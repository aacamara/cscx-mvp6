/**
 * Metrics & Analytics Tools for Agents
 * PRD: Agent Data Access Layer
 *
 * Tools for querying metrics and analytics:
 * - get_engagement_metrics: Product engagement and usage data
 * - get_risk_signals: Current risk indicators
 * - get_renewal_forecast: Renewal likelihood and recommendations
 */

import { Tool, ToolResult, AgentContext, RiskSignalData, RenewalForecast } from '../types.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Initialize Supabase client
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// ============================================
// get_engagement_metrics Tool
// ============================================

export const getEngagementMetricsTool: Tool = {
  name: 'get_engagement_metrics',
  description: 'Get product engagement metrics including DAU/MAU, feature adoption, login frequency, and usage trends. Useful for understanding customer adoption and identifying engagement issues.',
  inputSchema: {
    type: 'object',
    properties: {
      customer_id: {
        type: 'string',
        description: 'Customer ID. Uses current context if not provided.'
      },
      metrics: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['dau_mau', 'feature_adoption', 'login_frequency', 'session_duration', 'api_usage', 'all']
        },
        description: 'Specific metrics to retrieve',
        default: ['all']
      },
      period: {
        type: 'string',
        enum: ['7d', '30d', '90d'],
        description: 'Time period for metrics',
        default: '30d'
      },
      compare_to_cohort: {
        type: 'boolean',
        description: 'Include cohort comparison data',
        default: true
      }
    }
  },
  requiresApproval: false,

  async execute(input: {
    customer_id?: string;
    metrics?: string[];
    period?: '7d' | '30d' | '90d';
    compare_to_cohort?: boolean;
  }, context: AgentContext): Promise<ToolResult> {
    try {
      const customerId = input.customer_id || context.customer?.id;
      const requestedMetrics = input.metrics || ['all'];
      const period = input.period || '30d';
      const compareToCohort = input.compare_to_cohort !== false;

      if (!customerId) {
        return {
          success: false,
          error: 'No customer ID provided and no customer in context'
        };
      }

      // Fetch customer data
      let customerData: any = null;

      if (supabase) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single();

        if (!error) customerData = data;
      }

      // Fallback to context
      if (!customerData && context.customer) {
        customerData = {
          product_adoption: 65,
          last_activity_days: 2,
          nps_score: context.customer.healthScore > 70 ? 45 : 15
        };
      }

      // Build metrics response
      const metricsData: Record<string, any> = {};
      const includeMetric = (name: string) => requestedMetrics.includes('all') || requestedMetrics.includes(name);

      if (includeMetric('feature_adoption')) {
        const adoption = customerData?.product_adoption || 0;
        metricsData.feature_adoption = {
          value: adoption,
          unit: '%',
          trend: adoption > 60 ? 'stable' : 'declining',
          cohortAverage: compareToCohort ? 68 : undefined,
          percentile: compareToCohort ? Math.min(99, Math.round((adoption / 100) * 100)) : undefined
        };
      }

      if (includeMetric('login_frequency')) {
        const lastActivity = customerData?.last_activity_days || 7;
        const frequency = lastActivity <= 1 ? 'daily' :
          lastActivity <= 3 ? 'frequent' :
            lastActivity <= 7 ? 'weekly' : 'infrequent';

        metricsData.login_frequency = {
          value: frequency,
          lastActivityDays: lastActivity,
          trend: lastActivity <= 3 ? 'healthy' : 'concerning',
          cohortAverage: compareToCohort ? 'weekly' : undefined
        };
      }

      if (includeMetric('dau_mau')) {
        // Estimate DAU/MAU based on available data
        const dauMau = customerData?.product_adoption
          ? Math.round(customerData.product_adoption * 0.4)
          : 25;

        metricsData.dau_mau = {
          value: dauMau,
          unit: '%',
          interpretation: dauMau > 30 ? 'high engagement' :
            dauMau > 15 ? 'moderate engagement' : 'low engagement',
          cohortAverage: compareToCohort ? 28 : undefined
        };
      }

      if (includeMetric('session_duration')) {
        metricsData.session_duration = {
          value: 12,
          unit: 'minutes',
          trend: 'stable',
          cohortAverage: compareToCohort ? 15 : undefined
        };
      }

      if (includeMetric('api_usage')) {
        metricsData.api_usage = {
          value: customerData?.product_adoption ? customerData.product_adoption * 100 : 5000,
          unit: 'calls/day',
          trend: 'stable',
          cohortAverage: compareToCohort ? 7500 : undefined
        };
      }

      // Generate insights
      const insights = generateEngagementInsights(metricsData, customerData);

      return {
        success: true,
        data: {
          customerId,
          period,
          metrics: metricsData,
          insights,
          lastUpdated: new Date().toISOString()
        },
        metadata: {
          tool: 'get_engagement_metrics',
          executedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[get_engagement_metrics] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch engagement metrics'
      };
    }
  }
};

