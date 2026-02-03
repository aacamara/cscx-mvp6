/**
 * Account Team Routes
 * PRD-072: Account Team View API endpoints
 *
 * Endpoints:
 * - GET  /api/intelligence/account-team/:customerId       - Get team for account
 * - POST /api/intelligence/account-team/:customerId/members - Add team member
 * - PATCH /api/intelligence/account-team/:customerId/members/:memberId - Update member
 * - DELETE /api/intelligence/account-team/:customerId/members/:memberId - Remove member
 * - POST /api/intelligence/account-team/:customerId/activity - Log activity
 * - POST /api/intelligence/account-team/:customerId/sync - Schedule team sync
 * - GET  /api/intelligence/account-team/users/search - Search users for assignment
 */

import { Router, Request, Response } from 'express';
import { accountTeamService } from '../services/accountTeam.js';

const router = Router();

// ============================================
// GET ACCOUNT TEAM
// ============================================

/**
 * GET /api/intelligence/account-team/:customerId
 *
 * Get the account team view for a specific customer.
 *
 * Query Parameters:
 * - includeHistorical (optional): Include past team members (default: false)
 */
router.get('/:customerId', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { customerId } = req.params;
    const includeHistorical = req.query.includeHistorical === 'true';

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
      });
    }

    const teamData = await accountTeamService.getAccountTeam(customerId, includeHistorical);

    if (!teamData) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: `Could not find customer with ID '${customerId}'`,
        },
      });
    }

    const responseTime = Date.now() - startTime;

    console.log(
      `[AccountTeam] Team data retrieved for ${teamData.customerName} in ${responseTime}ms`
    );

    return res.json({
      success: true,
      data: teamData,
      meta: {
        responseTimeMs: responseTime,
        teamSize: teamData.coreTeam.length + teamData.extendedTeam.length,
        coverageScore: teamData.coverageScore,
      },
    });
  } catch (error) {
    console.error('[AccountTeam] Error fetching account team:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch account team',
      },
    });
  }
});

// ============================================
// ADD TEAM MEMBER
// ============================================

/**
 * POST /api/intelligence/account-team/:customerId/members
 *
 * Add a new team member to the account.
 *
 * Request Body:
 * - userId (required): UUID of the user to add
 * - role (required): Team role (csm, ae, se, etc.)
 * - isPrimary (optional): Whether this is the primary person for the role
 */
router.post('/:customerId/members', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { userId, role, isPrimary = false } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID is required',
        },
      });
    }

    if (!role) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ROLE',
          message: 'Role is required',
        },
      });
    }

    const validRoles = [
      'csm',
      'ae',
      'se',
      'tam',
      'support_lead',
      'exec_sponsor',
      'partner_mgr',
      'implementation',
      'training',
    ];

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ROLE',
          message: `Role must be one of: ${validRoles.join(', ')}`,
        },
      });
    }

    // Get the current user ID from the request (assuming auth middleware sets this)
    const assignedBy = (req as any).userId || null;

    const newMember = await accountTeamService.addTeamMember(
      customerId,
      userId,
      role,
      isPrimary,
      assignedBy
    );

    if (!newMember) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'ADD_FAILED',
          message: 'Failed to add team member',
        },
      });
    }

    console.log(`[AccountTeam] Team member ${newMember.name} added to customer ${customerId}`);

    return res.status(201).json({
      success: true,
      data: newMember,
      message: `${newMember.name} has been added as ${role}`,
    });
  } catch (error) {
    console.error('[AccountTeam] Error adding team member:', error);

    const message = error instanceof Error ? error.message : 'Failed to add team member';

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    });
  }
});

// ============================================
// UPDATE TEAM MEMBER
// ============================================

/**
 * PATCH /api/intelligence/account-team/:customerId/members/:memberId
 *
 * Update an existing team member.
 *
 * Request Body (all optional):
 * - role: New role
 * - isPrimary: Primary status
 * - status: Member status (active, inactive, transitioning)
 * - endDate: End date for the assignment
 */
router.patch('/:customerId/members/:memberId', async (req: Request, res: Response) => {
  try {
    const { customerId, memberId } = req.params;
    const { role, isPrimary, status, endDate } = req.body;

    if (!customerId || !memberId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: 'Customer ID and Member ID are required',
        },
      });
    }

    const updates: any = {};
    if (role !== undefined) updates.role = role;
    if (isPrimary !== undefined) updates.isPrimary = isPrimary;
    if (status !== undefined) updates.status = status;
    if (endDate !== undefined) updates.endDate = endDate;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_UPDATES',
          message: 'At least one field to update is required',
        },
      });
    }

    const success = await accountTeamService.updateTeamMember(customerId, memberId, updates);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update team member',
        },
      });
    }

    console.log(`[AccountTeam] Team member ${memberId} updated for customer ${customerId}`);

    return res.json({
      success: true,
      message: 'Team member updated successfully',
    });
  } catch (error) {
    console.error('[AccountTeam] Error updating team member:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update team member',
      },
    });
  }
});

