/**
 * DocuSign Contract Management Service - PRD-205
 *
 * Implements DocuSign integration for contract management:
 * - OAuth 2.0 authentication (Demo + Production)
 * - Envelope sync by customer
 * - Real-time webhook updates
 * - Document download
 * - Signature reminders
 * - Customer matching via email domain
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { CircuitBreaker } from '../circuitBreaker.js';
import { withRetry, retryStrategies } from '../retry.js';
import * as crypto from 'crypto';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Circuit breaker for DocuSign API calls
const docusignCircuitBreaker = new CircuitBreaker('docusign', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000 // 1 minute before retry
});

// ============================================
// Types
// ============================================

export interface DocuSignConnection {
  id?: string;
  accessToken: string;
  refreshToken: string;
  accountId: string;
  baseUri: string;
  tokenExpiresAt: Date;
  isDemo?: boolean;
}

export interface DocuSignEnvelope {
  envelopeId: string;
  status: EnvelopeStatus;
  subject: string;
  emailSubject?: string;
  emailBlurb?: string;
  sentDateTime?: string;
  completedDateTime?: string;
  voidedDateTime?: string;
  createdDateTime: string;
  statusChangedDateTime?: string;
  recipients?: DocuSignRecipient[];
  documents?: DocuSignDocument[];
  customFields?: Record<string, string>;
}

export type EnvelopeStatus =
  | 'created'
  | 'sent'
  | 'delivered'
  | 'signed'
  | 'completed'
  | 'declined'
  | 'voided';

export interface DocuSignRecipient {
  recipientId: string;
  recipientIdGuid: string;
  name: string;
  email: string;
  status: RecipientStatus;
  signedDateTime?: string;
  deliveredDateTime?: string;
  declinedDateTime?: string;
  routingOrder: number;
  recipientType: 'signer' | 'cc' | 'certifiedDelivery' | 'inPersonSigner';
}

export type RecipientStatus =
  | 'created'
  | 'sent'
  | 'delivered'
  | 'signed'
  | 'completed'
  | 'declined'
  | 'autoresponded';

export interface DocuSignDocument {
  documentId: string;
  name: string;
  fileExtension: string;
  uri: string;
  order: number;
}

export interface DocuSignWebhookEvent {
  event: string;
  apiVersion: string;
  uri: string;
  retryCount: number;
  configurationId: number;
  generatedDateTime: string;
  data: {
    accountId: string;
    userId: string;
    envelopeId: string;
    envelopeSummary?: DocuSignEnvelope;
  };
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
  syncSchedule: 'realtime' | 'hourly' | 'daily' | 'manual';
  matchByEmailDomain: boolean;
  matchByCustomField?: string;
  notifyOnComplete: boolean;
  notifyOnStalled: boolean;
  stalledThresholdDays: number;
}

export interface SyncStatus {
  connected: boolean;
  lastSyncAt?: Date;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  envelopesSynced?: number;
  syncErrors?: string[];
  nextScheduledSync?: Date;
}

export interface CustomerMatch {
  customerId: string;
  customerName: string;
  matchType: 'email_domain' | 'custom_field' | 'manual';
  confidence: number;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  syncSchedule: 'hourly',
  matchByEmailDomain: true,
  notifyOnComplete: true,
  notifyOnStalled: true,
  stalledThresholdDays: 3,
};

// ============================================
// DocuSign Service Class
// ============================================

export class DocuSignService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private apiVersion = 'v2.1';

  constructor() {
    this.clientId = process.env.DOCUSIGN_CLIENT_ID || '';
    this.clientSecret = process.env.DOCUSIGN_CLIENT_SECRET || '';
    this.redirectUri = process.env.DOCUSIGN_REDIRECT_URI || 'http://localhost:3001/api/integrations/docusign/callback';
  }

  /**
   * Check if DocuSign integration is configured
   */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Get OAuth base URL (Demo or Production)
   */
  private getOAuthBaseUrl(isDemo: boolean = false): string {
    return isDemo
      ? 'https://account-d.docusign.com'
      : 'https://account.docusign.com';
  }

  /**
   * Get API base URL
   */
  private getApiBaseUrl(isDemo: boolean = false): string {
    return isDemo
      ? 'https://demo.docusign.net/restapi'
      : 'https://www.docusign.net/restapi';
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthUrl(userId: string, isDemo: boolean = false): string {
    const baseUrl = this.getOAuthBaseUrl(isDemo);
    const state = JSON.stringify({ userId, isDemo });
    const encodedState = Buffer.from(state).toString('base64');

    const params = new URLSearchParams({
      response_type: 'code',
      scope: 'signature extended',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state: encodedState,
    });

    return `${baseUrl}/oauth/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async connect(code: string, isDemo: boolean = false): Promise<DocuSignConnection> {
    const baseUrl = this.getOAuthBaseUrl(isDemo);

    const response = await withRetry(
      async () => {
        return docusignCircuitBreaker.execute(async () => {
          const res = await fetch(`${baseUrl}/oauth/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code,
            }),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`DocuSign OAuth failed: ${error}`);
          }

          return res.json();
        });
      },
      {
        ...retryStrategies.aiService,
        maxRetries: 2,
        onRetry: (attempt, error) => {
          console.log(`[DocuSign] OAuth retry attempt ${attempt}: ${error.message}`);
        },
      }
    );

    // Get user info to get account ID
    const userInfo = await this.getUserInfo(response.access_token, isDemo);

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      accountId: userInfo.accounts[0].account_id,
      baseUri: userInfo.accounts[0].base_uri,
      tokenExpiresAt: new Date(Date.now() + response.expires_in * 1000),
      isDemo,
    };
  }

  /**
   * Get user info after OAuth
   */
  private async getUserInfo(accessToken: string, isDemo: boolean): Promise<{
    accounts: Array<{ account_id: string; base_uri: string; is_default: boolean }>;
  }> {
    const baseUrl = this.getOAuthBaseUrl(isDemo);

    const res = await fetch(`${baseUrl}/oauth/userinfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error('Failed to get user info');
    }

    return res.json();
  }

  /**
   * Refresh access token
   */
  async refreshToken(connection: DocuSignConnection): Promise<DocuSignConnection> {
    const baseUrl = this.getOAuthBaseUrl(connection.isDemo);

    const response = await withRetry(
      async () => {
        return docusignCircuitBreaker.execute(async () => {
          const res = await fetch(`${baseUrl}/oauth/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: connection.refreshToken,
            }),
          });

          if (!res.ok) {
            throw new Error('Failed to refresh DocuSign token');
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
      tokenExpiresAt: new Date(Date.now() + response.expires_in * 1000),
    };
  }

  /**
   * List envelopes with optional filters
   */
  async listEnvelopes(
    connection: DocuSignConnection,
    options: {
      fromDate?: string;
      toDate?: string;
      status?: string;
      searchText?: string;
      count?: number;
      startPosition?: number;
    } = {}
  ): Promise<{ envelopes: DocuSignEnvelope[]; resultSetSize: number; totalSetSize: number }> {
    const params = new URLSearchParams({
      from_date: options.fromDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      include: 'recipients,documents,custom_fields',
    });

    if (options.toDate) params.append('to_date', options.toDate);
    if (options.status) params.append('status', options.status);
    if (options.searchText) params.append('search_text', options.searchText);
    if (options.count) params.append('count', options.count.toString());
    if (options.startPosition) params.append('start_position', options.startPosition.toString());

    const url = `${connection.baseUri}/restapi/${this.apiVersion}/accounts/${connection.accountId}/envelopes?${params.toString()}`;

    const response = await withRetry(
      async () => {
        return docusignCircuitBreaker.execute(async () => {
          const res = await fetch(url, {
            headers: {
              Authorization: `Bearer ${connection.accessToken}`,
              'Content-Type': 'application/json',
            },
          });

          if (!res.ok) {
            const error = await res.text();
            if (res.status === 401) {
              throw new Error('TOKEN_EXPIRED');
            }
            throw new Error(`DocuSign API failed: ${error}`);
          }

          return res.json();
        });
      },
      {
        ...retryStrategies.aiService,
        retryableErrors: ['rate limit', 'timeout', '503', '429', 'ECONNRESET'],
      }
    );

    return {
      envelopes: response.envelopes || [],
      resultSetSize: parseInt(response.resultSetSize) || 0,
      totalSetSize: parseInt(response.totalSetSize) || 0,
    };
  }

  /**
   * Get envelope details
   */
  async getEnvelope(
    connection: DocuSignConnection,
    envelopeId: string
  ): Promise<DocuSignEnvelope> {
    const url = `${connection.baseUri}/restapi/${this.apiVersion}/accounts/${connection.accountId}/envelopes/${envelopeId}?include=recipients,documents,custom_fields`;

    const response = await withRetry(
      async () => {
        return docusignCircuitBreaker.execute(async () => {
          const res = await fetch(url, {
            headers: {
              Authorization: `Bearer ${connection.accessToken}`,
              'Content-Type': 'application/json',
            },
          });

          if (!res.ok) {
            throw new Error(`Failed to get envelope: ${await res.text()}`);
          }

          return res.json();
        });
      },
      retryStrategies.aiService
    );

    return response;
  }

  /**
   * Download document from envelope
   */
  async downloadDocument(
    connection: DocuSignConnection,
    envelopeId: string,
    documentId: string
  ): Promise<{ content: Buffer; contentType: string; fileName: string }> {
    const url = `${connection.baseUri}/restapi/${this.apiVersion}/accounts/${connection.accountId}/envelopes/${envelopeId}/documents/${documentId}`;

    const response = await docusignCircuitBreaker.execute(async () => {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to download document: ${await res.text()}`);
      }

      const contentType = res.headers.get('content-type') || 'application/pdf';
      const contentDisposition = res.headers.get('content-disposition') || '';
      const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      const fileName = fileNameMatch ? fileNameMatch[1] : `document_${documentId}.pdf`;

      const buffer = Buffer.from(await res.arrayBuffer());

      return { content: buffer, contentType, fileName };
    });

    return response;
  }

  /**
   * Send signature reminder
   */
  async sendReminder(
    connection: DocuSignConnection,
    envelopeId: string,
    recipientId?: string
  ): Promise<{ success: boolean; message: string }> {
    const url = `${connection.baseUri}/restapi/${this.apiVersion}/accounts/${connection.accountId}/envelopes/${envelopeId}`;

    const body: Record<string, unknown> = {
      status: 'sent', // Re-sending triggers a reminder
    };

    const response = await withRetry(
      async () => {
        return docusignCircuitBreaker.execute(async () => {
          const res = await fetch(url, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${connection.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`Failed to send reminder: ${error}`);
          }

          return res.json();
        });
      },
      retryStrategies.aiService
    );

    return { success: true, message: 'Reminder sent successfully' };
  }

  /**
   * Match envelope to customer by recipient email domain
   */
  async matchEnvelopeToCustomer(
    envelope: DocuSignEnvelope,
    config: SyncConfig
  ): Promise<CustomerMatch | null> {
    if (!supabase) return null;

    // Get recipient emails
    const recipientEmails = envelope.recipients
      ?.filter(r => r.recipientType === 'signer')
      ?.map(r => r.email) || [];

    if (recipientEmails.length === 0) return null;

    // Try matching by email domain
    if (config.matchByEmailDomain) {
      for (const email of recipientEmails) {
        const domain = email.split('@')[1]?.toLowerCase();
        if (!domain) continue;

        // Match against customer domain
        const { data: customers } = await supabase
          .from('customers')
          .select('id, name, domain')
          .or(`domain.ilike.%${domain}%,metadata->>email_domain.ilike.%${domain}%`)
          .limit(1);

        if (customers && customers.length > 0) {
          return {
            customerId: customers[0].id,
            customerName: customers[0].name,
            matchType: 'email_domain',
            confidence: 0.9,
          };
        }
      }
    }

    // Try matching by custom field
    if (config.matchByCustomField && envelope.customFields) {
      const customFieldValue = envelope.customFields[config.matchByCustomField];
      if (customFieldValue) {
        const { data: customers } = await supabase
          .from('customers')
          .select('id, name')
          .or(`external_id.eq.${customFieldValue},metadata->>salesforce_id.eq.${customFieldValue}`)
          .limit(1);

        if (customers && customers.length > 0) {
          return {
            customerId: customers[0].id,
            customerName: customers[0].name,
            matchType: 'custom_field',
            confidence: 1.0,
          };
        }
      }
    }

    return null;
  }

  /**
   * Sync envelopes from DocuSign
   */
  async syncEnvelopes(
    connection: DocuSignConnection,
    userId: string,
    options: {
      incremental?: boolean;
      lastSyncAt?: Date;
      syncConfig?: SyncConfig;
    } = {}
  ): Promise<SyncResult> {
    const { incremental = false, lastSyncAt, syncConfig = DEFAULT_SYNC_CONFIG } = options;

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
    const syncLog = await this.startSyncLog(userId, connection.id, 'envelopes', incremental ? 'incremental' : 'full');
    result.syncLogId = syncLog?.id;

    try {
      // Determine from_date
      const fromDate = incremental && lastSyncAt
        ? lastSyncAt.toISOString()
        : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      // List envelopes
      const { envelopes, totalSetSize } = await this.listEnvelopes(connection, {
        fromDate,
        status: 'any',
      });

      for (const envelope of envelopes) {
        try {
          // Try to match to customer
          const match = await this.matchEnvelopeToCustomer(envelope, syncConfig);

          // Check if envelope exists
          const { data: existing } = await supabase
            .from('docusign_envelopes')
            .select('id, status')
            .eq('envelope_id', envelope.envelopeId)
            .single();

          const envelopeData = {
            envelope_id: envelope.envelopeId,
            customer_id: match?.customerId || null,
            status: envelope.status,
            subject: envelope.emailSubject || envelope.subject || 'No Subject',
            documents: envelope.documents || [],
            recipients: envelope.recipients || [],
            sent_at: envelope.sentDateTime || null,
            completed_at: envelope.completedDateTime || null,
            voided_at: envelope.voidedDateTime || null,
            synced_at: new Date().toISOString(),
          };

          if (existing) {
            // Update existing
            await supabase
              .from('docusign_envelopes')
              .update(envelopeData)
              .eq('id', existing.id);

            // Track status change event
            if (existing.status !== envelope.status) {
              await this.recordEvent(envelope.envelopeId, 'status_changed', {
                old_status: existing.status,
                new_status: envelope.status,
              });
            }

            result.updated++;
          } else {
            // Create new
            await supabase
              .from('docusign_envelopes')
              .insert(envelopeData);

            // Track creation event
            await this.recordEvent(envelope.envelopeId, 'envelope_synced', {
              customer_id: match?.customerId,
              match_type: match?.matchType,
            });

            result.created++;
          }

          result.synced++;
        } catch (err) {
          result.errors.push(`Failed to sync envelope ${envelope.envelopeId}: ${(err as Error).message}`);
        }
      }

      // Complete sync log
      await this.completeSyncLog(syncLog?.id, result, 'completed');
    } catch (error) {
      result.errors.push(`Sync failed: ${(error as Error).message}`);
      await this.completeSyncLog(syncLog?.id, result, 'failed');
    }

    return result;
  }

  /**
   * Get envelopes for a customer
   */
  async getCustomerEnvelopes(
    customerId: string,
    options: {
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ envelopes: unknown[]; total: number }> {
    const { status, limit = 20, offset = 0 } = options;

    if (!supabase) {
      return { envelopes: [], total: 0 };
    }

    let query = supabase
      .from('docusign_envelopes')
      .select('*', { count: 'exact' })
      .eq('customer_id', customerId)
      .order('synced_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Failed to get envelopes: ${error.message}`);
    }

    return {
      envelopes: data || [],
      total: count || 0,
    };
  }

  /**
   * Process webhook event
   */
  async processWebhook(
    userId: string,
    event: DocuSignWebhookEvent
  ): Promise<{ processed: boolean; alerts: string[] }> {
    const alerts: string[] = [];

    if (!supabase) {
      return { processed: false, alerts };
    }

    try {
      const envelopeId = event.data.envelopeId;
      const envelopeSummary = event.data.envelopeSummary;

      // Get existing envelope
      const { data: existing } = await supabase
        .from('docusign_envelopes')
        .select('id, customer_id, status')
        .eq('envelope_id', envelopeId)
        .single();

      // Record event
      await this.recordEvent(envelopeId, event.event, {
        account_id: event.data.accountId,
        user_id: event.data.userId,
      });

      // Handle specific events
      switch (event.event) {
        case 'envelope-completed':
          if (existing?.customer_id) {
            alerts.push(`Contract completed for customer ${existing.customer_id}`);
          }
          break;

        case 'envelope-voided':
          if (existing?.customer_id) {
            alerts.push(`Contract voided for customer ${existing.customer_id}`);
          }
          break;

        case 'envelope-declined':
          if (existing?.customer_id) {
            alerts.push(`Contract declined for customer ${existing.customer_id}`);
          }
          break;

        case 'envelope-sent':
        case 'envelope-delivered':
        case 'recipient-signed':
          // Track status progression
          break;
      }

      // Update envelope status if we have summary
      if (envelopeSummary && existing) {
        await supabase
          .from('docusign_envelopes')
          .update({
            status: envelopeSummary.status,
            completed_at: envelopeSummary.completedDateTime || null,
            voided_at: envelopeSummary.voidedDateTime || null,
            recipients: envelopeSummary.recipients || [],
            synced_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      }

      return { processed: true, alerts };
    } catch (error) {
      console.error('[DocuSign] Webhook processing error:', error);
      return { processed: false, alerts };
    }
  }

  /**
   * Record an envelope event
   */
  private async recordEvent(
    envelopeId: string,
    eventType: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!supabase) return;

    await supabase.from('docusign_events').insert({
      envelope_id: envelopeId,
      event_type: eventType,
      metadata,
      occurred_at: new Date().toISOString(),
    });
  }

  /**
   * Save connection to database
   */
  async saveConnection(
    userId: string,
    connection: DocuSignConnection,
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
          provider: 'docusign',
          access_token: connection.accessToken,
          refresh_token: connection.refreshToken,
          account_id: connection.accountId,
          instance_url: connection.baseUri,
          token_expires_at: connection.tokenExpiresAt.toISOString(),
          is_sandbox: connection.isDemo || false,
          sync_schedule: config?.syncSchedule || DEFAULT_SYNC_CONFIG.syncSchedule,
          webhook_secret: webhookSecret,
          sync_enabled: true,
          metadata: {
            matchByEmailDomain: config?.matchByEmailDomain ?? DEFAULT_SYNC_CONFIG.matchByEmailDomain,
            matchByCustomField: config?.matchByCustomField,
            notifyOnComplete: config?.notifyOnComplete ?? DEFAULT_SYNC_CONFIG.notifyOnComplete,
            notifyOnStalled: config?.notifyOnStalled ?? DEFAULT_SYNC_CONFIG.notifyOnStalled,
            stalledThresholdDays: config?.stalledThresholdDays ?? DEFAULT_SYNC_CONFIG.stalledThresholdDays,
          },
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
  async getConnection(userId: string): Promise<(DocuSignConnection & { id: string; config: SyncConfig }) | null> {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'docusign')
      .single();

    if (error || !data) return null;

    // Check if token needs refresh
    const expiresAt = new Date(data.token_expires_at);
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

    let connection: DocuSignConnection = {
      id: data.id,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      accountId: data.account_id,
      baseUri: data.instance_url,
      tokenExpiresAt: expiresAt,
      isDemo: data.is_sandbox,
    };

    if (expiresAt.getTime() - Date.now() < bufferTime) {
      // Refresh the token
      connection = await this.refreshToken(connection);
      await this.saveConnection(userId, connection, data.metadata);
    }

    return {
      ...connection,
      id: data.id,
      config: {
        syncSchedule: data.sync_schedule || 'hourly',
        matchByEmailDomain: data.metadata?.matchByEmailDomain ?? true,
        matchByCustomField: data.metadata?.matchByCustomField,
        notifyOnComplete: data.metadata?.notifyOnComplete ?? true,
        notifyOnStalled: data.metadata?.notifyOnStalled ?? true,
        stalledThresholdDays: data.metadata?.stalledThresholdDays ?? 3,
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

    const { data: existing } = await supabase
      .from('integration_connections')
      .select('metadata')
      .eq('user_id', userId)
      .eq('provider', 'docusign')
      .single();

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (config.syncSchedule) updateData.sync_schedule = config.syncSchedule;

    updateData.metadata = {
      ...existing?.metadata,
      matchByEmailDomain: config.matchByEmailDomain,
      matchByCustomField: config.matchByCustomField,
      notifyOnComplete: config.notifyOnComplete,
      notifyOnStalled: config.notifyOnStalled,
      stalledThresholdDays: config.stalledThresholdDays,
    };

    const { error } = await supabase
      .from('integration_connections')
      .update(updateData)
      .eq('user_id', userId)
      .eq('provider', 'docusign');

    if (error) {
      throw new Error(`Failed to update config: ${error.message}`);
    }
  }

  /**
   * Disconnect DocuSign integration
   */
  async disconnect(userId: string): Promise<void> {
    if (!supabase) return;

    await supabase
      .from('integration_connections')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'docusign');
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
      .from('docusign_sync_log')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    return {
      connected: true,
      lastSyncAt: latestSync?.completed_at ? new Date(latestSync.completed_at) : undefined,
      lastSyncStatus: latestSync?.status,
      envelopesSynced: latestSync?.records_processed,
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
      .from('docusign_sync_log')
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
   * Get stalled contracts
   */
  async getStalledContracts(
    userId: string,
    thresholdDays: number = 3
  ): Promise<unknown[]> {
    if (!supabase) return [];

    const thresholdDate = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('docusign_envelopes')
      .select('*, customers!inner(name)')
      .in('status', ['sent', 'delivered'])
      .lt('sent_at', thresholdDate)
      .order('sent_at', { ascending: true });

    return data || [];
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
      .from('docusign_sync_log')
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
      .from('docusign_sync_log')
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
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return docusignCircuitBreaker.getStats();
  }
}

// Singleton instance
export const docusignService = new DocuSignService();
export default docusignService;
