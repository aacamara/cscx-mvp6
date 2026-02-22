/**
 * Risk Deep Dive Routes (PRD-083)
 *
 * API endpoints for comprehensive risk factor analysis:
 * - GET  /api/customers/:id/risk/deep-dive   - Get comprehensive risk analysis
 * - GET  /api/customers/:id/risk/trends      - Get risk trend data
 * - POST /api/customers/:id/risk/mitigation  - Generate mitigation plan
 */

import { Router, Request, Response } from 'express';
import {
  riskAnalysisService,
  generateRiskDeepDive,
  getRiskTrends,
  generateMitigationPlan,
} from '../services/intelligence/riskAnalysis.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

/**
 * GET /api/customers/:id/risk/deep-dive
 *
 * Generate comprehensive risk analysis for a customer.
 * Includes all contributing factors, weights, trends, and recommendations.
 */
router.get('/:customerId/risk/deep-dive', async (req: Request, res: Response) => {
  const startTime = Date.now();

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

    const deepDive = await generateRiskDeepDive(customerId);

    if (!deepDive) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: `Could not find customer with ID '${customerId}'`,
        },
      });
    }

    const responseTime = Date.now() - startTime;

    console.log(
      `[RiskDeepDive] Analysis generated for ${deepDive.customerName} in ${responseTime}ms`
    );

    // Warn if over 5 second target
    if (responseTime > 5000) {
      console.warn(`[RiskDeepDive] Analysis exceeded 5s target: ${responseTime}ms`);
    }

    return res.json({
      success: true,
      data: deepDive,
      meta: {
        generatedAt: deepDive.generatedAt,
        responseTimeMs: responseTime,
        dataCompleteness: deepDive.dataCompleteness,
        factorCount: deepDive.factors.length,
        riskScore: deepDive.riskScore,
        riskLevel: deepDive.riskLevel,
      },
    });
  } catch (error) {
    console.error('[RiskDeepDive] Error generating analysis:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate risk deep dive analysis',
      },
    });
  }
});

/**
 * GET /api/customers/:id/risk/trends
 *
 * Get historical risk trend data for a customer.
 *
 * Query Parameters:
 * - period (optional): 30, 60, 90, 180, 365 (days, default: 90)
 */
router.get('/:customerId/risk/trends', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { customerId } = req.params;
    const { period = '90' } = req.query;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
      });
    }

    const periodDays = parseInt(period as string, 10);
    if (isNaN(periodDays) || periodDays < 7 || periodDays > 365) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PERIOD',
          message: 'Period must be between 7 and 365 days',
        },
      });
    }

    const trends = await getRiskTrends(customerId, periodDays);

    if (!trends) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: `Could not find customer with ID '${customerId}'`,
        },
      });
    }

    const responseTime = Date.now() - startTime;

    console.log(
      `[RiskDeepDive] Trends generated for ${trends.customerName} in ${responseTime}ms`
    );

    return res.json({
      success: true,
      data: trends,
      meta: {
        responseTimeMs: responseTime,
        period: trends.period,
        dataPoints: trends.history.length,
      },
    });
  } catch (error) {
    console.error('[RiskDeepDive] Error generating trends:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate risk trend data',
      },
    });
  }
});

/**
 * POST /api/customers/:id/risk/mitigation
 *
 * Generate a mitigation plan based on risk analysis.
 */
router.post('/:customerId/risk/mitigation', async (req: Request, res: Response) => {
  const startTime = Date.now();

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

    const plan = await generateMitigationPlan(customerId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: `Could not find customer with ID '${customerId}'`,
        },
      });
    }

    const responseTime = Date.now() - startTime;

    console.log(
      `[RiskDeepDive] Mitigation plan generated for ${plan.customerName} in ${responseTime}ms`
    );

    return res.status(201).json({
      success: true,
      data: plan,
      meta: {
        responseTimeMs: responseTime,
        planId: plan.planId,
        totalActions: plan.totalActions,
        urgentActions: plan.urgentActions,
      },
    });
  } catch (error) {
    console.error('[RiskDeepDive] Error generating mitigation plan:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate mitigation plan',
      },
    });
  }
});

/**
 * GET /api/customers/:id/risk/factors
 *
 * Get detailed breakdown of risk factors by category.
 */
router.get('/:customerId/risk/factors', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { category } = req.query;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
      });
    }

    const deepDive = await generateRiskDeepDive(customerId);

    if (!deepDive) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: `Could not find customer with ID '${customerId}'`,
        },
      });
    }

    // Filter by category if specified
    let factors = deepDive.factors;
    if (category) {
      factors = deepDive.factorsByCategory[category as keyof typeof deepDive.factorsByCategory] || [];
    }

    return res.json({
      success: true,
      data: {
        customerId,
        customerName: deepDive.customerName,
        riskScore: deepDive.riskScore,
        riskLevel: deepDive.riskLevel,
        factors,
        factorsByCategory: category ? undefined : deepDive.factorsByCategory,
        primaryConcerns: deepDive.primaryConcerns,
      },
    });
  } catch (error) {
    console.error('[RiskDeepDive] Error fetching risk factors:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch risk factors',
      },
    });
  }
});

/**
 * GET /api/customers/:id/risk/benchmarks
 *
 * Get comparative benchmark data for the customer's risk metrics.
 */
router.get('/:customerId/risk/benchmarks', async (req: Request, res: Response) => {
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

    const deepDive = await generateRiskDeepDive(customerId);

    if (!deepDive) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: `Could not find customer with ID '${customerId}'`,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        customerId,
        customerName: deepDive.customerName,
        benchmarks: deepDive.benchmarks,
      },
    });
  } catch (error) {
    console.error('[RiskDeepDive] Error fetching benchmarks:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch risk benchmarks',
      },
    });
  }
});

export const riskDeepDiveRoutes = router;
export default router;
