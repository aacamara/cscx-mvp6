/**
 * Integration Health Monitoring Service
 *
 * PRD-101: Integration Disconnected Alert
 *
 * Monitors integration health including:
 * - OAuth token expiration/refresh failures
 * - API authentication failures
 * - Webhook delivery failures
 * - SSO authentication issues
 * - Partial failures (some endpoints working, others not)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { sendSlackAlert } from '../notifications/slack.js';
import { sendNotification } from '../notifications/index.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Types
// ============================================

export type IntegrationStatus = 'healthy' | 'degraded' | 'disconnected';

export type IntegrationType =
  | 'salesforce'
  | 'hubspot'
  | 'slack'
  | 'google'
  | 'zoom'
  | 'custom_api'
  | 'webhook';

export type IntegrationEventType =
  | 'auth_failure'
  | 'token_expired'
  | 'refresh_failed'
  | 'webhook_failed'
  | 'api_error'
  | 'sso_failure'
  | 'rate_limited'
  | 'partial_failure'
  | 'reconnected'
  | 'health_check';

export interface IntegrationHealth {
  id: string;
  customerId: string;
  integrationType: IntegrationType;
  integrationId?: string;
  integrationName?: string;
  status: IntegrationStatus;
  lastSuccessfulSync?: Date;
  lastFailureAt?: Date;
  failureCount: number;
  failureReason?: string;
  errorCode?: string;
  errorDetails?: Record<string, unknown>;
  isCritical: boolean;
  alertedAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrationEvent {
  id?: string;
  customerId: string;
  integrationType: IntegrationType;
  integrationId?: string;
  eventType: IntegrationEventType;
  errorDetails?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

export interface IntegrationAlertParams {
  customerId: string;
  customerName: string;
  customerARR?: number;
  integrationType: IntegrationType;
  integrationName: string;
  status: IntegrationStatus;
  failureReason: string;
  errorCode?: string;
  isCritical: boolean;
  technicalContactEmail?: string;
  technicalContactName?: string;
  csmUserId: string;
  slackWebhookUrl?: string;
}

export interface TroubleshootingStep {
  step: number;
  instruction: string;
  actionUrl?: string;
}

// ============================================
// Severity Calculation
// ============================================

/**
 * Calculate alert severity based on integration criticality and customer ARR
 */
export function calculateSeverity(
  isCritical: boolean,
  customerARR?: number,
  failureCount: number = 1
): 'low' | 'medium' | 'high' | 'critical' {
  // Critical integrations always have elevated severity
  if (isCritical) {
    if (customerARR && customerARR >= 100000) return 'critical';
    if (customerARR && customerARR >= 50000) return 'high';
    return 'high';
  }

  // Non-critical integrations
  if (customerARR && customerARR >= 200000) return 'high';
  if (customerARR && customerARR >= 100000) return 'medium';
  if (failureCount >= 5) return 'medium';

  return 'low';
}

// ============================================
// Troubleshooting Steps
// ============================================

const TROUBLESHOOTING_STEPS: Record<IntegrationType, TroubleshootingStep[]> = {
  salesforce: [
    { step: 1, instruction: 'Customer needs to reauthorize Salesforce connection' },
    { step: 2, instruction: 'Direct them to: Settings > Integrations > Salesforce > Reconnect', actionUrl: '/settings/integrations/salesforce' },
    { step: 3, instruction: 'If issue persists, check Salesforce API permissions' },
    { step: 4, instruction: 'Verify Salesforce connected app is not expired or revoked' },
  ],
  hubspot: [
    { step: 1, instruction: 'Customer needs to reauthorize HubSpot connection' },
    { step: 2, instruction: 'Direct them to: Settings > Integrations > HubSpot > Reconnect', actionUrl: '/settings/integrations/hubspot' },
    { step: 3, instruction: 'Check HubSpot API key or OAuth app permissions' },
  ],
  slack: [
    { step: 1, instruction: 'Reinstall the Slack app from workspace settings' },
    { step: 2, instruction: 'Direct them to: Settings > Integrations > Slack > Reinstall', actionUrl: '/settings/integrations/slack' },
    { step: 3, instruction: 'Ensure the bot has appropriate channel permissions' },
  ],
  google: [
    { step: 1, instruction: 'Customer needs to reauthorize Google Workspace connection' },
    { step: 2, instruction: 'Direct them to: Settings > Integrations > Google > Reconnect', actionUrl: '/settings/integrations/google' },
    { step: 3, instruction: 'Check that required Google Workspace APIs are enabled' },
    { step: 4, instruction: 'Verify OAuth consent screen and scopes are configured correctly' },
  ],
  zoom: [
    { step: 1, instruction: 'Customer needs to reauthorize Zoom connection' },
    { step: 2, instruction: 'Direct them to: Settings > Integrations > Zoom > Reconnect', actionUrl: '/settings/integrations/zoom' },
    { step: 3, instruction: 'Check Zoom app marketplace permissions' },
  ],
  custom_api: [
    { step: 1, instruction: 'Verify API endpoint is accessible and responding' },
    { step: 2, instruction: 'Check API credentials (API key, token, etc.)' },
    { step: 3, instruction: 'Review API rate limits and usage quotas' },
    { step: 4, instruction: 'Contact technical team if endpoint configuration changed' },
  ],
  webhook: [
    { step: 1, instruction: 'Verify webhook endpoint URL is accessible' },
    { step: 2, instruction: 'Check webhook authentication headers or signatures' },
    { step: 3, instruction: 'Review recent webhook delivery logs for error codes' },
    { step: 4, instruction: 'Test webhook manually using curl or Postman' },
  ],
};

