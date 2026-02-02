import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SupabaseService } from '../services/supabase.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';

const router = Router();
const db = new SupabaseService();

// Validation schemas
const updateEntitlementSchema = z.object({
  sku: z.string().optional(),
  product_name: z.string().optional(),
  quantity: z.number().optional(),
  quantity_unit: z.string().optional(),
  usage_limit: z.number().optional(),
  usage_unit: z.string().optional(),
  support_tier: z.string().optional(),
  sla_response_time: z.string().optional(),
  sla_resolution_time: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  effective_date: z.string().optional(),
  renewal_date: z.string().optional(),
  renewal_terms: z.string().optional(),
  auto_renew: z.boolean().optional(),
  unit_price: z.number().optional(),
  total_price: z.number().optional(),
  currency: z.string().optional(),
  billing_frequency: z.string().optional(),
  special_clauses: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional(),
  notes: z.string().optional()
});

// GET /api/entitlements - List entitlements with filters
router.get('/', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      customer_id,
      contract_id,
      status,
      is_active,
      limit = '20',
      offset = '0'
    } = req.query;

    const result = await db.listEntitlements({
      customerId: customer_id as string,
      contractId: contract_id as string,
      status: status as string,
      isActive: is_active === 'true' ? true : is_active === 'false' ? false : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    // Transform to API response format
    const entitlements = result.entitlements.map(e => ({
      id: e.id,
      contractId: e.contract_id,
      customerId: e.customer_id,
      customerName: (e.customers as Record<string, unknown>)?.name,
      contractFileName: (e.contracts as Record<string, unknown>)?.file_name,
      sku: e.sku,
      productName: e.product_name || e.name,
      quantity: e.quantity,
      quantityUnit: e.quantity_unit || e.unit,
      usageLimit: e.usage_limit,
      usageUnit: e.usage_unit,
      usageCurrent: e.usage_current,
      supportTier: e.support_tier,
      slaResponseTime: e.sla_response_time,
      slaResolutionTime: e.sla_resolution_time,
      startDate: e.start_date,
      endDate: e.end_date,
      effectiveDate: e.effective_date,
      renewalDate: e.renewal_date,
      renewalTerms: e.renewal_terms,
      autoRenew: e.auto_renew,
      unitPrice: e.unit_price,
      totalPrice: e.total_price,
      currency: e.currency,
      billingFrequency: e.billing_frequency,
      confidenceSku: e.confidence_sku,
      confidenceQuantity: e.confidence_quantity,
      confidenceDates: e.confidence_dates,
      confidencePricing: e.confidence_pricing,
      confidenceOverall: e.confidence_overall,
      specialClauses: e.special_clauses,
      exclusions: e.exclusions,
      notes: e.notes,
      sourceSection: e.source_section,
      version: e.version,
      isActive: e.is_active,
      status: e.status,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
      finalizedAt: e.finalized_at,
      finalizedBy: e.finalized_by
    }));

    res.json({
      entitlements,
      total: result.total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('List entitlements error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list entitlements' }
    });
  }
});

