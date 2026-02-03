/**
 * Mixpanel Integration Routes - PRD-197
 *
 * Handles connection, sync operations, and data retrieval for Mixpanel integration.
 * Implements all endpoints specified in PRD-197.
 */

import { Router, Request, Response } from 'express';
import { mixpanelService, MixpanelConnection, SyncConfig } from '../services/integrations/mixpanel.js';

const router = Router();

// ============================================
// CONNECTION ROUTES
// ============================================

/**
 * POST /api/integrations/mixpanel/connect
 *
 * Connect Mixpanel integration with project credentials (FR-1)
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { userId, projectId, projectSecret, dataResidency = 'US', serviceAccountUsername, serviceAccountSecret } =
      req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!projectId || !projectSecret) {
      return res.status(400).json({ error: 'projectId and projectSecret are required' });
    }

    if (!['US', 'EU'].includes(dataResidency)) {
      return res.status(400).json({ error: 'dataResidency must be US or EU' });
    }

    const connection: MixpanelConnection = {
      projectId,
      projectSecret,
      dataResidency,
      serviceAccountUsername,
      serviceAccountSecret,
    };

    // Test the connection
    const testResult = await mixpanelService.testConnection(connection);

    if (!testResult.success) {
      return res.status(400).json({
        error: 'Connection test failed',
        details: testResult.message,
      });
    }

    // Save the connection
    const connectionId = await mixpanelService.saveConnection(userId, connection);

    res.json({
      success: true,
      connectionId,
      message: 'Mixpanel connected successfully',
      projectId,
      dataResidency,
    });
  } catch (error) {
    console.error('Mixpanel connect error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/integrations/mixpanel/disconnect
 *
 * Disconnect Mixpanel integration
 */
