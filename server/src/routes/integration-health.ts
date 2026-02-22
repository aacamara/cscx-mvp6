/**
 * Integration Health Routes
 *
 * PRD-101: Integration Disconnected Alert
 *
 * API endpoints for monitoring and managing integration health status.
 */

import { Router, Request, Response } from 'express';
import {
  integrationHealthService,
  type IntegrationType,
  type IntegrationEventType,
  getTroubleshootingSteps,
  calculateSeverity,
} from '../services/integrations/health.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// HEALTH STATUS ENDPOINTS
// ============================================

/**
 * GET /api/integration-health
 *
 * Get integration health overview/metrics
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const metrics = await integrationHealthService.getHealthMetrics();

    res.json({
      success: true,
      data: {
        metrics,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to get integration health metrics:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/integration-health/disconnected
 *
 * Get all disconnected integrations (for alert dashboard)
 */
router.get('/disconnected', async (req: Request, res: Response) => {
  try {
    const disconnected = await integrationHealthService.getDisconnectedIntegrations();

    res.json({
      success: true,
      data: {
        integrations: disconnected,
        count: disconnected.length,
      },
    });
  } catch (error) {
    console.error('Failed to get disconnected integrations:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/integration-health/customer/:customerId
 *
 * Get integration health for a specific customer
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { type } = req.query;

    const health = await integrationHealthService.getIntegrationHealth(
      customerId,
      type as IntegrationType | undefined
    );

    res.json({
      success: true,
      data: {
        customerId,
        integrations: health,
        count: health.length,
      },
    });
  } catch (error) {
    console.error('Failed to get customer integration health:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/integration-health/customer/:customerId/events
 *
 * Get integration events history for a customer
 */
router.get('/customer/:customerId/events', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const events = await integrationHealthService.getIntegrationEvents(customerId, limit);

    res.json({
      success: true,
      data: {
        customerId,
        events,
        count: events.length,
      },
    });
  } catch (error) {
    console.error('Failed to get integration events:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// EVENT RECORDING ENDPOINTS
// ============================================

/**
 * POST /api/integration-health/event
 *
 * Record an integration event (failure, success, etc.)
 * Called by integration services when events occur.
 */
router.post('/event', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      integrationType,
      integrationId,
      eventType,
      errorDetails,
      metadata,
    } = req.body;

    if (!customerId || !integrationType || !eventType) {
      return res.status(400).json({
        success: false,
        error: 'customerId, integrationType, and eventType are required',
      });
    }

    await integrationHealthService.recordEvent({
      customerId,
      integrationType: integrationType as IntegrationType,
      integrationId,
      eventType: eventType as IntegrationEventType,
      errorDetails,
      metadata,
    });

    res.json({
      success: true,
      message: 'Event recorded successfully',
    });
  } catch (error) {
    console.error('Failed to record integration event:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/integration-health/reconnected
 *
 * Mark an integration as reconnected/resolved
 */
router.post('/reconnected', async (req: Request, res: Response) => {
  try {
    const { customerId, integrationType } = req.body;

    if (!customerId || !integrationType) {
      return res.status(400).json({
        success: false,
        error: 'customerId and integrationType are required',
      });
    }

    await integrationHealthService.recordEvent({
      customerId,
      integrationType: integrationType as IntegrationType,
      eventType: 'reconnected',
    });

    res.json({
      success: true,
      message: 'Integration marked as reconnected',
    });
  } catch (error) {
    console.error('Failed to mark integration as reconnected:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// ALERT ENDPOINTS
// ============================================

/**
 * POST /api/integration-health/alert
 *
 * Send an integration disconnection alert
 */
router.post('/alert', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      customerName,
      customerARR,
      integrationType,
      integrationName,
      status,
      failureReason,
      errorCode,
      isCritical,
      technicalContactEmail,
      technicalContactName,
      csmUserId,
      slackWebhookUrl,
    } = req.body;

    if (!customerId || !customerName || !integrationType || !integrationName || !csmUserId) {
      return res.status(400).json({
        success: false,
        error: 'customerId, customerName, integrationType, integrationName, and csmUserId are required',
      });
    }

    const result = await integrationHealthService.sendDisconnectionAlert({
      customerId,
      customerName,
      customerARR,
      integrationType: integrationType as IntegrationType,
      integrationName,
      status: status || 'disconnected',
      failureReason: failureReason || 'Integration connection failed',
      errorCode,
      isCritical: isCritical || false,
      technicalContactEmail,
      technicalContactName,
      csmUserId,
      slackWebhookUrl,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Failed to send integration alert:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// CONFIGURATION ENDPOINTS
// ============================================

/**
 * PUT /api/integration-health/customer/:customerId/critical
 *
 * Mark an integration as critical or not
 */
router.put('/customer/:customerId/critical', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { integrationType, isCritical } = req.body;

    if (!integrationType || isCritical === undefined) {
      return res.status(400).json({
        success: false,
        error: 'integrationType and isCritical are required',
      });
    }

    await integrationHealthService.setIntegrationCritical(
      customerId,
      integrationType as IntegrationType,
      isCritical
    );

    res.json({
      success: true,
      message: `Integration marked as ${isCritical ? 'critical' : 'non-critical'}`,
    });
  } catch (error) {
    console.error('Failed to update integration criticality:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// TROUBLESHOOTING ENDPOINTS
// ============================================

/**
 * GET /api/integration-health/troubleshoot/:integrationType
 *
 * Get troubleshooting steps for an integration type
 */
router.get('/troubleshoot/:integrationType', async (req: Request, res: Response) => {
  try {
    const { integrationType } = req.params;
    const steps = getTroubleshootingSteps(integrationType as IntegrationType);

    res.json({
      success: true,
      data: {
        integrationType,
        steps,
      },
    });
  } catch (error) {
    console.error('Failed to get troubleshooting steps:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/integration-health/severity
 *
 * Calculate severity for given parameters
 */
router.get('/severity', async (req: Request, res: Response) => {
  try {
    const { isCritical, customerARR, failureCount } = req.query;

    const severity = calculateSeverity(
      isCritical === 'true',
      customerARR ? parseInt(customerARR as string) : undefined,
      failureCount ? parseInt(failureCount as string) : undefined
    );

    res.json({
      success: true,
      data: { severity },
    });
  } catch (error) {
    console.error('Failed to calculate severity:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// CRON/SCHEDULED ENDPOINTS
// ============================================

/**
 * POST /api/integration-health/check
 *
 * Run health check on all integrations (called by cron)
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    const result = await integrationHealthService.runHealthCheck();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Failed to run integration health check:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

export default router;
