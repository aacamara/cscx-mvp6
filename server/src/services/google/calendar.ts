/**
 * Google Calendar Service
 * Handles Calendar API operations: events, scheduling, Meet links
 */

import { google, calendar_v3 } from 'googleapis';
import { googleOAuth } from './oauth.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Types
export interface CalendarEvent {
  id: string;
  googleEventId: string;
  calendarId: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  timezone?: string;
  isAllDay: boolean;
  meetLink?: string;
  conferenceId?: string;
  attendees: EventAttendee[];
  organizerEmail?: string;
  responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  status: 'confirmed' | 'tentative' | 'cancelled';
  isRecurring: boolean;
  recurrenceRule?: string;
}

export interface EventAttendee {
  email: string;
  displayName?: string;
  responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  organizer?: boolean;
  self?: boolean;
}

export interface CreateEventOptions {
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  timezone?: string;
  attendees?: string[]; // Email addresses
  createMeetLink?: boolean;
  sendNotifications?: boolean;
  reminderMinutes?: number[];
  calendarId?: string;
}

export interface UpdateEventOptions {
  title?: string;
  description?: string;
  location?: string;
  startTime?: Date;
  endTime?: Date;
  attendees?: string[];
  sendNotifications?: boolean;
}

export interface FreeBusySlot {
  start: Date;
  end: Date;
}

export class CalendarService {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Get Calendar API client for a user
   */
  private async getCalendarClient(userId: string): Promise<calendar_v3.Calendar> {
    const auth = await googleOAuth.getAuthenticatedClient(userId);
    return google.calendar({ version: 'v3', auth });
  }

  /**
   * List calendar events
   */
  async listEvents(
    userId: string,
    options: {
      calendarId?: string;
      timeMin?: Date;
      timeMax?: Date;
      maxResults?: number;
      singleEvents?: boolean;
      orderBy?: 'startTime' | 'updated';
      query?: string;
    } = {}
  ): Promise<CalendarEvent[]> {
    const calendar = await this.getCalendarClient(userId);

    const response = await calendar.events.list({
      calendarId: options.calendarId || 'primary',
      timeMin: options.timeMin?.toISOString() || new Date().toISOString(),
      timeMax: options.timeMax?.toISOString(),
      maxResults: options.maxResults || 50,
      singleEvents: options.singleEvents ?? true,
      orderBy: options.orderBy || 'startTime',
      q: options.query,
    });

    return (response.data.items || []).map(event => this.mapGoogleEventToEvent(event, options.calendarId || 'primary'));
  }

  /**
   * Get upcoming events (next 7 days by default)
   */
  async getUpcomingEvents(
    userId: string,
    days: number = 7,
    maxResults: number = 20
  ): Promise<CalendarEvent[]> {
    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + days);

