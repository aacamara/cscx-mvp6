/**
 * Meeting Prep Routes (PRD-127: Meeting Booked -> Pre-Meeting Research)
 *
 * API endpoints for automated pre-meeting research and briefing.
 *
 * Endpoints:
 * - GET  /api/meeting-prep/today             - Get today's meetings with prep status
 * - GET  /api/meeting-prep/upcoming          - Get upcoming meetings with prep briefs
 * - GET  /api/meeting-prep/:id               - Get specific prep brief
 * - POST /api/meeting-prep/:id/refresh       - Refresh/regenerate prep brief
 * - PUT  /api/meeting-prep/:id/viewed        - Mark brief as viewed
 * - PUT  /api/meeting-prep/:id/completed     - Mark brief as completed
 * - POST /api/meeting-prep/generate          - Manually generate brief for meeting
 * - GET  /api/meeting-prep/preferences       - Get user preferences
 * - PUT  /api/meeting-prep/preferences       - Update user preferences
 */

import { Router, Request, Response } from 'express';
import { meetingPrepService } from '../services/meetingPrepService.js';
import { calendarService } from '../services/google/calendar.js';

const router = Router();

/**
 * GET /api/meeting-prep/today
 *
 * Get today's meetings with their prep brief status.
 * Returns meetings sorted by start time with prep status indicator.
 */
router.get('/today', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string || 'demo_user';

    // Get today's prep briefs
    const briefs = await meetingPrepService.getTodaysBriefs(userId);

    // Enrich with meeting details from calendar if available
    const meetingsWithPrep = briefs.map(brief => ({
      id: brief.id,
      meetingId: brief.meetingId,
      calendarEventId: brief.calendarEventId,
      customerId: brief.customerId,
      customerName: brief.content.customerSnapshot.name,
      scheduledAt: brief.scheduledAt,
      meetingType: brief.content.meetingContext.meetingType,
      status: brief.status,
      viewedAt: brief.viewedAt,
      dataCompleteness: brief.dataCompleteness,
      healthScore: brief.content.customerSnapshot.healthScore,
      arr: brief.content.customerSnapshot.arr,
      talkingPointCount: brief.content.talkingPoints.length,
      openItemCount: brief.content.openItems.filter(i => i.priority === 'high').length,
      attendeeCount: brief.content.attendeeProfiles.length
    }));

    return res.json({
      success: true,
      data: {
        date: new Date().toISOString().split('T')[0],
        meetingCount: meetingsWithPrep.length,
        preparedCount: meetingsWithPrep.filter(m => m.status !== 'scheduled').length,
        viewedCount: meetingsWithPrep.filter(m => m.status === 'viewed' || m.status === 'completed').length,
        meetings: meetingsWithPrep
      }
    });
  } catch (error) {
    console.error('[MeetingPrep] Error fetching today\'s meetings:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch today\'s meeting prep'
      }
    });
  }
});

/**
 * GET /api/meeting-prep/upcoming
 *
 * Get upcoming meetings for the next N days with prep briefs.
 *
 * Query Parameters:
 * - days (optional): Number of days to look ahead (default: 7)
 */
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string || 'demo_user';
    const days = parseInt(req.query.days as string) || 7;

    const briefs = await meetingPrepService.getUpcomingBriefs(userId, days);

    const meetings = briefs.map(brief => ({
      id: brief.id,
      calendarEventId: brief.calendarEventId,
      customerId: brief.customerId,
      customerName: brief.content.customerSnapshot.name,
      scheduledAt: brief.scheduledAt,
      meetingType: brief.content.meetingContext.meetingType,
      status: brief.status,
      dataCompleteness: brief.dataCompleteness,
      healthScore: brief.content.customerSnapshot.healthScore
    }));

    // Group by date
    const groupedByDate = meetings.reduce((acc, meeting) => {
      const date = new Date(meeting.scheduledAt).toISOString().split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(meeting);
      return acc;
    }, {} as Record<string, typeof meetings>);

    return res.json({
      success: true,
      data: {
        days,
        totalMeetings: meetings.length,
        byDate: groupedByDate,
        meetings
      }
    });
  } catch (error) {
    console.error('[MeetingPrep] Error fetching upcoming meetings:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch upcoming meeting prep'
      }
    });
  }
});

