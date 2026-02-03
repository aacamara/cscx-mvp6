/**
 * Best Practices API Routes
 * PRD-254: Best Practice Sharing
 *
 * API endpoints for knowledge sharing among CSMs.
 * Enables creating, discovering, and engaging with best practices.
 */

import { Router, Request, Response } from 'express';
import {
  knowledgeSharingService,
  type BestPracticeCategory,
  type BestPracticeStatus,
  type UsageOutcome,
  type SearchFilters,
} from '../services/collaboration/index.js';

const router = Router();

// ============================================
// Helper to get user ID from request
// ============================================
function getUserId(req: Request): string {
  return (req.headers['x-user-id'] as string) || 'demo-user';
}

// ============================================
// CRUD Endpoints
// ============================================

/**
 * GET /api/best-practices
 * List/search best practices
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    const filters: SearchFilters = {
      query: req.query.q as string,
      category: req.query.category as BestPracticeCategory,
      status: (req.query.status as BestPracticeStatus) || 'published',
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      authorId: req.query.author as string,
      isFeatured: req.query.featured === 'true' ? true : req.query.featured === 'false' ? false : undefined,
      sortBy: (req.query.sortBy as SearchFilters['sortBy']) || 'popular',
      limit: parseInt(req.query.limit as string) || 20,
      offset: parseInt(req.query.offset as string) || 0,
    };

    const result = await knowledgeSharingService.search(filters, userId);

    res.json({
      success: true,
      data: {
        bestPractices: result.bestPractices,
        total: result.total,
        hasMore: result.hasMore,
        filters,
      },
    });
  } catch (error) {
    console.error('[BestPractices] List error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list best practices',
    });
  }
});

/**
 * GET /api/best-practices/featured
 * Get featured best practices
 */
router.get('/featured', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const featured = await knowledgeSharingService.getFeatured(limit);

    res.json({
      success: true,
      data: { bestPractices: featured },
    });
  } catch (error) {
    console.error('[BestPractices] Featured error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get featured practices',
    });
  }
});

/**
 * GET /api/best-practices/popular
 * Get popular best practices
 */
router.get('/popular', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const popular = await knowledgeSharingService.getPopular(limit);

    res.json({
      success: true,
      data: { bestPractices: popular },
    });
  } catch (error) {
    console.error('[BestPractices] Popular error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get popular practices',
    });
  }
});

/**
 * GET /api/best-practices/recommended
 * Get recommendations based on context
 */
router.get('/recommended', async (req: Request, res: Response) => {
  try {
    const context = {
      customerId: req.query.customerId as string,
      situation: req.query.situation as string,
      industry: req.query.industry as string,
      keywords: req.query.keywords ? (req.query.keywords as string).split(',') : undefined,
    };

    const recommendations = await knowledgeSharingService.getRecommendations(context);

    res.json({
      success: true,
      data: { recommendations },
    });
  } catch (error) {
    console.error('[BestPractices] Recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recommendations',
    });
  }
});

/**
 * GET /api/best-practices/my
 * Get current user's best practices
 */
router.get('/my', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const status = req.query.status as BestPracticeStatus | undefined;

    const practices = await knowledgeSharingService.getMyPractices(userId, status);

    res.json({
      success: true,
      data: { bestPractices: practices },
    });
  } catch (error) {
    console.error('[BestPractices] My practices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get your practices',
    });
  }
});

/**
 * GET /api/best-practices/saved
 * Get user's saved best practices
 */
router.get('/saved', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const saved = await knowledgeSharingService.getSaved(userId);

    res.json({
      success: true,
      data: { bestPractices: saved },
    });
  } catch (error) {
    console.error('[BestPractices] Saved error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get saved practices',
    });
  }
});

/**
 * GET /api/best-practices/pending-review
 * Get practices pending review (admin/manager)
 */
router.get('/pending-review', async (req: Request, res: Response) => {
  try {
    const pending = await knowledgeSharingService.getPendingReview();

    res.json({
      success: true,
      data: { bestPractices: pending },
    });
  } catch (error) {
    console.error('[BestPractices] Pending review error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pending practices',
    });
  }
});

