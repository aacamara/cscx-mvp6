/**
 * Custom Alerts Service
 * PRD-080: Service for managing custom alert rules
 */

import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { triggerEngine, TriggerType, TriggerCondition, TriggerAction } from '../triggers/index.js';

// ============================================
// Types
// ============================================

export type AlertMetricType =
  | 'health_score'
  | 'usage'
  | 'engagement'
  | 'nps'
  | 'support_tickets'
  | 'feature_adoption'
  | 'login_activity'
  | 'contract_value'
  | 'days_to_renewal'
  | 'custom';

export type AlertComparisonOperator =
  | 'below'
  | 'above'
  | 'equals'
  | 'drops_by'
  | 'increases_by'
  | 'changes_by';

export type AlertUrgency = 'low' | 'medium' | 'high' | 'critical';
export type NotificationChannel = 'email' | 'slack' | 'in_app' | 'webhook';
export type AlertTargetType = 'customer' | 'segment' | 'portfolio';

export interface CustomAlertRule {
  id: string;
  userId: string;
  name: string;
  description?: string;
  enabled: boolean;
  ruleType: 'system' | 'custom' | 'template';
  target: {
    type: AlertTargetType;
    customerId?: string;
    customerName?: string;
    segmentId?: string;
    segmentName?: string;
    filters?: Record<string, any>;
  };
  condition: {
    metric: AlertMetricType;
    metricLabel?: string;
    operator: AlertComparisonOperator;
    threshold: number;
    currentValue?: number;
    unit?: string;
  };
  notification: {
    channels: NotificationChannel[];
    urgency: AlertUrgency;
    messageTemplate?: string;
    recipients?: string[];
    slackChannel?: string;
    webhookUrl?: string;
  };
  timing: {
    cooldownMinutes: number;
    maxFiresPerDay: number;
    activeHoursOnly?: boolean;
    timezone?: string;
  };
  templateId?: string;
  lastFiredAt?: Date;
  fireCount: number;
  lastValue?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertEvent {
  id: string;
  alertRuleId: string;
  alertRuleName: string;
  customerId: string;
  customerName: string;
  metric: AlertMetricType;
  previousValue?: number;
  currentValue: number;
  threshold: number;
  operator: AlertComparisonOperator;
  urgency: AlertUrgency;
  notificationsSent: Array<{
    channel: NotificationChannel;
    success: boolean;
    sentAt: Date;
    error?: string;
  }>;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  firedAt: Date;
}

export interface CreateAlertRuleDTO {
  name: string;
  description?: string;
  targetType: AlertTargetType;
  customerId?: string;
  segmentId?: string;
  metric: AlertMetricType;
  operator: AlertComparisonOperator;
  threshold: number;
  channels: NotificationChannel[];
  urgency: AlertUrgency;
  cooldownMinutes?: number;
  maxFiresPerDay?: number;
  messageTemplate?: string;
  templateId?: string;
}

// ============================================
// Custom Alerts Service
// ============================================

class CustomAlertsService {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // CRUD Operations
  // ============================================

