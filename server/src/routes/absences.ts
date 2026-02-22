/**
 * PRD-258: Coverage Backup System - Absences Routes
 * API endpoints for CSM absence management
 */

import { Router, Request, Response } from 'express';
import { coverageBackupService } from '../services/collaboration/index.js';
import {
  CreateAbsenceRequest,
  UpdateAbsenceRequest,
  CreateCoverageAssignmentRequest,
  AddCoverageNoteRequest,
} from '../services/collaboration/types.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// Absence Management
// ============================================

/**
 * POST /api/absences
 * Create a new absence record
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const request: CreateAbsenceRequest = req.body;

    // Validate required fields
    if (!request.userId || !request.absenceType || !request.startDate || !request.endDate) {
      return res.status(400).json({
        success: false,
        error: 'userId, absenceType, startDate, and endDate are required',
      });
    }

    // Validate dates
    const startDate = new Date(request.startDate);
    const endDate = new Date(request.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format',
      });
    }

    if (endDate <= startDate) {
      return res.status(400).json({
        success: false,
        error: 'End date must be after start date',
      });
    }

    const absence = await coverageBackupService.createAbsence(request);

    res.status(201).json({
      success: true,
      absence,
    });
  } catch (error) {
    console.error('[Absences Routes] Create absence error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create absence',
    });
  }
});

/**
 * GET /api/absences
 * Get all absences for a user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const absences = await coverageBackupService.getAbsencesForUser(userId);

    res.json({
      success: true,
      absences,
    });
  } catch (error) {
    console.error('[Absences Routes] Get absences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get absences',
    });
  }
});

/**
 * GET /api/absences/:id
 * Get a specific absence by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const absence = await coverageBackupService.getAbsence(id);

    if (!absence) {
      return res.status(404).json({
        success: false,
        error: 'Absence not found',
      });
    }

    res.json({
      success: true,
      absence,
    });
  } catch (error) {
    console.error('[Absences Routes] Get absence error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get absence',
    });
  }
});

/**
 * PATCH /api/absences/:id
 * Update an absence
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates: UpdateAbsenceRequest = req.body;

    // Validate dates if provided
    if (updates.startDate) {
      const startDate = new Date(updates.startDate);
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid start date format',
        });
      }
    }

    if (updates.endDate) {
      const endDate = new Date(updates.endDate);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid end date format',
        });
      }
    }

    const absence = await coverageBackupService.updateAbsence(id, updates);

    if (!absence) {
      return res.status(404).json({
        success: false,
        error: 'Absence not found',
      });
    }

    res.json({
      success: true,
      absence,
    });
  } catch (error) {
    console.error('[Absences Routes] Update absence error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update absence',
    });
  }
});

/**
 * DELETE /api/absences/:id
 * Cancel an absence
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const success = await coverageBackupService.cancelAbsence(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Absence not found',
      });
    }

    res.json({
      success: true,
      message: 'Absence cancelled',
    });
  } catch (error) {
    console.error('[Absences Routes] Cancel absence error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel absence',
    });
  }
});

// ============================================
// Backup Suggestions
// ============================================

/**
 * GET /api/absences/:id/backup-suggestions
 * Get backup CSM suggestions for an absence
 */
router.get('/:id/backup-suggestions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const suggestions = await coverageBackupService.suggestBackups(id);

    res.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error('[Absences Routes] Get backup suggestions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get backup suggestions',
    });
  }
});

// ============================================
// Coverage Assignments
// ============================================

/**
 * GET /api/absences/:id/coverage
 * Get coverage assignments for an absence
 */
router.get('/:id/coverage', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const assignments = await coverageBackupService.getCoverageAssignments(id);

    res.json({
      success: true,
      assignments,
    });
  } catch (error) {
    console.error('[Absences Routes] Get coverage assignments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get coverage assignments',
    });
  }
});

/**
 * POST /api/absences/:id/coverage
 * Create a coverage assignment for an absence
 */
router.post('/:id/coverage', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const assignedByUserId = req.headers['x-user-id'] as string || req.body.assignedByUserId;

    const request: CreateCoverageAssignmentRequest = {
      absenceId: id,
      backupUserId: req.body.backupUserId,
      assignedByUserId,
      coverageType: req.body.coverageType,
      coveredCustomerIds: req.body.coveredCustomerIds,
      tier: req.body.tier,
    };

    if (!request.backupUserId) {
      return res.status(400).json({
        success: false,
        error: 'backupUserId is required',
      });
    }

    const assignment = await coverageBackupService.createCoverageAssignment(request);

    res.status(201).json({
      success: true,
      assignment,
    });
  } catch (error) {
    console.error('[Absences Routes] Create coverage assignment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create coverage assignment',
    });
  }
});

export default router;
