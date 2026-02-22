/**
 * PRD-099: High-Value Feature Released Alert
 * API Routes for Feature Releases
 *
 * Endpoints:
 * - GET    /api/feature-releases              - List releases
 * - POST   /api/feature-releases              - Create a release
 * - GET    /api/feature-releases/:id          - Get release details
 * - PUT    /api/feature-releases/:id          - Update a release
 * - POST   /api/feature-releases/:id/publish  - Publish and match customers
 * - GET    /api/feature-releases/:id/matches  - Get customer matches
 * - GET    /api/feature-releases/:id/stats    - Get adoption stats
 * - POST   /api/feature-releases/matches/:id/announce - Mark as announced
 * - POST   /api/feature-releases/matches/:id/adopt    - Mark as adopted
 * - GET    /api/feature-releases/pending      - Get pending announcements for CSM
 */

import { Router, Request, Response } from 'express';
import { featureReleaseService } from '../services/feature-releases/index.js';
import {
  CreateReleaseRequest,
  PublishReleaseRequest,
  AnnouncementMethod,
} from '../services/feature-releases/types.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// Release CRUD Endpoints
// ============================================

/**
 * GET /api/feature-releases
 * List all product releases
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, category, limit, offset } = req.query;

    const releases = await featureReleaseService.listReleases({
      status: status as string | undefined,
      category: category as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      releases,
      count: releases.length,
    });
  } catch (error) {
    console.error('Error listing releases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list releases',
    });
  }
});

/**
 * POST /api/feature-releases
 * Create a new product release
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'system';
    const data: CreateReleaseRequest = req.body;

    // Validate required fields
    if (!data.featureId || !data.featureName) {
      return res.status(400).json({
        success: false,
        error: 'featureId and featureName are required',
      });
    }

    const release = await featureReleaseService.createRelease(data, userId);

    res.status(201).json({
      success: true,
      release,
    });
  } catch (error) {
    console.error('Error creating release:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to create release',
    });
  }
});

/**
 * GET /api/feature-releases/:id
 * Get release details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const release = await featureReleaseService.getRelease(id);

    if (!release) {
      return res.status(404).json({
        success: false,
        error: 'Release not found',
      });
    }

    res.json({
      success: true,
      release,
    });
  } catch (error) {
    console.error('Error getting release:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get release',
    });
  }
});

/**
 * PUT /api/feature-releases/:id
 * Update a release
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates: Partial<CreateReleaseRequest> = req.body;

    const release = await featureReleaseService.updateRelease(id, updates);

    res.json({
      success: true,
      release,
    });
  } catch (error) {
    console.error('Error updating release:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to update release',
    });
  }
});

// ============================================
// Publish & Match Endpoints
// ============================================

/**
 * POST /api/feature-releases/:id/publish
 * Publish a release and match with customers (FR-1.1 - FR-1.5, FR-2.1)
 */
router.post('/:id/publish', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { minMatchScore, notifyCSMs } = req.body;

    const request: PublishReleaseRequest = {
      releaseId: id,
      minMatchScore: minMatchScore || 60,
      notifyCSMs: notifyCSMs !== false, // Default to true
    };

    const result = await featureReleaseService.publishRelease(request);

    res.json({
      success: true,
      release: result.release,
      matchesFound: result.matchesFound,
      alertsSent: result.alertsSent,
      message: `Published "${result.release.featureName}" and found ${result.matchesFound} matching customers. ${result.alertsSent} CSM alerts sent.`,
    });
  } catch (error) {
    console.error('Error publishing release:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to publish release',
    });
  }
});

/**
 * GET /api/feature-releases/:id/matches
 * Get customer matches for a release
 */
router.get('/:id/matches', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { minScore, announced, limit } = req.query;

    const matches = await featureReleaseService.getMatchesForRelease(id, {
      minScore: minScore ? parseInt(minScore as string) : undefined,
      announced: announced === 'true' ? true : announced === 'false' ? false : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      matches,
      count: matches.length,
    });
  } catch (error) {
    console.error('Error getting matches:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get matches',
    });
  }
});

/**
 * GET /api/feature-releases/:id/stats
 * Get adoption statistics for a release (FR-3.2)
 */
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const stats = await featureReleaseService.getAdoptionStats(id);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stats',
    });
  }
});

// ============================================
// Match Tracking Endpoints
// ============================================

/**
 * POST /api/feature-releases/matches/:id/announce
 * Mark a match as announced (FR-3.1)
 */
router.post('/matches/:id/announce', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { method, notes } = req.body;

    if (!method) {
      return res.status(400).json({
        success: false,
        error: 'method is required (email, call, meeting, or slack)',
      });
    }

    const validMethods: AnnouncementMethod[] = ['email', 'call', 'meeting', 'slack'];
    if (!validMethods.includes(method)) {
      return res.status(400).json({
        success: false,
        error: `Invalid method. Must be one of: ${validMethods.join(', ')}`,
      });
    }

    const match = await featureReleaseService.markAnnounced(id, method, notes);

    res.json({
      success: true,
      match,
      message: `Marked as announced via ${method}`,
    });
  } catch (error) {
    console.error('Error marking announced:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to mark as announced',
    });
  }
});

/**
 * POST /api/feature-releases/matches/:id/adopt
 * Mark a match as adopted (FR-3.2)
 */
router.post('/matches/:id/adopt', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const match = await featureReleaseService.markAdopted(id, notes);

    res.json({
      success: true,
      match,
      message: 'Marked as adopted',
    });
  } catch (error) {
    console.error('Error marking adopted:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to mark as adopted',
    });
  }
});

// ============================================
// CSM Pending Announcements
// ============================================

/**
 * GET /api/feature-releases/pending
 * Get pending announcements for the current CSM
 */
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const pending = await featureReleaseService.getPendingAnnouncements(userId);

    res.json({
      success: true,
      pending,
      count: pending.length,
    });
  } catch (error) {
    console.error('Error getting pending announcements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pending announcements',
    });
  }
});

// ============================================
// Customer-Specific Endpoints
// ============================================

/**
 * GET /api/feature-releases/customer/:customerId
 * Get feature matches for a specific customer
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const matches = await featureReleaseService.getMatchesForCustomer(customerId);

    res.json({
      success: true,
      matches,
      count: matches.length,
    });
  } catch (error) {
    console.error('Error getting customer matches:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get customer matches',
    });
  }
});

export default router;
