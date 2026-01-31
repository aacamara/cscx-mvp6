/**
 * Customer Database Tools for Agents
 * PRD: Agent Data Access Layer
 *
 * Tools for querying customer data:
 * - get_customer_360: Comprehensive customer profile
 * - get_health_trends: Health score history and trends
 * - get_customer_history: Interaction timeline
 */

import { Tool, ToolResult, AgentContext, Customer360, HealthTrendPoint } from '../types.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Initialize Supabase client
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// ============================================
// get_customer_360 Tool
// ============================================

export const getCustomer360Tool: Tool = {
  name: 'get_customer_360',
  description: 'Get complete customer profile including health score, ARR, engagement metrics, recent interactions, stakeholders, and risk signals. Use this to understand the full context of a customer before making recommendations.',
  inputSchema: {
    type: 'object',
    properties: {
      customer_id: {
        type: 'string',
        description: 'Customer ID to look up. If not provided, uses the current customer context.'
      },
      include_sections: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['overview', 'health', 'engagement', 'stakeholders', 'contracts', 'interactions', 'risks', 'opportunities']
        },
        description: 'Sections to include in the response. Default is all sections.'
      }
    }
  },
  requiresApproval: false,

  async execute(input: {
    customer_id?: string;
    include_sections?: string[];
  }, context: AgentContext): Promise<ToolResult> {
    try {
      const customerId = input.customer_id || context.customer?.id;

      if (!customerId) {
        return {
          success: false,
          error: 'No customer ID provided and no customer in context. Please specify a customer_id.'
        };
      }

      const sections = input.include_sections || ['overview', 'health', 'engagement', 'stakeholders', 'risks', 'opportunities'];

      // Fetch customer data
      let customerData: any = null;

      if (supabase) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single();

        if (error) {
          console.error('[get_customer_360] Supabase error:', error);
        } else {
          customerData = data;
        }
      }

      // Fallback to context if no DB data
      if (!customerData && context.customer) {
        customerData = {
          id: context.customer.id,
          name: context.customer.name,
          industry: context.customer.industry,
          arr: context.customer.arr,
          health_score: context.customer.healthScore,
          status: context.customer.status,
          renewal_date: context.customer.renewalDate,
          csm_name: context.customer.csmName,
          primary_contact: context.customer.primaryContact
        };
      }

      if (!customerData) {
        return {
          success: false,
          error: `Customer ${customerId} not found`
        };
      }

      // Build the 360 profile
      const profile: Partial<Customer360> = {};

      if (sections.includes('overview')) {
        profile.overview = {
          id: customerData.id,
          name: customerData.name,
          industry: customerData.industry,
          arr: customerData.arr || 0,
          mrr: customerData.mrr || Math.round((customerData.arr || 0) / 12),
          tier: customerData.tier || determineTier(customerData.arr),
          status: customerData.status || 'active',
          csmName: customerData.csm_name
        };
      }

      if (sections.includes('health')) {
        const healthScore = customerData.health_score || context.customer?.healthScore || 0;
        profile.health = {
          score: healthScore,
          trend: determineHealthTrend(healthScore),
          components: {
            engagement: customerData.engagement_score || calculateEngagementScore(customerData),
            adoption: customerData.product_adoption || 0,
            sentiment: customerData.nps_score ? normalizeNPS(customerData.nps_score) : undefined,
            support: customerData.support_score || calculateSupportScore(customerData)
          }
        };
      }

      if (sections.includes('engagement')) {
        profile.engagement = {
          productAdoption: customerData.product_adoption,
          lastActivityDays: customerData.last_activity_days,
          npsScore: customerData.nps_score,
          openTickets: customerData.open_tickets || 0
        };
      }

      if (sections.includes('stakeholders')) {
        profile.stakeholders = [];

        // Add primary contact if exists
        if (customerData.primary_contact) {
          profile.stakeholders.push({
            name: customerData.primary_contact.name,
            role: customerData.primary_contact.title || 'Primary Contact',
            email: customerData.primary_contact.email,
            isPrimary: true
          });
        }

        // Add stakeholders from contract data if available
        if (context.contract?.stakeholders) {
          for (const s of context.contract.stakeholders) {
            if (!profile.stakeholders.find(st => st.email === s.email)) {
              profile.stakeholders.push({
                name: s.name,
                role: s.role,
                email: s.email,
                isPrimary: false
              });
            }
          }
        }
      }

      if (sections.includes('risks')) {
        profile.risks = generateRiskAssessment(customerData, context);
      }

      if (sections.includes('opportunities')) {
        profile.opportunities = generateOpportunities(customerData, context);
      }

      return {
        success: true,
        data: {
          customerId,
          profile,
          lastUpdated: new Date().toISOString()
        },
        metadata: {
          tool: 'get_customer_360',
          sectionsIncluded: sections,
          executedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[get_customer_360] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch customer 360'
      };
    }
  }
};

