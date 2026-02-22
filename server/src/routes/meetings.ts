import { Router, Request, Response } from 'express';
import { SupabaseService } from '../services/supabase.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();
const db = new SupabaseService();

// POST /api/meetings/schedule - Schedule meeting
router.post('/schedule', async (req: Request, res: Response) => {
  try {
    const { customerId, attendees, duration, agenda, preferredTimes } = req.body;

    if (!customerId || !attendees || !attendees.length) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Customer ID and attendees required' }
      });
    }

    // Create meeting (pending approval)
    const meeting = await db.createMeeting({
      customer_id: customerId,
      title: agenda || 'Discovery Call',
      description: agenda,
      duration: duration || 60,
      attendees,
      status: 'pending_approval'
    });

    res.json({
      id: meeting.id,
      status: 'pending_approval',
      suggestedTime: preferredTimes?.[0] || null,
      calendarLink: null
    });
  } catch (error) {
    console.error('Schedule meeting error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to schedule meeting' }
    });
  }
});

// GET /api/meetings/:id - Get meeting details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Mock meeting data
    res.json({
      id,
      customerId: 'cust_123',
      title: 'Discovery Call',
      scheduledAt: new Date().toISOString(),
      duration: 60,
      status: 'scheduled',
      attendees: ['john@acme.com'],
      agenda: ['Introductions', 'Requirements', 'Next Steps']
    });
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get meeting' }
    });
  }
});

// POST /api/meetings/:id/transcript - Add transcript
router.post('/:id/transcript', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, duration } = req.body;

    if (!content) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Transcript content required' }
      });
    }

    // Save transcript and generate insights
    res.json({
      meetingId: id,
      transcriptId: `transcript_${Date.now()}`,
      wordCount: content.split(' ').length,
      duration,
      status: 'processing'
    });
  } catch (error) {
    console.error('Add transcript error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to add transcript' }
    });
  }
});

// GET /api/meetings/:id/insights - Get meeting insights
router.get('/:id/insights', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Mock insights
    res.json({
      meetingId: id,
      summary: 'Discovery call focused on understanding current challenges...',
      decisions: ['Proceed with Phase 1 implementation'],
      actionItems: [
        {
          description: 'Send SOW by Friday',
          owner: 'CSM',
          dueDate: '2025-01-10'
        }
      ],
      concerns: ['Integration timeline'],
      sentiment: 'positive',
      keyQuotes: [
        {
          speaker: 'Customer CTO',
          quote: 'This could transform our operations'
        }
      ]
    });
  } catch (error) {
    console.error('Get insights error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get insights' }
    });
  }
});

export { router as meetingRoutes };
