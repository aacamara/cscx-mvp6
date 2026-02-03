/**
 * QBR Email Skill
 * PRD-026: One-Click QBR Email Generation
 *
 * Generates and sends professional QBR emails (invitation or follow-up)
 * with customer-specific data
 */

import { Skill, SkillContext, SkillVariable, SkillStep } from '../types.js';

const variables: SkillVariable[] = [
  {
    name: 'emailType',
    type: 'string',
    required: true,
    description: 'Type of QBR email to send',
    validation: { options: ['invite', 'followup'] },
    defaultValue: 'invite',
  },
  {
    name: 'customerName',
    type: 'string',
    required: true,
    description: 'Name of the customer company',
  },
  {
    name: 'customerId',
    type: 'string',
    required: true,
    description: 'Customer ID for data lookup',
  },
  {
    name: 'quarter',
    type: 'string',
    required: false,
    description: 'QBR quarter (Q1, Q2, Q3, Q4)',
    validation: { options: ['Q1', 'Q2', 'Q3', 'Q4'] },
  },
  {
    name: 'year',
    type: 'number',
    required: false,
    description: 'QBR year',
  },
  {
    name: 'recipients',
    type: 'array',
    required: false,
    description: 'Override recipient email addresses',
  },
  {
    name: 'proposedDates',
    type: 'array',
    required: false,
    description: 'Proposed meeting dates/times for invite',
  },
  {
    name: 'scheduledDate',
    type: 'string',
    required: false,
    description: 'Confirmed meeting date for invite',
  },
  {
    name: 'meetingDate',
    type: 'string',
    required: false,
    description: 'Date of QBR meeting (for follow-up)',
  },
  {
    name: 'highlights',
    type: 'array',
    required: false,
    description: 'Key highlights from the QBR (for follow-up)',
  },
  {
    name: 'actionItems',
    type: 'array',
    required: false,
    description: 'Action items with owner and due date',
  },
  {
    name: 'customMessage',
    type: 'string',
    required: false,
    description: 'Custom message to include in the email',
  },
  {
    name: 'documentUrl',
    type: 'string',
    required: false,
    description: 'URL to QBR document (for follow-up)',
  },
  {
    name: 'presentationUrl',
    type: 'string',
    required: false,
    description: 'URL to QBR presentation (for follow-up)',
  },
];

