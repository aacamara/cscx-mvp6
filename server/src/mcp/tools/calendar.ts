/**
 * Calendar MCP Tool Wrappers
 * Wraps existing CalendarService methods as MCP tools
 */

import { z } from 'zod';
import { calendarService, CalendarEvent, FreeBusySlot } from '../../services/google/calendar.js';
import type { MCPTool, MCPContext, MCPResult } from '../index.js';
import { createMCPTool } from '../registry.js';

// ============================================
// Input Schemas
// ============================================

const listEventsSchema = z.object({
  calendarId: z.string().optional().default('primary'),
  timeMin: z.string().datetime().optional().describe('Start of time range (ISO 8601)'),
  timeMax: z.string().datetime().optional().describe('End of time range (ISO 8601)'),
  maxResults: z.number().int().min(1).max(250).optional().default(50),
  query: z.string().optional().describe('Search query for event titles'),
});

const getEventSchema = z.object({
  eventId: z.string().min(1).describe('Google Calendar event ID'),
  calendarId: z.string().optional().default('primary'),
});

const createEventSchema = z.object({
  title: z.string().min(1).max(500).describe('Event title'),
  description: z.string().optional().describe('Event description'),
  location: z.string().optional().describe('Event location'),
  startTime: z.string().datetime().describe('Event start time (ISO 8601)'),
  endTime: z.string().datetime().describe('Event end time (ISO 8601)'),
  timezone: z.string().optional().default('America/Toronto'),
  attendees: z.array(z.string().email()).optional().describe('Attendee email addresses'),
  createMeetLink: z.boolean().optional().default(true).describe('Create Google Meet link'),
  sendNotifications: z.boolean().optional().default(true).describe('Send email invitations'),
  calendarId: z.string().optional().default('primary'),
});

const updateEventSchema = z.object({
  eventId: z.string().min(1).describe('Google Calendar event ID'),
  calendarId: z.string().optional().default('primary'),
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  attendees: z.array(z.string().email()).optional(),
  sendNotifications: z.boolean().optional().default(true),
});

const checkAvailabilitySchema = z.object({
  attendees: z.array(z.string().email()).min(1).describe('Email addresses to check availability for'),
  timeMin: z.string().datetime().describe('Start of time range (ISO 8601)'),
  timeMax: z.string().datetime().describe('End of time range (ISO 8601)'),
  durationMinutes: z.number().int().min(15).max(480).optional().default(60),
});

const deleteEventSchema = z.object({
  eventId: z.string().min(1).describe('Google Calendar event ID'),
  calendarId: z.string().optional().default('primary'),
  sendNotifications: z.boolean().optional().default(true),
});

// ============================================
// Tool Implementations
// ============================================

export const calendarListEvents: MCPTool = createMCPTool({
  name: 'calendar.list_events',
  description: 'List calendar events within a time range. Supports filtering by date range and search query.',
  category: 'scheduling',
  provider: 'google',
  inputSchema: listEventsSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{
    events: CalendarEvent[];
  }>> => {
    try {
      const params = listEventsSchema.parse(input);
      const events = await calendarService.listEvents(context.userId, {
        calendarId: params.calendarId,
        timeMin: params.timeMin ? new Date(params.timeMin) : undefined,
        timeMax: params.timeMax ? new Date(params.timeMax) : undefined,
        maxResults: params.maxResults,
        query: params.query,
      });

      return {
        success: true,
        data: { events },
        metadata: {
          count: events.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: true,
      };
    }
  },
});

export const calendarGetEvent: MCPTool = createMCPTool({
  name: 'calendar.get_event',
  description: 'Get a specific calendar event by ID with full details including attendees and meet link.',
  category: 'scheduling',
  provider: 'google',
  inputSchema: getEventSchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ event: CalendarEvent }>> => {
    try {
      const { eventId, calendarId } = getEventSchema.parse(input);
      const event = await calendarService.getEvent(context.userId, eventId, calendarId);

      return {
        success: true,
        data: { event },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: false,
      };
    }
  },
});

