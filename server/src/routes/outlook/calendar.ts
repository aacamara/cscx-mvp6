/**
 * Outlook Calendar API Routes
 * Endpoints for calendar and meeting operations via Microsoft Graph
 * PRD-189: Outlook Calendar Integration
 */

import { Router, Request, Response, NextFunction } from 'express';
import { outlookCalendarService } from '../../services/outlook/index.js';
import { config } from '../../config/index.js';

const router = Router();

// Demo user ID - ONLY used in development mode
const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';

/**
 * Get user ID from request.
 * SECURITY: Demo user fallback ONLY allowed in development mode.
 * Production mode requires authenticated user (set by authMiddleware).
 */
const getUserId = (req: Request): string | null => {
  // Prefer userId from auth middleware (set by JWT verification)
  if ((req as any).userId) {
    return (req as any).userId;
  }

  // Development only: allow demo user for local testing
  if (config.nodeEnv === 'development') {
    return DEMO_USER_ID;
  }

  // Production: no fallback - must be authenticated
  return null;
};

/**
 * Helper to require authentication.
 * Returns 401 if not authenticated in production.
 */
const requireAuth = (req: Request, res: Response): string | null => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
    return null;
  }
  return userId;
};

/**
 * GET /api/outlook/calendar/events
 * List calendar events
 */
