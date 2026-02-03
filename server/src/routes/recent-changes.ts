/**
 * Recent Changes Routes (PRD-073)
 *
 * API endpoints for account change detection and alerting.
 *
 * Endpoints:
 * - GET  /api/intelligence/changes/:customerId           - Get recent changes for a customer
 * - POST /api/intelligence/changes/:changeId/acknowledge - Acknowledge a change
 * - GET  /api/intelligence/changes/:customerId/export    - Export changes as CSV
 * - GET  /api/intelligence/alerts/:customerId/preferences - Get alert preferences
 * - PUT  /api/intelligence/alerts/:customerId/preferences - Update alert preferences
 */

import { Router, Request, Response } from 'express';
import { recentChangesService } from '../services/recentChanges.js';

const router = Router();

/**
 * GET /api/intelligence/changes/:customerId
 *
 * Get recent changes for a specific customer.
 *
 * Query Parameters:
 * - period: '7d' | '14d' | '30d' | '90d' (default: '7d')
 * - severity: 'critical' | 'high' | 'medium' | 'low' | 'all' (default: 'all')
 * - acknowledged: 'true' | 'false' (optional)
 * - types: comma-separated list of change types (optional)
 */
router.get('/changes/:customerId', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { customerId } = req.params;
    const {
      period = '7d',
      severity = 'all',
      acknowledged,
      types,
    } = req.query;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
      });
    }

    // Validate period
    const validPeriods = ['7d', '14d', '30d', '90d'];
    if (!validPeriods.includes(period as string)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PERIOD',
          message: `Period must be one of: ${validPeriods.join(', ')}`,
        },
      });
    }

    // Validate severity
    const validSeverities = ['critical', 'high', 'medium', 'low', 'all'];
    if (!validSeverities.includes(severity as string)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SEVERITY',
          message: `Severity must be one of: ${validSeverities.join(', ')}`,
        },
      });
    }

    // Parse change types filter
    const changeTypes = types ? (types as string).split(',') : undefined;

    // Parse acknowledged filter
    let acknowledgedFilter: boolean | undefined;
    if (acknowledged === 'true') acknowledgedFilter = true;
    if (acknowledged === 'false') acknowledgedFilter = false;

    const result = await recentChangesService.getChanges({
      customerId,
      period: period as '7d' | '14d' | '30d' | '90d',
      severity: severity as 'critical' | 'high' | 'medium' | 'low' | 'all',
      acknowledged: acknowledgedFilter,
      changeTypes,
    });

    const responseTime = Date.now() - startTime;

    console.log(`[RecentChanges] Retrieved ${result.changes.length} changes for customer ${customerId} in ${responseTime}ms`);

    // Warn if over 5 second target
    if (responseTime > 5000) {
      console.warn(`[RecentChanges] Changes retrieval exceeded 5s target: ${responseTime}ms`);
    }

    return res.json({
      success: true,
      data: result,
      meta: {
        customerId,
        period,
        responseTimeMs: responseTime,
        changeCount: result.changes.length,
        unacknowledgedCount: result.summary.unacknowledged,
      },
    });
  } catch (error) {
    console.error('[RecentChanges] Error retrieving changes:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve account changes',
      },
    });
  }
});

/**
 * POST /api/intelligence/changes/:changeId/acknowledge
 *
 * Acknowledge a change and optionally record action taken.
 *
 * Request Body:
 * - actionTaken (optional): Description of action taken
 */
router.post('/changes/:changeId/acknowledge', async (req: Request, res: Response) => {
  try {
    const { changeId } = req.params;
    const { actionTaken, acknowledgedBy = 'CSM' } = req.body;

    if (!changeId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CHANGE_ID',
          message: 'Change ID is required',
        },
      });
    }

    const change = await recentChangesService.acknowledgeChange(
      changeId,
      acknowledgedBy,
      actionTaken
    );

    if (!change) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CHANGE_NOT_FOUND',
          message: `Change with ID '${changeId}' not found`,
        },
      });
    }

    console.log(`[RecentChanges] Change ${changeId} acknowledged`);

    return res.json({
      success: true,
      data: {
        change,
        suggestedActions: recentChangesService.getSuggestedActions(change),
      },
      meta: {
        acknowledgedAt: change.acknowledgedAt,
      },
    });
  } catch (error) {
    console.error('[RecentChanges] Error acknowledging change:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to acknowledge change',
      },
    });
  }
});

