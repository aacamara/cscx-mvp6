/**
 * Risk Agent Workflow Definitions
 */

import type { WorkflowDefinition, RiskWorkflowId } from '../types.js';

export const riskWorkflows: Record<RiskWorkflowId, WorkflowDefinition> = {
  // ============================================
  // RUN HEALTH ASSESSMENT
  // ============================================
  run_health_assessment: {
    id: 'run_health_assessment',
    name: 'Run Health Assessment',
    description: 'Comprehensive health check analyzing usage, engagement, support tickets, and sentiment.',
    agentType: 'risk',
    category: 'analysis',

    dataSources: [
      {
        type: 'sheet',
        query: {
          type: 'sheet',
          spreadsheetName: 'Health Score',
        },
      },
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
          subject: 'support',
          maxResults: 20,
        },
      },
      {
        type: 'calendar',
        query: {
          type: 'calendar',
          maxResults: 15,
        },
      },
    ],

    outputs: [
      {
        type: 'sheet',
        template: 'health_score_tracker',
        name: 'Health Assessment - {customerName} - {date}',
        folder: 'reports',
      },
      {
        type: 'doc',
        name: 'Health Report - {customerName}',
        folder: 'reports',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Health assessment complete. Review risk factors and recommended actions.',

    steps: [
      { id: 'fetch', name: 'Gathering Health Signals', type: 'fetch', config: {} },
      { id: 'process', name: 'Calculating Health Score', type: 'process', config: {} },
      { id: 'create', name: 'Creating Assessment', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },

  // ============================================
  // CREATE SAVE PLAY
  // ============================================
  create_save_play: {
    id: 'create_save_play',
    name: 'Create Save Play',
    description: 'Develops a comprehensive save strategy for at-risk customers.',
    agentType: 'risk',
    category: 'creation',

    dataSources: [
      {
        type: 'sheet',
        query: {
          type: 'sheet',
          spreadsheetName: 'Health Score',
        },
      },
      {
        type: 'gmail',
        query: {
          type: 'gmail',
          maxResults: 30,
        },
      },
      {
        type: 'drive',
        query: {
          type: 'drive',
          folderPath: 'Contracts',
        },
      },
    ],

    outputs: [
      {
        type: 'doc',
        template: 'save_play',
        name: 'Save Play - {customerName}',
        folder: 'reports',
      },
      {
        type: 'sheet',
        name: 'Save Play Tracker - {customerName}',
        folder: 'reports',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Save play strategy ready. Review action plan and escalation path.',

    steps: [
      { id: 'fetch', name: 'Analyzing Risk Factors', type: 'fetch', config: {} },
      { id: 'process', name: 'Building Strategy', type: 'process', config: {} },
      { id: 'create', name: 'Creating Save Play', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },

  // ============================================
  // GENERATE ESCALATION REPORT
  // ============================================
  generate_escalation_report: {
    id: 'generate_escalation_report',
    name: 'Generate Escalation Report',
    description: 'Creates an executive escalation report for high-risk situations.',
    agentType: 'risk',
    category: 'creation',

    dataSources: [
      {
        type: 'sheet',
        query: {
          type: 'sheet',
          spreadsheetName: 'Health Score',
        },
      },
      {
        type: 'gmail',
        query: {
          type: 'gmail',
          maxResults: 20,
        },
      },
      {
        type: 'drive',
        query: {
          type: 'drive',
          folderPath: 'Reports',
        },
      },
    ],

    outputs: [
      {
        type: 'doc',
        template: 'escalation_report',
        name: 'Escalation Report - {customerName}',
        folder: 'reports',
      },
      {
        type: 'slide',
        template: 'escalation_deck',
        name: 'Escalation Brief - {customerName}',
        folder: 'reports',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Escalation report ready for executive review.',

    steps: [
      { id: 'fetch', name: 'Compiling Evidence', type: 'fetch', config: {} },
      { id: 'process', name: 'Building Case', type: 'process', config: {} },
      { id: 'create', name: 'Creating Report', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },

  // ============================================
  // ANALYZE CHURN SIGNALS
  // ============================================
  analyze_churn_signals: {
    id: 'analyze_churn_signals',
    name: 'Analyze Churn Signals',
    description: 'Deep analysis of churn indicators and early warning signs.',
    agentType: 'risk',
    category: 'analysis',

    dataSources: [
      {
        type: 'sheet',
        query: {
          type: 'sheet',
          spreadsheetName: 'Usage Metrics',
        },
      },
      {
        type: 'sheet',
        query: {
          type: 'sheet',
          spreadsheetName: 'Health Score',
        },
      },
      {
        type: 'gmail',
        query: {
          type: 'gmail',
          maxResults: 30,
        },
      },
      {
        type: 'calendar',
        query: {
          type: 'calendar',
          maxResults: 20,
        },
      },
    ],

    outputs: [
      {
        type: 'sheet',
        name: 'Churn Analysis - {customerName}',
        folder: 'reports',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Churn signal analysis complete. Review indicators and recommended interventions.',

    steps: [
      { id: 'fetch', name: 'Gathering Signals', type: 'fetch', config: {} },
      { id: 'process', name: 'Analyzing Patterns', type: 'process', config: {} },
      { id: 'create', name: 'Creating Analysis', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },

  // ============================================
  // CREATE RECOVERY PLAN
  // ============================================
  create_recovery_plan: {
    id: 'create_recovery_plan',
    name: 'Create Recovery Plan',
    description: 'Develops a detailed recovery plan for struggling customers.',
    agentType: 'risk',
    category: 'creation',

    dataSources: [
      {
        type: 'sheet',
        query: {
          type: 'sheet',
          spreadsheetName: 'Health Score',
        },
      },
      {
        type: 'drive',
        query: {
          type: 'drive',
          nameContains: 'success plan',
        },
      },
    ],

    outputs: [
      {
        type: 'doc',
        name: 'Recovery Plan - {customerName}',
        folder: 'reports',
      },
      {
        type: 'sheet',
        name: 'Recovery Tracker - {customerName}',
        folder: 'reports',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Recovery plan ready. Review milestones and action items.',

    steps: [
      { id: 'fetch', name: 'Assessing Situation', type: 'fetch', config: {} },
      { id: 'process', name: 'Planning Recovery', type: 'process', config: {} },
      { id: 'create', name: 'Creating Plan', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },
};
