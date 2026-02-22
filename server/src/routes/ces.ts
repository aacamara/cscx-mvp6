/**
 * Customer Effort Score API Routes
 * PRD-160: Customer Effort Score Report
 *
 * Provides endpoints for:
 * - Portfolio CES overview
 * - Touchpoint analysis
 * - Customer CES detail
 * - Survey response submission
 * - CES correlations with churn/NPS/health
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// TYPES
// ============================================

type CESScoreValue = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type TouchpointType = 'support_ticket' | 'feature_use' | 'onboarding' | 'billing' | 'api_integration' | 'training' | 'renewal' | 'other';
type CESTrend = 'improving' | 'stable' | 'worsening';
type CESCategory = 'low_effort' | 'neutral' | 'high_effort';

interface CESByTouchpoint {
  touchpoint: TouchpointType;
  touchpoint_label: string;
  average: number;
  count: number;
  trend: CESTrend;
  trend_change: number;
}

interface CESDistribution {
  low_effort: number;
  neutral: number;
  high_effort: number;
}

interface ProblemArea {
  touchpoint: TouchpointType;
  touchpoint_label: string;
  average: number;
  count: number;
  common_feedback: string[];
  affected_customers: number;
}

interface FeedbackTheme {
  theme: string;
  count: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  example_feedback: string[];
}

interface CESSurvey {
  id: string;
  customer_id: string;
  customer_name: string;
  user_id: string;
  touchpoint: TouchpointType;
  score: CESScoreValue | null;
  feedback: string | null;
  responded_at: string | null;
  delivered_at: string;
  channel: 'in_app' | 'email' | 'slack';
}

// ============================================
// CONSTANTS
// ============================================

const TOUCHPOINT_LABELS: Record<TouchpointType, string> = {
  support_ticket: 'Support Ticket',
  feature_use: 'Feature Use',
  onboarding: 'Onboarding',
  billing: 'Billing/Invoicing',
  api_integration: 'API Integration',
  training: 'Training',
  renewal: 'Renewal',
  other: 'Other'
};

const CES_THRESHOLDS = {
  low_effort: { min: 6, max: 7 },
  neutral: { min: 4, max: 5 },
  high_effort: { min: 1, max: 3 }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function categorizeCES(score: number): CESCategory {
  if (score >= CES_THRESHOLDS.low_effort.min) return 'low_effort';
  if (score >= CES_THRESHOLDS.neutral.min) return 'neutral';
  return 'high_effort';
}

function determineCESTrend(current: number, previous: number | null): CESTrend {
  if (previous === null) return 'stable';
  const change = current - previous;
  if (change >= 0.3) return 'improving';
  if (change <= -0.3) return 'worsening';
  return 'stable';
}

function calculateDistribution(scores: number[]): CESDistribution {
  if (scores.length === 0) {
    return { low_effort: 0, neutral: 0, high_effort: 0 };
  }

  const lowEffort = scores.filter(s => s >= 6).length;
  const neutral = scores.filter(s => s >= 4 && s <= 5).length;
  const highEffort = scores.filter(s => s <= 3).length;
  const total = scores.length;

  return {
    low_effort: Math.round((lowEffort / total) * 100),
    neutral: Math.round((neutral / total) * 100),
    high_effort: Math.round((highEffort / total) * 100)
  };
}

function getPeriodDays(period: string): number {
  switch (period) {
    case 'week': return 7;
    case 'month': return 30;
    case 'quarter': return 90;
    case 'year': return 365;
    default: return 90;
  }
}

function getPeriodLabel(period: string): string {
  switch (period) {
    case 'week': return 'This Week';
    case 'month': return 'This Month';
    case 'quarter': return 'This Quarter';
    case 'year': return 'This Year';
    default: return 'This Quarter';
  }
}

// Generate mock CES surveys for development
function generateMockSurveys(count: number = 100): CESSurvey[] {
  const touchpoints: TouchpointType[] = ['support_ticket', 'feature_use', 'onboarding', 'billing', 'api_integration', 'training'];
  const customers = [
    { id: '1', name: 'Acme Corporation' },
    { id: '2', name: 'TechStart Inc' },
    { id: '3', name: 'GlobalTech Solutions' },
    { id: '4', name: 'DataFlow Inc' },
    { id: '5', name: 'CloudNine Systems' },
    { id: '6', name: 'MegaCorp Industries' },
    { id: '7', name: 'StartupX' },
    { id: '8', name: 'Enterprise Plus' },
    { id: '9', name: 'SmallBiz Co' },
    { id: '10', name: 'Innovation Labs' }
  ];

  const feedbackByTouchpoint: Record<string, string[]> = {
    support_ticket: ['Quick resolution', 'Very helpful agent', 'Had to repeat my issue', 'Took too long to get a response'],
    feature_use: ['Intuitive interface', 'Confusing navigation', 'Feature works great', 'Hard to find what I needed'],
    onboarding: ['Clear documentation', 'Smooth process', 'Missing steps in guide', 'Great onboarding call'],
    billing: ['Easy to understand', 'Confusing invoice', 'Hard to find billing info', 'Automated process works well'],
    api_integration: ['Documentation unclear', 'Good API design', 'Missing examples', 'Easy to integrate'],
    training: ['Very informative', 'Pace was too fast', 'Great examples', 'Need more hands-on exercises']
  };

  const surveys: CESSurvey[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const touchpoint = touchpoints[Math.floor(Math.random() * touchpoints.length)];
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const daysAgo = Math.floor(Math.random() * 90);
    const deliveredAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const hasResponded = Math.random() > 0.32; // ~68% response rate
    const respondedAt = hasResponded
      ? new Date(deliveredAt.getTime() + Math.random() * 2 * 24 * 60 * 60 * 1000)
      : null;

    // Scores tend to vary by touchpoint (API integration typically lower)
    let baseScore: number;
    switch (touchpoint) {
      case 'api_integration':
        baseScore = 3.8 + Math.random() * 2;
        break;
      case 'billing':
        baseScore = 4.2 + Math.random() * 2;
        break;
      case 'support_ticket':
        baseScore = 5.5 + Math.random() * 1.5;
        break;
      default:
        baseScore = 5 + Math.random() * 2;
    }

    const score = hasResponded
      ? Math.min(7, Math.max(1, Math.round(baseScore))) as CESScoreValue
      : null;

    const hasFeedback = hasResponded && Math.random() > 0.4;
    const feedbackOptions = feedbackByTouchpoint[touchpoint] || ['No feedback'];
    const feedback = hasFeedback
      ? feedbackOptions[Math.floor(Math.random() * feedbackOptions.length)]
      : null;

    surveys.push({
      id: `ces_${i + 1}`,
      customer_id: customer.id,
      customer_name: customer.name,
      user_id: `user_${Math.floor(Math.random() * 20) + 1}`,
      touchpoint,
      score,
      feedback,
      responded_at: respondedAt?.toISOString() || null,
      delivered_at: deliveredAt.toISOString(),
      channel: ['in_app', 'email', 'slack'][Math.floor(Math.random() * 3)] as 'in_app' | 'email' | 'slack'
    });
  }

  return surveys;
}

// Generate trend data points
function generateTrendPoints(days: number, baseAverage: number): Array<{ date: string; average: number; response_count: number; low_effort_pct: number; neutral_pct: number; high_effort_pct: number }> {
  const trends: Array<{ date: string; average: number; response_count: number; low_effort_pct: number; neutral_pct: number; high_effort_pct: number }> = [];
  const now = new Date();

  for (let i = days; i >= 0; i -= 7) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const variation = Math.sin(i / 10) * 0.3 + (Math.random() * 0.4 - 0.2);
    const average = Math.max(1, Math.min(7, baseAverage + variation));

    trends.push({
      date: date.toISOString().split('T')[0],
      average: parseFloat(average.toFixed(1)),
      response_count: Math.floor(20 + Math.random() * 30),
      low_effort_pct: Math.round(40 + average * 5 + Math.random() * 10),
      neutral_pct: Math.round(25 + Math.random() * 15),
      high_effort_pct: Math.round(15 - average * 2 + Math.random() * 10)
    });
  }

  return trends;
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/reports/ces
 * Get CES portfolio overview with touchpoint breakdown
 *
 * Query params:
 * - period: 'week' | 'month' | 'quarter' | 'year'
 * - touchpoint: Filter by touchpoint type
 * - segment: Filter by customer segment
 * - ces_filter: 'all' | 'low_effort' | 'neutral' | 'high_effort'
 * - customer_id: Filter by specific customer
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      period = 'quarter',
      touchpoint,
      segment,
      ces_filter,
      customer_id
    } = req.query;

    const periodDays = getPeriodDays(period as string);

    // Generate mock data (in production, fetch from Supabase)
    let surveys = generateMockSurveys(500);

    // Filter by period
    const cutoffDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    surveys = surveys.filter(s => new Date(s.delivered_at) >= cutoffDate);

    // Filter by touchpoint
    if (touchpoint) {
      surveys = surveys.filter(s => s.touchpoint === touchpoint);
    }

    // Filter by customer
    if (customer_id) {
      surveys = surveys.filter(s => s.customer_id === customer_id);
    }

    // Get responded surveys only for calculations
    const respondedSurveys = surveys.filter(s => s.score !== null);
    const scores = respondedSurveys.map(s => s.score as number);

    // Calculate overall metrics
    const avgScore = scores.length > 0
      ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
      : 0;

    const responseRate = surveys.length > 0
      ? Math.round((respondedSurveys.length / surveys.length) * 100)
      : 0;

    // Previous period for trend calculation
    const prevPeriodStart = new Date(cutoffDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const prevSurveys = generateMockSurveys(500).filter(s => {
      const date = new Date(s.delivered_at);
      return date >= prevPeriodStart && date < cutoffDate && s.score !== null;
    });
    const prevScores = prevSurveys.map(s => s.score as number);
    const prevAvg = prevScores.length > 0
      ? prevScores.reduce((a, b) => a + b, 0) / prevScores.length
      : avgScore;

    const trend = determineCESTrend(avgScore, prevAvg);
    const trendChange = parseFloat((avgScore - prevAvg).toFixed(1));

    // Calculate distribution
    const distribution = calculateDistribution(scores);

    // Calculate by touchpoint
    const touchpointGroups: Record<TouchpointType, number[]> = {
      support_ticket: [],
      feature_use: [],
      onboarding: [],
      billing: [],
      api_integration: [],
      training: [],
      renewal: [],
      other: []
    };

    respondedSurveys.forEach(s => {
      touchpointGroups[s.touchpoint].push(s.score as number);
    });

    const byTouchpoint: CESByTouchpoint[] = Object.entries(touchpointGroups)
      .filter(([_, scores]) => scores.length > 0)
      .map(([tp, scores]) => {
        const avg = parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1));
        const prevTpAvg = avg - (Math.random() * 0.6 - 0.3);
        return {
          touchpoint: tp as TouchpointType,
          touchpoint_label: TOUCHPOINT_LABELS[tp as TouchpointType],
          average: avg,
          count: scores.length,
          trend: determineCESTrend(avg, prevTpAvg),
          trend_change: parseFloat((avg - prevTpAvg).toFixed(1))
        };
      })
      .sort((a, b) => a.average - b.average);

    // Identify problem areas (CES < 4.5)
    const problemAreas: ProblemArea[] = byTouchpoint
      .filter(t => t.average < 4.5)
      .map(t => {
        const tpSurveys = respondedSurveys.filter(s => s.touchpoint === t.touchpoint);
        const feedbackList = tpSurveys
          .filter(s => s.feedback)
          .map(s => s.feedback as string);
        const uniqueCustomers = new Set(tpSurveys.map(s => s.customer_id)).size;

        return {
          touchpoint: t.touchpoint,
          touchpoint_label: t.touchpoint_label,
          average: t.average,
          count: t.count,
          common_feedback: feedbackList.slice(0, 3),
          affected_customers: uniqueCustomers
        };
      });

    // Identify top performers (CES >= 5.5)
    const topPerformers = byTouchpoint
      .filter(t => t.average >= 5.5)
      .map(t => ({
        touchpoint: t.touchpoint,
        touchpoint_label: t.touchpoint_label,
        average: t.average,
        count: t.count
      }))
      .sort((a, b) => b.average - a.average)
      .slice(0, 3);

    // Extract feedback themes
    const allFeedback = respondedSurveys
      .filter(s => s.feedback)
      .map(s => ({ feedback: s.feedback as string, score: s.score as number }));

    const feedbackThemes: FeedbackTheme[] = [
      {
        theme: 'Documentation',
        count: allFeedback.filter(f => f.feedback.toLowerCase().includes('document') || f.feedback.toLowerCase().includes('doc')).length,
        sentiment: 'negative',
        example_feedback: ['Documentation unclear', 'Missing steps in guide', 'Good API documentation']
      },
      {
        theme: 'Response Time',
        count: allFeedback.filter(f => f.feedback.toLowerCase().includes('time') || f.feedback.toLowerCase().includes('wait') || f.feedback.toLowerCase().includes('fast') || f.feedback.toLowerCase().includes('quick')).length,
        sentiment: 'mixed' as 'neutral',
        example_feedback: ['Quick resolution', 'Took too long to get a response', 'Fast support']
      },
      {
        theme: 'Ease of Use',
        count: allFeedback.filter(f => f.feedback.toLowerCase().includes('easy') || f.feedback.toLowerCase().includes('intuitive') || f.feedback.toLowerCase().includes('confusing') || f.feedback.toLowerCase().includes('hard')).length,
        sentiment: 'neutral',
        example_feedback: ['Intuitive interface', 'Confusing navigation', 'Easy to integrate']
      }
    ].filter(t => t.count > 0);

    // Generate trend points
    const trends = generateTrendPoints(periodDays, avgScore);

    // Generate correlations (mock data)
    const correlations = [
      {
        metric: 'nps' as const,
        metric_label: 'NPS Score',
        correlation_coefficient: 0.72,
        correlation_strength: 'strong' as const,
        insight: 'Customers with low CES scores are 3x more likely to give detractor NPS ratings'
      },
      {
        metric: 'health_score' as const,
        metric_label: 'Health Score',
        correlation_coefficient: 0.65,
        correlation_strength: 'moderate' as const,
        insight: 'High-effort experiences correlate with declining health scores within 30 days'
      },
      {
        metric: 'churn_rate' as const,
        metric_label: 'Churn Rate',
        correlation_coefficient: -0.58,
        correlation_strength: 'moderate' as const,
        insight: 'Customers with CES < 4 have 2.5x higher churn rate than those with CES > 5'
      }
    ];

    // Generate churn correlation data
    const churnCorrelation = [
      { ces_range: '1-3 (High Effort)', churn_rate: 32, customer_count: Math.round(respondedSurveys.length * 0.2) },
      { ces_range: '4-5 (Neutral)', churn_rate: 15, customer_count: Math.round(respondedSurveys.length * 0.35) },
      { ces_range: '6-7 (Low Effort)', churn_rate: 8, customer_count: Math.round(respondedSurveys.length * 0.45) }
    ];

    res.json({
      summary: {
        period: period as string,
        period_label: getPeriodLabel(period as string),
        overall: {
          average: avgScore,
          total_responses: respondedSurveys.length,
          total_surveys_sent: surveys.length,
          response_rate: responseRate,
          trend,
          trend_change: trendChange
        },
        distribution,
        by_touchpoint: byTouchpoint,
        problem_areas: problemAreas,
        top_performers: topPerformers,
        feedback_themes: feedbackThemes
      },
      trends,
      correlations,
      churn_correlation: churnCorrelation
    });
  } catch (error) {
    console.error('CES report error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch CES report data' }
    });
  }
});

/**
 * GET /api/reports/ces/touchpoints
 * Get detailed touchpoint analysis
 */
