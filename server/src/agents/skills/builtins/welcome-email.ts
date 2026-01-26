/**
 * Welcome Email Skill
 * Sends a personalized welcome email to new customers
 *
 * Variables: customerName, contactName, csmName, productName
 * Cacheable: Template portion yes (personalized portion no)
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
    name: 'contactName',
    type: 'string',
    required: true,
    description: 'Name of the primary contact',
  },
  {
    name: 'contactEmail',
    type: 'email',
    required: true,
    description: 'Email of the primary contact',
  },
  {
    name: 'csmName',
    type: 'string',
    required: false,
    description: 'Name of the assigned CSM',
    defaultValue: 'Your Customer Success Manager',
  },
  {
    name: 'productName',
    type: 'string',
    required: false,
    description: 'Name of the product/platform',
    defaultValue: 'our platform',
  },
  {
    name: 'tier',
    type: 'string',
    required: false,
    description: 'Customer tier (enterprise, professional, starter)',
    validation: { options: ['enterprise', 'professional', 'starter'] },
  },
  {
    name: 'includeResources',
    type: 'boolean',
    required: false,
    description: 'Include getting started resources',
    defaultValue: true,
  },
  {
    name: 'ccEmails',
    type: 'array',
    required: false,
    description: 'Additional emails to CC',
  },
];

const steps: SkillStep[] = [
  {
    id: 'load_template',
    name: 'Load Welcome Template',
    description: 'Load the appropriate welcome email template based on customer tier',
    tool: 'load_template',
    requiresApproval: false,
    inputMapper: (ctx: SkillContext) => {
      const tier = ctx.variables.tier || ctx.customer?.tier || 'professional';
      return {
        templateType: 'welcome_email',
        variant: tier,
      };
    },
  },
  {
    id: 'personalize_content',
    name: 'Personalize Email Content',
    description: 'Customize the template with customer-specific details',
    tool: 'personalize_template',
    requiresApproval: false,
    inputMapper: (ctx: SkillContext) => {
      const customerName = ctx.variables.customerName || ctx.customer?.name || 'Customer';
      const contactName = ctx.variables.contactName || ctx.customer?.primaryContact?.name || 'there';
      const csmName = ctx.variables.csmName || ctx.customer?.csmName || 'Your Customer Success Manager';
      const productName = ctx.variables.productName || 'our platform';
      const includeResources = ctx.variables.includeResources !== false;

      // Build personalized email body
      let body = `Hi ${contactName},\n\n` +
        `Welcome to ${productName}! I'm ${csmName}, and I'll be your dedicated Customer Success Manager. ` +
        `I'm thrilled to have ${customerName} on board and am here to ensure you get the most value from our partnership.\n\n`;

      body += `**What to Expect:**\n` +
        `- A dedicated point of contact for any questions\n` +
        `- Regular check-ins to track your progress\n` +
        `- Proactive recommendations based on your usage\n` +
        `- Priority support when you need it\n\n`;

      if (includeResources) {
        body += `**Getting Started Resources:**\n` +
          `- [Quick Start Guide] - Get up and running in minutes\n` +
          `- [Best Practices] - Learn from top performers\n` +
          `- [Support Portal] - 24/7 self-service help\n` +
          `- [Training Videos] - On-demand learning\n\n`;
      }

      body += `I'd love to schedule a brief introduction call to understand your goals and how we can best support you. ` +
        `Do you have 30 minutes this week or next?\n\n` +
        `Looking forward to working together!\n\n` +
        `Best regards,\n${csmName}`;

      return {
        template: 'welcome_email',
        variables: {
          contact_name: contactName,
          customer_name: customerName,
          csm_name: csmName,
          product_name: productName,
        },
        body,
        subject: `Welcome to ${productName}, ${contactName}!`,
      };
    },
  },
  {
    id: 'request_approval',
    name: 'Request Email Approval',
    description: 'Request human approval before sending the email',
    tool: 'draft_email',
    requiresApproval: true,
    inputMapper: (ctx: SkillContext) => {
      const customerName = ctx.variables.customerName || ctx.customer?.name || 'Customer';
      const contactName = ctx.variables.contactName || ctx.customer?.primaryContact?.name || 'there';
      const csmName = ctx.variables.csmName || ctx.customer?.csmName || 'Your Customer Success Manager';
      const productName = ctx.variables.productName || 'our platform';
      const includeResources = ctx.variables.includeResources !== false;

      let body = `Hi ${contactName},\n\n` +
        `Welcome to ${productName}! I'm ${csmName}, and I'll be your dedicated Customer Success Manager. ` +
        `I'm thrilled to have ${customerName} on board and am here to ensure you get the most value from our partnership.\n\n`;

      body += `**What to Expect:**\n` +
        `- A dedicated point of contact for any questions\n` +
        `- Regular check-ins to track your progress\n` +
        `- Proactive recommendations based on your usage\n` +
        `- Priority support when you need it\n\n`;

      if (includeResources) {
        body += `**Getting Started Resources:**\n` +
          `- Quick Start Guide - Get up and running in minutes\n` +
          `- Best Practices - Learn from top performers\n` +
          `- Support Portal - 24/7 self-service help\n` +
          `- Training Videos - On-demand learning\n\n`;
      }

      body += `I'd love to schedule a brief introduction call to understand your goals and how we can best support you. ` +
        `Do you have 30 minutes this week or next?\n\n` +
        `Looking forward to working together!\n\n` +
        `Best regards,\n${csmName}`;

      return {
        to: [ctx.variables.contactEmail],
        cc: ctx.variables.ccEmails || [],
        subject: `Welcome to ${productName}, ${contactName}!`,
        body,
      };
    },
  },
  {
    id: 'send_email',
    name: 'Send Welcome Email',
    description: 'Send the approved welcome email',
    tool: 'send_email',
    requiresApproval: false, // Already approved
    condition: (ctx: SkillContext) => ctx.variables._approved === true,
    inputMapper: (ctx: SkillContext) => ({
      to: [ctx.variables.contactEmail],
      cc: ctx.variables.ccEmails || [],
      subject: ctx.variables._approvedSubject,
      body: ctx.variables._approvedBody,
    }),
  },
];

export const welcomeEmailSkill: Skill = {
  id: 'welcome-email',
  name: 'Send Welcome Email',
  description: 'Load template, personalize content, request approval, and send a welcome email to new customers',
  icon: 'mail',
  category: 'communication',
  keywords: [
    'welcome', 'hello', 'introduce', 'introduction email',
    'welcome aboard', 'new customer', 'onboarding email',
    'first email', 'greeting', 'kickoff email',
  ],
  variables,
  steps,
  cacheable: {
    enabled: true,
    ttlSeconds: 3600, // 1 hour - template portion cached
    keyFields: ['tier', 'productName'], // Cache key based on tier and product
  },
  estimatedDurationSeconds: 60,
  estimatedCostSavingsPercent: 30, // Template loading is cached
};
