/**
 * Linear Integration Service - PRD-202
 *
 * Implements Linear Issue Integration:
 * - OAuth 2.0 authentication
 * - Issue sync by customer labels
 * - Customer-issue linking
 * - Real-time webhook processing
 * - Issue creation with customer context
 * - State change notifications
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

// Circuit breaker for Linear API calls
const linearCircuitBreaker = new CircuitBreaker('linear', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000, // 1 minute before retry
});

// ============================================
// Types
// ============================================

export interface LinearConnection {
  id?: string;
  accessToken: string;
  tokenType: string;
  expiresIn?: number;
  tokenExpiresAt?: Date;
  scope?: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  state: {
    id: string;
    name: string;
    type: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
    color: string;
  };
  priority: number; // 0=No priority, 1=Urgent, 2=High, 3=Normal, 4=Low
  priorityLabel: string;
  assignee?: {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
  };
  team: {
    id: string;
    name: string;
    key: string;
  };
  project?: {
    id: string;
    name: string;
  };
  cycle?: {
    id: string;
    name: string;
    number: number;
  };
  labels: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  dueDate?: string;
  estimate?: number;
  url: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  canceledAt?: string;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface LinearLabel {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface LinearProject {
  id: string;
  name: string;
  description?: string;
  state: string;
  startDate?: string;
  targetDate?: string;
}

export interface LinearUser {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  active: boolean;
}

export interface IssueCreateInput {
  teamId: string;
  title: string;
  description?: string;
  priority?: number;
  labelIds?: string[];
  projectId?: string;
  assigneeId?: string;
  dueDate?: string;
  estimate?: number;
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
  customerLabelPrefix: string; // e.g., "customer:" for labels like "customer:acmecorp"
  includeInHealthScore: boolean;
  notifyOnCompletion: boolean;
  notifyOnPriorityChange: boolean;
}

export interface SyncStatus {
  connected: boolean;
  lastSyncAt?: Date;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  issuesSynced?: number;
  syncErrors?: string[];
  nextScheduledSync?: Date;
}

export interface CustomerIssueLink {
  id: string;
  linearId: string;
  customerId: string;
  createdAt: Date;
}

export interface WebhookPayload {
  action: 'create' | 'update' | 'remove';
  type: 'Issue' | 'Comment' | 'Project' | 'Cycle';
  createdAt: string;
  data: Record<string, unknown>;
  url?: string;
  organizationId?: string;
  webhookId?: string;
  webhookTimestamp?: number;
}

// ============================================
// Linear Service Class
// ============================================

export class LinearService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private apiUrl = 'https://api.linear.app/graphql';
  private oauthUrl = 'https://linear.app/oauth/authorize';
  private tokenUrl = 'https://api.linear.app/oauth/token';

  constructor() {
    this.clientId = process.env.LINEAR_CLIENT_ID || '';
    this.clientSecret = process.env.LINEAR_CLIENT_SECRET || '';
    this.redirectUri =
      process.env.LINEAR_REDIRECT_URI ||
      'http://localhost:3001/api/integrations/linear/callback';
  }

  /**
   * Check if Linear integration is configured
   */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthUrl(userId: string): string {
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    const scopes = ['read', 'write', 'issues:create', 'comments:create'];

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes.join(','),
      state,
      prompt: 'consent',
    });

    return `${this.oauthUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async connect(code: string): Promise<LinearConnection> {
    const response = await withRetry(
      async () => {
        return linearCircuitBreaker.execute(async () => {
          const res = await fetch(this.tokenUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              code,
              client_id: this.clientId,
              client_secret: this.clientSecret,
              redirect_uri: this.redirectUri,
              grant_type: 'authorization_code',
            }),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`Linear OAuth failed: ${error}`);
          }

          return res.json();
        });
      },
      {
        ...retryStrategies.aiService,
        maxRetries: 2,
        onRetry: (attempt, error) => {
          console.log(`[Linear] OAuth retry attempt ${attempt}: ${error.message}`);
        },
      }
    );

    return {
      accessToken: response.access_token,
      tokenType: response.token_type || 'Bearer',
      expiresIn: response.expires_in,
      scope: response.scope,
    };
  }

  /**
   * Make GraphQL request to Linear API
   */
  private async graphqlRequest<T>(
    connection: LinearConnection,
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const response = await withRetry(
      async () => {
        return linearCircuitBreaker.execute(async () => {
          const res = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
              Authorization: `${connection.tokenType} ${connection.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, variables }),
          });

          if (!res.ok) {
            const error = await res.text();
            if (res.status === 401) {
              throw new Error('TOKEN_EXPIRED');
            }
            throw new Error(`Linear API error: ${error}`);
          }

          const json = await res.json();

          if (json.errors) {
            throw new Error(`Linear GraphQL error: ${JSON.stringify(json.errors)}`);
          }

          return json.data;
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
   * Get current user info
   */
  async getCurrentUser(connection: LinearConnection): Promise<LinearUser> {
    const query = `
      query {
        viewer {
          id
          name
          email
          avatarUrl
          active
        }
      }
    `;

    const data = await this.graphqlRequest<{ viewer: LinearUser }>(connection, query);
    return data.viewer;
  }

  /**
   * List all teams
   */
  async listTeams(connection: LinearConnection): Promise<LinearTeam[]> {
    const query = `
      query {
        teams {
          nodes {
            id
            name
            key
            description
            color
            icon
          }
        }
      }
    `;

    const data = await this.graphqlRequest<{ teams: { nodes: LinearTeam[] } }>(connection, query);
    return data.teams.nodes;
  }

  /**
   * List labels for a team
   */
  async listLabels(connection: LinearConnection, teamId?: string): Promise<LinearLabel[]> {
    const query = `
      query($teamId: String) {
        issueLabels(filter: { team: { id: { eq: $teamId } } }) {
          nodes {
            id
            name
            color
            description
          }
        }
      }
    `;

    const data = await this.graphqlRequest<{ issueLabels: { nodes: LinearLabel[] } }>(
      connection,
      query,
      { teamId }
    );
    return data.issueLabels.nodes;
  }

  /**
   * List projects
   */
  async listProjects(connection: LinearConnection, teamId?: string): Promise<LinearProject[]> {
    const query = `
      query($teamId: String) {
        projects(filter: { accessibleTeams: { id: { eq: $teamId } } }) {
          nodes {
            id
            name
            description
            state
            startDate
            targetDate
          }
        }
      }
    `;

    const data = await this.graphqlRequest<{ projects: { nodes: LinearProject[] } }>(
      connection,
      query,
      { teamId }
    );
    return data.projects.nodes;
  }

  /**
   * Get issues by customer label
   */
  async getIssuesByCustomerLabel(
    connection: LinearConnection,
    customerLabel: string,
    options: {
      includeCompleted?: boolean;
      limit?: number;
      after?: string;
    } = {}
  ): Promise<{ issues: LinearIssue[]; hasNextPage: boolean; endCursor?: string }> {
    const { includeCompleted = false, limit = 50, after } = options;

    const stateFilter = includeCompleted
      ? {}
      : { state: { type: { nin: ['completed', 'canceled'] } } };

    const query = `
      query($labelName: String!, $first: Int!, $after: String) {
        issues(
          filter: {
            labels: { name: { eq: $labelName } }
            ${includeCompleted ? '' : 'state: { type: { nin: ["completed", "canceled"] } }'}
          }
          first: $first
          after: $after
          orderBy: updatedAt
        ) {
          nodes {
            id
            identifier
            title
            description
            priority
            priorityLabel
            url
            dueDate
            estimate
            createdAt
            updatedAt
            completedAt
            canceledAt
            state {
              id
              name
              type
              color
            }
            assignee {
              id
              name
              email
              avatarUrl
            }
            team {
              id
              name
              key
            }
            project {
              id
              name
            }
            cycle {
              id
              name
              number
            }
            labels {
              nodes {
                id
                name
                color
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const data = await this.graphqlRequest<{
      issues: {
        nodes: Array<LinearIssue & { labels: { nodes: LinearLabel[] } }>;
        pageInfo: { hasNextPage: boolean; endCursor?: string };
      };
    }>(connection, query, { labelName: customerLabel, first: limit, after });

    // Flatten labels
    const issues = data.issues.nodes.map((issue) => ({
      ...issue,
      labels: issue.labels.nodes,
    }));

    return {
      issues,
      hasNextPage: data.issues.pageInfo.hasNextPage,
      endCursor: data.issues.pageInfo.endCursor,
    };
  }

  /**
   * Get a single issue by ID
   */
  async getIssue(connection: LinearConnection, issueId: string): Promise<LinearIssue | null> {
    const query = `
      query($id: String!) {
        issue(id: $id) {
          id
          identifier
          title
          description
          priority
          priorityLabel
          url
          dueDate
          estimate
          createdAt
          updatedAt
          completedAt
          canceledAt
          state {
            id
            name
            type
            color
          }
          assignee {
            id
            name
            email
            avatarUrl
          }
          team {
            id
            name
            key
          }
          project {
            id
            name
          }
          cycle {
            id
            name
            number
          }
          labels {
            nodes {
              id
              name
              color
            }
          }
        }
      }
    `;

    const data = await this.graphqlRequest<{
      issue: (LinearIssue & { labels: { nodes: LinearLabel[] } }) | null;
    }>(connection, query, { id: issueId });

    if (!data.issue) return null;

    return {
      ...data.issue,
      labels: data.issue.labels.nodes,
    };
  }

  /**
   * Create a new issue
   */
  async createIssue(
    connection: LinearConnection,
    input: IssueCreateInput
  ): Promise<LinearIssue> {
    const mutation = `
      mutation($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            title
            description
            priority
            priorityLabel
            url
            dueDate
            estimate
            createdAt
            updatedAt
            state {
              id
              name
              type
              color
            }
            assignee {
              id
              name
              email
              avatarUrl
            }
            team {
              id
              name
              key
            }
            project {
              id
              name
            }
            labels {
              nodes {
                id
                name
                color
              }
            }
          }
        }
      }
    `;

    const data = await this.graphqlRequest<{
      issueCreate: {
        success: boolean;
        issue: LinearIssue & { labels: { nodes: LinearLabel[] } };
      };
    }>(connection, mutation, { input });

    if (!data.issueCreate.success) {
      throw new Error('Failed to create Linear issue');
    }

    return {
      ...data.issueCreate.issue,
      labels: data.issueCreate.issue.labels.nodes,
    };
  }

  /**
   * Save connection to database
   */
  async saveConnection(userId: string, connection: LinearConnection): Promise<void> {
    if (!supabase) {
      console.warn('[Linear] No Supabase client - connection not persisted');
      return;
    }

    const { error } = await supabase.from('linear_connections').upsert(
      {
        user_id: userId,
        access_token: connection.accessToken,
        token_type: connection.tokenType,
        expires_in: connection.expiresIn,
        scope: connection.scope,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      console.error('[Linear] Failed to save connection:', error);
      throw new Error(`Failed to save connection: ${error.message}`);
    }

    console.log(`[Linear] Connection saved for user ${userId}`);
  }

  /**
   * Get connection from database
   */
  async getConnection(userId: string): Promise<LinearConnection | null> {
    if (!supabase) {
      console.warn('[Linear] No Supabase client - cannot retrieve connection');
      return null;
    }

    const { data, error } = await supabase
      .from('linear_connections')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      accessToken: data.access_token,
      tokenType: data.token_type || 'Bearer',
      expiresIn: data.expires_in,
      scope: data.scope,
    };
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

    // Get last sync log
    const { data: syncLog } = await supabase
      .from('linear_sync_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return {
      connected: true,
      lastSyncAt: syncLog?.completed_at ? new Date(syncLog.completed_at) : undefined,
      lastSyncStatus: syncLog?.status,
      issuesSynced: syncLog?.records_processed,
      syncErrors: syncLog?.error_details,
    };
  }

  /**
   * Sync issues for a customer
   */
  async syncCustomerIssues(
    connection: LinearConnection,
    userId: string,
    customerId: string,
    customerLabel: string,
    options: { incremental?: boolean } = {}
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
      // Create sync log
      const { data: syncLog } = await supabase
        .from('linear_sync_logs')
        .insert({
          user_id: userId,
          customer_id: customerId,
          sync_type: options.incremental ? 'incremental' : 'full',
          status: 'running',
        })
        .select()
        .single();

      result.syncLogId = syncLog?.id;

      // Fetch all issues with customer label
      let hasMore = true;
      let cursor: string | undefined;

      while (hasMore) {
        const { issues, hasNextPage, endCursor } = await this.getIssuesByCustomerLabel(
          connection,
          customerLabel,
          { includeCompleted: true, after: cursor }
        );

        for (const issue of issues) {
          try {
            // Upsert issue
            const { error: issueError } = await supabase.from('linear_issues').upsert(
              {
                linear_id: issue.id,
                identifier: issue.identifier,
                title: issue.title,
                description: issue.description,
                state: issue.state.name,
                state_type: issue.state.type,
                priority: issue.priority,
                priority_label: issue.priorityLabel,
                assignee: issue.assignee?.name,
                assignee_email: issue.assignee?.email,
                team: issue.team.name,
                team_key: issue.team.key,
                project: issue.project?.name,
                cycle: issue.cycle?.name,
                labels: issue.labels.map((l) => l.name),
                due_date: issue.dueDate,
                url: issue.url,
                linear_created_at: issue.createdAt,
                linear_updated_at: issue.updatedAt,
                completed_at: issue.completedAt,
                canceled_at: issue.canceledAt,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'linear_id' }
            );

            if (issueError) {
              result.errors.push(`Issue ${issue.identifier}: ${issueError.message}`);
              continue;
            }

            // Create/update customer link
            const { error: linkError } = await supabase.from('linear_customer_links').upsert(
              {
                linear_id: issue.id,
                customer_id: customerId,
              },
              { onConflict: 'linear_id,customer_id' }
            );

            if (linkError && !linkError.message.includes('duplicate')) {
              result.errors.push(`Link for ${issue.identifier}: ${linkError.message}`);
            }

            result.synced++;
          } catch (err) {
            result.errors.push(`Issue ${issue.identifier}: ${(err as Error).message}`);
          }
        }

        hasMore = hasNextPage;
        cursor = endCursor;
      }

      // Update sync log
      if (syncLog?.id) {
        await supabase
          .from('linear_sync_logs')
          .update({
            status: result.errors.length > 0 ? 'completed_with_errors' : 'completed',
            records_processed: result.synced,
            records_created: result.created,
            records_updated: result.updated,
            records_skipped: result.skipped,
            error_details: result.errors.length > 0 ? result.errors : null,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id);
      }

      // Record health event
      await integrationHealthService.recordEvent({
        customerId,
        integrationType: 'linear',
        eventType: result.errors.length > 0 ? 'sync_partial' : 'sync_success',
        metadata: {
          issuesSynced: result.synced,
          errors: result.errors.length,
        },
      });

    } catch (err) {
      result.errors.push((err as Error).message);

      // Record failure
      await integrationHealthService.recordEvent({
        customerId,
        integrationType: 'linear',
        eventType: 'sync_failed',
        errorDetails: (err as Error).message,
      });
    }

    return result;
  }

  /**
   * Get issues for a customer from database
   */
  async getCustomerIssues(
    customerId: string,
    options: {
      status?: 'open' | 'completed' | 'all';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ issues: LinearIssue[]; total: number }> {
    if (!supabase) {
      return { issues: [], total: 0 };
    }

    const { status = 'open', limit = 50, offset = 0 } = options;

    let query = supabase
      .from('linear_issues')
      .select(
        `
        *,
        linear_customer_links!inner(customer_id)
      `,
        { count: 'exact' }
      )
      .eq('linear_customer_links.customer_id', customerId);

    if (status === 'open') {
      query = query.in('state_type', ['backlog', 'unstarted', 'started']);
    } else if (status === 'completed') {
      query = query.in('state_type', ['completed', 'canceled']);
    }

    const { data, count, error } = await query
      .order('linear_updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Linear] Failed to get customer issues:', error);
      return { issues: [], total: 0 };
    }

    // Transform database format to LinearIssue format
    const issues: LinearIssue[] = (data || []).map((row) => ({
      id: row.linear_id,
      identifier: row.identifier,
      title: row.title,
      description: row.description,
      state: {
        id: '',
        name: row.state,
        type: row.state_type,
        color: '',
      },
      priority: row.priority,
      priorityLabel: row.priority_label,
      assignee: row.assignee
        ? {
            id: '',
            name: row.assignee,
            email: row.assignee_email,
          }
        : undefined,
      team: {
        id: '',
        name: row.team,
        key: row.team_key,
      },
      project: row.project
        ? {
            id: '',
            name: row.project,
          }
        : undefined,
      cycle: row.cycle
        ? {
            id: '',
            name: row.cycle,
            number: 0,
          }
        : undefined,
      labels: (row.labels || []).map((name: string) => ({
        id: '',
        name,
        color: '',
      })),
      dueDate: row.due_date,
      url: row.url,
      createdAt: row.linear_created_at,
      updatedAt: row.linear_updated_at,
      completedAt: row.completed_at,
      canceledAt: row.canceled_at,
    }));

    return { issues, total: count || 0 };
  }

  /**
   * Process webhook event
   */
  async processWebhook(
    userId: string,
    payload: WebhookPayload
  ): Promise<{ processed: boolean; alerts: string[] }> {
    const alerts: string[] = [];

    if (payload.type !== 'Issue') {
      return { processed: false, alerts };
    }

    if (!supabase) {
      return { processed: false, alerts };
    }

    const issueData = payload.data as Record<string, unknown>;
    const linearId = issueData.id as string;

    // Check if we're tracking this issue
    const { data: existingIssue } = await supabase
      .from('linear_issues')
      .select('*, linear_customer_links(customer_id)')
      .eq('linear_id', linearId)
      .single();

    if (!existingIssue) {
      // Issue not tracked, skip
      return { processed: false, alerts };
    }

    if (payload.action === 'update') {
      // Update the issue in our database
      const state = issueData.state as Record<string, unknown> | undefined;
      const assignee = issueData.assignee as Record<string, unknown> | undefined;

      const updateData: Record<string, unknown> = {
        title: issueData.title,
        description: issueData.description,
        priority: issueData.priority,
        priority_label: issueData.priorityLabel,
        updated_at: new Date().toISOString(),
        linear_updated_at: issueData.updatedAt,
      };

      if (state) {
        updateData.state = state.name;
        updateData.state_type = state.type;

        // Check for completion
        if (state.type === 'completed' && existingIssue.state_type !== 'completed') {
          updateData.completed_at = new Date().toISOString();
          alerts.push(`Issue ${existingIssue.identifier} completed`);
        }
      }

      if (assignee) {
        updateData.assignee = assignee.name;
        updateData.assignee_email = assignee.email;
      }

      // Check for priority change
      if (
        issueData.priority !== undefined &&
        issueData.priority !== existingIssue.priority
      ) {
        const oldPriority = existingIssue.priority;
        const newPriority = issueData.priority as number;

        if (newPriority < oldPriority) {
          // Priority elevated (lower number = higher priority)
          alerts.push(
            `Issue ${existingIssue.identifier} priority elevated to ${issueData.priorityLabel}`
          );
        }
      }

      await supabase.from('linear_issues').update(updateData).eq('linear_id', linearId);
    } else if (payload.action === 'remove') {
      // Mark issue as removed/canceled
      await supabase
        .from('linear_issues')
        .update({
          state: 'Removed',
          state_type: 'canceled',
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('linear_id', linearId);
    }

    // Create notification for CSM if there are alerts
    if (alerts.length > 0 && existingIssue.linear_customer_links?.length > 0) {
      for (const link of existingIssue.linear_customer_links) {
        // Would trigger notification system here
        console.log(`[Linear] Alert for customer ${link.customer_id}:`, alerts);
      }
    }

    return { processed: true, alerts };
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    if (!this.clientSecret) {
      console.warn('[Linear] No client secret configured for webhook validation');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.clientSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Disconnect user
   */
  async disconnect(userId: string): Promise<void> {
    if (!supabase) return;

    await supabase.from('linear_connections').delete().eq('user_id', userId);
    console.log(`[Linear] Disconnected user ${userId}`);
  }

  /**
   * Get sync history
   */
  async getSyncHistory(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ logs: any[]; total: number }> {
    if (!supabase) {
      return { logs: [], total: 0 };
    }

    const { limit = 20, offset = 0 } = options;

    const { data, count, error } = await supabase
      .from('linear_sync_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Linear] Failed to get sync history:', error);
      return { logs: [], total: 0 };
    }

    return { logs: data || [], total: count || 0 };
  }

  /**
   * Update sync config
   */
  async updateSyncConfig(userId: string, config: Partial<SyncConfig>): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from('linear_connections')
      .update({
        config: config,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to update config: ${error.message}`);
    }
  }

  /**
   * Get customer label for a customer
   */
  async getCustomerLabel(customerId: string): Promise<string | null> {
    if (!supabase) return null;

    const { data } = await supabase
      .from('linear_customer_labels')
      .select('label_name')
      .eq('customer_id', customerId)
      .single();

    return data?.label_name || null;
  }

  /**
   * Set customer label mapping
   */
  async setCustomerLabel(customerId: string, labelName: string): Promise<void> {
    if (!supabase) return;

    await supabase.from('linear_customer_labels').upsert(
      {
        customer_id: customerId,
        label_name: labelName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'customer_id' }
    );
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): { state: string; failures: number } {
    return linearCircuitBreaker.getStatus();
  }

  /**
   * Calculate impact for an issue (number of customers affected)
   */
  async getIssueImpact(linearId: string): Promise<{ customerCount: number; totalARR: number }> {
    if (!supabase) {
      return { customerCount: 0, totalARR: 0 };
    }

    const { data, error } = await supabase
      .from('linear_customer_links')
      .select(
        `
        customer_id,
        customers!inner(id, name, arr)
      `
      )
      .eq('linear_id', linearId);

    if (error || !data) {
      return { customerCount: 0, totalARR: 0 };
    }

    const customerCount = data.length;
    const totalARR = data.reduce((sum, link) => {
      const customer = link.customers as any;
      return sum + (customer?.arr || 0);
    }, 0);

    return { customerCount, totalARR };
  }
}

// Export singleton instance
export const linearService = new LinearService();
