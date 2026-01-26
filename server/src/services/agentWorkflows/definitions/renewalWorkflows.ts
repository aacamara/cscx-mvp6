/**
 * Renewal Agent Workflow Definitions
 *
 * These workflows help the Renewal Specialist agent:
 * - Generate renewal forecasts
 * - Create QBR packages
 * - Build value summaries
 * - Analyze expansion opportunities
 */

import type { WorkflowDefinition, RenewalWorkflowId } from '../types.js';

export const renewalWorkflows: Record<RenewalWorkflowId, WorkflowDefinition> = {
  // ============================================
  // GENERATE RENEWAL FORECAST
  // ============================================
  generate_renewal_forecast: {
    id: 'generate_renewal_forecast',
    name: 'Generate Renewal Forecast',
    description: 'Analyzes customer data from Sheets, contracts from Drive, and email sentiment from Gmail to create a comprehensive renewal forecast.',
    agentType: 'renewal',
    category: 'analysis',

    dataSources: [
      // 1. Fetch customer metrics from Sheets
      {
        type: 'sheet',
        query: {
          type: 'sheet',
          spreadsheetName: 'Customer Health',
          range: 'A1:Z100',
        },
        transform: (data: unknown) => {
          // Extract key metrics
          const sheetData = data as { data?: unknown[][] };
          return {
            metrics: sheetData.data || [],
            hasData: (sheetData.data?.length || 0) > 0,
          };
        },
      },
      // 2. Fetch contract documents from Drive
      {
        type: 'drive',
        query: {
          type: 'drive',
          folderPath: 'Contracts',
          fileType: 'any',
          maxResults: 10,
        },
      },
      // 3. Fetch recent emails about this customer
      {
        type: 'gmail',
        query: {
          type: 'gmail',
          maxResults: 20,
          includeBody: true,
        },
      },
      // 4. Fetch past meetings from Calendar
      {
        type: 'calendar',
        query: {
          type: 'calendar',
          maxResults: 10,
        },
      },
    ],

    outputs: [
      {
        type: 'folder',
        name: 'Renewal Forecast - {customerName} - {date}',
        folder: 'reports',
      },
      {
        type: 'sheet',
        template: 'renewal_tracker',
        name: 'Renewal Forecast - {customerName}',
        folder: 'reports',
        variables: ['customerName', 'arr', 'renewalDate', 'healthScore', 'riskFactors'],
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Please review the renewal forecast. Once approved, I can share it with stakeholders or use it to prepare renewal discussions.',

    steps: [
      { id: 'fetch', name: 'Gathering Data', type: 'fetch', config: {} },
      { id: 'process', name: 'Analyzing Renewal Signals', type: 'process', config: {} },
      { id: 'create', name: 'Creating Forecast', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },

  // ============================================
  // CREATE QBR PACKAGE
  // ============================================
  create_qbr_package: {
    id: 'create_qbr_package',
    name: 'Create QBR Package',
    description: 'Generates a complete Quarterly Business Review package with presentation, metrics sheet, and talking points.',
    agentType: 'renewal',
    category: 'creation',

    dataSources: [
      {
        type: 'sheet',
        query: {
          type: 'sheet',
          spreadsheetName: 'Usage Metrics',
          range: 'A1:Z100',
        },
      },
      {
        type: 'drive',
        query: {
          type: 'drive',
          folderPath: 'QBRs',
          maxResults: 5,
        },
      },
      {
        type: 'calendar',
        query: {
          type: 'calendar',
          query: 'QBR',
          maxResults: 5,
        },
      },
    ],

    outputs: [
      {
        type: 'folder',
        name: 'QBR - {customerName} - Q{quarter} {year}',
        folder: 'qbrs',
      },
      {
        type: 'slide',
        template: 'qbr_presentation',
        name: 'QBR Presentation - {customerName}',
        folder: 'qbrs',
      },
      {
        type: 'sheet',
        template: 'qbr_metrics',
        name: 'QBR Metrics - {customerName}',
        folder: 'qbrs',
      },
      {
        type: 'doc',
        template: 'qbr_report',
        name: 'QBR Talking Points - {customerName}',
        folder: 'qbrs',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Your QBR package is ready. Review the presentation and metrics before sharing with the customer.',

    steps: [
      { id: 'fetch', name: 'Pulling Historical Data', type: 'fetch', config: {} },
      { id: 'process', name: 'Analyzing Metrics', type: 'process', config: {} },
      { id: 'create', name: 'Building QBR Package', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },

  // ============================================
  // BUILD VALUE SUMMARY
  // ============================================
  build_value_summary: {
    id: 'build_value_summary',
    name: 'Build Value Summary',
    description: 'Creates a compelling value summary document showing ROI and business impact.',
    agentType: 'renewal',
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
          nameContains: 'Success',
          maxResults: 5,
        },
      },
    ],

    outputs: [
      {
        type: 'doc',
        template: 'value_summary',
        name: 'Value Summary - {customerName}',
        folder: 'reports',
      },
      {
        type: 'slide',
        template: 'value_summary',
        name: 'Value Presentation - {customerName}',
        folder: 'reports',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Value summary is ready. This document highlights the ROI and business impact for the customer.',

    steps: [
      { id: 'fetch', name: 'Gathering Success Metrics', type: 'fetch', config: {} },
      { id: 'process', name: 'Calculating Value', type: 'process', config: {} },
      { id: 'create', name: 'Creating Summary', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },

  // ============================================
  // CREATE RENEWAL PROPOSAL
  // ============================================
  create_renewal_proposal: {
    id: 'create_renewal_proposal',
    name: 'Create Renewal Proposal',
    description: 'Generates a formal renewal proposal document with pricing and terms.',
    agentType: 'renewal',
    category: 'creation',

    dataSources: [
      {
        type: 'drive',
        query: {
          type: 'drive',
          folderPath: 'Contracts',
          maxResults: 5,
        },
      },
      {
        type: 'sheet',
        query: {
          type: 'sheet',
          spreadsheetName: 'Pricing',
        },
      },
    ],

    outputs: [
      {
        type: 'doc',
        template: 'renewal_proposal',
        name: 'Renewal Proposal - {customerName}',
        folder: 'contracts',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Renewal proposal is ready. Review the terms and pricing before sending to the customer.',

    steps: [
      { id: 'fetch', name: 'Loading Contract Data', type: 'fetch', config: {} },
      { id: 'process', name: 'Preparing Proposal', type: 'process', config: {} },
      { id: 'create', name: 'Generating Document', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },

  // ============================================
  // ANALYZE EXPANSION OPPORTUNITIES
  // ============================================
  analyze_expansion_opportunities: {
    id: 'analyze_expansion_opportunities',
    name: 'Analyze Expansion Opportunities',
    description: 'Identifies upsell and cross-sell opportunities based on usage patterns and customer profile.',
    agentType: 'renewal',
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
        type: 'gmail',
        query: {
          type: 'gmail',
          subject: 'feature',
          maxResults: 20,
        },
      },
      {
        type: 'drive',
        query: {
          type: 'drive',
          nameContains: 'expansion',
          maxResults: 5,
        },
      },
    ],

    outputs: [
      {
        type: 'sheet',
        name: 'Expansion Analysis - {customerName}',
        folder: 'reports',
      },
      {
        type: 'doc',
        name: 'Expansion Playbook - {customerName}',
        folder: 'reports',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Expansion analysis complete. Review the opportunities identified.',

    steps: [
      { id: 'fetch', name: 'Analyzing Usage Patterns', type: 'fetch', config: {} },
      { id: 'process', name: 'Identifying Opportunities', type: 'process', config: {} },
      { id: 'create', name: 'Creating Analysis', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },
};