router.get('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { calendarId, timeMin, timeMax, maxResults, filter } = req.query;

    const events = await outlookCalendarService.listEvents(userId, {
      calendarId: calendarId as string,
      timeMin: timeMin ? new Date(timeMin as string) : undefined,
      timeMax: timeMax ? new Date(timeMax as string) : undefined,
      maxResults: maxResults ? parseInt(maxResults as string) : undefined,
      filter: filter as string,
    });

    res.json({ events });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/outlook/calendar/events/today
 * Get today's events
 */
router.get('/events/today', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const events = await outlookCalendarService.getTodayEvents(userId);
    res.json({ events });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/outlook/calendar/events/upcoming
 * Get upcoming events (next N days)
 */
router.get('/events/upcoming', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { days, maxResults } = req.query;

    const events = await outlookCalendarService.getUpcomingEvents(
      userId,
      days ? parseInt(days as string) : 7,
      maxResults ? parseInt(maxResults as string) : 20
    );

    res.json({ events });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/outlook/calendar/events/:eventId
 * Get a single event
 */
router.get('/events/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { eventId } = req.params;
    const { calendarId } = req.query;

    const event = await outlookCalendarService.getEvent(
      userId,
      eventId,
      calendarId as string
    );

    res.json({ event });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/outlook/calendar/events
 * Create a new event
 */
router.post('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const {
      subject,
      body,
      bodyContentType,
      location,
      startTime,
      endTime,
      timezone,
      attendees,
      isOnlineMeeting,
      onlineMeetingProvider,
      showAs,
      importance,
      recurrence,
      reminderMinutesBefore,
      calendarId,
    } = req.body;

    if (!subject || !startTime || !endTime) {
      return res.status(400).json({
        error: 'subject, startTime, and endTime are required',
      });
    }

    const event = await outlookCalendarService.createEvent(userId, {
      subject,
      body,
      bodyContentType,
      location,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      timezone,
      attendees,
      isOnlineMeeting,
      onlineMeetingProvider,
      showAs,
      importance,
      recurrence,
      reminderMinutesBefore,
      calendarId,
    });

    res.status(201).json({ event });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/outlook/calendar/meetings
 * Create a meeting with Teams link
 */
router.post('/meetings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const {
      subject,
      body,
      bodyContentType,
      location,
      startTime,
      endTime,
      timezone,
      attendees,
      showAs,
      importance,
      reminderMinutesBefore,
      calendarId,
    } = req.body;

    if (!subject || !startTime || !endTime) {
      return res.status(400).json({
        error: 'subject, startTime, and endTime are required',
      });
    }

    const event = await outlookCalendarService.createTeamsMeeting(userId, {
      subject,
      body,
      bodyContentType,
      location,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      timezone,
      attendees,
      showAs,
      importance,
      reminderMinutesBefore,
      calendarId,
    });

    res.status(201).json({ event, teamsJoinUrl: event.teamsJoinUrl });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/outlook/calendar/events/:eventId
 * Update an event
 */
router.put('/events/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { eventId } = req.params;
    const {
      subject,
      body,
      bodyContentType,
      location,
      startTime,
      endTime,
      timezone,
      attendees,
      isOnlineMeeting,
      showAs,
      calendarId,
    } = req.body;

    const event = await outlookCalendarService.updateEvent(
      userId,
      eventId,
      {
        subject,
        body,
        bodyContentType,
        location,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        timezone,
        attendees,
        isOnlineMeeting,
        showAs,
      },
      calendarId
    );

    res.json({ event });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/outlook/calendar/events/:eventId
 * Delete an event
 */
router.delete('/events/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { eventId } = req.params;
    const { calendarId } = req.query;

    await outlookCalendarService.deleteEvent(
      userId,
      eventId,
      calendarId as string
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/outlook/calendar/events/:eventId/cancel
 * Cancel an event (with optional message)
 */
router.post('/events/:eventId/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { eventId } = req.params;
    const { comment, calendarId } = req.body;

    await outlookCalendarService.cancelEvent(
      userId,
      eventId,
      comment,
      calendarId
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/outlook/calendar/events/:eventId/respond
 * RSVP to an event
 */
router.post('/events/:eventId/respond', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { eventId } = req.params;
    const { response, comment, sendResponse, calendarId } = req.body;

    if (!response || !['accept', 'tentativelyAccept', 'decline'].includes(response)) {
      return res.status(400).json({
        error: 'response must be one of: accept, tentativelyAccept, decline',
      });
    }

    await outlookCalendarService.respondToEvent(
      userId,
      eventId,
      response,
      comment,
      sendResponse !== false,
      calendarId
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/outlook/calendar/availability
 * Check free/busy status (getSchedule)
 */
router.post('/availability', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { schedules, startTime, endTime, interval } = req.body;

    if (!schedules || !startTime || !endTime) {
      return res.status(400).json({
        error: 'schedules (email array), startTime, and endTime are required',
      });
    }

    const freeBusy = await outlookCalendarService.getFreeBusy(
      userId,
      schedules,
      new Date(startTime),
      new Date(endTime),
      interval || 30
    );

    // Convert Map to object for JSON response
    const result: Record<string, any[]> = {};
    freeBusy.forEach((slots, email) => {
      result[email] = slots.map(s => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        status: s.status,
      }));
    });

    res.json({ availability: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/outlook/calendar/findmeetingtimes
 * Find meeting times using Microsoft's intelligent scheduling
 */
router.post('/findmeetingtimes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const {
      attendees,
      durationMinutes,
      startTime,
      endTime,
      isOrganizerOptional,
      returnSuggestionReasons,
      minimumAttendeePercentage,
    } = req.body;

    if (!attendees || !durationMinutes) {
      return res.status(400).json({
        error: 'attendees and durationMinutes are required',
      });
    }

    const suggestions = await outlookCalendarService.findMeetingTimes(userId, {
      attendees,
      durationMinutes,
      timeConstraint: startTime && endTime ? {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
      } : undefined,
      isOrganizerOptional,
      returnSuggestionReasons,
      minimumAttendeePercentage,
    });

    res.json({
      suggestions: suggestions.map(s => ({
        ...s,
        meetingTimeSlot: {
          start: s.meetingTimeSlot.start.toISOString(),
          end: s.meetingTimeSlot.end.toISOString(),
        },
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/outlook/calendar/calendars
 * List available calendars
 */
router.get('/calendars', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const calendars = await outlookCalendarService.getCalendarList(userId);
    res.json({ calendars });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/outlook/calendar/sync
 * Sync events to database
 */
router.post('/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { customerId, days } = req.body;

    const synced = await outlookCalendarService.syncEventsToDb(userId, customerId, { days });
    res.json({ synced });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/outlook/calendar/metrics/:customerId
 * Get meeting metrics for a customer
 */
router.get('/metrics/:customerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { customerId } = req.params;
    const { startDate, endDate } = req.query;

    const metrics = await outlookCalendarService.calculateMeetingMetrics(
      userId,
      customerId,
      {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      }
    );

    res.json({ metrics });
  } catch (error) {
    next(error);
  }
});

export default router;
