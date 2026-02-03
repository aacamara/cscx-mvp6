/**
 * Gong Service (PRD-193)
 *
 * Handles Gong API operations for call intelligence:
 * - Call data sync
 * - Transcript retrieval
 * - Insight extraction
 * - Sentiment analysis
 * - Risk signal detection
 * - Customer matching
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { CircuitBreaker } from '../circuitBreaker.js';
import { gongOAuth } from './oauth.js';
import {
  type GongApiCall,
  type GongApiCallsListResponse,
  type GongApiTranscriptResponse,
  type GongCallSyncOptions,
  type GongSyncResult,
  type SentimentAnalysisResult,
  RISK_SIGNAL_CONFIGS,
  getSentimentLabel,
} from './types.js';

// ============================================================================
// Types
// ============================================================================

export interface GongCall {
  id: string;
  gongCallId: string;
  customerId?: string;
  meetingId?: string;
  title: string;
  durationSeconds: number;
  participants: GongParticipant[];
  gongUrl: string;
  summary?: string;
  sentimentScore?: number;
  sentimentLabel?: string;
  callDate: string;
  syncedAt: string;
}

export interface GongParticipant {
  id: string;
  name: string;
  email?: string;
  role: 'internal' | 'external';
  speakingDuration?: number;
  speakingPercentage?: number;
}

export interface GongInsight {
  id: string;
  gongCallId: string;
  insightType: string;
  content: string;
  timestampSeconds: number;
  speaker?: string;
  confidence?: number;
  createdAt: string;
}

export interface GongTranscript {
  id: string;
  gongCallId: string;
  transcriptText: string;
  speakers: object[];
  wordCount: number;
  createdAt: string;
}

export interface GongRiskSignal {
  id: string;
  customerId: string;
  callId: string;
  signalType: string;
  severity: string;
  description: string;
  evidence: string;
  callDate: string;
  acknowledged: boolean;
  createdAt: string;
}

// ============================================================================
// Gong Service
// ============================================================================

export class GongService {
  private supabase: ReturnType<typeof createClient> | null = null;
  private circuitBreaker: CircuitBreaker;
  private baseUrl = 'https://api.gong.io/v2';

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    this.circuitBreaker = new CircuitBreaker('gong', {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 60000,
    });
  }

  // ============================================
  // API Request Helper
  // ============================================

  private async request<T>(
    userId: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const accessToken = await gongOAuth.getValidAccessToken(userId);

    return this.circuitBreaker.execute(async () => {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gong API error: ${response.status} - ${error}`);
      }

      return response.json();
    });
  }

  // ============================================
  // Call Operations
  // ============================================

  /**
   * Fetch calls from Gong API
   */
  async fetchCalls(
    userId: string,
    options: GongCallSyncOptions = {}
  ): Promise<{ calls: GongApiCall[]; cursor?: string; total: number }> {
    const body: Record<string, unknown> = {};

    if (options.fromDateTime) {
      body.filter = {
        ...body.filter as object,
        fromDateTime: options.fromDateTime,
      };
    }

    if (options.toDateTime) {
      body.filter = {
        ...body.filter as object,
        toDateTime: options.toDateTime,
      };
    }

    if (options.workspaceId) {
      body.filter = {
        ...body.filter as object,
        workspaceIds: [options.workspaceId],
      };
    }

    if (options.cursor) {
      body.cursor = options.cursor;
    }

    const response = await this.request<GongApiCallsListResponse>(
      userId,
      '/calls',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    return {
      calls: response.calls || [],
      cursor: response.records?.cursor,
      total: response.records?.totalRecords || 0,
    };
  }

  /**
   * Fetch extensive call data (with trackers and insights)
   */
  async fetchCallExtensive(
    userId: string,
    callId: string
  ): Promise<GongApiCall | null> {
    try {
      const response = await this.request<{ calls: GongApiCall[] }>(
        userId,
        '/calls/extensive',
        {
          method: 'POST',
          body: JSON.stringify({
            filter: {
              callIds: [callId],
            },
            contentSelector: {
              exposedFields: {
                content: {
                  structure: true,
                  trackers: true,
                  pointsOfInterest: true,
                },
                collaboration: {
                  publicComments: true,
                },
                parties: true,
              },
            },
          }),
        }
      );

      return response.calls?.[0] || null;
    } catch (error) {
      console.error(`[GongService] Error fetching call ${callId}:`, error);
      return null;
    }
  }

  /**
   * Fetch call transcript
   */
  async fetchTranscript(
    userId: string,
    callId: string
  ): Promise<GongApiTranscriptResponse | null> {
    try {
      const response = await this.request<GongApiTranscriptResponse>(
        userId,
        '/calls/transcript',
        {
          method: 'POST',
          body: JSON.stringify({
            filter: {
              callIds: [callId],
            },
          }),
        }
      );

      return response;
    } catch (error) {
      console.error(`[GongService] Error fetching transcript for ${callId}:`, error);
      return null;
    }
  }

  // ============================================
  // Sync Operations
  // ============================================

  /**
   * Sync calls from Gong to database
   */
  async syncCalls(
    userId: string,
    options: GongCallSyncOptions = {}
  ): Promise<GongSyncResult> {
    const startTime = Date.now();
    const result: GongSyncResult = {
      callsSynced: 0,
      transcriptsSynced: 0,
      insightsExtracted: 0,
      riskSignalsCreated: 0,
      customersMatched: 0,
      errors: [],
      duration: 0,
    };

    if (!this.supabase) {
      result.errors.push('Database not configured');
      return result;
    }

    try {
      let cursor: string | undefined = options.cursor;
      let hasMore = true;

      while (hasMore) {
        // Fetch batch of calls
        const { calls, cursor: nextCursor, total } = await this.fetchCalls(userId, {
          ...options,
          cursor,
        });

        console.log(`[GongService] Processing ${calls.length} calls (total: ${total})`);

        for (const gongCall of calls) {
          try {
            // Transform and save call
            const call = this.transformCall(gongCall);
            await this.saveCall(call);
            result.callsSynced++;

            // Fetch and save extensive data
            const extensiveData = await this.fetchCallExtensive(userId, gongCall.id);
            if (extensiveData) {
              // Extract and save insights
              const insights = this.extractInsights(extensiveData);
              for (const insight of insights) {
                await this.saveInsight(insight);
                result.insightsExtracted++;
              }

              // Detect and save risk signals
              const customerId = call.customerId;
              if (customerId) {
                const riskSignals = await this.detectRiskSignals(extensiveData, customerId);
                for (const signal of riskSignals) {
                  await this.saveRiskSignal(signal);
                  result.riskSignalsCreated++;
                }
              }
            }

            // Fetch and save transcript
            const transcriptData = await this.fetchTranscript(userId, gongCall.id);
            if (transcriptData?.callTranscripts?.[0]) {
              const transcript = this.transformTranscript(
                gongCall.id,
                transcriptData.callTranscripts[0]
              );
              await this.saveTranscript(transcript);
              result.transcriptsSynced++;
            }

            // Match to customer if not already matched
            if (!call.customerId) {
              const match = await this.matchCallToCustomer(gongCall);
              if (match) {
                await this.supabase
                  .from('gong_calls')
                  .update({ customer_id: match })
                  .eq('gong_call_id', gongCall.id);
                result.customersMatched++;
              }
            }
          } catch (error) {
            result.errors.push(`Error processing call ${gongCall.id}: ${(error as Error).message}`);
          }
        }

        cursor = nextCursor;
        hasMore = !!cursor && calls.length > 0;
      }
    } catch (error) {
      result.errors.push(`Sync error: ${(error as Error).message}`);
    }

    result.duration = Date.now() - startTime;
    console.log(`[GongService] Sync completed in ${result.duration}ms:`, result);

    return result;
  }

  // ============================================
  // Data Transformation
  // ============================================

  private transformCall(gongCall: GongApiCall): GongCall {
    const participants: GongParticipant[] = (gongCall.parties || []).map(party => ({
      id: party.id,
      name: party.name || 'Unknown',
      email: party.emailAddress,
      role: party.affiliation === 'Internal' ? 'internal' : 'external',
    }));

    return {
      id: crypto.randomUUID(),
      gongCallId: gongCall.id,
      title: gongCall.metaData?.title || 'Untitled Call',
      durationSeconds: gongCall.metaData?.duration || 0,
      participants,
      gongUrl: gongCall.metaData?.url || `https://app.gong.io/call?id=${gongCall.id}`,
      summary: gongCall.content?.structure?.callHighlights,
      callDate: gongCall.metaData?.started || new Date().toISOString(),
      syncedAt: new Date().toISOString(),
    };
  }

  private transformTranscript(
    callId: string,
    apiTranscript: { speakerId: string; topic?: string; sentences: { start: number; end: number; text: string }[] }[]
  ): GongTranscript {
    const speakers: object[] = [];
    let fullText = '';
    let wordCount = 0;

    for (const segment of apiTranscript) {
      for (const sentence of segment.sentences || []) {
        fullText += sentence.text + ' ';
        wordCount += sentence.text.split(/\s+/).length;
        speakers.push({
          speakerId: segment.speakerId,
          startTime: sentence.start,
          endTime: sentence.end,
          text: sentence.text,
        });
      }
    }

    return {
      id: crypto.randomUUID(),
      gongCallId: callId,
      transcriptText: fullText.trim(),
      speakers,
      wordCount,
      createdAt: new Date().toISOString(),
    };
  }

  // ============================================
  // Insight Extraction
  // ============================================

  private extractInsights(gongCall: GongApiCall): Omit<GongInsight, 'id' | 'createdAt'>[] {
    const insights: Omit<GongInsight, 'id' | 'createdAt'>[] = [];

    // Extract from trackers
    if (gongCall.content?.structure?.trackers) {
      for (const tracker of gongCall.content.structure.trackers) {
        const insightType = this.mapTrackerToInsightType(tracker.name);
        for (const occurrence of tracker.occurrences || []) {
          insights.push({
            gongCallId: gongCall.id,
            insightType,
            content: occurrence.phrases?.join(', ') || tracker.name,
            timestampSeconds: occurrence.startTime,
            speaker: occurrence.speakerId,
          });
        }
      }
    }

    // Extract from points of interest
    if (gongCall.content?.pointsOfInterest) {
      for (const poi of gongCall.content.pointsOfInterest) {
        insights.push({
          gongCallId: gongCall.id,
          insightType: this.mapPoiToInsightType(poi.type),
          content: poi.snippet || poi.type,
          timestampSeconds: poi.startTime,
          speaker: poi.speakerId,
        });
      }
    }

    return insights;
  }

  private mapTrackerToInsightType(trackerName: string): string {
    const lowerName = trackerName.toLowerCase();
    if (lowerName.includes('competitor')) return 'competitor_mention';
    if (lowerName.includes('price') || lowerName.includes('cost')) return 'pricing_discussion';
    if (lowerName.includes('risk') || lowerName.includes('concern')) return 'risk_indicator';
    if (lowerName.includes('action') || lowerName.includes('next step')) return 'action_item';
    if (lowerName.includes('question')) return 'question';
    return 'tracker';
  }

  private mapPoiToInsightType(poiType: string): string {
    const typeMap: Record<string, string> = {
      'competitor_mention': 'competitor_mention',
      'pricing': 'pricing_discussion',
      'objection': 'objection',
      'question': 'question',
      'next_steps': 'next_step',
      'action_item': 'action_item',
    };
    return typeMap[poiType.toLowerCase()] || 'insight';
  }

  // ============================================
  // Risk Signal Detection
  // ============================================

  private async detectRiskSignals(
    gongCall: GongApiCall,
    customerId: string
  ): Promise<Omit<GongRiskSignal, 'id' | 'createdAt'>[]> {
    const signals: Omit<GongRiskSignal, 'id' | 'createdAt'>[] = [];

    // Check trackers for risk signals
    if (gongCall.content?.structure?.trackers) {
      for (const tracker of gongCall.content.structure.trackers) {
        for (const riskConfig of RISK_SIGNAL_CONFIGS) {
          const trackerLower = tracker.name.toLowerCase();
          if (riskConfig.keywords.some(kw => trackerLower.includes(kw))) {
            signals.push({
              customerId,
              callId: gongCall.id,
              signalType: riskConfig.type,
              severity: riskConfig.severity,
              description: riskConfig.description,
              evidence: `Tracker "${tracker.name}" detected ${tracker.count} time(s)`,
              callDate: gongCall.metaData?.started || new Date().toISOString(),
              acknowledged: false,
            });
            break; // One signal per tracker
          }
        }
      }
    }

    // Check call highlights for risk keywords
    const highlights = gongCall.content?.structure?.callHighlights || '';
    for (const riskConfig of RISK_SIGNAL_CONFIGS) {
      const highlightsLower = highlights.toLowerCase();
      const matchedKeyword = riskConfig.keywords.find(kw => highlightsLower.includes(kw));
      if (matchedKeyword) {
        signals.push({
          customerId,
          callId: gongCall.id,
          signalType: riskConfig.type,
          severity: riskConfig.severity,
          description: riskConfig.description,
          evidence: `Keyword "${matchedKeyword}" found in call highlights`,
          callDate: gongCall.metaData?.started || new Date().toISOString(),
          acknowledged: false,
        });
      }
    }

    return signals;
  }

  // ============================================
  // Customer Matching
  // ============================================

  private async matchCallToCustomer(gongCall: GongApiCall): Promise<string | null> {
    if (!this.supabase) return null;

    // Try to match by email domain
    const externalParties = (gongCall.parties || []).filter(p => p.affiliation === 'External');
    const domains = new Set<string>();

    for (const party of externalParties) {
      if (party.emailAddress) {
        const domain = party.emailAddress.split('@')[1];
        if (domain) domains.add(domain.toLowerCase());
      }
    }

    for (const domain of domains) {
      // Check if any customer has this domain
      const { data } = await this.supabase
        .from('customers')
        .select('id')
        .ilike('domain', `%${domain}%`)
        .limit(1)
        .single();

      if (data?.id) {
        return data.id;
      }

      // Check stakeholders
      const { data: stakeholder } = await this.supabase
        .from('stakeholders')
        .select('customer_id')
        .ilike('email', `%@${domain}`)
        .limit(1)
        .single();

      if (stakeholder?.customer_id) {
        return stakeholder.customer_id;
      }
    }

    return null;
  }

  // ============================================
  // Sentiment Analysis
  // ============================================

  /**
   * Analyze sentiment for a call
   * Uses Claude API for sentiment analysis
   */
  async analyzeCallSentiment(
    userId: string,
    callId: string
  ): Promise<SentimentAnalysisResult | null> {
    // Get transcript
    const transcriptData = await this.fetchTranscript(userId, callId);
    if (!transcriptData?.callTranscripts?.[0]) {
      return null;
    }

    const transcript = transcriptData.callTranscripts[0];
    const fullText = transcript.transcript
      .flatMap(t => t.sentences.map(s => s.text))
      .join(' ');

    // Simple keyword-based sentiment (replace with Claude API for production)
    const positiveWords = ['great', 'excellent', 'happy', 'love', 'amazing', 'helpful', 'thank'];
    const negativeWords = ['frustrated', 'disappointed', 'issue', 'problem', 'broken', 'unhappy', 'concern'];

    const words = fullText.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of words) {
      if (positiveWords.some(pw => word.includes(pw))) positiveCount++;
      if (negativeWords.some(nw => word.includes(nw))) negativeCount++;
    }

    const totalSentimentWords = positiveCount + negativeCount;
    let score = 0;

    if (totalSentimentWords > 0) {
      score = Math.round(((positiveCount - negativeCount) / totalSentimentWords) * 100);
    }

    // Clamp score to [-100, 100]
    score = Math.max(-100, Math.min(100, score));

    return {
      score,
      label: getSentimentLabel(score),
      confidence: totalSentimentWords > 10 ? 0.8 : 0.5,
      segments: [],
    };
  }

  /**
   * Update call with sentiment score
   */
  async updateCallSentiment(callId: string, sentiment: SentimentAnalysisResult): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('gong_calls')
      .update({
        sentiment_score: sentiment.score,
        sentiment_label: sentiment.label,
        updated_at: new Date().toISOString(),
      })
      .eq('gong_call_id', callId);
  }

  // ============================================
  // Database Operations
  // ============================================

  private async saveCall(call: GongCall): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('gong_calls').upsert({
      id: call.id,
      gong_call_id: call.gongCallId,
      customer_id: call.customerId,
      meeting_id: call.meetingId,
      title: call.title,
      duration_seconds: call.durationSeconds,
      participants: call.participants,
      gong_url: call.gongUrl,
      summary: call.summary,
      sentiment_score: call.sentimentScore,
      sentiment_label: call.sentimentLabel,
      call_date: call.callDate,
      synced_at: call.syncedAt,
    }, {
      onConflict: 'gong_call_id',
    });
  }

  private async saveInsight(insight: Omit<GongInsight, 'id' | 'createdAt'>): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('gong_insights').insert({
      id: crypto.randomUUID(),
      gong_call_id: insight.gongCallId,
      insight_type: insight.insightType,
      content: insight.content,
      timestamp_seconds: insight.timestampSeconds,
      speaker: insight.speaker,
      confidence: insight.confidence,
      created_at: new Date().toISOString(),
    });
  }

  private async saveTranscript(transcript: GongTranscript): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('gong_transcripts').upsert({
      id: transcript.id,
      gong_call_id: transcript.gongCallId,
      transcript_text: transcript.transcriptText,
      speakers: transcript.speakers,
      word_count: transcript.wordCount,
      created_at: transcript.createdAt,
    }, {
      onConflict: 'gong_call_id',
    });
  }

  private async saveRiskSignal(signal: Omit<GongRiskSignal, 'id' | 'createdAt'>): Promise<void> {
    if (!this.supabase) return;

    // Check for existing similar signal to avoid duplicates
    const { data: existing } = await this.supabase
      .from('gong_risk_signals')
      .select('id')
      .eq('customer_id', signal.customerId)
      .eq('call_id', signal.callId)
      .eq('signal_type', signal.signalType)
      .single();

    if (existing) return;

    await this.supabase.from('gong_risk_signals').insert({
      id: crypto.randomUUID(),
      customer_id: signal.customerId,
      call_id: signal.callId,
      signal_type: signal.signalType,
      severity: signal.severity,
      description: signal.description,
      evidence: signal.evidence,
      call_date: signal.callDate,
      acknowledged: signal.acknowledged,
      created_at: new Date().toISOString(),
    });
  }

  // ============================================
  // Query Operations
  // ============================================

  /**
   * Get calls for a customer
   */
  async getCustomerCalls(
    customerId: string,
    options: {
      limit?: number;
      offset?: number;
      fromDate?: string;
      toDate?: string;
    } = {}
  ): Promise<{ calls: GongCall[]; total: number }> {
    if (!this.supabase) {
      return { calls: [], total: 0 };
    }

    let query = this.supabase
      .from('gong_calls')
      .select('*', { count: 'exact' })
      .eq('customer_id', customerId)
      .order('call_date', { ascending: false });

    if (options.fromDate) {
      query = query.gte('call_date', options.fromDate);
    }

    if (options.toDate) {
      query = query.lte('call_date', options.toDate);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[GongService] Error fetching customer calls:', error);
      return { calls: [], total: 0 };
    }

    const calls: GongCall[] = (data || []).map(row => ({
      id: row.id,
      gongCallId: row.gong_call_id,
      customerId: row.customer_id,
      meetingId: row.meeting_id,
      title: row.title,
      durationSeconds: row.duration_seconds,
      participants: row.participants || [],
      gongUrl: row.gong_url,
      summary: row.summary,
      sentimentScore: row.sentiment_score,
      sentimentLabel: row.sentiment_label,
      callDate: row.call_date,
      syncedAt: row.synced_at,
    }));

    return { calls, total: count || 0 };
  }

  /**
   * Get call by ID
   */
  async getCall(callId: string): Promise<GongCall | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('gong_calls')
      .select('*')
      .eq('gong_call_id', callId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      gongCallId: data.gong_call_id,
      customerId: data.customer_id,
      meetingId: data.meeting_id,
      title: data.title,
      durationSeconds: data.duration_seconds,
      participants: data.participants || [],
      gongUrl: data.gong_url,
      summary: data.summary,
      sentimentScore: data.sentiment_score,
      sentimentLabel: data.sentiment_label,
      callDate: data.call_date,
      syncedAt: data.synced_at,
    };
  }

  /**
   * Get transcript for a call
   */
  async getTranscript(callId: string): Promise<GongTranscript | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('gong_transcripts')
      .select('*')
      .eq('gong_call_id', callId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      gongCallId: data.gong_call_id,
      transcriptText: data.transcript_text,
      speakers: data.speakers || [],
      wordCount: data.word_count,
      createdAt: data.created_at,
    };
  }

  /**
   * Get insights for a call
   */
  async getCallInsights(callId: string): Promise<GongInsight[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('gong_insights')
      .select('*')
      .eq('gong_call_id', callId)
      .order('timestamp_seconds', { ascending: true });

    if (error || !data) return [];

    return data.map(row => ({
      id: row.id,
      gongCallId: row.gong_call_id,
      insightType: row.insight_type,
      content: row.content,
      timestampSeconds: row.timestamp_seconds,
      speaker: row.speaker,
      confidence: row.confidence,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get insights for a customer
   */
  async getCustomerInsights(customerId: string): Promise<{
    insights: GongInsight[];
    aggregated: Record<string, number>;
  }> {
    if (!this.supabase) {
      return { insights: [], aggregated: {} };
    }

    // Get all call IDs for customer
    const { data: calls } = await this.supabase
      .from('gong_calls')
      .select('gong_call_id')
      .eq('customer_id', customerId);

    if (!calls || calls.length === 0) {
      return { insights: [], aggregated: {} };
    }

    const callIds = calls.map(c => c.gong_call_id);

    // Get insights for these calls
    const { data, error } = await this.supabase
      .from('gong_insights')
      .select('*')
      .in('gong_call_id', callIds)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) {
      return { insights: [], aggregated: {} };
    }

    const insights: GongInsight[] = data.map(row => ({
      id: row.id,
      gongCallId: row.gong_call_id,
      insightType: row.insight_type,
      content: row.content,
      timestampSeconds: row.timestamp_seconds,
      speaker: row.speaker,
      confidence: row.confidence,
      createdAt: row.created_at,
    }));

    // Aggregate by type
    const aggregated: Record<string, number> = {};
    for (const insight of insights) {
      aggregated[insight.insightType] = (aggregated[insight.insightType] || 0) + 1;
    }

    return { insights, aggregated };
  }

  /**
   * Get risk signals for a customer
   */
  async getCustomerRiskSignals(
    customerId: string,
    unacknowledgedOnly = false
  ): Promise<GongRiskSignal[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('gong_risk_signals')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (unacknowledgedOnly) {
      query = query.eq('acknowledged', false);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map(row => ({
      id: row.id,
      customerId: row.customer_id,
      callId: row.call_id,
      signalType: row.signal_type,
      severity: row.severity,
      description: row.description,
      evidence: row.evidence,
      callDate: row.call_date,
      acknowledged: row.acknowledged,
      createdAt: row.created_at,
    }));
  }

  /**
   * Acknowledge a risk signal
   */
  async acknowledgeRiskSignal(signalId: string, userId: string): Promise<boolean> {
    if (!this.supabase) return false;

    const { error } = await this.supabase
      .from('gong_risk_signals')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
      })
      .eq('id', signalId);

    return !error;
  }

  /**
   * Search transcripts
   */
  async searchTranscripts(
    query: string,
    options: {
      customerId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ results: Array<{ callId: string; title: string; callDate: string; matches: string[] }>; total: number }> {
    if (!this.supabase) {
      return { results: [], total: 0 };
    }

    // Use full-text search if available, otherwise use ILIKE
    let dbQuery = this.supabase
      .from('gong_transcripts')
      .select(`
        gong_call_id,
        transcript_text,
        gong_calls!inner(title, call_date, customer_id)
      `)
      .ilike('transcript_text', `%${query}%`);

    if (options.customerId) {
      dbQuery = dbQuery.eq('gong_calls.customer_id', options.customerId);
    }

    if (options.limit) {
      dbQuery = dbQuery.limit(options.limit);
    }

    if (options.offset) {
      dbQuery = dbQuery.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error, count } = await dbQuery;

    if (error || !data) {
      return { results: [], total: 0 };
    }

    const results = data.map(row => {
      // Extract matching snippets
      const text = row.transcript_text;
      const queryLower = query.toLowerCase();
      const textLower = text.toLowerCase();
      const matches: string[] = [];

      let idx = textLower.indexOf(queryLower);
      while (idx !== -1 && matches.length < 3) {
        const start = Math.max(0, idx - 50);
        const end = Math.min(text.length, idx + query.length + 50);
        matches.push('...' + text.substring(start, end) + '...');
        idx = textLower.indexOf(queryLower, idx + 1);
      }

      return {
        callId: row.gong_call_id,
        title: (row as any).gong_calls?.title || 'Untitled',
        callDate: (row as any).gong_calls?.call_date || '',
        matches,
      };
    });

    return { results, total: count || results.length };
  }

  /**
   * Get sentiment trend for a customer
   */
  async getCustomerSentimentTrend(customerId: string): Promise<{
    current: number;
    change7d: number;
    change30d: number;
    trend: 'improving' | 'stable' | 'declining';
    history: { date: string; score: number }[];
  }> {
    if (!this.supabase) {
      return { current: 0, change7d: 0, change30d: 0, trend: 'stable', history: [] };
    }

    const { data } = await this.supabase
      .from('gong_calls')
      .select('call_date, sentiment_score')
      .eq('customer_id', customerId)
      .not('sentiment_score', 'is', null)
      .order('call_date', { ascending: false })
      .limit(30);

    if (!data || data.length === 0) {
      return { current: 0, change7d: 0, change30d: 0, trend: 'stable', history: [] };
    }

    const history = data.map(d => ({
      date: d.call_date,
      score: d.sentiment_score,
    })).reverse();

    const current = history[history.length - 1]?.score || 0;

    // Calculate 7-day change
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const score7dAgo = history.find(h => new Date(h.date) <= sevenDaysAgo)?.score || current;
    const change7d = current - score7dAgo;

    // Calculate 30-day change
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const score30dAgo = history.find(h => new Date(h.date) <= thirtyDaysAgo)?.score || current;
    const change30d = current - score30dAgo;

    // Determine trend
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (change7d > 5) trend = 'improving';
    else if (change7d < -5) trend = 'declining';

    return { current, change7d, change30d, trend, history };
  }

  // ============================================
  // Health Check
  // ============================================

  async healthCheck(userId: string): Promise<boolean> {
    try {
      await gongOAuth.getValidAccessToken(userId);
      return true;
    } catch {
      return false;
    }
  }

  getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
  }
}

// Singleton instance
export const gongService = new GongService();
