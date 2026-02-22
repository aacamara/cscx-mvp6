/**
 * Reference Routes
 * PRD-043: Reference Request to Customer
 *
 * API endpoints for reference pool management, matching, and call tracking.
 */

import { Router, Request, Response } from 'express';
import { referenceManagerService } from '../services/advocacy/referenceManager.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// Reference Request Generation
// ============================================

/**
 * POST /api/references/customers/:customerId/request
 * Generate a reference request for a customer
 */
router.post('/customers/:customerId/request', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const {
      stakeholderEmail,
      stakeholderName,
      stakeholderTitle,
      csmName,
      csmEmail,
      csmTitle,
      prospect,
      callDetails,
      urgency,
      customMessage,
    } = req.body;

    // Validation
    if (!stakeholderEmail || !stakeholderName) {
      return res.status(400).json({
        error: 'stakeholderEmail and stakeholderName are required',
      });
    }

    if (!csmName || !csmEmail) {
      return res.status(400).json({
        error: 'csmName and csmEmail are required',
      });
    }

    const result = await referenceManagerService.generateReferenceRequest(customerId, {
      stakeholderEmail,
      stakeholderName,
      stakeholderTitle,
      csmName,
      csmEmail,
      csmTitle,
      prospect,
      callDetails,
      urgency,
      customMessage,
    });

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        readiness: result.readiness,
      });
    }

    res.json({
      success: true,
      email: result.email,
      readiness: result.readiness,
    });
  } catch (error) {
    console.error('Error generating reference request:', error);
    res.status(500).json({ error: 'Failed to generate reference request' });
  }
});

/**
 * GET /api/references/customers/:customerId/readiness
 * Check customer readiness for reference request
 */
router.get('/customers/:customerId/readiness', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const readiness = await referenceManagerService.assessReadiness(customerId);

    res.json({
      success: true,
      data: readiness,
    });
  } catch (error) {
    console.error('Error assessing reference readiness:', error);
    res.status(500).json({ error: 'Failed to assess reference readiness' });
  }
});

/**
 * GET /api/references/customers/:customerId/status
 * Get customer's reference status and history
 */
router.get('/customers/:customerId/status', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const status = await referenceManagerService.getCustomerReferenceStatus(customerId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error getting customer reference status:', error);
    res.status(500).json({ error: 'Failed to get customer reference status' });
  }
});

// ============================================
// Reference Pool Management
// ============================================

/**
 * GET /api/references/pool
 * Get reference pool with stats
 */
