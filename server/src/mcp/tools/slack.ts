/**
 * Slack MCP Tool Wrappers
 * Wraps SlackService methods as MCP tools
 */

import { z } from 'zod';
import { slackService, SlackChannel, SlackUser, SlackMessage } from '../../services/slack/index.js';
import type { MCPTool, MCPContext, MCPResult } from '../index.js';

// ============================================
// Input Schemas
// ============================================

const sendMessageSchema = z.object({
  channel: z.string().min(1).describe('Channel ID or name to send message to'),
  text: z.string().min(1).describe('Message text'),
  blocks: z.array(z.any()).optional().describe('Slack Block Kit blocks for rich formatting'),
  threadTs: z.string().optional().describe('Thread timestamp to reply to'),
});

const listChannelsSchema = z.object({
  types: z.array(z.enum(['public_channel', 'private_channel', 'mpim', 'im'])).optional(),
  excludeArchived: z.boolean().optional().default(true),
  limit: z.number().int().min(1).max(1000).optional().default(200),
});

const getChannelSchema = z.object({
  channelId: z.string().min(1).describe('Slack channel ID'),
});

const getUserSchema = z.object({
  slackUserId: z.string().min(1).describe('Slack user ID'),
});

const findUserByEmailSchema = z.object({
  email: z.string().email().describe('Email address to search for'),
});

const sendDMSchema = z.object({
  slackUserId: z.string().min(1).describe('Slack user ID to send DM to'),
  text: z.string().min(1).describe('Message text'),
  blocks: z.array(z.any()).optional().describe('Slack Block Kit blocks'),
});

const replyToThreadSchema = z.object({
  channel: z.string().min(1).describe('Channel ID'),
  threadTs: z.string().min(1).describe('Thread timestamp to reply to'),
  text: z.string().min(1).describe('Reply text'),
  blocks: z.array(z.any()).optional(),
});

const addReactionSchema = z.object({
  channel: z.string().min(1).describe('Channel ID'),
  ts: z.string().min(1).describe('Message timestamp'),
  emoji: z.string().min(1).describe('Emoji name without colons (e.g., "thumbsup")'),
});

// ============================================
// Tool Implementations
// ============================================

export const slackSendMessage: MCPTool = createMCPTool({
  name: 'slack.send_message',
  description: 'Send a message to a Slack channel. Requires human approval.',
  category: 'communication',
  provider: 'slack',
  inputSchema: sendMessageSchema,
  requiresAuth: true,
  requiresApproval: true,
  approvalPolicy: 'require_approval',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ message: SlackMessage }>> => {
    try {
      const params = sendMessageSchema.parse(input);
      const message = await slackService.sendMessage(context.userId, params);

      return {
        success: true,
        data: { message },
        metadata: {
          channel: params.channel,
          hasBlocks: !!params.blocks?.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: false,
      };
    }
  },

  getApprovalDescription: (input: unknown): string => {
    try {
      const params = sendMessageSchema.parse(input);
      const preview = params.text.substring(0, 50);
      return `Send Slack message to ${params.channel}: "${preview}${params.text.length > 50 ? '...' : ''}"`;
    } catch {
      return 'Send Slack message';
    }
  },
});

export const slackListChannels: MCPTool = createMCPTool({
  name: 'slack.list_channels',
  description: 'List available Slack channels the user has access to.',
  category: 'communication',
  provider: 'slack',
  inputSchema: listChannelsSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ channels: SlackChannel[] }>> => {
    try {
      const params = listChannelsSchema.parse(input);
      const channels = await slackService.listChannels(context.userId, params);

      return {
        success: true,
        data: { channels },
        metadata: {
          count: channels.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: true,
      };
    }
  },
});

export const slackGetChannel: MCPTool = createMCPTool({
  name: 'slack.get_channel',
  description: 'Get information about a specific Slack channel.',
  category: 'communication',
  provider: 'slack',
  inputSchema: getChannelSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ channel: SlackChannel | null }>> => {
    try {
      const { channelId } = getChannelSchema.parse(input);
      const channel = await slackService.getChannel(context.userId, channelId);

      return {
        success: true,
        data: { channel },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: false,
      };
    }
  },
});

export const slackGetUser: MCPTool = createMCPTool({
  name: 'slack.get_user',
  description: 'Get information about a Slack user by their user ID.',
  category: 'communication',
  provider: 'slack',
  inputSchema: getUserSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ user: SlackUser | null }>> => {
    try {
      const { slackUserId } = getUserSchema.parse(input);
      const user = await slackService.getUser(context.userId, slackUserId);

      return {
        success: true,
        data: { user },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: false,
      };
    }
  },
});