export const calendarCreateEvent: MCPTool = createMCPTool({
  name: 'calendar.create_event',
  description: 'Create a new calendar event with optional Google Meet link. Requires human approval.',
  category: 'scheduling',
  provider: 'google',
  inputSchema: createEventSchema,
  requiresAuth: true,
  requiresApproval: true,
  approvalPolicy: 'require_approval',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ event: CalendarEvent }>> => {
    try {
      const params = createEventSchema.parse(input);
      const event = await calendarService.createEvent(context.userId, {
        title: params.title,
        description: params.description,
        location: params.location,
        startTime: new Date(params.startTime),
        endTime: new Date(params.endTime),
        timezone: params.timezone,
        attendees: params.attendees,
        createMeetLink: params.createMeetLink,
        sendNotifications: params.sendNotifications,
        calendarId: params.calendarId,
      });

      return {
        success: true,
        data: { event },
        metadata: {
          meetLink: event.meetLink,
          attendeeCount: event.attendees.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: false,
      };
    }
  },

  getApprovalDescription: (input: unknown): string => {
    try {
      const params = createEventSchema.parse(input);
      const date = new Date(params.startTime).toLocaleDateString();
      const attendees = params.attendees?.length || 0;
      return `Create meeting "${params.title}" on ${date}${attendees > 0 ? ` with ${attendees} attendees` : ''}`;
    } catch {
      return 'Create calendar event';
    }
  },
});

export const calendarUpdateEvent: MCPTool = createMCPTool({
  name: 'calendar.update_event',
  description: 'Update an existing calendar event. Requires human approval.',
  category: 'scheduling',
  provider: 'google',
  inputSchema: updateEventSchema,
  requiresAuth: true,
  requiresApproval: true,
  approvalPolicy: 'require_approval',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ event: CalendarEvent }>> => {
    try {
      const params = updateEventSchema.parse(input);
      const event = await calendarService.updateEvent(
        context.userId,
        params.eventId,
        {
          title: params.title,
          description: params.description,
          location: params.location,
          startTime: params.startTime ? new Date(params.startTime) : undefined,
          endTime: params.endTime ? new Date(params.endTime) : undefined,
          attendees: params.attendees,
          sendNotifications: params.sendNotifications,
        },
        params.calendarId
      );

      return {
        success: true,
        data: { event },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: false,
      };
    }
  },

  getApprovalDescription: (input: unknown): string => {
    try {
      const params = updateEventSchema.parse(input);
      return `Update calendar event ${params.eventId}`;
    } catch {
      return 'Update calendar event';
    }
  },
});

export const calendarCheckAvailability: MCPTool = createMCPTool({
  name: 'calendar.check_availability',
  description: 'Check free/busy times for attendees to find available meeting slots.',
  category: 'scheduling',
  provider: 'google',
  inputSchema: checkAvailabilitySchema,
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{
    busySlots: Record<string, FreeBusySlot[]>;
    suggestedSlots: Array<{ start: string; end: string }>;
  }>> => {
    try {
      const params = checkAvailabilitySchema.parse(input);
      const busySlots = await calendarService.getFreeBusy(
        context.userId,
        params.attendees,
        new Date(params.timeMin),
        new Date(params.timeMax)
      );

      // Find available slots (simplified algorithm)
      const suggestedSlots = findAvailableSlots(
        busySlots,
        new Date(params.timeMin),
        new Date(params.timeMax),
        params.durationMinutes
      );

      return {
        success: true,
        data: {
          busySlots,
          suggestedSlots,
        },
        metadata: {
          attendeeCount: params.attendees.length,
          suggestedCount: suggestedSlots.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: true,
      };
    }
  },
});

export const calendarDeleteEvent: MCPTool = createMCPTool({
  name: 'calendar.delete_event',
  description: 'Delete a calendar event. Requires human approval.',
  category: 'scheduling',
  provider: 'google',
  inputSchema: deleteEventSchema,
  requiresAuth: true,
  requiresApproval: true,
  approvalPolicy: 'require_approval',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ deleted: boolean }>> => {
    try {
      const params = deleteEventSchema.parse(input);
      await calendarService.deleteEvent(
        context.userId,
        params.eventId,
        params.calendarId,
        params.sendNotifications
      );

      return {
        success: true,
        data: { deleted: true },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: false,
      };
    }
  },

  getApprovalDescription: (input: unknown): string => {
    return 'Delete calendar event';
  },
});