// ============================================
// REMOVE TEAM MEMBER
// ============================================

/**
 * DELETE /api/intelligence/account-team/:customerId/members/:memberId
 *
 * Remove a team member from the account.
 */
router.delete('/:customerId/members/:memberId', async (req: Request, res: Response) => {
  try {
    const { customerId, memberId } = req.params;

    if (!customerId || !memberId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: 'Customer ID and Member ID are required',
        },
      });
    }

    const success = await accountTeamService.removeTeamMember(customerId, memberId);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'REMOVE_FAILED',
          message: 'Failed to remove team member',
        },
      });
    }

    console.log(`[AccountTeam] Team member ${memberId} removed from customer ${customerId}`);

    return res.json({
      success: true,
      message: 'Team member removed successfully',
    });
  } catch (error) {
    console.error('[AccountTeam] Error removing team member:', error);

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
// LOG ACTIVITY
// ============================================

/**
 * POST /api/intelligence/account-team/:customerId/activity
 *
 * Log a team activity for the account.
 *
 * Request Body:
 * - activityType (required): Type of activity
 * - description (required): Description of the activity
 * - visibility (optional): 'team' or 'private' (default: 'team')
 */
router.post('/:customerId/activity', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { activityType, description, visibility = 'team' } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
      });
    }

    if (!activityType || !description) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Activity type and description are required',
        },
      });
    }

    // Get the current user ID from the request
    const userId = (req as any).userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User ID is required to log activity',
        },
      });
    }

    const success = await accountTeamService.logActivity(
      customerId,
      userId,
      activityType,
      description,
      visibility
    );

    if (!success) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'LOG_FAILED',
          message: 'Failed to log activity',
        },
      });
    }

    console.log(`[AccountTeam] Activity logged for customer ${customerId}`);

    return res.status(201).json({
      success: true,
      message: 'Activity logged successfully',
    });
  } catch (error) {
    console.error('[AccountTeam] Error logging activity:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to log activity',
      },
    });
  }
});

// ============================================
// SCHEDULE TEAM SYNC
// ============================================

/**
 * POST /api/intelligence/account-team/:customerId/sync
 *
 * Schedule a team sync meeting.
 *
 * Request Body:
 * - topic (required): Meeting topic
 * - participants (required): Array of participant names
 * - proposedDate (required): ISO date string
 */
router.post('/:customerId/sync', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { topic, participants, proposedDate } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
      });
    }

    if (!topic || !participants || !proposedDate) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Topic, participants, and proposed date are required',
        },
      });
    }

    if (!Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARTICIPANTS',
          message: 'At least one participant is required',
        },
      });
    }

    const event = await accountTeamService.scheduleSync(
      customerId,
      topic,
      participants,
      proposedDate
    );

    if (!event) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'SCHEDULE_FAILED',
          message: 'Failed to schedule team sync',
        },
      });
    }

    console.log(`[AccountTeam] Team sync scheduled for customer ${customerId}`);

    return res.status(201).json({
      success: true,
      data: event,
      message: 'Team sync scheduled successfully',
    });
  } catch (error) {
    console.error('[AccountTeam] Error scheduling sync:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to schedule team sync',
      },
    });
  }
});

// ============================================
// SEARCH USERS
// ============================================

/**
 * GET /api/intelligence/account-team/users/search
 *
 * Search for users to add as team members.
 *
 * Query Parameters:
 * - q (required): Search query
 * - limit (optional): Maximum results (default: 10)
 */
router.get('/users/search', async (req: Request, res: Response) => {
  try {
    const { q, limit = '10' } = req.query;

    if (!q || (q as string).length < 2) {
      return res.json({
        success: true,
        data: {
          users: [],
        },
      });
    }

    const users = await accountTeamService.searchUsers(q as string, parseInt(limit as string));

    return res.json({
      success: true,
      data: {
        users,
      },
    });
  } catch (error) {
    console.error('[AccountTeam] Error searching users:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to search users',
      },
    });
  }
});

export { router as accountTeamRoutes };
export default router;
