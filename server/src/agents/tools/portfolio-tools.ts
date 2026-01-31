/**
 * Portfolio & Comparative Tools for Agents
 * PRD: Agent Data Access Layer
 *
 * Tools for portfolio-level analysis:
 * - get_portfolio_insights: Cross-customer analysis
 * - compare_to_cohort: Benchmark against similar customers
 */

import { Tool, ToolResult, AgentContext } from '../types.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Initialize Supabase client
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// ============================================
// get_portfolio_insights Tool
// ============================================

export const getPortfolioInsightsTool: Tool = {
  name: 'get_portfolio_insights',
  description: 'Get portfolio-level insights including health distribution, risk summary, renewal pipeline, and trends across all customers. Use this to understand the bigger picture and prioritize efforts.',
  inputSchema: {
    type: 'object',
    properties: {
      segment: {
        type: 'string',
        enum: ['all', 'enterprise', 'strategic', 'commercial', 'smb'],
        description: 'Customer segment to analyze',
        default: 'all'
      },
      focus: {
        type: 'string',
        enum: ['health', 'renewals', 'risks', 'expansion', 'engagement'],
        description: 'Primary focus area for insights',
        default: 'health'
      }
    }
  },
  requiresApproval: false,

  async execute(input: {
    segment?: 'all' | 'enterprise' | 'strategic' | 'commercial' | 'smb';
    focus?: 'health' | 'renewals' | 'risks' | 'expansion' | 'engagement';
  }, context: AgentContext): Promise<ToolResult> {
    try {
      const segment = input.segment || 'all';
      const focus = input.focus || 'health';

      // Fetch all customers
      let customers: any[] = [];

      if (supabase) {
        let query = supabase.from('customers').select('*');

        if (segment !== 'all') {
          query = query.eq('tier', segment);
        }

        const { data, error } = await query;
        if (!error && data) {
          customers = data;
        }
      }

      // If no DB data, use demo data
      if (customers.length === 0) {
        customers = generateDemoPortfolio();
        if (segment !== 'all') {
          customers = customers.filter(c => c.tier === segment);
        }
      }

      // Calculate portfolio metrics
      const totalCustomers = customers.length;
      const totalARR = customers.reduce((sum, c) => sum + (c.arr || 0), 0);
      const avgHealthScore = totalCustomers > 0
        ? Math.round(customers.reduce((sum, c) => sum + (c.health_score || 0), 0) / totalCustomers)
        : 0;

      // Health distribution
      const healthDistribution = {
        critical: customers.filter(c => (c.health_score || 0) < 40).length,
        atRisk: customers.filter(c => (c.health_score || 0) >= 40 && (c.health_score || 0) < 60).length,
        neutral: customers.filter(c => (c.health_score || 0) >= 60 && (c.health_score || 0) < 75).length,
        healthy: customers.filter(c => (c.health_score || 0) >= 75 && (c.health_score || 0) < 90).length,
        champion: customers.filter(c => (c.health_score || 0) >= 90).length
      };

      // Status distribution
      const statusDistribution = {
        active: customers.filter(c => c.status === 'active').length,
        onboarding: customers.filter(c => c.status === 'onboarding').length,
        at_risk: customers.filter(c => c.status === 'at_risk').length,
        churned: customers.filter(c => c.status === 'churned').length
      };

      // ARR at risk (customers with health < 60)
      const arrAtRisk = customers
        .filter(c => (c.health_score || 0) < 60)
        .reduce((sum, c) => sum + (c.arr || 0), 0);

      // Renewal pipeline (next 90 days)
      const now = new Date();
      const ninetyDaysOut = new Date();
      ninetyDaysOut.setDate(now.getDate() + 90);

      const upcomingRenewals = customers.filter(c => {
        if (!c.renewal_date) return false;
        const renewalDate = new Date(c.renewal_date);
        return renewalDate >= now && renewalDate <= ninetyDaysOut;
      });

      const renewalPipeline = {
        count: upcomingRenewals.length,
        totalARR: upcomingRenewals.reduce((sum, c) => sum + (c.arr || 0), 0),
        atRiskCount: upcomingRenewals.filter(c => (c.health_score || 0) < 60).length,
        atRiskARR: upcomingRenewals
          .filter(c => (c.health_score || 0) < 60)
          .reduce((sum, c) => sum + (c.arr || 0), 0)
      };

      // Focus-specific insights
      let focusInsights: any = {};

      switch (focus) {
        case 'health':
          focusInsights = {
            distribution: healthDistribution,
            avgScore: avgHealthScore,
            trend: avgHealthScore > 70 ? 'stable' : 'needs_attention',
            topConcerns: customers
              .filter(c => (c.health_score || 0) < 50)
              .sort((a, b) => (b.arr || 0) - (a.arr || 0))
              .slice(0, 5)
              .map(c => ({
                name: c.name,
                healthScore: c.health_score,
                arr: c.arr,
                status: c.status
              }))
          };
          break;

        case 'renewals':
          focusInsights = {
            pipeline: renewalPipeline,
            upcoming: upcomingRenewals
              .sort((a, b) => new Date(a.renewal_date).getTime() - new Date(b.renewal_date).getTime())
              .slice(0, 10)
              .map(c => ({
                name: c.name,
                renewalDate: c.renewal_date,
                arr: c.arr,
                healthScore: c.health_score,
                daysUntil: Math.ceil((new Date(c.renewal_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              }))
          };
          break;

        case 'risks':
          focusInsights = {
            arrAtRisk,
            customersAtRisk: healthDistribution.critical + healthDistribution.atRisk,
            topRisks: customers
              .filter(c => (c.health_score || 0) < 60 || c.status === 'at_risk')
              .sort((a, b) => (b.arr || 0) - (a.arr || 0))
              .slice(0, 10)
              .map(c => ({
                name: c.name,
                healthScore: c.health_score,
                arr: c.arr,
                riskFactors: identifyRiskFactors(c)
              }))
          };
          break;

        case 'expansion':
          const expansionCandidates = customers.filter(c =>
            (c.health_score || 0) >= 75 &&
            (c.expansion_potential === 'high' || c.expansion_potential === 'medium')
          );
          focusInsights = {
            candidates: expansionCandidates.length,
            potentialARR: expansionCandidates.reduce((sum, c) => sum + (c.arr || 0) * 0.2, 0), // Estimate 20% expansion
            topOpportunities: expansionCandidates
              .sort((a, b) => (b.arr || 0) - (a.arr || 0))
              .slice(0, 10)
              .map(c => ({
                name: c.name,
                healthScore: c.health_score,
                arr: c.arr,
                potential: c.expansion_potential,
                adoption: c.product_adoption
              }))
          };
          break;

        case 'engagement':
          const avgAdoption = Math.round(
            customers.reduce((sum, c) => sum + (c.product_adoption || 0), 0) / totalCustomers
          );
          focusInsights = {
            avgAdoption,
            lowEngagement: customers.filter(c => (c.last_activity_days || 30) > 14).length,
            highEngagement: customers.filter(c => (c.last_activity_days || 30) <= 3).length,
            needsAttention: customers
              .filter(c => (c.last_activity_days || 30) > 14)
              .sort((a, b) => (b.arr || 0) - (a.arr || 0))
              .slice(0, 10)
              .map(c => ({
                name: c.name,
                lastActivityDays: c.last_activity_days,
                arr: c.arr,
                adoption: c.product_adoption
              }))
          };
          break;
      }

      return {
        success: true,
        data: {
          segment,
          focus,
          summary: {
            totalCustomers,
            totalARR,
            avgHealthScore,
            healthDistribution,
            statusDistribution,
            arrAtRisk,
            renewalPipeline
          },
          focusInsights,
          generatedAt: new Date().toISOString()
        },
        metadata: {
          tool: 'get_portfolio_insights',
          executedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[get_portfolio_insights] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate portfolio insights'
      };
    }
  }
};

// ============================================
// compare_to_cohort Tool
// ============================================

export const compareToCohortTool: Tool = {
  name: 'compare_to_cohort',
  description: 'Compare customer metrics to cohort of similar customers (by tier, industry, ARR band, or tenure). Use this to understand how a customer performs relative to peers.',
  inputSchema: {
    type: 'object',
    properties: {
      customer_id: {
        type: 'string',
        description: 'Customer ID to compare. Uses current context if not provided.'
      },
      cohort_by: {
        type: 'string',
        enum: ['tier', 'industry', 'arr_band', 'tenure'],
        description: 'How to define the comparison cohort',
        default: 'tier'
      },
      metrics: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'Metrics to compare (default: health_score, product_adoption, nps_score)',
        default: ['health_score', 'product_adoption', 'nps_score']
      }
    }
  },
  requiresApproval: false,

  async execute(input: {
    customer_id?: string;
    cohort_by?: 'tier' | 'industry' | 'arr_band' | 'tenure';
    metrics?: string[];
  }, context: AgentContext): Promise<ToolResult> {
    try {
      const customerId = input.customer_id || context.customer?.id;
      const cohortBy = input.cohort_by || 'tier';
      const metricsToCompare = input.metrics || ['health_score', 'product_adoption', 'nps_score'];

      if (!customerId) {
        return {
          success: false,
          error: 'No customer ID provided and no customer in context'
        };
      }

      // Fetch target customer
      let targetCustomer: any = null;

      if (supabase) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single();

        if (!error) targetCustomer = data;
      }

      // Fallback to context
      if (!targetCustomer && context.customer) {
        targetCustomer = {
          id: context.customer.id,
          name: context.customer.name,
          tier: determineTier(context.customer.arr),
          industry: context.customer.industry,
          arr: context.customer.arr,
          health_score: context.customer.healthScore,
          product_adoption: 65,
          nps_score: 30
        };
      }

      if (!targetCustomer) {
        return {
          success: false,
          error: `Customer ${customerId} not found`
        };
      }

      // Fetch cohort customers
      let cohortCustomers: any[] = [];

      if (supabase) {
        let query = supabase.from('customers').select('*');

        // Apply cohort filter
        switch (cohortBy) {
          case 'tier':
            query = query.eq('tier', targetCustomer.tier || determineTier(targetCustomer.arr));
            break;
          case 'industry':
            if (targetCustomer.industry) {
              query = query.eq('industry', targetCustomer.industry);
            }
            break;
          case 'arr_band':
            const arrBand = getARRBand(targetCustomer.arr);
            query = query.gte('arr', arrBand.min).lte('arr', arrBand.max);
            break;
          // tenure would require contract_start date
        }

        const { data, error } = await query;
        if (!error && data) {
          cohortCustomers = data.filter(c => c.id !== customerId);
        }
      }

      // If no DB data, generate demo cohort
      if (cohortCustomers.length === 0) {
        cohortCustomers = generateDemoCohort(targetCustomer, cohortBy);
      }

      // Calculate cohort statistics for each metric
      const comparisons: Record<string, any> = {};

      for (const metric of metricsToCompare) {
        const customerValue = targetCustomer[metric];
        const cohortValues = cohortCustomers
          .map(c => c[metric])
          .filter(v => v !== undefined && v !== null);

        if (cohortValues.length > 0 && customerValue !== undefined) {
          const cohortAvg = Math.round(cohortValues.reduce((a, b) => a + b, 0) / cohortValues.length);
          const cohortMedian = calculateMedian(cohortValues);
          const percentile = calculatePercentile(customerValue, cohortValues);

          comparisons[metric] = {
            customerValue,
            cohortAverage: cohortAvg,
            cohortMedian,
            cohortMin: Math.min(...cohortValues),
            cohortMax: Math.max(...cohortValues),
            percentile,
            comparison: customerValue > cohortAvg ? 'above_average' :
              customerValue < cohortAvg ? 'below_average' : 'average',
            difference: customerValue - cohortAvg,
            differencePercent: Math.round(((customerValue - cohortAvg) / cohortAvg) * 100)
          };
        }
      }

      // Generate insights
      const insights = generateCohortInsights(comparisons, targetCustomer);

      return {
        success: true,
        data: {
          customerId,
          customerName: targetCustomer.name,
          cohortBy,
          cohortSize: cohortCustomers.length,
          cohortDefinition: describeCohort(targetCustomer, cohortBy),
          comparisons,
          insights,
          generatedAt: new Date().toISOString()
        },
        metadata: {
          tool: 'compare_to_cohort',
          executedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[compare_to_cohort] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compare to cohort'
      };
    }
  }
};

// ============================================
// Helper Functions
// ============================================

function determineTier(arr: number): string {
  if (arr >= 500000) return 'enterprise';
  if (arr >= 200000) return 'strategic';
  if (arr >= 50000) return 'commercial';
  return 'smb';
}

function getARRBand(arr: number): { min: number; max: number; label: string } {
  if (arr >= 500000) return { min: 500000, max: 10000000, label: '$500K+' };
  if (arr >= 200000) return { min: 200000, max: 499999, label: '$200K-$500K' };
  if (arr >= 100000) return { min: 100000, max: 199999, label: '$100K-$200K' };
  if (arr >= 50000) return { min: 50000, max: 99999, label: '$50K-$100K' };
  return { min: 0, max: 49999, label: 'Under $50K' };
}

function identifyRiskFactors(customer: any): string[] {
  const factors: string[] = [];

  if ((customer.health_score || 0) < 50) {
    factors.push('Critical health score');
  }
  if ((customer.product_adoption || 0) < 40) {
    factors.push('Low product adoption');
  }
  if ((customer.nps_score || 0) < 0) {
    factors.push('Negative NPS');
  }
  if ((customer.last_activity_days || 30) > 14) {
    factors.push('Low engagement');
  }
  if ((customer.open_tickets || 0) > 3) {
    factors.push('Multiple support tickets');
  }

  return factors.length > 0 ? factors : ['Status flagged as at-risk'];
}

function generateDemoPortfolio(): any[] {
  // Return demo customers for when no DB is available
  return [
    { id: '1', name: 'Acme Corp', tier: 'enterprise', arr: 450000, health_score: 85, status: 'active', product_adoption: 78, nps_score: 65, last_activity_days: 2, renewal_date: '2026-06-15' },
    { id: '2', name: 'TechStart Inc', tier: 'commercial', arr: 85000, health_score: 62, status: 'active', product_adoption: 45, nps_score: 25, last_activity_days: 8, renewal_date: '2026-04-01' },
    { id: '3', name: 'Global Finance', tier: 'strategic', arr: 320000, health_score: 45, status: 'at_risk', product_adoption: 35, nps_score: -10, last_activity_days: 21, renewal_date: '2026-03-15' },
    { id: '4', name: 'HealthCare Plus', tier: 'commercial', arr: 95000, health_score: 78, status: 'active', product_adoption: 72, nps_score: 55, last_activity_days: 3, renewal_date: '2026-08-01' },
    { id: '5', name: 'Retail Giants', tier: 'enterprise', arr: 520000, health_score: 91, status: 'active', product_adoption: 88, nps_score: 75, last_activity_days: 1, renewal_date: '2026-09-15', expansion_potential: 'high' }
  ];
}

function generateDemoCohort(target: any, cohortBy: string): any[] {
  // Generate synthetic cohort based on target customer
  const baseHealth = target.health_score || 70;
  const baseAdoption = target.product_adoption || 60;
  const baseNPS = target.nps_score || 30;

  return Array.from({ length: 15 }, (_, i) => ({
    id: `cohort-${i}`,
    name: `Cohort Customer ${i + 1}`,
    health_score: Math.max(20, Math.min(95, baseHealth + (Math.random() - 0.5) * 40)),
    product_adoption: Math.max(20, Math.min(95, baseAdoption + (Math.random() - 0.5) * 40)),
    nps_score: Math.max(-50, Math.min(80, baseNPS + (Math.random() - 0.5) * 60))
  }));
}

function calculateMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function calculatePercentile(value: number, values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const below = sorted.filter(v => v < value).length;
  return Math.round((below / sorted.length) * 100);
}

function describeCohort(customer: any, cohortBy: string): string {
  switch (cohortBy) {
    case 'tier':
      return `${customer.tier || 'unknown'} tier customers`;
    case 'industry':
      return `${customer.industry || 'same industry'} customers`;
    case 'arr_band':
      return `customers in ${getARRBand(customer.arr).label} ARR range`;
    case 'tenure':
      return 'customers with similar tenure';
    default:
      return 'similar customers';
  }
}

function generateCohortInsights(comparisons: Record<string, any>, customer: any): string[] {
  const insights: string[] = [];

  if (comparisons.health_score) {
    const healthComp = comparisons.health_score;
    if (healthComp.percentile >= 75) {
      insights.push(`Health score is in the top quartile (${healthComp.percentile}th percentile) of cohort`);
    } else if (healthComp.percentile <= 25) {
      insights.push(`Health score is in the bottom quartile (${healthComp.percentile}th percentile) - investigate improvement opportunities`);
    }
  }

  if (comparisons.product_adoption) {
    const adoptionComp = comparisons.product_adoption;
    if (adoptionComp.comparison === 'below_average') {
      insights.push(`Product adoption is ${Math.abs(adoptionComp.differencePercent)}% below cohort average - training opportunity`);
    } else if (adoptionComp.comparison === 'above_average' && adoptionComp.differencePercent > 20) {
      insights.push('Strong adoption leader in cohort - potential advocate or case study candidate');
    }
  }

  if (comparisons.nps_score) {
    const npsComp = comparisons.nps_score;
    if (npsComp.customerValue < 0 && npsComp.cohortAverage > 0) {
      insights.push('NPS significantly below cohort - detractor recovery needed');
    } else if (npsComp.customerValue > 50 && npsComp.percentile >= 75) {
      insights.push('Top promoter in cohort - referral opportunity');
    }
  }

  if (insights.length === 0) {
    insights.push('Customer metrics are within normal range for cohort');
  }

  return insights;
}
