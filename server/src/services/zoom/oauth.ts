/**
 * Zoom OAuth Service
 * Handles OAuth 2.0 flow for Zoom integration
 */

import { config } from '../../config/index.js';
import { createClient } from '@supabase/supabase-js';
import { zoomService } from './index.js';

const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);

// ============================================
// OAuth Configuration
// ============================================

const ZOOM_OAUTH_BASE = 'https://zoom.us/oauth';

// Required scopes for CSCX functionality
export const ZOOM_SCOPES = [
  'meeting:read',
  'meeting:write',
  'recording:read',
  'user:read',
  'webinar:read',
  'webinar:write',
];

// ============================================
// Zoom OAuth Service
// ============================================

export class ZoomOAuthService {
  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(userId: string, redirectUri: string): string {
    const state = Buffer.from(JSON.stringify({
      userId,
      timestamp: Date.now(),
    })).toString('base64');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.zoomClientId || '',
      redirect_uri: redirectUri,
      state,
    });

    return `${ZOOM_OAUTH_BASE}/authorize?${params}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
  }> {
    const response = await fetch(`${ZOOM_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.zoomClientId}:${config.zoomClientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    return response.json();
  }

  /**
   * Complete OAuth flow and store connection
   */
  async completeOAuth(
    userId: string,
    code: string,
    redirectUri: string
  ): Promise<{
    success: boolean;
    email?: string;
    name?: string;
    error?: string;
  }> {
    try {
      // Exchange code for tokens
      const tokens = await this.exchangeCode(code, redirectUri);

      // Set connection in service
      zoomService.setConnection(userId, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope.split(' '),
      });

      // Get user info
      const userInfo = await zoomService.getCurrentUser(userId);

      // Store connection in database
      const { error } = await supabase
        .from('zoom_connections')
        .upsert({
          user_id: userId,
          zoom_user_id: userInfo.id,
          email: userInfo.email,
          account_id: userInfo.account_id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          scope: tokens.scope.split(' '),
          connected_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        console.error('Error storing Zoom connection:', error);
        throw new Error('Failed to store connection');
      }

      return {
        success: true,
        email: userInfo.email,
        name: `${userInfo.first_name} ${userInfo.last_name}`,
      };
    } catch (error) {
      console.error('Zoom OAuth error:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Load connection from database
   */
  async loadConnection(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('zoom_connections')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return false;
    }

    zoomService.setConnection(userId, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(data.expires_at),
      accountId: data.account_id,
      scope: data.scope,
    });

    return true;
  }

  /**
   * Disconnect Zoom integration
   */
  async disconnect(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('zoom_connections')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error disconnecting Zoom:', error);
        return false;
      }

      // Clear from service
      // Note: ZoomService would need a removeConnection method

      return true;
    } catch (error) {
      console.error('Error disconnecting Zoom:', error);
      return false;
    }
  }

  /**
   * Check if user has Zoom connected
   */
  async isConnected(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('zoom_connections')
      .select('user_id, expires_at')
      .eq('user_id', userId)
      .single();

    if (!data) return false;

    // Check if token is still valid (with some buffer)
    const expiresAt = new Date(data.expires_at);
    const buffer = 5 * 60 * 1000; // 5 minutes

    if (expiresAt.getTime() - buffer < Date.now()) {
      // Token expired or about to expire, try to refresh
      const loaded = await this.loadConnection(userId);
      if (!loaded) return false;

      return zoomService.refreshToken(userId);
    }

    return true;
  }

  /**
   * Get connection status with details
   */
  async getConnectionStatus(userId: string): Promise<{
    connected: boolean;
    email?: string;
    accountId?: string;
    connectedAt?: string;
    scopes?: string[];
  }> {
    const { data, error } = await supabase
      .from('zoom_connections')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return { connected: false };
    }

    return {
      connected: true,
      email: data.email,
      accountId: data.account_id,
      connectedAt: data.connected_at,
      scopes: data.scope,
    };
  }
}

// ============================================
// Singleton Export
// ============================================

export const zoomOAuthService = new ZoomOAuthService();