/**
 * GET /api/best-practices/categories
 * Get category counts
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const counts = await knowledgeSharingService.getCategoryCounts();

    const categories = [
      { id: 'onboarding', label: 'Onboarding', count: counts.onboarding || 0, icon: 'rocket' },
      { id: 'renewal', label: 'Renewal', count: counts.renewal || 0, icon: 'refresh' },
      { id: 'expansion', label: 'Expansion', count: counts.expansion || 0, icon: 'trending-up' },
      { id: 'risk', label: 'Risk Management', count: counts.risk || 0, icon: 'alert-triangle' },
      { id: 'communication', label: 'Communication', count: counts.communication || 0, icon: 'message-circle' },
      { id: 'adoption', label: 'Adoption', count: counts.adoption || 0, icon: 'users' },
      { id: 'general', label: 'General', count: counts.general || 0, icon: 'book' },
    ];

    res.json({
      success: true,
      data: { categories, total: Object.values(counts).reduce((sum, c) => sum + c, 0) },
    });
  } catch (error) {
    console.error('[BestPractices] Categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get categories',
    });
  }
});

/**
 * GET /api/best-practices/stats
 * Get contributor stats for current user
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string || getUserId(req);
    const stats = await knowledgeSharingService.getContributorStats(userId);

    res.json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    console.error('[BestPractices] Stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stats',
    });
  }
});

/**
 * GET /api/best-practices/:id
 * Get a single best practice
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const practice = await knowledgeSharingService.getById(req.params.id, userId);

    if (!practice) {
      return res.status(404).json({
        success: false,
        error: 'Best practice not found',
      });
    }

    // Record view
    await knowledgeSharingService.recordView(req.params.id, userId);

    res.json({
      success: true,
      data: { bestPractice: practice },
    });
  } catch (error) {
    console.error('[BestPractices] Get error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get best practice',
    });
  }
});

/**
 * POST /api/best-practices
 * Create a new best practice
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const {
      title,
      problemStatement,
      solution,
      expectedOutcomes,
      variations,
      pitfalls,
      category,
      tags,
      customerSegment,
      applicableIndustries,
      linkedCustomerIds,
      attachments,
    } = req.body;

    if (!title || !problemStatement || !solution) {
      return res.status(400).json({
        success: false,
        error: 'Title, problem statement, and solution are required',
      });
    }

    const practice = await knowledgeSharingService.create(userId, {
      title,
      problemStatement,
      solution,
      expectedOutcomes,
      variations,
      pitfalls,
      category,
      tags,
      customerSegment,
      applicableIndustries,
      linkedCustomerIds,
      attachments,
    });

    res.status(201).json({
      success: true,
      data: { bestPractice: practice },
    });
  } catch (error) {
    console.error('[BestPractices] Create error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create best practice',
    });
  }
});

/**
 * PATCH /api/best-practices/:id
 * Update a best practice
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const practice = await knowledgeSharingService.update(req.params.id, userId, req.body);

    if (!practice) {
      return res.status(404).json({
        success: false,
        error: 'Best practice not found',
      });
    }

    res.json({
      success: true,
      data: { bestPractice: practice },
    });
  } catch (error) {
    console.error('[BestPractices] Update error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update';
    res.status(400).json({
      success: false,
      error: message,
    });
  }
});

/**
 * DELETE /api/best-practices/:id
 * Delete a draft best practice
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const deleted = await knowledgeSharingService.delete(req.params.id, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Best practice not found',
      });
    }

    res.json({
      success: true,
      message: 'Best practice deleted',
    });
  } catch (error) {
    console.error('[BestPractices] Delete error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete';
    res.status(400).json({
      success: false,
      error: message,
    });
  }
});

// ============================================
// Publishing Workflow Endpoints
// ============================================

/**
 * POST /api/best-practices/:id/submit
 * Submit for review
 */
