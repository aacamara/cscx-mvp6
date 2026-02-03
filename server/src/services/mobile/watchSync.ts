/**
 * Watch Data Sync Service
 * PRD-266: Apple Watch Integration
 *
 * Handles data synchronization between the server and Apple Watch app.
 * Provides endpoints for complications, glanceable data, and quick actions.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { CircuitBreaker } from '../circuitBreaker.js';

// ============================================
// Types
// ============================================

export interface WatchComplicationData {
  userId: string;
  type: 'circular' | 'rectangular' | 'corner' | 'inline' | 'graphic';
  data: {
    pendingCount?: number;
    nextTask?: TaskSummary | null;
    healthTrend?: 'improving' | 'stable' | 'declining';
    portfolioHealth?: number;
    unreadCount?: number;
  };
  updatedAt: Date;
}

export interface TaskSummary {
  id: string;
  title: string;
  customerId?: string;
  customerName?: string;
  dueAt: Date;
  priority: 'high' | 'medium' | 'low';
  type: 'followup' | 'meeting' | 'approval' | 'reminder';
}

export interface CustomerSummary {
  id: string;
  name: string;
  healthScore: number;
  stage: string;
  lastContactDays: number;
  nextMeeting?: Date;
  riskLevel: 'high' | 'medium' | 'low';
}

export interface PendingApproval {
  id: string;
  type: 'email' | 'meeting' | 'document' | 'action';
  title: string;
  description: string;
  customerId?: string;
  customerName?: string;
  requestedAt: Date;
  expiresAt?: Date;
}

export interface WatchDashboardData {
  priorityCustomers: CustomerSummary[];
  tasksDue: TaskSummary[];
  pendingApprovals: PendingApproval[];
  portfolioSummary: {
    totalCustomers: number;
    atRiskCount: number;
    healthyCount: number;
    averageHealthScore: number;
  };
  nextMeeting?: {
    id: string;
    title: string;
    customerName: string;
    startTime: Date;
    location?: string;
  };
}

export interface QuickNoteRequest {
  customerId?: string;
  content: string;
  voiceTranscribed: boolean;
  recordingDuration?: number;
}

export interface QuickActionResult {
  success: boolean;
  actionId?: string;
  message?: string;
  error?: string;
}

// ============================================
// Watch Sync Service
// ============================================

export class WatchSyncService {
  private supabase: ReturnType<typeof createClient> | null = null;
  private circuitBreaker: CircuitBreaker;
  private complicationCache: Map<string, WatchComplicationData> = new Map();
  private dashboardCache: Map<string, { data: WatchDashboardData; expiresAt: Date }> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    this.circuitBreaker = new CircuitBreaker('watch-sync', {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 30000,
    });
  }

  // ============================================
  // Complication Data
  // ============================================

  /**
   * Get complication data for Apple Watch
   */
  async getComplicationData(
    userId: string,
    type: WatchComplicationData['type']
  ): Promise<WatchComplicationData> {
    const cacheKey = `${userId}:${type}`;
    const cached = this.complicationCache.get(cacheKey);

    // Return cached data if less than 5 minutes old
    if (cached && (Date.now() - cached.updatedAt.getTime()) < 5 * 60 * 1000) {
      return cached;
    }

    // Fetch fresh data
    const data = await this.buildComplicationData(userId, type);
    this.complicationCache.set(cacheKey, data);

    return data;
  }

  /**
   * Build complication data based on type
   */
  private async buildComplicationData(
    userId: string,
    type: WatchComplicationData['type']
  ): Promise<WatchComplicationData> {
    const baseData: WatchComplicationData = {
      userId,
      type,
      data: {},
      updatedAt: new Date(),
    };

    switch (type) {
      case 'circular':
        // Unread/pending count
        const pendingCount = await this.getPendingCount(userId);
        baseData.data = { pendingCount, unreadCount: pendingCount };
        break;

      case 'rectangular':
        // Next task preview
        const nextTask = await this.getNextTask(userId);
        baseData.data = { nextTask };
        break;

      case 'corner':
        // Portfolio health indicator
        const portfolioHealth = await this.getPortfolioHealthScore(userId);
        baseData.data = { portfolioHealth };
        break;

      case 'inline':
        // Quick status
        const quickPending = await this.getPendingCount(userId);
        const quickHealth = await this.getPortfolioHealthScore(userId);
        baseData.data = {
          pendingCount: quickPending,
          portfolioHealth: quickHealth,
        };
        break;

      case 'graphic':
        // Health trend chart
        const trend = await this.getHealthTrend(userId);
        const graphicHealth = await this.getPortfolioHealthScore(userId);
        baseData.data = {
          healthTrend: trend,
          portfolioHealth: graphicHealth,
        };
        break;
    }

    return baseData;
  }

  /**
   * Get all complication data at once (for batch updates)
   */
  async getAllComplicationData(userId: string): Promise<WatchComplicationData[]> {
    const types: WatchComplicationData['type'][] = [
      'circular', 'rectangular', 'corner', 'inline', 'graphic'
    ];

    const results = await Promise.all(
      types.map(type => this.getComplicationData(userId, type))
    );

    return results;
  }

  // ============================================
  // Dashboard Data
  // ============================================

  /**
   * Get full dashboard data for Apple Watch app
   */
  async getDashboardData(userId: string): Promise<WatchDashboardData> {
    const cached = this.dashboardCache.get(userId);
    if (cached && cached.expiresAt > new Date()) {
      return cached.data;
    }

    const [
      priorityCustomers,
      tasksDue,
      pendingApprovals,
      portfolioSummary,
      nextMeeting,
    ] = await Promise.all([
      this.getPriorityCustomers(userId),
      this.getTasksDue(userId),
      this.getPendingApprovals(userId),
      this.getPortfolioSummary(userId),
      this.getNextMeeting(userId),
    ]);

    const data: WatchDashboardData = {
      priorityCustomers,
      tasksDue,
      pendingApprovals,
      portfolioSummary,
      nextMeeting,
    };

    // Cache for 2 minutes
    this.dashboardCache.set(userId, {
      data,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000),
    });

    return data;
  }

  /**
   * Get priority customers (at-risk or requiring attention)
   */
  private async getPriorityCustomers(userId: string): Promise<CustomerSummary[]> {
    if (!this.supabase) {
      return this.getMockPriorityCustomers();
    }

    try {
      const { data } = await this.circuitBreaker.execute(() =>
        this.supabase!.from('customers')
          .select('id, name, health_score, stage, last_contact_at, risk_level')
          .eq('csm_id', userId)
          .or('risk_level.eq.high,health_score.lt.50')
          .order('health_score', { ascending: true })
          .limit(5)
      );

      if (!data) return [];

      return data.map((c: any) => ({
        id: c.id,
        name: c.name,
        healthScore: c.health_score || 50,
        stage: c.stage || 'Active',
        lastContactDays: c.last_contact_at
          ? Math.floor((Date.now() - new Date(c.last_contact_at).getTime()) / (24 * 60 * 60 * 1000))
          : 30,
        riskLevel: c.risk_level || 'low',
      }));
    } catch {
      return this.getMockPriorityCustomers();
    }
  }

  /**
   * Get tasks due today
   */
  private async getTasksDue(userId: string): Promise<TaskSummary[]> {
    if (!this.supabase) {
      return this.getMockTasks();
    }

    try {
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      const { data } = await this.circuitBreaker.execute(() =>
        this.supabase!.from('tasks')
          .select('id, title, customer_id, due_at, priority, type, customers(name)')
          .eq('user_id', userId)
          .eq('completed', false)
          .lte('due_at', today.toISOString())
          .order('due_at', { ascending: true })
          .limit(5)
      );

      if (!data) return [];

      return data.map((t: any) => ({
        id: t.id,
        title: t.title,
        customerId: t.customer_id,
        customerName: t.customers?.name,
        dueAt: new Date(t.due_at),
        priority: t.priority || 'medium',
        type: t.type || 'followup',
      }));
    } catch {
      return this.getMockTasks();
    }
  }

  /**
   * Get pending approvals
   */
  private async getPendingApprovals(userId: string): Promise<PendingApproval[]> {
    if (!this.supabase) {
      return this.getMockApprovals();
    }

    try {
      const { data } = await this.circuitBreaker.execute(() =>
        this.supabase!.from('pending_approvals')
          .select('id, type, title, description, customer_id, requested_at, expires_at, customers(name)')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .order('requested_at', { ascending: false })
          .limit(10)
      );

      if (!data) return [];

      return data.map((a: any) => ({
        id: a.id,
        type: a.type || 'action',
        title: a.title,
        description: a.description,
        customerId: a.customer_id,
        customerName: a.customers?.name,
        requestedAt: new Date(a.requested_at),
        expiresAt: a.expires_at ? new Date(a.expires_at) : undefined,
      }));
    } catch {
      return this.getMockApprovals();
    }
  }

  /**
   * Get portfolio summary
   */
  private async getPortfolioSummary(userId: string): Promise<WatchDashboardData['portfolioSummary']> {
    if (!this.supabase) {
      return {
        totalCustomers: 25,
        atRiskCount: 3,
        healthyCount: 18,
        averageHealthScore: 72,
      };
    }

    try {
      const { data } = await this.circuitBreaker.execute(() =>
        this.supabase!.from('customers')
          .select('id, health_score, risk_level')
          .eq('csm_id', userId)
      );

      if (!data) {
        return {
          totalCustomers: 0,
          atRiskCount: 0,
          healthyCount: 0,
          averageHealthScore: 0,
        };
      }

      const atRisk = data.filter((c: any) => c.risk_level === 'high' || c.health_score < 40);
      const healthy = data.filter((c: any) => c.health_score >= 70);
      const avgScore = data.length > 0
        ? Math.round(data.reduce((sum: number, c: any) => sum + (c.health_score || 50), 0) / data.length)
        : 0;

      return {
        totalCustomers: data.length,
        atRiskCount: atRisk.length,
        healthyCount: healthy.length,
        averageHealthScore: avgScore,
      };
    } catch {
      return {
        totalCustomers: 0,
        atRiskCount: 0,
        healthyCount: 0,
        averageHealthScore: 0,
      };
    }
  }

  /**
   * Get next scheduled meeting
   */
  private async getNextMeeting(userId: string): Promise<WatchDashboardData['nextMeeting'] | undefined> {
    if (!this.supabase) {
      return {
        id: 'mock-meeting',
        title: 'QBR with Acme Corp',
        customerName: 'Acme Corp',
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        location: 'Zoom',
      };
    }

    try {
      const { data } = await this.circuitBreaker.execute(() =>
        this.supabase!.from('meetings')
          .select('id, title, customer_id, start_time, location, customers(name)')
          .eq('user_id', userId)
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(1)
          .single()
      );

      if (!data) return undefined;

      return {
        id: data.id,
        title: data.title,
        customerName: data.customers?.name || 'Unknown',
        startTime: new Date(data.start_time),
        location: data.location,
      };
    } catch {
      return undefined;
    }
  }

  // ============================================
  // Quick Actions
  // ============================================

  /**
   * Create a quick note (voice or typed)
   */
  async createQuickNote(userId: string, request: QuickNoteRequest): Promise<QuickActionResult> {
    if (!this.supabase) {
      return { success: true, actionId: 'mock-note-id', message: 'Note saved' };
    }

    try {
      const { data, error } = await this.circuitBreaker.execute(() =>
        this.supabase!.from('notes').insert({
          user_id: userId,
          customer_id: request.customerId,
          content: request.content,
          source: request.voiceTranscribed ? 'watch_voice' : 'watch_typed',
          metadata: {
            voiceTranscribed: request.voiceTranscribed,
            recordingDuration: request.recordingDuration,
            createdFrom: 'apple_watch',
          },
          created_at: new Date().toISOString(),
        }).select('id').single()
      );

      if (error) {
        return { success: false, error: error.message };
      }

      console.log(`[WatchSync] Quick note created: ${data?.id}`);
      return { success: true, actionId: data?.id, message: 'Note saved' };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Approve a pending item
   */
  async approveItem(userId: string, approvalId: string): Promise<QuickActionResult> {
    if (!this.supabase) {
      return { success: true, message: 'Approved' };
    }

    try {
      const { error } = await this.circuitBreaker.execute(() =>
        this.supabase!.from('pending_approvals')
          .update({
            status: 'approved',
            resolved_at: new Date().toISOString(),
            resolved_by: userId,
            resolution_source: 'apple_watch',
          })
          .eq('id', approvalId)
          .eq('user_id', userId)
      );

      if (error) {
        return { success: false, error: error.message };
      }

      // Invalidate cache
      this.dashboardCache.delete(userId);

      console.log(`[WatchSync] Item approved: ${approvalId}`);
      return { success: true, message: 'Approved' };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Reject a pending item
   */
  async rejectItem(userId: string, approvalId: string, reason?: string): Promise<QuickActionResult> {
    if (!this.supabase) {
      return { success: true, message: 'Rejected' };
    }

    try {
      const { error } = await this.circuitBreaker.execute(() =>
        this.supabase!.from('pending_approvals')
          .update({
            status: 'rejected',
            resolved_at: new Date().toISOString(),
            resolved_by: userId,
            resolution_source: 'apple_watch',
            rejection_reason: reason,
          })
          .eq('id', approvalId)
          .eq('user_id', userId)
      );

      if (error) {
        return { success: false, error: error.message };
      }

      // Invalidate cache
      this.dashboardCache.delete(userId);

      console.log(`[WatchSync] Item rejected: ${approvalId}`);
      return { success: true, message: 'Rejected' };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Mark task as complete
   */
  async completeTask(userId: string, taskId: string): Promise<QuickActionResult> {
    if (!this.supabase) {
      return { success: true, message: 'Task completed' };
    }

    try {
      const { error } = await this.circuitBreaker.execute(() =>
        this.supabase!.from('tasks')
          .update({
            completed: true,
            completed_at: new Date().toISOString(),
            completion_source: 'apple_watch',
          })
          .eq('id', taskId)
          .eq('user_id', userId)
      );

      if (error) {
        return { success: false, error: error.message };
      }

      // Invalidate cache
      this.dashboardCache.delete(userId);

      console.log(`[WatchSync] Task completed: ${taskId}`);
      return { success: true, message: 'Task completed' };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Snooze a reminder
   */
  async snoozeReminder(
    userId: string,
    reminderId: string,
    snoozeDuration: '15min' | '1hour' | '4hours' | 'tomorrow'
  ): Promise<QuickActionResult> {
    if (!this.supabase) {
      return { success: true, message: 'Reminder snoozed' };
    }

    const snoozeMap = {
      '15min': 15 * 60 * 1000,
      '1hour': 60 * 60 * 1000,
      '4hours': 4 * 60 * 60 * 1000,
      'tomorrow': 24 * 60 * 60 * 1000,
    };

    const newTime = new Date(Date.now() + snoozeMap[snoozeDuration]);

    try {
      const { error } = await this.circuitBreaker.execute(() =>
        this.supabase!.from('reminders')
          .update({
            remind_at: newTime.toISOString(),
            snooze_count: this.supabase!.rpc('increment', { x: 1 }),
            last_snoozed_at: new Date().toISOString(),
          })
          .eq('id', reminderId)
          .eq('user_id', userId)
      );

      if (error) {
        return { success: false, error: error.message };
      }

      console.log(`[WatchSync] Reminder snoozed: ${reminderId} until ${newTime.toISOString()}`);
      return { success: true, message: `Snoozed until ${newTime.toLocaleTimeString()}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  private async getPendingCount(userId: string): Promise<number> {
    if (!this.supabase) return 3;

    try {
      const { count } = await this.circuitBreaker.execute(() =>
        this.supabase!.from('pending_approvals')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'pending')
      );

      return count || 0;
    } catch {
      return 0;
    }
  }

  private async getNextTask(userId: string): Promise<TaskSummary | null> {
    const tasks = await this.getTasksDue(userId);
    return tasks[0] || null;
  }

  private async getPortfolioHealthScore(userId: string): Promise<number> {
    const summary = await this.getPortfolioSummary(userId);
    return summary.averageHealthScore;
  }

  private async getHealthTrend(userId: string): Promise<'improving' | 'stable' | 'declining'> {
    if (!this.supabase) return 'stable';

    try {
      // Get health score snapshots from last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const { data } = await this.circuitBreaker.execute(() =>
        this.supabase!.from('health_score_history')
          .select('score, recorded_at')
          .eq('user_id', userId)
          .gte('recorded_at', thirtyDaysAgo.toISOString())
          .order('recorded_at', { ascending: true })
      );

      if (!data || data.length < 2) return 'stable';

      const recentScores = data.slice(-7);
      const olderScores = data.slice(0, Math.min(7, data.length));

      const recentAvg = recentScores.reduce((sum: number, d: any) => sum + d.score, 0) / recentScores.length;
      const olderAvg = olderScores.reduce((sum: number, d: any) => sum + d.score, 0) / olderScores.length;

      const diff = recentAvg - olderAvg;

      if (diff > 5) return 'improving';
      if (diff < -5) return 'declining';
      return 'stable';
    } catch {
      return 'stable';
    }
  }

  // Mock data for development
  private getMockPriorityCustomers(): CustomerSummary[] {
    return [
      { id: '1', name: 'Acme Corp', healthScore: 35, stage: 'At Risk', lastContactDays: 14, riskLevel: 'high' },
      { id: '2', name: 'TechStart Inc', healthScore: 45, stage: 'Onboarding', lastContactDays: 7, riskLevel: 'medium' },
      { id: '3', name: 'Global Systems', healthScore: 52, stage: 'Active', lastContactDays: 21, riskLevel: 'medium' },
    ];
  }

  private getMockTasks(): TaskSummary[] {
    return [
      { id: '1', title: 'Follow up on support ticket', customerName: 'Acme Corp', dueAt: new Date(), priority: 'high', type: 'followup' },
      { id: '2', title: 'QBR preparation', customerName: 'TechStart Inc', dueAt: new Date(), priority: 'medium', type: 'meeting' },
    ];
  }

  private getMockApprovals(): PendingApproval[] {
    return [
      { id: '1', type: 'email', title: 'Renewal reminder email', description: 'Send 60-day renewal reminder', customerName: 'Acme Corp', requestedAt: new Date() },
      { id: '2', type: 'meeting', title: 'Schedule QBR', description: 'Book Q1 QBR meeting', customerName: 'TechStart Inc', requestedAt: new Date() },
    ];
  }

  /**
   * Invalidate all caches for a user
   */
  invalidateUserCache(userId: string): void {
    this.dashboardCache.delete(userId);
    for (const key of this.complicationCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.complicationCache.delete(key);
      }
    }
  }

  /**
   * Get circuit breaker stats
   */
  getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
  }
}

// Singleton instance
export const watchSyncService = new WatchSyncService();
