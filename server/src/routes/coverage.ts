/**
 * PRD-131: CSM Out of Office Coverage Routes
 * API endpoints for OOO coverage management
 */

import { Router, Request, Response } from 'express';
import { coverageService } from '../services/coverage.js';
import { SetupCoverageRequest } from '../types/coverage.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// Coverage Setup & Management
// ============================================

/**
 * POST /api/coverage/setup
 * Setup coverage for a CSM going OOO
 */
router.post('/setup', async (req: Request, res: Response) => {
  try {
    const request: SetupCoverageRequest = req.body;

    // Validate required fields
    if (!request.csmId || !request.startDate || !request.endDate) {
      return res.status(400).json({
        success: false,
        error: 'csmId, startDate, and endDate are required',
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

    const result = await coverageService.setupCoverage(request);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('[Coverage Routes] Setup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to setup coverage',
    });
  }
});

/**
 * GET /api/coverage/:csmId/current
 * Get current coverage status for a CSM
 */
router.get('/:csmId/current', async (req: Request, res: Response) => {
  try {
    const { csmId } = req.params;

    const coverage = await coverageService.getCurrentCoverage(csmId);

    res.json({
      success: true,
      hasActiveCoverage: !!coverage,
      coverage,
    });
  } catch (error) {
    console.error('[Coverage Routes] Get current error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get current coverage',
    });
  }
});

/**
 * GET /api/coverage/dashboard
 * Get coverage dashboard for a CSM
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const csmId = req.headers['x-csm-id'] as string || 'csm-001';

    const dashboard = await coverageService.getCoverageDashboard(csmId);

    res.json({
      success: true,
      dashboard,
    });
  } catch (error) {
    console.error('[Coverage Routes] Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get coverage dashboard',
    });
  }
});

/**
 * GET /api/coverage/:coverageId
 * Get coverage details by ID
 */
router.get('/:coverageId', async (req: Request, res: Response) => {
  try {
    const { coverageId } = req.params;

    // Skip if this is the 'dashboard' route
    if (coverageId === 'dashboard') {
      return res.status(400).json({
        success: false,
        error: 'Invalid coverage ID',
      });
    }

    const coverage = await coverageService.getCoverageById(coverageId);

    if (!coverage) {
      return res.status(404).json({
        success: false,
        error: 'Coverage not found',
      });
    }

    res.json({
      success: true,
      coverage,
    });
  } catch (error) {
    console.error('[Coverage Routes] Get coverage error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get coverage',
    });
  }
});

// ============================================
// Handoff Brief
// ============================================

/**
 * GET /api/coverage/:coverageId/handoff
 * Get handoff brief for a coverage
 */
router.get('/:coverageId/handoff', async (req: Request, res: Response) => {
  try {
    const { coverageId } = req.params;
    const viewerId = req.headers['x-user-id'] as string || req.headers['x-csm-id'] as string || 'unknown';

    const brief = await coverageService.getHandoffBrief(coverageId, viewerId);

    if (!brief) {
      return res.status(404).json({
        success: false,
        error: 'Handoff brief not found',
      });
    }

    res.json({
      success: true,
      brief,
    });
  } catch (error) {
    console.error('[Coverage Routes] Get handoff error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get handoff brief',
    });
  }
});

// ============================================
// Customer Notifications
// ============================================

/**
 * POST /api/coverage/:coverageId/notify-customers
 * Send customer notifications for a coverage
 */
router.post('/:coverageId/notify-customers', async (req: Request, res: Response) => {
  try {
    const { coverageId } = req.params;

    const result = await coverageService.sendCustomerNotifications(coverageId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.errors.join(', '),
        sent: result.sent,
      });
    }

    res.json({
      success: true,
      sent: result.sent,
      message: `Sent ${result.sent} notification(s)`,
    });
  } catch (error) {
    console.error('[Coverage Routes] Notify customers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send customer notifications',
    });
  }
});

// ============================================
// Return Handback
// ============================================

/**
 * POST /api/coverage/:coverageId/return
 * Process CSM return and generate handback
 */
router.post('/:coverageId/return', async (req: Request, res: Response) => {
  try {
    const { coverageId } = req.params;

    const handback = await coverageService.processReturn(coverageId);

    if (!handback) {
      return res.status(404).json({
        success: false,
        error: 'Coverage not found',
      });
    }

    res.json({
      success: true,
      handback,
    });
  } catch (error) {
    console.error('[Coverage Routes] Process return error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process return',
    });
  }
});

// ============================================
// CSM Management
// ============================================

/**
 * GET /api/coverage/csms/all
 * Get all CSMs
 */
router.get('/csms/all', async (req: Request, res: Response) => {
  try {
    const csms = await coverageService.getAllCSMs();

    res.json({
      success: true,
      csms,
    });
  } catch (error) {
    console.error('[Coverage Routes] Get CSMs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get CSMs',
    });
  }
});

/**
 * GET /api/coverage/csms/available
 * Get available CSMs for coverage
 */
router.get('/csms/available', async (req: Request, res: Response) => {
  try {
    const excludeCsmId = req.query.exclude as string || '';

    const csms = await coverageService.getAvailableCSMs(excludeCsmId);

    res.json({
      success: true,
      csms,
    });
  } catch (error) {
    console.error('[Coverage Routes] Get available CSMs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get available CSMs',
    });
  }
});

// ============================================
// OOO Detection
// ============================================

/**
 * POST /api/coverage/detect-ooo
 * Detect OOO events from calendar
 */
router.post('/detect-ooo', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const csmId = req.body.csmId || req.headers['x-csm-id'] as string;

    if (!userId || !csmId) {
      return res.status(400).json({
        success: false,
        error: 'userId and csmId are required',
      });
    }

    const detections = await coverageService.detectOOOFromCalendar(userId, csmId);

    res.json({
      success: true,
      detections,
      count: detections.length,
    });
  } catch (error) {
    console.error('[Coverage Routes] Detect OOO error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect OOO events',
    });
  }
});

/**
 * POST /api/coverage/manual-ooo
 * Set manual OOO flag
 */
router.post('/manual-ooo', async (req: Request, res: Response) => {
  try {
    const { csmId, startDate, endDate } = req.body;

    if (!csmId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'csmId, startDate, and endDate are required',
      });
    }

    const detection = await coverageService.setManualOOO(
      csmId,
      new Date(startDate),
      new Date(endDate)
    );

    res.status(201).json({
      success: true,
      detection,
    });
  } catch (error) {
    console.error('[Coverage Routes] Manual OOO error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set manual OOO',
    });
  }
});

export default router;
