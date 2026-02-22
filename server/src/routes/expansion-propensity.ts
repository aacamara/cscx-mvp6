/**
 * Expansion Propensity API Routes
 * PRD-238: AI-Powered Expansion Propensity Scoring
 *
 * Endpoints for predicting which customers are most likely to expand
 * based on usage patterns, engagement signals, and success metrics.
 *
 * Endpoints:
 * - GET  /api/analytics/expansion-propensity              - Get all propensity scores
 * - GET  /api/analytics/expansion-propensity/top          - Get top expansion opportunities
 * - GET  /api/analytics/expansion-propensity/stats        - Get portfolio-wide statistics
 * - GET  /api/customers/:id/expansion-propensity          - Get customer-specific propensity
 * - POST /api/analytics/expansion-propensity/refresh      - Trigger model refresh
 * - POST /api/analytics/expansion-propensity/:id/feedback - Submit feedback on score
 */

import { Router, Request, Response } from 'express';
import {
  calculatePropensity,
  calculatePropensityBatch,
  getTopExpansionOpportunities,
  getPortfolioPropensityStats,
  getCustomerPropensity,
} from '../services/ai/expansionPropensity.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// Portfolio-Level Endpoints
// ============================================

/**
 * GET /api/analytics/expansion-propensity
 *
 * Get expansion propensity scores for all customers.
 *
 * Query Parameters:
 * - minScore (optional): Minimum propensity score (0-100, default: 0)
 * - limit (optional): Maximum results to return (default: 50)
 * - sort (optional): Sort field (score, value, name)
 */
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const minScore = parseInt(req.query.minScore as string) || 0;
    const limit = parseInt(req.query.limit as string) || 50;
    const sort = (req.query.sort as string) || 'score';

    console.log(`[ExpansionPropensity] Fetching scores with minScore=${minScore}, limit=${limit}`);

    let scores = await calculatePropensityBatch({ minScore, limit: limit * 2 });

    // Apply sorting
    switch (sort) {
      case 'value':
        scores = scores.sort((a, b) => b.estimatedValue - a.estimatedValue);
        break;
      case 'name':
        scores = scores.sort((a, b) => a.customerName.localeCompare(b.customerName));
        break;
      case 'score':
      default:
        // Already sorted by score from batch function
        break;
    }

    // Apply limit
    scores = scores.slice(0, limit);

    const responseTime = Date.now() - startTime;

    return res.json({
      success: true,
      data: {
        scores,
        summary: {
          total: scores.length,
          avgScore: Math.round(scores.reduce((sum, s) => sum + s.propensityScore, 0) / Math.max(scores.length, 1)),
          totalEstimatedValue: scores.reduce((sum, s) => sum + s.estimatedValue, 0),
          highPropensity: scores.filter(s => s.propensityScore >= 80).length,
          mediumPropensity: scores.filter(s => s.propensityScore >= 60 && s.propensityScore < 80).length,
        },
      },
      meta: {
        generatedAt: new Date().toISOString(),
        responseTimeMs: responseTime,
        minScoreFilter: minScore,
      },
    });
  } catch (error) {
    console.error('[ExpansionPropensity] Error fetching scores:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'PROPENSITY_FETCH_FAILED',
        message: 'Failed to fetch expansion propensity scores',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /api/analytics/expansion-propensity/top
 *
 * Get top expansion opportunities ranked by propensity score.
 *
 * Query Parameters:
 * - limit (optional): Number of top opportunities (default: 10)
 */
router.get('/top', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const limit = parseInt(req.query.limit as string) || 10;

    console.log(`[ExpansionPropensity] Fetching top ${limit} opportunities`);

    const opportunities = await getTopExpansionOpportunities(limit);

    const responseTime = Date.now() - startTime;

    // Format for display (as shown in PRD Chat UI Flow)
    const formattedOpportunities = opportunities.map(opp => ({
      rank: opp.rank,
      customerId: opp.customer.customerId,
      customerName: opp.customer.customerName,
      propensity: `${opp.customer.propensityScore}%`,
      confidence: opp.customer.confidence,
      estimatedValue: opp.customer.estimatedValue,
      primarySignal: opp.customer.primarySignal,
      recommendedProducts: opp.customer.recommendedProducts.map(p => p.name),
      approach: opp.customer.approach,
      currentArr: opp.customer.currentState.arr,
      healthScore: opp.customer.currentState.healthScore,
      usageCapacity: `${opp.customer.currentState.usageCapacity}%`,
    }));

    return res.json({
      success: true,
      data: {
        opportunities: formattedOpportunities,
        fullDetails: opportunities,
        summary: {
          totalOpportunities: opportunities.length,
          totalEstimatedValue: opportunities.reduce((sum, o) => sum + o.customer.estimatedValue, 0),
          avgPropensity: Math.round(
            opportunities.reduce((sum, o) => sum + o.customer.propensityScore, 0) / Math.max(opportunities.length, 1)
          ),
        },
      },
      meta: {
        generatedAt: new Date().toISOString(),
        responseTimeMs: responseTime,
      },
    });
  } catch (error) {
    console.error('[ExpansionPropensity] Error fetching top opportunities:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'TOP_OPPORTUNITIES_FAILED',
        message: 'Failed to fetch top expansion opportunities',
      },
    });
  }
});

