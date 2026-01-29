/**
 * Gmail MCP Tool Wrappers
 * Wraps existing GmailService methods as MCP tools
 */

import { z } from 'zod';
import { gmailService, EmailThread, EmailMessage } from '../../services/google/gmail.js';
import { MCPTool, MCPContext, MCPResult, createMCPTool } from '../index.js';

// ============================================
// Input Schemas
// ============================================

const listThreadsSchema = z.object({
  query: z.string().optional().describe('Gmail search query (e.g., "from:user@example.com")'),
  maxResults: z.number().int().min(1).max(100).optional().default(20),
  labelIds: z.array(z.string()).optional(),
  pageToken: z.string().optional(),
});

const getThreadSchema = z.object({
  threadId: z.string().min(1).describe('Gmail thread ID'),
});

const sendEmailSchema = z.object({
  to: z.array(z.string().email()).min(1).describe('Recipient email addresses'),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().min(1).max(998).describe('Email subject'),
  bodyHtml: z.string().min(1).describe('Email body in HTML'),
  bodyText: z.string().optional().describe('Plain text version of email body'),
  threadId: z.string().optional().describe('Thread ID for replies'),
});

const createDraftSchema = z.object({
  to: z.array(z.string().email()).min(1).describe('Recipient email addresses'),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().min(1).max(998).describe('Email subject'),
  bodyHtml: z.string().min(1).describe('Email body in HTML'),
  bodyText: z.string().optional().describe('Plain text version of email body'),
  threadId: z.string().optional().describe('Thread ID for replies'),
});

const searchEmailsSchema = z.object({
  query: z.string().min(1).describe('Gmail search query'),
  maxResults: z.number().int().min(1).max(100).optional().default(20),
});

const threadActionSchema = z.object({
  threadId: z.string().min(1).describe('Gmail thread ID'),
});

// ============================================
// Tool Implementations
// ============================================

export const gmailListThreads: MCPTool = createMCPTool({
  name: 'gmail.list_threads',
  description: 'List recent email threads from Gmail inbox. Supports search queries and pagination.',
  category: 'communication',
  provider: 'google',
  inputSchema: listThreadsSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{
    threads: EmailThread[];
    nextPageToken?: string;
  }>> => {
    try {
      const params = listThreadsSchema.parse(input);
      const result = await gmailService.listThreads(context.userId, params);

      return {
        success: true,
        data: result,
        metadata: {
          count: result.threads.length,
          hasMore: !!result.nextPageToken,
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

export const gmailGetThread: MCPTool = createMCPTool({
  name: 'gmail.get_thread',
  description: 'Get a specific email thread with all messages by thread ID.',
  category: 'communication',
  provider: 'google',
  inputSchema: getThreadSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{
    thread: EmailThread;
    messages: EmailMessage[];
  }>> => {
    try {
      const { threadId } = getThreadSchema.parse(input);
      const result = await gmailService.getThread(context.userId, threadId);

      return {
        success: true,
        data: result,
        metadata: {
          messageCount: result.messages.length,
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
});

export const gmailSendEmail: MCPTool = createMCPTool({
  name: 'gmail.send_email',
  description: 'Send an email through Gmail. Requires human approval before sending.',
  category: 'communication',
  provider: 'google',
  inputSchema: sendEmailSchema,
  requiresAuth: true,
  requiresApproval: true,
  approvalPolicy: 'require_approval',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ messageId: string }>> => {
    try {
      const email = sendEmailSchema.parse(input);
      const messageId = await gmailService.sendEmail(context.userId, {
        ...email,
        saveToDb: true,
        customerId: context.customerId,
      });

      return {
        success: true,
        data: { messageId },
        metadata: {
          recipients: email.to.length + (email.cc?.length || 0) + (email.bcc?.length || 0),
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
      const email = sendEmailSchema.parse(input);
      return `Send email to ${email.to.join(', ')}: "${email.subject}"`;
    } catch {
      return 'Send email';
    }
  },
});

export const gmailCreateDraft: MCPTool = createMCPTool({
  name: 'gmail.create_draft',
  description: 'Create an email draft in Gmail. Does not send the email.',
  category: 'communication',
  provider: 'google',
  inputSchema: createDraftSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ draftId: string }>> => {
    try {
      const draft = createDraftSchema.parse(input);
      const draftId = await gmailService.createDraft(context.userId, draft);

      return {
        success: true,
        data: { draftId },
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

export const gmailSearch: MCPTool = createMCPTool({
  name: 'gmail.search',
  description: 'Search emails using Gmail search syntax (e.g., "from:user@example.com subject:renewal").',
  category: 'communication',
  provider: 'google',
  inputSchema: searchEmailsSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ threads: EmailThread[] }>> => {
    try {
      const { query, maxResults } = searchEmailsSchema.parse(input);
      const threads = await gmailService.searchEmails(context.userId, query, maxResults);

      return {
        success: true,
        data: { threads },
        metadata: {
          query,
          count: threads.length,
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

export const gmailMarkAsRead: MCPTool = createMCPTool({
  name: 'gmail.mark_as_read',
  description: 'Mark an email thread as read.',
  category: 'communication',
  provider: 'google',
  inputSchema: threadActionSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ success: boolean }>> => {
    try {
      const { threadId } = threadActionSchema.parse(input);
      await gmailService.markAsRead(context.userId, threadId);

      return {
        success: true,
        data: { success: true },
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

export const gmailArchiveThread: MCPTool = createMCPTool({
  name: 'gmail.archive_thread',
  description: 'Archive an email thread (remove from inbox).',
  category: 'communication',
  provider: 'google',
  inputSchema: threadActionSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ success: boolean }>> => {
    try {
      const { threadId } = threadActionSchema.parse(input);
      await gmailService.archiveThread(context.userId, threadId);

      return {
        success: true,
        data: { success: true },
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

export const gmailStarThread: MCPTool = createMCPTool({
  name: 'gmail.star_thread',
  description: 'Star an email thread for follow-up.',
  category: 'communication',
  provider: 'google',
  inputSchema: threadActionSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ success: boolean }>> => {
    try {
      const { threadId } = threadActionSchema.parse(input);
      await gmailService.starThread(context.userId, threadId);

      return {
        success: true,
        data: { success: true },
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

export const gmailGetLabels: MCPTool = createMCPTool({
  name: 'gmail.get_labels',
  description: 'Get all Gmail labels for organizing emails.',
  category: 'communication',
  provider: 'google',
  inputSchema: z.object({}),
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{
    labels: { id: string; name: string }[];
  }>> => {
    try {
      const labels = await gmailService.getLabels(context.userId);

      return {
        success: true,
        data: { labels },
        metadata: {
          count: labels.length,
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

// ============================================
// Export all Gmail tools
// ============================================

export const gmailTools: MCPTool[] = [
  gmailListThreads,
  gmailGetThread,
  gmailSendEmail,
  gmailCreateDraft,
  gmailSearch,
  gmailMarkAsRead,
  gmailArchiveThread,
  gmailStarThread,
  gmailGetLabels,
];
