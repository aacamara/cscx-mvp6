/**
 * Onboarding Checklist Skill
 * Creates customer workspace with Drive folder and tracking documents
 *
 * Variables: customerName, tier, industry
 * Cacheable: Yes (template-based)
 */

import { Skill, SkillContext, SkillVariable, SkillStep } from '../types.js';

const variables: SkillVariable[] = [
  {
    name: 'customerName',
    type: 'string',
    required: true,
    description: 'Name of the customer company',
  },
  {
    name: 'customerId',
    type: 'string',
    required: false,
    description: 'Customer ID for linking',
  },
  {
    name: 'tier',
    type: 'string',
    required: false,
    description: 'Customer tier determines checklist complexity',
    defaultValue: 'professional',
    validation: { options: ['enterprise', 'professional', 'starter'] },
  },
  {
    name: 'industry',
    type: 'string',
    required: false,
    description: 'Customer industry for customized checklist',
  },
  {
    name: 'arr',
    type: 'number',
    required: false,
    description: 'Annual Recurring Revenue',
  },
  {
    name: 'timelineDays',
    type: 'number',
    required: false,
    description: 'Target onboarding duration in days',
    defaultValue: 90,
    validation: { min: 30, max: 180 },
  },
  {
    name: 'stakeholderEmails',
    type: 'array',
    required: false,
    description: 'Emails of stakeholders to share workspace with',
  },
];

