/**
 * PRD-253: Peer Review Workflow API Routes
 *
 * REST endpoints for managing peer reviews on communications and actions.
 */

import { Router, Request, Response } from 'express';
import {
  peerReviewService,
  type CreateReviewRequestInput,
  type AssignReviewerInput,
  type SubmitDecisionInput,
  type AddCommentInput,
  type ResolveCommentInput,
  type ReviewRequestStatus,
  type AssignmentStatus,
} from '../services/collaboration/peerReview.js';

const router = Router();

// ============================================
// REVIEW REQUESTS
// ============================================

/**
 * POST /api/peer-review/requests
 * Create a new review request
 */
router.post('/requests', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const input: CreateReviewRequestInput = req.body;

    if (!input.contentType || !input.contentSnapshot) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['contentType', 'contentSnapshot'],
      });
    }

    const request = await peerReviewService.createReviewRequest(userId, input);

    res.status(201).json({
      success: true,
      request,
      message: 'Review request created successfully',
    });
  } catch (error) {
    console.error('Error creating review request:', error);
    res.status(500).json({
      error: 'Failed to create review request',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/peer-review/requests
 * Get review requests created by the current user
 */
router.get('/requests', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const status = req.query.status as ReviewRequestStatus | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const result = await peerReviewService.getMyRequests(userId, {
      status,
      page,
      pageSize,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error fetching review requests:', error);
    res.status(500).json({
      error: 'Failed to fetch review requests',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/peer-review/requests/:id
 * Get a specific review request by ID
 */
router.get('/requests/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const request = await peerReviewService.getReviewRequest(id);

    if (!request) {
      return res.status(404).json({ error: 'Review request not found' });
    }

    res.json({
      success: true,
      request,
    });
  } catch (error) {
    console.error('Error fetching review request:', error);
    res.status(500).json({
      error: 'Failed to fetch review request',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/peer-review/requests/:id
 * Cancel a review request
 */
router.delete('/requests/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    await peerReviewService.cancelRequest(id, userId);

    res.json({
      success: true,
      message: 'Review request cancelled',
    });
  } catch (error) {
    console.error('Error cancelling review request:', error);
    res.status(500).json({
      error: 'Failed to cancel review request',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/peer-review/requests/:id/audit-log
 * Get audit log for a review request
 */
router.get('/requests/:id/audit-log', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const auditLog = await peerReviewService.getAuditLog(id);

    res.json({
      success: true,
      auditLog,
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({
      error: 'Failed to fetch audit log',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// REVIEWER ASSIGNMENTS
// ============================================

/**
 * POST /api/peer-review/requests/:id/assign
 * Assign a reviewer to a request
 */
router.post('/requests/:id/assign', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;
    const input: AssignReviewerInput = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!input.reviewerUserId) {
      return res.status(400).json({
        error: 'Missing required field: reviewerUserId',
      });
    }

    const assignment = await peerReviewService.assignReviewer(id, userId, input);

    res.status(201).json({
      success: true,
      assignment,
      message: 'Reviewer assigned successfully',
    });
  } catch (error) {
    console.error('Error assigning reviewer:', error);
    res.status(500).json({
      error: 'Failed to assign reviewer',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/peer-review/queue
 * Get the reviewer's queue of pending reviews
 */
router.get('/queue', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const status = req.query.status as AssignmentStatus | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const result = await peerReviewService.getReviewQueue(userId, {
      status,
      page,
      pageSize,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error fetching review queue:', error);
    res.status(500).json({
      error: 'Failed to fetch review queue',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/peer-review/assignments/:id/start
 * Start reviewing an assignment
 */
router.post('/assignments/:id/start', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const assignment = await peerReviewService.startReview(id, userId);

    res.json({
      success: true,
      assignment,
      message: 'Review started',
    });
  } catch (error) {
    console.error('Error starting review:', error);
    res.status(500).json({
      error: 'Failed to start review',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/peer-review/assignments/:id/decline
 * Decline a review assignment
 */
router.post('/assignments/:id/decline', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    await peerReviewService.declineAssignment(id, userId, reason);

    res.json({
      success: true,
      message: 'Review assignment declined',
    });
  } catch (error) {
    console.error('Error declining assignment:', error);
    res.status(500).json({
      error: 'Failed to decline assignment',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/peer-review/assignments/:id/approve
 * Approve the reviewed content
 */
router.post('/assignments/:id/approve', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;
    const { overallFeedback, rating } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const input: SubmitDecisionInput = {
      decision: 'approved',
      overallFeedback,
      rating,
    };

    const assignment = await peerReviewService.submitDecision(id, userId, input);

    res.json({
      success: true,
      assignment,
      message: 'Content approved',
    });
  } catch (error) {
    console.error('Error approving content:', error);
    res.status(500).json({
      error: 'Failed to approve content',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/peer-review/assignments/:id/request-changes
 * Request changes on the reviewed content
 */
router.post('/assignments/:id/request-changes', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;
    const { overallFeedback, rating } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const input: SubmitDecisionInput = {
      decision: 'changes_requested',
      overallFeedback,
      rating,
    };

    const assignment = await peerReviewService.submitDecision(id, userId, input);

    res.json({
      success: true,
      assignment,
      message: 'Changes requested',
    });
  } catch (error) {
    console.error('Error requesting changes:', error);
    res.status(500).json({
      error: 'Failed to request changes',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/peer-review/assignments/:id/reject
 * Reject the reviewed content
 */
router.post('/assignments/:id/reject', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;
    const { overallFeedback, rating } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const input: SubmitDecisionInput = {
      decision: 'rejected',
      overallFeedback,
      rating,
    };

    const assignment = await peerReviewService.submitDecision(id, userId, input);

    res.json({
      success: true,
      assignment,
      message: 'Content rejected',
    });
  } catch (error) {
    console.error('Error rejecting content:', error);
    res.status(500).json({
      error: 'Failed to reject content',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// COMMENTS
// ============================================

/**
 * POST /api/peer-review/assignments/:id/comments
 * Add a comment to an assignment
 */
router.post('/assignments/:id/comments', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;
    const input: AddCommentInput = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!input.comment) {
      return res.status(400).json({
        error: 'Missing required field: comment',
      });
    }

    const comment = await peerReviewService.addComment(id, userId, input);

    res.status(201).json({
      success: true,
      comment,
      message: 'Comment added',
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      error: 'Failed to add comment',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/peer-review/assignments/:id/comments
 * Get comments for an assignment
 */
router.get('/assignments/:id/comments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const comments = await peerReviewService.getComments(id);

    res.json({
      success: true,
      comments,
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({
      error: 'Failed to fetch comments',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/peer-review/comments/:id/resolve
 * Resolve a comment
 */
router.post('/comments/:id/resolve', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;
    const input: ResolveCommentInput = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const comment = await peerReviewService.resolveComment(id, userId, input);

    res.json({
      success: true,
      comment,
      message: 'Comment resolved',
    });
  } catch (error) {
    console.error('Error resolving comment:', error);
    res.status(500).json({
      error: 'Failed to resolve comment',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// REVIEWER SUGGESTIONS
// ============================================

/**
 * POST /api/peer-review/suggest-reviewers
 * Get suggested reviewers for a potential request
 */
router.post('/suggest-reviewers', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const suggestions = await peerReviewService.suggestReviewers(userId, req.body);

    res.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error('Error suggesting reviewers:', error);
    res.status(500).json({
      error: 'Failed to suggest reviewers',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// ANALYTICS
// ============================================

/**
 * GET /api/peer-review/analytics
 * Get review analytics for the current user
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const analytics = await peerReviewService.getAnalytics(userId);

    res.json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch analytics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/peer-review/analytics/turnaround
 * Get turnaround time metrics
 */
router.get('/analytics/turnaround', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const metrics = await peerReviewService.getTurnaroundMetrics(userId);

    res.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('Error fetching turnaround metrics:', error);
    res.status(500).json({
      error: 'Failed to fetch turnaround metrics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/peer-review/analytics/themes
 * Get common feedback themes
 */
router.get('/analytics/themes', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const themes = await peerReviewService.getFeedbackThemes(userId);

    res.json({
      success: true,
      themes,
    });
  } catch (error) {
    console.error('Error fetching feedback themes:', error);
    res.status(500).json({
      error: 'Failed to fetch feedback themes',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/peer-review/analytics/workload
 * Get reviewer workload distribution
 */
router.get('/analytics/workload', async (req: Request, res: Response) => {
  try {
    const workload = await peerReviewService.getReviewerWorkload();

    res.json({
      success: true,
      workload,
    });
  } catch (error) {
    console.error('Error fetching workload:', error);
    res.status(500).json({
      error: 'Failed to fetch workload',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// META
// ============================================

/**
 * GET /api/peer-review/meta/content-types
 * Get available content types
 */
router.get('/meta/content-types', (_req: Request, res: Response) => {
  const contentTypes = [
    { value: 'email_draft', label: 'Email Draft', description: 'Outgoing email before sending' },
    { value: 'proposal', label: 'Proposal', description: 'Renewal or expansion proposal' },
    { value: 'document', label: 'Document', description: 'Any document (QBR, report, etc.)' },
    { value: 'action', label: 'Action', description: 'High-stakes action requiring review' },
    { value: 'escalation_response', label: 'Escalation Response', description: 'Response to customer escalation' },
  ];

  res.json({ success: true, contentTypes });
});

/**
 * GET /api/peer-review/meta/review-types
 * Get available review types
 */
router.get('/meta/review-types', (_req: Request, res: Response) => {
  const reviewTypes = [
    { value: 'quality', label: 'Quality', description: 'General quality and effectiveness review' },
    { value: 'accuracy', label: 'Accuracy', description: 'Fact-checking and accuracy verification' },
    { value: 'compliance', label: 'Compliance', description: 'Compliance and policy adherence check' },
    { value: 'coaching', label: 'Coaching', description: 'Developmental feedback for learning' },
  ];

  res.json({ success: true, reviewTypes });
});

/**
 * GET /api/peer-review/meta/urgency-levels
 * Get available urgency levels
 */
router.get('/meta/urgency-levels', (_req: Request, res: Response) => {
  const urgencyLevels = [
    { value: 'low', label: 'Low', description: 'No rush, review when convenient', slaHours: 72 },
    { value: 'normal', label: 'Normal', description: 'Standard priority', slaHours: 24 },
    { value: 'high', label: 'High', description: 'Important, review soon', slaHours: 8 },
    { value: 'urgent', label: 'Urgent', description: 'Critical, review immediately', slaHours: 2 },
  ];

  res.json({ success: true, urgencyLevels });
});

export default router;
