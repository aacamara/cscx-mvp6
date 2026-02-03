/**
 * Quiet Account Alert API Routes
 * PRD-106: Endpoints for quiet account detection and management
 *
 * Provides endpoints for:
 * - Detecting quiet accounts across portfolio
 * - Getting detailed quiet account information
 * - Recording interactions and re-engagement
 * - Generating check-in emails and suggestions
 */

import { Router, Request, Response } from 'express';
import {
  quietAccountService,
  detectQuietAccounts,
  getQuietAccountDetail,
  recordInteraction,
  markAlertSent,
  markReEngaged,
  excludeFromAlerts,
  generateQuietAccountEvents,
} from '../services/quietAccountDetector.js';
import {
  QuietAccountFilters,
  InteractionType,
  CustomerSegment,
  DEFAULT_QUIET_THRESHOLDS,
} from '../../../types/quietAccount.js';

const router = Router();

// ============================================
// PORTFOLIO-LEVEL ENDPOINTS
// ============================================

/**
 * GET /api/quiet-accounts
 * Get all quiet accounts with optional filters
 *
 * Query params:
 * - severity: 'warning' | 'elevated' | 'critical'
 * - segment: 'enterprise' | 'mid-market' | 'smb' | 'startup'
 * - minQuietDays: number
 * - maxQuietDays: number
 * - csmId: string
 * - sortBy: 'quiet_days' | 'arr' | 'renewal_date' | 'health_score'
 * - sortOrder: 'asc' | 'desc'
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters: QuietAccountFilters = {
      severity: req.query.severity as any,
      segment: req.query.segment as CustomerSegment,
      minQuietDays: req.query.minQuietDays
        ? parseInt(req.query.minQuietDays as string, 10)
        : undefined,
      maxQuietDays: req.query.maxQuietDays
        ? parseInt(req.query.maxQuietDays as string, 10)
        : undefined,
      csmId: req.query.csmId as string,
      includeExcluded: req.query.includeExcluded === 'true',
      sortBy: (req.query.sortBy as any) || 'quiet_days',
      sortOrder: (req.query.sortOrder as any) || 'desc',
    };

    const result = await detectQuietAccounts(filters);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching quiet accounts:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/quiet-accounts/summary
 * Get summary statistics for quiet accounts
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const csmId = req.query.csmId as string;
    const result = await detectQuietAccounts({ csmId });

    res.json({
      success: true,
      data: result.summary,
    });
  } catch (error) {
    console.error('Error fetching quiet account summary:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/quiet-accounts/thresholds
 * Get quiet account threshold configuration
 */
