/**
 * Account Success Metrics API Routes
 * PRD-069: Account Success Metrics for Account Intelligence
 *
 * Provides endpoints for:
 * - Success metrics overview for a customer
 * - Individual goal details
 * - Goal CRUD operations
 * - Metric updates
 * - Value/ROI reports
 * - Benchmark comparisons
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

const router = Router();

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// TYPES
// ============================================

type MetricCategory = 'operational' | 'financial' | 'quality' | 'adoption' | 'satisfaction';
type MetricDirection = 'higher_is_better' | 'lower_is_better';
type MetricStatus = 'exceeding' | 'on_track' | 'at_risk' | 'not_met';
type GoalStatus = 'not_started' | 'in_progress' | 'achieved' | 'at_risk';

interface SuccessMetric {
  id: string;
  customerId: string;
  goalId: string;
  category: MetricCategory;
  name: string;
  description: string;
  baseline: number;
  target: number;
  current: number;
  unit: string;
  direction: MetricDirection;
  dataSource: string;
  measuredAt: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  status: MetricStatus;
  progressPercent: number;
}

interface SuccessGoal {
  id: string;
  customerId: string;
  title: string;
  description: string;
  metrics: SuccessMetric[];
  owner: string;
  ownerTitle?: string;
  targetDate: string;
  status: GoalStatus;
  weight: number;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
}

interface ValueItem {
  category: string;
  description: string;
  annualValue: number;
  confidence: 'high' | 'medium' | 'low';
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate progress percentage based on baseline, target, and current values
 */
function calculateProgress(
  baseline: number,
  target: number,
  current: number,
  direction: MetricDirection
): number {
  const totalChange = target - baseline;
  if (totalChange === 0) return current >= target ? 100 : 0;

  const currentChange = current - baseline;
  let progress = (currentChange / totalChange) * 100;

  // For lower_is_better, we flip the direction of improvement
  if (direction === 'lower_is_better') {
    // Check if we're going in the right direction
    if (totalChange > 0) {
      // Target is higher than baseline but we want lower - shouldn't happen
      progress = 0;
    }
  }

  // Cap at 0-200% (allow exceeding but not going negative)
  return Math.max(0, Math.min(200, Math.round(progress)));
}

/**
 * Determine metric status based on progress percentage
 */
function determineMetricStatus(progressPercent: number): MetricStatus {
  if (progressPercent >= 100) return 'exceeding';
  if (progressPercent >= 75) return 'on_track';
  if (progressPercent >= 50) return 'at_risk';
  return 'not_met';
}

/**
 * Determine goal status based on metric statuses
 */
function determineGoalStatus(metrics: SuccessMetric[]): GoalStatus {
  if (metrics.length === 0) return 'not_started';

  const avgProgress = metrics.reduce((sum, m) => sum + m.progressPercent, 0) / metrics.length;

  if (avgProgress >= 100) return 'achieved';
  if (avgProgress >= 75) return 'in_progress';
  return 'at_risk';
}

/**
 * Calculate overall success score from goals
 */
function calculateSuccessScore(goals: SuccessGoal[]): number {
  if (goals.length === 0) return 0;

  const totalWeight = goals.reduce((sum, g) => sum + g.weight, 0);
  if (totalWeight === 0) return 0;

  const weightedScore = goals.reduce((sum, g) => {
    return sum + (g.progressPercent * g.weight);
  }, 0);

  return Math.round(weightedScore / totalWeight);
}

/**
 * Get success score label
 */
function getSuccessScoreLabel(score: number): 'exceptional' | 'strong' | 'on_track' | 'needs_attention' | 'at_risk' {
  if (score >= 90) return 'exceptional';
  if (score >= 75) return 'strong';
  if (score >= 60) return 'on_track';
  if (score >= 40) return 'needs_attention';
  return 'at_risk';
}

/**
 * Generate mock goals for a customer
 */
