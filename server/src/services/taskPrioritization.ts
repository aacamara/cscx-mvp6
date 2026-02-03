/**
 * Task Prioritization Service (PRD-214)
 *
 * Intelligent task prioritization algorithm that calculates priority scores
 * based on account health, ARR, renewal proximity, task type, and risk signals.
 *
 * Priority Score Range: 0-100
 * - Critical (90-100): Active escalations, churn-prevention actions
 * - High (70-89): At-risk outreach, renewal prep, executive meetings
 * - Medium (40-69): Regular check-ins, QBR prep, documentation
 * - Low (0-39): Administrative, optional follow-ups
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Types
// ============================================

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
export type PriorityCategory = 'critical' | 'high' | 'medium' | 'low';

export interface PriorityFactors {
  accountHealth: number;
  accountARR: number;
  renewalProximity: number;
  activeRiskSignals: number;
  taskType: TaskType;
  dueDate: Date | null;
  isOverdue: boolean;
  hasBlockers: boolean;
  recentInteraction: Date | null;
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

export interface PriorityScore {
  score: number;
  category: PriorityCategory;
  explanation: string;
  factors: PriorityFactorsBreakdown;
}

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
  priority: PriorityScore;
  customer_arr?: number;
  customer_health_score?: number;
  renewal_date?: string;
  days_until_renewal?: number;
  risk_signals_count?: number;
  manual_override?: {
    score: number;
    reason: string;
    overridden_by: string;
    overridden_at: string;
  };
}

export interface WhatNextRecommendation {
  task: PrioritizedTask;
  reasoning: string;
}

// ============================================
// Task Type Multipliers
// ============================================

const TASK_TYPE_MULTIPLIERS: Record<TaskType, number> = {
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

// ============================================
// Priority Category Thresholds
// ============================================

const PRIORITY_THRESHOLDS = {
  critical: 90,
  high: 70,
  medium: 40,
  low: 0,
};

// ============================================
// ARR Normalization (for scoring)
// ============================================

// Max ARR for normalization (accounts above this get max score)
const MAX_ARR_FOR_NORMALIZATION = 500000;

/**
 * Normalize ARR to a 0-100 scale
 */
function normalizeARR(arr: number): number {
  return Math.min(100, Math.round((arr / MAX_ARR_FOR_NORMALIZATION) * 100));
}

// ============================================
// Priority Calculation
// ============================================

/**
 * Calculate priority score for a task based on multiple factors
 */
export function calculatePriority(factors: PriorityFactors): PriorityScore {
  let score = 50; // Base score
  const breakdown: PriorityFactorsBreakdown = {
    health_impact: 0,
    arr_impact: 0,
    renewal_impact: 0,
    risk_impact: 0,
    type_impact: 0,
    overdue_impact: 0,
    sentiment_impact: 0,
  };

  // Account health impact (up to +30)
  // Lower health = higher priority
  const healthImpact = Math.round((100 - factors.accountHealth) * 0.3);
  score += healthImpact;
  breakdown.health_impact = healthImpact;

  // ARR impact (up to +15)
  const arrImpact = Math.round(factors.accountARR * 0.15);
  score += arrImpact;
  breakdown.arr_impact = arrImpact;

  // Renewal proximity impact (up to +20 for < 30 days, +10 for < 90 days)
  let renewalImpact = 0;
  if (factors.renewalProximity > 0 && factors.renewalProximity < 30) {
    renewalImpact = Math.round(20 * (1 - factors.renewalProximity / 30));
  } else if (factors.renewalProximity >= 30 && factors.renewalProximity < 90) {
    renewalImpact = Math.round(10 * (1 - (factors.renewalProximity - 30) / 60));
  }
  score += renewalImpact;
  breakdown.renewal_impact = renewalImpact;

  // Risk signals impact (up to +15, 5 per signal, max 3 signals counted)
  const riskImpact = Math.min(factors.activeRiskSignals * 5, 15);
  score += riskImpact;
  breakdown.risk_impact = riskImpact;

  // Apply task type multiplier
  const multiplier = TASK_TYPE_MULTIPLIERS[factors.taskType] || 1.0;
  const preMultiplierScore = score;
  score = Math.round(score * multiplier);
  breakdown.type_impact = score - preMultiplierScore;

  // Overdue penalty/boost (+15)
  if (factors.isOverdue) {
    score += 15;
    breakdown.overdue_impact = 15;
  }

  // Declining sentiment boost (+10)
  if (factors.sentimentTrend === 'declining') {
    score += 10;
    breakdown.sentiment_impact = 10;
  } else if (factors.sentimentTrend === 'improving') {
    score -= 5;
    breakdown.sentiment_impact = -5;
  }

  // Clamp score to 0-100
  score = Math.min(Math.max(score, 0), 100);

  // Determine category
  const category = categorizeScore(score);

  // Generate explanation
  const explanation = generateExplanation(factors, breakdown, score);

  return {
    score,
    category,
    explanation,
    factors: breakdown,
  };
}