router.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const practice = await knowledgeSharingService.submitForReview(req.params.id, userId);

    res.json({
      success: true,
      data: { bestPractice: practice },
      message: 'Submitted for review',
    });
  } catch (error) {
    console.error('[BestPractices] Submit error:', error);
    const message = error instanceof Error ? error.message : 'Failed to submit';
    res.status(400).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /api/best-practices/:id/approve
 * Approve and publish (admin/manager)
 */
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const reviewerId = getUserId(req);
    const practice = await knowledgeSharingService.approve(req.params.id, reviewerId);

    res.json({
      success: true,
      data: { bestPractice: practice },
      message: 'Best practice approved and published',
    });
  } catch (error) {
    console.error('[BestPractices] Approve error:', error);
    const message = error instanceof Error ? error.message : 'Failed to approve';
    res.status(400).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /api/best-practices/:id/reject
 * Reject submission (admin/manager)
 */
router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const reviewerId = getUserId(req);
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required',
      });
    }

    const practice = await knowledgeSharingService.reject(req.params.id, reviewerId, reason);

    res.json({
      success: true,
      data: { bestPractice: practice },
      message: 'Best practice rejected',
    });
  } catch (error) {
    console.error('[BestPractices] Reject error:', error);
    const message = error instanceof Error ? error.message : 'Failed to reject';
    res.status(400).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /api/best-practices/:id/archive
 * Archive a published practice
 */
router.post('/:id/archive', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const practice = await knowledgeSharingService.archive(req.params.id, userId);

    res.json({
      success: true,
      data: { bestPractice: practice },
      message: 'Best practice archived',
    });
  } catch (error) {
    console.error('[BestPractices] Archive error:', error);
    const message = error instanceof Error ? error.message : 'Failed to archive';
    res.status(400).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /api/best-practices/:id/feature
 * Feature/unfeature a practice (admin)
 */
router.post('/:id/feature', async (req: Request, res: Response) => {
  try {
    const { featured, reason } = req.body;
    const practice = await knowledgeSharingService.setFeatured(
      req.params.id,
      featured !== false,
      reason
    );

    res.json({
      success: true,
      data: { bestPractice: practice },
      message: featured !== false ? 'Best practice featured' : 'Best practice unfeatured',
    });
  } catch (error) {
    console.error('[BestPractices] Feature error:', error);
    const message = error instanceof Error ? error.message : 'Failed to feature';
    res.status(400).json({
      success: false,
      error: message,
    });
  }
});

// ============================================
// Engagement Endpoints
// ============================================

/**
 * POST /api/best-practices/:id/vote
 * Vote on a best practice
 */
router.post('/:id/vote', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { vote } = req.body; // 1, -1, or 0 (remove vote)

    if (vote === undefined || ![1, -1, 0].includes(vote)) {
      return res.status(400).json({
        success: false,
        error: 'Vote must be 1 (upvote), -1 (downvote), or 0 (remove)',
      });
    }

    const result = await knowledgeSharingService.vote(req.params.id, userId, vote);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[BestPractices] Vote error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record vote',
    });
  }
});

/**
 * POST /api/best-practices/:id/save
 * Save to personal collection
 */
router.post('/:id/save', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { collection } = req.body;

    const saved = await knowledgeSharingService.save(req.params.id, userId, collection);

    res.json({
      success: saved,
      message: saved ? 'Saved to collection' : 'Already saved',
    });
  } catch (error) {
    console.error('[BestPractices] Save error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save',
    });
  }
});

/**
 * DELETE /api/best-practices/:id/save
 * Remove from saved
 */
router.delete('/:id/save', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const removed = await knowledgeSharingService.unsave(req.params.id, userId);

    res.json({
      success: removed,
      message: removed ? 'Removed from saved' : 'Not saved',
    });
  } catch (error) {
    console.error('[BestPractices] Unsave error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unsave',
    });
  }
});

/**
 * POST /api/best-practices/:id/use
 * Record usage of a best practice
 */
router.post('/:id/use', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { customerId, outcome, notes } = req.body;

    const usage = await knowledgeSharingService.recordUsage(
      req.params.id,
      userId,
      customerId,
      outcome as UsageOutcome,
      notes
    );

    res.json({
      success: true,
      data: { usage },
      message: 'Usage recorded',
    });
  } catch (error) {
    console.error('[BestPractices] Record usage error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record usage',
    });
  }
});

// ============================================
// Comments Endpoints
// ============================================

/**
 * GET /api/best-practices/:id/comments
 * Get comments for a best practice
 */
router.get('/:id/comments', async (req: Request, res: Response) => {
  try {
    const comments = await knowledgeSharingService.getComments(req.params.id);

    res.json({
      success: true,
      data: { comments },
    });
  } catch (error) {
    console.error('[BestPractices] Get comments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get comments',
    });
  }
});

/**
 * POST /api/best-practices/:id/comments
 * Add a comment
 */
router.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { content, parentCommentId, isQuestion, userName } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Comment content is required',
      });
    }

    const comment = await knowledgeSharingService.addComment(
      req.params.id,
      userId,
      content,
      { parentCommentId, isQuestion, userName }
    );

    res.status(201).json({
      success: true,
      data: { comment },
    });
  } catch (error) {
    console.error('[BestPractices] Add comment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add comment',
    });
  }
});

/**
 * PATCH /api/best-practice-comments/:id
 * Update a comment
 */
router.patch('/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Comment content is required',
      });
    }

    const comment = await knowledgeSharingService.updateComment(
      req.params.commentId,
      userId,
      content
    );

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found or not authorized',
      });
    }

    res.json({
      success: true,
      data: { comment },
    });
  } catch (error) {
    console.error('[BestPractices] Update comment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update comment',
    });
  }
});

/**
 * POST /api/best-practice-comments/:id/resolve
 * Resolve a question
 */
router.post('/comments/:commentId/resolve', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const resolved = await knowledgeSharingService.resolveQuestion(req.params.commentId, userId);

    res.json({
      success: resolved,
      message: resolved ? 'Question resolved' : 'Not a question or already resolved',
    });
  } catch (error) {
    console.error('[BestPractices] Resolve question error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve question',
    });
  }
});

export default router;
