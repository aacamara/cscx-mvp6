/**
 * Health Insights API Routes
 *
 * Endpoints for AI-powered health score insights and recommendations.
 */

import { Router, Request, Response } from 'express';
import {
  generateHealthInsights,
  getPortfolioHealthSummary,
} from '../services/ai/health-insights.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

/**
 * GET /api/health-insights/:customerId
 *
 * Generate comprehensive AI-powered health insights for a customer.
 */
router.get('/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const {
      includeHistory,
      includePredictions,
      horizons,
    } = req.query;

    // Parse options
    const options = {
      includeHistory: includeHistory !== 'false',
      includePredictions: includePredictions !== 'false',
      predictionHorizons: horizons
        ? (horizons as string).split(',').map(h => parseInt(h, 10))
        : [30, 60, 90],
    };

    const insights = await generateHealthInsights(customerId, options);

    res.json({
      success: true,
      data: insights,
    });
  } catch (error) {
    console.error('Error generating health insights:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INSIGHTS_GENERATION_FAILED',
        message: 'Failed to generate health insights',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /api/health-insights/portfolio/summary
 *
 * Get portfolio-level health insights summary.
 */
router.get('/portfolio/summary', async (req: Request, res: Response) => {
  try {
    const summary = await getPortfolioHealthSummary();

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error getting portfolio summary:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PORTFOLIO_SUMMARY_FAILED',
        message: 'Failed to get portfolio health summary',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * POST /api/health-insights/:customerId/feedback
 *
 * Submit feedback on insight quality (for model improvement).
 */
router.post('/:customerId/feedback', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { insightId, helpful, actionTaken, notes } = req.body;

    // Validate request
    if (!insightId || typeof helpful !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FEEDBACK',
          message: 'insightId and helpful (boolean) are required',
        },
      });
    }

    // In a production system, this would store feedback in the database
    // for model improvement. For now, we log it.
    console.log('Insight feedback received:', {
      customerId,
      insightId,
      helpful,
      actionTaken,
      notes,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Feedback recorded successfully',
    });
  } catch (error) {
    console.error('Error recording feedback:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FEEDBACK_FAILED',
        message: 'Failed to record feedback',
      },
    });
  }
});

/**
 * POST /api/health-insights/:customerId/refresh
 *
 * Force refresh insights (recalculate health score and regenerate).
 */
router.post('/:customerId/refresh', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    // Generate fresh insights (will recalculate scores)
    const insights = await generateHealthInsights(customerId, {
      includeHistory: true,
      includePredictions: true,
      predictionHorizons: [30, 60, 90],
    });

    res.json({
      success: true,
      data: insights,
      message: 'Insights refreshed successfully',
    });
  } catch (error) {
    console.error('Error refreshing insights:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REFRESH_FAILED',
        message: 'Failed to refresh insights',
      },
    });
  }
});

/**
 * GET /api/health-insights/:customerId/interventions
 *
 * Get only intervention recommendations (lighter endpoint).
 */
router.get('/:customerId/interventions', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    // Generate insights with minimal options
    const insights = await generateHealthInsights(customerId, {
      includeHistory: false,
      includePredictions: false,
    });

    res.json({
      success: true,
      data: {
        customerId,
        currentHealth: insights.currentHealth,
        riskLevel: insights.riskLevel,
        interventions: insights.interventions,
      },
    });
  } catch (error) {
    console.error('Error getting interventions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERVENTIONS_FAILED',
        message: 'Failed to get intervention recommendations',
      },
    });
  }
});

/**
 * GET /api/health-insights/:customerId/predictions
 *
 * Get only health predictions.
 */
router.get('/:customerId/predictions', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { horizons } = req.query;

    const predictionHorizons = horizons
      ? (horizons as string).split(',').map(h => parseInt(h, 10))
      : [30, 60, 90];

    const insights = await generateHealthInsights(customerId, {
      includeHistory: true,
      includePredictions: true,
      predictionHorizons,
    });

    res.json({
      success: true,
      data: {
        customerId,
        currentHealth: insights.currentHealth,
        trend: insights.trend,
        predictions: insights.predictions,
        confidence: insights.confidence,
      },
    });
  } catch (error) {
    console.error('Error getting predictions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PREDICTIONS_FAILED',
        message: 'Failed to get health predictions',
      },
    });
  }
});

export default router;