/**
 * GET /api/meeting-prep/:id
 *
 * Get a specific prep brief by ID.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const brief = await meetingPrepService.getBriefById(id);

    if (!brief) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'BRIEF_NOT_FOUND',
          message: 'Meeting prep brief not found'
        }
      });
    }

    // Format for frontend consumption
    return res.json({
      success: true,
      data: {
        id: brief.id,
        meetingId: brief.meetingId,
        calendarEventId: brief.calendarEventId,
        customerId: brief.customerId,
        csmId: brief.csmId,
        scheduledAt: brief.scheduledAt,
        status: brief.status,
        viewedAt: brief.viewedAt,
        dataCompleteness: brief.dataCompleteness,

        // Customer context
        customer: {
          name: brief.content.customerSnapshot.name,
          healthScore: brief.content.customerSnapshot.healthScore,
          healthTrend: brief.content.customerSnapshot.healthTrend,
          arr: brief.content.customerSnapshot.arr,
          renewalDate: brief.content.customerSnapshot.renewalDate,
          stage: brief.content.customerSnapshot.stage,
          daysSinceLastMeeting: brief.content.customerSnapshot.daysSinceLastMeeting,
          industry: brief.content.customerSnapshot.industry
        },

        // Meeting context
        meetingContext: brief.content.meetingContext,

        // Prep content
        talkingPoints: brief.content.talkingPoints,
        questions: brief.content.questions,
        recommendations: brief.content.recommendations,

        // Supporting data
        attendees: brief.content.attendeeProfiles,
        recentActivity: brief.content.recentActivity,
        openItems: brief.content.openItems,
        previousMeetings: brief.content.previousMeetings
      }
    });
  } catch (error) {
    console.error('[MeetingPrep] Error fetching brief:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch meeting prep brief'
      }
    });
  }
});

/**
 * POST /api/meeting-prep/:id/refresh
 *
 * Refresh/regenerate a prep brief with latest data.
 */
router.post('/:id/refresh', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const brief = await meetingPrepService.refreshBrief(id);

    if (!brief) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REFRESH_FAILED',
          message: 'Failed to refresh meeting prep brief'
        }
      });
    }

    return res.json({
      success: true,
      data: {
        id: brief.id,
        refreshedAt: new Date().toISOString(),
        dataCompleteness: brief.dataCompleteness
      }
    });
  } catch (error) {
    console.error('[MeetingPrep] Error refreshing brief:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to refresh meeting prep brief'
      }
    });
  }
});

/**
 * PUT /api/meeting-prep/:id/viewed
 *
 * Mark a prep brief as viewed.
 */
router.put('/:id/viewed', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const success = await meetingPrepService.markAsViewed(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to mark brief as viewed'
        }
      });
    }

    return res.json({
      success: true,
      data: {
        id,
        status: 'viewed',
        viewedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[MeetingPrep] Error marking viewed:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to mark brief as viewed'
      }
    });
  }
});

/**
 * PUT /api/meeting-prep/:id/completed
 *
 * Mark a prep brief as completed (meeting finished).
 */
router.put('/:id/completed', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const success = await meetingPrepService.markAsCompleted(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to mark brief as completed'
        }
      });
    }

    return res.json({
      success: true,
      data: {
        id,
        status: 'completed'
      }
    });
  } catch (error) {
    console.error('[MeetingPrep] Error marking completed:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to mark brief as completed'
      }
    });
  }
});

