/**
 * PRD-090: Feature Adoption API Routes
 *
 * Endpoints for feature adoption tracking, stall detection, and enablement workflows.
 */

import { Router, Request, Response } from 'express';
import {
  featureAdoptionService,
  detectAdoptionStallForCustomer,
  detectAdoptionStallForAllCustomers,
  sendAdoptionStallSlackAlert,
} from '../services/adoption/index.js';
import type { DetectionConfig, InterventionType, TrainingResource } from '../services/adoption/types.js';

const router = Router();

// ============================================
// Feature Catalog Endpoints
// ============================================

/**
 * GET /api/feature-adoption/features
 * Get all features in the catalog
 */
router.get('/features', async (req: Request, res: Response) => {
  try {
    const features = await featureAdoptionService.getAllFeatures();

    res.json({
      success: true,
      features,
      count: features.length,
    });
  } catch (error) {
    console.error('Get features error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to get features',
    });
  }
});

/**
 * GET /api/feature-adoption/features/:featureId
 * Get a specific feature by ID
 */
router.get('/features/:featureId', async (req: Request, res: Response) => {
  try {
    const { featureId } = req.params;

    const feature = await featureAdoptionService.getFeature(featureId);

    if (!feature) {
      return res.status(404).json({
        error: 'Feature not found',
      });
    }

    res.json({
      success: true,
      feature,
    });
  } catch (error) {
    console.error('Get feature error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to get feature',
    });
  }
});

/**
 * GET /api/feature-adoption/features/:featureId/resources
 * Get enablement resources for a feature
 */
router.get('/features/:featureId/resources', async (req: Request, res: Response) => {
  try {
    const { featureId } = req.params;

    const resources = await featureAdoptionService.getFeatureResources(featureId);

    if (!resources) {
      return res.status(404).json({
        error: 'Feature not found',
      });
    }

    res.json({
      success: true,
      feature: resources.feature,
      resources: resources.resources,
      suggestedOutreach: resources.suggestedOutreach,
    });
  } catch (error) {
    console.error('Get feature resources error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to get feature resources',
    });
  }
});

// ============================================
// Customer Adoption Endpoints
// ============================================

/**
 * GET /api/feature-adoption/customers/:customerId
 * Get feature adoption status for a customer
 */
router.get('/customers/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const status = await featureAdoptionService.getCustomerAdoptionStatus(customerId);

    if (!status) {
      return res.status(404).json({
        error: 'Customer adoption status not found',
      });
    }

    res.json({
      success: true,
      customerId,
      ...status,
    });
  } catch (error) {
    console.error('Get customer adoption error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to get customer adoption status',
    });
  }
});

/**
 * POST /api/feature-adoption/customers/:customerId/initialize
 * Initialize feature adoption tracking for a customer
 */
router.post('/customers/:customerId/initialize', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { featureIds } = req.body as { featureIds?: string[] };

    if (!featureIds || !Array.isArray(featureIds) || featureIds.length === 0) {
      return res.status(400).json({
        error: 'featureIds array is required',
      });
    }

    const success = await featureAdoptionService.initializeCustomerAdoption(customerId, featureIds);

    if (!success) {
      return res.status(500).json({
        error: 'Failed to initialize customer adoption',
      });
    }

    res.json({
      success: true,
      customerId,
      featuresInitialized: featureIds.length,
    });
  } catch (error) {
    console.error('Initialize adoption error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to initialize adoption',
    });
  }
});

/**
 * POST /api/feature-adoption/sync
 * Bulk update feature adoption from usage events
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { customerId, usageEvents } = req.body as {
      customerId: string;
      usageEvents?: Array<{ featureId: string; count: number }>;
    };

    if (!customerId) {
      return res.status(400).json({
        error: 'customerId is required',
      });
    }

    if (usageEvents && usageEvents.length > 0) {
      const success = await featureAdoptionService.syncFeatureAdoption(customerId, usageEvents);

      res.json({
        success,
        customerId,
        eventsProcessed: usageEvents.length,
      });
    } else {
      res.json({
        success: true,
        customerId,
        eventsProcessed: 0,
        message: 'No usage events provided',
      });
    }
  } catch (error) {
    console.error('Sync adoption error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to sync adoption',
    });
  }
});

/**
 * POST /api/feature-adoption/usage
 * Update feature usage from a single event
 */
router.post('/usage', async (req: Request, res: Response) => {
  try {
    const { customerId, featureId, usageCount = 1 } = req.body as {
      customerId: string;
      featureId: string;
      usageCount?: number;
    };

    if (!customerId || !featureId) {
      return res.status(400).json({
        error: 'customerId and featureId are required',
      });
    }

    const adoption = await featureAdoptionService.updateFeatureUsage(customerId, featureId, usageCount);

    if (!adoption) {
      return res.status(500).json({
        error: 'Failed to update feature usage',
      });
    }

    res.json({
      success: true,
      adoption,
    });
  } catch (error) {
    console.error('Update usage error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to update feature usage',
    });
  }
});