export const calendarGetUpcoming: MCPTool = createMCPTool({
  name: 'calendar.get_upcoming',
  description: 'Get upcoming calendar events for the next N days.',
  category: 'scheduling',
  provider: 'google',
  inputSchema: z.object({
    days: z.number().int().min(1).max(90).optional().default(7),
    maxResults: z.number().int().min(1).max(50).optional().default(20),
  }),
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ events: CalendarEvent[] }>> => {
    try {
      const params = z.object({
        days: z.number().default(7),
        maxResults: z.number().default(20),
      }).parse(input);

      const events = await calendarService.getUpcomingEvents(
        context.userId,
        params.days,
        params.maxResults
      );

      return {
        success: true,
        data: { events },
        metadata: {
          count: events.length,
          daysAhead: params.days,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: true,
      };
    }
  },
});

export const calendarGetToday: MCPTool = createMCPTool({
  name: 'calendar.get_today',
  description: 'Get all calendar events for today.',
  category: 'scheduling',
  provider: 'google',
  inputSchema: z.object({}),
  requiresAuth: true,
  requiresApproval: false,
  approvalPolicy: 'auto_approve',

  execute: async (input: unknown, context: MCPContext): Promise<MCPResult<{ events: CalendarEvent[] }>> => {
    try {
      const events = await calendarService.getTodayEvents(context.userId);

      return {
        success: true,
        data: { events },
        metadata: {
          count: events.length,
          date: new Date().toISOString().split('T')[0],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        retryable: true,
      };
    }
  },
});

// ============================================
// Helper Functions
// ============================================

function findAvailableSlots(
  busySlots: Record<string, FreeBusySlot[]>,
  timeMin: Date,
  timeMax: Date,
  durationMinutes: number
): Array<{ start: string; end: string }> {
  const slots: Array<{ start: string; end: string }> = [];

  // Merge all busy times
  const allBusy: FreeBusySlot[] = [];
  for (const attendeeBusy of Object.values(busySlots)) {
    allBusy.push(...attendeeBusy);
  }

  // Sort by start time
  allBusy.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Merge overlapping busy times
  const mergedBusy: FreeBusySlot[] = [];
  for (const slot of allBusy) {
    const last = mergedBusy[mergedBusy.length - 1];
    if (last && slot.start <= last.end) {
      last.end = new Date(Math.max(last.end.getTime(), slot.end.getTime()));
    } else {
      mergedBusy.push({ ...slot });
    }
  }

  // Find gaps
  let current = new Date(timeMin);

  // Only suggest slots during business hours (9am-5pm)
  for (let day = 0; day < 7 && slots.length < 5; day++) {
    const dayStart = new Date(current);
    dayStart.setHours(9, 0, 0, 0);

    const dayEnd = new Date(current);
    dayEnd.setHours(17, 0, 0, 0);

    if (dayStart > timeMax) break;

    let slotStart = dayStart;

    for (const busy of mergedBusy) {
      if (busy.start > dayEnd) break;
      if (busy.end < dayStart) continue;

      // Check if there's a slot before this busy period
      const gapEnd = new Date(Math.min(busy.start.getTime(), dayEnd.getTime()));
      const gapDuration = (gapEnd.getTime() - slotStart.getTime()) / (1000 * 60);

      if (gapDuration >= durationMinutes && slotStart >= dayStart) {
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
        });
        if (slots.length >= 5) break;
      }

      slotStart = new Date(Math.max(busy.end.getTime(), dayStart.getTime()));
    }

    // Check for slot at end of day
    if (slots.length < 5) {
      const gapDuration = (dayEnd.getTime() - slotStart.getTime()) / (1000 * 60);
      if (gapDuration >= durationMinutes && slotStart >= dayStart && slotStart < dayEnd) {
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
        });
      }
    }

    // Move to next day
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }

  return slots;
}

// ============================================
// Export all Calendar tools
// ============================================

export const calendarTools: MCPTool[] = [
  calendarListEvents,
  calendarGetEvent,
  calendarCreateEvent,
  calendarUpdateEvent,
  calendarCheckAvailability,
  calendarDeleteEvent,
  calendarGetUpcoming,
  calendarGetToday,
];
