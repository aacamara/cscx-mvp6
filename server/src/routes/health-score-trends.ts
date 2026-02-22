/**
 * Health Score Trend Analysis Routes
 *
 * PRD-060 (interpreted as Health Score Trend Analysis)
 * Combined with PRD-153 (Health Score Portfolio View) and PRD-170 (Trend Analysis Report)
 *
 * Endpoints:
 * - GET  /api/health-trends/portfolio          - Portfolio-wide health trend analysis
 * - GET  /api/health-trends/customer/:id       - Single customer health trend
 * - GET  /api/health-trends/compare            - Compare health trends across segments
 * - GET  /api/health-trends/alerts             - Get health score alerts and anomalies
 */

import { Router, Request, Response } from 'express';
import { optionalAuthMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';
import healthScoreTrendService, {
  HealthScoreTrendAnalysis,
  CustomerHealthTrend
} from '../services/usage/health-score-trend.js';

const router = Router();

/**
 * GET /api/health-trends/portfolio
 *
 * Get comprehensive portfolio health score trend analysis.
 * Returns overview, all customer trends, alerts, and insights.
 *
 * Query Parameters:
 * - csmId (optional): Filter to specific CSM's portfolio
 * - segment (optional): Filter by industry/segment
 * - days (optional): Number of days of history (default: 90)
 */
router.get('/portfolio', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { csmId, segment, days = '90' } = req.query;

    const analysis = await healthScoreTrendService.getPortfolioHealthTrendAnalysis({
      csmId: csmId as string | undefined,
      segment: segment as string | undefined,
      days: parseInt(days as string)
    });

    const responseTime = Date.now() - startTime;

    console.log(`[HealthTrends] Portfolio analysis generated in ${responseTime}ms`);

    return res.json({
      success: true,
      data: analysis,
      meta: {
        responseTimeMs: responseTime,
        periodDays: parseInt(days as string),
        filters: {
          csmId: csmId || null,
          segment: segment || null
        }
      }
    });
  } catch (error) {
    console.error('[HealthTrends] Error generating portfolio analysis:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate portfolio health trend analysis'
      }
    });
  }
});

/**
 * GET /api/health-trends/customer/:id
 *
 * Get health score trend analysis for a specific customer.
 * Includes historical data, trend direction, forecast, and anomalies.
 *
 * Path Parameters:
 * - id: Customer UUID
 *
 * Query Parameters:
 * - days (optional): Number of days of history (default: 90)
 */
router.get('/customer/:id', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { id } = req.params;
    const { days = '90' } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required'
        }
      });
    }

    const trend = await healthScoreTrendService.getCustomerHealthTrend(
      id,
      parseInt(days as string)
    );

    if (!trend) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: `Could not find customer with ID '${id}'`
        }
      });
    }

    const responseTime = Date.now() - startTime;

    console.log(`[HealthTrends] Customer trend generated for ${trend.customerName} in ${responseTime}ms`);

    return res.json({
      success: true,
      data: trend,
      meta: {
        responseTimeMs: responseTime,
        periodDays: parseInt(days as string),
        dataPoints: trend.dataPoints.length
      }
    });
  } catch (error) {
    console.error('[HealthTrends] Error generating customer trend:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate customer health trend'
      }
    });
  }
});

/**
 * GET /api/health-trends/compare
 *
 * Compare health score trends across different dimensions.
 * Supports comparison by segment, CSM, industry, or tenure.
 *
 * Query Parameters:
 * - dimension (required): 'segment' | 'csm' | 'industry' | 'tenure'
 * - days (optional): Number of days of history (default: 90)
 */
router.get('/compare', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { dimension, days = '90' } = req.query;

    if (!dimension) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_DIMENSION',
          message: 'Comparison dimension is required (segment, csm, industry, tenure)'
        }
      });
    }

    // Get full portfolio analysis
    const analysis = await healthScoreTrendService.getPortfolioHealthTrendAnalysis({
      days: parseInt(days as string)
    });

    // Group by dimension (for now, simplified grouping by category)
    const groups: Record<string, {
      customers: CustomerHealthTrend[];
      avgScore: number;
      totalArr: number;
      trend: string;
    }> = {};

    // Group customers
    analysis.customers.forEach(customer => {
      let groupKey: string;

      switch (dimension) {
        case 'segment':
        case 'industry':
          groupKey = 'All Segments'; // Would need industry data
          break;
        case 'csm':
          groupKey = 'All CSMs'; // Would need CSM assignment data
          break;
        case 'tenure':
          // Group by health category as a proxy for now
          groupKey = customer.category;
          break;
        default:
          groupKey = customer.category;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = {
          customers: [],
          avgScore: 0,
          totalArr: 0,
          trend: 'stable'
        };
      }

      groups[groupKey].customers.push(customer);
    });

    // Calculate aggregates for each group
    Object.values(groups).forEach(group => {
      const totalCustomers = group.customers.length;
      group.avgScore = totalCustomers > 0
        ? Math.round(group.customers.reduce((sum, c) => sum + c.currentScore, 0) / totalCustomers)
        : 0;
      group.totalArr = group.customers.reduce((sum, c) => sum + (c.arr || 0), 0);

      // Determine overall trend
      const upCount = group.customers.filter(c => c.trend.direction === 'up').length;
      const downCount = group.customers.filter(c => c.trend.direction === 'down').length;
      group.trend = upCount > downCount ? 'improving' : downCount > upCount ? 'declining' : 'stable';
    });

    const responseTime = Date.now() - startTime;

    return res.json({
      success: true,
      data: {
        dimension,
        groups: Object.entries(groups).map(([name, data]) => ({
          name,
          customerCount: data.customers.length,
          avgHealthScore: data.avgScore,
          totalArr: data.totalArr,
          trend: data.trend
        })),
        generatedAt: new Date().toISOString()
      },
      meta: {
        responseTimeMs: responseTime,
        periodDays: parseInt(days as string)
      }
    });
  } catch (error) {
    console.error('[HealthTrends] Error generating comparison:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate health trend comparison'
      }
    });
  }
});