// ============================================
// Stall Detection Endpoints
// ============================================

/**
 * POST /api/feature-adoption/detect-stalls
 * Detect adoption stalls for a specific customer
 */
router.post('/detect-stalls', async (req: Request, res: Response) => {
  try {
    const { customerId, config: detectionConfig } = req.body as {
      customerId: string;
      config?: DetectionConfig;
    };

    if (!customerId) {
      return res.status(400).json({
        error: 'customerId is required',
      });
    }

    const result = await detectAdoptionStallForCustomer(customerId, detectionConfig);

    res.json({
      success: !result.skipped,
      customerId: result.customerId,
      customerName: result.customerName,
      alertsCount: result.alerts.length,
      alerts: result.alerts,
      skipped: result.skipped,
      skipReason: result.skipReason,
    });
  } catch (error) {
    console.error('Detect stalls error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to detect adoption stalls',
    });
  }
});

/**
 * POST /api/feature-adoption/detect-stalls-all
 * Run adoption stall detection for all active customers
 */
router.post('/detect-stalls-all', async (req: Request, res: Response) => {
  try {
    const { config: detectionConfig } = req.body as {
      config?: DetectionConfig;
    };

    const result = await detectAdoptionStallForAllCustomers(detectionConfig);

    res.json({
      success: true,
      processed: result.processed,
      alertsGenerated: result.alertsGenerated,
      results: result.results.map(r => ({
        customerId: r.customerId,
        customerName: r.customerName,
        alertsCount: r.alerts.length,
        skipped: r.skipped,
        skipReason: r.skipReason,
      })),
    });
  } catch (error) {
    console.error('Detect stalls all error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to detect adoption stalls',
    });
  }
});

// ============================================
// Intervention Endpoints
// ============================================

/**
 * POST /api/feature-adoption/:id/intervention
 * Record an enablement intervention
 */
router.post('/:id/intervention', async (req: Request, res: Response) => {
  try {
    const { id: adoptionId } = req.params;
    const { interventionType, details, resourcesShared, sentBy } = req.body as {
      interventionType: InterventionType;
      details?: string;
      resourcesShared?: TrainingResource[];
      sentBy?: string;
    };

    if (!interventionType) {
      return res.status(400).json({
        error: 'interventionType is required',
      });
    }

    const validTypes: InterventionType[] = ['email', 'call', 'training', 'resource_share', 'in_app_tip'];
    if (!validTypes.includes(interventionType)) {
      return res.status(400).json({
        error: `interventionType must be one of: ${validTypes.join(', ')}`,
      });
    }

    const intervention = await featureAdoptionService.recordIntervention(adoptionId, {
      interventionType,
      details,
      resourcesShared,
      sentBy,
    });

    if (!intervention) {
      return res.status(404).json({
        error: 'Feature adoption record not found',
      });
    }

    res.json({
      success: true,
      intervention,
    });
  } catch (error) {
    console.error('Record intervention error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to record intervention',
    });
  }
});

/**
 * GET /api/feature-adoption/interventions/:customerId
 * Get intervention history for a customer
 */
router.get('/interventions/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { featureId } = req.query;

    const interventions = await featureAdoptionService.getInterventionHistory(
      customerId,
      featureId as string | undefined
    );

    res.json({
      success: true,
      customerId,
      featureId: featureId || null,
      interventions,
      count: interventions.length,
    });
  } catch (error) {
    console.error('Get interventions error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to get interventions',
    });
  }
});

// ============================================
// Analytics Endpoints
// ============================================

/**
 * GET /api/feature-adoption/analytics
 * Get aggregated feature adoption analytics
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const analytics = await featureAdoptionService.getFeatureAdoptionAnalytics();

    res.json({
      success: true,
      ...analytics,
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to get adoption analytics',
    });
  }
});

// ============================================
// Slack Alert Endpoint
// ============================================

/**
 * POST /api/feature-adoption/alerts/:alertId/slack
 * Send adoption stall alert to Slack
 */
router.post('/alerts/:alertId/slack', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { webhookUrl, csmName, customerArr, customerHealthScore, alert } = req.body as {
      webhookUrl: string;
      csmName?: string;
      customerArr?: number;
      customerHealthScore?: number;
      alert: any; // AdoptionStallAlert serialized
    };

    if (!webhookUrl) {
      return res.status(400).json({
        error: 'webhookUrl is required',
      });
    }

    if (!alert) {
      return res.status(400).json({
        error: 'alert data is required',
      });
    }

    // Reconstruct dates
    const reconstructedAlert = {
      ...alert,
      detectedAt: new Date(alert.detectedAt),
      cooldownExpiresAt: new Date(alert.cooldownExpiresAt),
    };

    const success = await sendAdoptionStallSlackAlert(
      reconstructedAlert,
      webhookUrl,
      csmName,
      customerArr,
      customerHealthScore
    );

    res.json({
      success,
      alertId,
    });
  } catch (error) {
    console.error('Send Slack alert error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to send Slack alert',
    });
  }
});

export default router;