function generateMockGoals(customerId: string, customerName: string): SuccessGoal[] {
  const now = new Date();
  const goals: SuccessGoal[] = [];

  // Goal 1: Reduce Reporting Time
  const goal1Metrics: SuccessMetric[] = [
    {
      id: `${customerId}-m1`,
      customerId,
      goalId: `${customerId}-g1`,
      category: 'operational',
      name: 'Time to create report',
      description: 'Average time to generate standard reports',
      baseline: 4,
      target: 2,
      current: 1.2,
      unit: 'hours',
      direction: 'lower_is_better',
      dataSource: 'Product Analytics',
      measuredAt: now.toISOString(),
      frequency: 'weekly',
      status: 'exceeding',
      progressPercent: 140
    },
    {
      id: `${customerId}-m2`,
      customerId,
      goalId: `${customerId}-g1`,
      category: 'operational',
      name: 'Reports created per week',
      description: 'Number of reports generated weekly',
      baseline: 10,
      target: 25,
      current: 35,
      unit: 'count',
      direction: 'higher_is_better',
      dataSource: 'Product Analytics',
      measuredAt: now.toISOString(),
      frequency: 'weekly',
      status: 'exceeding',
      progressPercent: 167
    },
    {
      id: `${customerId}-m3`,
      customerId,
      goalId: `${customerId}-g1`,
      category: 'operational',
      name: 'Manual steps eliminated',
      description: 'Process steps automated',
      baseline: 0,
      target: 15,
      current: 18,
      unit: 'count',
      direction: 'higher_is_better',
      dataSource: 'Workflow Analysis',
      measuredAt: now.toISOString(),
      frequency: 'monthly',
      status: 'exceeding',
      progressPercent: 120
    }
  ];

  goals.push({
    id: `${customerId}-g1`,
    customerId,
    title: 'Reduce Reporting Time',
    description: 'Streamline report generation to save time and improve efficiency',
    metrics: goal1Metrics,
    owner: 'Sarah Chen',
    ownerTitle: 'VP Operations',
    targetDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'achieved',
    weight: 0.25,
    progressPercent: Math.round(goal1Metrics.reduce((s, m) => s + m.progressPercent, 0) / goal1Metrics.length),
    createdAt: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: now.toISOString()
  });

  // Goal 2: Improve Data Accuracy
  const goal2Metrics: SuccessMetric[] = [
    {
      id: `${customerId}-m4`,
      customerId,
      goalId: `${customerId}-g2`,
      category: 'quality',
      name: 'Data error rate',
      description: 'Percentage of records with errors',
      baseline: 12,
      target: 2,
      current: 3.8,
      unit: 'percent',
      direction: 'lower_is_better',
      dataSource: 'Quality Audits',
      measuredAt: now.toISOString(),
      frequency: 'weekly',
      status: 'on_track',
      progressPercent: 82
    },
    {
      id: `${customerId}-m5`,
      customerId,
      goalId: `${customerId}-g2`,
      category: 'quality',
      name: 'Manual corrections per week',
      description: 'Number of manual data fixes needed',
      baseline: 45,
      target: 5,
      current: 8,
      unit: 'count',
      direction: 'lower_is_better',
      dataSource: 'Support Logs',
      measuredAt: now.toISOString(),
      frequency: 'weekly',
      status: 'on_track',
      progressPercent: 93
    },
    {
      id: `${customerId}-m6`,
      customerId,
      goalId: `${customerId}-g2`,
      category: 'quality',
      name: 'Audit findings per quarter',
      description: 'Issues identified in quarterly audits',
      baseline: 15,
      target: 3,
      current: 4,
      unit: 'count',
      direction: 'lower_is_better',
      dataSource: 'Audit Reports',
      measuredAt: now.toISOString(),
      frequency: 'quarterly',
      status: 'on_track',
      progressPercent: 92
    }
  ];

  goals.push({
    id: `${customerId}-g2`,
    customerId,
    title: 'Improve Data Accuracy',
    description: 'Reduce data errors and improve data quality across systems',
    metrics: goal2Metrics,
    owner: 'Mike Lee',
    ownerTitle: 'Director Analytics',
    targetDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'in_progress',
    weight: 0.25,
    progressPercent: Math.round(goal2Metrics.reduce((s, m) => s + m.progressPercent, 0) / goal2Metrics.length),
    createdAt: new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: now.toISOString()
  });

  // Goal 3: Increase Team Efficiency (At Risk)
  const goal3Metrics: SuccessMetric[] = [
    {
      id: `${customerId}-m7`,
      customerId,
      goalId: `${customerId}-g3`,
      category: 'adoption',
      name: 'Tasks per person per day',
      description: 'Average task completion rate',
      baseline: 15,
      target: 25,
      current: 18,
      unit: 'count',
      direction: 'higher_is_better',
      dataSource: 'Product Analytics',
      measuredAt: now.toISOString(),
      frequency: 'daily',
      status: 'at_risk',
      progressPercent: 30
    },
    {
      id: `${customerId}-m8`,
      customerId,
      goalId: `${customerId}-g3`,
      category: 'adoption',
      name: 'System adoption rate',
      description: 'Percentage of team actively using system',
      baseline: 40,
      target: 90,
      current: 65,
      unit: 'percent',
      direction: 'higher_is_better',
      dataSource: 'Usage Analytics',
      measuredAt: now.toISOString(),
      frequency: 'weekly',
      status: 'at_risk',
      progressPercent: 50
    },
    {
      id: `${customerId}-m9`,
      customerId,
      goalId: `${customerId}-g3`,
      category: 'adoption',
      name: 'Workflows automated',
      description: 'Number of processes automated',
      baseline: 0,
      target: 10,
      current: 4,
      unit: 'count',
      direction: 'higher_is_better',
      dataSource: 'Platform Config',
      measuredAt: now.toISOString(),
      frequency: 'monthly',
      status: 'at_risk',
      progressPercent: 40
    }
  ];

  goals.push({
    id: `${customerId}-g3`,
    customerId,
    title: 'Increase Team Efficiency',
    description: 'Boost productivity through better adoption and automation',
    metrics: goal3Metrics,
    owner: 'Bob Smith',
    ownerTitle: 'Manager',
    targetDate: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'at_risk',
    weight: 0.2,
    progressPercent: Math.round(goal3Metrics.reduce((s, m) => s + m.progressPercent, 0) / goal3Metrics.length),
    createdAt: new Date(now.getTime() - 80 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: now.toISOString()
  });

  // Goal 4: Enable Self-Service
  const goal4Metrics: SuccessMetric[] = [
    {
      id: `${customerId}-m10`,
      customerId,
      goalId: `${customerId}-g4`,
      category: 'adoption',
      name: 'Self-service rate',
      description: 'Percentage of queries resolved without support',
      baseline: 50,
      target: 90,
      current: 88,
      unit: 'percent',
      direction: 'higher_is_better',
      dataSource: 'Support Analytics',
      measuredAt: now.toISOString(),
      frequency: 'weekly',
      status: 'on_track',
      progressPercent: 95
    }
  ];

  goals.push({
    id: `${customerId}-g4`,
    customerId,
    title: 'Enable Self-Service',
    description: 'Reduce dependency on support by enabling user self-service',
    metrics: goal4Metrics,
    owner: 'Sarah Chen',
    ownerTitle: 'VP Operations',
    targetDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'in_progress',
    weight: 0.15,
    progressPercent: 95,
    createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: now.toISOString()
  });

  // Goal 5: Consolidate Tools
  const goal5Metrics: SuccessMetric[] = [
    {
      id: `${customerId}-m11`,
      customerId,
      goalId: `${customerId}-g5`,
      category: 'financial',
      name: 'Tools retired',
      description: 'Legacy tools decommissioned',
      baseline: 0,
      target: 3,
      current: 3,
      unit: 'count',
      direction: 'higher_is_better',
      dataSource: 'IT Inventory',
      measuredAt: now.toISOString(),
      frequency: 'monthly',
      status: 'exceeding',
      progressPercent: 100
    }
  ];

  goals.push({
    id: `${customerId}-g5`,
    customerId,
    title: 'Consolidate Tools',
    description: 'Reduce tooling sprawl by retiring redundant systems',
    metrics: goal5Metrics,
    owner: 'James Wilson',
    ownerTitle: 'IT Director',
    targetDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'achieved',
    weight: 0.15,
    progressPercent: 100,
    createdAt: new Date(now.getTime() - 150 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: now.toISOString()
  });

  return goals;
}

/**
 * Calculate value items from goals
 */
function calculateValueItems(goals: SuccessGoal[]): ValueItem[] {
  const items: ValueItem[] = [];

  // Time savings from operational goals
  const operationalMetrics = goals.flatMap(g => g.metrics.filter(m => m.category === 'operational'));
  if (operationalMetrics.length > 0) {
    // Calculate based on time saved
    const timeSavedHours = 140; // Mock: 140 hours/month saved
    const hourlyRate = 60;
    items.push({
      category: 'Time Savings',
      description: `${timeSavedHours} hours/month saved @ $${hourlyRate}/hr`,
      annualValue: timeSavedHours * hourlyRate * 12,
      confidence: 'high'
    });
  }

  // Error reduction from quality goals
  const qualityMetrics = goals.flatMap(g => g.metrics.filter(m => m.category === 'quality'));
  if (qualityMetrics.length > 0) {
    items.push({
      category: 'Error Reduction',
      description: '180 errors prevented/month, 90 hours saved',
      annualValue: 64800,
      confidence: 'medium'
    });
  }

  // Tool consolidation from financial goals
  const financialMetrics = goals.flatMap(g => g.metrics.filter(m => m.category === 'financial'));
  if (financialMetrics.length > 0) {
    items.push({
      category: 'Tool Consolidation',
      description: '3 legacy tools retired',
      annualValue: 45000,
      confidence: 'high'
    });
  }

  return items;
}

/**
 * Generate trend data for success score
 */
function generateSuccessScoreTrend(days: number = 90): Array<{ date: string; progressPercent: number }> {
  const trends: Array<{ date: string; progressPercent: number }> = [];
  const now = new Date();

  for (let i = days; i >= 0; i -= 7) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    // Simulate gradual improvement with some variance
    const baseProgress = 50 + ((days - i) / days) * 35;
    const progress = Math.min(100, Math.max(0, baseProgress + Math.random() * 10 - 5));

    trends.push({
      date: date.toISOString().split('T')[0],
      progressPercent: Math.round(progress)
    });
  }

  return trends;
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/intelligence/success-metrics/:customerId
 * Get comprehensive success metrics for a customer
 *
 * Query params:
 * - period: 'all' | 'ytd' | 'last_quarter' | 'last_month'
 * - includeBenchmarks: boolean
 */
router.get('/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { period = 'all', includeBenchmarks = 'true' } = req.query;

    let customer: any = null;

    // Fetch customer from Supabase
    if (supabase) {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      customer = data;
    }

    // Mock customer if not found
    if (!customer) {
      customer = {
        id: customerId,
        name: 'Acme Corporation',
        arr: 150000,
        industry: 'Technology',
        contract_start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        renewal_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()
      };
    }

    // Generate goals and metrics
    const goals = generateMockGoals(customerId, customer.name);

    // Calculate success score
    const successScore = calculateSuccessScore(goals);
    const goalsOnTrack = goals.filter(g => g.status === 'achieved' || g.status === 'in_progress').length;
    const goalsAtRisk = goals.filter(g => g.status === 'at_risk').length;

    // Calculate value
    const valueItems = calculateValueItems(goals);
    const totalAnnualValue = valueItems.reduce((sum, item) => sum + item.annualValue, 0);
    const investment = customer.arr || 150000;

    // Generate trends
    const successScoreTrend = generateSuccessScoreTrend(90);
    const goalProgressTrends: Record<string, Array<{ date: string; progressPercent: number }>> = {};
    goals.forEach(g => {
      goalProgressTrends[g.id] = generateSuccessScoreTrend(90);
    });

    // Benchmarks
    const benchmarks = includeBenchmarks === 'true' ? [
      {
        metric: 'Success Score',
        customerValue: successScore,
        peerAverage: 72,
        percentile: 80
      },
      {
        metric: 'Goals Achieved',
        customerValue: Math.round((goalsOnTrack / goals.length) * 100),
        peerAverage: 65,
        percentile: 75
      },
      {
        metric: 'ROI',
        customerValue: Math.round((totalAnnualValue / investment) * 100),
        peerAverage: 120,
        percentile: 85
      }
    ] : [];

    // Milestones
    const now = new Date();
    const milestones = [
      {
        id: 'ms1',
        title: 'Goal 3 checkpoint',
        targetDate: new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'at_risk' as const,
        goalId: `${customerId}-g3`
      },
      {
        id: 'ms2',
        title: 'QBR review',
        targetDate: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'on_track' as const
      },
      {
        id: 'ms3',
        title: 'Annual success review',
        targetDate: new Date(now.getTime() + 150 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'planned' as const
      }
    ];

    // Customer quotes
    const quotes = [
      {
        text: "What used to take us half a day now takes 20 minutes. The team loves it.",
        author: 'Sarah Chen',
        source: 'QBR',
        date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        goalId: `${customerId}-g1`
      }
    ];

    res.json({
      customerId,
      customerName: customer.name,
      contractStart: customer.contract_start || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      lastUpdated: new Date().toISOString(),

      overview: {
        score: successScore,
        label: getSuccessScoreLabel(successScore),
        goalsOnTrack,
        goalsAtRisk,
        totalGoals: goals.length,
        totalValueDelivered: totalAnnualValue
      },

      goals,

      valueSummary: {
        items: valueItems,
        totalAnnualValue,
        roi: {
          investment,
          valueDelivered: totalAnnualValue,
          roiPercent: Math.round((totalAnnualValue / investment) * 100)
        }
      },

      trends: {
        successScore: successScoreTrend,
        goalProgress: goalProgressTrends
      },

      benchmarks,
      milestones,
      quotes
    });
  } catch (error) {
    console.error('Success metrics error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch success metrics' }
    });
  }
});

