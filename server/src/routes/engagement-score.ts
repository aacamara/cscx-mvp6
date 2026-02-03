/**
 * Engagement Score Breakdown API Routes
 * PRD-070: Detailed engagement score breakdown with contributing factors
 */

import { Router, Request, Response } from 'express';
import { engagementScoreService } from '../services/engagementScore.js';

const router = Router();

// ============================================
// ENGAGEMENT SCORE BREAKDOWN
// ============================================

/**
 * GET /api/intelligence/engagement/:customerId
 * Get detailed engagement score breakdown for a customer
 *
 * Query params:
 * - period: '7d' | '14d' | '30d' | '60d' | '90d' (default: '30d')
 * - comparePeriod: 'previous' | 'year_ago' (default: 'previous')
 */
router.get('/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { period = '30d', comparePeriod = 'previous' } = req.query;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CUSTOMER_ID', message: 'Customer ID is required' },
      });
    }

    const breakdown = await engagementScoreService.getEngagementScoreBreakdown(
      customerId,
      period as string,
      comparePeriod as string
    );

    if (!breakdown) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found or no engagement data available' },
      });
    }

    res.json({
      success: true,
      data: breakdown,
    });
  } catch (error) {
    console.error('Engagement score breakdown error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch engagement score breakdown' },
    });
  }
});

/**
 * GET /api/intelligence/engagement/:customerId/trends
 * Get engagement score trends over time
 *
 * Query params:
 * - months: number of months to fetch (default: 6)
 */
router.get('/:customerId/trends', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { months = '6' } = req.query;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CUSTOMER_ID', message: 'Customer ID is required' },
      });
    }

    const trends = await engagementScoreService.getEngagementTrends(
      customerId,
      parseInt(months as string, 10)
    );

    res.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    console.error('Engagement trends error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch engagement trends' },
    });
  }
});

/**
 * GET /api/intelligence/engagement/:customerId/alerts
 * Get engagement alerts for a customer
 */
router.get('/:customerId/alerts', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CUSTOMER_ID', message: 'Customer ID is required' },
      });
    }

    const alerts = await engagementScoreService.getEngagementAlerts(customerId);

    res.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    console.error('Engagement alerts error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch engagement alerts' },
    });
  }
});

/**
 * GET /api/intelligence/engagement/:customerId/component/:component
 * Get detailed breakdown of a specific engagement component
 */
router.get('/:customerId/component/:component', async (req: Request, res: Response) => {
  try {
    const { customerId, component } = req.params;

    if (!customerId || !component) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PARAMS', message: 'Customer ID and component are required' },
      });
    }

    const validComponents = ['communication', 'product', 'relationship'];
    if (!validComponents.includes(component)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_COMPONENT',
          message: `Invalid component. Must be one of: ${validComponents.join(', ')}`,
        },
      });
    }

    const breakdown = await engagementScoreService.getEngagementScoreBreakdown(customerId);

    if (!breakdown) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found or no engagement data available' },
      });
    }

    const componentDetail = breakdown.componentDetails[component as 'communication' | 'product' | 'relationship'];

    res.json({
      success: true,
      data: {
        customer: breakdown.customer,
        component: component,
        detail: componentDetail,
        overall: breakdown.score.overall,
        updatedAt: breakdown.updatedAt,
      },
    });
  } catch (error) {
    console.error('Component detail error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch component detail' },
    });
  }
});

/**
 * GET /api/intelligence/engagement/:customerId/peer-comparison
 * Get peer comparison data for customer engagement
 */
router.get('/:customerId/peer-comparison', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CUSTOMER_ID', message: 'Customer ID is required' },
      });
    }

    const breakdown = await engagementScoreService.getEngagementScoreBreakdown(customerId);

    if (!breakdown) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found or no engagement data available' },
      });
    }

    res.json({
      success: true,
      data: {
        customer: breakdown.customer,
        peerComparison: breakdown.peerComparison,
        insight: breakdown.peerComparison.overall.percentile >= 50
          ? 'Above average engagement compared to similar accounts'
          : 'Below average engagement compared to similar accounts',
      },
    });
  } catch (error) {
    console.error('Peer comparison error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch peer comparison' },
    });
  }
});

/**
 * GET /api/intelligence/engagement/:customerId/impact
 * Get impact analysis for potential score changes
 */
router.get('/:customerId/impact', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CUSTOMER_ID', message: 'Customer ID is required' },
      });
    }

    const breakdown = await engagementScoreService.getEngagementScoreBreakdown(customerId);

    if (!breakdown) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found or no engagement data available' },
      });
    }

    res.json({
      success: true,
      data: {
        customer: breakdown.customer,
        currentScore: breakdown.score.overall,
        impactAnalysis: breakdown.impactAnalysis,
      },
    });
  } catch (error) {
    console.error('Impact analysis error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch impact analysis' },
    });
  }
});

/**
 * GET /api/intelligence/engagement/:customerId/recommendations
 * Get actionable recommendations for improving engagement
 */
router.get('/:customerId/recommendations', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CUSTOMER_ID', message: 'Customer ID is required' },
      });
    }

    const breakdown = await engagementScoreService.getEngagementScoreBreakdown(customerId);

    if (!breakdown) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found or no engagement data available' },
      });
    }

    res.json({
      success: true,
      data: {
        customer: breakdown.customer,
        currentScore: breakdown.score.overall,
        recommendations: breakdown.score.recommendations,
        riskFactors: breakdown.score.riskFactors,
      },
    });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch recommendations' },
    });
  }
});

export { router as engagementScoreRoutes };
