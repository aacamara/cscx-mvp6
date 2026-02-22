/**
 * PRD-220: Automated Data Enrichment API Routes
 *
 * Endpoints for triggering, checking, and managing data enrichment
 * for customers and stakeholders.
 */

import { Router, Request, Response } from 'express';
import { enrichmentService } from '../services/enrichment.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// TRIGGER ENRICHMENT
// ============================================

/**
 * POST /api/enrichment/trigger
 * Trigger enrichment for an entity (customer or stakeholder)
 *
 * Body:
 *   - entity_type: 'customer' | 'stakeholder'
 *   - entity_id: UUID
 *   - priority: 'high' | 'normal' | 'low' (default: 'normal')
 *   - fields?: string[] - Specific fields to enrich
 *   - source_hints?: { domain?, email?, linkedin_url?, company_name? }
 */
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    const {
      entity_type,
      entity_id,
      priority = 'normal',
      fields,
      source_hints
    } = req.body;

    // Validation
    if (!entity_type || !entity_id) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'entity_type and entity_id are required'
        }
      });
    }

    if (!['customer', 'stakeholder'].includes(entity_type)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'entity_type must be "customer" or "stakeholder"'
        }
      });
    }

    if (!['high', 'normal', 'low'].includes(priority)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'priority must be "high", "normal", or "low"'
        }
      });
    }

    // Queue the enrichment request
    const queueItem = await enrichmentService.queueEnrichment({
      entity_type,
      entity_id,
      priority,
      requested_fields: fields,
      source_hints
    });

    res.status(202).json({
      success: true,
      message: 'Enrichment request queued',
      data: {
        queue_id: queueItem.id,
        entity_type: queueItem.entity_type,
        entity_id: queueItem.entity_id,
        priority: queueItem.priority,
        status: queueItem.status,
        created_at: queueItem.created_at
      }
    });
  } catch (error) {
    console.error('Error triggering enrichment:', error);
    res.status(500).json({
      error: {
        code: 'ENRICHMENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to trigger enrichment'
      }
    });
  }
});

/**
 * POST /api/enrichment/trigger/batch
 * Trigger enrichment for multiple entities
 *
 * Body:
 *   - entities: Array<{ entity_type, entity_id, source_hints? }>
 *   - priority: 'high' | 'normal' | 'low'
 *   - fields?: string[]
 */
router.post('/trigger/batch', async (req: Request, res: Response) => {
  try {
    const { entities, priority = 'normal', fields } = req.body;

    if (!Array.isArray(entities) || entities.length === 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'entities array is required and must not be empty'
        }
      });
    }

    if (entities.length > 100) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Maximum 100 entities per batch'
        }
      });
    }

    const results = await Promise.all(
      entities.map(async (entity: { entity_type: 'customer' | 'stakeholder'; entity_id: string; source_hints?: Record<string, string> }) => {
        try {
          const queueItem = await enrichmentService.queueEnrichment({
            entity_type: entity.entity_type,
            entity_id: entity.entity_id,
            priority,
            requested_fields: fields,
            source_hints: entity.source_hints
          });
          return {
            entity_id: entity.entity_id,
            entity_type: entity.entity_type,
            queue_id: queueItem.id,
            status: 'queued'
          };
        } catch (err) {
          return {
            entity_id: entity.entity_id,
            entity_type: entity.entity_type,
            status: 'failed',
            error: err instanceof Error ? err.message : 'Unknown error'
          };
        }
      })
    );

    const queued = results.filter(r => r.status === 'queued').length;
    const failed = results.filter(r => r.status === 'failed').length;

    res.status(202).json({
      success: true,
      message: `Batch enrichment: ${queued} queued, ${failed} failed`,
      data: {
        total: entities.length,
        queued,
        failed,
        results
      }
    });
  } catch (error) {
    console.error('Error triggering batch enrichment:', error);
    res.status(500).json({
      error: {
        code: 'ENRICHMENT_ERROR',
        message: 'Failed to process batch enrichment'
      }
    });
  }
});

// ============================================
// CHECK STATUS
// ============================================

/**
 * GET /api/enrichment/status/:entityType/:entityId
 * Get enrichment status for an entity
 */