  /**
   * Create a new custom alert rule
   */
  async createAlertRule(userId: string, dto: CreateAlertRuleDTO): Promise<CustomAlertRule> {
    const id = uuidv4();
    const now = new Date();

    // Fetch customer name if customerId provided
    let customerName: string | undefined;
    if (dto.customerId && this.supabase) {
      const { data: customer } = await this.supabase
        .from('customers')
        .select('name')
        .eq('id', dto.customerId)
        .single();
      customerName = customer?.name;
    }

    const rule: CustomAlertRule = {
      id,
      userId,
      name: dto.name,
      description: dto.description,
      enabled: true,
      ruleType: dto.templateId ? 'template' : 'custom',
      target: {
        type: dto.targetType,
        customerId: dto.customerId,
        customerName,
        segmentId: dto.segmentId,
      },
      condition: {
        metric: dto.metric,
        operator: dto.operator,
        threshold: dto.threshold,
        unit: this.getMetricUnit(dto.metric),
      },
      notification: {
        channels: dto.channels,
        urgency: dto.urgency,
        messageTemplate: dto.messageTemplate,
      },
      timing: {
        cooldownMinutes: dto.cooldownMinutes || this.getDefaultCooldown(dto.urgency),
        maxFiresPerDay: dto.maxFiresPerDay || 10,
      },
      templateId: dto.templateId,
      fireCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    if (this.supabase) {
      // Create trigger in database
      const triggerData = this.ruleToTrigger(rule);

      const { error } = await this.supabase
        .from('triggers')
        .insert({
          id: rule.id,
          user_id: userId,
          customer_id: dto.customerId || null,
          name: rule.name,
          description: rule.description,
          type: 'custom',
          rule_type: rule.ruleType,
          condition: rule.condition,
          actions: triggerData.actions,
          cooldown_minutes: rule.timing.cooldownMinutes,
          max_fires_per_day: rule.timing.maxFiresPerDay,
          enabled: true,
          fire_count: 0,
          notification_channels: rule.notification.channels,
          metadata: {
            urgency: rule.notification.urgency,
            targetType: rule.target.type,
            messageTemplate: rule.notification.messageTemplate,
            templateId: rule.templateId,
          },
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        });

      if (error) {
        console.error('[CustomAlerts] Failed to create alert rule:', error);
        throw new Error('Failed to create alert rule');
      }

      // Invalidate trigger engine cache
      triggerEngine.clearCache();
    }

    return rule;
  }

  /**
   * Get all custom alert rules for a user
   */
  async getAlertRules(userId: string, options?: {
    customerId?: string;
    enabled?: boolean;
    metric?: AlertMetricType;
  }): Promise<CustomAlertRule[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('triggers')
      .select('*')
      .eq('user_id', userId)
      .in('rule_type', ['custom', 'template'])
      .order('created_at', { ascending: false });

    if (options?.customerId) {
      query = query.or(`customer_id.eq.${options.customerId},customer_id.is.null`);
    }

    if (options?.enabled !== undefined) {
      query = query.eq('enabled', options.enabled);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[CustomAlerts] Failed to fetch alert rules:', error);
      return [];
    }

    return (data || []).map(row => this.rowToRule(row));
  }

  /**
   * Get a single alert rule by ID
   */
  async getAlertRule(id: string): Promise<CustomAlertRule | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('triggers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    return this.rowToRule(data);
  }

  /**
   * Update an alert rule
   */
  async updateAlertRule(id: string, updates: Partial<CustomAlertRule>): Promise<CustomAlertRule | null> {
    if (!this.supabase) return null;

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
    if (updates.condition !== undefined) updateData.condition = updates.condition;
    if (updates.timing?.cooldownMinutes !== undefined) {
      updateData.cooldown_minutes = updates.timing.cooldownMinutes;
    }
    if (updates.timing?.maxFiresPerDay !== undefined) {
      updateData.max_fires_per_day = updates.timing.maxFiresPerDay;
    }
    if (updates.notification?.channels !== undefined) {
      updateData.notification_channels = updates.notification.channels;
    }
    if (updates.notification !== undefined || updates.target !== undefined) {
      // Fetch existing metadata and merge
      const existing = await this.getAlertRule(id);
      if (existing) {
        updateData.metadata = {
          urgency: updates.notification?.urgency || existing.notification.urgency,
          targetType: updates.target?.type || existing.target.type,
          messageTemplate: updates.notification?.messageTemplate || existing.notification.messageTemplate,
          templateId: existing.templateId,
        };
      }
    }

    const { data, error } = await this.supabase
      .from('triggers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      console.error('[CustomAlerts] Failed to update alert rule:', error);
      return null;
    }

    // Invalidate trigger engine cache
    triggerEngine.clearCache();

    return this.rowToRule(data);
  }

  /**
   * Delete an alert rule
   */
  async deleteAlertRule(id: string): Promise<boolean> {
    if (!this.supabase) return false;

    const { error } = await this.supabase
      .from('triggers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[CustomAlerts] Failed to delete alert rule:', error);
      return false;
    }

    // Invalidate trigger engine cache
    triggerEngine.clearCache();

    return true;
  }

  /**
   * Enable/disable an alert rule
   */
  async toggleAlertRule(id: string, enabled: boolean): Promise<boolean> {
    const result = await this.updateAlertRule(id, { enabled });
    return result !== null;
  }

  // ============================================
  // Alert Events
  // ============================================

