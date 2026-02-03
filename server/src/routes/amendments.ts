/**
 * Amendment Routes (PRD-042: Contract Amendment Request)
 *
 * API endpoints for contract amendment management.
 *
 * Endpoints:
 * - POST   /api/amendments                           - Create new amendment
 * - GET    /api/amendments                           - List amendments with filters
 * - GET    /api/amendments/summary                   - Get amendment summary stats
 * - GET    /api/amendments/:id                       - Get amendment by ID
 * - PATCH  /api/amendments/:id/status                - Update amendment status
 * - GET    /api/amendments/:id/history               - Get amendment history
 * - POST   /api/amendments/:id/email                 - Generate amendment email
 * - POST   /api/amendments/:id/send                  - Send amendment email
 * - POST   /api/amendments/:id/confirmation-email    - Generate confirmation email
 * - POST   /api/customers/:id/amendment-request      - Create amendment request for customer
 * - GET    /api/customers/:id/amendments             - Get customer's amendments
 * - POST   /api/amendments/calculate-impact          - Calculate financial impact
 */

import { Router, Request, Response } from 'express';
import {
  amendmentGenerator,
  type AmendmentType,
  type AmendmentStatus,
  type CreateAmendmentInput,
  type AmendmentEmailInput,
  type AmendmentFilters,
} from '../services/contracts/amendmentGenerator.js';

const router = Router();

// ============================================
// Amendment CRUD Endpoints
// ============================================

/**
 * POST /api/amendments
 *
 * Create a new contract amendment.
 */
router.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const {
      customerId,
      contractId,
      amendmentType,
      description,
      reason,
      proposedSeats,
      proposedFeatures,
      proposedTermEnd,
      internalNotes,
      requestedById,
      requestedByName,
    } = req.body;

    // Validation
    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CUSTOMER_ID', message: 'customerId is required' },
      });
    }

    if (!amendmentType) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_AMENDMENT_TYPE', message: 'amendmentType is required' },
      });
    }

    const input: CreateAmendmentInput = {
      customerId,
      contractId,
      amendmentType: amendmentType as AmendmentType,
      description,
      reason,
      proposedSeats,
      proposedFeatures,
      proposedTermEnd,
      internalNotes,
      requestedById,
      requestedByName,
    };

    const amendment = await amendmentGenerator.createAmendment(input);

    const responseTime = Date.now() - startTime;
    console.log(`[Amendments] Created amendment ${amendment.id} in ${responseTime}ms`);

    return res.status(201).json({
      success: true,
      data: amendment,
      meta: {
        createdAt: new Date().toISOString(),
        responseTimeMs: responseTime,
      },
    });
  } catch (error) {
    console.error('[Amendments] Create error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create amendment',
      },
    });
  }
});

/**
 * GET /api/amendments
 *
 * List amendments with filters.
 */
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const filters: AmendmentFilters = {
      customerId: req.query.customerId as string,
      contractId: req.query.contractId as string,
      status: req.query.status as AmendmentStatus,
      amendmentType: req.query.amendmentType as AmendmentType,
      csmId: req.query.csmId as string,
      fromDate: req.query.fromDate as string,
      toDate: req.query.toDate as string,
      search: req.query.search as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const result = await amendmentGenerator.listAmendments(filters);

    const responseTime = Date.now() - startTime;

    return res.json({
      success: true,
      data: result.amendments,
      meta: {
        total: result.total,
        limit: filters.limit,
        offset: filters.offset,
        responseTimeMs: responseTime,
      },
    });
  } catch (error) {
    console.error('[Amendments] List error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'LIST_FAILED',
        message: error instanceof Error ? error.message : 'Failed to list amendments',
      },
    });
  }
});

/**
 * GET /api/amendments/summary
 *
 * Get amendment summary statistics.
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const customerId = req.query.customerId as string;
    const summary = await amendmentGenerator.getSummary(customerId);

    return res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('[Amendments] Summary error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'SUMMARY_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get summary',
      },
    });
  }
});

/**
 * GET /api/amendments/:id
 *
 * Get amendment by ID.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const amendment = await amendmentGenerator.getAmendment(id);

    if (!amendment) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Amendment not found' },
      });
    }

    return res.json({
      success: true,
      data: amendment,
    });
  } catch (error) {
    console.error('[Amendments] Get error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'GET_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get amendment',
      },
    });
  }
});

/**
 * PATCH /api/amendments/:id/status
 *
 * Update amendment status.
 */
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, actorId, actorName, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_STATUS', message: 'status is required' },
      });
    }

    const amendment = await amendmentGenerator.updateStatus(
      id,
      status as AmendmentStatus,
      actorId,
      actorName,
      notes
    );

    console.log(`[Amendments] Updated ${id} status to ${status}`);

    return res.json({
      success: true,
      data: amendment,
    });
  } catch (error) {
    console.error('[Amendments] Status update error:', error);

    const message = error instanceof Error ? error.message : 'Failed to update status';
    const isValidationError = message.includes('Invalid status transition');

    return res.status(isValidationError ? 400 : 500).json({
      success: false,
      error: {
        code: isValidationError ? 'INVALID_TRANSITION' : 'UPDATE_FAILED',
        message,
      },
    });
  }
});

/**
 * GET /api/amendments/:id/history
 *
 * Get amendment history.
 */
