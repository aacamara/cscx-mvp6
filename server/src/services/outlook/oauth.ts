/**
 * Microsoft OAuth Service
 * Handles OAuth flow, token management, and refresh for Microsoft Graph API
 * PRD-189: Outlook Calendar Integration
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Microsoft Graph API scopes for Outlook Calendar
export const MICROSOFT_SCOPES = [
  // Calendar
  'Calendars.ReadWrite',
  'Calendars.Read.Shared',
  // Mail (for meeting invites)
  'Mail.Send',
  // User info
  'User.Read',
  'offline_access', // For refresh tokens
  'openid',
  'profile',
  'email',
];

export interface MicrosoftTokens {
  access_token: string;
  refresh_token: string;
  token_expires_at: Date;
  granted_scopes: string[];
  microsoft_email: string;
  microsoft_user_id: string;
  microsoft_display_name?: string;
  tenant_id?: string;
}

export interface MicrosoftUserInfo {
  id: string;
  email: string;
  displayName?: string;
  userPrincipalName?: string;
}

interface MicrosoftConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tenantId: string;
}

export class MicrosoftOAuthService {
  private supabase: ReturnType<typeof createClient> | null = null;
  private config: MicrosoftConfig;
  private authorizeEndpoint: string;
  private tokenEndpoint: string;

  constructor() {
    // Initialize config from environment
    this.config = {
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3001/api/outlook/auth/callback',
      tenantId: process.env.MICROSOFT_TENANT_ID || 'common', // 'common' for multi-tenant
    };

    // OAuth endpoints (using 'common' for multi-tenant support)
    this.authorizeEndpoint = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/authorize`;
    this.tokenEndpoint = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;

    // Initialize Supabase client
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Check if Microsoft OAuth is configured
   */
  isConfigured(): boolean {
    return !!(this.config.clientId && this.config.clientSecret);
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    if (!this.isConfigured()) {
      throw new Error('Microsoft OAuth not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.');
    }

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      response_mode: 'query',
      scope: MICROSOFT_SCOPES.join(' '),
      prompt: 'consent', // Force consent to ensure refresh token
    });

    if (state) {
      params.append('state', state);
    }

    return `${this.authorizeEndpoint}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<MicrosoftTokens> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      redirect_uri: this.config.redirectUri,
      grant_type: 'authorization_code',
      scope: MICROSOFT_SCOPES.join(' '),
    });

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to exchange code: ${error.error_description || error.error}`);
    }

    const tokens = await response.json();

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Failed to get tokens from Microsoft');
    }

    // Get user info
    const userInfo = await this.getUserInfo(tokens.access_token);

    // Calculate expiry
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      granted_scopes: tokens.scope?.split(' ') || MICROSOFT_SCOPES,
      microsoft_email: userInfo.email,
      microsoft_user_id: userInfo.id,
      microsoft_display_name: userInfo.displayName,
    };
  }

  /**
   * Get Microsoft user info from access token
   */
  async getUserInfo(accessToken: string): Promise<MicrosoftUserInfo> {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get user info from Microsoft');
    }

    const data = await response.json();

    return {
      id: data.id,
      email: data.mail || data.userPrincipalName,
      displayName: data.displayName,
      userPrincipalName: data.userPrincipalName,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_at: Date; refresh_token?: string }> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: MICROSOFT_SCOPES.join(' '),
    });

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to refresh token: ${error.error_description || error.error}`);
    }

    const tokens = await response.json();

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

    return {
      access_token: tokens.access_token,
      expires_at: expiresAt,
      refresh_token: tokens.refresh_token, // Microsoft may return a new refresh token
    };
  }

  /**
   * Save tokens to database for a user
   */
  async saveTokens(userId: string, tokens: MicrosoftTokens): Promise<void> {
    if (!this.supabase) {
      console.warn('Supabase not configured, tokens not persisted');
      return;
    }

    const { error } = await (this.supabase as any)
      .from('microsoft_oauth_tokens')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokens.token_expires_at.toISOString(),
        granted_scopes: tokens.granted_scopes,
        microsoft_email: tokens.microsoft_email,
        microsoft_user_id: tokens.microsoft_user_id,
        microsoft_display_name: tokens.microsoft_display_name,
        is_valid: true,
        last_refresh_at: new Date().toISOString(),
        last_error: null,
      }, {
        onConflict: 'user_id',
      });

    if (error) {
      throw new Error(`Failed to save tokens: ${error.message}`);
    }
  }

  /**
   * Get tokens for a user from database
   */
  async getTokens(userId: string): Promise<MicrosoftTokens | null> {
    if (!this.supabase) {
      return null;
    }

    const { data, error } = await (this.supabase as any)
      .from('microsoft_oauth_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: new Date(data.token_expires_at),
      granted_scopes: data.granted_scopes,
      microsoft_email: data.microsoft_email,
      microsoft_user_id: data.microsoft_user_id,
      microsoft_display_name: data.microsoft_display_name,
      tenant_id: data.tenant_id,
    };
  }

  /**
   * Get valid access token for a user (refreshes if needed)
   */
  async getValidAccessToken(userId: string): Promise<string> {
    const tokens = await this.getTokens(userId);

    if (!tokens) {
      throw new Error('No Microsoft tokens found for user. Please connect Microsoft account.');
    }

    // Check if token is expired or about to expire (5 min buffer)
    const now = new Date();
    const expiresAt = new Date(tokens.token_expires_at);
    const bufferMs = 5 * 60 * 1000; // 5 minutes

    if (now.getTime() + bufferMs >= expiresAt.getTime()) {
      // Token expired or expiring soon, refresh it
      try {
        const refreshed = await this.refreshAccessToken(tokens.refresh_token);

        // Update tokens in database
        await this.updateAccessToken(
          userId,
          refreshed.access_token,
          refreshed.expires_at,
          refreshed.refresh_token
        );

        return refreshed.access_token;
      } catch (error) {
        // Mark token as invalid
        await this.markTokenInvalid(userId, (error as Error).message);
        throw new Error('Failed to refresh Microsoft token. Please reconnect Microsoft account.');
      }
    }

    return tokens.access_token;
  }

  /**
   * Update access token in database
   */
  private async updateAccessToken(
    userId: string,
    accessToken: string,
    expiresAt: Date,
    newRefreshToken?: string
  ): Promise<void> {
    if (!this.supabase) return;

    const update: Record<string, any> = {
      access_token: accessToken,
      token_expires_at: expiresAt.toISOString(),
      last_refresh_at: new Date().toISOString(),
      last_error: null,
    };

    if (newRefreshToken) {
      update.refresh_token = newRefreshToken;
    }

    await (this.supabase as any)
      .from('microsoft_oauth_tokens')
      .update(update)
      .eq('user_id', userId);
  }

  /**
   * Mark token as invalid in database
   */
  private async markTokenInvalid(userId: string, errorMessage: string): Promise<void> {
    if (!this.supabase) return;

    await (this.supabase as any)
      .from('microsoft_oauth_tokens')
      .update({
        is_valid: false,
        last_error: errorMessage,
      })
      .eq('user_id', userId);
  }

  /**
   * Delete tokens for a user (disconnect)
   */
  async deleteTokens(userId: string): Promise<void> {
    if (!this.supabase) return;

    // Revoke token with Microsoft (optional - Microsoft tokens auto-expire)
    // Note: Microsoft doesn't have a simple revocation endpoint like Google

    // Delete from database
    await this.supabase
      .from('microsoft_oauth_tokens')
      .delete()
      .eq('user_id', userId);
  }

  /**
   * Check if user has Microsoft connected
   */
  async isConnected(userId: string): Promise<boolean> {
    const tokens = await this.getTokens(userId);
    return tokens !== null;
  }

  /**
   * Get connection status with details
   */
  async getConnectionStatus(userId: string): Promise<{
    connected: boolean;
    email?: string;
    displayName?: string;
    scopes?: string[];
    expiresAt?: Date;
    isValid?: boolean;
  }> {
    const tokens = await this.getTokens(userId);

    if (!tokens) {
      return { connected: false };
    }

    // Check if token is valid in database
    const { data } = await (this.supabase as any)
      .from('microsoft_oauth_tokens')
      .select('is_valid, last_error')
      .eq('user_id', userId)
      .single();

    return {
      connected: true,
      email: tokens.microsoft_email,
      displayName: tokens.microsoft_display_name,
      scopes: tokens.granted_scopes,
      expiresAt: tokens.token_expires_at,
      isValid: data?.is_valid ?? true,
    };
  }
}

// Singleton instance
export const microsoftOAuth = new MicrosoftOAuthService();
