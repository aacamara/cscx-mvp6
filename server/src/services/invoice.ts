/**
 * Invoice Notification Service
 * PRD-125: Invoice Generated -> CSM Notification
 *
 * Handles invoice detection, context enrichment, risk assessment,
 * and CSM notifications for billing events.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  InvoiceNotification,
  InvoiceStatus,
  BillingSource,
  InvoiceRiskFlag,
  PaymentHistory,
  InvoiceCustomerContext,
  StripeInvoiceWebhook,
  ChargebeeInvoiceWebhook,
  ManualInvoiceUpload,
  InvoiceNotificationFilters,
  InvoiceDashboard,
  ValueReinforcementPrompt,
  InvoiceNotificationPreferences,
  InvoiceNotificationEvent,
} from '../types/invoice.js';

// ============================================
// In-Memory Storage (Replace with DB in production)
// ============================================

const invoiceNotifications: Map<string, InvoiceNotification> = new Map();
const notificationPreferences: Map<string, InvoiceNotificationPreferences> = new Map();

// Mock customer data for demo
const mockCustomers: Map<string, {
  id: string;
  name: string;
  csmId: string;
  csmName: string;
  healthScore: number;
  healthTrend: 'improving' | 'stable' | 'declining';
  paymentHistory: PaymentHistory;
  renewalDate: Date | null;
  recentIssues: boolean;
  recentIssueCount: number;
  contractValue: number;
  segment: string;
  invoiceHistory: Array<{ invoiceId: string; amount: number; paidOnTime: boolean }>;
  primaryContact?: { name: string; email: string; title?: string };
}> = new Map([
  ['cust-001', {
    id: 'cust-001',
    name: 'Acme Corp',
    csmId: 'csm-001',
    csmName: 'Sarah Chen',
    healthScore: 85,
    healthTrend: 'stable',
    paymentHistory: 'excellent',
    renewalDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    recentIssues: false,
    recentIssueCount: 0,
    contractValue: 250000,
    segment: 'Enterprise',
    invoiceHistory: [
      { invoiceId: 'inv-prev-1', amount: 25000, paidOnTime: true },
      { invoiceId: 'inv-prev-2', amount: 25000, paidOnTime: true },
    ],
    primaryContact: { name: 'John Smith', email: 'john@acme.com', title: 'VP Engineering' },
  }],
  ['cust-002', {
    id: 'cust-002',
    name: 'TechStart Inc',
    csmId: 'csm-001',
    csmName: 'Sarah Chen',
    healthScore: 45,
    healthTrend: 'declining',
    paymentHistory: 'fair',
    renewalDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
    recentIssues: true,
    recentIssueCount: 3,
    contractValue: 75000,
    segment: 'Mid-Market',
    invoiceHistory: [
      { invoiceId: 'inv-prev-3', amount: 7500, paidOnTime: false },
      { invoiceId: 'inv-prev-4', amount: 7500, paidOnTime: true },
    ],
    primaryContact: { name: 'Lisa Park', email: 'lisa@techstart.io', title: 'CTO' },
  }],
  ['cust-003', {
    id: 'cust-003',
    name: 'GlobalRetail Co',
    csmId: 'csm-002',
    csmName: 'Marcus Johnson',
    healthScore: 72,
    healthTrend: 'improving',
    paymentHistory: 'good',
    renewalDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    recentIssues: false,
    recentIssueCount: 0,
    contractValue: 500000,
    segment: 'Strategic',
    invoiceHistory: [
      { invoiceId: 'inv-prev-5', amount: 50000, paidOnTime: true },
    ],
    primaryContact: { name: 'Robert Chen', email: 'rchen@globalretail.com', title: 'Director of Operations' },
  }],
]);

// ============================================
// Invoice Service
// ============================================

class InvoiceService {
  private eventCallbacks: Array<(event: InvoiceNotificationEvent) => void> = [];

  /**
   * Register a callback for invoice notification events
   */
  onEvent(callback: (event: InvoiceNotificationEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Emit an event to all registered callbacks
   */
  private emitEvent(event: InvoiceNotificationEvent): void {
    this.eventCallbacks.forEach(cb => {
      try {
        cb(event);
      } catch (err) {
        console.error('[InvoiceService] Event callback error:', err);
      }
    });
  }

  // ============================================
  // Webhook Handlers
  // ============================================

  /**
   * Process Stripe invoice webhook
   */
  async processStripeWebhook(webhook: StripeInvoiceWebhook): Promise<InvoiceNotification> {
    console.log('[InvoiceService] Processing Stripe webhook:', webhook.id);

    // Map Stripe customer to internal customer
    const customerId = webhook.metadata?.cscx_customer_id || this.findCustomerByEmail(webhook.customer_email);

    if (!customerId) {
      throw new Error(`Customer not found for Stripe customer: ${webhook.customer}`);
    }

    const notification = await this.createNotification({
      invoiceId: webhook.id,
      invoiceNumber: webhook.number,
      customerId,
      amount: webhook.amount_due / 100, // Convert cents to dollars
      currency: webhook.currency.toUpperCase(),
      dueDate: new Date(webhook.due_date * 1000),
      status: this.mapStripeStatus(webhook.status),
      billingSource: 'stripe',
    });

    return notification;
  }

  /**
   * Process Chargebee invoice webhook
   */
  async processChargebeeWebhook(webhook: ChargebeeInvoiceWebhook): Promise<InvoiceNotification> {
    console.log('[InvoiceService] Processing Chargebee webhook:', webhook.id);

    const customerId = this.findCustomerByChargebeeId(webhook.customer_id);

    if (!customerId) {
      throw new Error(`Customer not found for Chargebee customer: ${webhook.customer_id}`);
    }

    const notification = await this.createNotification({
      invoiceId: webhook.id,
      invoiceNumber: webhook.invoice_number,
      customerId,
      amount: webhook.total / 100, // Convert cents to dollars
      currency: webhook.currency_code,
      dueDate: new Date(webhook.due_date * 1000),
      status: this.mapChargebeeStatus(webhook.status),
      billingSource: 'chargebee',
    });

    return notification;
  }

  /**
   * Process manual invoice upload
   */
  async processManualUpload(data: ManualInvoiceUpload): Promise<InvoiceNotification> {
    console.log('[InvoiceService] Processing manual upload for:', data.customerName);

    const notification = await this.createNotification({
      invoiceId: `manual-${uuidv4()}`,
      invoiceNumber: data.invoiceNumber,
      customerId: data.customerId,
      amount: data.amount,
      currency: data.currency,
      dueDate: new Date(data.dueDate),
      status: 'pending',
      billingSource: 'manual',
    });

    return notification;
  }

  // ============================================
  // Core Notification Logic
  // ============================================

  /**
   * Create a new invoice notification with context enrichment
   */
  private async createNotification(params: {
    invoiceId: string;
    invoiceNumber?: string;
    customerId: string;
    amount: number;
    currency: string;
    dueDate: Date;
    status: InvoiceStatus;
    billingSource: BillingSource;
  }): Promise<InvoiceNotification> {
    const customer = mockCustomers.get(params.customerId);

    if (!customer) {
      throw new Error(`Customer not found: ${params.customerId}`);
    }

    // Enrich with customer context
    const customerContext = this.buildCustomerContext(customer);

    // Assess risks
    const riskFlags = this.assessRisks(params, customer, customerContext);
    const riskScore = this.calculateRiskScore(riskFlags);

    // Generate recommended actions
    const recommendedActions = this.generateRecommendedActions(riskFlags, customerContext, params.amount);

    const notification: InvoiceNotification = {
      id: uuidv4(),
      invoiceId: params.invoiceId,
      invoiceNumber: params.invoiceNumber,
      customerId: params.customerId,
      customerName: customer.name,
      csmId: customer.csmId,
      amount: params.amount,
      currency: params.currency,
      dueDate: params.dueDate,
      status: params.status,
      billingSource: params.billingSource,
      riskFlags,
      riskScore,
      customerContext,
      recommendedActions,
      notifiedAt: new Date(),
      acknowledgedAt: null,
      actionTaken: null,
      paymentReceivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store notification
    invoiceNotifications.set(notification.id, notification);

    // Emit event for real-time notifications
    this.emitEvent({
      type: 'invoice:created',
      notification,
      timestamp: new Date().toISOString(),
    });

    // Send notifications based on preferences
    await this.sendNotifications(notification);

    console.log('[InvoiceService] Created notification:', notification.id, 'Risk Score:', riskScore);

    return notification;
  }

  /**
   * Build customer context from customer data
   */
  private buildCustomerContext(customer: typeof mockCustomers extends Map<string, infer V> ? V : never): InvoiceCustomerContext {
    const daysToRenewal = customer.renewalDate
      ? Math.ceil((customer.renewalDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : null;

    return {
      healthScore: customer.healthScore,
      healthTrend: customer.healthTrend,
      paymentHistory: customer.paymentHistory,
      renewalDate: customer.renewalDate,
      daysToRenewal,
      recentIssues: customer.recentIssues,
      recentIssueCount: customer.recentIssueCount,
      contractValue: customer.contractValue,
      segment: customer.segment,
      csmName: customer.csmName,
      primaryContact: customer.primaryContact,
      valueDelivered: this.generateValueSummary(customer),
    };
  }

  /**
   * Generate value summary for customer
   */
  private generateValueSummary(customer: typeof mockCustomers extends Map<string, infer V> ? V : never) {
    // In production, this would pull from actual usage/metrics data
    return {
      summary: `${customer.name} has achieved significant value this period.`,
      metrics: [
        { name: 'Active Users', value: '247', change: '+12%' },
        { name: 'Feature Adoption', value: '78%', change: '+5%' },
        { name: 'Support Tickets', value: '3', change: '-40%' },
      ],
    };
  }

  // ============================================
  // Risk Assessment
  // ============================================

  /**
   * Assess invoice risks based on multiple factors
   */
  private assessRisks(
    params: { amount: number; customerId: string },
    customer: typeof mockCustomers extends Map<string, infer V> ? V : never,
    context: InvoiceCustomerContext
  ): InvoiceRiskFlag[] {
    const flags: InvoiceRiskFlag[] = [];

    // First invoice check
    if (customer.invoiceHistory.length === 0) {
      flags.push('first_invoice');
    }

    // Significant amount change (>20% from average)
    if (customer.invoiceHistory.length > 0) {
      const avgAmount = customer.invoiceHistory.reduce((sum, inv) => sum + inv.amount, 0) / customer.invoiceHistory.length;
      const changePercent = Math.abs((params.amount - avgAmount) / avgAmount);
      if (changePercent > 0.2) {
        flags.push('significant_amount_change');
      }
    }

    // Declining health
    if (context.healthTrend === 'declining' || context.healthScore < 50) {
      flags.push('declining_health');
    }

    // Late payment history
    if (context.paymentHistory === 'fair' || context.paymentHistory === 'poor') {
      flags.push('late_payment_history');
    }

    // High value (>$50k)
    if (params.amount > 50000) {
      flags.push('high_value');
    }

    // Renewal approaching (within 90 days)
    if (context.daysToRenewal !== null && context.daysToRenewal <= 90) {
      flags.push('renewal_approaching');
    }

    // Recent support issues
    if (context.recentIssues) {
      flags.push('support_issues');
    }

    return flags;
  }

  /**
   * Calculate overall risk score from flags
   */
  private calculateRiskScore(flags: InvoiceRiskFlag[]): number {
    const flagWeights: Record<InvoiceRiskFlag, number> = {
      'first_invoice': 15,
      'significant_amount_change': 10,
      'declining_health': 25,
      'late_payment_history': 30,
      'contract_dispute': 35,
      'high_value': 10,
      'renewal_approaching': 15,
      'support_issues': 20,
    };

    const totalWeight = flags.reduce((sum, flag) => sum + (flagWeights[flag] || 0), 0);
    return Math.min(100, totalWeight);
  }

  /**
   * Generate recommended actions based on risk assessment
   */
  private generateRecommendedActions(
    flags: InvoiceRiskFlag[],
    context: InvoiceCustomerContext,
    amount: number
  ): string[] {
    const actions: string[] = [];

    if (flags.includes('first_invoice')) {
      actions.push('Schedule welcome call to ensure smooth first payment process');
    }

    if (flags.includes('declining_health')) {
      actions.push('Reach out proactively to address any concerns before payment due date');
    }

    if (flags.includes('late_payment_history')) {
      actions.push('Send reminder 7 days before due date with payment options');
    }

    if (flags.includes('high_value')) {
      actions.push('Prepare value summary to send alongside payment reminder');
    }

    if (flags.includes('renewal_approaching')) {
      actions.push(`Discuss renewal (${context.daysToRenewal} days away) during payment follow-up`);
    }

    if (flags.includes('support_issues')) {
      actions.push(`Acknowledge recent support issues (${context.recentIssueCount} tickets) and confirm resolution`);
    }

    if (flags.includes('significant_amount_change')) {
      actions.push('Explain any changes in invoice amount proactively');
    }

    // Default action if no specific risks
    if (actions.length === 0) {
      actions.push('Standard payment reminder if not received by due date');
    }

    return actions;
  }

  // ============================================
  // Notification Delivery
  // ============================================

  /**
   * Send notifications through configured channels
   */
  private async sendNotifications(notification: InvoiceNotification): Promise<void> {
    const prefs = notificationPreferences.get(notification.csmId) || this.getDefaultPreferences(notification.csmId);

    // In-app notification (always enabled via WebSocket events)
    console.log('[InvoiceService] In-app notification sent for:', notification.customerName);

    // Slack notification for high-value invoices
    if (prefs.channels.slack && notification.amount >= prefs.thresholds.minAmountForSlack) {
      await this.sendSlackNotification(notification);
    }

    // Queue for email digest (would be processed by scheduled job)
    if (prefs.channels.emailDigest) {
      console.log('[InvoiceService] Queued for email digest:', notification.id);
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(notification: InvoiceNotification): Promise<void> {
    const riskEmoji = notification.riskScore > 50 ? ':warning:' : notification.riskScore > 25 ? ':large_yellow_circle:' : ':white_check_mark:';

    const message = {
      channel: 'csm-alerts', // Would be configured per CSM
      text: `${riskEmoji} Invoice Generated: ${notification.customerName}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Invoice for ${notification.customerName}*\nAmount: ${this.formatCurrency(notification.amount, notification.currency)} | Due: ${this.formatDate(notification.dueDate)}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Health: ${notification.customerContext.healthScore}/100 | Payment History: ${notification.customerContext.paymentHistory}`,
            },
          ],
        },
        ...(notification.riskFlags.length > 0 ? [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Risk Flags:* ${notification.riskFlags.map(f => f.replace(/_/g, ' ')).join(', ')}`,
          },
        }] : []),
      ],
    };

    console.log('[InvoiceService] Would send Slack message:', JSON.stringify(message, null, 2));
  }

  /**
   * Get default notification preferences
   */
  private getDefaultPreferences(csmId: string): InvoiceNotificationPreferences {
    return {
      csmId,
      channels: {
        inApp: true,
        slack: true,
        emailDigest: true,
      },
      thresholds: {
        minAmountForSlack: 10000, // Slack for invoices > $10k
        minAmountForImmediate: 5000, // Immediate notification for > $5k
      },
      digestSchedule: 'daily',
      digestTime: '09:00',
    };
  }

  // ============================================
  // Query Methods
  // ============================================

  /**
   * Get notifications for a CSM with filters
   */
  async getNotificationsForCSM(
    csmId: string,
    filters: InvoiceNotificationFilters = {},
    page = 1,
    pageSize = 20
  ): Promise<{
    notifications: InvoiceNotification[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
    summary: { totalPending: number; totalOverdue: number; totalAtRisk: number; totalAmount: number };
  }> {
    let notifications = Array.from(invoiceNotifications.values())
      .filter(n => n.csmId === csmId);

    // Apply filters
    if (filters.status && filters.status !== 'all') {
      notifications = notifications.filter(n => n.status === filters.status);
    }
    if (filters.customerId) {
      notifications = notifications.filter(n => n.customerId === filters.customerId);
    }
    if (filters.minAmount !== undefined) {
      notifications = notifications.filter(n => n.amount >= filters.minAmount!);
    }
    if (filters.maxAmount !== undefined) {
      notifications = notifications.filter(n => n.amount <= filters.maxAmount!);
    }
    if (filters.hasRiskFlags) {
      notifications = notifications.filter(n => n.riskFlags.length > 0);
    }
    if (filters.acknowledged !== undefined) {
      notifications = notifications.filter(n =>
        filters.acknowledged ? n.acknowledgedAt !== null : n.acknowledgedAt === null
      );
    }

    // Sort by date (newest first)
    notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = notifications.length;
    const totalPages = Math.ceil(total / pageSize);

    // Paginate
    const start = (page - 1) * pageSize;
    const paginatedNotifications = notifications.slice(start, start + pageSize);

    // Calculate summary from all matching notifications (not just page)
    const summary = {
      totalPending: notifications.filter(n => n.status === 'pending').length,
      totalOverdue: notifications.filter(n => n.status === 'overdue').length,
      totalAtRisk: notifications.filter(n => n.riskScore >= 50).length,
      totalAmount: notifications.reduce((sum, n) => sum + n.amount, 0),
    };

    return {
      notifications: paginatedNotifications,
      pagination: { page, pageSize, total, totalPages },
      summary,
    };
  }

  /**
   * Get notifications for a specific customer
   */
  async getNotificationsForCustomer(customerId: string): Promise<InvoiceNotification[]> {
    return Array.from(invoiceNotifications.values())
      .filter(n => n.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get a single notification by ID
   */
  async getNotificationById(id: string): Promise<InvoiceNotification | null> {
    return invoiceNotifications.get(id) || null;
  }

  /**
   * Get pending notifications for a CSM
   */
  async getPendingForCSM(csmId: string): Promise<InvoiceNotification[]> {
    return Array.from(invoiceNotifications.values())
      .filter(n => n.csmId === csmId && n.status === 'pending' && !n.acknowledgedAt)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  // ============================================
  // Actions
  // ============================================

  /**
   * Acknowledge a notification
   */
  async acknowledgeNotification(id: string, actionTaken?: string): Promise<InvoiceNotification | null> {
    const notification = invoiceNotifications.get(id);
    if (!notification) return null;

    notification.acknowledgedAt = new Date();
    notification.actionTaken = actionTaken || null;
    notification.updatedAt = new Date();

    invoiceNotifications.set(id, notification);

    return notification;
  }

  /**
   * Update invoice status (e.g., when payment is received)
   */
  async updateInvoiceStatus(
    invoiceId: string,
    status: InvoiceStatus,
    paymentDate?: Date
  ): Promise<InvoiceNotification | null> {
    // Find notification by invoice ID
    const notification = Array.from(invoiceNotifications.values())
      .find(n => n.invoiceId === invoiceId);

    if (!notification) return null;

    const previousStatus = notification.status;
    notification.status = status;
    notification.updatedAt = new Date();

    if (status === 'paid' && paymentDate) {
      notification.paymentReceivedAt = paymentDate;
    }

    invoiceNotifications.set(notification.id, notification);

    // Emit appropriate event
    if (status === 'paid') {
      this.emitEvent({
        type: 'invoice:paid',
        notification,
        timestamp: new Date().toISOString(),
      });
    } else if (status === 'overdue' && previousStatus !== 'overdue') {
      this.emitEvent({
        type: 'invoice:overdue',
        notification,
        timestamp: new Date().toISOString(),
      });
    } else {
      this.emitEvent({
        type: 'invoice:updated',
        notification,
        timestamp: new Date().toISOString(),
      });
    }

    return notification;
  }

  // ============================================
  // Dashboard
  // ============================================

  /**
   * Get invoice dashboard for a CSM
   */
  async getDashboard(csmId: string): Promise<InvoiceDashboard> {
    const allNotifications = Array.from(invoiceNotifications.values())
      .filter(n => n.csmId === csmId);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const pending = allNotifications.filter(n => n.status === 'pending');
    const overdue = allNotifications.filter(n => n.status === 'overdue');
    const atRisk = allNotifications.filter(n => n.riskScore >= 50 && n.status === 'pending');
    const paidThisMonth = allNotifications.filter(n =>
      n.status === 'paid' && n.paymentReceivedAt && n.paymentReceivedAt >= startOfMonth
    );

    // Calculate collection rate (paid on time / total paid this month)
    const paidOnTime = paidThisMonth.filter(n =>
      n.paymentReceivedAt && n.paymentReceivedAt <= n.dueDate
    );
    const collectionRate = paidThisMonth.length > 0
      ? (paidOnTime.length / paidThisMonth.length) * 100
      : 100;

    // Upcoming due dates (next 14 days)
    const upcomingDueDates = pending
      .filter(n => {
        const daysUntil = Math.ceil((n.dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        return daysUntil >= 0 && daysUntil <= 14;
      })
      .map(n => ({
        notification: n,
        daysUntilDue: Math.ceil((n.dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
      }))
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    // Risk alerts
    const riskAlerts = atRisk.map(n => ({
      notification: n,
      primaryRisk: n.riskFlags[0],
      recommendedAction: n.recommendedActions[0] || 'Review account status',
    }));

    // Value reinforcement queue (for strategic accounts with pending invoices)
    const valueReinforcementQueue = pending
      .filter(n => n.customerContext.segment === 'Strategic' || n.customerContext.segment === 'Enterprise')
      .map(n => this.buildValueReinforcementPrompt(n));

    return {
      csmId,
      summary: {
        pendingCount: pending.length,
        pendingAmount: pending.reduce((sum, n) => sum + n.amount, 0),
        overdueCount: overdue.length,
        overdueAmount: overdue.reduce((sum, n) => sum + n.amount, 0),
        atRiskCount: atRisk.length,
        atRiskAmount: atRisk.reduce((sum, n) => sum + n.amount, 0),
        paidThisMonth: paidThisMonth.reduce((sum, n) => sum + n.amount, 0),
        collectionRate,
      },
      recentNotifications: allNotifications
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5),
      upcomingDueDates,
      riskAlerts,
      valueReinforcementQueue,
    };
  }

  /**
   * Build value reinforcement prompt for a notification
   */
  private buildValueReinforcementPrompt(notification: InvoiceNotification): ValueReinforcementPrompt {
    return {
      customerId: notification.customerId,
      customerName: notification.customerName,
      invoiceId: notification.invoiceId,
      invoiceAmount: notification.amount,
      actions: [
        {
          id: `${notification.id}-value-summary`,
          type: 'send_value_summary',
          label: 'Send Value Summary',
          description: 'Send a summary of value delivered this period before payment',
          priority: 'high',
          template: 'value-summary-email',
        },
        {
          id: `${notification.id}-schedule-checkin`,
          type: 'schedule_checkin',
          label: 'Schedule Check-in',
          description: 'Schedule a quick check-in call to address any concerns',
          priority: 'medium',
        },
        {
          id: `${notification.id}-share-metrics`,
          type: 'share_metrics',
          label: 'Share Success Metrics',
          description: 'Share recent usage and success metrics',
          priority: 'medium',
        },
        {
          id: `${notification.id}-address-concerns`,
          type: 'address_concerns',
          label: 'Address Concerns',
          description: 'Proactively reach out to address any known concerns',
          priority: notification.customerContext.recentIssues ? 'high' : 'low',
        },
      ],
      valueSummary: notification.customerContext.valueDelivered ? {
        keyWins: ['Reduced support ticket volume by 40%', 'Achieved 78% feature adoption'],
        metrics: notification.customerContext.valueDelivered.metrics || [],
      } : undefined,
    };
  }

  // ============================================
  // Payment Tracking Job
  // ============================================

  /**
   * Check for overdue invoices (called by scheduled job)
   */
  async checkOverdueInvoices(): Promise<number> {
    const now = new Date();
    let overdueCount = 0;

    for (const [id, notification] of invoiceNotifications) {
      if (notification.status === 'pending' && notification.dueDate < now) {
        notification.status = 'overdue';
        notification.updatedAt = new Date();
        invoiceNotifications.set(id, notification);

        this.emitEvent({
          type: 'invoice:overdue',
          notification,
          timestamp: new Date().toISOString(),
        });

        overdueCount++;
        console.log('[InvoiceService] Invoice marked overdue:', notification.invoiceId, 'Customer:', notification.customerName);
      }
    }

    return overdueCount;
  }

  // ============================================
  // Preferences
  // ============================================

  /**
   * Update notification preferences for a CSM
   */
  async updatePreferences(prefs: InvoiceNotificationPreferences): Promise<void> {
    notificationPreferences.set(prefs.csmId, prefs);
  }

  /**
   * Get notification preferences for a CSM
   */
  async getPreferences(csmId: string): Promise<InvoiceNotificationPreferences> {
    return notificationPreferences.get(csmId) || this.getDefaultPreferences(csmId);
  }

  // ============================================
  // Helper Methods
  // ============================================

  private findCustomerByEmail(email?: string): string | null {
    if (!email) return null;
    // In production, this would query the customer database
    return 'cust-001'; // Demo fallback
  }

  private findCustomerByChargebeeId(chargebeeId: string): string | null {
    // In production, this would query the customer database
    return 'cust-001'; // Demo fallback
  }

  private mapStripeStatus(status: string): InvoiceStatus {
    switch (status) {
      case 'paid':
        return 'paid';
      case 'open':
      case 'draft':
        return 'pending';
      case 'uncollectible':
        return 'failed';
      default:
        return 'pending';
    }
  }

  private mapChargebeeStatus(status: string): InvoiceStatus {
    switch (status) {
      case 'paid':
        return 'paid';
      case 'pending':
      case 'posted':
      case 'payment_due':
        return 'pending';
      case 'not_paid':
        return 'overdue';
      default:
        return 'pending';
    }
  }

  private formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // ============================================
  // Demo Data Seeding
  // ============================================

  /**
   * Seed demo notifications for testing
   */
  async seedDemoData(): Promise<void> {
    console.log('[InvoiceService] Seeding demo data...');

    // Create sample invoices for each customer
    const demoInvoices = [
      {
        invoiceId: 'inv-stripe-001',
        invoiceNumber: 'INV-2026-0042',
        customerId: 'cust-001',
        amount: 25000,
        currency: 'USD',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        status: 'pending' as InvoiceStatus,
        billingSource: 'stripe' as BillingSource,
      },
      {
        invoiceId: 'inv-stripe-002',
        invoiceNumber: 'INV-2026-0043',
        customerId: 'cust-002',
        amount: 7500,
        currency: 'USD',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        status: 'pending' as InvoiceStatus,
        billingSource: 'stripe' as BillingSource,
      },
      {
        invoiceId: 'inv-chargebee-001',
        invoiceNumber: 'INV-2026-0044',
        customerId: 'cust-003',
        amount: 50000,
        currency: 'USD',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        status: 'pending' as InvoiceStatus,
        billingSource: 'chargebee' as BillingSource,
      },
      {
        invoiceId: 'inv-manual-001',
        invoiceNumber: 'INV-2026-0041',
        customerId: 'cust-001',
        amount: 25000,
        currency: 'USD',
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago (overdue)
        status: 'overdue' as InvoiceStatus,
        billingSource: 'manual' as BillingSource,
      },
    ];

    for (const invoice of demoInvoices) {
      const customer = mockCustomers.get(invoice.customerId);
      if (!customer) continue;

      const customerContext = this.buildCustomerContext(customer);
      const riskFlags = this.assessRisks(invoice, customer, customerContext);
      const riskScore = this.calculateRiskScore(riskFlags);
      const recommendedActions = this.generateRecommendedActions(riskFlags, customerContext, invoice.amount);

      const notification: InvoiceNotification = {
        id: uuidv4(),
        ...invoice,
        customerName: customer.name,
        csmId: customer.csmId,
        riskFlags,
        riskScore,
        customerContext,
        recommendedActions,
        notifiedAt: new Date(),
        acknowledgedAt: null,
        actionTaken: null,
        paymentReceivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      invoiceNotifications.set(notification.id, notification);
    }

    console.log('[InvoiceService] Seeded', invoiceNotifications.size, 'demo notifications');
  }
}

// Export singleton instance
export const invoiceService = new InvoiceService();
