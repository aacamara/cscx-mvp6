/**
 * Team Performance Service
 * PRD-178: Team Performance Dashboard for CS Leaders
 *
 * Provides metrics aggregation for:
 * - Individual CSM performance (retention, NRR, health, activity)
 * - Team-level aggregations and goals
 * - Historical trends and benchmarks
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// TYPES (Internal)
// ============================================

interface CSMMetrics {
  user_id: string;
  user_name: string;
  email: string;
  avatar_url?: string;
  portfolio_value: number;
  customer_count: number;
  retention_rate: number;
  net_revenue_retention: number;
  health_score_avg: number;
  activity_score: number;
  meetings_this_month: number;
  emails_this_month: number;
  tasks_completed: number;
  retention_trend: 'improving' | 'stable' | 'declining';
  nrr_trend: 'improving' | 'stable' | 'declining';
  health_trend: 'improving' | 'stable' | 'declining';
  retention_rate_previous: number;
  nrr_previous: number;
  health_score_avg_previous: number;
}

interface TeamSummary {
  total_csms: number;
  total_customers: number;
  total_arr: number;
  avg_retention_rate: number;
  avg_nrr: number;
  avg_health_score: number;
  avg_activity_score: number;
  retention_change_wow: number;
  nrr_change_wow: number;
  health_change_wow: number;
  high_performers: number;
  meeting_target: number;
  below_target: number;
}

interface TeamGoal {
  id: string;
  team_id?: string;
  metric: 'retention' | 'nrr' | 'health' | 'activity';
  target_value: number;
  current_value: number;
  period_start: string;
  period_end: string;
  progress_pct: number;
  status: 'on_track' | 'at_risk' | 'behind';
}

interface TeamHighlight {
  type: 'achievement' | 'improvement' | 'concern';
  title: string;
  description: string;
  csm_name?: string;
  csm_id?: string;
  metric?: string;
  value?: number;
}

interface TeamTrendPoint {
  date: string;
  avg_retention: number;
  avg_nrr: number;
  avg_health: number;
  avg_activity: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function determineTrend(current: number, previous: number): 'improving' | 'stable' | 'declining' {
  const change = current - previous;
  if (change >= 2) return 'improving';
  if (change <= -2) return 'declining';
  return 'stable';
}

function calculateActivityScore(meetings: number, emails: number, tasks: number): number {
  // Weighted activity score
  // Meetings: 40%, Emails: 30%, Tasks: 30%
  const meetingScore = Math.min(100, (meetings / 8) * 100) * 0.4;  // Target: 8 meetings/month
  const emailScore = Math.min(100, (emails / 40) * 100) * 0.3;      // Target: 40 emails/month
  const taskScore = Math.min(100, (tasks / 20) * 100) * 0.3;        // Target: 20 tasks/month

  return Math.round(meetingScore + emailScore + taskScore);
}

function getGoalStatus(current: number, target: number, progressPct: number): 'on_track' | 'at_risk' | 'behind' {
  if (progressPct >= 90) return 'on_track';
  if (progressPct >= 70) return 'at_risk';
  return 'behind';
}

function generateMockCSMs(): CSMMetrics[] {
  // Mock CSM data for development
  return [
    {
      user_id: 'csm-001',
      user_name: 'Sarah Chen',
      email: 'sarah.chen@company.com',
      portfolio_value: 2500000,
      customer_count: 18,
      retention_rate: 98,
      net_revenue_retention: 112,
      health_score_avg: 82,
      activity_score: 95,
      meetings_this_month: 12,
      emails_this_month: 48,
      tasks_completed: 24,
      retention_trend: 'stable',
      nrr_trend: 'improving',
      health_trend: 'improving',
      retention_rate_previous: 97,
      nrr_previous: 108,
      health_score_avg_previous: 78
    },
    {
      user_id: 'csm-002',
      user_name: 'Mike Torres',
      email: 'mike.torres@company.com',
      portfolio_value: 1800000,
      customer_count: 15,
      retention_rate: 95,
      net_revenue_retention: 105,
      health_score_avg: 78,
      activity_score: 88,
      meetings_this_month: 10,
      emails_this_month: 42,
      tasks_completed: 18,
      retention_trend: 'improving',
      nrr_trend: 'stable',
      health_trend: 'stable',
      retention_rate_previous: 90,
      nrr_previous: 103,
      health_score_avg_previous: 76
    },
    {
      user_id: 'csm-003',
      user_name: 'Jennifer Park',
      email: 'jennifer.park@company.com',
      portfolio_value: 2100000,
      customer_count: 16,
      retention_rate: 92,
      net_revenue_retention: 98,
      health_score_avg: 75,
      activity_score: 82,
      meetings_this_month: 8,
      emails_this_month: 38,
      tasks_completed: 16,
      retention_trend: 'stable',
      nrr_trend: 'declining',
      health_trend: 'stable',
      retention_rate_previous: 94,
      nrr_previous: 102,
      health_score_avg_previous: 77
    },
    {
      user_id: 'csm-004',
      user_name: 'David Kim',
      email: 'david.kim@company.com',
      portfolio_value: 1600000,
      customer_count: 12,
      retention_rate: 96,
      net_revenue_retention: 108,
      health_score_avg: 80,
      activity_score: 90,
      meetings_this_month: 11,
      emails_this_month: 44,
      tasks_completed: 22,
      retention_trend: 'stable',
      nrr_trend: 'improving',
      health_trend: 'improving',
      retention_rate_previous: 95,
      nrr_previous: 104,
      health_score_avg_previous: 76
    },
    {
      user_id: 'csm-005',
      user_name: 'Emily Rodriguez',
      email: 'emily.rodriguez@company.com',
      portfolio_value: 2200000,
      customer_count: 17,
      retention_rate: 94,
      net_revenue_retention: 103,
      health_score_avg: 76,
      activity_score: 85,
      meetings_this_month: 9,
      emails_this_month: 40,
      tasks_completed: 19,
      retention_trend: 'declining',
      nrr_trend: 'stable',
      health_trend: 'declining',
      retention_rate_previous: 97,
      nrr_previous: 101,
      health_score_avg_previous: 79
    }
  ];
}

function generateMockTrends(days: number = 30): TeamTrendPoint[] {
  const trends: TeamTrendPoint[] = [];
  const now = new Date();

  for (let i = days; i >= 0; i -= 7) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const baseRetention = 94 + Math.sin(i / 10) * 2;
    const baseNrr = 104 + Math.sin(i / 8) * 4;
    const baseHealth = 77 + Math.sin(i / 12) * 3;
    const baseActivity = 86 + Math.sin(i / 6) * 4;

    trends.push({
      date: date.toISOString().split('T')[0],
      avg_retention: Math.round(baseRetention * 10) / 10,
      avg_nrr: Math.round(baseNrr * 10) / 10,
      avg_health: Math.round(baseHealth),
      avg_activity: Math.round(baseActivity)
    });
  }

  return trends;
}

// ============================================
// SERVICE CLASS
// ============================================

export class TeamPerformanceService {
  /**
   * Get team performance overview
   */
  async getTeamPerformance(
    period: 'month' | 'quarter' | 'year' = 'month',
    teamId?: string,
    sortBy: string = 'retention',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<{
    summary: TeamSummary;
    csm_metrics: CSMMetrics[];
    team_goals: TeamGoal[];
    highlights: TeamHighlight[];
    trends: TeamTrendPoint[];
    period: { start: string; end: string; label: string };
  }> {
    // Calculate period dates
    const now = new Date();
    let periodStart: Date;
    let periodLabel: string;

    switch (period) {
      case 'quarter':
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        periodStart = new Date(now.getFullYear(), quarterStart, 1);
        periodLabel = `Q${Math.floor(quarterStart / 3) + 1} ${now.getFullYear()}`;
        break;
      case 'year':
        periodStart = new Date(now.getFullYear(), 0, 1);
        periodLabel = now.getFullYear().toString();
        break;
      default: // month
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    // Get CSM metrics from database or mock data
    let csmMetrics: CSMMetrics[];

    if (supabase) {
      // Fetch real data from database
      const { data: users } = await supabase
        .from('users')
        .select('id, email, full_name, avatar_url')
        .eq('role', 'csm');

      if (users && users.length > 0) {
        csmMetrics = await Promise.all(
          users.map(async (user) => {
            // Get customer metrics for this CSM
            const { data: customers } = await supabase!
              .from('customers')
              .select('id, arr, health_score')
              .eq('csm_id', user.id);

            const customerList = customers || [];
            const portfolioValue = customerList.reduce((sum, c) => sum + (Number(c.arr) || 0), 0);
            const avgHealth = customerList.length > 0
              ? customerList.reduce((sum, c) => sum + (c.health_score || 70), 0) / customerList.length
              : 70;

            // Get activity metrics
            const { count: meetingCount } = await supabase!
              .from('agent_activity_log')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('activity_type', 'meeting')
              .gte('created_at', periodStart.toISOString());

            const { count: emailCount } = await supabase!
              .from('agent_activity_log')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('activity_type', 'email')
              .gte('created_at', periodStart.toISOString());

            const { count: taskCount } = await supabase!
              .from('agent_activity_log')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('activity_type', 'task')
              .gte('created_at', periodStart.toISOString());

            const meetings = meetingCount || Math.floor(Math.random() * 8) + 4;
            const emails = emailCount || Math.floor(Math.random() * 30) + 20;
            const tasks = taskCount || Math.floor(Math.random() * 15) + 10;

            // Mock retention and NRR (would come from actual calculations in production)
            const retention = 90 + Math.random() * 10;
            const nrr = 95 + Math.random() * 20;
            const previousRetention = retention - 2 + Math.random() * 4;
            const previousNrr = nrr - 3 + Math.random() * 6;
            const previousHealth = avgHealth - 2 + Math.random() * 4;

            return {
              user_id: user.id,
              user_name: user.full_name || user.email.split('@')[0],
              email: user.email,
              avatar_url: user.avatar_url,
              portfolio_value: portfolioValue,
              customer_count: customerList.length,
              retention_rate: Math.round(retention * 10) / 10,
              net_revenue_retention: Math.round(nrr * 10) / 10,
              health_score_avg: Math.round(avgHealth),
              activity_score: calculateActivityScore(meetings, emails, tasks),
              meetings_this_month: meetings,
              emails_this_month: emails,
              tasks_completed: tasks,
              retention_trend: determineTrend(retention, previousRetention),
              nrr_trend: determineTrend(nrr, previousNrr),
              health_trend: determineTrend(avgHealth, previousHealth),
              retention_rate_previous: Math.round(previousRetention * 10) / 10,
              nrr_previous: Math.round(previousNrr * 10) / 10,
              health_score_avg_previous: Math.round(previousHealth)
            };
          })
        );
      } else {
        csmMetrics = generateMockCSMs();
      }
    } else {
      csmMetrics = generateMockCSMs();
    }

    // Sort CSM metrics
    csmMetrics.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'retention':
          comparison = a.retention_rate - b.retention_rate;
          break;
        case 'nrr':
          comparison = a.net_revenue_retention - b.net_revenue_retention;
          break;
        case 'health':
          comparison = a.health_score_avg - b.health_score_avg;
          break;
        case 'activity':
          comparison = a.activity_score - b.activity_score;
          break;
        case 'portfolio':
          comparison = a.portfolio_value - b.portfolio_value;
          break;
        case 'name':
          comparison = a.user_name.localeCompare(b.user_name);
          break;
        default:
          comparison = a.retention_rate - b.retention_rate;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Calculate team summary
    const summary: TeamSummary = {
      total_csms: csmMetrics.length,
      total_customers: csmMetrics.reduce((sum, c) => sum + c.customer_count, 0),
      total_arr: csmMetrics.reduce((sum, c) => sum + c.portfolio_value, 0),
      avg_retention_rate: Math.round(
        (csmMetrics.reduce((sum, c) => sum + c.retention_rate, 0) / csmMetrics.length) * 10
      ) / 10,
      avg_nrr: Math.round(
        (csmMetrics.reduce((sum, c) => sum + c.net_revenue_retention, 0) / csmMetrics.length) * 10
      ) / 10,
      avg_health_score: Math.round(
        csmMetrics.reduce((sum, c) => sum + c.health_score_avg, 0) / csmMetrics.length
      ),
      avg_activity_score: Math.round(
        csmMetrics.reduce((sum, c) => sum + c.activity_score, 0) / csmMetrics.length
      ),
      retention_change_wow: Math.round(
        (csmMetrics.reduce((sum, c) => sum + (c.retention_rate - c.retention_rate_previous), 0) / csmMetrics.length) * 10
      ) / 10,
      nrr_change_wow: Math.round(
        (csmMetrics.reduce((sum, c) => sum + (c.net_revenue_retention - c.nrr_previous), 0) / csmMetrics.length) * 10
      ) / 10,
      health_change_wow: Math.round(
        csmMetrics.reduce((sum, c) => sum + (c.health_score_avg - c.health_score_avg_previous), 0) / csmMetrics.length
      ),
      high_performers: csmMetrics.filter(c => c.retention_rate >= 96).length,
      meeting_target: csmMetrics.filter(c => c.retention_rate >= 90 && c.retention_rate < 96).length,
      below_target: csmMetrics.filter(c => c.retention_rate < 90).length
    };

    // Define team goals
    const teamGoals: TeamGoal[] = [
      {
        id: 'goal-retention',
        metric: 'retention',
        target_value: 96,
        current_value: summary.avg_retention_rate,
        period_start: periodStart.toISOString().split('T')[0],
        period_end: now.toISOString().split('T')[0],
        progress_pct: Math.round((summary.avg_retention_rate / 96) * 100),
        status: getGoalStatus(summary.avg_retention_rate, 96, Math.round((summary.avg_retention_rate / 96) * 100))
      },
      {
        id: 'goal-nrr',
        metric: 'nrr',
        target_value: 110,
        current_value: summary.avg_nrr,
        period_start: periodStart.toISOString().split('T')[0],
        period_end: now.toISOString().split('T')[0],
        progress_pct: Math.round((summary.avg_nrr / 110) * 100),
        status: getGoalStatus(summary.avg_nrr, 110, Math.round((summary.avg_nrr / 110) * 100))
      },
      {
        id: 'goal-health',
        metric: 'health',
        target_value: 80,
        current_value: summary.avg_health_score,
        period_start: periodStart.toISOString().split('T')[0],
        period_end: now.toISOString().split('T')[0],
        progress_pct: Math.round((summary.avg_health_score / 80) * 100),
        status: getGoalStatus(summary.avg_health_score, 80, Math.round((summary.avg_health_score / 80) * 100))
      }
    ];

    // Generate highlights
    const highlights: TeamHighlight[] = [];

    // Find top performer
    const topRetention = csmMetrics.reduce((best, c) =>
      c.retention_rate > best.retention_rate ? c : best, csmMetrics[0]);
    if (topRetention.retention_rate >= 96) {
      highlights.push({
        type: 'achievement',
        title: 'Top Retention',
        description: `${topRetention.user_name} achieved ${topRetention.retention_rate}% retention - highest on the team`,
        csm_name: topRetention.user_name,
        csm_id: topRetention.user_id,
        metric: 'retention',
        value: topRetention.retention_rate
      });
    }

    // Find biggest improvers
    const mostImproved = csmMetrics.reduce((best, c) => {
      const improvement = c.retention_rate - c.retention_rate_previous;
      const bestImprovement = best.retention_rate - best.retention_rate_previous;
      return improvement > bestImprovement ? c : best;
    }, csmMetrics[0]);
    const improvementAmount = mostImproved.retention_rate - mostImproved.retention_rate_previous;
    if (improvementAmount >= 3) {
      highlights.push({
        type: 'improvement',
        title: 'Most Improved',
        description: `${mostImproved.user_name} improved retention by ${improvementAmount.toFixed(1)}%`,
        csm_name: mostImproved.user_name,
        csm_id: mostImproved.user_id,
        metric: 'retention',
        value: improvementAmount
      });
    }

    // Find concerns
    const belowTarget = csmMetrics.filter(c => c.net_revenue_retention < 100);
    if (belowTarget.length > 0) {
      const concern = belowTarget[0];
      highlights.push({
        type: 'concern',
        title: 'NRR Below Target',
        description: `${concern.user_name} NRR at ${concern.net_revenue_retention}% - goal is 110%`,
        csm_name: concern.user_name,
        csm_id: concern.user_id,
        metric: 'nrr',
        value: concern.net_revenue_retention
      });
    }

    // Generate trends
    const trends = generateMockTrends(30);

    return {
      summary,
      csm_metrics: csmMetrics,
      team_goals: teamGoals,
      highlights,
      trends,
      period: {
        start: periodStart.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0],
        label: periodLabel
      }
    };
  }

  /**
   * Get individual CSM detail metrics
   */
  async getCSMDetail(userId: string): Promise<{
    csm: CSMMetrics;
    customers: Array<{
      customer_id: string;
      customer_name: string;
      arr: number;
      health_score: number;
      health_category: 'healthy' | 'warning' | 'critical';
      days_to_renewal: number | null;
      last_contact: string | null;
    }>;
    goals: Array<{
      id: string;
      user_id: string;
      metric: string;
      target_value: number;
      current_value: number;
      period_start: string;
      period_end: string;
      status: string;
      created_at: string;
    }>;
    activity_log: Array<{
      id: string;
      type: string;
      customer_name: string;
      description: string;
      timestamp: string;
    }>;
    trends: Array<{
      date: string;
      retention: number;
      nrr: number;
      health: number;
      activity: number;
    }>;
  }> {
    // Get team performance first to find the CSM
    const teamData = await this.getTeamPerformance();
    const csm = teamData.csm_metrics.find(c => c.user_id === userId);

    if (!csm) {
      throw new Error('CSM not found');
    }

    // Get customers for this CSM
    let customers: Array<{
      customer_id: string;
      customer_name: string;
      arr: number;
      health_score: number;
      health_category: 'healthy' | 'warning' | 'critical';
      days_to_renewal: number | null;
      last_contact: string | null;
    }> = [];

    if (supabase) {
      const { data: customerData } = await supabase
        .from('customers')
        .select('id, name, arr, health_score, renewal_date')
        .eq('csm_id', userId);

      if (customerData) {
        customers = customerData.map(c => {
          const score = c.health_score || 70;
          const daysToRenewal = c.renewal_date
            ? Math.ceil((new Date(c.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null;

          return {
            customer_id: c.id,
            customer_name: c.name,
            arr: c.arr || 0,
            health_score: score,
            health_category: score >= 70 ? 'healthy' : score >= 40 ? 'warning' : 'critical',
            days_to_renewal: daysToRenewal,
            last_contact: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
          };
        });
      }
    }

    // If no customers found, generate mock data
    if (customers.length === 0) {
      customers = [
        { customer_id: 'cust-1', customer_name: 'Acme Corp', arr: 120000, health_score: 85, health_category: 'healthy', days_to_renewal: 120, last_contact: new Date().toISOString() },
        { customer_id: 'cust-2', customer_name: 'TechStart Inc', arr: 65000, health_score: 48, health_category: 'warning', days_to_renewal: 45, last_contact: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
        { customer_id: 'cust-3', customer_name: 'GlobalTech', arr: 280000, health_score: 92, health_category: 'healthy', days_to_renewal: 200, last_contact: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
      ];
    }

    // CSM goals
    const goals = [
      {
        id: `goal-${userId}-retention`,
        user_id: userId,
        metric: 'retention',
        target_value: 96,
        current_value: csm.retention_rate,
        period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        period_end: new Date().toISOString().split('T')[0],
        status: csm.retention_rate >= 94 ? 'on_track' : csm.retention_rate >= 90 ? 'at_risk' : 'behind',
        created_at: new Date().toISOString()
      },
      {
        id: `goal-${userId}-nrr`,
        user_id: userId,
        metric: 'nrr',
        target_value: 110,
        current_value: csm.net_revenue_retention,
        period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        period_end: new Date().toISOString().split('T')[0],
        status: csm.net_revenue_retention >= 105 ? 'on_track' : csm.net_revenue_retention >= 100 ? 'at_risk' : 'behind',
        created_at: new Date().toISOString()
      }
    ];

    // Generate activity log
    const activityTypes = ['meeting', 'email', 'call', 'note', 'task'];
    const activity_log = Array.from({ length: 10 }, (_, i) => ({
      id: `activity-${i}`,
      type: activityTypes[Math.floor(Math.random() * activityTypes.length)],
      customer_name: customers[i % customers.length]?.customer_name || 'Unknown Customer',
      description: `${activityTypes[i % activityTypes.length]} activity completed`,
      timestamp: new Date(Date.now() - i * 2 * 24 * 60 * 60 * 1000).toISOString()
    }));

    // Generate individual trends
    const trends = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (11 - i) * 7);
      return {
        date: date.toISOString().split('T')[0],
        retention: Math.round((csm.retention_rate + Math.sin(i) * 2) * 10) / 10,
        nrr: Math.round((csm.net_revenue_retention + Math.sin(i) * 3) * 10) / 10,
        health: Math.round(csm.health_score_avg + Math.sin(i) * 2),
        activity: Math.round(csm.activity_score + Math.sin(i) * 4)
      };
    });

    return {
      csm,
      customers,
      goals,
      activity_log,
      trends
    };
  }

  /**
   * Create or update a team goal
   */
  async setTeamGoal(input: {
    metric: 'retention' | 'nrr' | 'health' | 'activity';
    target_value: number;
    period_start: string;
    period_end: string;
    user_id?: string;
  }): Promise<{ id: string; success: boolean }> {
    if (!supabase) {
      return { id: `goal-${Date.now()}`, success: true };
    }

    const { data, error } = await supabase
      .from('csm_goals')
      .insert({
        user_id: input.user_id || null,
        metric: input.metric,
        target_value: input.target_value,
        period_start: input.period_start,
        period_end: input.period_end,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating goal:', error);
      throw new Error('Failed to create goal');
    }

    return { id: data.id, success: true };
  }

  /**
   * Get leaderboard for a specific metric
   */
  async getLeaderboard(
    metric: 'retention' | 'nrr' | 'health' | 'activity' = 'retention',
    period: 'month' | 'quarter' | 'year' = 'month'
  ): Promise<{
    metric: string;
    period: string;
    entries: Array<{
      rank: number;
      user_id: string;
      user_name: string;
      avatar_url?: string;
      metric_value: number;
      change_from_previous: number;
      is_top_performer: boolean;
    }>;
  }> {
    const teamData = await this.getTeamPerformance(period);
    const csms = teamData.csm_metrics;

    // Sort by the specified metric
    const sorted = [...csms].sort((a, b) => {
      switch (metric) {
        case 'retention':
          return b.retention_rate - a.retention_rate;
        case 'nrr':
          return b.net_revenue_retention - a.net_revenue_retention;
        case 'health':
          return b.health_score_avg - a.health_score_avg;
        case 'activity':
          return b.activity_score - a.activity_score;
        default:
          return 0;
      }
    });

    const entries = sorted.map((csm, index) => {
      let value: number;
      let previousValue: number;

      switch (metric) {
        case 'retention':
          value = csm.retention_rate;
          previousValue = csm.retention_rate_previous;
          break;
        case 'nrr':
          value = csm.net_revenue_retention;
          previousValue = csm.nrr_previous;
          break;
        case 'health':
          value = csm.health_score_avg;
          previousValue = csm.health_score_avg_previous;
          break;
        case 'activity':
          value = csm.activity_score;
          previousValue = csm.activity_score; // No previous for activity
          break;
        default:
          value = 0;
          previousValue = 0;
      }

      return {
        rank: index + 1,
        user_id: csm.user_id,
        user_name: csm.user_name,
        avatar_url: csm.avatar_url,
        metric_value: value,
        change_from_previous: Math.round((value - previousValue) * 10) / 10,
        is_top_performer: index < 3
      };
    });

    return {
      metric,
      period: teamData.period.label,
      entries
    };
  }
}

// Export singleton instance
export const teamPerformanceService = new TeamPerformanceService();
