/**
 * Multi-Threading Routes
 * PRD-044: Multi-Threading Introduction
 *
 * API endpoints for:
 * - Threading score assessment
 * - Stakeholder gap analysis
 * - Introduction request generation
 * - Introduction tracking
 */

import { Router, Request, Response } from 'express';
import {
  multiThreadService,
  type GenerateIntroRequestInput,
  type IntroductionTarget,
} from '../services/relationships/multiThread.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// Threading Assessment Endpoints
// ============================================

/**
 * GET /api/customers/:id/threading-score
 * Get multi-threading score for a customer
 */
router.get('/:id/threading-score', async (req: Request, res: Response) => {
  try {
    const { id: customerId } = req.params;

    const score = await multiThreadService.getThreadingScore(customerId);

    if (!score) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Customer not found or no stakeholders' },
      });
    }

    res.json({
      customerId,
      score: score.score,
      details: {
        hasChampion: score.hasChampion,
        hasExecSponsor: score.hasExecSponsor,
        decisionMakersCovered: score.decisionMakersCovered,
        totalDecisionMakers: score.totalDecisionMakers,
        departmentsCovered: score.departmentsCovered,
        totalDepartments: score.totalDepartments,
        avgSentimentScore: score.avgSentimentScore,
        engagementGapCount: score.engagementGapCount,
      },
      riskLevel: getRiskLevel(score.score),
    });
  } catch (error) {
    console.error('Error getting threading score:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get threading score' },
    });
  }
});

/**
 * GET /api/customers/:id/stakeholder-gaps
 * Identify missing stakeholder types
 */
router.get('/:id/stakeholder-gaps', async (req: Request, res: Response) => {
  try {
    const { id: customerId } = req.params;

    const gaps = await multiThreadService.getStakeholderGaps(customerId);

    res.json({
      customerId,
      gaps,
      totalGaps: gaps.length,
      criticalGaps: gaps.filter(g => g.importance === 'critical').length,
      highGaps: gaps.filter(g => g.importance === 'high').length,
    });
  } catch (error) {
    console.error('Error getting stakeholder gaps:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get stakeholder gaps' },
    });
  }
});

/**
 * GET /api/customers/:id/threading-assessment
 * Get comprehensive threading assessment
 */
router.get('/:id/threading-assessment', async (req: Request, res: Response) => {
  try {
    const { id: customerId } = req.params;

    const assessment = await multiThreadService.getThreadingAssessment(customerId);

    if (!assessment) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Customer not found' },
      });
    }

    res.json({ assessment });
  } catch (error) {
    console.error('Error getting threading assessment:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get threading assessment' },
    });
  }
});

// ============================================
// Introduction Request Endpoints
// ============================================

/**
 * POST /api/customers/:id/intro-request
 * Generate introduction request email
 */
router.post('/:id/intro-request', async (req: Request, res: Response) => {
  try {
    const { id: customerId } = req.params;
    const {
      championId,
      target,
      context,
    } = req.body as {
      championId: string;
      target: IntroductionTarget;
      context?: {
        reason?: string;
        customMessage?: string;
        keyMetrics?: Array<{ metric: string; value: string }>;
      };
    };

    // Validate required fields
    if (!championId) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'championId is required' },
      });
    }

    if (!target || !target.name || !target.title) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'target with name and title is required' },
      });
    }

    const input: GenerateIntroRequestInput = {
      customerId,
      championId,
      target: {
        stakeholderId: target.stakeholderId,
        name: target.name,
        firstName: target.firstName || target.name.split(' ')[0],
        title: target.title,
        email: target.email,
        department: target.department,
        reason: target.reason || 'Build deeper multi-threaded relationship',
        priority: target.priority || 'high',
      },
      context,
    };

    const result = await multiThreadService.generateIntroRequest(input);

    if (!result) {
      return res.status(500).json({
        error: { code: 'GENERATION_ERROR', message: 'Failed to generate introduction request' },
      });
    }

    res.json({
      request: result.request,
      email: {
        subject: result.email.subject,
        bodyHtml: result.email.bodyHtml,
        bodyText: result.email.bodyText,
        draftIntro: result.email.draftIntroEmail,
        talkingPoints: result.email.talkingPoints,
        suggestedSendTime: result.email.suggestedSendTime,
      },
      assessment: result.assessment,
    });
  } catch (error) {
    console.error('Error generating intro request:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate introduction request' },
    });
  }
});

/**
 * GET /api/customers/:id/intro-requests
 * List introduction requests for a customer
 */
router.get('/:id/intro-requests', async (req: Request, res: Response) => {
  try {
    const { id: customerId } = req.params;
    const { status } = req.query as { status?: 'pending' | 'sent' | 'introduced' | 'declined' | 'no_response' };

    const requests = await multiThreadService.getIntroductionRequests(customerId, status);

    res.json({
      customerId,
      requests,
      total: requests.length,
      byStatus: {
        pending: requests.filter(r => r.status === 'pending').length,
        sent: requests.filter(r => r.status === 'sent').length,
        introduced: requests.filter(r => r.status === 'introduced').length,
        declined: requests.filter(r => r.status === 'declined').length,
        noResponse: requests.filter(r => r.status === 'no_response').length,
      },
    });
  } catch (error) {
    console.error('Error listing intro requests:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list introduction requests' },
    });
  }
});

/**
 * POST /api/customers/:id/intro-requests/:requestId/send
 * Mark introduction request as sent
 */
router.post('/:id/intro-requests/:requestId/send', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;

    const success = await multiThreadService.markIntroRequestSent(requestId);

    if (!success) {
      return res.status(500).json({
        error: { code: 'UPDATE_ERROR', message: 'Failed to mark request as sent' },
      });
    }

    res.json({
      success: true,
      requestId,
      status: 'sent',
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error marking request sent:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to mark request as sent' },
    });
  }
});

/**
 * POST /api/customers/:id/intro-requests/:requestId/introduced
 * Record successful introduction
 */
router.post('/:id/intro-requests/:requestId/introduced', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { targetStakeholderId, notes } = req.body;

    const success = await multiThreadService.recordIntroduction(
      requestId,
      targetStakeholderId,
      notes
    );

    if (!success) {
      return res.status(500).json({
        error: { code: 'UPDATE_ERROR', message: 'Failed to record introduction' },
      });
    }

    res.json({
      success: true,
      requestId,
      status: 'introduced',
      introducedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error recording introduction:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to record introduction' },
    });
  }
});

/**
 * GET /api/customers/:id/intro-suggestions
 * Get suggested introduction targets based on gaps
 */
router.get('/:id/intro-suggestions', async (req: Request, res: Response) => {
  try {
    const { id: customerId } = req.params;
    const { limit = '5' } = req.query;

    const suggestions = await multiThreadService.suggestIntroductionTargets(
      customerId,
      parseInt(limit as string)
    );

    res.json({
      customerId,
      suggestions,
      total: suggestions.length,
    });
  } catch (error) {
    console.error('Error getting intro suggestions:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get introduction suggestions' },
    });
  }
});

// ============================================
// Helper Functions
// ============================================

function getRiskLevel(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score < 30) return 'critical';
  if (score < 50) return 'high';
  if (score < 70) return 'medium';
  return 'low';
}

export { router as multiThreadingRoutes };
export default router;