// GET /api/entitlements/:id - Get single entitlement
router.get('/:id', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const entitlement = await db.getEntitlement(id);

    if (!entitlement) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Entitlement not found' }
      });
    }

    res.json({
      id: entitlement.id,
      contractId: entitlement.contract_id,
      customerId: entitlement.customer_id,
      customerName: (entitlement.customers as Record<string, unknown>)?.name,
      contract: entitlement.contracts,
      sku: entitlement.sku,
      productName: entitlement.product_name || entitlement.name,
      quantity: entitlement.quantity,
      quantityUnit: entitlement.quantity_unit || entitlement.unit,
      usageLimit: entitlement.usage_limit,
      usageUnit: entitlement.usage_unit,
      usageCurrent: entitlement.usage_current,
      supportTier: entitlement.support_tier,
      slaResponseTime: entitlement.sla_response_time,
      slaResolutionTime: entitlement.sla_resolution_time,
      startDate: entitlement.start_date,
      endDate: entitlement.end_date,
      effectiveDate: entitlement.effective_date,
      renewalDate: entitlement.renewal_date,
      renewalTerms: entitlement.renewal_terms,
      autoRenew: entitlement.auto_renew,
      unitPrice: entitlement.unit_price,
      totalPrice: entitlement.total_price,
      currency: entitlement.currency,
      billingFrequency: entitlement.billing_frequency,
      confidenceSku: entitlement.confidence_sku,
      confidenceQuantity: entitlement.confidence_quantity,
      confidenceDates: entitlement.confidence_dates,
      confidencePricing: entitlement.confidence_pricing,
      confidenceOverall: entitlement.confidence_overall,
      specialClauses: entitlement.special_clauses,
      exclusions: entitlement.exclusions,
      notes: entitlement.notes,
      sourceSection: entitlement.source_section,
      version: entitlement.version,
      isActive: entitlement.is_active,
      status: entitlement.status,
      createdAt: entitlement.created_at,
      updatedAt: entitlement.updated_at,
      finalizedAt: entitlement.finalized_at,
      finalizedBy: entitlement.finalized_by
    });
  } catch (error) {
    console.error('Get entitlement error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get entitlement' }
    });
  }
});

// PATCH /api/entitlements/:id - Update entitlement (HITL review)
router.patch('/:id', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Validate request body
    const validationResult = updateEntitlementSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: validationResult.error.errors
        }
      });
    }

    // Get current entitlement for edit history
    const current = await db.getEntitlement(id);
    if (!current) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Entitlement not found' }
      });
    }

    const updates = validationResult.data;
    const updatedFields: string[] = [];

    // Record edit history for each changed field
    for (const [key, newValue] of Object.entries(updates)) {
      const oldValue = current[key];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        updatedFields.push(key);
        await db.saveEntitlementEdit({
          entitlement_id: id,
          field_name: key,
          old_value: oldValue !== undefined ? String(oldValue) : null,
          new_value: newValue !== undefined ? String(newValue) : null,
          edited_by: userId
        });
      }
    }

    // Set status to pending_review after edits
    const finalUpdates = {
      ...updates,
      status: 'pending_review'
    };

    await db.updateEntitlement(id, finalUpdates);

    res.json({
      id,
      updated_fields: updatedFields,
      status: 'pending_review'
    });
  } catch (error) {
    console.error('Update entitlement error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update entitlement' }
    });
  }
});

// POST /api/entitlements/:id/finalize - Finalize entitlement
router.post('/:id/finalize', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Finalize the entitlement
    const result = await db.finalizeEntitlement(id, userId);

    res.json({
      id: result.id,
      version: result.version,
      status: result.status,
      is_active: result.is_active,
      finalized_at: result.finalized_at
    });
  } catch (error) {
    console.error('Finalize entitlement error:', error);
    if (error instanceof Error && error.message === 'Entitlement not found') {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Entitlement not found' }
      });
    }
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to finalize entitlement' }
    });
  }
});

// GET /api/entitlements/:id/history - Get version history with edit trail
router.get('/:id/history', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const history = await db.getEntitlementVersionHistory(id);

    if (!history.entitlement) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Entitlement not found' }
      });
    }

    res.json({
      entitlement: {
        id: history.entitlement.id,
        version: history.entitlement.version,
        status: history.entitlement.status,
        isActive: history.entitlement.is_active,
        createdAt: history.entitlement.created_at,
        updatedAt: history.entitlement.updated_at,
        finalizedAt: history.entitlement.finalized_at
      },
      edits: history.edits.map(e => ({
        id: e.id,
        fieldName: e.field_name,
        oldValue: e.old_value,
        newValue: e.new_value,
        editedBy: e.edited_by,
        editedAt: e.edited_at
      }))
    });
  } catch (error) {
    console.error('Get entitlement history error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get entitlement history' }
    });
  }
});

export { router as entitlementRoutes };
