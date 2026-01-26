/**
 * Kickoff Meeting Skill
 * Schedules an initial kickoff meeting with customer stakeholders
 *
 * Variables: customerName, contactEmail, proposedDate
 * Cacheable: No (time-sensitive)
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
    name: 'contactEmail',
    type: 'email',
    required: true,
    description: 'Primary contact email for the meeting invite',
  },
  {
    name: 'proposedDate',
    type: 'date',
    required: false,
    description: 'Preferred date for the kickoff (defaults to next week)',
  },
  {
    name: 'durationMinutes',
    type: 'number',
    required: false,
    description: 'Meeting duration in minutes',
    defaultValue: 60,
    validation: { min: 30, max: 120 },
  },
  {
    name: 'additionalAttendees',
    type: 'array',
    required: false,
    description: 'Additional attendee emails',
  },
  {
    name: 'includeAgenda',
    type: 'boolean',
    required: false,
    description: 'Include a default agenda in the invite',
    defaultValue: true,
  },
];

const steps: SkillStep[] = [
  {
    id: 'check_availability',
    name: 'Check Calendar Availability',
    description: 'Find available time slots for the kickoff meeting',
    tool: 'check_availability',
    requiresApproval: false,
    inputMapper: (ctx: SkillContext) => {
      const proposedDate = ctx.variables.proposedDate
        ? new Date(ctx.variables.proposedDate)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default: 1 week out

      return {
        durationMinutes: ctx.variables.durationMinutes || 60,
        dateRange: {
          start: proposedDate.toISOString(),
          end: new Date(proposedDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
        participants: [
          ctx.variables.contactEmail,
          ...(ctx.variables.additionalAttendees || []),
        ].filter(Boolean),
      };
    },
  },
  {
    id: 'draft_meeting_invite',
    name: 'Draft Meeting Invite',
    description: 'Prepare the meeting invitation with details',
    tool: 'draft_meeting',
    requiresApproval: true,
    inputMapper: (ctx: SkillContext) => {
      const customerName = ctx.variables.customerName || ctx.customer?.name || 'Customer';
      const includeAgenda = ctx.variables.includeAgenda !== false;

      let description = `Kickoff meeting to begin our partnership with ${customerName}.`;

      if (includeAgenda) {
        description += `\n\n**Agenda:**\n` +
          `1. Introductions and team overview\n` +
          `2. Review goals and success criteria\n` +
          `3. Walkthrough of onboarding timeline\n` +
          `4. Technical requirements discussion\n` +
          `5. Q&A and next steps\n\n` +
          `Please come prepared with:\n` +
          `- Your team's key objectives\n` +
          `- Any questions about the platform\n` +
          `- Preferred communication channels`;
      }

      return {
        title: `${customerName} - Kickoff Meeting`,
        description,
        attendees: [
          ctx.variables.contactEmail,
          ...(ctx.variables.additionalAttendees || []),
        ].filter(Boolean),
        durationMinutes: ctx.variables.durationMinutes || 60,
        createMeetLink: true,
      };
    },
  },
  {
    id: 'request_approval',
    name: 'Request Meeting Approval',
    description: 'Request human approval before booking the meeting',
    tool: 'request_human_approval',
    requiresApproval: true,
    inputMapper: (ctx: SkillContext) => ({
      action: 'book_meeting',
      description: `Book kickoff meeting with ${ctx.variables.customerName}`,
      urgency: 'important',
    }),
  },
  {
    id: 'book_meeting',
    name: 'Book Kickoff Meeting',
    description: 'Schedule the kickoff meeting on the calendar',
    tool: 'book_meeting',
    requiresApproval: false, // Already approved in previous step
    condition: (ctx: SkillContext) => {
      // Only execute if previous approval was granted
      return ctx.variables._approved === true;
    },
    inputMapper: (ctx: SkillContext) => {
      const customerName = ctx.variables.customerName || ctx.customer?.name || 'Customer';
      const proposedDate = ctx.variables.proposedDate
        ? new Date(ctx.variables.proposedDate)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      return {
        title: `${customerName} - Kickoff Meeting`,
        description: ctx.variables._draftedDescription || `Kickoff meeting with ${customerName}`,
        startTime: proposedDate.toISOString(),
        endTime: new Date(proposedDate.getTime() + (ctx.variables.durationMinutes || 60) * 60 * 1000).toISOString(),
        attendees: [
          ctx.variables.contactEmail,
          ...(ctx.variables.additionalAttendees || []),
        ].filter(Boolean),
        createMeetLink: true,
        sendNotifications: true,
      };
    },
  },
  {
    id: 'send_confirmation',
    name: 'Send Confirmation Email',
    description: 'Send a confirmation email with meeting details',
    tool: 'draft_email',
    requiresApproval: true,
    condition: (ctx: SkillContext) => ctx.variables._meetingBooked === true,
    inputMapper: (ctx: SkillContext) => {
      const customerName = ctx.variables.customerName || ctx.customer?.name || 'Customer';
      const contactName = ctx.customer?.primaryContact?.name || 'there';

      return {
        to: [ctx.variables.contactEmail],
        subject: `Kickoff Meeting Confirmed - ${customerName}`,
        body: `Hi ${contactName},\n\n` +
          `I'm excited to confirm our kickoff meeting! You should have received a calendar invite with all the details.\n\n` +
          `In the meantime, here's what to expect:\n` +
          `- We'll review your goals and success criteria\n` +
          `- Walk through the onboarding timeline\n` +
          `- Discuss any technical requirements\n` +
          `- Answer your questions\n\n` +
          `Please don't hesitate to reach out if you have any questions before we meet.\n\n` +
          `Looking forward to our conversation!\n\n` +
          `Best regards`,
      };
    },
  },
];

export const kickoffMeetingSkill: Skill = {
  id: 'kickoff-meeting',
  name: 'Schedule Kickoff Meeting',
  description: 'Check availability, draft invite, request approval, and book a kickoff meeting with customer stakeholders',
  icon: 'calendar',
  category: 'scheduling',
  keywords: [
    'kickoff', 'kick-off', 'first meeting', 'initial meeting',
    'onboarding meeting', 'introductory call', 'intro call',
    'schedule kickoff', 'book kickoff', 'setup meeting',
  ],
  variables,
  steps,
  cacheable: {
    enabled: false, // Time-sensitive, don't cache
    ttlSeconds: 0,
    keyFields: [],
  },
  estimatedDurationSeconds: 120,
  estimatedCostSavingsPercent: 0,
};