  /**
   * Get alert history for a customer
   */
  async getAlertHistory(options: {
    customerId?: string;
    alertRuleId?: string;
    acknowledged?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<AlertEvent[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('trigger_events')
      .select(`
        *,
        triggers (name, type, metadata)
      `)
      .order('fired_at', { ascending: false })
      .range(options.offset || 0, (options.offset || 0) + (options.limit || 50) - 1);

    if (options.customerId) {
      query = query.eq('customer_id', options.customerId);
    }

    if (options.alertRuleId) {
      query = query.eq('trigger_id', options.alertRuleId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[CustomAlerts] Failed to fetch alert history:', error);
      return [];
    }

    return (data || []).map(row => this.rowToAlertEvent(row));
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertEventId: string, userId: string): Promise<boolean> {
    if (!this.supabase) return false;

    const { error } = await this.supabase
      .from('trigger_events')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
      })
      .eq('id', alertEventId);

    if (error) {
      console.error('[CustomAlerts] Failed to acknowledge alert:', error);
      return false;
    }

    return true;
  }

  // ============================================
  // Alert Summary
  // ============================================

  /**
   * Get alert summary statistics
   */
  async getAlertSummary(userId: string): Promise<{
    totalRules: number;
    activeRules: number;
    alertsFiredToday: number;
    alertsFiredWeek: number;
    byUrgency: Record<AlertUrgency, number>;
    byMetric: Record<string, number>;
  }> {
    if (!this.supabase) {
      return {
        totalRules: 0,
        activeRules: 0,
        alertsFiredToday: 0,
        alertsFiredWeek: 0,
        byUrgency: { low: 0, medium: 0, high: 0, critical: 0 },
        byMetric: {},
      };
    }

    // Get rules
    const { data: rules } = await this.supabase
      .from('triggers')
      .select('id, enabled, condition, metadata')
      .eq('user_id', userId)
      .in('rule_type', ['custom', 'template']);

    // Get events
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { data: todayEvents } = await this.supabase
      .from('trigger_events')
      .select('id, trigger_id')
      .gte('fired_at', today.toISOString());

    const { data: weekEvents } = await this.supabase
      .from('trigger_events')
      .select('id, trigger_id')
      .gte('fired_at', weekAgo.toISOString());

    // Calculate stats
    const byUrgency: Record<AlertUrgency, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    const byMetric: Record<string, number> = {};

    (rules || []).forEach(rule => {
      const urgency = (rule.metadata?.urgency as AlertUrgency) || 'medium';
      byUrgency[urgency]++;

      const metric = rule.condition?.metric || 'custom';
      byMetric[metric] = (byMetric[metric] || 0) + 1;
    });

    return {
      totalRules: rules?.length || 0,
      activeRules: rules?.filter(r => r.enabled).length || 0,
      alertsFiredToday: todayEvents?.length || 0,
      alertsFiredWeek: weekEvents?.length || 0,
      byUrgency,
      byMetric,
    };
  }

  // ============================================
  // Customer-Specific Alerts
  // ============================================

  /**
   * Get alert rules for a specific customer
   */
  async getCustomerAlerts(customerId: string): Promise<{
    rules: CustomAlertRule[];
    recentEvents: AlertEvent[];
    pendingCount: number;
  }> {
    if (!this.supabase) {
      return { rules: [], recentEvents: [], pendingCount: 0 };
    }

    // Get rules
    const { data: rules } = await this.supabase
      .from('triggers')
      .select('*')
      .or(`customer_id.eq.${customerId},customer_id.is.null`)
      .in('rule_type', ['custom', 'template', 'system'])
      .eq('enabled', true);

    // Get recent events
    const { data: events } = await this.supabase
      .from('trigger_events')
      .select(`*, triggers (name, type, metadata)`)
      .eq('customer_id', customerId)
      .order('fired_at', { ascending: false })
      .limit(10);

    // Count unacknowledged
    const { count } = await this.supabase
      .from('trigger_events')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('acknowledged', false);

    return {
      rules: (rules || []).map(r => this.rowToRule(r)),
      recentEvents: (events || []).map(e => this.rowToAlertEvent(e)),
      pendingCount: count || 0,
    };
  }

  // ============================================
  // Helpers
  // ============================================

  private rowToRule(row: any): CustomAlertRule {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      enabled: row.enabled,
      ruleType: row.rule_type || 'custom',
      target: {
        type: row.metadata?.targetType || 'customer',
        customerId: row.customer_id,
      },
      condition: row.condition || {},
      notification: {
        channels: row.notification_channels || ['in_app'],
        urgency: row.metadata?.urgency || 'medium',
        messageTemplate: row.metadata?.messageTemplate,
      },
      timing: {
        cooldownMinutes: row.cooldown_minutes || 60,
        maxFiresPerDay: row.max_fires_per_day || 10,
      },
      templateId: row.metadata?.templateId,
      lastFiredAt: row.last_fired_at ? new Date(row.last_fired_at) : undefined,
      fireCount: row.fire_count || 0,
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private rowToAlertEvent(row: any): AlertEvent {
    return {
      id: row.id,
      alertRuleId: row.trigger_id,
      alertRuleName: row.triggers?.name || 'Unknown',
      customerId: row.customer_id,
      customerName: row.event_data?.customerName || 'Unknown',
      metric: row.event_data?.metric || 'custom',
      previousValue: row.event_data?.previousValue,
      currentValue: row.event_data?.currentValue || 0,
      threshold: row.event_data?.threshold || 0,
      operator: row.event_data?.operator || 'below',
      urgency: row.triggers?.metadata?.urgency || 'medium',
      notificationsSent: row.actions_executed || [],
      acknowledged: row.acknowledged || false,
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
      acknowledgedBy: row.acknowledged_by,
      firedAt: new Date(row.fired_at),
    };
  }

  private ruleToTrigger(rule: CustomAlertRule): { condition: TriggerCondition; actions: TriggerAction[] } {
    // Map metric to trigger type
    const triggerTypeMap: Record<AlertMetricType, TriggerType> = {
      health_score: 'health_score_drop',
      usage: 'usage_drop',
      engagement: 'usage_anomaly',
      nps: 'nps_submitted',
      support_tickets: 'ticket_escalated',
      feature_adoption: 'adoption_stalled',
      login_activity: 'no_login',
      contract_value: 'custom',
      days_to_renewal: 'renewal_approaching',
      custom: 'custom',
    };

    const condition: TriggerCondition = {
      type: triggerTypeMap[rule.condition.metric] || 'custom',
      params: {
        metric: rule.condition.metric,
        operator: rule.condition.operator,
        threshold: rule.condition.threshold,
      },
    };

    const actions: TriggerAction[] = [];

    // Add notification actions based on channels
    if (rule.notification.channels.includes('in_app')) {
      actions.push({
        id: uuidv4(),
        type: 'notify_csm',
        params: {
          message: rule.notification.messageTemplate || `Alert: ${rule.name}`,
          urgency: rule.notification.urgency,
        },
      });
    }

    if (rule.notification.channels.includes('email')) {
      actions.push({
        id: uuidv4(),
        type: 'send_email',
        tool: 'mcp__gmail__send_email',
        params: {
          subject: `[CSCX Alert] ${rule.name}`,
          body: rule.notification.messageTemplate || `Alert triggered for {{customerName}}`,
        },
        requiresApproval: false,
      });
    }

    if (rule.notification.channels.includes('slack')) {
      actions.push({
        id: uuidv4(),
        type: 'send_slack',
        tool: 'mcp__slack__send_message',
        params: {
          channel: rule.notification.slackChannel || '#alerts',
          message: rule.notification.messageTemplate || `Alert: ${rule.name} for {{customerName}}`,
        },
      });
    }

    return { condition, actions };
  }

  private getMetricUnit(metric: AlertMetricType): string {
    const units: Record<AlertMetricType, string> = {
      health_score: '%',
      usage: '%',
      engagement: '%',
      nps: '',
      support_tickets: 'tickets',
      feature_adoption: '%',
      login_activity: 'days',
      contract_value: 'USD',
      days_to_renewal: 'days',
      custom: '',
    };
    return units[metric] || '';
  }

  private getDefaultCooldown(urgency: AlertUrgency): number {
    const cooldowns: Record<AlertUrgency, number> = {
      low: 10080,      // 7 days
      medium: 1440,    // 24 hours
      high: 240,       // 4 hours
      critical: 60,    // 1 hour
    };
    return cooldowns[urgency] || 1440;
  }
}

// Export singleton
export const customAlertsService = new CustomAlertsService();
