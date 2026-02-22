/**
 * Alert Routes (PRD-221)
 *
 * REST API endpoints for intelligent alert filtering
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';
import alertsService, {
  GetAlertsRequest,
  AlertFeedbackType,
  AlertType,
  RawAlert,
} from '../services/alerts/index.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ============================================
// GET /api/alerts - List alerts with filtering
// ============================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default-user';

    const options: GetAlertsRequest = {
      format: (req.query.format as 'bundled' | 'individual') || 'bundled',
      minScore: req.query.min_score ? parseInt(req.query.min_score as string) : undefined,
      status: req.query.status as any,
      customerId: req.query.customer_id as string,
      types: req.query.types ? (req.query.types as string).split(',') as AlertType[] : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const result = await alertsService.getAlerts(userId, options);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch alerts' },
    });
  }
});

// ============================================
// GET /api/alerts/stats - Get alert statistics
// ============================================

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default-user';
    const days = req.query.days ? parseInt(req.query.days as string) : 7;

    const stats = await alertsService.getAlertStats(userId, days);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching alert stats:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch alert statistics' },
    });
  }
});

// ============================================
// GET /api/alerts/:id - Get single alert
// ============================================

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const alert = await alertsService.getAlertById(id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Alert not found' },
      });
    }

    res.json({
      success: true,
      data: alert,
    });
  } catch (error) {
    console.error('Error fetching alert:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch alert' },
    });
  }
});

// ============================================
// GET /api/alerts/bundles/:id - Get bundle
// ============================================

router.get('/bundles/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const bundle = await alertsService.getBundleById(id);

    if (!bundle) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Bundle not found' },
      });
    }

    res.json({
      success: true,
      data: bundle,
    });
  } catch (error) {
    console.error('Error fetching bundle:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bundle' },
    });
  }
});

// ============================================
// POST /api/alerts - Create/process new alert
// ============================================

router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default-user';

    const {
      type,
      customerId,
      customerName,
      title,
      description,
      metricChange,
      metadata,
      source,
    } = req.body;

    if (!type || !customerId || !title || !description) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'type, customerId, title, and description are required',
        },
      });
    }

    const rawAlert: RawAlert = {
      id: uuidv4(),
      type,
      customerId,
      customerName,
      title,
      description,
      metricChange,
      metadata,
      source,
      createdAt: new Date(),
    };

    const scoredAlert = await alertsService.processAlert(rawAlert, userId);

    res.status(201).json({
      success: true,
      data: scoredAlert,
    });
  } catch (error) {
    console.error('Error processing alert:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to process alert' },
    });
  }
});

// ============================================
// POST /api/alerts/:id/read - Mark as read
// ============================================

router.post('/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await alertsService.markAlertsAsRead([id]);

    res.json({
      success: true,
      message: 'Alert marked as read',
    });
  } catch (error) {
    console.error('Error marking alert as read:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to mark alert as read' },
    });
  }
});

// ============================================
// POST /api/alerts/bundles/:id/read - Mark bundle as read
// ============================================

router.post('/bundles/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await alertsService.markBundleAsRead(id);

    res.json({
      success: true,
      message: 'Bundle marked as read',
    });
  } catch (error) {
    console.error('Error marking bundle as read:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to mark bundle as read' },
    });
  }
});

// ============================================
// POST /api/alerts/:id/snooze - Snooze alert
// ============================================

router.post('/:id/snooze', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { hours = 24 } = req.body;

    const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
    await alertsService.snoozeAlert(id, snoozeUntil);

    res.json({
      success: true,
      message: `Alert snoozed until ${snoozeUntil.toISOString()}`,
      snoozeUntil,
    });
  } catch (error) {
    console.error('Error snoozing alert:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to snooze alert' },
    });
  }
});

// ============================================
// POST /api/alerts/:id/dismiss - Dismiss alert
// ============================================

router.post('/:id/dismiss', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await alertsService.dismissAlert(id);

    res.json({
      success: true,
      message: 'Alert dismissed',
    });
  } catch (error) {
    console.error('Error dismissing alert:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to dismiss alert' },
    });
  }
});

// ============================================
// POST /api/alerts/:id/feedback - Submit feedback
// ============================================

router.post('/:id/feedback', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string || 'default-user';

    const { feedback, notes } = req.body;

    if (!feedback || !['helpful', 'not_helpful', 'already_knew', 'false_positive'].includes(feedback)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid feedback type required: helpful, not_helpful, already_knew, or false_positive',
        },
      });
    }

    const result = await alertsService.submitFeedback(id, userId, feedback as AlertFeedbackType, notes);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Feedback submitted - thank you for helping improve alert quality',
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to submit feedback' },
    });
  }
});

// ============================================
// GET /api/alerts/preferences - Get preferences
// ============================================

router.get('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default-user';

    const preferences = await alertsService.getAlertPreferences(userId);

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch preferences' },
    });
  }
});

// ============================================
// PUT /api/alerts/preferences - Update preferences
// ============================================

router.put('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default-user';

    const updates = req.body;

    const preferences = await alertsService.updateAlertPreferences(userId, updates);

    res.json({
      success: true,
      data: preferences,
      message: 'Preferences updated successfully',
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update preferences' },
    });
  }
});

// ============================================
// GET /api/alerts/suppressions - List suppressions
// ============================================

router.get('/suppressions', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default-user';

    const suppressions = await alertsService.getSuppressions(userId);

    res.json({
      success: true,
      data: suppressions,
    });
  } catch (error) {
    console.error('Error fetching suppressions:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch suppressions' },
    });
  }
});

// ============================================
// POST /api/alerts/suppressions - Create suppression
// ============================================

router.post('/suppressions', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'default-user';

    const {
      suppressionType,
      customerId,
      alertType,
      reason,
      expiresInDays,
    } = req.body;

    if (!suppressionType || !reason) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'suppressionType and reason are required',
        },
      });
    }

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const suppression = await alertsService.createSuppression({
      userId,
      suppressionType,
      customerId,
      alertType,
      reason,
      expiresAt,
    });

    res.status(201).json({
      success: true,
      data: suppression,
    });
  } catch (error) {
    console.error('Error creating suppression:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create suppression' },
    });
  }
});

// ============================================
// DELETE /api/alerts/suppressions/:id - Delete suppression
// ============================================

router.delete('/suppressions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await alertsService.deleteSuppression(id);

    res.json({
      success: true,
      message: 'Suppression removed',
    });
  } catch (error) {
    console.error('Error deleting suppression:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete suppression' },
    });
  }
});

// ============================================
// GET /api/alerts/feedback/stats - Feedback stats
// ============================================

router.get('/feedback/stats', async (req: Request, res: Response) => {
  try {
    const alertType = req.query.type as AlertType | undefined;
    const days = req.query.days ? parseInt(req.query.days as string) : 30;

    const stats = await alertsService.getFeedbackStats(alertType, days);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch feedback stats' },
    });
  }
});

export default router;
export { router as alertsRoutes };