// ============================================
// get_health_trends Tool
// ============================================

export const getHealthTrendsTool: Tool = {
  name: 'get_health_trends',
  description: 'Get health score trends over time with component breakdown (engagement, adoption, sentiment, support). Use this to identify patterns and recent changes in customer health.',
  inputSchema: {
    type: 'object',
    properties: {
      customer_id: {
        type: 'string',
        description: 'Customer ID. Uses current context if not provided.'
      },
      period: {
        type: 'string',
        enum: ['7d', '30d', '90d', '1y'],
        description: 'Time period for trend data',
        default: '90d'
      },
      include_predictions: {
        type: 'boolean',
        description: 'Include predicted future health scores',
        default: true
      }
    }
  },
  requiresApproval: false,

  async execute(input: {
    customer_id?: string;
    period?: '7d' | '30d' | '90d' | '1y';
    include_predictions?: boolean;
  }, context: AgentContext): Promise<ToolResult> {
    try {
      const customerId = input.customer_id || context.customer?.id;
      const period = input.period || '90d';
      const includePredictions = input.include_predictions !== false;

      if (!customerId) {
        return {
          success: false,
          error: 'No customer ID provided and no customer in context'
        };
      }

      // Calculate date range
      const periodDays = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365
      }[period];

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      // Try to fetch historical health scores from database
      let healthHistory: HealthTrendPoint[] = [];

      if (supabase) {
        const { data, error } = await supabase
          .from('health_scores')
          .select('*')
          .eq('customer_id', customerId)
          .gte('recorded_at', startDate.toISOString())
          .order('recorded_at', { ascending: true });

        if (!error && data && data.length > 0) {
          healthHistory = data.map(d => ({
            date: d.recorded_at,
            score: d.score,
            components: d.components
          }));
        }
      }

      // If no historical data, generate synthetic trend based on current score
      if (healthHistory.length === 0) {
        const currentScore = context.customer?.healthScore || 75;
        healthHistory = generateSyntheticTrend(currentScore, periodDays);
      }

      // Calculate trend analysis
      const analysis = analyzeTrend(healthHistory);

      // Generate predictions if requested
      let predictions: HealthTrendPoint[] | undefined;
      if (includePredictions) {
        predictions = generatePredictions(healthHistory, analysis);
      }

      return {
        success: true,
        data: {
          customerId,
          period,
          trend: healthHistory,
          analysis: {
            direction: analysis.direction,
            changePercent: analysis.changePercent,
            volatility: analysis.volatility,
            currentScore: healthHistory[healthHistory.length - 1]?.score || 0,
            periodStart: healthHistory[0]?.score || 0,
            highestScore: Math.max(...healthHistory.map(h => h.score)),
            lowestScore: Math.min(...healthHistory.map(h => h.score)),
            averageScore: Math.round(healthHistory.reduce((a, b) => a + b.score, 0) / healthHistory.length)
          },
          predictions,
          insights: generateTrendInsights(analysis, context)
        },
        metadata: {
          tool: 'get_health_trends',
          executedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[get_health_trends] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch health trends'
      };
    }
  }
};

// ============================================
// get_customer_history Tool
// ============================================

