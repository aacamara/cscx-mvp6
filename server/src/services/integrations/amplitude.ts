/**
 * Amplitude Analytics Integration Service - PRD-196
 *
 * Implements Amplitude product analytics sync:
 * - API key + secret authentication
 * - Account-level metrics (DAU, WAU, MAU, retention)
 * - Behavioral cohorts and power user tracking
 * - Funnel analytics and drop-off detection
 * - Stickiness metrics (DAU/MAU ratio)
 * - Health score integration
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { CircuitBreaker } from '../circuitBreaker.js';
import { withRetry, retryStrategies } from '../retry.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Circuit breaker for Amplitude API calls
const amplitudeCircuitBreaker = new CircuitBreaker('amplitude', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000, // 1 minute before retry
});

// ============================================
// Types
// ============================================

export interface AmplitudeConnection {
  id?: string;
  apiKey: string;
  secretKey: string;
  projectId?: string;
  orgId?: string;
}

export interface AmplitudeMetrics {
  id?: string;
  customerId: string;
  amplitudeOrgId: string;
  metricDate: Date;
  dau: number;
  wau: number;
  mau: number;
  newUsers: number;
  sessionCount: number;
  eventsCount: number;
  retentionD1: number | null;
  retentionD7: number | null;
  retentionD30: number | null;
  stickinessRatio: number;
  avgSessionDuration?: number;
  uniqueFeaturesUsed?: number;
}

export interface AmplitudeFunnel {
  id?: string;
  customerId: string;
  funnelId: string;
  funnelName: string;
  steps: FunnelStep[];
  overallConversionRate: number;
  biggestDropOff: string;
  metricDate: Date;
}

export interface FunnelStep {
  stepNumber: number;
  stepName: string;
  eventName: string;
  count: number;
  conversionRate: number;
  dropOffRate: number;
}

export interface AmplitudeCohort {
  id: string;
  name: string;
  description?: string;
  userCount: number;
  definition?: Record<string, unknown>;
}

export interface AmplitudeRetention {
  customerId: string;
  cohortDate: Date;
  day1: number;
  day7: number;
  day14: number;
  day30: number;
  day60?: number;
  day90?: number;
}

export interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  syncLogId?: string;
}

export interface AmplitudeConfig {
  syncSchedule: 'daily' | 'hourly' | 'manual';
  metricsToSync: string[];
  funnelsToTrack: string[];
  retentionDays: number[];
  healthScoreWeights: {
    retentionWeight: number;
    engagementWeight: number;
    featureBreadthWeight: number;
  };
}

export interface AmplitudeSyncStatus {
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

const DEFAULT_CONFIG: AmplitudeConfig = {
  syncSchedule: 'daily',
  metricsToSync: ['dau', 'wau', 'mau', 'retention', 'sessions', 'events'],
  funnelsToTrack: [],
  retentionDays: [1, 7, 30],
  healthScoreWeights: {
    retentionWeight: 0.4,
    engagementWeight: 0.35,
    featureBreadthWeight: 0.25,
  },
};

// ============================================
// Amplitude API Response Types
// ============================================

interface AmplitudeActiveUsersResponse {
  data: {
    series: number[][];
    seriesLabels: string[];
    xValues: string[];
  };
}

interface AmplitudeRetentionResponse {
  data: {
    series: number[][];
    seriesLabels: string[];
  };
}

interface AmplitudeCohortsResponse {
  cohorts: Array<{
    id: string;
    name: string;
    description?: string;
    size: number;
    definition?: Record<string, unknown>;
  }>;
}

interface AmplitudeFunnelResponse {
  data: {
    series: number[][];
    seriesLabels: string[];
    events: string[];
  };
}

// ============================================
// Amplitude Service Class
// ============================================

export class AmplitudeService {
  private baseUrl = 'https://amplitude.com/api/2';
  private dashboardApiUrl = 'https://amplitude.com/api/3';

  constructor() {
    // Service initialization
  }

  /**
   * Check if Amplitude integration is configured
   */
  isConfigured(): boolean {
    return Boolean(process.env.AMPLITUDE_API_KEY && process.env.AMPLITUDE_SECRET_KEY);
  }

  /**
   * Get basic auth header for Amplitude API
   */
  private getAuthHeader(connection: AmplitudeConnection): string {
    const credentials = `${connection.apiKey}:${connection.secretKey}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
  }

  /**
   * Verify API credentials by making a test call
   */
  async verifyConnection(connection: AmplitudeConnection): Promise<{
    valid: boolean;
    projectId?: string;
    error?: string;
  }> {
    try {
      const response = await amplitudeCircuitBreaker.execute(async () => {
        // Use the dashboard API to verify credentials
        const res = await fetch(`${this.dashboardApiUrl}/cohorts`, {
          method: 'GET',
          headers: {
            Authorization: this.getAuthHeader(connection),
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          if (res.status === 401) {
            return { valid: false, error: 'Invalid API credentials' };
          }
          const error = await res.text();
          return { valid: false, error: `API error: ${error}` };
        }

        return { valid: true };
      });

      return response;
    } catch (error) {
      return { valid: false, error: (error as Error).message };
    }
  }

  /**
   * Connect Amplitude integration for a user
   */
  async connect(
    userId: string,
    apiKey: string,
    secretKey: string,
    orgId?: string
  ): Promise<{ success: boolean; connectionId?: string; error?: string }> {
    const connection: AmplitudeConnection = { apiKey, secretKey, orgId };

    // Verify credentials first
    const verification = await this.verifyConnection(connection);
    if (!verification.valid) {
      return { success: false, error: verification.error };
    }

    // Save connection
    const connectionId = await this.saveConnection(userId, connection);

    return { success: true, connectionId };
  }

  /**
   * Save connection to database
   */
  async saveConnection(
    userId: string,
    connection: AmplitudeConnection,
    config?: Partial<AmplitudeConfig>
  ): Promise<string> {
    if (!supabase) {
      // Demo mode - return mock ID
      return `amplitude-${Date.now()}`;
    }

    const { data, error } = await supabase
      .from('integration_connections')
      .upsert(
        {
          user_id: userId,
          provider: 'amplitude',
          api_key: connection.apiKey,
          api_secret: connection.secretKey,
          org_id: connection.orgId,
          sync_schedule: config?.syncSchedule || DEFAULT_CONFIG.syncSchedule,
          sync_config: config || DEFAULT_CONFIG,
          sync_enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
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
  async getConnection(userId: string): Promise<(AmplitudeConnection & { id: string; config: AmplitudeConfig }) | null> {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'amplitude')
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      apiKey: data.api_key,
      secretKey: data.api_secret,
      orgId: data.org_id,
      config: data.sync_config || DEFAULT_CONFIG,
    };
  }

  /**
   * Disconnect Amplitude integration
   */
  async disconnect(userId: string): Promise<void> {
    if (!supabase) return;

    await supabase
      .from('integration_connections')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'amplitude');
  }

  /**
   * Fetch active users data from Amplitude
   */
  async fetchActiveUsers(
    connection: AmplitudeConnection,
    startDate: string,
    endDate: string,
    metric: 'active' | 'new' | 'returning' = 'active'
  ): Promise<AmplitudeActiveUsersResponse | null> {
    const url = `${this.baseUrl}/users?start=${startDate}&end=${endDate}&m=${metric}`;

    try {
      const response = await withRetry(
        async () => {
          return amplitudeCircuitBreaker.execute(async () => {
            const res = await fetch(url, {
              headers: {
                Authorization: this.getAuthHeader(connection),
                'Content-Type': 'application/json',
              },
            });

            if (!res.ok) {
              throw new Error(`Amplitude API error: ${await res.text()}`);
            }

            return res.json();
          });
        },
        {
          ...retryStrategies.aiService,
          maxRetries: 3,
        }
      );

      return response;
    } catch (error) {
      console.error('Failed to fetch Amplitude active users:', error);
      return null;
    }
  }

  /**
   * Fetch retention data from Amplitude
   */
  async fetchRetention(
    connection: AmplitudeConnection,
    startDate: string,
    endDate: string
  ): Promise<AmplitudeRetentionResponse | null> {
    const url = `${this.baseUrl}/retention?start=${startDate}&end=${endDate}`;

    try {
      const response = await withRetry(
        async () => {
          return amplitudeCircuitBreaker.execute(async () => {
            const res = await fetch(url, {
              headers: {
                Authorization: this.getAuthHeader(connection),
                'Content-Type': 'application/json',
              },
            });

            if (!res.ok) {
              throw new Error(`Amplitude API error: ${await res.text()}`);
            }

            return res.json();
          });
        },
        retryStrategies.aiService
      );

      return response;
    } catch (error) {
      console.error('Failed to fetch Amplitude retention:', error);
      return null;
    }
  }

  /**
   * Fetch cohorts from Amplitude
   */
  async fetchCohorts(connection: AmplitudeConnection): Promise<AmplitudeCohort[]> {
    const url = `${this.dashboardApiUrl}/cohorts`;

    try {
      const response = await withRetry(
        async () => {
          return amplitudeCircuitBreaker.execute(async () => {
            const res = await fetch(url, {
              headers: {
                Authorization: this.getAuthHeader(connection),
                'Content-Type': 'application/json',
              },
            });

            if (!res.ok) {
              throw new Error(`Amplitude API error: ${await res.text()}`);
            }

            return res.json() as Promise<AmplitudeCohortsResponse>;
          });
        },
        retryStrategies.aiService
      );

      return response.cohorts.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        userCount: c.size,
        definition: c.definition,
      }));
    } catch (error) {
      console.error('Failed to fetch Amplitude cohorts:', error);
      return [];
    }
  }

  /**
   * Fetch funnel data from Amplitude
   */
  async fetchFunnel(
    connection: AmplitudeConnection,
    funnelId: string,
    startDate: string,
    endDate: string
  ): Promise<AmplitudeFunnelResponse | null> {
    const url = `${this.dashboardApiUrl}/funnels/${funnelId}?start=${startDate}&end=${endDate}`;

    try {
      const response = await withRetry(
        async () => {
          return amplitudeCircuitBreaker.execute(async () => {
            const res = await fetch(url, {
              headers: {
                Authorization: this.getAuthHeader(connection),
                'Content-Type': 'application/json',
              },
            });

            if (!res.ok) {
              throw new Error(`Amplitude API error: ${await res.text()}`);
            }

            return res.json();
          });
        },
        retryStrategies.aiService
      );

      return response;
    } catch (error) {
      console.error('Failed to fetch Amplitude funnel:', error);
      return null;
    }
  }

  /**
   * Sync metrics for a customer from Amplitude
   */
  async syncMetrics(
    connection: AmplitudeConnection,
    customerId: string,
    amplitudeOrgId: string,
    userId: string
  ): Promise<SyncResult> {
    const result: SyncResult = {
      synced: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    const syncLog = await this.startSyncLog(userId, connection.id, 'metrics', 'pull');
    result.syncLogId = syncLog?.id;

    try {
      // Calculate date range (last 30 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const startStr = startDate.toISOString().split('T')[0].replace(/-/g, '');
      const endStr = endDate.toISOString().split('T')[0].replace(/-/g, '');

      // Fetch active users
      const [activeData, newData, retentionData] = await Promise.all([
        this.fetchActiveUsers(connection, startStr, endStr, 'active'),
        this.fetchActiveUsers(connection, startStr, endStr, 'new'),
        this.fetchRetention(connection, startStr, endStr),
      ]);

      if (!activeData) {
        result.errors.push('Failed to fetch active users data');
        await this.completeSyncLog(syncLog?.id, result, 'failed');
        return result;
      }

      // Process and aggregate data
      const metrics = this.processMetricsData(
        customerId,
        amplitudeOrgId,
        activeData,
        newData,
        retentionData
      );

      // Save to database
      if (supabase) {
        for (const metric of metrics) {
          try {
            const { data: existing } = await supabase
              .from('amplitude_metrics')
              .select('id')
              .eq('customer_id', customerId)
              .eq('metric_date', metric.metricDate.toISOString().split('T')[0])
              .single();

            if (existing) {
              await supabase
                .from('amplitude_metrics')
                .update({
                  dau: metric.dau,
                  wau: metric.wau,
                  mau: metric.mau,
                  new_users: metric.newUsers,
                  session_count: metric.sessionCount,
                  events_count: metric.eventsCount,
                  retention_d1: metric.retentionD1,
                  retention_d7: metric.retentionD7,
                  retention_d30: metric.retentionD30,
                  stickiness_ratio: metric.stickinessRatio,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);
              result.updated++;
            } else {
              await supabase.from('amplitude_metrics').insert({
                customer_id: customerId,
                amplitude_org_id: amplitudeOrgId,
                metric_date: metric.metricDate.toISOString().split('T')[0],
                dau: metric.dau,
                wau: metric.wau,
                mau: metric.mau,
                new_users: metric.newUsers,
                session_count: metric.sessionCount,
                events_count: metric.eventsCount,
                retention_d1: metric.retentionD1,
                retention_d7: metric.retentionD7,
                retention_d30: metric.retentionD30,
                stickiness_ratio: metric.stickinessRatio,
              });
              result.created++;
            }
            result.synced++;
          } catch (err) {
            result.errors.push(`Failed to save metric: ${(err as Error).message}`);
          }
        }
      } else {
        // Demo mode - just count
        result.synced = metrics.length;
        result.created = metrics.length;
      }

      await this.completeSyncLog(syncLog?.id, result, 'completed');
    } catch (error) {
      result.errors.push(`Sync failed: ${(error as Error).message}`);
      await this.completeSyncLog(syncLog?.id, result, 'failed');
    }

    return result;
  }

  /**
   * Process raw Amplitude data into metrics
   */
  private processMetricsData(
    customerId: string,
    amplitudeOrgId: string,
    activeData: AmplitudeActiveUsersResponse,
    newData: AmplitudeActiveUsersResponse | null,
    retentionData: AmplitudeRetentionResponse | null
  ): AmplitudeMetrics[] {
    const metrics: AmplitudeMetrics[] = [];
    const xValues = activeData.data.xValues || [];
    const activeSeries = activeData.data.series?.[0] || [];
    const newSeries = newData?.data.series?.[0] || [];
    const retentionSeries = retentionData?.data.series || [];

    // Process each day
    for (let i = 0; i < xValues.length; i++) {
      const dateStr = xValues[i];
      const dau = activeSeries[i] || 0;

      // Calculate WAU (sum of last 7 days)
      let wau = 0;
      for (let j = Math.max(0, i - 6); j <= i; j++) {
        wau += activeSeries[j] || 0;
      }

      // Calculate MAU (sum of last 30 days)
      let mau = 0;
      for (let j = Math.max(0, i - 29); j <= i; j++) {
        mau += activeSeries[j] || 0;
      }

      // Get retention values
      let retentionD1: number | null = null;
      let retentionD7: number | null = null;
      let retentionD30: number | null = null;

      if (retentionSeries.length > 0) {
        const cohortRetention = retentionSeries[Math.min(i, retentionSeries.length - 1)];
        retentionD1 = cohortRetention?.[1] ?? null;
        retentionD7 = cohortRetention?.[7] ?? null;
        retentionD30 = cohortRetention?.[30] ?? null;
      }

      // Calculate stickiness ratio (DAU/MAU)
      const stickinessRatio = mau > 0 ? parseFloat((dau / mau).toFixed(4)) : 0;

      metrics.push({
        customerId,
        amplitudeOrgId,
        metricDate: new Date(dateStr),
        dau,
        wau,
        mau,
        newUsers: newSeries[i] || 0,
        sessionCount: 0, // Would need separate API call
        eventsCount: 0, // Would need separate API call
        retentionD1,
        retentionD7,
        retentionD30,
        stickinessRatio,
      });
    }

    return metrics;
  }

  /**
   * Get metrics for a customer
   */
  async getMetrics(
    customerId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AmplitudeMetrics[]> {
    if (!supabase) {
      // Return mock data for demo
      return this.getMockMetrics(customerId);
    }

    let query = supabase
      .from('amplitude_metrics')
      .select('*')
      .eq('customer_id', customerId)
      .order('metric_date', { ascending: false });

    if (startDate) {
      query = query.gte('metric_date', startDate.toISOString().split('T')[0]);
    }
    if (endDate) {
      query = query.lte('metric_date', endDate.toISOString().split('T')[0]);
    }

    const { data, error } = await query.limit(90);

    if (error) {
      throw new Error(`Failed to fetch metrics: ${error.message}`);
    }

    return (data || []).map(this.mapToMetrics);
  }

  /**
   * Get retention data for a customer
   */
  async getRetention(customerId: string): Promise<AmplitudeRetention | null> {
    if (!supabase) {
      // Return mock data
      return {
        customerId,
        cohortDate: new Date(),
        day1: 45,
        day7: 32,
        day14: 25,
        day30: 18,
        day60: 12,
        day90: 8,
      };
    }

    const { data } = await supabase
      .from('amplitude_metrics')
      .select('retention_d1, retention_d7, retention_d30, metric_date')
      .eq('customer_id', customerId)
      .order('metric_date', { ascending: false })
      .limit(1)
      .single();

    if (!data) return null;

    return {
      customerId,
      cohortDate: new Date(data.metric_date),
      day1: data.retention_d1 || 0,
      day7: data.retention_d7 || 0,
      day14: (data.retention_d7 + data.retention_d30) / 2 || 0, // Estimated
      day30: data.retention_d30 || 0,
    };
  }

  /**
   * Get funnels for a customer
   */
  async getFunnels(customerId: string): Promise<AmplitudeFunnel[]> {
    if (!supabase) {
      // Return mock data
      return this.getMockFunnels(customerId);
    }

    const { data, error } = await supabase
      .from('amplitude_funnels')
      .select('*')
      .eq('customer_id', customerId)
      .order('metric_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch funnels: ${error.message}`);
    }

    return (data || []).map(this.mapToFunnel);
  }

  /**
   * Calculate health score components from Amplitude data
   */
  async calculateHealthScoreComponents(customerId: string): Promise<{
    retentionScore: number;
    engagementScore: number;
    featureBreadthScore: number;
    overallScore: number;
  }> {
    const metrics = await this.getMetrics(customerId);

    if (metrics.length === 0) {
      return {
        retentionScore: 50,
        engagementScore: 50,
        featureBreadthScore: 50,
        overallScore: 50,
      };
    }

    const latestMetric = metrics[0];
    const config = DEFAULT_CONFIG.healthScoreWeights;

    // Retention score (0-100) - based on D30 retention
    // Good retention is 20%+, excellent is 40%+
    const retentionD30 = latestMetric.retentionD30 || 0;
    const retentionScore = Math.min(100, Math.round(retentionD30 * 2.5)); // 40% = 100

    // Engagement score (0-100) - based on stickiness (DAU/MAU)
    // Good stickiness is 15%+, excellent is 30%+
    const stickinessRatio = latestMetric.stickinessRatio || 0;
    const engagementScore = Math.min(100, Math.round(stickinessRatio * 333)); // 30% = ~100

    // Feature breadth score (0-100) - based on unique features used
    // For now, estimate based on session frequency
    const sessionDepth = latestMetric.sessionCount > 0
      ? Math.min(100, Math.round((latestMetric.sessionCount / latestMetric.dau) * 50))
      : 60; // Default
    const featureBreadthScore = sessionDepth;

    // Calculate weighted overall score
    const overallScore = Math.round(
      retentionScore * config.retentionWeight +
      engagementScore * config.engagementWeight +
      featureBreadthScore * config.featureBreadthWeight
    );

    return {
      retentionScore,
      engagementScore,
      featureBreadthScore,
      overallScore,
    };
  }

  /**
   * Get sync status for a user
   */
  async getSyncStatus(userId: string): Promise<AmplitudeSyncStatus> {
    if (!supabase) {
      return { connected: false };
    }

    const connection = await this.getConnection(userId);
    if (!connection) {
      return { connected: false };
    }

    // Get latest sync log
    const { data: latestSync } = await supabase
      .from('amplitude_sync_log')
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
   * Start sync log entry
   */
  private async startSyncLog(
    userId: string,
    connectionId: string | undefined,
    objectType: string,
    direction: string
  ): Promise<{ id: string } | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('amplitude_sync_log')
      .insert({
        user_id: userId,
        integration_id: connectionId,
        object_type: objectType,
        direction,
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
      .from('amplitude_sync_log')
      .update({
        status,
        records_processed: result.synced,
        records_created: result.created,
        records_updated: result.updated,
        records_skipped: result.skipped,
        records_failed: result.errors.length,
        error_details: result.errors,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLogId);
  }

  /**
   * Map database row to AmplitudeMetrics
   */
  private mapToMetrics(row: Record<string, unknown>): AmplitudeMetrics {
    return {
      id: row.id as string,
      customerId: row.customer_id as string,
      amplitudeOrgId: row.amplitude_org_id as string,
      metricDate: new Date(row.metric_date as string),
      dau: row.dau as number,
      wau: row.wau as number,
      mau: row.mau as number,
      newUsers: row.new_users as number,
      sessionCount: row.session_count as number,
      eventsCount: row.events_count as number,
      retentionD1: row.retention_d1 as number | null,
      retentionD7: row.retention_d7 as number | null,
      retentionD30: row.retention_d30 as number | null,
      stickinessRatio: row.stickiness_ratio as number,
    };
  }

  /**
   * Map database row to AmplitudeFunnel
   */
  private mapToFunnel(row: Record<string, unknown>): AmplitudeFunnel {
    return {
      id: row.id as string,
      customerId: row.customer_id as string,
      funnelId: row.funnel_id as string,
      funnelName: row.funnel_name as string,
      steps: row.steps as FunnelStep[],
      overallConversionRate: row.overall_conversion_rate as number,
      biggestDropOff: row.biggest_drop_off as string,
      metricDate: new Date(row.metric_date as string),
    };
  }

  /**
   * Get mock metrics for demo mode
   */
  private getMockMetrics(customerId: string): AmplitudeMetrics[] {
    const metrics: AmplitudeMetrics[] = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // Generate realistic-looking data with some variance
      const baseDau = 150 + Math.floor(Math.random() * 50);
      const baseRetention = 25 + Math.floor(Math.random() * 15);

      metrics.push({
        customerId,
        amplitudeOrgId: 'demo-org',
        metricDate: date,
        dau: baseDau,
        wau: baseDau * 4,
        mau: baseDau * 12,
        newUsers: Math.floor(baseDau * 0.15),
        sessionCount: baseDau * 2,
        eventsCount: baseDau * 25,
        retentionD1: baseRetention + 20,
        retentionD7: baseRetention + 10,
        retentionD30: baseRetention,
        stickinessRatio: 0.12 + Math.random() * 0.08,
      });
    }

    return metrics;
  }

  /**
   * Get mock funnels for demo mode
   */
  private getMockFunnels(customerId: string): AmplitudeFunnel[] {
    return [
      {
        customerId,
        funnelId: 'onboarding',
        funnelName: 'Onboarding Funnel',
        steps: [
          { stepNumber: 1, stepName: 'Sign Up', eventName: 'signup_complete', count: 1000, conversionRate: 100, dropOffRate: 0 },
          { stepNumber: 2, stepName: 'Profile Setup', eventName: 'profile_setup', count: 850, conversionRate: 85, dropOffRate: 15 },
          { stepNumber: 3, stepName: 'First Action', eventName: 'first_action', count: 680, conversionRate: 80, dropOffRate: 20 },
          { stepNumber: 4, stepName: 'Invite Team', eventName: 'invite_sent', count: 340, conversionRate: 50, dropOffRate: 50 },
          { stepNumber: 5, stepName: 'Activated', eventName: 'user_activated', count: 272, conversionRate: 80, dropOffRate: 20 },
        ],
        overallConversionRate: 27.2,
        biggestDropOff: 'Invite Team',
        metricDate: new Date(),
      },
      {
        customerId,
        funnelId: 'feature-adoption',
        funnelName: 'Feature Adoption',
        steps: [
          { stepNumber: 1, stepName: 'Dashboard View', eventName: 'view_dashboard', count: 500, conversionRate: 100, dropOffRate: 0 },
          { stepNumber: 2, stepName: 'Create Report', eventName: 'create_report', count: 350, conversionRate: 70, dropOffRate: 30 },
          { stepNumber: 3, stepName: 'Share Report', eventName: 'share_report', count: 175, conversionRate: 50, dropOffRate: 50 },
          { stepNumber: 4, stepName: 'Schedule Report', eventName: 'schedule_report', count: 87, conversionRate: 50, dropOffRate: 50 },
        ],
        overallConversionRate: 17.4,
        biggestDropOff: 'Share Report',
        metricDate: new Date(),
      },
    ];
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return amplitudeCircuitBreaker.getStats();
  }

  /**
   * Map customer to Amplitude org ID
   */
  async mapCustomerToOrg(customerId: string, amplitudeOrgId: string): Promise<void> {
    if (!supabase) return;

    await supabase
      .from('amplitude_customer_mapping')
      .upsert(
        {
          customer_id: customerId,
          amplitude_org_id: amplitudeOrgId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'customer_id' }
      );
  }

  /**
   * Get Amplitude org ID for a customer
   */
  async getOrgIdForCustomer(customerId: string): Promise<string | null> {
    if (!supabase) return null;

    const { data } = await supabase
      .from('amplitude_customer_mapping')
      .select('amplitude_org_id')
      .eq('customer_id', customerId)
      .single();

    return data?.amplitude_org_id || null;
  }
}

// Singleton instance
export const amplitudeService = new AmplitudeService();
export default amplitudeService;
