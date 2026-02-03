/**
 * PRD-257: Cross-Functional Alignment Routes
 *
 * API endpoints for unified activity timeline, account team management,
 * conflict detection, and coordination requests.
 *
 * Endpoints:
 * - GET  /api/cross-functional/customers/:customerId/activities - Get activity timeline
 * - POST /api/cross-functional/customers/:customerId/activities - Create activity
 * - GET  /api/cross-functional/customers/:customerId/team - Get account team
 * - POST /api/cross-functional/customers/:customerId/team - Add team member
 * - PATCH /api/cross-functional/team/:memberId - Update team member
 * - DELETE /api/cross-functional/team/:memberId - Remove team member
 * - GET  /api/cross-functional/customers/:customerId/conflicts - Get conflicts
 * - POST /api/cross-functional/customers/:customerId/conflicts/detect - Run conflict detection
 * - POST /api/cross-functional/conflicts/:conflictId/resolve - Resolve conflict
 * - GET  /api/cross-functional/coordination-requests - Get coordination requests
 * - POST /api/cross-functional/coordination-requests - Create coordination request
 * - PATCH /api/cross-functional/coordination-requests/:requestId - Update request
 * - GET  /api/cross-functional/sync-status - Get integration sync status
 * - GET  /api/cross-functional/customers/:customerId/summary - Get full summary
 */

import { Router, Request, Response } from 'express';
import {
  crossFunctionalService,
  ActivityFilters,
  CreateActivityParams,
  CreateTeamMemberParams,
  UpdateTeamMemberParams,
  CreateCoordinationRequestParams,
  UpdateCoordinationRequestParams,
  ConflictDetectionParams,
  ResolveConflictParams,
  Team,
  SourceSystem,
  ActivityType,
  RequestType,
} from '../services/collaboration/index.js';

const router = Router();

// ============================================
// Activity Timeline Endpoints (FR-1, FR-2)
// ============================================

/**
 * GET /api/cross-functional/customers/:customerId/activities
 * Get unified activity timeline for a customer
 */
router.get('/customers/:customerId/activities', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const {
      teams,
      activityTypes,
      sourceSystems,
      isPlanned,
      startDate,
      endDate,
      contactEmail,
      searchQuery,
      limit,
      offset,
    } = req.query;

    const filters: ActivityFilters = {
      customerId,
    };

    if (teams) filters.teams = (teams as string).split(',') as Team[];
    if (activityTypes) filters.activityTypes = (activityTypes as string).split(',') as ActivityType[];
    if (sourceSystems) filters.sourceSystems = (sourceSystems as string).split(',') as SourceSystem[];
    if (isPlanned !== undefined) filters.isPlanned = isPlanned === 'true';
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;
    if (contactEmail) filters.contactEmail = contactEmail as string;
    if (searchQuery) filters.searchQuery = searchQuery as string;
    if (limit) filters.limit = parseInt(limit as string);
    if (offset) filters.offset = parseInt(offset as string);

    const timeline = await crossFunctionalService.getActivities(filters);

    return res.json({
      success: true,
      data: timeline,
    });
  } catch (error) {
    console.error('[CrossFunctional] Error fetching activities:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch activity timeline',
      },
    });
  }
});

/**
 * POST /api/cross-functional/customers/:customerId/activities
 * Create a new cross-functional activity
 */
router.post('/customers/:customerId/activities', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const {
      sourceSystem,
      sourceId,
      sourceUrl,
      activityType,
      title,
      description,
      team,
      performedByName,
      performedByEmail,
      performedByUserId,
      contactName,
      contactEmail,
      activityDate,
      isPlanned,
      status,
      outcome,
      metadata,
    } = req.body;

    // Validation
    if (!sourceSystem || !activityType || !title || !team || !activityDate) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'sourceSystem, activityType, title, team, and activityDate are required',
        },
      });
    }

    const params: CreateActivityParams = {
      customerId,
      sourceSystem,
      sourceId,
      sourceUrl,
      activityType,
      title,
      description,
      team,
      performedByName,
      performedByEmail,
      performedByUserId,
      contactName,
      contactEmail,
      activityDate,
      isPlanned,
      status,
      outcome,
      metadata,
    };

    const activity = await crossFunctionalService.createActivity(params);

    return res.status(201).json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error('[CrossFunctional] Error creating activity:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create activity',
      },
    });
  }
});

