/**
 * Intercom Integration Service - PRD-185
 *
 * Implements Intercom Conversation Sync:
 * - OAuth 2.0 authentication
 * - Conversation sync by company/user
 * - Company/User matching to CSCX customers
 * - Sentiment analysis via AI
 * - Engagement metrics calculation
 * - Theme extraction
 * - Real-time webhook processing
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

// Circuit breaker for Intercom API calls
const intercomCircuitBreaker = new CircuitBreaker('intercom', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000, // 1 minute before retry
});

// ============================================
// Types
// ============================================

export interface IntercomConnection {
  id?: string;
  accessToken: string;
  tokenType: string;
  appId?: string;
  workspaceId?: string;
  tokenExpiresAt?: Date;
}

export interface IntercomConversation {
  id: string;
  type: string;
  title?: string;
  created_at: number;
  updated_at: number;
  waiting_since?: number;
  snoozed_until?: number;
  open: boolean;
  state: 'open' | 'closed' | 'snoozed';
  read: boolean;
  priority: 'priority' | 'not_priority';
  admin_assignee_id?: number;
  team_assignee_id?: string;
  tags?: { id: string; name: string; applied_at: number }[];
  conversation_rating?: {
    rating: number;
    remark?: string;
    created_at: number;
  };
  source?: {
    type: string;
    id: string;
    delivered_as: string;
    subject?: string;
    body: string;
    author: {
      type: string;
      id: string;
      name?: string;
      email?: string;
    };
    attachments?: { url: string; name: string; type: string }[];
    url?: string;
  };
  contacts?: {
    type: string;
    contacts: Array<{
      type: string;
      id: string;
      external_id?: string;
    }>;
  };
  first_contact_reply?: {
    created_at: number;
    type: string;
    url?: string;
  };
  sla_applied?: {
    sla_name: string;
    sla_status: string;
  };
  statistics?: {
    time_to_assignment: number;
    time_to_admin_reply: number;
    time_to_first_close: number;
    time_to_last_close: number;
    median_time_to_reply: number;
    first_contact_reply_at: number;
    first_assignment_at: number;
    first_admin_reply_at: number;
    first_close_at: number;
    last_assignment_at: number;
    last_assignment_admin_reply_at: number;
    last_contact_reply_at: number;
    last_admin_reply_at: number;
    last_close_at: number;
    last_closed_by_id: number;
    count_reopens: number;
    count_assignments: number;
    count_conversation_parts: number;
  };
  conversation_parts?: {
    type: string;
    conversation_parts: ConversationPart[];
    total_count: number;
  };
}

export interface ConversationPart {
  type: string;
  id: string;
  part_type: string;
  body: string;
  created_at: number;
  updated_at: number;
  notified_at: number;
  assigned_to?: {
    type: string;
    id: string;
  };
  author: {
    type: string;
    id: string;
    name?: string;
    email?: string;
  };
  attachments?: { url: string; name: string; type: string }[];
  external_id?: string;
  redacted: boolean;
}

export interface IntercomCompany {
  type: string;
  id: string;
  company_id: string;
  name: string;
  plan?: { type: string; id: string; name: string };
  size?: number;
  industry?: string;
  website?: string;
  monthly_spend?: number;
  session_count?: number;
  user_count?: number;
  created_at: number;
  updated_at: number;
  last_request_at?: number;
  custom_attributes?: Record<string, unknown>;
}

export interface IntercomUser {
  type: string;
  id: string;
  user_id?: string;
  external_id?: string;
  email?: string;
  phone?: string;
  name?: string;
  avatar?: string;
  owner_id?: number;
  social_profiles?: { type: string; name: string; url: string }[];
  companies?: { type: string; companies: IntercomCompany[] };
  location_data?: {
    city_name?: string;
    continent_code?: string;
    country_code?: string;
    country_name?: string;
    postal_code?: string;
    region_name?: string;
    timezone?: string;
  };
  created_at: number;
  updated_at: number;
  last_request_at?: number;
  last_seen_ip?: string;
  signed_up_at?: number;
  custom_attributes?: Record<string, unknown>;
}

export interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  syncLogId?: string;
}

export interface ConversationMetrics {
  totalConversations: number;
  openConversations: number;
  closedConversations: number;
  avgResponseTime: number;
  avgResolutionTime: number;
  repeatContactRate: number;
  conversationVolume: { date: string; count: number }[];
  sentimentDistribution: { sentiment: string; count: number }[];
  topThemes: { theme: string; count: number }[];
}

export interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated';
  score: number;
  confidence: number;
  keywords: string[];
}

export interface ThemeResult {
  themes: string[];
  categories: ('support' | 'feature_request' | 'bug' | 'billing' | 'general')[];
  keywords: string[];
}

export interface SyncConfig {
  syncSchedule: 'realtime' | 'hourly' | 'daily' | 'manual';
  sentimentAnalysisEnabled: boolean;
  themeExtractionEnabled: boolean;
  includeInHealthScore: boolean;
}

export interface SyncStatus {
  connected: boolean;
  lastSyncAt?: Date;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  conversationsSynced?: number;
  syncErrors?: string[];
  nextScheduledSync?: Date;
}

// ============================================
// Intercom Service Class
// ============================================

export class IntercomService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private apiVersion = '2.11';
  private baseUrl = 'https://api.intercom.io';

  constructor() {
    this.clientId = process.env.INTERCOM_CLIENT_ID || '';
    this.clientSecret = process.env.INTERCOM_CLIENT_SECRET || '';
    this.redirectUri =
      process.env.INTERCOM_REDIRECT_URI ||
      'http://localhost:3001/api/integrations/intercom/callback';
  }

  /**
   * Check if Intercom integration is configured
   */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthUrl(userId: string): string {
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
    });

    return `https://app.intercom.com/oauth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async connect(code: string): Promise<IntercomConnection> {
    const response = await withRetry(
      async () => {
        return intercomCircuitBreaker.execute(async () => {
          const res = await fetch('https://api.intercom.io/auth/eagle/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code,
              client_id: this.clientId,
              client_secret: this.clientSecret,
            }),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`Intercom OAuth failed: ${error}`);
          }

          return res.json();
        });
      },
      {
        ...retryStrategies.aiService,
        maxRetries: 2,
        onRetry: (attempt, error) => {
          console.log(`[Intercom] OAuth retry attempt ${attempt}: ${error.message}`);
        },
      }
    );

    return {
      accessToken: response.access_token,
      tokenType: response.token_type || 'Bearer',
    };
  }

  /**
   * Make authenticated API request to Intercom
   */
  private async apiRequest<T>(
    connection: IntercomConnection,
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: unknown;
      params?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, params } = options;

    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const response = await withRetry(
      async () => {
        return intercomCircuitBreaker.execute(async () => {
          const res = await fetch(url, {
            method,
            headers: {
              Authorization: `Bearer ${connection.accessToken}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'Intercom-Version': this.apiVersion,
            },
            ...(body && { body: JSON.stringify(body) }),
          });

          if (!res.ok) {
            const error = await res.text();
            if (res.status === 401) {
              throw new Error('TOKEN_EXPIRED');
            }
            throw new Error(`Intercom API error: ${error}`);
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
   * List conversations with pagination
   */
  async listConversations(
    connection: IntercomConnection,
    options: {
      starting_after?: string;
      per_page?: number;
    } = {}
  ): Promise<{ conversations: IntercomConversation[]; pages: { next?: { starting_after: string } } }> {
    const params: Record<string, string> = {};
    if (options.starting_after) params.starting_after = options.starting_after;
    if (options.per_page) params.per_page = options.per_page.toString();

    return this.apiRequest(connection, '/conversations', { params });
  }

  /**
   * Get a single conversation with all parts
   */
  async getConversation(
    connection: IntercomConnection,
    conversationId: string
  ): Promise<IntercomConversation> {
    return this.apiRequest(connection, `/conversations/${conversationId}`, {
      params: { display_as: 'plaintext' },
    });
  }

  /**
   * Search conversations by company
   */
  async searchConversationsByCompany(
    connection: IntercomConnection,
    companyId: string,
    options: {
      starting_after?: string;
      per_page?: number;
    } = {}
  ): Promise<{ conversations: IntercomConversation[]; pages: { next?: { starting_after: string } } }> {
    const query = {
      query: {
        field: 'contact.company.company_id',
        operator: '=',
        value: companyId,
      },
      pagination: {
        per_page: options.per_page || 50,
        ...(options.starting_after && { starting_after: options.starting_after }),
      },
    };

    return this.apiRequest(connection, '/conversations/search', {
      method: 'POST',
      body: query,
    });
  }

  /**
   * List companies with pagination
   */
  async listCompanies(
    connection: IntercomConnection,
    options: {
      starting_after?: string;
      per_page?: number;
    } = {}
  ): Promise<{ data: IntercomCompany[]; pages: { next?: { starting_after: string } } }> {
    const params: Record<string, string> = {};
    if (options.starting_after) params.starting_after = options.starting_after;
    if (options.per_page) params.per_page = options.per_page.toString();

    return this.apiRequest(connection, '/companies', { params });
  }

  /**
   * Get a single company
   */
  async getCompany(connection: IntercomConnection, companyId: string): Promise<IntercomCompany> {
    return this.apiRequest(connection, `/companies/${companyId}`);
  }

  /**
   * List users with pagination
   */
  async listUsers(
    connection: IntercomConnection,
    options: {
      starting_after?: string;
      per_page?: number;
    } = {}
  ): Promise<{ data: IntercomUser[]; pages: { next?: { starting_after: string } } }> {
    const params: Record<string, string> = {};
    if (options.starting_after) params.starting_after = options.starting_after;
    if (options.per_page) params.per_page = options.per_page.toString();

    return this.apiRequest(connection, '/contacts', { params });
  }

  /**
   * Sync conversations from Intercom to CSCX
   */
  async syncConversations(
    connection: IntercomConnection,
    userId: string,
    options: {
      incremental?: boolean;
      lastSyncAt?: Date;
      companyId?: string;
    } = {}
  ): Promise<SyncResult> {
    const { incremental = false, lastSyncAt, companyId } = options;

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
      'conversations',
      incremental ? 'incremental' : 'full'
    );
    result.syncLogId = syncLog?.id;

    try {
      // Get customer mapping (Intercom company ID -> CSCX Customer ID)
      const { data: customers } = await supabase
        .from('customers')
        .select('id, external_id, intercom_company_id, name, domain')
        .or('intercom_company_id.not.is.null,external_id.not.is.null');

      const customerByIntercomId = new Map<string, string>();
      const customerByDomain = new Map<string, string>();

      customers?.forEach((c) => {
        if (c.intercom_company_id) {
          customerByIntercomId.set(c.intercom_company_id, c.id);
        }
        if (c.domain) {
          customerByDomain.set(c.domain.toLowerCase(), c.id);
        }
      });

      // Fetch conversations
      let hasMore = true;
      let startingAfter: string | undefined;

      while (hasMore) {
        let response;

        if (companyId) {
          response = await this.searchConversationsByCompany(connection, companyId, {
            starting_after: startingAfter,
            per_page: 50,
          });
        } else {
          response = await this.listConversations(connection, {
            starting_after: startingAfter,
            per_page: 50,
          });
        }

        for (const conv of response.conversations) {
          try {
            // Skip if incremental and not updated since last sync
            if (incremental && lastSyncAt) {
              const updatedAt = new Date(conv.updated_at * 1000);
              if (updatedAt <= lastSyncAt) {
                result.skipped++;
                continue;
              }
            }

            // Get full conversation with parts
            const fullConversation = await this.getConversation(connection, conv.id);

            // Match to customer
            let customerId: string | null = null;

            // Try to match via contacts' company
            if (fullConversation.contacts?.contacts) {
              for (const contact of fullConversation.contacts.contacts) {
                // Would need to fetch contact details to get company
                // For now, we'll rely on the search being scoped to company
                if (companyId && customerByIntercomId.has(companyId)) {
                  customerId = customerByIntercomId.get(companyId) || null;
                  break;
                }
              }
            }

            // Skip if no customer match
            if (!customerId) {
              result.skipped++;
              continue;
            }

            // Analyze sentiment
            const transcript = this.extractTranscript(fullConversation);
            const sentiment = await this.analyzeSentiment(transcript);
            const themes = await this.extractThemes(transcript);

            // Check if conversation exists
            const { data: existing } = await supabase
              .from('intercom_conversations')
              .select('id')
              .eq('intercom_id', conv.id)
              .single();

            const conversationData = {
              intercom_id: conv.id,
              customer_id: customerId,
              subject: fullConversation.source?.subject || this.generateSubject(fullConversation),
              state: conv.state,
              sentiment: sentiment.sentiment,
              sentiment_score: sentiment.score,
              tags: fullConversation.tags?.map((t) => t.name) || [],
              themes: themes.themes,
              assignee_id: conv.admin_assignee_id?.toString(),
              priority: conv.priority,
              open: conv.open,
              rating: fullConversation.conversation_rating?.rating,
              rating_remark: fullConversation.conversation_rating?.remark,
              first_contact_reply_at: fullConversation.first_contact_reply?.created_at
                ? new Date(fullConversation.first_contact_reply.created_at * 1000).toISOString()
                : null,
              statistics: fullConversation.statistics || {},
              created_at: new Date(conv.created_at * 1000).toISOString(),
              updated_at: new Date(conv.updated_at * 1000).toISOString(),
              closed_at: conv.state === 'closed' && fullConversation.statistics?.last_close_at
                ? new Date(fullConversation.statistics.last_close_at * 1000).toISOString()
                : null,
            };

            if (existing) {
              await supabase.from('intercom_conversations').update(conversationData).eq('id', existing.id);
              result.updated++;
            } else {
              const { data: newConv } = await supabase
                .from('intercom_conversations')
                .insert(conversationData)
                .select('id')
                .single();

              result.created++;

              // Save conversation messages
              if (newConv && fullConversation.conversation_parts?.conversation_parts) {
                await this.saveConversationMessages(
                  newConv.id,
                  fullConversation.source,
                  fullConversation.conversation_parts.conversation_parts
                );
              }
            }

            result.synced++;
          } catch (err) {
            result.errors.push(`Failed to sync conversation ${conv.id}: ${(err as Error).message}`);
          }
        }

        // Check for more pages
        if (response.pages?.next?.starting_after) {
          startingAfter = response.pages.next.starting_after;
        } else {
          hasMore = false;
        }
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
   * Save conversation messages to database
   */
  private async saveConversationMessages(
    conversationId: string,
    source: IntercomConversation['source'],
    parts: ConversationPart[]
  ): Promise<void> {
    if (!supabase) return;

    const messages = [];

    // Add the initial source message
    if (source) {
      messages.push({
        conversation_id: conversationId,
        intercom_part_id: source.id,
        author_type: source.author?.type || 'user',
        author_id: source.author?.id,
        author_name: source.author?.name,
        author_email: source.author?.email,
        body: source.body,
        part_type: source.type,
        created_at: new Date().toISOString(), // Source doesn't have created_at
      });
    }

    // Add conversation parts
    for (const part of parts) {
      if (part.body && !part.redacted) {
        messages.push({
          conversation_id: conversationId,
          intercom_part_id: part.id,
          author_type: part.author?.type || 'unknown',
          author_id: part.author?.id,
          author_name: part.author?.name,
          author_email: part.author?.email,
          body: part.body,
          part_type: part.part_type,
          created_at: new Date(part.created_at * 1000).toISOString(),
        });
      }
    }

    if (messages.length > 0) {
      await supabase.from('intercom_messages').insert(messages);
    }
  }

  /**
   * Extract full transcript from conversation
   */
  private extractTranscript(conversation: IntercomConversation): string {
    const parts: string[] = [];

    // Add source message
    if (conversation.source?.body) {
      const author = conversation.source.author?.name || conversation.source.author?.email || 'Customer';
      parts.push(`${author}: ${conversation.source.body}`);
    }

    // Add conversation parts
    if (conversation.conversation_parts?.conversation_parts) {
      for (const part of conversation.conversation_parts.conversation_parts) {
        if (part.body && !part.redacted) {
          const author = part.author?.name || part.author?.email || part.author?.type || 'Unknown';
          parts.push(`${author}: ${part.body}`);
        }
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Generate subject from conversation if not provided
   */
  private generateSubject(conversation: IntercomConversation): string {
    // Use first 50 chars of the first message
    const firstMessage = conversation.source?.body || '';
    const cleaned = firstMessage.replace(/<[^>]*>/g, '').trim();
    return cleaned.length > 50 ? cleaned.substring(0, 47) + '...' : cleaned || 'No subject';
  }

  /**
   * Analyze sentiment of conversation using AI
   */
  async analyzeSentiment(transcript: string): Promise<SentimentResult> {
    // Default result if AI analysis not available
    const defaultResult: SentimentResult = {
      sentiment: 'neutral',
      score: 0.5,
      confidence: 0.5,
      keywords: [],
    };

    if (!config.anthropicApiKey || !transcript || transcript.length < 10) {
      return defaultResult;
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.anthropicApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: `Analyze the sentiment of this customer support conversation. Return a JSON object with:
- sentiment: one of "positive", "neutral", "negative", "frustrated"
- score: 0-1 where 0 is most negative, 1 is most positive
- confidence: 0-1 confidence in the analysis
- keywords: array of 3-5 key emotional/sentiment words found

Conversation:
${transcript.substring(0, 2000)}

Return only valid JSON, no other text.`,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.content?.[0]?.text;
        if (content) {
          const parsed = JSON.parse(content);
          return {
            sentiment: parsed.sentiment || 'neutral',
            score: parsed.score || 0.5,
            confidence: parsed.confidence || 0.5,
            keywords: parsed.keywords || [],
          };
        }
      }
    } catch (error) {
      console.error('[Intercom] Sentiment analysis failed:', error);
    }

    return defaultResult;
  }

  /**
   * Extract themes from conversation using AI
   */
  async extractThemes(transcript: string): Promise<ThemeResult> {
    const defaultResult: ThemeResult = {
      themes: [],
      categories: ['general'],
      keywords: [],
    };

    if (!config.anthropicApiKey || !transcript || transcript.length < 10) {
      return defaultResult;
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.anthropicApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: `Extract themes from this customer support conversation. Return a JSON object with:
- themes: array of 2-5 specific topics discussed (e.g., "login issues", "billing question", "feature request")
- categories: array of applicable categories from: "support", "feature_request", "bug", "billing", "general"
- keywords: array of 3-5 key technical/product terms mentioned

Conversation:
${transcript.substring(0, 2000)}

Return only valid JSON, no other text.`,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.content?.[0]?.text;
        if (content) {
          const parsed = JSON.parse(content);
          return {
            themes: parsed.themes || [],
            categories: parsed.categories || ['general'],
            keywords: parsed.keywords || [],
          };
        }
      }
    } catch (error) {
      console.error('[Intercom] Theme extraction failed:', error);
    }

    return defaultResult;
  }

  /**
   * Calculate engagement metrics for a customer
   */
  async getConversationMetrics(customerId: string): Promise<ConversationMetrics> {
    const defaultMetrics: ConversationMetrics = {
      totalConversations: 0,
      openConversations: 0,
      closedConversations: 0,
      avgResponseTime: 0,
      avgResolutionTime: 0,
      repeatContactRate: 0,
      conversationVolume: [],
      sentimentDistribution: [],
      topThemes: [],
    };

    if (!supabase) {
      return defaultMetrics;
    }

    try {
      // Get all conversations for customer
      const { data: conversations } = await supabase
        .from('intercom_conversations')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (!conversations || conversations.length === 0) {
        return defaultMetrics;
      }

      // Calculate metrics
      const totalConversations = conversations.length;
      const openConversations = conversations.filter((c) => c.state === 'open').length;
      const closedConversations = conversations.filter((c) => c.state === 'closed').length;

      // Calculate average response time (from statistics)
      const responseTimes = conversations
        .filter((c) => c.statistics?.time_to_admin_reply)
        .map((c) => c.statistics.time_to_admin_reply);
      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

      // Calculate average resolution time
      const resolutionTimes = conversations
        .filter((c) => c.statistics?.time_to_first_close)
        .map((c) => c.statistics.time_to_first_close);
      const avgResolutionTime = resolutionTimes.length > 0
        ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
        : 0;

      // Calculate repeat contact rate (conversations within 7 days of a previous one)
      let repeatContacts = 0;
      const sortedByDate = [...conversations].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      for (let i = 1; i < sortedByDate.length; i++) {
        const current = new Date(sortedByDate[i].created_at).getTime();
        const previous = new Date(sortedByDate[i - 1].created_at).getTime();
        if (current - previous < 7 * 24 * 60 * 60 * 1000) {
          repeatContacts++;
        }
      }
      const repeatContactRate = totalConversations > 1 ? repeatContacts / (totalConversations - 1) : 0;

      // Conversation volume over last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const volumeByDay = new Map<string, number>();
      conversations
        .filter((c) => new Date(c.created_at) >= thirtyDaysAgo)
        .forEach((c) => {
          const date = new Date(c.created_at).toISOString().split('T')[0];
          volumeByDay.set(date, (volumeByDay.get(date) || 0) + 1);
        });
      const conversationVolume = Array.from(volumeByDay.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Sentiment distribution
      const sentimentCounts = new Map<string, number>();
      conversations.forEach((c) => {
        const sentiment = c.sentiment || 'neutral';
        sentimentCounts.set(sentiment, (sentimentCounts.get(sentiment) || 0) + 1);
      });
      const sentimentDistribution = Array.from(sentimentCounts.entries())
        .map(([sentiment, count]) => ({ sentiment, count }))
        .sort((a, b) => b.count - a.count);

      // Top themes
      const themeCounts = new Map<string, number>();
      conversations.forEach((c) => {
        (c.themes || []).forEach((theme: string) => {
          themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
        });
      });
      const topThemes = Array.from(themeCounts.entries())
        .map(([theme, count]) => ({ theme, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalConversations,
        openConversations,
        closedConversations,
        avgResponseTime,
        avgResolutionTime,
        repeatContactRate,
        conversationVolume,
        sentimentDistribution,
        topThemes,
      };
    } catch (error) {
      console.error('[Intercom] Failed to calculate metrics:', error);
      return defaultMetrics;
    }
  }

  /**
   * Get conversations for a customer
   */
  async getCustomerConversations(
    customerId: string,
    options: {
      limit?: number;
      offset?: number;
      state?: 'open' | 'closed' | 'snoozed';
      sentiment?: 'positive' | 'neutral' | 'negative' | 'frustrated';
    } = {}
  ): Promise<{ conversations: unknown[]; total: number }> {
    const { limit = 20, offset = 0, state, sentiment } = options;

    if (!supabase) {
      return { conversations: [], total: 0 };
    }

    let query = supabase
      .from('intercom_conversations')
      .select('*', { count: 'exact' })
      .eq('customer_id', customerId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (state) {
      query = query.eq('state', state);
    }

    if (sentiment) {
      query = query.eq('sentiment', sentiment);
    }

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Failed to get conversations: ${error.message}`);
    }

    return { conversations: data || [], total: count || 0 };
  }

  /**
   * Get messages for a conversation
   */
  async getConversationMessages(conversationId: string): Promise<unknown[]> {
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('intercom_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get messages: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Save connection to database
   */
  async saveConnection(
    userId: string,
    connection: IntercomConnection,
    config?: Partial<SyncConfig>
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
          provider: 'intercom',
          access_token: connection.accessToken,
          token_type: connection.tokenType,
          app_id: connection.appId,
          workspace_id: connection.workspaceId,
          webhook_secret: webhookSecret,
          sync_schedule: config?.syncSchedule || 'hourly',
          sentiment_analysis_enabled: config?.sentimentAnalysisEnabled ?? true,
          theme_extraction_enabled: config?.themeExtractionEnabled ?? true,
          include_in_health_score: config?.includeInHealthScore ?? true,
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
  async getConnection(userId: string): Promise<(IntercomConnection & { id: string; config: Partial<SyncConfig> }) | null> {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'intercom')
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      accessToken: data.access_token,
      tokenType: data.token_type || 'Bearer',
      appId: data.app_id,
      workspaceId: data.workspace_id,
      config: {
        syncSchedule: data.sync_schedule,
        sentimentAnalysisEnabled: data.sentiment_analysis_enabled,
        themeExtractionEnabled: data.theme_extraction_enabled,
        includeInHealthScore: data.include_in_health_score,
      },
    };
  }

  /**
   * Disconnect Intercom integration
   */
  async disconnect(userId: string): Promise<void> {
    if (!supabase) return;

    await supabase.from('integration_connections').delete().eq('user_id', userId).eq('provider', 'intercom');
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
      .from('intercom_sync_log')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    return {
      connected: true,
      lastSyncAt: latestSync?.completed_at ? new Date(latestSync.completed_at) : undefined,
      lastSyncStatus: latestSync?.status,
      conversationsSynced: latestSync?.records_processed,
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
      .from('intercom_sync_log')
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
   * Handle Intercom webhook
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
      topic: string;
      data?: {
        item?: IntercomConversation;
      };
    };

    // Process based on topic
    switch (typedPayload.topic) {
      case 'conversation.user.created':
      case 'conversation.user.replied':
      case 'conversation.admin.replied':
      case 'conversation.admin.closed':
      case 'conversation.admin.opened':
        // Queue conversation for sync
        // In production, this would be queued for async processing
        return { processed: true, action: 'conversation_updated' };

      default:
        return { processed: false, action: 'unknown_topic' };
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
      .from('intercom_sync_log')
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

    await supabase.from('intercom_sync_log').update({
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
    return intercomCircuitBreaker.getStats();
  }

  /**
   * Map Intercom company to CSCX customer
   * Used for company matching during sync
   */
  async matchCompanyToCustomer(
    company: IntercomCompany
  ): Promise<string | null> {
    if (!supabase) return null;

    // Try matching by intercom_company_id
    const { data: byId } = await supabase
      .from('customers')
      .select('id')
      .eq('intercom_company_id', company.company_id)
      .single();

    if (byId) return byId.id;

    // Try matching by domain from website
    if (company.website) {
      try {
        const domain = new URL(company.website).hostname.replace('www.', '');
        const { data: byDomain } = await supabase
          .from('customers')
          .select('id')
          .eq('domain', domain)
          .single();

        if (byDomain) return byDomain.id;
      } catch {
        // Invalid URL, skip domain matching
      }
    }

    // Try matching by company name (fuzzy match would be better)
    const { data: byName } = await supabase
      .from('customers')
      .select('id')
      .ilike('name', company.name)
      .single();

    if (byName) return byName.id;

    return null;
  }
}

// Singleton instance
export const intercomService = new IntercomService();
export default intercomService;
