/**
 * Batch Operations Service
 * Enables executing goals for multiple customers in parallel
 *
 * Features:
 * - Parallel execution with configurable concurrency
 * - Aggregated results
 * - Stop on first error or continue all mode
 * - Progress tracking
 */

import { v4 as uuidv4 } from 'uuid';
import { executeGoal, ExecutionResult } from '../agents/engine/orchestrator-executor.js';
import { AgentContext, CustomerProfile } from '../agents/types.js';
import { SupabaseService } from './supabase.js';
import { AgenticModeConfig } from '../agents/engine/agentic-loop.js';

// ============================================
// Types
// ============================================

export interface BatchExecutionConfig {
  goal: string;
  customerIds: string[];
  userId: string;
  concurrency?: number;           // Max parallel executions (default: 5)
  stopOnError?: boolean;          // Stop all if one fails (default: false)
  timeoutMs?: number;             // Per-customer timeout (default: 60000)
  agenticConfig?: AgenticModeConfig;
}

export interface BatchCustomerResult {
  customerId: string;
  customerName: string;
  status: 'success' | 'failed' | 'skipped' | 'timeout';
  result?: ExecutionResult;
  error?: string;
  durationMs: number;
}

export interface BatchExecutionResult {
  id: string;
  goal: string;
  status: 'completed' | 'partial' | 'failed';
  startedAt: Date;
  completedAt: Date;
  totalCustomers: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  results: BatchCustomerResult[];
  summary: {
    totalActionsExecuted: number;
    totalStepsExecuted: number;
    averageDurationMs: number;
    commonErrors: string[];
  };
}

export interface BatchExecutionProgress {
  id: string;
  status: 'running' | 'completed' | 'failed';
  progress: number;      // 0-100
  completed: number;
  total: number;
  currentCustomer?: string;
  results: BatchCustomerResult[];
}

// ============================================
// Batch Operations Service
// ============================================

export class BatchOperationsService {
  private db: SupabaseService;
  private runningBatches: Map<string, BatchExecutionProgress> = new Map();

  constructor() {
    this.db = new SupabaseService();
  }

