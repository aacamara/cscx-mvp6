/**
 * Amplitude Analytics Integration Routes - PRD-196
 *
 * Handles API endpoints for Amplitude product analytics integration:
 * - Connect/disconnect integration
 * - Sync metrics from Amplitude
 * - View metrics, funnels, and retention data
 * - Customer org mapping
 * - Health score integration
 */

import { Router, Request, Response } from 'express';
import { amplitudeService } from '../services/integrations/amplitude.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// CONNECTION MANAGEMENT
// ============================================

/**
 * POST /api/integrations/amplitude/connect
 *
 * Connect Amplitude integration with API credentials (FR-1)
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { userId, apiKey, secretKey, orgId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!apiKey || !secretKey) {
      return res.status(400).json({ error: 'apiKey and secretKey are required' });
    }

    const result = await amplitudeService.connect(userId, apiKey, secretKey, orgId);

    if (!result.success) {
      return res.status(400).json({
        error: result.error || 'Failed to connect Amplitude',
      });
    }

    res.json({
      success: true,
      connectionId: result.connectionId,
      message: 'Amplitude connected successfully',
    });
  } catch (error) {
    console.error('Amplitude connect error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/integrations/amplitude/disconnect
 *
 * Disconnect Amplitude integration
 */
router.delete('/disconnect', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    await amplitudeService.disconnect(userId);

    res.json({
      success: true,
      message: 'Amplitude disconnected successfully',
    });
  } catch (error) {
    console.error('Amplitude disconnect error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/integrations/amplitude/status
 *
 * Get Amplitude integration status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check if globally configured
    if (!amplitudeService.isConfigured()) {
      return res.json({
        configured: false,
        connected: false,
        message: 'Amplitude integration not configured. Set AMPLITUDE_API_KEY and AMPLITUDE_SECRET_KEY.',
      });
    }

    // Get user-specific status
    const status = await amplitudeService.getSyncStatus(userId);

    // Get connection details if connected
    let connectionDetails = null;
    if (status.connected) {
      const connection = await amplitudeService.getConnection(userId);
      if (connection) {
        connectionDetails = {
          orgId: connection.orgId,
          config: connection.config,
        };
      }
    }

    // Get circuit breaker status
    const circuitBreakerStatus = amplitudeService.getCircuitBreakerStatus();

    res.json({
      configured: true,
      ...status,
      connection: connectionDetails,
      circuitBreaker: circuitBreakerStatus,
    });
  } catch (error) {
    console.error('Amplitude status error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// SYNC OPERATIONS
// ============================================

/**
 * POST /api/integrations/amplitude/sync
 *
 * Trigger manual metrics sync from Amplitude
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { userId, customerId, amplitudeOrgId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!customerId || !amplitudeOrgId) {
      return res.status(400).json({
        error: 'customerId and amplitudeOrgId are required',
      });
    }

    const connection = await amplitudeService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({
        error: 'Amplitude not connected. Please authenticate first.',
      });
    }

    const result = await amplitudeService.syncMetrics(
      connection,
      customerId,
      amplitudeOrgId,
      userId
    );

    res.json({
      success: result.errors.length === 0,
      result,
    });
  } catch (error) {
    console.error('Amplitude sync error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// METRICS ENDPOINTS
// ============================================

/**
 * GET /api/amplitude/metrics/:customerId
 *
 * Get Amplitude metrics for a customer (FR-2)
 */
router.get('/metrics/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    const metrics = await amplitudeService.getMetrics(customerId, startDate, endDate);

    // Calculate summary statistics
    let summary = null;
    if (metrics.length > 0) {
      const latestMetric = metrics[0];
      const previousMetric = metrics.length > 7 ? metrics[7] : null;

      summary = {
        currentDau: latestMetric.dau,
        currentMau: latestMetric.mau,
        stickinessRatio: latestMetric.stickinessRatio,
        retentionD30: latestMetric.retentionD30,
        dauTrend: previousMetric
          ? ((latestMetric.dau - previousMetric.dau) / previousMetric.dau) * 100
          : null,
        mauTrend: previousMetric
          ? ((latestMetric.mau - previousMetric.mau) / previousMetric.mau) * 100
          : null,
      };
    }

    res.json({
      success: true,
      customerId,
      metrics,
      summary,
    });
  } catch (error) {
    console.error('Get Amplitude metrics error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/amplitude/retention/:customerId
 *
 * Get retention data for a customer (FR-2)
 */
router.get('/retention/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const retention = await amplitudeService.getRetention(customerId);

    if (!retention) {
      return res.json({
        success: true,
        customerId,
        retention: null,
        message: 'No retention data available',
      });
    }

    // Calculate retention curve
    const retentionCurve = [
      { day: 0, rate: 100 },
      { day: 1, rate: retention.day1 },
      { day: 7, rate: retention.day7 },
      { day: 14, rate: retention.day14 },
      { day: 30, rate: retention.day30 },
    ];

    if (retention.day60) {
      retentionCurve.push({ day: 60, rate: retention.day60 });
    }
    if (retention.day90) {
      retentionCurve.push({ day: 90, rate: retention.day90 });
    }

    res.json({
      success: true,
      customerId,
      retention,
      retentionCurve,
    });
  } catch (error) {
    console.error('Get Amplitude retention error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/amplitude/funnels/:customerId
 *
 * Get funnel data for a customer (FR-4)
 */
router.get('/funnels/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const funnels = await amplitudeService.getFunnels(customerId);

    // Add insights for each funnel
    const funnelsWithInsights = funnels.map((funnel) => ({
      ...funnel,
      insight: generateFunnelInsight(funnel),
    }));

    res.json({
      success: true,
      customerId,
      funnels: funnelsWithInsights,
    });
  } catch (error) {
    console.error('Get Amplitude funnels error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/amplitude/stickiness/:customerId
 *
 * Get stickiness metrics (DAU/MAU ratio) for a customer (FR-5)
 */
router.get('/stickiness/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const metrics = await amplitudeService.getMetrics(customerId);

    if (metrics.length === 0) {
      return res.json({
        success: true,
        customerId,
        stickiness: null,
        message: 'No stickiness data available',
      });
    }

    const latestMetric = metrics[0];
    const stickinessHistory = metrics.slice(0, 30).map((m) => ({
      date: m.metricDate,
      ratio: m.stickinessRatio,
      dau: m.dau,
      mau: m.mau,
    }));

    // Calculate stickiness rating
    const currentStickiness = latestMetric.stickinessRatio * 100;
    let rating: 'excellent' | 'good' | 'fair' | 'poor';
    if (currentStickiness >= 25) rating = 'excellent';
    else if (currentStickiness >= 15) rating = 'good';
    else if (currentStickiness >= 8) rating = 'fair';
    else rating = 'poor';

    res.json({
      success: true,
      customerId,
      stickiness: {
        current: latestMetric.stickinessRatio,
        currentPercent: currentStickiness.toFixed(1),
        rating,
        dau: latestMetric.dau,
        mau: latestMetric.mau,
        trend: stickinessHistory,
      },
      interpretation: getStickinessInterpretation(rating),
    });
  } catch (error) {
    console.error('Get Amplitude stickiness error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// HEALTH SCORE INTEGRATION
// ============================================

/**
 * GET /api/amplitude/health-score/:customerId
 *
 * Get health score components from Amplitude data (FR-6)
 */
router.get('/health-score/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const healthComponents = await amplitudeService.calculateHealthScoreComponents(
      customerId
    );

    res.json({
      success: true,
      customerId,
      healthScore: {
        overall: healthComponents.overallScore,
        components: {
          retention: {
            score: healthComponents.retentionScore,
            weight: 0.4,
            description: 'Based on 30-day retention rate',
          },
          engagement: {
            score: healthComponents.engagementScore,
            weight: 0.35,
            description: 'Based on DAU/MAU stickiness ratio',
          },
          featureBreadth: {
            score: healthComponents.featureBreadthScore,
            weight: 0.25,
            description: 'Based on feature adoption depth',
          },
        },
      },
    });
  } catch (error) {
    console.error('Get Amplitude health score error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// CUSTOMER MAPPING
// ============================================

/**
 * POST /api/amplitude/mapping
 *
 * Map a customer to an Amplitude org ID (FR-2)
 */
router.post('/mapping', async (req: Request, res: Response) => {
  try {
    const { customerId, amplitudeOrgId } = req.body;

    if (!customerId || !amplitudeOrgId) {
      return res.status(400).json({
        error: 'customerId and amplitudeOrgId are required',
      });
    }

    await amplitudeService.mapCustomerToOrg(customerId, amplitudeOrgId);

    res.json({
      success: true,
      message: 'Customer mapped to Amplitude org successfully',
      customerId,
      amplitudeOrgId,
    });
  } catch (error) {
    console.error('Amplitude mapping error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/amplitude/mapping/:customerId
 *
 * Get Amplitude org ID for a customer
 */
router.get('/mapping/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const orgId = await amplitudeService.getOrgIdForCustomer(customerId);

    res.json({
      success: true,
      customerId,
      amplitudeOrgId: orgId,
      mapped: orgId !== null,
    });
  } catch (error) {
    console.error('Get Amplitude mapping error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate insight text for a funnel
 */
function generateFunnelInsight(funnel: {
  overallConversionRate: number;
  biggestDropOff: string;
  steps: Array<{ stepName: string; dropOffRate: number }>;
}): string {
  const conversionRate = funnel.overallConversionRate;
  const dropOffStep = funnel.biggestDropOff;

  let insight = '';

  if (conversionRate >= 30) {
    insight = `Strong funnel performance with ${conversionRate.toFixed(1)}% overall conversion.`;
  } else if (conversionRate >= 15) {
    insight = `Moderate funnel performance at ${conversionRate.toFixed(1)}% conversion.`;
  } else {
    insight = `Funnel needs attention with only ${conversionRate.toFixed(1)}% conversion.`;
  }

  if (dropOffStep) {
    insight += ` Biggest drop-off occurs at "${dropOffStep}" step.`;
  }

  return insight;
}

/**
 * Get interpretation text for stickiness rating
 */
function getStickinessInterpretation(rating: 'excellent' | 'good' | 'fair' | 'poor'): string {
  const interpretations = {
    excellent: 'Users are highly engaged and using the product frequently. This indicates strong product-market fit.',
    good: 'Healthy engagement levels with regular user activity. Room for improvement in daily habits.',
    fair: 'Moderate engagement. Consider analyzing which features drive daily usage and promoting them.',
    poor: 'Low engagement suggests users are not finding daily value. Investigate onboarding and core value proposition.',
  };

  return interpretations[rating];
}

export default router;
