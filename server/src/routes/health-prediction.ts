/**
 * Health Prediction API Routes (PRD-231)
 *
 * Endpoints for AI-powered health score predictions and forecasts.
 */

import { Router, Request, Response } from 'express';
import {
  healthPredictionService,
  HealthPrediction,
  PortfolioHealthForecast,
} from '../services/ai/health-prediction.js';

const router = Router();

/**
 * GET /api/health-prediction/:customerId
 *
 * Generate health prediction for a specific customer.
 * Returns predicted health scores for 30, 60, 90 days with confidence intervals.
 */
router.get('/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { horizons } = req.query;

    // Parse custom horizons if provided
    const horizonDays = horizons
      ? (horizons as string).split(',').map(h => parseInt(h.trim(), 10)).filter(n => !isNaN(n))
      : [30, 60, 90];

    const prediction = await healthPredictionService.predictHealth(customerId, horizonDays);

    res.json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    console.error('[HealthPrediction] Error generating prediction:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PREDICTION_FAILED',
        message: 'Failed to generate health prediction',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /api/health-prediction/portfolio/forecast
 *
 * Get portfolio-level health forecast with aggregated predictions.
 */
router.get('/portfolio/forecast', async (req: Request, res: Response) => {
  try {
    const forecast = await healthPredictionService.getPortfolioForecast();

    res.json({
      success: true,
      data: forecast,
    });
  } catch (error) {
    console.error('[HealthPrediction] Error getting portfolio forecast:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PORTFOLIO_FORECAST_FAILED',
        message: 'Failed to get portfolio health forecast',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * POST /api/health-prediction/:customerId/refresh
 *
 * Force refresh prediction for a customer (recalculates with latest data).
 */
router.post('/:customerId/refresh', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    // Generate fresh prediction
    const prediction = await healthPredictionService.predictHealth(customerId, [30, 60, 90]);

    res.json({
      success: true,
      data: prediction,
      message: 'Prediction refreshed successfully',
    });
  } catch (error) {
    console.error('[HealthPrediction] Error refreshing prediction:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REFRESH_FAILED',
        message: 'Failed to refresh prediction',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /api/health-prediction/:customerId/interventions
 *
 * Get only intervention recommendations (lighter endpoint).
 */
router.get('/:customerId/interventions', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const prediction = await healthPredictionService.predictHealth(customerId, [30]);

    res.json({
      success: true,
      data: {
        customerId,
        customerName: prediction.customerName,
        currentHealth: prediction.currentHealth,
        interventions: prediction.interventions,
        primaryDrivers: prediction.primaryDrivers,
      },
    });
  } catch (error) {
    console.error('[HealthPrediction] Error getting interventions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERVENTIONS_FAILED',
        message: 'Failed to get intervention recommendations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /api/health-prediction/:customerId/drivers
 *
 * Get only primary drivers affecting health trajectory.
 */
router.get('/:customerId/drivers', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const prediction = await healthPredictionService.predictHealth(customerId, [30, 60, 90]);

    res.json({
      success: true,
      data: {
        customerId,
        customerName: prediction.customerName,
        currentHealth: prediction.currentHealth,
        primaryDrivers: prediction.primaryDrivers,
        predictions: prediction.predictions.map(p => ({
          daysAhead: p.daysAhead,
          predictedScore: p.predictedScore,
          keyFactors: p.keyFactors,
        })),
      },
    });
  } catch (error) {
    console.error('[HealthPrediction] Error getting drivers:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DRIVERS_FAILED',
        message: 'Failed to get prediction drivers',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * POST /api/health-prediction/:customerId/accuracy/update
 *
 * Trigger accuracy tracking update for a customer.
 * Should be called periodically (e.g., daily cron) to track prediction quality.
 */
router.post('/:customerId/accuracy/update', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    await healthPredictionService.updatePredictionAccuracy(customerId);

    res.json({
      success: true,
      message: 'Prediction accuracy updated',
    });
  } catch (error) {
    console.error('[HealthPrediction] Error updating accuracy:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ACCURACY_UPDATE_FAILED',
        message: 'Failed to update prediction accuracy',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * POST /api/health-prediction/:customerId/simulation
 *
 * Simulate the impact of planned interventions on health trajectory.
 */
router.post('/:customerId/simulation', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { interventions } = req.body;

    if (!Array.isArray(interventions) || interventions.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'interventions array is required',
        },
      });
    }

    // Get current prediction
    const basePrediction = await healthPredictionService.predictHealth(customerId, [30, 60, 90]);

    // Calculate impact of selected interventions
    const selectedInterventions = basePrediction.interventions.filter(i =>
      interventions.includes(i.intervention)
    );

    const totalImpact = selectedInterventions.reduce((sum, i) => sum + i.expectedHealthImpact, 0);

    // Calculate adjusted predictions
    const adjustedPredictions = basePrediction.predictions.map(p => ({
      daysAhead: p.daysAhead,
      originalScore: p.predictedScore,
      adjustedScore: Math.min(100, p.predictedScore + totalImpact),
      improvement: totalImpact,
    }));

    res.json({
      success: true,
      data: {
        customerId,
        customerName: basePrediction.customerName,
        currentHealth: basePrediction.currentHealth,
        selectedInterventions: selectedInterventions.map(i => i.intervention),
        totalExpectedImpact: totalImpact,
        adjustedPredictions,
        confidence: basePrediction.confidence,
        simulatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[HealthPrediction] Error running simulation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SIMULATION_FAILED',
        message: 'Failed to run intervention simulation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * GET /api/health-prediction/batch/at-risk
 *
 * Get customers predicted to become at-risk within a specified timeframe.
 */
router.get('/batch/at-risk', async (req: Request, res: Response) => {
  try {
    const { daysAhead = '30', threshold = '50' } = req.query;

    const days = parseInt(daysAhead as string, 10) || 30;
    const healthThreshold = parseInt(threshold as string, 10) || 50;

    const forecast = await healthPredictionService.getPortfolioForecast();

    // Filter accounts that will drop below threshold
    const atRiskAccounts = forecast.accountsDeclining.filter(a => {
      if (days <= 30) return a.predicted90d < healthThreshold;
      if (days <= 60) return a.predicted90d < healthThreshold;
      return a.predicted90d < healthThreshold;
    });

    res.json({
      success: true,
      data: {
        daysAhead: days,
        threshold: healthThreshold,
        count: atRiskAccounts.length,
        accounts: atRiskAccounts,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[HealthPrediction] Error getting at-risk accounts:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AT_RISK_FAILED',
        message: 'Failed to get at-risk accounts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

export default router;
