/**
 * Product Update Impact Routes
 * PRD-126: Product Update Impact Assessment
 *
 * API endpoints for:
 * - Product update management
 * - Impact assessment
 * - CSM notifications
 * - Communication templates
 * - Adoption tracking
 * - Deprecation management
 */

import { Router, Request, Response } from 'express';
import {
  productUpdateImpactService,
  UpdateType,
  AdoptionStatus
} from '../services/productUpdateImpact.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// Product Update CRUD
// ============================================

/**
 * POST /api/product-updates
 * Create a new product update and trigger impact assessment
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      version,
      updateType,
      description,
      releaseNotes,
      releasedAt,
      effectiveDate,
      deprecationDeadline,
      affectedFeatures,
      prerequisites
    } = req.body;

    // Validate required fields
    if (!name || !version || !updateType || !description) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, version, updateType, description'
        }
      });
    }

    // Validate updateType
    const validTypes: UpdateType[] = ['feature', 'improvement', 'fix', 'deprecation', 'breaking'];
    if (!validTypes.includes(updateType)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid updateType. Must be one of: ${validTypes.join(', ')}`
        }
      });
    }

    const update = await productUpdateImpactService.createProductUpdate({
      name,
      version,
      updateType,
      description,
      releaseNotes: releaseNotes || '',
      releasedAt: releasedAt ? new Date(releasedAt) : new Date(),
      effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
      deprecationDeadline: deprecationDeadline ? new Date(deprecationDeadline) : null,
      affectedFeatures: affectedFeatures || [],
      prerequisites: prerequisites || []
    });

    res.status(201).json({
      success: true,
      data: update,
      message: 'Product update created and impact assessment triggered'
    });
  } catch (error) {
    console.error('Create product update error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create product update'
      }
    });
  }
});

/**
 * GET /api/product-updates
 * List all product updates with optional filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      updateType,
      search,
      limit = '50',
      offset = '0'
    } = req.query;

    const { updates, total } = await productUpdateImpactService.listProductUpdates({
      updateType: updateType as UpdateType | undefined,
      search: search as string | undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10)
    });

    res.json({
      success: true,
      data: {
        updates,
        total,
        hasMore: parseInt(offset as string, 10) + updates.length < total
      }
    });
  } catch (error) {
    console.error('List product updates error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list product updates'
      }
    });
  }
});

/**
 * GET /api/product-updates/:id
 * Get a specific product update
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const update = await productUpdateImpactService.getProductUpdate(id);

    if (!update) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Product update not found: ${id}`
        }
      });
    }

    res.json({
      success: true,
      data: update
    });
  } catch (error) {
    console.error('Get product update error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get product update'
      }
    });
  }
});

// ============================================
// Impact Assessment
// ============================================

/**
 * GET /api/product-updates/:id/impact
 * Get impact assessment for a product update
 */
router.get('/:id/impact', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { impactType, sortBy, sortOrder, search } = req.query;

    const result = await productUpdateImpactService.getUpdateImpact(id);

    if (!result) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Product update not found: ${id}`
        }
      });
    }

    let { impacts } = result;

    // Apply filters
    if (impactType) {
      impacts = impacts.filter(i => i.impactType === impactType);
    }

    if (search) {
      const searchLower = (search as string).toLowerCase();
      impacts = impacts.filter(i =>
        i.customerName.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    if (sortBy) {
      impacts = [...impacts].sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'relevance':
            comparison = a.relevanceScore - b.relevanceScore;
            break;
          case 'name':
            comparison = a.customerName.localeCompare(b.customerName);
            break;
          case 'adoption':
            const adoptionOrder = { 'not_started': 0, 'in_progress': 1, 'completed': 2 };
            comparison = adoptionOrder[a.adoptionStatus] - adoptionOrder[b.adoptionStatus];
            break;
          default:
            comparison = b.relevanceScore - a.relevanceScore;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    // Get templates
    const templates = await productUpdateImpactService.getTemplatesForUpdate(id);

    // Get adoption metrics
    const adoptionData = await productUpdateImpactService.getAdoptionMetrics(id);

    // Get deprecation status if applicable
    const deprecationStatus = await productUpdateImpactService.getDeprecationStatus(id);

    res.json({
      success: true,
      data: {
        update: result.update,
        impactSummary: result.summary,
        customerImpacts: impacts,
        adoptionMetrics: adoptionData.summary,
        deprecationStatus: deprecationStatus?.summary || null,
        communicationTemplates: templates
      }
    });
  } catch (error) {
    console.error('Get update impact error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get impact assessment'
      }
    });
  }
});

/**
 * POST /api/product-updates/:id/assess
 * Trigger/re-run impact assessment for a product update
 */
router.post('/:id/assess', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const update = await productUpdateImpactService.getProductUpdate(id);
    if (!update) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Product update not found: ${id}`
        }
      });
    }

    const impacts = await productUpdateImpactService.runImpactAssessment(id);

    res.json({
      success: true,
      data: {
        updateId: id,
        totalCustomersAssessed: impacts.length,
        assessedAt: new Date().toISOString()
      },
      message: `Impact assessment completed for ${impacts.length} customers`
    });
  } catch (error) {
    console.error('Run impact assessment error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to run impact assessment'
      }
    });
  }
});