// ============================================
// Account Team Endpoints (FR-5)
// ============================================

/**
 * GET /api/cross-functional/customers/:customerId/team
 * Get account team members
 */
router.get('/customers/:customerId/team', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const team = await crossFunctionalService.getAccountTeam(customerId);

    return res.json({
      success: true,
      data: team,
    });
  } catch (error) {
    console.error('[CrossFunctional] Error fetching team:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch account team',
      },
    });
  }
});

/**
 * POST /api/cross-functional/customers/:customerId/team
 * Add team member to account
 */
router.post('/customers/:customerId/team', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const {
      userId,
      externalEmail,
      name,
      team,
      role,
      responsibilities,
      sourceSystem,
      sourceId,
    } = req.body;

    // Validation
    if (!name || !team || !role) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'name, team, and role are required',
        },
      });
    }

    if (!userId && !externalEmail) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Either userId or externalEmail is required',
        },
      });
    }

    const params: CreateTeamMemberParams = {
      customerId,
      userId,
      externalEmail,
      name,
      team,
      role,
      responsibilities,
      sourceSystem,
      sourceId,
    };

    const member = await crossFunctionalService.addTeamMember(params);

    return res.status(201).json({
      success: true,
      data: member,
    });
  } catch (error) {
    console.error('[CrossFunctional] Error adding team member:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to add team member',
      },
    });
  }
});

/**
 * PATCH /api/cross-functional/team/:memberId
 * Update team member
 */
router.patch('/team/:memberId', async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const { name, team, role, responsibilities, isActive } = req.body;

    const params: UpdateTeamMemberParams = {};
    if (name !== undefined) params.name = name;
    if (team !== undefined) params.team = team;
    if (role !== undefined) params.role = role;
    if (responsibilities !== undefined) params.responsibilities = responsibilities;
    if (isActive !== undefined) params.isActive = isActive;

    const member = await crossFunctionalService.updateTeamMember(memberId, params);

    if (!member) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Team member not found',
        },
      });
    }

    return res.json({
      success: true,
      data: member,
    });
  } catch (error) {
    console.error('[CrossFunctional] Error updating team member:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update team member',
      },
    });
  }
});

/**
 * DELETE /api/cross-functional/team/:memberId
 * Remove team member
 */
router.delete('/team/:memberId', async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;

    const success = await crossFunctionalService.removeTeamMember(memberId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Team member not found',
        },
      });
    }

    return res.json({
      success: true,
      message: 'Team member removed',
    });
  } catch (error) {
    console.error('[CrossFunctional] Error removing team member:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to remove team member',
      },
    });
  }
});

// ============================================
// Conflict Detection Endpoints (FR-3)
// ============================================

/**
 * GET /api/cross-functional/customers/:customerId/conflicts
 * Get activity conflicts for a customer
 */
router.get('/customers/:customerId/conflicts', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { includeResolved } = req.query;

    const conflicts = await crossFunctionalService.getConflicts(
      customerId,
      includeResolved === 'true'
    );

    return res.json({
      success: true,
      data: conflicts,
    });
  } catch (error) {
    console.error('[CrossFunctional] Error fetching conflicts:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch conflicts',
      },
    });
  }
});

/**
 * POST /api/cross-functional/customers/:customerId/conflicts/detect
 * Run conflict detection for a customer
 */
router.post('/customers/:customerId/conflicts/detect', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { lookbackDays, outreachThreshold, gapThresholdDays } = req.body;

    const params: ConflictDetectionParams = {
      customerId,
    };

    if (lookbackDays) params.lookbackDays = lookbackDays;
    if (outreachThreshold) params.outreachThreshold = outreachThreshold;
    if (gapThresholdDays) params.gapThresholdDays = gapThresholdDays;

    const result = await crossFunctionalService.detectConflicts(params);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[CrossFunctional] Error detecting conflicts:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to detect conflicts',
      },
    });
  }
});

