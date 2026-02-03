/**
 * Seasonal Activity Types (PRD-115)
 *
 * Types for seasonal review alerts including QBRs, annual planning,
 * budget cycles, and customer-specific periodic activities.
 */

// ============================================
// Core Enums and Types
// ============================================

export type ActivityType =
  | 'qbr'
  | 'annual_planning'
  | 'budget_cycle_checkin'
  | 'year_end_review'
  | 'fiscal_year_planning'
  | 'seasonal_usage_review'
  | 'custom';

export type ActivityStatus = 'pending' | 'scheduled' | 'completed' | 'skipped' | 'overdue';

export type QBRCadence = 'quarterly' | 'bi-annual' | 'annual';

export type FiscalYearStartMonth = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

// ============================================
// Activity Type Configuration
// ============================================

export const ACTIVITY_TYPE_CONFIG: Record<ActivityType, {
  label: string;
  description: string;
  icon: string;
  defaultLeadTimeDays: number;
  requiresScheduling: boolean;
  templates: string[];
}> = {
  qbr: {
    label: 'Quarterly Business Review',
    description: 'Strategic review of progress, metrics, and roadmap alignment',
    icon: ':bar_chart:',
    defaultLeadTimeDays: 21,
    requiresScheduling: true,
    templates: ['qbr_presentation', 'qbr_metrics_sheet', 'qbr_agenda'],
  },
  annual_planning: {
    label: 'Annual Account Planning',
    description: 'Comprehensive annual strategy and goal setting session',
    icon: ':calendar:',
    defaultLeadTimeDays: 30,
    requiresScheduling: true,
    templates: ['annual_plan_doc', 'success_plan'],
  },
  budget_cycle_checkin: {
    label: 'Budget Cycle Check-in',
    description: 'Align with customer budget planning timeline',
    icon: ':moneybag:',
    defaultLeadTimeDays: 14,
    requiresScheduling: false,
    templates: ['value_summary'],
  },
  year_end_review: {
    label: 'Year-End Review',
    description: 'Annual accomplishments and value delivered summary',
    icon: ':trophy:',
    defaultLeadTimeDays: 14,
    requiresScheduling: true,
    templates: ['year_end_summary', 'roi_report'],
  },
  fiscal_year_planning: {
    label: 'Fiscal Year Planning',
    description: 'Customer-specific fiscal year alignment',
    icon: ':date:',
    defaultLeadTimeDays: 30,
    requiresScheduling: true,
    templates: ['fiscal_alignment_doc'],
  },
  seasonal_usage_review: {
    label: 'Seasonal Usage Review',
    description: 'Analyze usage patterns during key business periods',
    icon: ':chart_with_upwards_trend:',
    defaultLeadTimeDays: 7,
    requiresScheduling: false,
    templates: ['usage_analysis'],
  },
  custom: {
    label: 'Custom Activity',
    description: 'User-defined seasonal activity',
    icon: ':pencil:',
    defaultLeadTimeDays: 14,
    requiresScheduling: false,
    templates: [],
  },
};

// ============================================
// Status Configuration
// ============================================

export const STATUS_CONFIG: Record<ActivityStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}> = {
  pending: {
    label: 'Pending',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/30',
    icon: ':yellow_circle:',
  },
  scheduled: {
    label: 'Scheduled',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    icon: ':large_blue_circle:',
  },
  completed: {
    label: 'Completed',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
    icon: ':green_circle:',
  },
  skipped: {
    label: 'Skipped',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500/30',
    icon: ':white_circle:',
  },
  overdue: {
    label: 'Overdue',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    icon: ':red_circle:',
  },
};

// ============================================
// Preparation Checklist Item
// ============================================

export interface PrepChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
}

// ============================================
// Seasonal Activity
// ============================================