/**
 * GET /api/analytics/expansion-propensity/stats
 *
 * Get portfolio-wide propensity statistics for the dashboard.
 */
router.get('/stats', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    console.log('[ExpansionPropensity] Fetching portfolio stats');

    const stats = await getPortfolioPropensityStats();

    const responseTime = Date.now() - startTime;

    return res.json({
      success: true,
      data: stats,
      meta: {
        generatedAt: new Date().toISOString(),
        responseTimeMs: responseTime,
      },
    });
  } catch (error) {
    console.error('[ExpansionPropensity] Error fetching stats:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'STATS_FETCH_FAILED',
        message: 'Failed to fetch portfolio propensity statistics',
      },
    });
  }
});

/**
 * POST /api/analytics/expansion-propensity/refresh
 *
 * Trigger a full model refresh for all customers.
 * This recalculates propensity scores based on latest data.
 */
router.post('/refresh', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    console.log('[ExpansionPropensity] Starting full model refresh');

    // Recalculate all scores
    const scores = await calculatePropensityBatch({ minScore: 0, limit: 1000 });

    const responseTime = Date.now() - startTime;
    console.log(`[ExpansionPropensity] Refresh complete: ${scores.length} customers scored in ${responseTime}ms`);

    return res.json({
      success: true,
      data: {
        customersScored: scores.length,
        avgScore: Math.round(scores.reduce((sum, s) => sum + s.propensityScore, 0) / Math.max(scores.length, 1)),
        totalEstimatedValue: scores.reduce((sum, s) => sum + s.estimatedValue, 0),
        distribution: {
          veryHigh: scores.filter(s => s.propensityScore >= 80).length,
          high: scores.filter(s => s.propensityScore >= 60 && s.propensityScore < 80).length,
          medium: scores.filter(s => s.propensityScore >= 40 && s.propensityScore < 60).length,
          low: scores.filter(s => s.propensityScore >= 20 && s.propensityScore < 40).length,
          veryLow: scores.filter(s => s.propensityScore < 20).length,
        },
      },
      meta: {
        refreshedAt: new Date().toISOString(),
        refreshTimeMs: responseTime,
      },
    });
  } catch (error) {
    console.error('[ExpansionPropensity] Error refreshing model:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'REFRESH_FAILED',
        message: 'Failed to refresh expansion propensity model',
      },
    });
  }
});

/**
 * POST /api/analytics/expansion-propensity/:customerId/feedback
 *
 * Submit feedback on propensity score accuracy (for model improvement).
 *
 * Request Body:
 * - accurate (boolean): Whether the score was accurate
 * - actualOutcome (string): What actually happened
 * - notes (string, optional): Additional feedback
 */
