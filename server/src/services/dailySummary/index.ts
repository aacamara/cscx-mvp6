/**
 * Daily Summary Service
 * PRD-150: End of Day -> Daily Summary
 *
 * Compiles and generates automated end-of-day summaries for CSMs
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { gmailService } from '../google/gmail.js';
import { slackService } from '../slack/index.js';
import { generateDailySummaryEmail } from '../../templates/emails/daily-summary.js';
import type {
  DailySummary,
  WeeklySummary,
  DailySummarySettings,
  TaskRef,
  MeetingSummary,
  MeetingPreview,
  Deadline,
  Reminder,
  FollowUp,
  Alert,
  ApprovalRef,
  EmailRef,
  CustomerRef,
  RenewalPreview,
} from '../../../../types/dailySummary.js';

// ============================================
// Service Class
// ============================================

export class DailySummaryService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Settings Management
  // ============================================

  async getSettings(userId: string): Promise<DailySummarySettings> {
    const defaults: DailySummarySettings = {
      userId,
      enabled: true,
      schedule: {
        time: '17:00',
        timezone: 'America/New_York',
        skipWeekends: true,
        skipHolidays: false,
      },
      delivery: {
        email: true,
        slack: false,
        inApp: true,
      },
      content: {
        showMetrics: true,
        showPortfolioHealth: true,
        showWeeklyComparison: true,
        maxCustomersNeedingAttention: 5,
        maxUpcomingRenewals: 5,
        maxOverdueTasks: 10,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!this.supabase) {
      return defaults;
    }

    const { data, error } = await this.supabase
      .from('daily_summary_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return defaults;
    }

    return {
      userId: data.user_id,
      enabled: data.enabled ?? true,
      schedule: {
        time: data.schedule_time || '17:00',
        timezone: data.timezone || 'America/New_York',
        skipWeekends: data.skip_weekends ?? true,
        skipHolidays: data.skip_holidays ?? false,
      },
      delivery: {
        email: data.delivery_email ?? true,
        slack: data.delivery_slack ?? false,
        inApp: data.delivery_in_app ?? true,
        slackChannelId: data.slack_channel_id,
      },
      content: {
        showMetrics: data.show_metrics ?? true,
        showPortfolioHealth: data.show_portfolio_health ?? true,
        showWeeklyComparison: data.show_weekly_comparison ?? true,
        maxCustomersNeedingAttention: data.max_customers_needing_attention || 5,
        maxUpcomingRenewals: data.max_upcoming_renewals || 5,
        maxOverdueTasks: data.max_overdue_tasks || 10,
      },
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updateSettings(
    userId: string,
    updates: Partial<{
      enabled: boolean;
      schedule: Partial<DailySummarySettings['schedule']>;
      delivery: Partial<DailySummarySettings['delivery']>;
      content: Partial<DailySummarySettings['content']>;
    }>
  ): Promise<DailySummarySettings> {
    const current = await this.getSettings(userId);

    const updated: DailySummarySettings = {
      ...current,
      enabled: updates.enabled ?? current.enabled,
      schedule: { ...current.schedule, ...updates.schedule },
      delivery: { ...current.delivery, ...updates.delivery },
      content: { ...current.content, ...updates.content },
      updatedAt: new Date().toISOString(),
    };

    if (this.supabase) {
      await this.supabase.from('daily_summary_settings').upsert({
        user_id: userId,
        enabled: updated.enabled,
        schedule_time: updated.schedule.time,
        timezone: updated.schedule.timezone,
        skip_weekends: updated.schedule.skipWeekends,
        skip_holidays: updated.schedule.skipHolidays,
        delivery_email: updated.delivery.email,
        delivery_slack: updated.delivery.slack,
        delivery_in_app: updated.delivery.inApp,
        slack_channel_id: updated.delivery.slackChannelId,
        show_metrics: updated.content.showMetrics,
        show_portfolio_health: updated.content.showPortfolioHealth,
        show_weekly_comparison: updated.content.showWeeklyComparison,
        max_customers_needing_attention: updated.content.maxCustomersNeedingAttention,
        max_upcoming_renewals: updated.content.maxUpcomingRenewals,
        max_overdue_tasks: updated.content.maxOverdueTasks,
        updated_at: updated.updatedAt,
      }, {
        onConflict: 'user_id',
      });
    }

    return updated;
  }

  // ============================================
  // Summary Generation
  // ============================================

  async generateDailySummary(
    userId: string,
    date: string = new Date().toISOString().split('T')[0]
  ): Promise<DailySummary> {
    const settings = await this.getSettings(userId);

    // Get user's timezone-adjusted date boundaries
    const timezone = settings.schedule.timezone;
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);
    const tomorrow = new Date(dayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    // Compile all summary data in parallel
    const [
      accomplishments,
      tomorrowData,
      attention,
      portfolio,
      metrics,
    ] = await Promise.all([
      this.compileAccomplishments(userId, dayStart, dayEnd),
      this.compileTomorrowPreview(userId, tomorrow, tomorrowEnd),
      this.compileAttentionRequired(userId, settings),
      this.compilePortfolioHealth(userId, settings),
      this.compileMetrics(userId, dayStart, dayEnd),
    ]);

    const summary: DailySummary = {
      id: uuidv4(),
      csmId: userId,
      date,
      timezone,
      accomplishments,
      tomorrow: tomorrowData,
      attention,
      portfolio,
      metrics,
      delivery: {
        channels: [],
        sentAt: null,
        viewedAt: null,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Persist summary
    await this.saveSummary(summary);

    return summary;
  }

  async generateWeeklySummary(
    userId: string,
    weekStartDate?: string
  ): Promise<WeeklySummary> {
    // Calculate week boundaries (Monday to Sunday)
    const now = new Date();
    let weekStart: Date;

    if (weekStartDate) {
      weekStart = new Date(weekStartDate);
    } else {
      weekStart = new Date(now);
      const dayOfWeek = weekStart.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust for Monday start
      weekStart.setDate(weekStart.getDate() - diff);
    }

    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekEnd);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);

    const settings = await this.getSettings(userId);

    // Compile weekly data
    const [currentWeekData, prevWeekData, nextWeekData] = await Promise.all([
      this.compileWeekAccomplishments(userId, weekStart, weekEnd),
      this.compileWeekAccomplishments(userId, prevWeekStart, prevWeekEnd),
      this.compileNextWeekPreview(userId, weekEnd),
    ]);

    const summary: WeeklySummary = {
      id: uuidv4(),
      csmId: userId,
      weekStartDate: weekStart.toISOString().split('T')[0],
      weekEndDate: weekEnd.toISOString().split('T')[0],
      timezone: settings.schedule.timezone,
      accomplishments: {
        totalTasksCompleted: currentWeekData.tasksCompleted,
        totalMeetingsHeld: currentWeekData.meetingsHeld,
        totalEmailsSent: currentWeekData.emailsSent,
        totalCallsMade: currentWeekData.callsMade,
        highlights: currentWeekData.highlights,
      },
      comparison: {
        tasksCompleted: {
          current: currentWeekData.tasksCompleted,
          previous: prevWeekData.tasksCompleted,
          change: this.calculateChange(currentWeekData.tasksCompleted, prevWeekData.tasksCompleted),
        },
        customerTouches: {
          current: currentWeekData.customerTouches,
          previous: prevWeekData.customerTouches,
          change: this.calculateChange(currentWeekData.customerTouches, prevWeekData.customerTouches),
        },
        avgResponseTime: {
          current: currentWeekData.avgResponseTime,
          previous: prevWeekData.avgResponseTime,
          change: this.calculateChange(prevWeekData.avgResponseTime, currentWeekData.avgResponseTime), // Reversed for response time
        },
        taskCompletionRate: {
          current: currentWeekData.taskCompletionRate,
          previous: prevWeekData.taskCompletionRate,
          change: this.calculateChange(currentWeekData.taskCompletionRate, prevWeekData.taskCompletionRate),
        },
      },
      nextWeek: nextWeekData,
      createdAt: new Date().toISOString(),
    };

    return summary;
  }

  // ============================================
  // Data Compilation Methods
  // ============================================

  private async compileAccomplishments(
    userId: string,
    dayStart: Date,
    dayEnd: Date
  ): Promise<DailySummary['accomplishments']> {
    if (!this.supabase) {
      return this.getMockAccomplishments();
    }

    // Get completed tasks
    const { data: tasks } = await this.supabase
      .from('tasks')
      .select('id, title, customer_id, customers(name), completed_at')
      .eq('assigned_to', userId)
      .eq('status', 'completed')
      .gte('completed_at', dayStart.toISOString())
      .lte('completed_at', dayEnd.toISOString());

    const tasksCompleted: TaskRef[] = (tasks || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      customerId: t.customer_id,
      customerName: t.customers?.name,
      completedAt: t.completed_at,
    }));

    // Get meetings held (from calendar or meetings table)
    const { data: meetings } = await this.supabase
      .from('meetings')
      .select('id, title, customer_id, customers(name), start_time, end_time, attendees, outcome, notes')
      .eq('organizer_id', userId)
      .gte('start_time', dayStart.toISOString())
      .lte('start_time', dayEnd.toISOString());

    const meetingsHeld: MeetingSummary[] = (meetings || []).map((m: any) => ({
      id: m.id,
      title: m.title,
      customerId: m.customer_id,
      customerName: m.customers?.name,
      startTime: m.start_time,
      endTime: m.end_time,
      attendees: m.attendees || [],
      outcome: m.outcome,
      notes: m.notes,
    }));

    // Get email count from activity log
    const { count: emailsSent } = await this.supabase
      .from('agent_activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action_type', 'send_email')
      .eq('status', 'completed')
      .gte('started_at', dayStart.toISOString())
      .lte('started_at', dayEnd.toISOString());

    // Get calls made
    const { count: callsMade } = await this.supabase
      .from('agent_activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('action_type', ['make_call', 'log_call'])
      .eq('status', 'completed')
      .gte('started_at', dayStart.toISOString())
      .lte('started_at', dayEnd.toISOString());

    // Get documents created
    const { data: docs } = await this.supabase
      .from('agent_activity_log')
      .select('result_data')
      .eq('user_id', userId)
      .in('action_type', ['create_document', 'create_presentation', 'create_spreadsheet'])
      .eq('status', 'completed')
      .gte('started_at', dayStart.toISOString())
      .lte('started_at', dayEnd.toISOString());

    const documentsCreated = (docs || [])
      .map((d: any) => d.result_data?.documentName || d.result_data?.title)
      .filter(Boolean);

    // Get issues resolved
    const { data: issues } = await this.supabase
      .from('ctas')
      .select('id, name')
      .eq('assigned_to', userId)
      .eq('status', 'resolved')
      .gte('resolved_at', dayStart.toISOString())
      .lte('resolved_at', dayEnd.toISOString());

    const issuesResolved = (issues || []).map((i: any) => i.name);

    return {
      tasksCompleted,
      meetingsHeld,
      emailsSent: emailsSent || 0,
      callsMade: callsMade || 0,
      documentsCreated,
      issuesResolved,
    };
  }

  private async compileTomorrowPreview(
    userId: string,
    tomorrowStart: Date,
    tomorrowEnd: Date
  ): Promise<DailySummary['tomorrow']> {
    if (!this.supabase) {
      return this.getMockTomorrowPreview();
    }

    // Get scheduled meetings for tomorrow
    const { data: meetingsData } = await this.supabase
      .from('meetings')
      .select('id, title, customer_id, customers(name), start_time, end_time, attendees')
      .or(`organizer_id.eq.${userId},attendees.cs.{${userId}}`)
      .gte('start_time', tomorrowStart.toISOString())
      .lt('start_time', tomorrowEnd.toISOString())
      .order('start_time');

    const meetings: MeetingPreview[] = (meetingsData || []).map((m: any) => ({
      id: m.id,
      title: m.title,
      customerId: m.customer_id,
      customerName: m.customers?.name,
      startTime: m.start_time,
      endTime: m.end_time,
      attendees: m.attendees || [],
      prepRequired: true, // Could be determined by meeting type
    }));

    // Get tasks due tomorrow
    const tomorrowDate = tomorrowStart.toISOString().split('T')[0];
    const { data: tasksData } = await this.supabase
      .from('tasks')
      .select('id, title, customer_id, customers(name), due_date, priority')
      .eq('assigned_to', userId)
      .neq('status', 'completed')
      .eq('due_date', tomorrowDate);

    const tasksDue: TaskRef[] = (tasksData || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      customerId: t.customer_id,
      customerName: t.customers?.name,
      dueDate: t.due_date,
      priority: t.priority,
    }));

    // Get deadlines approaching (renewals, milestones)
    const deadlines: Deadline[] = [];

    // Check for renewals
    const sevenDaysOut = new Date(tomorrowStart);
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

    const { data: renewals } = await this.supabase
      .from('customers')
      .select('id, name, renewal_date, arr')
      .eq('assigned_csm_id', userId)
      .gte('renewal_date', tomorrowDate)
      .lte('renewal_date', sevenDaysOut.toISOString().split('T')[0]);

    (renewals || []).forEach((r: any) => {
      const dueDate = new Date(r.renewal_date);
      const daysUntilDue = Math.ceil((dueDate.getTime() - tomorrowStart.getTime()) / (1000 * 60 * 60 * 24));
      deadlines.push({
        id: r.id,
        title: `Renewal: ${r.name}`,
        customerId: r.id,
        customerName: r.name,
        dueDate: r.renewal_date,
        type: 'renewal',
        daysUntilDue,
      });
    });

    // Get reminders
    const { data: remindersData } = await this.supabase
      .from('reminders')
      .select('id, title, customer_id, customers(name), reminder_date, type')
      .eq('user_id', userId)
      .eq('reminder_date', tomorrowDate)
      .eq('status', 'pending');

    const reminders: Reminder[] = (remindersData || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      customerId: r.customer_id,
      customerName: r.customers?.name,
      reminderDate: r.reminder_date,
      type: r.type || 'custom',
    }));

    return { meetings, tasksDue, deadlines, reminders };
  }

  private async compileAttentionRequired(
    userId: string,
    settings: DailySummarySettings
  ): Promise<DailySummary['attention']> {
    if (!this.supabase) {
      return this.getMockAttentionRequired();
    }

    const today = new Date().toISOString().split('T')[0];

    // Get overdue tasks
    const { data: overdueTasks } = await this.supabase
      .from('tasks')
      .select('id, title, customer_id, customers(name), due_date, priority')
      .eq('assigned_to', userId)
      .neq('status', 'completed')
      .lt('due_date', today)
      .order('due_date')
      .limit(settings.content.maxOverdueTasks);

    // Get missed follow-ups
    const { data: missedFollowUps } = await this.supabase
      .from('follow_ups')
      .select('id, title, customer_id, customers(name), scheduled_date')
      .eq('user_id', userId)
      .eq('status', 'missed')
      .lt('scheduled_date', today)
      .limit(10);

    const followUps: FollowUp[] = (missedFollowUps || []).map((f: any) => {
      const originalDate = new Date(f.scheduled_date);
      const daysOverdue = Math.ceil((new Date().getTime() - originalDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: f.id,
        title: f.title,
        customerId: f.customer_id,
        customerName: f.customers?.name,
        originalDate: f.scheduled_date,
        daysOverdue,
      };
    });

    // Get active alerts (health drops, churn risk, etc.)
    const { data: alertsData } = await this.supabase
      .from('alerts')
      .select('id, type, severity, title, description, customer_id, customers(name), detected_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('severity', { ascending: false })
      .limit(10);

    const alerts: Alert[] = (alertsData || []).map((a: any) => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      title: a.title,
      description: a.description,
      customerId: a.customer_id,
      customerName: a.customers?.name,
      detectedAt: a.detected_at,
    }));

    // Get pending approvals
    const { data: approvalsData } = await this.supabase
      .from('pending_actions')
      .select('id, type, title, customer_id, customers(name), created_at, requested_by')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at');

    const pendingApprovals: ApprovalRef[] = (approvalsData || []).map((a: any) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      customerId: a.customer_id,
      customerName: a.customers?.name,
      requestedAt: a.created_at,
      requestedBy: a.requested_by,
    }));

    // Get unanswered emails (simplified - would need Gmail integration)
    const unansweredEmails: EmailRef[] = [];

    return {
      overdueTasks: (overdueTasks || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        customerId: t.customer_id,
        customerName: t.customers?.name,
        dueDate: t.due_date,
        priority: t.priority,
      })),
      missedFollowUps: followUps,
      alerts,
      pendingApprovals,
      unansweredEmails,
    };
  }

  private async compilePortfolioHealth(
    userId: string,
    settings: DailySummarySettings
  ): Promise<DailySummary['portfolio']> {
    if (!this.supabase) {
      return this.getMockPortfolioHealth();
    }

    // Get all customers for this CSM
    const { data: customers } = await this.supabase
      .from('customers')
      .select('id, name, health_score, health_color, arr, renewal_date')
      .eq('assigned_csm_id', userId);

    const customerList = customers || [];
    const totalCustomers = customerList.length;

    // Calculate health distribution
    const healthDistribution = {
      green: customerList.filter((c: any) => c.health_color === 'green').length,
      yellow: customerList.filter((c: any) => c.health_color === 'yellow').length,
      red: customerList.filter((c: any) => c.health_color === 'red').length,
    };

    // Get customers needing attention (yellow/red health, or recent changes)
    const needingAttention: CustomerRef[] = customerList
      .filter((c: any) => c.health_color !== 'green')
      .sort((a: any, b: any) => (a.health_score || 100) - (b.health_score || 100))
      .slice(0, settings.content.maxCustomersNeedingAttention)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        healthScore: c.health_score || 0,
        healthColor: c.health_color || 'yellow',
        arr: c.arr || 0,
        reason: c.health_color === 'red' ? 'Critical health score' : 'Needs attention',
      }));

    // Get active risk signals count
    const { count: riskSignals } = await this.supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active')
      .in('type', ['churn_risk', 'health_drop', 'engagement_drop']);

    // Get upcoming renewals (next 30 days)
    const thirtyDaysOut = new Date();
    thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
    const today = new Date().toISOString().split('T')[0];

    const upcomingRenewals: RenewalPreview[] = customerList
      .filter((c: any) => {
        if (!c.renewal_date) return false;
        return c.renewal_date >= today && c.renewal_date <= thirtyDaysOut.toISOString().split('T')[0];
      })
      .sort((a: any, b: any) => new Date(a.renewal_date).getTime() - new Date(b.renewal_date).getTime())
      .slice(0, settings.content.maxUpcomingRenewals)
      .map((c: any) => {
        const renewalDate = new Date(c.renewal_date);
        const daysUntilRenewal = Math.ceil((renewalDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: c.id,
          customerName: c.name,
          customerId: c.id,
          renewalDate: c.renewal_date,
          daysUntilRenewal,
          arr: c.arr || 0,
          healthScore: c.health_score || 70,
          healthColor: c.health_color || 'yellow',
        };
      });

    return {
      totalCustomers,
      healthDistribution,
      needingAttention,
      riskSignals: riskSignals || 0,
      upcomingRenewals,
    };
  }

  private async compileMetrics(
    userId: string,
    dayStart: Date,
    dayEnd: Date
  ): Promise<DailySummary['metrics']> {
    if (!this.supabase) {
      return this.getMockMetrics();
    }

    // Get customer touches (emails, calls, meetings)
    const { count: emailCount } = await this.supabase
      .from('agent_activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action_type', 'send_email')
      .eq('status', 'completed')
      .gte('started_at', dayStart.toISOString())
      .lte('started_at', dayEnd.toISOString());

    const { count: meetingCount } = await this.supabase
      .from('meetings')
      .select('*', { count: 'exact', head: true })
      .eq('organizer_id', userId)
      .gte('start_time', dayStart.toISOString())
      .lte('start_time', dayEnd.toISOString());

    const customerTouches = (emailCount || 0) + (meetingCount || 0);

    // Calculate task completion rate
    const { count: totalTasks } = await this.supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', userId)
      .eq('due_date', dayStart.toISOString().split('T')[0]);

    const { count: completedTasks } = await this.supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', userId)
      .eq('status', 'completed')
      .eq('due_date', dayStart.toISOString().split('T')[0]);

    const taskCompletionRate = totalTasks && totalTasks > 0
      ? Math.round((completedTasks || 0) / totalTasks * 100)
      : 100;

    // Get average response time (from activity log or metrics table)
    const avgResponseTime = 2.5; // Placeholder - would calculate from actual data

    // Get comparison with average (last 7 days)
    const sevenDaysAgo = new Date(dayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: avgData } = await this.supabase
      .from('csm_daily_metrics')
      .select('customer_touches, task_completion_rate, avg_response_time')
      .eq('user_id', userId)
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .lt('date', dayStart.toISOString().split('T')[0]);

    let vsAverage = {
      customerTouches: 0,
      taskCompletionRate: 0,
      responseTime: 0,
    };

    if (avgData && avgData.length > 0) {
      const avgTouches = avgData.reduce((sum: number, d: any) => sum + (d.customer_touches || 0), 0) / avgData.length;
      const avgCompletionRate = avgData.reduce((sum: number, d: any) => sum + (d.task_completion_rate || 0), 0) / avgData.length;
      const avgRespTime = avgData.reduce((sum: number, d: any) => sum + (d.avg_response_time || 0), 0) / avgData.length;

      vsAverage = {
        customerTouches: avgTouches > 0 ? Math.round((customerTouches - avgTouches) / avgTouches * 100) : 0,
        taskCompletionRate: avgCompletionRate > 0 ? Math.round(taskCompletionRate - avgCompletionRate) : 0,
        responseTime: avgRespTime > 0 ? Math.round((avgRespTime - avgResponseTime) / avgRespTime * 100) : 0,
      };
    }

    return {
      customerTouches,
      avgResponseTime,
      taskCompletionRate,
      vsAverage,
    };
  }

  private async compileWeekAccomplishments(
    userId: string,
    weekStart: Date,
    weekEnd: Date
  ): Promise<{
    tasksCompleted: number;
    meetingsHeld: number;
    emailsSent: number;
    callsMade: number;
    highlights: string[];
    customerTouches: number;
    avgResponseTime: number;
    taskCompletionRate: number;
  }> {
    if (!this.supabase) {
      return {
        tasksCompleted: 15,
        meetingsHeld: 8,
        emailsSent: 45,
        callsMade: 12,
        highlights: ['Closed 2 renewals', 'Onboarded 1 new customer'],
        customerTouches: 65,
        avgResponseTime: 2.3,
        taskCompletionRate: 85,
      };
    }

    const { count: tasksCompleted } = await this.supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', userId)
      .eq('status', 'completed')
      .gte('completed_at', weekStart.toISOString())
      .lte('completed_at', weekEnd.toISOString());

    const { count: meetingsHeld } = await this.supabase
      .from('meetings')
      .select('*', { count: 'exact', head: true })
      .eq('organizer_id', userId)
      .gte('start_time', weekStart.toISOString())
      .lte('start_time', weekEnd.toISOString());

    const { count: emailsSent } = await this.supabase
      .from('agent_activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action_type', 'send_email')
      .eq('status', 'completed')
      .gte('started_at', weekStart.toISOString())
      .lte('started_at', weekEnd.toISOString());

    const { count: callsMade } = await this.supabase
      .from('agent_activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('action_type', ['make_call', 'log_call'])
      .eq('status', 'completed')
      .gte('started_at', weekStart.toISOString())
      .lte('started_at', weekEnd.toISOString());

    // Generate highlights
    const highlights: string[] = [];
    if ((tasksCompleted || 0) > 10) highlights.push(`Completed ${tasksCompleted} tasks`);
    if ((meetingsHeld || 0) > 5) highlights.push(`Held ${meetingsHeld} customer meetings`);

    const customerTouches = (emailsSent || 0) + (meetingsHeld || 0) + (callsMade || 0);

    return {
      tasksCompleted: tasksCompleted || 0,
      meetingsHeld: meetingsHeld || 0,
      emailsSent: emailsSent || 0,
      callsMade: callsMade || 0,
      highlights,
      customerTouches,
      avgResponseTime: 2.5, // Placeholder
      taskCompletionRate: 80, // Placeholder
    };
  }

  private async compileNextWeekPreview(
    userId: string,
    currentWeekEnd: Date
  ): Promise<WeeklySummary['nextWeek']> {
    const nextWeekStart = new Date(currentWeekEnd);
    nextWeekStart.setDate(nextWeekStart.getDate() + 1);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);

    if (!this.supabase) {
      return {
        scheduledMeetings: 5,
        tasksDue: 12,
        renewals: [],
        deadlines: [],
      };
    }

    const { count: scheduledMeetings } = await this.supabase
      .from('meetings')
      .select('*', { count: 'exact', head: true })
      .or(`organizer_id.eq.${userId},attendees.cs.{${userId}}`)
      .gte('start_time', nextWeekStart.toISOString())
      .lt('start_time', nextWeekEnd.toISOString());

    const { count: tasksDue } = await this.supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', userId)
      .neq('status', 'completed')
      .gte('due_date', nextWeekStart.toISOString().split('T')[0])
      .lt('due_date', nextWeekEnd.toISOString().split('T')[0]);

    const { data: renewalsData } = await this.supabase
      .from('customers')
      .select('id, name, renewal_date, arr, health_score, health_color')
      .eq('assigned_csm_id', userId)
      .gte('renewal_date', nextWeekStart.toISOString().split('T')[0])
      .lt('renewal_date', nextWeekEnd.toISOString().split('T')[0]);

    const renewals: RenewalPreview[] = (renewalsData || []).map((r: any) => ({
      id: r.id,
      customerName: r.name,
      customerId: r.id,
      renewalDate: r.renewal_date,
      daysUntilRenewal: Math.ceil((new Date(r.renewal_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
      arr: r.arr || 0,
      healthScore: r.health_score || 70,
      healthColor: r.health_color || 'yellow',
    }));

    return {
      scheduledMeetings: scheduledMeetings || 0,
      tasksDue: tasksDue || 0,
      renewals,
      deadlines: [],
    };
  }

  // ============================================
  // Delivery Methods
  // ============================================

  async deliverSummary(
    summary: DailySummary,
    channels: ('email' | 'slack' | 'in_app')[]
  ): Promise<{ email: boolean; slack: boolean; inApp: boolean }> {
    const results = { email: false, slack: false, inApp: false };
    const settings = await this.getSettings(summary.csmId);

    // Get user info for email
    let userEmail = '';
    let userName = '';
    if (this.supabase) {
      const { data: user } = await this.supabase
        .from('users')
        .select('email, name')
        .eq('id', summary.csmId)
        .single();
      userEmail = user?.email || '';
      userName = user?.name || 'CSM';
    }

    // Deliver via email
    if (channels.includes('email') && settings.delivery.email && userEmail) {
      try {
        const emailContent = generateDailySummaryEmail({
          summary,
          csmName: userName,
          csmEmail: userEmail,
        });

        await gmailService.sendEmail(summary.csmId, {
          to: [userEmail],
          subject: emailContent.subject,
          bodyHtml: emailContent.bodyHtml,
          bodyText: emailContent.bodyText,
        });

        results.email = true;
        summary.delivery.emailId = `email_${summary.id}`;
      } catch (error) {
        console.error('[DailySummary] Email delivery failed:', error);
      }
    }

    // Deliver via Slack
    if (channels.includes('slack') && settings.delivery.slack) {
      try {
        const slackMessage = this.formatSlackSummary(summary);
        const channelId = settings.delivery.slackChannelId;

        if (channelId) {
          const result = await slackService.sendMessage(summary.csmId, {
            channel: channelId,
            text: slackMessage.text,
            blocks: slackMessage.blocks,
          });
          results.slack = true;
          summary.delivery.slackTs = result.ts;
        }
      } catch (error) {
        console.error('[DailySummary] Slack delivery failed:', error);
      }
    }

    // Save in-app notification
    if (channels.includes('in_app') && settings.delivery.inApp) {
      try {
        if (this.supabase) {
          await this.supabase.from('notifications').insert({
            user_id: summary.csmId,
            type: 'daily_summary',
            title: `Daily Summary - ${formatDateShort(summary.date)}`,
            body: this.formatInAppSummary(summary),
            priority: 'low',
            data: { summaryId: summary.id },
            action_url: `/summary/${summary.id}`,
            created_at: new Date().toISOString(),
          });
          results.inApp = true;
        }
      } catch (error) {
        console.error('[DailySummary] In-app notification failed:', error);
      }
    }

    // Update delivery tracking
    summary.delivery.channels = channels.filter(c =>
      (c === 'email' && results.email) ||
      (c === 'slack' && results.slack) ||
      (c === 'in_app' && results.inApp)
    );
    summary.delivery.sentAt = new Date().toISOString();
    await this.saveSummary(summary);

    return results;
  }

  private formatSlackSummary(summary: DailySummary): { text: string; blocks: any[] } {
    const date = formatDateShort(summary.date);
    const accomplishmentCount = summary.accomplishments.tasksCompleted.length +
      summary.accomplishments.meetingsHeld.length;
    const attentionCount = summary.attention.overdueTasks.length +
      summary.attention.alerts.length +
      summary.attention.pendingApprovals.length;

    const text = `Daily Summary for ${date}`;

    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `Daily Summary - ${date}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Tasks Completed:* ${summary.accomplishments.tasksCompleted.length}` },
          { type: 'mrkdwn', text: `*Meetings Held:* ${summary.accomplishments.meetingsHeld.length}` },
          { type: 'mrkdwn', text: `*Emails Sent:* ${summary.accomplishments.emailsSent}` },
          { type: 'mrkdwn', text: `*Customer Touches:* ${summary.metrics.customerTouches}` },
        ],
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Tomorrow:* ${summary.tomorrow.meetings.length} meetings, ${summary.tomorrow.tasksDue.length} tasks due` },
      },
    ];

    if (attentionCount > 0) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `:warning: *Attention Required:* ${attentionCount} items need your attention` },
      });
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Portfolio Health:* :large_green_circle: ${summary.portfolio.healthDistribution.green} | :large_yellow_circle: ${summary.portfolio.healthDistribution.yellow} | :red_circle: ${summary.portfolio.healthDistribution.red}`,
      },
    });

    return { text, blocks };
  }

  private formatInAppSummary(summary: DailySummary): string {
    return `Completed ${summary.accomplishments.tasksCompleted.length} tasks, ` +
      `held ${summary.accomplishments.meetingsHeld.length} meetings. ` +
      `Tomorrow: ${summary.tomorrow.meetings.length} meetings scheduled. ` +
      `${summary.attention.overdueTasks.length} items need attention.`;
  }

  // ============================================
  // Persistence Methods
  // ============================================

  private async saveSummary(summary: DailySummary): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('daily_summaries').upsert({
      id: summary.id,
      csm_id: summary.csmId,
      date: summary.date,
      timezone: summary.timezone,
      accomplishments: summary.accomplishments,
      tomorrow: summary.tomorrow,
      attention: summary.attention,
      portfolio: summary.portfolio,
      metrics: summary.metrics,
      delivery: summary.delivery,
      created_at: summary.createdAt,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'csm_id,date',
    });
  }

  async getSummary(userId: string, date: string): Promise<DailySummary | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('daily_summaries')
      .select('*')
      .eq('csm_id', userId)
      .eq('date', date)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      csmId: data.csm_id,
      date: data.date,
      timezone: data.timezone,
      accomplishments: data.accomplishments,
      tomorrow: data.tomorrow,
      attention: data.attention,
      portfolio: data.portfolio,
      metrics: data.metrics,
      delivery: data.delivery,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async markAsViewed(summaryId: string): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('daily_summaries')
      .update({
        'delivery.viewedAt': new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', summaryId);
  }

  // ============================================
  // Helper Methods
  // ============================================

  private calculateChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round((current - previous) / previous * 100);
  }

  // ============================================
  // Mock Data (for development without database)
  // ============================================

  private getMockAccomplishments(): DailySummary['accomplishments'] {
    return {
      tasksCompleted: [
        { id: '1', title: 'Prepare QBR deck for Acme Corp', customerId: 'c1', customerName: 'Acme Corp', completedAt: new Date().toISOString() },
        { id: '2', title: 'Review health metrics', completedAt: new Date().toISOString() },
      ],
      meetingsHeld: [
        { id: 'm1', title: 'Weekly sync with TechStart', customerId: 'c2', customerName: 'TechStart', startTime: '10:00', endTime: '10:30', attendees: ['john@techstart.com'], outcome: 'Discussed adoption goals' },
      ],
      emailsSent: 8,
      callsMade: 3,
      documentsCreated: ['QBR Presentation - Acme Corp'],
      issuesResolved: ['Support escalation #1234'],
    };
  }

  private getMockTomorrowPreview(): DailySummary['tomorrow'] {
    return {
      meetings: [
        { id: 'm2', title: 'Kickoff call with NewCo', customerId: 'c3', customerName: 'NewCo', startTime: '09:00', endTime: '10:00', attendees: ['sarah@newco.io'], prepRequired: true },
      ],
      tasksDue: [
        { id: 't1', title: 'Send onboarding materials', customerId: 'c3', customerName: 'NewCo', dueDate: new Date().toISOString(), priority: 'high' },
      ],
      deadlines: [],
      reminders: [
        { id: 'r1', title: 'Follow up on proposal', customerId: 'c1', customerName: 'Acme Corp', reminderDate: new Date().toISOString(), type: 'follow_up' },
      ],
    };
  }

  private getMockAttentionRequired(): DailySummary['attention'] {
    return {
      overdueTasks: [],
      missedFollowUps: [],
      alerts: [
        { id: 'a1', type: 'health_drop', severity: 'medium', title: 'Health score dropped', description: 'TechStart health dropped 15 points', customerId: 'c2', customerName: 'TechStart', detectedAt: new Date().toISOString() },
      ],
      pendingApprovals: [],
      unansweredEmails: [],
    };
  }

  private getMockPortfolioHealth(): DailySummary['portfolio'] {
    return {
      totalCustomers: 15,
      healthDistribution: { green: 10, yellow: 4, red: 1 },
      needingAttention: [
        { id: 'c4', name: 'RiskyCo', healthScore: 35, healthColor: 'red', arr: 50000, reason: 'Critical health score' },
      ],
      riskSignals: 2,
      upcomingRenewals: [
        { id: 'c1', customerName: 'Acme Corp', customerId: 'c1', renewalDate: '2026-02-15', daysUntilRenewal: 17, arr: 120000, healthScore: 85, healthColor: 'green' },
      ],
    };
  }

  private getMockMetrics(): DailySummary['metrics'] {
    return {
      customerTouches: 12,
      avgResponseTime: 2.3,
      taskCompletionRate: 85,
      vsAverage: {
        customerTouches: 15,
        taskCompletionRate: 5,
        responseTime: -10,
      },
    };
  }
}

// ============================================
// Helper Functions
// ============================================

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// ============================================
// Singleton Instance
// ============================================

export const dailySummaryService = new DailySummaryService();
export default dailySummaryService;