/**
 * GET /api/intelligence/success-metrics/:customerId/goals/:goalId
 * Get detailed information for a specific goal
 */
router.get('/:customerId/goals/:goalId', async (req: Request, res: Response) => {
  try {
    const { customerId, goalId } = req.params;

    // Generate all goals for this customer
    const goals = generateMockGoals(customerId, 'Customer');
    const goal = goals.find(g => g.id === goalId);

    if (!goal) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Goal not found' }
      });
    }

    // Generate value items for this goal
    const valueItems = calculateValueItems([goal]);

    // Generate metric trends
    const metricTrends: Record<string, Array<{ date: string; value: number }>> = {};
    goal.metrics.forEach(m => {
      metricTrends[m.id] = generateMetricTrend(m);
    });

    // Recommendations for at-risk goals
    const recommendations: Array<{ priority: string; action: string; goalId: string }> = [];
    if (goal.status === 'at_risk') {
      recommendations.push(
        { priority: 'immediate', action: 'Schedule team training session', goalId },
        { priority: 'this_week', action: 'Identify automation opportunities', goalId },
        { priority: 'this_month', action: 'Implement 3 quick-win automations', goalId }
      );
    }

    // Root cause analysis for at-risk
    const rootCauseAnalysis = goal.status === 'at_risk' ? [
      'Only 65% of team using system regularly',
      'Automation features underutilized',
      'Training completion at 50%'
    ] : undefined;

    // Customer quotes related to this goal
    const quotes = goal.status === 'achieved' ? [
      {
        text: "What used to take us half a day now takes 20 minutes. The team loves it.",
        author: goal.owner,
        source: 'QBR',
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        goalId
      }
    ] : [];

    res.json({
      goal,
      valueDelivered: valueItems,
      metricTrends,
      recommendations,
      rootCauseAnalysis,
      quotes
    });
  } catch (error) {
    console.error('Goal detail error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch goal details' }
    });
  }
});