router.get('/pool', async (req: Request, res: Response) => {
  try {
    const {
      activeOnly = 'true',
      availableOnly = 'false',
      industry,
      limit = '50',
      offset = '0',
    } = req.query;

    const pool = await referenceManagerService.getReferencePool({
      activeOnly: activeOnly === 'true',
      availableOnly: availableOnly === 'true',
      industry: industry as string | undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({
      success: true,
      data: pool,
    });
  } catch (error) {
    console.error('Error getting reference pool:', error);
    res.status(500).json({ error: 'Failed to get reference pool' });
  }
});

/**
 * POST /api/references/match
 * Match references to prospect criteria
 */
router.post('/match', async (req: Request, res: Response) => {
  try {
    const { industry, companySize, topics, preferredFormat, maxDuration, urgency } = req.body;

    const matches = await referenceManagerService.matchReferences({
      industry,
      companySize,
      topics,
      preferredFormat,
      maxDuration,
      urgency,
    });

    res.json({
      success: true,
      data: {
        matches,
        total: matches.length,
      },
    });
  } catch (error) {
    console.error('Error matching references:', error);
    res.status(500).json({ error: 'Failed to match references' });
  }
});

// ============================================
// Reference Enrollment
// ============================================

/**
 * POST /api/references/enroll
 * Enroll a customer in the reference program
 */
router.post('/enroll', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      stakeholderName,
      stakeholderEmail,
      stakeholderTitle,
      preferredFormat,
      preferredDuration,
      topics,
      industries,
      maxCallsPerMonth,
      notes,
    } = req.body;

    // Validation
    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    if (!stakeholderName || !stakeholderEmail) {
      return res.status(400).json({
        error: 'stakeholderName and stakeholderEmail are required',
      });
    }

    const result = await referenceManagerService.enrollInReferenceProgram({
      customerId,
      stakeholderName,
      stakeholderEmail,
      stakeholderTitle,
      preferredFormat,
      preferredDuration,
      topics,
      industries,
      maxCallsPerMonth,
      notes,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.status(201).json({
      success: true,
      data: result.reference,
    });
  } catch (error) {
    console.error('Error enrolling in reference program:', error);
    res.status(500).json({ error: 'Failed to enroll in reference program' });
  }
});

/**
 * PATCH /api/references/:referenceId/availability
 * Update reference availability
 */
router.patch('/:referenceId/availability', async (req: Request, res: Response) => {
  try {
    const { referenceId } = req.params;
    const { availability, maxCallsPerMonth } = req.body;

    if (!availability) {
      return res.status(400).json({ error: 'availability is required' });
    }

    const validStatuses = ['available', 'busy', 'limited', 'inactive', 'declined'];
    if (!validStatuses.includes(availability)) {
      return res.status(400).json({
        error: `Invalid availability status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const result = await referenceManagerService.updateReferenceAvailability(
      referenceId,
      availability,
      maxCallsPerMonth
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating reference availability:', error);
    res.status(500).json({ error: 'Failed to update reference availability' });
  }
});

// ============================================
// Reference Calls
// ============================================

/**
 * POST /api/references/calls
 * Create a reference call request
 */
router.post('/calls', async (req: Request, res: Response) => {
  try {
    const {
      referenceId,
      prospectCompany,
      prospectContactName,
      prospectContactEmail,
      prospectIndustry,
      scheduledAt,
      callFormat,
    } = req.body;

    // Validation
    if (!referenceId) {
      return res.status(400).json({ error: 'referenceId is required' });
    }

    if (!prospectCompany) {
      return res.status(400).json({ error: 'prospectCompany is required' });
    }

    const result = await referenceManagerService.createReferenceCall({
      referenceId,
      prospectCompany,
      prospectContactName,
      prospectContactEmail,
      prospectIndustry,
      scheduledAt,
      callFormat,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.status(201).json({
      success: true,
      data: result.call,
    });
  } catch (error) {
    console.error('Error creating reference call:', error);
    res.status(500).json({ error: 'Failed to create reference call' });
  }
});

/**
 * PATCH /api/references/calls/:callId
 * Update reference call status
 */
router.patch('/calls/:callId', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    const {
      status,
      completedAt,
      durationMinutes,
      referenceRating,
      prospectRating,
      referenceFeedback,
      prospectFeedback,
      outcome,
      dealInfluenced,
      dealValue,
    } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const validStatuses = ['requested', 'scheduled', 'completed', 'no_show', 'cancelled', 'rescheduled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const result = await referenceManagerService.updateCallStatus(callId, status, {
      completedAt,
      durationMinutes,
      referenceRating,
      prospectRating,
      referenceFeedback,
      prospectFeedback,
      outcome,
      dealInfluenced,
      dealValue,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating reference call:', error);
    res.status(500).json({ error: 'Failed to update reference call' });
  }
});

/**
 * POST /api/references/calls/:callId/complete
 * Mark a reference call as completed with feedback
 */
router.post('/calls/:callId/complete', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    const {
      durationMinutes,
      referenceRating,
      prospectRating,
      referenceFeedback,
      prospectFeedback,
      outcome,
      dealInfluenced,
      dealValue,
    } = req.body;

    const result = await referenceManagerService.updateCallStatus(callId, 'completed', {
      completedAt: new Date().toISOString(),
      durationMinutes,
      referenceRating,
      prospectRating,
      referenceFeedback,
      prospectFeedback,
      outcome,
      dealInfluenced,
      dealValue,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, message: 'Reference call marked as completed' });
  } catch (error) {
    console.error('Error completing reference call:', error);
    res.status(500).json({ error: 'Failed to complete reference call' });
  }
});

export default router;
