/**
 * Health Score Portfolio API Routes
 * PRD-153: Portfolio-wide health score visualization
 *
 * Provides endpoints for:
 * - Portfolio health overview
 * - Customer health matrix
 * - Health score detail/components
 * - Cohort comparison
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { applyOrgFilter } from '../middleware/orgFilter.js';

const router = Router();

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// TYPES
// ============================================

interface HealthScoreComponents {
  usage_score: number;      // 0-100, weight: 40%
  engagement_score: number; // 0-100, weight: 35%
  sentiment_score: number;  // 0-100, weight: 25%
}

interface CustomerHealthSummary {
  customer_id: string;
  customer_name: string;
  health_score: number;
  category: 'healthy' | 'warning' | 'critical';
  trend: 'improving' | 'stable' | 'declining';
  score_change: number;
  change_period: string;
  arr: number;
  segment: string;
  renewal_date: string | null;
  days_to_renewal: number | null;
  lowest_component: string | null;
  active_risks: number;
  last_contact: string | null;
}

interface PortfolioOverview {
  total_customers: number;
  total_arr: number;
  avg_health_score: number;
  score_change_wow: number;
  healthy: { count: number; arr: number; pct: number };
  warning: { count: number; arr: number; pct: number };
  critical: { count: number; arr: number; pct: number };
  changes: {
    improved: number;
    declined: number;
    stable: number;
  };
}

interface PortfolioTrend {
  date: string;
  avg_score: number;
  healthy_pct: number;
  warning_pct: number;
  critical_pct: number;
}

// Health score thresholds
const HEALTH_THRESHOLDS = {
  healthy: { min: 70, max: 100 },
  warning: { min: 40, max: 69 },
  critical: { min: 0, max: 39 }
};

// Component weights
const COMPONENT_WEIGHTS = {
  usage: 0.40,
  engagement: 0.35,
  sentiment: 0.25
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function categorizeHealth(score: number): 'healthy' | 'warning' | 'critical' {
  if (score >= HEALTH_THRESHOLDS.healthy.min) return 'healthy';
  if (score >= HEALTH_THRESHOLDS.warning.min) return 'warning';
  return 'critical';
}

function calculateDaysToRenewal(renewalDate: string | null): number | null {
  if (!renewalDate) return null;
  const renewal = new Date(renewalDate);
  const now = new Date();
  const diffTime = renewal.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function determineTrend(currentScore: number, previousScore: number | null): 'improving' | 'stable' | 'declining' {
  if (previousScore === null) return 'stable';
  const change = currentScore - previousScore;
  if (change >= 5) return 'improving';
  if (change <= -5) return 'declining';
  return 'stable';
}

function getLowestComponent(components: HealthScoreComponents | null): string | null {
  if (!components) return null;
  const scores = [
    { name: 'usage', score: components.usage_score },
    { name: 'engagement', score: components.engagement_score },
    { name: 'sentiment', score: components.sentiment_score }
  ];
  scores.sort((a, b) => a.score - b.score);
  return scores[0].name;
}

// Generate mock historical data for trends (in production, this would come from health_score_history table)
function generateMockTrends(days: number = 30): PortfolioTrend[] {
  const trends: PortfolioTrend[] = [];
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const baseScore = 68 + Math.sin(i / 5) * 5 + Math.random() * 4;

    trends.push({
      date: date.toISOString().split('T')[0],
      avg_score: Math.round(baseScore),
      healthy_pct: Math.round(50 + Math.random() * 20),
      warning_pct: Math.round(25 + Math.random() * 10),
      critical_pct: Math.round(5 + Math.random() * 10)
    });
  }

  return trends;
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/reports/health-portfolio
 * Get portfolio health overview with customer list
 *
 * Query params:
 * - csm_id: Filter by CSM
 * - team_id: Filter by team
 * - segment: Filter by segment
 * - date: View as of date
 * - health_filter: 'all' | 'healthy' | 'warning' | 'critical'
 * - sort_by: 'score' | 'arr' | 'renewal' | 'name' | 'change'
 * - sort_order: 'asc' | 'desc'
 * - search: Search by customer name
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      csm_id,
      segment,
      health_filter,
      sort_by = 'score',
      sort_order = 'desc',
      search
    } = req.query;

    let customers: any[] = [];

    // Fetch customers from Supabase
    if (supabase) {
      let query = supabase
        .from('customers')
        .select('*');

      // Multi-tenant: filter by organization_id
      query = applyOrgFilter(query, req);

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      if (segment) {
        query = query.eq('segment', segment);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      customers = data || [];
    } else {
      // Mock data for development
      customers = [
        { id: '1', name: 'Acme Corporation', arr: 120000, health_score: 85, industry: 'Technology', renewal_date: '2026-06-15', stage: 'active' },
        { id: '2', name: 'TechStart Inc', arr: 65000, health_score: 48, industry: 'SaaS', renewal_date: '2026-02-28', stage: 'at_risk' },
        { id: '3', name: 'GlobalTech Solutions', arr: 280000, health_score: 92, industry: 'Enterprise', renewal_date: '2026-09-01', stage: 'active' },
        { id: '4', name: 'DataFlow Inc', arr: 95000, health_score: 35, industry: 'Data', renewal_date: '2026-03-15', stage: 'at_risk' },
        { id: '5', name: 'CloudNine Systems', arr: 150000, health_score: 78, industry: 'Cloud', renewal_date: '2026-05-20', stage: 'active' },
        { id: '6', name: 'MegaCorp Industries', arr: 340000, health_score: 72, industry: 'Manufacturing', renewal_date: '2026-08-10', stage: 'active' },
        { id: '7', name: 'StartupX', arr: 45000, health_score: 61, industry: 'Startup', renewal_date: '2026-04-01', stage: 'onboarding' },
        { id: '8', name: 'Enterprise Plus', arr: 520000, health_score: 88, industry: 'Enterprise', renewal_date: '2026-12-15', stage: 'active' },
        { id: '9', name: 'SmallBiz Co', arr: 28000, health_score: 55, industry: 'SMB', renewal_date: '2026-03-30', stage: 'active' },
        { id: '10', name: 'Innovation Labs', arr: 175000, health_score: 82, industry: 'R&D', renewal_date: '2026-07-25', stage: 'active' }
      ];
    }

    // Transform customers to health summaries
    const customerHealthSummaries: CustomerHealthSummary[] = customers.map((c, index) => {
      const score = c.health_score || 70;
      const category = categorizeHealth(score);

      // Mock previous scores for trend calculation
      const previousScore = score + (Math.random() * 20 - 10);
      const trend = determineTrend(score, previousScore);
      const scoreChange = Math.round(score - previousScore);

      // Mock component scores
      const components: HealthScoreComponents = {
        usage_score: Math.min(100, Math.max(0, score + Math.floor(Math.random() * 20 - 10))),
        engagement_score: Math.min(100, Math.max(0, score + Math.floor(Math.random() * 20 - 10))),
        sentiment_score: Math.min(100, Math.max(0, score + Math.floor(Math.random() * 20 - 10)))
      };

      return {
        customer_id: c.id,
        customer_name: c.name,
        health_score: score,
        category,
        trend,
        score_change: scoreChange,
        change_period: 'week',
        arr: c.arr || 0,
        segment: c.industry || c.segment || 'Unknown',
        renewal_date: c.renewal_date || null,
        days_to_renewal: calculateDaysToRenewal(c.renewal_date),
        lowest_component: getLowestComponent(components),
        active_risks: category === 'critical' ? Math.floor(Math.random() * 3) + 1 : (category === 'warning' ? Math.floor(Math.random() * 2) : 0),
        last_contact: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      };
    });

    // Apply health filter
    let filteredCustomers = customerHealthSummaries;
    if (health_filter && health_filter !== 'all') {
      filteredCustomers = customerHealthSummaries.filter(c => c.category === health_filter);
    }

    // Apply sorting
    filteredCustomers.sort((a, b) => {
      let comparison = 0;
      switch (sort_by) {
        case 'score':
          comparison = a.health_score - b.health_score;
          break;
        case 'arr':
          comparison = a.arr - b.arr;
          break;
        case 'renewal':
          comparison = (a.days_to_renewal || 999) - (b.days_to_renewal || 999);
          break;
        case 'name':
          comparison = a.customer_name.localeCompare(b.customer_name);
          break;
        case 'change':
          comparison = a.score_change - b.score_change;
          break;
        default:
          comparison = b.health_score - a.health_score;
      }
      return sort_order === 'asc' ? comparison : -comparison;
    });

    // Calculate overview metrics
    const healthyCustomers = customerHealthSummaries.filter(c => c.category === 'healthy');
    const warningCustomers = customerHealthSummaries.filter(c => c.category === 'warning');
    const criticalCustomers = customerHealthSummaries.filter(c => c.category === 'critical');

    const totalCustomers = customerHealthSummaries.length;
    const totalArr = customerHealthSummaries.reduce((sum, c) => sum + c.arr, 0);
    const avgHealthScore = totalCustomers > 0
      ? Math.round(customerHealthSummaries.reduce((sum, c) => sum + c.health_score, 0) / totalCustomers)
      : 0;

    // Calculate week-over-week change (mock for now)
    const scoreChangeWow = Math.round(Math.random() * 6 - 3);

    const overview: PortfolioOverview = {
      total_customers: totalCustomers,
      total_arr: totalArr,
      avg_health_score: avgHealthScore,
      score_change_wow: scoreChangeWow,
      healthy: {
        count: healthyCustomers.length,
        arr: healthyCustomers.reduce((sum, c) => sum + c.arr, 0),
        pct: totalCustomers > 0 ? Math.round((healthyCustomers.length / totalCustomers) * 100) : 0
      },
      warning: {
        count: warningCustomers.length,
        arr: warningCustomers.reduce((sum, c) => sum + c.arr, 0),
        pct: totalCustomers > 0 ? Math.round((warningCustomers.length / totalCustomers) * 100) : 0
      },
      critical: {
        count: criticalCustomers.length,
        arr: criticalCustomers.reduce((sum, c) => sum + c.arr, 0),
        pct: totalCustomers > 0 ? Math.round((criticalCustomers.length / totalCustomers) * 100) : 0
      },
      changes: {
        improved: customerHealthSummaries.filter(c => c.trend === 'improving').length,
        declined: customerHealthSummaries.filter(c => c.trend === 'declining').length,
        stable: customerHealthSummaries.filter(c => c.trend === 'stable').length
      }
    };

    // Generate trend data
    const trends = generateMockTrends(30);

    // Identify alerts
    const alerts = {
      new_critical: criticalCustomers.filter(c => c.score_change < -10).slice(0, 3),
      steep_declines: customerHealthSummaries.filter(c => c.score_change <= -10).slice(0, 3),
      renewals_at_risk: customerHealthSummaries
        .filter(c => c.days_to_renewal !== null && c.days_to_renewal <= 90 && c.category !== 'healthy')
        .slice(0, 3)
    };

    res.json({
      overview,
      customers: filteredCustomers,
      trends,
      alerts
    });
  } catch (error) {
    console.error('Health portfolio error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch health portfolio data' }
    });
  }
});

/**
 * GET /api/reports/health-portfolio/:customerId
 * Get detailed health score for a specific customer
 */