/**
 * Generate trend data for a metric
 */
function generateMetricTrend(metric: SuccessMetric): Array<{ date: string; value: number }> {
  const trends: Array<{ date: string; value: number }> = [];
  const now = new Date();
  const days = 90;

  for (let i = days; i >= 0; i -= 7) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    // Interpolate between baseline and current
    const progress = (days - i) / days;
    let value: number;

    if (metric.direction === 'lower_is_better') {
      value = metric.baseline - (metric.baseline - metric.current) * progress;
    } else {
      value = metric.baseline + (metric.current - metric.baseline) * progress;
    }

    // Add some variance
    value = value + (Math.random() * (metric.target - metric.baseline) * 0.1);

    trends.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(value * 100) / 100
    });
  }

  return trends;
}

/**
 * POST /api/intelligence/success-metrics/:customerId/goals
 * Create a new success goal
 */
router.post('/:customerId/goals', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { title, description, metrics, owner, ownerTitle, targetDate, weight = 0.2 } = req.body;

    if (!title || !owner || !targetDate) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: title, owner, targetDate' }
      });
    }

    const now = new Date();
    const goalId = `${customerId}-g${Date.now()}`;

    // Transform metrics with calculated fields
    const transformedMetrics: SuccessMetric[] = (metrics || []).map((m: any, index: number) => {
      const progress = calculateProgress(m.baseline, m.target, m.current || m.baseline, m.direction);
      return {
        id: `${goalId}-m${index}`,
        customerId,
        goalId,
        category: m.category || 'operational',
        name: m.name,
        description: m.description || '',
        baseline: m.baseline,
        target: m.target,
        current: m.current || m.baseline,
        unit: m.unit,
        direction: m.direction || 'higher_is_better',
        dataSource: m.dataSource || 'Manual Entry',
        measuredAt: now.toISOString(),
        frequency: m.frequency || 'monthly',
        status: determineMetricStatus(progress),
        progressPercent: progress
      };
    });

    const avgProgress = transformedMetrics.length > 0
      ? Math.round(transformedMetrics.reduce((s, m) => s + m.progressPercent, 0) / transformedMetrics.length)
      : 0;

    const newGoal: SuccessGoal = {
      id: goalId,
      customerId,
      title,
      description: description || '',
      metrics: transformedMetrics,
      owner,
      ownerTitle,
      targetDate,
      status: transformedMetrics.length === 0 ? 'not_started' : determineGoalStatus(transformedMetrics),
      weight,
      progressPercent: avgProgress,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    // In production, save to Supabase
    if (supabase) {
      // Would insert into success_goals and success_metrics tables
      // For now, just return the created goal
    }

    res.status(201).json(newGoal);
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create goal' }
    });
  }
});

