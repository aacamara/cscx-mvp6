/**
 * Calendly Scheduling Integration Service - PRD-208
 *
 * Implements Calendly scheduling integration:
 * - OAuth 2.0 authentication
 * - Event sync (bookings, cancellations, reschedules)
 * - Customer linking via invitee email
 * - Scheduling link generation
 * - Webhook event processing
 * - Engagement metrics calculation
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

// Circuit breaker for Calendly API calls
const calendlyCircuitBreaker = new CircuitBreaker('calendly', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000, // 1 minute before retry
});

// ============================================
// Types
// ============================================

export interface CalendlyConnection {
  id?: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  calendlyUserId: string;
  calendlyUserUri: string;
  organizationUri?: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  timezone?: string;
}

export interface CalendlyEvent {
  uri: string;
  name: string;
  status: 'active' | 'canceled';
  startTime: string;
  endTime: string;
  eventType: string;
  location?: CalendlyLocation;
  inviteesCounter: {
    total: number;
    active: number;
    limit: number;
  };
  createdAt: string;
  updatedAt: string;
  eventMemberships: Array<{
    user: string;
  }>;
  eventGuests?: Array<{
    email: string;
    name?: string;
  }>;
}

export interface CalendlyInvitee {
  uri: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  status: 'active' | 'canceled';
  timezone?: string;
  event: string;
  createdAt: string;
  updatedAt: string;
  cancelUrl?: string;
  rescheduleUrl?: string;
  questionsAndAnswers?: Array<{
    question: string;
    answer: string;
  }>;
  tracking?: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  };
}

export interface CalendlyEventType {
  uri: string;
  name: string;
  active: boolean;
  slug?: string;
  schedulingUrl: string;
  duration: number;
  kind: 'solo' | 'group';
  poolingType?: 'round_robin' | 'collective';
  type: 'StandardEventType' | 'AdhocEventType';
  color: string;
  description?: string;
  descriptionPlain?: string;
  secret?: boolean;
  profile?: {
    type: string;
    name: string;
    owner: string;
  };
}

export interface CalendlyLocation {
  type: 'physical' | 'outbound_call' | 'inbound_call' | 'custom' | 'google_conference' | 'zoom_conference' | 'microsoft_teams_conference';
  location?: string;
  additionalInfo?: string;
  joinUrl?: string;
  status?: 'initiated' | 'processing' | 'pushed' | 'failed';
  data?: Record<string, unknown>;
}

export interface CalendlyWebhookEvent {
  event: 'invitee.created' | 'invitee.canceled' | 'routing_form_submission.created';
  createdAt: string;
  createdBy: string;
  payload: {
    uri: string;
    email?: string;
    name?: string;
    event?: string;
    status?: string;
    cancelUrl?: string;
    rescheduleUrl?: string;
    invitee?: CalendlyInvitee;
    scheduledEvent?: CalendlyEvent;
    questionsAndAnswers?: Array<{
      question: string;
      answer: string;
    }>;
  };
}

export interface SchedulingLink {
  bookingUrl: string;
  owner: string;
  ownerType: 'EventType' | 'User';
  maxEventCount?: number;
}

export interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  syncLogId?: string;
}

export interface EngagementMetrics {
  customerId: string;
  customerName: string;
  totalBookings: number;
  completedMeetings: number;
  canceledMeetings: number;
  noShows: number;
  cancellationRate: number;
  averageMeetingsPerMonth: number;
  lastMeetingDate?: string;
  nextMeetingDate?: string;
  meetingFrequency: 'high' | 'medium' | 'low' | 'none';
  trend: 'increasing' | 'stable' | 'decreasing';
}

// ============================================
// Calendly Service Class
// ============================================

export class CalendlyService {
  private baseUrl = 'https://api.calendly.com';
  private oauthUrl = 'https://auth.calendly.com/oauth';

  constructor() {}

  /**
   * Check if Calendly integration is configured
   */
  isConfigured(): boolean {
    return Boolean(
      process.env.CALENDLY_CLIENT_ID &&
      process.env.CALENDLY_CLIENT_SECRET
    );
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const clientId = process.env.CALENDLY_CLIENT_ID;
    const redirectUri = process.env.CALENDLY_REDIRECT_URI ||
      `${config.frontendUrl}/api/integrations/calendly/callback`;

    const params = new URLSearchParams({
      client_id: clientId || '',
      response_type: 'code',
      redirect_uri: redirectUri,
      state,
    });

    return `${this.oauthUrl}/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    redirectUri?: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
    createdAt: number;
  }> {
    const clientId = process.env.CALENDLY_CLIENT_ID;
    const clientSecret = process.env.CALENDLY_CLIENT_SECRET;
    const redirect = redirectUri || process.env.CALENDLY_REDIRECT_URI ||
      `${config.frontendUrl}/api/integrations/calendly/callback`;

    const response = await fetch(`${this.oauthUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId || '',
        client_secret: clientSecret || '',
        code,
        redirect_uri: redirect,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || 'Failed to exchange code for tokens');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      createdAt: data.created_at,
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const clientId = process.env.CALENDLY_CLIENT_ID;
    const clientSecret = process.env.CALENDLY_CLIENT_SECRET;

    const response = await fetch(`${this.oauthUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId || '',
        client_secret: clientSecret || '',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || 'Failed to refresh token');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * Make authenticated request to Calendly API
   */
  private async calendlyRequest<T>(
    endpoint: string,
    accessToken: string,
    options: {
      method?: 'GET' | 'POST' | 'DELETE';
      body?: Record<string, unknown>;
      params?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, params } = options;

    return withRetry(
      async () => {
        return calendlyCircuitBreaker.execute(async () => {
          let url = `${this.baseUrl}${endpoint}`;

          if (params) {
            const searchParams = new URLSearchParams(params);
            url += `?${searchParams.toString()}`;
          }

          const fetchOptions: RequestInit = {
            method,
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          };

          if (body && (method === 'POST')) {
            fetchOptions.body = JSON.stringify(body);
          }

          const res = await fetch(url, fetchOptions);

          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || `Calendly API error: ${res.status}`);
          }

          return res.json();
        });
      },
      {
        ...retryStrategies.aiService,
        retryableErrors: ['rate limit', 'timeout', '503', '429', 'ECONNRESET'],
        onRetry: (attempt, error) => {
          console.log(`[Calendly] Retry attempt ${attempt}: ${error.message}`);
        },
      }
    );
  }

  /**
   * Get current user info from Calendly
   */
  async getCurrentUser(accessToken: string): Promise<{
    uri: string;
    email: string;
    name: string;
    schedulingUrl: string;
    timezone: string;
    avatarUrl?: string;
    currentOrganization?: string;
  }> {
    const response = await this.calendlyRequest<{ resource: any }>(
      '/users/me',
      accessToken
    );

    return {
      uri: response.resource.uri,
      email: response.resource.email,
      name: response.resource.name,
      schedulingUrl: response.resource.scheduling_url,
      timezone: response.resource.timezone,
      avatarUrl: response.resource.avatar_url,
      currentOrganization: response.resource.current_organization,
    };
  }

  /**
   * List scheduled events
   */
  async listScheduledEvents(
    accessToken: string,
    userUri: string,
    options: {
      status?: 'active' | 'canceled';
      minStartTime?: string;
      maxStartTime?: string;
      inviteeEmail?: string;
      count?: number;
      pageToken?: string;
    } = {}
  ): Promise<{
    collection: CalendlyEvent[];
    pagination: {
      count: number;
      nextPage?: string;
      previousPage?: string;
      nextPageToken?: string;
      previousPageToken?: string;
    };
  }> {
    const params: Record<string, string> = {
      user: userUri,
      count: String(options.count || 50),
    };

    if (options.status) params.status = options.status;
    if (options.minStartTime) params.min_start_time = options.minStartTime;
    if (options.maxStartTime) params.max_start_time = options.maxStartTime;
    if (options.inviteeEmail) params.invitee_email = options.inviteeEmail;
    if (options.pageToken) params.page_token = options.pageToken;

    const response = await this.calendlyRequest<{
      collection: any[];
      pagination: any;
    }>('/scheduled_events', accessToken, { params });

    return {
      collection: response.collection.map(this.mapScheduledEvent),
      pagination: response.pagination,
    };
  }

  /**
   * Get a single scheduled event
   */
  async getScheduledEvent(
    accessToken: string,
    eventUuid: string
  ): Promise<CalendlyEvent> {
    const response = await this.calendlyRequest<{ resource: any }>(
      `/scheduled_events/${eventUuid}`,
      accessToken
    );

    return this.mapScheduledEvent(response.resource);
  }

  /**
   * List event invitees
   */
  async listEventInvitees(
    accessToken: string,
    eventUuid: string,
    options: {
      status?: 'active' | 'canceled';
      count?: number;
      pageToken?: string;
    } = {}
  ): Promise<{
    collection: CalendlyInvitee[];
    pagination: any;
  }> {
    const params: Record<string, string> = {
      count: String(options.count || 50),
    };

    if (options.status) params.status = options.status;
    if (options.pageToken) params.page_token = options.pageToken;

    const response = await this.calendlyRequest<{
      collection: any[];
      pagination: any;
    }>(`/scheduled_events/${eventUuid}/invitees`, accessToken, { params });

    return {
      collection: response.collection.map(this.mapInvitee),
      pagination: response.pagination,
    };
  }

  /**
   * List event types
   */
  async listEventTypes(
    accessToken: string,
    userUri: string,
    options: {
      active?: boolean;
      count?: number;
      pageToken?: string;
    } = {}
  ): Promise<{
    collection: CalendlyEventType[];
    pagination: any;
  }> {
    const params: Record<string, string> = {
      user: userUri,
      count: String(options.count || 50),
    };

    if (options.active !== undefined) params.active = String(options.active);
    if (options.pageToken) params.page_token = options.pageToken;

    const response = await this.calendlyRequest<{
      collection: any[];
      pagination: any;
    }>('/event_types', accessToken, { params });

    return {
      collection: response.collection.map(this.mapEventType),
      pagination: response.pagination,
    };
  }

  /**
   * Create a single-use scheduling link
   */
  async createSchedulingLink(
    accessToken: string,
    eventTypeUri: string,
    maxEventCount: number = 1
  ): Promise<SchedulingLink> {
    const response = await this.calendlyRequest<{ resource: any }>(
      '/scheduling_links',
      accessToken,
      {
        method: 'POST',
        body: {
          max_event_count: maxEventCount,
          owner: eventTypeUri,
          owner_type: 'EventType',
        },
      }
    );

    return {
      bookingUrl: response.resource.booking_url,
      owner: response.resource.owner,
      ownerType: response.resource.owner_type,
      maxEventCount: response.resource.max_event_count,
    };
  }

  /**
   * Create a webhook subscription
   */
  async createWebhookSubscription(
    accessToken: string,
    organizationUri: string,
    callbackUrl: string,
    events: string[] = ['invitee.created', 'invitee.canceled'],
    scope: 'organization' | 'user' = 'organization',
    userUri?: string
  ): Promise<{
    uri: string;
    callbackUrl: string;
    state: string;
    events: string[];
    scope: string;
  }> {
    const body: Record<string, unknown> = {
      url: callbackUrl,
      events,
      organization: organizationUri,
      scope,
    };

    if (userUri) {
      body.user = userUri;
    }

    const response = await this.calendlyRequest<{ resource: any }>(
      '/webhook_subscriptions',
      accessToken,
      { method: 'POST', body }
    );

    return {
      uri: response.resource.uri,
      callbackUrl: response.resource.callback_url,
      state: response.resource.state,
      events: response.resource.events,
      scope: response.resource.scope,
    };
  }

  /**
   * Delete a webhook subscription
   */
  async deleteWebhookSubscription(
    accessToken: string,
    webhookUuid: string
  ): Promise<void> {
    await this.calendlyRequest(
      `/webhook_subscriptions/${webhookUuid}`,
      accessToken,
      { method: 'DELETE' }
    );
  }

  // ============================================
  // Database Operations
  // ============================================

  /**
   * Save Calendly connection to database
   */
  async saveConnection(connection: CalendlyConnection): Promise<string> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const { data, error } = await supabase
      .from('calendly_connections')
      .upsert({
        user_id: connection.userId,
        access_token: connection.accessToken,
        refresh_token: connection.refreshToken,
        token_expires_at: connection.tokenExpiresAt.toISOString(),
        calendly_user_id: connection.calendlyUserId,
        calendly_user_uri: connection.calendlyUserUri,
        organization_uri: connection.organizationUri,
        email: connection.email,
        name: connection.name,
        avatar_url: connection.avatarUrl,
        timezone: connection.timezone,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to save connection: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Get Calendly connection for a user
   */
  async getConnection(userId: string): Promise<CalendlyConnection | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('calendly_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt: new Date(data.token_expires_at),
      calendlyUserId: data.calendly_user_id,
      calendlyUserUri: data.calendly_user_uri,
      organizationUri: data.organization_uri,
      email: data.email,
      name: data.name,
      avatarUrl: data.avatar_url,
      timezone: data.timezone,
    };
  }

  /**
   * Get valid access token for a user (refreshes if needed)
   */
  async getValidAccessToken(userId: string): Promise<string> {
    const connection = await this.getConnection(userId);

    if (!connection) {
      throw new Error('No Calendly connection found. Please connect your account.');
    }

    // Check if token is expired or about to expire (5 min buffer)
    const now = new Date();
    const expiresAt = new Date(connection.tokenExpiresAt);
    const bufferMs = 5 * 60 * 1000; // 5 minutes

    if (now.getTime() + bufferMs >= expiresAt.getTime()) {
      // Token expired or expiring soon, refresh it
      try {
        const refreshed = await this.refreshAccessToken(connection.refreshToken);

        // Update tokens in database
        await this.updateTokens(
          userId,
          refreshed.accessToken,
          refreshed.refreshToken,
          new Date(Date.now() + refreshed.expiresIn * 1000)
        );

        return refreshed.accessToken;
      } catch (error) {
        // Mark connection as invalid
        await this.markConnectionInvalid(userId, (error as Error).message);
        throw new Error('Failed to refresh Calendly token. Please reconnect.');
      }
    }

    return connection.accessToken;
  }

  /**
   * Update tokens in database
   */
  private async updateTokens(
    userId: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: Date
  ): Promise<void> {
    if (!supabase) return;

    await supabase
      .from('calendly_connections')
      .update({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  }

  /**
   * Mark connection as invalid
   */
  private async markConnectionInvalid(userId: string, errorMessage: string): Promise<void> {
    if (!supabase) return;

    await supabase
      .from('calendly_connections')
      .update({
        is_active: false,
        last_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  }

  /**
   * Disconnect Calendly integration
   */
  async disconnect(userId: string): Promise<void> {
    if (!supabase) return;

    await supabase
      .from('calendly_connections')
      .delete()
      .eq('user_id', userId);
  }

  /**
   * Check if user has Calendly connected
   */
  async isConnected(userId: string): Promise<boolean> {
    const connection = await this.getConnection(userId);
    return connection !== null;
  }

  /**
   * Get connection status with details
   */
  async getConnectionStatus(userId: string): Promise<{
    connected: boolean;
    email?: string;
    name?: string;
    schedulingUrl?: string;
    lastSyncAt?: string;
  }> {
    if (!supabase) return { connected: false };

    const { data } = await supabase
      .from('calendly_connections')
      .select('*, calendly_sync_log(completed_at)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!data) {
      return { connected: false };
    }

    return {
      connected: true,
      email: data.email,
      name: data.name,
      schedulingUrl: data.calendly_user_uri ?
        `https://calendly.com/${data.calendly_user_id}` : undefined,
      lastSyncAt: data.calendly_sync_log?.[0]?.completed_at,
    };
  }

  // ============================================
  // Event Sync Operations
  // ============================================

  /**
   * Sync Calendly events to database
   */
  async syncEvents(
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
    } = {}
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

    const connection = await this.getConnection(userId);
    if (!connection) {
      result.errors.push('Calendly not connected');
      return result;
    }

    const syncLog = await this.startSyncLog(userId, 'events');
    result.syncLogId = syncLog?.id;

    try {
      const accessToken = await this.getValidAccessToken(userId);
      const startDate = options.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
      const endDate = options.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead

      let pageToken: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const { collection: events, pagination } = await this.listScheduledEvents(
          accessToken,
          connection.calendlyUserUri,
          {
            minStartTime: startDate.toISOString(),
            maxStartTime: endDate.toISOString(),
            count: 50,
            pageToken,
          }
        );

        for (const event of events) {
          try {
            // Get invitees for this event
            const eventUuid = this.extractUuidFromUri(event.uri);
            const { collection: invitees } = await this.listEventInvitees(
              accessToken,
              eventUuid
            );

            // Find matching customer by email domain
            const invitee = invitees[0];
            let customerId: string | null = null;
            let stakeholderId: string | null = null;

            if (invitee?.email) {
              const match = await this.matchInviteeToCustomer(invitee.email);
              customerId = match.customerId;
              stakeholderId = match.stakeholderId;
            }

            // Save event to database
            const eventData = {
              calendly_event_id: eventUuid,
              calendly_event_uri: event.uri,
              user_id: userId,
              customer_id: customerId,
              stakeholder_id: stakeholderId,
              event_type: event.eventType,
              event_name: event.name,
              invitee_email: invitee?.email,
              invitee_name: invitee?.name,
              start_time: event.startTime,
              end_time: event.endTime,
              status: event.status,
              location: event.location ? JSON.stringify(event.location) : null,
              cancel_url: invitee?.cancelUrl,
              reschedule_url: invitee?.rescheduleUrl,
              updated_at: new Date().toISOString(),
            };

            const { data: existing } = await supabase
              .from('calendly_events')
              .select('id')
              .eq('calendly_event_id', eventUuid)
              .single();

            if (existing) {
              await supabase
                .from('calendly_events')
                .update(eventData)
                .eq('id', existing.id);
              result.updated++;
            } else {
              await supabase
                .from('calendly_events')
                .insert({
                  ...eventData,
                  created_at: new Date().toISOString(),
                });
              result.created++;
            }

            result.synced++;
          } catch (err) {
            result.errors.push(`Failed to sync event ${event.uri}: ${(err as Error).message}`);
          }
        }

        pageToken = pagination.nextPageToken;
        hasMore = !!pageToken;
      }

      await this.completeSyncLog(syncLog?.id, result, 'completed');
    } catch (error) {
      result.errors.push(`Sync failed: ${(error as Error).message}`);
      await this.completeSyncLog(syncLog?.id, result, 'failed');
    }

    return result;
  }

  /**
   * Match invitee email to customer in database
   */
  private async matchInviteeToCustomer(email: string): Promise<{
    customerId: string | null;
    stakeholderId: string | null;
  }> {
    if (!supabase) return { customerId: null, stakeholderId: null };

    // First try to match stakeholder by email
    const { data: stakeholder } = await supabase
      .from('stakeholders')
      .select('id, customer_id')
      .eq('email', email)
      .single();

    if (stakeholder) {
      return {
        customerId: stakeholder.customer_id,
        stakeholderId: stakeholder.id,
      };
    }

    // Try to match by email domain
    const domain = email.split('@')[1];
    if (domain) {
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .ilike('name', `%${domain.split('.')[0]}%`)
        .limit(1)
        .single();

      if (customer) {
        return { customerId: customer.id, stakeholderId: null };
      }
    }

    return { customerId: null, stakeholderId: null };
  }

  // ============================================
  // Webhook Processing
  // ============================================

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    webhookSecret: string
  ): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  /**
   * Process webhook event
   */
  async processWebhook(
    userId: string,
    event: CalendlyWebhookEvent
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    try {
      // Log the webhook event
      await supabase.from('calendly_webhook_events').insert({
        user_id: userId,
        event_type: event.event,
        event_uri: event.payload.uri,
        payload: event.payload,
        created_at: event.createdAt,
        processed: false,
      });

      switch (event.event) {
        case 'invitee.created':
          await this.handleInviteeCreated(userId, event.payload);
          break;

        case 'invitee.canceled':
          await this.handleInviteeCanceled(userId, event.payload);
          break;

        default:
          console.log('Unhandled Calendly webhook event:', event.event);
      }

      // Mark as processed
      await supabase
        .from('calendly_webhook_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('event_uri', event.payload.uri);

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Handle invitee.created webhook
   */
  private async handleInviteeCreated(
    userId: string,
    payload: CalendlyWebhookEvent['payload']
  ): Promise<void> {
    if (!supabase || !payload.scheduledEvent) return;

    const event = payload.scheduledEvent;
    const invitee = payload.invitee || {
      email: payload.email,
      name: payload.name,
      uri: payload.uri,
    };

    // Match invitee to customer
    const match = await this.matchInviteeToCustomer(invitee.email || '');

    const eventUuid = this.extractUuidFromUri(event.uri);

    await supabase.from('calendly_events').upsert({
      calendly_event_id: eventUuid,
      calendly_event_uri: event.uri,
      user_id: userId,
      customer_id: match.customerId,
      stakeholder_id: match.stakeholderId,
      event_type: event.eventType,
      event_name: event.name,
      invitee_email: invitee.email,
      invitee_name: invitee.name,
      start_time: event.startTime,
      end_time: event.endTime,
      status: 'active',
      location: event.location ? JSON.stringify(event.location) : null,
      cancel_url: payload.cancelUrl,
      reschedule_url: payload.rescheduleUrl,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'calendly_event_id',
    });

    // Create activity record if customer matched
    if (match.customerId) {
      await supabase.from('activities').insert({
        customer_id: match.customerId,
        type: 'calendly_booking',
        title: `Calendly booking: ${event.name}`,
        description: `Meeting scheduled with ${invitee.name || invitee.email} for ${new Date(event.startTime).toLocaleString()}`,
        metadata: {
          calendly_event_id: eventUuid,
          invitee_email: invitee.email,
          start_time: event.startTime,
        },
        created_at: new Date().toISOString(),
      });
    }
  }

  /**
   * Handle invitee.canceled webhook
   */
  private async handleInviteeCanceled(
    userId: string,
    payload: CalendlyWebhookEvent['payload']
  ): Promise<void> {
    if (!supabase) return;

    // Extract event UUID from invitee URI
    const eventUri = payload.event;
    if (!eventUri) return;

    const eventUuid = this.extractUuidFromUri(eventUri);

    // Update event status
    const { data: existing } = await supabase
      .from('calendly_events')
      .select('id, customer_id')
      .eq('calendly_event_id', eventUuid)
      .single();

    if (existing) {
      await supabase
        .from('calendly_events')
        .update({
          status: 'canceled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      // Create activity record if customer matched
      if (existing.customer_id) {
        await supabase.from('activities').insert({
          customer_id: existing.customer_id,
          type: 'calendly_cancellation',
          title: 'Calendly meeting canceled',
          description: `Meeting with ${payload.name || payload.email} was canceled`,
          metadata: {
            calendly_event_id: eventUuid,
            invitee_email: payload.email,
          },
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  // ============================================
  // Customer-Specific Operations
  // ============================================

  /**
   * Get Calendly events for a customer
   */
  async getCustomerEvents(
    customerId: string,
    options: {
      status?: 'active' | 'canceled';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    events: Array<{
      id: string;
      eventName: string;
      inviteeEmail: string;
      inviteeName?: string;
      startTime: string;
      endTime: string;
      status: string;
      cancelUrl?: string;
      rescheduleUrl?: string;
    }>;
    total: number;
  }> {
    if (!supabase) return { events: [], total: 0 };

    const { limit = 20, offset = 0 } = options;

    let query = supabase
      .from('calendly_events')
      .select('*', { count: 'exact' })
      .eq('customer_id', customerId)
      .order('start_time', { ascending: false })
      .range(offset, offset + limit - 1);

    if (options.status) {
      query = query.eq('status', options.status);
    }

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Failed to get customer events: ${error.message}`);
    }

    return {
      events: (data || []).map((e) => ({
        id: e.id,
        eventName: e.event_name,
        inviteeEmail: e.invitee_email,
        inviteeName: e.invitee_name,
        startTime: e.start_time,
        endTime: e.end_time,
        status: e.status,
        cancelUrl: e.cancel_url,
        rescheduleUrl: e.reschedule_url,
      })),
      total: count || 0,
    };
  }

  /**
   * Get engagement metrics for a customer
   */
  async getCustomerMetrics(customerId: string): Promise<EngagementMetrics | null> {
    if (!supabase) return null;

    // Get customer name
    const { data: customer } = await supabase
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .single();

    if (!customer) return null;

    // Get all events for this customer
    const { data: events } = await supabase
      .from('calendly_events')
      .select('start_time, end_time, status')
      .eq('customer_id', customerId);

    if (!events || events.length === 0) {
      return {
        customerId,
        customerName: customer.name,
        totalBookings: 0,
        completedMeetings: 0,
        canceledMeetings: 0,
        noShows: 0,
        cancellationRate: 0,
        averageMeetingsPerMonth: 0,
        meetingFrequency: 'none',
        trend: 'stable',
      };
    }

    const now = new Date();
    const totalBookings = events.length;
    const canceledMeetings = events.filter((e) => e.status === 'canceled').length;
    const activeMeetings = events.filter((e) => e.status === 'active');
    const pastMeetings = activeMeetings.filter((e) => new Date(e.start_time) < now);
    const futureMeetings = activeMeetings.filter((e) => new Date(e.start_time) >= now);

    // Calculate date range
    const sortedEvents = [...events].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    const firstEvent = sortedEvents[0];
    const lastEvent = sortedEvents[sortedEvents.length - 1];

    const firstDate = new Date(firstEvent.start_time);
    const lastDate = new Date(lastEvent.start_time);
    const monthsSpan = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
    const averageMeetingsPerMonth = totalBookings / monthsSpan;

    // Determine meeting frequency
    let meetingFrequency: EngagementMetrics['meetingFrequency'];
    if (averageMeetingsPerMonth >= 4) {
      meetingFrequency = 'high';
    } else if (averageMeetingsPerMonth >= 1) {
      meetingFrequency = 'medium';
    } else if (totalBookings > 0) {
      meetingFrequency = 'low';
    } else {
      meetingFrequency = 'none';
    }

    // Calculate trend (compare last 3 months to previous 3 months)
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    const recentMeetings = events.filter((e) => new Date(e.start_time) >= threeMonthsAgo);
    const previousMeetings = events.filter(
      (e) => new Date(e.start_time) >= sixMonthsAgo && new Date(e.start_time) < threeMonthsAgo
    );

    let trend: EngagementMetrics['trend'];
    if (recentMeetings.length > previousMeetings.length * 1.2) {
      trend = 'increasing';
    } else if (recentMeetings.length < previousMeetings.length * 0.8) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    return {
      customerId,
      customerName: customer.name,
      totalBookings,
      completedMeetings: pastMeetings.length,
      canceledMeetings,
      noShows: 0, // Would need additional tracking
      cancellationRate: totalBookings > 0 ? (canceledMeetings / totalBookings) * 100 : 0,
      averageMeetingsPerMonth: Math.round(averageMeetingsPerMonth * 10) / 10,
      lastMeetingDate: pastMeetings.length > 0 ?
        pastMeetings.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())[0].start_time :
        undefined,
      nextMeetingDate: futureMeetings.length > 0 ?
        futureMeetings.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0].start_time :
        undefined,
      meetingFrequency,
      trend,
    };
  }

  /**
   * Generate one-time scheduling link for a customer
   */
  async generateSchedulingLink(
    userId: string,
    customerId: string,
    eventTypeUri: string
  ): Promise<{
    bookingUrl: string;
    linkId: string;
  }> {
    const accessToken = await this.getValidAccessToken(userId);
    const link = await this.createSchedulingLink(accessToken, eventTypeUri, 1);

    if (!supabase) {
      return { bookingUrl: link.bookingUrl, linkId: '' };
    }

    // Save link to database
    const { data } = await supabase
      .from('calendly_links')
      .insert({
        user_id: userId,
        customer_id: customerId,
        booking_url: link.bookingUrl,
        event_type: eventTypeUri,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    return {
      bookingUrl: link.bookingUrl,
      linkId: data?.id || '',
    };
  }

  /**
   * Mark scheduling link as used
   */
  async markLinkUsed(linkId: string): Promise<void> {
    if (!supabase) return;

    await supabase
      .from('calendly_links')
      .update({ used_at: new Date().toISOString() })
      .eq('id', linkId);
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Extract UUID from Calendly URI
   */
  private extractUuidFromUri(uri: string): string {
    const parts = uri.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Map raw scheduled event to typed event
   */
  private mapScheduledEvent(raw: any): CalendlyEvent {
    return {
      uri: raw.uri,
      name: raw.name,
      status: raw.status,
      startTime: raw.start_time,
      endTime: raw.end_time,
      eventType: raw.event_type,
      location: raw.location,
      inviteesCounter: raw.invitees_counter,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      eventMemberships: raw.event_memberships,
      eventGuests: raw.event_guests,
    };
  }

  /**
   * Map raw invitee to typed invitee
   */
  private mapInvitee(raw: any): CalendlyInvitee {
    return {
      uri: raw.uri,
      email: raw.email,
      name: raw.name,
      firstName: raw.first_name,
      lastName: raw.last_name,
      status: raw.status,
      timezone: raw.timezone,
      event: raw.event,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      cancelUrl: raw.cancel_url,
      rescheduleUrl: raw.reschedule_url,
      questionsAndAnswers: raw.questions_and_answers,
      tracking: raw.tracking,
    };
  }

  /**
   * Map raw event type to typed event type
   */
  private mapEventType(raw: any): CalendlyEventType {
    return {
      uri: raw.uri,
      name: raw.name,
      active: raw.active,
      slug: raw.slug,
      schedulingUrl: raw.scheduling_url,
      duration: raw.duration,
      kind: raw.kind,
      poolingType: raw.pooling_type,
      type: raw.type,
      color: raw.color,
      description: raw.description_html,
      descriptionPlain: raw.description_plain,
      secret: raw.secret,
      profile: raw.profile,
    };
  }

  /**
   * Start sync log
   */
  private async startSyncLog(userId: string, objectType: string): Promise<{ id: string } | null> {
    if (!supabase) return null;

    const { data } = await supabase
      .from('calendly_sync_log')
      .insert({
        user_id: userId,
        object_type: objectType,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    return data;
  }

  /**
   * Complete sync log
   */
  private async completeSyncLog(
    syncLogId: string | undefined,
    result: SyncResult,
    status: 'completed' | 'failed'
  ): Promise<void> {
    if (!supabase || !syncLogId) return;

    await supabase.from('calendly_sync_log').update({
      status,
      records_synced: result.synced,
      records_created: result.created,
      records_updated: result.updated,
      records_skipped: result.skipped,
      errors: result.errors,
      completed_at: new Date().toISOString(),
    }).eq('id', syncLogId);
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return calendlyCircuitBreaker.getStats();
  }
}

// Singleton instance
export const calendlyService = new CalendlyService();
export default calendlyService;
