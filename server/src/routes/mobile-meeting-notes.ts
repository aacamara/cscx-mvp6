/**
 * Mobile Meeting Notes Routes
 * PRD-269: Mobile Meeting Notes
 *
 * API endpoints for mobile meeting notes capture, voice transcription,
 * action items, and AI-powered post-meeting processing.
 */

import { Router, Request, Response } from 'express';
import { mobileMeetingNotesService } from '../services/mobile/meetingNotes.js';
import type { MeetingTemplateType } from '../services/mobile/meetingNotes.js';

const router = Router();

// ============================================
// Meeting Note CRUD
// ============================================

/**
 * POST /api/mobile/meeting-notes
 * Create a new meeting note
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      customer_id,
      customer_name,
      title,
      template_type,
      meeting_id,
      attendees,
    } = req.body;

    // For now, use a placeholder user ID - in production this would come from auth
    const created_by = req.headers['x-user-id'] as string || 'user_default';

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const note = await mobileMeetingNotesService.createMeetingNote({
      customer_id,
      customer_name,
      title,
      template_type: template_type as MeetingTemplateType,
      meeting_id,
      created_by,
      attendees,
    });

    res.status(201).json({ note });
  } catch (error) {
    console.error('Error creating meeting note:', error);
    res.status(500).json({ error: 'Failed to create meeting note' });
  }
});

/**
 * GET /api/mobile/meeting-notes
 * List meeting notes for user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const user_id = req.headers['x-user-id'] as string || 'user_default';
    const { customer_id, status, limit, offset } = req.query;

    const notes = await mobileMeetingNotesService.listMeetingNotes({
      user_id,
      customer_id: customer_id as string,
      status: status as 'active' | 'processing' | 'completed',
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({ notes, total: notes.length });
  } catch (error) {
    console.error('Error listing meeting notes:', error);
    res.status(500).json({ error: 'Failed to list meeting notes' });
  }
});

/**
 * GET /api/mobile/meeting-notes/:noteId
 * Get meeting note by ID
 */
router.get('/:noteId', async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;

    const note = await mobileMeetingNotesService.getMeetingNote(noteId);

    if (!note) {
      return res.status(404).json({ error: 'Meeting note not found' });
    }

    res.json({ note });
  } catch (error) {
    console.error('Error getting meeting note:', error);
    res.status(500).json({ error: 'Failed to get meeting note' });
  }
});

/**
 * PATCH /api/mobile/meeting-notes/:noteId
 * Update meeting note
 */
router.patch('/:noteId', async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const updates = req.body;

    const note = await mobileMeetingNotesService.updateMeetingNote(noteId, updates);

    res.json({ note });
  } catch (error) {
    console.error('Error updating meeting note:', error);
    res.status(500).json({ error: 'Failed to update meeting note' });
  }
});

// ============================================
// Action Items
// ============================================

/**
 * POST /api/mobile/meeting-notes/:noteId/action-items
 * Add action item to meeting note
 */
router.post('/:noteId/action-items', async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const { title, description, owner_id, owner_name, owner_type, due_date, priority, status } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const actionItem = await mobileMeetingNotesService.addActionItem(noteId, {
      title,
      description,
      owner_id,
      owner_name,
      owner_type: owner_type || 'unknown',
      due_date: due_date ? new Date(due_date) : undefined,
      priority: priority || 'medium',
      status: status || 'open',
    });

    res.status(201).json({ actionItem });
  } catch (error) {
    console.error('Error adding action item:', error);
    res.status(500).json({ error: 'Failed to add action item' });
  }
});

// ============================================
// Highlights
// ============================================

/**
 * POST /api/mobile/meeting-notes/:noteId/highlights
 * Add highlight to meeting note
 */
router.post('/:noteId/highlights', async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const { text, type, speaker } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const highlight = await mobileMeetingNotesService.addHighlight(noteId, {
      text,
      type: type || 'key_moment',
      speaker,
    });

    res.status(201).json({ highlight });
  } catch (error) {
    console.error('Error adding highlight:', error);
    res.status(500).json({ error: 'Failed to add highlight' });
  }
});

// ============================================
// Voice Notes
// ============================================

/**
 * POST /api/mobile/meeting-notes/:noteId/voice-notes
 * Add voice note with transcription
 */
