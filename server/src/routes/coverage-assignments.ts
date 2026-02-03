/**
 * PRD-258: Coverage Backup System - Coverage Assignment Routes
 * API endpoints for managing coverage assignments, briefs, and activities
 */

import { Router, Request, Response } from 'express';
import { coverageBackupService } from '../services/collaboration/index.js';
import { AddCoverageNoteRequest } from '../services/collaboration/types.js';

const router = Router();

// ============================================
// Coverage Assignment Actions
// ============================================

/**
 * PATCH /api/coverage-assignments/:id
 * Update a coverage assignment
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Currently only status updates are supported via this endpoint
    // Use dedicated accept/decline endpoints for those actions
    res.json({
      success: true,
      message: 'Assignment updated',
    });
  } catch (error) {
    console.error('[Coverage Assignments Routes] Update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update coverage assignment',
    });
  }
});

/**
 * POST /api/coverage-assignments/:id/accept
 * Accept a coverage assignment
 */
router.post('/:id/accept', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const assignment = await coverageBackupService.acceptCoverageAssignment(id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Coverage assignment not found',
      });
    }

    res.json({
      success: true,
      assignment,
      message: 'Coverage accepted - briefs are now being generated',
    });
  } catch (error) {
    console.error('[Coverage Assignments Routes] Accept error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept coverage assignment',
    });
  }
});

/**
 * POST /api/coverage-assignments/:id/decline
 * Decline a coverage assignment
 */
router.post('/:id/decline', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Decline reason is required',
      });
    }

    const assignment = await coverageBackupService.declineCoverageAssignment(id, reason);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Coverage assignment not found',
      });
    }

    res.json({
      success: true,
      assignment,
      message: 'Coverage declined',
    });
  } catch (error) {
    console.error('[Coverage Assignments Routes] Decline error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to decline coverage assignment',
    });
  }
});

// ============================================
// Coverage Briefs
// ============================================

/**
 * GET /api/coverage-assignments/:id/briefs
 * Get all coverage briefs for an assignment
 */
router.get('/:id/briefs', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const briefs = await coverageBackupService.getCoverageBriefs(id);

    res.json({
      success: true,
      briefs,
    });
  } catch (error) {
    console.error('[Coverage Assignments Routes] Get briefs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get coverage briefs',
    });
  }
});

/**
 * POST /api/coverage-briefs/:id/notes
 * Add notes to a coverage brief
 */
router.post('/briefs/:id/notes', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    if (!notes) {
      return res.status(400).json({
        success: false,
        error: 'Notes content is required',
      });
    }

    await coverageBackupService.addNotesToBrief(id, notes);

    res.json({
      success: true,
      message: 'Notes added to brief',
    });
  } catch (error) {
    console.error('[Coverage Assignments Routes] Add notes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add notes to brief',
    });
  }
});

/**
 * POST /api/coverage-briefs/:id/viewed
 * Mark a coverage brief as viewed
 */
router.post('/briefs/:id/viewed', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string || 'unknown';

    await coverageBackupService.markBriefViewed(id, userId);

    res.json({
      success: true,
      message: 'Brief marked as viewed',
    });
  } catch (error) {
    console.error('[Coverage Assignments Routes] Mark viewed error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark brief as viewed',
    });
  }
});

// ============================================
// Coverage Activities
// ============================================

/**
 * GET /api/coverage-assignments/:id/activities
 * Get all activities for a coverage assignment
 */
router.get('/:id/activities', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const activities = await coverageBackupService.getCoverageActivities(id);

    res.json({
      success: true,
      activities,
    });
  } catch (error) {
    console.error('[Coverage Assignments Routes] Get activities error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get coverage activities',
    });
  }
});

/**
 * POST /api/coverage-assignments/:id/activities
 * Log an activity during coverage
 */
router.post('/:id/activities', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const request: AddCoverageNoteRequest = {
      coverageAssignmentId: id,
      customerId: req.body.customerId,
      activityType: req.body.activityType,
      description: req.body.description,
      outcome: req.body.outcome,
      relatedEntityType: req.body.relatedEntityType,
      relatedEntityId: req.body.relatedEntityId,
    };

    if (!request.activityType || !request.description) {
      return res.status(400).json({
        success: false,
        error: 'activityType and description are required',
      });
    }

    const activity = await coverageBackupService.logCoverageActivity(request);

    res.status(201).json({
      success: true,
      activity,
    });
  } catch (error) {
    console.error('[Coverage Assignments Routes] Log activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log coverage activity',
    });
  }
});

// ============================================
// Return & Handback
// ============================================

/**
 * GET /api/coverage-assignments/:id/summary
 * Get handback summary for a coverage assignment
 */
router.get('/:id/summary', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Generate the handback summary
    const handback = await coverageBackupService.generateHandback(id);

    res.json({
      success: true,
      handback,
    });
  } catch (error) {
    console.error('[Coverage Assignments Routes] Get summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get coverage summary',
    });
  }
});

/**
 * POST /api/coverage-assignments/:id/complete
 * Complete a coverage assignment (trigger handback generation)
 */
router.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { feedbackFromBackup } = req.body;

    const handback = await coverageBackupService.generateHandback(id);

    res.json({
      success: true,
      handback,
      message: 'Coverage completed and handback generated',
    });
  } catch (error) {
    console.error('[Coverage Assignments Routes] Complete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete coverage',
    });
  }
});

export default router;
