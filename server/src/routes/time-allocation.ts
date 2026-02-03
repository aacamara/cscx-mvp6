/**
 * Time Allocation Analysis API Routes
 * PRD-161: Time tracking and analysis for CSM productivity
 *
 * Provides endpoints for:
 * - Time allocation report
 * - CSM time detail
 * - Time entry logging
 * - Activity breakdown
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// TYPES
// ============================================

type ActivityType =
  | 'meeting'
  | 'email'
  | 'call'
  | 'internal_meeting'
  | 'admin'
  | 'documentation'
  | 'training'
  | 'research'
  | 'travel'
  | 'other';

type TimeEntrySource = 'calendar' | 'email' | 'manual' | 'system';

interface TimeEntry {
  id: string;
  csm_id: string;
  customer_id?: string;
  activity_type: ActivityType;
  description?: string;
  duration_minutes: number;
  date: string;
  source: TimeEntrySource;
  reference_id?: string;
}

interface ActivityBreakdown {
  type: ActivityType;
  label: string;
  hours: number;
  percentage: number;
  color: string;
  customer_facing: boolean;
}

interface CustomerTimeBreakdown {
  customer_id: string;
  customer_name: string;
  hours: number;
  arr: number;
  hours_per_10k_arr: number;
  efficiency_status: 'excellent' | 'normal' | 'high';
}

interface CSMTimeBreakdown {
  csm_id: string;
  csm_name: string;
  total_hours: number;
  customer_facing_pct: number;
  admin_pct: number;
  customer_count: number;
  arr_managed: number;
  arr_per_hour: number;
}

interface WeeklyTrend {
  week: string;
  week_label: string;
  total_hours: number;
  by_activity: { type: ActivityType; hours: number }[];
}

interface OptimizationSuggestion {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  impact: string;
  customer_id?: string;
  customer_name?: string;
  metric_value?: number;
  metric_label?: string;
}

// Activity configuration
const ACTIVITY_CONFIG: Record<ActivityType, {
  label: string;
  color: string;
  customerFacing: boolean;
}> = {
  meeting: { label: 'Customer Meetings', color: '#4ade80', customerFacing: true },
  email: { label: 'Email', color: '#60a5fa', customerFacing: true },
  call: { label: 'Calls', color: '#f472b6', customerFacing: true },
  internal_meeting: { label: 'Internal Meetings', color: '#a78bfa', customerFacing: false },
  admin: { label: 'Admin', color: '#fbbf24', customerFacing: false },
  documentation: { label: 'Documentation', color: '#34d399', customerFacing: false },
  training: { label: 'Training', color: '#f87171', customerFacing: false },
  research: { label: 'Research', color: '#fb923c', customerFacing: false },
  travel: { label: 'Travel', color: '#94a3b8', customerFacing: false },
  other: { label: 'Other', color: '#6b7280', customerFacing: false }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateEfficiencyStatus(hoursPerTenKArr: number): 'excellent' | 'normal' | 'high' {
  if (hoursPerTenKArr <= 1.5) return 'excellent';
  if (hoursPerTenKArr <= 3.0) return 'normal';
  return 'high';
}

function getDateRangeForPeriod(period: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = new Date(now);
  let startDate: Date;

  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), quarterMonth, 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return { startDate, endDate };
}

function getPeriodLabel(period: string): string {
  const { startDate, endDate } = getDateRangeForPeriod(period);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  switch (period) {
    case 'week':
      return `${monthNames[startDate.getMonth()]} ${startDate.getDate()} - ${monthNames[endDate.getMonth()]} ${endDate.getDate()}, ${endDate.getFullYear()}`;
    case 'month':
      return `${monthNames[startDate.getMonth()]} ${startDate.getFullYear()}`;
    case 'quarter':
      const quarter = Math.floor(startDate.getMonth() / 3) + 1;
      return `Q${quarter} ${startDate.getFullYear()}`;
    case 'year':
      return `${startDate.getFullYear()}`;
    default:
      return `${monthNames[startDate.getMonth()]} ${startDate.getFullYear()}`;
  }
}

function getWeekLabel(date: Date): string {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[date.getMonth()]} ${date.getDate()}`;
}

// Generate mock time entries for development
function generateMockTimeEntries(period: string): TimeEntry[] {
  const { startDate, endDate } = getDateRangeForPeriod(period);
  const entries: TimeEntry[] = [];
  const activityTypes: ActivityType[] = ['meeting', 'email', 'call', 'internal_meeting', 'admin', 'documentation', 'training', 'research'];
  const sources: TimeEntrySource[] = ['calendar', 'email', 'manual'];

  const mockCustomers = [
    { id: '1', name: 'Acme Corporation', arr: 120000 },
    { id: '2', name: 'TechStart Inc', arr: 65000 },
    { id: '3', name: 'GlobalTech Solutions', arr: 280000 },
    { id: '4', name: 'DataFlow Inc', arr: 95000 },
    { id: '5', name: 'CloudNine Systems', arr: 150000 }
  ];

  // Generate entries for each day
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    // Skip weekends
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Generate 4-8 entries per day
      const entriesPerDay = Math.floor(Math.random() * 5) + 4;
      for (let i = 0; i < entriesPerDay; i++) {
        const activityType = activityTypes[Math.floor(Math.random() * activityTypes.length)];
        const isCustomerFacing = ACTIVITY_CONFIG[activityType].customerFacing;
        const customer = isCustomerFacing ? mockCustomers[Math.floor(Math.random() * mockCustomers.length)] : undefined;

        entries.push({
          id: uuidv4(),
          csm_id: '1',
          customer_id: customer?.id,
          activity_type: activityType,
          description: `${ACTIVITY_CONFIG[activityType].label} activity`,
          duration_minutes: [15, 30, 45, 60, 90, 120][Math.floor(Math.random() * 6)],
          date: currentDate.toISOString().split('T')[0],
          source: sources[Math.floor(Math.random() * sources.length)],
          reference_id: undefined
        });
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return entries;
}

// Generate mock CSM data
function generateMockCSMs() {
  return [
    { id: '1', name: 'Sarah Chen', email: 'sarah.chen@company.com', customers: 15, arr: 1850000 },
    { id: '2', name: 'Mike Johnson', email: 'mike.johnson@company.com', customers: 12, arr: 1420000 },
    { id: '3', name: 'Lisa Wang', email: 'lisa.wang@company.com', customers: 14, arr: 2100000 },
    { id: '4', name: 'James Wilson', email: 'james.wilson@company.com', customers: 10, arr: 980000 },
    { id: '5', name: 'Emily Davis', email: 'emily.davis@company.com', customers: 18, arr: 2450000 }
  ];
}

// Generate mock customer data
function generateMockCustomers() {
  return [
    { id: '1', name: 'Acme Corporation', arr: 120000, segment: 'Enterprise' },
    { id: '2', name: 'TechStart Inc', arr: 65000, segment: 'SMB' },
    { id: '3', name: 'GlobalTech Solutions', arr: 280000, segment: 'Enterprise' },
    { id: '4', name: 'DataFlow Inc', arr: 95000, segment: 'Mid-Market' },
    { id: '5', name: 'CloudNine Systems', arr: 150000, segment: 'Mid-Market' },
    { id: '6', name: 'MegaCorp Industries', arr: 340000, segment: 'Enterprise' },
    { id: '7', name: 'StartupX', arr: 45000, segment: 'SMB' },
    { id: '8', name: 'Enterprise Plus', arr: 520000, segment: 'Enterprise' },
    { id: '9', name: 'SmallBiz Co', arr: 28000, segment: 'SMB' },
    { id: '10', name: 'Innovation Labs', arr: 175000, segment: 'Mid-Market' }
  ];
}

// Calculate activity breakdown from time entries
function calculateActivityBreakdown(entries: TimeEntry[]): ActivityBreakdown[] {
  const totals: Record<ActivityType, number> = {} as Record<ActivityType, number>;

  // Initialize all activity types
  Object.keys(ACTIVITY_CONFIG).forEach(type => {
    totals[type as ActivityType] = 0;
  });

  // Sum up duration by activity type
  entries.forEach(entry => {
    totals[entry.activity_type] = (totals[entry.activity_type] || 0) + entry.duration_minutes;
  });

  const totalMinutes = Object.values(totals).reduce((sum, val) => sum + val, 0);

  // Convert to breakdown format
  return Object.entries(totals)
    .map(([type, minutes]) => ({
      type: type as ActivityType,
      label: ACTIVITY_CONFIG[type as ActivityType].label,
      hours: Math.round((minutes / 60) * 10) / 10,
      percentage: totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0,
      color: ACTIVITY_CONFIG[type as ActivityType].color,
      customer_facing: ACTIVITY_CONFIG[type as ActivityType].customerFacing
    }))
    .filter(breakdown => breakdown.hours > 0)
    .sort((a, b) => b.hours - a.hours);
}

// Calculate customer time breakdown
function calculateCustomerBreakdown(entries: TimeEntry[], customers: any[]): CustomerTimeBreakdown[] {
  const customerTotals: Record<string, { minutes: number; activities: Record<ActivityType, number> }> = {};

  // Sum up time by customer
  entries.forEach(entry => {
    if (entry.customer_id) {
      if (!customerTotals[entry.customer_id]) {
        customerTotals[entry.customer_id] = { minutes: 0, activities: {} as Record<ActivityType, number> };
      }
      customerTotals[entry.customer_id].minutes += entry.duration_minutes;
      customerTotals[entry.customer_id].activities[entry.activity_type] =
        (customerTotals[entry.customer_id].activities[entry.activity_type] || 0) + entry.duration_minutes;
    }
  });

  // Convert to breakdown format
  return Object.entries(customerTotals)
    .map(([customerId, data]) => {
      const customer = customers.find(c => c.id === customerId) || { name: 'Unknown', arr: 0 };
      const hours = Math.round((data.minutes / 60) * 10) / 10;
      const arrInTenK = customer.arr / 10000;
      const hoursPerTenKArr = arrInTenK > 0 ? Math.round((hours / arrInTenK) * 10) / 10 : 0;

      return {
        customer_id: customerId,
        customer_name: customer.name,
        hours,
        arr: customer.arr,
        hours_per_10k_arr: hoursPerTenKArr,
        efficiency_status: calculateEfficiencyStatus(hoursPerTenKArr)
      };
    })
    .sort((a, b) => b.hours - a.hours);
}

// Calculate weekly trends
function calculateWeeklyTrends(entries: TimeEntry[]): WeeklyTrend[] {
  const weeklyData: Record<string, { date: Date; minutes: number; activities: Record<ActivityType, number> }> = {};

  entries.forEach(entry => {
    const date = new Date(entry.date);
    // Get Monday of the week
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    const weekKey = monday.toISOString().split('T')[0];

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { date: monday, minutes: 0, activities: {} as Record<ActivityType, number> };
    }
    weeklyData[weekKey].minutes += entry.duration_minutes;
    weeklyData[weekKey].activities[entry.activity_type] =
      (weeklyData[weekKey].activities[entry.activity_type] || 0) + entry.duration_minutes;
  });

  return Object.entries(weeklyData)
    .map(([week, data]) => ({
      week,
      week_label: getWeekLabel(data.date),
      total_hours: Math.round((data.minutes / 60) * 10) / 10,
      by_activity: Object.entries(data.activities)
        .map(([type, minutes]) => ({
          type: type as ActivityType,
          hours: Math.round((minutes / 60) * 10) / 10
        }))
        .filter(a => a.hours > 0)
    }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

// Generate optimization suggestions
function generateOptimizationSuggestions(
  activityBreakdown: ActivityBreakdown[],
  customerBreakdown: CustomerTimeBreakdown[],
  adminPct: number,
  customerFacingPct: number
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];

  // Check admin overhead
  if (adminPct > 15) {
    suggestions.push({
      id: uuidv4(),
      priority: adminPct > 20 ? 'high' : 'medium',
      category: 'admin_reduction',
      title: 'Admin overhead above target',
      description: `Admin time at ${adminPct}% exceeds the 15% target. Consider automating recurring tasks or delegating administrative work.`,
      impact: `Reducing admin time to target could free up ${Math.round((adminPct - 15) * 0.4)} hours per week for customer-facing activities.`,
      metric_value: adminPct,
      metric_label: 'Admin %'
    });
  }

  // Check customer-facing time
  if (customerFacingPct < 60) {
    suggestions.push({
      id: uuidv4(),
      priority: customerFacingPct < 50 ? 'high' : 'medium',
      category: 'time_balance',
      title: 'Customer-facing time below target',
      description: `Customer-facing time at ${customerFacingPct}% is below the 60% target. Review internal meeting frequency and prioritize customer engagements.`,
      impact: `Increasing customer-facing time to 60% could improve customer relationships and reduce churn risk.`,
      metric_value: customerFacingPct,
      metric_label: 'Customer-Facing %'
    });
  }

  // Check high time-consuming customers
  const inefficientCustomers = customerBreakdown.filter(c => c.efficiency_status === 'high');
  inefficientCustomers.slice(0, 3).forEach(customer => {
    suggestions.push({
      id: uuidv4(),
      priority: customer.hours_per_10k_arr > 5 ? 'high' : 'medium',
      category: 'customer_efficiency',
      title: `High time investment: ${customer.customer_name}`,
      description: `${customer.hours_per_10k_arr} hours per $10K ARR is significantly above average. Review engagement model for this customer.`,
      impact: `Optimizing time with this customer could save ${Math.round(customer.hours * 0.3)} hours per month.`,
      customer_id: customer.customer_id,
      customer_name: customer.customer_name,
      metric_value: customer.hours_per_10k_arr,
      metric_label: 'Hrs/$10K ARR'
    });
  });

  // Check internal meetings
  const internalMeetings = activityBreakdown.find(a => a.type === 'internal_meeting');
  if (internalMeetings && internalMeetings.percentage > 15) {
    suggestions.push({
      id: uuidv4(),
      priority: 'low',
      category: 'time_balance',
      title: 'High internal meeting load',
      description: `Internal meetings consume ${internalMeetings.percentage}% of time. Consider reducing meeting frequency or duration.`,
      impact: `Reducing internal meetings by 25% could free up ${Math.round(internalMeetings.hours * 0.25)} hours.`,
      metric_value: internalMeetings.percentage,
      metric_label: 'Internal Mtg %'
    });
  }

  return suggestions;
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/reports/time-allocation
 * Get time allocation report with breakdown by activity, CSM, and customer
 *
 * Query params:
 * - csm_id: Filter by CSM
 * - team_id: Filter by team
 * - period: 'week' | 'month' | 'quarter' | 'year'
 * - start_date: Custom start date
 * - end_date: Custom end date
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      csm_id,
      team_id,
      period = 'month'
    } = req.query;

    // Get mock data (in production, fetch from database)
    const entries = generateMockTimeEntries(period as string);
    const csms = generateMockCSMs();
    const customers = generateMockCustomers();

    // Calculate activity breakdown
    const activityBreakdown = calculateActivityBreakdown(entries);

    // Calculate totals
    const totalMinutes = entries.reduce((sum, e) => sum + e.duration_minutes, 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    // Calculate customer-facing vs admin percentages
    const customerFacingMinutes = entries
      .filter(e => ACTIVITY_CONFIG[e.activity_type].customerFacing)
      .reduce((sum, e) => sum + e.duration_minutes, 0);
    const adminMinutes = entries
      .filter(e => e.activity_type === 'admin')
      .reduce((sum, e) => sum + e.duration_minutes, 0);
    const internalMinutes = entries
      .filter(e => e.activity_type === 'internal_meeting')
      .reduce((sum, e) => sum + e.duration_minutes, 0);

    const customerFacingPct = totalMinutes > 0 ? Math.round((customerFacingMinutes / totalMinutes) * 100) : 0;
    const adminPct = totalMinutes > 0 ? Math.round((adminMinutes / totalMinutes) * 100) : 0;
    const internalPct = totalMinutes > 0 ? Math.round((internalMinutes / totalMinutes) * 100) : 0;

    // Calculate customer breakdown
    const customerBreakdown = calculateCustomerBreakdown(entries, customers);

    // Calculate total ARR from customers with time entries
    const customerIds = new Set(entries.filter(e => e.customer_id).map(e => e.customer_id));
    const totalArr = customers
      .filter(c => customerIds.has(c.id))
      .reduce((sum, c) => sum + c.arr, 0);
    const avgHoursPerTenKArr = totalArr > 0 ? Math.round((totalHours / (totalArr / 10000)) * 10) / 10 : 0;

    // Calculate CSM breakdown (mock for now - single CSM)
    const csmBreakdown: CSMTimeBreakdown[] = csms.slice(0, 3).map((csm, index) => {
      const csmMultiplier = 0.8 + Math.random() * 0.4;
      const csmHours = Math.round(totalHours * csmMultiplier);
      const csmCustomerFacing = Math.round(55 + Math.random() * 20);
      const csmAdmin = Math.round(10 + Math.random() * 10);

      return {
        csm_id: csm.id,
        csm_name: csm.name,
        total_hours: csmHours,
        customer_facing_pct: csmCustomerFacing,
        admin_pct: csmAdmin,
        customer_count: csm.customers,
        arr_managed: csm.arr,
        arr_per_hour: Math.round(csm.arr / csmHours)
      };
    });

    // Calculate weekly trends
    const weeklyTrends = calculateWeeklyTrends(entries);

    // Generate optimization suggestions
    const recommendations = generateOptimizationSuggestions(
      activityBreakdown,
      customerBreakdown,
      adminPct,
      customerFacingPct
    );

    // Build summary
    const summary = {
      period: period as string,
      period_label: getPeriodLabel(period as string),
      total_hours: totalHours,
      total_csms: csms.length,
      customer_facing_pct: customerFacingPct,
      customer_facing_vs_target: customerFacingPct - 60,
      admin_pct: adminPct,
      admin_vs_target: adminPct - 15,
      internal_pct: internalPct,
      avg_hours_per_10k_arr: avgHoursPerTenKArr,
      tracking_completeness: 92 // Mock - would be calculated from expected vs actual hours
    };

    res.json({
      summary,
      by_activity: activityBreakdown,
      by_csm: csmBreakdown,
      by_customer: customerBreakdown,
      trends: weeklyTrends,
      recommendations
    });
  } catch (error) {
    console.error('Time allocation error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch time allocation data' }
    });
  }
});

/**
 * GET /api/reports/time-allocation/:csmId
 * Get detailed time allocation for a specific CSM
 */
