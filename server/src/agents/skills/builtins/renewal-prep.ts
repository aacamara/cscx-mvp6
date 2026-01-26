/**
 * Renewal Prep Skill
 * Prepares materials for upcoming renewal including usage data, QBR deck, and proposal
 *
 * Variables: customerId, renewalDate
 * Cacheable: 24 hour TTL
 */

import { Skill, SkillContext, SkillVariable, SkillStep } from '../types.js';

const variables: SkillVariable[] = [
  {
    name: 'customerId',
    type: 'string',
    required: true,
    description: 'Customer ID for renewal preparation',
  },
  {
    name: 'customerName',
    type: 'string',
    required: false,
    description: 'Customer name for documents',
  },
  {
    name: 'renewalDate',
    type: 'date',
    required: true,
    description: 'Upcoming renewal date',
  },
  {
    name: 'currentArr',
    type: 'number',
    required: false,
    description: 'Current ARR for the customer',
  },
  {
    name: 'proposedArr',
    type: 'number',
    required: false,
    description: 'Proposed ARR for renewal (if upsell)',
  },
  {
    name: 'includeQbrDeck',
    type: 'boolean',
    required: false,
    description: 'Generate a QBR presentation',
    defaultValue: true,
  },
  {
    name: 'includeProposal',
    type: 'boolean',
    required: false,
    description: 'Generate a renewal proposal document',
    defaultValue: true,
  },
  {
    name: 'includeValueSummary',
    type: 'boolean',
    required: false,
    description: 'Include value realization summary',
    defaultValue: true,
  },
];

