/**
 * Support Ticket Service
 * PRD-087: Handles support ticket operations, spike detection, and escalation
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { triggerEngine, CustomerEvent } from '../../triggers/index.js';

// ============================================
// Types
// ============================================

export interface SupportTicket {
  id: string;
  externalId: string;
  customerId: string;
  subject: string;
  description?: string;
  category: TicketCategory;
  severity: TicketSeverity;
  status: TicketStatus;
  assignee?: string;
  reporterEmail?: string;
  reporterName?: string;
  escalationLevel: number;
  escalationCount: number;
  isEscalated: boolean;
  tags: string[];
  source: string;
  externalUrl?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  firstResponseAt?: Date;
}

export type TicketCategory = 'technical' | 'billing' | 'training' | 'feature_request' | 'general';
export type TicketSeverity = 'P1' | 'P2' | 'P3' | 'P4';
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';

export interface SpikeDetectionParams {
  customerId: string;
  lookbackHours?: number;
  baselineDays?: number;
  spikeThreshold?: number;
}

export interface SpikeResult {
  isSpike: boolean;
  ticketCount: number;
  baseline: number;
  multiplier: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  themes: string[];
  tickets: SupportTicket[];
  categoryBreakdown: Record<string, number>;
  severityBreakdown: Record<string, number>;
}

export interface RiskSignal {
  id: string;
  customerId: string;
  signalType: string;
  severity: string;
  title: string;
  description?: string;
  scoreImpact: number;
  metadata: Record<string, any>;
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;
  autoResolved: boolean;
  source: string;
  triggerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketBaseline {
  customerId: string;
  baselineDailyAvg: number;
  baselineCalculatedAt: Date;
  baselineDays: number;
  totalTicketsInPeriod: number;
  categoryBreakdown: Record<string, number>;
  severityBreakdown: Record<string, number>;
}

export interface TicketWebhookPayload {
  ticketId: string;
  customerId: string;
  category?: string;
  severity?: string;
  subject: string;
  description?: string;
  reporterEmail?: string;
  reporterName?: string;
  assignee?: string;
  status?: string;
  tags?: string[];
  externalUrl?: string;
  createdAt?: string;
  isEscalation?: boolean;
  escalationLevel?: number;
  metadata?: Record<string, any>;
}

export interface SupportSummary {
  recentTickets: SupportTicket[];
  baseline: number;
  currentRate: number;
  isSpike: boolean;
  themes: string[];
  categoryBreakdown: Record<string, number>;
  severityBreakdown: Record<string, number>;
  openTicketCount: number;
  avgResolutionTimeHours: number;
  escalatedTicketCount: number;
}

// ============================================
// Support Service
// ============================================

export class SupportService {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Ticket Operations
  // ============================================

  /**
   * Process incoming ticket webhook
   */
  async processTicketWebhook(payload: TicketWebhookPayload): Promise<{
    ticket: SupportTicket;
    spikeDetected: boolean;
    spikeResult?: SpikeResult;
  }> {
    // Create or update ticket
    const ticket = await this.upsertTicket(payload);

    // Check for spike
    const spikeResult = await this.detectTicketSpike({
      customerId: payload.customerId,
      lookbackHours: 24,
      spikeThreshold: 3.0,
    });

    // If spike detected, fire trigger event
    if (spikeResult.isSpike) {
      await this.handleSpikeDetected(ticket.customerId, spikeResult);
    }

    return {
      ticket,
      spikeDetected: spikeResult.isSpike,
      spikeResult: spikeResult.isSpike ? spikeResult : undefined,
    };
  }

  /**
   * Insert or update a ticket
   */
  async upsertTicket(payload: TicketWebhookPayload): Promise<SupportTicket> {
    if (!this.supabase) {
      // Return mock ticket for testing
      return {
        id: uuidv4(),
        externalId: payload.ticketId,
        customerId: payload.customerId,
        subject: payload.subject,
        description: payload.description,
        category: (payload.category as TicketCategory) || 'general',
        severity: (payload.severity as TicketSeverity) || 'P3',
        status: (payload.status as TicketStatus) || 'open',
        assignee: payload.assignee,
        reporterEmail: payload.reporterEmail,
        reporterName: payload.reporterName,
        escalationLevel: payload.escalationLevel || 0,
        escalationCount: payload.isEscalation ? 1 : 0,
        isEscalated: payload.isEscalation || false,
        tags: payload.tags || [],
        source: 'webhook',
        externalUrl: payload.externalUrl,
        metadata: payload.metadata || {},
        createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date(),
        updatedAt: new Date(),
      };
    }

    const ticketData = {
      external_id: payload.ticketId,
      customer_id: payload.customerId,
      subject: payload.subject,
      description: payload.description,
      category: payload.category || 'general',
      severity: payload.severity || 'P3',
      status: payload.status || 'open',
      assignee: payload.assignee,
      reporter_email: payload.reporterEmail,
      reporter_name: payload.reporterName,
      escalation_level: payload.escalationLevel || 0,
      is_escalated: payload.isEscalation || false,
      tags: payload.tags || [],
      source: 'webhook',
      external_url: payload.externalUrl,
      metadata: payload.metadata || {},
      created_at: payload.createdAt || new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('support_tickets')
      .upsert(ticketData, {
        onConflict: 'external_id,customer_id',
      })
      .select()
      .single();

    if (error) {
      console.error('[SupportService] Error upserting ticket:', error);
      throw error;
    }

    return this.mapDbTicket(data);
  }

  /**
   * Get tickets for a customer
   */
  async getTickets(
    customerId: string,
    options: {
      lookbackHours?: number;
      status?: TicketStatus[];
      category?: TicketCategory[];
      severity?: TicketSeverity[];
      limit?: number;
    } = {}
  ): Promise<SupportTicket[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('support_tickets')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (options.lookbackHours) {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - options.lookbackHours);
      query = query.gte('created_at', cutoff.toISOString());
    }

    if (options.status?.length) {
      query = query.in('status', options.status);
    }

    if (options.category?.length) {
      query = query.in('category', options.category);
    }

    if (options.severity?.length) {
      query = query.in('severity', options.severity);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[SupportService] Error fetching tickets:', error);
      return [];
    }

    return (data || []).map(this.mapDbTicket);
  }

  // ============================================
  // Baseline Calculations
  // ============================================

  /**
   * Calculate and store baseline for a customer
   */
  async calculateBaseline(customerId: string, days: number = 30): Promise<TicketBaseline> {
    if (!this.supabase) {
      return {
        customerId,
        baselineDailyAvg: 2.0,
        baselineCalculatedAt: new Date(),
        baselineDays: days,
        totalTicketsInPeriod: 60,
        categoryBreakdown: { technical: 40, billing: 10, training: 10 },
        severityBreakdown: { P1: 5, P2: 15, P3: 30, P4: 10 },
      };
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Get ticket counts
    const { data: tickets, error } = await this.supabase
      .from('support_tickets')
      .select('category, severity, created_at')
      .eq('customer_id', customerId)
      .gte('created_at', cutoff.toISOString());

    if (error) {
      console.error('[SupportService] Error calculating baseline:', error);
      throw error;
    }

    const totalTickets = tickets?.length || 0;
    const dailyAvg = totalTickets / days;

    // Calculate breakdowns
    const categoryBreakdown: Record<string, number> = {};
    const severityBreakdown: Record<string, number> = {};

    for (const ticket of tickets || []) {
      categoryBreakdown[ticket.category] = (categoryBreakdown[ticket.category] || 0) + 1;
      severityBreakdown[ticket.severity] = (severityBreakdown[ticket.severity] || 0) + 1;
    }

    // Store baseline
    const baseline = {
      customer_id: customerId,
      baseline_daily_avg: dailyAvg,
      baseline_calculated_at: new Date().toISOString(),
      baseline_days: days,
      total_tickets_in_period: totalTickets,
      category_breakdown: categoryBreakdown,
      severity_breakdown: severityBreakdown,
    };

    await this.supabase
      .from('ticket_baselines')
      .upsert(baseline, { onConflict: 'customer_id' });

    return {
      customerId,
      baselineDailyAvg: dailyAvg,
      baselineCalculatedAt: new Date(),
      baselineDays: days,
      totalTicketsInPeriod: totalTickets,
      categoryBreakdown,
      severityBreakdown,
    };
  }

  /**
   * Get stored baseline for a customer
   */
  async getBaseline(customerId: string): Promise<TicketBaseline | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('ticket_baselines')
      .select('*')
      .eq('customer_id', customerId)
      .single();

    if (error || !data) return null;

    return {
      customerId: data.customer_id,
      baselineDailyAvg: parseFloat(data.baseline_daily_avg),
      baselineCalculatedAt: new Date(data.baseline_calculated_at),
      baselineDays: data.baseline_days,
      totalTicketsInPeriod: data.total_tickets_in_period,
      categoryBreakdown: data.category_breakdown || {},
      severityBreakdown: data.severity_breakdown || {},
    };
  }

  // ============================================
  // Spike Detection
  // ============================================

  /**
   * Detect ticket spike for a customer
   */
  async detectTicketSpike(params: SpikeDetectionParams): Promise<SpikeResult> {
    const {
      customerId,
      lookbackHours = 24,
      baselineDays = 30,
      spikeThreshold = 3.0,
    } = params;

    // Get recent tickets
    const recentTickets = await this.getTickets(customerId, { lookbackHours });

    // Get or calculate baseline
    let baseline = await this.getBaseline(customerId);
    if (!baseline) {
      baseline = await this.calculateBaseline(customerId, baselineDays);
    }

    // Normalize current count to daily rate
    const normalizedCurrent = recentTickets.length / (lookbackHours / 24);
    const baselineAvg = baseline.baselineDailyAvg || 2.0; // Default baseline
    const multiplier = baselineAvg > 0 ? normalizedCurrent / baselineAvg : normalizedCurrent;

    // Determine if spike exists
    const isSpike = multiplier >= spikeThreshold;

    // Calculate breakdowns
    const categoryBreakdown: Record<string, number> = {};
    const severityBreakdown: Record<string, number> = {};

    for (const ticket of recentTickets) {
      categoryBreakdown[ticket.category] = (categoryBreakdown[ticket.category] || 0) + 1;
      severityBreakdown[ticket.severity] = (severityBreakdown[ticket.severity] || 0) + 1;
    }

    // Extract themes from ticket subjects
    const themes = this.extractThemes(recentTickets);

    // Determine severity
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (multiplier >= 5) {
      severity = 'critical';
    } else if (multiplier >= 3) {
      severity = 'high';
    } else if (multiplier >= 2) {
      severity = 'medium';
    }

    return {
      isSpike,
      ticketCount: recentTickets.length,
      baseline: baselineAvg,
      multiplier: Math.round(multiplier * 10) / 10,
      severity,
      themes,
      tickets: recentTickets,
      categoryBreakdown,
      severityBreakdown,
    };
  }

  /**
   * Extract common themes from tickets using simple keyword analysis
   */
  private extractThemes(tickets: SupportTicket[]): string[] {
    const keywords: Record<string, number> = {};

    // Common CS/technical keywords to look for
    const targetKeywords = [
      'api', 'error', 'login', 'password', 'timeout', 'slow', 'crash',
      'bug', 'outage', 'downtime', 'integration', 'sync', 'billing',
      'invoice', 'payment', 'refund', 'upgrade', 'training', 'onboarding',
      'feature', 'permission', 'access', 'security', 'data', 'export',
      'import', 'report', 'dashboard', 'notification', 'email', 'sso',
    ];

    for (const ticket of tickets) {
      const text = `${ticket.subject} ${ticket.description || ''}`.toLowerCase();

      for (const keyword of targetKeywords) {
        if (text.includes(keyword)) {
          keywords[keyword] = (keywords[keyword] || 0) + 1;
        }
      }
    }

    // Get top themes (appearing in 20%+ of tickets, max 5)
    const threshold = Math.max(1, tickets.length * 0.2);
    const themes = Object.entries(keywords)
      .filter(([_, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([keyword]) => keyword);

    return themes;
  }

  // ============================================
  // Risk Signals
  // ============================================

  /**
   * Handle detected spike - create risk signal and fire trigger
   */
  async handleSpikeDetected(customerId: string, spikeResult: SpikeResult): Promise<RiskSignal> {
    // Create risk signal
    const signal = await this.createRiskSignal({
      customerId,
      signalType: 'ticket_spike',
      severity: spikeResult.severity,
      title: `Support ticket spike: ${spikeResult.ticketCount} tickets (${spikeResult.multiplier}x normal)`,
      description: `Customer experienced ${spikeResult.multiplier}x their normal support ticket rate in the last 24 hours.`,
      scoreImpact: spikeResult.severity === 'critical' ? -20 : spikeResult.severity === 'high' ? -15 : -10,
      metadata: {
        ticket_count: spikeResult.ticketCount,
        baseline_daily_avg: spikeResult.baseline,
        spike_multiplier: spikeResult.multiplier,
        period_hours: 24,
        ticket_breakdown: spikeResult.categoryBreakdown,
        severity_breakdown: spikeResult.severityBreakdown,
        common_themes: spikeResult.themes,
        ticket_ids: spikeResult.tickets.map(t => t.externalId),
      },
    });

    // Get customer info for event
    const customerInfo = await this.getCustomerInfo(customerId);

    // Fire trigger event
    const event: CustomerEvent = {
      id: uuidv4(),
      type: 'support_ticket_created',
      customerId,
      customerName: customerInfo?.name,
      data: {
        ticketCount: spikeResult.ticketCount,
        baseline: spikeResult.baseline,
        spikeMultiplier: spikeResult.multiplier,
        severity: spikeResult.severity,
        categoryBreakdown: spikeResult.categoryBreakdown,
        severityBreakdown: spikeResult.severityBreakdown,
        themes: spikeResult.themes,
        riskSignalId: signal.id,
      },
      timestamp: new Date(),
      source: 'spike_detection',
    };

    // Process through trigger engine
    await triggerEngine.processEvent(event);

    return signal;
  }

  /**
   * Create a risk signal
   */
  async createRiskSignal(params: {
    customerId: string;
    signalType: string;
    severity: string;
    title: string;
    description?: string;
    scoreImpact?: number;
    metadata?: Record<string, any>;
    triggerId?: string;
  }): Promise<RiskSignal> {
    const signalId = uuidv4();

    if (!this.supabase) {
      return {
        id: signalId,
        customerId: params.customerId,
        signalType: params.signalType,
        severity: params.severity,
        title: params.title,
        description: params.description,
        scoreImpact: params.scoreImpact || 0,
        metadata: params.metadata || {},
        status: 'active',
        autoResolved: false,
        source: 'system',
        triggerId: params.triggerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const { data, error } = await this.supabase
      .from('risk_signals')
      .insert({
        id: signalId,
        customer_id: params.customerId,
        signal_type: params.signalType,
        severity: params.severity,
        title: params.title,
        description: params.description,
        score_impact: params.scoreImpact || 0,
        metadata: params.metadata || {},
        status: 'active',
        source: 'system',
        trigger_id: params.triggerId,
      })
      .select()
      .single();

    if (error) {
      console.error('[SupportService] Error creating risk signal:', error);
      throw error;
    }

    return this.mapDbRiskSignal(data);
  }

  /**
   * Get active risk signals for a customer
   */
  async getRiskSignals(customerId: string, signalType?: string): Promise<RiskSignal[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('risk_signals')
      .select('*')
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (signalType) {
      query = query.eq('signal_type', signalType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[SupportService] Error fetching risk signals:', error);
      return [];
    }

    return (data || []).map(this.mapDbRiskSignal);
  }

  /**
   * Acknowledge a risk signal
   */
  async acknowledgeSignal(signalId: string, userId: string): Promise<RiskSignal | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('risk_signals')
      .update({
        status: 'acknowledged',
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', signalId)
      .select()
      .single();

    if (error) {
      console.error('[SupportService] Error acknowledging signal:', error);
      return null;
    }

    return this.mapDbRiskSignal(data);
  }

  /**
   * Resolve a risk signal
   */
  async resolveSignal(signalId: string, notes?: string, autoResolved: boolean = false): Promise<RiskSignal | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('risk_signals')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution_notes: notes,
        auto_resolved: autoResolved,
      })
      .eq('id', signalId)
      .select()
      .single();

    if (error) {
      console.error('[SupportService] Error resolving signal:', error);
      return null;
    }

    return this.mapDbRiskSignal(data);
  }

  // ============================================
  // Support Summary
  // ============================================

  /**
   * Get comprehensive support summary for a customer
   */
  async getSupportSummary(customerId: string, lookbackHours: number = 24): Promise<SupportSummary> {
    const spikeResult = await this.detectTicketSpike({ customerId, lookbackHours });

    // Get open ticket count
    const openTickets = await this.getTickets(customerId, {
      status: ['open', 'pending'],
    });

    // Get escalated tickets
    const allRecentTickets = await this.getTickets(customerId, { lookbackHours: 168 }); // Last week
    const escalatedCount = allRecentTickets.filter(t => t.isEscalated).length;

    // Calculate average resolution time
    const resolvedTickets = allRecentTickets.filter(t => t.resolvedAt);
    let avgResolutionTimeHours = 0;
    if (resolvedTickets.length > 0) {
      const totalHours = resolvedTickets.reduce((sum, t) => {
        const created = t.createdAt.getTime();
        const resolved = t.resolvedAt!.getTime();
        return sum + (resolved - created) / (1000 * 60 * 60);
      }, 0);
      avgResolutionTimeHours = Math.round(totalHours / resolvedTickets.length);
    }

    return {
      recentTickets: spikeResult.tickets,
      baseline: spikeResult.baseline,
      currentRate: spikeResult.ticketCount / (lookbackHours / 24),
      isSpike: spikeResult.isSpike,
      themes: spikeResult.themes,
      categoryBreakdown: spikeResult.categoryBreakdown,
      severityBreakdown: spikeResult.severityBreakdown,
      openTicketCount: openTickets.length,
      avgResolutionTimeHours,
      escalatedTicketCount: escalatedCount,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private async getCustomerInfo(customerId: string): Promise<{ name: string; arr?: number } | null> {
    if (!this.supabase) return null;

    const { data } = await this.supabase
      .from('customers')
      .select('name, arr')
      .eq('id', customerId)
      .single();

    return data;
  }

  private mapDbTicket(row: any): SupportTicket {
    return {
      id: row.id,
      externalId: row.external_id,
      customerId: row.customer_id,
      subject: row.subject,
      description: row.description,
      category: row.category,
      severity: row.severity,
      status: row.status,
      assignee: row.assignee,
      reporterEmail: row.reporter_email,
      reporterName: row.reporter_name,
      escalationLevel: row.escalation_level,
      escalationCount: row.escalation_count,
      isEscalated: row.is_escalated,
      tags: row.tags || [],
      source: row.source,
      externalUrl: row.external_url,
      metadata: row.metadata || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      firstResponseAt: row.first_response_at ? new Date(row.first_response_at) : undefined,
    };
  }

  private mapDbRiskSignal(row: any): RiskSignal {
    return {
      id: row.id,
      customerId: row.customer_id,
      signalType: row.signal_type,
      severity: row.severity,
      title: row.title,
      description: row.description,
      scoreImpact: row.score_impact,
      metadata: row.metadata || {},
      status: row.status,
      acknowledgedBy: row.acknowledged_by,
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      resolutionNotes: row.resolution_notes,
      autoResolved: row.auto_resolved,
      source: row.source,
      triggerId: row.trigger_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// Singleton instance
export const supportService = new SupportService();