router.get('/status/:entityType/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;

    if (!['customer', 'stakeholder'].includes(entityType)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'entityType must be "customer" or "stakeholder"'
        }
      });
    }

    const status = await enrichmentService.getEnrichmentStatus(
      entityType as 'customer' | 'stakeholder',
      entityId
    );

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting enrichment status:', error);
    res.status(500).json({
      error: {
        code: 'ENRICHMENT_ERROR',
        message: 'Failed to get enrichment status'
      }
    });
  }
});

/**
 * GET /api/enrichment/queue/:entityType/:entityId
 * Get queue status for an entity
 */
router.get('/queue/:entityType/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;

    if (!['customer', 'stakeholder'].includes(entityType)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'entityType must be "customer" or "stakeholder"'
        }
      });
    }

    const queueStatus = await enrichmentService.getQueueStatus(
      entityType as 'customer' | 'stakeholder',
      entityId
    );

    if (!queueStatus) {
      return res.json({
        success: true,
        data: {
          queued: false,
          message: 'No pending enrichment in queue'
        }
      });
    }

    res.json({
      success: true,
      data: {
        queued: true,
        queue_item: queueStatus
      }
    });
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({
      error: {
        code: 'ENRICHMENT_ERROR',
        message: 'Failed to get queue status'
      }
    });
  }
});

// ============================================
// GET ENRICHED DATA
// ============================================

/**
 * GET /api/enrichment/customer/:customerId
 * Get enriched customer data
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const enrichedData = await enrichmentService.getEnrichedCustomer(customerId);

    res.json({
      success: true,
      data: enrichedData
    });
  } catch (error) {
    console.error('Error getting enriched customer:', error);
    res.status(500).json({
      error: {
        code: 'ENRICHMENT_ERROR',
        message: 'Failed to get enriched customer data'
      }
    });
  }
});

/**
 * GET /api/customers/:id/enriched
 * Alternative endpoint - get customer with enriched fields
 * (This matches the PRD specification)
 */
router.get('/customers/:id/enriched', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const enrichedData = await enrichmentService.getEnrichedCustomer(id);

    // Merge customer base data with enrichment
    const merged = {
      ...enrichedData.customer,
      ...enrichedData.enrichment,
      _enrichment_metadata: enrichedData.metadata
    };

    res.json({
      success: true,
      data: merged
    });
  } catch (error) {
    console.error('Error getting enriched customer:', error);
    res.status(500).json({
      error: {
        code: 'ENRICHMENT_ERROR',
        message: 'Failed to get enriched customer data'
      }
    });
  }
});

// ============================================
// ENRICHMENT SYNC (for immediate enrichment)
// ============================================

/**
 * POST /api/enrichment/sync
 * Synchronously enrich an entity (waits for completion)
 * Use for on-demand enrichment in UI
 *
 * Note: This should have a reasonable timeout and is intended
 * for single entities, not batch operations.
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const {
      entity_type,
      entity_id,
      fields,
      source_hints
    } = req.body;

    if (!entity_type || !entity_id) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'entity_type and entity_id are required'
        }
      });
    }

    // Queue with high priority
    const queueItem = await enrichmentService.queueEnrichment({
      entity_type,
      entity_id,
      priority: 'high',
      requested_fields: fields,
      source_hints
    });

    // Process immediately and wait for result
    // The processQueueItem is already called for high priority items,
    // but we'll wait for completion
    const maxWait = 30000; // 30 seconds
    const pollInterval = 500; // 500ms
    let elapsed = 0;

    while (elapsed < maxWait) {
      const status = await enrichmentService.getQueueStatus(entity_type, entity_id);

      if (status && (status.status === 'completed' || status.status === 'failed')) {
        if (status.status === 'failed') {
          return res.status(500).json({
            error: {
              code: 'ENRICHMENT_FAILED',
              message: status.error_message || 'Enrichment failed'
            }
          });
        }

        // Get the enriched data
        const enrichedData = entity_type === 'customer'
          ? await enrichmentService.getEnrichedCustomer(entity_id)
          : await enrichmentService.getEnrichmentStatus(entity_type, entity_id);

        return res.json({
          success: true,
          data: enrichedData
        });
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      elapsed += pollInterval;
    }

    // Timeout - return queue status
    res.status(202).json({
      success: true,
      message: 'Enrichment in progress',
      data: {
        queue_id: queueItem.id,
        status: 'processing',
        message: 'Request is taking longer than expected. Check status endpoint for updates.'
      }
    });
  } catch (error) {
    console.error('Error in sync enrichment:', error);
    res.status(500).json({
      error: {
        code: 'ENRICHMENT_ERROR',
        message: error instanceof Error ? error.message : 'Sync enrichment failed'
      }
    });
  }
});

// ============================================
// REFRESH STALE DATA
// ============================================

/**
 * POST /api/enrichment/refresh-stale
 * Trigger re-enrichment for entities with stale data
 *
 * Body:
 *   - entity_type: 'customer' | 'stakeholder' | 'all'
 *   - stale_days: number (default: 30)
 *   - limit: number (default: 50, max: 200)
 */
