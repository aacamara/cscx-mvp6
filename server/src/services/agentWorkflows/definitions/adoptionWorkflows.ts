/**
 * Adoption Agent Workflow Definitions
 */

import type { WorkflowDefinition, AdoptionWorkflowId } from '../types.js';

export const adoptionWorkflows: Record<AdoptionWorkflowId, WorkflowDefinition> = {
  // ============================================
  // ANALYZE USAGE METRICS
  // ============================================
  analyze_usage_metrics: {
    id: 'analyze_usage_metrics',
    name: 'Analyze Usage Metrics',
    description: 'Deep dive into product usage data to identify adoption patterns and opportunities.',
    agentType: 'adoption',
    category: 'analysis',

    dataSources: [
      {
        type: 'sheet',
        query: {
          type: 'sheet',
          spreadsheetName: 'Usage Metrics',
          range: 'A1:Z500',
        },
      },
      {
        type: 'sheet',
        query: {
          type: 'sheet',
          spreadsheetName: 'Feature Usage',
        },
      },
    ],

    outputs: [
      {
        type: 'sheet',
        name: 'Usage Analysis - {customerName} - {date}',
        folder: 'reports',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Usage analysis complete. Review the insights and recommendations.',

    steps: [
      { id: 'fetch', name: 'Pulling Usage Data', type: 'fetch', config: {} },
      { id: 'process', name: 'Analyzing Patterns', type: 'process', config: {} },
      { id: 'create', name: 'Creating Report', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },

  // ============================================
  // CREATE ADOPTION REPORT
  // ============================================
  create_adoption_report: {
    id: 'create_adoption_report',
    name: 'Create Adoption Report',
    description: 'Generates a comprehensive adoption report showing feature utilization and engagement.',
    agentType: 'adoption',
    category: 'creation',

    dataSources: [
      {
        type: 'sheet',
        query: {
          type: 'sheet',
          spreadsheetName: 'Usage Metrics',
        },
      },
      {
        type: 'calendar',
        query: {
          type: 'calendar',
          query: 'training',
          maxResults: 10,
        },
      },
    ],

    outputs: [
      {
        type: 'slide',
        template: 'adoption_report',
        name: 'Adoption Report - {customerName}',
        folder: 'reports',
      },
      {
        type: 'sheet',
        template: 'adoption_tracker',
        name: 'Adoption Metrics - {customerName}',
        folder: 'reports',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Adoption report is ready. Share with the customer to drive engagement.',

    steps: [
      { id: 'fetch', name: 'Gathering Metrics', type: 'fetch', config: {} },
      { id: 'process', name: 'Calculating Adoption', type: 'process', config: {} },
      { id: 'create', name: 'Building Report', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },

  // ============================================
  // GENERATE TRAINING RECOMMENDATIONS
  // ============================================
  generate_training_recommendations: {
    id: 'generate_training_recommendations',
    name: 'Generate Training Recommendations',
    description: 'Analyzes usage gaps to recommend targeted training sessions.',
    agentType: 'adoption',
    category: 'analysis',

    dataSources: [
      {
        type: 'sheet',
        query: {
          type: 'sheet',
          spreadsheetName: 'Feature Usage',
        },
      },
      {
        type: 'calendar',
        query: {
          type: 'calendar',
          query: 'training',
        },
      },
    ],

    outputs: [
      {
        type: 'doc',
        name: 'Training Recommendations - {customerName}',
        folder: 'reports',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Training recommendations ready. Review and schedule sessions.',

    steps: [
      { id: 'fetch', name: 'Analyzing Gaps', type: 'fetch', config: {} },
      { id: 'process', name: 'Identifying Needs', type: 'process', config: {} },
      { id: 'create', name: 'Creating Plan', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },

  // ============================================
  // CREATE FEATURE ROLLOUT PLAN
  // ============================================
  create_feature_rollout_plan: {
    id: 'create_feature_rollout_plan',
    name: 'Create Feature Rollout Plan',
    description: 'Develops a plan for rolling out new features to the customer.',
    agentType: 'adoption',
    category: 'creation',

    dataSources: [
      {
        type: 'drive',
        query: {
          type: 'drive',
          nameContains: 'roadmap',
        },
      },
      {
        type: 'sheet',
        query: {
          type: 'sheet',
          spreadsheetName: 'Feature Usage',
        },
      },
    ],

    outputs: [
      {
        type: 'doc',
        name: 'Feature Rollout Plan - {customerName}',
        folder: 'reports',
      },
      {
        type: 'sheet',
        name: 'Rollout Tracker - {customerName}',
        folder: 'reports',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Rollout plan ready. Review timeline and communication strategy.',

    steps: [
      { id: 'fetch', name: 'Loading Roadmap', type: 'fetch', config: {} },
      { id: 'process', name: 'Planning Rollout', type: 'process', config: {} },
      { id: 'create', name: 'Creating Plan', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },

  // ============================================
  // BUILD CHAMPION PLAYBOOK
  // ============================================
  build_champion_playbook: {
    id: 'build_champion_playbook',
    name: 'Build Champion Playbook',
    description: 'Creates a playbook for developing and nurturing product champions.',
    agentType: 'adoption',
    category: 'creation',

    dataSources: [
      {
        type: 'sheet',
        query: {
          type: 'sheet',
          spreadsheetName: 'Usage Metrics',
        },
      },
      {
        type: 'gmail',
        query: {
          type: 'gmail',
          maxResults: 20,
        },
      },
    ],

    outputs: [
      {
        type: 'doc',
        name: 'Champion Playbook - {customerName}',
        folder: 'reports',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Champion playbook ready. Identifies potential champions and engagement strategies.',

    steps: [
      { id: 'fetch', name: 'Identifying Power Users', type: 'fetch', config: {} },
      { id: 'process', name: 'Analyzing Engagement', type: 'process', config: {} },
      { id: 'create', name: 'Building Playbook', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },
};
