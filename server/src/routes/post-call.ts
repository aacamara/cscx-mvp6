/**
 * Post-Call Processing API Routes
 * PRD-116: Endpoints for triggering and managing post-call processing
 *
 * Endpoints:
 * - POST /api/workflows/post-call/trigger - Manually trigger processing
 * - GET /api/workflows/post-call/:resultId/status - Check processing status
 * - GET /api/workflows/post-call/results - List recent results
 * - GET /api/workflows/post-call/:resultId - Get full result details
 */

import { Router, Request, Response } from 'express';
import {
  postCallProcessingService,
  type TriggerPostCallRequest,
} from '../services/post-call-processing/index.js';

const router = Router();

// ============================================
// POST /api/workflows/post-call/trigger
// Manually trigger post-call processing
// ============================================
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const {
      meetingId,
      customerId,
      transcriptText,
      transcriptUrl,
      meetingTitle,
      meetingDate,
      durationMinutes,
      participants,
      source,
    } = req.body;

    // Validate required fields
    if (!meetingId) {
      return res.status(400).json({
        error: 'Missing required field: meetingId',
      });
    }

    if (!transcriptText && !transcriptUrl) {
      return res.status(400).json({
        error: 'Either transcriptText or transcriptUrl is required',
      });
    }

    const request: TriggerPostCallRequest = {
      meetingId,
      customerId,
      transcriptText,
      transcriptUrl,
      meetingTitle,
      meetingDate,
      durationMinutes,
      participants,
      source,
    };

    const result = await postCallProcessingService.triggerProcessing(
      userId,
      request,
      'manual'
    );

    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'Failed to trigger processing',
      });
    }

    res.status(202).json({
      success: true,
      message: 'Post-call processing triggered',
      resultId: result.resultId,
      statusUrl: `/api/workflows/post-call/${result.resultId}/status`,
    });
  } catch (error) {
    console.error('Error triggering post-call processing:', error);
    res.status(500).json({
      error: 'Failed to trigger post-call processing',
      details: (error as Error).message,
    });
  }
});

// ============================================
// GET /api/workflows/post-call/:resultId/status
// Check processing status
// ============================================
router.get('/:resultId/status', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { resultId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const status = await postCallProcessingService.getProcessingStatus(resultId);

    if (!status) {
      return res.status(404).json({ error: 'Processing result not found' });
    }

    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('Error getting processing status:', error);
    res.status(500).json({
      error: 'Failed to get processing status',
      details: (error as Error).message,
    });
  }
});

// ============================================
// GET /api/workflows/post-call/results
// List recent processing results
// ============================================
router.get('/results', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { limit, customerId } = req.query;

    const results = await postCallProcessingService.getRecentResults(
      userId,
      limit ? parseInt(limit as string, 10) : 20,
      customerId as string | undefined
    );

    res.json({
      success: true,
      results,
      count: results.length,
    });
  } catch (error) {
    console.error('Error listing processing results:', error);
    res.status(500).json({
      error: 'Failed to list processing results',
      details: (error as Error).message,
    });
  }
});

// ============================================
// GET /api/workflows/post-call/:resultId
// Get full processing result details
// ============================================
router.get('/:resultId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { resultId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const result = await postCallProcessingService.getProcessingResult(resultId);

    if (!result) {
      return res.status(404).json({ error: 'Processing result not found' });
    }

    // Verify ownership
    if (result.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this result' });
    }

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Error getting processing result:', error);
    res.status(500).json({
      error: 'Failed to get processing result',
      details: (error as Error).message,
    });
  }
});

export default router;