router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const history = await amendmentGenerator.getHistory(id);

    return res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('[Amendments] History error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'HISTORY_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get history',
      },
    });
  }
});

// ============================================
// Email Generation Endpoints
// ============================================

/**
 * POST /api/amendments/:id/email
 *
 * Generate amendment request email (preview).
 */
router.post('/:id/email', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      contactName,
      contactEmail,
      ccEmails,
      customMessage,
      includeLegalCc,
      includeSalesCc,
    } = req.body;

    if (!contactName || !contactEmail) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CONTACT', message: 'contactName and contactEmail are required' },
      });
    }

    const input: AmendmentEmailInput = {
      amendmentId: id,
      contactName,
      contactEmail,
      ccEmails,
      customMessage,
      includeLegalCc,
      includeSalesCc,
    };

    const email = await amendmentGenerator.generateEmail(input);

    return res.json({
      success: true,
      data: email,
    });
  } catch (error) {
    console.error('[Amendments] Email generation error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'EMAIL_GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to generate email',
      },
    });
  }
});

/**
 * POST /api/amendments/:id/send
 *
 * Mark amendment email as sent and update status.
 */
router.post('/:id/send', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { to, cc, subject, body } = req.body;

    if (!to || !Array.isArray(to) || to.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_RECIPIENTS', message: 'to array is required' },
      });
    }

    if (!subject || !body) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CONTENT', message: 'subject and body are required' },
      });
    }

    const amendment = await amendmentGenerator.markEmailSent(id, to, cc || [], subject, body);

    console.log(`[Amendments] Marked email sent for ${id}`);

    return res.json({
      success: true,
      data: amendment,
      message: 'Amendment request email marked as sent',
    });
  } catch (error) {
    console.error('[Amendments] Send error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'SEND_FAILED',
        message: error instanceof Error ? error.message : 'Failed to mark email sent',
      },
    });
  }
});

/**
 * POST /api/amendments/:id/confirmation-email
 *
 * Generate confirmation email after amendment execution.
 */
router.post('/:id/confirmation-email', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { contactName } = req.body;

    if (!contactName) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CONTACT_NAME', message: 'contactName is required' },
      });
    }

    const email = await amendmentGenerator.generateConfirmationEmail(id, contactName);

    return res.json({
      success: true,
      data: email,
    });
  } catch (error) {
    console.error('[Amendments] Confirmation email error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'CONFIRMATION_EMAIL_FAILED',
        message: error instanceof Error ? error.message : 'Failed to generate confirmation email',
      },
    });
  }
});

// ============================================
// Financial Impact Calculation
// ============================================

/**
 * POST /api/amendments/calculate-impact
 *
 * Calculate financial impact of a proposed amendment.
 */
router.post('/calculate-impact', async (req: Request, res: Response) => {
  try {
    const { customerId, proposedSeats, proposedFeatures, proposedTermEnd } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CUSTOMER_ID', message: 'customerId is required' },
      });
    }

    const impact = await amendmentGenerator.calculateFinancialImpact(
      customerId,
      proposedSeats,
      proposedFeatures,
      proposedTermEnd
    );

    return res.json({
      success: true,
      data: impact,
    });
  } catch (error) {
    console.error('[Amendments] Calculate impact error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'CALCULATION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to calculate impact',
      },
    });
  }
});

// ============================================
// Customer-Scoped Endpoints
// ============================================

/**
 * POST /api/customers/:id/amendment-request
 *
 * Create an amendment request for a specific customer.
 * This is a convenience endpoint that combines impact calculation and creation.
 */
router.post('/customers/:id/amendment-request', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const customerId = req.params.id;
    const {
      amendmentType,
      proposedSeats,
      proposedFeatures,
      proposedTermEnd,
      reason,
      internalNotes,
      requestedByName,
    } = req.body;

    if (!amendmentType) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_AMENDMENT_TYPE', message: 'amendmentType is required' },
      });
    }

    // Calculate impact first
    const impact = await amendmentGenerator.calculateFinancialImpact(
      customerId,
      proposedSeats,
      proposedFeatures,
      proposedTermEnd
    );

    // Create the amendment
    const amendment = await amendmentGenerator.createAmendment({
      customerId,
      amendmentType: amendmentType as AmendmentType,
      proposedSeats,
      proposedFeatures,
      proposedTermEnd,
      reason,
      internalNotes,
      requestedByName,
    });

    const responseTime = Date.now() - startTime;

    return res.status(201).json({
      success: true,
      data: {
        amendment,
        financialImpact: impact,
      },
      meta: {
        createdAt: new Date().toISOString(),
        responseTimeMs: responseTime,
      },
    });
  } catch (error) {
    console.error('[Amendments] Customer amendment request error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create amendment request',
      },
    });
  }
});

/**
 * GET /api/contracts/:id/amendments
 *
 * Get amendments for a specific contract.
 */
router.get('/contracts/:id/amendments', async (req: Request, res: Response) => {
  try {
    const contractId = req.params.id;
    const result = await amendmentGenerator.listAmendments({ contractId });

    return res.json({
      success: true,
      data: result.amendments,
      meta: { total: result.total },
    });
  } catch (error) {
    console.error('[Amendments] Contract amendments error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'LIST_FAILED',
        message: error instanceof Error ? error.message : 'Failed to list contract amendments',
      },
    });
  }
});

export { router as amendmentRoutes };
export default router;
