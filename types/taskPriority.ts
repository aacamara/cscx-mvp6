/**
 * Task Prioritization Types (PRD-214)
 *
 * Intelligent task prioritization based on:
 * - Account health, ARR, renewal proximity
 * - Task type and urgency
 * - Risk signals and sentiment
 */

// ============================================
// Priority Score Types
// ============================================

export type PriorityCategory = 'critical' | 'high' | 'medium' | 'low';

export type TaskType =
  | 'escalation'
  | 'churn_prevention'
  | 'renewal_prep'
  | 'executive_meeting'
  | 'at_risk_outreach'
  | 'qbr_prep'
  | 'check_in'
  | 'documentation'
  | 'administrative'
  | 'follow_up'
  | 'training'
  | 'other';

export type SentimentTrend = 'improving' | 'stable' | 'declining';

// ============================================
// Priority Factors
// ============================================

export interface PriorityFactors {
  // Account factors
  accountHealth: number;      // 0-100 (inverted: low health = high priority)
  accountARR: number;         // Normalized to 0-100
  renewalProximity: number;   // Days until renewal (closer = higher)
  activeRiskSignals: number;  // Count of unresolved signals

  // Task factors
  taskType: TaskType;
  dueDate: Date | null;
  isOverdue: boolean;
  hasBlockers: boolean;

  // Context factors
  recentInteraction: Date | null;    // Days since last touch
  sentimentTrend: SentimentTrend;
}

export interface PriorityFactorsBreakdown {
  health_impact: number;
  arr_impact: number;
  renewal_impact: number;
  risk_impact: number;
  type_impact: number;
  overdue_impact: number;
  sentiment_impact: number;
}

// ============================================
// Priority Score
// ============================================

export interface PriorityScore {
  score: number;              // 0-100
  category: PriorityCategory;
  explanation: string;
  factors: PriorityFactorsBreakdown;
}

// ============================================
// Prioritized Task
// ============================================

export interface PrioritizedTask {
  id: string;
  title: string;
  description?: string;
  customer_id: string;
  customer_name: string;
  due_date: string | null;
  task_type: TaskType;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  created_at: string;
  updated_at: string;

  // Priority data
  priority: PriorityScore;

  // Customer context
  customer_arr?: number;
  customer_health_score?: number;
  renewal_date?: string;
  days_until_renewal?: number;
  risk_signals_count?: number;

  // Manual override
  manual_override?: {
    score: number;
    reason: string;
    overridden_by: string;
    overridden_at: string;
  };
}

// ============================================
// API Response Types
// ============================================

export interface PrioritizedTasksResponse {
  tasks: PrioritizedTask[];
  recommendations: string[];
  summary: {
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
    total_tasks: number;
    overdue_count: number;
  };
  calculated_at: string;
}

export interface WhatNextRecommendation {
  task: PrioritizedTask;
  reasoning: string;
}

export interface WhatNextResponse {
  top_priorities: WhatNextRecommendation[];
  daily_focus: string;
  time_allocation: {
    critical: string;
    high: string;
    medium: string;
    low: string;
  };
  generated_at: string;
}

// ============================================
// Priority Override
// ============================================

export interface PriorityOverrideRequest {
  task_id: string;
  manual_priority: number;
  reason: string;
}

export interface PriorityOverrideResponse {
  success: boolean;
  task: PrioritizedTask;
}

// ============================================
// Task Type Configuration
// ============================================

export const TASK_TYPE_MULTIPLIERS: Record<TaskType, number> = {
  escalation: 1.5,
  churn_prevention: 1.4,
  renewal_prep: 1.3,
  executive_meeting: 1.25,
  at_risk_outreach: 1.2,
  qbr_prep: 1.1,
  check_in: 1.0,
  documentation: 0.9,
  follow_up: 0.85,
  training: 0.8,
  administrative: 0.7,
  other: 0.8,
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  escalation: 'Escalation',
  churn_prevention: 'Churn Prevention',
  renewal_prep: 'Renewal Prep',
  executive_meeting: 'Executive Meeting',
  at_risk_outreach: 'At-Risk Outreach',
  qbr_prep: 'QBR Prep',
  check_in: 'Check-In',
  documentation: 'Documentation',
  follow_up: 'Follow-Up',
  training: 'Training',
  administrative: 'Administrative',
  other: 'Other',
};

export const PRIORITY_CATEGORY_COLORS: Record<PriorityCategory, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'green',
};

// ============================================
// Priority Thresholds
// ============================================

export const PRIORITY_THRESHOLDS = {
  critical: 90,  // 90-100
  high: 70,      // 70-89
  medium: 40,    // 40-69
  low: 0,        // 0-39
};

/**
 * Get priority category from score
 */
export function getPriorityCategory(score: number): PriorityCategory {
  if (score >= PRIORITY_THRESHOLDS.critical) return 'critical';
  if (score >= PRIORITY_THRESHOLDS.high) return 'high';
  if (score >= PRIORITY_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/**
 * Get category color class
 */
export function getCategoryColorClass(category: PriorityCategory): string {
  switch (category) {
    case 'critical':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'high':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'medium':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'low':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
  }
}

/**
 * Get category indicator dot
 */
export function getCategoryIndicator(category: PriorityCategory): string {
  switch (category) {
    case 'critical':
      return 'bg-red-500';
    case 'high':
      return 'bg-orange-500';
    case 'medium':
      return 'bg-yellow-500';
    case 'low':
      return 'bg-green-500';
  }
}
