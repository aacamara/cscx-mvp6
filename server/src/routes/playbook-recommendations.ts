/**
 * Playbook Recommendations API Routes
 * PRD-232: Automated Playbook Selection
 *
 * Provides endpoints for AI-powered playbook recommendations,
 * including recommendation retrieval, approval, and trigger evaluation.
 */

import { Router, Request, Response } from 'express';
import {
  getPlaybookRecommendation,
  startRecommendedPlaybook,
  declineRecommendation,
  getPendingRecommendations,
  evaluateTriggers,
} from '../services/ai/playbook-selector.js';

const router = Router();

/**
 * GET /api/customers/:id/recommended-playbook
 * Get AI-recommended playbook for a specific customer
 */
router.get('/customers/:id/recommended-playbook', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    const recommendation = await getPlaybookRecommendation(id);

    res.json({
      customer_id: recommendation.customer_id,
      customer_name: recommendation.customer_name,
      recommended_playbook: {
        id: recommendation.recommended_playbook.id,
        name: recommendation.recommended_playbook.name,
        description: recommendation.recommended_playbook.description,
        duration_days: recommendation.recommended_playbook.duration_days,
        steps_count: recommendation.recommended_playbook.steps_count,
      },
      fit_score: recommendation.fit_score,
      reasoning: recommendation.reasoning,
      alternative_playbooks: recommendation.alternative_playbooks,
      trigger_type: recommendation.trigger_type,
      trigger_event: recommendation.trigger_event,
      status: recommendation.status,
      recommendation_id: recommendation.id,
    });
  } catch (error) {
    console.error('Error getting playbook recommendation:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/customers/:id/start-playbook
 * Start a playbook for a customer (from recommendation or manual selection)
 */
router.post('/customers/:id/start-playbook', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { playbook_id, recommendation_id, override_reason } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    if (!playbook_id) {
      return res.status(400).json({ error: 'Playbook ID is required' });
    }

    const result = await startRecommendedPlaybook(
      id,
      playbook_id,
      recommendation_id,
      override_reason
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.status(201).json({
      success: true,
      execution_id: result.executionId,
      message: 'Playbook started successfully',
    });
  } catch (error) {
    console.error('Error starting playbook:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/playbook-recommendations
 * Get all pending playbook recommendations for the current user
 */
router.get('/playbook-recommendations', async (req: Request, res: Response) => {
  try {
    const recommendations = await getPendingRecommendations();

    res.json({
      recommendations,
      total: recommendations.length,
    });
  } catch (error) {
    console.error('Error getting pending recommendations:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/playbook-recommendations/:id/approve
 * Approve and start a recommended playbook
 */
router.post('/playbook-recommendations/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { customer_id, playbook_id } = req.body;

    if (!customer_id || !playbook_id) {
      return res.status(400).json({
        error: 'customer_id and playbook_id are required',
      });
    }

    const result = await startRecommendedPlaybook(customer_id, playbook_id, id);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      execution_id: result.executionId,
      message: 'Recommendation approved and playbook started',
    });
  } catch (error) {
    console.error('Error approving recommendation:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/playbook-recommendations/:id/decline
 * Decline a playbook recommendation
 */
router.post('/playbook-recommendations/:id/decline', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await declineRecommendation(id, reason);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      message: 'Recommendation declined',
    });
  } catch (error) {
    console.error('Error declining recommendation:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/playbook-recommendations/evaluate-trigger
 * Evaluate a trigger event and generate recommendation if conditions are met
 */
router.post('/playbook-recommendations/evaluate-trigger', async (req: Request, res: Response) => {
  try {
    const { customer_id, event_type } = req.body;

    if (!customer_id || !event_type) {
      return res.status(400).json({
        error: 'customer_id and event_type are required',
      });
    }

    const recommendation = await evaluateTriggers(customer_id, event_type);

    if (!recommendation) {
      return res.json({
        triggered: false,
        message: 'No playbook triggers matched',
      });
    }

    res.json({
      triggered: true,
      recommendation: {
        id: recommendation.id,
        customer_id: recommendation.customer_id,
        customer_name: recommendation.customer_name,
        recommended_playbook: {
          id: recommendation.recommended_playbook.id,
          name: recommendation.recommended_playbook.name,
          description: recommendation.recommended_playbook.description,
        },
        fit_score: recommendation.fit_score,
        reasoning: recommendation.reasoning,
        trigger_type: recommendation.trigger_type,
        trigger_event: recommendation.trigger_event,
        status: recommendation.status,
      },
    });
  } catch (error) {
    console.error('Error evaluating trigger:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/playbook-recommendations/stats
 * Get statistics on playbook recommendations and outcomes
 */
router.get('/playbook-recommendations/stats', async (req: Request, res: Response) => {
  try {
    // For now, return mock stats. In production, this would query the database.
    res.json({
      total_recommendations: 45,
      accepted_rate: 0.82,
      outcomes: {
        success: 28,
        partial: 8,
        failed: 2,
        in_progress: 7,
      },
      by_trigger_type: {
        automatic: 12,
        suggested: 25,
        manual: 8,
      },
      avg_fit_score: 78,
      top_playbooks: [
        { playbook_id: 'save-play-standard', count: 15, success_rate: 0.73 },
        { playbook_id: 'renewal-90day', count: 12, success_rate: 0.85 },
        { playbook_id: 'adoption-standard', count: 10, success_rate: 0.80 },
      ],
    });
  } catch (error) {
    console.error('Error getting recommendation stats:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as playbookRecommendationsRoutes };
