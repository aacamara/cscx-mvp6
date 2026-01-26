/**
 * Meeting Agent API Routes
 * Endpoints for meeting preparation, summaries, and follow-ups
 */

import { Router, Request, Response } from 'express';
import {
  meetingAgent,
  MeetingType,
  CustomerContext,
  MeetingBriefRequest
} from '../../langchain/agents/meetingAgent.js';

const router = Router();

/**
 * GET /api/google/meetings/today
 * Get today's meetings with briefs
 */
router.get('/today', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    // This would typically come from a customer service
    // For now, return meetings without briefs unless customer context is provided
    const getCustomerContext = async (attendees: string[]): Promise<CustomerContext | null> => {
      // In production, this would look up customer from attendee emails
      // For now, return null to skip brief generation
      return null;
    };

    const meetingsWithBriefs = await meetingAgent.getTodaysMeetingsWithBriefs(
      userId,
      getCustomerContext
    );

    res.json({
      success: true,
      meetings: meetingsWithBriefs.map(m => ({
        event: {
          id: m.event.id,
          title: m.event.title,
          startTime: m.event.startTime,
          endTime: m.event.endTime,
          attendees: m.event.attendees,
          meetLink: m.event.meetLink,
          location: m.event.location
        },
        hasBrief: m.brief !== null,
        brief: m.brief
      }))
    });
  } catch (error) {
    console.error('Error fetching today\'s meetings:', error);
    res.status(500).json({
      error: 'Failed to fetch meetings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/google/meetings/brief
 * Generate a meeting brief
 */
router.post('/brief', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const {
      eventId,
      meetingType,
      customerContext,
      attendees,
      meetingTitle,
      meetingDate,
      duration,
      additionalContext
    } = req.body;

    if (!meetingType || !customerContext || !attendees) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['meetingType', 'customerContext', 'attendees']
      });
    }

    // Validate meeting type
    const validMeetingTypes: MeetingType[] = [
      'kickoff', 'qbr', 'check_in', 'training', 'executive_review',
      'renewal', 'escalation', 'demo', 'planning', 'custom'
    ];

    if (!validMeetingTypes.includes(meetingType)) {
      return res.status(400).json({
        error: 'Invalid meeting type',
        validTypes: validMeetingTypes
      });
    }

    const request: MeetingBriefRequest = {
      eventId,
      meetingType,
      customerContext,
      attendees,
      meetingTitle,
      meetingDate: meetingDate ? new Date(meetingDate) : undefined,
      duration,
      additionalContext,
      userId
    };

    const brief = await meetingAgent.generateMeetingBrief(request);

    res.json({
      success: true,
      brief: {
        title: brief.title,
        customerSummary: brief.customerSummary,
        objectives: brief.objectives,
        suggestedAgenda: brief.suggestedAgenda,
        talkingPoints: brief.talkingPoints,
        risksAndConcerns: brief.risksAndConcerns,
        opportunitiesAndWins: brief.opportunitiesAndWins,
        attendeeInsights: brief.attendeeInsights,
        relevantDocuments: brief.relevantDocuments.map(d => ({
          id: d.id,
          name: d.name,
          mimeType: d.mimeType,
          webViewLink: d.webViewLink
        })),
        recentEmailContext: brief.recentEmailContext,
        preparationTips: brief.preparationTips,
        suggestedQuestions: brief.suggestedQuestions,
        confidence: brief.confidence
      }
    });
  } catch (error) {
    console.error('Error generating meeting brief:', error);
    res.status(500).json({
      error: 'Failed to generate meeting brief',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/google/meetings/summary
 * Generate a meeting summary from notes
 */
router.post('/summary', async (req: Request, res: Response) => {
  try {
    const {
      meetingNotes,
      customerContext,
      attendees,
      meetingType = 'custom'
    } = req.body;

    if (!meetingNotes || !customerContext || !attendees) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['meetingNotes', 'customerContext', 'attendees']
      });
    }

    const summary = await meetingAgent.generateMeetingSummary(
      meetingNotes,
      customerContext,
      attendees,
      meetingType
    );

    res.json({
      success: true,
      summary: {
        title: summary.title,
        date: summary.date,
        attendees: summary.attendees,
        keyDiscussions: summary.keyDiscussions,
        decisions: summary.decisions,
        actionItems: summary.actionItems.map(item => ({
          task: item.task,
          owner: item.owner,
          dueDate: item.dueDate,
          priority: item.priority,
          status: item.status
        })),
        nextSteps: summary.nextSteps,
        sentiment: summary.sentiment,
        healthImpact: summary.healthImpact
      }
    });
  } catch (error) {
    console.error('Error generating meeting summary:', error);
    res.status(500).json({
      error: 'Failed to generate meeting summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/google/meetings/follow-up
 * Schedule a follow-up meeting
 */
router.post('/follow-up', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const {
      customerContext,
      title,
      daysFromNow = 7,
      duration = 30,
      attendees,
      agenda,
      createMeetLink = true
    } = req.body;

    if (!customerContext || !attendees || attendees.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['customerContext', 'attendees']
      });
    }

    const event = await meetingAgent.scheduleFollowUp(userId, customerContext, {
      title,
      daysFromNow,
      duration,
      attendees,
      agenda,
      createMeetLink
    });

    res.json({
      success: true,
      event: {
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        attendees: event.attendees,
        meetLink: event.meetLink
      }
    });
  } catch (error) {
    console.error('Error scheduling follow-up:', error);
    res.status(500).json({
      error: 'Failed to schedule follow-up',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/google/meetings/action-items
 * Create action items from a meeting
 */
router.post('/action-items', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId, meetingId, actionItems } = req.body;

    if (!customerId || !meetingId || !actionItems || actionItems.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['customerId', 'meetingId', 'actionItems']
      });
    }

    // Validate action items structure
    for (const item of actionItems) {
      if (!item.task || !item.owner || !item.priority) {
        return res.status(400).json({
          error: 'Invalid action item structure',
          required: ['task', 'owner', 'priority']
        });
      }
    }

    await meetingAgent.createActionItems(userId, customerId, meetingId, actionItems);

    res.json({
      success: true,
      message: `Created ${actionItems.length} action items`,
      actionItems
    });
  } catch (error) {
    console.error('Error creating action items:', error);
    res.status(500).json({
      error: 'Failed to create action items',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/google/meetings/types
 * Get available meeting types
 */
router.get('/types', (_req: Request, res: Response) => {
  const meetingTypes = [
    { value: 'kickoff', label: 'Kickoff/Implementation', description: 'New customer onboarding or implementation kickoff' },
    { value: 'qbr', label: 'Quarterly Business Review', description: 'Quarterly strategic alignment and success review' },
    { value: 'check_in', label: 'Check-in', description: 'Regular status update and relationship maintenance' },
    { value: 'training', label: 'Training Session', description: 'Product training or enablement session' },
    { value: 'executive_review', label: 'Executive Review', description: 'Strategic review with executive stakeholders' },
    { value: 'renewal', label: 'Renewal Discussion', description: 'Contract renewal and expansion conversation' },
    { value: 'escalation', label: 'Escalation', description: 'Issue resolution or urgent matter discussion' },
    { value: 'demo', label: 'Product Demo', description: 'New feature demonstration or product showcase' },
    { value: 'planning', label: 'Planning Session', description: 'Strategic planning or roadmap alignment' },
    { value: 'custom', label: 'Custom Meeting', description: 'Other meeting type' }
  ];

  res.json({
    success: true,
    meetingTypes
  });
});

export default router;
