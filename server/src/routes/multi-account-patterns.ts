/**
 * Multi-Account Pattern Routes (PRD-105)
 *
 * API endpoints for managing parent-child customer relationships
 * and multi-account pattern detection.
 */

import { Router, Request, Response } from 'express';
import {
  multiAccountPatternService,
  CustomerRelationshipType,
  PatternType,
  PatternSeverity,
  PatternStatus,
} from '../services/multiAccountPatterns/index.js';
import {
  sendMultiAccountPatternAlert,
  handlePatternAlertInteraction,
} from '../services/multiAccountPatterns/slack-alerts.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// Customer Family Management
// ============================================

/**
 * GET /api/multi-account/families
 * List all customer families (parent accounts with children)
 */
router.get('/families', async (req: Request, res: Response) => {
  try {
    const families = await multiAccountPatternService.getCustomerFamilies();

    res.json({
      success: true,
      data: families,
      count: families.length,
    });
  } catch (error) {
    console.error('[MultiAccountPatterns] Error listing families:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list customer families' },
    });
  }
});

/**
 * GET /api/multi-account/families/:parentId
 * Get a specific customer family
 */
router.get('/families/:parentId', async (req: Request, res: Response) => {
  try {
    const { parentId } = req.params;
    const family = await multiAccountPatternService.getCustomerFamily(parentId);

    if (!family) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer family not found' },
      });
    }

    res.json({
      success: true,
      data: family,
    });
  } catch (error) {
    console.error('[MultiAccountPatterns] Error getting family:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get customer family' },
    });
  }
});

/**
 * GET /api/multi-account/families/:parentId/dashboard
 * Get comprehensive family dashboard with patterns and history
 */
router.get('/families/:parentId/dashboard', async (req: Request, res: Response) => {
  try {
    const { parentId } = req.params;
    const dashboard = await multiAccountPatternService.getFamilyDashboard(parentId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer family not found' },
      });
    }

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error('[MultiAccountPatterns] Error getting family dashboard:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get family dashboard' },
    });
  }
});

/**
 * POST /api/multi-account/relationships
 * Set parent-child relationship between customers
 */
router.post('/relationships', async (req: Request, res: Response) => {
  try {
    const { childCustomerId, parentCustomerId, relationshipType } = req.body;

    if (!childCustomerId || !parentCustomerId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'childCustomerId and parentCustomerId are required' },
      });
    }

    const validTypes: CustomerRelationshipType[] = ['subsidiary', 'division', 'region', 'brand', 'department'];
    if (relationshipType && !validTypes.includes(relationshipType)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `relationshipType must be one of: ${validTypes.join(', ')}` },
      });
    }

    const success = await multiAccountPatternService.setParentRelationship(
      childCustomerId,
      parentCustomerId,
      relationshipType || 'subsidiary'
    );

    if (!success) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to set parent relationship' },
      });
    }

    res.json({
      success: true,
      message: 'Parent relationship set successfully',
    });
  } catch (error) {
    console.error('[MultiAccountPatterns] Error setting relationship:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to set parent relationship' },
    });
  }
});

/**
 * DELETE /api/multi-account/relationships/:childId
 * Remove parent-child relationship
 */
router.delete('/relationships/:childId', async (req: Request, res: Response) => {
  try {
    const { childId } = req.params;

    const success = await multiAccountPatternService.removeParentRelationship(childId);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to remove parent relationship' },
      });
    }

    res.json({
      success: true,
      message: 'Parent relationship removed successfully',
    });
  } catch (error) {
    console.error('[MultiAccountPatterns] Error removing relationship:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to remove parent relationship' },
    });
  }
});

// ============================================
// Pattern Detection
// ============================================

/**
 * POST /api/multi-account/patterns/detect
 * Run pattern detection for families
 */
router.post('/patterns/detect', async (req: Request, res: Response) => {
  try {
    const { parentCustomerId, patternTypes, config } = req.body;

    // Validate pattern types if provided
    if (patternTypes) {
      const validTypes: PatternType[] = ['risk_contagion', 'replication_opportunity', 'synchronized_change', 'cross_expansion'];
      for (const type of patternTypes) {
        if (!validTypes.includes(type)) {
          return res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: `Invalid pattern type: ${type}` },
          });
        }
      }
    }

    const patterns = await multiAccountPatternService.detectPatterns({
      parentCustomerId,
      patternTypes,
      config,
    });

    res.json({
      success: true,
      data: patterns,
      count: patterns.length,
      message: `Detected ${patterns.length} pattern(s)`,
    });
  } catch (error) {
    console.error('[MultiAccountPatterns] Error detecting patterns:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to detect patterns' },
    });
  }
});

/**
 * GET /api/multi-account/patterns
 * List patterns with filtering
 */
router.get('/patterns', async (req: Request, res: Response) => {
  try {
    const {
      parentCustomerId,
      patternTypes,
      status,
      severity,
      limit,
      offset,
      sortBy,
      sortOrder,
    } = req.query;

    const patterns = await multiAccountPatternService.getPatterns({
      parentCustomerId: parentCustomerId as string,
      patternTypes: patternTypes ? (patternTypes as string).split(',') as PatternType[] : undefined,
      status: status ? (status as string).split(',') as PatternStatus[] : undefined,
      severity: severity ? (severity as string).split(',') as PatternSeverity[] : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      sortBy: sortBy as 'detected_at' | 'severity' | 'confidence_score',
      sortOrder: sortOrder as 'asc' | 'desc',
    });

    res.json({
      success: true,
      data: patterns,
      count: patterns.length,
    });
  } catch (error) {
    console.error('[MultiAccountPatterns] Error listing patterns:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list patterns' },
    });
  }
});

