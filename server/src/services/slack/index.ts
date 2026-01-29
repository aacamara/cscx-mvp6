/**
 * Slack Service
 * Handles Slack API operations: messaging, channels, users
 */

import { WebClient, ChatPostMessageResponse, ConversationsListResponse, UsersInfoResponse } from '@slack/web-api';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { CircuitBreaker } from '../circuitBreaker.js';

// ============================================
// Types
// ============================================

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  isMember: boolean;
  topic?: string;
  purpose?: string;
  memberCount?: number;
}

export interface SlackUser {
  id: string;
  name: string;
  realName?: string;
  email?: string;
  title?: string;
  avatar?: string;
  isBot: boolean;
  isAdmin: boolean;
}

export interface SlackMessage {
  ts: string;
  text: string;
  userId?: string;
  userName?: string;
  channel: string;
  threadTs?: string;
  reactions?: Array<{ name: string; count: number }>;
}

export interface SlackConnection {
  userId: string;
  teamId: string;
  teamName: string;
  accessToken: string;
  botUserId?: string;
  scopes: string[];
}

export interface SendMessageOptions {
  channel: string;
  text: string;
  blocks?: any[];
  threadTs?: string;
  unfurlLinks?: boolean;
  unfurlMedia?: boolean;
}

// ============================================
// Slack Service
// ============================================

