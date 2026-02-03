/**
 * Confluence Integration Service - PRD-204
 *
 * Implements knowledge base integration with Confluence:
 * - OAuth 2.0 authentication (Cloud) and API Token (Server)
 * - Space configuration and content sync
 * - Semantic search with embeddings
 * - Customer page linking
 * - Page creation from CSCX.AI
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

// Circuit breaker for Confluence API calls
const confluenceCircuitBreaker = new CircuitBreaker('confluence', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000, // 1 minute before retry
});

// ============================================
// Types
// ============================================

export interface ConfluenceConnection {
  id?: string;
  accessToken: string;
  refreshToken?: string;
  cloudId?: string;
  baseUrl: string;
  tokenExpiresAt?: Date;
  authType: 'oauth' | 'api_token';
  email?: string;
}

export interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  type: 'global' | 'personal';
  status: 'current' | 'archived';
  description?: string;
  homepageId?: string;
}

export interface ConfluencePage {
  id: string;
  title: string;
  spaceKey: string;
  body?: string;
  labels: string[];
  version: number;
  lastModified: string;
  createdBy?: string;
  webUrl: string;
  ancestors?: { id: string; title: string }[];
}

export interface ConfluencePageCreate {
  spaceKey: string;
  title: string;
  body: string;
  parentId?: string;
  labels?: string[];
}

export interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  syncLogId?: string;
}

export interface SpaceConfig {
  spaceKey: string;
  spaceName: string;
  enabled: boolean;
  syncFrequency: 'hourly' | 'daily' | 'weekly' | 'manual';
  lastSyncAt?: string;
  pageCount?: number;
}

export interface SyncConfig {
  spaces: SpaceConfig[];
  syncSchedule: 'hourly' | 'daily' | 'manual';
  generateEmbeddings: boolean;
  includeAttachments: boolean;
}

export interface SyncStatus {
  connected: boolean;
  lastSyncAt?: Date;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  pagesSynced?: number;
  syncErrors?: string[];
  nextScheduledSync?: Date;
}

export interface SearchResult {
  pageId: string;
  title: string;
  spaceKey: string;
  snippet: string;
  score: number;
  webUrl: string;
  labels: string[];
  lastModified: string;
}

export interface CustomerPageLink {
  id: string;
  pageId: string;
  customerId: string;
  linkType: 'label' | 'property' | 'manual';
  pageTitle: string;
  pageUrl: string;
}

// ============================================
// Confluence Service Class
// ============================================

export class ConfluenceService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.CONFLUENCE_CLIENT_ID || '';
    this.clientSecret = process.env.CONFLUENCE_CLIENT_SECRET || '';
    this.redirectUri =
      process.env.CONFLUENCE_REDIRECT_URI ||
      'http://localhost:3001/api/integrations/confluence/callback';
  }

  /**
   * Check if Confluence OAuth is configured
   */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Generate OAuth2 authorization URL for Confluence Cloud
   */
  getAuthUrl(userId: string): string {
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: this.clientId,
      scope:
        'read:confluence-content.all write:confluence-content read:confluence-space.summary read:confluence-content.summary search:confluence offline_access',
      redirect_uri: this.redirectUri,
      state,
      response_type: 'code',
      prompt: 'consent',
    });

    return `https://auth.atlassian.com/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token (Confluence Cloud)
   */
  async connect(code: string): Promise<ConfluenceConnection> {
    const response = await withRetry(
      async () => {
        return confluenceCircuitBreaker.execute(async () => {
          const res = await fetch('https://auth.atlassian.com/oauth/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              grant_type: 'authorization_code',
              client_id: this.clientId,
              client_secret: this.clientSecret,
              code,
              redirect_uri: this.redirectUri,
            }),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`Confluence OAuth failed: ${error}`);
          }

          return res.json();
        });
      },
      {
        ...retryStrategies.aiService,
        maxRetries: 2,
        onRetry: (attempt, error) => {
          console.log(`[Confluence] OAuth retry attempt ${attempt}: ${error.message}`);
        },
      }
    );

    // Get accessible resources (cloud instances)
    const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        Authorization: `Bearer ${response.access_token}`,
        Accept: 'application/json',
      },
    });

    if (!resourcesRes.ok) {
      throw new Error('Failed to get Confluence cloud instances');
    }

    const resources = await resourcesRes.json();
    if (!resources.length) {
      throw new Error('No Confluence instances found for this account');
    }

    // Use first available cloud instance
    const cloudId = resources[0].id;
    const baseUrl = `https://api.atlassian.com/ex/confluence/${cloudId}`;

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      cloudId,
      baseUrl,
      tokenExpiresAt: new Date(Date.now() + response.expires_in * 1000),
      authType: 'oauth',
    };
  }

  /**
   * Connect using API token (Confluence Server/Data Center)
   */
  async connectWithApiToken(
    baseUrl: string,
    email: string,
    apiToken: string
  ): Promise<ConfluenceConnection> {
    // Validate the connection by making a test request
    const authHeader = Buffer.from(`${email}:${apiToken}`).toString('base64');

    const response = await withRetry(
      async () => {
        return confluenceCircuitBreaker.execute(async () => {
          const res = await fetch(`${baseUrl}/wiki/rest/api/space?limit=1`, {
            headers: {
              Authorization: `Basic ${authHeader}`,
              Accept: 'application/json',
            },
          });

          if (!res.ok) {
            if (res.status === 401) {
              throw new Error('Invalid email or API token');
            }
            throw new Error(`Connection test failed: ${res.statusText}`);
          }

          return res.json();
        });
      },
      { ...retryStrategies.aiService, maxRetries: 2 }
    );

    return {
      accessToken: apiToken,
      baseUrl: baseUrl.replace(/\/+$/, ''), // Remove trailing slashes
      authType: 'api_token',
      email,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(connection: ConfluenceConnection): Promise<ConfluenceConnection> {
    if (connection.authType !== 'oauth' || !connection.refreshToken) {
      throw new Error('Token refresh only available for OAuth connections');
    }

    const response = await withRetry(
      async () => {
        return confluenceCircuitBreaker.execute(async () => {
          const res = await fetch('https://auth.atlassian.com/oauth/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              grant_type: 'refresh_token',
              client_id: this.clientId,
              client_secret: this.clientSecret,
              refresh_token: connection.refreshToken,
            }),
          });

          if (!res.ok) {
            throw new Error('Failed to refresh Confluence token');
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
   * Get authorization header
   */
  private getAuthHeader(connection: ConfluenceConnection): string {
    if (connection.authType === 'api_token' && connection.email) {
      return `Basic ${Buffer.from(`${connection.email}:${connection.accessToken}`).toString('base64')}`;
    }
    return `Bearer ${connection.accessToken}`;
  }

  /**
   * Get API base URL
   */
  private getApiUrl(connection: ConfluenceConnection): string {
    if (connection.authType === 'oauth') {
      return connection.baseUrl;
    }
    return `${connection.baseUrl}/wiki/rest/api`;
  }

  /**
   * List available spaces
   */
  async listSpaces(
    connection: ConfluenceConnection,
    options: { limit?: number; start?: number; type?: 'global' | 'personal' } = {}
  ): Promise<{ spaces: ConfluenceSpace[]; total: number }> {
    const { limit = 25, start = 0, type } = options;
    const apiUrl = this.getApiUrl(connection);

    const params = new URLSearchParams({
      limit: limit.toString(),
      start: start.toString(),
    });
    if (type) params.append('type', type);

    const response = await withRetry(
      async () => {
        return confluenceCircuitBreaker.execute(async () => {
          const res = await fetch(`${apiUrl}/space?${params.toString()}`, {
            headers: {
              Authorization: this.getAuthHeader(connection),
              Accept: 'application/json',
            },
          });

          if (!res.ok) {
            throw new Error(`Failed to list spaces: ${res.statusText}`);
          }

          return res.json();
        });
      },
      retryStrategies.aiService
    );

    const spaces: ConfluenceSpace[] = response.results.map((space: any) => ({
      id: space.id,
      key: space.key,
      name: space.name,
      type: space.type,
      status: space.status,
      description: space.description?.plain?.value,
      homepageId: space.homepage?.id,
    }));

    return {
      spaces,
      total: response.size || spaces.length,
    };
  }

  /**
   * Get pages from a space
   */
  async getSpacePages(
    connection: ConfluenceConnection,
    spaceKey: string,
    options: { limit?: number; start?: number; lastModifiedAfter?: Date } = {}
  ): Promise<{ pages: ConfluencePage[]; hasMore: boolean }> {
    const { limit = 50, start = 0, lastModifiedAfter } = options;
    const apiUrl = this.getApiUrl(connection);

    let cql = `space="${spaceKey}" AND type=page`;
    if (lastModifiedAfter) {
      cql += ` AND lastmodified>="${lastModifiedAfter.toISOString().split('T')[0]}"`;
    }

    const params = new URLSearchParams({
      cql,
      limit: limit.toString(),
      start: start.toString(),
      expand: 'body.storage,version,metadata.labels,ancestors',
    });

    const response = await withRetry(
      async () => {
        return confluenceCircuitBreaker.execute(async () => {
          const res = await fetch(`${apiUrl}/content/search?${params.toString()}`, {
            headers: {
              Authorization: this.getAuthHeader(connection),
              Accept: 'application/json',
            },
          });

          if (!res.ok) {
            throw new Error(`Failed to get pages: ${res.statusText}`);
          }

          return res.json();
        });
      },
      retryStrategies.aiService
    );

    const pages: ConfluencePage[] = response.results.map((page: any) => ({
      id: page.id,
      title: page.title,
      spaceKey: page.space?.key || spaceKey,
      body: this.stripHtml(page.body?.storage?.value || ''),
      labels: page.metadata?.labels?.results?.map((l: any) => l.name) || [],
      version: page.version?.number || 1,
      lastModified: page.version?.when || new Date().toISOString(),
      createdBy: page.version?.by?.displayName,
      webUrl: page._links?.webui
        ? `${connection.baseUrl.replace('/wiki/rest/api', '')}${page._links.webui}`
        : '',
      ancestors: page.ancestors?.map((a: any) => ({ id: a.id, title: a.title })),
    }));

    return {
      pages,
      hasMore: response._links?.next !== undefined,
    };
  }

  /**
   * Get a single page by ID
   */
  async getPage(
    connection: ConfluenceConnection,
    pageId: string
  ): Promise<ConfluencePage | null> {
    const apiUrl = this.getApiUrl(connection);

    try {
      const response = await confluenceCircuitBreaker.execute(async () => {
        const res = await fetch(
          `${apiUrl}/content/${pageId}?expand=body.storage,version,metadata.labels,space,ancestors`,
          {
            headers: {
              Authorization: this.getAuthHeader(connection),
              Accept: 'application/json',
            },
          }
        );

        if (!res.ok) {
          if (res.status === 404) return null;
          throw new Error(`Failed to get page: ${res.statusText}`);
        }

        return res.json();
      });

      if (!response) return null;

      return {
        id: response.id,
        title: response.title,
        spaceKey: response.space?.key,
        body: this.stripHtml(response.body?.storage?.value || ''),
        labels: response.metadata?.labels?.results?.map((l: any) => l.name) || [],
        version: response.version?.number || 1,
        lastModified: response.version?.when || new Date().toISOString(),
        createdBy: response.version?.by?.displayName,
        webUrl: response._links?.webui
          ? `${connection.baseUrl.replace('/wiki/rest/api', '')}${response._links.webui}`
          : '',
        ancestors: response.ancestors?.map((a: any) => ({ id: a.id, title: a.title })),
      };
    } catch (error) {
      console.error('Error getting page:', error);
      return null;
    }
  }

  /**
   * Search Confluence content
   */
  async search(
    connection: ConfluenceConnection,
    query: string,
    options: { spaceKeys?: string[]; limit?: number; labels?: string[] } = {}
  ): Promise<SearchResult[]> {
    const { spaceKeys, limit = 20, labels } = options;
    const apiUrl = this.getApiUrl(connection);

    let cql = `text~"${query}" AND type=page`;
    if (spaceKeys?.length) {
      cql += ` AND space IN (${spaceKeys.map((k) => `"${k}"`).join(',')})`;
    }
    if (labels?.length) {
      cql += ` AND label IN (${labels.map((l) => `"${l}"`).join(',')})`;
    }

    const params = new URLSearchParams({
      cql,
      limit: limit.toString(),
      expand: 'content.metadata.labels,content.space',
    });

    const response = await withRetry(
      async () => {
        return confluenceCircuitBreaker.execute(async () => {
          const res = await fetch(`${apiUrl}/content/search?${params.toString()}`, {
            headers: {
              Authorization: this.getAuthHeader(connection),
              Accept: 'application/json',
            },
          });

          if (!res.ok) {
            throw new Error(`Search failed: ${res.statusText}`);
          }

          return res.json();
        });
      },
      retryStrategies.aiService
    );

    return response.results.map((result: any, index: number) => ({
      pageId: result.content?.id || result.id,
      title: result.content?.title || result.title,
      spaceKey: result.content?.space?.key || result.resultGlobalContainer?.displayUrl,
      snippet: result.excerpt || '',
      score: 1 - index * 0.05, // Simple relevance score based on order
      webUrl: result.content?._links?.webui
        ? `${connection.baseUrl.replace('/wiki/rest/api', '')}${result.content._links.webui}`
        : '',
      labels: result.content?.metadata?.labels?.results?.map((l: any) => l.name) || [],
      lastModified: result.lastModified || new Date().toISOString(),
    }));
  }

  /**
   * Create a new page
   */
  async createPage(
    connection: ConfluenceConnection,
    page: ConfluencePageCreate
  ): Promise<ConfluencePage> {
    const apiUrl = this.getApiUrl(connection);

    const body: any = {
      type: 'page',
      title: page.title,
      space: { key: page.spaceKey },
      body: {
        storage: {
          value: page.body,
          representation: 'storage',
        },
      },
    };

    if (page.parentId) {
      body.ancestors = [{ id: page.parentId }];
    }

    const response = await withRetry(
      async () => {
        return confluenceCircuitBreaker.execute(async () => {
          const res = await fetch(`${apiUrl}/content`, {
            method: 'POST',
            headers: {
              Authorization: this.getAuthHeader(connection),
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`Failed to create page: ${error}`);
          }

          return res.json();
        });
      },
      retryStrategies.aiService
    );

    // Add labels if provided
    if (page.labels?.length) {
      await this.addLabels(connection, response.id, page.labels);
    }

    return {
      id: response.id,
      title: response.title,
      spaceKey: page.spaceKey,
      body: page.body,
      labels: page.labels || [],
      version: 1,
      lastModified: new Date().toISOString(),
      webUrl: response._links?.webui
        ? `${connection.baseUrl.replace('/wiki/rest/api', '')}${response._links.webui}`
        : '',
    };
  }

  /**
   * Add labels to a page
   */
  async addLabels(
    connection: ConfluenceConnection,
    pageId: string,
    labels: string[]
  ): Promise<void> {
    const apiUrl = this.getApiUrl(connection);

    const labelData = labels.map((name) => ({ prefix: 'global', name }));

    await confluenceCircuitBreaker.execute(async () => {
      const res = await fetch(`${apiUrl}/content/${pageId}/label`, {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(connection),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(labelData),
      });

      if (!res.ok) {
        console.warn(`Failed to add labels to page ${pageId}: ${res.statusText}`);
      }
    });
  }

  /**
   * Sync pages from configured spaces
   */
  async syncPages(
    connection: ConfluenceConnection,
    userId: string,
    options: { spaceKeys?: string[]; incremental?: boolean; lastSyncAt?: Date } = {}
  ): Promise<SyncResult> {
    const { spaceKeys, incremental = false, lastSyncAt } = options;

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
      'pages',
      incremental ? 'incremental' : 'full'
    );
    result.syncLogId = syncLog?.id;

    try {
      // Get spaces to sync
      let spacesToSync = spaceKeys;
      if (!spacesToSync?.length) {
        const { data: configuredSpaces } = await supabase
          .from('confluence_space_config')
          .select('space_key')
          .eq('user_id', userId)
          .eq('enabled', true);

        spacesToSync = configuredSpaces?.map((s) => s.space_key) || [];
      }

      if (!spacesToSync.length) {
        result.errors.push('No spaces configured for sync');
        await this.completeSyncLog(syncLog?.id, result, 'completed');
        return result;
      }

      // Sync each space
      for (const spaceKey of spacesToSync) {
        try {
          let start = 0;
          let hasMore = true;

          while (hasMore) {
            const { pages, hasMore: more } = await this.getSpacePages(connection, spaceKey, {
              limit: 50,
              start,
              lastModifiedAfter: incremental ? lastSyncAt : undefined,
            });

            hasMore = more;
            start += pages.length;

            for (const page of pages) {
              try {
                // Check if page exists
                const { data: existing } = await supabase
                  .from('confluence_pages')
                  .select('id, last_modified_at')
                  .eq('confluence_page_id', page.id)
                  .single();

                const pageData = {
                  confluence_page_id: page.id,
                  space_key: page.spaceKey,
                  title: page.title,
                  content_text: page.body,
                  labels: page.labels,
                  page_url: page.webUrl,
                  last_modified_at: page.lastModified,
                  synced_at: new Date().toISOString(),
                  user_id: userId,
                };

                if (existing) {
                  // Check if page was modified
                  if (new Date(page.lastModified) > new Date(existing.last_modified_at)) {
                    await supabase.from('confluence_pages').update(pageData).eq('id', existing.id);
                    result.updated++;
                  } else {
                    result.skipped++;
                  }
                } else {
                  await supabase.from('confluence_pages').insert(pageData);
                  result.created++;
                }

                result.synced++;
              } catch (err) {
                result.errors.push(`Failed to sync page ${page.title}: ${(err as Error).message}`);
              }
            }
          }

          // Update space sync timestamp
          await supabase
            .from('confluence_space_config')
            .update({ last_sync_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('space_key', spaceKey);
        } catch (err) {
          result.errors.push(`Failed to sync space ${spaceKey}: ${(err as Error).message}`);
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
   * Search synced pages (local database)
   */
  async searchSyncedPages(
    userId: string,
    query: string,
    options: { spaceKeys?: string[]; labels?: string[]; limit?: number } = {}
  ): Promise<SearchResult[]> {
    const { spaceKeys, labels, limit = 20 } = options;

    if (!supabase) {
      return [];
    }

    let queryBuilder = supabase
      .from('confluence_pages')
      .select('*')
      .eq('user_id', userId)
      .ilike('title', `%${query}%`)
      .limit(limit);

    if (spaceKeys?.length) {
      queryBuilder = queryBuilder.in('space_key', spaceKeys);
    }

    if (labels?.length) {
      queryBuilder = queryBuilder.overlaps('labels', labels);
    }

    const { data: pages, error } = await queryBuilder;

    if (error || !pages) {
      console.error('Search error:', error);
      return [];
    }

    return pages.map((page, index) => ({
      pageId: page.confluence_page_id,
      title: page.title,
      spaceKey: page.space_key,
      snippet: page.content_text?.substring(0, 200) || '',
      score: 1 - index * 0.05,
      webUrl: page.page_url,
      labels: page.labels || [],
      lastModified: page.last_modified_at,
    }));
  }

  /**
   * Full-text search with content matching
   */
  async fullTextSearch(
    userId: string,
    query: string,
    options: { spaceKeys?: string[]; limit?: number } = {}
  ): Promise<SearchResult[]> {
    const { spaceKeys, limit = 20 } = options;

    if (!supabase) {
      return [];
    }

    // Use PostgreSQL full-text search
    let queryBuilder = supabase
      .from('confluence_pages')
      .select('*')
      .eq('user_id', userId)
      .or(`title.ilike.%${query}%,content_text.ilike.%${query}%`)
      .limit(limit);

    if (spaceKeys?.length) {
      queryBuilder = queryBuilder.in('space_key', spaceKeys);
    }

    const { data: pages, error } = await queryBuilder;

    if (error || !pages) {
      console.error('Full-text search error:', error);
      return [];
    }

    return pages.map((page, index) => {
      // Find snippet with query match
      const lowerContent = (page.content_text || '').toLowerCase();
      const lowerQuery = query.toLowerCase();
      const matchIndex = lowerContent.indexOf(lowerQuery);
      let snippet = '';

      if (matchIndex >= 0) {
        const start = Math.max(0, matchIndex - 50);
        const end = Math.min(lowerContent.length, matchIndex + query.length + 150);
        snippet = (start > 0 ? '...' : '') + page.content_text.substring(start, end) + (end < lowerContent.length ? '...' : '');
      } else {
        snippet = page.content_text?.substring(0, 200) || '';
      }

      return {
        pageId: page.confluence_page_id,
        title: page.title,
        spaceKey: page.space_key,
        snippet,
        score: 1 - index * 0.05,
        webUrl: page.page_url,
        labels: page.labels || [],
        lastModified: page.last_modified_at,
      };
    });
  }

  /**
   * Link a page to a customer
   */
  async linkPageToCustomer(
    userId: string,
    pageId: string,
    customerId: string,
    linkType: 'label' | 'property' | 'manual' = 'manual'
  ): Promise<CustomerPageLink | null> {
    if (!supabase) return null;

    // Get page details
    const { data: page } = await supabase
      .from('confluence_pages')
      .select('title, page_url')
      .eq('confluence_page_id', pageId)
      .eq('user_id', userId)
      .single();

    if (!page) {
      throw new Error('Page not found');
    }

    const { data, error } = await supabase
      .from('confluence_customer_links')
      .upsert(
        {
          confluence_page_id: pageId,
          customer_id: customerId,
          link_type: linkType,
          user_id: userId,
        },
        { onConflict: 'confluence_page_id,customer_id' }
      )
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to link page: ${error.message}`);
    }

    return {
      id: data.id,
      pageId,
      customerId,
      linkType,
      pageTitle: page.title,
      pageUrl: page.page_url,
    };
  }

  /**
   * Get pages linked to a customer
   */
  async getCustomerPages(customerId: string): Promise<CustomerPageLink[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('confluence_customer_links')
      .select(
        `
        id,
        confluence_page_id,
        customer_id,
        link_type,
        confluence_pages (
          title,
          page_url
        )
      `
      )
      .eq('customer_id', customerId);

    if (error || !data) {
      console.error('Error getting customer pages:', error);
      return [];
    }

    return data.map((link: any) => ({
      id: link.id,
      pageId: link.confluence_page_id,
      customerId: link.customer_id,
      linkType: link.link_type,
      pageTitle: link.confluence_pages?.title || '',
      pageUrl: link.confluence_pages?.page_url || '',
    }));
  }

  /**
   * Remove page-customer link
   */
  async unlinkPageFromCustomer(linkId: string): Promise<void> {
    if (!supabase) return;

    await supabase.from('confluence_customer_links').delete().eq('id', linkId);
  }

  /**
   * Save connection to database
   */
  async saveConnection(
    userId: string,
    connection: ConfluenceConnection,
    config?: Partial<SyncConfig>
  ): Promise<string> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const { data, error } = await supabase
      .from('integration_connections')
      .upsert(
        {
          user_id: userId,
          provider: 'confluence',
          access_token: connection.accessToken,
          refresh_token: connection.refreshToken,
          instance_url: connection.baseUrl,
          cloud_id: connection.cloudId,
          token_expires_at: connection.tokenExpiresAt?.toISOString(),
          auth_type: connection.authType,
          email: connection.email,
          sync_schedule: config?.syncSchedule || 'daily',
          generate_embeddings: config?.generateEmbeddings ?? true,
          sync_enabled: true,
        },
        { onConflict: 'user_id,provider' }
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
  ): Promise<(ConfluenceConnection & { id: string; config: Partial<SyncConfig> }) | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'confluence')
      .single();

    if (error || !data) return null;

    // Check if OAuth token needs refresh
    if (data.auth_type === 'oauth' && data.token_expires_at) {
      const expiresAt = new Date(data.token_expires_at);
      const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

      if (expiresAt.getTime() - Date.now() < bufferTime) {
        try {
          const refreshed = await this.refreshToken({
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            cloudId: data.cloud_id,
            baseUrl: data.instance_url,
            authType: 'oauth',
          });

          await this.saveConnection(userId, refreshed, {
            syncSchedule: data.sync_schedule,
            generateEmbeddings: data.generate_embeddings,
          });

          return {
            id: data.id,
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            cloudId: refreshed.cloudId,
            baseUrl: refreshed.baseUrl,
            tokenExpiresAt: refreshed.tokenExpiresAt,
            authType: 'oauth',
            config: {
              syncSchedule: data.sync_schedule,
              generateEmbeddings: data.generate_embeddings,
              spaces: [],
            },
          };
        } catch (err) {
          console.error('Failed to refresh Confluence token:', err);
        }
      }
    }

    return {
      id: data.id,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      cloudId: data.cloud_id,
      baseUrl: data.instance_url,
      tokenExpiresAt: data.token_expires_at ? new Date(data.token_expires_at) : undefined,
      authType: data.auth_type,
      email: data.email,
      config: {
        syncSchedule: data.sync_schedule,
        generateEmbeddings: data.generate_embeddings,
        spaces: [],
      },
    };
  }

  /**
   * Update space configuration
   */
  async updateSpaceConfig(userId: string, spaceConfig: SpaceConfig): Promise<void> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const { error } = await supabase.from('confluence_space_config').upsert(
      {
        user_id: userId,
        space_key: spaceConfig.spaceKey,
        space_name: spaceConfig.spaceName,
        enabled: spaceConfig.enabled,
        sync_frequency: spaceConfig.syncFrequency,
      },
      { onConflict: 'user_id,space_key' }
    );

    if (error) {
      throw new Error(`Failed to update space config: ${error.message}`);
    }
  }

  /**
   * Get configured spaces
   */
  async getSpaceConfigs(userId: string): Promise<SpaceConfig[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('confluence_space_config')
      .select('*')
      .eq('user_id', userId);

    if (error || !data) return [];

    return data.map((config) => ({
      spaceKey: config.space_key,
      spaceName: config.space_name,
      enabled: config.enabled,
      syncFrequency: config.sync_frequency,
      lastSyncAt: config.last_sync_at,
      pageCount: config.page_count,
    }));
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
    if (config.generateEmbeddings !== undefined)
      updateData.generate_embeddings = config.generateEmbeddings;

    const { error } = await supabase
      .from('integration_connections')
      .update(updateData)
      .eq('user_id', userId)
      .eq('provider', 'confluence');

    if (error) {
      throw new Error(`Failed to update config: ${error.message}`);
    }
  }

  /**
   * Disconnect Confluence integration
   */
  async disconnect(userId: string): Promise<void> {
    if (!supabase) return;

    // Delete connection
    await supabase
      .from('integration_connections')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'confluence');

    // Delete space configs
    await supabase.from('confluence_space_config').delete().eq('user_id', userId);

    // Delete synced pages
    await supabase.from('confluence_pages').delete().eq('user_id', userId);

    // Delete customer links
    await supabase.from('confluence_customer_links').delete().eq('user_id', userId);
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
      .from('confluence_sync_log')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    // Get page count
    const { count: pageCount } = await supabase
      .from('confluence_pages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    return {
      connected: true,
      lastSyncAt: latestSync?.completed_at ? new Date(latestSync.completed_at) : undefined,
      lastSyncStatus: latestSync?.status,
      pagesSynced: pageCount || 0,
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
      .from('confluence_sync_log')
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
      .from('confluence_sync_log')
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
      .from('confluence_sync_log')
      .update({
        status,
        pages_processed: result.synced,
        pages_created: result.created,
        pages_updated: result.updated,
        pages_skipped: result.skipped,
        pages_failed: result.errors.length,
        error_details: result.errors,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLogId);
  }

  /**
   * Strip HTML tags from content
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return confluenceCircuitBreaker.getStats();
  }
}

// Singleton instance
export const confluenceService = new ConfluenceService();
export default confluenceService;