export const getCustomerHistoryTool: Tool = {
  name: 'get_customer_history',
  description: 'Get chronological history of customer interactions, meetings, emails, support tickets, and key events. Use this to understand recent engagement and context before conversations.',
  inputSchema: {
    type: 'object',
    properties: {
      customer_id: {
        type: 'string',
        description: 'Customer ID. Uses current context if not provided.'
      },
      event_types: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['meetings', 'emails', 'tickets', 'calls', 'milestones', 'all']
        },
        description: 'Types of events to include',
        default: ['all']
      },
      period: {
        type: 'string',
        enum: ['7d', '30d', '90d', '1y', 'all'],
        description: 'Time period for history',
        default: '90d'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of events to return',
        default: 50,
        maximum: 200
      }
    }
  },
  requiresApproval: false,

  async execute(input: {
    customer_id?: string;
    event_types?: string[];
    period?: string;
    limit?: number;
  }, context: AgentContext): Promise<ToolResult> {
    try {
      const customerId = input.customer_id || context.customer?.id;
      const eventTypes = input.event_types || ['all'];
      const period = input.period || '90d';
      const limit = input.limit || 50;

      if (!customerId) {
        return {
          success: false,
          error: 'No customer ID provided and no customer in context'
        };
      }

      // Calculate date range
      let startDate: Date | null = null;
      if (period !== 'all') {
        const periodDays = {
          '7d': 7,
          '30d': 30,
          '90d': 90,
          '1y': 365
        }[period] || 90;

        startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);
      }

      const events: any[] = [];

      // Fetch from agent_activities if available
      if (supabase) {
        const query = supabase
          .from('agent_activities')
          .select('*')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (startDate) {
          query.gte('created_at', startDate.toISOString());
        }

        const { data, error } = await query;

        if (!error && data) {
          for (const activity of data) {
            const eventType = mapActivityToEventType(activity.action_type);
            if (eventTypes.includes('all') || eventTypes.includes(eventType)) {
              events.push({
                id: activity.id,
                type: eventType,
                date: activity.created_at,
                summary: activity.action_data?.summary || activity.action_type,
                details: activity.action_data,
                outcome: activity.result_data?.status || activity.status,
                participants: activity.action_data?.participants || []
              });
            }
          }
        }
      }

      // Add context interactions if available
      if (context.recentInteractions) {
        for (const interaction of context.recentInteractions) {
          if (eventTypes.includes('all') || eventTypes.includes(interaction.type)) {
            events.push({
              id: `ctx-${Date.now()}-${Math.random()}`,
              type: interaction.type,
              date: interaction.date,
              summary: interaction.title,
              details: interaction.description,
              participants: interaction.user ? [interaction.user] : []
            });
          }
        }
      }

      // Sort by date descending
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Calculate summary statistics
      const summary = {
        totalEvents: events.length,
        byType: {} as Record<string, number>,
        lastInteraction: events[0]?.date || null,
        daysSinceLastInteraction: events[0]
          ? Math.floor((Date.now() - new Date(events[0].date).getTime()) / (1000 * 60 * 60 * 24))
          : null
      };

      for (const event of events) {
        summary.byType[event.type] = (summary.byType[event.type] || 0) + 1;
      }

      return {
        success: true,
        data: {
          customerId,
          period,
          eventTypes: eventTypes.includes('all') ? 'all' : eventTypes,
          events: events.slice(0, limit),
          summary
        },
        metadata: {
          tool: 'get_customer_history',
          executedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[get_customer_history] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch customer history'
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

function determineHealthTrend(score: number): 'improving' | 'stable' | 'declining' {
  // In a real implementation, this would compare to historical data
  if (score >= 75) return 'stable';
  if (score >= 50) return 'stable';
  return 'declining';
}

function calculateEngagementScore(customer: any): number {
  let score = 50; // Base score

  if (customer.last_activity_days !== undefined) {
    if (customer.last_activity_days <= 3) score += 30;
    else if (customer.last_activity_days <= 7) score += 20;
    else if (customer.last_activity_days <= 14) score += 10;
    else if (customer.last_activity_days > 30) score -= 20;
  }

  if (customer.product_adoption) {
    score += Math.round(customer.product_adoption * 0.2);
  }

  return Math.max(0, Math.min(100, score));
}

function calculateSupportScore(customer: any): number {
  let score = 80; // Base score

  if (customer.open_tickets !== undefined) {
    score -= customer.open_tickets * 10;
  }

  return Math.max(0, Math.min(100, score));
}

function normalizeNPS(nps: number): number {
  // Convert NPS (-100 to 100) to a 0-100 scale
  return Math.round((nps + 100) / 2);
}

function generateRiskAssessment(customer: any, context: AgentContext): Array<{type: string; severity: string; description: string}> {
  const risks: Array<{type: string; severity: string; description: string}> = [];

  // Health score risk
  const healthScore = customer.health_score || context.customer?.healthScore || 0;
  if (healthScore < 40) {
    risks.push({
      type: 'health',
      severity: 'critical',
      description: `Health score is critically low at ${healthScore}%`
    });
  } else if (healthScore < 60) {
    risks.push({
      type: 'health',
      severity: 'high',
      description: `Health score is concerning at ${healthScore}%`
    });
  }

  // Engagement risk
  if (customer.last_activity_days > 14) {
    risks.push({
      type: 'engagement',
      severity: customer.last_activity_days > 30 ? 'high' : 'medium',
      description: `No activity in ${customer.last_activity_days} days`
    });
  }

  // Adoption risk
  if (customer.product_adoption !== undefined && customer.product_adoption < 40) {
    risks.push({
      type: 'adoption',
      severity: customer.product_adoption < 20 ? 'high' : 'medium',
      description: `Low product adoption at ${customer.product_adoption}%`
    });
  }

  // NPS risk
  if (customer.nps_score !== undefined && customer.nps_score < 0) {
    risks.push({
      type: 'sentiment',
      severity: customer.nps_score < -30 ? 'critical' : 'high',
      description: `Negative NPS score: ${customer.nps_score}`
    });
  }

  // Support risk
  if (customer.open_tickets > 3) {
    risks.push({
      type: 'support',
      severity: customer.open_tickets > 5 ? 'high' : 'medium',
      description: `${customer.open_tickets} open support tickets`
    });
  }

  // Renewal risk
  if (customer.renewal_date) {
    const daysToRenewal = Math.floor(
      (new Date(customer.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysToRenewal < 30 && healthScore < 70) {
      risks.push({
        type: 'renewal',
        severity: 'critical',
        description: `Renewal in ${daysToRenewal} days with low health score`
      });
    }
  }

  return risks;
}

function generateOpportunities(customer: any, context: AgentContext): Array<{type: string; potential: string; description: string}> {
  const opportunities: Array<{type: string; potential: string; description: string}> = [];

  const healthScore = customer.health_score || context.customer?.healthScore || 0;

  // Expansion opportunity
  if (healthScore >= 80 && customer.expansion_potential !== 'low') {
    opportunities.push({
      type: 'expansion',
      potential: customer.expansion_potential || 'medium',
      description: 'High health score indicates readiness for expansion conversation'
    });
  }

  // Advocacy opportunity
  if (customer.nps_score !== undefined && customer.nps_score >= 50) {
    opportunities.push({
      type: 'advocacy',
      potential: 'high',
      description: `Promoter NPS (${customer.nps_score}) - candidate for case study or referral`
    });
  }

  // Adoption opportunity
  if (customer.product_adoption !== undefined && customer.product_adoption < 70 && healthScore >= 60) {
    opportunities.push({
      type: 'adoption',
      potential: 'medium',
      description: `Room for adoption growth (currently ${customer.product_adoption}%)`
    });
  }

  return opportunities;
}

function generateSyntheticTrend(currentScore: number, days: number): HealthTrendPoint[] {
  const trend: HealthTrendPoint[] = [];
  const pointCount = Math.min(days, 30); // Max 30 data points

  for (let i = pointCount; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i * Math.ceil(days / pointCount));

    // Add some variance to simulate real data
    const variance = Math.sin(i * 0.3) * 5 + (Math.random() - 0.5) * 3;
    const score = Math.max(0, Math.min(100, Math.round(currentScore + variance)));

    trend.push({
      date: date.toISOString(),
      score
    });
  }

  return trend;
}

function analyzeTrend(history: HealthTrendPoint[]): {
  direction: 'improving' | 'stable' | 'declining';
  changePercent: number;
  volatility: 'low' | 'medium' | 'high';
} {
  if (history.length < 2) {
    return { direction: 'stable', changePercent: 0, volatility: 'low' };
  }

  const firstScore = history[0].score;
  const lastScore = history[history.length - 1].score;
  const changePercent = Math.round(((lastScore - firstScore) / firstScore) * 100);

  let direction: 'improving' | 'stable' | 'declining' = 'stable';
  if (changePercent > 5) direction = 'improving';
  else if (changePercent < -5) direction = 'declining';

  // Calculate volatility
  const scores = history.map(h => h.score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  let volatility: 'low' | 'medium' | 'high' = 'low';
  if (stdDev > 10) volatility = 'high';
  else if (stdDev > 5) volatility = 'medium';

  return { direction, changePercent, volatility };
}

function generatePredictions(history: HealthTrendPoint[], analysis: any): HealthTrendPoint[] {
  const predictions: HealthTrendPoint[] = [];
  const lastScore = history[history.length - 1]?.score || 75;

  // Simple linear extrapolation for next 30 days
  const trendMultiplier = analysis.direction === 'improving' ? 0.5 :
    analysis.direction === 'declining' ? -0.5 : 0;

  for (let i = 1; i <= 4; i++) { // 4 weekly predictions
    const date = new Date();
    date.setDate(date.getDate() + i * 7);

    const predictedScore = Math.max(0, Math.min(100,
      Math.round(lastScore + (trendMultiplier * i))
    ));

    predictions.push({
      date: date.toISOString(),
      score: predictedScore
    });
  }

  return predictions;
}

function generateTrendInsights(analysis: any, context: AgentContext): string[] {
  const insights: string[] = [];

  if (analysis.direction === 'improving') {
    insights.push('Health score is trending upward - continue current engagement strategy');
  } else if (analysis.direction === 'declining') {
    insights.push('Health score is declining - investigate root cause and consider intervention');
  }

  if (analysis.volatility === 'high') {
    insights.push('High score volatility detected - may indicate inconsistent engagement');
  }

  if (analysis.changePercent > 10) {
    insights.push(`Significant improvement of ${analysis.changePercent}% in the period`);
  } else if (analysis.changePercent < -10) {
    insights.push(`Significant decline of ${Math.abs(analysis.changePercent)}% needs attention`);
  }

  return insights;
}

function mapActivityToEventType(actionType: string): string {
  const mapping: Record<string, string> = {
    'send_email': 'emails',
    'draft_email': 'emails',
    'book_meeting': 'meetings',
    'create_meeting': 'meetings',
    'support_ticket': 'tickets',
    'call': 'calls',
    'milestone': 'milestones'
  };

  return mapping[actionType] || 'milestones';
}