router.get('/:csmId', async (req: Request, res: Response) => {
  try {
    const { csmId } = req.params;
    const { period = 'month' } = req.query;

    // Get mock data
    const csms = generateMockCSMs();
    const csm = csms.find(c => c.id === csmId) || csms[0];
    const entries = generateMockTimeEntries(period as string);
    const customers = generateMockCustomers();

    // Calculate breakdowns
    const activityBreakdown = calculateActivityBreakdown(entries);
    const customerBreakdown = calculateCustomerBreakdown(entries, customers);
    const weeklyTrends = calculateWeeklyTrends(entries);

    // Calculate totals for recommendations
    const totalMinutes = entries.reduce((sum, e) => sum + e.duration_minutes, 0);
    const customerFacingMinutes = entries
      .filter(e => ACTIVITY_CONFIG[e.activity_type].customerFacing)
      .reduce((sum, e) => sum + e.duration_minutes, 0);
    const adminMinutes = entries
      .filter(e => e.activity_type === 'admin')
      .reduce((sum, e) => sum + e.duration_minutes, 0);

    const customerFacingPct = totalMinutes > 0 ? Math.round((customerFacingMinutes / totalMinutes) * 100) : 0;
    const adminPct = totalMinutes > 0 ? Math.round((adminMinutes / totalMinutes) * 100) : 0;

    const recommendations = generateOptimizationSuggestions(
      activityBreakdown,
      customerBreakdown,
      adminPct,
      customerFacingPct
    );

    res.json({
      csm: {
        id: csm.id,
        name: csm.name,
        email: csm.email,
        customer_count: csm.customers,
        arr_managed: csm.arr
      },
      period: period as string,
      total_hours: Math.round((totalMinutes / 60) * 10) / 10,
      by_activity: activityBreakdown,
      by_customer: customerBreakdown,
      weekly_trends: weeklyTrends,
      recommendations
    });
  } catch (error) {
    console.error('CSM time detail error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch CSM time detail' }
    });
  }
});

