/**
 * PandaDoc Integration Service - PRD-206
 *
 * Implements PandaDoc document management integration:
 * - OAuth 2.0 authentication
 * - Document sync by customer
 * - Status tracking (sent, viewed, completed, paid)
 * - Webhook processing for real-time updates
 * - Document creation from templates
 * - Analytics and engagement tracking
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

// Circuit breaker for PandaDoc API calls
const pandadocCircuitBreaker = new CircuitBreaker('pandadoc', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000, // 1 minute before retry
});

// ============================================
// Types
// ============================================

export interface PandaDocConnection {
  id?: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  workspaceId?: string;
}

export interface PandaDocDocument {
  id: string;
  name: string;
  status: DocumentStatus;
  date_created: string;
  date_modified: string;
  date_completed?: string;
  expiration_date?: string;
  version: string;
  recipients: PandaDocRecipient[];
  metadata?: Record<string, unknown>;
  tokens?: Array<{ name: string; value: string }>;
  grand_total?: {
    amount: string;
    currency: string;
  };
  template?: {
    id: string;
    name: string;
  };
}

export type DocumentStatus =
  | 'document.draft'
  | 'document.sent'
  | 'document.viewed'
  | 'document.waiting_approval'
  | 'document.approved'
  | 'document.waiting_pay'
  | 'document.paid'
  | 'document.completed'
  | 'document.voided'
  | 'document.declined';

export interface PandaDocRecipient {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  recipient_type: 'signer' | 'cc' | 'approver';
  has_completed: boolean;
  signing_order?: number;
}

export interface PandaDocTemplate {
  id: string;
  name: string;
  date_created: string;
  date_modified: string;
  version: string;
  content_placeholders?: Array<{
    uuid: string;
    block_id: string;
    name: string;
  }>;
  tokens?: Array<{
    name: string;
    value: string;
  }>;
}

export interface DocumentAnalytics {
  documentId: string;
  totalViews: number;
  totalTimeSpent: number;
  recipientAnalytics: Array<{
    email: string;
    viewCount: number;
    timeSpent: number;
    lastViewedAt?: string;
    completedAt?: string;
    pages?: Array<{
      number: number;
      timeSpent: number;
    }>;
  }>;
}

export interface CreateDocumentParams {
  name: string;
  templateId: string;
  recipients: Array<{
    email: string;
    firstName: string;
    lastName: string;
    role?: string;
    signingOrder?: number;
  }>;
  tokens?: Array<{ name: string; value: string }>;
  metadata?: Record<string, unknown>;
  sendImmediately?: boolean;
  message?: string;
  subject?: string;
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
  customerMatchingField: 'recipient_email' | 'metadata_field';
  metadataCustomerField?: string;
  notifyOnEvents: DocumentEventType[];
  requireApprovalForSend: boolean;
}

export type DocumentEventType =
  | 'document_sent'
  | 'document_viewed'
  | 'document_completed'
  | 'document_paid'
  | 'recipient_completed'
  | 'document_declined';

export interface SyncStatus {
  connected: boolean;
  lastSyncAt?: Date;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  recordsSynced?: number;
  syncErrors?: string[];
  nextScheduledSync?: Date;
}

export interface PandaDocWebhook {
  event: string;
  data: {
    id: string;
    name?: string;
    status?: string;
    date_created?: string;
    date_modified?: string;
    recipients?: PandaDocRecipient[];
    metadata?: Record<string, unknown>;
    grand_total?: {
      amount: string;
      currency: string;
    };
  };
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  syncSchedule: 'hourly',
  customerMatchingField: 'recipient_email',
  notifyOnEvents: ['document_sent', 'document_viewed', 'document_completed', 'document_paid'],
  requireApprovalForSend: true,
};

// ============================================
// PandaDoc Service Class
// ============================================

export class PandaDocService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private apiBaseUrl = 'https://api.pandadoc.com/public/v1';

  constructor() {
    this.clientId = process.env.PANDADOC_CLIENT_ID || '';
    this.clientSecret = process.env.PANDADOC_CLIENT_SECRET || '';
    this.redirectUri =
      process.env.PANDADOC_REDIRECT_URI || 'http://localhost:3001/api/integrations/pandadoc/callback';
  }

  /**
   * Check if PandaDoc integration is configured
   */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthUrl(userId: string): string {
    const state = JSON.stringify({ userId });
    const encodedState = Buffer.from(state).toString('base64');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'read+write',
      state: encodedState,
    });

    return `https://app.pandadoc.com/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async connect(code: string): Promise<PandaDocConnection> {
    const response = await withRetry(
      async () => {
        return pandadocCircuitBreaker.execute(async () => {
          const res = await fetch('https://api.pandadoc.com/oauth2/access_token', {
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
              scope: 'read+write',
            }),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`PandaDoc OAuth failed: ${error}`);
          }

          return res.json();
        });
      },
      {
        ...retryStrategies.aiService,
        maxRetries: 2,
        onRetry: (attempt, error) => {
          console.log(`[PandaDoc] OAuth retry attempt ${attempt}: ${error.message}`);
        },
      }
    );

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      tokenExpiresAt: new Date(Date.now() + response.expires_in * 1000),
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(connection: PandaDocConnection): Promise<PandaDocConnection> {
    const response = await withRetry(
      async () => {
        return pandadocCircuitBreaker.execute(async () => {
          const res = await fetch('https://api.pandadoc.com/oauth2/access_token', {
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
            throw new Error('Failed to refresh PandaDoc token');
          }

          return res.json();
        });
      },
      { ...retryStrategies.aiService, maxRetries: 2 }
    );

    return {
      ...connection,
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      tokenExpiresAt: new Date(Date.now() + response.expires_in * 1000),
    };
  }

  /**
   * Make authenticated API request to PandaDoc
   */
  async apiRequest<T>(
    connection: PandaDocConnection,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.apiBaseUrl}${endpoint}`;

    const response = await withRetry(
      async () => {
        return pandadocCircuitBreaker.execute(async () => {
          const res = await fetch(url, {
            ...options,
            headers: {
              Authorization: `Bearer ${connection.accessToken}`,
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
              throw new Error('RATE_LIMITED');
            }
            throw new Error(`PandaDoc API error: ${error}`);
          }

          // Handle 204 No Content responses
          if (res.status === 204) {
            return {} as T;
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
   * List documents with optional filters
   */
  async listDocuments(
    connection: PandaDocConnection,
    options: {
      q?: string;
      status?: DocumentStatus[];
      page?: number;
      count?: number;
      orderBy?: 'date_created' | 'date_modified' | 'name';
      ascending?: boolean;
    } = {}
  ): Promise<{ results: PandaDocDocument[]; count: number }> {
    const params = new URLSearchParams();

    if (options.q) params.append('q', options.q);
    if (options.status?.length) params.append('status', options.status.join(','));
    if (options.page) params.append('page', options.page.toString());
    if (options.count) params.append('count', (options.count || 50).toString());
    if (options.orderBy) params.append('order_by', options.orderBy);
    if (options.ascending !== undefined) params.append('ascending', options.ascending.toString());

    return this.apiRequest(connection, `/documents?${params.toString()}`);
  }

  /**
   * Get document details
   */
  async getDocument(connection: PandaDocConnection, documentId: string): Promise<PandaDocDocument> {
    return this.apiRequest(connection, `/documents/${documentId}`);
  }

  /**
   * Get document analytics
   */
  async getDocumentAnalytics(
    connection: PandaDocConnection,
    documentId: string
  ): Promise<DocumentAnalytics> {
    const response = await this.apiRequest<{
      statistics: Array<{
        recipient: { email: string };
        view_count: number;
        time_spent: number;
        last_viewed_at?: string;
        completed_at?: string;
        pages?: Array<{ number: number; time_spent: number }>;
      }>;
    }>(connection, `/documents/${documentId}/session`);

    const totalViews = response.statistics.reduce((sum, s) => sum + s.view_count, 0);
    const totalTimeSpent = response.statistics.reduce((sum, s) => sum + s.time_spent, 0);

    return {
      documentId,
      totalViews,
      totalTimeSpent,
      recipientAnalytics: response.statistics.map((s) => ({
        email: s.recipient.email,
        viewCount: s.view_count,
        timeSpent: s.time_spent,
        lastViewedAt: s.last_viewed_at,
        completedAt: s.completed_at,
        pages: s.pages,
      })),
    };
  }

  /**
   * List available templates
   */
  async listTemplates(
    connection: PandaDocConnection,
    options: { q?: string; page?: number; count?: number } = {}
  ): Promise<{ results: PandaDocTemplate[] }> {
    const params = new URLSearchParams();
    if (options.q) params.append('q', options.q);
    if (options.page) params.append('page', options.page.toString());
    if (options.count) params.append('count', (options.count || 50).toString());

    return this.apiRequest(connection, `/templates?${params.toString()}`);
  }

  /**
   * Get template details
   */
  async getTemplate(connection: PandaDocConnection, templateId: string): Promise<PandaDocTemplate> {
    return this.apiRequest(connection, `/templates/${templateId}/details`);
  }

  /**
   * Create document from template
   */
  async createDocument(
    connection: PandaDocConnection,
    params: CreateDocumentParams
  ): Promise<PandaDocDocument> {
    const requestBody = {
      name: params.name,
      template_uuid: params.templateId,
      recipients: params.recipients.map((r, index) => ({
        email: r.email,
        first_name: r.firstName,
        last_name: r.lastName,
        role: r.role || 'signer',
        signing_order: r.signingOrder || index + 1,
      })),
      tokens: params.tokens || [],
      metadata: params.metadata || {},
    };

    const document = await this.apiRequest<PandaDocDocument>(connection, '/documents', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    // Wait for document to be ready (PandaDoc processes documents async)
    await this.waitForDocumentReady(connection, document.id);

    // Send immediately if requested
    if (params.sendImmediately) {
      await this.sendDocument(connection, document.id, {
        message: params.message,
        subject: params.subject,
      });

      // Refresh document status
      return this.getDocument(connection, document.id);
    }

    return document;
  }

  /**
   * Wait for document to be ready (status changes from uploading)
   */
  private async waitForDocumentReady(
    connection: PandaDocConnection,
    documentId: string,
    maxAttempts = 30
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const doc = await this.getDocument(connection, documentId);
      if (doc.status === 'document.draft') {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('Document processing timeout');
  }

  /**
   * Send document for signature
   */
  async sendDocument(
    connection: PandaDocConnection,
    documentId: string,
    options: { message?: string; subject?: string; silent?: boolean } = {}
  ): Promise<void> {
    await this.apiRequest(connection, `/documents/${documentId}/send`, {
      method: 'POST',
      body: JSON.stringify({
        message: options.message || 'Please review and sign the attached document.',
        subject: options.subject,
        silent: options.silent ?? false,
      }),
    });
  }

  /**
   * Void a document
   */
  async voidDocument(connection: PandaDocConnection, documentId: string): Promise<void> {
    await this.apiRequest(connection, `/documents/${documentId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Sync documents from PandaDoc to CSCX
   */
  async syncDocuments(
    connection: PandaDocConnection,
    userId: string,
    options: {
      incremental?: boolean;
      lastSyncAt?: Date;
      customerId?: string; // Sync for specific customer
    } = {}
  ): Promise<SyncResult> {
    const { incremental = false, lastSyncAt, customerId } = options;

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
      'documents',
      incremental ? 'incremental' : 'full'
    );
    result.syncLogId = syncLog?.id;

    try {
      // Get customer email mappings
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name, email_domains');

      const domainToCustomer = new Map<string, string>();
      customers?.forEach((c) => {
        if (c.email_domains) {
          c.email_domains.forEach((d: string) => {
            domainToCustomer.set(d.toLowerCase(), c.id);
          });
        }
      });

      // Fetch documents from PandaDoc
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.listDocuments(connection, {
          page,
          count: 100,
          orderBy: 'date_modified',
          ascending: false,
        });

        for (const doc of response.results) {
          try {
            // Skip if incremental and doc hasn't changed
            if (incremental && lastSyncAt) {
              const docModified = new Date(doc.date_modified);
              if (docModified < lastSyncAt) {
                hasMore = false;
                break;
              }
            }

            // Match document to customer via recipient email domain
            let matchedCustomerId: string | undefined = customerId;

            if (!matchedCustomerId && doc.recipients) {
              for (const recipient of doc.recipients) {
                const emailDomain = recipient.email.split('@')[1]?.toLowerCase();
                if (emailDomain && domainToCustomer.has(emailDomain)) {
                  matchedCustomerId = domainToCustomer.get(emailDomain);
                  break;
                }
              }
            }

            if (!matchedCustomerId) {
              result.skipped++;
              continue;
            }

            // Check if document exists
            const { data: existing } = await supabase
              .from('pandadoc_documents')
              .select('id, synced_at')
              .eq('pandadoc_id', doc.id)
              .single();

            const documentData = {
              pandadoc_id: doc.id,
              customer_id: matchedCustomerId,
              name: doc.name,
              status: doc.status,
              document_type: this.inferDocumentType(doc.name),
              recipients: doc.recipients,
              sent_at: doc.status !== 'document.draft' ? doc.date_created : null,
              viewed_at: ['document.viewed', 'document.completed', 'document.paid'].includes(doc.status)
                ? doc.date_modified
                : null,
              completed_at: doc.date_completed || null,
              payment_status: doc.status === 'document.paid' ? 'paid' : null,
              amount: doc.grand_total?.amount ? parseFloat(doc.grand_total.amount) : null,
              currency: doc.grand_total?.currency || null,
              metadata: doc.metadata || {},
              synced_at: new Date().toISOString(),
            };

            if (existing) {
              await supabase.from('pandadoc_documents').update(documentData).eq('id', existing.id);
              result.updated++;
            } else {
              await supabase.from('pandadoc_documents').insert(documentData);
              result.created++;
            }

            result.synced++;
          } catch (err) {
            result.errors.push(`Failed to sync document ${doc.id}: ${(err as Error).message}`);
          }
        }

        // Check if more pages
        if (response.results.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      }

      await this.completeSyncLog(syncLog?.id, result, 'completed');
    } catch (error) {
      result.errors.push(`Sync failed: ${(error as Error).message}`);
      await this.completeSyncLog(syncLog?.id, result, 'failed');
    }

    return result;
  }

  /**
   * Infer document type from name
   */
  private inferDocumentType(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('proposal')) return 'proposal';
    if (lower.includes('contract') || lower.includes('agreement')) return 'contract';
    if (lower.includes('quote') || lower.includes('quotation')) return 'quote';
    if (lower.includes('sow') || lower.includes('statement of work')) return 'sow';
    if (lower.includes('nda') || lower.includes('non-disclosure')) return 'nda';
    if (lower.includes('renewal')) return 'renewal';
    if (lower.includes('amendment') || lower.includes('addendum')) return 'amendment';
    return 'other';
  }

  /**
   * Process webhook from PandaDoc
   */
  async processWebhook(
    userId: string,
    webhook: PandaDocWebhook
  ): Promise<{ processed: boolean; notifications: string[] }> {
    const notifications: string[] = [];

    if (!supabase) {
      return { processed: false, notifications };
    }

    try {
      const { event, data } = webhook;

      // Find matching document
      const { data: document } = await supabase
        .from('pandadoc_documents')
        .select('id, customer_id, name')
        .eq('pandadoc_id', data.id)
        .single();

      if (!document) {
        // Document not tracked yet - skip
        console.log(`[PandaDoc] Document ${data.id} not found in database`);
        return { processed: false, notifications };
      }

      // Update document based on event
      const updates: Record<string, unknown> = {
        status: data.status,
        synced_at: new Date().toISOString(),
      };

      switch (event) {
        case 'document_state_changed':
          if (data.status === 'document.viewed') {
            updates.viewed_at = new Date().toISOString();
            notifications.push(`document_viewed:${document.customer_id}:${document.name}`);
          } else if (data.status === 'document.completed') {
            updates.completed_at = new Date().toISOString();
            notifications.push(`document_completed:${document.customer_id}:${document.name}`);
          } else if (data.status === 'document.paid') {
            updates.payment_status = 'paid';
            updates.paid_at = new Date().toISOString();
            if (data.grand_total) {
              updates.amount = parseFloat(data.grand_total.amount);
              updates.currency = data.grand_total.currency;
            }
            notifications.push(`document_paid:${document.customer_id}:${document.name}`);
          } else if (data.status === 'document.declined') {
            notifications.push(`document_declined:${document.customer_id}:${document.name}`);
          }
          break;

        case 'recipient_completed':
          // Log recipient event
          await supabase.from('pandadoc_events').insert({
            pandadoc_id: data.id,
            event_type: 'recipient_completed',
            recipient_email: (data as any).recipient?.email,
            occurred_at: new Date().toISOString(),
          });
          break;
      }

      // Update document
      await supabase.from('pandadoc_documents').update(updates).eq('id', document.id);

      // Create timeline event
      await this.createTimelineEvent(document.customer_id, event, document.name, data);

      return { processed: true, notifications };
    } catch (error) {
      console.error('[PandaDoc] Webhook processing error:', error);
      return { processed: false, notifications };
    }
  }

  /**
   * Create customer timeline event
   */
  private async createTimelineEvent(
    customerId: string,
    eventType: string,
    documentName: string,
    data: unknown
  ): Promise<void> {
    if (!supabase) return;

    const eventLabels: Record<string, string> = {
      document_state_changed: 'Document Status Changed',
      recipient_completed: 'Recipient Signed',
      document_created: 'Document Created',
      document_sent: 'Document Sent',
    };

    await supabase.from('customer_timeline').insert({
      customer_id: customerId,
      event_type: 'pandadoc',
      event_title: eventLabels[eventType] || 'Document Event',
      event_description: `${documentName}: ${eventType}`,
      metadata: data,
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Get documents for a specific customer
   */
  async getCustomerDocuments(
    customerId: string,
    options: { status?: string; limit?: number; offset?: number } = {}
  ): Promise<{ documents: unknown[]; total: number }> {
    if (!supabase) {
      return { documents: [], total: 0 };
    }

    const { limit = 20, offset = 0, status } = options;

    let query = supabase
      .from('pandadoc_documents')
      .select('*', { count: 'exact' })
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Failed to get documents: ${error.message}`);
    }

    return { documents: data || [], total: count || 0 };
  }

  /**
   * Save connection to database
   */
  async saveConnection(
    userId: string,
    connection: PandaDocConnection,
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
          provider: 'pandadoc',
          access_token: connection.accessToken,
          refresh_token: connection.refreshToken,
          token_expires_at: connection.tokenExpiresAt.toISOString(),
          workspace_id: connection.workspaceId || null,
          sync_config: config || DEFAULT_SYNC_CONFIG,
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
  ): Promise<(PandaDocConnection & { id: string; config: Partial<SyncConfig> }) | null> {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'pandadoc')
      .single();

    if (error || !data) return null;

    // Check if token needs refresh
    const expiresAt = new Date(data.token_expires_at);
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

    let connection: PandaDocConnection = {
      id: data.id,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt: expiresAt,
      workspaceId: data.workspace_id,
    };

    if (expiresAt.getTime() - Date.now() < bufferTime) {
      // Refresh the token
      const refreshed = await this.refreshToken(connection);
      await this.saveConnection(userId, refreshed, data.sync_config);
      connection = {
        ...refreshed,
        id: data.id,
      };
    }

    return {
      ...connection,
      config: data.sync_config || DEFAULT_SYNC_CONFIG,
    };
  }

  /**
   * Update sync configuration
   */
  async updateSyncConfig(userId: string, config: Partial<SyncConfig>): Promise<void> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const { error } = await supabase
      .from('integration_connections')
      .update({
        sync_config: config,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'pandadoc');

    if (error) {
      throw new Error(`Failed to update config: ${error.message}`);
    }
  }

  /**
   * Disconnect PandaDoc integration
   */
  async disconnect(userId: string): Promise<void> {
    if (!supabase) return;

    await supabase.from('integration_connections').delete().eq('user_id', userId).eq('provider', 'pandadoc');
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
      .from('pandadoc_sync_log')
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
      .from('pandadoc_sync_log')
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
      .from('pandadoc_sync_log')
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
      .from('pandadoc_sync_log')
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
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return pandadocCircuitBreaker.getStats();
  }
}

// Singleton instance
export const pandadocService = new PandaDocService();
export default pandadocService;