router.get('/touchpoints', async (req: Request, res: Response) => {
  try {
    const { period = 'quarter', touchpoint } = req.query;
    const periodDays = getPeriodDays(period as string);

    let surveys = generateMockSurveys(500);

    // Filter by period
    const cutoffDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    surveys = surveys.filter(s => new Date(s.delivered_at) >= cutoffDate);

    // Filter by touchpoint if specified
    if (touchpoint) {
      surveys = surveys.filter(s => s.touchpoint === touchpoint);
    }

    const respondedSurveys = surveys.filter(s => s.score !== null);

    // Group by touchpoint
    const touchpointGroups: Record<TouchpointType, Array<{ score: number; feedback: string | null }>> = {
      support_ticket: [],
      feature_use: [],
      onboarding: [],
      billing: [],
      api_integration: [],
      training: [],
      renewal: [],
      other: []
    };

    respondedSurveys.forEach(s => {
      touchpointGroups[s.touchpoint].push({
        score: s.score as number,
        feedback: s.feedback
      });
    });

    const touchpoints: CESByTouchpoint[] = Object.entries(touchpointGroups)
      .filter(([_, data]) => data.length > 0)
      .map(([tp, data]) => {
        const scores = data.map(d => d.score);
        const avg = parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1));
        const prevAvg = avg - (Math.random() * 0.6 - 0.3);

        return {
          touchpoint: tp as TouchpointType,
          touchpoint_label: TOUCHPOINT_LABELS[tp as TouchpointType],
          average: avg,
          count: scores.length,
          trend: determineCESTrend(avg, prevAvg),
          trend_change: parseFloat((avg - prevAvg).toFixed(1))
        };
      })
      .sort((a, b) => a.average - b.average);

    res.json({ touchpoints });
  } catch (error) {
    console.error('Touchpoint analysis error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch touchpoint analysis' }
    });
  }
});

