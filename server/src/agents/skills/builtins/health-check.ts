/**
 * Health Check Skill
 * Fetches customer health score, analyzes trends, and generates recommendations
 *
 * Variables: customerId
 * Cacheable: 1 hour TTL
 */

import { Skill, SkillContext, SkillVariable, SkillStep } from '../types.js';

const variables: SkillVariable[] = [
  {
    name: 'customerId',
    type: 'string',
    required: true,
    description: 'Customer ID to analyze',
  },
  {
    name: 'customerName',
    type: 'string',
    required: false,
    description: 'Customer name for reports',
  },
  {
    name: 'includeUsageMetrics',
    type: 'boolean',
    required: false,
    description: 'Include detailed usage metrics',
    defaultValue: true,
  },
  {
    name: 'includeSentiment',
    type: 'boolean',
    required: false,
    description: 'Include sentiment analysis from communications',
    defaultValue: true,
  },
  {
    name: 'lookbackDays',
    type: 'number',
    required: false,
    description: 'Number of days to analyze for trends',
    defaultValue: 90,
    validation: { min: 7, max: 365 },
  },
  {
    name: 'generateReport',
    type: 'boolean',
    required: false,
    description: 'Generate a health check report document',
    defaultValue: false,
  },
];

const steps: SkillStep[] = [
  {
    id: 'fetch_health_score',
    name: 'Fetch Health Score',
    description: 'Retrieve the current customer health score and metrics',
    tool: 'get_health_score',
    requiresApproval: false,
    inputMapper: (ctx: SkillContext) => ({
      customerId: ctx.variables.customerId,
    }),
  },
  {
    id: 'fetch_usage_metrics',
    name: 'Fetch Usage Metrics',
    description: 'Retrieve product usage data for the customer',
    tool: 'get_usage_metrics',
    requiresApproval: false,
    condition: (ctx: SkillContext) => ctx.variables.includeUsageMetrics !== false,
    inputMapper: (ctx: SkillContext) => ({
      customerId: ctx.variables.customerId,
      lookbackDays: ctx.variables.lookbackDays || 90,
      metrics: ['daily_active_users', 'feature_adoption', 'session_duration', 'api_calls'],
    }),
  },
  {
    id: 'analyze_trends',
    name: 'Analyze Trends',
    description: 'Analyze health and usage trends over time',
    tool: 'analyze_trends',
    requiresApproval: false,
    inputMapper: (ctx: SkillContext) => ({
      customerId: ctx.variables.customerId,
      lookbackDays: ctx.variables.lookbackDays || 90,
      healthData: ctx.variables._healthScore,
      usageData: ctx.variables._usageMetrics,
    }),
  },
  {
    id: 'analyze_sentiment',
    name: 'Analyze Communication Sentiment',
    description: 'Analyze sentiment from recent customer communications',
    tool: 'analyze_sentiment',
    requiresApproval: false,
    condition: (ctx: SkillContext) => ctx.variables.includeSentiment !== false,
    inputMapper: (ctx: SkillContext) => ({
      customerId: ctx.variables.customerId,
      lookbackDays: Math.min(ctx.variables.lookbackDays || 90, 30), // Sentiment max 30 days
      sources: ['email', 'support_tickets', 'nps_responses'],
    }),
  },
  {
    id: 'generate_recommendations',
    name: 'Generate Recommendations',
    description: 'Generate actionable recommendations based on analysis',
    tool: 'generate_recommendations',
    requiresApproval: false,
    inputMapper: (ctx: SkillContext) => ({
      customerId: ctx.variables.customerId,
      customerName: ctx.variables.customerName || ctx.customer?.name,
      healthScore: ctx.variables._healthScore,
      trends: ctx.variables._trends,
      sentiment: ctx.variables._sentiment,
      arr: ctx.customer?.arr,
      tier: ctx.customer?.tier,
    }),
  },
  {
    id: 'create_report',
    name: 'Create Health Report',
    description: 'Generate a comprehensive health check report document',
    tool: 'create_document',
    requiresApproval: false,
    condition: (ctx: SkillContext) => ctx.variables.generateReport === true,
    inputMapper: (ctx: SkillContext) => {
      const customerName = ctx.variables.customerName || ctx.customer?.name || 'Customer';

      return {
        template: 'health_check_report',
        title: `${customerName} - Health Check Report (${new Date().toLocaleDateString()})`,
        variables: {
          customer_name: customerName,
          date: new Date().toLocaleDateString(),
          health_score: ctx.variables._healthScore?.score || 'N/A',
          health_trend: ctx.variables._trends?.healthTrend || 'stable',
          usage_summary: JSON.stringify(ctx.variables._usageMetrics || {}),
          sentiment_summary: ctx.variables._sentiment?.summary || 'N/A',
          recommendations: ctx.variables._recommendations?.join('\n- ') || 'None',
        },
      };
    },
  },
];

export const healthCheckSkill: Skill = {
  id: 'health-check',
  name: 'Customer Health Check',
  description: 'Fetch health score, analyze trends, and generate actionable recommendations',
  icon: 'activity',
  category: 'analysis',
  keywords: [
    'health check', 'health score', 'customer health', 'risk assessment',
    'usage analysis', 'trend analysis', 'sentiment', 'recommendations',
    'check health', 'how is', 'customer status', 'account health',
  ],
  variables,
  steps,
  cacheable: {
    enabled: true,
    ttlSeconds: 3600, // 1 hour - health data changes but not rapidly
    keyFields: ['customerId', 'lookbackDays'],
  },
  estimatedDurationSeconds: 45,
  estimatedCostSavingsPercent: 50, // Analysis can be cached
};
