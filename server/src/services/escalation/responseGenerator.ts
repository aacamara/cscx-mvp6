/**
 * Escalation Response Generator Service
 * PRD-029: Escalation Response Drafting
 *
 * Generates context-aware escalation responses based on:
 * - Escalation source and type
 * - Customer history and relationship
 * - Severity level
 * - SLA requirements
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  EscalationType,
  EscalationSeverity,
  EscalationContext,
  EscalationTemplate,
  generateEscalationResponse,
  generateEscalationResponseHtml,
} from '../../templates/emails/escalation-response.js';

// Types
export interface RiskSignal {
  id: string;
  customer_id: string;
  signal_type: string;
  severity: string;
  description: string;
  detected_at: string;
  resolved_at: string | null;
  metadata: Record<string, any>;
  escalation_type?: string;
  reported_by_name?: string;
  reported_by_email?: string;
  reported_by_title?: string;
  response_sent_at?: string;
  response_email_id?: string;
}

export interface Customer {
  id: string;
  name: string;
  industry?: string;
  arr: number;
  health_score: number;
  stage: string;
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_title?: string;
}

export interface EscalationDetails {
  riskSignal: RiskSignal;
  customer: Customer;
  escalationType: EscalationType;
  severity: EscalationSeverity;
  issueDescription: string;
  issueDuration: string;
  reportedBy: {
    name: string;
    email: string;
    title?: string;
  };
  recentCommunications: Array<{
    type: string;
    subject: string;
    date: string;
  }>;
  healthTrend: 'improving' | 'stable' | 'declining';
}

export interface GeneratedResponse {
  draft: EscalationTemplate;
  htmlBody: string;
  escalationDetails: EscalationDetails;
  metadata: {
    generatedAt: string;
    templateUsed: string;
    confidenceScore: number;
    slaStatus: 'on_track' | 'at_risk' | 'breached';
    suggestedUrgency: 'normal' | 'expedited' | 'immediate';
  };
}

export interface SaveResponseInput {
  riskSignalId: string;
  customerId: string;
  toEmail: string;
  toName?: string;
  draftSubject: string;
  draftBody: string;
  ccEmails?: string[];
  suggestedCCs?: string[];
  escalationType: EscalationType;
  severity: EscalationSeverity;
  templateUsed: string;
  confidenceScore: number;
}

export class EscalationResponseGenerator {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Get full escalation context including customer history
   */
  async getEscalationContext(riskSignalId: string): Promise<EscalationDetails | null> {
    if (!this.supabase) {
      console.warn('[EscalationGenerator] Supabase not configured');
      return null;
    }

    // Get risk signal
    const { data: signal, error: signalError } = await this.supabase
      .from('risk_signals')
      .select('*')
      .eq('id', riskSignalId)
      .single();

    if (signalError || !signal) {
      console.error('[EscalationGenerator] Risk signal not found:', signalError);
      return null;
    }

    // Get customer
    const { data: customer, error: customerError } = await this.supabase
      .from('customers')
      .select('*')
      .eq('id', signal.customer_id)
      .single();

    if (customerError || !customer) {
      console.error('[EscalationGenerator] Customer not found:', customerError);
      return null;
    }

    // Get recent communications
    const { data: recentComms } = await this.supabase
      .from('agent_activity_log')
      .select('action_type, action_data, started_at')
      .eq('customer_id', signal.customer_id)
      .in('action_type', ['send_email', 'draft_email', 'email'])
      .order('started_at', { ascending: false })
      .limit(5);

    // Calculate issue duration
    const detectedAt = new Date(signal.detected_at);
    const now = new Date();
    const durationHours = Math.floor((now.getTime() - detectedAt.getTime()) / (1000 * 60 * 60));
    const issueDuration = durationHours < 24
      ? `${durationHours} hours`
      : `${Math.floor(durationHours / 24)} days`;

    // Determine escalation type from signal
    const escalationType = this.inferEscalationType(signal);

    // Determine severity
    const severity = this.mapSeverity(signal.severity);

    // Get reported by info
    const reportedBy = {
      name: signal.reported_by_name || customer.primary_contact_name || 'Customer',
      email: signal.reported_by_email || customer.primary_contact_email || '',
      title: signal.reported_by_title || customer.primary_contact_title,
    };

    // Get health trend (last 30 days)
    const { data: healthHistory } = await this.supabase
      .from('usage_metrics')
      .select('adoption_score, metric_date')
      .eq('customer_id', signal.customer_id)
      .order('metric_date', { ascending: false })
      .limit(30);

    let healthTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (healthHistory && healthHistory.length >= 2) {
      const recent = healthHistory.slice(0, 7).reduce((sum, h) => sum + (h.adoption_score || 0), 0) / 7;
      const older = healthHistory.slice(7, 14).reduce((sum, h) => sum + (h.adoption_score || 0), 0) / 7;

      if (recent > older + 5) healthTrend = 'improving';
      else if (recent < older - 5) healthTrend = 'declining';
    }

    return {
      riskSignal: signal,
      customer: {
        id: customer.id,
        name: customer.name,
        industry: customer.industry,
        arr: customer.arr || 0,
        health_score: customer.health_score || 70,
        stage: customer.stage,
        primary_contact_name: customer.primary_contact_name,
        primary_contact_email: customer.primary_contact_email,
        primary_contact_title: customer.primary_contact_title,
      },
      escalationType,
      severity,
      issueDescription: signal.description || 'Customer escalation requiring immediate attention',
      issueDuration,
      reportedBy,
      recentCommunications: (recentComms || []).map(c => ({
        type: c.action_type,
        subject: c.action_data?.subject || 'Email',
        date: c.started_at,
      })),
      healthTrend,
    };
  }

  /**
   * Generate escalation response for a customer
   */
  async generateResponse(
    customerId: string,
    riskSignalId: string | null,
    csmName: string,
    csmPhone?: string,
    csmEmail?: string,
    overrides?: Partial<EscalationContext>
  ): Promise<GeneratedResponse | null> {
    // Get escalation details
    let details: EscalationDetails | null = null;

    if (riskSignalId) {
      details = await this.getEscalationContext(riskSignalId);
    }

    // If no risk signal, fetch customer and create basic context
    if (!details && this.supabase) {
      const { data: customer } = await this.supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (customer) {
        details = {
          riskSignal: {
            id: 'manual',
            customer_id: customerId,
            signal_type: 'support_escalation',
            severity: 'high',
            description: overrides?.issueDescription || 'Customer escalation',
            detected_at: new Date().toISOString(),
            resolved_at: null,
            metadata: {},
          },
          customer: {
            id: customer.id,
            name: customer.name,
            industry: customer.industry,
            arr: customer.arr || 0,
            health_score: customer.health_score || 70,
            stage: customer.stage,
            primary_contact_name: customer.primary_contact_name,
            primary_contact_email: customer.primary_contact_email,
            primary_contact_title: customer.primary_contact_title,
          },
          escalationType: (overrides?.escalationType as EscalationType) || 'support_escalation',
          severity: (overrides?.severity as EscalationSeverity) || 'high',
          issueDescription: overrides?.issueDescription || 'Customer escalation requiring attention',
          issueDuration: '0 hours',
          reportedBy: {
            name: customer.primary_contact_name || 'Customer',
            email: customer.primary_contact_email || '',
            title: customer.primary_contact_title,
          },
          recentCommunications: [],
          healthTrend: 'stable',
        };
      }
    }

    if (!details) {
      console.error('[EscalationGenerator] Could not get escalation details');
      return null;
    }

    // Build context for template
    const context: EscalationContext = {
      customerName: details.customer.name,
      contactName: details.reportedBy.name,
      contactTitle: details.reportedBy.title,
      issueDescription: details.issueDescription,
      issueDuration: details.issueDuration,
      arrValue: details.customer.arr,
      healthScore: details.customer.health_score,
      escalationType: details.escalationType,
      severity: details.severity,
      csmName,
      csmPhone,
      csmEmail,
      ...overrides,
    };

    // Generate response using templates
    const draft = generateEscalationResponse(context);
    const htmlBody = generateEscalationResponseHtml(context);

    // Calculate SLA status
    const slaStatus = this.calculateSLAStatus(details);

    // Calculate confidence score based on available context
    const confidenceScore = this.calculateConfidenceScore(details);

    // Determine suggested urgency
    const suggestedUrgency = this.determineSuggestedUrgency(details, slaStatus);

    return {
      draft,
      htmlBody,
      escalationDetails: details,
      metadata: {
        generatedAt: new Date().toISOString(),
        templateUsed: details.escalationType,
        confidenceScore,
        slaStatus,
        suggestedUrgency,
      },
    };
  }

  /**
   * Save escalation response draft to database
   */
  async saveResponseDraft(input: SaveResponseInput): Promise<string | null> {
    if (!this.supabase) {
      console.warn('[EscalationGenerator] Supabase not configured');
      return null;
    }

    // Get the risk signal's detected_at for response time calculation
    let escalationDetectedAt: string | null = null;
    if (input.riskSignalId !== 'manual') {
      const { data: signal } = await this.supabase
        .from('risk_signals')
        .select('detected_at')
        .eq('id', input.riskSignalId)
        .single();

      escalationDetectedAt = signal?.detected_at || null;
    }

    const { data, error } = await this.supabase
      .from('escalation_responses')
      .insert({
        risk_signal_id: input.riskSignalId !== 'manual' ? input.riskSignalId : null,
        customer_id: input.customerId,
        to_email: input.toEmail,
        to_name: input.toName,
        draft_subject: input.draftSubject,
        draft_body: input.draftBody,
        cc_emails: input.ccEmails || [],
        suggested_ccs: input.suggestedCCs || [],
        status: 'draft',
        escalation_type: input.escalationType,
        escalation_severity: input.severity,
        ai_confidence_score: input.confidenceScore,
        template_used: input.templateUsed,
        escalation_detected_at: escalationDetectedAt,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[EscalationGenerator] Failed to save draft:', error);
      return null;
    }

    return data?.id || null;
  }

  /**
   * Mark response as sent and update tracking
   */
  async markResponseSent(
    responseId: string,
    gmailMessageId: string,
    sentBy: string
  ): Promise<boolean> {
    if (!this.supabase) return false;

    const sentAt = new Date();

    // Get the response to calculate response time
    const { data: response } = await this.supabase
      .from('escalation_responses')
      .select('risk_signal_id, escalation_detected_at')
      .eq('id', responseId)
      .single();

    let responseTimeMinutes: number | null = null;
    if (response?.escalation_detected_at) {
      const detectedAt = new Date(response.escalation_detected_at);
      responseTimeMinutes = Math.floor((sentAt.getTime() - detectedAt.getTime()) / (1000 * 60));
    }

    // Update escalation_responses
    const { error: responseError } = await this.supabase
      .from('escalation_responses')
      .update({
        status: 'sent',
        gmail_message_id: gmailMessageId,
        sent_at: sentAt.toISOString(),
        sent_by: sentBy,
        response_time_minutes: responseTimeMinutes,
      })
      .eq('id', responseId);

    if (responseError) {
      console.error('[EscalationGenerator] Failed to update response:', responseError);
      return false;
    }

    // Update risk_signals if linked
    if (response?.risk_signal_id) {
      await this.supabase
        .from('risk_signals')
        .update({
          response_sent_at: sentAt.toISOString(),
          response_email_id: gmailMessageId,
          response_time_minutes: responseTimeMinutes,
        })
        .eq('id', response.risk_signal_id);
    }

    return true;
  }

  /**
   * Get pending escalation responses
   */
  async getPendingResponses(customerId?: string): Promise<any[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('escalation_responses')
      .select(`
        *,
        customers (name, arr, health_score),
        risk_signals (signal_type, severity, detected_at)
      `)
      .in('status', ['draft', 'pending_approval'])
      .order('created_at', { ascending: false });

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[EscalationGenerator] Failed to get pending responses:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get unresponded escalations
   */
  async getUnrespondedEscalations(limit: number = 20): Promise<any[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('risk_signals')
      .select(`
        *,
        customers (id, name, arr, health_score, stage)
      `)
      .eq('signal_type', 'support_escalation')
      .is('response_sent_at', null)
      .is('resolved_at', null)
      .order('detected_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[EscalationGenerator] Failed to get unresponded escalations:', error);
      return [];
    }

    return data || [];
  }

  // ==================== Helper Methods ====================

  private inferEscalationType(signal: RiskSignal): EscalationType {
    // Check if already typed
    if (signal.escalation_type) {
      return signal.escalation_type as EscalationType;
    }

    // Infer from signal type and metadata
    const description = (signal.description || '').toLowerCase();
    const metadata = signal.metadata || {};

    if (description.includes('api') || description.includes('integration') ||
        description.includes('technical') || description.includes('bug') ||
        metadata.issueCategory === 'technical') {
      return 'technical';
    }

    if (description.includes('billing') || description.includes('invoice') ||
        description.includes('payment') || description.includes('charge') ||
        metadata.issueCategory === 'billing') {
      return 'billing';
    }

    if (description.includes('executive') || description.includes('ceo') ||
        description.includes('cto') || description.includes('vp') ||
        metadata.reporterLevel === 'executive') {
      return 'executive_complaint';
    }

    if (description.includes('sla') || description.includes('service') ||
        description.includes('quality') || metadata.issueCategory === 'service') {
      return 'service';
    }

    return 'support_escalation';
  }

  private mapSeverity(severity: string): EscalationSeverity {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
      default:
        return 'low';
    }
  }

  private calculateSLAStatus(
    details: EscalationDetails
  ): 'on_track' | 'at_risk' | 'breached' {
    const detectedAt = new Date(details.riskSignal.detected_at);
    const now = new Date();
    const hoursElapsed = (now.getTime() - detectedAt.getTime()) / (1000 * 60 * 60);

    // SLA targets based on severity
    const slaTargets: Record<EscalationSeverity, number> = {
      critical: 1,  // 1 hour
      high: 4,      // 4 hours
      medium: 24,   // 24 hours
      low: 48,      // 48 hours
    };

    const target = slaTargets[details.severity];

    if (hoursElapsed > target) return 'breached';
    if (hoursElapsed > target * 0.75) return 'at_risk';
    return 'on_track';
  }

  private calculateConfidenceScore(details: EscalationDetails): number {
    let score = 0.5; // Base score

    // More context = higher confidence
    if (details.issueDescription && details.issueDescription.length > 50) score += 0.1;
    if (details.reportedBy.email) score += 0.1;
    if (details.customer.arr > 0) score += 0.1;
    if (details.recentCommunications.length > 0) score += 0.1;
    if (details.customer.health_score) score += 0.1;

    return Math.min(1, score);
  }

  private determineSuggestedUrgency(
    details: EscalationDetails,
    slaStatus: 'on_track' | 'at_risk' | 'breached'
  ): 'normal' | 'expedited' | 'immediate' {
    // Critical severity or breached SLA = immediate
    if (details.severity === 'critical' || slaStatus === 'breached') {
      return 'immediate';
    }

    // High severity, at-risk SLA, or declining health = expedited
    if (
      details.severity === 'high' ||
      slaStatus === 'at_risk' ||
      details.healthTrend === 'declining' ||
      details.customer.arr >= 100000
    ) {
      return 'expedited';
    }

    return 'normal';
  }
}

// Singleton instance
export const escalationResponseGenerator = new EscalationResponseGenerator();

export default escalationResponseGenerator;