/**
 * GET /api/reports/ces/:customerId
 * Get CES detail for a specific customer
 */
router.get('/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { period = 'quarter' } = req.query;
    const periodDays = getPeriodDays(period as string);

    // Mock customer data
    const mockCustomers: Record<string, { name: string; segment: string; arr: number; health_score: number }> = {
      '1': { name: 'Acme Corporation', segment: 'Enterprise', arr: 120000, health_score: 85 },
      '2': { name: 'TechStart Inc', segment: 'SMB', arr: 65000, health_score: 48 },
      '3': { name: 'GlobalTech Solutions', segment: 'Enterprise', arr: 280000, health_score: 92 },
      '4': { name: 'DataFlow Inc', segment: 'Mid-Market', arr: 95000, health_score: 35 },
      '5': { name: 'CloudNine Systems', segment: 'Mid-Market', arr: 150000, health_score: 78 }
    };

    const customer = mockCustomers[customerId] || {
      name: 'Unknown Customer',
      segment: 'Unknown',
      arr: 0,
      health_score: 50
    };

    // Generate mock surveys for this customer
    let surveys = generateMockSurveys(200).filter(s => s.customer_id === customerId);

    // If no surveys for this customer, generate some
    if (surveys.length === 0) {
      surveys = generateMockSurveys(50).map(s => ({ ...s, customer_id: customerId, customer_name: customer.name }));
    }

    // Filter by period
    const cutoffDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    surveys = surveys.filter(s => new Date(s.delivered_at) >= cutoffDate);

    const respondedSurveys = surveys.filter(s => s.score !== null);
    const scores = respondedSurveys.map(s => s.score as number);

    const avgScore = scores.length > 0
      ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
      : 0;

    const prevAvg = avgScore - (Math.random() * 0.6 - 0.3);
    const trend = determineCESTrend(avgScore, prevAvg);
    const trendChange = parseFloat((avgScore - prevAvg).toFixed(1));

    // Calculate distribution
    const distribution = calculateDistribution(scores);

    // Group by touchpoint
    const touchpointGroups: Record<TouchpointType, number[]> = {
      support_ticket: [],
      feature_use: [],
      onboarding: [],
      billing: [],
      api_integration: [],
      training: [],
      renewal: [],
      other: []
    };

    respondedSurveys.forEach(s => {
      touchpointGroups[s.touchpoint].push(s.score as number);
    });

    const byTouchpoint: CESByTouchpoint[] = Object.entries(touchpointGroups)
      .filter(([_, scores]) => scores.length > 0)
      .map(([tp, scores]) => {
        const avg = parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1));
        const prevTpAvg = avg - (Math.random() * 0.4 - 0.2);
        return {
          touchpoint: tp as TouchpointType,
          touchpoint_label: TOUCHPOINT_LABELS[tp as TouchpointType],
          average: avg,
          count: scores.length,
          trend: determineCESTrend(avg, prevTpAvg),
          trend_change: parseFloat((avg - prevTpAvg).toFixed(1))
        };
      })
      .sort((a, b) => a.average - b.average);

    // Recent surveys with days_ago
    const now = new Date();
    const recentSurveys = surveys
      .sort((a, b) => new Date(b.delivered_at).getTime() - new Date(a.delivered_at).getTime())
      .slice(0, 10)
      .map(s => ({
        ...s,
        days_ago: Math.floor((now.getTime() - new Date(s.delivered_at).getTime()) / (24 * 60 * 60 * 1000))
      }));

    // Extract feedback themes for this customer
    const customerFeedback = respondedSurveys
      .filter(s => s.feedback)
      .map(s => s.feedback as string);

    const feedbackThemes: FeedbackTheme[] = [];
    if (customerFeedback.some(f => f.toLowerCase().includes('document'))) {
      feedbackThemes.push({
        theme: 'Documentation',
        count: customerFeedback.filter(f => f.toLowerCase().includes('document')).length,
        sentiment: 'negative',
        example_feedback: customerFeedback.filter(f => f.toLowerCase().includes('document')).slice(0, 2)
      });
    }
    if (customerFeedback.some(f => f.toLowerCase().includes('time') || f.toLowerCase().includes('quick'))) {
      feedbackThemes.push({
        theme: 'Response Time',
        count: customerFeedback.filter(f => f.toLowerCase().includes('time') || f.toLowerCase().includes('quick')).length,
        sentiment: 'neutral',
        example_feedback: customerFeedback.filter(f => f.toLowerCase().includes('time') || f.toLowerCase().includes('quick')).slice(0, 2)
      });
    }

    // Generate recommendations based on CES data
    const recommendations: string[] = [];

    if (avgScore < 4.5) {
      recommendations.push('Schedule a check-in call to understand friction points');
      recommendations.push('Review recent support interactions for improvement opportunities');
    }

    const lowestTouchpoint = byTouchpoint[0];
    if (lowestTouchpoint && lowestTouchpoint.average < 4) {
      recommendations.push(`Focus on improving ${lowestTouchpoint.touchpoint_label} experience (current CES: ${lowestTouchpoint.average})`);
    }

    if (distribution.high_effort > 30) {
      recommendations.push('High effort experiences are prevalent - consider proactive outreach');
    }

    if (trend === 'worsening') {
      recommendations.push('CES trend is declining - investigate recent changes in customer experience');
    }

    res.json({
      customer: {
        id: customerId,
        name: customer.name,
        segment: customer.segment,
        arr: customer.arr,
        health_score: customer.health_score
      },
      current_ces: avgScore,
      category: categorizeCES(avgScore),
      trend,
      trend_change: trendChange,
      distribution,
      by_touchpoint: byTouchpoint,
      recent_surveys: recentSurveys,
      feedback_themes: feedbackThemes,
      recommendations
    });
  } catch (error) {
    console.error('Customer CES detail error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch customer CES detail' }
    });
  }
});

/**
 * POST /api/ces/respond
 * Submit a CES survey response
 */
router.post('/respond', async (req: Request, res: Response) => {
  try {
    const { survey_id, score, feedback } = req.body;

    // Validate score
    if (!score || score < 1 || score > 7) {
      return res.status(400).json({
        error: { code: 'INVALID_SCORE', message: 'Score must be between 1 and 7' }
      });
    }

    // In production, update the survey in Supabase
    if (supabase) {
      const { error } = await supabase
        .from('ces_surveys')
        .update({
          score,
          feedback: feedback || null,
          responded_at: new Date().toISOString()
        })
        .eq('id', survey_id);

      if (error) {
        throw error;
      }
    }

    res.json({
      success: true,
      message: 'Survey response recorded successfully',
      survey_id
    });
  } catch (error) {
    console.error('Survey submission error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to submit survey response' }
    });
  }
});

export { router as cesRoutes };