  /**
   * Execute a goal for multiple customers in parallel
   */
  async executeBatch(config: BatchExecutionConfig): Promise<BatchExecutionResult> {
    const batchId = uuidv4();
    const startedAt = new Date();

    const {
      goal,
      customerIds,
      userId,
      concurrency = 5,
      stopOnError = false,
      timeoutMs = 60000,
      agenticConfig,
    } = config;

    console.log(`[BatchOps] Starting batch ${batchId}: "${goal.substring(0, 50)}..." for ${customerIds.length} customers`);

    // Initialize progress tracking
    const progress: BatchExecutionProgress = {
      id: batchId,
      status: 'running',
      progress: 0,
      completed: 0,
      total: customerIds.length,
      results: [],
    };
    this.runningBatches.set(batchId, progress);

    const results: BatchCustomerResult[] = [];
    let stopped = false;

    // Process in chunks for concurrency control
    const chunks = this.chunkArray(customerIds, concurrency);

    for (const chunk of chunks) {
      if (stopped) break;

      // Execute chunk in parallel
      const chunkPromises = chunk.map(async (customerId) => {
        if (stopped) {
          return this.createSkippedResult(customerId, 'Batch stopped due to error');
        }

        const startTime = Date.now();

        try {
          // Get customer data
          const customerData = await this.db.getCustomer(customerId);
          const customer = this.mapCustomerData(customerId, customerData);

          // Update progress
          progress.currentCustomer = customer.name;

          // Build context
          const context: AgentContext = {
            userId,
            customer,
            currentPhase: 'monitoring',
            completedTasks: [],
            pendingApprovals: [],
            recentInteractions: [],
            riskSignals: [],
          };

          // Execute with timeout
          const result = await this.executeWithTimeout(
            executeGoal(goal, context, agenticConfig),
            timeoutMs
          );

          const durationMs = Date.now() - startTime;

          return {
            customerId,
            customerName: customer.name,
            status: result.success ? 'success' : 'failed',
            result,
            durationMs,
          } as BatchCustomerResult;

        } catch (error) {
          const durationMs = Date.now() - startTime;
          const errorMessage = (error as Error).message;

          if (stopOnError) {
            stopped = true;
          }

          return {
            customerId,
            customerName: customerId,
            status: errorMessage.includes('timeout') ? 'timeout' : 'failed',
            error: errorMessage,
            durationMs,
          } as BatchCustomerResult;
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);

      // Update progress
      progress.completed = results.length;
      progress.progress = Math.round((results.length / customerIds.length) * 100);
      progress.results = results;
    }

    const completedAt = new Date();

    // Calculate summary
    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed' || r.status === 'timeout').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    const totalActionsExecuted = results
      .filter(r => r.result)
      .reduce((sum, r) => sum + (r.result?.actions.length || 0), 0);

    const totalStepsExecuted = results
      .filter(r => r.result)
      .reduce((sum, r) => sum + (r.result?.state.currentStep || 0), 0);

    const durations = results.map(r => r.durationMs);
    const averageDurationMs = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    const errors = results
      .filter(r => r.error)
      .map(r => r.error!);
    const commonErrors = this.findCommonErrors(errors);

    const batchResult: BatchExecutionResult = {
      id: batchId,
      goal,
      status: failedCount === 0 ? 'completed' : successCount === 0 ? 'failed' : 'partial',
      startedAt,
      completedAt,
      totalCustomers: customerIds.length,
      successCount,
      failedCount,
      skippedCount,
      results,
      summary: {
        totalActionsExecuted,
        totalStepsExecuted,
        averageDurationMs,
        commonErrors,
      },
    };

    // Update progress to completed
    progress.status = 'completed';
    progress.progress = 100;

    console.log(`[BatchOps] Batch ${batchId} completed: ${successCount}/${customerIds.length} successful`);

    // Clean up after a delay
    setTimeout(() => this.runningBatches.delete(batchId), 300000); // 5 minutes

    return batchResult;
  }

  /**
   * Get progress of a running batch
   */
  getBatchProgress(batchId: string): BatchExecutionProgress | null {
    return this.runningBatches.get(batchId) || null;
  }

  /**
   * List all running batches for a user
   */
  getRunningBatches(): BatchExecutionProgress[] {
    return Array.from(this.runningBatches.values());
  }

  /**
   * Execute a goal for all customers matching criteria
   */
  async executeBatchByFilter(config: {
    goal: string;
    userId: string;
    filter: {
      status?: string;
      healthScoreBelow?: number;
      healthScoreAbove?: number;
      arrAbove?: number;
      arrBelow?: number;
      tags?: string[];
    };
    concurrency?: number;
    stopOnError?: boolean;
    agenticConfig?: AgenticModeConfig;
  }): Promise<BatchExecutionResult> {
    // Get matching customer IDs
    const customerIds = await this.getCustomerIdsByFilter(config.filter);

    if (customerIds.length === 0) {
      return {
        id: uuidv4(),
        goal: config.goal,
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
        totalCustomers: 0,
        successCount: 0,
        failedCount: 0,
        skippedCount: 0,
        results: [],
        summary: {
          totalActionsExecuted: 0,
          totalStepsExecuted: 0,
          averageDurationMs: 0,
          commonErrors: [],
        },
      };
    }

    return this.executeBatch({
      goal: config.goal,
      customerIds,
      userId: config.userId,
      concurrency: config.concurrency,
      stopOnError: config.stopOnError,
      agenticConfig: config.agenticConfig,
    });
  }

  // ============================================
  // Private Helpers
  // ============================================

  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Execution timeout')), timeoutMs)
      ),
    ]);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private mapCustomerData(
    customerId: string,
    data: Record<string, unknown> | null
  ): CustomerProfile {
    if (!data) {
      return {
        id: customerId,
        name: `Customer ${customerId.substring(0, 8)}`,
        arr: 0,
        healthScore: 0,
        status: 'active',
      };
    }

    return {
      id: data.id as string,
      name: data.name as string,
      arr: (data.arr as number) || 0,
      healthScore: (data.health_score as number) || 0,
      status: (data.stage as any) || 'active',
      renewalDate: data.renewal_date as string | undefined,
      primaryContact: data.primary_contact_email ? {
        name: (data.primary_contact_name as string) || 'Contact',
        email: data.primary_contact_email as string,
      } : undefined,
    };
  }

  private createSkippedResult(customerId: string, reason: string): BatchCustomerResult {
    return {
      customerId,
      customerName: customerId,
      status: 'skipped',
      error: reason,
      durationMs: 0,
    };
  }

  private findCommonErrors(errors: string[]): string[] {
    if (errors.length === 0) return [];

    // Count error occurrences
    const counts = new Map<string, number>();
    for (const error of errors) {
      // Normalize error messages
      const normalized = error.toLowerCase().substring(0, 100);
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }

    // Return top 5 most common errors
    return Array.from(counts.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error, count]) => `${error} (${count}x)`);
  }

  private async getCustomerIdsByFilter(filter: {
    status?: string;
    healthScoreBelow?: number;
    healthScoreAbove?: number;
    arrAbove?: number;
    arrBelow?: number;
    tags?: string[];
  }): Promise<string[]> {
    // This would query Supabase with filters
    // For now, return empty - implement based on your customer table structure
    try {
      // Example implementation - adjust based on your schema
      const { createClient } = await import('@supabase/supabase-js');
      const { config } = await import('../config/index.js');

      if (!config.supabaseUrl || !config.supabaseServiceKey) {
        return [];
      }

      const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
      let query = supabase.from('customers').select('id');

      if (filter.status) {
        query = query.eq('stage', filter.status);
      }
      if (filter.healthScoreBelow !== undefined) {
        query = query.lt('health_score', filter.healthScoreBelow);
      }
      if (filter.healthScoreAbove !== undefined) {
        query = query.gt('health_score', filter.healthScoreAbove);
      }
      if (filter.arrAbove !== undefined) {
        query = query.gt('arr', filter.arrAbove);
      }
      if (filter.arrBelow !== undefined) {
        query = query.lt('arr', filter.arrBelow);
      }

      const { data, error } = await query;

      if (error || !data) {
        console.error('[BatchOps] Failed to get customers by filter:', error);
        return [];
      }

      return data.map(c => c.id);

    } catch (e) {
      console.error('[BatchOps] Error getting customers:', e);
      return [];
    }
  }
}

// Singleton instance
export const batchOperationsService = new BatchOperationsService();

export default batchOperationsService;