const steps: SkillStep[] = [
  {
    id: 'create_drive_folder',
    name: 'Create Drive Folder Structure',
    description: 'Create the customer workspace folder in Google Drive',
    tool: 'create_workspace',
    requiresApproval: false,
    inputMapper: (ctx: SkillContext) => ({
      customerName: ctx.variables.customerName || ctx.customer?.name || 'New Customer',
      customerId: ctx.variables.customerId || ctx.customer?.id,
      structure: {
        name: `CSCX - ${ctx.variables.customerName || ctx.customer?.name}`,
        subfolders: [
          '01 - Onboarding',
          '02 - Meetings',
          '03 - QBRs',
          '04 - Contracts',
          '05 - Reports',
          '06 - Training Materials',
        ],
      },
    }),
  },
  {
    id: 'create_tracking_sheet',
    name: 'Create Onboarding Tracker',
    description: 'Create a Google Sheet to track onboarding progress',
    tool: 'create_sheet',
    requiresApproval: false,
    inputMapper: (ctx: SkillContext) => {
      const customerName = ctx.variables.customerName || ctx.customer?.name || 'New Customer';
      const tier = ctx.variables.tier || ctx.customer?.tier || 'professional';
      const timelineDays = ctx.variables.timelineDays || 90;

      // Determine phases based on tier
      const phases = tier === 'enterprise'
        ? ['Discovery', 'Technical Setup', 'Integration', 'Training', 'Go-Live', 'Adoption']
        : tier === 'professional'
          ? ['Kickoff', 'Setup', 'Training', 'Go-Live']
          : ['Quick Start', 'Setup', 'Go-Live'];

      return {
        templateType: 'onboarding_tracker',
        title: `${customerName} - Onboarding Tracker`,
        variables: {
          customer_name: customerName,
          start_date: new Date().toISOString().split('T')[0],
          target_completion: new Date(Date.now() + timelineDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          arr: ctx.variables.arr || ctx.customer?.arr || 0,
          tier: tier,
          phases: phases.join(', '),
        },
      };
    },
  },
  {
    id: 'populate_checklist',
    name: 'Populate Checklist Items',
    description: 'Add onboarding tasks based on tier and industry',
    tool: 'populate_sheet',
    requiresApproval: false,
    inputMapper: (ctx: SkillContext) => {
      const tier = ctx.variables.tier || ctx.customer?.tier || 'professional';
      const industry = ctx.variables.industry || ctx.customer?.industry;

      // Build checklist based on tier
      const baseChecklist = [
        { phase: 'Kickoff', task: 'Schedule kickoff meeting', owner: 'CSM', priority: 'high' },
        { phase: 'Kickoff', task: 'Send welcome email', owner: 'CSM', priority: 'high' },
        { phase: 'Kickoff', task: 'Create stakeholder map', owner: 'CSM', priority: 'medium' },
        { phase: 'Setup', task: 'Provision user accounts', owner: 'Technical', priority: 'high' },
        { phase: 'Setup', task: 'Configure integrations', owner: 'Technical', priority: 'high' },
        { phase: 'Training', task: 'Schedule admin training', owner: 'CSM', priority: 'medium' },
        { phase: 'Training', task: 'Deliver user training', owner: 'CSM', priority: 'medium' },
        { phase: 'Go-Live', task: 'Confirm go-live readiness', owner: 'CSM', priority: 'high' },
        { phase: 'Go-Live', task: 'Monitor initial adoption', owner: 'CSM', priority: 'medium' },
      ];

      // Add enterprise-specific tasks
      const enterpriseAdditions = tier === 'enterprise' ? [
        { phase: 'Discovery', task: 'Executive alignment meeting', owner: 'CSM', priority: 'high' },
        { phase: 'Discovery', task: 'Technical architecture review', owner: 'Technical', priority: 'high' },
        { phase: 'Integration', task: 'API integration setup', owner: 'Technical', priority: 'high' },
        { phase: 'Integration', task: 'SSO configuration', owner: 'Technical', priority: 'high' },
        { phase: 'Adoption', task: 'Champion program setup', owner: 'CSM', priority: 'medium' },
        { phase: 'Adoption', task: '30-day health check', owner: 'CSM', priority: 'high' },
      ] : [];

      // Add industry-specific tasks
      const industryAdditions = industry === 'healthcare' ? [
        { phase: 'Setup', task: 'HIPAA compliance review', owner: 'Technical', priority: 'high' },
        { phase: 'Setup', task: 'BAA execution', owner: 'Legal', priority: 'high' },
      ] : industry === 'finance' ? [
        { phase: 'Setup', task: 'Security assessment', owner: 'Technical', priority: 'high' },
        { phase: 'Setup', task: 'Compliance documentation', owner: 'Legal', priority: 'high' },
      ] : [];

      return {
        data: [...baseChecklist, ...enterpriseAdditions, ...industryAdditions],
        sheetId: ctx.variables._createdSheetId,
      };
    },
  },
  {
    id: 'share_workspace',
    name: 'Share Workspace',
    description: 'Share the workspace folder with stakeholders',
    tool: 'share_folder',
    requiresApproval: false,
    condition: (ctx: SkillContext) =>
      ctx.variables.stakeholderEmails && ctx.variables.stakeholderEmails.length > 0,
    inputMapper: (ctx: SkillContext) => ({
      folderId: ctx.variables._createdFolderId,
      emails: ctx.variables.stakeholderEmails || [],
      role: 'reader', // Read-only by default
      sendNotification: true,
      message: `Your onboarding workspace is ready! This folder contains all the resources for your ${ctx.variables.customerName} implementation.`,
    }),
  },
  {
    id: 'create_success_plan',
    name: 'Create Success Plan Document',
    description: 'Generate a success plan document template',
    tool: 'create_document',
    requiresApproval: false,
    condition: (ctx: SkillContext) => {
      const tier = ctx.variables.tier || ctx.customer?.tier || 'professional';
      return tier === 'enterprise' || tier === 'professional';
    },
    inputMapper: (ctx: SkillContext) => {
      const customerName = ctx.variables.customerName || ctx.customer?.name || 'New Customer';

      return {
        template: 'success_plan',
        title: `${customerName} - Success Plan`,
        folderId: ctx.variables._createdFolderId,
        variables: {
          customer_name: customerName,
          start_date: new Date().toISOString().split('T')[0],
          csm_name: ctx.customer?.csmName || 'TBD',
          arr: ctx.variables.arr || ctx.customer?.arr || 'TBD',
          industry: ctx.variables.industry || ctx.customer?.industry || 'TBD',
        },
      };
    },
  },
];

export const onboardingChecklistSkill: Skill = {
  id: 'onboarding-checklist',
  name: 'Create Onboarding Workspace',
  description: 'Create Drive folder, onboarding tracker spreadsheet, and populate checklist based on customer tier',
  icon: 'folder-plus',
  category: 'onboarding',
  keywords: [
    'workspace', 'folder', 'drive', 'setup', 'onboarding setup',
    'checklist', 'tracker', 'onboarding checklist', 'create workspace',
    'customer folder', 'project setup', 'kickoff prep',
  ],
  variables,
  steps,
  cacheable: {
    enabled: true,
    ttlSeconds: 86400, // 24 hours - templates are stable
    keyFields: ['tier', 'industry'], // Cache based on tier and industry
  },
  estimatedDurationSeconds: 180,
  estimatedCostSavingsPercent: 45, // Template and structure creation cached
};