export class SlackService {
  private clients: Map<string, WebClient> = new Map();
  private supabase: ReturnType<typeof createClient> | null = null;
  private circuitBreaker: CircuitBreaker;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    this.circuitBreaker = new CircuitBreaker('slack', {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 30000,
    });
  }

  // ============================================
  // Connection Management
  // ============================================

  async getConnection(userId: string): Promise<SlackConnection | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('slack_connections')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;

    return {
      userId: data.user_id,
      teamId: data.team_id,
      teamName: data.team_name,
      accessToken: data.access_token,
      botUserId: data.bot_user_id,
      scopes: data.scopes || [],
    };
  }

  async saveConnection(connection: SlackConnection): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('slack_connections').upsert({
      user_id: connection.userId,
      team_id: connection.teamId,
      team_name: connection.teamName,
      access_token: connection.accessToken,
      bot_user_id: connection.botUserId,
      scopes: connection.scopes,
      connected_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,team_id',
    });
  }

  async deleteConnection(userId: string): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('slack_connections')
      .delete()
      .eq('user_id', userId);

    this.clients.delete(userId);
  }

  // ============================================
  // Client Management
  // ============================================

  async getClient(userId: string): Promise<WebClient> {
    // Check cache first
    if (this.clients.has(userId)) {
      return this.clients.get(userId)!;
    }

    // Get connection from database
    const connection = await this.getConnection(userId);
    if (!connection) {
      throw new Error('Slack not connected. Please connect your Slack workspace first.');
    }

    // Create new client
    const client = new WebClient(connection.accessToken);
    this.clients.set(userId, client);

    return client;
  }

  async isConnected(userId: string): Promise<boolean> {
    const connection = await this.getConnection(userId);
    return !!connection;
  }

  // ============================================
  // Messaging
  // ============================================

  async sendMessage(userId: string, options: SendMessageOptions): Promise<SlackMessage> {
    const client = await this.getClient(userId);

    const response = await this.circuitBreaker.execute<ChatPostMessageResponse>(() =>
      client.chat.postMessage({
        channel: options.channel,
        text: options.text,
        blocks: options.blocks,
        thread_ts: options.threadTs,
        unfurl_links: options.unfurlLinks ?? false,
        unfurl_media: options.unfurlMedia ?? false,
      })
    );

    if (!response.ok || !response.ts) {
      throw new Error(response.error || 'Failed to send message');
    }

    return {
      ts: response.ts,
      text: options.text,
      channel: options.channel,
      threadTs: options.threadTs,
    };
  }

  async replyToThread(
    userId: string,
    channel: string,
    threadTs: string,
    text: string,
    blocks?: any[]
  ): Promise<SlackMessage> {
    return this.sendMessage(userId, {
      channel,
      text,
      blocks,
      threadTs,
    });
  }

  async updateMessage(
    userId: string,
    channel: string,
    ts: string,
    text: string,
    blocks?: any[]
  ): Promise<void> {
    const client = await this.getClient(userId);

    await this.circuitBreaker.execute(() =>
      client.chat.update({
        channel,
        ts,
        text,
        blocks,
      })
    );
  }

  async deleteMessage(userId: string, channel: string, ts: string): Promise<void> {
    const client = await this.getClient(userId);

    await this.circuitBreaker.execute(() =>
      client.chat.delete({
        channel,
        ts,
      })
    );
  }

  // ============================================
  // Channels
  // ============================================

  async listChannels(
    userId: string,
    options: {
      types?: string[];
      excludeArchived?: boolean;
      limit?: number;
    } = {}
  ): Promise<SlackChannel[]> {
    const client = await this.getClient(userId);

    const response = await this.circuitBreaker.execute<ConversationsListResponse>(() =>
      client.conversations.list({
        types: options.types?.join(',') || 'public_channel,private_channel',
        exclude_archived: options.excludeArchived ?? true,
        limit: options.limit || 200,
      })
    );

    if (!response.ok || !response.channels) {
      throw new Error(response.error || 'Failed to list channels');
    }

    return response.channels.map(channel => ({
      id: channel.id || '',
      name: channel.name || '',
      isPrivate: channel.is_private || false,
      isMember: channel.is_member || false,
      topic: channel.topic?.value,
      purpose: channel.purpose?.value,
      memberCount: channel.num_members,
    }));
  }

  async getChannel(userId: string, channelId: string): Promise<SlackChannel | null> {
    const client = await this.getClient(userId);

    const response = await this.circuitBreaker.execute(() =>
      client.conversations.info({
        channel: channelId,
      })
    );

    if (!response.ok || !response.channel) {
      return null;
    }

    const channel = response.channel as any;
    return {
      id: channel.id || '',
      name: channel.name || '',
      isPrivate: channel.is_private || false,
      isMember: channel.is_member || false,
      topic: channel.topic?.value,
      purpose: channel.purpose?.value,
      memberCount: channel.num_members,
    };
  }

  async joinChannel(userId: string, channelId: string): Promise<void> {
    const client = await this.getClient(userId);

    await this.circuitBreaker.execute(() =>
      client.conversations.join({
        channel: channelId,
      })
    );
  }

  // ============================================
  // Users
  // ============================================

  async getUser(userId: string, slackUserId: string): Promise<SlackUser | null> {
    const client = await this.getClient(userId);

    const response = await this.circuitBreaker.execute<UsersInfoResponse>(() =>
      client.users.info({
        user: slackUserId,
      })
    );

    if (!response.ok || !response.user) {
      return null;
    }

    const user = response.user;
    return {
      id: user.id || '',
      name: user.name || '',
      realName: user.real_name,
      email: user.profile?.email,
      title: user.profile?.title,
      avatar: user.profile?.image_72,
      isBot: user.is_bot || false,
      isAdmin: user.is_admin || false,
    };
  }

  async listUsers(userId: string, limit: number = 100): Promise<SlackUser[]> {
    const client = await this.getClient(userId);

    const response = await this.circuitBreaker.execute(() =>
      client.users.list({
        limit,
      })
    );

    if (!response.ok || !response.members) {
      throw new Error('Failed to list users');
    }

    return response.members.map(user => ({
      id: user.id || '',
      name: user.name || '',
      realName: user.real_name,
      email: user.profile?.email,
      title: user.profile?.title,
      avatar: user.profile?.image_72,
      isBot: user.is_bot || false,
      isAdmin: user.is_admin || false,
    }));
  }

  async findUserByEmail(userId: string, email: string): Promise<SlackUser | null> {
    const client = await this.getClient(userId);

    try {
      const response = await this.circuitBreaker.execute(() =>
        client.users.lookupByEmail({
          email,
        })
      );

      if (!response.ok || !response.user) {
        return null;
      }

      const user = response.user;
      return {
        id: user.id || '',
        name: user.name || '',
        realName: user.real_name,
        email: user.profile?.email,
        title: user.profile?.title,
        avatar: user.profile?.image_72,
        isBot: user.is_bot || false,
        isAdmin: user.is_admin || false,
      };
    } catch {
      return null;
    }
  }

  // ============================================
  // Direct Messages
  // ============================================

  async openDM(userId: string, slackUserIds: string[]): Promise<string> {
    const client = await this.getClient(userId);

    const response = await this.circuitBreaker.execute(() =>
      client.conversations.open({
        users: slackUserIds.join(','),
      })
    );

    if (!response.ok || !response.channel?.id) {
      throw new Error('Failed to open DM');
    }

    return response.channel.id;
  }

  async sendDM(
    userId: string,
    slackUserId: string,
    text: string,
    blocks?: any[]
  ): Promise<SlackMessage> {
    const channelId = await this.openDM(userId, [slackUserId]);
    return this.sendMessage(userId, {
      channel: channelId,
      text,
      blocks,
    });
  }

  // ============================================
  // Reactions
  // ============================================

  async addReaction(
    userId: string,
    channel: string,
    ts: string,
    emoji: string
  ): Promise<void> {
    const client = await this.getClient(userId);

    await this.circuitBreaker.execute(() =>
      client.reactions.add({
        channel,
        timestamp: ts,
        name: emoji,
      })
    );
  }

  // ============================================
  // Health Check
  // ============================================

  async healthCheck(userId: string): Promise<boolean> {
    try {
      const client = await this.getClient(userId);
      const response = await client.auth.test();
      return response.ok || false;
    } catch {
      return false;
    }
  }

  getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
  }
}

// Singleton instance
export const slackService = new SlackService();