/**
 * POST /api/time-entries
 * Log a new time entry
 */
router.post('/entries', async (req: Request, res: Response) => {
  try {
    const { activity_type, customer_id, duration_minutes, date, description } = req.body;

    // Validate required fields
    if (!activity_type || !duration_minutes || !date) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'activity_type, duration_minutes, and date are required' }
      });
    }

    // Validate activity type
    if (!ACTIVITY_CONFIG[activity_type as ActivityType]) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid activity_type' }
      });
    }

    const entry: TimeEntry = {
      id: uuidv4(),
      csm_id: '1', // In production, get from auth
      customer_id,
      activity_type,
      description,
      duration_minutes,
      date,
      source: 'manual',
      reference_id: undefined
    };

    // In production, save to database
    if (supabase) {
      const { data, error } = await supabase
        .from('time_entries')
        .insert([{
          id: entry.id,
          csm_id: entry.csm_id,
          customer_id: entry.customer_id,
          activity_type: entry.activity_type,
          description: entry.description,
          duration_minutes: entry.duration_minutes,
          date: entry.date,
          source: entry.source,
          reference_id: entry.reference_id
        }])
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }

      return res.status(201).json(data);
    }

    // Return mock response
    res.status(201).json({
      ...entry,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Create time entry error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create time entry' }
    });
  }
});

