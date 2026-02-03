/**
 * Template Library Routes (PRD-256: Team Meeting Prep)
 *
 * API endpoints for meeting prep templates and scheduled meeting preps.
 *
 * Endpoints:
 * Templates:
 * - GET    /api/template-library/templates              - List all templates
 * - GET    /api/template-library/templates/:id          - Get template by ID
 * - POST   /api/template-library/templates              - Create new template
 * - PATCH  /api/template-library/templates/:id          - Update template
 * - DELETE /api/template-library/templates/:id          - Delete template
 *
 * Meeting Preps:
 * - GET    /api/template-library/preps                  - List meeting preps
 * - GET    /api/template-library/preps/upcoming         - Get upcoming preps
 * - GET    /api/template-library/preps/:id              - Get prep by ID
 * - POST   /api/template-library/preps                  - Create meeting prep
 * - PATCH  /api/template-library/preps/:id              - Update meeting prep
 * - DELETE /api/template-library/preps/:id              - Delete meeting prep
 * - POST   /api/template-library/preps/:id/generate     - Generate prep document
 * - POST   /api/template-library/preps/:id/send         - Send prep to attendees
 * - POST   /api/template-library/preps/:id/complete     - Complete meeting
 *
 * Agenda & Topics:
 * - PATCH  /api/template-library/preps/:id/agenda       - Update agenda
 * - GET    /api/template-library/preps/:id/topics       - Get topic submissions
 * - POST   /api/template-library/preps/:id/topics       - Submit a topic
 * - DELETE /api/template-library/topics/:id             - Delete topic
 *
 * Action Items:
 * - GET    /api/template-library/preps/:id/action-items - Get action items
 * - POST   /api/template-library/preps/:id/action-items - Create action item
 * - PATCH  /api/template-library/action-items/:id       - Update action item
 * - POST   /api/template-library/action-items/:id/complete - Complete action item
 */

import { Router, Request, Response } from 'express';
import {
  templateLibraryService,
  MeetingType,
  MeetingPrepStatus,
  TopicPriority
} from '../services/collaboration/templateLibrary.js';

const router = Router();

// ============================================
// Template Routes
// ============================================

/**
 * GET /api/template-library/templates
 * List all meeting prep templates
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const meetingType = req.query.type as MeetingType | undefined;
    const templates = await templateLibraryService.getTemplates(meetingType);

    return res.json({
      success: true,
      data: {
        templates,
        count: templates.length
      }
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error fetching templates:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch templates'
      }
    });
  }
});

/**
 * GET /api/template-library/templates/:id
 * Get a specific template
 */
router.get('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = await templateLibraryService.getTemplateById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Template not found'
        }
      });
    }

    return res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error fetching template:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch template'
      }
    });
  }
});

/**
 * POST /api/template-library/templates
 * Create a new template
 */
router.post('/templates', async (req: Request, res: Response) => {
  try {
    const { name, description, meeting_type, sections, default_agenda, generate_hours_before, send_to_attendees } = req.body;
    const userId = req.query.userId as string || req.body.userId;

    if (!name || !meeting_type || !sections) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'name, meeting_type, and sections are required'
        }
      });
    }

    const template = await templateLibraryService.createTemplate({
      name,
      description,
      meeting_type,
      sections,
      default_agenda,
      generate_hours_before,
      send_to_attendees,
      created_by_user_id: userId
    });

    return res.status(201).json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error creating template:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create template'
      }
    });
  }
});

/**
 * PATCH /api/template-library/templates/:id
 * Update a template
 */
router.patch('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const template = await templateLibraryService.updateTemplate(id, updates);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Template not found'
        }
      });
    }

    return res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error updating template:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update template'
      }
    });
  }
});

/**
 * DELETE /api/template-library/templates/:id
 * Delete a template (soft delete)
 */
router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await templateLibraryService.deleteTemplate(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Template not found'
        }
      });
    }

    return res.json({
      success: true,
      data: { deleted: true }
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error deleting template:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete template'
      }
    });
  }
});

// ============================================
// Meeting Prep Routes
// ============================================

/**
 * GET /api/template-library/preps
 * List meeting preps
 */
router.get('/preps', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const status = req.query.status as MeetingPrepStatus;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

    const preps = await templateLibraryService.getMeetingPreps(userId, { status, limit });

    return res.json({
      success: true,
      data: {
        preps,
        count: preps.length
      }
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error fetching preps:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch meeting preps'
      }
    });
  }
});