router.get('/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    let customer: any = null;

    // Fetch customer from Supabase
    if (supabase) {
      let query = supabase
        .from('customers')
        .select('*');

      // Multi-tenant: filter by organization_id
      query = applyOrgFilter(query, req);

      const { data, error } = await query
        .eq('id', customerId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      customer = data;
    }

    // Mock customer data if not found
    if (!customer) {
      customer = {
        id: customerId,
        name: 'Acme Corporation',
        arr: 120000,
        health_score: 57,
        industry: 'Technology',
        renewal_date: '2026-06-15',
        stage: 'active'
      };
    }

    const score = customer.health_score || 70;

    // Mock component scores
    const components: HealthScoreComponents = {
      usage_score: Math.min(100, Math.max(0, score + Math.floor(Math.random() * 15 - 5))),
      engagement_score: Math.min(100, Math.max(0, score - 10 + Math.floor(Math.random() * 10))),
      sentiment_score: Math.min(100, Math.max(0, score + 5 + Math.floor(Math.random() * 10)))
    };

    // Generate history (mock)
    const history: Array<{ date: string; score: number; components: HealthScoreComponents }> = [];
    for (let i = 90; i >= 0; i -= 7) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const historyScore = Math.max(30, Math.min(100, score + Math.sin(i / 10) * 15 + Math.random() * 5));
      history.push({
        date: date.toISOString().split('T')[0],
        score: Math.round(historyScore),
        components: {
          usage_score: Math.round(historyScore + Math.random() * 10 - 5),
          engagement_score: Math.round(historyScore - 5 + Math.random() * 10),
          sentiment_score: Math.round(historyScore + 5 + Math.random() * 10)
        }
      });
    }

    // Mock active risks
    const risks = score < 50 ? [
      { severity: 'high', type: 'champion_departure', description: 'Champion departure announced' },
      { severity: 'medium', type: 'usage_decline', description: 'Usage declined 25% this month' }
    ] : score < 70 ? [
      { severity: 'medium', type: 'engagement_drop', description: 'Engagement frequency decreased' }
    ] : [];

    // Generate recommendations based on score and components
    const recommendations: string[] = [];
    if (components.engagement_score < components.usage_score && components.engagement_score < components.sentiment_score) {
      recommendations.push('Schedule a check-in meeting to improve engagement');
      recommendations.push('Review communication cadence and adjust touchpoints');
    }
    if (components.usage_score < 60) {
      recommendations.push('Review product usage data and identify adoption blockers');
      recommendations.push('Offer additional training or onboarding sessions');
    }
    if (score < 50) {
      recommendations.push('Initiate save play workflow immediately');
      recommendations.push('Escalate to leadership for executive involvement');
    }
    if (calculateDaysToRenewal(customer.renewal_date) !== null &&
        calculateDaysToRenewal(customer.renewal_date)! <= 60 &&
        score < 70) {
      recommendations.push('Prepare renewal risk mitigation strategy');
    }

    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        arr: customer.arr,
        industry: customer.industry || customer.segment,
        renewal_date: customer.renewal_date,
        days_to_renewal: calculateDaysToRenewal(customer.renewal_date),
        status: customer.stage || 'active'
      },
      current_score: score,
      category: categorizeHealth(score),
      trend: determineTrend(score, history[history.length - 2]?.score || score),
      components,
      component_weights: COMPONENT_WEIGHTS,
      lowest_component: getLowestComponent(components),
      history,
      risks,
      recommendations
    });
  } catch (error) {
    console.error('Health detail error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch customer health detail' }
    });
  }
});

