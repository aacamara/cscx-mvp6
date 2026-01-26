/**
 * Strategic CSM Agent Workflow Definitions
 */

import type { WorkflowDefinition, StrategicWorkflowId } from '../types.js';

export const strategicWorkflows: Record<StrategicWorkflowId, WorkflowDefinition> = {
  // ============================================
  // CREATE ACCOUNT PLAN
  // ============================================
  create_account_plan: {
    id: 'create_account_plan',
    name: 'Create Account Plan',
    description: 'Develops a comprehensive strategic account plan for key customers.',
    agentType: 'strategic',
    category: 'creation',

    dataSources: [
      {
        type: 'drive',
        query: {
          type: 'drive',
          folderPath: 'Contracts',
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
        type: 'folder',
        name: 'Account Plan - {customerName}',
        folder: 'reports',
      },
      {
        type: 'doc',
        template: 'account_plan',
        name: 'Strategic Account Plan - {customerName}',
        folder: 'reports',
      },
      {
        type: 'sheet',
        name: 'Account Plan Tracker - {customerName}',
        folder: 'reports',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Strategic account plan ready. Review objectives and initiatives.',

    steps: [
      { id: 'fetch', name: 'Gathering Account Intel', type: 'fetch', config: {} },
      { id: 'process', name: 'Developing Strategy', type: 'process', config: {} },
      { id: 'create', name: 'Creating Plan', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },

  // ============================================
  // GENERATE EXECUTIVE BRIEFING
  // ============================================
  generate_executive_briefing: {
    id: 'generate_executive_briefing',
    name: 'Generate Executive Briefing',
    description: 'Creates an executive-level briefing document for leadership meetings.',
    agentType: 'strategic',
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
          folderPath: 'QBRs',
          maxResults: 3,
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
        type: 'slide',
        template: 'executive_briefing',
        name: 'Executive Briefing - {customerName}',
        folder: 'reports',
      },
      {
        type: 'doc',
        name: 'Executive Summary - {customerName}',
        folder: 'reports',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Executive briefing ready. Review key points and recommendations.',

    steps: [
      { id: 'fetch', name: 'Compiling Executive Data', type: 'fetch', config: {} },
      { id: 'process', name: 'Summarizing Insights', type: 'process', config: {} },
      { id: 'create', name: 'Creating Briefing', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },

  // ============================================
  // BUILD SUCCESS STORY
  // ============================================
  build_success_story: {
    id: 'build_success_story',
    name: 'Build Success Story',
    description: 'Creates a compelling customer success story for marketing and sales.',
    agentType: 'strategic',
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
        type: 'drive',
        query: {
          type: 'drive',
          nameContains: 'success',
        },
      },
      {
        type: 'gmail',
        query: {
          type: 'gmail',
          subject: 'thank',
          maxResults: 10,
        },
      },
    ],

    outputs: [
      {
        type: 'doc',
        name: 'Success Story - {customerName}',
        folder: 'reports',
      },
      {
        type: 'slide',
        name: 'Case Study - {customerName}',
        folder: 'reports',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Success story draft ready. Review metrics and quotes.',

    steps: [
      { id: 'fetch', name: 'Gathering Success Data', type: 'fetch', config: {} },
      { id: 'process', name: 'Crafting Narrative', type: 'process', config: {} },
      { id: 'create', name: 'Creating Story', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },

  // ============================================
  // CREATE PARTNERSHIP PROPOSAL
  // ============================================
  create_partnership_proposal: {
    id: 'create_partnership_proposal',
    name: 'Create Partnership Proposal',
    description: 'Develops a strategic partnership or co-marketing proposal.',
    agentType: 'strategic',
    category: 'creation',

    dataSources: [
      {
        type: 'drive',
        query: {
          type: 'drive',
          folderPath: 'Contracts',
        },
      },
      {
        type: 'sheet',
        query: {
          type: 'sheet',
          spreadsheetName: 'Usage Metrics',
        },
      },
    ],

    outputs: [
      {
        type: 'doc',
        name: 'Partnership Proposal - {customerName}',
        folder: 'reports',
      },
      {
        type: 'slide',
        name: 'Partnership Deck - {customerName}',
        folder: 'reports',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Partnership proposal ready. Review terms and benefits.',

    steps: [
      { id: 'fetch', name: 'Analyzing Potential', type: 'fetch', config: {} },
      { id: 'process', name: 'Developing Proposal', type: 'process', config: {} },
      { id: 'create', name: 'Creating Documents', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },

  // ============================================
  // ANALYZE STRATEGIC OPPORTUNITIES
  // ============================================
  analyze_strategic_opportunities: {
    id: 'analyze_strategic_opportunities',
    name: 'Analyze Strategic Opportunities',
    description: 'Identifies and analyzes strategic growth opportunities within the account.',
    agentType: 'strategic',
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
        type: 'drive',
        query: {
          type: 'drive',
          folderPath: 'Contracts',
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
          maxResults: 15,
        },
      },
    ],

    outputs: [
      {
        type: 'sheet',
        name: 'Strategic Opportunities - {customerName}',
        folder: 'reports',
      },
      {
        type: 'doc',
        name: 'Opportunity Analysis - {customerName}',
        folder: 'reports',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Strategic analysis complete. Review opportunities and recommended actions.',

    steps: [
      { id: 'fetch', name: 'Gathering Intelligence', type: 'fetch', config: {} },
      { id: 'process', name: 'Analyzing Opportunities', type: 'process', config: {} },
      { id: 'create', name: 'Creating Analysis', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },
};
