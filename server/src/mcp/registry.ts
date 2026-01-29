/**
 * MCP Registry - Federated Tool Registry
 * Manages registration, discovery, and execution of MCP tools
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { CircuitBreaker } from '../services/circuitBreaker.js';
import {
  MCPTool,
  MCPToolDefinition,
  MCPContext,
  MCPResult,
  MCPError,
  MCPEvent,
  MCPProvider,
  MCPProviderInterface,
  ToolFilter,
  ToolDiscoveryResult,
  MCPErrorCode,
} from './index.js';

// ============================================
// Registry Configuration
// ============================================

interface RegistryConfig {
  enableMetrics: boolean;
  enableAuditLog: boolean;
  defaultTimeout: number;
  maxConcurrentExecutions: number;
}

const DEFAULT_CONFIG: RegistryConfig = {
  enableMetrics: true,
  enableAuditLog: true,
  defaultTimeout: 30000, // 30 seconds
  maxConcurrentExecutions: 10,
};

// ============================================
// MCP Registry Class
// ============================================

export class MCPRegistry {
  private tools: Map<string, MCPTool> = new Map();
  private providers: Map<MCPProvider, MCPProviderInterface> = new Map();
  private circuitBreakers: Map<MCPProvider, CircuitBreaker> = new Map();
  private config: RegistryConfig;
  private supabase: ReturnType<typeof createClient> | null = null;
  private eventListeners: Array<(event: MCPEvent) => void> = [];

  constructor(registryConfig: Partial<RegistryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...registryConfig };

    // Initialize Supabase for audit logging
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }

    // Initialize circuit breakers for known providers
    this.initializeCircuitBreakers();
  }

  private initializeCircuitBreakers(): void {
    const providers: MCPProvider[] = ['google', 'slack', 'zoom', 'internal', 'custom'];

    for (const provider of providers) {
      this.circuitBreakers.set(
        provider,
        new CircuitBreaker(`mcp-${provider}`, {
          failureThreshold: 5,
          successThreshold: 3,
          timeout: 30000,
        })
      );
    }
  }

  // ============================================
  // Tool Registration
  // ============================================

  registerTool(tool: MCPTool): void {
    const { name } = tool.definition;

    if (this.tools.has(name)) {
      console.warn(`[MCPRegistry] Tool "${name}" is being re-registered. Overwriting.`);
    }

    this.tools.set(name, tool);
    console.log(`[MCPRegistry] Registered tool: ${name} (${tool.definition.provider})`);
  }

  registerTools(tools: MCPTool[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  unregisterTool(name: string): boolean {
    const deleted = this.tools.delete(name);
    if (deleted) {
      console.log(`[MCPRegistry] Unregistered tool: ${name}`);
    }
    return deleted;
  }

  // ============================================
  // Provider Registration
  // ============================================

  registerProvider(provider: MCPProviderInterface): void {
    this.providers.set(provider.name, provider);

    // Register all tools from this provider
    const tools = provider.getTools();
    this.registerTools(tools);

    console.log(
      `[MCPRegistry] Registered provider: ${provider.displayName} with ${tools.length} tools`
    );
  }

  // ============================================
  // Tool Discovery
  // ============================================

  getTool(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  getToolDefinition(name: string): MCPToolDefinition | undefined {
    return this.tools.get(name)?.definition;
  }

  discoverTools(filter?: ToolFilter): ToolDiscoveryResult {
    let tools = Array.from(this.tools.values());

    if (filter) {
      if (filter.category) {
        tools = tools.filter((t) => t.definition.category === filter.category);
      }
      if (filter.provider) {
        tools = tools.filter((t) => t.definition.provider === filter.provider);
      }
      if (filter.requiresApproval !== undefined) {
        tools = tools.filter((t) => t.definition.requiresApproval === filter.requiresApproval);
      }
    }

    return {
      tools: tools.map((t) => ({
        name: t.definition.name,
        description: t.definition.description,
        category: t.definition.category,
        provider: t.definition.provider,
        requiresApproval: t.definition.requiresApproval,
      })),
      total: tools.length,
    };
  }

  listAllTools(): string[] {
    return Array.from(this.tools.keys());
  }

  // ============================================
  // Tool Execution
  // ============================================

  async execute(
    toolName: string,
    input: unknown,
    context: MCPContext
  ): Promise<MCPResult> {
    const startTime = Date.now();
    const eventId = uuidv4();

    // Get tool
    const tool = this.tools.get(toolName);
    if (!tool) {
      const error = new MCPError(
        `Tool "${toolName}" not found`,
        'TOOL_NOT_FOUND',
        toolName
      );
      await this.logEvent({
        id: eventId,
        timestamp: new Date(),
        eventType: 'tool_failed',
        toolName,
        provider: 'internal',
        context,
        error: error.message,
      });
      return error.toResult();
    }

    const { definition } = tool;

    // Emit tool_called event
    await this.emitEvent({
      id: eventId,
      timestamp: new Date(),
      eventType: 'tool_called',
      toolName,
      provider: definition.provider,
      context,
      input,
    });

    try {
      // Validate input
      const validationResult = definition.inputSchema.safeParse(input);
      if (!validationResult.success) {
        throw new MCPError(
          `Invalid input: ${validationResult.error.message}`,
          'VALIDATION_ERROR',
          toolName
        );
      }

      // Check approval requirements
      if (definition.requiresApproval && definition.approvalPolicy === 'require_approval') {
        // Return early with approval request
        // The caller should handle creating an approval request
        return {
          success: false,
          error: 'Approval required before execution',
          errorCode: 'APPROVAL_REQUIRED',
          metadata: {
            approvalRequired: true,
            approvalDescription: definition.getApprovalDescription?.(input) ||
              `Execute ${toolName}`,
          },
        };
      }

      // Get circuit breaker for this provider
      const breaker = this.circuitBreakers.get(definition.provider);

      // Execute with circuit breaker
      let result: MCPResult;
      if (breaker) {
        result = await breaker.execute(() => definition.execute(input, context));
      } else {
        result = await definition.execute(input, context);
      }

      const durationMs = Date.now() - startTime;

      // Emit tool_completed event
      await this.emitEvent({
        id: eventId,
        timestamp: new Date(),
        eventType: 'tool_completed',
        toolName,
        provider: definition.provider,
        context,
        input,
        output: result.data,
        durationMs,
      });

      // Log execution to database
      await this.logExecution(toolName, context, input, result, durationMs);

      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTimeMs: durationMs,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const mcpError =
        error instanceof MCPError
          ? error
          : new MCPError(
              (error as Error).message,
              'INTERNAL_ERROR',
              toolName,
              false,
              error as Error
            );

      // Emit tool_failed event
      await this.emitEvent({
        id: eventId,
        timestamp: new Date(),
        eventType: 'tool_failed',
        toolName,
        provider: definition.provider,
        context,
        input,
        error: mcpError.message,
        durationMs,
      });

      // Log failed execution
      await this.logExecution(toolName, context, input, mcpError.toResult(), durationMs);

      return mcpError.toResult();
    }
  }

  // ============================================
  // Approval Handling
  // ============================================

  async executeWithApproval(
    toolName: string,
    input: unknown,
    context: MCPContext,
    approvalId: string,
    approved: boolean
  ): Promise<MCPResult> {
    if (!approved) {
      return {
        success: false,
        error: 'Action was not approved',
        errorCode: 'APPROVAL_DENIED',
        metadata: { approvalId },
      };
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      return new MCPError('Tool not found', 'TOOL_NOT_FOUND', toolName).toResult();
    }

    const { definition } = tool;
    const startTime = Date.now();

    try {
      const result = await definition.execute(input, context);
      const durationMs = Date.now() - startTime;

      await this.logExecution(toolName, context, input, result, durationMs, approvalId);

      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTimeMs: durationMs,
          approvalId,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const mcpError = new MCPError(
        (error as Error).message,
        'INTERNAL_ERROR',
        toolName,
        false,
        error as Error
      );
      await this.logExecution(toolName, context, input, mcpError.toResult(), durationMs, approvalId);
      return mcpError.toResult();
    }
  }

  // ============================================
  // Event System
  // ============================================

  addEventListener(listener: (event: MCPEvent) => void): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(listener: (event: MCPEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private async emitEvent(event: MCPEvent): Promise<void> {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[MCPRegistry] Event listener error:', error);
      }
    }

    if (this.config.enableAuditLog) {
      await this.logEvent(event);
    }
  }

  private async logEvent(event: MCPEvent): Promise<void> {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[MCP Event] ${event.eventType}: ${event.toolName}`, {
        provider: event.provider,
        durationMs: event.durationMs,
        error: event.error,
      });
    }
  }

  // ============================================
  // Audit Logging
  // ============================================

  private async logExecution(
    toolName: string,
    context: MCPContext,
    input: unknown,
    result: MCPResult,
    durationMs: number,
    approvalId?: string
  ): Promise<void> {
    if (!this.supabase || !this.config.enableAuditLog) return;

    try {
      await this.supabase.from('mcp_tool_executions').insert({
        tool_name: toolName,
        user_id: context.userId,
        customer_id: context.customerId,
        input: input as any,
        output: result.data,
        success: result.success,
        error_message: result.error,
        execution_time_ms: durationMs,
        approval_id: approvalId,
      });
    } catch (error) {
      console.error('[MCPRegistry] Failed to log execution:', error);
    }
  }

  // ============================================
  // Health Checks
  // ============================================

  async checkProviderHealth(provider: MCPProvider): Promise<boolean> {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) return false;

    try {
      return await providerInstance.isHealthy();
    } catch {
      return false;
    }
  }

  async checkAllHealth(): Promise<Record<MCPProvider, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, provider] of this.providers) {
      results[name] = await this.checkProviderHealth(name);
    }

    // Also check circuit breaker states
    for (const [name, breaker] of this.circuitBreakers) {
      const stats = breaker.getStats();
      if (stats.state === 'OPEN') {
        results[name] = false;
      }
    }

    return results as Record<MCPProvider, boolean>;
  }

  getCircuitBreakerStats(): Record<string, ReturnType<CircuitBreaker['getStats']>> {
    const stats: Record<string, ReturnType<CircuitBreaker['getStats']>> = {};
    for (const [name, breaker] of this.circuitBreakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  // ============================================
  // Metrics
  // ============================================

  getMetrics(): {
    totalTools: number;
    toolsByProvider: Record<string, number>;
    toolsByCategory: Record<string, number>;
    circuitBreakerStats: Record<string, any>;
  } {
    const toolsByProvider: Record<string, number> = {};
    const toolsByCategory: Record<string, number> = {};

    for (const tool of this.tools.values()) {
      const { provider, category } = tool.definition;
      toolsByProvider[provider] = (toolsByProvider[provider] || 0) + 1;
      toolsByCategory[category] = (toolsByCategory[category] || 0) + 1;
    }

    return {
      totalTools: this.tools.size,
      toolsByProvider,
      toolsByCategory,
      circuitBreakerStats: this.getCircuitBreakerStats(),
    };
  }

  // ============================================
  // Shutdown
  // ============================================

  async shutdown(): Promise<void> {
    console.log('[MCPRegistry] Shutting down...');

    // Shutdown all providers
    for (const provider of this.providers.values()) {
      if (provider.shutdown) {
        await provider.shutdown();
      }
    }

    // Shutdown all tools
    for (const tool of this.tools.values()) {
      if (tool.shutdown) {
        await tool.shutdown();
      }
    }

    this.tools.clear();
    this.providers.clear();
    this.eventListeners = [];

    console.log('[MCPRegistry] Shutdown complete');
  }
}

// ============================================
// Singleton Instance
// ============================================

export const mcpRegistry = new MCPRegistry();

// ============================================
// Helper for creating tools
// ============================================

export function createMCPTool(definition: MCPToolDefinition): MCPTool {
  return {
    definition,
    healthCheck: async () => true,
  };
}
