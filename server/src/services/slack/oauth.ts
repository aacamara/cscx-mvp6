/**
 * Slack OAuth Service
 * Handles Slack OAuth 2.0 flow for workspace authorization
 */

import { WebClient } from '@slack/web-api';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// ============================================
// Configuration
// ============================================

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || '';
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET || '';
const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI || 'http://localhost:3001/api/slack/callback';

// Minimal scopes for CSM functionality
const SLACK_SCOPES = [
  'channels:read',          // List public channels
  'channels:join',          // Join public channels
  'chat:write',             // Send messages
  'groups:read',            // List private channels (with membership)
  'im:write',               // Send DMs
  'mpim:write',             // Send group DMs
  'users:read',             // View users
  'users:read.email',       // View user emails
  'reactions:write',        // Add reactions
  'files:write',            // Upload files
] as const;

export interface SlackOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  teamId: string;
  teamName: string;
  botUserId?: string;
  botAccessToken?: string;
  scopes: string[];
  authedUserId: string;
  expiresAt?: Date;
}

// ============================================
// Slack OAuth Service
// ============================================

export class SlackOAuthService {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // OAuth Flow
  // ============================================

  /**
   * Generate authorization URL for Slack OAuth
   */
  getAuthorizationUrl(userId: string, redirectUri?: string): string {
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    const params = new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      scope: SLACK_SCOPES.join(','),
      redirect_uri: redirectUri || SLACK_REDIRECT_URI,
      state,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri?: string): Promise<SlackOAuthTokens> {
    const client = new WebClient();

    const response = await client.oauth.v2.access({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri || SLACK_REDIRECT_URI,
    });

    if (!response.ok) {
      throw new Error(response.error || 'Failed to exchange code for tokens');
    }

    return {
      accessToken: response.access_token || '',
      teamId: response.team?.id || '',
      teamName: response.team?.name || '',
      botUserId: response.bot_user_id,
      scopes: (response.scope || '').split(','),
      authedUserId: response.authed_user?.id || '',
    };
  }

  /**
   * Complete OAuth flow and save connection
   */
  async completeOAuth(code: string, state: string): Promise<{
    success: boolean;
    teamName?: string;
    error?: string;
  }> {
    try {
      // Decode state to get userId
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      const userId = stateData.userId;

      if (!userId) {
        return { success: false, error: 'Invalid state parameter' };
      }

      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(code);

      // Save connection to database
      if (this.supabase) {
        await this.supabase.from('slack_connections').upsert({
          user_id: userId,
          team_id: tokens.teamId,
          team_name: tokens.teamName,
          access_token: tokens.accessToken,
          bot_user_id: tokens.botUserId,
          scopes: tokens.scopes,
          authed_user_id: tokens.authedUserId,
          connected_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,team_id',
        });
      }

      return {
        success: true,
        teamName: tokens.teamName,
      };
    } catch (error) {
      console.error('[SlackOAuth] Error completing OAuth:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // ============================================
  // Connection Management
  // ============================================

  /**
   * Check if user has Slack connected
   */
  async isConnected(userId: string): Promise<boolean> {
    if (!this.supabase) return false;

    const { data, error } = await this.supabase
      .from('slack_connections')
      .select('id')
      .eq('user_id', userId)
      .single();

    return !error && !!data;
  }

  /**
   * Get Slack connection for user
   */
  async getConnection(userId: string): Promise<{
    teamId: string;
    teamName: string;
    scopes: string[];
  } | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('slack_connections')
      .select('team_id, team_name, scopes')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;

    return {
      teamId: data.team_id,
      teamName: data.team_name,
      scopes: data.scopes || [],
    };
  }

  /**
   * Disconnect Slack
   */
  async disconnect(userId: string): Promise<void> {
    if (!this.supabase) return;

    // Optionally revoke the token
    const { data } = await this.supabase
      .from('slack_connections')
      .select('access_token')
      .eq('user_id', userId)
      .single();

    if (data?.access_token) {
      try {
        const client = new WebClient(data.access_token);
        await client.auth.revoke();
      } catch (error) {
        console.warn('[SlackOAuth] Failed to revoke token:', error);
      }
    }

    // Delete connection from database
    await this.supabase
      .from('slack_connections')
      .delete()
      .eq('user_id', userId);
  }

  /**
   * Validate existing connection
   */
  async validateConnection(userId: string): Promise<boolean> {
    if (!this.supabase) return false;

    const { data, error } = await this.supabase
      .from('slack_connections')
      .select('access_token')
      .eq('user_id', userId)
      .single();

    if (error || !data?.access_token) return false;

    try {
      const client = new WebClient(data.access_token);
      const response = await client.auth.test();
      return response.ok || false;
    } catch {
      return false;
    }
  }

  // ============================================
  // Utilities
  // ============================================

  /**
   * Get required scopes
   */
  getRequiredScopes(): readonly string[] {
    return SLACK_SCOPES;
  }

  /**
   * Check if connection has required scope
   */
  async hasScope(userId: string, scope: string): Promise<boolean> {
    const connection = await this.getConnection(userId);
    return connection?.scopes.includes(scope) || false;
  }
}

// Singleton instance
export const slackOAuth = new SlackOAuthService();