// ============================================
// CSM Notifications
// ============================================

/**
 * POST /api/product-updates/:id/notify-csms
 * Notify CSMs about impacted customers
 */
router.post('/:id/notify-csms', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { csmIds, message } = req.body;

    const result = await productUpdateImpactService.notifyCSMs(id, csmIds);

    res.json({
      success: true,
      data: result,
      message: `Notified ${result.notified} CSM(s) about impacted customers`
    });
  } catch (error) {
    console.error('Notify CSMs error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to notify CSMs'
      }
    });
  }
});

// ============================================
// Customer Updates View
// ============================================

/**
 * GET /api/product-updates/customer/:customerId
 * Get all product updates relevant to a specific customer
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const updates = await productUpdateImpactService.getCustomerUpdates(customerId);

    res.json({
      success: true,
      data: {
        customerId,
        updates
      }
    });
  } catch (error) {
    console.error('Get customer updates error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get customer updates'
      }
    });
  }
});

// ============================================
// Communication Templates
// ============================================

/**
 * GET /api/product-updates/:id/templates
 * Get communication templates for a product update
 */
router.get('/:id/templates', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const templates = await productUpdateImpactService.getTemplatesForUpdate(id);

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get communication templates'
      }
    });
  }
});

/**
 * POST /api/product-updates/:id/templates/generate
 * Generate/regenerate communication templates
 */
router.post('/:id/templates/generate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const templates = await productUpdateImpactService.generateCommunicationTemplates(id);

    res.json({
      success: true,
      data: templates,
      message: `Generated ${templates.length} communication templates`
    });
  } catch (error) {
    console.error('Generate templates error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to generate templates'
      }
    });
  }
});

// ============================================
// Adoption Tracking
// ============================================

/**
 * GET /api/product-updates/:id/adoption
 * Get adoption metrics for a product update
 */
router.get('/:id/adoption', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await productUpdateImpactService.getAdoptionMetrics(id);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get adoption metrics error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get adoption metrics'
      }
    });
  }
});

/**
 * PUT /api/product-updates/:id/adoption/:customerId
 * Update adoption status for a customer
 */
router.put('/:id/adoption/:customerId', async (req: Request, res: Response) => {
  try {
    const { id, customerId } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses: AdoptionStatus[] = ['not_started', 'in_progress', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        }
      });
    }

    const impact = await productUpdateImpactService.updateAdoptionStatus(id, customerId, status);

    if (!impact) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Customer impact not found'
        }
      });
    }

    res.json({
      success: true,
      data: impact,
      message: `Adoption status updated to ${status}`
    });
  } catch (error) {
    console.error('Update adoption status error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update adoption status'
      }
    });
  }
});

// ============================================
// Deprecation Management
// ============================================

/**
 * GET /api/product-updates/:id/deprecation
 * Get deprecation/migration status for a product update
 */
router.get('/:id/deprecation', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await productUpdateImpactService.getDeprecationStatus(id);

    if (!result) {
      return res.status(404).json({
        error: {
          code: 'NOT_APPLICABLE',
          message: 'This update does not have deprecation tracking (not a deprecation or breaking change)'
        }
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get deprecation status error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get deprecation status'
      }
    });
  }
});

export default router;
