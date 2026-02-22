/**
 * Approval Queue API Routes
 * Endpoints for Human-in-the-Loop (HITL) approval management
 */

import { Router, Request, Response } from 'express';
import {
  approvalService,
  ActionType,
  ApprovalStatus
} from '../services/approval.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

/**
 * GET /api/approvals
 * Get pending approvals for the current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const result = await approvalService.getPendingApprovals(userId, { page, pageSize });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error fetching approvals:', error);
    res.status(500).json({
      error: 'Failed to fetch approvals',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/approvals/history
 * Get approval history for the current user
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const {
      status,
      actionType,
      startDate,
      endDate,
      page,
      pageSize
    } = req.query;

    const result = await approvalService.getApprovalHistory(userId, {
      status: status as ApprovalStatus,
      actionType: actionType as ActionType,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: parseInt(page as string) || 1,
      pageSize: parseInt(pageSize as string) || 20
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error fetching approval history:', error);
    res.status(500).json({
      error: 'Failed to fetch approval history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/approvals/stats
 * Get approval statistics for the current user
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const stats = await approvalService.getStats(userId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching approval stats:', error);
    res.status(500).json({
      error: 'Failed to fetch approval stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/approvals/:id
 * Get a specific approval by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const approval = await approvalService.getApproval(id);

    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    // Verify ownership
    if (approval.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this approval' });
    }

    res.json({
      success: true,
      approval
    });
  } catch (error) {
    console.error('Error fetching approval:', error);
    res.status(500).json({
      error: 'Failed to fetch approval',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/approvals
 * Create a new approval request (typically called by agents)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const {
      executionId,
      actionType,
      actionData,
      originalContent,
      expiresInHours
    } = req.body;

    if (!actionType || !actionData) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['actionType', 'actionData']
      });
    }

    // Validate action type
    const validActionTypes: ActionType[] = [
      'send_email', 'schedule_meeting', 'create_task', 'share_document', 'other'
    ];

    if (!validActionTypes.includes(actionType)) {
      return res.status(400).json({
        error: 'Invalid action type',
        validTypes: validActionTypes
      });
    }

    const approval = await approvalService.createApproval({
      userId,
      executionId,
      actionType,
      actionData,
      originalContent,
      expiresInHours
    });

    res.status(201).json({
      success: true,
      approval,
      message: 'Approval request created. Awaiting review.'
    });
  } catch (error) {
    console.error('Error creating approval:', error);
    res.status(500).json({
      error: 'Failed to create approval',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/approvals/:id/approve
 * Approve an action
 */
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    // Verify ownership
    const existing = await approvalService.getApproval(id);
    if (!existing) {
      return res.status(404).json({ error: 'Approval not found' });
    }
    if (existing.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to approve this action' });
    }

    const { reviewerNotes } = req.body;

    const approval = await approvalService.reviewApproval(id, {
      status: 'approved',
      reviewerNotes
    });

    res.json({
      success: true,
      approval,
      message: 'Action approved and executed successfully.'
    });
  } catch (error) {
    console.error('Error approving action:', error);
    res.status(500).json({
      error: 'Failed to approve action',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/approvals/:id/reject
 * Reject an action
 */
router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    // Verify ownership
    const existing = await approvalService.getApproval(id);
    if (!existing) {
      return res.status(404).json({ error: 'Approval not found' });
    }
    if (existing.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to reject this action' });
    }

    const { reviewerNotes } = req.body;

    const approval = await approvalService.reviewApproval(id, {
      status: 'rejected',
      reviewerNotes
    });

    res.json({
      success: true,
      approval,
      message: 'Action rejected.'
    });
  } catch (error) {
    console.error('Error rejecting action:', error);
    res.status(500).json({
      error: 'Failed to reject action',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/approvals/:id/modify
 * Modify and approve an action
 */
router.post('/:id/modify', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    // Verify ownership
    const existing = await approvalService.getApproval(id);
    if (!existing) {
      return res.status(404).json({ error: 'Approval not found' });
    }
    if (existing.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to modify this action' });
    }

    const { modifiedContent, reviewerNotes } = req.body;

    if (!modifiedContent) {
      return res.status(400).json({
        error: 'Modified content is required'
      });
    }

    const approval = await approvalService.reviewApproval(id, {
      status: 'modified',
      modifiedContent,
      reviewerNotes
    });

    res.json({
      success: true,
      approval,
      message: 'Action modified and executed successfully.'
    });
  } catch (error) {
    console.error('Error modifying action:', error);
    res.status(500).json({
      error: 'Failed to modify action',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/approvals/:id
 * Cancel a pending approval
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    // Verify ownership
    const existing = await approvalService.getApproval(id);
    if (!existing) {
      return res.status(404).json({ error: 'Approval not found' });
    }
    if (existing.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to cancel this approval' });
    }

    if (existing.status !== 'pending') {
      return res.status(400).json({
        error: 'Only pending approvals can be cancelled'
      });
    }

    await approvalService.cancelApproval(id);

    res.json({
      success: true,
      message: 'Approval cancelled successfully.'
    });
  } catch (error) {
    console.error('Error cancelling approval:', error);
    res.status(500).json({
      error: 'Failed to cancel approval',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/approvals/action-types
 * Get available action types
 */
router.get('/meta/action-types', (_req: Request, res: Response) => {
  const actionTypes = [
    { value: 'send_email', label: 'Send Email', description: 'Send an email to a customer or contact' },
    { value: 'schedule_meeting', label: 'Schedule Meeting', description: 'Schedule a calendar meeting with attendees' },
    { value: 'create_task', label: 'Create Task', description: 'Create a follow-up task' },
    { value: 'share_document', label: 'Share Document', description: 'Share a document from Google Drive' },
    { value: 'other', label: 'Other', description: 'Other custom action' }
  ];

  res.json({
    success: true,
    actionTypes
  });
});

export default router;
