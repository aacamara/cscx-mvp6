/**
 * Jira Integration Service - PRD-201
 *
 * Implements Jira issue tracking integration:
 * - OAuth 2.0 (Cloud) and API token (Server/Data Center) authentication
 * - Issue sync with customer linking
 * - Webhook support for real-time updates
 * - Issue creation from CSCX.AI
 * - Impact analysis and SLA tracking
 * - CSM notification on status changes
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

// Circuit breaker for Jira API calls
const jiraCircuitBreaker = new CircuitBreaker('jira', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000, // 1 minute before retry
});

// ============================================
// Types
// ============================================

export interface JiraConnection {
  id?: string;
  baseUrl: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  authType: 'oauth' | 'api_token';
  email?: string; // Required for API token auth
  cloudId?: string; // Jira Cloud instance ID
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description?: string | { content: Array<{ content: Array<{ text: string }> }> };
    issuetype: { id: string; name: string };
    status: { id: string; name: string; statusCategory: { key: string } };
    priority?: { id: string; name: string };
    assignee?: { accountId: string; displayName: string; emailAddress?: string };
    reporter?: { accountId: string; displayName: string; emailAddress?: string };
    project: { id: string; key: string; name: string };
    labels?: string[];
    components?: Array<{ id: string; name: string }>;
    created: string;
    updated: string;
    resolutiondate?: string;
    resolution?: { id: string; name: string };
    [key: string]: unknown; // Custom fields
  };
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
}

export interface JiraSearchResult {
  expand: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

export interface JiraWebhookPayload {
  webhookEvent: string;
  timestamp: number;
  user?: {
    accountId: string;
    displayName: string;
  };
  issue?: JiraIssue;
  changelog?: {
    id: string;
    items: Array<{
      field: string;
      fieldtype: string;
      fieldId?: string;
      from?: string;
      fromString?: string;
      to?: string;
      toString?: string;
    }>;
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

export interface CustomerLinkConfig {
  type: 'custom_field' | 'label' | 'component' | 'jql';
  fieldId?: string; // For custom_field
  labelPrefix?: string; // For label (e.g., 'customer_')
  componentName?: string; // For component
  jqlTemplate?: string; // For JQL (e.g., 'labels = "{{customerId}}"')
}

export interface SyncConfig {
  syncSchedule: 'realtime' | 'hourly' | 'daily' | 'manual';
  customerLinkConfig: CustomerLinkConfig;
  syncClosedIssues: boolean;
  healthScoreWeight: number;
  projectKeys?: string[]; // Limit sync to specific projects
}

export interface SyncStatus {
  connected: boolean;
  lastSyncAt?: Date;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  recordsSynced?: number;
  syncErrors?: string[];
  nextScheduledSync?: Date;
}

export interface IssueMetrics {
  customerId: string;
  metricDate: Date;
  openBugs: number;
  openFeatureRequests: number;
  totalOpenIssues: number;
  resolvedLast7d: number;
  resolvedLast30d: number;
  avgResolutionDays: number | null;
  criticalIssues: number;
  highPriorityIssues: number;
}

export interface CreateIssueRequest {
  projectKey: string;
  summary: string;
  description: string;
  issueType: string;
  priority?: string;
  customerId: string;
  customerName?: string;
  healthScore?: number;
  stakeholderInfo?: string;
}

export type LinkType = 'affected' | 'requested' | 'watching';

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CUSTOMER_LINK_CONFIG: CustomerLinkConfig = {
  type: 'label',
  labelPrefix: 'customer_',
};

const DEFAULT_SYNC_CONFIG: Partial<SyncConfig> = {
  syncSchedule: 'hourly',
  customerLinkConfig: DEFAULT_CUSTOMER_LINK_CONFIG,
  syncClosedIssues: false,
  healthScoreWeight: 10,
};

// ============================================
// Jira Service Class
// ============================================

export class JiraService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.JIRA_CLIENT_ID || '';
    this.clientSecret = process.env.JIRA_CLIENT_SECRET || '';
    this.redirectUri =
      process.env.JIRA_REDIRECT_URI || 'http://localhost:3001/api/integrations/jira/callback';
  }

  /**
   * Check if Jira OAuth integration is configured
   */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Generate OAuth2 authorization URL for Jira Cloud
   */
  getAuthUrl(userId: string): string {
    const state = JSON.stringify({ userId });
    const encodedState = Buffer.from(state).toString('base64');

    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: this.clientId,
      scope: 'read:jira-work read:jira-user write:jira-work offline_access',
      redirect_uri: this.redirectUri,
      state: encodedState,
      response_type: 'code',
      prompt: 'consent',
    });

    return `https://auth.atlassian.com/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token (Jira Cloud OAuth 2.0)
   */
  async connect(code: string): Promise<JiraConnection> {
    const response = await withRetry(
      async () => {
        return jiraCircuitBreaker.execute(async () => {
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
            throw new Error(`Jira OAuth failed: ${error}`);
          }

          return res.json();
        });
      },
      {
        ...retryStrategies.aiService,
        maxRetries: 2,
        onRetry: (attempt, error) => {
          console.log(`[Jira] OAuth retry attempt ${attempt}: ${error.message}`);
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
      throw new Error('Failed to get accessible Jira resources');
    }

    const resources = await resourcesRes.json();
    if (!resources.length) {
      throw new Error('No accessible Jira sites found');
    }

    // Use the first available Jira site
    const site = resources[0];

    return {
      baseUrl: `https://api.atlassian.com/ex/jira/${site.id}`,
      cloudId: site.id,
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      tokenExpiresAt: response.expires_in
        ? new Date(Date.now() + response.expires_in * 1000)
        : undefined,
      authType: 'oauth',
    };
  }

  /**
   * Connect using API token (Jira Server/Data Center)
   */
  async connectWithApiToken(
    baseUrl: string,
    email: string,
    apiToken: string
  ): Promise<JiraConnection> {
    // Verify credentials by making a test request
    const credentials = Buffer.from(`${email}:${apiToken}`).toString('base64');

    const response = await withRetry(
      async () => {
        return jiraCircuitBreaker.execute(async () => {
          const res = await fetch(`${baseUrl}/rest/api/3/myself`, {
            headers: {
              Authorization: `Basic ${credentials}`,
              'Content-Type': 'application/json',
            },
          });

          if (!res.ok) {
            throw new Error('Invalid Jira API credentials');
          }

          return res.json();
        });
      },
      { ...retryStrategies.aiService, maxRetries: 2 }
    );

    return {
      baseUrl,
      accessToken: apiToken,
      email,
      authType: 'api_token',
    };
  }

  /**
   * Refresh OAuth token if expired
   */
  async refreshTokenIfNeeded(connection: JiraConnection): Promise<JiraConnection> {
    if (connection.authType !== 'oauth' || !connection.refreshToken) {
      return connection;
    }

    // Check if token expires within 5 minutes
    if (connection.tokenExpiresAt && connection.tokenExpiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
      return connection;
    }

    console.log('[Jira] Refreshing OAuth token...');

    const response = await fetch('https://auth.atlassian.com/oauth/token', {
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

    if (!response.ok) {
      throw new Error('Failed to refresh Jira token');
    }

    const data = await response.json();

    return {
      ...connection,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || connection.refreshToken,
      tokenExpiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  /**
   * Get authorization header based on auth type
   */
  private getAuthHeader(connection: JiraConnection): string {
    if (connection.authType === 'api_token' && connection.email) {
      const credentials = Buffer.from(`${connection.email}:${connection.accessToken}`).toString(
        'base64'
      );
      return `Basic ${credentials}`;
    }
    return `Bearer ${connection.accessToken}`;
  }

  /**
   * Make authenticated API request to Jira
   */
  async apiRequest<T>(
    connection: JiraConnection,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Refresh token if needed
    const activeConnection = await this.refreshTokenIfNeeded(connection);
    const url = `${activeConnection.baseUrl}/rest/api/3${endpoint}`;

    const response = await withRetry(
      async () => {
        return jiraCircuitBreaker.execute(async () => {
          const res = await fetch(url, {
            ...options,
            headers: {
              Authorization: this.getAuthHeader(activeConnection),
              'Content-Type': 'application/json',
              Accept: 'application/json',
              ...options.headers,
            },
          });

          if (!res.ok) {
            const error = await res.text();
            if (res.status === 401) {
              throw new Error('TOKEN_EXPIRED');
            }
            if (res.status === 429) {
              const retryAfter = res.headers.get('Retry-After');
              throw new Error(`RATE_LIMITED:${retryAfter || 60}`);
            }
            throw new Error(`Jira API error (${res.status}): ${error}`);
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
   * Search issues using JQL
   */
  async searchIssues(
    connection: JiraConnection,
    jql: string,
    options: { startAt?: number; maxResults?: number; fields?: string[] } = {}
  ): Promise<JiraSearchResult> {
    const { startAt = 0, maxResults = 50, fields = ['*all'] } = options;

    const params = new URLSearchParams({
      jql,
      startAt: startAt.toString(),
      maxResults: maxResults.toString(),
      fields: fields.join(','),
    });

    return this.apiRequest(connection, `/search?${params.toString()}`);
  }

  /**
   * Get single issue by key
   */
  async getIssue(connection: JiraConnection, issueKey: string): Promise<JiraIssue> {
    const result = await this.apiRequest<{ fields: JiraIssue['fields']; id: string; key: string; self: string }>(
      connection,
      `/issue/${issueKey}`
    );
    return result as JiraIssue;
  }

  /**
   * Create a new issue in Jira
   */
  async createIssue(
    connection: JiraConnection,
    request: CreateIssueRequest
  ): Promise<{ id: string; key: string; self: string }> {
    const linkConfig = await this.getLinkConfig(connection);

    // Build issue fields
    const fields: Record<string, unknown> = {
      project: { key: request.projectKey },
      summary: request.summary,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: request.description }],
          },
        ],
      },
      issuetype: { name: request.issueType },
    };

    if (request.priority) {
      fields.priority = { name: request.priority };
    }

    // Add customer link based on config
    if (linkConfig.type === 'label') {
      fields.labels = [`${linkConfig.labelPrefix || 'customer_'}${request.customerId}`];
    } else if (linkConfig.type === 'custom_field' && linkConfig.fieldId) {
      fields[linkConfig.fieldId] = request.customerId;
    }

    // Add context to description
    if (request.customerName || request.healthScore !== undefined || request.stakeholderInfo) {
      const contextLines = [
        '---',
        'CSCX.AI Context:',
        request.customerName ? `Customer: ${request.customerName}` : '',
        request.healthScore !== undefined ? `Health Score: ${request.healthScore}` : '',
        request.stakeholderInfo ? `Stakeholder: ${request.stakeholderInfo}` : '',
        '---',
        '',
        request.description,
      ].filter(Boolean);

      fields.description = {
        type: 'doc',
        version: 1,
        content: contextLines.map((line) => ({
          type: 'paragraph',
          content: [{ type: 'text', text: line }],
        })),
      };
    }

    return this.apiRequest(connection, '/issue', {
      method: 'POST',
      body: JSON.stringify({ fields }),
    });
  }

  /**
   * Get available projects
   */
  async getProjects(connection: JiraConnection): Promise<JiraProject[]> {
    const result = await this.apiRequest<JiraProject[]>(connection, '/project');
    return result;
  }

  /**
   * Get issue types for a project
   */
  async getIssueTypes(
    connection: JiraConnection,
    projectKey: string
  ): Promise<Array<{ id: string; name: string; subtask: boolean }>> {
    const result = await this.apiRequest<{ issueTypes: Array<{ id: string; name: string; subtask: boolean }> }>(
      connection,
      `/project/${projectKey}`
    );
    return result.issueTypes;
  }

  /**
   * Build JQL for customer issues
   */
  private buildCustomerJQL(customerId: string, linkConfig: CustomerLinkConfig): string {
    switch (linkConfig.type) {
      case 'label':
        return `labels = "${linkConfig.labelPrefix || 'customer_'}${customerId}"`;
      case 'custom_field':
        return `"${linkConfig.fieldId}" = "${customerId}"`;
      case 'component':
        return `component = "${linkConfig.componentName || customerId}"`;
      case 'jql':
        return (linkConfig.jqlTemplate || '').replace('{{customerId}}', customerId);
      default:
        return `labels = "customer_${customerId}"`;
    }
  }

  /**
   * Get link config from connection or default
   */
  private async getLinkConfig(connection: JiraConnection): Promise<CustomerLinkConfig> {
    if (!supabase || !connection.id) {
      return DEFAULT_CUSTOMER_LINK_CONFIG;
    }

    const { data } = await supabase
      .from('integration_connections')
      .select('customer_link_config')
      .eq('id', connection.id)
      .single();

    return data?.customer_link_config || DEFAULT_CUSTOMER_LINK_CONFIG;
  }

  /**
   * Sync issues for a specific customer
   */
  async syncCustomerIssues(
    connection: JiraConnection,
    userId: string,
    customerId: string
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

    try {
      const linkConfig = await this.getLinkConfig(connection);
      const jql = this.buildCustomerJQL(customerId, linkConfig);

      let startAt = 0;
      const maxResults = 50;
      let hasMore = true;

      while (hasMore) {
        const searchResult = await this.searchIssues(connection, jql, {
          startAt,
          maxResults,
          fields: [
            'summary',
            'description',
            'issuetype',
            'status',
            'priority',
            'assignee',
            'reporter',
            'project',
            'labels',
            'components',
            'created',
            'updated',
            'resolutiondate',
            'resolution',
          ],
        });

        for (const issue of searchResult.issues) {
          try {
            await this.upsertIssue(issue, customerId);
            result.synced++;
            result.created++; // We're upserting, so count as created for simplicity
          } catch (err) {
            result.errors.push(`Failed to sync issue ${issue.key}: ${(err as Error).message}`);
          }
        }

        startAt += maxResults;
        hasMore = startAt < searchResult.total;

        // Rate limiting delay
        if (hasMore) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      result.errors.push(`Sync failed: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Sync all issues (for configured customers)
   */
  async syncAllIssues(
    connection: JiraConnection,
    userId: string,
    options: { incremental?: boolean; lastSyncAt?: Date } = {}
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

    // Start sync log
    const syncLog = await this.startSyncLog(userId, connection.id, 'issues', options.incremental ? 'incremental' : 'full');
    result.syncLogId = syncLog?.id;

    try {
      // Get all customers with Jira linking
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name, jira_customer_id');

      if (!customers || customers.length === 0) {
        result.errors.push('No customers configured for Jira sync');
        await this.completeSyncLog(syncLog?.id, result, 'completed');
        return result;
      }

      const linkConfig = await this.getLinkConfig(connection);

      // Build JQL for modified issues (if incremental)
      let baseJql = '';
      if (options.incremental && options.lastSyncAt) {
        const sinceDate = options.lastSyncAt.toISOString().split('T')[0];
        baseJql = `updated >= "${sinceDate}"`;
      }

      // Sync issues for each customer
      for (const customer of customers) {
        const customerId = customer.jira_customer_id || customer.id;
        const customerJql = this.buildCustomerJQL(customerId, linkConfig);
        const jql = baseJql ? `(${customerJql}) AND (${baseJql})` : customerJql;

        try {
          let startAt = 0;
          const maxResults = 50;
          let hasMore = true;

          while (hasMore) {
            const searchResult = await this.searchIssues(connection, jql, {
              startAt,
              maxResults,
            });

            for (const issue of searchResult.issues) {
              try {
                const isNew = await this.upsertIssue(issue, customer.id);
                result.synced++;
                if (isNew) {
                  result.created++;
                } else {
                  result.updated++;
                }
              } catch (err) {
                result.errors.push(`Failed to sync issue ${issue.key}: ${(err as Error).message}`);
              }
            }

            startAt += maxResults;
            hasMore = startAt < searchResult.total;

            // Rate limiting delay
            if (hasMore) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
        } catch (err) {
          result.errors.push(`Failed to sync customer ${customer.name}: ${(err as Error).message}`);
        }
      }

      // Recalculate metrics for all customers
      await this.recalculateMetrics(userId, customers.map((c) => c.id));

      await this.completeSyncLog(syncLog?.id, result, 'completed');
    } catch (error) {
      result.errors.push(`Sync failed: ${(error as Error).message}`);
      await this.completeSyncLog(syncLog?.id, result, 'failed');
    }

    return result;
  }

  /**
   * Upsert issue to database
   */
  private async upsertIssue(issue: JiraIssue, customerId: string): Promise<boolean> {
    if (!supabase) return false;

    // Extract description text
    let descriptionText = '';
    if (typeof issue.fields.description === 'string') {
      descriptionText = issue.fields.description;
    } else if (issue.fields.description?.content) {
      descriptionText = issue.fields.description.content
        .map((block) => block.content?.map((c) => c.text).join('') || '')
        .join('\n');
    }

    const issueData = {
      jira_key: issue.key,
      jira_id: issue.id,
      project_key: issue.fields.project.key,
      summary: issue.fields.summary,
      description: descriptionText?.substring(0, 10000),
      issue_type: issue.fields.issuetype.name,
      status: issue.fields.status.name,
      status_category: issue.fields.status.statusCategory.key,
      priority: issue.fields.priority?.name || null,
      assignee: issue.fields.assignee?.displayName || null,
      assignee_email: issue.fields.assignee?.emailAddress || null,
      reporter: issue.fields.reporter?.displayName || null,
      labels: issue.fields.labels || [],
      components: issue.fields.components?.map((c) => c.name) || [],
      jira_created_at: issue.fields.created,
      jira_updated_at: issue.fields.updated,
      resolved_at: issue.fields.resolutiondate || null,
      resolution: issue.fields.resolution?.name || null,
    };

    // Check if issue exists
    const { data: existing } = await supabase
      .from('jira_issues')
      .select('id')
      .eq('jira_key', issue.key)
      .single();

    if (existing) {
      await supabase.from('jira_issues').update(issueData).eq('id', existing.id);

      // Update or create customer link
      await supabase.from('jira_customer_links').upsert(
        {
          jira_key: issue.key,
          customer_id: customerId,
          link_type: 'affected',
        },
        { onConflict: 'jira_key,customer_id' }
      );

      return false;
    }

    // Insert new issue
    await supabase.from('jira_issues').insert(issueData);

    // Create customer link
    await supabase.from('jira_customer_links').insert({
      jira_key: issue.key,
      customer_id: customerId,
      link_type: 'affected',
    });

    return true;
  }

  /**
   * Recalculate issue metrics for customers
   */
  async recalculateMetrics(userId: string, customerIds: string[]): Promise<void> {
    if (!supabase || customerIds.length === 0) return;

    const today = new Date().toISOString().split('T')[0];

    for (const customerId of customerIds) {
      try {
        // Get issues linked to this customer
        const { data: links } = await supabase
          .from('jira_customer_links')
          .select('jira_key')
          .eq('customer_id', customerId);

        if (!links || links.length === 0) continue;

        const jiraKeys = links.map((l) => l.jira_key);

        const { data: issues } = await supabase
          .from('jira_issues')
          .select('*')
          .in('jira_key', jiraKeys);

        if (!issues || issues.length === 0) continue;

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Calculate metrics
        const openIssues = issues.filter((i) => i.status_category !== 'done');
        const openBugs = openIssues.filter((i) =>
          ['bug', 'defect'].includes(i.issue_type?.toLowerCase() || '')
        ).length;
        const openFeatureRequests = openIssues.filter((i) =>
          ['story', 'feature', 'new feature', 'improvement'].includes(i.issue_type?.toLowerCase() || '')
        ).length;

        const resolvedIssues = issues.filter((i) => i.resolved_at);
        const resolvedLast7d = resolvedIssues.filter(
          (i) => new Date(i.resolved_at) >= sevenDaysAgo
        ).length;
        const resolvedLast30d = resolvedIssues.filter(
          (i) => new Date(i.resolved_at) >= thirtyDaysAgo
        ).length;

        // Calculate average resolution time
        let avgResolutionDays: number | null = null;
        const recentlyResolved = resolvedIssues.filter(
          (i) => new Date(i.resolved_at) >= thirtyDaysAgo
        );
        if (recentlyResolved.length > 0) {
          const totalDays = recentlyResolved.reduce((sum, i) => {
            const created = new Date(i.jira_created_at);
            const resolved = new Date(i.resolved_at);
            return sum + (resolved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
          }, 0);
          avgResolutionDays = Math.round((totalDays / recentlyResolved.length) * 10) / 10;
        }

        const criticalIssues = openIssues.filter((i) =>
          ['highest', 'critical', 'blocker'].includes(i.priority?.toLowerCase() || '')
        ).length;
        const highPriorityIssues = openIssues.filter((i) =>
          ['high'].includes(i.priority?.toLowerCase() || '')
        ).length;

        // Upsert metrics
        await supabase.from('jira_metrics').upsert(
          {
            customer_id: customerId,
            metric_date: today,
            open_bugs: openBugs,
            open_feature_requests: openFeatureRequests,
            total_open_issues: openIssues.length,
            resolved_last_7d: resolvedLast7d,
            resolved_last_30d: resolvedLast30d,
            avg_resolution_days: avgResolutionDays,
            critical_issues: criticalIssues,
            high_priority_issues: highPriorityIssues,
          },
          { onConflict: 'customer_id,metric_date' }
        );
      } catch (error) {
        console.error(`Failed to recalculate metrics for customer ${customerId}:`, error);
      }
    }
  }

  /**
   * Process webhook from Jira
   */
  async processWebhook(
    userId: string,
    payload: JiraWebhookPayload
  ): Promise<{ processed: boolean; alerts: string[] }> {
    const alerts: string[] = [];

    if (!supabase || !payload.issue) {
      return { processed: false, alerts };
    }

    try {
      const issue = payload.issue;

      // Find linked customers
      const { data: links } = await supabase
        .from('jira_customer_links')
        .select('customer_id')
        .eq('jira_key', issue.key);

      if (!links || links.length === 0) {
        // Try to find customer from labels
        const labels = issue.fields.labels || [];
        const customerLabel = labels.find((l) => l.startsWith('customer_'));
        if (customerLabel) {
          const customerId = customerLabel.replace('customer_', '');
          const { data: customer } = await supabase
            .from('customers')
            .select('id')
            .eq('jira_customer_id', customerId)
            .single();

          if (customer) {
            await this.upsertIssue(issue, customer.id);

            // Check for alerts
            if (payload.changelog) {
              const statusChange = payload.changelog.items.find((i) => i.field === 'status');
              if (statusChange?.toString?.toLowerCase() === 'done') {
                alerts.push(`issue_resolved:${customer.id}:${issue.key}`);
              }

              const priorityChange = payload.changelog.items.find((i) => i.field === 'priority');
              if (priorityChange && ['highest', 'critical', 'blocker'].includes(priorityChange.toString?.toLowerCase() || '')) {
                alerts.push(`priority_escalated:${customer.id}:${issue.key}`);
              }
            }

            // Recalculate metrics
            await this.recalculateMetrics(userId, [customer.id]);

            return { processed: true, alerts };
          }
        }

        return { processed: false, alerts };
      }

      // Update issue for all linked customers
      for (const link of links) {
        await this.upsertIssue(issue, link.customer_id);

        // Check for alerts
        if (payload.changelog) {
          const statusChange = payload.changelog.items.find((i) => i.field === 'status');
          if (statusChange?.toString?.toLowerCase() === 'done') {
            alerts.push(`issue_resolved:${link.customer_id}:${issue.key}`);
          }

          const priorityChange = payload.changelog.items.find((i) => i.field === 'priority');
          if (priorityChange && ['highest', 'critical', 'blocker'].includes(priorityChange.toString?.toLowerCase() || '')) {
            alerts.push(`priority_escalated:${link.customer_id}:${issue.key}`);
          }
        }
      }

      // Recalculate metrics
      await this.recalculateMetrics(userId, links.map((l) => l.customer_id));

      return { processed: true, alerts };
    } catch (error) {
      console.error('Jira webhook processing error:', error);
      return { processed: false, alerts };
    }
  }

  /**
   * Get issues for a specific customer
   */
  async getCustomerIssues(
    customerId: string,
    options: { status?: string; type?: string; limit?: number; offset?: number } = {}
  ): Promise<{ issues: unknown[]; total: number }> {
    if (!supabase) {
      return { issues: [], total: 0 };
    }

    const { limit = 20, offset = 0, status, type } = options;

    // Get linked jira keys
    const { data: links } = await supabase
      .from('jira_customer_links')
      .select('jira_key')
      .eq('customer_id', customerId);

    if (!links || links.length === 0) {
      return { issues: [], total: 0 };
    }

    const jiraKeys = links.map((l) => l.jira_key);

    let query = supabase
      .from('jira_issues')
      .select('*', { count: 'exact' })
      .in('jira_key', jiraKeys)
      .order('jira_updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (type) {
      query = query.eq('issue_type', type);
    }

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Failed to get issues: ${error.message}`);
    }

    return { issues: data || [], total: count || 0 };
  }

  /**
   * Get single issue details
   */
  async getIssueByKey(issueKey: string): Promise<unknown | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('jira_issues')
      .select('*')
      .eq('jira_key', issueKey)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Get customers affected by an issue
   */
  async getAffectedCustomers(issueKey: string): Promise<unknown[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('jira_customer_links')
      .select(`
        customer_id,
        link_type,
        customers (
          id,
          name,
          health_score
        )
      `)
      .eq('jira_key', issueKey);

    if (error) return [];
    return data || [];
  }

  /**
   * Get issue metrics for a customer
   */
  async getCustomerMetrics(
    customerId: string,
    options: { days?: number } = {}
  ): Promise<IssueMetrics[]> {
    if (!supabase) return [];

    const { days = 30 } = options;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('jira_metrics')
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
   * Update customer linking configuration
   */
  async updateCustomerLink(
    customerId: string,
    jiraCustomerId: string
  ): Promise<void> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    await supabase
      .from('customers')
      .update({ jira_customer_id: jiraCustomerId })
      .eq('id', customerId);
  }

  /**
   * Add issue-customer link with specific type
   */
  async linkIssueToCustomer(
    issueKey: string,
    customerId: string,
    linkType: LinkType = 'affected'
  ): Promise<void> {
    if (!supabase) {
      throw new Error('Database not configured');
    }

    await supabase.from('jira_customer_links').upsert(
      {
        jira_key: issueKey,
        customer_id: customerId,
        link_type: linkType,
      },
      { onConflict: 'jira_key,customer_id' }
    );
  }

  /**
   * Save connection to database
   */
  async saveConnection(
    userId: string,
    connection: JiraConnection,
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
          provider: 'jira',
          base_url: connection.baseUrl,
          cloud_id: connection.cloudId || null,
          access_token: connection.accessToken,
          refresh_token: connection.refreshToken || null,
          token_expires_at: connection.tokenExpiresAt?.toISOString() || null,
          auth_type: connection.authType,
          email: connection.email || null,
          customer_link_config: config?.customerLinkConfig || DEFAULT_CUSTOMER_LINK_CONFIG,
          sync_schedule: config?.syncSchedule || 'hourly',
          sync_closed_issues: config?.syncClosedIssues ?? false,
          health_score_weight: config?.healthScoreWeight ?? 10,
          project_keys: config?.projectKeys || null,
          webhook_secret: webhookSecret,
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
  async getConnection(userId: string): Promise<(JiraConnection & { id: string; config: Partial<SyncConfig> }) | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'jira')
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      baseUrl: data.base_url,
      cloudId: data.cloud_id,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt: data.token_expires_at ? new Date(data.token_expires_at) : undefined,
      authType: data.auth_type || 'api_token',
      email: data.email,
      config: {
        customerLinkConfig: data.customer_link_config,
        syncSchedule: data.sync_schedule,
        syncClosedIssues: data.sync_closed_issues,
        healthScoreWeight: data.health_score_weight,
        projectKeys: data.project_keys,
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
    if (config.customerLinkConfig) updateData.customer_link_config = config.customerLinkConfig;
    if (config.syncClosedIssues !== undefined) updateData.sync_closed_issues = config.syncClosedIssues;
    if (config.healthScoreWeight !== undefined) updateData.health_score_weight = config.healthScoreWeight;
    if (config.projectKeys) updateData.project_keys = config.projectKeys;

    const { error } = await supabase
      .from('integration_connections')
      .update(updateData)
      .eq('user_id', userId)
      .eq('provider', 'jira');

    if (error) {
      throw new Error(`Failed to update config: ${error.message}`);
    }
  }

  /**
   * Disconnect Jira integration
   */
  async disconnect(userId: string): Promise<void> {
    if (!supabase) return;

    await supabase.from('integration_connections').delete().eq('user_id', userId).eq('provider', 'jira');
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
      .from('jira_sync_log')
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
      .from('jira_sync_log')
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
      .from('jira_sync_log')
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
      .from('jira_sync_log')
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
    return jiraCircuitBreaker.getStats();
  }
}

// Singleton instance
export const jiraService = new JiraService();
export default jiraService;
