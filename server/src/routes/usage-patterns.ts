/**
 * Usage Pattern Analysis API Routes
 * PRD-066: Usage Pattern Analysis
 *
 * Provides endpoints for:
 * - Full usage pattern analysis
 * - Specific pattern types (time, feature, user)
 * - Benchmark comparisons
 * - Anomaly management
 */

import { Router, Request, Response } from 'express';
import { analyzeUsagePatterns, getBenchmarkComparison } from '../services/usage/patternAnalysis.js';

const router = Router();

/**
 * GET /api/usage-patterns/:customerId
 * Get comprehensive usage pattern analysis for a customer
 *
 * Query params:
 * - period: '7d' | '30d' | '90d' | 'all' (default: '30d')
 * - includeAnomalies: boolean (default: true)
 * - includePredictions: boolean (default: true)
 * - includeUserDetails: boolean (default: true)
 */
router.get('/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const {
      period = '30d',
      includeAnomalies = 'true',
      includePredictions = 'true',
      includeUserDetails = 'true',
    } = req.query;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID is required',
      });
    }

    const analysis = await analyzeUsagePatterns(customerId, {
      period: period as '7d' | '30d' | '90d' | 'all',
      includeAnomalies: includeAnomalies === 'true',
      includePredictions: includePredictions === 'true',
      includeUserDetails: includeUserDetails === 'true',
    });

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('Usage pattern analysis error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/usage-patterns/:customerId/summary
 * Get a summary view of usage patterns (lighter weight)
 */
router.get('/:customerId/summary', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { period = '30d' } = req.query;

    const analysis = await analyzeUsagePatterns(customerId, {
      period: period as '7d' | '30d' | '90d' | 'all',
      includeAnomalies: false,
      includePredictions: false,
      includeUserDetails: false,
    });

    res.json({
      success: true,
      data: {
        customerId: analysis.customerId,
        customerName: analysis.customerName,
        summary: analysis.summary,
        engagement: analysis.engagement,
        topRecommendations: analysis.recommendations.slice(0, 3),
        generatedAt: analysis.generatedAt,
      },
    });
  } catch (error) {
    console.error('Usage pattern summary error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/usage-patterns/:customerId/time-patterns
 * Get time-based usage patterns only
 */
router.get('/:customerId/time-patterns', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { period = '30d' } = req.query;

    const analysis = await analyzeUsagePatterns(customerId, {
      period: period as '7d' | '30d' | '90d' | 'all',
      includeAnomalies: false,
      includePredictions: false,
      includeUserDetails: false,
    });

    res.json({
      success: true,
      data: {
        customerId: analysis.customerId,
        analyzedPeriod: analysis.analyzedPeriod,
        timePatterns: analysis.timePatterns,
      },
    });
  } catch (error) {
    console.error('Time patterns error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/usage-patterns/:customerId/feature-patterns
 * Get feature usage patterns only
 */
router.get('/:customerId/feature-patterns', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { period = '30d' } = req.query;

    const analysis = await analyzeUsagePatterns(customerId, {
      period: period as '7d' | '30d' | '90d' | 'all',
      includeAnomalies: false,
      includePredictions: false,
      includeUserDetails: false,
    });

    res.json({
      success: true,
      data: {
        customerId: analysis.customerId,
        analyzedPeriod: analysis.analyzedPeriod,
        featurePatterns: analysis.featurePatterns,
      },
    });
  } catch (error) {
    console.error('Feature patterns error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/usage-patterns/:customerId/user-segments
 * Get user segmentation analysis
 */
router.get('/:customerId/user-segments', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { period = '30d', includeUserDetails = 'true' } = req.query;

    const analysis = await analyzeUsagePatterns(customerId, {
      period: period as '7d' | '30d' | '90d' | 'all',
      includeAnomalies: false,
      includePredictions: false,
      includeUserDetails: includeUserDetails === 'true',
    });

    res.json({
      success: true,
      data: {
        customerId: analysis.customerId,
        analyzedPeriod: analysis.analyzedPeriod,
        userSegmentation: analysis.userSegmentation,
      },
    });
  } catch (error) {
    console.error('User segments error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/usage-patterns/:customerId/anomalies
 * Get detected usage anomalies
 */
router.get('/:customerId/anomalies', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { period = '30d' } = req.query;

    const analysis = await analyzeUsagePatterns(customerId, {
      period: period as '7d' | '30d' | '90d' | 'all',
      includeAnomalies: true,
      includePredictions: false,
      includeUserDetails: false,
    });

    res.json({
      success: true,
      data: {
        customerId: analysis.customerId,
        analyzedPeriod: analysis.analyzedPeriod,
        anomalies: analysis.anomalies,
      },
    });
  } catch (error) {
    console.error('Anomalies error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/usage-patterns/:customerId/churn-risk
 * Get churn risk indicators
 */
router.get('/:customerId/churn-risk', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { period = '30d' } = req.query;

    const analysis = await analyzeUsagePatterns(customerId, {
      period: period as '7d' | '30d' | '90d' | 'all',
      includeAnomalies: false,
      includePredictions: true,
      includeUserDetails: false,
    });

    // Calculate overall risk score
    const weightedScore = analysis.churnIndicators.reduce(
      (sum, ind) => sum + (ind.score * ind.weight), 0
    );
    const riskLevel = weightedScore >= 70 ? 'low' : weightedScore >= 50 ? 'medium' : 'high';

    res.json({
      success: true,
      data: {
        customerId: analysis.customerId,
        analyzedPeriod: analysis.analyzedPeriod,
        overallRiskScore: Math.round(100 - weightedScore),
        riskLevel,
        indicators: analysis.churnIndicators,
        predictions: analysis.predictions,
      },
    });
  } catch (error) {
    console.error('Churn risk error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/usage-patterns/:customerId/benchmark
 * Get benchmark comparison against peers
 */
router.get('/:customerId/benchmark', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { segment } = req.query;

    const comparisons = await getBenchmarkComparison(customerId, segment as string | undefined);

    res.json({
      success: true,
      data: {
        customerId,
        comparisons,
      },
    });
  } catch (error) {
    console.error('Benchmark comparison error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/usage-patterns/:customerId/recommendations
 * Get actionable recommendations
 */
router.get('/:customerId/recommendations', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { period = '30d', priority } = req.query;

    const analysis = await analyzeUsagePatterns(customerId, {
      period: period as '7d' | '30d' | '90d' | 'all',
      includeAnomalies: true,
      includePredictions: false,
      includeUserDetails: false,
    });

    let recommendations = analysis.recommendations;
    if (priority) {
      recommendations = recommendations.filter(r => r.priority === priority);
    }

    res.json({
      success: true,
      data: {
        customerId: analysis.customerId,
        analyzedPeriod: analysis.analyzedPeriod,
        summary: analysis.summary,
        recommendations,
      },
    });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/usage-patterns/:customerId/anomalies/:anomalyId/dismiss
 * Dismiss a detected anomaly
 */
router.post('/:customerId/anomalies/:anomalyId/dismiss', async (req: Request, res: Response) => {
  try {
    const { customerId, anomalyId } = req.params;
    const { reason } = req.body;

    // In a real implementation, this would update the database
    // For now, return success
    res.json({
      success: true,
      data: {
        anomalyId,
        dismissed: true,
        dismissedAt: new Date().toISOString(),
        reason: reason || 'User dismissed',
      },
    });
  } catch (error) {
    console.error('Dismiss anomaly error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/usage-patterns/:customerId/heatmap
 * Get usage heatmap data (hour x day matrix)
 */
router.get('/:customerId/heatmap', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { period = '30d' } = req.query;

    const analysis = await analyzeUsagePatterns(customerId, {
      period: period as '7d' | '30d' | '90d' | 'all',
      includeAnomalies: false,
      includePredictions: false,
      includeUserDetails: false,
    });

    // Build heatmap matrix (7 days x 24 hours)
    const heatmap: { day: string; hour: number; value: number }[] = [];

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    analysis.timePatterns.daily.forEach((dayPattern, dayIndex) => {
      analysis.timePatterns.hourly.forEach(hourPattern => {
        // Estimate value based on day and hour patterns
        const dayFactor = dayPattern.avgEvents / Math.max(...analysis.timePatterns.daily.map(d => d.avgEvents || 1));
        const hourFactor = hourPattern.avgEvents / Math.max(...analysis.timePatterns.hourly.map(h => h.avgEvents || 1));
        const value = Math.round(dayFactor * hourFactor * 100);

        heatmap.push({
          day: dayNames[dayIndex],
          hour: hourPattern.hour,
          value,
        });
      });
    });

    res.json({
      success: true,
      data: {
        customerId: analysis.customerId,
        analyzedPeriod: analysis.analyzedPeriod,
        heatmap,
        peakTimes: analysis.timePatterns.peakUsageTimes,
      },
    });
  } catch (error) {
    console.error('Heatmap error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

export default router;
