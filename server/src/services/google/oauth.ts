/**
 * Google OAuth Service
 * Handles OAuth flow, token management, and refresh for all Google Workspace APIs
 */

import { google } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// All Google Workspace scopes for CSCX.AI
export const GOOGLE_SCOPES = [
  // Gmail
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.modify',

  // Calendar
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',

  // Drive
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',

  // Docs, Sheets, Slides
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/presentations',

  // Tasks
  'https://www.googleapis.com/auth/tasks',

  // Contacts
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/directory.readonly',

  // User info
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
];

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  token_expires_at: Date;
  granted_scopes: string[];
  google_email: string;
  google_user_id: string;
  google_picture_url?: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export class GoogleOAuthService {
  private oauth2Client: OAuth2Client;
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    // Initialize OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      config.google?.clientId,
      config.google?.clientSecret,
      config.google?.redirectUri
    );

    // Initialize Supabase client
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Check if Google OAuth is configured
   */
  isConfigured(): boolean {
    return !!(config.google?.clientId && config.google?.clientSecret);
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
    }

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Get refresh token
      prompt: 'consent', // Force consent to ensure refresh token
      scope: GOOGLE_SCOPES,
      state: state || undefined,
      include_granted_scopes: true,
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
    const { tokens } = await this.oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Failed to get tokens from Google');
    }

    // Set credentials to get user info
    this.oauth2Client.setCredentials(tokens);

    // Get user info
    const userInfo = await this.getUserInfo(tokens.access_token);

    // Calculate expiry
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000); // Default 1 hour

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt,
      granted_scopes: tokens.scope?.split(' ') || GOOGLE_SCOPES,
      google_email: userInfo.email,
      google_user_id: userInfo.id,
      google_picture_url: userInfo.picture,
    };
  }

  /**
   * Get Google user info from access token
   */
  async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
    this.oauth2Client.setCredentials({ access_token: accessToken });

    const { data } = await oauth2.userinfo.get();

    if (!data.id || !data.email) {
      throw new Error('Failed to get user info from Google');
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name || undefined,
      picture: data.picture || undefined,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_at: Date }> {
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });

    const { credentials } = await this.oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token');
    }

    const expiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    return {
      access_token: credentials.access_token,
      expires_at: expiresAt,
    };
  }

  /**
   * Save tokens to database for a user
   */
  async saveTokens(userId: string, tokens: GoogleTokens): Promise<void> {
    if (!this.supabase) {
      console.warn('Supabase not configured, tokens not persisted');
      return;
    }

    // Type assertion needed until Supabase types are regenerated
    const { error } = await (this.supabase as any)
      .from('google_oauth_tokens')
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokens.token_expires_at.toISOString(),
        granted_scopes: tokens.granted_scopes,
        google_email: tokens.google_email,
        google_user_id: tokens.google_user_id,
        google_picture_url: tokens.google_picture_url,
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
  async getTokens(userId: string): Promise<GoogleTokens | null> {
    if (!this.supabase) {
      return null;
    }

    // Type assertion needed until Supabase types are regenerated
    const { data, error } = await (this.supabase as any)
      .from('google_oauth_tokens')
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
      google_email: data.google_email,
      google_user_id: data.google_user_id,
      google_picture_url: data.google_picture_url,
    };
  }

  /**
   * Get valid access token for a user (refreshes if needed)
   */
  async getValidAccessToken(userId: string): Promise<string> {
    const tokens = await this.getTokens(userId);

    if (!tokens) {
      throw new Error('No Google tokens found for user. Please connect Google account.');
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
        await this.updateAccessToken(userId, refreshed.access_token, refreshed.expires_at);

        return refreshed.access_token;
      } catch (error) {
        // Mark token as invalid
        await this.markTokenInvalid(userId, (error as Error).message);
        throw new Error('Failed to refresh Google token. Please reconnect Google account.');
      }
    }

    return tokens.access_token;
  }

  /**
   * Update access token in database
   */
  private async updateAccessToken(userId: string, accessToken: string, expiresAt: Date): Promise<void> {
    if (!this.supabase) return;

    // Type assertion needed until Supabase types are regenerated
    await (this.supabase as any)
      .from('google_oauth_tokens')
      .update({
        access_token: accessToken,
        token_expires_at: expiresAt.toISOString(),
        last_refresh_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('user_id', userId);
  }

  /**
   * Mark token as invalid in database
   */
  private async markTokenInvalid(userId: string, errorMessage: string): Promise<void> {
    if (!this.supabase) return;

    // Type assertion needed until Supabase types are regenerated
    await (this.supabase as any)
      .from('google_oauth_tokens')
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

    // Revoke token with Google
    const tokens = await this.getTokens(userId);
    if (tokens) {
      try {
        await this.oauth2Client.revokeToken(tokens.access_token);
      } catch (error) {
        // Ignore revoke errors, token might already be invalid
        console.warn('Failed to revoke token:', error);
      }
    }

    // Delete from database
    await this.supabase
      .from('google_oauth_tokens')
      .delete()
      .eq('user_id', userId);
  }

  /**
   * Check if user has Google connected
   */
  async isConnected(userId: string): Promise<boolean> {
    const tokens = await this.getTokens(userId);
    return tokens !== null;
  }

  /**
   * Get an authenticated OAuth2Client for making API calls
   */
  async getAuthenticatedClient(userId: string): Promise<OAuth2Client> {
    const accessToken = await this.getValidAccessToken(userId);
    const tokens = await this.getTokens(userId);

    if (!tokens) {
      throw new Error('No tokens found');
    }

    const client = new google.auth.OAuth2(
      config.google?.clientId,
      config.google?.clientSecret,
      config.google?.redirectUri
    );

    client.setCredentials({
      access_token: accessToken,
      refresh_token: tokens.refresh_token,
    });

    return client;
  }

  /**
   * Get connection status with details
   */
  async getConnectionStatus(userId: string): Promise<{
    connected: boolean;
    email?: string;
    scopes?: string[];
    expiresAt?: Date;
    isValid?: boolean;
  }> {
    const tokens = await this.getTokens(userId);

    if (!tokens) {
      return { connected: false };
    }

    // Type assertion needed until Supabase types are regenerated
    const { data } = await (this.supabase as any)
      .from('google_oauth_tokens')
      .select('is_valid, last_error')
      .eq('user_id', userId)
      .single();

    return {
      connected: true,
      email: tokens.google_email,
      scopes: tokens.granted_scopes,
      expiresAt: tokens.token_expires_at,
      isValid: data?.is_valid ?? true,
    };
  }
}

// Singleton instance
export const googleOAuth = new GoogleOAuthService();
