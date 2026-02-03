/**
 * useOutlookCalendar Hook
 * Provides Outlook calendar operations for React components
 * PRD-189: Outlook Calendar Integration
 */

import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Types
export interface OutlookCalendarEvent {
  id: string;
  outlookEventId: string;
  calendarId: string;
  subject: string;
  bodyPreview?: string;
  bodyContent?: string;
  location?: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  isAllDay: boolean;
  onlineMeetingUrl?: string;
  teamsJoinUrl?: string;
  attendees: OutlookEventAttendee[];
  organizerEmail?: string;
  responseStatus?: 'accepted' | 'declined' | 'tentative' | 'notResponded' | 'none';
  showAs: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown';
  isRecurring: boolean;
  isCancelled: boolean;
  importance: 'low' | 'normal' | 'high';
}

export interface OutlookEventAttendee {
  email: string;
  name?: string;
  type: 'required' | 'optional' | 'resource';
  responseStatus?: 'accepted' | 'declined' | 'tentative' | 'notResponded' | 'none';
}

export interface OutlookCalendar {
  id: string;
  name: string;
  isDefaultCalendar: boolean;
  canEdit: boolean;
  owner?: string;
}

export interface CreateEventParams {
  subject: string;
  body?: string;
  bodyContentType?: 'text' | 'HTML';
  location?: string;
  startTime: Date | string;
  endTime: Date | string;
  timezone?: string;
  attendees?: { email: string; name?: string; type?: 'required' | 'optional' }[];
  isOnlineMeeting?: boolean;
  showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere';
  importance?: 'low' | 'normal' | 'high';
  reminderMinutesBefore?: number;
  calendarId?: string;
}

export interface MeetingTimeSuggestion {
  meetingTimeSlot: {
    start: string;
    end: string;
  };
  confidence: number;
  attendeeAvailability: {
    email: string;
    availability: 'free' | 'busy' | 'tentative' | 'unknown';
  }[];
  locations: string[];
}

export interface MeetingMetrics {
  totalMeetings: number;
  totalDurationMinutes: number;
  averageDurationMinutes: number;
  meetingFrequency: number;
  attendanceRate: number;
  lastMeetingDate?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  email?: string;
  displayName?: string;
  scopes?: string[];
  expiresAt?: string;
  isValid?: boolean;
}

interface UseOutlookCalendarReturn {
  // Connection
  connectionStatus: ConnectionStatus | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Connection actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  checkStatus: () => Promise<void>;

  // Calendar operations
  listEvents: (options?: {
    timeMin?: Date;
    timeMax?: Date;
    maxResults?: number;
    calendarId?: string;
  }) => Promise<OutlookCalendarEvent[]>;
  getTodayEvents: () => Promise<OutlookCalendarEvent[]>;
  getUpcomingEvents: (days?: number, maxResults?: number) => Promise<OutlookCalendarEvent[]>;
  getEvent: (eventId: string, calendarId?: string) => Promise<OutlookCalendarEvent>;

  // Event mutations
  createEvent: (params: CreateEventParams) => Promise<OutlookCalendarEvent>;
  createTeamsMeeting: (params: CreateEventParams) => Promise<OutlookCalendarEvent>;
  updateEvent: (eventId: string, params: Partial<CreateEventParams>, calendarId?: string) => Promise<OutlookCalendarEvent>;
  deleteEvent: (eventId: string, calendarId?: string) => Promise<void>;
  cancelEvent: (eventId: string, comment?: string, calendarId?: string) => Promise<void>;
  respondToEvent: (eventId: string, response: 'accept' | 'tentativelyAccept' | 'decline', comment?: string) => Promise<void>;

  // Scheduling
  getAvailability: (emails: string[], startTime: Date, endTime: Date) => Promise<Record<string, any[]>>;
  findMeetingTimes: (options: {
    attendees: { email: string; type?: 'required' | 'optional' }[];
    durationMinutes: number;
    startTime?: Date;
    endTime?: Date;
  }) => Promise<MeetingTimeSuggestion[]>;

  // Calendar management
  getCalendars: () => Promise<OutlookCalendar[]>;

