/**
 * Scheduler Agent
 * Manages calendar, checks availability, books meetings
 * Integrates with Google Calendar
 */

import {
  Agent,
  AgentContext,
  Tool,
  ToolResult
} from '../types';

// ============================================
// Scheduler Tools
// ============================================

const checkAvailability: Tool = {
  name: 'check_availability',
  description: 'Check calendar availability for CSM and customer stakeholders',
  inputSchema: {
    type: 'object',
    properties: {
      participants: {
        type: 'array',
        items: { type: 'string' },
        description: 'Email addresses of participants'
      },
      durationMinutes: {
        type: 'number',
        description: 'Meeting duration in minutes'
      },
      dateRange: {
        type: 'object',
        properties: {
          start: { type: 'string', format: 'date' },
          end: { type: 'string', format: 'date' }
        },
        description: 'Date range to check'
      },
      preferredTimes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Preferred time slots (e.g., "morning", "afternoon")'
      }
    },
    required: ['participants', 'durationMinutes', 'dateRange']
  },
  requiresApproval: false,
  execute: async (input: {
    participants: string[];
    durationMinutes: number;
    dateRange: { start: string; end: string };
    preferredTimes?: string[];
  }, context: AgentContext): Promise<ToolResult> => {
    console.log(`[Scheduler] Checking availability for ${input.participants.length} participants`);

    // TODO: Integrate with Google Calendar API
    // For now, return mock availability
    const mockSlots = [
      { start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), end: new Date(Date.now() + 24 * 60 * 60 * 1000 + input.durationMinutes * 60 * 1000).toISOString() },
      { start: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), end: new Date(Date.now() + 48 * 60 * 60 * 1000 + input.durationMinutes * 60 * 1000).toISOString() },
      { start: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), end: new Date(Date.now() + 72 * 60 * 60 * 1000 + input.durationMinutes * 60 * 1000).toISOString() }
    ];

    return {
      success: true,
      data: {
        availableSlots: mockSlots,
        participantsChecked: input.participants,
        durationMinutes: input.durationMinutes
      }
    };
  }
};

const proposeMeeting: Tool = {
  name: 'propose_meeting',
  description: 'Create a meeting proposal with multiple time options',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Meeting title'
      },
      description: {
        type: 'string',
        description: 'Meeting description/agenda'
      },
      participants: {
        type: 'array',
        items: { type: 'string' },
        description: 'Email addresses of participants'
      },
      proposedSlots: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            start: { type: 'string' },
            end: { type: 'string' }
          }
        },
        description: 'Proposed time slots'
      },
      meetingType: {
        type: 'string',
        enum: ['kickoff', 'check-in', 'qbr', 'training', 'support', 'other'],
        description: 'Type of meeting'
      },
      includeGoogleMeet: {
        type: 'boolean',
        description: 'Whether to include Google Meet link'
      }
    },
    required: ['title', 'participants', 'proposedSlots']
  },
  requiresApproval: true, // Human reviews before sending
  execute: async (input: {
    title: string;
    description?: string;
    participants: string[];
    proposedSlots: Array<{ start: string; end: string }>;
    meetingType?: string;
    includeGoogleMeet?: boolean;
  }, context: AgentContext): Promise<ToolResult> => {
    console.log(`[Scheduler] Proposing meeting: ${input.title}`);

    return {
      success: true,
      data: {
        proposalId: `proposal_${Date.now()}`,
        title: input.title,
        participants: input.participants,
        slots: input.proposedSlots,
        meetingType: input.meetingType || 'other',
        status: 'pending_approval'
      }
    };
  }
};

