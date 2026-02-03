/**
 * Zendesk Integration Service - PRD-184
 *
 * Implements Zendesk ticket integration:
 * - OAuth 2.0 and API token authentication
 * - Ticket data sync (Zendesk -> CSCX.AI)
 * - Customer matching via organization/email domain
 * - Support metrics calculation
 * - Health score integration
 * - Alert triggers for escalations
 * - Webhook support for real-time updates
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

// Circuit breaker for Zendesk API calls
const zendeskCircuitBreaker = new CircuitBreaker('zendesk', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000, // 1 minute before retry
});

// ============================================
// Types
// ============================================

export interface ZendeskConnection {
  id?: string;
  subdomain: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  authType: 'oauth' | 'api_token';
  email?: string; // Required for API token auth
}

export interface ZendeskTicket {
  id: number;
  url: string;
  subject: string;
  description: string;
  status: 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed';
  priority: 'urgent' | 'high' | 'normal' | 'low' | null;
  type: 'problem' | 'incident' | 'question' | 'task' | null;
  organization_id: number | null;
  requester_id: number;
  assignee_id: number | null;
  group_id: number | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  solved_at: string | null;
  satisfaction_rating?: {
    score: 'good' | 'bad' | 'offered' | 'unoffered';
    comment: string | null;
  };
  custom_fields?: Array<{ id: number; value: string | null }>;
  via?: {
    channel: string;
    source: {
      from: { name?: string; address?: string };
      to: { name?: string; address?: string };
    };
  };
}

export interface ZendeskOrganization {
  id: number;
  name: string;
  domain_names: string[];
  external_id: string | null;
  tags: string[];
}

export interface ZendeskUser {
  id: number;
  email: string;
  name: string;
  organization_id: number | null;
}

export interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  syncLogId?: string;
}

export interface CustomerMapping {
  type: 'organization_id' | 'email_domain' | 'custom_field';
  zendeskField: string;
  cscxField: string;
}

export interface SyncConfig {
  syncSchedule: 'realtime' | 'hourly' | 'daily' | 'manual';
  customerMappings: CustomerMapping[];
  syncOpenOnly: boolean;
  includePrivateComments: boolean;
  healthScoreWeight: number; // 0-100, weight in health score calculation
}

export interface SupportMetrics {
  customerId: string;
  metricDate: Date;
  openTickets: number;
  pendingTickets: number;
  escalations: number;
  avgResolutionHours: number | null;
  csatScore: number | null;
  csatResponses: number;
  ticketVolume7d: number;
  ticketVolume30d: number;
  slaBreaches: number;
}

export interface SyncStatus {
  connected: boolean;
  lastSyncAt?: Date;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  recordsSynced?: number;
  syncErrors?: string[];
  nextScheduledSync?: Date;
}

export interface AlertConfig {
  escalationAlert: boolean;
  slaBreachAlert: boolean;
  ticketSpikeThreshold: number; // Alert if > N tickets in 24 hours
  negativeCsatAlert: boolean;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CUSTOMER_MAPPINGS: CustomerMapping[] = [
  { type: 'organization_id', zendeskField: 'organization_id', cscxField: 'zendesk_org_id' },
  { type: 'email_domain', zendeskField: 'domain_names', cscxField: 'domain' },
];

const DEFAULT_ALERT_CONFIG: AlertConfig = {
  escalationAlert: true,
  slaBreachAlert: true,
  ticketSpikeThreshold: 3,
  negativeCsatAlert: true,
};

// ============================================
// Zendesk Service Class
// ============================================

export class ZendeskService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.ZENDESK_CLIENT_ID || '';
    this.clientSecret = process.env.ZENDESK_CLIENT_SECRET || '';
    this.redirectUri =
      process.env.ZENDESK_REDIRECT_URI || 'http://localhost:3001/api/integrations/zendesk/callback';
  }

  /**
   * Check if Zendesk OAuth integration is configured
   */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthUrl(userId: string, subdomain: string): string {
    const state = JSON.stringify({ userId, subdomain });
    const encodedState = Buffer.from(state).toString('base64');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'read write',
      state: encodedState,
    });

    return `https://${subdomain}.zendesk.com/oauth/authorizations/new?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async connect(code: string, subdomain: string): Promise<ZendeskConnection> {
    const response = await withRetry(
      async () => {
        return zendeskCircuitBreaker.execute(async () => {
          const res = await fetch(`https://${subdomain}.zendesk.com/oauth/tokens`, {
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
              scope: 'read write',
            }),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`Zendesk OAuth failed: ${error}`);
          }

          return res.json();
        });
      },
      {
        ...retryStrategies.aiService,
        maxRetries: 2,
        onRetry: (attempt, error) => {
          console.log(`[Zendesk] OAuth retry attempt ${attempt}: ${error.message}`);
        },
      }
    );

    return {
      subdomain,
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      tokenExpiresAt: response.expires_in
        ? new Date(Date.now() + response.expires_in * 1000)
        : undefined,
      authType: 'oauth',
    };
  }

  /**
   * Connect using API token (alternative to OAuth)
   */
  async connectWithApiToken(
    subdomain: string,
    email: string,
    apiToken: string
  ): Promise<ZendeskConnection> {
    // Verify credentials by making a test request
    const credentials = Buffer.from(`${email}/token:${apiToken}`).toString('base64');

    const response = await withRetry(
      async () => {
        return zendeskCircuitBreaker.execute(async () => {
          const res = await fetch(`https://${subdomain}.zendesk.com/api/v2/users/me.json`, {
            headers: {
              Authorization: `Basic ${credentials}`,
              'Content-Type': 'application/json',
            },
          });

          if (!res.ok) {
            throw new Error('Invalid Zendesk API credentials');
          }

          return res.json();
        });
      },
      { ...retryStrategies.aiService, maxRetries: 2 }
    );

    return {
      subdomain,
      accessToken: apiToken,
      email,
      authType: 'api_token',
    };
  }

  /**
   * Get authorization header based on auth type
   */
  private getAuthHeader(connection: ZendeskConnection): string {
    if (connection.authType === 'api_token' && connection.email) {
      const credentials = Buffer.from(`${connection.email}/token:${connection.accessToken}`).toString(
        'base64'
      );
      return `Basic ${credentials}`;
    }
    return `Bearer ${connection.accessToken}`;
  }

  /**
   * Make authenticated API request to Zendesk
   */
  async apiRequest<T>(
    connection: ZendeskConnection,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `https://${connection.subdomain}.zendesk.com/api/v2${endpoint}`;

    const response = await withRetry(
      async () => {
        return zendeskCircuitBreaker.execute(async () => {
          const res = await fetch(url, {
            ...options,
            headers: {
              Authorization: this.getAuthHeader(connection),
              'Content-Type': 'application/json',
              ...options.headers,
            },
          });

          if (!res.ok) {
            const error = await res.text();
            if (res.status === 401) {
              throw new Error('TOKEN_EXPIRED');
            }
            if (res.status === 429) {
              // Rate limited - get retry-after header
              const retryAfter = res.headers.get('Retry-After');
              throw new Error(`RATE_LIMITED:${retryAfter || 60}`);
            }
            throw new Error(`Zendesk API error: ${error}`);
          }

          return res.json();
        });
      },
      {
        ...retryStrategies.aiService,
        retryableErrors: ['rate limit', 'timeout', '503', '429', 'ECONNRESET', 'RATE_LIMITED'],
      }
    );

    return response;
  }

  /**
   * Get tickets by organization
   */
  async getTicketsByOrganization(
    connection: ZendeskConnection,
    organizationId: number,
    options: { status?: string; page?: number } = {}
  ): Promise<{ tickets: ZendeskTicket[]; next_page: string | null; count: number }> {
    let endpoint = `/organizations/${organizationId}/tickets.json?sort_by=updated_at&sort_order=desc`;

    if (options.status) {
      endpoint += `&status=${options.status}`;
    }
    if (options.page) {
      endpoint += `&page=${options.page}`;
    }

    return this.apiRequest(connection, endpoint);
  }

  /**
   * Get all tickets using incremental export (for full sync)
   */
  async getIncrementalTickets(
    connection: ZendeskConnection,
    startTime: number
  ): Promise<{ tickets: ZendeskTicket[]; end_time: number; end_of_stream: boolean }> {
    return this.apiRequest(connection, `/incremental/tickets.json?start_time=${startTime}`);
  }

  /**
   * Get organization by ID
   */
  async getOrganization(
    connection: ZendeskConnection,
    organizationId: number
  ): Promise<{ organization: ZendeskOrganization }> {
    return this.apiRequest(connection, `/organizations/${organizationId}.json`);
  }

  /**
   * Search organizations by domain
   */
  async searchOrganizationsByDomain(
    connection: ZendeskConnection,
    domain: string
  ): Promise<{ organizations: ZendeskOrganization[] }> {
    return this.apiRequest(
      connection,
      `/organizations/search.json?external_id=${encodeURIComponent(domain)}`
    );
  }

  /**
   * Get user by ID
   */
  async getUser(connection: ZendeskConnection, userId: number): Promise<{ user: ZendeskUser }> {
    return this.apiRequest(connection, `/users/${userId}.json`);
  }

  /**
   * Get satisfaction ratings for tickets
   */
  async getSatisfactionRatings(
    connection: ZendeskConnection,
    options: { score?: 'good' | 'bad'; page?: number } = {}
  ): Promise<{ satisfaction_ratings: Array<{ id: number; score: string; ticket_id: number }> }> {
    let endpoint = '/satisfaction_ratings.json?';

    if (options.score) {
      endpoint += `score=${options.score}&`;
    }
    if (options.page) {
      endpoint += `page=${options.page}`;
    }

    return this.apiRequest(connection, endpoint);
  }

  /**
   * Sync tickets from Zendesk to CSCX
   */
  async syncTickets(
    connection: ZendeskConnection,
    userId: string,
    options: {
      incremental?: boolean;
      lastSyncAt?: Date;
      customerMappings?: CustomerMapping[];
    } = {}
  ): Promise<SyncResult> {
    const { incremental = false, lastSyncAt, customerMappings = DEFAULT_CUSTOMER_MAPPINGS } = options;

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

    // Start sync log
    const syncLog = await this.startSyncLog(
      userId,
      connection.id,
      'tickets',
      incremental ? 'incremental' : 'full'
    );
    result.syncLogId = syncLog?.id;

    try {
      // Get customer mappings for matching tickets to CSCX customers
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name, zendesk_org_id, domain, email_domains');

      const customerMap = new Map<string, string>();
      const domainMap = new Map<string, string>();

      customers?.forEach((c) => {
        if (c.zendesk_org_id) {
          customerMap.set(c.zendesk_org_id.toString(), c.id);
        }
        if (c.domain) {
          domainMap.set(c.domain.toLowerCase(), c.id);
        }
        if (c.email_domains) {
          c.email_domains.forEach((d: string) => domainMap.set(d.toLowerCase(), c.id));
        }
      });

      // Determine start time for sync
      const startTime = incremental && lastSyncAt
        ? Math.floor(lastSyncAt.getTime() / 1000)
        : Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000); // Default: 30 days ago

      // Use incremental export API
      let endOfStream = false;
      let currentStartTime = startTime;

      while (!endOfStream) {
        const response = await this.getIncrementalTickets(connection, currentStartTime);

        for (const ticket of response.tickets) {
          try {
            // Try to match ticket to a CSCX customer
            let customerId: string | undefined;

            // 1. Try organization ID mapping
            if (ticket.organization_id) {
              customerId = customerMap.get(ticket.organization_id.toString());
            }

            // 2. Try email domain mapping if no org match
            if (!customerId && ticket.via?.source?.from?.address) {
              const emailDomain = ticket.via.source.from.address.split('@')[1]?.toLowerCase();
              if (emailDomain) {
                customerId = domainMap.get(emailDomain);
              }
            }

            // Skip tickets without customer match (but log them)
            if (!customerId) {
              result.skipped++;
              continue;
            }

            // Check if ticket already exists
            const { data: existing } = await supabase
              .from('zendesk_tickets')
              .select('id, updated_at')
              .eq('zendesk_ticket_id', ticket.id)
              .single();

            const ticketData = {
              zendesk_ticket_id: ticket.id,
              customer_id: customerId,
              subject: ticket.subject,
              description: ticket.description?.substring(0, 10000), // Truncate long descriptions
              status: ticket.status,
              priority: ticket.priority,
              requester_email: ticket.via?.source?.from?.address,
              assignee_name: null, // Would need additional API call to get name
              tags: ticket.tags,
              satisfaction_rating: ticket.satisfaction_rating?.score || null,
              zendesk_created_at: ticket.created_at,
              zendesk_updated_at: ticket.updated_at,
              resolved_at: ticket.solved_at,
              organization_id: ticket.organization_id,
            };

            if (existing) {
              // Update existing ticket
              await supabase.from('zendesk_tickets').update(ticketData).eq('id', existing.id);
              result.updated++;
            } else {
              // Create new ticket
              await supabase.from('zendesk_tickets').insert(ticketData);
              result.created++;
            }

            result.synced++;
          } catch (err) {
            result.errors.push(`Failed to sync ticket ${ticket.id}: ${(err as Error).message}`);
          }
        }

        endOfStream = response.end_of_stream;
        currentStartTime = response.end_time;

        // Add a small delay to avoid rate limiting
        if (!endOfStream) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Calculate and update metrics for affected customers
      await this.recalculateMetrics(userId, Array.from(new Set(customers?.map((c) => c.id) || [])));

      // Complete sync log
      await this.completeSyncLog(syncLog?.id, result, 'completed');
    } catch (error) {
      result.errors.push(`Sync failed: ${(error as Error).message}`);
      await this.completeSyncLog(syncLog?.id, result, 'failed');
    }

    return result;
  }

  /**
   * Recalculate support metrics for specified customers
   */
  async recalculateMetrics(userId: string, customerIds: string[]): Promise<void> {
    if (!supabase || customerIds.length === 0) return;

    const today = new Date().toISOString().split('T')[0];

    for (const customerId of customerIds) {
      try {
        // Get ticket statistics for this customer
        const { data: tickets } = await supabase
          .from('zendesk_tickets')
          .select('*')
          .eq('customer_id', customerId);

        if (!tickets || tickets.length === 0) continue;

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Calculate metrics
        const openTickets = tickets.filter((t) =>
          ['new', 'open', 'pending', 'hold'].includes(t.status)
        ).length;
        const pendingTickets = tickets.filter((t) => t.status === 'pending').length;
        const escalations = tickets.filter(
          (t) => t.priority === 'urgent' || t.priority === 'high'
        ).length;

        // Calculate average resolution time
        const resolvedTickets = tickets.filter((t) => t.resolved_at);
        let avgResolutionHours: number | null = null;
        if (resolvedTickets.length > 0) {
          const totalHours = resolvedTickets.reduce((sum, t) => {
            const created = new Date(t.zendesk_created_at);
            const resolved = new Date(t.resolved_at);
            return sum + (resolved.getTime() - created.getTime()) / (1000 * 60 * 60);
          }, 0);
          avgResolutionHours = Math.round((totalHours / resolvedTickets.length) * 10) / 10;
        }

        // Calculate CSAT
        const ratedTickets = tickets.filter((t) => t.satisfaction_rating);
        let csatScore: number | null = null;
        if (ratedTickets.length > 0) {
          const goodRatings = ratedTickets.filter((t) => t.satisfaction_rating === 'good').length;
          csatScore = Math.round((goodRatings / ratedTickets.length) * 100);
        }

        // Count tickets in time windows
        const ticketVolume7d = tickets.filter(
          (t) => new Date(t.zendesk_created_at) >= sevenDaysAgo
        ).length;
        const ticketVolume30d = tickets.filter(
          (t) => new Date(t.zendesk_created_at) >= thirtyDaysAgo
        ).length;

        // Upsert metrics
        await supabase.from('zendesk_metrics').upsert(
          {
            customer_id: customerId,
            metric_date: today,
            open_tickets: openTickets,
            pending_tickets: pendingTickets,
            escalations,
            avg_resolution_hours: avgResolutionHours,
            csat_score: csatScore,
            csat_responses: ratedTickets.length,
            ticket_volume_7d: ticketVolume7d,
            ticket_volume_30d: ticketVolume30d,
            sla_breaches: 0, // Would need SLA data from Zendesk to calculate
          },
          {
            onConflict: 'customer_id,metric_date',
          }
        );
      } catch (error) {
        console.error(`Failed to recalculate metrics for customer ${customerId}:`, error);
      }
    }
  }

  /**
   * Get tickets for a specific customer
   */
  async getCustomerTickets(
    customerId: string,
    options: { status?: string; limit?: number; offset?: number } = {}
  ): Promise<{ tickets: unknown[]; total: number }> {
    if (!supabase) {
      return { tickets: [], total: 0 };
    }

    const { limit = 20, offset = 0, status } = options;

    let query = supabase
      .from('zendesk_tickets')
      .select('*', { count: 'exact' })
      .eq('customer_id', customerId)
      .order('zendesk_updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Failed to get tickets: ${error.message}`);
    }

    return { tickets: data || [], total: count || 0 };
  }

  /**
   * Get support metrics for a customer
   */
  async getCustomerMetrics(
    customerId: string,
    options: { days?: number } = {}
  ): Promise<SupportMetrics[]> {
    if (!supabase) {
      return [];
    }

    const { days = 30 } = options;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const { data, error } = await supabase
      .from('zendesk_metrics')
      .select('*')
      .eq('customer_id', customerId)
      .gte('metric_date', startDate)
      .order('metric_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to get metrics: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Process webhook from Zendesk
   */
  async processWebhook(
    userId: string,
    payload: {
      ticket?: ZendeskTicket;
      event?: string;
    }
  ): Promise<{ processed: boolean; alerts: string[] }> {
    const alerts: string[] = [];

    if (!supabase || !payload.ticket) {
      return { processed: false, alerts };
    }

    try {
      const ticket = payload.ticket;

      // Find the customer for this ticket
      let customerId: string | undefined;

      if (ticket.organization_id) {
        const { data } = await supabase
          .from('customers')
          .select('id')
          .eq('zendesk_org_id', ticket.organization_id)
          .single();
        customerId = data?.id;
      }

      if (!customerId) {
        return { processed: false, alerts };
      }

      // Upsert the ticket
      await supabase.from('zendesk_tickets').upsert(
        {
          zendesk_ticket_id: ticket.id,
          customer_id: customerId,
          subject: ticket.subject,
          description: ticket.description?.substring(0, 10000),
          status: ticket.status,
          priority: ticket.priority,
          requester_email: ticket.via?.source?.from?.address,
          tags: ticket.tags,
          satisfaction_rating: ticket.satisfaction_rating?.score || null,
          zendesk_created_at: ticket.created_at,
          zendesk_updated_at: ticket.updated_at,
          resolved_at: ticket.solved_at,
          organization_id: ticket.organization_id,
        },
        {
          onConflict: 'zendesk_ticket_id',
        }
      );

      // Check for alert conditions
      const connection = await this.getConnection(userId);
      const alertConfig: AlertConfig = connection?.config?.alertConfig || DEFAULT_ALERT_CONFIG;

      // Escalation alert
      if (alertConfig.escalationAlert && (ticket.priority === 'urgent' || ticket.priority === 'high')) {
        alerts.push(`escalation:${customerId}:${ticket.id}`);
      }

      // Negative CSAT alert
      if (alertConfig.negativeCsatAlert && ticket.satisfaction_rating?.score === 'bad') {
        alerts.push(`negative_csat:${customerId}:${ticket.id}`);
      }

      // Check for ticket spike
      if (alertConfig.ticketSpikeThreshold > 0) {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from('zendesk_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('customer_id', customerId)
          .gte('zendesk_created_at', yesterday);

        if (count && count >= alertConfig.ticketSpikeThreshold) {
          alerts.push(`ticket_spike:${customerId}:${count}`);
        }
      }

      // Recalculate metrics
      await this.recalculateMetrics(userId, [customerId]);

      return { processed: true, alerts };
    } catch (error) {
      console.error('Webhook processing error:', error);
      return { processed: false, alerts };
    }
  }

  /**
   * Save connection to database
   */
  async saveConnection(
    userId: string,
    connection: ZendeskConnection,
    config?: Partial<SyncConfig & { alertConfig: AlertConfig }>
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
          provider: 'zendesk',
          subdomain: connection.subdomain,
          access_token: connection.accessToken,
          refresh_token: connection.refreshToken || null,
          token_expires_at: connection.tokenExpiresAt?.toISOString() || null,
          auth_type: connection.authType,
          email: connection.email || null,
          customer_mappings: config?.customerMappings || DEFAULT_CUSTOMER_MAPPINGS,
          sync_schedule: config?.syncSchedule || 'hourly',
          sync_open_only: config?.syncOpenOnly ?? false,
          health_score_weight: config?.healthScoreWeight ?? 15,
          alert_config: config?.alertConfig || DEFAULT_ALERT_CONFIG,
          webhook_secret: webhookSecret,
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
  async getConnection(
    userId: string
  ): Promise<(ZendeskConnection & { id: string; config: Partial<SyncConfig & { alertConfig: AlertConfig }> }) | null> {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'zendesk')
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      subdomain: data.subdomain,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt: data.token_expires_at ? new Date(data.token_expires_at) : undefined,
      authType: data.auth_type || 'api_token',
      email: data.email,
      config: {
        customerMappings: data.customer_mappings,
        syncSchedule: data.sync_schedule,
        syncOpenOnly: data.sync_open_only,
        healthScoreWeight: data.health_score_weight,
        alertConfig: data.alert_config,
      },
    };
  }

  /**
   * Update customer mapping configuration
   */
  async updateMapping(userId: string, customerId: string, zendeskOrgId: number): Promise<void> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    await supabase.from('customers').update({ zendesk_org_id: zendeskOrgId }).eq('id', customerId);
  }

  /**
   * Update sync configuration
   */
  async updateSyncConfig(
    userId: string,
    config: Partial<SyncConfig & { alertConfig: AlertConfig }>
  ): Promise<void> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (config.syncSchedule) updateData.sync_schedule = config.syncSchedule;
    if (config.customerMappings) updateData.customer_mappings = config.customerMappings;
    if (config.syncOpenOnly !== undefined) updateData.sync_open_only = config.syncOpenOnly;
    if (config.healthScoreWeight !== undefined) updateData.health_score_weight = config.healthScoreWeight;
    if (config.alertConfig) updateData.alert_config = config.alertConfig;

    const { error } = await supabase
      .from('integration_connections')
      .update(updateData)
      .eq('user_id', userId)
      .eq('provider', 'zendesk');

    if (error) {
      throw new Error(`Failed to update config: ${error.message}`);
    }
  }

  /**
   * Disconnect Zendesk integration
   */
  async disconnect(userId: string): Promise<void> {
    if (!supabase) return;

    await supabase.from('integration_connections').delete().eq('user_id', userId).eq('provider', 'zendesk');
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
      .from('zendesk_sync_log')
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

    if (!supabase) {
      return { logs: [], total: 0 };
    }

    const { data, count, error } = await supabase
      .from('zendesk_sync_log')
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
      .from('zendesk_sync_log')
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

    await supabase
      .from('zendesk_sync_log')
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
   * Validate webhook signature
   */
  validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('base64');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return zendeskCircuitBreaker.getStats();
  }
}

// Singleton instance
export const zendeskService = new ZendeskService();
export default zendeskService;
