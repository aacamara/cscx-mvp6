/**
 * Audit Logging Service
 * Production-grade audit logging for agentic actions
 * Logs to Supabase table `agent_audit_logs` with fallback to console
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// ============================================================================
// Types
// ============================================================================

export type AuditAction =
  | 'agent_execute_start'
  | 'agent_execute_complete'
  | 'agent_execute_error'
  | 'agent_plan_start'
  | 'agent_plan_complete'
  | 'agent_plan_error'
  | 'agent_resume_start'
  | 'agent_resume_complete'
  | 'agent_resume_error'
  | 'specialist_execute_start'
  | 'specialist_execute_complete'
  | 'specialist_execute_error'
  | 'approval_requested'
  | 'approval_approved'
  | 'approval_rejected'
  | 'tool_execution'
  | 'config_change'
  | 'mode_toggle'
  | 'schedule_update'
  | 'auth_login_success'
  | 'auth_login_failure'
  | 'auth_token_refresh'
  | 'auth_logout'
  | 'auth_invite_validated'
  | 'auth_invite_redeemed'
  | 'auth_admin_provisioned';

export type AuditStatus = 'success' | 'failure' | 'pending' | 'cancelled';

export interface AuditLogEntry {
  id?: string;
  userId: string;
  action: AuditAction;
  agentType?: string;
  customerId?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: AuditStatus;
  durationMs?: number;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
  timestamp?: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogQueryOptions {
  userId?: string;
  action?: AuditAction;
  agentType?: string;
  customerId?: string;
  status?: AuditStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogStats {
  totalLogs: number;
  byAction: Record<string, number>;
  byStatus: Record<string, number>;
  byAgentType: Record<string, number>;
  avgDurationMs: number;
  errorRate: number;
}

// ============================================================================
// Audit Log Service
// ============================================================================

class AuditLogService {
  private client: SupabaseClient | null = null;
  private inMemoryLogs: AuditLogEntry[] = [];
  private readonly MAX_IN_MEMORY_LOGS = 10000;
  private readonly TABLE_NAME = 'agent_audit_logs';

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.client = createClient(
        config.supabaseUrl,
        config.supabaseServiceKey
      );
    }
  }

  /**
   * Log an audit entry
   */
  async log(entry: AuditLogEntry): Promise<string> {
    const timestamp = entry.timestamp || new Date();
    const id = entry.id || `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const logEntry: AuditLogEntry = {
      ...entry,
      id,
      timestamp,
    };

    // Always log to console in development
    if (config.nodeEnv === 'development') {
      this.logToConsole(logEntry);
    }

    // Attempt to log to Supabase
    if (this.client) {
      try {
        await this.logToDatabase(logEntry);
      } catch (error) {
        console.error('[AuditLog] Failed to write to database:', error);
        // Fall back to in-memory storage
        this.logToMemory(logEntry);
      }
    } else {
      // No database configured, use in-memory
      this.logToMemory(logEntry);
    }

    return id;
  }

  /**
   * Log to Supabase database
   */
  private async logToDatabase(entry: AuditLogEntry): Promise<void> {
    if (!this.client) return;

    const { error } = await this.client
      .from(this.TABLE_NAME)
      .insert({
        id: entry.id,
        user_id: entry.userId,
        action: entry.action,
        agent_type: entry.agentType,
        customer_id: entry.customerId,
        input: entry.input,
        output: entry.output,
        status: entry.status,
        duration_ms: entry.durationMs,
        error: entry.error,
        metadata: entry.metadata,
        ip_address: entry.ipAddress,
        user_agent: entry.userAgent,
        created_at: entry.timestamp?.toISOString(),
      });

    if (error) {
      throw error;
    }
  }

  /**
   * Log to console (for development/debugging)
   */
  private logToConsole(entry: AuditLogEntry): void {
    const logLevel = entry.status === 'failure' ? 'error' : 'info';
    const prefix = `[AuditLog:${entry.action}]`;

    const logData = {
      userId: entry.userId,
      agentType: entry.agentType,
      customerId: entry.customerId,
      status: entry.status,
      durationMs: entry.durationMs,
      ...(entry.error && { error: entry.error.message }),
    };

    if (logLevel === 'error') {
      console.error(prefix, logData);
      if (entry.error?.stack) {
        console.error(prefix, 'Stack:', entry.error.stack);
      }
    } else {
      console.log(prefix, logData);
    }
  }

  /**
   * Log to in-memory storage (fallback)
   */
  private logToMemory(entry: AuditLogEntry): void {
    this.inMemoryLogs.push(entry);

    // Trim old logs if exceeding max
    if (this.inMemoryLogs.length > this.MAX_IN_MEMORY_LOGS) {
      this.inMemoryLogs = this.inMemoryLogs.slice(-this.MAX_IN_MEMORY_LOGS / 2);
    }
  }

  /**
   * Query audit logs
   */
  async query(options: AuditLogQueryOptions = {}): Promise<AuditLogEntry[]> {
    if (this.client) {
      try {
        return await this.queryDatabase(options);
      } catch (error) {
        console.error('[AuditLog] Failed to query database:', error);
        return this.queryMemory(options);
      }
    }

    return this.queryMemory(options);
  }

  /**
   * Query from Supabase
   */
  private async queryDatabase(options: AuditLogQueryOptions): Promise<AuditLogEntry[]> {
    if (!this.client) return [];

    let query = this.client
      .from(this.TABLE_NAME)
      .select('*')
      .order('created_at', { ascending: false });

    if (options.userId) {
      query = query.eq('user_id', options.userId);
    }
    if (options.action) {
      query = query.eq('action', options.action);
    }
    if (options.agentType) {
      query = query.eq('agent_type', options.agentType);
    }
    if (options.customerId) {
      query = query.eq('customer_id', options.customerId);
    }
    if (options.status) {
      query = query.eq('status', options.status);
    }
    if (options.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }
    if (options.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map(this.mapDatabaseEntry);
  }

  /**
   * Query from in-memory storage
   */
  private queryMemory(options: AuditLogQueryOptions): AuditLogEntry[] {
    let logs = [...this.inMemoryLogs];

    if (options.userId) {
      logs = logs.filter(l => l.userId === options.userId);
    }
    if (options.action) {
      logs = logs.filter(l => l.action === options.action);
    }
    if (options.agentType) {
      logs = logs.filter(l => l.agentType === options.agentType);
    }
    if (options.customerId) {
      logs = logs.filter(l => l.customerId === options.customerId);
    }
    if (options.status) {
      logs = logs.filter(l => l.status === options.status);
    }
    if (options.startDate) {
      logs = logs.filter(l => l.timestamp && l.timestamp >= options.startDate!);
    }
    if (options.endDate) {
      logs = logs.filter(l => l.timestamp && l.timestamp <= options.endDate!);
    }

    // Sort by timestamp descending
    logs.sort((a, b) => {
      const timeA = a.timestamp?.getTime() || 0;
      const timeB = b.timestamp?.getTime() || 0;
      return timeB - timeA;
    });

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    logs = logs.slice(offset, offset + limit);

    return logs;
  }

  /**
   * Map database row to AuditLogEntry
   */
  private mapDatabaseEntry(row: Record<string, unknown>): AuditLogEntry {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      action: row.action as AuditAction,
      agentType: row.agent_type as string | undefined,
      customerId: row.customer_id as string | undefined,
      input: row.input as Record<string, unknown> | undefined,
      output: row.output as Record<string, unknown> | undefined,
      status: row.status as AuditStatus,
      durationMs: row.duration_ms as number | undefined,
      error: row.error as AuditLogEntry['error'] | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      timestamp: row.created_at ? new Date(row.created_at as string) : undefined,
      ipAddress: row.ip_address as string | undefined,
      userAgent: row.user_agent as string | undefined,
    };
  }

  /**
   * Get audit log statistics
   */
  async getStats(options: AuditLogQueryOptions = {}): Promise<AuditLogStats> {
    const logs = await this.query({ ...options, limit: 10000 });

    const byAction: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byAgentType: Record<string, number> = {};
    let totalDuration = 0;
    let durationCount = 0;
    let errorCount = 0;

    for (const log of logs) {
      // Count by action
      byAction[log.action] = (byAction[log.action] || 0) + 1;

      // Count by status
      byStatus[log.status] = (byStatus[log.status] || 0) + 1;

      // Count by agent type
      if (log.agentType) {
        byAgentType[log.agentType] = (byAgentType[log.agentType] || 0) + 1;
      }

      // Track duration
      if (log.durationMs !== undefined) {
        totalDuration += log.durationMs;
        durationCount++;
      }

      // Track errors
      if (log.status === 'failure') {
        errorCount++;
      }
    }

    return {
      totalLogs: logs.length,
      byAction,
      byStatus,
      byAgentType,
      avgDurationMs: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
      errorRate: logs.length > 0 ? Math.round((errorCount / logs.length) * 100) / 100 : 0,
    };
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  /**
   * Log agent execution start
   */
  async logExecutionStart(
    userId: string,
    goal: string,
    customerId?: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.log({
      userId,
      action: 'agent_execute_start',
      agentType: 'orchestrator',
      customerId,
      input: { goal },
      status: 'pending',
      metadata,
    });
  }

  /**
   * Log agent execution completion
   */
  async logExecutionComplete(
    userId: string,
    goal: string,
    result: Record<string, unknown>,
    durationMs: number,
    customerId?: string
  ): Promise<string> {
    return this.log({
      userId,
      action: 'agent_execute_complete',
      agentType: 'orchestrator',
      customerId,
      input: { goal },
      output: result,
      status: 'success',
      durationMs,
    });
  }

  /**
   * Log agent execution error
   */
  async logExecutionError(
    userId: string,
    goal: string,
    error: Error,
    durationMs: number,
    customerId?: string
  ): Promise<string> {
    return this.log({
      userId,
      action: 'agent_execute_error',
      agentType: 'orchestrator',
      customerId,
      input: { goal },
      status: 'failure',
      durationMs,
      error: {
        message: error.message,
        code: (error as any).code,
        stack: error.stack,
      },
    });
  }

  /**
   * Log approval decision
   */
  async logApprovalDecision(
    userId: string,
    stateId: string,
    approved: boolean,
    actionType?: string,
    reason?: string
  ): Promise<string> {
    return this.log({
      userId,
      action: approved ? 'approval_approved' : 'approval_rejected',
      status: 'success',
      metadata: {
        stateId,
        actionType,
        reason,
      },
    });
  }

  /**
   * Log specialist execution
   */
  async logSpecialistExecution(
    userId: string,
    agentId: string,
    task: string,
    result: Record<string, unknown> | null,
    status: AuditStatus,
    durationMs: number,
    customerId?: string,
    error?: Error
  ): Promise<string> {
    return this.log({
      userId,
      action: status === 'success' ? 'specialist_execute_complete' : 'specialist_execute_error',
      agentType: agentId,
      customerId,
      input: { task },
      output: result || undefined,
      status,
      durationMs,
      error: error ? {
        message: error.message,
        code: (error as any).code,
        stack: error.stack,
      } : undefined,
    });
  }

  /**
   * Log configuration change
   */
  async logConfigChange(
    userId: string,
    changes: Record<string, unknown>,
    previousConfig?: Record<string, unknown>
  ): Promise<string> {
    return this.log({
      userId,
      action: 'config_change',
      status: 'success',
      input: { changes },
      metadata: { previousConfig },
    });
  }

  /**
   * Log mode toggle
   */
  async logModeToggle(userId: string, enabled: boolean): Promise<string> {
    return this.log({
      userId,
      action: 'mode_toggle',
      status: 'success',
      metadata: { enabled },
    });
  }

  // ============================================================================
  // Auth Event Methods
  // ============================================================================

  /**
   * Log successful login
   */
  async logAuthLoginSuccess(
    userId: string,
    email?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    return this.log({
      userId,
      action: 'auth_login_success',
      status: 'success',
      metadata: { email },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log failed login attempt
   */
  async logAuthLoginFailure(
    userId: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    return this.log({
      userId,
      action: 'auth_login_failure',
      status: 'failure',
      error: { message: reason },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log token refresh / session validation
   */
  async logAuthTokenRefresh(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    return this.log({
      userId,
      action: 'auth_token_refresh',
      status: 'success',
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log user logout
   */
  async logAuthLogout(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    return this.log({
      userId,
      action: 'auth_logout',
      status: 'success',
      ipAddress,
      userAgent,
    });
  }
}

// Export singleton instance
export const auditLog = new AuditLogService();

// Export class for testing
export { AuditLogService };
