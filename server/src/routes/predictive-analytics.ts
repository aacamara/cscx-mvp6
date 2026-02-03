/**
 * Predictive Analytics API Routes
 * PRD-176: Endpoints for predictive analytics and forecasting
 */

import { Router, Request, Response } from 'express';
import {
  predictiveAnalyticsService,
  PredictionType,
} from '../services/predictiveAnalytics.js';

const router = Router();

// ============================================
// PORTFOLIO PREDICTIONS
// ============================================

/**
 * GET /api/reports/predictive-analytics
 * Get full predictive analytics report for portfolio
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { segment, horizon_days } = req.query;

    const horizonDays = horizon_days ? parseInt(horizon_days as string, 10) : 90;

    const report = await predictiveAnalyticsService.getPredictiveAnalyticsReport(
      userId,
      segment as string,
      horizonDays
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Predictive analytics report error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/reports/predictive-analytics/high-risk
 * Get high churn risk customers
 */
router.get('/high-risk', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { segment, min_probability, limit } = req.query;

    const report = await predictiveAnalyticsService.getPredictiveAnalyticsReport(
      userId,
      segment as string
    );

    let highRisk = report.high_risk;

    // Filter by minimum probability if specified
    if (min_probability) {
      const minProb = parseInt(min_probability as string, 10);
      highRisk = highRisk.filter(p => p.outcome.predicted_value >= minProb);
    }

    // Limit results
    if (limit) {
      highRisk = highRisk.slice(0, parseInt(limit as string, 10));
    }

    res.json({
      success: true,
      data: {
        predictions: highRisk,
        total: highRisk.length,
        total_arr_at_risk: highRisk.reduce((sum, p) => sum + (p.arr || 0), 0),
      },
    });
  } catch (error) {
    console.error('High risk predictions error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/reports/predictive-analytics/expansion-opportunities
 * Get expansion opportunity predictions
 */
router.get('/expansion-opportunities', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { segment, min_probability, limit } = req.query;

    const report = await predictiveAnalyticsService.getPredictiveAnalyticsReport(
      userId,
      segment as string
    );

    let opportunities = report.high_opportunity;

    // Filter by minimum probability if specified
    if (min_probability) {
      const minProb = parseInt(min_probability as string, 10);
      opportunities = opportunities.filter(p => p.outcome.predicted_value >= minProb);
    }

    // Limit results
    if (limit) {
      opportunities = opportunities.slice(0, parseInt(limit as string, 10));
    }

    res.json({
      success: true,
      data: {
        predictions: opportunities,
        total: opportunities.length,
      },
    });
  } catch (error) {
    console.error('Expansion opportunities error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// CUSTOMER-LEVEL PREDICTIONS
// ============================================

/**
 * GET /api/reports/predictive-analytics/customers/:customerId
 * Get all predictions for a specific customer
 */
router.get('/customers/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const [churnPrediction, expansionPrediction, healthPrediction] = await Promise.all([
      predictiveAnalyticsService.getCustomerPrediction(customerId, 'churn'),
      predictiveAnalyticsService.getCustomerPrediction(customerId, 'expansion'),
      predictiveAnalyticsService.getCustomerPrediction(customerId, 'health'),
    ]);

    if (!churnPrediction && !expansionPrediction && !healthPrediction) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found or no predictions available',
      });
    }

    res.json({
      success: true,
      data: {
        customer_id: customerId,
        predictions: {
          churn: churnPrediction,
          expansion: expansionPrediction,
          health: healthPrediction,
        },
      },
    });
  } catch (error) {
    console.error('Customer predictions error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/reports/predictive-analytics/customers/:customerId/:type
 * Get specific prediction type for a customer
 */
router.get('/customers/:customerId/:type', async (req: Request, res: Response) => {
  try {
    const { customerId, type } = req.params;

    if (!['churn', 'expansion', 'health', 'behavior'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prediction type. Must be: churn, expansion, health, or behavior',
      });
    }

    const prediction = await predictiveAnalyticsService.getCustomerPrediction(
      customerId,
      type as PredictionType
    );

    if (!prediction) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found or no prediction available',
      });
    }

    res.json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    console.error('Customer prediction error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// MODEL PERFORMANCE
// ============================================

/**
 * GET /api/reports/predictive-analytics/model-performance
 * Get model performance metrics
 */
router.get('/model-performance', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    const report = await predictiveAnalyticsService.getPredictiveAnalyticsReport(userId);

    res.json({
      success: true,
      data: {
        models: report.model_performance,
        summary: {
          avg_accuracy: Math.round(
            report.model_performance.reduce((sum, m) => sum + m.accuracy, 0) /
            report.model_performance.length
          ),
          total_training_samples: report.model_performance.reduce(
            (sum, m) => sum + m.training_samples,
            0
          ),
        },
      },
    });
  } catch (error) {
    console.error('Model performance error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/reports/predictive-analytics/accuracy/:type
 * Get prediction accuracy for a specific model type
 */
router.get('/accuracy/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { lookback_days } = req.query;

    if (!['churn', 'expansion', 'health'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prediction type. Must be: churn, expansion, or health',
      });
    }

    const lookbackDays = lookback_days ? parseInt(lookback_days as string, 10) : 90;

    const accuracy = await predictiveAnalyticsService.getPredictionAccuracy(
      type as PredictionType,
      lookbackDays
    );

    res.json({
      success: true,
      data: accuracy,
    });
  } catch (error) {
    console.error('Prediction accuracy error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// PORTFOLIO SUMMARY
// ============================================

/**
 * GET /api/reports/predictive-analytics/portfolio-summary
 * Get portfolio prediction summary
 */
router.get('/portfolio-summary', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { horizon_days } = req.query;

    const horizonDays = horizon_days ? parseInt(horizon_days as string, 10) : 90;

    const report = await predictiveAnalyticsService.getPredictiveAnalyticsReport(
      userId,
      undefined,
      horizonDays
    );

    res.json({
      success: true,
      data: {
        horizon_days: horizonDays,
        total_customers: report.total_customers,
        predictions: report.portfolio_predictions,
        high_risk_count: report.high_risk.length,
        high_opportunity_count: report.high_opportunity.length,
        generated_at: report.generated_at,
      },
    });
  } catch (error) {
    console.error('Portfolio summary error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

export default router;