/**
 * PUT /api/intelligence/success-metrics/:customerId/goals/:goalId
 * Update an existing success goal
 */
router.put('/:customerId/goals/:goalId', async (req: Request, res: Response) => {
  try {
    const { customerId, goalId } = req.params;
    const updates = req.body;

    // In production, fetch and update from Supabase
    // For now, generate mock and apply updates
    const goals = generateMockGoals(customerId, 'Customer');
    const goal = goals.find(g => g.id === goalId);

    if (!goal) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Goal not found' }
      });
    }

    const updatedGoal: SuccessGoal = {
      ...goal,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    res.json(updatedGoal);
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update goal' }
    });
  }
});

/**
 * DELETE /api/intelligence/success-metrics/:customerId/goals/:goalId
 * Delete a success goal
 */
router.delete('/:customerId/goals/:goalId', async (req: Request, res: Response) => {
  try {
    const { customerId, goalId } = req.params;

    // In production, delete from Supabase
    // For now, just return success

    res.status(204).send();
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete goal' }
    });
  }
});

/**
 * PUT /api/intelligence/success-metrics/:customerId/metrics/:metricId
 * Update a metric's current value
 */
router.put('/:customerId/metrics/:metricId', async (req: Request, res: Response) => {
  try {
    const { customerId, metricId } = req.params;
    const { current, baseline, target, measuredAt } = req.body;

    // In production, fetch and update from Supabase
    // For now, return mock updated metric
    const now = new Date();

    const updatedMetric: Partial<SuccessMetric> = {
      id: metricId,
      customerId,
      measuredAt: measuredAt || now.toISOString()
    };

    if (current !== undefined) updatedMetric.current = current;
    if (baseline !== undefined) updatedMetric.baseline = baseline;
    if (target !== undefined) updatedMetric.target = target;

    // Recalculate progress and status if values changed
    if (current !== undefined || baseline !== undefined || target !== undefined) {
      const b = baseline !== undefined ? baseline : 0;
      const t = target !== undefined ? target : 100;
      const c = current !== undefined ? current : 0;
      const progress = calculateProgress(b, t, c, 'higher_is_better');
      updatedMetric.progressPercent = progress;
      updatedMetric.status = determineMetricStatus(progress);
    }

    res.json(updatedMetric);
  } catch (error) {
    console.error('Update metric error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update metric' }
    });
  }
});

