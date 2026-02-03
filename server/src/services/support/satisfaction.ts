/**
 * Support Satisfaction Service
 *
 * PRD-102: Support Satisfaction Drop Alert
 *
 * Monitors CSAT scores from support interactions and generates alerts
 * when satisfaction drops, providing context for CSM follow-up.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { triggerEngine, CustomerEvent } from '../../triggers/index.js';
import { determineSeverity } from '../../triggers/conditions/support-satisfaction-drop.js';

// ============================================
// Types
// ============================================

export interface SupportSatisfaction {
  id: string;
  customerId: string;
  ticketId: string;
  ticketSubject?: string;
  rating: number;
  feedback?: string;
  ticketCategory?: string;
  resolutionTimeHours?: number;
  wasEscalated: boolean;
  surveySentAt?: Date;
  respondedAt?: Date;
  csmNotified: boolean;
  csmFollowedUp: boolean;
  followUpAt?: Date;
  followUpNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SatisfactionTrend {
  customerId: string;
  averageCsat: number;
  responseCount: number;
  poorRatingCount: number;
  recentAverage: number;
  previousAverage: number;
  trendDirection: 'improving' | 'stable' | 'declining' | 'critical';
  trendPercentage: number;
  lastPoorRatingAt?: Date;
  poorRatingsLast30Days: number;
  calculatedAt: Date;
}

export interface SatisfactionAlert {
  id: string;
  customerId: string;
  satisfactionId?: string;
  alertType: 'poor_rating' | 'trend_decline' | 'repeat_dissatisfaction';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description?: string;
  ticketId?: string;
  rating?: number;
  previousAvgCsat?: number;
  customerArr?: number;
  metadata: Record<string, any>;
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;
  notifiedAt?: Date;
  notificationChannel?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CSATWebhookPayload {
  ticketId: string;
  customerId: string;
  rating: number;
  feedback?: string;
  ticketSubject?: string;
  ticketCategory?: string;
  resolutionTimeHours?: number;
  wasEscalated?: boolean;
  surveySentAt?: string;
  respondedAt?: string;
  externalUrl?: string;
  metadata?: Record<string, any>;
}

export interface SatisfactionSummary {
  customer: {
    id: string;
    name: string;
    arr: number;
    healthScore?: number;
  };
  trend: SatisfactionTrend;
  recentRatings: SupportSatisfaction[];
  activeAlerts: SatisfactionAlert[];
  supportHistory: {
    ticketsThisMonth: number;
    avgResolutionTimeHours: number;
    previousAvgCsat: number;
  };
}

export interface SlackAlertContext {
  customerName: string;
  customerId: string;
  rating: number;
  ticketId: string;
  ticketSubject: string;
  ticketCategory?: string;
  resolutionTimeHours?: number;
  slaHours?: number;
  customerFeedback?: string;
  customerArr: number;
  supportHistory: {
    ticketsThisMonth: number;
    previousAvgCsat: number;
  };
  lowRatingCount30Days: number;
  externalTicketUrl?: string;
}

// ============================================
// Support Satisfaction Service
// ============================================

export class SupportSatisfactionService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // CSAT Processing
  // ============================================

  /**
   * Process incoming CSAT response from webhook
   */
  async processCSATWebhook(payload: CSATWebhookPayload): Promise<{
    satisfaction: SupportSatisfaction;
    alertGenerated: boolean;
    alert?: SatisfactionAlert;
  }> {
    // Validate rating
    if (payload.rating < 1 || payload.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Save satisfaction record
    const satisfaction = await this.saveSatisfaction(payload);

    // Update customer trend
    await this.updateTrend(payload.customerId);

    // Check if alert should be generated
    const { shouldAlert, alert } = await this.evaluateForAlert(satisfaction);

    if (shouldAlert && alert) {
      // Fire trigger event for the engine
      await this.fireTriggerEvent(satisfaction, alert);
    }

    return {
      satisfaction,
      alertGenerated: shouldAlert,
      alert,
    };
  }

  /**
   * Save satisfaction record
   */
  async saveSatisfaction(payload: CSATWebhookPayload): Promise<SupportSatisfaction> {
    const id = uuidv4();
    const now = new Date();

    if (!this.supabase) {
      // Return mock for testing
      return {
        id,
        customerId: payload.customerId,
        ticketId: payload.ticketId,
        ticketSubject: payload.ticketSubject,
        rating: payload.rating,
        feedback: payload.feedback,
        ticketCategory: payload.ticketCategory,
        resolutionTimeHours: payload.resolutionTimeHours,
        wasEscalated: payload.wasEscalated || false,
        surveySentAt: payload.surveySentAt ? new Date(payload.surveySentAt) : undefined,
        respondedAt: payload.respondedAt ? new Date(payload.respondedAt) : now,
        csmNotified: false,
        csmFollowedUp: false,
        createdAt: now,
        updatedAt: now,
      };
    }

    const { data, error } = await this.supabase
      .from('support_satisfaction')
      .upsert({
        id,
        customer_id: payload.customerId,
        ticket_id: payload.ticketId,
        ticket_subject: payload.ticketSubject,
        rating: payload.rating,
        feedback: payload.feedback,
        ticket_category: payload.ticketCategory,
        resolution_time_hours: payload.resolutionTimeHours,
        was_escalated: payload.wasEscalated || false,
        survey_sent_at: payload.surveySentAt,
        responded_at: payload.respondedAt || now.toISOString(),
        csm_notified: false,
        csm_followed_up: false,
      }, {
        onConflict: 'customer_id,ticket_id',
      })
      .select()
      .single();

    if (error) {
      console.error('[SatisfactionService] Error saving satisfaction:', error);
      throw error;
    }

    return this.mapDbSatisfaction(data);
  }

  /**
   * Update trend for customer
   */
  async updateTrend(customerId: string): Promise<SatisfactionTrend | null> {
    if (!this.supabase) {
      return null;
    }

    // Call the database function to calculate trend
    await this.supabase.rpc('calculate_satisfaction_trend', {
      p_customer_id: customerId,
    });

    // Fetch the updated trend
    return this.getTrend(customerId);
  }

  /**
   * Get trend for customer
   */
  async getTrend(customerId: string): Promise<SatisfactionTrend | null> {
    if (!this.supabase) {
      return null;
    }

    const { data, error } = await this.supabase
      .from('support_satisfaction_trends')
      .select('*')
      .eq('customer_id', customerId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbTrend(data);
  }

  // ============================================
  // Alert Generation
  // ============================================

  /**
   * Evaluate satisfaction for alert generation
   */
  async evaluateForAlert(satisfaction: SupportSatisfaction): Promise<{
    shouldAlert: boolean;
    alert?: SatisfactionAlert;
  }> {
    // Only generate alerts for poor ratings (1-2)
    if (satisfaction.rating > 2) {
      return { shouldAlert: false };
    }

    // Get customer info and trend
    const [customer, trend] = await Promise.all([
      this.getCustomerInfo(satisfaction.customerId),
      this.getTrend(satisfaction.customerId),
    ]);

    if (!customer) {
      console.warn('[SatisfactionService] Customer not found:', satisfaction.customerId);
      return { shouldAlert: false };
    }

    // Determine alert type
    let alertType: SatisfactionAlert['alertType'] = 'poor_rating';
    const poorRatingsLast30Days = trend?.poorRatingsLast30Days || 1;

    if (poorRatingsLast30Days >= 2) {
      alertType = 'repeat_dissatisfaction';
    } else if (trend?.trendDirection === 'declining' || trend?.trendDirection === 'critical') {
      alertType = 'trend_decline';
    }

    // Determine severity
    const severity = determineSeverity(
      satisfaction.rating,
      customer.arr || 0,
      poorRatingsLast30Days,
      trend?.trendDirection
    );

    // Create alert
    const alert = await this.createAlert({
      customerId: satisfaction.customerId,
      satisfactionId: satisfaction.id,
      alertType,
      severity,
      ticketId: satisfaction.ticketId,
      rating: satisfaction.rating,
      previousAvgCsat: trend?.previousAverage,
      customerArr: customer.arr,
      metadata: {
        ticketSubject: satisfaction.ticketSubject,
        ticketCategory: satisfaction.ticketCategory,
        feedback: satisfaction.feedback,
        resolutionTimeHours: satisfaction.resolutionTimeHours,
        wasEscalated: satisfaction.wasEscalated,
        trendDirection: trend?.trendDirection,
        poorRatingsLast30Days,
        customerName: customer.name,
        customerHealthScore: customer.healthScore,
      },
    });

    return {
      shouldAlert: true,
      alert,
    };
  }

  /**
   * Create satisfaction alert
   */
  async createAlert(params: {
    customerId: string;
    satisfactionId?: string;
    alertType: SatisfactionAlert['alertType'];
    severity: SatisfactionAlert['severity'];
    ticketId?: string;
    rating?: number;
    previousAvgCsat?: number;
    customerArr?: number;
    metadata?: Record<string, any>;
  }): Promise<SatisfactionAlert> {
    const id = uuidv4();
    const now = new Date();

    // Generate title based on alert type
    let title: string;
    let description: string;

    switch (params.alertType) {
      case 'repeat_dissatisfaction':
        title = `Repeat Poor Support Rating: ${params.metadata?.customerName || 'Customer'}`;
        description = `Customer has given multiple low ratings recently. This is the ${params.metadata?.poorRatingsLast30Days || 2}nd low rating in the last 30 days.`;
        break;
      case 'trend_decline':
        title = `Declining Support Satisfaction: ${params.metadata?.customerName || 'Customer'}`;
        description = `Customer's support satisfaction trend is declining. Previous average CSAT: ${params.previousAvgCsat?.toFixed(1) || 'N/A'}`;
        break;
      default:
        title = `Poor Support Rating: ${params.metadata?.customerName || 'Customer'}`;
        description = `Customer gave a ${params.rating}/5 rating for support ticket #${params.ticketId}`;
    }

    if (!this.supabase) {
      return {
        id,
        customerId: params.customerId,
        satisfactionId: params.satisfactionId,
        alertType: params.alertType,
        severity: params.severity,
        title,
        description,
        ticketId: params.ticketId,
        rating: params.rating,
        previousAvgCsat: params.previousAvgCsat,
        customerArr: params.customerArr,
        metadata: params.metadata || {},
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
    }

    const { data, error } = await this.supabase
      .from('support_satisfaction_alerts')
      .insert({
        id,
        customer_id: params.customerId,
        satisfaction_id: params.satisfactionId,
        alert_type: params.alertType,
        severity: params.severity,
        title,
        description,
        ticket_id: params.ticketId,
        rating: params.rating,
        previous_avg_csat: params.previousAvgCsat,
        customer_arr: params.customerArr,
        metadata: params.metadata || {},
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('[SatisfactionService] Error creating alert:', error);
      throw error;
    }

    return this.mapDbAlert(data);
  }

  /**
   * Fire trigger event for satisfaction drop
   */
  async fireTriggerEvent(satisfaction: SupportSatisfaction, alert: SatisfactionAlert): Promise<void> {
    const customer = await this.getCustomerInfo(satisfaction.customerId);
    const trend = await this.getTrend(satisfaction.customerId);

    const event: CustomerEvent = {
      id: uuidv4(),
      type: 'support_csat_received' as any, // Add to CustomerEventType
      customerId: satisfaction.customerId,
      customerName: customer?.name,
      data: {
        rating: satisfaction.rating,
        ticketId: satisfaction.ticketId,
        ticketSubject: satisfaction.ticketSubject,
        ticketCategory: satisfaction.ticketCategory,
        feedback: satisfaction.feedback,
        resolutionTimeHours: satisfaction.resolutionTimeHours,
        wasEscalated: satisfaction.wasEscalated,
        previousAvgCsat: trend?.previousAverage,
        trendDirection: trend?.trendDirection,
        trendPercentage: trend?.trendPercentage,
        poorRatingsLast30Days: trend?.poorRatingsLast30Days,
        alertId: alert.id,
        alertType: alert.alertType,
        severity: alert.severity,
        customerArr: customer?.arr,
      },
      timestamp: new Date(),
      source: 'satisfaction_service',
    };

    await triggerEngine.processEvent(event);
  }

  // ============================================
  // Alert Management
  // ============================================

  /**
   * Get active alerts for customer
   */
  async getActiveAlerts(customerId: string): Promise<SatisfactionAlert[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('support_satisfaction_alerts')
      .select('*')
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SatisfactionService] Error fetching alerts:', error);
      return [];
    }

    return (data || []).map(this.mapDbAlert);
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<SatisfactionAlert | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('support_satisfaction_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', alertId)
      .select()
      .single();

    if (error) {
      console.error('[SatisfactionService] Error acknowledging alert:', error);
      return null;
    }

    return this.mapDbAlert(data);
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string, notes?: string): Promise<SatisfactionAlert | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('support_satisfaction_alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution_notes: notes,
      })
      .eq('id', alertId)
      .select()
      .single();

    if (error) {
      console.error('[SatisfactionService] Error resolving alert:', error);
      return null;
    }

    return this.mapDbAlert(data);
  }

  /**
   * Mark CSM follow-up complete
   */
  async markFollowedUp(satisfactionId: string, notes?: string): Promise<SupportSatisfaction | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('support_satisfaction')
      .update({
        csm_followed_up: true,
        follow_up_at: new Date().toISOString(),
        follow_up_notes: notes,
      })
      .eq('id', satisfactionId)
      .select()
      .single();

    if (error) {
      console.error('[SatisfactionService] Error marking follow-up:', error);
      return null;
    }

    return this.mapDbSatisfaction(data);
  }

  // ============================================
  // Summary and Reports
  // ============================================

  /**
   * Get satisfaction summary for customer
   */
  async getSatisfactionSummary(customerId: string): Promise<SatisfactionSummary | null> {
    const [customer, trend, recentRatings, activeAlerts] = await Promise.all([
      this.getCustomerInfo(customerId),
      this.getTrend(customerId),
      this.getRecentRatings(customerId, 10),
      this.getActiveAlerts(customerId),
    ]);

    if (!customer) return null;

    // Calculate support history
    const supportHistory = await this.getSupportHistory(customerId);

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        arr: customer.arr || 0,
        healthScore: customer.healthScore,
      },
      trend: trend || {
        customerId,
        averageCsat: 0,
        responseCount: 0,
        poorRatingCount: 0,
        recentAverage: 0,
        previousAverage: 0,
        trendDirection: 'stable',
        trendPercentage: 0,
        poorRatingsLast30Days: 0,
        calculatedAt: new Date(),
      },
      recentRatings,
      activeAlerts,
      supportHistory,
    };
  }

  /**
   * Get recent ratings for customer
   */
  async getRecentRatings(customerId: string, limit: number = 10): Promise<SupportSatisfaction[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('support_satisfaction')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[SatisfactionService] Error fetching ratings:', error);
      return [];
    }

    return (data || []).map(this.mapDbSatisfaction);
  }

  /**
   * Get support history stats
   */
  async getSupportHistory(customerId: string): Promise<{
    ticketsThisMonth: number;
    avgResolutionTimeHours: number;
    previousAvgCsat: number;
  }> {
    if (!this.supabase) {
      return {
        ticketsThisMonth: 0,
        avgResolutionTimeHours: 0,
        previousAvgCsat: 0,
      };
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data } = await this.supabase
      .from('support_satisfaction')
      .select('resolution_time_hours, rating')
      .eq('customer_id', customerId)
      .gte('created_at', thirtyDaysAgo.toISOString());

    const records = data || [];

    const ticketsThisMonth = records.length;
    const avgResolutionTimeHours = records.length > 0
      ? records.reduce((sum, r) => sum + (r.resolution_time_hours || 0), 0) / records.length
      : 0;

    // Get previous average (30-60 days ago)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data: prevData } = await this.supabase
      .from('support_satisfaction')
      .select('rating')
      .eq('customer_id', customerId)
      .gte('created_at', sixtyDaysAgo.toISOString())
      .lt('created_at', thirtyDaysAgo.toISOString());

    const prevRecords = prevData || [];
    const previousAvgCsat = prevRecords.length > 0
      ? prevRecords.reduce((sum, r) => sum + r.rating, 0) / prevRecords.length
      : 0;

    return {
      ticketsThisMonth,
      avgResolutionTimeHours: Math.round(avgResolutionTimeHours),
      previousAvgCsat: Math.round(previousAvgCsat * 10) / 10,
    };
  }

  /**
   * Build Slack alert context for the PRD-specified format
   */
  async buildSlackAlertContext(satisfaction: SupportSatisfaction): Promise<SlackAlertContext> {
    const [customer, trend, supportHistory] = await Promise.all([
      this.getCustomerInfo(satisfaction.customerId),
      this.getTrend(satisfaction.customerId),
      this.getSupportHistory(satisfaction.customerId),
    ]);

    return {
      customerName: customer?.name || 'Unknown Customer',
      customerId: satisfaction.customerId,
      rating: satisfaction.rating,
      ticketId: satisfaction.ticketId,
      ticketSubject: satisfaction.ticketSubject || 'Support Request',
      ticketCategory: satisfaction.ticketCategory,
      resolutionTimeHours: satisfaction.resolutionTimeHours,
      slaHours: 24, // Default SLA, could be customer-specific
      customerFeedback: satisfaction.feedback,
      customerArr: customer?.arr || 0,
      supportHistory: {
        ticketsThisMonth: supportHistory.ticketsThisMonth,
        previousAvgCsat: supportHistory.previousAvgCsat,
      },
      lowRatingCount30Days: trend?.poorRatingsLast30Days || 1,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private async getCustomerInfo(customerId: string): Promise<{
    id: string;
    name: string;
    arr?: number;
    healthScore?: number;
  } | null> {
    if (!this.supabase) return null;

    const { data } = await this.supabase
      .from('customers')
      .select('id, name, arr, health_score')
      .eq('id', customerId)
      .single();

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      arr: data.arr,
      healthScore: data.health_score,
    };
  }

  private mapDbSatisfaction(row: any): SupportSatisfaction {
    return {
      id: row.id,
      customerId: row.customer_id,
      ticketId: row.ticket_id,
      ticketSubject: row.ticket_subject,
      rating: row.rating,
      feedback: row.feedback,
      ticketCategory: row.ticket_category,
      resolutionTimeHours: row.resolution_time_hours,
      wasEscalated: row.was_escalated,
      surveySentAt: row.survey_sent_at ? new Date(row.survey_sent_at) : undefined,
      respondedAt: row.responded_at ? new Date(row.responded_at) : undefined,
      csmNotified: row.csm_notified,
      csmFollowedUp: row.csm_followed_up,
      followUpAt: row.follow_up_at ? new Date(row.follow_up_at) : undefined,
      followUpNotes: row.follow_up_notes,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapDbTrend(row: any): SatisfactionTrend {
    return {
      customerId: row.customer_id,
      averageCsat: parseFloat(row.average_csat) || 0,
      responseCount: row.response_count || 0,
      poorRatingCount: row.poor_rating_count || 0,
      recentAverage: parseFloat(row.recent_average) || 0,
      previousAverage: parseFloat(row.previous_average) || 0,
      trendDirection: row.trend_direction || 'stable',
      trendPercentage: parseFloat(row.trend_percentage) || 0,
      lastPoorRatingAt: row.last_poor_rating_at ? new Date(row.last_poor_rating_at) : undefined,
      poorRatingsLast30Days: row.poor_ratings_last_30_days || 0,
      calculatedAt: new Date(row.calculated_at),
    };
  }

  private mapDbAlert(row: any): SatisfactionAlert {
    return {
      id: row.id,
      customerId: row.customer_id,
      satisfactionId: row.satisfaction_id,
      alertType: row.alert_type,
      severity: row.severity,
      title: row.title,
      description: row.description,
      ticketId: row.ticket_id,
      rating: row.rating,
      previousAvgCsat: row.previous_avg_csat ? parseFloat(row.previous_avg_csat) : undefined,
      customerArr: row.customer_arr ? parseFloat(row.customer_arr) : undefined,
      metadata: row.metadata || {},
      status: row.status,
      acknowledgedBy: row.acknowledged_by,
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      resolutionNotes: row.resolution_notes,
      notifiedAt: row.notified_at ? new Date(row.notified_at) : undefined,
      notificationChannel: row.notification_channel,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// Singleton instance
export const supportSatisfactionService = new SupportSatisfactionService();
