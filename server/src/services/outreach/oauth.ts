/**
 * Outreach OAuth Service
 * PRD-191: Handles OAuth 2.0 flow for Outreach.io integration
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { OutreachOAuthTokens, OutreachConnection } from './types.js';

// ============================================
// Configuration
// ============================================

const OUTREACH_CLIENT_ID = process.env.OUTREACH_CLIENT_ID || '';
const OUTREACH_CLIENT_SECRET = process.env.OUTREACH_CLIENT_SECRET || '';
const OUTREACH_REDIRECT_URI = process.env.OUTREACH_REDIRECT_URI || 'http://localhost:3001/api/outreach/callback';

const OUTREACH_OAUTH_BASE = 'https://api.outreach.io/oauth';
const OUTREACH_API_BASE = 'https://api.outreach.io/api/v2';

// Scopes required for sequence enrollment
export const OUTREACH_SCOPES = [
  'prospects.all',          // Create/update/read prospects
  'sequences.all',          // Read sequences
  'sequenceStates.all',     // Enroll/pause/remove from sequences
  'mailings.read',          // Read mailing status
  'accounts.all',           // Create/read accounts
  'users.read',             // Read user info
] as const;

// ============================================
// Outreach OAuth Service
// ============================================

export class OutreachOAuthService {
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
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(userId: string, redirectUri?: string): string {
    const state = Buffer.from(JSON.stringify({
      userId,
      timestamp: Date.now(),
    })).toString('base64');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: OUTREACH_CLIENT_ID,
      redirect_uri: redirectUri || OUTREACH_REDIRECT_URI,
      scope: OUTREACH_SCOPES.join(' '),
      state,
    });

    return `${OUTREACH_OAUTH_BASE}/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri?: string): Promise<OutreachOAuthTokens> {
    const response = await fetch(`${OUTREACH_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: OUTREACH_CLIENT_ID,
        client_secret: OUTREACH_CLIENT_SECRET,
        redirect_uri: redirectUri || OUTREACH_REDIRECT_URI,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for tokens: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope.split(' '),
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<OutreachOAuthTokens> {
    const response = await fetch(`${OUTREACH_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: OUTREACH_CLIENT_ID,
        client_secret: OUTREACH_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      tokenType: data.token_type,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope.split(' '),
    };
  }

  /**
   * Complete OAuth flow - exchange code and save connection
   */
  async completeOAuth(code: string, state: string): Promise<{
    success: boolean;
    email?: string;
    name?: string;
    error?: string;
  }> {
    try {
      // Decode state
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      const userId = stateData.userId;

      if (!userId) {
        return { success: false, error: 'Invalid state parameter' };
      }

      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(code);

      // Get current user info from Outreach
      const userInfo = await this.getCurrentUser(tokens.accessToken);

      // Save connection to database
      await this.saveConnection({
        userId,
        outreachUserId: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
        connectedAt: new Date(),
      });

      return {
        success: true,
        email: userInfo.email,
        name: userInfo.name,
      };
    } catch (error) {
      console.error('[OutreachOAuth] Error completing OAuth:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get current user info from Outreach API
   */
  private async getCurrentUser(accessToken: string): Promise<{
    id: number;
    email: string;
    name: string;
  }> {
    const response = await fetch(`${OUTREACH_API_BASE}/users/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.api+json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get user info from Outreach');
    }

    const data = await response.json();
    const user = data.data;

    return {
      id: user.id,
      email: user.attributes.email,
      name: `${user.attributes.firstName || ''} ${user.attributes.lastName || ''}`.trim(),
    };
  }

  // ============================================
  // Connection Management
  // ============================================

  /**
   * Save connection to database
   */
  async saveConnection(connection: OutreachConnection): Promise<void> {
    if (!this.supabase) {
      console.warn('[OutreachOAuth] Database not available');
      return;
    }

    const { error } = await this.supabase.from('outreach_connections').upsert({
      user_id: connection.userId,
      outreach_user_id: connection.outreachUserId,
      email: connection.email,
      name: connection.name,
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken,
      expires_at: connection.expiresAt.toISOString(),
      scope: connection.scope,
      connected_at: connection.connectedAt.toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });

    if (error) {
      console.error('[OutreachOAuth] Error saving connection:', error);
      throw new Error('Failed to save connection');
    }
  }

  /**
   * Get connection for a user
   */
  async getConnection(userId: string): Promise<OutreachConnection | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('outreach_connections')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;

    return {
      userId: data.user_id,
      outreachUserId: data.outreach_user_id,
      email: data.email,
      name: data.name,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(data.expires_at),
      scope: data.scope || [],
      connectedAt: new Date(data.connected_at),
    };
  }

  /**
   * Get valid access token, refreshing if needed
   */
  async getValidAccessToken(userId: string): Promise<string | null> {
    const connection = await this.getConnection(userId);
    if (!connection) return null;

    // Check if token is expired or about to expire (within 5 minutes)
    const buffer = 5 * 60 * 1000;
    if (connection.expiresAt.getTime() - buffer > Date.now()) {
      return connection.accessToken;
    }

    // Refresh the token
    try {
      const newTokens = await this.refreshAccessToken(connection.refreshToken);

      // Update connection with new tokens
      await this.saveConnection({
        ...connection,
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresAt: newTokens.expiresAt,
      });

      return newTokens.accessToken;
    } catch (error) {
      console.error('[OutreachOAuth] Failed to refresh token:', error);
      return null;
    }
  }

  /**
   * Check if user has Outreach connected
   */
  async isConnected(userId: string): Promise<boolean> {
    const connection = await this.getConnection(userId);
    return !!connection;
  }

  /**
   * Validate connection by making a test API call
   */
  async validateConnection(userId: string): Promise<boolean> {
    try {
      const accessToken = await this.getValidAccessToken(userId);
      if (!accessToken) return false;

      const response = await fetch(`${OUTREACH_API_BASE}/users/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/vnd.api+json',
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Disconnect Outreach integration
   */
  async disconnect(userId: string): Promise<void> {
    if (!this.supabase) return;

    // Optionally revoke the token (Outreach doesn't have a revoke endpoint)
    // Just delete from our database

    const { error } = await this.supabase
      .from('outreach_connections')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('[OutreachOAuth] Error disconnecting:', error);
      throw new Error('Failed to disconnect');
    }
  }

  /**
   * Get connection status with details
   */
  async getConnectionStatus(userId: string): Promise<{
    connected: boolean;
    email?: string;
    name?: string;
    connectedAt?: string;
    scopes?: string[];
    healthy?: boolean;
  }> {
    const connection = await this.getConnection(userId);

    if (!connection) {
      return { connected: false };
    }

    const healthy = await this.validateConnection(userId);

    return {
      connected: true,
      email: connection.email,
      name: connection.name,
      connectedAt: connection.connectedAt.toISOString(),
      scopes: connection.scope,
      healthy,
    };
  }

  /**
   * Get required scopes
   */
  getRequiredScopes(): readonly string[] {
    return OUTREACH_SCOPES;
  }

  /**
   * Check if connection has required scope
   */
  async hasScope(userId: string, scope: string): Promise<boolean> {
    const connection = await this.getConnection(userId);
    return connection?.scope.includes(scope) || false;
  }
}

// Singleton instance
export const outreachOAuth = new OutreachOAuthService();