  // Sync & metrics
  syncEvents: (customerId?: string, days?: number) => Promise<number>;
  getMeetingMetrics: (customerId: string, startDate?: Date, endDate?: Date) => Promise<MeetingMetrics>;
}

export function useOutlookCalendar(userId?: string): UseOutlookCalendarReturn {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userId) headers['x-user-id'] = userId;

  // Fetch connection status
  const checkStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/outlook/auth/status`, { headers });

      if (!response.ok) {
        throw new Error('Failed to fetch connection status');
      }

      const status = await response.json();
      setConnectionStatus(status);
      setError(null);
    } catch (err) {
      console.error('Failed to check Outlook status:', err);
      setError((err as Error).message);
      setConnectionStatus({ connected: false });
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Connect to Outlook
  const connect = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/outlook/auth/connect?userId=${userId || ''}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to initiate connection');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, [userId]);

  // Disconnect from Outlook
  const disconnect = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/outlook/auth/disconnect`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setConnectionStatus({ connected: false });
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, [userId]);

  // List events
  const listEvents = useCallback(async (options?: {
    timeMin?: Date;
    timeMax?: Date;
    maxResults?: number;
    calendarId?: string;
  }): Promise<OutlookCalendarEvent[]> => {
    const params = new URLSearchParams();
    if (options?.timeMin) params.append('timeMin', options.timeMin.toISOString());
    if (options?.timeMax) params.append('timeMax', options.timeMax.toISOString());
    if (options?.maxResults) params.append('maxResults', options.maxResults.toString());
    if (options?.calendarId) params.append('calendarId', options.calendarId);

    const response = await fetch(`${API_URL}/api/outlook/calendar/events?${params}`, { headers });

    if (!response.ok) {
      throw new Error('Failed to list events');
    }

    const { events } = await response.json();
    return events;
  }, [userId]);

  // Get today's events
  const getTodayEvents = useCallback(async (): Promise<OutlookCalendarEvent[]> => {
    const response = await fetch(`${API_URL}/api/outlook/calendar/events/today`, { headers });

    if (!response.ok) {
      throw new Error('Failed to get today events');
    }

    const { events } = await response.json();
    return events;
  }, [userId]);

  // Get upcoming events
  const getUpcomingEvents = useCallback(async (
    days: number = 7,
    maxResults: number = 20
  ): Promise<OutlookCalendarEvent[]> => {
    const response = await fetch(
      `${API_URL}/api/outlook/calendar/events/upcoming?days=${days}&maxResults=${maxResults}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error('Failed to get upcoming events');
    }

    const { events } = await response.json();
    return events;
  }, [userId]);

  // Get single event
  const getEvent = useCallback(async (
    eventId: string,
    calendarId?: string
  ): Promise<OutlookCalendarEvent> => {
    const params = calendarId ? `?calendarId=${calendarId}` : '';
    const response = await fetch(`${API_URL}/api/outlook/calendar/events/${eventId}${params}`, { headers });

    if (!response.ok) {
      throw new Error('Failed to get event');
    }

    const { event } = await response.json();
    return event;
  }, [userId]);

  // Create event
  const createEvent = useCallback(async (params: CreateEventParams): Promise<OutlookCalendarEvent> => {
    const response = await fetch(`${API_URL}/api/outlook/calendar/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...params,
        startTime: params.startTime instanceof Date ? params.startTime.toISOString() : params.startTime,
        endTime: params.endTime instanceof Date ? params.endTime.toISOString() : params.endTime,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to create event');
    }

    const { event } = await response.json();
    return event;
  }, [userId]);

  // Create Teams meeting
  const createTeamsMeeting = useCallback(async (params: CreateEventParams): Promise<OutlookCalendarEvent> => {
    const response = await fetch(`${API_URL}/api/outlook/calendar/meetings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...params,
        startTime: params.startTime instanceof Date ? params.startTime.toISOString() : params.startTime,
        endTime: params.endTime instanceof Date ? params.endTime.toISOString() : params.endTime,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to create Teams meeting');
    }

    const { event } = await response.json();
    return event;
  }, [userId]);

  // Update event
  const updateEvent = useCallback(async (
    eventId: string,
    params: Partial<CreateEventParams>,
    calendarId?: string
  ): Promise<OutlookCalendarEvent> => {
    const response = await fetch(`${API_URL}/api/outlook/calendar/events/${eventId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        ...params,
        startTime: params.startTime instanceof Date ? params.startTime.toISOString() : params.startTime,
        endTime: params.endTime instanceof Date ? params.endTime.toISOString() : params.endTime,
        calendarId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update event');
    }

    const { event } = await response.json();
    return event;
  }, [userId]);

  // Delete event
  const deleteEvent = useCallback(async (eventId: string, calendarId?: string): Promise<void> => {
    const params = calendarId ? `?calendarId=${calendarId}` : '';
    const response = await fetch(`${API_URL}/api/outlook/calendar/events/${eventId}${params}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to delete event');
    }
  }, [userId]);

  // Cancel event
  const cancelEvent = useCallback(async (
    eventId: string,
    comment?: string,
    calendarId?: string
  ): Promise<void> => {
    const response = await fetch(`${API_URL}/api/outlook/calendar/events/${eventId}/cancel`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ comment, calendarId }),
    });

    if (!response.ok) {
      throw new Error('Failed to cancel event');
    }
  }, [userId]);

  // Respond to event
  const respondToEvent = useCallback(async (
    eventId: string,
    response: 'accept' | 'tentativelyAccept' | 'decline',
    comment?: string
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/api/outlook/calendar/events/${eventId}/respond`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ response, comment }),
    });

    if (!res.ok) {
      throw new Error('Failed to respond to event');
    }
  }, [userId]);

  // Get availability
  const getAvailability = useCallback(async (
    emails: string[],
    startTime: Date,
    endTime: Date
  ): Promise<Record<string, any[]>> => {
    const response = await fetch(`${API_URL}/api/outlook/calendar/availability`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        schedules: emails,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get availability');
    }

    const { availability } = await response.json();
    return availability;
  }, [userId]);

  // Find meeting times
  const findMeetingTimes = useCallback(async (options: {
    attendees: { email: string; type?: 'required' | 'optional' }[];
    durationMinutes: number;
    startTime?: Date;
    endTime?: Date;
  }): Promise<MeetingTimeSuggestion[]> => {
    const response = await fetch(`${API_URL}/api/outlook/calendar/findmeetingtimes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        attendees: options.attendees,
        durationMinutes: options.durationMinutes,
        startTime: options.startTime?.toISOString(),
        endTime: options.endTime?.toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to find meeting times');
    }

    const { suggestions } = await response.json();
    return suggestions;
  }, [userId]);

  // Get calendars
  const getCalendars = useCallback(async (): Promise<OutlookCalendar[]> => {
    const response = await fetch(`${API_URL}/api/outlook/calendar/calendars`, { headers });

    if (!response.ok) {
      throw new Error('Failed to get calendars');
    }

    const { calendars } = await response.json();
    return calendars;
  }, [userId]);

  // Sync events
  const syncEvents = useCallback(async (customerId?: string, days?: number): Promise<number> => {
    const response = await fetch(`${API_URL}/api/outlook/calendar/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ customerId, days }),
    });

    if (!response.ok) {
      throw new Error('Failed to sync events');
    }

    const { synced } = await response.json();
    return synced;
  }, [userId]);

  // Get meeting metrics
  const getMeetingMetrics = useCallback(async (
    customerId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<MeetingMetrics> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());

    const response = await fetch(
      `${API_URL}/api/outlook/calendar/metrics/${customerId}?${params}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error('Failed to get meeting metrics');
    }

    const { metrics } = await response.json();
    return metrics;
  }, [userId]);

  return {
    // Connection
    connectionStatus,
    isConnected: connectionStatus?.connected ?? false,
    isLoading,
    error,

    // Connection actions
    connect,
    disconnect,
    checkStatus,

    // Calendar operations
    listEvents,
    getTodayEvents,
    getUpcomingEvents,
    getEvent,

    // Event mutations
    createEvent,
    createTeamsMeeting,
    updateEvent,
    deleteEvent,
    cancelEvent,
    respondToEvent,

    // Scheduling
    getAvailability,
    findMeetingTimes,

    // Calendar management
    getCalendars,

    // Sync & metrics
    syncEvents,
    getMeetingMetrics,
  };
}

export default useOutlookCalendar;