router.get('/thresholds', async (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        thresholds: DEFAULT_QUIET_THRESHOLDS,
        description: {
          enterprise: 'Enterprise accounts: 21+ days triggers warning',
          'mid-market': 'Mid-Market accounts: 30+ days triggers warning',
          smb: 'SMB accounts: 45+ days triggers warning',
          startup: 'Startup accounts: 45+ days triggers warning',
          escalation: 'All segments: 60+ days triggers escalation (critical)',
        },
      },
    });
  } catch (error) {
    console.error('Error fetching thresholds:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// SINGLE ACCOUNT ENDPOINTS
// ============================================

/**
 * GET /api/quiet-accounts/:customerId
 * Get detailed quiet account information for a specific customer
 */
router.get('/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const detail = await getQuietAccountDetail(customerId);

    if (!detail) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found or no quiet account data available',
      });
    }

    res.json({
      success: true,
      data: detail,
    });
  } catch (error) {
    console.error('Error fetching quiet account detail:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/quiet-accounts/:customerId/check-in-email
 * Generate a draft check-in email for a quiet account
 */
router.get('/:customerId/check-in-email', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const detail = await getQuietAccountDetail(customerId);

    if (!detail) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    if (!detail.draftCheckInEmail) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate check-in email',
      });
    }

    res.json({
      success: true,
      data: detail.draftCheckInEmail,
    });
  } catch (error) {
    console.error('Error generating check-in email:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/quiet-accounts/:customerId/suggestions
 * Get re-engagement suggestions for a quiet account
 */
router.get('/:customerId/suggestions', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const detail = await getQuietAccountDetail(customerId);

    if (!detail) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    res.json({
      success: true,
      data: {
        suggestions: detail.reEngagementSuggestions,
        suggestedActions: detail.alert.suggestedActions,
      },
    });
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// INTERACTION TRACKING ENDPOINTS
// ============================================

/**
 * POST /api/quiet-accounts/:customerId/interactions
 * Record a new interaction for a customer (resets quiet status)
 */
router.post('/:customerId/interactions', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { type, date } = req.body;

    // Validate interaction type
    const validTypes: InteractionType[] = [
      'meeting',
      'email_sent',
      'email_received',
      'support_ticket',
      'csm_note',
      'call',
      'qbr',
    ];

    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid interaction type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    const success = await recordInteraction(
      customerId,
      type as InteractionType,
      date || new Date().toISOString()
    );

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to record interaction',
      });
    }

    res.status(201).json({
      success: true,
      message: 'Interaction recorded successfully',
    });
  } catch (error) {
    console.error('Error recording interaction:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/quiet-accounts/:customerId/re-engage
 * Mark account as re-engaged
 */
router.post('/:customerId/re-engage', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { interactionType } = req.body;

    const validTypes: InteractionType[] = [
      'meeting',
      'email_sent',
      'email_received',
      'call',
      'qbr',
    ];

    const type = interactionType && validTypes.includes(interactionType)
      ? interactionType
      : 'email_sent';

    const success = await markReEngaged(customerId, type as InteractionType);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to mark account as re-engaged',
      });
    }

    res.json({
      success: true,
      message: 'Account marked as re-engaged',
    });
  } catch (error) {
    console.error('Error marking re-engaged:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// ALERT MANAGEMENT ENDPOINTS
// ============================================

/**
 * POST /api/quiet-accounts/:customerId/alert-sent
 * Mark alert as sent for a customer
 */
router.post('/:customerId/alert-sent', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const success = await markAlertSent(customerId);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to mark alert as sent',
      });
    }

    res.json({
      success: true,
      message: 'Alert marked as sent',
    });
  } catch (error) {
    console.error('Error marking alert sent:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/quiet-accounts/:customerId/exclude
 * Exclude account from quiet alerts
 */
router.post('/:customerId/exclude', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { reason, excludeUntil } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Reason is required for exclusion',
      });
    }

    const success = await excludeFromAlerts(customerId, reason, excludeUntil);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to exclude account from alerts',
      });
    }

    res.json({
      success: true,
      message: 'Account excluded from quiet alerts',
    });
  } catch (error) {
    console.error('Error excluding from alerts:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// TRIGGER INTEGRATION ENDPOINTS
// ============================================

/**
 * POST /api/quiet-accounts/scan
 * Manually trigger a scan for quiet accounts
 * (Typically run by scheduled job)
 */
router.post('/scan', async (req: Request, res: Response) => {
  try {
    const events = await generateQuietAccountEvents();

    res.json({
      success: true,
      data: {
        scannedAt: new Date().toISOString(),
        quietAccountsFound: events.length,
        events,
      },
    });
  } catch (error) {
    console.error('Error running quiet account scan:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/quiet-accounts/alerts/batch
 * Send alerts for multiple quiet accounts
 */
router.post('/alerts/batch', async (req: Request, res: Response) => {
  try {
    const { customerIds, channel = 'slack' } = req.body;

    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'customerIds array is required',
      });
    }

    const results = await Promise.all(
      customerIds.map(async (customerId: string) => {
        try {
          await markAlertSent(customerId);
          return { customerId, success: true };
        } catch (error) {
          return { customerId, success: false, error: (error as Error).message };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;

    res.json({
      success: true,
      data: {
        total: customerIds.length,
        sent: successCount,
        failed: customerIds.length - successCount,
        channel,
        results,
      },
    });
  } catch (error) {
    console.error('Error sending batch alerts:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

export { router as quietAccountRoutes };
export default router;