/**
 * GET /api/reports/health-portfolio/compare
 * Compare health scores across cohorts
 *
 * Query params:
 * - dimension: 'segment' | 'csm' | 'industry' | 'tenure'
 * - period: Time period for comparison
 */
router.get('/compare', async (req: Request, res: Response) => {
  try {
    const { dimension = 'segment' } = req.query;

    let customers: any[] = [];

    // Fetch customers
    if (supabase) {
      let query = supabase
        .from('customers')
        .select('*');

      // Multi-tenant: filter by organization_id
      query = applyOrgFilter(query, req);

      const { data, error } = await query;

      if (!error && data) {
        customers = data;
      }
    } else {
      // Mock data
      customers = [
        { id: '1', name: 'Acme Corp', arr: 120000, health_score: 85, industry: 'Technology', segment: 'Enterprise' },
        { id: '2', name: 'TechStart', arr: 65000, health_score: 48, industry: 'SaaS', segment: 'SMB' },
        { id: '3', name: 'GlobalTech', arr: 280000, health_score: 92, industry: 'Enterprise', segment: 'Enterprise' },
        { id: '4', name: 'DataFlow', arr: 95000, health_score: 35, industry: 'Data', segment: 'Mid-Market' },
        { id: '5', name: 'CloudNine', arr: 150000, health_score: 78, industry: 'Cloud', segment: 'Mid-Market' }
      ];
    }

    // Group by dimension
    const groups: Record<string, any[]> = {};
    customers.forEach(c => {
      let key = 'Unknown';
      switch (dimension) {
        case 'segment':
          key = c.segment || c.industry || 'Unknown';
          break;
        case 'industry':
          key = c.industry || 'Unknown';
          break;
        case 'csm':
          key = c.csm_name || 'Unassigned';
          break;
        default:
          key = c.segment || 'Unknown';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });

    // Calculate metrics per group
    const cohorts = Object.entries(groups).map(([name, members]) => {
      const avgScore = Math.round(members.reduce((sum, c) => sum + (c.health_score || 70), 0) / members.length);
      const totalArr = members.reduce((sum, c) => sum + (c.arr || 0), 0);
      const healthyCount = members.filter(c => (c.health_score || 70) >= 70).length;

      return {
        name,
        customer_count: members.length,
        avg_health_score: avgScore,
        total_arr: totalArr,
        healthy_pct: Math.round((healthyCount / members.length) * 100),
        at_risk_count: members.filter(c => (c.health_score || 70) < 50).length
      };
    });

    // Sort by average health score descending
    cohorts.sort((a, b) => b.avg_health_score - a.avg_health_score);

    res.json({
      dimension,
      cohorts
    });
  } catch (error) {
    console.error('Health comparison error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch cohort comparison' }
    });
  }
});

export { router as healthPortfolioRoutes };