const bookMeeting: Tool = {
  name: 'book_meeting',
  description: 'Confirm and book a meeting on calendars',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Meeting title'
      },
      description: {
        type: 'string',
        description: 'Meeting description/agenda'
      },
      participants: {
        type: 'array',
        items: { type: 'string' },
        description: 'Email addresses of participants'
      },
      slot: {
        type: 'object',
        properties: {
          start: { type: 'string' },
          end: { type: 'string' }
        },
        description: 'Confirmed time slot'
      },
      includeGoogleMeet: {
        type: 'boolean',
        description: 'Whether to include Google Meet link'
      },
      sendInvites: {
        type: 'boolean',
        description: 'Whether to send calendar invites'
      }
    },
    required: ['title', 'participants', 'slot']
  },
  requiresApproval: true, // Human confirms booking
  execute: async (input: {
    title: string;
    description?: string;
    participants: string[];
    slot: { start: string; end: string };
    includeGoogleMeet?: boolean;
    sendInvites?: boolean;
  }, context: AgentContext): Promise<ToolResult> => {
    console.log(`[Scheduler] Booking meeting: ${input.title}`);

    // TODO: Integrate with Google Calendar API
    return {
      success: true,
      data: {
        eventId: `event_${Date.now()}`,
        title: input.title,
        participants: input.participants,
        start: input.slot.start,
        end: input.slot.end,
        meetLink: input.includeGoogleMeet ? `https://meet.google.com/${Date.now()}` : undefined,
        status: 'pending_approval'
      }
    };
  }
};

const sendReminder: Tool = {
  name: 'send_reminder',
  description: 'Send meeting reminder to participants',
  inputSchema: {
    type: 'object',
    properties: {
      eventId: {
        type: 'string',
        description: 'Calendar event ID'
      },
      reminderType: {
        type: 'string',
        enum: ['24h', '1h', '15m', 'custom'],
        description: 'When to send reminder'
      },
      customMessage: {
        type: 'string',
        description: 'Optional custom reminder message'
      }
    },
    required: ['eventId', 'reminderType']
  },
  requiresApproval: false, // Auto-reminders OK
  execute: async (input: {
    eventId: string;
    reminderType: string;
    customMessage?: string;
  }, context: AgentContext): Promise<ToolResult> => {
    console.log(`[Scheduler] Sending ${input.reminderType} reminder for ${input.eventId}`);

    return {
      success: true,
      data: {
        eventId: input.eventId,
        reminderType: input.reminderType,
        sent: true
      }
    };
  }
};

const getTodaysMeetings: Tool = {
  name: 'get_todays_meetings',
  description: 'Get all meetings scheduled for today',
  inputSchema: {
    type: 'object',
    properties: {
      includeCustomerOnly: {
        type: 'boolean',
        description: 'Only show customer-related meetings'
      }
    },
    required: []
  },
  requiresApproval: false,
  execute: async (input: {
    includeCustomerOnly?: boolean;
  }, context: AgentContext): Promise<ToolResult> => {
    console.log(`[Scheduler] Getting today's meetings`);

    // TODO: Integrate with Google Calendar API
    return {
      success: true,
      data: {
        meetings: [],
        count: 0,
        date: new Date().toISOString().split('T')[0]
      }
    };
  }
};

// ============================================
// Scheduler Agent Definition
// ============================================

export const SchedulerAgent: Agent = {
  id: 'scheduler',
  name: 'Meeting Scheduler',
  role: 'Schedule and manage customer meetings',
  description: 'Handles all calendar-related tasks including checking availability, proposing meeting times, booking meetings, and sending reminders.',
  model: 'claude-haiku-4', // Fast model for scheduling

  tools: [
    checkAvailability,
    proposeMeeting,
    bookMeeting,
    sendReminder,
    getTodaysMeetings
  ],

  permissions: {
    allowedTools: ['check_availability', 'propose_meeting', 'book_meeting', 'send_reminder', 'get_todays_meetings'],
    allowedDirectories: ['/calendars', '/meetings'],
    requiresApproval: ['propose_meeting', 'book_meeting'],
    blockedActions: ['delete_meeting', 'access_other_customers']
  },

  requiredContext: ['customer', 'customer.stakeholders'],

  hooks: {
    preToolUse: async (tool: string, input: any) => {
      console.log(`[Scheduler] Using tool: ${tool}`);
      return true;
    },
    postToolUse: async (tool: string, output: any) => {
      console.log(`[Scheduler] Tool complete: ${tool}`);
    },
    onError: async (error: Error) => {
      console.error(`[Scheduler] Error: ${error.message}`);
    }
  }
};

export default SchedulerAgent;