export interface SeasonalActivity {
  id: string;
  customerId: string;
  customerName?: string;
  activityType: ActivityType;
  period: string; // Q1_2026, FY2026, etc.
  dueDate: string;
  scheduledDate?: string;
  completedDate?: string;
  status: ActivityStatus;
  notes?: string;
  prepChecklist?: PrepChecklistItem[];
  linkedDocuments?: Array<{
    type: string;
    id: string;
    url: string;
    name: string;
  }>;
  linkedMeeting?: {
    id: string;
    title: string;
    scheduledAt: string;
    attendees: string[];
  };
  previousActivityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Customer Calendar Settings
// ============================================

export interface CustomerCalendarSettings {
  customerId: string;
  fiscalYearStartMonth: FiscalYearStartMonth;
  qbrCadence: QBRCadence;
  customCycles?: Array<{
    name: string;
    frequency: 'monthly' | 'quarterly' | 'annual';
    startMonth: number;
  }>;
  preferredMeetingDays?: number[]; // 0-6 (Sunday-Saturday)
  blackoutPeriods?: Array<{
    start: string;
    end: string;
    reason: string;
  }>;
}

// ============================================
// Activity Alert
// ============================================

export interface SeasonalActivityAlert {
  id: string;
  activityId: string;
  activity: SeasonalActivity;
  customer: {
    id: string;
    name: string;
    arr: number;
    healthScore: number;
    segment?: string;
    tier?: string;
  };
  daysUntilDue: number;
  alertPriority: 'low' | 'medium' | 'high' | 'urgent';
  recommendedActions: string[];
  templatesReady: string[];
}

// ============================================
// Portfolio Summary
// ============================================

export interface SeasonalActivitySummary {
  totalAccounts: number;
  scheduled: number;
  completed: number;
  needsAttention: number;
  overdue: number;
  byActivityType: Record<ActivityType, {
    total: number;
    scheduled: number;
    completed: number;
    pending: number;
  }>;
  upcomingDeadlines: Array<{
    activityId: string;
    customerId: string;
    customerName: string;
    activityType: ActivityType;
    dueDate: string;
    daysUntil: number;
    status: ActivityStatus;
  }>;
}

// ============================================
// Filter Types
// ============================================

export type PeriodFilter = 'current_quarter' | 'next_quarter' | 'current_fy' | 'next_fy' | 'custom';
export type StatusFilter = 'all' | 'pending' | 'scheduled' | 'needs_attention' | 'completed';

export interface SeasonalActivityFilters {
  period: PeriodFilter;
  customPeriodStart?: string;
  customPeriodEnd?: string;
  activityTypes?: ActivityType[];
  statusFilter: StatusFilter;
  csmId?: string;
  segment?: string;
  tier?: string;
  search?: string;
  sortBy?: 'due_date' | 'arr' | 'customer_name' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export const DEFAULT_FILTERS: SeasonalActivityFilters = {
  period: 'current_quarter',
  statusFilter: 'all',
  sortBy: 'due_date',
  sortOrder: 'asc',
};

// ============================================
// API Request/Response Types
// ============================================

export interface CreateSeasonalActivityRequest {
  customerId: string;
  activityType: ActivityType;
  period: string;
  dueDate: string;
  notes?: string;
}

export interface UpdateSeasonalActivityRequest {
  status?: ActivityStatus;
  scheduledDate?: string;
  notes?: string;
  prepChecklist?: PrepChecklistItem[];
}

export interface BulkScheduleRequest {
  activityIds: string[];
  scheduledDate: string;
}

export interface SeasonalActivityAPIResponse {
  success: boolean;
  data: SeasonalActivity;
  meta: {
    responseTimeMs: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface SeasonalActivityListAPIResponse {
  success: boolean;
  data: {
    activities: SeasonalActivity[];
    summary: SeasonalActivitySummary;
  };
  meta: {
    total: number;
    page: number;
    limit: number;
    responseTimeMs: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface SeasonalAlertListAPIResponse {
  success: boolean;
  data: {
    alerts: SeasonalActivityAlert[];
    summary: SeasonalActivitySummary;
  };
  meta: {
    total: number;
    responseTimeMs: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

// ============================================
// Period Utilities
// ============================================

/**
 * Get current quarter period string (e.g., Q1_2026)
 */
export function getCurrentQuarterPeriod(): string {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `Q${quarter}_${now.getFullYear()}`;
}

/**
 * Get next quarter period string
 */
export function getNextQuarterPeriod(): string {
  const now = new Date();
  let quarter = Math.floor(now.getMonth() / 3) + 2;
  let year = now.getFullYear();
  if (quarter > 4) {
    quarter = 1;
    year++;
  }
  return `Q${quarter}_${year}`;
}

/**
 * Get fiscal year period string based on start month
 */
export function getFiscalYearPeriod(startMonth: FiscalYearStartMonth): string {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  let fiscalYear = now.getFullYear();
  if (currentMonth < startMonth) {
    fiscalYear--;
  }
  return `FY${fiscalYear}`;
}

/**
 * Parse period string to date range
 */
export function parsePeriodToDateRange(period: string): { start: Date; end: Date } {
  const quarterMatch = period.match(/Q([1-4])_(\d{4})/);
  if (quarterMatch) {
    const quarter = parseInt(quarterMatch[1]);
    const year = parseInt(quarterMatch[2]);
    const startMonth = (quarter - 1) * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0);
    return { start, end };
  }

  const fyMatch = period.match(/FY(\d{4})/);
  if (fyMatch) {
    const year = parseInt(fyMatch[1]);
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    return { start, end };
  }

  // Default to current month
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  };
}

/**
 * Calculate alert priority based on days until due and activity type
 */
export function calculateAlertPriority(
  daysUntilDue: number,
  activityType: ActivityType,
  customerArr: number
): 'low' | 'medium' | 'high' | 'urgent' {
  // Urgent: overdue or due within 3 days
  if (daysUntilDue <= 3) return 'urgent';

  // High: due within a week or high-value customer
  if (daysUntilDue <= 7 || customerArr >= 500000) return 'high';

  // Medium: due within lead time
  const leadTime = ACTIVITY_TYPE_CONFIG[activityType].defaultLeadTimeDays;
  if (daysUntilDue <= leadTime) return 'medium';

  return 'low';
}

/**
 * Get default preparation checklist for activity type
 */
export function getDefaultPrepChecklist(activityType: ActivityType): PrepChecklistItem[] {
  const checklists: Record<ActivityType, PrepChecklistItem[]> = {
    qbr: [
      { id: 'qbr_1', title: 'Update health score dashboard', completed: false },
      { id: 'qbr_2', title: 'Compile usage metrics', completed: false },
      { id: 'qbr_3', title: 'Prepare ROI summary', completed: false },
      { id: 'qbr_4', title: 'Draft agenda', completed: false },
      { id: 'qbr_5', title: 'Identify discussion topics', completed: false },
      { id: 'qbr_6', title: 'Review previous QBR notes', completed: false },
    ],
    annual_planning: [
      { id: 'ap_1', title: 'Review current year achievements', completed: false },
      { id: 'ap_2', title: 'Document customer goals for next year', completed: false },
      { id: 'ap_3', title: 'Prepare success plan draft', completed: false },
      { id: 'ap_4', title: 'Identify expansion opportunities', completed: false },
      { id: 'ap_5', title: 'Schedule stakeholder alignment calls', completed: false },
    ],
    budget_cycle_checkin: [
      { id: 'bc_1', title: 'Prepare value summary', completed: false },
      { id: 'bc_2', title: 'Document ROI metrics', completed: false },
      { id: 'bc_3', title: 'Identify renewal timeline', completed: false },
    ],
    year_end_review: [
      { id: 'yer_1', title: 'Compile annual metrics', completed: false },
      { id: 'yer_2', title: 'Document key achievements', completed: false },
      { id: 'yer_3', title: 'Prepare executive summary', completed: false },
      { id: 'yer_4', title: 'Gather customer testimonials', completed: false },
    ],
    fiscal_year_planning: [
      { id: 'fyp_1', title: 'Understand customer fiscal timeline', completed: false },
      { id: 'fyp_2', title: 'Prepare budget justification', completed: false },
      { id: 'fyp_3', title: 'Document projected value', completed: false },
    ],
    seasonal_usage_review: [
      { id: 'sur_1', title: 'Analyze usage patterns', completed: false },
      { id: 'sur_2', title: 'Compare to baseline', completed: false },
      { id: 'sur_3', title: 'Identify optimization opportunities', completed: false },
    ],
    custom: [],
  };

  return checklists[activityType].map(item => ({ ...item }));
}