    return this.listEvents(userId, {
      timeMin,
      timeMax,
      maxResults,
      orderBy: 'startTime',
    });
  }

  /**
   * Get today's events
   */
  async getTodayEvents(userId: string): Promise<CalendarEvent[]> {
    const timeMin = new Date();
    timeMin.setHours(0, 0, 0, 0);

    const timeMax = new Date();
    timeMax.setHours(23, 59, 59, 999);

    return this.listEvents(userId, {
      timeMin,
      timeMax,
      orderBy: 'startTime',
    });
  }

  /**
   * Get a single event by ID
   */
  async getEvent(
    userId: string,
    eventId: string,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent> {
    const calendar = await this.getCalendarClient(userId);

    const response = await calendar.events.get({
      calendarId,
      eventId,
    });

    return this.mapGoogleEventToEvent(response.data, calendarId);
  }

  /**
   * Create a new calendar event
   */
  async createEvent(userId: string, options: CreateEventOptions): Promise<CalendarEvent> {
    const calendar = await this.getCalendarClient(userId);

    const eventResource: calendar_v3.Schema$Event = {
      summary: options.title,
      description: options.description,
      location: options.location,
      start: {
        dateTime: options.startTime.toISOString(),
        timeZone: options.timezone || 'America/Toronto',
      },
      end: {
        dateTime: options.endTime.toISOString(),
        timeZone: options.timezone || 'America/Toronto',
      },
      attendees: options.attendees?.map(email => ({ email })),
    };

    // Add Google Meet link if requested
    if (options.createMeetLink) {
      eventResource.conferenceData = {
        createRequest: {
          requestId: `cscx-${Date.now()}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      };
    }

    // Add reminders
    if (options.reminderMinutes?.length) {
      eventResource.reminders = {
        useDefault: false,
        overrides: options.reminderMinutes.map(minutes => ({
          method: 'popup',
          minutes,
        })),
      };
    }

    const response = await calendar.events.insert({
      calendarId: options.calendarId || 'primary',
      requestBody: eventResource,
      conferenceDataVersion: options.createMeetLink ? 1 : 0,
      sendUpdates: options.sendNotifications ? 'all' : 'none',
    });

    return this.mapGoogleEventToEvent(response.data, options.calendarId || 'primary');
  }

  /**
   * Create event with Google Meet link
   */
  async createMeeting(
    userId: string,
    options: Omit<CreateEventOptions, 'createMeetLink'>
  ): Promise<CalendarEvent> {
    return this.createEvent(userId, {
      ...options,
      createMeetLink: true,
      sendNotifications: true,
    });
  }

  /**
   * Update an existing event
   */
  async updateEvent(
    userId: string,
    eventId: string,
    options: UpdateEventOptions,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent> {
    const calendar = await this.getCalendarClient(userId);

    const updateResource: calendar_v3.Schema$Event = {};

    if (options.title) updateResource.summary = options.title;
    if (options.description !== undefined) updateResource.description = options.description;
    if (options.location !== undefined) updateResource.location = options.location;
    if (options.startTime) {
      updateResource.start = {
        dateTime: options.startTime.toISOString(),
      };
    }
    if (options.endTime) {
      updateResource.end = {
        dateTime: options.endTime.toISOString(),
      };
    }
    if (options.attendees) {
      updateResource.attendees = options.attendees.map(email => ({ email }));
    }

    const response = await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: updateResource,
      sendUpdates: options.sendNotifications ? 'all' : 'none',
    });

    return this.mapGoogleEventToEvent(response.data, calendarId);
  }

  /**
   * Delete an event
   */
  async deleteEvent(
    userId: string,
    eventId: string,
    calendarId: string = 'primary',
    sendNotifications: boolean = true
  ): Promise<void> {
    const calendar = await this.getCalendarClient(userId);

    await calendar.events.delete({
      calendarId,
      eventId,
      sendUpdates: sendNotifications ? 'all' : 'none',
    });
  }

  /**
   * Check free/busy status
   */
  async getFreeBusy(
    userId: string,
    timeMin: Date,
    timeMax: Date,
    calendarIds: string[] = ['primary']
  ): Promise<Map<string, FreeBusySlot[]>> {
    const calendar = await this.getCalendarClient(userId);

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: calendarIds.map(id => ({ id })),
      },
    });

    const result = new Map<string, FreeBusySlot[]>();

    if (response.data.calendars) {
      for (const [calId, data] of Object.entries(response.data.calendars)) {
        const slots: FreeBusySlot[] = (data.busy || []).map(slot => ({
          start: new Date(slot.start || ''),
          end: new Date(slot.end || ''),
        }));
        result.set(calId, slots);
      }
    }

    return result;
  }

  /**
   * Find available time slots
   */
  async findAvailableSlots(
    userId: string,
    options: {
      timeMin: Date;
      timeMax: Date;
      duration: number; // minutes
      attendeeEmails?: string[];
    }
  ): Promise<{ start: Date; end: Date }[]> {
    const freeBusy = await this.getFreeBusy(
      userId,
      options.timeMin,
      options.timeMax,
      ['primary']
    );

    const busySlots = freeBusy.get('primary') || [];
    const availableSlots: { start: Date; end: Date }[] = [];

    // Sort busy slots by start time
    busySlots.sort((a, b) => a.start.getTime() - b.start.getTime());

    let currentStart = new Date(options.timeMin);
    const durationMs = options.duration * 60 * 1000;

    // Find gaps in busy schedule
    for (const busy of busySlots) {
      if (currentStart.getTime() + durationMs <= busy.start.getTime()) {
        // There's a gap before this busy slot
        let slotEnd = new Date(busy.start);

        // Add slots of the requested duration
        while (currentStart.getTime() + durationMs <= slotEnd.getTime()) {
          availableSlots.push({
            start: new Date(currentStart),
            end: new Date(currentStart.getTime() + durationMs),
          });
          currentStart = new Date(currentStart.getTime() + durationMs);
        }
      }

      // Move past this busy slot
      if (busy.end.getTime() > currentStart.getTime()) {
        currentStart = new Date(busy.end);
      }
    }

    // Check for available time after the last busy slot
    while (currentStart.getTime() + durationMs <= options.timeMax.getTime()) {
      availableSlots.push({
        start: new Date(currentStart),
        end: new Date(currentStart.getTime() + durationMs),
      });
      currentStart = new Date(currentStart.getTime() + durationMs);
    }

    // Filter to business hours (9 AM - 6 PM)
    return availableSlots.filter(slot => {
      const hour = slot.start.getHours();
      return hour >= 9 && hour < 18;
    });
  }

  /**
   * RSVP to an event
   */
  async respondToEvent(
    userId: string,
    eventId: string,
    response: 'accepted' | 'declined' | 'tentative',
    calendarId: string = 'primary'
  ): Promise<void> {
    const calendar = await this.getCalendarClient(userId);
    const tokens = await googleOAuth.getTokens(userId);

    if (!tokens?.google_email) {
      throw new Error('Could not get user email');
    }

    // Get current event to find attendee
    const event = await calendar.events.get({
      calendarId,
      eventId,
    });

    const attendees = event.data.attendees?.map(attendee => {
      if (attendee.email === tokens.google_email) {
        return { ...attendee, responseStatus: response };
      }
      return attendee;
    });

    await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: { attendees },
    });
  }

  /**
   * Get list of calendars
   */
  async getCalendarList(userId: string): Promise<{
    id: string;
    name: string;
    primary: boolean;
    accessRole: string;
  }[]> {
    const calendar = await this.getCalendarClient(userId);

    const response = await calendar.calendarList.list();

    return (response.data.items || []).map(cal => ({
      id: cal.id || '',
      name: cal.summary || '',
      primary: cal.primary || false,
      accessRole: cal.accessRole || 'reader',
    }));
  }

  /**
   * Quick add event using natural language
   */
  async quickAddEvent(
    userId: string,
    text: string,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent> {
    const calendar = await this.getCalendarClient(userId);

    const response = await calendar.events.quickAdd({
      calendarId,
      text,
    });

    return this.mapGoogleEventToEvent(response.data, calendarId);
  }

  // ==================== Helper Methods ====================

  /**
   * Map Google Calendar event to our event type
   */
  private mapGoogleEventToEvent(
    event: calendar_v3.Schema$Event,
    calendarId: string
  ): CalendarEvent {
    const isAllDay = !event.start?.dateTime;

    return {
      id: event.id || '',
      googleEventId: event.id || '',
      calendarId,
      title: event.summary || '(No Title)',
      description: event.description || undefined,
      location: event.location || undefined,
      startTime: new Date(event.start?.dateTime || event.start?.date || ''),
      endTime: new Date(event.end?.dateTime || event.end?.date || ''),
      timezone: event.start?.timeZone || undefined,
      isAllDay,
      meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri || undefined,
      conferenceId: event.conferenceData?.conferenceId || undefined,
      attendees: (event.attendees || []).map(a => ({
        email: a.email || '',
        displayName: a.displayName || undefined,
        responseStatus: a.responseStatus as EventAttendee['responseStatus'],
        organizer: a.organizer || false,
        self: a.self || false,
      })),
      organizerEmail: event.organizer?.email || undefined,
      responseStatus: this.getCurrentUserResponse(event),
      status: (event.status as CalendarEvent['status']) || 'confirmed',
      isRecurring: !!event.recurringEventId,
      recurrenceRule: event.recurrence?.[0] || undefined,
    };
  }

  /**
   * Get current user's response status from event
   */
  private getCurrentUserResponse(
    event: calendar_v3.Schema$Event
  ): 'accepted' | 'declined' | 'tentative' | 'needsAction' | undefined {
    const selfAttendee = event.attendees?.find(a => a.self);
    return selfAttendee?.responseStatus as CalendarEvent['responseStatus'];
  }

  /**
   * Sync events to database
   */
  async syncEventsToDb(
    userId: string,
    customerId?: string,
    options: { days?: number } = {}
  ): Promise<number> {
    if (!this.supabase) return 0;

    const events = await this.getUpcomingEvents(userId, options.days || 30);
    let synced = 0;

    for (const event of events) {
      // Type assertion needed until Supabase types are regenerated
      const { error } = await (this.supabase as any)
        .from('calendar_events')
        .upsert({
          user_id: userId,
          customer_id: customerId,
          google_event_id: event.googleEventId,
          google_calendar_id: event.calendarId,
          title: event.title,
          description: event.description,
          location: event.location,
          start_time: event.startTime.toISOString(),
          end_time: event.endTime.toISOString(),
          timezone: event.timezone,
          is_all_day: event.isAllDay,
          attendees: event.attendees,
          organizer_email: event.organizerEmail,
          response_status: event.responseStatus,
          meet_link: event.meetLink,
          conference_id: event.conferenceId,
          status: event.status,
          is_recurring: event.isRecurring,
          recurrence_rule: event.recurrenceRule,
          last_synced_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,google_event_id',
        });

      if (!error) synced++;
    }

    return synced;
  }
}

// Singleton instance
export const calendarService = new CalendarService();