/**
 * GET /api/multi-account/patterns/:patternId
 * Get a specific pattern
 */
router.get('/patterns/:patternId', async (req: Request, res: Response) => {
  try {
    const { patternId } = req.params;
    const pattern = await multiAccountPatternService.getPattern(patternId);

    if (!pattern) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Pattern not found' },
      });
    }

    res.json({
      success: true,
      data: pattern,
    });
  } catch (error) {
    console.error('[MultiAccountPatterns] Error getting pattern:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get pattern' },
    });
  }
});

/**
 * PATCH /api/multi-account/patterns/:patternId/status
 * Update pattern status
 */
router.patch('/patterns/:patternId/status', async (req: Request, res: Response) => {
  try {
    const { patternId } = req.params;
    const { status, userId } = req.body;

    const validStatuses: PatternStatus[] = ['active', 'acknowledged', 'resolved', 'dismissed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `status must be one of: ${validStatuses.join(', ')}` },
      });
    }

    const success = await multiAccountPatternService.updatePatternStatus(patternId, status, userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Pattern not found or update failed' },
      });
    }

    res.json({
      success: true,
      message: `Pattern status updated to ${status}`,
    });
  } catch (error) {
    console.error('[MultiAccountPatterns] Error updating pattern status:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update pattern status' },
    });
  }
});

// ============================================
// Alerts
// ============================================

/**
 * POST /api/multi-account/patterns/:patternId/alert
 * Send alert for a pattern
 */
router.post('/patterns/:patternId/alert', async (req: Request, res: Response) => {
  try {
    const { patternId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'userId is required' },
      });
    }

    // Get pattern
    const pattern = await multiAccountPatternService.getPattern(patternId);
    if (!pattern) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Pattern not found' },
      });
    }

    // Get family
    const family = await multiAccountPatternService.getCustomerFamily(pattern.parentCustomerId);
    if (!family) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer family not found' },
      });
    }

    // Send alert
    const result = await sendMultiAccountPatternAlert(userId, pattern, family);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: { code: 'ALERT_FAILED', message: result.error || 'Failed to send alert' },
      });
    }

    res.json({
      success: true,
      message: 'Alert sent successfully',
      messageTs: result.messageTs,
    });
  } catch (error) {
    console.error('[MultiAccountPatterns] Error sending alert:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to send alert' },
    });
  }
});

/**
 * POST /api/multi-account/alerts/interaction
 * Handle Slack interactive message action
 */
router.post('/alerts/interaction', async (req: Request, res: Response) => {
  try {
    const { actionId, userId } = req.body;

    if (!actionId || !userId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'actionId and userId are required' },
      });
    }

    const result = await handlePatternAlertInteraction(actionId, userId);

    if (!result.processed) {
      return res.status(400).json({
        success: false,
        error: { code: 'UNKNOWN_ACTION', message: result.error || 'Unknown action' },
      });
    }

    res.json({
      success: true,
      action: result.action,
    });
  } catch (error) {
    console.error('[MultiAccountPatterns] Error handling interaction:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to handle interaction' },
    });
  }
});

// ============================================
// Summary Endpoints
// ============================================

/**
 * GET /api/multi-account/summary
 * Get summary of all multi-account patterns
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const families = await multiAccountPatternService.getCustomerFamilies();
    const activePatterns = await multiAccountPatternService.getPatterns({ status: ['active'] });

    // Calculate summaries
    const totalFamilies = families.length;
    const totalChildAccounts = families.reduce((sum, f) => sum + f.children.length, 0);
    const totalArr = families.reduce((sum, f) => sum + f.totalArr, 0);

    const avgFamilyHealth = totalFamilies > 0
      ? Math.round(families.reduce((sum, f) => sum + f.aggregatedHealthScore, 0) / totalFamilies)
      : 0;

    const patternsByType = {
      risk_contagion: activePatterns.filter(p => p.patternType === 'risk_contagion').length,
      replication_opportunity: activePatterns.filter(p => p.patternType === 'replication_opportunity').length,
      synchronized_change: activePatterns.filter(p => p.patternType === 'synchronized_change').length,
      cross_expansion: activePatterns.filter(p => p.patternType === 'cross_expansion').length,
    };

    const patternsBySeverity = {
      critical: activePatterns.filter(p => p.severity === 'critical').length,
      high: activePatterns.filter(p => p.severity === 'high').length,
      medium: activePatterns.filter(p => p.severity === 'medium').length,
      low: activePatterns.filter(p => p.severity === 'low').length,
    };

    const familiesAtRisk = families.filter(f =>
      f.children.some(c => c.healthScore < 60) ||
      activePatterns.some(p => p.parentCustomerId === f.parentCustomerId && p.severity === 'high' || p.severity === 'critical')
    ).length;

    res.json({
      success: true,
      data: {
        families: {
          total: totalFamilies,
          totalChildAccounts,
          totalArr,
          avgHealth: avgFamilyHealth,
          atRisk: familiesAtRisk,
        },
        patterns: {
          active: activePatterns.length,
          byType: patternsByType,
          bySeverity: patternsBySeverity,
        },
      },
    });
  } catch (error) {
    console.error('[MultiAccountPatterns] Error getting summary:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get summary' },
    });
  }
});

export { router as multiAccountPatternsRoutes };
export default router;
