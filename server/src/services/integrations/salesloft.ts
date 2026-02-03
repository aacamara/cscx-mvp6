/**
 * SalesLoft Cadence Integration Service - PRD-192
 *
 * Implements SalesLoft cadence automation for CSCX.AI:
 * - OAuth 2.0 authentication (FR-1)
 * - Cadence discovery and display (FR-2)
 * - People sync from stakeholders (FR-3)
 * - Cadence enrollment with approval flow (FR-4)
 * - Trigger automation mapping (FR-5)
 * - Activity sync back to CSCX.AI (FR-6)
 * - Cadence management (pause, skip, remove) (FR-7)
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

// Circuit breaker for SalesLoft API calls
const salesloftCircuitBreaker = new CircuitBreaker('salesloft', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000, // 1 minute before retry
});

// ============================================
// Types
// ============================================

export interface SalesloftConnection {
  id?: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  userId?: string;
}

export interface SalesloftCadence {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  team_cadence: boolean;
  shared: boolean;
  remove_bounces_enabled: boolean;
  remove_replies_enabled: boolean;
  opt_out_link_included: boolean;
  cadence_framework_id?: number;
  cadence_function?: string;
  external_identifier?: string;
  tags: string[];
  counts?: {
    cadence_people: number;
    target_daily_people: number;
    opportunities_created: number;
    meetings_booked: number;
  };
  current_state?: string;
  owner?: {
    id: number;
    name: string;
    email: string;
  };
  // CSCX computed fields
  step_count?: number;
  duration_days?: number;
  success_rate?: number;
}

export interface SalesloftCadenceStep {
  id: number;
  type: 'email' | 'phone' | 'other' | 'integration';
  step_number: number;
  day: number;
  name?: string;
  multitouch_enabled: boolean;
  cadence?: {
    id: number;
  };
}

export interface SalesloftPerson {
  id: number;
  first_name: string;
  last_name: string;
  display_name: string;
  email_address: string;
  secondary_email_address?: string;
  personal_email_address?: string;
  phone?: string;
  phone_extension?: string;
  mobile_phone?: string;
  home_phone?: string;
  title?: string;
  city?: string;
  state?: string;
  country?: string;
  work_city?: string;
  work_state?: string;
  work_country?: string;
  person_company_name?: string;
  person_company_website?: string;
  person_company_industry?: string;
  job_seniority?: string;
  do_not_contact: boolean;
  bouncing: boolean;
  locale?: string;
  eu_resident: boolean;
  personal_website?: string;
  twitter_handle?: string;
  linkedin_url?: string;
  created_at: string;
  updated_at: string;
  last_contacted_at?: string;
  last_replied_at?: string;
  account?: {
    id: number;
    name: string;
  };
  owner?: {
    id: number;
    name: string;
  };
  tags: string[];
  custom_fields?: Record<string, unknown>;
}

export interface SalesloftCadenceMembership {
  id: number;
  added_at: string;
  person_deleted: boolean;
  currently_on_cadence: boolean;
  current_state: 'active' | 'paused' | 'removed' | 'finished';
  current_step?: {
    id: number;
    type: string;
    day: number;
    step_number: number;
  };
  latest_action?: {
    id: number;
    type: string;
    action_type: string;
    created_at: string;
  };
  person?: SalesloftPerson;
  cadence?: {
    id: number;
    name: string;
  };
  counts?: {
    views: number;
    clicks: number;
    replies: number;
    bounces: number;
  };
}

export interface SalesloftActivity {
  id: number;
  type: 'email' | 'call' | 'meeting' | 'note' | 'task' | 'step';
  action_type?: string;
  action?: string;
  subject?: string;
  body?: string;
  created_at: string;
  updated_at: string;
  occurred_at?: string;
  person?: {
    id: number;
    email_address: string;
  };
  cadence?: {
    id: number;
    name: string;
  };
  cadence_step?: {
    id: number;
    step_number: number;
    type: string;
  };
  user?: {
    id: number;
    name: string;
    email: string;
  };
  counts?: {
    clicks?: number;
    views?: number;
    replies?: number;
  };
  status?: string;
  sentiment?: string;
  bounced?: boolean;
}

export interface TriggerMapping {
  id?: string;
  triggerType: 'new_customer' | 'renewal_window' | 'at_risk' | 'expansion_signal' | 'onboarding_stall' | 'churn_risk' | 'low_nps';
  cadenceId: number;
  cadenceName: string;
  stakeholderCriteria?: {
    roles?: string[];
    isPrimary?: boolean;
    minEngagementScore?: number;
  };
  segmentCriteria?: {
    healthScoreMin?: number;
    healthScoreMax?: number;
    segments?: string[];
    arrMin?: number;
    arrMax?: number;
  };
  enabled: boolean;
  requiresApproval: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  syncLogId?: string;
}

export interface EnrollmentResult {
  success: boolean;
  membershipId?: number;
  personId?: number;
  cadenceId?: number;
  error?: string;
  requiresApproval?: boolean;
  approvalId?: string;
}

export interface SyncConfig {
  syncSchedule: 'realtime' | 'hourly' | 'daily' | 'manual';
  activitySyncEnabled: boolean;
  activitySyncIntervalMinutes: number;
  autoEnrollmentEnabled: boolean;
  requireApprovalForEnrollment: boolean;
}

export interface SyncStatus {
  connected: boolean;
  lastSyncAt?: Date;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  cadencesSynced?: number;
  peopleSynced?: number;
  activitiesSynced?: number;
  syncErrors?: string[];
  nextScheduledSync?: Date;
}

// ============================================
// Default Trigger Mappings
// ============================================

const DEFAULT_TRIGGER_MAPPINGS: Partial<TriggerMapping>[] = [
  {
    triggerType: 'new_customer',
    enabled: false,
    requiresApproval: true,
    stakeholderCriteria: { isPrimary: true },
    segmentCriteria: {}
  },
  {
    triggerType: 'renewal_window',
    enabled: false,
    requiresApproval: true,
    stakeholderCriteria: { roles: ['executive_sponsor', 'decision_maker'] },
    segmentCriteria: {}
  },
  {
    triggerType: 'at_risk',
    enabled: false,
    requiresApproval: true,
    stakeholderCriteria: { isPrimary: true },
    segmentCriteria: { healthScoreMax: 50 }
  },
  {
    triggerType: 'expansion_signal',
    enabled: false,
    requiresApproval: true,
    stakeholderCriteria: { roles: ['executive_sponsor', 'economic_buyer'] },
    segmentCriteria: { healthScoreMin: 70 }
  },
];

// ============================================
// SalesLoft Service Class
// ============================================

export class SalesloftService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private baseUrl = 'https://api.salesloft.com/v2';

  constructor() {
    this.clientId = process.env.SALESLOFT_CLIENT_ID || '';
    this.clientSecret = process.env.SALESLOFT_CLIENT_SECRET || '';
    this.redirectUri =
      process.env.SALESLOFT_REDIRECT_URI ||
      'http://localhost:3001/api/integrations/salesloft/callback';
  }

  /**
   * Check if SalesLoft integration is configured
   */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Generate OAuth2 authorization URL (FR-1)
   */
  getAuthUrl(userId: string): string {
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state,
    });

    return `https://accounts.salesloft.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token (FR-1)
   */
  async connect(code: string): Promise<SalesloftConnection> {
    const response = await withRetry(
      async () => {
        return salesloftCircuitBreaker.execute(async () => {
          const res = await fetch('https://accounts.salesloft.com/oauth/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code,
              client_id: this.clientId,
              client_secret: this.clientSecret,
              redirect_uri: this.redirectUri,
            }),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`SalesLoft OAuth failed: ${error}`);
          }

          return res.json();
        });
      },
      {
        ...retryStrategies.aiService,
        maxRetries: 2,
        onRetry: (attempt, error) => {
          console.log(`[SalesLoft] OAuth retry attempt ${attempt}: ${error.message}`);
        },
      }
    );

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      tokenExpiresAt: new Date(Date.now() + (response.expires_in || 7200) * 1000),
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(connection: SalesloftConnection): Promise<SalesloftConnection> {
    const response = await withRetry(
      async () => {
        return salesloftCircuitBreaker.execute(async () => {
          const res = await fetch('https://accounts.salesloft.com/oauth/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: connection.refreshToken,
              client_id: this.clientId,
              client_secret: this.clientSecret,
            }),
          });

          if (!res.ok) {
            throw new Error('Failed to refresh SalesLoft token');
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
      tokenExpiresAt: new Date(Date.now() + (response.expires_in || 7200) * 1000),
    };
  }

  /**
   * Make authenticated API request to SalesLoft
   */
  private async apiRequest<T>(
    connection: SalesloftConnection,
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
        return salesloftCircuitBreaker.execute(async () => {
          const res = await fetch(url, {
            method,
            headers: {
              Authorization: `Bearer ${connection.accessToken}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            ...(body && { body: JSON.stringify(body) }),
          });

          if (!res.ok) {
            const error = await res.text();
            if (res.status === 401) {
              throw new Error('TOKEN_EXPIRED');
            }
            throw new Error(`SalesLoft API error: ${error}`);
          }

          // Handle 204 No Content
          if (res.status === 204) {
            return {} as T;
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

  // ============================================
  // Cadence Operations (FR-2)
  // ============================================

  /**
   * List available cadences
   */
  async listCadences(
    connection: SalesloftConnection,
    options: {
      page?: number;
      per_page?: number;
      include_paging_counts?: boolean;
      sort_by?: string;
      sort_direction?: 'asc' | 'desc';
      updated_at_gt?: string;
      team_cadence?: boolean;
    } = {}
  ): Promise<{ data: SalesloftCadence[]; metadata: { paging: { total_count: number; next_page?: number } } }> {
    const params: Record<string, string> = {};
    if (options.page) params.page = options.page.toString();
    if (options.per_page) params.per_page = options.per_page.toString();
    if (options.include_paging_counts) params.include_paging_counts = 'true';
    if (options.sort_by) params.sort_by = options.sort_by;
    if (options.sort_direction) params.sort_direction = options.sort_direction;
    if (options.updated_at_gt) params['updated_at[gt]'] = options.updated_at_gt;
    if (options.team_cadence !== undefined) params.team_cadence = options.team_cadence.toString();

    return this.apiRequest(connection, '/cadences', { params });
  }

  /**
   * Get a single cadence with details
   */
  async getCadence(
    connection: SalesloftConnection,
    cadenceId: number
  ): Promise<{ data: SalesloftCadence }> {
    return this.apiRequest(connection, `/cadences/${cadenceId}`);
  }

  /**
   * Get cadence steps
   */
  async getCadenceSteps(
    connection: SalesloftConnection,
    cadenceId: number
  ): Promise<{ data: SalesloftCadenceStep[] }> {
    return this.apiRequest(connection, '/steps', {
      params: { cadence_id: cadenceId.toString() },
    });
  }

  // ============================================
  // People Operations (FR-3)
  // ============================================

  /**
   * Create or update a person in SalesLoft
   */
  async upsertPerson(
    connection: SalesloftConnection,
    personData: {
      first_name: string;
      last_name: string;
      email_address: string;
      title?: string;
      phone?: string;
      mobile_phone?: string;
      city?: string;
      state?: string;
      country?: string;
      account_id?: number;
      custom_fields?: Record<string, unknown>;
    }
  ): Promise<{ data: SalesloftPerson }> {
    // First, try to find existing person by email
    const existingPerson = await this.findPersonByEmail(connection, personData.email_address);

    if (existingPerson) {
      // Update existing person
      return this.apiRequest(connection, `/people/${existingPerson.id}`, {
        method: 'PUT',
        body: personData,
      });
    }

    // Create new person
    return this.apiRequest(connection, '/people', {
      method: 'POST',
      body: personData,
    });
  }

  /**
   * Find a person by email
   */
  async findPersonByEmail(
    connection: SalesloftConnection,
    email: string
  ): Promise<SalesloftPerson | null> {
    try {
      const response = await this.apiRequest<{ data: SalesloftPerson[] }>(
        connection,
        '/people',
        { params: { email_addresses: email } }
      );

      return response.data.length > 0 ? response.data[0] : null;
    } catch {
      return null;
    }
  }

  /**
   * Get a person by ID
   */
  async getPerson(
    connection: SalesloftConnection,
    personId: number
  ): Promise<{ data: SalesloftPerson }> {
    return this.apiRequest(connection, `/people/${personId}`);
  }

  /**
   * List people
   */
  async listPeople(
    connection: SalesloftConnection,
    options: {
      page?: number;
      per_page?: number;
      account_id?: number;
    } = {}
  ): Promise<{ data: SalesloftPerson[]; metadata: { paging: { total_count: number } } }> {
    const params: Record<string, string> = {};
    if (options.page) params.page = options.page.toString();
    if (options.per_page) params.per_page = options.per_page.toString();
    if (options.account_id) params.account_id = options.account_id.toString();

    return this.apiRequest(connection, '/people', { params });
  }

  // ============================================
  // Cadence Membership Operations (FR-4, FR-7)
  // ============================================

  /**
   * Add a person to a cadence (FR-4)
   */
  async addPersonToCadence(
    connection: SalesloftConnection,
    personId: number,
    cadenceId: number,
    options: {
      user_id?: number;
      step_id?: number;
    } = {}
  ): Promise<{ data: SalesloftCadenceMembership }> {
    const body: Record<string, unknown> = {
      person_id: personId,
      cadence_id: cadenceId,
    };

    if (options.user_id) body.user_id = options.user_id;
    if (options.step_id) body.step_id = options.step_id;

    return this.apiRequest(connection, '/cadence_memberships', {
      method: 'POST',
      body,
    });
  }

  /**
   * Get cadence membership for a person
   */
  async getCadenceMembership(
    connection: SalesloftConnection,
    membershipId: number
  ): Promise<{ data: SalesloftCadenceMembership }> {
    return this.apiRequest(connection, `/cadence_memberships/${membershipId}`);
  }

  /**
   * List cadence memberships
   */
  async listCadenceMemberships(
    connection: SalesloftConnection,
    options: {
      person_id?: number;
      cadence_id?: number;
      currently_on_cadence?: boolean;
      page?: number;
      per_page?: number;
    } = {}
  ): Promise<{ data: SalesloftCadenceMembership[]; metadata: { paging: { total_count: number } } }> {
    const params: Record<string, string> = {};
    if (options.person_id) params.person_id = options.person_id.toString();
    if (options.cadence_id) params.cadence_id = options.cadence_id.toString();
    if (options.currently_on_cadence !== undefined) {
      params.currently_on_cadence = options.currently_on_cadence.toString();
    }
    if (options.page) params.page = options.page.toString();
    if (options.per_page) params.per_page = options.per_page.toString();

    return this.apiRequest(connection, '/cadence_memberships', { params });
  }

  /**
   * Pause a person in a cadence (FR-7)
   */
  async pauseCadenceMembership(
    connection: SalesloftConnection,
    membershipId: number
  ): Promise<{ data: SalesloftCadenceMembership }> {
    return this.apiRequest(connection, `/cadence_memberships/${membershipId}`, {
      method: 'PUT',
      body: { current_state: 'paused' },
    });
  }

  /**
   * Resume a paused cadence membership
   */
  async resumeCadenceMembership(
    connection: SalesloftConnection,
    membershipId: number
  ): Promise<{ data: SalesloftCadenceMembership }> {
    return this.apiRequest(connection, `/cadence_memberships/${membershipId}`, {
      method: 'PUT',
      body: { current_state: 'active' },
    });
  }

  /**
   * Remove a person from a cadence (FR-7)
   */
  async removeCadenceMembership(
    connection: SalesloftConnection,
    membershipId: number
  ): Promise<void> {
    await this.apiRequest(connection, `/cadence_memberships/${membershipId}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // Activity Operations (FR-6)
  // ============================================

  /**
   * Get activities for a person
   */
  async getPersonActivities(
    connection: SalesloftConnection,
    personId: number,
    options: {
      page?: number;
      per_page?: number;
      type?: string;
    } = {}
  ): Promise<{ data: SalesloftActivity[]; metadata: { paging: { total_count: number } } }> {
    const params: Record<string, string> = {
      person_id: personId.toString(),
    };
    if (options.page) params.page = options.page.toString();
    if (options.per_page) params.per_page = options.per_page.toString();
    if (options.type) params.type = options.type;

    return this.apiRequest(connection, '/activities', { params });
  }

  /**
   * Get email activities
   */
  async getEmailActivities(
    connection: SalesloftConnection,
    options: {
      person_id?: number;
      cadence_id?: number;
      updated_at_gt?: string;
      page?: number;
      per_page?: number;
    } = {}
  ): Promise<{ data: SalesloftActivity[] }> {
    const params: Record<string, string> = {};
    if (options.person_id) params.person_id = options.person_id.toString();
    if (options.cadence_id) params.cadence_id = options.cadence_id.toString();
    if (options.updated_at_gt) params['updated_at[gt]'] = options.updated_at_gt;
    if (options.page) params.page = options.page.toString();
    if (options.per_page) params.per_page = options.per_page.toString();

    return this.apiRequest(connection, '/activities/emails', { params });
  }

  // ============================================
  // Account Operations
  // ============================================

  /**
   * Find or create a SalesLoft account
   */
  async findOrCreateAccount(
    connection: SalesloftConnection,
    accountData: {
      name: string;
      domain?: string;
      website?: string;
      industry?: string;
    }
  ): Promise<{ data: { id: number; name: string } }> {
    // Try to find by domain first
    if (accountData.domain || accountData.website) {
      const domain = accountData.domain || new URL(accountData.website!).hostname;
      try {
        const response = await this.apiRequest<{ data: { id: number; name: string }[] }>(
          connection,
          '/accounts',
          { params: { domain } }
        );
        if (response.data.length > 0) {
          return { data: response.data[0] };
        }
      } catch {
        // Continue to create
      }
    }

    // Create new account
    return this.apiRequest(connection, '/accounts', {
      method: 'POST',
      body: accountData,
    });
  }

  // ============================================
  // CSCX.AI Integration Methods
  // ============================================

  /**
   * Sync stakeholder to SalesLoft person (FR-3)
   */
  async syncStakeholderToPerson(
    connection: SalesloftConnection,
    stakeholder: {
      id: string;
      name: string;
      email: string;
      title?: string;
      phone?: string;
      customer: {
        id: string;
        name: string;
        domain?: string;
      };
    }
  ): Promise<{ personId: number; created: boolean }> {
    // Parse name
    const nameParts = stakeholder.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Find or create account
    let accountId: number | undefined;
    if (stakeholder.customer.domain) {
      try {
        const account = await this.findOrCreateAccount(connection, {
          name: stakeholder.customer.name,
          domain: stakeholder.customer.domain,
        });
        accountId = account.data.id;
      } catch (err) {
        console.warn('[SalesLoft] Failed to create account:', err);
      }
    }

    // Upsert person
    const result = await this.upsertPerson(connection, {
      first_name: firstName,
      last_name: lastName,
      email_address: stakeholder.email,
      title: stakeholder.title,
      phone: stakeholder.phone,
      account_id: accountId,
      custom_fields: {
        cscx_stakeholder_id: stakeholder.id,
        cscx_customer_id: stakeholder.customer.id,
      },
    });

    // Store mapping in database
    if (supabase) {
      await supabase.from('salesloft_person_mappings').upsert({
        stakeholder_id: stakeholder.id,
        salesloft_person_id: result.data.id,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'stakeholder_id',
      });
    }

    const existingPerson = await this.findPersonByEmail(connection, stakeholder.email);
    return {
      personId: result.data.id,
      created: !existingPerson,
    };
  }

  /**
   * Enroll a stakeholder in a cadence with approval flow (FR-4)
   */
  async enrollStakeholderInCadence(
    connection: SalesloftConnection,
    userId: string,
    stakeholderId: string,
    cadenceId: number,
    options: {
      requireApproval?: boolean;
      triggerType?: string;
    } = {}
  ): Promise<EnrollmentResult> {
    const { requireApproval = true, triggerType } = options;

    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    try {
      // Get stakeholder with customer info
      const { data: stakeholder, error: stakeholderError } = await supabase
        .from('stakeholders')
        .select(`
          id,
          name,
          email,
          title,
          phone,
          customers!inner (
            id,
            name,
            domain
          )
        `)
        .eq('id', stakeholderId)
        .single();

      if (stakeholderError || !stakeholder) {
        return { success: false, error: 'Stakeholder not found' };
      }

      // Sync stakeholder to SalesLoft person
      const { personId } = await this.syncStakeholderToPerson(connection, {
        id: stakeholder.id,
        name: stakeholder.name,
        email: stakeholder.email,
        title: stakeholder.title,
        phone: stakeholder.phone,
        customer: stakeholder.customers as { id: string; name: string; domain?: string },
      });

      // If approval is required, create pending action
      if (requireApproval) {
        const { data: pendingAction, error: pendingError } = await supabase
          .from('pending_actions')
          .insert({
            user_id: userId,
            action_type: 'salesloft_cadence_enrollment',
            action_data: {
              stakeholderId,
              personId,
              cadenceId,
              triggerType,
            },
            status: 'pending',
            created_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (pendingError) {
          return { success: false, error: 'Failed to create approval request' };
        }

        return {
          success: true,
          requiresApproval: true,
          approvalId: pendingAction.id,
          personId,
          cadenceId,
        };
      }

      // Execute enrollment directly
      const membership = await this.addPersonToCadence(connection, personId, cadenceId);

      // Store membership in database
      await this.saveMembership(stakeholderId, membership.data, cadenceId);

      return {
        success: true,
        membershipId: membership.data.id,
        personId,
        cadenceId,
      };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
      };
    }
  }

  /**
   * Execute approved enrollment
   */
  async executeApprovedEnrollment(
    connection: SalesloftConnection,
    approvalId: string
  ): Promise<EnrollmentResult> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    // Get pending action
    const { data: pendingAction, error } = await supabase
      .from('pending_actions')
      .select('*')
      .eq('id', approvalId)
      .eq('action_type', 'salesloft_cadence_enrollment')
      .eq('status', 'pending')
      .single();

    if (error || !pendingAction) {
      return { success: false, error: 'Approval not found or already processed' };
    }

    const { personId, cadenceId, stakeholderId } = pendingAction.action_data;

    try {
      // Execute enrollment
      const membership = await this.addPersonToCadence(connection, personId, cadenceId);

      // Store membership
      await this.saveMembership(stakeholderId, membership.data, cadenceId);

      // Update pending action
      await supabase
        .from('pending_actions')
        .update({
          status: 'approved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', approvalId);

      return {
        success: true,
        membershipId: membership.data.id,
        personId,
        cadenceId,
      };
    } catch (err) {
      // Update pending action as failed
      await supabase
        .from('pending_actions')
        .update({
          status: 'failed',
          error_message: (err as Error).message,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', approvalId);

      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Save membership to database
   */
  private async saveMembership(
    stakeholderId: string,
    membership: SalesloftCadenceMembership,
    cadenceId: number
  ): Promise<void> {
    if (!supabase) return;

    await supabase.from('salesloft_memberships').upsert({
      stakeholder_id: stakeholderId,
      salesloft_person_id: membership.person?.id || membership.id,
      salesloft_membership_id: membership.id,
      cadence_id: cadenceId,
      cadence_name: membership.cadence?.name || '',
      status: membership.current_state,
      current_step: membership.current_step?.step_number,
      added_at: membership.added_at,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'salesloft_membership_id',
    });
  }

  /**
   * Sync activities back to CSCX.AI (FR-6)
   */
  async syncActivities(
    connection: SalesloftConnection,
    userId: string,
    options: {
      incremental?: boolean;
      lastSyncAt?: Date;
    } = {}
  ): Promise<SyncResult> {
    const { incremental = true, lastSyncAt } = options;

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

    const syncLog = await this.startSyncLog(userId, connection.id, 'activities', incremental ? 'incremental' : 'full');
    result.syncLogId = syncLog?.id;

    try {
      // Get all memberships we're tracking
      const { data: memberships } = await supabase
        .from('salesloft_memberships')
        .select('stakeholder_id, salesloft_person_id, cadence_id')
        .eq('status', 'active');

      if (!memberships || memberships.length === 0) {
        await this.completeSyncLog(syncLog?.id, result, 'completed');
        return result;
      }

      // Sync activities for each membership
      for (const membership of memberships) {
        try {
          const activities = await this.getPersonActivities(connection, membership.salesloft_person_id, {
            per_page: 50,
          });

          for (const activity of activities.data) {
            // Skip if not updated since last sync (for incremental)
            if (incremental && lastSyncAt) {
              const activityDate = new Date(activity.updated_at);
              if (activityDate <= lastSyncAt) {
                result.skipped++;
                continue;
              }
            }

            // Check if activity exists
            const { data: existing } = await supabase
              .from('salesloft_activities')
              .select('id')
              .eq('salesloft_activity_id', activity.id)
              .single();

            const activityData = {
              salesloft_activity_id: activity.id,
              stakeholder_id: membership.stakeholder_id,
              cadence_id: membership.cadence_id,
              activity_type: activity.type,
              action_type: activity.action_type,
              subject: activity.subject,
              occurred_at: activity.occurred_at || activity.created_at,
              status: activity.status,
              sentiment: activity.sentiment,
              bounced: activity.bounced,
              counts: activity.counts,
              updated_at: new Date().toISOString(),
            };

            if (existing) {
              await supabase
                .from('salesloft_activities')
                .update(activityData)
                .eq('id', existing.id);
              result.updated++;
            } else {
              await supabase
                .from('salesloft_activities')
                .insert({
                  ...activityData,
                  created_at: new Date().toISOString(),
                });
              result.created++;
            }

            result.synced++;
          }

          // Update membership status
          const membershipData = await this.listCadenceMemberships(connection, {
            person_id: membership.salesloft_person_id,
            cadence_id: membership.cadence_id,
          });

          if (membershipData.data.length > 0) {
            const currentMembership = membershipData.data[0];
            await supabase
              .from('salesloft_memberships')
              .update({
                status: currentMembership.current_state,
                current_step: currentMembership.current_step?.step_number,
                completed_at: currentMembership.current_state === 'finished'
                  ? new Date().toISOString()
                  : null,
                updated_at: new Date().toISOString(),
              })
              .eq('stakeholder_id', membership.stakeholder_id)
              .eq('cadence_id', membership.cadence_id);
          }
        } catch (err) {
          result.errors.push(`Failed to sync activities for person ${membership.salesloft_person_id}: ${(err as Error).message}`);
        }
      }

      await this.completeSyncLog(syncLog?.id, result, 'completed');
    } catch (error) {
      result.errors.push(`Sync failed: ${(error as Error).message}`);
      await this.completeSyncLog(syncLog?.id, result, 'failed');

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
   * Get cadence memberships for a stakeholder
   */
  async getStakeholderCadences(
    stakeholderId: string
  ): Promise<{
    memberships: Array<{
      id: string;
      cadenceId: number;
      cadenceName: string;
      status: string;
      currentStep: number | null;
      addedAt: string;
      completedAt: string | null;
    }>;
    activities: Array<{
      id: string;
      type: string;
      subject: string;
      occurredAt: string;
      status: string;
    }>;
  }> {
    if (!supabase) {
      return { memberships: [], activities: [] };
    }

    const { data: memberships } = await supabase
      .from('salesloft_memberships')
      .select('*')
      .eq('stakeholder_id', stakeholderId)
      .order('added_at', { ascending: false });

    const { data: activities } = await supabase
      .from('salesloft_activities')
      .select('*')
      .eq('stakeholder_id', stakeholderId)
      .order('occurred_at', { ascending: false })
      .limit(20);

    return {
      memberships: (memberships || []).map(m => ({
        id: m.id,
        cadenceId: m.cadence_id,
        cadenceName: m.cadence_name,
        status: m.status,
        currentStep: m.current_step,
        addedAt: m.added_at,
        completedAt: m.completed_at,
      })),
      activities: (activities || []).map(a => ({
        id: a.id,
        type: a.activity_type,
        subject: a.subject,
        occurredAt: a.occurred_at,
        status: a.status,
      })),
    };
  }

  // ============================================
  // Trigger Mapping Operations (FR-5)
  // ============================================

  /**
   * Get trigger mappings for a user
   */
  async getTriggerMappings(userId: string): Promise<TriggerMapping[]> {
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('salesloft_cadence_mappings')
      .select('*')
      .eq('user_id', userId)
      .order('trigger_type');

    if (error) {
      console.error('Failed to get trigger mappings:', error);
      return [];
    }

    return (data || []).map(m => ({
      id: m.id,
      triggerType: m.trigger_type,
      cadenceId: m.cadence_id,
      cadenceName: m.cadence_name,
      stakeholderCriteria: m.stakeholder_criteria,
      segmentCriteria: m.segment_criteria,
      enabled: m.enabled,
      requiresApproval: m.requires_approval ?? true,
      createdAt: new Date(m.created_at),
      updatedAt: m.updated_at ? new Date(m.updated_at) : undefined,
    }));
  }

  /**
   * Update trigger mappings
   */
  async updateTriggerMappings(
    userId: string,
    mappings: Array<{
      triggerType: TriggerMapping['triggerType'];
      cadenceId: number;
      cadenceName: string;
      stakeholderCriteria?: TriggerMapping['stakeholderCriteria'];
      segmentCriteria?: TriggerMapping['segmentCriteria'];
      enabled: boolean;
      requiresApproval?: boolean;
    }>
  ): Promise<void> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    // Upsert each mapping
    for (const mapping of mappings) {
      await supabase.from('salesloft_cadence_mappings').upsert({
        user_id: userId,
        trigger_type: mapping.triggerType,
        cadence_id: mapping.cadenceId,
        cadence_name: mapping.cadenceName,
        stakeholder_criteria: mapping.stakeholderCriteria || {},
        segment_criteria: mapping.segmentCriteria || {},
        enabled: mapping.enabled,
        requires_approval: mapping.requiresApproval ?? true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,trigger_type',
      });
    }
  }

  /**
   * Process a trigger event (FR-5)
   */
  async processTrigger(
    connection: SalesloftConnection,
    userId: string,
    triggerType: TriggerMapping['triggerType'],
    stakeholderId: string,
    customerId: string
  ): Promise<EnrollmentResult | null> {
    if (!supabase) {
      return null;
    }

    // Get mapping for this trigger
    const { data: mapping } = await supabase
      .from('salesloft_cadence_mappings')
      .select('*')
      .eq('user_id', userId)
      .eq('trigger_type', triggerType)
      .eq('enabled', true)
      .single();

    if (!mapping) {
      return null; // No enabled mapping for this trigger
    }

    // Validate stakeholder against criteria
    const { data: stakeholder } = await supabase
      .from('stakeholders')
      .select('*, customers!inner(*)')
      .eq('id', stakeholderId)
      .single();

    if (!stakeholder) {
      return null;
    }

    // Check stakeholder criteria
    const criteria = mapping.stakeholder_criteria || {};
    if (criteria.roles?.length && !criteria.roles.includes(stakeholder.role)) {
      return null;
    }
    if (criteria.isPrimary && !stakeholder.is_primary) {
      return null;
    }

    // Check segment criteria
    const segCriteria = mapping.segment_criteria || {};
    const customer = stakeholder.customers;
    if (segCriteria.healthScoreMin && customer.health_score < segCriteria.healthScoreMin) {
      return null;
    }
    if (segCriteria.healthScoreMax && customer.health_score > segCriteria.healthScoreMax) {
      return null;
    }

    // Enroll with approval if required
    return this.enrollStakeholderInCadence(
      connection,
      userId,
      stakeholderId,
      mapping.cadence_id,
      {
        requireApproval: mapping.requires_approval,
        triggerType,
      }
    );
  }

  // ============================================
  // Connection Management
  // ============================================

  /**
   * Save connection to database
   */
  async saveConnection(
    userId: string,
    connection: SalesloftConnection,
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
          provider: 'salesloft',
          access_token: connection.accessToken,
          refresh_token: connection.refreshToken,
          token_expires_at: connection.tokenExpiresAt.toISOString(),
          webhook_secret: webhookSecret,
          sync_schedule: config?.syncSchedule || 'hourly',
          activity_sync_enabled: config?.activitySyncEnabled ?? true,
          activity_sync_interval_minutes: config?.activitySyncIntervalMinutes || 30,
          auto_enrollment_enabled: config?.autoEnrollmentEnabled ?? false,
          require_approval: config?.requireApprovalForEnrollment ?? true,
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
  ): Promise<(SalesloftConnection & { id: string; config: Partial<SyncConfig> }) | null> {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'salesloft')
      .single();

    if (error || !data) return null;

    // Check if token needs refresh
    const expiresAt = new Date(data.token_expires_at);
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

    let connection: SalesloftConnection = {
      id: data.id,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt: expiresAt,
    };

    if (expiresAt.getTime() - Date.now() < bufferTime) {
      // Refresh the token
      try {
        connection = await this.refreshToken(connection);
        await this.saveConnection(userId, connection, {
          syncSchedule: data.sync_schedule,
          activitySyncEnabled: data.activity_sync_enabled,
          activitySyncIntervalMinutes: data.activity_sync_interval_minutes,
          autoEnrollmentEnabled: data.auto_enrollment_enabled,
          requireApprovalForEnrollment: data.require_approval,
        });
      } catch (err) {
        console.error('[SalesLoft] Token refresh failed:', err);
      }
    }

    return {
      ...connection,
      id: data.id,
      config: {
        syncSchedule: data.sync_schedule,
        activitySyncEnabled: data.activity_sync_enabled,
        activitySyncIntervalMinutes: data.activity_sync_interval_minutes,
        autoEnrollmentEnabled: data.auto_enrollment_enabled,
        requireApprovalForEnrollment: data.require_approval,
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
    if (config.activitySyncEnabled !== undefined) updateData.activity_sync_enabled = config.activitySyncEnabled;
    if (config.activitySyncIntervalMinutes) updateData.activity_sync_interval_minutes = config.activitySyncIntervalMinutes;
    if (config.autoEnrollmentEnabled !== undefined) updateData.auto_enrollment_enabled = config.autoEnrollmentEnabled;
    if (config.requireApprovalForEnrollment !== undefined) updateData.require_approval = config.requireApprovalForEnrollment;

    const { error } = await supabase
      .from('integration_connections')
      .update(updateData)
      .eq('user_id', userId)
      .eq('provider', 'salesloft');

    if (error) {
      throw new Error(`Failed to update config: ${error.message}`);
    }
  }

  /**
   * Disconnect SalesLoft integration
   */
  async disconnect(userId: string): Promise<void> {
    if (!supabase) return;

    await supabase.from('integration_connections').delete().eq('user_id', userId).eq('provider', 'salesloft');
    await supabase.from('salesloft_cadence_mappings').delete().eq('user_id', userId);
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
      .from('salesloft_sync_log')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    return {
      connected: true,
      lastSyncAt: latestSync?.completed_at ? new Date(latestSync.completed_at) : undefined,
      lastSyncStatus: latestSync?.status,
      activitiesSynced: latestSync?.records_processed,
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
      .from('salesloft_sync_log')
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
      .from('salesloft_sync_log')
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

    await supabase.from('salesloft_sync_log').update({
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
    return salesloftCircuitBreaker.getStats();
  }
}

// Singleton instance
export const salesloftService = new SalesloftService();
export default salesloftService;