export const slackFindUserByEmail: MCPTool = createMCPTool({
  name: 'slack.find_user_by_email',
  description: 'Find a Slack user by their email address.',
  category: 'communication',
  provider: 'slack',
  inputSchema: findUserByEmailSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ user: SlackUser | null }>> => {
    try {
      const { email } = findUserByEmailSchema.parse(input);
      const user = await slackService.findUserByEmail(context.userId, email);

      return {
        success: true,
        data: { user },
        metadata: { searchEmail: email },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: false,
      };
    }
  },
});

export const slackSendDM: MCPTool = createMCPTool({
  name: 'slack.send_dm',
  description: 'Send a direct message to a Slack user. Requires human approval.',
  category: 'communication',
  provider: 'slack',
  inputSchema: sendDMSchema,
  requiresAuth: true,
  requiresApproval: true,
  approvalPolicy: 'require_approval',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ message: SlackMessage }>> => {
    try {
      const params = sendDMSchema.parse(input);
      const message = await slackService.sendDM(
        context.userId,
        params.slackUserId,
        params.text,
        params.blocks
      );

      return {
        success: true,
        data: { message },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: false,
      };
    }
  },

  getApprovalDescription: (input: unknown): string => {
    try {
      const params = sendDMSchema.parse(input);
      const preview = params.text.substring(0, 50);
      return `Send DM to Slack user: "${preview}${params.text.length > 50 ? '...' : ''}"`;
    } catch {
      return 'Send Slack direct message';
    }
  },
});

export const slackReplyToThread: MCPTool = createMCPTool({
  name: 'slack.reply_to_thread',
  description: 'Reply to a thread in Slack. Requires human approval.',
  category: 'communication',
  provider: 'slack',
  inputSchema: replyToThreadSchema,
  requiresAuth: true,
  requiresApproval: true,
  approvalPolicy: 'require_approval',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ message: SlackMessage }>> => {
    try {
      const params = replyToThreadSchema.parse(input);
      const message = await slackService.replyToThread(
        context.userId,
        params.channel,
        params.threadTs,
        params.text,
        params.blocks
      );

      return {
        success: true,
        data: { message },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: false,
      };
    }
  },

  getApprovalDescription: (input: unknown): string => {
    try {
      const params = replyToThreadSchema.parse(input);
      return `Reply to Slack thread in ${params.channel}`;
    } catch {
      return 'Reply to Slack thread';
    }
  },
});

export const slackAddReaction: MCPTool = createMCPTool({
  name: 'slack.add_reaction',
  description: 'Add an emoji reaction to a Slack message.',
  category: 'communication',
  provider: 'slack',
  inputSchema: addReactionSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ added: boolean }>> => {
    try {
      const params = addReactionSchema.parse(input);
      await slackService.addReaction(
        context.userId,
        params.channel,
        params.ts,
        params.emoji
      );

      return {
        success: true,
        data: { added: true },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: false,
      };
    }
  },
});

export const slackListUsers: MCPTool = createMCPTool({
  name: 'slack.list_users',
  description: 'List users in the Slack workspace.',
  category: 'communication',
  provider: 'slack',
  inputSchema: z.object({
    limit: z.number().int().min(1).max(200).optional().default(100),
  }),
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ users: SlackUser[] }>> => {
    try {
      const params = z.object({ limit: z.number().default(100) }).parse(input);
      const users = await slackService.listUsers(context.userId, params.limit);

      return {
        success: true,
        data: { users },
        metadata: {
          count: users.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: true,
      };
    }
  },
});

export const slackCheckConnection: MCPTool = createMCPTool({
  name: 'slack.check_connection',
  description: 'Check if Slack is connected and working.',
  category: 'communication',
  provider: 'slack',
  inputSchema: z.object({}),
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{
    connected: boolean;
    healthy: boolean;
  }>> => {
    try {
      const connected = await slackService.isConnected(context.userId);

      if (!connected) {
        return {
          success: true,
          data: { connected: false, healthy: false },
        };
      }

      const healthy = await slackService.healthCheck(context.userId);

      return {
        success: true,
        data: { connected, healthy },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: true,
      };
    }
  },
});

// ============================================
// Export all Slack tools
// ============================================

export const slackTools: MCPTool[] = [
  slackSendMessage,
  slackListChannels,
  slackGetChannel,
  slackGetUser,
  slackFindUserByEmail,
  slackSendDM,
  slackReplyToThread,
  slackAddReaction,
  slackListUsers,
  slackCheckConnection,
];
