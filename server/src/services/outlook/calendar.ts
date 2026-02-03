/**
 * Outlook Calendar Service
 * Handles Microsoft Graph Calendar API operations: events, scheduling, Teams meetings
 * PRD-189: Outlook Calendar Integration
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { microsoftOAuth } from './oauth.js';

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

// Types
export interface OutlookCalendarEvent {
  id: string;
  outlookEventId: string;
  calendarId: string;
  subject: string;
  bodyPreview?: string;
  bodyContent?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  timezone?: string;
  isAllDay: boolean;
  onlineMeetingUrl?: string;
  teamsJoinUrl?: string;
  attendees: OutlookEventAttendee[];
  organizerEmail?: string;
  responseStatus?: 'accepted' | 'declined' | 'tentative' | 'notResponded' | 'none';
  showAs: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown';
  isRecurring: boolean;
  recurrencePattern?: OutlookRecurrence;
  isCancelled: boolean;
  importance: 'low' | 'normal' | 'high';
  sensitivity: 'normal' | 'personal' | 'private' | 'confidential';
}

export interface OutlookEventAttendee {
  email: string;
  name?: string;
  type: 'required' | 'optional' | 'resource';
  responseStatus?: 'accepted' | 'declined' | 'tentative' | 'notResponded' | 'none';
}

export interface OutlookRecurrence {
  pattern: {
    type: 'daily' | 'weekly' | 'absoluteMonthly' | 'relativeMonthly' | 'absoluteYearly' | 'relativeYearly';
    interval: number;
    daysOfWeek?: string[];
    dayOfMonth?: number;
    month?: number;
  };
  range: {
    type: 'endDate' | 'noEnd' | 'numbered';
    startDate: string;
    endDate?: string;
    numberOfOccurrences?: number;
  };
}

export interface CreateOutlookEventOptions {
  subject: string;
  body?: string;
  bodyContentType?: 'text' | 'HTML';
  location?: string;
  startTime: Date;
  endTime: Date;
  timezone?: string;
  attendees?: { email: string; name?: string; type?: 'required' | 'optional' }[];
  isOnlineMeeting?: boolean;
  onlineMeetingProvider?: 'teamsForBusiness' | 'skypeForBusiness' | 'skypeForConsumer';
  showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere';
  importance?: 'low' | 'normal' | 'high';
  recurrence?: OutlookRecurrence;
  reminderMinutesBefore?: number;
  calendarId?: string;
}

export interface UpdateOutlookEventOptions {
  subject?: string;
  body?: string;
  bodyContentType?: 'text' | 'HTML';
  location?: string;
  startTime?: Date;
  endTime?: Date;
  timezone?: string;
  attendees?: { email: string; name?: string; type?: 'required' | 'optional' }[];
  isOnlineMeeting?: boolean;
  showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere';
}

export interface FreeBusySlot {
  start: Date;
  end: Date;
  status: 'busy' | 'tentative' | 'oof' | 'workingElsewhere' | 'free';
}

export interface MeetingTimeSuggestion {
  meetingTimeSlot: {
    start: Date;
    end: Date;
  };
  confidence: number;
  attendeeAvailability: {
    email: string;
    availability: 'free' | 'busy' | 'tentative' | 'unknown';
  }[];
  locations: string[];
}

export class OutlookCalendarService {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Make authenticated request to Microsoft Graph API
   */
  private async graphRequest<T>(
    userId: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const accessToken = await microsoftOAuth.getValidAccessToken(userId);

    const response = await fetch(`${GRAPH_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Graph API error: ${error.error?.message || response.statusText}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
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
      filter?: string;
      select?: string[];
      orderBy?: string;
    } = {}
  ): Promise<OutlookCalendarEvent[]> {
    const calendarId = options.calendarId || 'calendar';
    const params = new URLSearchParams();

    // Build $filter
    const filters: string[] = [];
    if (options.timeMin) {
      filters.push(`start/dateTime ge '${options.timeMin.toISOString()}'`);
    }
    if (options.timeMax) {
      filters.push(`end/dateTime le '${options.timeMax.toISOString()}'`);
    }
    if (options.filter) {
      filters.push(options.filter);
    }
    if (filters.length > 0) {
      params.append('$filter', filters.join(' and '));
    }

    // Select fields
    const selectFields = options.select || [
      'id', 'subject', 'bodyPreview', 'start', 'end', 'location',
      'attendees', 'organizer', 'isOnlineMeeting', 'onlineMeeting',
      'showAs', 'isAllDay', 'recurrence', 'isCancelled', 'importance',
      'sensitivity', 'responseStatus'
    ];
    params.append('$select', selectFields.join(','));

    // Limit
    if (options.maxResults) {
      params.append('$top', options.maxResults.toString());
    }

    // Order
    params.append('$orderby', options.orderBy || 'start/dateTime');

    const response = await this.graphRequest<{ value: any[] }>(
      userId,
      `/me/${calendarId}/events?${params.toString()}`
    );

    return (response.value || []).map(event => this.mapGraphEventToEvent(event, calendarId));
  }

  /**
   * Get upcoming events (next N days)
   */
  async getUpcomingEvents(
    userId: string,
    days: number = 7,
    maxResults: number = 20
  ): Promise<OutlookCalendarEvent[]> {
    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + days);

    return this.listEvents(userId, {
      timeMin,
      timeMax,
      maxResults,
    });
  }

  /**
   * Get today's events
   */
  async getTodayEvents(userId: string): Promise<OutlookCalendarEvent[]> {
    const timeMin = new Date();
    timeMin.setHours(0, 0, 0, 0);

    const timeMax = new Date();
    timeMax.setHours(23, 59, 59, 999);

    return this.listEvents(userId, {
      timeMin,
      timeMax,
    });
  }

  /**
   * Get a single event by ID
   */
  async getEvent(
    userId: string,
    eventId: string,
    calendarId: string = 'calendar'
  ): Promise<OutlookCalendarEvent> {
    const event = await this.graphRequest<any>(
      userId,
      `/me/${calendarId}/events/${eventId}`
    );

    return this.mapGraphEventToEvent(event, calendarId);
  }

  /**
   * Create a new calendar event
   */
  async createEvent(userId: string, options: CreateOutlookEventOptions): Promise<OutlookCalendarEvent> {
    const calendarId = options.calendarId || 'calendar';

    const eventResource: Record<string, any> = {
      subject: options.subject,
      start: {
        dateTime: options.startTime.toISOString(),
        timeZone: options.timezone || 'UTC',
      },
      end: {
        dateTime: options.endTime.toISOString(),
        timeZone: options.timezone || 'UTC',
      },
    };

    if (options.body) {
      eventResource.body = {
        contentType: options.bodyContentType || 'HTML',
        content: options.body,
      };
    }

    if (options.location) {
      eventResource.location = {
        displayName: options.location,
      };
    }

    if (options.attendees?.length) {
      eventResource.attendees = options.attendees.map(a => ({
        emailAddress: {
          address: a.email,
          name: a.name,
        },
        type: a.type || 'required',
      }));
    }

    // Create Teams meeting if requested
    if (options.isOnlineMeeting) {
      eventResource.isOnlineMeeting = true;
      eventResource.onlineMeetingProvider = options.onlineMeetingProvider || 'teamsForBusiness';
    }

    if (options.showAs) {
      eventResource.showAs = options.showAs;
    }

    if (options.importance) {
      eventResource.importance = options.importance;
    }

    if (options.recurrence) {
      eventResource.recurrence = options.recurrence;
    }

    if (options.reminderMinutesBefore !== undefined) {
      eventResource.isReminderOn = true;
      eventResource.reminderMinutesBeforeStart = options.reminderMinutesBefore;
    }

    const response = await this.graphRequest<any>(
      userId,
      `/me/${calendarId}/events`,
      {
        method: 'POST',
        body: JSON.stringify(eventResource),
      }
    );

    return this.mapGraphEventToEvent(response, calendarId);
  }

  /**
   * Create event with Teams meeting link
   */
  async createTeamsMeeting(
    userId: string,
    options: Omit<CreateOutlookEventOptions, 'isOnlineMeeting' | 'onlineMeetingProvider'>
  ): Promise<OutlookCalendarEvent> {
    return this.createEvent(userId, {
      ...options,
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
    });
  }

  /**
   * Update an existing event
   */
  async updateEvent(
    userId: string,
    eventId: string,
    options: UpdateOutlookEventOptions,
    calendarId: string = 'calendar'
  ): Promise<OutlookCalendarEvent> {
    const updateResource: Record<string, any> = {};

    if (options.subject) updateResource.subject = options.subject;

    if (options.body !== undefined) {
      updateResource.body = {
        contentType: options.bodyContentType || 'HTML',
        content: options.body,
      };
    }

    if (options.location !== undefined) {
      updateResource.location = {
        displayName: options.location,
      };
    }

    if (options.startTime) {
      updateResource.start = {
        dateTime: options.startTime.toISOString(),
        timeZone: options.timezone || 'UTC',
      };
    }

    if (options.endTime) {
      updateResource.end = {
        dateTime: options.endTime.toISOString(),
        timeZone: options.timezone || 'UTC',
      };
    }

    if (options.attendees) {
      updateResource.attendees = options.attendees.map(a => ({
        emailAddress: {
          address: a.email,
          name: a.name,
        },
        type: a.type || 'required',
      }));
    }

    if (options.isOnlineMeeting !== undefined) {
      updateResource.isOnlineMeeting = options.isOnlineMeeting;
      if (options.isOnlineMeeting) {
        updateResource.onlineMeetingProvider = 'teamsForBusiness';
      }
    }

    if (options.showAs) {
      updateResource.showAs = options.showAs;
    }

    const response = await this.graphRequest<any>(
      userId,
      `/me/${calendarId}/events/${eventId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updateResource),
      }
    );

    return this.mapGraphEventToEvent(response, calendarId);
  }

  /**
   * Delete an event
   */
  async deleteEvent(
    userId: string,
    eventId: string,
    calendarId: string = 'calendar'
  ): Promise<void> {
    await this.graphRequest(
      userId,
      `/me/${calendarId}/events/${eventId}`,
      { method: 'DELETE' }
    );
  }

  /**
   * Cancel an event (instead of deleting)
   */
  async cancelEvent(
    userId: string,
    eventId: string,
    comment?: string,
    calendarId: string = 'calendar'
  ): Promise<void> {
    await this.graphRequest(
      userId,
      `/me/${calendarId}/events/${eventId}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify({ comment }),
      }
    );
  }

  /**
   * RSVP to an event
   */
  async respondToEvent(
    userId: string,
    eventId: string,
    response: 'accept' | 'tentativelyAccept' | 'decline',
    comment?: string,
    sendResponse: boolean = true,
    calendarId: string = 'calendar'
  ): Promise<void> {
    await this.graphRequest(
      userId,
      `/me/${calendarId}/events/${eventId}/${response}`,
      {
        method: 'POST',
        body: JSON.stringify({
          comment,
          sendResponse,
        }),
      }
    );
  }

  /**
   * Get free/busy schedule
   */
  async getFreeBusy(
    userId: string,
    schedules: string[], // Email addresses to check
    startTime: Date,
    endTime: Date,
    availabilityViewInterval: number = 30 // Minutes
  ): Promise<Map<string, FreeBusySlot[]>> {
    const response = await this.graphRequest<{
      value: {
        scheduleId: string;
        scheduleItems: {
          start: { dateTime: string; timeZone: string };
          end: { dateTime: string; timeZone: string };
          status: string;
        }[];
      }[];
    }>(
      userId,
      '/me/calendar/getSchedule',
      {
        method: 'POST',
        body: JSON.stringify({
          schedules,
          startTime: {
            dateTime: startTime.toISOString(),
            timeZone: 'UTC',
          },
          endTime: {
            dateTime: endTime.toISOString(),
            timeZone: 'UTC',
          },
          availabilityViewInterval,
        }),
      }
    );

    const result = new Map<string, FreeBusySlot[]>();

    for (const schedule of response.value || []) {
      const slots: FreeBusySlot[] = (schedule.scheduleItems || []).map(item => ({
        start: new Date(item.start.dateTime),
        end: new Date(item.end.dateTime),
        status: item.status as FreeBusySlot['status'],
      }));
      result.set(schedule.scheduleId, slots);
    }

    return result;
  }

  /**
   * Find meeting times using Microsoft's intelligent scheduling
   */
  async findMeetingTimes(
    userId: string,
    options: {
      attendees: { email: string; type?: 'required' | 'optional' }[];
      durationMinutes: number;
      timeConstraint?: {
        startTime: Date;
        endTime: Date;
      };
      isOrganizerOptional?: boolean;
      returnSuggestionReasons?: boolean;
      minimumAttendeePercentage?: number;
    }
  ): Promise<MeetingTimeSuggestion[]> {
    const requestBody: Record<string, any> = {
      attendees: options.attendees.map(a => ({
        emailAddress: { address: a.email },
        type: a.type || 'required',
      })),
      meetingDuration: `PT${options.durationMinutes}M`,
    };

    if (options.timeConstraint) {
      requestBody.timeConstraint = {
        activityDomain: 'work',
        timeslots: [{
          start: {
            dateTime: options.timeConstraint.startTime.toISOString(),
            timeZone: 'UTC',
          },
          end: {
            dateTime: options.timeConstraint.endTime.toISOString(),
            timeZone: 'UTC',
          },
        }],
      };
    }

    if (options.isOrganizerOptional !== undefined) {
      requestBody.isOrganizerOptional = options.isOrganizerOptional;
    }

    if (options.returnSuggestionReasons !== undefined) {
      requestBody.returnSuggestionReasons = options.returnSuggestionReasons;
    }

    if (options.minimumAttendeePercentage !== undefined) {
      requestBody.minimumAttendeePercentage = options.minimumAttendeePercentage;
    }

    const response = await this.graphRequest<{
      meetingTimeSuggestions: {
        meetingTimeSlot: {
          start: { dateTime: string; timeZone: string };
          end: { dateTime: string; timeZone: string };
        };
        confidence: number;
        attendeeAvailability: {
          attendee: { emailAddress: { address: string } };
          availability: string;
        }[];
        locations: { displayName: string }[];
      }[];
    }>(
      userId,
      '/me/findMeetingTimes',
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }
    );

    return (response.meetingTimeSuggestions || []).map(suggestion => ({
      meetingTimeSlot: {
        start: new Date(suggestion.meetingTimeSlot.start.dateTime),
        end: new Date(suggestion.meetingTimeSlot.end.dateTime),
      },
      confidence: suggestion.confidence,
      attendeeAvailability: (suggestion.attendeeAvailability || []).map(a => ({
        email: a.attendee.emailAddress.address,
        availability: a.availability as MeetingTimeSuggestion['attendeeAvailability'][0]['availability'],
      })),
      locations: (suggestion.locations || []).map(l => l.displayName),
    }));
  }

  /**
   * List available calendars
   */
  async getCalendarList(userId: string): Promise<{
    id: string;
    name: string;
    isDefaultCalendar: boolean;
    canEdit: boolean;
    owner?: string;
  }[]> {
    const response = await this.graphRequest<{ value: any[] }>(
      userId,
      '/me/calendars?$select=id,name,isDefaultCalendar,canEdit,owner'
    );

    return (response.value || []).map(cal => ({
      id: cal.id,
      name: cal.name,
      isDefaultCalendar: cal.isDefaultCalendar || false,
      canEdit: cal.canEdit || false,
      owner: cal.owner?.address,
    }));
  }

  /**
   * Map Microsoft Graph event to our event type
   */
  private mapGraphEventToEvent(
    event: any,
    calendarId: string
  ): OutlookCalendarEvent {
    const isAllDay = event.isAllDay || false;

    return {
      id: event.id,
      outlookEventId: event.id,
      calendarId,
      subject: event.subject || '(No Subject)',
      bodyPreview: event.bodyPreview || undefined,
      bodyContent: event.body?.content || undefined,
      location: event.location?.displayName || undefined,
      startTime: new Date(event.start?.dateTime || event.start?.date || ''),
      endTime: new Date(event.end?.dateTime || event.end?.date || ''),
      timezone: event.start?.timeZone || undefined,
      isAllDay,
      onlineMeetingUrl: event.onlineMeeting?.joinUrl || undefined,
      teamsJoinUrl: event.onlineMeeting?.joinUrl || undefined,
      attendees: (event.attendees || []).map((a: any) => ({
        email: a.emailAddress?.address || '',
        name: a.emailAddress?.name || undefined,
        type: a.type || 'required',
        responseStatus: this.mapResponseStatus(a.status?.response),
      })),
      organizerEmail: event.organizer?.emailAddress?.address || undefined,
      responseStatus: this.mapResponseStatus(event.responseStatus?.response),
      showAs: event.showAs || 'busy',
      isRecurring: !!event.recurrence,
      recurrencePattern: event.recurrence || undefined,
      isCancelled: event.isCancelled || false,
      importance: event.importance || 'normal',
      sensitivity: event.sensitivity || 'normal',
    };
  }

  /**
   * Map Microsoft response status to our format
   */
  private mapResponseStatus(
    status?: string
  ): 'accepted' | 'declined' | 'tentative' | 'notResponded' | 'none' | undefined {
    switch (status) {
      case 'accepted':
        return 'accepted';
      case 'declined':
        return 'declined';
      case 'tentativelyAccepted':
        return 'tentative';
      case 'notResponded':
        return 'notResponded';
      case 'none':
        return 'none';
      default:
        return undefined;
    }
  }

  /**
   * Sync events to database for tracking
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
      const { error } = await (this.supabase as any)
        .from('outlook_calendar_sync')
        .upsert({
          user_id: userId,
          customer_id: customerId,
          outlook_event_id: event.outlookEventId,
          calendar_id: event.calendarId,
          subject: event.subject,
          body_preview: event.bodyPreview,
          location: event.location,
          start_time: event.startTime.toISOString(),
          end_time: event.endTime.toISOString(),
          timezone: event.timezone,
          is_all_day: event.isAllDay,
          attendees: event.attendees,
          organizer_email: event.organizerEmail,
          response_status: event.responseStatus,
          teams_join_url: event.teamsJoinUrl,
          show_as: event.showAs,
          is_recurring: event.isRecurring,
          is_cancelled: event.isCancelled,
          last_synced_at: new Date().toISOString(),
          sync_direction: 'inbound',
        }, {
          onConflict: 'user_id,outlook_event_id',
        });

      if (!error) synced++;
    }

    return synced;
  }

  /**
   * Match event to customer by attendee domain or subject
   */
  async detectCustomerMeeting(
    event: OutlookCalendarEvent,
    customerDomains: string[]
  ): Promise<{ matched: boolean; matchedBy: 'domain' | 'subject' | null; domain?: string }> {
    // Check attendee domains
    for (const attendee of event.attendees) {
      const domain = attendee.email.split('@')[1]?.toLowerCase();
      if (domain && customerDomains.includes(domain)) {
        return { matched: true, matchedBy: 'domain', domain };
      }
    }

    // Could add subject pattern matching here
    return { matched: false, matchedBy: null };
  }

  /**
   * Calculate meeting metrics for a customer
   */
  async calculateMeetingMetrics(
    userId: string,
    customerId: string,
    options: { startDate?: Date; endDate?: Date } = {}
  ): Promise<{
    totalMeetings: number;
    totalDurationMinutes: number;
    averageDurationMinutes: number;
    meetingFrequency: number; // meetings per week
    attendanceRate: number;
    lastMeetingDate?: Date;
  }> {
    if (!this.supabase) {
      return {
        totalMeetings: 0,
        totalDurationMinutes: 0,
        averageDurationMinutes: 0,
        meetingFrequency: 0,
        attendanceRate: 0,
      };
    }

    // Query synced meetings for this customer
    let query = (this.supabase as any)
      .from('outlook_calendar_sync')
      .select('*')
      .eq('user_id', userId)
      .eq('customer_id', customerId)
      .eq('is_cancelled', false);

    if (options.startDate) {
      query = query.gte('start_time', options.startDate.toISOString());
    }
    if (options.endDate) {
      query = query.lte('end_time', options.endDate.toISOString());
    }

    const { data: meetings, error } = await query;

    if (error || !meetings?.length) {
      return {
        totalMeetings: 0,
        totalDurationMinutes: 0,
        averageDurationMinutes: 0,
        meetingFrequency: 0,
        attendanceRate: 0,
      };
    }

    const totalMeetings = meetings.length;
    const totalDurationMinutes = meetings.reduce((sum: number, m: any) => {
      const start = new Date(m.start_time).getTime();
      const end = new Date(m.end_time).getTime();
      return sum + (end - start) / (1000 * 60);
    }, 0);

    const averageDurationMinutes = totalDurationMinutes / totalMeetings;

    // Calculate frequency (meetings per week)
    const dates = meetings.map((m: any) => new Date(m.start_time));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    const weeks = Math.max(1, (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
    const meetingFrequency = totalMeetings / weeks;

    // Calculate attendance rate (meetings where user accepted)
    const acceptedMeetings = meetings.filter((m: any) => m.response_status === 'accepted').length;
    const attendanceRate = totalMeetings > 0 ? acceptedMeetings / totalMeetings : 0;

    // Last meeting date
    const lastMeetingDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : undefined;

    return {
      totalMeetings,
      totalDurationMinutes,
      averageDurationMinutes,
      meetingFrequency,
      attendanceRate,
      lastMeetingDate,
    };
  }
}

// Singleton instance
export const outlookCalendarService = new OutlookCalendarService();