const steps: SkillStep[] = [
  {
    id: 'gather_usage_data',
    name: 'Gather Usage Data',
    description: 'Collect comprehensive usage metrics for the contract period',
    tool: 'get_usage_metrics',
    requiresApproval: false,
    inputMapper: (ctx: SkillContext) => {
      // Calculate lookback from renewal date (full contract period)
      const renewalDate = new Date(ctx.variables.renewalDate);
      const lookbackDays = Math.min(365, Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) + 365);

      return {
        customerId: ctx.variables.customerId,
        lookbackDays,
        metrics: [
          'daily_active_users',
          'monthly_active_users',
          'feature_adoption',
          'api_calls',
          'storage_used',
          'seats_provisioned',
          'seats_active',
        ],
        aggregation: 'monthly',
      };
    },
  },
  {
    id: 'gather_health_history',
    name: 'Gather Health History',
    description: 'Collect health score trends over time',
    tool: 'get_health_history',
    requiresApproval: false,
    inputMapper: (ctx: SkillContext) => ({
      customerId: ctx.variables.customerId,
      lookbackDays: 365,
    }),
  },
  {
    id: 'calculate_value_metrics',
    name: 'Calculate Value Metrics',
    description: 'Calculate ROI and value realization metrics',
    tool: 'calculate_value_metrics',
    requiresApproval: false,
    condition: (ctx: SkillContext) => ctx.variables.includeValueSummary !== false,
    inputMapper: (ctx: SkillContext) => ({
      customerId: ctx.variables.customerId,
      usageData: ctx.variables._usageMetrics,
      currentArr: ctx.variables.currentArr || ctx.customer?.arr,
    }),
  },
  {
    id: 'create_qbr_deck',
    name: 'Create QBR Deck',
    description: 'Generate a QBR presentation with usage and value data',
    tool: 'create_presentation',
    requiresApproval: false,
    condition: (ctx: SkillContext) => ctx.variables.includeQbrDeck !== false,
    inputMapper: (ctx: SkillContext) => {
      const customerName = ctx.variables.customerName || ctx.customer?.name || 'Customer';
      const renewalDate = new Date(ctx.variables.renewalDate);
      const quarter = `Q${Math.ceil((renewalDate.getMonth() + 1) / 3)} ${renewalDate.getFullYear()}`;

      return {
        template: 'qbr_deck',
        title: `${customerName} - ${quarter} QBR`,
        variables: {
          customer_name: customerName,
          quarter: quarter,
          health_score: ctx.variables._healthHistory?.currentScore || 'N/A',
          health_trend: ctx.variables._healthHistory?.trend || 'stable',
          arr: ctx.variables.currentArr || ctx.customer?.arr || 'N/A',
          usage_highlights: JSON.stringify(ctx.variables._usageMetrics?.highlights || []),
          value_metrics: JSON.stringify(ctx.variables._valueMetrics || {}),
          renewal_date: renewalDate.toLocaleDateString(),
        },
      };
    },
  },
  {
    id: 'draft_renewal_proposal',
    name: 'Draft Renewal Proposal',
    description: 'Create a renewal proposal document',
    tool: 'create_document',
    requiresApproval: false,
    condition: (ctx: SkillContext) => ctx.variables.includeProposal !== false,
    inputMapper: (ctx: SkillContext) => {
      const customerName = ctx.variables.customerName || ctx.customer?.name || 'Customer';
      const renewalDate = new Date(ctx.variables.renewalDate);
      const currentArr = ctx.variables.currentArr || ctx.customer?.arr || 0;
      const proposedArr = ctx.variables.proposedArr || currentArr;
      const isUpsell = proposedArr > currentArr;

      return {
        template: 'renewal_proposal',
        title: `${customerName} - Renewal Proposal ${renewalDate.getFullYear()}`,
        variables: {
          customer_name: customerName,
          renewal_date: renewalDate.toLocaleDateString(),
          current_arr: currentArr.toLocaleString(),
          proposed_arr: proposedArr.toLocaleString(),
          change_percent: ((proposedArr - currentArr) / currentArr * 100).toFixed(1),
          is_upsell: isUpsell,
          value_delivered: JSON.stringify(ctx.variables._valueMetrics || {}),
          usage_summary: ctx.variables._usageMetrics?.summary || 'See attached data',
          renewal_terms: '12 months',
        },
      };
    },
  },
  {
    id: 'create_value_summary',
    name: 'Create Value Summary',
    description: 'Generate a one-page value realization summary',
    tool: 'create_document',
    requiresApproval: false,
    condition: (ctx: SkillContext) => ctx.variables.includeValueSummary !== false,
    inputMapper: (ctx: SkillContext) => {
      const customerName = ctx.variables.customerName || ctx.customer?.name || 'Customer';

      return {
        template: 'value_summary',
        title: `${customerName} - Value Summary`,
        variables: {
          customer_name: customerName,
          date: new Date().toLocaleDateString(),
          roi: ctx.variables._valueMetrics?.roi || 'Calculating...',
          time_saved_hours: ctx.variables._valueMetrics?.timeSavedHours || 'N/A',
          cost_savings: ctx.variables._valueMetrics?.costSavings?.toLocaleString() || 'N/A',
          key_achievements: ctx.variables._valueMetrics?.achievements?.join('\n- ') || 'TBD',
          adoption_rate: ctx.variables._usageMetrics?.adoptionRate || 'N/A',
        },
      };
    },
  },
  {
    id: 'compile_materials',
    name: 'Compile Renewal Materials',
    description: 'Organize all renewal materials in a folder',
    tool: 'organize_folder',
    requiresApproval: false,
    inputMapper: (ctx: SkillContext) => {
      const customerName = ctx.variables.customerName || ctx.customer?.name || 'Customer';
      const renewalDate = new Date(ctx.variables.renewalDate);

      return {
        customerName,
        folderName: `${customerName} - Renewal ${renewalDate.getFullYear()}`,
        documents: [
          ctx.variables._qbrDeckId && { id: ctx.variables._qbrDeckId, type: 'presentation' },
          ctx.variables._proposalId && { id: ctx.variables._proposalId, type: 'document' },
          ctx.variables._valueSummaryId && { id: ctx.variables._valueSummaryId, type: 'document' },
        ].filter(Boolean),
      };
    },
  },
];

export const renewalPrepSkill: Skill = {
  id: 'renewal-prep',
  name: 'Prepare Renewal Materials',
  description: 'Gather usage data, create QBR deck, draft renewal proposal, and generate value summary',
  icon: 'refresh-cw',
  category: 'renewal',
  keywords: [
    'renewal', 'renew', 'renewal prep', 'renewal preparation',
    'qbr', 'quarterly business review', 'value summary',
    'renewal proposal', 'contract renewal', 'renewal materials',
    'prepare renewal', 'renewal package', 'upsell',
  ],
  variables,
  steps,
  cacheable: {
    enabled: true,
    ttlSeconds: 86400, // 24 hours - data is relatively stable
    keyFields: ['customerId', 'renewalDate'],
  },
  estimatedDurationSeconds: 300,
  estimatedCostSavingsPercent: 40, // Templates and some data cached
};