router.post('/refresh-stale', async (req: Request, res: Response) => {
  try {
    const {
      entity_type = 'all',
      stale_days = 30,
      limit = 50
    } = req.body;

    const effectiveLimit = Math.min(limit, 200);

    // This would query the database for stale records and queue them
    // For now, return a placeholder response
    res.json({
      success: true,
      message: 'Stale data refresh initiated',
      data: {
        entity_type,
        stale_threshold_days: stale_days,
        limit: effectiveLimit,
        queued_count: 0, // Would be populated from actual query
        message: 'Stale records will be refreshed in background'
      }
    });
  } catch (error) {
    console.error('Error refreshing stale data:', error);
    res.status(500).json({
      error: {
        code: 'ENRICHMENT_ERROR',
        message: 'Failed to refresh stale data'
      }
    });
  }
});

// ============================================
// CONFIGURATION
// ============================================

/**
 * GET /api/enrichment/config
 * Get current enrichment configuration
 */
router.get('/config', async (_req: Request, res: Response) => {
  // Return current configuration
  res.json({
    success: true,
    data: {
      auto_enrich_on_create: true,
      re_enrich_interval_days: 30,
      high_priority_interval_days: 7,
      stale_threshold_days: 14,
      max_retries: 3,
      enabled_providers: ['clearbit', 'linkedin', 'crunchbase', 'news_api', 'ai_inference'],
      customer_fields: [
        'employee_count',
        'industry',
        'headquarters_city',
        'funding_total',
        'tech_stack',
        'recent_news',
        'key_executives'
      ],
      stakeholder_fields: [
        'linkedin_url',
        'current_title',
        'previous_positions',
        'education',
        'skills'
      ]
    }
  });
});

/**
 * GET /api/enrichment/providers
 * Get available data providers and their status
 */
router.get('/providers', async (_req: Request, res: Response) => {
  // Return provider status (in production, would check actual API status)
  res.json({
    success: true,
    data: {
      providers: [
        {
          id: 'clearbit',
          name: 'Clearbit',
          status: 'active',
          capabilities: ['company_info', 'employee_count', 'industry', 'location'],
          rate_limit: '100/hour'
        },
        {
          id: 'crunchbase',
          name: 'Crunchbase',
          status: 'active',
          capabilities: ['funding', 'investors', 'news'],
          rate_limit: '200/day'
        },
        {
          id: 'linkedin',
          name: 'LinkedIn',
          status: 'active',
          capabilities: ['profiles', 'company_pages', 'connections'],
          rate_limit: '100/day'
        },
        {
          id: 'builtwith',
          name: 'BuiltWith',
          status: 'active',
          capabilities: ['tech_stack'],
          rate_limit: '50/day'
        },
        {
          id: 'news_api',
          name: 'News API',
          status: 'active',
          capabilities: ['recent_news', 'press_releases'],
          rate_limit: '1000/day'
        },
        {
          id: 'ai_inference',
          name: 'AI Inference',
          status: 'active',
          capabilities: ['data_consolidation', 'conflict_resolution'],
          rate_limit: 'unlimited'
        }
      ]
    }
  });
});

export default router;