/**
 * GET /api/time-entries
 * Get time entries with filters
 */
router.get('/entries', async (req: Request, res: Response) => {
  try {
    const {
      csm_id,
      customer_id,
      activity_type,
      source,
      start_date,
      end_date,
      limit = 50,
      offset = 0
    } = req.query;

    // Generate mock entries
    const allEntries = generateMockTimeEntries('month');

    // Apply filters
    let filteredEntries = allEntries;

    if (customer_id) {
      filteredEntries = filteredEntries.filter(e => e.customer_id === customer_id);
    }
    if (activity_type) {
      filteredEntries = filteredEntries.filter(e => e.activity_type === activity_type);
    }
    if (source) {
      filteredEntries = filteredEntries.filter(e => e.source === source);
    }
    if (start_date) {
      filteredEntries = filteredEntries.filter(e => e.date >= (start_date as string));
    }
    if (end_date) {
      filteredEntries = filteredEntries.filter(e => e.date <= (end_date as string));
    }

    // Sort by date descending
    filteredEntries.sort((a, b) => b.date.localeCompare(a.date));

    // Paginate
    const paginatedEntries = filteredEntries.slice(
      Number(offset),
      Number(offset) + Number(limit)
    );

    res.json({
      entries: paginatedEntries.map(e => ({
        ...e,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })),
      total: filteredEntries.length,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    console.error('Get time entries error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch time entries' }
    });
  }
});

/**
 * DELETE /api/time-entries/:entryId
 * Delete a time entry
 */
router.delete('/entries/:entryId', async (req: Request, res: Response) => {
  try {
    const { entryId } = req.params;

    // In production, delete from database
    if (supabase) {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', entryId);

      if (error) {
        console.error('Supabase delete error:', error);
        throw error;
      }
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete time entry error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete time entry' }
    });
  }
});

export { router as timeAllocationRoutes };
