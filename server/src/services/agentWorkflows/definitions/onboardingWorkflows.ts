/**
 * Onboarding Agent Workflow Definitions
 */

import type { WorkflowDefinition, OnboardingWorkflowId } from '../types.js';

export const onboardingWorkflows: Record<OnboardingWorkflowId, WorkflowDefinition> = {
  // ============================================
  // CREATE KICKOFF PACKAGE
  // ============================================
  create_kickoff_package: {
    id: 'create_kickoff_package',
    name: 'Create Kickoff Package',
    description: 'Creates a complete kickoff package with agenda, stakeholder map, and meeting materials.',
    agentType: 'onboarding',
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
        type: 'gmail',
        query: {
          type: 'gmail',
          maxResults: 10,
        },
      },
    ],

    outputs: [
      {
        type: 'folder',
        name: 'Kickoff - {customerName}',
        folder: 'onboarding',
      },
      {
        type: 'slide',
        template: 'kickoff_deck',
        name: 'Kickoff Presentation - {customerName}',
        folder: 'onboarding',
      },
      {
        type: 'doc',
        template: 'meeting_notes',
        name: 'Kickoff Agenda - {customerName}',
        folder: 'onboarding',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Kickoff package is ready. Review before scheduling the kickoff meeting.',

    steps: [
      { id: 'fetch', name: 'Loading Contract Info', type: 'fetch', config: {} },
      { id: 'process', name: 'Preparing Materials', type: 'process', config: {} },
      { id: 'create', name: 'Creating Package', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },

  // ============================================
  // GENERATE ONBOARDING PLAN
  // ============================================
  generate_onboarding_plan: {
    id: 'generate_onboarding_plan',
    name: 'Generate Onboarding Plan',
    description: 'Creates a detailed 30-60-90 day onboarding plan based on customer profile and requirements.',
    agentType: 'onboarding',
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
          spreadsheetName: 'Requirements',
        },
      },
    ],

    outputs: [
      {
        type: 'doc',
        template: 'onboarding_plan',
        name: 'Onboarding Plan - {customerName}',
        folder: 'onboarding',
      },
      {
        type: 'sheet',
        template: 'onboarding_tracker',
        name: 'Onboarding Tracker - {customerName}',
        folder: 'onboarding',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Onboarding plan is ready. Review the milestones and timeline.',

    steps: [
      { id: 'fetch', name: 'Analyzing Requirements', type: 'fetch', config: {} },
      { id: 'process', name: 'Building Timeline', type: 'process', config: {} },
      { id: 'create', name: 'Creating Plan', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },

  // ============================================
  // CREATE WELCOME SEQUENCE
  // ============================================
  create_welcome_sequence: {
    id: 'create_welcome_sequence',
    name: 'Create Welcome Sequence',
    description: 'Creates a series of welcome emails and materials for new customer stakeholders.',
    agentType: 'onboarding',
    category: 'communication',

    dataSources: [
      {
        type: 'drive',
        query: {
          type: 'drive',
          nameContains: 'template',
          maxResults: 5,
        },
      },
    ],

    outputs: [
      {
        type: 'doc',
        name: 'Welcome Email Templates - {customerName}',
        folder: 'onboarding',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Welcome sequence drafts are ready. Review before sending.',

    steps: [
      { id: 'fetch', name: 'Loading Templates', type: 'fetch', config: {} },
      { id: 'process', name: 'Personalizing Content', type: 'process', config: {} },
      { id: 'create', name: 'Creating Emails', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },

  // ============================================
  // SETUP CUSTOMER WORKSPACE
  // ============================================
  setup_customer_workspace: {
    id: 'setup_customer_workspace',
    name: 'Setup Customer Workspace',
    description: 'Creates a complete Google Drive folder structure for the new customer.',
    agentType: 'onboarding',
    category: 'automation',

    dataSources: [],

    outputs: [
      {
        type: 'folder',
        name: 'CSCX - {customerName}',
        folder: 'reports',
      },
    ],

    requiresApproval: false,
    approvalMessage: 'Customer workspace created successfully.',

    steps: [
      { id: 'create', name: 'Creating Workspace', type: 'create', config: {} },
      { id: 'notify', name: 'Complete', type: 'notify', config: {} },
    ],
  },

  // ============================================
  // CREATE TRAINING MATERIALS
  // ============================================
  create_training_materials: {
    id: 'create_training_materials',
    name: 'Create Training Materials',
    description: 'Generates customized training materials based on the customer\'s product entitlements.',
    agentType: 'onboarding',
    category: 'creation',

    dataSources: [
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
        type: 'folder',
        name: 'Training - {customerName}',
        folder: 'onboarding',
      },
      {
        type: 'slide',
        template: 'training_presentation',
        name: 'Training Deck - {customerName}',
        folder: 'onboarding',
      },
      {
        type: 'doc',
        name: 'Training Guide - {customerName}',
        folder: 'onboarding',
      },
    ],

    requiresApproval: true,
    approvalMessage: 'Training materials are ready. Review before scheduling training sessions.',

    steps: [
      { id: 'fetch', name: 'Analyzing Entitlements', type: 'fetch', config: {} },
      { id: 'process', name: 'Customizing Content', type: 'process', config: {} },
      { id: 'create', name: 'Creating Materials', type: 'create', config: {} },
      { id: 'notify', name: 'Ready for Review', type: 'notify', config: {} },
    ],
  },
};
