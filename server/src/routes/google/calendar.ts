/**
 * Calendar API Routes
 * Endpoints for calendar and meeting operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { calendarService } from '../../services/google/calendar.js';

const router = Router();

// Middleware to extract userId (in production, this comes from auth)
// Demo user ID with connected Google account
const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';

const getUserId = (req: Request): string => {
  return req.headers['x-user-id'] as string || req.query.userId as string || DEMO_USER_ID;
};

/**
 * GET /calendar/events
 * List calendar events
 */
router.get('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { calendarId, timeMin, timeMax, maxResults, query } = req.query;

    const events = await calendarService.listEvents(userId, {
      calendarId: calendarId as string,
      timeMin: timeMin ? new Date(timeMin as string) : undefined,
      timeMax: timeMax ? new Date(timeMax as string) : undefined,
      maxResults: maxResults ? parseInt(maxResults as string) : undefined,
      query: query as string,
    });

    res.json({ events });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /calendar/events/today
 * Get today's events
 */
router.get('/events/today', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const events = await calendarService.getTodayEvents(userId);
    res.json({ events });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /calendar/events/upcoming
 * Get upcoming events (next N days)
 */
router.get('/events/upcoming', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { days, maxResults } = req.query;

    const events = await calendarService.getUpcomingEvents(
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
 * GET /calendar/events/:eventId
 * Get a single event
 */
router.get('/events/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { eventId } = req.params;
    const { calendarId } = req.query;

    const event = await calendarService.getEvent(
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
 * POST /calendar/events
 * Create a new event
 */
router.post('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const {
      title,
      description,
      location,
      startTime,
      endTime,
      timezone,
      attendees,
      createMeetLink,
      sendNotifications,
      reminderMinutes,
      calendarId,
    } = req.body;

    if (!title || !startTime || !endTime) {
      return res.status(400).json({
        error: 'title, startTime, and endTime are required',
      });
    }

    const event = await calendarService.createEvent(userId, {
      title,
      description,
      location,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      timezone,
      attendees,
      createMeetLink,
      sendNotifications,
      reminderMinutes,
      calendarId,
    });

    res.status(201).json({ event });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /calendar/meetings
 * Create a meeting with Google Meet link
 */
router.post('/meetings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const {
      title,
      description,
      startTime,
      endTime,
      timezone,
      attendees,
      reminderMinutes,
      calendarId,
    } = req.body;

    if (!title || !startTime || !endTime) {
      return res.status(400).json({
        error: 'title, startTime, and endTime are required',
      });
    }

    const event = await calendarService.createMeeting(userId, {
      title,
      description,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      timezone,
      attendees,
      reminderMinutes,
      calendarId,
    });

    res.status(201).json({ event, meetLink: event.meetLink });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /calendar/events/:eventId
 * Update an event
 */
router.put('/events/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { eventId } = req.params;
    const {
      title,
      description,
      location,
      startTime,
      endTime,
      attendees,
      sendNotifications,
      calendarId,
    } = req.body;

    const event = await calendarService.updateEvent(
      userId,
      eventId,
      {
        title,
        description,
        location,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        attendees,
        sendNotifications,
      },
      calendarId
    );

    res.json({ event });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /calendar/events/:eventId
 * Delete an event
 */
router.delete('/events/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { eventId } = req.params;
    const { calendarId, sendNotifications } = req.query;

    await calendarService.deleteEvent(
      userId,
      eventId,
      calendarId as string,
      sendNotifications !== 'false'
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /calendar/events/:eventId/respond
 * RSVP to an event
 */
router.post('/events/:eventId/respond', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { eventId } = req.params;
    const { response, calendarId } = req.body;

    if (!response || !['accepted', 'declined', 'tentative'].includes(response)) {
      return res.status(400).json({
        error: 'response must be one of: accepted, declined, tentative',
      });
    }

    await calendarService.respondToEvent(
      userId,
      eventId,
      response,
      calendarId
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /calendar/freebusy
 * Check free/busy status
 */
router.post('/freebusy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { timeMin, timeMax, calendarIds } = req.body;

    if (!timeMin || !timeMax) {
      return res.status(400).json({
        error: 'timeMin and timeMax are required',
      });
    }

    const freeBusy = await calendarService.getFreeBusy(
      userId,
      new Date(timeMin),
      new Date(timeMax),
      calendarIds
    );

    // Convert Map to object for JSON response
    const result: Record<string, { start: string; end: string }[]> = {};
    freeBusy.forEach((slots, calId) => {
      result[calId] = slots.map(s => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
      }));
    });

    res.json({ freeBusy: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /calendar/available-slots
 * Find available time slots
 */
router.post('/available-slots', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { timeMin, timeMax, duration, attendeeEmails } = req.body;

    if (!timeMin || !timeMax || !duration) {
      return res.status(400).json({
        error: 'timeMin, timeMax, and duration (in minutes) are required',
      });
    }

    const slots = await calendarService.findAvailableSlots(userId, {
      timeMin: new Date(timeMin),
      timeMax: new Date(timeMax),
      duration,
      attendeeEmails,
    });

    res.json({
      slots: slots.map(s => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /calendar/quick-add
 * Quick add event using natural language
 */
router.post('/quick-add', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { text, calendarId } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const event = await calendarService.quickAddEvent(userId, text, calendarId);
    res.status(201).json({ event });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /calendar/calendars
 * List available calendars
 */
router.get('/calendars', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const calendars = await calendarService.getCalendarList(userId);
    res.json({ calendars });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /calendar/sync
 * Sync events to database
 */
router.post('/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const { customerId, days } = req.body;

    const synced = await calendarService.syncEventsToDb(userId, customerId, { days });
    res.json({ synced });
  } catch (error) {
    next(error);
  }
});

export default router;
