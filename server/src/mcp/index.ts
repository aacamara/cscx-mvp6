/**
 * MCP (Model Context Protocol) Core Types and Interfaces
 * Foundation for tool routing and agent access to external services
 */

import { z } from 'zod';

// ============================================
// Core MCP Types
// ============================================

export interface MCPContext {
  userId: string;
  customerId?: string;
  customerName?: string;
  sessionId?: string;
  agentId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

export interface MCPResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  metadata?: {
    executionTimeMs?: number;
    cached?: boolean;
    approvalId?: string;
    [key: string]: unknown;
  };
}

export type ApprovalPolicy =
  | 'always_approve'      // No approval needed
  | 'auto_approve'        // Auto-approve with conditions
  | 'require_approval'    // Always requires human approval
  | 'never_approve';      // Never allow (blocked)

export interface MCPToolDefinition {
  name: string;
  description: string;
  category: MCPToolCategory;
  provider: MCPProvider;

  // Schema for input validation
  inputSchema: z.ZodType<any>;
  outputSchema?: z.ZodType<any>;

  // Execution requirements
  requiresAuth: boolean;
  requiresApproval: boolean;
  approvalPolicy: ApprovalPolicy;

  // Rate limiting
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };

  // Execution
  execute: (input: unknown, context: MCPContext) => Promise<MCPResult>;

  // Optional approval description generator
  getApprovalDescription?: (input: unknown) => string;
}

export type MCPToolCategory =
  | 'communication'       // Email, Slack, messaging
  | 'scheduling'          // Calendar, meetings
  | 'documents'           // Drive, Docs, file management
  | 'meeting_intelligence' // Zoom recordings, transcripts
  | 'crm'                 // CRM operations
  | 'analytics'           // Usage data, metrics
  | 'automation';         // Triggers, workflows

export type MCPProvider =
  | 'google'
  | 'slack'
  | 'zoom'
  | 'internal'
  | 'custom';

// ============================================
// MCP Tool Interface (for registration)
// Simplified flat structure for easier tool creation
// ============================================

export interface MCPTool {
  name: string;
  description: string;
  category: string;
  provider: string;

  // Schema for input validation
  inputSchema: z.ZodType<any>;
  outputSchema?: z.ZodType<any>;

  // Execution requirements
  requiresApproval?: boolean;
  approvalPolicy?: ApprovalPolicy;

  // Rate limiting
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };

  // Execution
  execute: (input: any, context: MCPContext) => Promise<MCPResult>;

  // Optional approval description generator
  getApprovalDescription?: (input: unknown) => string;

  // Health check for the tool
  healthCheck?: () => Promise<boolean>;

  // Cleanup/shutdown
  shutdown?: () => Promise<void>;
}

// Full definition with all required fields
export interface MCPToolFull {
  definition: MCPToolDefinition;
  healthCheck?: () => Promise<boolean>;
  shutdown?: () => Promise<void>;
}

// ============================================
// MCP Provider Interface (for extensibility)
// ============================================

export interface MCPProviderInterface {
  name: MCPProvider;
  displayName: string;

  // Get all tools from this provider
  getTools(): MCPTool[];

  // Check if provider is healthy/connected
  isHealthy(): Promise<boolean>;

  // Initialize provider (OAuth, etc.)
  initialize?(context: MCPContext): Promise<void>;

  // Cleanup
  shutdown?(): Promise<void>;
}

// ============================================
// MCP Error Types
// ============================================

export class MCPError extends Error {
  constructor(
    message: string,
    public readonly code: MCPErrorCode,
    public readonly toolName?: string,
    public readonly retryable: boolean = false,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'MCPError';
  }

  toResult(): MCPResult {
    return {
      success: false,
      error: this.message,
      errorCode: this.code,
      retryable: this.retryable,
    };
  }
}

export type MCPErrorCode =
  | 'TOOL_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'AUTH_REQUIRED'
  | 'AUTH_FAILED'
  | 'APPROVAL_REQUIRED'
  | 'APPROVAL_DENIED'
  | 'RATE_LIMITED'
  | 'PROVIDER_ERROR'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR';

// ============================================
// MCP Events (for observability)
// ============================================

export interface MCPEvent {
  id: string;
  timestamp: Date;
  eventType: MCPEventType;
  toolName: string;
  provider: MCPProvider;
  context: MCPContext;

  // Execution details
  input?: unknown;
  output?: unknown;
  error?: string;

  // Metrics
  durationMs?: number;

  // Approval tracking
  approvalId?: string;
  approvalStatus?: 'pending' | 'approved' | 'denied';
}

export type MCPEventType =
  | 'tool_called'
  | 'tool_completed'
  | 'tool_failed'
  | 'approval_requested'
  | 'approval_received'
  | 'rate_limited'
  | 'circuit_opened'
  | 'circuit_closed';

// ============================================
// Helper Types
// ============================================

export interface ToolFilter {
  category?: MCPToolCategory;
  provider?: MCPProvider;
  requiresApproval?: boolean;
  enabled?: boolean;
}

export interface ToolDiscoveryResult {
  tools: Array<{
    name: string;
    description: string;
    category: MCPToolCategory;
    provider: MCPProvider;
    requiresApproval: boolean;
  }>;
  total: number;
}

// ============================================
// Common Zod Schemas
// ============================================

export const emailAddressSchema = z.string().email();
export const uuidSchema = z.string().uuid();
export const dateSchema = z.string().datetime();

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
  pageToken: z.string().optional(),
});

// ============================================
// Exports
// ============================================

export { MCPRegistry } from './registry.js';