const steps: SkillStep[] = [
  {
    id: 'gather_customer_data',
    name: 'Gather Customer Data',
    description: 'Fetch customer profile, stakeholders, and health metrics',
    tool: 'fetch_customer_data',
    requiresApproval: false,
    inputMapper: (ctx: SkillContext) => ({
      customerId: ctx.variables.customerId || ctx.customerId,
      includeStakeholders: true,
      includeMetrics: true,
    }),
  },
  {
    id: 'determine_recipients',
    name: 'Determine Recipients',
    description: 'Select appropriate stakeholders for QBR email based on roles',
    tool: 'select_stakeholders',
    requiresApproval: false,
    inputMapper: (ctx: SkillContext) => {
      // Use provided recipients or auto-select from stakeholders
      if (ctx.variables.recipients && ctx.variables.recipients.length > 0) {
        return { emails: ctx.variables.recipients };
      }
      return {
        customerId: ctx.variables.customerId || ctx.customerId,
        roles: ['Executive', 'VP', 'Director', 'Primary Contact', 'Decision Maker'],
        maxRecipients: 5,
      };
    },
  },
  {
    id: 'generate_email_content',
    name: 'Generate Email Content',
    description: 'Generate personalized QBR email using templates',
    tool: 'generate_qbr_email',
    requiresApproval: false,
    inputMapper: (ctx: SkillContext) => {
      const now = new Date();
      const quarter = ctx.variables.quarter || `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
      const year = ctx.variables.year || now.getFullYear();

      return {
        customerId: ctx.variables.customerId || ctx.customerId,
        customerName: ctx.variables.customerName || ctx.customer?.name,
        type: ctx.variables.emailType || 'invite',
        quarter,
        year,
        proposedDates: ctx.variables.proposedDates,
        scheduledDate: ctx.variables.scheduledDate,
        meetingDate: ctx.variables.meetingDate,
        highlights: ctx.variables.highlights,
        actionItems: ctx.variables.actionItems,
        customMessage: ctx.variables.customMessage,
        documentUrl: ctx.variables.documentUrl,
        presentationUrl: ctx.variables.presentationUrl,
      };
    },
  },
  {
    id: 'request_approval',
    name: 'Request Email Approval',
    description: 'Submit email for human review before sending',
    tool: 'draft_email',
    requiresApproval: true,
    inputMapper: (ctx: SkillContext) => {
      const customerName = ctx.variables.customerName || ctx.customer?.name || 'Customer';
      const emailType = ctx.variables.emailType || 'invite';
      const now = new Date();
      const quarter = ctx.variables.quarter || `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
      const year = ctx.variables.year || now.getFullYear();

      return {
        to: ctx.variables._selectedRecipients || ctx.variables.recipients || [],
        subject: `${customerName} ${quarter} ${year} Quarterly Business Review${emailType === 'followup' ? ' - Summary' : ' - Let\'s Schedule'}`,
        body: ctx.variables._generatedEmailBody || '',
        bodyHtml: ctx.variables._generatedEmailHtml || '',
        purpose: emailType === 'followup' ? 'qbr-followup' : 'qbr-invite',
        metadata: {
          customerId: ctx.variables.customerId || ctx.customerId,
          quarter,
          year,
          type: emailType,
        },
      };
    },
  },
  {
    id: 'send_email',
    name: 'Send QBR Email',
    description: 'Send the approved QBR email via Gmail',
    tool: 'send_email',
    requiresApproval: false,
    condition: (ctx: SkillContext) => ctx.variables._approved === true,
    inputMapper: (ctx: SkillContext) => ({
      to: ctx.variables._approvedRecipients || ctx.variables._selectedRecipients || [],
      subject: ctx.variables._approvedSubject || '',
      body: ctx.variables._approvedBody || '',
      bodyHtml: ctx.variables._approvedBodyHtml || '',
    }),
  },
  {
    id: 'log_activity',
    name: 'Log Activity',
    description: 'Record QBR email activity in the customer timeline',
    tool: 'log_activity',
    requiresApproval: false,
    condition: (ctx: SkillContext) => ctx.variables._emailSent === true,
    inputMapper: (ctx: SkillContext) => {
      const emailType = ctx.variables.emailType || 'invite';
      const now = new Date();
      const quarter = ctx.variables.quarter || `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
      const year = ctx.variables.year || now.getFullYear();

      return {
        customerId: ctx.variables.customerId || ctx.customerId,
        type: 'email',
        title: `QBR ${emailType === 'followup' ? 'Follow-up' : 'Invitation'} Email Sent`,
        description: `${quarter} ${year} QBR ${emailType === 'followup' ? 'follow-up' : 'invitation'} sent to ${(ctx.variables._selectedRecipients || []).length} recipients`,
        metadata: {
          messageId: ctx.variables._sentMessageId,
          emailType,
          quarter,
          year,
          recipientCount: (ctx.variables._selectedRecipients || []).length,
        },
      };
    },
  },
];

export const qbrEmailSkill: Skill = {
  id: 'qbr-email',
  name: 'Send QBR Email',
  description: 'Generate and send professional QBR invitation or follow-up emails with customer-specific data, metrics, and agenda',
  icon: 'calendar-check',
  category: 'communication',
  keywords: [
    'qbr', 'quarterly business review', 'qbr email',
    'qbr invite', 'qbr invitation', 'qbr schedule',
    'qbr followup', 'qbr follow-up', 'qbr summary',
    'business review', 'quarterly review', 'send qbr',
    'generate qbr', 'qbr meeting',
  ],
  variables,
  steps,
  cacheable: {
    enabled: false, // QBR emails should always be fresh
    ttlSeconds: 0,
    keyFields: [],
  },
  estimatedDurationSeconds: 120,
  estimatedCostSavingsPercent: 0, // No caching benefit
};

export default qbrEmailSkill;