/**
 * POST /api/meeting-prep/generate
 *
 * Manually generate a prep brief for a calendar event.
 *
 * Request Body:
 * - calendarEventId (required): Google Calendar event ID
 * - customerId (required): Customer ID
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { calendarEventId, customerId } = req.body;
    const userId = req.query.userId as string || req.body.userId || 'demo_user';

    if (!calendarEventId || !customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'calendarEventId and customerId are required'
        }
      });
    }

    // Get calendar event
    const event = await calendarService.getEvent(userId, calendarEventId);

    // Generate brief
    const brief = await meetingPrepService.generateBrief(event, customerId, userId);

    if (!brief) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: 'Failed to generate meeting prep brief'
        }
      });
    }

    return res.json({
      success: true,
      data: {
        id: brief.id,
        customerId: brief.customerId,
        scheduledAt: brief.scheduledAt,
        dataCompleteness: brief.dataCompleteness,
        customerName: brief.content.customerSnapshot.name
      }
    });
  } catch (error) {
    console.error('[MeetingPrep] Error generating brief:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate meeting prep brief'
      }
    });
  }
});

/**
 * POST /api/meeting-prep/generate-upcoming
 *
 * Generate briefs for all upcoming meetings that don't have one.
 * Typically called by a scheduler or manually triggered.
 */
router.post('/generate-upcoming', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string || req.body.userId || 'demo_user';
    const hoursAhead = parseInt(req.body.hoursAhead) || 48;

    const generated = await meetingPrepService.generateUpcomingBriefs(userId, hoursAhead);

    return res.json({
      success: true,
      data: {
        generated,
        message: `Generated ${generated} meeting prep brief(s)`
      }
    });
  } catch (error) {
    console.error('[MeetingPrep] Error generating upcoming briefs:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate upcoming meeting prep briefs'
      }
    });
  }
});

/**
 * GET /api/meeting-prep/preferences
 *
 * Get user's meeting prep preferences.
 */
router.get('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string || 'demo_user';

    const preferences = await meetingPrepService.getPreferences(userId);

    return res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error('[MeetingPrep] Error fetching preferences:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch preferences'
      }
    });
  }
});

/**
 * PUT /api/meeting-prep/preferences
 *
 * Update user's meeting prep preferences.
 */
router.put('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string || req.body.userId || 'demo_user';
    const updates = req.body;

    // Remove userId from updates to avoid confusion
    delete updates.userId;

    const success = await meetingPrepService.updatePreferences(userId, updates);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update preferences'
        }
      });
    }

    const updatedPrefs = await meetingPrepService.getPreferences(userId);

    return res.json({
      success: true,
      data: updatedPrefs
    });
  } catch (error) {
    console.error('[MeetingPrep] Error updating preferences:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update preferences'
      }
    });
  }
});

/**
 * GET /api/meeting-prep/stats
 *
 * Get meeting prep statistics for dashboard.
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string || 'demo_user';

    // Get briefs for stats calculation
    const todaysBriefs = await meetingPrepService.getTodaysBriefs(userId);
    const upcomingBriefs = await meetingPrepService.getUpcomingBriefs(userId, 7);

    const stats = {
      today: {
        total: todaysBriefs.length,
        viewed: todaysBriefs.filter(b => b.status === 'viewed' || b.status === 'completed').length,
        pending: todaysBriefs.filter(b => b.status === 'scheduled' || b.status === 'delivered').length
      },
      thisWeek: {
        total: upcomingBriefs.length,
        averageDataCompleteness: upcomingBriefs.length > 0
          ? Math.round(upcomingBriefs.reduce((sum, b) => sum + b.dataCompleteness, 0) / upcomingBriefs.length)
          : 0
      },
      highPriorityItems: todaysBriefs.reduce(
        (count, b) => count + b.content.openItems.filter(i => i.priority === 'high').length,
        0
      )
    };

    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[MeetingPrep] Error fetching stats:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch stats'
      }
    });
  }
});

export default router;
