/**
 * Coaching API Routes (PRD-239)
 *
 * Endpoints for AI-powered CSM coaching:
 * - POST /api/coaching/guidance - Get situational guidance
 * - POST /api/coaching/feedback - Get interaction feedback
 * - GET /api/coaching/skills - Get skill assessment
 * - GET /api/coaching/progress - Get progress over time
 * - GET /api/coaching/weekly-summary - Generate weekly summary
 */

import { Router, Request, Response } from 'express';
import {
  coachingService,
  SituationType,
  GuidanceRequest,
  FeedbackRequest,
} from '../services/ai/coaching.js';
import { config } from '../config/index.js';

const router = Router();

// Demo user ID - ONLY used in development mode
const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';

/**
 * Get user ID from request.
 * SECURITY: Demo user fallback ONLY allowed in development mode.
 */
const getUserId = (req: Request): string | null => {
  // Prefer userId from auth middleware (set by JWT verification)
  if ((req as any).userId) {
    return (req as any).userId;
  }

  // Development only: allow demo user for local testing
  if (config.nodeEnv === 'development') {
    return DEMO_USER_ID;
  }

  // Production: no fallback - must be authenticated
  return null;
};

// Valid situation types for validation
const VALID_SITUATION_TYPES: SituationType[] = [
  'champion_departure',
  'champion_promotion',
  'escalation',
  'churn_risk',
  'expansion_opportunity',
  'difficult_conversation',
  'stakeholder_mapping',
  'renewal_negotiation',
  'onboarding_stall',
  'product_feedback',
  'competitor_threat',
  'executive_engagement',
  'general',
];

// Valid interaction types for feedback
const VALID_INTERACTION_TYPES = ['email', 'call', 'meeting', 'presentation'];

/**
 * POST /api/coaching/guidance
 * Get situational guidance from the AI coach
 */
router.post('/guidance', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const {
      customerId,
      customerName,
      situationType,
      situationDescription,
      additionalContext,
    } = req.body;

    // Validate required fields
    if (!situationType) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'situationType is required',
      });
    }

    if (!situationDescription) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'situationDescription is required',
      });
    }

    // Validate situation type
    if (!VALID_SITUATION_TYPES.includes(situationType)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid situationType. Valid types: ${VALID_SITUATION_TYPES.join(', ')}`,
      });
    }

    console.log('[Coaching] Guidance request:', {
      userId,
      situationType,
      customerName,
      descriptionLength: situationDescription.length,
    });

    const request: GuidanceRequest = {
      userId,
      customerId,
      customerName,
      situationType,
      situationDescription,
      additionalContext,
    };

    const guidance = await coachingService.getGuidance(request);

    res.json({
      success: true,
      data: guidance,
    });
  } catch (error) {
    console.error('Coaching guidance error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/coaching/feedback
 * Get feedback on a customer interaction
 */
router.post('/feedback', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const {
      customerId,
      interactionType,
      interactionDescription,
      outcome,
      selfAssessment,
    } = req.body;

    // Validate required fields
    if (!interactionType) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'interactionType is required',
      });
    }

    if (!interactionDescription) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'interactionDescription is required',
      });
    }

    // Validate interaction type
    if (!VALID_INTERACTION_TYPES.includes(interactionType)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid interactionType. Valid types: ${VALID_INTERACTION_TYPES.join(', ')}`,
      });
    }

    console.log('[Coaching] Feedback request:', {
      userId,
      interactionType,
      descriptionLength: interactionDescription.length,
    });

    const request: FeedbackRequest = {
      userId,
      customerId,
      interactionType,
      interactionDescription,
      outcome,
      selfAssessment,
    };

    const feedback = await coachingService.getFeedback(request);

    res.json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    console.error('Coaching feedback error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/coaching/skills
 * Get skill assessment for the current user
 */
router.get('/skills', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    console.log('[Coaching] Skills request:', { userId });

    const skills = await coachingService.getSkillAssessment(userId);

    res.json({
      success: true,
      data: skills,
    });
  } catch (error) {
    console.error('Coaching skills error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/coaching/progress
 * Get coaching progress over time
 */
router.get('/progress', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    console.log('[Coaching] Progress request:', { userId });

    const progress = await coachingService.getProgress(userId);

    res.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error('Coaching progress error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/coaching/weekly-summary
 * Generate weekly coaching summary
 */
router.get('/weekly-summary', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    console.log('[Coaching] Weekly summary request:', { userId });

    const summary = await coachingService.generateWeeklySummary(userId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Weekly summary error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/coaching/situation-types
 * Get available situation types for guidance
 */
router.get('/situation-types', (_req: Request, res: Response) => {
  const situationTypes = VALID_SITUATION_TYPES.map(type => ({
    value: type,
    label: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    description: getSituationDescription(type),
  }));

  res.json({
    success: true,
    data: situationTypes,
  });
});

function getSituationDescription(type: SituationType): string {
  const descriptions: Record<SituationType, string> = {
    champion_departure: 'Your primary champion is leaving the company',
    champion_promotion: 'Your champion has been promoted to a higher role',
    escalation: 'Handling a customer escalation or complaint',
    churn_risk: 'Signs indicate the customer may not renew',
    expansion_opportunity: 'Potential to grow the account',
    difficult_conversation: 'Having a challenging discussion with a customer',
    stakeholder_mapping: 'Building relationships with multiple stakeholders',
    renewal_negotiation: 'Negotiating contract renewal terms',
    onboarding_stall: 'Customer onboarding has stalled or slowed',
    product_feedback: 'Customer has provided negative product feedback',
    competitor_threat: 'Competitor is actively pursuing your customer',
    executive_engagement: 'Engaging with C-level executives',
    general: 'General customer success question or situation',
  };
  return descriptions[type];
}

export default router;
