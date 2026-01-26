/**
 * Agent Scheduler Service
 * Enables cron-based scheduled agent runs
 *
 * Supports:
 * - Daily, weekly, and custom cron expressions
 * - Automatic goal execution at scheduled times
 * - Supabase persistence with in-memory fallback
 */

import cron, { ScheduledTask } from 'node-cron';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { executeGoal } from '../agents/engine/orchestrator-executor.js';
import { AgentContext, CustomerProfile } from '../agents/types.js';
import { SupabaseService } from './supabase.js';

// ============================================
// Types
// ============================================

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface AgentSchedule {
  id: string;
  userId: string;
  customerId?: string;
  name: string;
  description?: string;
  goal: string;
  frequency: ScheduleFrequency;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  lastRunStatus?: 'success' | 'failed' | 'running';
  lastRunError?: string;
  runCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduleRunLog {
  id: string;
  scheduleId: string;
  status: 'success' | 'failed' | 'running';
  startedAt: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
  stepsExecuted: number;
}

export interface CreateScheduleInput {
  userId: string;
  customerId?: string;
  name: string;
  description?: string;
  goal: string;
  frequency: ScheduleFrequency;
  cronExpression?: string;
  timezone?: string;
  enabled?: boolean;
}

// ============================================
// Cron Expression Helpers
// ============================================

function frequencyToCron(frequency: ScheduleFrequency, customCron?: string): string {
  switch (frequency) {
    case 'daily':
      return '0 9 * * *'; // 9 AM daily
    case 'weekly':
      return '0 9 * * 1'; // 9 AM every Monday
    case 'monthly':
      return '0 9 1 * *'; // 9 AM on 1st of month
    case 'custom':
      if (!customCron || !cron.validate(customCron)) {
        throw new Error('Invalid custom cron expression');
      }
      return customCron;
    default:
      return '0 9 * * *';
  }
}

function calculateNextRun(cronExpression: string, timezone: string): Date {
  // Simple calculation - for accurate next run, use cron-parser library
  const now = new Date();
  const parts = cronExpression.split(' ');

  // Basic parsing for common patterns
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  const nextRun = new Date(now);
  nextRun.setSeconds(0);
  nextRun.setMilliseconds(0);

  if (minute !== '*') {
    nextRun.setMinutes(parseInt(minute));
  }
  if (hour !== '*') {
    nextRun.setHours(parseInt(hour));
  }

  // If the calculated time is in the past, move to next occurrence
  if (nextRun <= now) {
    if (dayOfWeek !== '*') {
      // Weekly
      const targetDay = parseInt(dayOfWeek);
      const currentDay = nextRun.getDay();
      const daysUntil = (targetDay + 7 - currentDay) % 7 || 7;
      nextRun.setDate(nextRun.getDate() + daysUntil);
    } else if (dayOfMonth !== '*') {
      // Monthly
      nextRun.setMonth(nextRun.getMonth() + 1);
      nextRun.setDate(parseInt(dayOfMonth));
    } else {
      // Daily
      nextRun.setDate(nextRun.getDate() + 1);
    }
  }

  return nextRun;
}

// ============================================
// Scheduler Service
// ============================================

export class SchedulerService {
  private supabase: SupabaseClient | null = null;
  private db: SupabaseService;
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private scheduleCache: Map<string, AgentSchedule> = new Map();
  private runLogs: Map<string, ScheduleRunLog[]> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    this.db = new SupabaseService();
  }

  /**
   * Initialize scheduler - load and start all enabled schedules
   */
  async initialize(): Promise<void> {
    console.log('[Scheduler] Initializing agent scheduler...');

    try {
      const schedules = await this.getAllEnabledSchedules();

      for (const schedule of schedules) {
        this.startSchedule(schedule);
      }

      console.log(`[Scheduler] Started ${schedules.length} scheduled tasks`);
    } catch (error) {
      console.error('[Scheduler] Failed to initialize:', error);
    }
  }

  /**
   * Create a new schedule
   */
  async createSchedule(input: CreateScheduleInput): Promise<AgentSchedule> {
    const cronExpression = frequencyToCron(input.frequency, input.cronExpression);
    const timezone = input.timezone || 'America/New_York';

    const schedule: AgentSchedule = {
      id: uuidv4(),
      userId: input.userId,
      customerId: input.customerId,
      name: input.name,
      description: input.description,
      goal: input.goal,
      frequency: input.frequency,
      cronExpression,
      timezone,
      enabled: input.enabled !== false,
      runCount: 0,
      nextRunAt: calculateNextRun(cronExpression, timezone),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Persist to database
    if (this.supabase) {
      try {
        const { error } = await this.supabase
          .from('agent_schedules')
          .insert({
            id: schedule.id,
            user_id: schedule.userId,
            customer_id: schedule.customerId,
            name: schedule.name,
            description: schedule.description,
            goal: schedule.goal,
            frequency: schedule.frequency,
            cron_expression: schedule.cronExpression,
            timezone: schedule.timezone,
            enabled: schedule.enabled,
            run_count: schedule.runCount,
            next_run_at: schedule.nextRunAt?.toISOString(),
            created_at: schedule.createdAt.toISOString(),
            updated_at: schedule.updatedAt.toISOString(),
          });

        if (error) {
          console.error('[Scheduler] Failed to persist schedule:', error);
        }
      } catch (e) {
        console.error('[Scheduler] Database error:', e);
      }
    }

    // Add to cache
    this.scheduleCache.set(schedule.id, schedule);

    // Start the schedule if enabled
    if (schedule.enabled) {
      this.startSchedule(schedule);
    }

    console.log(`[Scheduler] Created schedule: ${schedule.name} (${schedule.id})`);
    return schedule;
  }

  /**
   * Get a schedule by ID
   */
  async getSchedule(scheduleId: string): Promise<AgentSchedule | null> {
    // Check cache first
    const cached = this.scheduleCache.get(scheduleId);
    if (cached) return cached;

    // Try database
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('agent_schedules')
          .select('*')
          .eq('id', scheduleId)
          .single();

        if (data && !error) {
          const schedule = this.mapDbToSchedule(data);
          this.scheduleCache.set(schedule.id, schedule);
          return schedule;
        }
      } catch (e) {
        console.error('[Scheduler] Failed to get schedule:', e);
      }
    }

    return null;
  }

  /**
   * Get all schedules for a user
   */
  async getUserSchedules(userId: string): Promise<AgentSchedule[]> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('agent_schedules')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (data && !error) {
          return data.map(this.mapDbToSchedule);
        }
      } catch (e) {
        console.error('[Scheduler] Failed to get user schedules:', e);
      }
    }

    // Fallback to cache
    return Array.from(this.scheduleCache.values())
      .filter(s => s.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get all enabled schedules
   */
  async getAllEnabledSchedules(): Promise<AgentSchedule[]> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('agent_schedules')
          .select('*')
          .eq('enabled', true);

        if (data && !error) {
          return data.map(this.mapDbToSchedule);
        }
      } catch (e) {
        console.error('[Scheduler] Failed to get enabled schedules:', e);
      }
    }

    // Fallback to cache
    return Array.from(this.scheduleCache.values()).filter(s => s.enabled);
  }

  /**
   * Update a schedule
   */
  async updateSchedule(
    scheduleId: string,
    updates: Partial<Omit<AgentSchedule, 'id' | 'userId' | 'createdAt'>>
  ): Promise<AgentSchedule | null> {
    const existing = await this.getSchedule(scheduleId);
    if (!existing) return null;

    // Recalculate cron expression if frequency changed
    let cronExpression = existing.cronExpression;
    if (updates.frequency) {
      cronExpression = frequencyToCron(updates.frequency, updates.cronExpression);
    }

    const updated: AgentSchedule = {
      ...existing,
      ...updates,
      cronExpression,
      nextRunAt: calculateNextRun(cronExpression, updates.timezone || existing.timezone),
      updatedAt: new Date(),
    };

    // Persist to database
    if (this.supabase) {
      try {
        await this.supabase
          .from('agent_schedules')
          .update({
            name: updated.name,
            description: updated.description,
            goal: updated.goal,
            frequency: updated.frequency,
            cron_expression: updated.cronExpression,
            timezone: updated.timezone,
            enabled: updated.enabled,
            next_run_at: updated.nextRunAt?.toISOString(),
            updated_at: updated.updatedAt.toISOString(),
          })
          .eq('id', scheduleId);
      } catch (e) {
        console.error('[Scheduler] Failed to update schedule:', e);
      }
    }

    // Update cache
    this.scheduleCache.set(scheduleId, updated);

    // Restart schedule if it was running
    this.stopSchedule(scheduleId);
    if (updated.enabled) {
      this.startSchedule(updated);
    }

    return updated;
  }

  /**
   * Toggle schedule enabled/disabled
   */
  async toggleSchedule(scheduleId: string, enabled: boolean): Promise<AgentSchedule | null> {
    return this.updateSchedule(scheduleId, { enabled });
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: string): Promise<boolean> {
    // Stop the scheduled task
    this.stopSchedule(scheduleId);

    // Remove from database
    if (this.supabase) {
      try {
        const { error } = await this.supabase
          .from('agent_schedules')
          .delete()
          .eq('id', scheduleId);

        if (error) {
          console.error('[Scheduler] Failed to delete schedule:', error);
          return false;
        }
      } catch (e) {
        console.error('[Scheduler] Database error:', e);
        return false;
      }
    }

    // Remove from cache
    this.scheduleCache.delete(scheduleId);
    this.runLogs.delete(scheduleId);

    console.log(`[Scheduler] Deleted schedule: ${scheduleId}`);
    return true;
  }

  /**
   * Manually trigger a schedule run
   */
  async triggerSchedule(scheduleId: string): Promise<ScheduleRunLog> {
    const schedule = await this.getSchedule(scheduleId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    return this.executeSchedule(schedule);
  }

  /**
   * Get run logs for a schedule
   */
  async getRunLogs(scheduleId: string, limit = 20): Promise<ScheduleRunLog[]> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('agent_schedule_runs')
          .select('*')
          .eq('schedule_id', scheduleId)
          .order('started_at', { ascending: false })
          .limit(limit);

        if (data && !error) {
          return data.map(this.mapDbToRunLog);
        }
      } catch (e) {
        console.error('[Scheduler] Failed to get run logs:', e);
      }
    }

    // Fallback to in-memory
    return (this.runLogs.get(scheduleId) || []).slice(0, limit);
  }

  // ============================================
  // Private Methods
  // ============================================

  private startSchedule(schedule: AgentSchedule): void {
    // Validate cron expression
    if (!cron.validate(schedule.cronExpression)) {
      console.error(`[Scheduler] Invalid cron expression for ${schedule.id}: ${schedule.cronExpression}`);
      return;
    }

    // Stop existing task if any
    this.stopSchedule(schedule.id);

    // Create new scheduled task
    const task = cron.schedule(
      schedule.cronExpression,
      async () => {
        console.log(`[Scheduler] Executing scheduled run: ${schedule.name}`);
        await this.executeSchedule(schedule);
      },
      {
        scheduled: true,
        timezone: schedule.timezone,
      }
    );

    this.scheduledTasks.set(schedule.id, task);
    console.log(`[Scheduler] Started schedule: ${schedule.name} (${schedule.cronExpression})`);
  }

  private stopSchedule(scheduleId: string): void {
    const task = this.scheduledTasks.get(scheduleId);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(scheduleId);
    }
  }

  private async executeSchedule(schedule: AgentSchedule): Promise<ScheduleRunLog> {
    const runLog: ScheduleRunLog = {
      id: uuidv4(),
      scheduleId: schedule.id,
      status: 'running',
      startedAt: new Date(),
      stepsExecuted: 0,
    };

    // Update schedule last run status
    await this.updateScheduleRunStatus(schedule.id, 'running');

    try {
      // Build context
      const context = await this.buildContextForSchedule(schedule);

      // Execute the goal
      const result = await executeGoal(schedule.goal, context);

      // Update run log
      runLog.status = result.success ? 'success' : 'failed';
      runLog.completedAt = new Date();
      runLog.result = {
        message: result.message,
        actions: result.actions.length,
        status: result.state.status,
      };
      runLog.stepsExecuted = result.state.currentStep;

      if (!result.success) {
        runLog.error = result.state.error || result.message;
      }

      // Update schedule
      await this.updateScheduleAfterRun(schedule, runLog);

    } catch (error) {
      runLog.status = 'failed';
      runLog.completedAt = new Date();
      runLog.error = (error as Error).message;

      await this.updateScheduleAfterRun(schedule, runLog);
    }

    // Persist run log
    await this.saveRunLog(runLog);

    return runLog;
  }

  private async buildContextForSchedule(schedule: AgentSchedule): Promise<AgentContext> {
    let customer: CustomerProfile = {
      id: 'scheduled',
      name: 'Scheduled Task',
      arr: 0,
      healthScore: 0,
      status: 'active',
    };

    if (schedule.customerId) {
      try {
        const customerData = await this.db.getCustomer(schedule.customerId);
        if (customerData) {
          customer = {
            id: customerData.id as string,
            name: customerData.name as string,
            arr: (customerData.arr as number) || 0,
            healthScore: (customerData.health_score as number) || 0,
            status: (customerData.stage as any) || 'active',
            renewalDate: customerData.renewal_date as string | undefined,
          };
        }
      } catch (e) {
        console.log('[Scheduler] Could not load customer for schedule:', e);
      }
    }

    return {
      userId: schedule.userId,
      customer,
      currentPhase: 'monitoring',
      completedTasks: [],
      pendingApprovals: [],
      recentInteractions: [],
      riskSignals: [],
    };
  }

  private async updateScheduleRunStatus(
    scheduleId: string,
    status: 'running' | 'success' | 'failed'
  ): Promise<void> {
    if (this.supabase) {
      try {
        await this.supabase
          .from('agent_schedules')
          .update({
            last_run_status: status,
            last_run_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', scheduleId);
      } catch (e) {
        console.error('[Scheduler] Failed to update run status:', e);
      }
    }

    // Update cache
    const cached = this.scheduleCache.get(scheduleId);
    if (cached) {
      cached.lastRunStatus = status;
      cached.lastRunAt = new Date();
    }
  }

  private async updateScheduleAfterRun(
    schedule: AgentSchedule,
    runLog: ScheduleRunLog
  ): Promise<void> {
    const nextRunAt = calculateNextRun(schedule.cronExpression, schedule.timezone);

    if (this.supabase) {
      try {
        await this.supabase
          .from('agent_schedules')
          .update({
            last_run_at: runLog.startedAt.toISOString(),
            last_run_status: runLog.status,
            last_run_error: runLog.error,
            next_run_at: nextRunAt.toISOString(),
            run_count: schedule.runCount + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', schedule.id);
      } catch (e) {
        console.error('[Scheduler] Failed to update schedule after run:', e);
      }
    }

    // Update cache
    const cached = this.scheduleCache.get(schedule.id);
    if (cached) {
      cached.lastRunAt = runLog.startedAt;
      cached.lastRunStatus = runLog.status;
      cached.lastRunError = runLog.error;
      cached.nextRunAt = nextRunAt;
      cached.runCount++;
    }
  }

  private async saveRunLog(runLog: ScheduleRunLog): Promise<void> {
    if (this.supabase) {
      try {
        await this.supabase
          .from('agent_schedule_runs')
          .insert({
            id: runLog.id,
            schedule_id: runLog.scheduleId,
            status: runLog.status,
            started_at: runLog.startedAt.toISOString(),
            completed_at: runLog.completedAt?.toISOString(),
            result: runLog.result,
            error: runLog.error,
            steps_executed: runLog.stepsExecuted,
          });
      } catch (e) {
        console.error('[Scheduler] Failed to save run log:', e);
      }
    }

    // Add to in-memory logs
    const logs = this.runLogs.get(runLog.scheduleId) || [];
    logs.unshift(runLog);
    // Keep only last 100 logs in memory
    this.runLogs.set(runLog.scheduleId, logs.slice(0, 100));
  }

  private mapDbToSchedule(data: any): AgentSchedule {
    return {
      id: data.id,
      userId: data.user_id,
      customerId: data.customer_id,
      name: data.name,
      description: data.description,
      goal: data.goal,
      frequency: data.frequency,
      cronExpression: data.cron_expression,
      timezone: data.timezone,
      enabled: data.enabled,
      lastRunAt: data.last_run_at ? new Date(data.last_run_at) : undefined,
      nextRunAt: data.next_run_at ? new Date(data.next_run_at) : undefined,
      lastRunStatus: data.last_run_status,
      lastRunError: data.last_run_error,
      runCount: data.run_count || 0,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  private mapDbToRunLog(data: any): ScheduleRunLog {
    return {
      id: data.id,
      scheduleId: data.schedule_id,
      status: data.status,
      startedAt: new Date(data.started_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      result: data.result,
      error: data.error,
      stepsExecuted: data.steps_executed || 0,
    };
  }

  /**
   * Cleanup - stop all scheduled tasks
   */
  shutdown(): void {
    console.log('[Scheduler] Shutting down...');
    for (const [id, task] of this.scheduledTasks) {
      task.stop();
    }
    this.scheduledTasks.clear();
  }
}

// Singleton instance
export const schedulerService = new SchedulerService();

export default schedulerService;