/**
 * GET /api/template-library/preps/upcoming
 * Get upcoming meeting preps
 */
router.get('/preps/upcoming', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    const preps = await templateLibraryService.getMeetingPreps(userId, { upcoming: true, limit });

    return res.json({
      success: true,
      data: {
        preps,
        count: preps.length
      }
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error fetching upcoming preps:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch upcoming meeting preps'
      }
    });
  }
});

/**
 * GET /api/template-library/preps/:id
 * Get a specific meeting prep
 */
router.get('/preps/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const prep = await templateLibraryService.getMeetingPrepById(id);

    if (!prep) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Meeting prep not found'
        }
      });
    }

    // Also fetch topics and action items
    const [topics, actionItems] = await Promise.all([
      templateLibraryService.getTopicSubmissions(id),
      templateLibraryService.getActionItems(id)
    ]);

    return res.json({
      success: true,
      data: {
        ...prep,
        topic_submissions: topics,
        action_items_list: actionItems
      }
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error fetching prep:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch meeting prep'
      }
    });
  }
});

/**
 * POST /api/template-library/preps
 * Create a new meeting prep
 */
router.post('/preps', async (req: Request, res: Response) => {
  try {
    const { template_id, meeting_title, meeting_date, calendar_event_id, attendees } = req.body;
    const userId = req.query.userId as string || req.body.organizer_user_id;

    if (!meeting_title || !meeting_date || !attendees) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'meeting_title, meeting_date, and attendees are required'
        }
      });
    }

    const prep = await templateLibraryService.createMeetingPrep({
      template_id,
      organizer_user_id: userId,
      meeting_title,
      meeting_date: new Date(meeting_date),
      calendar_event_id,
      attendees
    });

    return res.status(201).json({
      success: true,
      data: prep
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error creating prep:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create meeting prep'
      }
    });
  }
});

/**
 * PATCH /api/template-library/preps/:id
 * Update a meeting prep
 */
router.patch('/preps/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Convert date string if present
    if (updates.meeting_date) {
      updates.meeting_date = new Date(updates.meeting_date);
    }

    const prep = await templateLibraryService.updateMeetingPrep(id, updates);

    if (!prep) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Meeting prep not found'
        }
      });
    }

    return res.json({
      success: true,
      data: prep
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error updating prep:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update meeting prep'
      }
    });
  }
});

/**
 * DELETE /api/template-library/preps/:id
 * Delete a meeting prep
 */
router.delete('/preps/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await templateLibraryService.deleteMeetingPrep(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Meeting prep not found'
        }
      });
    }

    return res.json({
      success: true,
      data: { deleted: true }
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error deleting prep:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete meeting prep'
      }
    });
  }
});

/**
 * POST /api/template-library/preps/:id/generate
 * Generate prep document
 */
router.post('/preps/:id/generate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const prep = await templateLibraryService.generatePrepDocument(id);

    if (!prep) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Meeting prep not found'
        }
      });
    }

    return res.json({
      success: true,
      data: prep
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error generating prep:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate prep document'
      }
    });
  }
});

/**
 * POST /api/template-library/preps/:id/send
 * Mark prep as sent to attendees
 */
router.post('/preps/:id/send', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const prep = await templateLibraryService.updateMeetingPrep(id, {
      status: 'sent',
      sent_at: new Date()
    });

    if (!prep) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Meeting prep not found'
        }
      });
    }

    return res.json({
      success: true,
      data: {
        id: prep.id,
        status: prep.status,
        sent_at: prep.sent_at
      }
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error sending prep:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to send prep'
      }
    });
  }
});

/**
 * POST /api/template-library/preps/:id/complete
 * Complete a meeting with notes and action items
 */
router.post('/preps/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes, effectiveness_rating, action_items } = req.body;

    const prep = await templateLibraryService.completeMeeting(id, {
      notes,
      effectiveness_rating,
      action_items
    });

    if (!prep) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Meeting prep not found'
        }
      });
    }

    // Fetch the action items
    const actionItems = await templateLibraryService.getActionItems(id);

    return res.json({
      success: true,
      data: {
        ...prep,
        action_items_list: actionItems
      }
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error completing meeting:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to complete meeting'
      }
    });
  }
});

// ============================================
// Agenda & Topics Routes
// ============================================

