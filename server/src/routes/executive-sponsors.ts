/**
 * Executive Sponsor API Routes
 * PRD-246: Executive Sponsor Assignment
 *
 * Endpoints for managing executive sponsors, assignments, engagements, and impact metrics
 */

import { Router, Request, Response } from 'express';
import {
  executiveSponsorService,
  AssignmentStatus,
  EngagementCadence,
  EngagementType
} from '../services/executiveSponsor.js';

const router = Router();

// ============================================
// EXECUTIVE SPONSOR ENDPOINTS
// ============================================

/**
 * GET /api/executive-sponsors
 * Get all executive sponsors with optional filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      active,
      has_capacity,
      industry,
      specialty,
      search,
      page,
      pageSize
    } = req.query;

    const result = await executiveSponsorService.getExecutiveSponsors({
      active: active !== undefined ? active === 'true' : undefined,
      has_capacity: has_capacity === 'true',
      industry: industry as string,
      specialty: specialty as string,
      search: search as string,
      page: parseInt(page as string) || 1,
      pageSize: parseInt(pageSize as string) || 20
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error fetching executive sponsors:', error);
    res.status(500).json({
      error: 'Failed to fetch executive sponsors',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/executive-sponsors
 * Create a new executive sponsor
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, title, bio, industries, specialties, max_accounts } = req.body;

    if (!user_id || !title) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['user_id', 'title']
      });
    }

    const sponsor = await executiveSponsorService.createExecutiveSponsor({
      user_id,
      title,
      bio,
      industries,
      specialties,
      max_accounts
    });

    res.status(201).json({
      success: true,
      sponsor
    });
  } catch (error) {
    console.error('Error creating executive sponsor:', error);
    res.status(500).json({
      error: 'Failed to create executive sponsor',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/executive-sponsors/:id
 * Get executive sponsor by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const sponsor = await executiveSponsorService.getExecutiveSponsor(id);

    if (!sponsor) {
      return res.status(404).json({ error: 'Executive sponsor not found' });
    }

    res.json({
      success: true,
      sponsor
    });
  } catch (error) {
    console.error('Error fetching executive sponsor:', error);
    res.status(500).json({
      error: 'Failed to fetch executive sponsor',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PATCH /api/executive-sponsors/:id
 * Update executive sponsor
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, bio, industries, specialties, max_accounts, active } = req.body;

    const sponsor = await executiveSponsorService.updateExecutiveSponsor(id, {
      title,
      bio,
      industries,
      specialties,
      max_accounts,
      active
    });

    res.json({
      success: true,
      sponsor
    });
  } catch (error) {
    console.error('Error updating executive sponsor:', error);
    res.status(500).json({
      error: 'Failed to update executive sponsor',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/executive-sponsors/:id/portfolio
 * Get executive sponsor's portfolio
 */
