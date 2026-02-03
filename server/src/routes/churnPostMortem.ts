/**
 * Churn Post-Mortem API Routes (PRD-124)
 *
 * Endpoints for automated churn post-mortem workflows:
 * - POST /api/churn/post-mortem - Initiate post-mortem
 * - GET /api/churn/post-mortem/:id - Get post-mortem details
 * - PUT /api/churn/post-mortem/:id/root-cause - Set root cause
 * - POST /api/churn/post-mortem/:id/compile - Compile customer data
 * - POST /api/churn/post-mortem/:id/analyze - Generate AI analysis
 * - POST /api/churn/post-mortem/:id/schedule-review - Schedule review
 * - POST /api/churn/post-mortem/:id/complete - Complete analysis
 * - GET /api/churn/analysis/patterns - Get churn patterns
 * - GET /api/churn/post-mortems - List post-mortems
 */

import { Router, Request, Response } from 'express';
import { churnPostMortemService } from '../services/churnPostMortem.js';
import { logger } from '../services/logger.js';

const router = Router();

// ============================================
// POST /api/churn/post-mortem
// Initiate a new post-mortem
// ============================================
router.post('/post-mortem', async (req: Request, res: Response) => {
  try {
    const { customerId, churnDate, detectionSource, arrLost } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'customerId is required'
      });
    }

    const postMortem = await churnPostMortemService.initiatePostMortem({
      customerId,
      churnDate,
      detectionSource,
      arrLost,
      createdBy: userId
    });

    res.status(201).json({
      success: true,
      postMortem,
      message: 'Post-mortem initiated successfully'
    });
  } catch (error) {
    logger.error('Failed to initiate post-mortem', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initiate post-mortem'
    });
  }
});

// ============================================
// GET /api/churn/post-mortem/:id
// Get post-mortem details
// ============================================
router.get('/post-mortem/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await churnPostMortemService.getPostMortem(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Post-mortem not found'
      });
    }

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Failed to get post-mortem', { error, id: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get post-mortem'
    });
  }
});

// ============================================
// PUT /api/churn/post-mortem/:id/root-cause
// Set root cause classification
// ============================================
router.put('/post-mortem/:id/root-cause', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { primary, contributing, customNotes } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!primary) {
      return res.status(400).json({
        success: false,
        error: 'primary root cause is required'
      });
    }

    const postMortem = await churnPostMortemService.setRootCause(
      id,
      { primary, contributing, customNotes },
      userId
    );

    res.json({
      success: true,
      postMortem
    });
  } catch (error) {
    logger.error('Failed to set root cause', { error, id: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set root cause'
    });
  }
});

// ============================================
// POST /api/churn/post-mortem/:id/compile
// Compile customer history data
// ============================================
router.post('/post-mortem/:id/compile', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    const dataCompilation = await churnPostMortemService.compileData(id, userId);

    res.json({
      success: true,
      dataCompilation,
      message: 'Data compiled successfully'
    });
  } catch (error) {
    logger.error('Failed to compile data', { error, id: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to compile data'
    });
  }
});

// ============================================
// POST /api/churn/post-mortem/:id/analyze
// Generate AI-powered analysis
// ============================================
router.post('/post-mortem/:id/analyze', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    const analysis = await churnPostMortemService.generateAnalysis(id, userId);

    res.json({
      success: true,
      analysis,
      message: 'Analysis generated successfully'
    });
  } catch (error) {
    logger.error('Failed to generate analysis', { error, id: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate analysis'
    });
  }
});

// ============================================
// POST /api/churn/post-mortem/:id/schedule-review
// Schedule post-mortem review meeting
// ============================================
router.post('/post-mortem/:id/schedule-review', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { scheduledAt, attendees } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!scheduledAt || !attendees || !Array.isArray(attendees)) {
      return res.status(400).json({
        success: false,
        error: 'scheduledAt and attendees array are required'
      });
    }

    const postMortem = await churnPostMortemService.scheduleReview(
      id,
      scheduledAt,
      attendees,
      userId
    );

    res.json({
      success: true,
      postMortem,
      message: 'Review scheduled successfully'
    });
  } catch (error) {
    logger.error('Failed to schedule review', { error, id: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to schedule review'
    });
  }
});

// ============================================
// POST /api/churn/post-mortem/:id/complete
// Complete the post-mortem
// ============================================
router.post('/post-mortem/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reviewOutcome, lessonsLearned, recommendations, winBackAssessment } = req.body;
    const userId = req.headers['x-user-id'] as string;

    const postMortem = await churnPostMortemService.completePostMortem(
      id,
      { reviewOutcome, lessonsLearned, recommendations, winBackAssessment },
      userId
    );

    res.json({
      success: true,
      postMortem,
      message: 'Post-mortem completed successfully'
    });
  } catch (error) {
    logger.error('Failed to complete post-mortem', { error, id: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete post-mortem'
    });
  }
});

// ============================================
// GET /api/churn/analysis/patterns
// Get churn pattern analysis
// ============================================
router.get('/analysis/patterns', async (req: Request, res: Response) => {
  try {
    const { periodStart, periodEnd } = req.query;

    const patterns = await churnPostMortemService.getPatterns({
      periodStart: periodStart as string | undefined,
      periodEnd: periodEnd as string | undefined
    });

    res.json({
      success: true,
      patterns,
      period: {
        start: periodStart || 'all',
        end: periodEnd || 'all'
      }
    });
  } catch (error) {
    logger.error('Failed to get patterns', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get patterns'
    });
  }
});

// ============================================
// GET /api/churn/post-mortems
// List post-mortems with filters
// ============================================
router.get('/post-mortems', async (req: Request, res: Response) => {
  try {
    const { status, customerId, fromDate, toDate, limit, offset } = req.query;

    const result = await churnPostMortemService.listPostMortems({
      status: status as string | undefined,
      customerId: customerId as string | undefined,
      fromDate: fromDate as string | undefined,
      toDate: toDate as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Failed to list post-mortems', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list post-mortems'
    });
  }
});

// ============================================
// GET /api/churn/dashboard
// Get churn dashboard data
// ============================================
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    // Get patterns for summary
    const patterns = await churnPostMortemService.getPatterns();

    // Get recent post-mortems
    const { postMortems: recentPostMortems } = await churnPostMortemService.listPostMortems({
      limit: 10
    });

    // Get pending post-mortems (not completed)
    const { postMortems: pendingPostMortems, total: pendingCount } = await churnPostMortemService.listPostMortems({
      status: 'initiated' as const
    });

    res.json({
      success: true,
      dashboard: {
        summary: patterns.summary,
        rootCauseDistribution: patterns.rootCauseDistribution,
        monthlyTrends: patterns.monthlyTrends,
        winBackPipeline: patterns.winBackPipeline,
        recentPostMortems,
        pendingPostMortems: pendingPostMortems.slice(0, 5),
        pendingCount
      }
    });
  } catch (error) {
    logger.error('Failed to get dashboard', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get dashboard'
    });
  }
});

export default router;