/**
 * Categorize score into priority level
 */
function categorizeScore(score: number): PriorityCategory {
  if (score >= PRIORITY_THRESHOLDS.critical) return 'critical';
  if (score >= PRIORITY_THRESHOLDS.high) return 'high';
  if (score >= PRIORITY_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/**
 * Generate human-readable explanation for priority score
 */
function generateExplanation(
  factors: PriorityFactors,
  breakdown: PriorityFactorsBreakdown,
  score: number
): string {
  const reasons: string[] = [];

  // Health reason
  if (factors.accountHealth < 50) {
    reasons.push(`Health score at ${factors.accountHealth}`);
  } else if (factors.accountHealth < 70) {
    reasons.push(`Health score ${factors.accountHealth}`);
  }

  // ARR reason
  if (factors.accountARR >= 80) {
    const arrValue = Math.round((factors.accountARR / 100) * MAX_ARR_FOR_NORMALIZATION);
    reasons.push(`$${(arrValue / 1000).toFixed(0)}K ARR account`);
  }

  // Renewal reason
  if (factors.renewalProximity > 0 && factors.renewalProximity < 30) {
    reasons.push(`Renewal in ${factors.renewalProximity} days`);
  } else if (factors.renewalProximity >= 30 && factors.renewalProximity < 60) {
    reasons.push(`Renewal in ${factors.renewalProximity} days`);
  }

  // Risk signals
  if (factors.activeRiskSignals > 0) {
    reasons.push(`${factors.activeRiskSignals} active risk signal${factors.activeRiskSignals > 1 ? 's' : ''}`);
  }

  // Overdue
  if (factors.isOverdue) {
    reasons.push('Task is overdue');
  }

  // Sentiment
  if (factors.sentimentTrend === 'declining') {
    reasons.push('Declining sentiment trend');
  }

  // Task type for critical tasks
  if (factors.taskType === 'escalation') {
    reasons.unshift('Active escalation');
  } else if (factors.taskType === 'churn_prevention') {
    reasons.unshift('Churn prevention action');
  }

  if (reasons.length === 0) {
    return 'Standard priority task';
  }

  return `Priority ${score}: ${reasons.join(', ')}`;
}

// ============================================
// Task Fetching & Prioritization
// ============================================

/**
 * Fetch and prioritize all tasks for a user
 */
export async function getPrioritizedTasks(
  userId: string,
  options: {
    customerId?: string;
    includeCompleted?: boolean;
    limit?: number;
  } = {}
): Promise<{
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
}> {
  const { customerId, includeCompleted = false, limit = 50 } = options;

  // Get tasks from database or mock data
  const rawTasks = await fetchTasks(userId, customerId, includeCompleted, limit);

  // Get customer data for context
  const customerIds = [...new Set(rawTasks.map((t) => t.customer_id))];
  const customers = await fetchCustomers(customerIds);
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  // Get risk signals for customers
  const riskSignals = await fetchRiskSignals(customerIds);
  const riskSignalMap = new Map(riskSignals);

  // Calculate priorities for each task
  const prioritizedTasks: PrioritizedTask[] = [];

  for (const task of rawTasks) {
    const customer = customerMap.get(task.customer_id);
    const riskSignalCount = riskSignalMap.get(task.customer_id) || 0;

    // Calculate days until renewal
    let daysUntilRenewal = 0;
    if (customer?.renewal_date) {
      const renewalDate = new Date(customer.renewal_date);
      daysUntilRenewal = Math.max(0, Math.floor((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    }

    // Check if overdue
    let isOverdue = false;
    if (task.due_date) {
      const dueDate = new Date(task.due_date);
      isOverdue = dueDate < new Date();
    }

    // Build priority factors
    const factors: PriorityFactors = {
      accountHealth: customer?.health_score || 70,
      accountARR: normalizeARR(customer?.arr || 0),
      renewalProximity: daysUntilRenewal,
      activeRiskSignals: riskSignalCount,
      taskType: mapTaskType(task.task_type),
      dueDate: task.due_date ? new Date(task.due_date) : null,
      isOverdue,
      hasBlockers: task.status === 'blocked',
      recentInteraction: customer?.last_interaction ? new Date(customer.last_interaction) : null,
      sentimentTrend: customer?.sentiment_trend || 'stable',
    };

    // Calculate priority
    const priority = calculatePriority(factors);

    // Check for manual override
    const override = await getManualOverride(task.id);
    if (override) {
      priority.score = override.score;
      priority.category = categorizeScore(override.score);
      priority.explanation = `Manual override: ${override.reason}`;
    }

    prioritizedTasks.push({
      id: task.id,
      title: task.title,
      description: task.description,
      customer_id: task.customer_id,
      customer_name: customer?.name || 'Unknown Customer',
      due_date: task.due_date,
      task_type: mapTaskType(task.task_type),
      status: task.status,
      created_at: task.created_at,
      updated_at: task.updated_at,
      priority,
      customer_arr: customer?.arr,
      customer_health_score: customer?.health_score,
      renewal_date: customer?.renewal_date,
      days_until_renewal: daysUntilRenewal,
      risk_signals_count: riskSignalCount,
      manual_override: override
        ? {
            score: override.score,
            reason: override.reason,
            overridden_by: override.overridden_by,
            overridden_at: override.overridden_at,
          }
        : undefined,
    });
  }

  // Sort by priority score (descending)
  prioritizedTasks.sort((a, b) => b.priority.score - a.priority.score);

  // Generate recommendations
  const recommendations = generateRecommendations(prioritizedTasks);

  // Calculate summary
  const summary = {
    critical_count: prioritizedTasks.filter((t) => t.priority.category === 'critical').length,
    high_count: prioritizedTasks.filter((t) => t.priority.category === 'high').length,
    medium_count: prioritizedTasks.filter((t) => t.priority.category === 'medium').length,
    low_count: prioritizedTasks.filter((t) => t.priority.category === 'low').length,
    total_tasks: prioritizedTasks.length,
    overdue_count: prioritizedTasks.filter((t) => t.due_date && new Date(t.due_date) < new Date()).length,
  };

  return { tasks: prioritizedTasks, recommendations, summary };
}

/**
 * Generate "What should I work on next?" recommendations
 */
export async function getWhatNext(
  userId: string,
  maxRecommendations: number = 5
): Promise<{
  top_priorities: WhatNextRecommendation[];
  daily_focus: string;
  time_allocation: {
    critical: string;
    high: string;
    medium: string;
    low: string;
  };
}> {
  // Get prioritized tasks
  const { tasks, summary } = await getPrioritizedTasks(userId, {
    includeCompleted: false,
    limit: 50,
  });

  // Get top N tasks
  const topTasks = tasks.slice(0, maxRecommendations);

  // Generate reasoning for each
  const top_priorities: WhatNextRecommendation[] = topTasks.map((task) => ({
    task,
    reasoning: generateDetailedReasoning(task),
  }));

  // Generate daily focus message
  const daily_focus = generateDailyFocus(summary, topTasks);

  // Calculate time allocation based on task distribution
  const time_allocation = calculateTimeAllocation(summary);

  return {
    top_priorities,
    daily_focus,
    time_allocation,
  };
}

/**
 * Recalculate priority for a specific task
 */
export async function recalculatePriority(taskId: string): Promise<PrioritizedTask | null> {
  if (!supabase) {
    console.warn('Supabase not configured, cannot recalculate priority');
    return null;
  }

  // Fetch the task
  const { data: task, error: taskError } = await supabase
    .from('plan_tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (taskError || !task) {
    console.error('Task not found:', taskId);
    return null;
  }

  // Fetch customer data
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', task.customer_id)
    .single();

  // Fetch risk signals
  const { count: riskCount } = await supabase
    .from('risk_signals')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', task.customer_id)
    .eq('resolved', false);

  // Calculate priority (same logic as getPrioritizedTasks)
  let daysUntilRenewal = 0;
  if (customer?.renewal_date) {
    const renewalDate = new Date(customer.renewal_date);
    daysUntilRenewal = Math.max(0, Math.floor((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  let isOverdue = false;
  if (task.due_date) {
    const dueDate = new Date(task.due_date);
    isOverdue = dueDate < new Date();
  }

  const factors: PriorityFactors = {
    accountHealth: customer?.health_score || 70,
    accountARR: normalizeARR(customer?.arr || 0),
    renewalProximity: daysUntilRenewal,
    activeRiskSignals: riskCount || 0,
    taskType: mapTaskType(task.task_type),
    dueDate: task.due_date ? new Date(task.due_date) : null,
    isOverdue,
    hasBlockers: task.status === 'blocked',
    recentInteraction: customer?.last_interaction ? new Date(customer.last_interaction) : null,
    sentimentTrend: (customer?.sentiment_trend as SentimentTrend) || 'stable',
  };

  const priority = calculatePriority(factors);

  // Save to task_priorities table
  await supabase.from('task_priorities').upsert({
    task_id: taskId,
    score: priority.score,
    category: priority.category,
    factors: priority.factors,
    explanation: priority.explanation,
    calculated_at: new Date().toISOString(),
  });

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    customer_id: task.customer_id,
    customer_name: customer?.name || 'Unknown Customer',
    due_date: task.due_date,
    task_type: mapTaskType(task.task_type),
    status: task.status,
    created_at: task.created_at,
    updated_at: task.updated_at,
    priority,
    customer_arr: customer?.arr,
    customer_health_score: customer?.health_score,
    renewal_date: customer?.renewal_date,
    days_until_renewal: daysUntilRenewal,
    risk_signals_count: riskCount || 0,
  };
}

/**
 * Set manual priority override
 */
export async function setManualOverride(
  taskId: string,
  score: number,
  reason: string,
  userId: string
): Promise<boolean> {
  if (!supabase) {
    console.warn('Supabase not configured');
    return false;
  }

  const { error } = await supabase.from('task_priorities').upsert({
    task_id: taskId,
    manual_override: score,
    override_reason: reason,
    override_by: userId,
    updated_at: new Date().toISOString(),
  });

  return !error;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Fetch tasks from database or return mock data
 */
async function fetchTasks(
  userId: string,
  customerId?: string,
  includeCompleted = false,
  limit = 50
): Promise<any[]> {
  if (supabase) {
    let query = supabase
      .from('plan_tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (!includeCompleted) {
      query = query.neq('status', 'completed');
    }

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      return data;
    }
  }

  // Return mock data for demo
  return generateMockTasks(limit);
}

/**
 * Fetch customers by IDs
 */
async function fetchCustomers(customerIds: string[]): Promise<any[]> {
  if (!supabase || customerIds.length === 0) {
    return generateMockCustomers();
  }

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .in('id', customerIds);

  if (!error && data) {
    return data;
  }

  return generateMockCustomers();
}

/**
 * Fetch risk signals count per customer
 */
async function fetchRiskSignals(customerIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();

  if (!supabase || customerIds.length === 0) {
    // Mock data
    customerIds.forEach((id, i) => map.set(id, i % 3));
    return map;
  }

  const { data, error } = await supabase
    .from('risk_signals')
    .select('customer_id')
    .in('customer_id', customerIds)
    .eq('resolved', false);

  if (!error && data) {
    data.forEach((signal) => {
      const count = map.get(signal.customer_id) || 0;
      map.set(signal.customer_id, count + 1);
    });
  }

  return map;
}

/**
 * Get manual override for a task
 */
async function getManualOverride(taskId: string): Promise<{
  score: number;
  reason: string;
  overridden_by: string;
  overridden_at: string;
} | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('task_priorities')
    .select('manual_override, override_reason, override_by, updated_at')
    .eq('task_id', taskId)
    .single();

  if (error || !data || data.manual_override === null) {
    return null;
  }

  return {
    score: data.manual_override,
    reason: data.override_reason || 'No reason provided',
    overridden_by: data.override_by || 'unknown',
    overridden_at: data.updated_at,
  };
}

/**
 * Map task type string to TaskType enum
 */
function mapTaskType(taskType: string | null): TaskType {
  const typeMap: Record<string, TaskType> = {
    escalation: 'escalation',
    churn_prevention: 'churn_prevention',
    renewal_prep: 'renewal_prep',
    executive_meeting: 'executive_meeting',
    at_risk_outreach: 'at_risk_outreach',
    qbr_prep: 'qbr_prep',
    check_in: 'check_in',
    documentation: 'documentation',
    administrative: 'administrative',
    follow_up: 'follow_up',
    training: 'training',
    'check-in': 'check_in',
    'qbr-prep': 'qbr_prep',
    'follow-up': 'follow_up',
  };

  return typeMap[taskType?.toLowerCase() || ''] || 'other';
}

/**
 * Generate recommendations based on task distribution
 */
function generateRecommendations(tasks: PrioritizedTask[]): string[] {
  const recommendations: string[] = [];

  // Check for critical tasks
  const criticalTasks = tasks.filter((t) => t.priority.category === 'critical');
  if (criticalTasks.length > 0) {
    const topCritical = criticalTasks[0];
    recommendations.push(
      `Focus on ${topCritical.customer_name} today - ${criticalTasks.length === 1 ? 'critical task requires attention' : `${criticalTasks.length} critical tasks require attention`}`
    );
  }

  // Check for at-risk accounts
  const atRiskTasks = tasks.filter((t) => t.customer_health_score && t.customer_health_score < 50);
  if (atRiskTasks.length > 0 && atRiskTasks.length <= 3) {
    const names = [...new Set(atRiskTasks.map((t) => t.customer_name))].slice(0, 3);
    recommendations.push(`${names.join(', ')} ${names.length === 1 ? 'needs' : 'need'} immediate attention - health scores below 50`);
  }

  // Check for upcoming renewals
  const renewalTasks = tasks.filter((t) => t.days_until_renewal && t.days_until_renewal < 30);
  if (renewalTasks.length > 0) {
    recommendations.push(
      `${renewalTasks.length} task${renewalTasks.length === 1 ? '' : 's'} related to accounts with renewals in the next 30 days`
    );
  }

  // Check for overdue tasks
  const overdueTasks = tasks.filter((t) => t.due_date && new Date(t.due_date) < new Date());
  if (overdueTasks.length > 0) {
    recommendations.push(
      `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? '' : 's'} - consider rescheduling or delegating`
    );
  }

  // Low priority suggestion
  const lowTasks = tasks.filter((t) => t.priority.category === 'low');
  if (lowTasks.length > 5) {
    recommendations.push(`Consider delegating routine check-ins to focus on high-priority accounts`);
  }

  return recommendations.slice(0, 5);
}

/**
 * Generate detailed reasoning for a task recommendation
 */
function generateDetailedReasoning(task: PrioritizedTask): string {
  const parts: string[] = [];

  // Start with customer name
  parts.push(`${task.customer_name} requires attention.`);

  // Health score
  if (task.customer_health_score !== undefined && task.customer_health_score < 60) {
    parts.push(
      `Their health score ${task.customer_health_score < 40 ? 'dropped to' : 'is at'} ${task.customer_health_score}.`
    );
  }

  // ARR context
  if (task.customer_arr && task.customer_arr >= 100000) {
    parts.push(`This is a $${(task.customer_arr / 1000).toFixed(0)}K ARR account.`);
  }

  // Renewal context
  if (task.days_until_renewal !== undefined && task.days_until_renewal < 60) {
    parts.push(`Renewal is in ${task.days_until_renewal} days.`);
  }

  // Risk signals
  if (task.risk_signals_count && task.risk_signals_count > 0) {
    parts.push(`There ${task.risk_signals_count === 1 ? 'is' : 'are'} ${task.risk_signals_count} active risk signal${task.risk_signals_count === 1 ? '' : 's'}.`);
  }

  // Task type specific
  if (task.task_type === 'escalation') {
    parts.push('This escalation needs immediate resolution.');
  } else if (task.task_type === 'churn_prevention') {
    parts.push('Proactive outreach could prevent churn.');
  }

  return parts.join(' ');
}

/**
 * Generate daily focus message
 */
function generateDailyFocus(
  summary: {
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
    total_tasks: number;
    overdue_count: number;
  },
  topTasks: PrioritizedTask[]
): string {
  if (summary.critical_count > 0) {
    return `Today your priority should be ${summary.critical_count} critical task${summary.critical_count === 1 ? '' : 's'}. ${topTasks[0]?.customer_name || 'Your top account'} needs immediate attention.`;
  }

  if (summary.high_count > 2) {
    return `You have ${summary.high_count} high-priority tasks today. Focus on at-risk accounts and upcoming renewals.`;
  }

  if (summary.overdue_count > 0) {
    return `Clear ${summary.overdue_count} overdue task${summary.overdue_count === 1 ? '' : 's'} first, then focus on proactive outreach.`;
  }

  return `Good day ahead! ${summary.total_tasks} tasks to review - focus on high-value accounts for maximum impact.`;
}

/**
 * Calculate recommended time allocation
 */
function calculateTimeAllocation(summary: {
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
}): { critical: string; high: string; medium: string; low: string } {
  const totalMinutes = 480; // 8-hour day

  // Weight by priority
  const criticalWeight = summary.critical_count * 4;
  const highWeight = summary.high_count * 2;
  const mediumWeight = summary.medium_count * 1;
  const lowWeight = summary.low_count * 0.5;
  const totalWeight = criticalWeight + highWeight + mediumWeight + lowWeight || 1;

  const criticalMins = Math.round((criticalWeight / totalWeight) * totalMinutes);
  const highMins = Math.round((highWeight / totalWeight) * totalMinutes);
  const mediumMins = Math.round((mediumWeight / totalWeight) * totalMinutes);
  const lowMins = Math.round((lowWeight / totalWeight) * totalMinutes);

  const formatTime = (mins: number) => {
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      if (remainingMins === 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
      return `${hours}-${hours + 1} hours`;
    }
    return `${mins} minutes`;
  };

  return {
    critical: summary.critical_count > 0 ? formatTime(criticalMins) : 'None needed',
    high: summary.high_count > 0 ? formatTime(highMins) : 'None needed',
    medium: summary.medium_count > 0 ? formatTime(mediumMins) : 'None needed',
    low: summary.low_count > 0 ? formatTime(lowMins) : 'None needed',
  };
}

// ============================================
// Mock Data Generators
// ============================================

function generateMockTasks(limit: number): any[] {
  const mockCustomers = generateMockCustomers();
  const taskTypes = [
    'escalation',
    'churn_prevention',
    'renewal_prep',
    'check_in',
    'qbr_prep',
    'follow_up',
    'documentation',
    'administrative',
  ];
  const statuses = ['pending', 'in_progress', 'blocked'];

  const tasks = [];
  const now = new Date();

  for (let i = 0; i < Math.min(limit, 15); i++) {
    const customer = mockCustomers[i % mockCustomers.length];
    const daysOffset = Math.floor(Math.random() * 14) - 5; // -5 to +9 days from now
    const dueDate = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000);

    tasks.push({
      id: `task-${i + 1}`,
      title: getMockTaskTitle(taskTypes[i % taskTypes.length], customer.name),
      description: `Task for ${customer.name}`,
      customer_id: customer.id,
      task_type: taskTypes[i % taskTypes.length],
      status: statuses[i % statuses.length],
      due_date: dueDate.toISOString(),
      created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: now.toISOString(),
    });
  }

  return tasks;
}

function generateMockCustomers(): any[] {
  return [
    {
      id: 'cust-1',
      name: 'TechCorp Industries',
      arr: 250000,
      health_score: 35,
      renewal_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      sentiment_trend: 'declining',
      last_interaction: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'cust-2',
      name: 'GlobalCo',
      arr: 180000,
      health_score: 72,
      renewal_date: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
      sentiment_trend: 'stable',
      last_interaction: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'cust-3',
      name: 'Acme Corp',
      arr: 120000,
      health_score: 85,
      renewal_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      sentiment_trend: 'improving',
      last_interaction: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'cust-4',
      name: 'StartupXYZ',
      arr: 45000,
      health_score: 42,
      renewal_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      sentiment_trend: 'declining',
      last_interaction: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'cust-5',
      name: 'Enterprise Ltd',
      arr: 350000,
      health_score: 78,
      renewal_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      sentiment_trend: 'stable',
      last_interaction: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

function getMockTaskTitle(taskType: string, customerName: string): string {
  const titles: Record<string, string> = {
    escalation: `Respond to ${customerName} escalation`,
    churn_prevention: `Call ${customerName} about usage drop`,
    renewal_prep: `Prepare renewal proposal for ${customerName}`,
    check_in: `Monthly check-in with ${customerName}`,
    qbr_prep: `Prepare QBR materials for ${customerName}`,
    follow_up: `Follow up on ${customerName} feature request`,
    documentation: `Update ${customerName} success plan`,
    administrative: `Update CRM notes for ${customerName}`,
    executive_meeting: `Executive review with ${customerName}`,
    at_risk_outreach: `Proactive outreach to ${customerName}`,
  };

  return titles[taskType] || `Task for ${customerName}`;
}

// Export service functions
export const taskPrioritizationService = {
  calculatePriority,
  getPrioritizedTasks,
  getWhatNext,
  recalculatePriority,
  setManualOverride,
};

export default taskPrioritizationService;