router.get('/:id/portfolio', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const portfolio = await executiveSponsorService.getSponsorPortfolio(id);

    res.json({
      success: true,
      ...portfolio
    });
  } catch (error) {
    console.error('Error fetching sponsor portfolio:', error);
    res.status(500).json({
      error: 'Failed to fetch sponsor portfolio',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/executive-sponsors/:id/dashboard
 * Get executive sponsor's dashboard
 */
router.get('/:id/dashboard', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dashboard = await executiveSponsorService.getSponsorDashboard(id);

    res.json({
      success: true,
      ...dashboard
    });
  } catch (error) {
    console.error('Error fetching sponsor dashboard:', error);
    res.status(500).json({
      error: 'Failed to fetch sponsor dashboard',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/executive-sponsors/impact-metrics
 * Get impact metrics comparing sponsored vs non-sponsored accounts
 */
router.get('/reports/impact-metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = await executiveSponsorService.getImpactMetrics();

    res.json({
      success: true,
      ...metrics
    });
  } catch (error) {
    console.error('Error fetching impact metrics:', error);
    res.status(500).json({
      error: 'Failed to fetch impact metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================
// ASSIGNMENT ENDPOINTS
// ============================================

/**
 * GET /api/executive-assignments
 * Get all assignments with optional filters
 */
router.get('/assignments', async (req: Request, res: Response) => {
  try {
    const {
      customer_id,
      executive_sponsor_id,
      status,
      page,
      pageSize
    } = req.query;

    const result = await executiveSponsorService.getAssignments({
      customer_id: customer_id as string,
      executive_sponsor_id: executive_sponsor_id as string,
      status: status as AssignmentStatus,
      page: parseInt(page as string) || 1,
      pageSize: parseInt(pageSize as string) || 20
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({
      error: 'Failed to fetch assignments',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/executive-assignments
 * Create a new assignment (request sponsor for account)
 */
router.post('/assignments', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const {
      customer_id,
      executive_sponsor_id,
      engagement_cadence,
      assignment_reason
    } = req.body;

    if (!customer_id || !executive_sponsor_id) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['customer_id', 'executive_sponsor_id']
      });
    }

    const assignment = await executiveSponsorService.createAssignment(
      {
        customer_id,
        executive_sponsor_id,
        engagement_cadence,
        assignment_reason
      },
      userId
    );

    res.status(201).json({
      success: true,
      assignment,
      message: 'Assignment request created. Awaiting executive acceptance.'
    });
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({
      error: 'Failed to create assignment',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/executive-assignments/:id
 * Get assignment by ID
 */
router.get('/assignments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const assignment = await executiveSponsorService.getAssignment(id);

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({
      success: true,
      assignment
    });
  } catch (error) {
    console.error('Error fetching assignment:', error);
    res.status(500).json({
      error: 'Failed to fetch assignment',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PATCH /api/executive-assignments/:id
 * Update assignment (accept/decline, change cadence, end)
 */
router.patch('/assignments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, engagement_cadence, end_reason } = req.body;

    // Validate status transitions
    if (status) {
      const validStatuses: AssignmentStatus[] = ['proposed', 'active', 'ended'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Invalid status',
          validStatuses
        });
      }
    }

    // Validate cadence
    if (engagement_cadence) {
      const validCadences: EngagementCadence[] = ['monthly', 'quarterly', 'biannual'];
      if (!validCadences.includes(engagement_cadence)) {
        return res.status(400).json({
          error: 'Invalid engagement cadence',
          validCadences
        });
      }
    }

    const assignment = await executiveSponsorService.updateAssignment(id, {
      status,
      engagement_cadence,
      end_reason
    });

    const message = status === 'active'
      ? 'Assignment accepted'
      : status === 'ended'
        ? 'Assignment ended'
        : 'Assignment updated';

    res.json({
      success: true,
      assignment,
      message
    });
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({
      error: 'Failed to update assignment',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/executive-assignments/:id
 * Delete assignment
 */
router.delete('/assignments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await executiveSponsorService.deleteAssignment(id);

    res.json({
      success: true,
      message: 'Assignment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({
      error: 'Failed to delete assignment',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================
// MATCHING ENDPOINTS
// ============================================

/**
 * GET /api/customers/:id/executive-sponsor-matches
 * Get best-fit executive sponsors for a customer
 */
router.get('/matching/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const matches = await executiveSponsorService.findBestExecutiveSponsors(customerId);

    res.json({
      success: true,
      customer_id: customerId,
      matches,
      total: matches.length
    });
  } catch (error) {
    console.error('Error finding executive sponsor matches:', error);
    res.status(500).json({
      error: 'Failed to find executive sponsor matches',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================
// ENGAGEMENT ENDPOINTS
// ============================================

/**
 * GET /api/executive-engagements
 * Get all engagements with optional filters
 */
router.get('/engagements', async (req: Request, res: Response) => {
  try {
    const {
      customer_id,
      executive_sponsor_id,
      assignment_id,
      engagement_type,
      start_date,
      end_date,
      page,
      pageSize
    } = req.query;

    const result = await executiveSponsorService.getEngagements({
      customer_id: customer_id as string,
      executive_sponsor_id: executive_sponsor_id as string,
      assignment_id: assignment_id as string,
      engagement_type: engagement_type as EngagementType,
      start_date: start_date ? new Date(start_date as string) : undefined,
      end_date: end_date ? new Date(end_date as string) : undefined,
      page: parseInt(page as string) || 1,
      pageSize: parseInt(pageSize as string) || 20
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error fetching engagements:', error);
    res.status(500).json({
      error: 'Failed to fetch engagements',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/executive-engagements
 * Log a new engagement
 */
router.post('/engagements', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const {
      assignment_id,
      customer_id,
      executive_sponsor_id,
      engagement_type,
      title,
      description,
      customer_attendees,
      outcome,
      next_steps,
      engagement_date,
      source,
      external_id
    } = req.body;

    if (!customer_id || !executive_sponsor_id || !engagement_type || !title || !engagement_date) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['customer_id', 'executive_sponsor_id', 'engagement_type', 'title', 'engagement_date']
      });
    }

    // Validate engagement type
    const validTypes: EngagementType[] = ['meeting', 'email', 'ebr', 'call', 'event'];
    if (!validTypes.includes(engagement_type)) {
      return res.status(400).json({
        error: 'Invalid engagement type',
        validTypes
      });
    }

    const engagement = await executiveSponsorService.createEngagement(
      {
        assignment_id,
        customer_id,
        executive_sponsor_id,
        engagement_type,
        title,
        description,
        customer_attendees,
        outcome,
        next_steps,
        engagement_date,
        source,
        external_id
      },
      userId
    );

    res.status(201).json({
      success: true,
      engagement,
      message: 'Engagement logged successfully'
    });
  } catch (error) {
    console.error('Error creating engagement:', error);
    res.status(500).json({
      error: 'Failed to create engagement',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/executive-assignments/:id/engagements
 * Get all engagements for an assignment
 */
router.get('/assignments/:id/engagements', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page, pageSize } = req.query;

    const result = await executiveSponsorService.getEngagements({
      assignment_id: id,
      page: parseInt(page as string) || 1,
      pageSize: parseInt(pageSize as string) || 20
    });

    res.json({
      success: true,
      assignment_id: id,
      ...result
    });
  } catch (error) {
    console.error('Error fetching assignment engagements:', error);
    res.status(500).json({
      error: 'Failed to fetch assignment engagements',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================
// QUALIFICATION ENDPOINTS
// ============================================

/**
 * GET /api/executive-sponsors/qualified-accounts
 * Get accounts qualifying for executive sponsorship
 */
router.get('/qualified-accounts', async (_req: Request, res: Response) => {
  try {
    const result = await executiveSponsorService.getQualifiedAccounts();

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error fetching qualified accounts:', error);
    res.status(500).json({
      error: 'Failed to fetch qualified accounts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================
// META ENDPOINTS
// ============================================

/**
 * GET /api/executive-sponsors/meta/engagement-types
 * Get available engagement types
 */
router.get('/meta/engagement-types', (_req: Request, res: Response) => {
  const engagementTypes = [
    { value: 'meeting', label: 'Meeting', description: 'In-person or virtual meeting' },
    { value: 'email', label: 'Email', description: 'Email correspondence' },
    { value: 'ebr', label: 'Executive Business Review', description: 'Formal quarterly/annual business review' },
    { value: 'call', label: 'Phone Call', description: 'Phone or voice call' },
    { value: 'event', label: 'Event', description: 'Conference, dinner, or other event' }
  ];

  res.json({
    success: true,
    engagementTypes
  });
});

/**
 * GET /api/executive-sponsors/meta/cadences
 * Get available engagement cadences
 */
router.get('/meta/cadences', (_req: Request, res: Response) => {
  const cadences = [
    { value: 'monthly', label: 'Monthly', days: 30 },
    { value: 'quarterly', label: 'Quarterly', days: 90 },
    { value: 'biannual', label: 'Bi-Annual', days: 180 }
  ];

  res.json({
    success: true,
    cadences
  });
});

/**
 * GET /api/executive-sponsors/meta/statuses
 * Get available assignment statuses
 */
router.get('/meta/statuses', (_req: Request, res: Response) => {
  const statuses = [
    { value: 'proposed', label: 'Proposed', description: 'Awaiting executive acceptance' },
    { value: 'active', label: 'Active', description: 'Assignment is active' },
    { value: 'ended', label: 'Ended', description: 'Assignment has ended' }
  ];

  res.json({
    success: true,
    statuses
  });
});

export default router;