/**
 * Get troubleshooting steps for an integration type
 */
export function getTroubleshootingSteps(integrationType: IntegrationType): TroubleshootingStep[] {
  return TROUBLESHOOTING_STEPS[integrationType] || TROUBLESHOOTING_STEPS.custom_api;
}

// ============================================
// Integration Health Service
// ============================================

class IntegrationHealthService {
  // In-memory cache for demo mode
  private healthCache: Map<string, IntegrationHealth> = new Map();
  private eventsCache: IntegrationEvent[] = [];

  /**
   * Record an integration event (auth failure, webhook failure, etc.)
   */
  async recordEvent(event: IntegrationEvent): Promise<void> {
    // Save event to database
    if (supabase) {
      try {
        await supabase.from('integration_events').insert({
          customer_id: event.customerId,
          integration_type: event.integrationType,
          integration_id: event.integrationId,
          event_type: event.eventType,
          error_details: event.errorDetails || {},
          metadata: event.metadata || {},
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Failed to record integration event:', err);
      }
    } else {
      // Demo mode - store in memory
      this.eventsCache.push({
        ...event,
        id: `event-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: new Date(),
      });
    }

    // Update health status based on event type
    if (this.isFailureEvent(event.eventType)) {
      await this.updateHealthStatus(event.customerId, event.integrationType, event);
    } else if (event.eventType === 'reconnected') {
      await this.markAsResolved(event.customerId, event.integrationType);
    }
  }

  /**
   * Check if event type is a failure
   */
  private isFailureEvent(eventType: IntegrationEventType): boolean {
    return [
      'auth_failure',
      'token_expired',
      'refresh_failed',
      'webhook_failed',
      'api_error',
      'sso_failure',
      'rate_limited',
      'partial_failure',
    ].includes(eventType);
  }

  /**
   * Update integration health status after a failure event
   */
  async updateHealthStatus(
    customerId: string,
    integrationType: IntegrationType,
    event: IntegrationEvent
  ): Promise<IntegrationHealth | null> {
    const key = `${customerId}:${integrationType}`;
    let health: IntegrationHealth | null = null;

    if (supabase) {
      // Get or create health record
      const { data: existing } = await supabase
        .from('integration_health')
        .select('*')
        .eq('customer_id', customerId)
        .eq('integration_type', integrationType)
        .single();

      const now = new Date();
      const failureCount = (existing?.failure_count || 0) + 1;

      // Determine new status
      let newStatus: IntegrationStatus = 'degraded';
      if (event.eventType === 'auth_failure' || event.eventType === 'token_expired' || event.eventType === 'refresh_failed') {
        newStatus = 'disconnected';
      } else if (failureCount >= 3) {
        newStatus = 'disconnected';
      }

      // Determine failure reason
      const failureReason = this.getFailureReason(event);
      const errorCode = (event.errorDetails?.code as string) || event.eventType.toUpperCase();

      if (existing) {
        const { data } = await supabase
          .from('integration_health')
          .update({
            status: newStatus,
            last_failure_at: now.toISOString(),
            failure_count: failureCount,
            failure_reason: failureReason,
            error_code: errorCode,
            resolved_at: null,
            updated_at: now.toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (data) {
          health = this.mapToHealthRecord(data);
        }
      } else {
        const { data } = await supabase
          .from('integration_health')
          .insert({
            customer_id: customerId,
            integration_type: integrationType,
            integration_id: event.integrationId,
            status: newStatus,
            last_failure_at: now.toISOString(),
            failure_count: 1,
            failure_reason: failureReason,
            error_code: errorCode,
            is_critical: false,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .select()
          .single();

        if (data) {
          health = this.mapToHealthRecord(data);
        }
      }
    } else {
      // Demo mode
      const existing = this.healthCache.get(key);
      const now = new Date();
      const failureCount = (existing?.failureCount || 0) + 1;

      let newStatus: IntegrationStatus = 'degraded';
      if (event.eventType === 'auth_failure' || event.eventType === 'token_expired' || event.eventType === 'refresh_failed') {
        newStatus = 'disconnected';
      } else if (failureCount >= 3) {
        newStatus = 'disconnected';
      }

      health = {
        id: existing?.id || `health-${Date.now()}`,
        customerId,
        integrationType,
        integrationId: event.integrationId,
        status: newStatus,
        lastFailureAt: now,
        failureCount,
        failureReason: this.getFailureReason(event),
        errorCode: (event.errorDetails?.code as string) || event.eventType.toUpperCase(),
        isCritical: existing?.isCritical || false,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      this.healthCache.set(key, health);
    }

    return health;
  }

  /**
   * Get failure reason from event
   */
  private getFailureReason(event: IntegrationEvent): string {
    const reasons: Record<IntegrationEventType, string> = {
      auth_failure: 'Authentication failed - credentials may be invalid',
      token_expired: 'OAuth token expired and refresh failed',
      refresh_failed: 'Failed to refresh OAuth token',
      webhook_failed: 'Webhook delivery failed - endpoint unreachable or returned error',
      api_error: 'API request failed',
      sso_failure: 'SSO authentication failed',
      rate_limited: 'API rate limit exceeded',
      partial_failure: 'Some API endpoints are failing while others work',
      reconnected: 'Connection restored',
      health_check: 'Health check performed',
    };

    return (event.errorDetails?.message as string) || reasons[event.eventType] || 'Unknown error';
  }

  /**
   * Mark an integration as resolved
   */
  async markAsResolved(customerId: string, integrationType: IntegrationType): Promise<void> {
    const key = `${customerId}:${integrationType}`;
    const now = new Date();

    if (supabase) {
      await supabase
        .from('integration_health')
        .update({
          status: 'healthy',
          failure_count: 0,
          failure_reason: null,
          error_code: null,
          resolved_at: now.toISOString(),
          last_successful_sync: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('customer_id', customerId)
        .eq('integration_type', integrationType);
    } else {
      const existing = this.healthCache.get(key);
      if (existing) {
        this.healthCache.set(key, {
          ...existing,
          status: 'healthy',
          failureCount: 0,
          failureReason: undefined,
          errorCode: undefined,
          resolvedAt: now,
          lastSuccessfulSync: now,
          updatedAt: now,
        });
      }
    }
  }

  /**
   * Get integration health for a customer
   */
  async getIntegrationHealth(
    customerId: string,
    integrationType?: IntegrationType
  ): Promise<IntegrationHealth[]> {
    if (supabase) {
      let query = supabase
        .from('integration_health')
        .select('*')
        .eq('customer_id', customerId);

      if (integrationType) {
        query = query.eq('integration_type', integrationType);
      }

      const { data } = await query.order('updated_at', { ascending: false });
      return (data || []).map(this.mapToHealthRecord);
    }

    // Demo mode
    const results: IntegrationHealth[] = [];
    this.healthCache.forEach((health) => {
      if (health.customerId === customerId) {
        if (!integrationType || health.integrationType === integrationType) {
          results.push(health);
        }
      }
    });

    return results;
  }

  /**
   * Get all disconnected integrations
   */
  async getDisconnectedIntegrations(): Promise<IntegrationHealth[]> {
    if (supabase) {
      const { data } = await supabase
        .from('integration_health')
        .select('*')
        .eq('status', 'disconnected')
        .is('resolved_at', null)
        .order('last_failure_at', { ascending: false });

      return (data || []).map(this.mapToHealthRecord);
    }

    // Demo mode
    const results: IntegrationHealth[] = [];
    this.healthCache.forEach((health) => {
      if (health.status === 'disconnected' && !health.resolvedAt) {
        results.push(health);
      }
    });

    return results;
  }

  /**
   * Get integration events for a customer
   */
  async getIntegrationEvents(
    customerId: string,
    limit: number = 50
  ): Promise<IntegrationEvent[]> {
    if (supabase) {
      const { data } = await supabase
        .from('integration_events')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(limit);

      return (data || []).map((e) => ({
        id: e.id,
        customerId: e.customer_id,
        integrationType: e.integration_type,
        integrationId: e.integration_id,
        eventType: e.event_type,
        errorDetails: e.error_details,
        metadata: e.metadata,
        createdAt: new Date(e.created_at),
      }));
    }

    // Demo mode
    return this.eventsCache
      .filter((e) => e.customerId === customerId)
      .slice(0, limit);
  }

  /**
   * Check if an alert should be sent (deduplication)
   */
  async shouldSendAlert(customerId: string, integrationType: IntegrationType): Promise<boolean> {
    if (supabase) {
      const { data } = await supabase
        .from('integration_health')
        .select('alerted_at')
        .eq('customer_id', customerId)
        .eq('integration_type', integrationType)
        .single();

      // Don't alert if already alerted in the last hour
      if (data?.alerted_at) {
        const alertedAt = new Date(data.alerted_at);
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return alertedAt < hourAgo;
      }

      return true;
    }

    // Demo mode
    const key = `${customerId}:${integrationType}`;
    const health = this.healthCache.get(key);
    if (health?.alertedAt) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return health.alertedAt < hourAgo;
    }

    return true;
  }

  /**
   * Mark that an alert was sent
   */
  async markAlerted(customerId: string, integrationType: IntegrationType): Promise<void> {
    const now = new Date();

    if (supabase) {
      await supabase
        .from('integration_health')
        .update({ alerted_at: now.toISOString() })
        .eq('customer_id', customerId)
        .eq('integration_type', integrationType);
    } else {
      const key = `${customerId}:${integrationType}`;
      const health = this.healthCache.get(key);
      if (health) {
        this.healthCache.set(key, { ...health, alertedAt: now });
      }
    }
  }

  /**
   * Send integration disconnection alert
   */
  async sendDisconnectionAlert(params: IntegrationAlertParams): Promise<{
    slackSent: boolean;
    emailSent: boolean;
    notificationSent: boolean;
  }> {
    const result = {
      slackSent: false,
      emailSent: false,
      notificationSent: false,
    };

    // Check deduplication
    const shouldAlert = await this.shouldSendAlert(params.customerId, params.integrationType);
    if (!shouldAlert) {
      console.log(`[IntegrationHealth] Skipping duplicate alert for ${params.customerName} - ${params.integrationType}`);
      return result;
    }

    const severity = calculateSeverity(params.isCritical, params.customerARR);
    const troubleshootingSteps = getTroubleshootingSteps(params.integrationType);

    // 1. Send Slack alert if webhook URL provided
    if (params.slackWebhookUrl) {
      try {
        const slackMessage = this.buildSlackAlertMessage(params, troubleshootingSteps);
        result.slackSent = await sendSlackAlert(params.slackWebhookUrl, {
          type: 'risk_signal',
          title: `Integration Disconnected: ${params.customerName}`,
          message: slackMessage,
          customer: {
            id: params.customerId,
            name: params.customerName,
            arr: params.customerARR,
          },
          priority: severity === 'critical' ? 'urgent' : severity === 'high' ? 'high' : 'medium',
          actionUrl: `/customers/${params.customerId}?tab=integrations`,
          fields: {
            integration: params.integrationName,
            status: params.status.toUpperCase(),
            errorCode: params.errorCode,
            critical: params.isCritical ? 'Yes' : 'No',
          },
        });
      } catch (err) {
        console.error('Failed to send Slack alert:', err);
      }
    }

    // 2. Send in-app notification to CSM
    try {
      const notificationResult = await sendNotification(params.csmUserId, {
        type: 'risk_signal',
        title: `Integration Disconnected: ${params.customerName}`,
        body: `${params.integrationName} integration disconnected. ${params.failureReason}`,
        priority: severity === 'critical' ? 'urgent' : severity === 'high' ? 'high' : 'medium',
        customerId: params.customerId,
        customerName: params.customerName,
        actionUrl: `/customers/${params.customerId}?tab=integrations`,
        data: {
          integrationType: params.integrationType,
          integrationName: params.integrationName,
          errorCode: params.errorCode,
          isCritical: params.isCritical,
        },
      });
      result.notificationSent = notificationResult.inApp;
      result.emailSent = notificationResult.email;
    } catch (err) {
      console.error('Failed to send notification:', err);
    }

    // Mark as alerted
    await this.markAlerted(params.customerId, params.integrationType);

    return result;
  }

  /**
   * Build Slack alert message
   */
  private buildSlackAlertMessage(
    params: IntegrationAlertParams,
    troubleshootingSteps: TroubleshootingStep[]
  ): string {
    const lines: string[] = [
      `*Integration:* ${params.integrationName}`,
      `*Status:* ${params.status.toUpperCase()}`,
      `*Error:* ${params.failureReason}`,
    ];

    if (params.errorCode) {
      lines.push(`*Error Code:* ${params.errorCode}`);
    }

    lines.push('');
    lines.push('*Impact:*');
    if (params.isCritical) {
      lines.push('- This is marked as a *CRITICAL* integration');
    }
    lines.push('- Data sync has stopped');
    lines.push('- Automated workflows may be affected');

    if (params.technicalContactName) {
      lines.push('');
      lines.push(`*Technical Contact:* ${params.technicalContactName}`);
      if (params.technicalContactEmail) {
        lines.push(`*Email:* ${params.technicalContactEmail}`);
      }
    }

    lines.push('');
    lines.push('*Troubleshooting Steps:*');
    troubleshootingSteps.forEach((step) => {
      lines.push(`${step.step}. ${step.instruction}`);
    });

    return lines.join('\n');
  }

  /**
   * Mark integration as critical
   */
  async setIntegrationCritical(
    customerId: string,
    integrationType: IntegrationType,
    isCritical: boolean
  ): Promise<void> {
    if (supabase) {
      await supabase
        .from('integration_health')
        .update({ is_critical: isCritical, updated_at: new Date().toISOString() })
        .eq('customer_id', customerId)
        .eq('integration_type', integrationType);
    } else {
      const key = `${customerId}:${integrationType}`;
      const health = this.healthCache.get(key);
      if (health) {
        this.healthCache.set(key, { ...health, isCritical, updatedAt: new Date() });
      }
    }
  }

  /**
   * Get health metrics summary
   */
  async getHealthMetrics(): Promise<{
    totalIntegrations: number;
    healthy: number;
    degraded: number;
    disconnected: number;
    criticalDisconnected: number;
  }> {
    if (supabase) {
      const { data } = await supabase
        .from('integration_health')
        .select('status, is_critical')
        .is('resolved_at', null);

      const metrics = {
        totalIntegrations: data?.length || 0,
        healthy: 0,
        degraded: 0,
        disconnected: 0,
        criticalDisconnected: 0,
      };

      data?.forEach((h) => {
        if (h.status === 'healthy') metrics.healthy++;
        else if (h.status === 'degraded') metrics.degraded++;
        else if (h.status === 'disconnected') {
          metrics.disconnected++;
          if (h.is_critical) metrics.criticalDisconnected++;
        }
      });

      return metrics;
    }

    // Demo mode
    const metrics = {
      totalIntegrations: 0,
      healthy: 0,
      degraded: 0,
      disconnected: 0,
      criticalDisconnected: 0,
    };

    this.healthCache.forEach((health) => {
      if (!health.resolvedAt) {
        metrics.totalIntegrations++;
        if (health.status === 'healthy') metrics.healthy++;
        else if (health.status === 'degraded') metrics.degraded++;
        else if (health.status === 'disconnected') {
          metrics.disconnected++;
          if (health.isCritical) metrics.criticalDisconnected++;
        }
      }
    });

    return metrics;
  }

  /**
   * Map database row to IntegrationHealth
   */
  private mapToHealthRecord(row: Record<string, unknown>): IntegrationHealth {
    return {
      id: row.id as string,
      customerId: row.customer_id as string,
      integrationType: row.integration_type as IntegrationType,
      integrationId: row.integration_id as string | undefined,
      integrationName: row.integration_name as string | undefined,
      status: row.status as IntegrationStatus,
      lastSuccessfulSync: row.last_successful_sync ? new Date(row.last_successful_sync as string) : undefined,
      lastFailureAt: row.last_failure_at ? new Date(row.last_failure_at as string) : undefined,
      failureCount: row.failure_count as number,
      failureReason: row.failure_reason as string | undefined,
      errorCode: row.error_code as string | undefined,
      errorDetails: row.error_details as Record<string, unknown> | undefined,
      isCritical: row.is_critical as boolean,
      alertedAt: row.alerted_at ? new Date(row.alerted_at as string) : undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  /**
   * Run periodic health check on all integrations
   * This should be called by a cron job
   */
  async runHealthCheck(): Promise<{
    checked: number;
    alerts: number;
  }> {
    const result = { checked: 0, alerts: 0 };

    // Get all active integrations that haven't been checked recently
    const disconnected = await this.getDisconnectedIntegrations();

    for (const health of disconnected) {
      result.checked++;

      // If it's been more than 1 hour since last alert, send another
      if (await this.shouldSendAlert(health.customerId, health.integrationType)) {
        // Would need customer info from database to send full alert
        // This is a simplified version
        result.alerts++;
      }
    }

    return result;
  }
}

// Export singleton instance
export const integrationHealthService = new IntegrationHealthService();
export default integrationHealthService;