/**
 * POST /api/cross-functional/conflicts/:conflictId/resolve
 * Resolve a conflict
 */
router.post('/conflicts/:conflictId/resolve', async (req: Request, res: Response) => {
  try {
    const { conflictId } = req.params;
    const { resolvedByUserId, resolutionNotes } = req.body;
    const userId = (req as any).userId || resolvedByUserId;

    const params: ResolveConflictParams = {
      resolvedByUserId: userId,
      resolutionNotes,
    };

    const conflict = await crossFunctionalService.resolveConflict(conflictId, params);

    if (!conflict) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Conflict not found',
        },
      });
    }

    return res.json({
      success: true,
      data: conflict,
    });
  } catch (error) {
    console.error('[CrossFunctional] Error resolving conflict:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to resolve conflict',
      },
    });
  }
});

// ============================================
// Coordination Request Endpoints (FR-4)
// ============================================

/**
 * GET /api/cross-functional/coordination-requests
 * Get coordination requests
 */
router.get('/coordination-requests', async (req: Request, res: Response) => {
  try {
    const { customerId, status } = req.query;

    const requests = await crossFunctionalService.getCoordinationRequests(
      customerId as string | undefined,
      status as string | undefined
    );

    return res.json({
      success: true,
      data: {
        requests,
        total: requests.length,
      },
    });
  } catch (error) {
    console.error('[CrossFunctional] Error fetching coordination requests:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch coordination requests',
      },
    });
  }
});

/**
 * POST /api/cross-functional/coordination-requests
 * Create a coordination request
 */
router.post('/coordination-requests', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      requestType,
      targetTeam,
      targetEmail,
      reason,
      contextNotes,
      startDate,
      endDate,
    } = req.body;

    const userId = (req as any).userId;

    // Validation
    if (!customerId || !requestType || !reason) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'customerId, requestType, and reason are required',
        },
      });
    }

    const validRequestTypes: RequestType[] = ['hold_off', 'alignment_call', 'context_share'];
    if (!validRequestTypes.includes(requestType)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `requestType must be one of: ${validRequestTypes.join(', ')}`,
        },
      });
    }

    const params: CreateCoordinationRequestParams = {
      customerId,
      requestedByUserId: userId,
      requestType,
      targetTeam,
      targetEmail,
      reason,
      contextNotes,
      startDate,
      endDate,
    };

    const request = await crossFunctionalService.createCoordinationRequest(params);

    return res.status(201).json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error('[CrossFunctional] Error creating coordination request:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create coordination request',
      },
    });
  }
});

/**
 * PATCH /api/cross-functional/coordination-requests/:requestId
 * Update a coordination request
 */
router.patch('/coordination-requests/:requestId', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { status, responseNotes } = req.body;
    const userId = (req as any).userId;

    const params: UpdateCoordinationRequestParams = {};
    if (status) params.status = status;
    if (responseNotes !== undefined) params.responseNotes = responseNotes;
    if (userId) params.respondedByUserId = userId;

    const request = await crossFunctionalService.updateCoordinationRequest(requestId, params);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Coordination request not found',
        },
      });
    }

    return res.json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error('[CrossFunctional] Error updating coordination request:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update coordination request',
      },
    });
  }
});

// ============================================
// Integration Sync Status Endpoints
// ============================================

/**
 * GET /api/cross-functional/sync-status
 * Get integration sync status
 */
router.get('/sync-status', async (req: Request, res: Response) => {
  try {
    const status = await crossFunctionalService.getSyncStatus();

    return res.json({
      success: true,
      data: {
        integrations: status,
        total: status.length,
        enabled: status.filter(s => s.isEnabled).length,
      },
    });
  } catch (error) {
    console.error('[CrossFunctional] Error fetching sync status:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch sync status',
      },
    });
  }
});

// ============================================
// Summary Endpoint
// ============================================

/**
 * GET /api/cross-functional/customers/:customerId/summary
 * Get full cross-functional summary for a customer
 */
router.get('/customers/:customerId/summary', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const summary = await crossFunctionalService.getCrossFunctionalSummary(customerId);

    return res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('[CrossFunctional] Error fetching summary:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch cross-functional summary',
      },
    });
  }
});

export default router;