router.post('/:customerId/feedback', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { accurate, actualOutcome, notes } = req.body;

    if (typeof accurate !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FEEDBACK',
          message: 'accurate (boolean) is required',
        },
      });
    }

    // Log feedback for model improvement
    // In production, this would be stored for retraining
    console.log('[ExpansionPropensity] Feedback received:', {
      customerId,
      accurate,
      actualOutcome,
      notes,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: 'Feedback recorded successfully',
      data: {
        customerId,
        feedbackRecorded: true,
      },
    });
  } catch (error) {
    console.error('[ExpansionPropensity] Error recording feedback:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'FEEDBACK_FAILED',
        message: 'Failed to record feedback',
      },
    });
  }
});

// ============================================
// Customer-Specific Endpoint (mounted differently)
// ============================================

/**
 * GET /api/customers/:customerId/expansion-propensity
 *
 * Get expansion propensity for a specific customer.
 *
 * Query Parameters:
 * - refresh (optional): Force recalculation (true/false)
 */
export const customerPropensityHandler = async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { customerId } = req.params;
    const forceRefresh = req.query.refresh === 'true';

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
      });
    }

    console.log(`[ExpansionPropensity] Fetching propensity for customer ${customerId}`);

    const propensity = await getCustomerPropensity(customerId, forceRefresh);

    const responseTime = Date.now() - startTime;

    // Format for the deep dive view shown in PRD
    const deepDive = {
      propensityScore: propensity.propensityScore,
      confidence: propensity.confidence,
      contributingFactors: propensity.contributingFactors.map(f => ({
        factor: f.factor,
        description: f.description,
        points: f.weight,
        category: f.category,
        signal: f.signal,
      })),
      recommendedApproach: {
        product: propensity.recommendedProducts[0]?.name || 'Additional Seats',
        timing: propensity.approach.timing,
        champion: propensity.approach.champion,
        entryPoint: propensity.approach.entryPoint,
        talkingPoints: propensity.approach.talkingPoints,
      },
      estimatedValue: propensity.estimatedValue,
      currentState: propensity.currentState,
    };

    return res.json({
      success: true,
      data: {
        propensity,
        deepDive,
        actions: {
          createExpansionOpp: `/api/expansion/opportunities`,
          scheduleMeeting: `/api/meetings/schedule`,
          generateProposal: `/api/customers/${customerId}/proposal`,
        },
      },
      meta: {
        generatedAt: propensity.calculatedAt,
        responseTimeMs: responseTime,
        cached: !forceRefresh,
      },
    });
  } catch (error) {
    console.error('[ExpansionPropensity] Error fetching customer propensity:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'CUSTOMER_PROPENSITY_FAILED',
        message: 'Failed to fetch customer expansion propensity',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
};

// ============================================
// Comparison Endpoint
// ============================================

/**
 * POST /api/analytics/expansion-propensity/compare
 *
 * Compare propensity scores for multiple customers.
 *
 * Request Body:
 * - customerIds (string[]): Array of customer IDs to compare
 */
router.post('/compare', async (req: Request, res: Response) => {
  try {
    const { customerIds } = req.body;

    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'customerIds array is required',
        },
      });
    }

    if (customerIds.length > 10) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOO_MANY_CUSTOMERS',
          message: 'Maximum 10 customers can be compared at once',
        },
      });
    }

    const scores = await Promise.all(
      customerIds.map(id => getCustomerPropensity(id, false).catch(() => null))
    );

    const validScores = scores.filter(s => s !== null) as typeof scores;

    return res.json({
      success: true,
      data: {
        comparison: validScores.sort((a, b) => (b?.propensityScore || 0) - (a?.propensityScore || 0)),
        summary: {
          compared: validScores.length,
          avgScore: Math.round(
            validScores.reduce((sum, s) => sum + (s?.propensityScore || 0), 0) / Math.max(validScores.length, 1)
          ),
          highestScore: Math.max(...validScores.map(s => s?.propensityScore || 0)),
          lowestScore: Math.min(...validScores.map(s => s?.propensityScore || 0)),
        },
      },
    });
  } catch (error) {
    console.error('[ExpansionPropensity] Error comparing customers:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'COMPARISON_FAILED',
        message: 'Failed to compare customer propensity scores',
      },
    });
  }
});

export default router;
