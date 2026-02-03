/**
 * Gong OAuth Service (PRD-193)
 *
 * Handles Gong API OAuth 2.0 authentication flow.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import type { GongConnectionRow } from './types.js';

// ============================================================================
// Configuration
// ============================================================================

const GONG_CLIENT_ID = process.env.GONG_CLIENT_ID || '';
const GONG_CLIENT_SECRET = process.env.GONG_CLIENT_SECRET || '';
const GONG_REDIRECT_URI = process.env.GONG_REDIRECT_URI || 'http://localhost:3001/api/gong/callback';
const GONG_AUTH_URL = 'https://app.gong.io/oauth2/authorize';
const GONG_TOKEN_URL = 'https://app.gong.io/oauth2/token';

// Required scopes for CSM functionality
const GONG_SCOPES = [
  'api:calls:read:basic',     // Read call metadata
  'api:calls:read:extensive', // Read detailed call data
  'api:calls:read:transcript', // Read transcripts
  'api:users:read',           // Read users
  'api:stats:user-actions',   // User engagement stats
] as const;

export interface GongOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  scope: string;
}

export interface GongConnection {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  workspaceId?: string;
  workspaceName?: string;
  scopes: string[];
  connectedAt: string;
}

// ============================================================================
// Gong OAuth Service
// ============================================================================

export class GongOAuthService {
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
   * Generate authorization URL for Gong OAuth
   */
  getAuthorizationUrl(userId: string, redirectUri?: string): string {
    const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64');

    const params = new URLSearchParams({
      client_id: GONG_CLIENT_ID,
      redirect_uri: redirectUri || GONG_REDIRECT_URI,
      response_type: 'code',
      scope: GONG_SCOPES.join(' '),
      state,
    });

    return `${GONG_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri?: string): Promise<GongOAuthTokens> {
    const credentials = Buffer.from(`${GONG_CLIENT_ID}:${GONG_CLIENT_SECRET}`).toString('base64');

    const response = await fetch(GONG_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri || GONG_REDIRECT_URI,
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
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<GongOAuthTokens> {
    const credentials = Buffer.from(`${GONG_CLIENT_ID}:${GONG_CLIENT_SECRET}`).toString('base64');

    const response = await fetch(GONG_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
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
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  /**
   * Complete OAuth flow and save connection
   */
  async completeOAuth(code: string, state: string): Promise<{
    success: boolean;
    workspaceName?: string;
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

      // Get workspace info
      const workspaceInfo = await this.getWorkspaceInfo(tokens.accessToken);

      // Calculate expiration
      const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

      // Save connection to database
      if (this.supabase) {
        await this.supabase.from('gong_connections').upsert({
          user_id: userId,
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          expires_at: expiresAt.toISOString(),
          workspace_id: workspaceInfo?.id,
          workspace_name: workspaceInfo?.name,
          scopes: tokens.scope.split(' '),
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });
      }

      return {
        success: true,
        workspaceName: workspaceInfo?.name,
      };
    } catch (error) {
      console.error('[GongOAuth] Error completing OAuth:', error);
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
   * Check if user has Gong connected
   */
  async isConnected(userId: string): Promise<boolean> {
    if (!this.supabase) return false;

    const { data, error } = await this.supabase
      .from('gong_connections')
      .select('id')
      .eq('user_id', userId)
      .single();

    return !error && !!data;
  }

  /**
   * Get Gong connection for user
   */
  async getConnection(userId: string): Promise<GongConnection | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('gong_connections')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;

    const row = data as GongConnectionRow;
    return {
      userId: row.user_id,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      workspaceId: row.workspace_id,
      workspaceName: row.workspace_name,
      scopes: row.scopes || [],
      connectedAt: row.connected_at,
    };
  }

  /**
   * Get valid access token (refresh if needed)
   */
  async getValidAccessToken(userId: string): Promise<string> {
    const connection = await this.getConnection(userId);

    if (!connection) {
      throw new Error('Gong not connected. Please connect your Gong workspace first.');
    }

    // Check if token is expired or about to expire (within 5 minutes)
    const now = new Date();
    const expirationBuffer = 5 * 60 * 1000; // 5 minutes

    if (connection.expiresAt && connection.expiresAt.getTime() - now.getTime() < expirationBuffer) {
      if (!connection.refreshToken) {
        throw new Error('Token expired and no refresh token available. Please reconnect Gong.');
      }

      // Refresh the token
      const newTokens = await this.refreshAccessToken(connection.refreshToken);
      const newExpiresAt = new Date(Date.now() + newTokens.expiresIn * 1000);

      // Update in database
      if (this.supabase) {
        await this.supabase
          .from('gong_connections')
          .update({
            access_token: newTokens.accessToken,
            refresh_token: newTokens.refreshToken,
            expires_at: newExpiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
      }

      return newTokens.accessToken;
    }

    return connection.accessToken;
  }

  /**
   * Disconnect Gong
   */
  async disconnect(userId: string): Promise<void> {
    if (!this.supabase) return;

    // Delete connection from database
    await this.supabase
      .from('gong_connections')
      .delete()
      .eq('user_id', userId);
  }

  /**
   * Validate existing connection
   */
  async validateConnection(userId: string): Promise<boolean> {
    try {
      const token = await this.getValidAccessToken(userId);
      const workspaceInfo = await this.getWorkspaceInfo(token);
      return !!workspaceInfo;
    } catch {
      return false;
    }
  }

  // ============================================
  // Workspace Info
  // ============================================

  /**
   * Get workspace information from Gong
   */
  private async getWorkspaceInfo(accessToken: string): Promise<{ id: string; name: string } | null> {
    try {
      const response = await fetch('https://api.gong.io/v2/settings/workspaces', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('[GongOAuth] Failed to get workspace info:', response.status);
        return null;
      }

      const data = await response.json();

      if (data.workspaces && data.workspaces.length > 0) {
        return {
          id: data.workspaces[0].id,
          name: data.workspaces[0].name,
        };
      }

      return null;
    } catch (error) {
      console.warn('[GongOAuth] Error getting workspace info:', error);
      return null;
    }
  }

  // ============================================
  // Utilities
  // ============================================

  /**
   * Get required scopes
   */
  getRequiredScopes(): readonly string[] {
    return GONG_SCOPES;
  }

  /**
   * Check if connection has required scope
   */
  async hasScope(userId: string, scope: string): Promise<boolean> {
    const connection = await this.getConnection(userId);
    return connection?.scopes.includes(scope) || false;
  }

  /**
   * Check if Gong is configured
   */
  isConfigured(): boolean {
    return !!GONG_CLIENT_ID && !!GONG_CLIENT_SECRET;
  }
}

// Singleton instance
export const gongOAuth = new GongOAuthService();