/**
 * POST /api/intelligence/changes/acknowledge-all
 *
 * Acknowledge all unacknowledged changes for a customer.
 *
 * Request Body:
 * - customerId (required): Customer ID
 * - changeIds (required): Array of change IDs to acknowledge
 */
router.post('/changes/acknowledge-all', async (req: Request, res: Response) => {
  try {
    const { customerId, changeIds, acknowledgedBy = 'CSM' } = req.body;

    if (!customerId || !changeIds || !Array.isArray(changeIds)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Customer ID and change IDs array are required',
        },
      });
    }

    const results = await Promise.all(
      changeIds.map(id =>
        recentChangesService.acknowledgeChange(id, acknowledgedBy)
      )
    );

    const acknowledged = results.filter(r => r !== null);

    console.log(`[RecentChanges] Acknowledged ${acknowledged.length} of ${changeIds.length} changes for customer ${customerId}`);

    return res.json({
      success: true,
      data: {
        acknowledgedCount: acknowledged.length,
        totalRequested: changeIds.length,
      },
    });
  } catch (error) {
    console.error('[RecentChanges] Error acknowledging changes:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to acknowledge changes',
      },
    });
  }
});

/**
 * GET /api/intelligence/changes/:customerId/export
 *
 * Export changes as CSV file.
 *
 * Query Parameters:
 * - period: '7d' | '14d' | '30d' | '90d' (default: '30d')
 * - format: 'csv' | 'json' (default: 'csv')
 */
router.get('/changes/:customerId/export', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { period = '30d', format = 'csv' } = req.query;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
      });
    }

    const result = await recentChangesService.getChanges({
      customerId,
      period: period as '7d' | '14d' | '30d' | '90d',
    });

    if (format === 'csv') {
      const csv = recentChangesService.exportChanges(result.changes);
      const filename = `changes-${customerId}-${period}-${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    }

    // Default to JSON
    return res.json({
      success: true,
      data: result.changes,
      meta: {
        exportFormat: format,
        recordCount: result.changes.length,
        period,
      },
    });
  } catch (error) {
    console.error('[RecentChanges] Error exporting changes:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to export changes',
      },
    });
  }
});

/**
 * GET /api/intelligence/alerts/:customerId/preferences
 *
 * Get alert preferences for a customer.
 */
router.get('/alerts/:customerId/preferences', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
      });
    }

    const preferences = await recentChangesService.getAlertPreferences(customerId);

    return res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error('[RecentChanges] Error getting alert preferences:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get alert preferences',
      },
    });
  }
});

/**
 * PUT /api/intelligence/alerts/:customerId/preferences
 *
 * Update alert preferences for a customer.
 *
 * Request Body:
 * - healthDrop: { enabled: boolean, threshold: number, channels: string[] }
 * - usageChange: { enabled: boolean, threshold: number, channels: string[] }
 * - championActivity: { enabled: boolean, threshold: number, channels: string[] }
 * - supportTickets: { enabled: boolean, threshold: number, channels: string[] }
 * - renewalReminder: { enabled: boolean, threshold: number, channels: string[] }
 */
router.put('/alerts/:customerId/preferences', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const updates = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
      });
    }

    const preferences = await recentChangesService.updateAlertPreferences(
      customerId,
      updates
    );

    console.log(`[RecentChanges] Alert preferences updated for customer ${customerId}`);

    return res.json({
      success: true,
      data: preferences,
      meta: {
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[RecentChanges] Error updating alert preferences:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update alert preferences',
      },
    });
  }
});

/**
 * GET /api/intelligence/changes/:changeId/actions
 *
 * Get suggested actions for a specific change.
 */
router.get('/changes/:changeId/actions', async (req: Request, res: Response) => {
  try {
    const { changeId } = req.params;

    if (!changeId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CHANGE_ID',
          message: 'Change ID is required',
        },
      });
    }

    // For now, return generic actions based on change type patterns
    // In a full implementation, we would look up the specific change
    return res.json({
      success: true,
      data: {
        changeId,
        suggestedActions: [
          'Review change details',
          'Contact customer if needed',
          'Schedule follow-up meeting',
          'Update account notes',
        ],
      },
    });
  } catch (error) {
    console.error('[RecentChanges] Error getting suggested actions:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get suggested actions',
      },
    });
  }
});

export default router;