router.delete('/disconnect', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    await mixpanelService.disconnect(userId);

    res.json({
      success: true,
      message: 'Mixpanel disconnected successfully',
    });
  } catch (error) {
    console.error('Mixpanel disconnect error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/integrations/mixpanel/status
 *
 * Get Mixpanel integration status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check if service is configured
    if (!mixpanelService.isConfigured()) {
      return res.json({
        configured: false,
        connected: false,
        message: 'Mixpanel integration not configured. Set MIXPANEL_PROJECT_ID and MIXPANEL_PROJECT_SECRET.',
      });
    }

    // Get sync status
    const status = await mixpanelService.getSyncStatus(userId);

    // Get connection details if connected
    let connectionDetails = null;
    if (status.connected) {
      const connection = await mixpanelService.getConnection(userId);
      if (connection) {
        connectionDetails = {
          projectId: connection.projectId,
          dataResidency: connection.dataResidency,
          hasServiceAccount: Boolean(connection.serviceAccountUsername),
          config: connection.config,
        };
      }
    }

    // Get circuit breaker status
    const circuitBreakerStatus = mixpanelService.getCircuitBreakerStatus();

    res.json({
      configured: true,
      ...status,
      connection: connectionDetails,
      circuitBreaker: circuitBreakerStatus,
    });
  } catch (error) {
    console.error('Mixpanel status error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// SYNC ROUTES
// ============================================

/**
 * POST /api/mixpanel/sync
 *
 * Trigger manual sync (FR-2, FR-3, FR-5)
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { userId, syncType = 'full', customerIds, options } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const connection = await mixpanelService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({
        error: 'Mixpanel not connected. Please connect first.',
      });
    }

    let result;
    switch (syncType) {
      case 'events':
        if (!customerIds || customerIds.length === 0) {
          return res.status(400).json({ error: 'customerIds required for events sync' });
        }
        // Sync events for specific customer
        result = await mixpanelService.fullSync(connection, userId, {
          customerIds,
          syncConfig: { ...connection.config, ...options },
        });
        break;

      case 'funnels':
        if (!customerIds || customerIds.length === 0) {
          return res.status(400).json({ error: 'customerIds required for funnels sync' });
        }
        result = await mixpanelService.fullSync(connection, userId, {
          customerIds,
          syncConfig: { ...connection.config, ...options },
        });
        break;

      case 'full':
      default:
        result = await mixpanelService.fullSync(connection, userId, {
          customerIds,
          syncConfig: { ...connection.config, ...options },
        });
        break;
    }

    res.json({
      success: true,
      syncType,
      result,
    });
  } catch (error) {
    console.error('Mixpanel sync error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/integrations/mixpanel/config
 *
 * Update sync configuration
 */
router.put('/config', async (req: Request, res: Response) => {
  try {
    const { userId, config } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Validate config
    const validSchedules = ['daily', 'weekly', 'manual'];
    if (config.syncSchedule && !validSchedules.includes(config.syncSchedule)) {
      return res.status(400).json({ error: `Invalid syncSchedule: ${config.syncSchedule}` });
    }

    const connection = await mixpanelService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({ error: 'Mixpanel not connected' });
    }

    // Update connection with new config
    await mixpanelService.saveConnection(
      userId,
      {
        projectId: connection.projectId,
        projectSecret: connection.projectSecret,
        dataResidency: connection.dataResidency,
        serviceAccountUsername: connection.serviceAccountUsername,
        serviceAccountSecret: connection.serviceAccountSecret,
      },
      { ...connection.config, ...config }
    );

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      config,
    });
  } catch (error) {
    console.error('Mixpanel config error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/integrations/mixpanel/history
 *
 * Get sync history
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const history = await mixpanelService.getSyncHistory(userId, { limit, offset });

    res.json(history);
  } catch (error) {
    console.error('Mixpanel history error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// DATA RETRIEVAL ROUTES
// ============================================

/**
 * GET /api/mixpanel/events/:customerId
 *
 * Get Mixpanel event metrics for a customer (FR-2)
 */
router.get('/events/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const metrics = await mixpanelService.getCustomerMetrics(customerId, { days });

    // Calculate summary statistics
    const summary = {
      totalEvents: metrics.reduce((sum, m) => sum + m.totalEvents, 0),
      avgDailyEvents: metrics.length > 0 ? Math.round(metrics.reduce((sum, m) => sum + m.totalEvents, 0) / metrics.length) : 0,
      avgUniqueUsers: metrics.length > 0 ? Math.round(metrics.reduce((sum, m) => sum + m.uniqueUsers, 0) / metrics.length) : 0,
      avgEventsPerUser:
        metrics.length > 0
          ? Math.round((metrics.reduce((sum, m) => sum + m.avgEventsPerUser, 0) / metrics.length) * 100) / 100
          : 0,
      topEvents: aggregateTopEvents(metrics),
      dataPoints: metrics.length,
      dateRange: {
        from: metrics.length > 0 ? metrics[0].metricDate : null,
        to: metrics.length > 0 ? metrics[metrics.length - 1].metricDate : null,
      },
    };

    res.json({
      customerId,
      summary,
      metrics,
    });
  } catch (error) {
    console.error('Get Mixpanel events error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/mixpanel/funnels/:customerId
 *
 * Get Mixpanel funnel data for a customer (FR-3)
 */
router.get('/funnels/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const funnels = await mixpanelService.getCustomerFunnels(customerId, { days });

    // Group by funnel and get latest data for each
    const funnelMap = new Map<string, typeof funnels[0]>();
    for (const funnel of funnels) {
      const existing = funnelMap.get(funnel.funnelId);
      if (!existing || funnel.metricDate > existing.metricDate) {
        funnelMap.set(funnel.funnelId, funnel);
      }
    }

    const latestFunnels = Array.from(funnelMap.values());

    // Calculate summary
    const summary = {
      totalFunnels: latestFunnels.length,
      avgConversionRate:
        latestFunnels.length > 0
          ? Math.round((latestFunnels.reduce((sum, f) => sum + f.conversionRate, 0) / latestFunnels.length) * 100) / 100
          : 0,
      bestPerforming: latestFunnels.length > 0 ? latestFunnels.reduce((best, f) => (f.conversionRate > best.conversionRate ? f : best)) : null,
      needsAttention: latestFunnels.filter((f) => f.conversionRate < 20),
    };

    res.json({
      customerId,
      summary,
      funnels: latestFunnels,
      history: funnels, // Full historical data
    });
  } catch (error) {
    console.error('Get Mixpanel funnels error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/mixpanel/users/:customerId
 *
 * Get Mixpanel user aggregates for a customer (FR-4)
 */
router.get('/users/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    // Get latest metrics to derive user data
    const metrics = await mixpanelService.getCustomerMetrics(customerId, { days: 30 });

    if (metrics.length === 0) {
      return res.json({
        customerId,
        users: null,
        message: 'No user data available. Sync Mixpanel data first.',
      });
    }

    // Aggregate user statistics from metrics
    const latestMetric = metrics[metrics.length - 1];
    const weekAgoMetric = metrics.find(
      (m) => m.metricDate >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    const userStats = {
      totalActiveUsers: latestMetric.uniqueUsers,
      avgDailyActiveUsers: Math.round(
        metrics.reduce((sum, m) => sum + m.uniqueUsers, 0) / metrics.length
      ),
      avgEventsPerUser: Math.round(latestMetric.avgEventsPerUser * 100) / 100,
      trend: weekAgoMetric
        ? {
            usersChange: latestMetric.uniqueUsers - weekAgoMetric.uniqueUsers,
            usersChangePercent:
              weekAgoMetric.uniqueUsers > 0
                ? Math.round(
                    ((latestMetric.uniqueUsers - weekAgoMetric.uniqueUsers) /
                      weekAgoMetric.uniqueUsers) *
                      100
                  )
                : 0,
          }
        : null,
      lastUpdated: latestMetric.metricDate,
    };

    res.json({
      customerId,
      users: userStats,
    });
  } catch (error) {
    console.error('Get Mixpanel users error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/mixpanel/engagement/:customerId
 *
 * Get engagement score and health integration (FR-6)
 */
router.get('/engagement/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    // Calculate fresh engagement score
    const engagementScore = await mixpanelService.updateEngagementScore(customerId);

    // Get metrics and funnels for breakdown
    const metrics = await mixpanelService.getCustomerMetrics(customerId, { days: 30 });
    const funnels = await mixpanelService.getCustomerFunnels(customerId, { days: 30 });

    // Calculate component scores
    const avgEvents = metrics.length > 0 ? metrics.reduce((sum, m) => sum + m.totalEvents, 0) / metrics.length : 0;
    const avgUsers = metrics.length > 0 ? metrics.reduce((sum, m) => sum + m.uniqueUsers, 0) / metrics.length : 0;
    const avgSessions = metrics.length > 0 ? metrics.reduce((sum, m) => sum + m.sessions, 0) / metrics.length : 0;
    const avgConversion = funnels.length > 0 ? funnels.reduce((sum, f) => sum + f.conversionRate, 0) / funnels.length : 0;

    const breakdown = {
      eventActivity: {
        score: Math.min(25, Math.floor(avgEvents / 100)),
        maxScore: 25,
        avgEventsPerDay: Math.round(avgEvents),
      },
      userEngagement: {
        score: Math.min(25, Math.floor(avgUsers / 10)),
        maxScore: 25,
        avgUsersPerDay: Math.round(avgUsers),
      },
      sessionDepth: {
        score: Math.min(25, Math.floor(avgSessions / 20)),
        maxScore: 25,
        avgSessionsPerDay: Math.round(avgSessions),
      },
      funnelConversion: {
        score: Math.min(25, Math.floor(avgConversion / 4)),
        maxScore: 25,
        avgConversionRate: Math.round(avgConversion * 100) / 100,
      },
    };

    // Determine health status
    let healthStatus: 'healthy' | 'at_risk' | 'critical' = 'healthy';
    if (engagementScore !== null) {
      if (engagementScore < 30) healthStatus = 'critical';
      else if (engagementScore < 60) healthStatus = 'at_risk';
    }

    res.json({
      customerId,
      engagementScore,
      healthStatus,
      breakdown,
      recommendations: generateRecommendations(breakdown, healthStatus),
      lastCalculated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get engagement score error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Aggregate top events across multiple days
 */
function aggregateTopEvents(
  metrics: Array<{ topEvents: Array<{ name: string; count: number }> }>
): Array<{ name: string; count: number }> {
  const eventCounts: Record<string, number> = {};

  for (const metric of metrics) {
    for (const event of metric.topEvents || []) {
      eventCounts[event.name] = (eventCounts[event.name] || 0) + event.count;
    }
  }

  return Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));
}

/**
 * Generate recommendations based on engagement breakdown
 */
function generateRecommendations(
  breakdown: {
    eventActivity: { score: number; avgEventsPerDay: number };
    userEngagement: { score: number; avgUsersPerDay: number };
    sessionDepth: { score: number; avgSessionsPerDay: number };
    funnelConversion: { score: number; avgConversionRate: number };
  },
  healthStatus: string
): string[] {
  const recommendations: string[] = [];

  if (breakdown.eventActivity.score < 10) {
    recommendations.push('Low event activity detected. Consider scheduling a product adoption review call.');
  }

  if (breakdown.userEngagement.score < 10) {
    recommendations.push('User engagement is declining. Review onboarding completion and feature discovery.');
  }

  if (breakdown.funnelConversion.avgConversionRate < 20) {
    recommendations.push('Funnel conversion rates are below benchmark. Identify drop-off points and address friction.');
  }

  if (healthStatus === 'critical') {
    recommendations.push('URGENT: Customer engagement is critically low. Schedule an executive check-in immediately.');
  } else if (healthStatus === 'at_risk') {
    recommendations.push('Customer shows signs of declining engagement. Proactive outreach recommended.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Engagement metrics are healthy. Continue current success plan.');
  }

  return recommendations;
}

export default router;