// ============================================
// get_risk_signals Tool
// ============================================

export const getRiskSignalsTool: Tool = {
  name: 'get_risk_signals',
  description: 'Get current risk signals including churn indicators, engagement drops, sentiment issues, and support escalations. Use this to identify and prioritize customers needing attention.',
  inputSchema: {
    type: 'object',
    properties: {
      customer_id: {
        type: 'string',
        description: 'Customer ID. Uses current context if not provided.'
      },
      signal_types: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['churn', 'engagement', 'sentiment', 'support', 'payment', 'all']
        },
        description: 'Types of risk signals to check',
        default: ['all']
      },
      severity_filter: {
        type: 'string',
        enum: ['critical', 'high', 'medium', 'low', 'all'],
        description: 'Filter by severity level',
        default: 'all'
      }
    }
  },
  requiresApproval: false,

  async execute(input: {
    customer_id?: string;
    signal_types?: string[];
    severity_filter?: string;
  }, context: AgentContext): Promise<ToolResult> {
    try {
      const customerId = input.customer_id || context.customer?.id;
      const signalTypes = input.signal_types || ['all'];
      const severityFilter = input.severity_filter || 'all';

      if (!customerId) {
        return {
          success: false,
          error: 'No customer ID provided and no customer in context'
        };
      }

      // Fetch customer data
      let customerData: any = null;

      if (supabase) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single();

        if (!error) customerData = data;
      }

      // Fallback to context
      if (!customerData && context.customer) {
        customerData = {
          health_score: context.customer.healthScore,
          status: context.customer.status,
          product_adoption: 65,
          last_activity_days: 5,
          nps_score: 20,
          open_tickets: 2,
          renewal_date: context.customer.renewalDate
        };
      }

      // Detect risk signals
      const signals: RiskSignalData[] = [];
      const includeType = (type: string) => signalTypes.includes('all') || signalTypes.includes(type);
      const includeSeverity = (severity: string) =>
        severityFilter === 'all' ||
        severity === severityFilter ||
        (severityFilter === 'high' && (severity === 'critical' || severity === 'high')) ||
        (severityFilter === 'medium' && severity !== 'low');

      // Churn signals
      if (includeType('churn')) {
        const healthScore = customerData?.health_score || context.customer?.healthScore || 0;

        if (healthScore < 40) {
          const signal: RiskSignalData = {
            type: 'churn',
            severity: 'critical',
            description: `Critical health score of ${healthScore}% indicates high churn risk`,
            detectedAt: new Date().toISOString(),
            recommendation: 'Immediate executive escalation and intervention required'
          };
          if (includeSeverity(signal.severity)) signals.push(signal);
        } else if (healthScore < 60) {
          const signal: RiskSignalData = {
            type: 'churn',
            severity: 'high',
            description: `Low health score of ${healthScore}% indicates elevated churn risk`,
            detectedAt: new Date().toISOString(),
            recommendation: 'Schedule health review call within 48 hours'
          };
          if (includeSeverity(signal.severity)) signals.push(signal);
        }

        // Renewal proximity risk
        if (customerData?.renewal_date) {
          const daysToRenewal = Math.floor(
            (new Date(customerData.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          if (daysToRenewal < 30 && healthScore < 70) {
            const signal: RiskSignalData = {
              type: 'churn',
              severity: 'critical',
              description: `Renewal in ${daysToRenewal} days with concerning health score`,
              detectedAt: new Date().toISOString(),
              recommendation: 'Prioritize renewal conversation and address health issues immediately'
            };
            if (includeSeverity(signal.severity)) signals.push(signal);
          }
        }
      }

      // Engagement signals
      if (includeType('engagement')) {
        const lastActivity = customerData?.last_activity_days || 30;
        const adoption = customerData?.product_adoption || 0;

        if (lastActivity > 14) {
          const signal: RiskSignalData = {
            type: 'engagement',
            severity: lastActivity > 30 ? 'high' : 'medium',
            description: `No activity for ${lastActivity} days - engagement risk`,
            detectedAt: new Date().toISOString(),
            recommendation: lastActivity > 30
              ? 'Immediate outreach required - check for issues'
              : 'Schedule check-in call to understand engagement drop'
          };
          if (includeSeverity(signal.severity)) signals.push(signal);
        }

        if (adoption < 40) {
          const signal: RiskSignalData = {
            type: 'engagement',
            severity: adoption < 20 ? 'high' : 'medium',
            description: `Low product adoption at ${adoption}%`,
            detectedAt: new Date().toISOString(),
            recommendation: 'Schedule adoption review and training session'
          };
          if (includeSeverity(signal.severity)) signals.push(signal);
        }
      }

      // Sentiment signals
      if (includeType('sentiment')) {
        const nps = customerData?.nps_score;

        if (nps !== undefined && nps < 0) {
          const signal: RiskSignalData = {
            type: 'sentiment',
            severity: nps < -30 ? 'critical' : 'high',
            description: `Detractor NPS score of ${nps}`,
            detectedAt: new Date().toISOString(),
            recommendation: 'Conduct detractor recovery call and document feedback'
          };
          if (includeSeverity(signal.severity)) signals.push(signal);
        }
      }

      // Support signals
      if (includeType('support')) {
        const openTickets = customerData?.open_tickets || 0;

        if (openTickets > 3) {
          const signal: RiskSignalData = {
            type: 'support',
            severity: openTickets > 5 ? 'high' : 'medium',
            description: `${openTickets} open support tickets`,
            detectedAt: new Date().toISOString(),
            recommendation: 'Review ticket backlog and prioritize resolution'
          };
          if (includeSeverity(signal.severity)) signals.push(signal);
        }
      }

      // Payment signals (placeholder - would integrate with billing system)
      if (includeType('payment')) {
        // Check context risk signals
        const paymentRisks = context.riskSignals?.filter(r => r.type === 'churn');
        for (const risk of paymentRisks || []) {
          const signal: RiskSignalData = {
            type: 'payment',
            severity: risk.severity as RiskSignalData['severity'],
            description: risk.description,
            detectedAt: risk.detectedAt.toISOString(),
            recommendation: 'Contact billing to resolve payment issues'
          };
          if (includeSeverity(signal.severity)) signals.push(signal);
        }
      }

      // Sort by severity
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      signals.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      // Generate summary
      const summary = {
        totalSignals: signals.length,
        critical: signals.filter(s => s.severity === 'critical').length,
        high: signals.filter(s => s.severity === 'high').length,
        medium: signals.filter(s => s.severity === 'medium').length,
        low: signals.filter(s => s.severity === 'low').length,
        overallRiskLevel: signals.some(s => s.severity === 'critical') ? 'critical' :
          signals.some(s => s.severity === 'high') ? 'high' :
            signals.some(s => s.severity === 'medium') ? 'medium' :
              signals.length > 0 ? 'low' : 'none'
      };

      return {
        success: true,
        data: {
          customerId,
          signals,
          summary,
          checkedAt: new Date().toISOString()
        },
        metadata: {
          tool: 'get_risk_signals',
          signalTypesChecked: signalTypes,
          severityFilter,
          executedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[get_risk_signals] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch risk signals'
      };
    }
  }
};

// ============================================
// get_renewal_forecast Tool
// ============================================

export const getRenewalForecastTool: Tool = {
  name: 'get_renewal_forecast',
  description: 'Get renewal forecast including probability, expansion potential, risk factors, and recommended actions. Use this to prioritize renewals and plan renewal conversations.',
  inputSchema: {
    type: 'object',
    properties: {
      customer_id: {
        type: 'string',
        description: 'Customer ID. Uses current context if not provided.'
      },
      include_recommendations: {
        type: 'boolean',
        description: 'Include recommended actions for improving renewal likelihood',
        default: true
      }
    }
  },
  requiresApproval: false,

  async execute(input: {
    customer_id?: string;
    include_recommendations?: boolean;
  }, context: AgentContext): Promise<ToolResult> {
    try {
      const customerId = input.customer_id || context.customer?.id;
      const includeRecommendations = input.include_recommendations !== false;

      if (!customerId) {
        return {
          success: false,
          error: 'No customer ID provided and no customer in context'
        };
      }

      // Fetch customer data
      let customerData: any = null;

      if (supabase) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single();

        if (!error) customerData = data;
      }

      // Fallback to context
      if (!customerData && context.customer) {
        customerData = {
          health_score: context.customer.healthScore,
          status: context.customer.status,
          arr: context.customer.arr,
          product_adoption: 65,
          nps_score: 30,
          renewal_date: context.customer.renewalDate,
          expansion_potential: 'medium'
        };
      }

      // Calculate renewal probability
      const healthScore = customerData?.health_score || context.customer?.healthScore || 50;
      const nps = customerData?.nps_score || 0;
      const adoption = customerData?.product_adoption || 50;

      // Weighted probability calculation
      let probability = (healthScore * 0.4) + (normalizeNPS(nps) * 0.3) + (adoption * 0.3);
      probability = Math.max(10, Math.min(95, Math.round(probability)));

      // Adjust for at-risk status
      if (customerData?.status === 'at_risk' || context.customer?.status === 'at_risk') {
        probability = Math.max(10, probability - 20);
      }

      // Calculate days until renewal
      let daysUntilRenewal = 365;
      let renewalDate: string | undefined;

      if (customerData?.renewal_date) {
        renewalDate = customerData.renewal_date;
        daysUntilRenewal = Math.floor(
          (new Date(customerData.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
      }

      // Determine expansion potential
      let expansionPotential: RenewalForecast['expansionPotential'] = 'medium';
      if (healthScore >= 80 && adoption >= 70) {
        expansionPotential = 'high';
      } else if (healthScore < 60 || adoption < 40) {
        expansionPotential = 'low';
      }

      // Identify risk factors
      const riskFactors: string[] = [];

      if (healthScore < 60) {
        riskFactors.push(`Low health score (${healthScore}%)`);
      }
      if (nps < 0) {
        riskFactors.push(`Negative NPS (${nps})`);
      }
      if (adoption < 50) {
        riskFactors.push(`Low product adoption (${adoption}%)`);
      }
      if (customerData?.open_tickets > 3) {
        riskFactors.push(`Multiple open support tickets (${customerData.open_tickets})`);
      }
      if (customerData?.last_activity_days > 14) {
        riskFactors.push(`Low recent engagement (${customerData.last_activity_days} days since last activity)`);
      }
      if (daysUntilRenewal < 30) {
        riskFactors.push('Renewal is imminent');
      }

      // Generate recommendations if requested
      const recommendedActions: string[] = [];

      if (includeRecommendations) {
        if (daysUntilRenewal < 30) {
          recommendedActions.push('Schedule renewal conversation immediately');
        } else if (daysUntilRenewal < 90) {
          recommendedActions.push('Begin renewal preparation and discovery');
        }

        if (healthScore < 70) {
          recommendedActions.push('Conduct health review to identify improvement areas');
        }

        if (adoption < 60) {
          recommendedActions.push('Schedule training/enablement session to boost adoption');
        }

        if (nps < 20) {
          recommendedActions.push('Gather feedback and address satisfaction concerns');
        }

        if (expansionPotential === 'high') {
          recommendedActions.push('Explore expansion opportunities during renewal');
        }

        if (customerData?.open_tickets > 0) {
          recommendedActions.push('Resolve open support tickets before renewal conversation');
        }

        // Always have at least one recommendation
        if (recommendedActions.length === 0) {
          recommendedActions.push('Continue standard engagement and monitor health metrics');
        }
      }

      const forecast: RenewalForecast = {
        probability,
        expansionPotential,
        riskFactors,
        recommendedActions,
        daysUntilRenewal,
        renewalDate
      };

      return {
        success: true,
        data: {
          customerId,
          forecast,
          confidence: probability > 70 ? 'high' : probability > 50 ? 'medium' : 'low',
          lastCalculated: new Date().toISOString()
        },
        metadata: {
          tool: 'get_renewal_forecast',
          executedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[get_renewal_forecast] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate renewal forecast'
      };
    }
  }
};

// ============================================
// Helper Functions
// ============================================

function normalizeNPS(nps: number): number {
  // Convert NPS (-100 to 100) to 0-100 scale
  return Math.round((nps + 100) / 2);
}

function generateEngagementInsights(metrics: Record<string, any>, customerData: any): string[] {
  const insights: string[] = [];

  if (metrics.feature_adoption?.value < 50) {
    insights.push('Feature adoption is below average - consider targeted training');
  } else if (metrics.feature_adoption?.value >= 80) {
    insights.push('Strong feature adoption indicates engaged power user');
  }

  if (metrics.login_frequency?.lastActivityDays > 7) {
    insights.push('Login frequency has dropped - investigate potential issues');
  }

  if (metrics.dau_mau?.value < 20) {
    insights.push('Low DAU/MAU ratio suggests sporadic usage - opportunity for deeper engagement');
  }

  if (metrics.feature_adoption?.percentile && metrics.feature_adoption.percentile < 25) {
    insights.push('Adoption is in bottom quartile compared to cohort');
  } else if (metrics.feature_adoption?.percentile && metrics.feature_adoption.percentile > 75) {
    insights.push('Adoption exceeds 75% of similar customers');
  }

  return insights.length > 0 ? insights : ['Engagement metrics are within normal ranges'];
}