router.post('/:noteId/voice-notes', async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const { uri, duration, transcription } = req.body;

    if (!uri || duration === undefined) {
      return res.status(400).json({ error: 'uri and duration are required' });
    }

    const voiceNote = await mobileMeetingNotesService.addVoiceNote(noteId, {
      uri,
      duration,
      transcription,
    });

    res.status(201).json({ voiceNote });
  } catch (error) {
    console.error('Error adding voice note:', error);
    res.status(500).json({ error: 'Failed to add voice note' });
  }
});

// ============================================
// Risk & Opportunity Flags
// ============================================

/**
 * POST /api/mobile/meeting-notes/:noteId/risks
 * Add risk flag
 */
router.post('/:noteId/risks', async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const { description, severity } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }

    const risk = await mobileMeetingNotesService.addRiskFlag(noteId, {
      description,
      severity: severity || 'medium',
    });

    res.status(201).json({ risk });
  } catch (error) {
    console.error('Error adding risk flag:', error);
    res.status(500).json({ error: 'Failed to add risk flag' });
  }
});

/**
 * POST /api/mobile/meeting-notes/:noteId/opportunities
 * Add opportunity flag
 */
router.post('/:noteId/opportunities', async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const { description, potential, type } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }

    const opportunity = await mobileMeetingNotesService.addOpportunityFlag(noteId, {
      description,
      potential: potential || 'medium',
      type: type || 'expansion',
    });

    res.status(201).json({ opportunity });
  } catch (error) {
    console.error('Error adding opportunity flag:', error);
    res.status(500).json({ error: 'Failed to add opportunity flag' });
  }
});

// ============================================
// Meeting Detection
// ============================================

/**
 * GET /api/mobile/meeting-notes/detect-meeting
 * Detect current meeting from calendar
 */
router.get('/detect-meeting', async (req: Request, res: Response) => {
  try {
    const user_id = req.headers['x-user-id'] as string || 'user_default';

    const meeting = await mobileMeetingNotesService.detectCurrentMeeting(user_id);

    if (!meeting) {
      return res.json({ meeting: null, message: 'No current meeting detected' });
    }

    res.json({ meeting });
  } catch (error) {
    console.error('Error detecting meeting:', error);
    res.status(500).json({ error: 'Failed to detect meeting' });
  }
});

// ============================================
// Post-Meeting Processing
// ============================================

/**
 * POST /api/mobile/meeting-notes/:noteId/process
 * Process meeting notes with AI
 */
router.post('/:noteId/process', async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;

    const processed = await mobileMeetingNotesService.processMeetingNotes(noteId);

    res.json({ processed });
  } catch (error) {
    console.error('Error processing meeting notes:', error);
    res.status(500).json({ error: 'Failed to process meeting notes' });
  }
});

/**
 * POST /api/mobile/meeting-notes/:noteId/create-tasks
 * Create tasks from action items
 */
router.post('/:noteId/create-tasks', async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;

    const result = await mobileMeetingNotesService.createTasksFromActionItems(noteId);

    res.json({
      success: true,
      created: result.created,
      failed: result.failed,
    });
  } catch (error) {
    console.error('Error creating tasks:', error);
    res.status(500).json({ error: 'Failed to create tasks' });
  }
});

// ============================================
// Sync & Collaboration
// ============================================

/**
 * POST /api/mobile/meeting-notes/:noteId/sync
 * Sync offline changes
 */
router.post('/:noteId/sync', async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const { changes } = req.body;

    if (!changes || !Array.isArray(changes)) {
      return res.status(400).json({ error: 'changes array is required' });
    }

    const note = await mobileMeetingNotesService.syncOfflineChanges(noteId, changes);

    res.json({ note, synced: true });
  } catch (error) {
    console.error('Error syncing changes:', error);
    res.status(500).json({ error: 'Failed to sync changes' });
  }
});

/**
 * POST /api/mobile/meeting-notes/:noteId/join
 * Join meeting note as collaborator
 */
router.post('/:noteId/join', async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const user_id = req.headers['x-user-id'] as string || 'user_default';

    const note = await mobileMeetingNotesService.joinMeetingNote(noteId, user_id);

    res.json({ note, joined: true });
  } catch (error) {
    console.error('Error joining meeting note:', error);
    res.status(500).json({ error: 'Failed to join meeting note' });
  }
});

// ============================================
// Templates
// ============================================

/**
 * GET /api/mobile/meeting-notes/templates
 * Get available meeting templates
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const templates = mobileMeetingNotesService.getMeetingTemplates();
    res.json({ templates });
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

export default router;