/**
 * GET /api/intelligence/success-metrics/:customerId/value-report
 * Generate a value report for customer sharing
 */
router.get('/:customerId/value-report', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { format = 'json' } = req.query;

    let customer: any = null;

    if (supabase) {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();
      customer = data;
    }

    if (!customer) {
      customer = {
        id: customerId,
        name: 'Acme Corporation',
        arr: 150000
      };
    }

    const goals = generateMockGoals(customerId, customer.name);
    const valueItems = calculateValueItems(goals);
    const totalAnnualValue = valueItems.reduce((sum, item) => sum + item.annualValue, 0);
    const successScore = calculateSuccessScore(goals);

    const report = {
      generated: new Date().toISOString(),
      customer: {
        id: customer.id,
        name: customer.name,
        arr: customer.arr
      },
      summary: {
        successScore,
        successLabel: getSuccessScoreLabel(successScore),
        goalsAchieved: goals.filter(g => g.status === 'achieved').length,
        totalGoals: goals.length,
        totalValueDelivered: totalAnnualValue,
        roiPercent: Math.round((totalAnnualValue / (customer.arr || 150000)) * 100)
      },
      goals: goals.map(g => ({
        title: g.title,
        status: g.status,
        progress: g.progressPercent,
        owner: g.owner,
        metrics: g.metrics.map(m => ({
          name: m.name,
          baseline: m.baseline,
          target: m.target,
          current: m.current,
          unit: m.unit,
          status: m.status
        }))
      })),
      valueBreakdown: valueItems,
      roi: {
        investment: customer.arr || 150000,
        valueDelivered: totalAnnualValue,
        roiPercent: Math.round((totalAnnualValue / (customer.arr || 150000)) * 100)
      }
    };

    if (format === 'markdown') {
      // Generate markdown format
      let md = `# Account Success Report: ${customer.name}\n\n`;
      md += `Generated: ${new Date().toLocaleDateString()}\n\n`;
      md += `## Executive Summary\n\n`;
      md += `- **Success Score**: ${successScore}/100 (${getSuccessScoreLabel(successScore)})\n`;
      md += `- **Goals Achieved**: ${report.summary.goalsAchieved} of ${report.summary.totalGoals}\n`;
      md += `- **Annual Value Delivered**: $${totalAnnualValue.toLocaleString()}\n`;
      md += `- **ROI**: ${report.summary.roiPercent}%\n\n`;
      md += `## Goals Overview\n\n`;

      goals.forEach(g => {
        const statusIcon = g.status === 'achieved' ? '[check]' : g.status === 'at_risk' ? '[warning]' : '[progress]';
        md += `### ${g.title} ${statusIcon}\n`;
        md += `Status: ${g.status} | Progress: ${g.progressPercent}% | Owner: ${g.owner}\n\n`;
        md += `| Metric | Baseline | Target | Current | Status |\n`;
        md += `|--------|----------|--------|---------|--------|\n`;
        g.metrics.forEach(m => {
          md += `| ${m.name} | ${m.baseline} ${m.unit} | ${m.target} ${m.unit} | ${m.current} ${m.unit} | ${m.status} |\n`;
        });
        md += `\n`;
      });

      md += `## Value Summary\n\n`;
      md += `| Category | Annual Value | Confidence |\n`;
      md += `|----------|--------------|------------|\n`;
      valueItems.forEach(v => {
        md += `| ${v.category} | $${v.annualValue.toLocaleString()} | ${v.confidence} |\n`;
      });
      md += `| **Total** | **$${totalAnnualValue.toLocaleString()}** | |\n`;

      res.set('Content-Type', 'text/markdown');
      return res.send(md);
    }

    res.json(report);
  } catch (error) {
    console.error('Value report error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate value report' }
    });
  }
});

export { router as successMetricsRoutes };
