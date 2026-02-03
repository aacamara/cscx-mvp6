/**
 * Mixpanel Integration Service - PRD-197
 *
 * Implements integration with Mixpanel product analytics:
 * - Service account authentication
 * - Event data aggregation by account
 * - Funnel performance tracking
 * - User profile aggregation
 * - Health score integration
 * - Circuit breaker and retry patterns
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { CircuitBreaker } from '../circuitBreaker.js';
import { withRetry, retryStrategies } from '../retry.js';
import crypto from 'crypto';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Circuit breaker for Mixpanel API calls
const mixpanelCircuitBreaker = new CircuitBreaker('mixpanel', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000, // 1 minute before retry
});

// ============================================
// Types
// ============================================

export interface MixpanelConnection {
  id?: string;
  projectId: string;
  projectSecret: string;
  serviceAccountUsername?: string;
  serviceAccountSecret?: string;
  dataResidency: 'US' | 'EU';
}

export interface MixpanelMetrics {
  customerId: string;
  metricDate: Date;
  totalEvents: number;
  uniqueUsers: number;
  sessions: number;
  avgEventsPerUser: number;
  avgSessionDurationSeconds: number;
  topEvents: Array<{ name: string; count: number }>;
  propertyBreakdowns: Record<string, Record<string, number>>;
}

export interface MixpanelFunnel {
  customerId: string;
  funnelId: string;
  funnelName: string;
  metricDate: Date;
  conversionRate: number;
  completedUsers: number;
  startedUsers: number;
  dropOffStep: number;
  steps: Array<{
    stepName: string;
    entered: number;
    completed: number;
    conversionRate: number;
  }>;
}

export interface MixpanelUserAggregate {
  customerId: string;
  snapshotDate: Date;
  totalUsers: number;
  activeUsers7d: number;
  activeUsers30d: number;
  newUsers7d: number;
  churnedUsers30d: number;
  powerUsers: number;
  avgLifetimeEvents: number;
  userSegments: Record<string, number>;
  customProperties: Record<string, unknown>;
}

export interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  syncLogId?: string;
}

export interface SyncConfig {
  syncSchedule: 'daily' | 'weekly' | 'manual';
  eventsToTrack: string[];
  funnelsToSync: string[];
  groupByProperty: string; // Property used to map events to customers
  dateRangeDays: number; // How many days of data to sync
}

export interface SyncStatus {
  connected: boolean;
  lastSyncAt?: Date;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  recordsSynced?: number;
  syncErrors?: string[];
  nextScheduledSync?: Date;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  syncSchedule: 'daily',
  eventsToTrack: [],
  funnelsToSync: [],
  groupByProperty: '$group_id', // Default Mixpanel group property
  dateRangeDays: 30,
};

// ============================================
// Mixpanel Service Class
// ============================================

export class MixpanelService {
  private apiVersion = '2.0';

  /**
   * Check if Mixpanel integration is configured
   */
  isConfigured(): boolean {
    return Boolean(process.env.MIXPANEL_PROJECT_ID && process.env.MIXPANEL_PROJECT_SECRET);
  }

  /**
   * Get API base URL based on data residency
   */
  private getApiBaseUrl(dataResidency: 'US' | 'EU' = 'US'): string {
    return dataResidency === 'EU'
      ? 'https://eu.mixpanel.com/api'
      : 'https://mixpanel.com/api';
  }

  /**
   * Get Data Export API base URL
   */
  private getDataExportBaseUrl(dataResidency: 'US' | 'EU' = 'US'): string {
    return dataResidency === 'EU'
      ? 'https://data-eu.mixpanel.com/api'
      : 'https://data.mixpanel.com/api';
  }

  /**
   * Create authentication headers for Mixpanel API
   */
  private getAuthHeaders(connection: MixpanelConnection): Record<string, string> {
    // Service account auth takes precedence
    if (connection.serviceAccountUsername && connection.serviceAccountSecret) {
      const credentials = Buffer.from(
        `${connection.serviceAccountUsername}:${connection.serviceAccountSecret}`
      ).toString('base64');
      return {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      };
    }

    // Fall back to project secret
    const credentials = Buffer.from(`${connection.projectSecret}:`).toString('base64');
    return {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Test connection to Mixpanel
   */
  async testConnection(connection: MixpanelConnection): Promise<{ success: boolean; message: string }> {
    try {
      const baseUrl = this.getApiBaseUrl(connection.dataResidency);
      const url = `${baseUrl}/${this.apiVersion}/engage?project_id=${connection.projectId}`;

      const response = await withRetry(
        async () => {
          return mixpanelCircuitBreaker.execute(async () => {
            const res = await fetch(url, {
              method: 'POST',
              headers: this.getAuthHeaders(connection),
              body: JSON.stringify({
                filter_by_cohort: '{}',
                page: 0,
                page_size: 1,
              }),
            });

            if (!res.ok) {
              const error = await res.text();
              throw new Error(`Mixpanel connection test failed: ${error}`);
            }

            return res.json();
          });
        },
        { ...retryStrategies.aiService, maxRetries: 2 }
      );

      return {
        success: true,
        message: `Connected to Mixpanel project ${connection.projectId}`,
      };
    } catch (error) {
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  }

  /**
   * Execute JQL (JavaScript Query Language) query
   */
  async executeJql<T>(connection: MixpanelConnection, script: string): Promise<T> {
    const baseUrl = this.getApiBaseUrl(connection.dataResidency);
    const url = `${baseUrl}/${this.apiVersion}/jql?project_id=${connection.projectId}`;

    const response = await withRetry(
      async () => {
        return mixpanelCircuitBreaker.execute(async () => {
          const res = await fetch(url, {
            method: 'POST',
            headers: this.getAuthHeaders(connection),
            body: JSON.stringify({ script }),
          });

          if (!res.ok) {
            const error = await res.text();
            if (res.status === 429) {
              throw new Error('RATE_LIMITED: ' + error);
            }
            throw new Error(`JQL query failed: ${error}`);
          }

          return res.json();
        });
      },
      {
        ...retryStrategies.aiService,
        retryableErrors: ['RATE_LIMITED', 'timeout', '503', '429', 'ECONNRESET'],
      }
    );

    return response as T;
  }

  /**
   * Export raw events for a date range
   */
  async exportEvents(
    connection: MixpanelConnection,
    fromDate: string,
    toDate: string,
    options: { event?: string; groupId?: string } = {}
  ): Promise<Array<Record<string, unknown>>> {
    const baseUrl = this.getDataExportBaseUrl(connection.dataResidency);
    const params = new URLSearchParams({
      project_id: connection.projectId,
      from_date: fromDate,
      to_date: toDate,
    });

    if (options.event) {
      params.append('event', JSON.stringify([options.event]));
    }

    const url = `${baseUrl}/${this.apiVersion}/export?${params.toString()}`;

    const response = await withRetry(
      async () => {
        return mixpanelCircuitBreaker.execute(async () => {
          const res = await fetch(url, {
            headers: this.getAuthHeaders(connection),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`Event export failed: ${error}`);
          }

          // Mixpanel exports as newline-delimited JSON
          const text = await res.text();
          const events = text
            .trim()
            .split('\n')
            .filter((line) => line)
            .map((line) => JSON.parse(line));

          return events;
        });
      },
      retryStrategies.aiService
    );

    return response;
  }

  /**
   * Get funnel data
   */
  async getFunnels(connection: MixpanelConnection): Promise<Array<{ funnel_id: number; name: string }>> {
    const baseUrl = this.getApiBaseUrl(connection.dataResidency);
    const url = `${baseUrl}/${this.apiVersion}/funnels/list?project_id=${connection.projectId}`;

    const response = await withRetry(
      async () => {
        return mixpanelCircuitBreaker.execute(async () => {
          const res = await fetch(url, {
            headers: this.getAuthHeaders(connection),
          });

          if (!res.ok) {
            throw new Error(`Failed to fetch funnels: ${await res.text()}`);
          }

          return res.json();
        });
      },
      retryStrategies.aiService
    );

    return response;
  }

  /**
   * Get funnel performance data
   */
  async getFunnelData(
    connection: MixpanelConnection,
    funnelId: string,
    fromDate: string,
    toDate: string,
    options: { groupId?: string } = {}
  ): Promise<MixpanelFunnel | null> {
    const baseUrl = this.getApiBaseUrl(connection.dataResidency);
    const params = new URLSearchParams({
      project_id: connection.projectId,
      funnel_id: funnelId,
      from_date: fromDate,
      to_date: toDate,
    });

    if (options.groupId) {
      params.append('where', `properties["$group_id"] == "${options.groupId}"`);
    }

    const url = `${baseUrl}/${this.apiVersion}/funnels?${params.toString()}`;

    const response = await withRetry(
      async () => {
        return mixpanelCircuitBreaker.execute(async () => {
          const res = await fetch(url, {
            headers: this.getAuthHeaders(connection),
          });

          if (!res.ok) {
            throw new Error(`Failed to fetch funnel data: ${await res.text()}`);
          }

          return res.json();
        });
      },
      retryStrategies.aiService
    );

    if (!response.data || !response.meta) {
      return null;
    }

    // Parse funnel response
    const dates = Object.keys(response.data);
    if (dates.length === 0) return null;

    const latestData = response.data[dates[dates.length - 1]];
    const steps = latestData.steps || [];

    let dropOffStep = 0;
    let maxDropOff = 0;

    const parsedSteps = steps.map((step: any, index: number) => {
      const entered = step.count || 0;
      const completed = steps[index + 1]?.count || 0;
      const conversionRate = entered > 0 ? (completed / entered) * 100 : 0;
      const dropOff = entered - completed;

      if (dropOff > maxDropOff) {
        maxDropOff = dropOff;
        dropOffStep = index + 1;
      }

      return {
        stepName: step.event || `Step ${index + 1}`,
        entered,
        completed,
        conversionRate: Math.round(conversionRate * 100) / 100,
      };
    });

    const firstStep = steps[0]?.count || 0;
    const lastStep = steps[steps.length - 1]?.count || 0;
    const overallConversion = firstStep > 0 ? (lastStep / firstStep) * 100 : 0;

    return {
      customerId: '', // Will be set by caller
      funnelId,
      funnelName: response.meta.name || `Funnel ${funnelId}`,
      metricDate: new Date(toDate),
      conversionRate: Math.round(overallConversion * 100) / 100,
      completedUsers: lastStep,
      startedUsers: firstStep,
      dropOffStep,
      steps: parsedSteps,
    };
  }

  /**
   * Sync event metrics for a customer
   */
  async syncEventMetrics(
    connection: MixpanelConnection,
    userId: string,
    customerId: string,
    mixpanelGroupId: string,
    options: { fromDate?: string; toDate?: string } = {}
  ): Promise<SyncResult> {
    const result: SyncResult = {
      synced: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    if (!supabase) {
      result.errors.push('Database not configured');
      return result;
    }

    const toDate = options.toDate || new Date().toISOString().split('T')[0];
    const fromDate =
      options.fromDate ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Start sync log
    const syncLog = await this.startSyncLog(userId, connection.id, 'events', [customerId]);
    result.syncLogId = syncLog?.id;

    try {
      // Use JQL to aggregate events by day for this group
      const script = `
        function main() {
          return Events({
            from_date: '${fromDate}',
            to_date: '${toDate}',
            event_selectors: [{event: '*'}]
          })
          .filter(function(event) {
            return event.properties['$group_id'] === '${mixpanelGroupId}';
          })
          .groupBy(['name', function(event) {
            return new Date(event.time).toISOString().split('T')[0];
          }], mixpanel.reducer.count());
        }
      `;

      const eventData = await this.executeJql<Array<{ key: [string, string]; value: number }>>(
        connection,
        script
      );

      // Aggregate by date
      const dateAggregates: Record<
        string,
        {
          totalEvents: number;
          eventCounts: Record<string, number>;
          uniqueUsers: Set<string>;
        }
      > = {};

      for (const item of eventData) {
        const [eventName, date] = item.key;
        if (!dateAggregates[date]) {
          dateAggregates[date] = {
            totalEvents: 0,
            eventCounts: {},
            uniqueUsers: new Set(),
          };
        }
        dateAggregates[date].totalEvents += item.value;
        dateAggregates[date].eventCounts[eventName] =
          (dateAggregates[date].eventCounts[eventName] || 0) + item.value;
      }

      // Get unique users per day with separate JQL
      const userScript = `
        function main() {
          return Events({
            from_date: '${fromDate}',
            to_date: '${toDate}'
          })
          .filter(function(event) {
            return event.properties['$group_id'] === '${mixpanelGroupId}';
          })
          .groupByUser(['distinct_id', function(event) {
            return new Date(event.time).toISOString().split('T')[0];
          }], mixpanel.reducer.count())
          .groupBy([function(item) { return item.key[1]; }], mixpanel.reducer.count());
        }
      `;

      const userData = await this.executeJql<Array<{ key: [string]; value: number }>>(
        connection,
        userScript
      );

      const uniqueUsersByDate: Record<string, number> = {};
      for (const item of userData) {
        uniqueUsersByDate[item.key[0]] = item.value;
      }

      // Upsert metrics for each date
      for (const [date, data] of Object.entries(dateAggregates)) {
        try {
          const topEvents = Object.entries(data.eventCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));

          const uniqueUsers = uniqueUsersByDate[date] || 0;
          const avgEventsPerUser = uniqueUsers > 0 ? data.totalEvents / uniqueUsers : 0;

          const metricsRecord = {
            customer_id: customerId,
            mixpanel_group_id: mixpanelGroupId,
            metric_date: date,
            total_events: data.totalEvents,
            unique_users: uniqueUsers,
            sessions: 0, // Would need separate query for session data
            avg_events_per_user: Math.round(avgEventsPerUser * 100) / 100,
            top_events: topEvents,
            updated_at: new Date().toISOString(),
          };

          const { data: existing } = await supabase
            .from('mixpanel_metrics')
            .select('id')
            .eq('customer_id', customerId)
            .eq('metric_date', date)
            .single();

          if (existing) {
            await supabase.from('mixpanel_metrics').update(metricsRecord).eq('id', existing.id);
            result.updated++;
          } else {
            await supabase.from('mixpanel_metrics').insert(metricsRecord);
            result.created++;
          }
          result.synced++;
        } catch (err) {
          result.errors.push(`Failed to sync metrics for ${date}: ${(err as Error).message}`);
        }
      }

      // Update customer's last sync timestamp
      await supabase
        .from('customers')
        .update({ last_mixpanel_sync: new Date().toISOString() })
        .eq('id', customerId);

      // Complete sync log
      await this.completeSyncLog(syncLog?.id, result, 'completed');
    } catch (error) {
      result.errors.push(`Sync failed: ${(error as Error).message}`);
      await this.completeSyncLog(syncLog?.id, result, 'failed');
    }

    return result;
  }

  /**
   * Sync funnel data for a customer
   */
  async syncFunnelMetrics(
    connection: MixpanelConnection,
    userId: string,
    customerId: string,
    mixpanelGroupId: string,
    funnelIds: string[],
    options: { fromDate?: string; toDate?: string } = {}
  ): Promise<SyncResult> {
    const result: SyncResult = {
      synced: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    if (!supabase) {
      result.errors.push('Database not configured');
      return result;
    }

    const toDate = options.toDate || new Date().toISOString().split('T')[0];
    const fromDate =
      options.fromDate ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const syncLog = await this.startSyncLog(userId, connection.id, 'funnels', [customerId]);
    result.syncLogId = syncLog?.id;

    try {
      // If no specific funnels, get all available
      let funnelsToSync = funnelIds;
      if (funnelsToSync.length === 0) {
        const allFunnels = await this.getFunnels(connection);
        funnelsToSync = allFunnels.map((f) => String(f.funnel_id));
      }

      for (const funnelId of funnelsToSync) {
        try {
          const funnelData = await this.getFunnelData(connection, funnelId, fromDate, toDate, {
            groupId: mixpanelGroupId,
          });

          if (!funnelData) {
            result.skipped++;
            continue;
          }

          funnelData.customerId = customerId;

          const funnelRecord = {
            customer_id: customerId,
            funnel_id: funnelId,
            funnel_name: funnelData.funnelName,
            metric_date: toDate,
            conversion_rate: funnelData.conversionRate,
            completed_users: funnelData.completedUsers,
            started_users: funnelData.startedUsers,
            drop_off_step: funnelData.dropOffStep,
            steps: funnelData.steps,
            updated_at: new Date().toISOString(),
          };

          const { data: existing } = await supabase
            .from('mixpanel_funnels')
            .select('id')
            .eq('customer_id', customerId)
            .eq('funnel_id', funnelId)
            .eq('metric_date', toDate)
            .single();

          if (existing) {
            await supabase.from('mixpanel_funnels').update(funnelRecord).eq('id', existing.id);
            result.updated++;
          } else {
            await supabase.from('mixpanel_funnels').insert(funnelRecord);
            result.created++;
          }
          result.synced++;
        } catch (err) {
          result.errors.push(`Failed to sync funnel ${funnelId}: ${(err as Error).message}`);
        }
      }

      await this.completeSyncLog(syncLog?.id, result, 'completed');
    } catch (error) {
      result.errors.push(`Funnel sync failed: ${(error as Error).message}`);
      await this.completeSyncLog(syncLog?.id, result, 'failed');
    }

    return result;
  }

  /**
   * Calculate and update engagement score for a customer
   */
  async updateEngagementScore(customerId: string): Promise<number | null> {
    if (!supabase) return null;

    try {
      // Get last 30 days of metrics
      const { data: metrics } = await supabase
        .from('mixpanel_metrics')
        .select('total_events, unique_users, sessions')
        .eq('customer_id', customerId)
        .gte('metric_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      // Get funnel conversions
      const { data: funnels } = await supabase
        .from('mixpanel_funnels')
        .select('conversion_rate')
        .eq('customer_id', customerId)
        .gte('metric_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      if (!metrics || metrics.length === 0) return null;

      // Calculate averages
      const avgEvents = metrics.reduce((sum, m) => sum + (m.total_events || 0), 0) / metrics.length;
      const avgUsers = metrics.reduce((sum, m) => sum + (m.unique_users || 0), 0) / metrics.length;
      const avgSessions = metrics.reduce((sum, m) => sum + (m.sessions || 0), 0) / metrics.length;
      const avgConversion =
        funnels && funnels.length > 0
          ? funnels.reduce((sum, f) => sum + (f.conversion_rate || 0), 0) / funnels.length
          : 0;

      // Calculate score (each component out of 25, total 100)
      let score = 0;
      score += Math.min(25, Math.floor(avgEvents / 100)); // Event activity
      score += Math.min(25, Math.floor(avgUsers / 10)); // User engagement
      score += Math.min(25, Math.floor(avgSessions / 20)); // Session depth
      score += Math.min(25, Math.floor(avgConversion / 4)); // Funnel conversion

      // Update customer
      await supabase
        .from('customers')
        .update({ mixpanel_engagement_score: Math.min(100, score) })
        .eq('id', customerId);

      return Math.min(100, score);
    } catch (error) {
      console.error('Failed to calculate engagement score:', error);
      return null;
    }
  }

  /**
   * Full sync for all customers with Mixpanel mapping
   */
  async fullSync(
    connection: MixpanelConnection,
    userId: string,
    options: { customerIds?: string[]; syncConfig?: Partial<SyncConfig> } = {}
  ): Promise<{
    events: SyncResult;
    funnels: SyncResult;
    totalDuration: number;
  }> {
    const startTime = Date.now();
    const config = { ...DEFAULT_SYNC_CONFIG, ...options.syncConfig };

    const eventsResult: SyncResult = { synced: 0, created: 0, updated: 0, skipped: 0, errors: [] };
    const funnelsResult: SyncResult = { synced: 0, created: 0, updated: 0, skipped: 0, errors: [] };

    if (!supabase) {
      eventsResult.errors.push('Database not configured');
      return { events: eventsResult, funnels: funnelsResult, totalDuration: Date.now() - startTime };
    }

    try {
      // Get customers with Mixpanel group IDs
      let query = supabase
        .from('customers')
        .select('id, mixpanel_group_id')
        .not('mixpanel_group_id', 'is', null);

      if (options.customerIds?.length) {
        query = query.in('id', options.customerIds);
      }

      const { data: customers } = await query;

      if (!customers || customers.length === 0) {
        eventsResult.skipped = 1;
        return { events: eventsResult, funnels: funnelsResult, totalDuration: Date.now() - startTime };
      }

      const fromDate = new Date(Date.now() - config.dateRangeDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const toDate = new Date().toISOString().split('T')[0];

      for (const customer of customers) {
        // Sync events
        const eventResult = await this.syncEventMetrics(
          connection,
          userId,
          customer.id,
          customer.mixpanel_group_id,
          { fromDate, toDate }
        );

        eventsResult.synced += eventResult.synced;
        eventsResult.created += eventResult.created;
        eventsResult.updated += eventResult.updated;
        eventsResult.errors.push(...eventResult.errors);

        // Sync funnels
        const funnelResult = await this.syncFunnelMetrics(
          connection,
          userId,
          customer.id,
          customer.mixpanel_group_id,
          config.funnelsToSync,
          { fromDate, toDate }
        );

        funnelsResult.synced += funnelResult.synced;
        funnelsResult.created += funnelResult.created;
        funnelsResult.updated += funnelResult.updated;
        funnelsResult.errors.push(...funnelResult.errors);

        // Update engagement score
        await this.updateEngagementScore(customer.id);
      }
    } catch (error) {
      eventsResult.errors.push(`Full sync failed: ${(error as Error).message}`);
    }

    return {
      events: eventsResult,
      funnels: funnelsResult,
      totalDuration: Date.now() - startTime,
    };
  }

  /**
   * Save connection to database
   */
  async saveConnection(
    userId: string,
    connection: MixpanelConnection,
    config?: Partial<SyncConfig>
  ): Promise<string> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const syncConfig = { ...DEFAULT_SYNC_CONFIG, ...config };

    const { data, error } = await supabase
      .from('integration_connections')
      .upsert(
        {
          user_id: userId,
          provider: 'mixpanel',
          access_token: connection.projectSecret,
          refresh_token: connection.serviceAccountSecret || null,
          instance_url: `https://${connection.dataResidency.toLowerCase()}.mixpanel.com`,
          field_mappings: {
            projectId: connection.projectId,
            dataResidency: connection.dataResidency,
            serviceAccountUsername: connection.serviceAccountUsername,
            ...syncConfig,
          },
          sync_schedule: syncConfig.syncSchedule,
          sync_enabled: true,
        },
        {
          onConflict: 'user_id,provider',
        }
      )
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to save connection: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Get saved connection for a user
   */
  async getConnection(userId: string): Promise<(MixpanelConnection & { id: string; config: Partial<SyncConfig> }) | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'mixpanel')
      .single();

    if (error || !data) return null;

    const fieldMappings = data.field_mappings || {};

    return {
      id: data.id,
      projectId: fieldMappings.projectId || '',
      projectSecret: data.access_token || '',
      serviceAccountUsername: fieldMappings.serviceAccountUsername,
      serviceAccountSecret: data.refresh_token || undefined,
      dataResidency: fieldMappings.dataResidency || 'US',
      config: {
        syncSchedule: data.sync_schedule || 'daily',
        eventsToTrack: fieldMappings.eventsToTrack || [],
        funnelsToSync: fieldMappings.funnelsToSync || [],
        groupByProperty: fieldMappings.groupByProperty || '$group_id',
        dateRangeDays: fieldMappings.dateRangeDays || 30,
      },
    };
  }

  /**
   * Disconnect Mixpanel integration
   */
  async disconnect(userId: string): Promise<void> {
    if (!supabase) return;

    await supabase.from('integration_connections').delete().eq('user_id', userId).eq('provider', 'mixpanel');
  }

  /**
   * Get sync status
   */
  async getSyncStatus(userId: string): Promise<SyncStatus> {
    if (!supabase) return { connected: false };

    const connection = await this.getConnection(userId);
    if (!connection) return { connected: false };

    const { data: latestSync } = await supabase
      .from('mixpanel_sync_log')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    return {
      connected: true,
      lastSyncAt: latestSync?.completed_at ? new Date(latestSync.completed_at) : undefined,
      lastSyncStatus: latestSync?.status,
      recordsSynced: latestSync?.records_processed,
      syncErrors: latestSync?.error_details,
    };
  }

  /**
   * Get sync history
   */
  async getSyncHistory(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ logs: unknown[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    if (!supabase) return { logs: [], total: 0 };

    const { data, count, error } = await supabase
      .from('mixpanel_sync_log')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to get sync history: ${error.message}`);
    }

    return { logs: data || [], total: count || 0 };
  }

  /**
   * Get customer metrics
   */
  async getCustomerMetrics(
    customerId: string,
    options: { days?: number } = {}
  ): Promise<MixpanelMetrics[]> {
    const days = options.days || 30;

    if (!supabase) return [];

    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('mixpanel_metrics')
      .select('*')
      .eq('customer_id', customerId)
      .gte('metric_date', fromDate)
      .order('metric_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to get metrics: ${error.message}`);
    }

    return (data || []).map((row) => ({
      customerId: row.customer_id,
      metricDate: new Date(row.metric_date),
      totalEvents: row.total_events,
      uniqueUsers: row.unique_users,
      sessions: row.sessions,
      avgEventsPerUser: parseFloat(row.avg_events_per_user),
      avgSessionDurationSeconds: row.avg_session_duration_seconds,
      topEvents: row.top_events || [],
      propertyBreakdowns: row.property_breakdowns || {},
    }));
  }

  /**
   * Get customer funnels
   */
  async getCustomerFunnels(
    customerId: string,
    options: { days?: number } = {}
  ): Promise<MixpanelFunnel[]> {
    const days = options.days || 30;

    if (!supabase) return [];

    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('mixpanel_funnels')
      .select('*')
      .eq('customer_id', customerId)
      .gte('metric_date', fromDate)
      .order('metric_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to get funnels: ${error.message}`);
    }

    return (data || []).map((row) => ({
      customerId: row.customer_id,
      funnelId: row.funnel_id,
      funnelName: row.funnel_name,
      metricDate: new Date(row.metric_date),
      conversionRate: parseFloat(row.conversion_rate),
      completedUsers: row.completed_users,
      startedUsers: row.started_users,
      dropOffStep: row.drop_off_step,
      steps: row.steps || [],
    }));
  }

  /**
   * Start sync log entry
   */
  private async startSyncLog(
    userId: string,
    connectionId: string | undefined,
    syncType: string,
    customerIds: string[]
  ): Promise<{ id: string } | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('mixpanel_sync_log')
      .insert({
        user_id: userId,
        integration_id: connectionId,
        sync_type: syncType,
        customer_ids: customerIds,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to start sync log:', error);
      return null;
    }

    return data;
  }

  /**
   * Complete sync log entry
   */
  private async completeSyncLog(
    syncLogId: string | undefined,
    result: SyncResult,
    status: 'completed' | 'failed'
  ): Promise<void> {
    if (!supabase || !syncLogId) return;

    await supabase
      .from('mixpanel_sync_log')
      .update({
        status,
        records_processed: result.synced,
        records_created: result.created,
        records_updated: result.updated,
        records_failed: result.errors.length,
        error_details: result.errors,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLogId);
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return mixpanelCircuitBreaker.getStats();
  }
}

// Singleton instance
export const mixpanelService = new MixpanelService();
export default mixpanelService;
