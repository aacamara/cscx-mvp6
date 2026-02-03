/**
 * Notion Integration Service - PRD-203
 *
 * Implements documentation sync with Notion:
 * - OAuth 2.0 authentication
 * - Page sync and search
 * - Database integration
 * - Customer linking
 * - Page creation from templates
 * - Content embedding and AI indexing
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

// Circuit breaker for Notion API calls
const notionCircuitBreaker = new CircuitBreaker('notion', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000, // 1 minute before retry
});

// ============================================
// Types
// ============================================

export interface NotionConnection {
  id?: string;
  accessToken: string;
  workspaceId: string;
  workspaceName: string;
  workspaceIcon?: string;
  botId: string;
  tokenExpiresAt?: Date;
}

export interface NotionPage {
  id: string;
  notionPageId: string;
  title: string;
  url: string;
  icon?: string;
  cover?: string;
  parentType: 'database' | 'page' | 'workspace';
  parentId?: string;
  lastEditedAt: string;
  lastEditedBy?: string;
  properties?: Record<string, unknown>;
  contentMarkdown?: string;
}

export interface NotionDatabase {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  url: string;
  properties: NotionDatabaseProperty[];
}

export interface NotionDatabaseProperty {
  id: string;
  name: string;
  type: string;
  options?: Array<{ id: string; name: string; color: string }>;
}

export interface NotionBlock {
  id: string;
  type: string;
  hasChildren: boolean;
  content?: string;
  children?: NotionBlock[];
}

export interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  syncLogId?: string;
}

export interface NotionSyncConfig {
  syncSchedule: 'realtime' | 'hourly' | 'daily' | 'manual';
  customerLinkingMethod: 'property' | 'tag' | 'folder' | 'auto';
  customerPropertyName?: string;
  enabledDatabases: string[];
  enabledWorkspaces: string[];
  indexForSearch: boolean;
  indexForAI: boolean;
}

export interface NotionSyncStatus {
  connected: boolean;
  workspaceName?: string;
  lastSyncAt?: Date;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  pagesSynced?: number;
  syncErrors?: string[];
  nextScheduledSync?: Date;
}

export interface NotionSearchResult {
  pages: NotionPage[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface NotionPageTemplate {
  id: string;
  name: string;
  type: 'success_plan' | 'meeting_notes' | 'project_brief' | 'custom';
  databaseId?: string;
  defaultProperties: Record<string, unknown>;
  contentBlocks: NotionBlockInput[];
}

export interface NotionBlockInput {
  type: string;
  content?: string;
  children?: NotionBlockInput[];
}

// ============================================
// Default Templates
// ============================================

const DEFAULT_TEMPLATES: NotionPageTemplate[] = [
  {
    id: 'success_plan',
    name: 'Success Plan',
    type: 'success_plan',
    defaultProperties: {},
    contentBlocks: [
      { type: 'heading_1', content: 'Customer Success Plan' },
      { type: 'heading_2', content: 'Executive Summary' },
      { type: 'paragraph', content: '' },
      { type: 'heading_2', content: 'Goals & Objectives' },
      { type: 'bulleted_list_item', content: 'Primary Goal:' },
      { type: 'bulleted_list_item', content: 'Secondary Goal:' },
      { type: 'heading_2', content: 'Success Metrics' },
      { type: 'paragraph', content: '' },
      { type: 'heading_2', content: 'Timeline & Milestones' },
      { type: 'paragraph', content: '' },
      { type: 'heading_2', content: 'Risks & Mitigation' },
      { type: 'paragraph', content: '' },
    ],
  },
  {
    id: 'meeting_notes',
    name: 'Meeting Notes',
    type: 'meeting_notes',
    defaultProperties: {},
    contentBlocks: [
      { type: 'heading_1', content: 'Meeting Notes' },
      { type: 'heading_2', content: 'Attendees' },
      { type: 'bulleted_list_item', content: '' },
      { type: 'heading_2', content: 'Agenda' },
      { type: 'numbered_list_item', content: '' },
      { type: 'heading_2', content: 'Discussion Notes' },
      { type: 'paragraph', content: '' },
      { type: 'heading_2', content: 'Action Items' },
      { type: 'to_do', content: '' },
      { type: 'heading_2', content: 'Next Steps' },
      { type: 'paragraph', content: '' },
    ],
  },
  {
    id: 'project_brief',
    name: 'Project Brief',
    type: 'project_brief',
    defaultProperties: {},
    contentBlocks: [
      { type: 'heading_1', content: 'Project Brief' },
      { type: 'heading_2', content: 'Overview' },
      { type: 'paragraph', content: '' },
      { type: 'heading_2', content: 'Objectives' },
      { type: 'bulleted_list_item', content: '' },
      { type: 'heading_2', content: 'Scope' },
      { type: 'paragraph', content: '' },
      { type: 'heading_2', content: 'Timeline' },
      { type: 'paragraph', content: '' },
      { type: 'heading_2', content: 'Resources' },
      { type: 'bulleted_list_item', content: '' },
      { type: 'heading_2', content: 'Success Criteria' },
      { type: 'bulleted_list_item', content: '' },
    ],
  },
];

// ============================================
// Notion Service Class
// ============================================

export class NotionService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private apiVersion = '2022-06-28';
  private baseUrl = 'https://api.notion.com/v1';

  constructor() {
    this.clientId = process.env.NOTION_CLIENT_ID || '';
    this.clientSecret = process.env.NOTION_CLIENT_SECRET || '';
    this.redirectUri =
      process.env.NOTION_REDIRECT_URI ||
      'http://localhost:3001/api/integrations/notion/callback';
  }

  /**
   * Check if Notion integration is configured
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
      response_type: 'code',
      owner: 'user',
      state,
    });

    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async connect(code: string): Promise<NotionConnection> {
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString('base64');

    const response = await withRetry(
      async () => {
        return notionCircuitBreaker.execute(async () => {
          const res = await fetch(`${this.baseUrl}/oauth/token`, {
            method: 'POST',
            headers: {
              Authorization: `Basic ${credentials}`,
              'Content-Type': 'application/json',
              'Notion-Version': this.apiVersion,
            },
            body: JSON.stringify({
              grant_type: 'authorization_code',
              code,
              redirect_uri: this.redirectUri,
            }),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`Notion OAuth failed: ${error}`);
          }

          return res.json();
        });
      },
      {
        ...retryStrategies.aiService,
        maxRetries: 2,
        onRetry: (attempt, error) => {
          console.log(`[Notion] OAuth retry attempt ${attempt}: ${error.message}`);
        },
      }
    );

    return {
      accessToken: response.access_token,
      workspaceId: response.workspace_id,
      workspaceName: response.workspace_name,
      workspaceIcon: response.workspace_icon,
      botId: response.bot_id,
    };
  }

  /**
   * Make authenticated API request to Notion
   */
  private async request<T>(
    connection: NotionConnection,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${this.baseUrl}${endpoint}`;

    const response = await withRetry(
      async () => {
        return notionCircuitBreaker.execute(async () => {
          const res = await fetch(url, {
            ...options,
            headers: {
              Authorization: `Bearer ${connection.accessToken}`,
              'Notion-Version': this.apiVersion,
              'Content-Type': 'application/json',
              ...options.headers,
            },
          });

          if (!res.ok) {
            const error = await res.text();
            if (res.status === 401) {
              throw new Error('TOKEN_EXPIRED');
            }
            throw new Error(`Notion API failed: ${error}`);
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
   * Search Notion pages
   */
  async search(
    connection: NotionConnection,
    query: string,
    options: {
      filter?: 'page' | 'database';
      startCursor?: string;
      pageSize?: number;
    } = {}
  ): Promise<NotionSearchResult> {
    const body: Record<string, unknown> = {
      query,
      page_size: options.pageSize || 20,
    };

    if (options.filter) {
      body.filter = { property: 'object', value: options.filter };
    }

    if (options.startCursor) {
      body.start_cursor = options.startCursor;
    }

    const response = await this.request<{
      results: unknown[];
      has_more: boolean;
      next_cursor?: string;
    }>(connection, '/search', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const pages = response.results
      .filter((r: any) => r.object === 'page')
      .map((page: any) => this.mapPageResult(page));

    return {
      pages,
      total: response.results.length,
      hasMore: response.has_more,
      nextCursor: response.next_cursor,
    };
  }

  /**
   * Get a specific page
   */
  async getPage(connection: NotionConnection, pageId: string): Promise<NotionPage> {
    const response = await this.request<any>(connection, `/pages/${pageId}`);
    return this.mapPageResult(response);
  }

  /**
   * Get page content as blocks
   */
  async getPageContent(
    connection: NotionConnection,
    pageId: string
  ): Promise<NotionBlock[]> {
    const response = await this.request<{ results: any[] }>(
      connection,
      `/blocks/${pageId}/children`
    );

    return response.results.map((block) => this.mapBlockResult(block));
  }

  /**
   * Get page content as markdown
   */
  async getPageMarkdown(
    connection: NotionConnection,
    pageId: string
  ): Promise<string> {
    const blocks = await this.getPageContent(connection, pageId);
    return this.blocksToMarkdown(blocks);
  }

  /**
   * Convert blocks to markdown
   */
  private blocksToMarkdown(blocks: NotionBlock[], depth = 0): string {
    const indent = '  '.repeat(depth);
    let markdown = '';

    for (const block of blocks) {
      switch (block.type) {
        case 'heading_1':
          markdown += `# ${block.content}\n\n`;
          break;
        case 'heading_2':
          markdown += `## ${block.content}\n\n`;
          break;
        case 'heading_3':
          markdown += `### ${block.content}\n\n`;
          break;
        case 'paragraph':
          markdown += `${indent}${block.content}\n\n`;
          break;
        case 'bulleted_list_item':
          markdown += `${indent}- ${block.content}\n`;
          break;
        case 'numbered_list_item':
          markdown += `${indent}1. ${block.content}\n`;
          break;
        case 'to_do':
          markdown += `${indent}- [ ] ${block.content}\n`;
          break;
        case 'code':
          markdown += `\`\`\`\n${block.content}\n\`\`\`\n\n`;
          break;
        case 'quote':
          markdown += `> ${block.content}\n\n`;
          break;
        case 'divider':
          markdown += '---\n\n';
          break;
        default:
          if (block.content) {
            markdown += `${block.content}\n\n`;
          }
      }

      if (block.children && block.children.length > 0) {
        markdown += this.blocksToMarkdown(block.children, depth + 1);
      }
    }

    return markdown;
  }

  /**
   * Map Notion API page result to our type
   */
  private mapPageResult(page: any): NotionPage {
    let title = 'Untitled';

    // Extract title from properties
    if (page.properties) {
      for (const [, prop] of Object.entries(page.properties) as [string, any][]) {
        if (prop.type === 'title' && prop.title?.[0]?.plain_text) {
          title = prop.title[0].plain_text;
          break;
        }
      }
    }

    return {
      id: page.id,
      notionPageId: page.id,
      title,
      url: page.url,
      icon: page.icon?.emoji || page.icon?.external?.url,
      cover: page.cover?.external?.url || page.cover?.file?.url,
      parentType: page.parent?.type || 'workspace',
      parentId: page.parent?.database_id || page.parent?.page_id,
      lastEditedAt: page.last_edited_time,
      lastEditedBy: page.last_edited_by?.id,
      properties: page.properties,
    };
  }

  /**
   * Map Notion API block result to our type
   */
  private mapBlockResult(block: any): NotionBlock {
    const type = block.type;
    let content = '';

    // Extract text content based on block type
    const blockContent = block[type];
    if (blockContent?.rich_text) {
      content = blockContent.rich_text
        .map((rt: any) => rt.plain_text)
        .join('');
    } else if (blockContent?.text) {
      content = blockContent.text;
    }

    return {
      id: block.id,
      type,
      hasChildren: block.has_children,
      content,
    };
  }

  /**
   * Create a new page
   */
  async createPage(
    connection: NotionConnection,
    options: {
      parentType: 'database' | 'page';
      parentId: string;
      title: string;
      properties?: Record<string, unknown>;
      content?: NotionBlockInput[];
      customerId?: string;
      customerName?: string;
    }
  ): Promise<NotionPage> {
    const parent =
      options.parentType === 'database'
        ? { database_id: options.parentId }
        : { page_id: options.parentId };

    const properties: Record<string, unknown> = {
      ...(options.properties || {}),
    };

    // Add title property
    if (options.parentType === 'database') {
      // For database pages, title is usually in a property
      properties.Name = {
        title: [{ text: { content: options.title } }],
      };
    } else {
      properties.title = {
        title: [{ text: { content: options.title } }],
      };
    }

    // Build request body
    const body: Record<string, unknown> = {
      parent,
      properties,
    };

    // Add content blocks
    if (options.content && options.content.length > 0) {
      body.children = options.content.map((block) =>
        this.buildBlockInput(block, options.customerName)
      );
    }

    const response = await this.request<any>(connection, '/pages', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return this.mapPageResult(response);
  }

  /**
   * Build block input for API
   */
  private buildBlockInput(
    block: NotionBlockInput,
    customerName?: string
  ): Record<string, unknown> {
    const content = block.content?.replace(
      /\{\{customer_name\}\}/g,
      customerName || ''
    );

    const richText = content
      ? [{ type: 'text', text: { content } }]
      : [];

    const blockData: Record<string, unknown> = {
      object: 'block',
      type: block.type,
      [block.type]: {
        rich_text: richText,
      },
    };

    // Handle to_do blocks specially
    if (block.type === 'to_do') {
      blockData[block.type] = {
        rich_text: richText,
        checked: false,
      };
    }

    return blockData;
  }

  /**
   * Create page from template
   */
  async createPageFromTemplate(
    connection: NotionConnection,
    options: {
      templateId: string;
      parentType: 'database' | 'page';
      parentId: string;
      title: string;
      customerId?: string;
      customerName?: string;
      additionalProperties?: Record<string, unknown>;
    }
  ): Promise<NotionPage> {
    const template = DEFAULT_TEMPLATES.find((t) => t.id === options.templateId);

    if (!template) {
      throw new Error(`Template not found: ${options.templateId}`);
    }

    return this.createPage(connection, {
      parentType: options.parentType,
      parentId: options.parentId,
      title: options.title,
      properties: {
        ...template.defaultProperties,
        ...options.additionalProperties,
      },
      content: template.contentBlocks,
      customerId: options.customerId,
      customerName: options.customerName,
    });
  }

  /**
   * List databases accessible to the integration
   */
  async listDatabases(connection: NotionConnection): Promise<NotionDatabase[]> {
    const response = await this.request<{ results: any[] }>(connection, '/search', {
      method: 'POST',
      body: JSON.stringify({
        filter: { property: 'object', value: 'database' },
        page_size: 100,
      }),
    });

    return response.results.map((db) => ({
      id: db.id,
      title: db.title?.[0]?.plain_text || 'Untitled',
      description: db.description?.[0]?.plain_text,
      icon: db.icon?.emoji || db.icon?.external?.url,
      url: db.url,
      properties: Object.entries(db.properties || {}).map(
        ([name, prop]: [string, any]) => ({
          id: prop.id,
          name,
          type: prop.type,
          options: prop.select?.options || prop.multi_select?.options,
        })
      ),
    }));
  }

  /**
   * Query a database
   */
  async queryDatabase(
    connection: NotionConnection,
    databaseId: string,
    options: {
      filter?: Record<string, unknown>;
      sorts?: Array<{ property: string; direction: 'ascending' | 'descending' }>;
      startCursor?: string;
      pageSize?: number;
    } = {}
  ): Promise<NotionSearchResult> {
    const body: Record<string, unknown> = {
      page_size: options.pageSize || 50,
    };

    if (options.filter) {
      body.filter = options.filter;
    }

    if (options.sorts) {
      body.sorts = options.sorts;
    }

    if (options.startCursor) {
      body.start_cursor = options.startCursor;
    }

    const response = await this.request<{
      results: any[];
      has_more: boolean;
      next_cursor?: string;
    }>(connection, `/databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const pages = response.results.map((page) => this.mapPageResult(page));

    return {
      pages,
      total: response.results.length,
      hasMore: response.has_more,
      nextCursor: response.next_cursor,
    };
  }

  /**
   * Sync pages for a customer
   */
  async syncCustomerPages(
    connection: NotionConnection,
    userId: string,
    customerId: string,
    customerName: string,
    options: {
      databaseIds?: string[];
      linkingMethod?: 'property' | 'tag' | 'search';
      propertyName?: string;
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

    const syncLog = await this.startSyncLog(userId, connection.id, 'pages', 'pull');
    result.syncLogId = syncLog?.id;

    try {
      // Search for pages mentioning the customer
      const searchResult = await this.search(connection, customerName, {
        filter: 'page',
        pageSize: 100,
      });

      for (const page of searchResult.pages) {
        try {
          // Get full page content
          const markdown = await this.getPageMarkdown(connection, page.notionPageId);

          // Check if page exists
          const { data: existing } = await supabase
            .from('notion_pages')
            .select('id, synced_at')
            .eq('notion_page_id', page.notionPageId)
            .single();

          const pageData = {
            notion_page_id: page.notionPageId,
            customer_id: customerId,
            title: page.title,
            content_markdown: markdown,
            page_url: page.url,
            icon: page.icon,
            cover: page.cover,
            parent_type: page.parentType,
            parent_id: page.parentId,
            last_edited_at: page.lastEditedAt,
            synced_at: new Date().toISOString(),
          };

          if (existing) {
            await supabase
              .from('notion_pages')
              .update(pageData)
              .eq('id', existing.id);
            result.updated++;
          } else {
            await supabase.from('notion_pages').insert(pageData);
            result.created++;
          }

          result.synced++;
        } catch (err) {
          result.errors.push(
            `Failed to sync page ${page.title}: ${(err as Error).message}`
          );
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
   * Get pages for a customer
   */
  async getCustomerPages(customerId: string): Promise<NotionPage[]> {
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('notion_pages')
      .select('*')
      .eq('customer_id', customerId)
      .order('last_edited_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      notionPageId: row.notion_page_id,
      title: row.title,
      url: row.page_url,
      icon: row.icon,
      cover: row.cover,
      parentType: row.parent_type,
      parentId: row.parent_id,
      lastEditedAt: row.last_edited_at,
      contentMarkdown: row.content_markdown,
    }));
  }

  /**
   * Save connection to database
   */
  async saveConnection(
    userId: string,
    connection: NotionConnection,
    config?: Partial<NotionSyncConfig>
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
          provider: 'notion',
          access_token: connection.accessToken,
          workspace_id: connection.workspaceId,
          workspace_name: connection.workspaceName,
          bot_id: connection.botId,
          sync_schedule: config?.syncSchedule || 'daily',
          sync_config: {
            customerLinkingMethod: config?.customerLinkingMethod || 'auto',
            customerPropertyName: config?.customerPropertyName,
            enabledDatabases: config?.enabledDatabases || [],
            indexForSearch: config?.indexForSearch ?? true,
            indexForAI: config?.indexForAI ?? true,
          },
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
  ): Promise<(NotionConnection & { id: string; config: Partial<NotionSyncConfig> }) | null> {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'notion')
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      accessToken: data.access_token,
      workspaceId: data.workspace_id,
      workspaceName: data.workspace_name,
      botId: data.bot_id,
      config: {
        syncSchedule: data.sync_schedule,
        ...data.sync_config,
      },
    };
  }

  /**
   * Update sync configuration
   */
  async updateSyncConfig(userId: string, config: Partial<NotionSyncConfig>): Promise<void> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const { error } = await supabase
      .from('integration_connections')
      .update({
        sync_schedule: config.syncSchedule,
        sync_config: config,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'notion');

    if (error) {
      throw new Error(`Failed to update config: ${error.message}`);
    }
  }

  /**
   * Disconnect Notion integration
   */
  async disconnect(userId: string): Promise<void> {
    if (!supabase) return;

    // Delete synced pages
    await supabase
      .from('notion_pages')
      .delete()
      .eq('user_id', userId);

    // Delete connection
    await supabase
      .from('integration_connections')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'notion');
  }

  /**
   * Get sync status
   */
  async getSyncStatus(userId: string): Promise<NotionSyncStatus> {
    if (!supabase) {
      return { connected: false };
    }

    const connection = await this.getConnection(userId);
    if (!connection) {
      return { connected: false };
    }

    // Get latest sync log
    const { data: latestSync } = await supabase
      .from('notion_sync_log')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    return {
      connected: true,
      workspaceName: connection.workspaceName,
      lastSyncAt: latestSync?.completed_at
        ? new Date(latestSync.completed_at)
        : undefined,
      lastSyncStatus: latestSync?.status,
      pagesSynced: latestSync?.records_processed,
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
      .from('notion_sync_log')
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
   * Get available templates
   */
  getTemplates(): NotionPageTemplate[] {
    return DEFAULT_TEMPLATES;
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
      .from('notion_sync_log')
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
      .from('notion_sync_log')
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
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return notionCircuitBreaker.getStats();
  }
}

// Singleton instance
export const notionService = new NotionService();
export default notionService;
