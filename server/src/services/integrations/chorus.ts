/**
 * Chorus.ai Integration Service - PRD-194
 *
 * Implements Chorus (ZoomInfo Chorus) conversation intelligence integration:
 * - OAuth 2.0 / API Key authentication
 * - Meeting/call sync with recordings and metadata
 * - Transcript retrieval and search
 * - AI-extracted action items -> CSCX tasks
 * - Momentum insights integration
 * - Tracker sync (competitor mentions, features, etc.)
 * - Health score integration via conversation signals
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { CircuitBreaker } from '../circuitBreaker.js';
import { withRetry, retryStrategies } from '../retry.js';
import { integrationHealthService } from './health.js';
import crypto from 'crypto';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Circuit breaker for Chorus API calls
const chorusCircuitBreaker = new CircuitBreaker('chorus', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000, // 1 minute before retry
});

// ============================================
// Types
// ============================================

export interface ChorusConnection {
  id?: string;
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  tokenExpiresAt?: Date;
  apiKey?: string; // Alternative to OAuth
  subdomain?: string;
}

export interface ChorusCall {
  id: string;
  externalId: string;
  title: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  recordingUrl?: string;
  participants: ChorusParticipant[];
  summary?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  keyTopics?: string[];
  nextSteps?: string[];
  momScore?: number; // Momentum score
  trackers?: ChorusTracker[];
  createdAt: string;
  updatedAt: string;
}

export interface ChorusParticipant {
  id: string;
  name: string;
  email?: string;
  role: 'internal' | 'external';
  speakingTimeSeconds?: number;
  speakingPercentage?: number;
}

export interface ChorusTranscript {
  callId: string;
  segments: TranscriptSegment[];
  totalDurationSeconds: number;
  language: string;
}

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  speakerName: string;
  speakerType: 'internal' | 'external';
  startTimeMs: number;
  endTimeMs: number;
  text: string;
  confidence?: number;
}

export interface ChorusActionItem {
  id: string;
  callId: string;
  description: string;
  owner?: string;
  ownerEmail?: string;
  dueDate?: string;
  status: 'open' | 'completed' | 'dismissed';
  confidence: number;
  extractedAt: string;
}

export interface ChorusMomentumInsight {
  callId: string;
  dealProgress: 'advancing' | 'stalled' | 'declining' | 'unknown';
  nextStepsDetected: string[];
  pricingDiscussed: boolean;
  pricingContext?: string;
  objectionsRaised: string[];
  competitorMentions: string[];
  buyingSignals: string[];
  riskIndicators: string[];
  overallScore: number; // 0-100
}

export interface ChorusTracker {
  id: string;
  name: string;
  category: string;
  matchCount: number;
  matches: TrackerMatch[];
}

export interface TrackerMatch {
  text: string;
  speakerName: string;
  speakerType: 'internal' | 'external';
  timestampMs: number;
}

export interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  syncLogId?: string;
}

export interface CallMetrics {
  totalCalls: number;
  totalDurationMinutes: number;
  avgCallDuration: number;
  avgMomentumScore: number;
  sentimentDistribution: { sentiment: string; count: number }[];
  topTrackers: { tracker: string; count: number }[];
  actionItemsCreated: number;
  actionItemsCompleted: number;
  callVolume: { date: string; count: number }[];
}

export interface SyncConfig {
  syncSchedule: 'realtime' | 'hourly' | 'daily' | 'manual';
  syncActionItems: boolean;
  createTasks: boolean;
  syncTrackers: boolean;
  syncMomentum: boolean;
  includeInHealthScore: boolean;
  momentumHealthWeight: number; // 0-100, weight in health score calculation
  trackerMappings: TrackerMapping[];
}

export interface TrackerMapping {
  chorusTracker: string;
  cscxCategory: string;
  healthImpact: 'positive' | 'neutral' | 'negative';
}

export interface SyncStatus {
  connected: boolean;
  lastSyncAt?: Date;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  callsSynced?: number;
  syncErrors?: string[];
  nextScheduledSync?: Date;
}

// ============================================
// Chorus Service Class
// ============================================

export class ChorusService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private apiVersion = 'v1';
  private baseUrl = 'https://chorus.ai/api';

  constructor() {
    this.clientId = process.env.CHORUS_CLIENT_ID || '';
    this.clientSecret = process.env.CHORUS_CLIENT_SECRET || '';
    this.redirectUri =
      process.env.CHORUS_REDIRECT_URI ||
      'http://localhost:3001/api/integrations/chorus/callback';
  }

  /**
   * Check if Chorus integration is configured
   */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret) || Boolean(process.env.CHORUS_API_KEY);
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthUrl(userId: string): string {
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state,
      scope: 'read:calls read:transcripts read:trackers read:insights',
    });

    return `https://chorus.ai/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async connect(code: string): Promise<ChorusConnection> {
    const response = await withRetry(
      async () => {
        return chorusCircuitBreaker.execute(async () => {
          const res = await fetch('https://chorus.ai/oauth/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              grant_type: 'authorization_code',
              code,
              client_id: this.clientId,
              client_secret: this.clientSecret,
              redirect_uri: this.redirectUri,
            }),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`Chorus OAuth failed: ${error}`);
          }

          return res.json();
        });
      },
      {
        ...retryStrategies.aiService,
        maxRetries: 2,
        onRetry: (attempt, error) => {
          console.log(`[Chorus] OAuth retry attempt ${attempt}: ${error.message}`);
        },
      }
    );

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      tokenType: response.token_type || 'Bearer',
      tokenExpiresAt: response.expires_in
        ? new Date(Date.now() + response.expires_in * 1000)
        : undefined,
    };
  }

  /**
   * Connect using API key (alternative to OAuth)
   */
  async connectWithApiKey(apiKey: string): Promise<ChorusConnection> {
    // Validate the API key by making a test call
    const testConnection: ChorusConnection = {
      accessToken: apiKey,
      tokenType: 'api-key',
      apiKey,
    };

    // Test the connection
    try {
      await this.listCalls(testConnection, { limit: 1 });
      return testConnection;
    } catch (error) {
      throw new Error(`Invalid Chorus API key: ${(error as Error).message}`);
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(connection: ChorusConnection): Promise<ChorusConnection> {
    if (!connection.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await withRetry(
      async () => {
        return chorusCircuitBreaker.execute(async () => {
          const res = await fetch('https://chorus.ai/oauth/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              grant_type: 'refresh_token',
              refresh_token: connection.refreshToken,
              client_id: this.clientId,
              client_secret: this.clientSecret,
            }),
          });

          if (!res.ok) {
            throw new Error('Failed to refresh Chorus token');
          }

          return res.json();
        });
      },
      { ...retryStrategies.aiService, maxRetries: 2 }
    );

    return {
      ...connection,
      accessToken: response.access_token,
      refreshToken: response.refresh_token || connection.refreshToken,
      tokenExpiresAt: response.expires_in
        ? new Date(Date.now() + response.expires_in * 1000)
        : connection.tokenExpiresAt,
    };
  }

  /**
   * Make authenticated API request to Chorus
   */
  private async apiRequest<T>(
    connection: ChorusConnection,
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: unknown;
      params?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, params } = options;

    let url = `${this.baseUrl}/${this.apiVersion}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const response = await withRetry(
      async () => {
        return chorusCircuitBreaker.execute(async () => {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          };

          // Use API key or Bearer token based on connection type
          if (connection.tokenType === 'api-key') {
            headers['X-API-Key'] = connection.accessToken;
          } else {
            headers['Authorization'] = `Bearer ${connection.accessToken}`;
          }

          const res = await fetch(url, {
            method,
            headers,
            ...(body && { body: JSON.stringify(body) }),
          });

          if (!res.ok) {
            const error = await res.text();
            if (res.status === 401) {
              throw new Error('TOKEN_EXPIRED');
            }
            throw new Error(`Chorus API error: ${error}`);
          }

          return res.json();
        });
      },
      {
        ...retryStrategies.aiService,
        retryableErrors: ['rate limit', 'timeout', '503', '429', 'ECONNRESET'],
      }
    );

    return response as T;
  }

  /**
   * List calls with pagination and filters
   */
  async listCalls(
    connection: ChorusConnection,
    options: {
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
      participantEmail?: string;
    } = {}
  ): Promise<{ calls: ChorusCall[]; total: number; hasMore: boolean }> {
    const params: Record<string, string> = {};
    if (options.startDate) params.start_date = options.startDate;
    if (options.endDate) params.end_date = options.endDate;
    if (options.limit) params.limit = options.limit.toString();
    if (options.offset) params.offset = options.offset.toString();
    if (options.participantEmail) params.participant_email = options.participantEmail;

    const response = await this.apiRequest<{
      calls: unknown[];
      total: number;
      has_more: boolean;
    }>(connection, '/calls', { params });

    return {
      calls: response.calls.map(this.mapApiCallToChorusCall),
      total: response.total,
      hasMore: response.has_more,
    };
  }

  /**
   * Get a single call with details
   */
  async getCall(connection: ChorusConnection, callId: string): Promise<ChorusCall> {
    const response = await this.apiRequest<unknown>(connection, `/calls/${callId}`);
    return this.mapApiCallToChorusCall(response);
  }

  /**
   * Get call transcript
   */
  async getTranscript(connection: ChorusConnection, callId: string): Promise<ChorusTranscript> {
    const response = await this.apiRequest<{
      call_id: string;
      segments: Array<{
        id: string;
        speaker_id: string;
        speaker_name: string;
        speaker_type: string;
        start_time_ms: number;
        end_time_ms: number;
        text: string;
        confidence?: number;
      }>;
      total_duration_seconds: number;
      language: string;
    }>(connection, `/calls/${callId}/transcript`);

    return {
      callId: response.call_id,
      segments: response.segments.map((s) => ({
        id: s.id,
        speakerId: s.speaker_id,
        speakerName: s.speaker_name,
        speakerType: s.speaker_type as 'internal' | 'external',
        startTimeMs: s.start_time_ms,
        endTimeMs: s.end_time_ms,
        text: s.text,
        confidence: s.confidence,
      })),
      totalDurationSeconds: response.total_duration_seconds,
      language: response.language,
    };
  }

  /**
   * Get call action items
   */
  async getActionItems(connection: ChorusConnection, callId: string): Promise<ChorusActionItem[]> {
    const response = await this.apiRequest<{
      action_items: Array<{
        id: string;
        description: string;
        owner?: string;
        owner_email?: string;
        due_date?: string;
        status: string;
        confidence: number;
        extracted_at: string;
      }>;
    }>(connection, `/calls/${callId}/action-items`);

    return response.action_items.map((item) => ({
      id: item.id,
      callId,
      description: item.description,
      owner: item.owner,
      ownerEmail: item.owner_email,
      dueDate: item.due_date,
      status: item.status as 'open' | 'completed' | 'dismissed',
      confidence: item.confidence,
      extractedAt: item.extracted_at,
    }));
  }

  /**
   * Get momentum insights for a call
   */
  async getMomentumInsights(
    connection: ChorusConnection,
    callId: string
  ): Promise<ChorusMomentumInsight> {
    const response = await this.apiRequest<{
      deal_progress: string;
      next_steps_detected: string[];
      pricing_discussed: boolean;
      pricing_context?: string;
      objections_raised: string[];
      competitor_mentions: string[];
      buying_signals: string[];
      risk_indicators: string[];
      overall_score: number;
    }>(connection, `/calls/${callId}/momentum`);

    return {
      callId,
      dealProgress: response.deal_progress as 'advancing' | 'stalled' | 'declining' | 'unknown',
      nextStepsDetected: response.next_steps_detected,
      pricingDiscussed: response.pricing_discussed,
      pricingContext: response.pricing_context,
      objectionsRaised: response.objections_raised,
      competitorMentions: response.competitor_mentions,
      buyingSignals: response.buying_signals,
      riskIndicators: response.risk_indicators,
      overallScore: response.overall_score,
    };
  }

  /**
   * Get trackers for a call
   */
  async getTrackers(connection: ChorusConnection, callId: string): Promise<ChorusTracker[]> {
    const response = await this.apiRequest<{
      trackers: Array<{
        id: string;
        name: string;
        category: string;
        match_count: number;
        matches: Array<{
          text: string;
          speaker_name: string;
          speaker_type: string;
          timestamp_ms: number;
        }>;
      }>;
    }>(connection, `/calls/${callId}/trackers`);

    return response.trackers.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      matchCount: t.match_count,
      matches: t.matches.map((m) => ({
        text: m.text,
        speakerName: m.speaker_name,
        speakerType: m.speaker_type as 'internal' | 'external',
        timestampMs: m.timestamp_ms,
      })),
    }));
  }

  /**
   * Search transcripts across calls
   */
  async searchTranscripts(
    connection: ChorusConnection,
    query: string,
    options: {
      startDate?: string;
      endDate?: string;
      limit?: number;
    } = {}
  ): Promise<{
    results: Array<{
      callId: string;
      callTitle: string;
      callDate: string;
      matches: Array<{
        text: string;
        speakerName: string;
        timestampMs: number;
        context: string;
      }>;
    }>;
    total: number;
  }> {
    const params: Record<string, string> = {
      query,
    };
    if (options.startDate) params.start_date = options.startDate;
    if (options.endDate) params.end_date = options.endDate;
    if (options.limit) params.limit = options.limit.toString();

    const response = await this.apiRequest<{
      results: Array<{
        call_id: string;
        call_title: string;
        call_date: string;
        matches: Array<{
          text: string;
          speaker_name: string;
          timestamp_ms: number;
          context: string;
        }>;
      }>;
      total: number;
    }>(connection, '/transcripts/search', { params });

    return {
      results: response.results.map((r) => ({
        callId: r.call_id,
        callTitle: r.call_title,
        callDate: r.call_date,
        matches: r.matches.map((m) => ({
          text: m.text,
          speakerName: m.speaker_name,
          timestampMs: m.timestamp_ms,
          context: m.context,
        })),
      })),
      total: response.total,
    };
  }

  /**
   * Sync calls from Chorus to CSCX
   */
  async syncCalls(
    connection: ChorusConnection,
    userId: string,
    options: {
      incremental?: boolean;
      lastSyncAt?: Date;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<SyncResult> {
    const { incremental = false, lastSyncAt, startDate, endDate } = options;

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

    const syncLog = await this.startSyncLog(
      userId,
      connection.id,
      'calls',
      incremental ? 'incremental' : 'full'
    );
    result.syncLogId = syncLog?.id;

    try {
      // Get customer mapping
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name, domain, contacts:stakeholders(email)');

      const customerByDomain = new Map<string, string>();
      const customerByEmail = new Map<string, string>();

      customers?.forEach((c) => {
        if (c.domain) {
          customerByDomain.set(c.domain.toLowerCase(), c.id);
        }
        if (c.contacts) {
          (c.contacts as Array<{ email: string }>).forEach((contact) => {
            if (contact.email) {
              customerByEmail.set(contact.email.toLowerCase(), c.id);
            }
          });
        }
      });

      // Fetch calls
      let offset = 0;
      const limit = 50;
      let hasMore = true;

      const queryStartDate = incremental && lastSyncAt
        ? lastSyncAt.toISOString().split('T')[0]
        : startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      while (hasMore) {
        const response = await this.listCalls(connection, {
          startDate: queryStartDate,
          endDate,
          limit,
          offset,
        });

        for (const call of response.calls) {
          try {
            // Match call to customer via participant emails
            let customerId: string | null = null;

            for (const participant of call.participants) {
              if (participant.role === 'external' && participant.email) {
                // Try direct email match
                if (customerByEmail.has(participant.email.toLowerCase())) {
                  customerId = customerByEmail.get(participant.email.toLowerCase()) || null;
                  break;
                }

                // Try domain match
                const emailDomain = participant.email.split('@')[1]?.toLowerCase();
                if (emailDomain && customerByDomain.has(emailDomain)) {
                  customerId = customerByDomain.get(emailDomain) || null;
                  break;
                }
              }
            }

            // Skip if no customer match
            if (!customerId) {
              result.skipped++;
              continue;
            }

            // Get additional call data
            const [actionItems, momentum, trackers] = await Promise.all([
              this.getActionItems(connection, call.externalId).catch(() => []),
              this.getMomentumInsights(connection, call.externalId).catch(() => null),
              this.getTrackers(connection, call.externalId).catch(() => []),
            ]);

            // Check if call exists
            const { data: existing } = await supabase
              .from('chorus_calls')
              .select('id')
              .eq('chorus_call_id', call.externalId)
              .single();

            const callData = {
              chorus_call_id: call.externalId,
              customer_id: customerId,
              title: call.title,
              duration_seconds: call.durationSeconds,
              participants: call.participants,
              chorus_url: call.recordingUrl,
              summary: call.summary,
              call_date: call.startTime,
              sentiment: call.sentiment,
              key_topics: call.keyTopics,
              momentum_score: momentum?.overallScore,
              momentum_data: momentum,
              trackers: trackers,
              synced_at: new Date().toISOString(),
            };

            if (existing) {
              await supabase.from('chorus_calls').update(callData).eq('id', existing.id);
              result.updated++;
            } else {
              const { data: newCall } = await supabase
                .from('chorus_calls')
                .insert(callData)
                .select('id')
                .single();

              result.created++;

              // Create tasks from action items
              if (newCall && actionItems.length > 0) {
                await this.createTasksFromActionItems(newCall.id, customerId, actionItems);
              }
            }

            // Save action items
            if (actionItems.length > 0) {
              await this.saveActionItems(call.externalId, customerId, actionItems);
            }

            result.synced++;
          } catch (err) {
            result.errors.push(`Failed to sync call ${call.externalId}: ${(err as Error).message}`);
          }
        }

        offset += limit;
        hasMore = response.hasMore;
      }

      await this.completeSyncLog(syncLog?.id, result, 'completed');
    } catch (error) {
      result.errors.push(`Sync failed: ${(error as Error).message}`);
      await this.completeSyncLog(syncLog?.id, result, 'failed');

      // Record health event
      await integrationHealthService.recordEvent({
        customerId: userId,
        integrationType: 'custom_api',
        integrationId: connection.id,
        eventType: 'api_error',
        errorDetails: { message: (error as Error).message },
      });
    }

    return result;
  }

  /**
   * Save action items to database
   */
  private async saveActionItems(
    callId: string,
    customerId: string,
    actionItems: ChorusActionItem[]
  ): Promise<void> {
    if (!supabase || actionItems.length === 0) return;

    const items = actionItems.map((item) => ({
      chorus_call_id: callId,
      customer_id: customerId,
      description: item.description,
      owner: item.owner,
      owner_email: item.ownerEmail,
      due_date: item.dueDate,
      status: item.status,
      confidence: item.confidence,
      created_at: item.extractedAt,
    }));

    await supabase.from('chorus_action_items').upsert(items, {
      onConflict: 'chorus_call_id,description',
    });
  }

  /**
   * Create CSCX tasks from Chorus action items
   */
  private async createTasksFromActionItems(
    chorusCallId: string,
    customerId: string,
    actionItems: ChorusActionItem[]
  ): Promise<void> {
    if (!supabase) return;

    for (const item of actionItems) {
      // Only create tasks for high-confidence items
      if (item.confidence < 0.7) continue;

      const taskData = {
        customer_id: customerId,
        title: item.description.substring(0, 200),
        description: `[Auto-created from Chorus call]\n\n${item.description}`,
        status: 'pending',
        priority: 'medium',
        due_date: item.dueDate,
        source: 'chorus',
        source_id: chorusCallId,
        created_at: new Date().toISOString(),
      };

      const { data: newTask } = await supabase.from('tasks').insert(taskData).select('id').single();

      // Link action item to task
      if (newTask) {
        await supabase
          .from('chorus_action_items')
          .update({ task_id: newTask.id })
          .eq('chorus_call_id', item.callId)
          .eq('description', item.description);
      }
    }
  }

  /**
   * Get calls for a customer
   */
  async getCustomerCalls(
    customerId: string,
    options: {
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<{ calls: unknown[]; total: number }> {
    const { limit = 20, offset = 0, startDate, endDate } = options;

    if (!supabase) {
      return { calls: [], total: 0 };
    }

    let query = supabase
      .from('chorus_calls')
      .select('*', { count: 'exact' })
      .eq('customer_id', customerId)
      .order('call_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (startDate) {
      query = query.gte('call_date', startDate);
    }
    if (endDate) {
      query = query.lte('call_date', endDate);
    }

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Failed to get calls: ${error.message}`);
    }

    return { calls: data || [], total: count || 0 };
  }

  /**
   * Get action items for a customer
   */
  async getCustomerActionItems(
    customerId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: 'open' | 'completed' | 'dismissed';
    } = {}
  ): Promise<{ actionItems: unknown[]; total: number }> {
    const { limit = 20, offset = 0, status } = options;

    if (!supabase) {
      return { actionItems: [], total: 0 };
    }

    let query = supabase
      .from('chorus_action_items')
      .select('*, chorus_calls!inner(title, call_date)', { count: 'exact' })
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Failed to get action items: ${error.message}`);
    }

    return { actionItems: data || [], total: count || 0 };
  }

  /**
   * Get momentum insights for a customer
   */
  async getCustomerInsights(customerId: string): Promise<{
    avgMomentumScore: number;
    recentTrend: 'improving' | 'declining' | 'stable';
    topObjections: string[];
    topCompetitors: string[];
    buyingSignals: string[];
    riskIndicators: string[];
  }> {
    if (!supabase) {
      return {
        avgMomentumScore: 0,
        recentTrend: 'stable',
        topObjections: [],
        topCompetitors: [],
        buyingSignals: [],
        riskIndicators: [],
      };
    }

    // Get recent calls with momentum data
    const { data: calls } = await supabase
      .from('chorus_calls')
      .select('momentum_score, momentum_data, call_date')
      .eq('customer_id', customerId)
      .not('momentum_data', 'is', null)
      .order('call_date', { ascending: false })
      .limit(20);

    if (!calls || calls.length === 0) {
      return {
        avgMomentumScore: 0,
        recentTrend: 'stable',
        topObjections: [],
        topCompetitors: [],
        buyingSignals: [],
        riskIndicators: [],
      };
    }

    // Calculate average momentum score
    const scores = calls.filter((c) => c.momentum_score != null).map((c) => c.momentum_score);
    const avgMomentumScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    // Determine trend (compare last 5 calls to previous 5)
    let recentTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (scores.length >= 10) {
      const recentAvg = scores.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
      const previousAvg = scores.slice(5, 10).reduce((a, b) => a + b, 0) / 5;
      if (recentAvg > previousAvg + 5) recentTrend = 'improving';
      else if (recentAvg < previousAvg - 5) recentTrend = 'declining';
    }

    // Aggregate insights
    const objectionCounts = new Map<string, number>();
    const competitorCounts = new Map<string, number>();
    const allBuyingSignals: string[] = [];
    const allRiskIndicators: string[] = [];

    for (const call of calls) {
      const momentum = call.momentum_data as ChorusMomentumInsight | null;
      if (!momentum) continue;

      momentum.objectionsRaised?.forEach((o) => {
        objectionCounts.set(o, (objectionCounts.get(o) || 0) + 1);
      });
      momentum.competitorMentions?.forEach((c) => {
        competitorCounts.set(c, (competitorCounts.get(c) || 0) + 1);
      });
      allBuyingSignals.push(...(momentum.buyingSignals || []));
      allRiskIndicators.push(...(momentum.riskIndicators || []));
    }

    const topObjections = Array.from(objectionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([objection]) => objection);

    const topCompetitors = Array.from(competitorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([competitor]) => competitor);

    // Deduplicate signals
    const buyingSignals = [...new Set(allBuyingSignals)].slice(0, 10);
    const riskIndicators = [...new Set(allRiskIndicators)].slice(0, 10);

    return {
      avgMomentumScore,
      recentTrend,
      topObjections,
      topCompetitors,
      buyingSignals,
      riskIndicators,
    };
  }

  /**
   * Calculate call metrics for a customer
   */
  async getCallMetrics(customerId: string, days: number = 30): Promise<CallMetrics> {
    const defaultMetrics: CallMetrics = {
      totalCalls: 0,
      totalDurationMinutes: 0,
      avgCallDuration: 0,
      avgMomentumScore: 0,
      sentimentDistribution: [],
      topTrackers: [],
      actionItemsCreated: 0,
      actionItemsCompleted: 0,
      callVolume: [],
    };

    if (!supabase) {
      return defaultMetrics;
    }

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Get calls
    const { data: calls } = await supabase
      .from('chorus_calls')
      .select('*')
      .eq('customer_id', customerId)
      .gte('call_date', startDate)
      .order('call_date', { ascending: true });

    if (!calls || calls.length === 0) {
      return defaultMetrics;
    }

    // Get action items
    const { data: actionItems } = await supabase
      .from('chorus_action_items')
      .select('status')
      .eq('customer_id', customerId)
      .gte('created_at', startDate);

    // Calculate metrics
    const totalCalls = calls.length;
    const totalDurationSeconds = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
    const totalDurationMinutes = Math.round(totalDurationSeconds / 60);
    const avgCallDuration = totalCalls > 0 ? Math.round(totalDurationSeconds / totalCalls / 60) : 0;

    // Average momentum score
    const momentumScores = calls.filter((c) => c.momentum_score != null).map((c) => c.momentum_score);
    const avgMomentumScore = momentumScores.length > 0
      ? Math.round(momentumScores.reduce((a, b) => a + b, 0) / momentumScores.length)
      : 0;

    // Sentiment distribution
    const sentimentCounts = new Map<string, number>();
    calls.forEach((c) => {
      const sentiment = c.sentiment || 'unknown';
      sentimentCounts.set(sentiment, (sentimentCounts.get(sentiment) || 0) + 1);
    });
    const sentimentDistribution = Array.from(sentimentCounts.entries())
      .map(([sentiment, count]) => ({ sentiment, count }))
      .sort((a, b) => b.count - a.count);

    // Top trackers
    const trackerCounts = new Map<string, number>();
    calls.forEach((c) => {
      const trackers = c.trackers as ChorusTracker[] | null;
      trackers?.forEach((t) => {
        trackerCounts.set(t.name, (trackerCounts.get(t.name) || 0) + t.matchCount);
      });
    });
    const topTrackers = Array.from(trackerCounts.entries())
      .map(([tracker, count]) => ({ tracker, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Action items
    const actionItemsCreated = actionItems?.length || 0;
    const actionItemsCompleted = actionItems?.filter((a) => a.status === 'completed').length || 0;

    // Call volume by date
    const volumeByDate = new Map<string, number>();
    calls.forEach((c) => {
      const date = new Date(c.call_date).toISOString().split('T')[0];
      volumeByDate.set(date, (volumeByDate.get(date) || 0) + 1);
    });
    const callVolume = Array.from(volumeByDate.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalCalls,
      totalDurationMinutes,
      avgCallDuration,
      avgMomentumScore,
      sentimentDistribution,
      topTrackers,
      actionItemsCreated,
      actionItemsCompleted,
      callVolume,
    };
  }

  /**
   * Map API response to ChorusCall
   */
  private mapApiCallToChorusCall(apiCall: unknown): ChorusCall {
    const call = apiCall as Record<string, unknown>;
    return {
      id: call.id as string,
      externalId: (call.external_id || call.id) as string,
      title: call.title as string,
      startTime: call.start_time as string,
      endTime: call.end_time as string,
      durationSeconds: call.duration_seconds as number,
      recordingUrl: call.recording_url as string | undefined,
      participants: ((call.participants as unknown[]) || []).map((p: unknown) => {
        const participant = p as Record<string, unknown>;
        return {
          id: participant.id as string,
          name: participant.name as string,
          email: participant.email as string | undefined,
          role: participant.role as 'internal' | 'external',
          speakingTimeSeconds: participant.speaking_time_seconds as number | undefined,
          speakingPercentage: participant.speaking_percentage as number | undefined,
        };
      }),
      summary: call.summary as string | undefined,
      sentiment: call.sentiment as 'positive' | 'neutral' | 'negative' | undefined,
      keyTopics: call.key_topics as string[] | undefined,
      nextSteps: call.next_steps as string[] | undefined,
      momScore: call.momentum_score as number | undefined,
      trackers: call.trackers as ChorusTracker[] | undefined,
      createdAt: call.created_at as string,
      updatedAt: call.updated_at as string,
    };
  }

  /**
   * Save connection to database
   */
  async saveConnection(
    userId: string,
    connection: ChorusConnection,
    syncConfig?: Partial<SyncConfig>
  ): Promise<string> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const webhookSecret = crypto.randomBytes(32).toString('hex');

    const { data, error } = await supabase
      .from('integration_connections')
      .upsert(
        {
          user_id: userId,
          provider: 'chorus',
          access_token: connection.accessToken,
          refresh_token: connection.refreshToken,
          token_type: connection.tokenType,
          token_expires_at: connection.tokenExpiresAt?.toISOString(),
          api_key: connection.apiKey,
          webhook_secret: webhookSecret,
          sync_schedule: syncConfig?.syncSchedule || 'hourly',
          sync_action_items: syncConfig?.syncActionItems ?? true,
          create_tasks: syncConfig?.createTasks ?? true,
          sync_trackers: syncConfig?.syncTrackers ?? true,
          sync_momentum: syncConfig?.syncMomentum ?? true,
          include_in_health_score: syncConfig?.includeInHealthScore ?? true,
          momentum_health_weight: syncConfig?.momentumHealthWeight ?? 15,
          tracker_mappings: syncConfig?.trackerMappings || [],
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
  async getConnection(userId: string): Promise<(ChorusConnection & { id: string; config: Partial<SyncConfig> }) | null> {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'chorus')
      .single();

    if (error || !data) return null;

    // Check if token needs refresh
    const expiresAt = data.token_expires_at ? new Date(data.token_expires_at) : null;
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

    if (expiresAt && data.refresh_token && expiresAt.getTime() - Date.now() < bufferTime) {
      try {
        const refreshed = await this.refreshToken({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          tokenType: data.token_type,
          tokenExpiresAt: expiresAt,
        });

        await this.saveConnection(userId, refreshed, {
          syncSchedule: data.sync_schedule,
          syncActionItems: data.sync_action_items,
          createTasks: data.create_tasks,
          syncTrackers: data.sync_trackers,
          syncMomentum: data.sync_momentum,
          includeInHealthScore: data.include_in_health_score,
          momentumHealthWeight: data.momentum_health_weight,
          trackerMappings: data.tracker_mappings,
        });

        return {
          id: data.id,
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          tokenType: refreshed.tokenType,
          tokenExpiresAt: refreshed.tokenExpiresAt,
          config: {
            syncSchedule: data.sync_schedule,
            syncActionItems: data.sync_action_items,
            createTasks: data.create_tasks,
            syncTrackers: data.sync_trackers,
            syncMomentum: data.sync_momentum,
            includeInHealthScore: data.include_in_health_score,
            momentumHealthWeight: data.momentum_health_weight,
            trackerMappings: data.tracker_mappings,
          },
        };
      } catch (refreshError) {
        console.error('[Chorus] Failed to refresh token:', refreshError);
        // Return existing connection, let the caller handle auth errors
      }
    }

    return {
      id: data.id,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      tokenExpiresAt: expiresAt || undefined,
      apiKey: data.api_key,
      config: {
        syncSchedule: data.sync_schedule,
        syncActionItems: data.sync_action_items,
        createTasks: data.create_tasks,
        syncTrackers: data.sync_trackers,
        syncMomentum: data.sync_momentum,
        includeInHealthScore: data.include_in_health_score,
        momentumHealthWeight: data.momentum_health_weight,
        trackerMappings: data.tracker_mappings,
      },
    };
  }

  /**
   * Update sync configuration
   */
  async updateSyncConfig(userId: string, config: Partial<SyncConfig>): Promise<void> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (config.syncSchedule) updateData.sync_schedule = config.syncSchedule;
    if (config.syncActionItems !== undefined) updateData.sync_action_items = config.syncActionItems;
    if (config.createTasks !== undefined) updateData.create_tasks = config.createTasks;
    if (config.syncTrackers !== undefined) updateData.sync_trackers = config.syncTrackers;
    if (config.syncMomentum !== undefined) updateData.sync_momentum = config.syncMomentum;
    if (config.includeInHealthScore !== undefined) updateData.include_in_health_score = config.includeInHealthScore;
    if (config.momentumHealthWeight !== undefined) updateData.momentum_health_weight = config.momentumHealthWeight;
    if (config.trackerMappings) updateData.tracker_mappings = config.trackerMappings;

    const { error } = await supabase
      .from('integration_connections')
      .update(updateData)
      .eq('user_id', userId)
      .eq('provider', 'chorus');

    if (error) {
      throw new Error(`Failed to update config: ${error.message}`);
    }
  }

  /**
   * Disconnect Chorus integration
   */
  async disconnect(userId: string): Promise<void> {
    if (!supabase) return;

    await supabase.from('integration_connections').delete().eq('user_id', userId).eq('provider', 'chorus');
  }

  /**
   * Get sync status
   */
  async getSyncStatus(userId: string): Promise<SyncStatus> {
    if (!supabase) {
      return { connected: false };
    }

    const connection = await this.getConnection(userId);
    if (!connection) {
      return { connected: false };
    }

    // Get latest sync log
    const { data: latestSync } = await supabase
      .from('chorus_sync_log')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    return {
      connected: true,
      lastSyncAt: latestSync?.completed_at ? new Date(latestSync.completed_at) : undefined,
      lastSyncStatus: latestSync?.status,
      callsSynced: latestSync?.records_processed,
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

    if (!supabase) {
      return { logs: [], total: 0 };
    }

    const { data, count, error } = await supabase
      .from('chorus_sync_log')
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
   * Handle Chorus webhook
   */
  async handleWebhook(
    payload: unknown,
    signature: string,
    webhookSecret: string
  ): Promise<{ processed: boolean; action?: string }> {
    // Validate webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature || ''), Buffer.from(expectedSignature))) {
      throw new Error('Invalid webhook signature');
    }

    const typedPayload = payload as {
      type: string;
      event: string;
      data?: {
        call_id?: string;
        action_item?: unknown;
      };
    };

    // Process based on event type
    switch (typedPayload.event) {
      case 'call.processed':
      case 'call.updated':
        // Queue call for sync
        return { processed: true, action: 'call_sync_queued' };

      case 'action_item.created':
        // Queue action item for processing
        return { processed: true, action: 'action_item_queued' };

      case 'transcript.ready':
        // Transcript is ready to be fetched
        return { processed: true, action: 'transcript_ready' };

      default:
        return { processed: false, action: 'unknown_event' };
    }
  }

  /**
   * Start sync log entry
   */
  private async startSyncLog(
    userId: string,
    connectionId: string | undefined,
    objectType: string,
    syncType: string
  ): Promise<{ id: string } | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('chorus_sync_log')
      .insert({
        user_id: userId,
        integration_id: connectionId,
        object_type: objectType,
        sync_type: syncType,
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

    await supabase.from('chorus_sync_log').update({
      status,
      records_processed: result.synced,
      records_created: result.created,
      records_updated: result.updated,
      records_skipped: result.skipped,
      records_failed: result.errors.length,
      error_details: result.errors,
      completed_at: new Date().toISOString(),
    }).eq('id', syncLogId);
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return chorusCircuitBreaker.getStats();
  }
}

// Singleton instance
export const chorusService = new ChorusService();
export default chorusService;