/**
 * GET /api/health-trends/alerts
 *
 * Get health score alerts and anomalies that need attention.
 * Returns customers crossing thresholds, steep declines, and renewal risks.
 *
 * Query Parameters:
 * - severity (optional): Filter by severity ('critical', 'warning', 'info')
 * - limit (optional): Maximum alerts to return (default: 20)
 */
router.get('/alerts', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { severity, limit = '20' } = req.query;

    // Get full portfolio analysis
    const analysis = await healthScoreTrendService.getPortfolioHealthTrendAnalysis({
      days: 30 // Use shorter window for alerts
    });

    // Filter insights by severity if specified
    let alerts = analysis.insights;

    if (severity) {
      alerts = alerts.filter(insight => insight.severity === severity);
    }

    // Limit results
    alerts = alerts.slice(0, parseInt(limit as string));

    const responseTime = Date.now() - startTime;

    return res.json({
      success: true,
      data: {
        alerts,
        summary: {
          total: analysis.insights.length,
          critical: analysis.insights.filter(i => i.severity === 'critical').length,
          warning: analysis.insights.filter(i => i.severity === 'warning').length,
          info: analysis.insights.filter(i => i.severity === 'info').length
        },
        attentionNeeded: {
          newCritical: analysis.alerts.newCritical.map(c => ({
            customerId: c.customerId,
            customerName: c.customerName,
            currentScore: c.currentScore,
            trend: c.trend.description
          })),
          steepDeclines: analysis.alerts.steepDeclines.map(c => ({
            customerId: c.customerId,
            customerName: c.customerName,
            currentScore: c.currentScore,
            slope: c.trend.slope,
            trend: c.trend.description
          })),
          renewalsAtRisk: analysis.alerts.renewalsAtRisk.map(c => ({
            customerId: c.customerId,
            customerName: c.customerName,
            currentScore: c.currentScore,
            daysToRenewal: c.daysToRenewal,
            category: c.category
          }))
        },
        generatedAt: analysis.generatedAt
      },
      meta: {
        responseTimeMs: responseTime,
        severityFilter: severity || null
      }
    });
  } catch (error) {
    console.error('[HealthTrends] Error fetching alerts:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch health score alerts'
      }
    });
  }
});

/**
 * GET /api/health-trends/forecast
 *
 * Get health score forecasts for portfolio or specific customer.
 *
 * Query Parameters:
 * - customerId (optional): Specific customer ID
 * - periods (optional): Number of periods to forecast (default: 4)
 */
router.get('/forecast', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { customerId, periods = '4' } = req.query;

    if (customerId) {
      // Get specific customer forecast
      const trend = await healthScoreTrendService.getCustomerHealthTrend(
        customerId as string,
        90
      );

      if (!trend) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: `Could not find customer with ID '${customerId}'`
          }
        });
      }

      return res.json({
        success: true,
        data: {
          customerId: trend.customerId,
          customerName: trend.customerName,
          currentScore: trend.currentScore,
          forecast: trend.forecast,
          trend: trend.trend
        },
        meta: {
          responseTimeMs: Date.now() - startTime
        }
      });
    }

    // Get portfolio-level forecast
    const analysis = await healthScoreTrendService.getPortfolioHealthTrendAnalysis({
      days: 90
    });

    // Calculate simple portfolio forecast
    const recentTrend = analysis.portfolioTrend.slice(-6);
    const avgChange = recentTrend.length > 1
      ? (recentTrend[recentTrend.length - 1].avgScore - recentTrend[0].avgScore) / (recentTrend.length - 1)
      : 0;

    const forecasts: Array<{ period: number; predictedAvgScore: number; confidence: string }> = [];
    let currentScore = analysis.overview.avgHealthScore;

    for (let i = 1; i <= parseInt(periods as string); i++) {
      currentScore = Math.max(0, Math.min(100, Math.round(currentScore + avgChange)));
      forecasts.push({
        period: i,
        predictedAvgScore: currentScore,
        confidence: Math.abs(avgChange) < 2 ? 'high' : Math.abs(avgChange) < 5 ? 'medium' : 'low'
      });
    }

    return res.json({
      success: true,
      data: {
        currentAvgScore: analysis.overview.avgHealthScore,
        trendDirection: analysis.overview.trendDirection,
        forecasts,
        methodology: 'Linear extrapolation from 90-day trend'
      },
      meta: {
        responseTimeMs: Date.now() - startTime,
        periodsForecasted: parseInt(periods as string)
      }
    });
  } catch (error) {
    console.error('[HealthTrends] Error generating forecast:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate health score forecast'
      }
    });
  }
});

export default router;
