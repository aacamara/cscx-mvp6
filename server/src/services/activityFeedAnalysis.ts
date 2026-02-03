/**
 * Activity Feed Analysis Service
 * PRD-172: Activity tracking and analysis for customer engagement
 *
 * Provides:
 * - Activity aggregation and metrics
 * - Gap detection for customers without recent activity
 * - CSM productivity analysis
 * - Activity effectiveness correlation
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Types
// ============================================

export type ActivityType = 'email' | 'meeting' | 'call' | 'note' | 'task' | 'document';

export interface Activity {
  id: string;
  type: ActivityType;
  customer_id: string;
  customer_name?: string;
  csm_id: string;
  csm_name?: string;
  timestamp: string;
  description: string;
  outcome?: string;
  duration_minutes?: number;
  participants?: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ActivityMetrics {
  period: string;
  period_start: string;
  period_end: string;
  total_activities: number;
  by_type: Record<ActivityType, number>;
  by_csm: Record<string, { name: string; count: number }>;
  avg_per_customer: number;
  customers_with_activity: number;
  customers_without_activity: number;
  total_customers: number;
}

export interface ActivityGap {
  customer_id: string;
  customer_name: string;
  arr: number;
  health_color: 'green' | 'yellow' | 'red';
  days_since_activity: number;
  last_activity_date: string | null;
  last_activity_type: ActivityType | null;
  risk_level: 'low' | 'medium' | 'high';
  csm_id: string;
  csm_name: string;
}

export interface CSMProductivity {
  csm_id: string;
  csm_name: string;
  total_activities: number;
  customers_touched: number;
  total_customers: number;
  coverage_rate: number;
  by_type: Record<ActivityType, number>;
  avg_activities_per_customer: number;
  activities_this_week: number;
  activities_last_week: number;
  trend_change: number;
}

export interface ActivityTrendPoint {
  date: string;
  total: number;
  by_type: Record<ActivityType, number>;
}

export interface ActivityEffectiveness {
  activity_type: ActivityType;
  total_count: number;
  avg_health_impact: number;
  correlated_health_improvements: number;
  correlated_health_declines: number;
  avg_response_rate: number;
  recommended_frequency: string;
}

export interface ActivityFeedFilters {
  period?: 'today' | 'this_week' | 'this_month' | 'this_quarter' | 'custom';
  start_date?: string;
  end_date?: string;
  activity_types?: ActivityType[];
  csm_id?: string;
  customer_id?: string;
  include_gaps?: boolean;
  gap_threshold_days?: number;
}

// ============================================
// Helper Functions
// ============================================

function getDateRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let start: Date;

  switch (period) {
    case 'today':
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      break;
    case 'this_week':
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      break;
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'this_quarter':
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), quarterMonth, 1);
      break;
    default:
      // Default to last 7 days
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

function calculateRiskLevel(daysSinceActivity: number): 'low' | 'medium' | 'high' {
  if (daysSinceActivity >= 21) return 'high';
  if (daysSinceActivity >= 14) return 'medium';
  return 'low';
}

function initializeByType(): Record<ActivityType, number> {
  return {
    email: 0,
    meeting: 0,
    call: 0,
    note: 0,
    task: 0,
    document: 0,
  };
}

// ============================================
// Activity Feed Analysis Service
// ============================================

export class ActivityFeedAnalysisService {
  /**
   * Get activity feed metrics for the portfolio
   */
  async getActivityMetrics(
    userId: string,
    filters: ActivityFeedFilters = {}
  ): Promise<ActivityMetrics> {
    const { period = 'this_week', start_date, end_date } = filters;

    // Calculate date range
    let startDate: Date;
    let endDate: Date;

    if (start_date && end_date) {
      startDate = new Date(start_date);
      endDate = new Date(end_date);
    } else {
      const range = getDateRange(period);
      startDate = range.start;
      endDate = range.end;
    }

    if (!supabase) {
      // Return mock data when no database
      return this.getMockActivityMetrics(period, startDate, endDate);
    }

    try {
      // Get all activities in the period
      const { data: activities, error: activitiesError } = await supabase
        .from('customer_activities')
        .select(`
          id,
          type,
          customer_id,
          csm_id,
          timestamp,
          description,
          customers (id, name)
        `)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: false });

      if (activitiesError) throw activitiesError;

      // Get total customers
      const { count: totalCustomers, error: customersError } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });

      if (customersError) throw customersError;

      // Calculate metrics
      const byType = initializeByType();
      const byCsm: Record<string, { name: string; count: number }> = {};
      const customersWithActivity = new Set<string>();

      (activities || []).forEach((activity: any) => {
        // By type
        if (activity.type && byType.hasOwnProperty(activity.type)) {
          byType[activity.type as ActivityType]++;
        }

        // By CSM
        if (activity.csm_id) {
          if (!byCsm[activity.csm_id]) {
            byCsm[activity.csm_id] = { name: activity.csm_id, count: 0 };
          }
          byCsm[activity.csm_id].count++;
        }

        // Track customers with activity
        if (activity.customer_id) {
          customersWithActivity.add(activity.customer_id);
        }
      });

      const total = activities?.length || 0;
      const customersCount = customersWithActivity.size;
      const totalCustomersCount = totalCustomers || 0;

      return {
        period,
        period_start: startDate.toISOString(),
        period_end: endDate.toISOString(),
        total_activities: total,
        by_type: byType,
        by_csm: byCsm,
        avg_per_customer: totalCustomersCount > 0 ? Math.round((total / totalCustomersCount) * 10) / 10 : 0,
        customers_with_activity: customersCount,
        customers_without_activity: totalCustomersCount - customersCount,
        total_customers: totalCustomersCount,
      };
    } catch (error) {
      console.error('[ActivityFeedAnalysis] Error fetching metrics:', error);
      return this.getMockActivityMetrics(period, startDate, endDate);
    }
  }

  /**
   * Get customers with activity gaps
   */
  async getActivityGaps(
    userId: string,
    thresholdDays: number = 7
  ): Promise<ActivityGap[]> {
    if (!supabase) {
      return this.getMockActivityGaps(thresholdDays);
    }

    try {
      // Get all customers with their last activity
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select(`
          id,
          name,
          arr,
          health_color,
          owner_id
        `);

      if (customersError) throw customersError;

      // Get last activity for each customer
      const gaps: ActivityGap[] = [];

      for (const customer of customers || []) {
        const { data: lastActivity, error: activityError } = await supabase
          .from('customer_activities')
          .select('timestamp, type')
          .eq('customer_id', customer.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        const now = new Date();
        let daysSinceActivity: number;
        let lastActivityDate: string | null = null;
        let lastActivityType: ActivityType | null = null;

        if (lastActivity && !activityError) {
          lastActivityDate = lastActivity.timestamp;
          lastActivityType = lastActivity.type;
          const activityDate = new Date(lastActivity.timestamp);
          daysSinceActivity = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
        } else {
          // No activity found
          daysSinceActivity = 999; // Very high number for customers with no activity
        }

        if (daysSinceActivity >= thresholdDays) {
          gaps.push({
            customer_id: customer.id,
            customer_name: customer.name,
            arr: customer.arr || 0,
            health_color: customer.health_color || 'yellow',
            days_since_activity: daysSinceActivity,
            last_activity_date: lastActivityDate,
            last_activity_type: lastActivityType,
            risk_level: calculateRiskLevel(daysSinceActivity),
            csm_id: customer.owner_id || 'unassigned',
            csm_name: customer.owner_id || 'Unassigned',
          });
        }
      }

      // Sort by days since activity (highest first)
      gaps.sort((a, b) => b.days_since_activity - a.days_since_activity);

      return gaps;
    } catch (error) {
      console.error('[ActivityFeedAnalysis] Error fetching gaps:', error);
      return this.getMockActivityGaps(thresholdDays);
    }
  }

  /**
   * Get CSM productivity metrics
   */
  async getCSMProductivity(userId: string): Promise<CSMProductivity[]> {
    if (!supabase) {
      return this.getMockCSMProductivity();
    }

    try {
      // Get activities from this week and last week
      const now = new Date();
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(now.getDate() - now.getDay());
      thisWeekStart.setHours(0, 0, 0, 0);

      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);

      const lastWeekEnd = new Date(thisWeekStart);
      lastWeekEnd.setMilliseconds(-1);

      // Get this week's activities
      const { data: thisWeekActivities, error: thisWeekError } = await supabase
        .from('customer_activities')
        .select('csm_id, type, customer_id')
        .gte('timestamp', thisWeekStart.toISOString());

      if (thisWeekError) throw thisWeekError;

      // Get last week's activities
      const { data: lastWeekActivities, error: lastWeekError } = await supabase
        .from('customer_activities')
        .select('csm_id, type, customer_id')
        .gte('timestamp', lastWeekStart.toISOString())
        .lt('timestamp', thisWeekStart.toISOString());

      if (lastWeekError) throw lastWeekError;

      // Get customer assignments per CSM
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id, owner_id');

      if (customersError) throw customersError;

      // Calculate productivity per CSM
      const csmStats: Record<string, {
        activities: number;
        customersTouched: Set<string>;
        byType: Record<ActivityType, number>;
        thisWeek: number;
        lastWeek: number;
        totalCustomers: number;
      }> = {};

      // Initialize CSM stats from customer assignments
      (customers || []).forEach((customer: any) => {
        const csmId = customer.owner_id || 'unassigned';
        if (!csmStats[csmId]) {
          csmStats[csmId] = {
            activities: 0,
            customersTouched: new Set(),
            byType: initializeByType(),
            thisWeek: 0,
            lastWeek: 0,
            totalCustomers: 0,
          };
        }
        csmStats[csmId].totalCustomers++;
      });

      // Process this week's activities
      (thisWeekActivities || []).forEach((activity: any) => {
        const csmId = activity.csm_id || 'unassigned';
        if (!csmStats[csmId]) {
          csmStats[csmId] = {
            activities: 0,
            customersTouched: new Set(),
            byType: initializeByType(),
            thisWeek: 0,
            lastWeek: 0,
            totalCustomers: 0,
          };
        }
        csmStats[csmId].activities++;
        csmStats[csmId].thisWeek++;
        csmStats[csmId].customersTouched.add(activity.customer_id);
        if (activity.type && csmStats[csmId].byType.hasOwnProperty(activity.type)) {
          csmStats[csmId].byType[activity.type as ActivityType]++;
        }
      });

      // Process last week's activities
      (lastWeekActivities || []).forEach((activity: any) => {
        const csmId = activity.csm_id || 'unassigned';
        if (csmStats[csmId]) {
          csmStats[csmId].lastWeek++;
        }
      });

      // Build productivity array
      const productivity: CSMProductivity[] = Object.entries(csmStats).map(([csmId, stats]) => ({
        csm_id: csmId,
        csm_name: csmId === 'unassigned' ? 'Unassigned' : csmId,
        total_activities: stats.activities,
        customers_touched: stats.customersTouched.size,
        total_customers: stats.totalCustomers,
        coverage_rate: stats.totalCustomers > 0
          ? Math.round((stats.customersTouched.size / stats.totalCustomers) * 100)
          : 0,
        by_type: stats.byType,
        avg_activities_per_customer: stats.customersTouched.size > 0
          ? Math.round((stats.activities / stats.customersTouched.size) * 10) / 10
          : 0,
        activities_this_week: stats.thisWeek,
        activities_last_week: stats.lastWeek,
        trend_change: stats.lastWeek > 0
          ? Math.round(((stats.thisWeek - stats.lastWeek) / stats.lastWeek) * 100)
          : stats.thisWeek > 0 ? 100 : 0,
      }));

      // Sort by total activities
      productivity.sort((a, b) => b.total_activities - a.total_activities);

      return productivity;
    } catch (error) {
      console.error('[ActivityFeedAnalysis] Error fetching CSM productivity:', error);
      return this.getMockCSMProductivity();
    }
  }

  /**
   * Get activity trends over time
   */
  async getActivityTrends(
    userId: string,
    days: number = 30
  ): Promise<ActivityTrendPoint[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    if (!supabase) {
      return this.getMockActivityTrends(days);
    }

    try {
      const { data: activities, error } = await supabase
        .from('customer_activities')
        .select('timestamp, type')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      // Group by date
      const trendsByDate: Record<string, { total: number; byType: Record<ActivityType, number> }> = {};

      // Initialize all dates
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        trendsByDate[dateKey] = { total: 0, byType: initializeByType() };
      }

      // Count activities
      (activities || []).forEach((activity: any) => {
        const dateKey = activity.timestamp.split('T')[0];
        if (trendsByDate[dateKey]) {
          trendsByDate[dateKey].total++;
          if (activity.type && trendsByDate[dateKey].byType.hasOwnProperty(activity.type)) {
            trendsByDate[dateKey].byType[activity.type as ActivityType]++;
          }
        }
      });

      return Object.entries(trendsByDate).map(([date, data]) => ({
        date,
        total: data.total,
        by_type: data.byType,
      }));
    } catch (error) {
      console.error('[ActivityFeedAnalysis] Error fetching trends:', error);
      return this.getMockActivityTrends(days);
    }
  }

  /**
   * Get recent activities
   */
  async getRecentActivities(
    userId: string,
    limit: number = 50,
    filters: ActivityFeedFilters = {}
  ): Promise<Activity[]> {
    if (!supabase) {
      return this.getMockRecentActivities(limit);
    }

    try {
      let query = supabase
        .from('customer_activities')
        .select(`
          id,
          type,
          customer_id,
          csm_id,
          timestamp,
          description,
          outcome,
          duration_minutes,
          participants,
          metadata,
          created_at,
          customers (id, name)
        `)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (filters.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }

      if (filters.csm_id) {
        query = query.eq('csm_id', filters.csm_id);
      }

      if (filters.activity_types && filters.activity_types.length > 0) {
        query = query.in('type', filters.activity_types);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((activity: any) => ({
        id: activity.id,
        type: activity.type,
        customer_id: activity.customer_id,
        customer_name: activity.customers?.name,
        csm_id: activity.csm_id,
        csm_name: activity.csm_id,
        timestamp: activity.timestamp,
        description: activity.description,
        outcome: activity.outcome,
        duration_minutes: activity.duration_minutes,
        participants: activity.participants,
        metadata: activity.metadata,
        created_at: activity.created_at,
      }));
    } catch (error) {
      console.error('[ActivityFeedAnalysis] Error fetching recent activities:', error);
      return this.getMockRecentActivities(limit);
    }
  }

  /**
   * Log a new activity
   */
  async logActivity(activity: Omit<Activity, 'id' | 'created_at'>): Promise<Activity | null> {
    if (!supabase) {
      console.log('[ActivityFeedAnalysis] No database, activity not persisted:', activity);
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('customer_activities')
        .insert({
          type: activity.type,
          customer_id: activity.customer_id,
          csm_id: activity.csm_id,
          timestamp: activity.timestamp,
          description: activity.description,
          outcome: activity.outcome,
          duration_minutes: activity.duration_minutes,
          participants: activity.participants || [],
          metadata: activity.metadata || {},
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('[ActivityFeedAnalysis] Error logging activity:', error);
      return null;
    }
  }

  /**
   * Get activity effectiveness analysis
   */
  async getActivityEffectiveness(userId: string): Promise<ActivityEffectiveness[]> {
    // This would require more complex analysis correlating activities with health score changes
    // For now, return mock data with recommendations
    return [
      {
        activity_type: 'meeting',
        total_count: 62,
        avg_health_impact: 3.2,
        correlated_health_improvements: 45,
        correlated_health_declines: 5,
        avg_response_rate: 0.92,
        recommended_frequency: 'Weekly for at-risk, bi-weekly for healthy',
      },
      {
        activity_type: 'email',
        total_count: 98,
        avg_health_impact: 1.5,
        correlated_health_improvements: 32,
        correlated_health_declines: 12,
        avg_response_rate: 0.68,
        recommended_frequency: '2-3 per week',
      },
      {
        activity_type: 'call',
        total_count: 35,
        avg_health_impact: 2.8,
        correlated_health_improvements: 28,
        correlated_health_declines: 3,
        avg_response_rate: 0.85,
        recommended_frequency: 'As needed, prioritize at-risk',
      },
      {
        activity_type: 'note',
        total_count: 43,
        avg_health_impact: 0.5,
        correlated_health_improvements: 15,
        correlated_health_declines: 8,
        avg_response_rate: 1.0,
        recommended_frequency: 'After every interaction',
      },
      {
        activity_type: 'task',
        total_count: 10,
        avg_health_impact: 0.8,
        correlated_health_improvements: 8,
        correlated_health_declines: 1,
        avg_response_rate: 0.95,
        recommended_frequency: 'Track all commitments',
      },
      {
        activity_type: 'document',
        total_count: 15,
        avg_health_impact: 1.2,
        correlated_health_improvements: 12,
        correlated_health_declines: 2,
        avg_response_rate: 0.75,
        recommended_frequency: 'Quarterly for QBRs and renewals',
      },
    ];
  }

  // ============================================
  // Mock Data Methods
  // ============================================

  private getMockActivityMetrics(period: string, startDate: Date, endDate: Date): ActivityMetrics {
    return {
      period,
      period_start: startDate.toISOString(),
      period_end: endDate.toISOString(),
      total_activities: 248,
      by_type: {
        email: 98,
        meeting: 62,
        call: 35,
        note: 43,
        task: 10,
        document: 0,
      },
      by_csm: {
        'csm-1': { name: 'Alex Chen', count: 85 },
        'csm-2': { name: 'Sarah Kim', count: 72 },
        'csm-3': { name: 'Mike Johnson', count: 91 },
      },
      avg_per_customer: 4.8,
      customers_with_activity: 47,
      customers_without_activity: 5,
      total_customers: 52,
    };
  }

  private getMockActivityGaps(thresholdDays: number): ActivityGap[] {
    return [
      {
        customer_id: 'gap-1',
        customer_name: 'DataFlow Inc',
        arr: 85000,
        health_color: 'yellow',
        days_since_activity: 12,
        last_activity_date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        last_activity_type: 'email',
        risk_level: 'medium',
        csm_id: 'csm-1',
        csm_name: 'Alex Chen',
      },
      {
        customer_id: 'gap-2',
        customer_name: 'CloudNine Systems',
        arr: 120000,
        health_color: 'red',
        days_since_activity: 8,
        last_activity_date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        last_activity_type: 'meeting',
        risk_level: 'low',
        csm_id: 'csm-2',
        csm_name: 'Sarah Kim',
      },
      {
        customer_id: 'gap-3',
        customer_name: 'TechVenture Corp',
        arr: 45000,
        health_color: 'yellow',
        days_since_activity: 21,
        last_activity_date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
        last_activity_type: 'call',
        risk_level: 'high',
        csm_id: 'csm-3',
        csm_name: 'Mike Johnson',
      },
      {
        customer_id: 'gap-4',
        customer_name: 'Innovate Labs',
        arr: 65000,
        health_color: 'green',
        days_since_activity: 15,
        last_activity_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        last_activity_type: 'email',
        risk_level: 'medium',
        csm_id: 'csm-1',
        csm_name: 'Alex Chen',
      },
      {
        customer_id: 'gap-5',
        customer_name: 'Global Solutions',
        arr: 200000,
        health_color: 'yellow',
        days_since_activity: 9,
        last_activity_date: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
        last_activity_type: 'meeting',
        risk_level: 'low',
        csm_id: 'csm-2',
        csm_name: 'Sarah Kim',
      },
    ].filter(gap => gap.days_since_activity >= thresholdDays);
  }

  private getMockCSMProductivity(): CSMProductivity[] {
    return [
      {
        csm_id: 'csm-1',
        csm_name: 'Alex Chen',
        total_activities: 85,
        customers_touched: 18,
        total_customers: 20,
        coverage_rate: 90,
        by_type: { email: 35, meeting: 22, call: 12, note: 14, task: 2, document: 0 },
        avg_activities_per_customer: 4.7,
        activities_this_week: 22,
        activities_last_week: 18,
        trend_change: 22,
      },
      {
        csm_id: 'csm-2',
        csm_name: 'Sarah Kim',
        total_activities: 72,
        customers_touched: 15,
        total_customers: 18,
        coverage_rate: 83,
        by_type: { email: 28, meeting: 18, call: 10, note: 12, task: 4, document: 0 },
        avg_activities_per_customer: 4.8,
        activities_this_week: 18,
        activities_last_week: 20,
        trend_change: -10,
      },
      {
        csm_id: 'csm-3',
        csm_name: 'Mike Johnson',
        total_activities: 91,
        customers_touched: 14,
        total_customers: 14,
        coverage_rate: 100,
        by_type: { email: 35, meeting: 22, call: 13, note: 17, task: 4, document: 0 },
        avg_activities_per_customer: 6.5,
        activities_this_week: 25,
        activities_last_week: 22,
        trend_change: 14,
      },
    ];
  }

  private getMockActivityTrends(days: number): ActivityTrendPoint[] {
    const trends: ActivityTrendPoint[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // Generate realistic-looking activity counts
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const baseTotal = isWeekend ? 3 : 12;
      const variance = Math.floor(Math.random() * 8) - 4;

      const total = Math.max(0, baseTotal + variance);
      const emailCount = Math.floor(total * 0.4);
      const meetingCount = Math.floor(total * 0.25);
      const callCount = Math.floor(total * 0.15);
      const noteCount = Math.floor(total * 0.15);
      const taskCount = total - emailCount - meetingCount - callCount - noteCount;

      trends.push({
        date: date.toISOString().split('T')[0],
        total,
        by_type: {
          email: emailCount,
          meeting: meetingCount,
          call: callCount,
          note: noteCount,
          task: Math.max(0, taskCount),
          document: 0,
        },
      });
    }

    return trends;
  }

  private getMockRecentActivities(limit: number): Activity[] {
    const activities: Activity[] = [];
    const types: ActivityType[] = ['email', 'meeting', 'call', 'note', 'task'];
    const customers = [
      { id: 'c1', name: 'Acme Corp' },
      { id: 'c2', name: 'TechStart Inc' },
      { id: 'c3', name: 'DataFlow Systems' },
      { id: 'c4', name: 'CloudNine Corp' },
      { id: 'c5', name: 'Innovate Labs' },
    ];
    const csms = [
      { id: 'csm-1', name: 'Alex Chen' },
      { id: 'csm-2', name: 'Sarah Kim' },
      { id: 'csm-3', name: 'Mike Johnson' },
    ];

    for (let i = 0; i < limit; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const csm = csms[Math.floor(Math.random() * csms.length)];
      const hoursAgo = Math.floor(Math.random() * 168); // Last week

      activities.push({
        id: `activity-${i}`,
        type,
        customer_id: customer.id,
        customer_name: customer.name,
        csm_id: csm.id,
        csm_name: csm.name,
        timestamp: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
        description: this.getActivityDescription(type, customer.name),
        created_at: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
      });
    }

    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return activities;
  }

  private getActivityDescription(type: ActivityType, customerName: string): string {
    const descriptions: Record<ActivityType, string[]> = {
      email: [
        `Follow-up on implementation progress with ${customerName}`,
        `Sent onboarding checklist to ${customerName}`,
        `Renewal discussion with ${customerName}`,
        `Feature request follow-up for ${customerName}`,
      ],
      meeting: [
        `Quarterly business review with ${customerName}`,
        `Kickoff meeting with ${customerName}`,
        `Training session for ${customerName}`,
        `Executive sync with ${customerName}`,
      ],
      call: [
        `Check-in call with ${customerName}`,
        `Support escalation call with ${customerName}`,
        `Renewal negotiation call with ${customerName}`,
      ],
      note: [
        `Internal notes on ${customerName} engagement`,
        `Risk assessment notes for ${customerName}`,
        `Champion identification for ${customerName}`,
      ],
      task: [
        `Prepare QBR materials for ${customerName}`,
        `Follow up on ${customerName} feature request`,
        `Schedule renewal meeting with ${customerName}`,
      ],
      document: [
        `Created success plan for ${customerName}`,
        `Generated QBR presentation for ${customerName}`,
        `Shared renewal proposal with ${customerName}`,
      ],
    };

    const options = descriptions[type];
    return options[Math.floor(Math.random() * options.length)];
  }
}

// Singleton instance
export const activityFeedAnalysisService = new ActivityFeedAnalysisService();
export default activityFeedAnalysisService;