/**
 * PATCH /api/template-library/preps/:id/agenda
 * Update meeting agenda
 */
router.patch('/preps/:id/agenda', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { agenda, finalized } = req.body;

    const updates: Record<string, unknown> = {};
    if (agenda !== undefined) updates.agenda = agenda;
    if (finalized !== undefined) updates.agenda_finalized = finalized;

    const prep = await templateLibraryService.updateMeetingPrep(id, updates);

    if (!prep) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Meeting prep not found'
        }
      });
    }

    return res.json({
      success: true,
      data: {
        id: prep.id,
        agenda: prep.agenda,
        agenda_finalized: prep.agenda_finalized
      }
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error updating agenda:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update agenda'
      }
    });
  }
});

/**
 * GET /api/template-library/preps/:id/topics
 * Get topic submissions for a meeting
 */
router.get('/preps/:id/topics', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const topics = await templateLibraryService.getTopicSubmissions(id);

    return res.json({
      success: true,
      data: {
        topics,
        count: topics.length
      }
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error fetching topics:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch topics'
      }
    });
  }
});

/**
 * POST /api/template-library/preps/:id/topics
 * Submit a topic for a meeting
 */
router.post('/preps/:id/topics', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { topic, description, customer_id, priority } = req.body;
    const userId = req.query.userId as string || req.body.submitted_by_user_id;

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'topic is required'
        }
      });
    }

    const submission = await templateLibraryService.submitTopic(id, topic, {
      submitted_by_user_id: userId,
      description,
      customer_id,
      priority: priority as TopicPriority
    });

    return res.status(201).json({
      success: true,
      data: submission
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error submitting topic:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to submit topic'
      }
    });
  }
});

/**
 * DELETE /api/template-library/topics/:id
 * Delete a topic submission
 */
router.delete('/topics/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await templateLibraryService.deleteTopicSubmission(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Topic not found'
        }
      });
    }

    return res.json({
      success: true,
      data: { deleted: true }
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error deleting topic:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete topic'
      }
    });
  }
});

// ============================================
// Action Items Routes
// ============================================

/**
 * GET /api/template-library/preps/:id/action-items
 * Get action items for a meeting
 */
router.get('/preps/:id/action-items', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actionItems = await templateLibraryService.getActionItems(id);

    return res.json({
      success: true,
      data: {
        action_items: actionItems,
        count: actionItems.length
      }
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error fetching action items:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch action items'
      }
    });
  }
});

/**
 * POST /api/template-library/preps/:id/action-items
 * Create an action item
 */
router.post('/preps/:id/action-items', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { description, owner_user_id, customer_id, due_date } = req.body;

    if (!description) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'description is required'
        }
      });
    }

    const actionItem = await templateLibraryService.createActionItem(id, description, {
      owner_user_id,
      customer_id,
      due_date: due_date ? new Date(due_date) : undefined
    });

    return res.status(201).json({
      success: true,
      data: actionItem
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error creating action item:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create action item'
      }
    });
  }
});

/**
 * PATCH /api/template-library/action-items/:id
 * Update an action item
 */
router.patch('/action-items/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.due_date) {
      updates.due_date = new Date(updates.due_date);
    }

    const actionItem = await templateLibraryService.updateActionItem(id, updates);

    if (!actionItem) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Action item not found'
        }
      });
    }

    return res.json({
      success: true,
      data: actionItem
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error updating action item:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update action item'
      }
    });
  }
});

/**
 * POST /api/template-library/action-items/:id/complete
 * Mark an action item as complete
 */
router.post('/action-items/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actionItem = await templateLibraryService.completeActionItem(id);

    if (!actionItem) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Action item not found'
        }
      });
    }

    return res.json({
      success: true,
      data: actionItem
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error completing action item:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to complete action item'
      }
    });
  }
});

/**
 * GET /api/template-library/action-items
 * Get all action items (optionally filtered)
 */
router.get('/action-items', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    const owner = req.query.owner as string;

    const actionItems = await templateLibraryService.getActionItems(undefined, {
      status: status as 'pending' | 'in_progress' | 'completed' | 'cancelled',
      owner_user_id: owner
    });

    return res.json({
      success: true,
      data: {
        action_items: actionItems,
        count: actionItems.length
      }
    });
  } catch (error) {
    console.error('[TemplateLibrary] Error fetching action items:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch action items'
      }
    });
  }
});

export default router;
