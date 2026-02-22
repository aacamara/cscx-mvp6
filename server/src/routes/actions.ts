/**
 * Pending Actions Routes
 * API endpoints for HITL approval workflow
 */

import { Router, Request, Response } from 'express';
import {
  pendingActionsService,
  ActionType,
  ScheduleMeetingDetails,
  SendEmailDetails
} from '../services/pendingActions.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

/**
 * GET /api/actions
 * List pending actions for the current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const status = req.query.status as string | undefined;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' }
      });
    }

    const actions = await pendingActionsService.getUserActions(
      userId,
      status as any
    );

    res.json({
      actions,
      total: actions.length
    });
  } catch (error) {
    console.error('List actions error:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to list actions' }
    });
  }
});

/**
 * GET /api/actions/pending
 * List only pending actions for the current user
 */
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' }
      });
    }

    const actions = await pendingActionsService.getUserActions(userId, 'pending');

    res.json({
      actions,
      total: actions.length
    });
  } catch (error) {
    console.error('List pending actions error:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to list pending actions' }
    });
  }
});

/**
 * GET /api/actions/:id
 * Get a specific action by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    const action = await pendingActionsService.getAction(id);

    if (!action) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Action not found' }
      });
    }

    // Verify user owns this action
    if (action.userId !== userId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Not authorized to view this action' }
      });
    }

    res.json({ action });
  } catch (error) {
    console.error('Get action error:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to get action' }
    });
  }
});

/**
 * POST /api/actions/:id/approve
 * Approve and execute a pending action
 */
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' }
      });
    }

    const action = await pendingActionsService.getAction(id);

    if (!action) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Action not found' }
      });
    }

    // Verify user owns this action
    if (action.userId !== userId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Not authorized to approve this action' }
      });
    }

    console.log(`👤 User ${userId} approving action: ${id}`);

    const updatedAction = await pendingActionsService.approveAction(id);

    res.json({
      action: updatedAction,
      message: updatedAction.status === 'executed'
        ? 'Action approved and executed successfully'
        : `Action failed: ${updatedAction.error}`
    });
  } catch (error) {
    console.error('Approve action error:', error);
    res.status(500).json({
      error: {
        code: 'ERROR',
        message: error instanceof Error ? error.message : 'Failed to approve action'
      }
    });
  }
});

/**
 * POST /api/actions/:id/reject
 * Reject a pending action
 */
router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' }
      });
    }

    const action = await pendingActionsService.getAction(id);

    if (!action) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Action not found' }
      });
    }

    // Verify user owns this action
    if (action.userId !== userId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Not authorized to reject this action' }
      });
    }

    console.log(`👤 User ${userId} rejecting action: ${id}`);

    const updatedAction = await pendingActionsService.rejectAction(id, reason);

    res.json({
      action: updatedAction,
      message: 'Action rejected'
    });
  } catch (error) {
    console.error('Reject action error:', error);
    res.status(500).json({
      error: {
        code: 'ERROR',
        message: error instanceof Error ? error.message : 'Failed to reject action'
      }
    });
  }
});

/**
 * DELETE /api/actions/:id
 * Delete an action
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    const action = await pendingActionsService.getAction(id);

    if (!action) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Action not found' }
      });
    }

    // Verify user owns this action
    if (action.userId !== userId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Not authorized to delete this action' }
      });
    }

    await pendingActionsService.deleteAction(id);

    res.json({ message: 'Action deleted' });
  } catch (error) {
    console.error('Delete action error:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to delete action' }
    });
  }
});

/**
 * POST /api/actions/clear
 * Clear all actions for the current user
 */
router.post('/clear', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' }
      });
    }

    const deleted = await pendingActionsService.clearUserActions(userId);

    res.json({
      message: `Cleared ${deleted} actions`,
      deleted
    });
  } catch (error) {
    console.error('Clear actions error:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to clear actions' }
    });
  }
});

export { router as actionsRoutes };
