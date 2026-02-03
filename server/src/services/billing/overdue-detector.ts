/**
 * Invoice Overdue Detector Service
 * PRD-092: Invoice Overdue - Collections Alert
 *
 * Detects overdue invoices, calculates context, and creates alerts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  Invoice,
  InvoiceOverdueAlert,
  CustomerBillingOverview,
  OverdueCheckResult,
  PaymentHistory,
  RelatedTicket,
  getSeverityFromDays,
  getAlertTypeFromDays,
  getMilestoneFromDays,
  getUrgencyFromSeverity,
  AlertSeverity,
  OverdueAlertType,
  DEFAULT_OVERDUE_CONFIG,
  OverdueAlertConfig,
} from './types.js';

// ============================================
// Overdue Detector Service
// ============================================

export class OverdueDetectorService {
  private supabase: SupabaseClient | null = null;
  private config: OverdueAlertConfig;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    this.config = DEFAULT_OVERDUE_CONFIG;
  }

  // ============================================
  // Main Detection Methods
  // ============================================

  /**
   * Check all overdue invoices and create alerts for new milestones
   * This is the main entry point, called daily by scheduler
   */
  async checkAllOverdue(): Promise<OverdueCheckResult[]> {
    if (!this.supabase) {
      throw new Error('Database not available');
    }

    console.log('[OverdueDetector] Starting overdue invoice check...');

    // Get all overdue invoices
    const { data: overdueInvoices, error } = await this.supabase
      .from('invoices')
      .select(`
        *,
        customers (
          id,
          name,
          health_score,
          csm_id,
          total_outstanding,
          overdue_invoice_count
        )
      `)
      .eq('status', 'overdue')
      .gt('days_overdue', 0)
      .order('days_overdue', { ascending: false });

    if (error) {
      console.error('[OverdueDetector] Error fetching overdue invoices:', error);
      throw error;
    }

    const results: OverdueCheckResult[] = [];

    for (const invoice of overdueInvoices || []) {
      const daysOverdue = invoice.days_overdue;
      const milestone = getMilestoneFromDays(daysOverdue);

      if (!milestone || !this.config.milestones.includes(milestone)) {
        continue; // Skip if not at a milestone
      }

      const alertType = getAlertTypeFromDays(daysOverdue);
      if (!alertType) continue;

      // Check if alert already exists for this milestone
      const existingAlert = await this.getExistingAlert(invoice.id, alertType);

      if (existingAlert) {
        // Alert already exists for this milestone
        results.push({
          customer_id: invoice.customer_id,
          customer_name: invoice.customers?.name || 'Unknown',
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          amount: invoice.amount,
          due_date: invoice.due_date,
          days_overdue: daysOverdue,
          milestone: alertType,
          severity: getSeverityFromDays(daysOverdue),
          is_new_alert: false,
          alert: existingAlert,
        });
        continue;
      }

      // Create new alert
      const alert = await this.createOverdueAlert(invoice, daysOverdue);

      results.push({
        customer_id: invoice.customer_id,
        customer_name: invoice.customers?.name || 'Unknown',
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        amount: invoice.amount,
        due_date: invoice.due_date,
        days_overdue: daysOverdue,
        milestone: alertType,
        severity: getSeverityFromDays(daysOverdue),
        is_new_alert: true,
        alert,
      });
    }

    console.log(`[OverdueDetector] Processed ${results.length} overdue invoices, ${results.filter(r => r.is_new_alert).length} new alerts`);

    return results;
  }

  /**
   * Check overdue status for a specific customer
   */
  async checkCustomerOverdue(customerId: string): Promise<OverdueCheckResult[]> {
    if (!this.supabase) {
      throw new Error('Database not available');
    }

    const { data: overdueInvoices, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('customer_id', customerId)
      .eq('status', 'overdue')
      .gt('days_overdue', 0);

    if (error) throw error;

    const results: OverdueCheckResult[] = [];
    const customer = await this.getCustomerBasicInfo(customerId);

    for (const invoice of overdueInvoices || []) {
      const daysOverdue = invoice.days_overdue;
      const alertType = getAlertTypeFromDays(daysOverdue);

      if (!alertType) continue;

      results.push({
        customer_id: customerId,
        customer_name: customer?.name || 'Unknown',
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        amount: invoice.amount,
        due_date: invoice.due_date,
        days_overdue: daysOverdue,
        milestone: alertType,
        severity: getSeverityFromDays(daysOverdue),
        is_new_alert: false,
      });
    }

    return results;
  }

  // ============================================
  // Billing Overview
  // ============================================

  /**
   * Get comprehensive billing overview for a customer
   */
  async getCustomerBillingOverview(customerId: string): Promise<CustomerBillingOverview> {
    if (!this.supabase) {
      throw new Error('Database not available');
    }

    // Get customer info
    const { data: customer, error: customerError } = await this.supabase
      .from('customers')
      .select('id, name, health_score, total_outstanding, oldest_overdue_days, overdue_invoice_count')
      .eq('id', customerId)
      .single();

    if (customerError) throw customerError;

    // Get all invoices
    const { data: invoices, error: invoicesError } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('customer_id', customerId)
      .order('due_date', { ascending: false });

    if (invoicesError) throw invoicesError;

    // Get payment history
    const paymentHistory = await this.getPaymentHistory(customerId);

    // Get open support tickets
    const openTickets = await this.getOpenSupportTickets(customerId);

    // Check if first time overdue
    const isFirstTimeOverdue = await this.isFirstTimeOverdue(customerId);

    return {
      customer_id: customerId,
      customer_name: customer.name,
      total_outstanding: customer.total_outstanding || 0,
      oldest_overdue_days: customer.oldest_overdue_days || 0,
      overdue_invoice_count: customer.overdue_invoice_count || 0,
      payment_history: paymentHistory,
      invoices: invoices || [],
      overdue_invoices: (invoices || []).filter((i: Invoice) => i.status === 'overdue'),
      is_first_time_overdue: isFirstTimeOverdue,
      health_score: customer.health_score,
      open_support_tickets: openTickets,
    };
  }

  // ============================================
  // Alert Creation
  // ============================================

  /**
   * Create an overdue alert with full context
   */
  private async createOverdueAlert(
    invoice: any,
    daysOverdue: number
  ): Promise<InvoiceOverdueAlert> {
    if (!this.supabase) {
      throw new Error('Database not available');
    }

    const customerId = invoice.customer_id;
    const severity = getSeverityFromDays(daysOverdue);
    const alertType = getAlertTypeFromDays(daysOverdue)!;
    const urgency = getUrgencyFromSeverity(severity);

    // Gather context
    const [
      paymentHistory,
      totalOutstanding,
      healthScore,
      lastMeeting,
      openTickets,
      relatedTickets,
      isFirstTimeOverdue,
      recentNps,
    ] = await Promise.all([
      this.getPaymentHistory(customerId),
      this.getTotalOutstanding(customerId),
      this.getHealthScore(customerId),
      this.getLastMeetingDate(customerId),
      this.getOpenSupportTickets(customerId),
      this.getRelatedTickets(customerId),
      this.isFirstTimeOverdue(customerId),
      this.getRecentNps(customerId),
    ]);

    // Generate recommended action
    const recommendedAction = this.generateRecommendedAction(
      daysOverdue,
      isFirstTimeOverdue,
      openTickets,
      healthScore
    );

    // Determine if potential dispute
    const potentialDispute = relatedTickets.some(
      (t) => t.subject.toLowerCase().includes('billing') ||
             t.subject.toLowerCase().includes('invoice') ||
             t.subject.toLowerCase().includes('charge')
    );

    const alertData = {
      customer_id: customerId,
      invoice_id: invoice.id,
      alert_type: alertType,
      severity,
      days_overdue: daysOverdue,
      invoice_amount: invoice.amount,
      total_outstanding: totalOutstanding,
      total_overdue_invoices: await this.getOverdueInvoiceCount(customerId),
      payment_history: paymentHistory,
      is_first_time_overdue: isFirstTimeOverdue,
      health_score: healthScore,
      last_meeting_date: lastMeeting,
      open_support_tickets: openTickets,
      recent_nps: recentNps,
      related_tickets: relatedTickets,
      potential_dispute: potentialDispute,
      recommended_action: recommendedAction,
      action_urgency: urgency,
      suggested_outreach_template: this.getOutreachTemplate(severity, isFirstTimeOverdue),
      status: 'pending' as const,
    };

    const { data, error } = await this.supabase
      .from('invoice_overdue_alerts')
      .insert(alertData)
      .select()
      .single();

    if (error) {
      console.error('[OverdueDetector] Error creating alert:', error);
      throw error;
    }

    console.log(`[OverdueDetector] Created ${alertType} alert for invoice ${invoice.invoice_number}`);

    return data as InvoiceOverdueAlert;
  }

  // ============================================
  // Context Gathering
  // ============================================

  private async getPaymentHistory(customerId: string): Promise<PaymentHistory> {
    if (!this.supabase) {
      return { on_time: 0, late: 0, avg_days_to_pay: 0, payment_behavior: 'unknown' };
    }

    const { data: payments } = await this.supabase
      .from('payment_records')
      .select('was_on_time, days_from_due, payment_date')
      .eq('customer_id', customerId)
      .order('payment_date', { ascending: false });

    if (!payments || payments.length === 0) {
      return { on_time: 0, late: 0, avg_days_to_pay: 0, payment_behavior: 'unknown' };
    }

    const onTime = payments.filter((p) => p.was_on_time).length;
    const late = payments.filter((p) => !p.was_on_time).length;
    const avgDays = payments.reduce((acc, p) => acc + (p.days_from_due || 0), 0) / payments.length;

    const onTimeRate = onTime / payments.length;
    let behavior: PaymentHistory['payment_behavior'] = 'unknown';

    if (onTimeRate >= 0.95) behavior = 'excellent';
    else if (onTimeRate >= 0.8) behavior = 'good';
    else if (onTimeRate >= 0.6) behavior = 'fair';
    else behavior = 'poor';

    return {
      on_time: onTime,
      late: late,
      avg_days_to_pay: Math.round(avgDays),
      last_payment_date: payments[0]?.payment_date ? new Date(payments[0].payment_date) : undefined,
      payment_behavior: behavior,
    };
  }

  private async getTotalOutstanding(customerId: string): Promise<number> {
    if (!this.supabase) return 0;

    const { data } = await this.supabase
      .from('invoices')
      .select('amount, amount_paid')
      .eq('customer_id', customerId)
      .not('status', 'in', '("paid","void")');

    return (data || []).reduce((acc, i) => acc + (i.amount - i.amount_paid), 0);
  }

  private async getHealthScore(customerId: string): Promise<number | undefined> {
    if (!this.supabase) return undefined;

    const { data } = await this.supabase
      .from('customers')
      .select('health_score')
      .eq('id', customerId)
      .single();

    return data?.health_score;
  }

  private async getLastMeetingDate(customerId: string): Promise<Date | undefined> {
    if (!this.supabase) return undefined;

    const { data } = await this.supabase
      .from('meetings')
      .select('start_time')
      .eq('customer_id', customerId)
      .lte('start_time', new Date().toISOString())
      .order('start_time', { ascending: false })
      .limit(1);

    return data?.[0]?.start_time ? new Date(data[0].start_time) : undefined;
  }

  private async getOpenSupportTickets(customerId: string): Promise<number> {
    if (!this.supabase) return 0;

    // Try to query support_tickets table if it exists
    const { count } = await this.supabase
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .not('status', 'in', '("closed","resolved")');

    return count || 0;
  }

  private async getRelatedTickets(customerId: string): Promise<RelatedTicket[]> {
    if (!this.supabase) return [];

    const { data } = await this.supabase
      .from('support_tickets')
      .select('id, subject, status, created_at')
      .eq('customer_id', customerId)
      .not('status', 'in', '("closed","resolved")')
      .order('created_at', { ascending: false })
      .limit(5);

    return (data || []).map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      created_at: new Date(t.created_at),
    }));
  }

  private async isFirstTimeOverdue(customerId: string): Promise<boolean> {
    if (!this.supabase) return true;

    // Check if there have been any previous overdue alerts that were resolved
    const { count } = await this.supabase
      .from('invoice_overdue_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('status', 'resolved');

    return (count || 0) === 0;
  }

  private async getRecentNps(customerId: string): Promise<number | undefined> {
    if (!this.supabase) return undefined;

    const { data } = await this.supabase
      .from('nps_responses')
      .select('score')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1);

    return data?.[0]?.score;
  }

  private async getOverdueInvoiceCount(customerId: string): Promise<number> {
    if (!this.supabase) return 1;

    const { count } = await this.supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('status', 'overdue');

    return count || 1;
  }

  private async getExistingAlert(
    invoiceId: string,
    alertType: OverdueAlertType
  ): Promise<InvoiceOverdueAlert | null> {
    if (!this.supabase) return null;

    const { data } = await this.supabase
      .from('invoice_overdue_alerts')
      .select('*')
      .eq('invoice_id', invoiceId)
      .eq('alert_type', alertType)
      .neq('status', 'resolved')
      .single();

    return data as InvoiceOverdueAlert | null;
  }

  private async getCustomerBasicInfo(customerId: string): Promise<{ name: string } | null> {
    if (!this.supabase) return null;

    const { data } = await this.supabase
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .single();

    return data;
  }

  // ============================================
  // Recommendation Generation
  // ============================================

  private generateRecommendedAction(
    daysOverdue: number,
    isFirstTimeOverdue: boolean,
    openTickets: number,
    healthScore?: number
  ): string {
    // If open support tickets, might be related issue
    if (openTickets > 0) {
      return 'Check open support tickets first - payment delay may be related to service issues.';
    }

    // First-time overdue with good health
    if (isFirstTimeOverdue && (healthScore === undefined || healthScore >= 70)) {
      return 'This is their first overdue invoice and health is good. Send a friendly reminder - likely administrative delay.';
    }

    // First-time but poor health
    if (isFirstTimeOverdue && healthScore !== undefined && healthScore < 50) {
      return 'First overdue but health score is concerning. Schedule a check-in call to understand if there are underlying issues.';
    }

    // Repeat offender
    if (!isFirstTimeOverdue) {
      if (daysOverdue >= 30) {
        return 'Repeat payment issue - escalate to finance and consider payment plan discussion.';
      }
      return 'Not their first late payment. Direct outreach recommended to understand payment timeline.';
    }

    // Default based on severity
    if (daysOverdue >= 60) {
      return 'Critical: Immediate outreach required. Coordinate with finance on collections process.';
    }
    if (daysOverdue >= 30) {
      return 'Escalate to manager. Direct call to billing contact recommended.';
    }

    return 'Send soft check-in email to understand payment timeline.';
  }

  private getOutreachTemplate(severity: AlertSeverity, isFirstTimeOverdue: boolean): string {
    if (isFirstTimeOverdue && severity === 'low') {
      return `Subject: Quick check-in on invoice payment

Hi {{contact_name}},

I hope you're doing well! I wanted to reach out regarding invoice #{{invoice_number}} that was due on {{due_date}}.

I'm sure this is just an administrative oversight, but I wanted to make sure there are no issues on our end that might be causing a delay.

Is there anything I can help with?

Best,
{{csm_name}}`;
    }

    if (severity === 'high' || severity === 'critical') {
      return `Subject: Urgent: Invoice #{{invoice_number}} - {{days_overdue}} days overdue

Hi {{contact_name}},

I'm reaching out regarding invoice #{{invoice_number}} for ${{amount}}, which is now {{days_overdue}} days past due.

I want to ensure there are no concerns on your end and discuss options to resolve this promptly.

Could we schedule a quick call this week?

Best,
{{csm_name}}`;
    }

    return `Subject: Follow-up: Invoice #{{invoice_number}}

Hi {{contact_name}},

I'm following up on invoice #{{invoice_number}} which is currently {{days_overdue}} days past the due date.

Please let me know if you have any questions about the invoice or if there's anything I can help clarify.

Best,
{{csm_name}}`;
  }

  // ============================================
  // Alert Management
  // ============================================

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    if (!this.supabase) throw new Error('Database not available');

    await this.supabase
      .from('invoice_overdue_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
      })
      .eq('id', alertId);
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(
    alertId: string,
    userId: string,
    resolutionType: string,
    notes?: string
  ): Promise<void> {
    if (!this.supabase) throw new Error('Database not available');

    await this.supabase
      .from('invoice_overdue_alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
        resolution_type: resolutionType,
        resolution_notes: notes,
      })
      .eq('id', alertId);
  }

  /**
   * Get pending alerts for a CSM
   */
  async getPendingAlerts(csmId?: string): Promise<InvoiceOverdueAlert[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('invoice_overdue_alerts')
      .select(`
        *,
        invoices (invoice_number, amount, due_date),
        customers (name, arr)
      `)
      .in('status', ['pending', 'acknowledged', 'in_progress'])
      .order('severity', { ascending: false })
      .order('days_overdue', { ascending: false });

    if (csmId) {
      query = query.eq('customers.csm_id', csmId);
    }

    const { data } = await query;
    return (data || []) as InvoiceOverdueAlert[];
  }

  /**
   * Mark as CSM notified
   */
  async markCsmNotified(alertId: string, slackTs?: string): Promise<void> {
    if (!this.supabase) throw new Error('Database not available');

    await this.supabase
      .from('invoice_overdue_alerts')
      .update({
        csm_notified: true,
        csm_notified_at: new Date().toISOString(),
        slack_message_ts: slackTs,
      })
      .eq('id', alertId);
  }

  /**
   * Mark as finance notified
   */
  async markFinanceNotified(alertId: string): Promise<void> {
    if (!this.supabase) throw new Error('Database not available');

    await this.supabase
      .from('invoice_overdue_alerts')
      .update({
        finance_notified: true,
        finance_notified_at: new Date().toISOString(),
      })
      .eq('id', alertId);
  }
}

// Singleton instance
export const overdueDetector = new OverdueDetectorService();
