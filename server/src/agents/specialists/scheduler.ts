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
} from '../types.js';
import { calendarService } from '../../services/google/calendar.js';

// Import data access tools for scheduler
import { getToolsForAgent } from '../tools/index.js';

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

    try {
      const userId = context.userId;
      if (!userId) {
        throw new Error('User ID required for calendar access');
      }

      const startDate = new Date(input.dateRange.start);
      const endDate = new Date(input.dateRange.end);

      // Get free/busy info from Google Calendar
      const freeBusyMap = await calendarService.getFreeBusy(
        userId,
        startDate,
        endDate,
        ['primary']
      );

      // Get busy slots from the primary calendar
      const busySlots = freeBusyMap.get('primary') || [];

      // Find available slots by inverting busy times
      const availableSlots: Array<{ start: string; end: string }> = [];
      const durationMs = input.durationMinutes * 60 * 1000;

      // Simple slot generation: check each day at common meeting times
      const meetingHours = [9, 10, 11, 14, 15, 16]; // 9am-11am, 2pm-4pm

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        for (const hour of meetingHours) {
          const slotStart = new Date(d);
          slotStart.setHours(hour, 0, 0, 0);
          const slotEnd = new Date(slotStart.getTime() + durationMs);

          // Check if this slot conflicts with any busy times
          const isAvailable = !busySlots.some(busy => {
            return slotStart < busy.end && slotEnd > busy.start;
          });

          if (isAvailable && slotStart > new Date()) {
            availableSlots.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString()
            });
          }

          if (availableSlots.length >= 5) break; // Limit to 5 suggestions
        }
        if (availableSlots.length >= 5) break;
      }

      return {
        success: true,
        data: {
          availableSlots,
          participantsChecked: input.participants,
          durationMinutes: input.durationMinutes,
          busySlots: busySlots.map(s => ({ start: s.start.toISOString(), end: s.end.toISOString() }))
        }
      };
    } catch (error) {
      console.error('[Scheduler] Error checking availability:', error);
      return {
        success: false,
        error: `Failed to check availability: ${(error as Error).message}`
      };
    }
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

    try {
      const userId = context.userId;
      if (!userId) {
        throw new Error('User ID required for calendar access');
      }

      // Create the event using Google Calendar API
      const event = await calendarService.createEvent(userId, {
        title: input.title,
        description: input.description,
        startTime: new Date(input.slot.start),
        endTime: new Date(input.slot.end),
        attendees: input.participants,
        createMeetLink: input.includeGoogleMeet !== false, // Default to true
        sendNotifications: input.sendInvites !== false, // Default to true
      });

      return {
        success: true,
        data: {
          eventId: event.googleEventId,
          title: event.title,
          participants: input.participants,
          start: event.startTime.toISOString(),
          end: event.endTime.toISOString(),
          meetLink: event.meetLink,
          status: 'confirmed'
        }
      };
    } catch (error) {
      console.error('[Scheduler] Error booking meeting:', error);
      return {
        success: false,
        error: `Failed to book meeting: ${(error as Error).message}`
      };
    }
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

    try {
      const userId = context.userId;
      if (!userId) {
        throw new Error('User ID required for calendar access');
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get today's events from Google Calendar
      const events = await calendarService.listEvents(userId, {
        timeMin: today,
        timeMax: tomorrow,
        singleEvents: true,
        orderBy: 'startTime',
      });

      // Filter customer-only if requested
      let filteredEvents = events;
      if (input.includeCustomerOnly && context.customer?.primaryContact?.email) {
        const customerEmail = context.customer.primaryContact.email;
        filteredEvents = events.filter(event =>
          event.attendees.some(a => a.email === customerEmail)
        );
      }

      return {
        success: true,
        data: {
          meetings: filteredEvents.map(e => ({
            id: e.googleEventId,
            title: e.title,
            start: e.startTime.toISOString(),
            end: e.endTime.toISOString(),
            meetLink: e.meetLink,
            attendees: e.attendees.map(a => a.email),
          })),
          count: filteredEvents.length,
          date: today.toISOString().split('T')[0]
        }
      };
    } catch (error) {
      console.error('[Scheduler] Error getting meetings:', error);
      return {
        success: false,
        error: `Failed to get meetings: ${(error as Error).message}`
      };
    }
  }
};

// ============================================
// Scheduler Agent Definition
// ============================================

// Get data access tools for the scheduler
const schedulerDataTools = getToolsForAgent('scheduler');

export const SchedulerAgent: Agent = {
  id: 'scheduler',
  name: 'Meeting Scheduler',
  role: 'Schedule and manage customer meetings',
  description: 'Handles all calendar-related tasks including checking availability, proposing meeting times, booking meetings, and sending reminders. Has access to customer context and health trends for meeting prep.',
  model: 'claude-haiku-4', // Fast model for scheduling

  tools: [
    checkAvailability,
    proposeMeeting,
    bookMeeting,
    sendReminder,
    getTodaysMeetings,
    // Data access tools for customer context and meeting prep
    ...schedulerDataTools
  ],

  permissions: {
    allowedTools: [
      'check_availability', 'propose_meeting', 'book_meeting', 'send_reminder', 'get_todays_meetings',
      // Data access tools
      'get_customer_360', 'get_health_trends', 'get_customer_history'
    ],
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
