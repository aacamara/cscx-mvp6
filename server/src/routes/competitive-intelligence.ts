/**
 * Competitive Intelligence Routes (PRD-068)
 *
 * API endpoints for account-specific competitive intelligence.
 *
 * Endpoints:
 * - GET  /api/intelligence/competitive/:customerId  - Get competitive intel for account
 * - POST /api/intelligence/competitive/mention      - Record a competitive mention
 * - GET  /api/intelligence/competitive/battle-card/:competitorId - Get battle card
 * - GET  /api/intelligence/competitive/portfolio-risk - Portfolio-wide competitive risk
 */

import { Router, Request, Response } from 'express';
import { competitiveIntelligenceService } from '../services/competitiveIntelligence.js';

const router = Router();

/**
 * GET /api/intelligence/competitive/:customerId
 *
 * Generate comprehensive competitive intelligence for a specific customer.
 *
 * Query Parameters:
 * - period (optional): '30d', '90d', '6m', '1y' (default: 12m)
 */
router.get('/competitive/:customerId', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { customerId } = req.params;
    const { period } = req.query;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required'
        }
      });
    }

    const intelligence = await competitiveIntelligenceService.generateIntelligence(
      customerId,
      period as string | undefined
    );

    if (!intelligence) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ACCOUNT_NOT_FOUND',
          message: `Could not find an account with ID '${customerId}'`
        }
      });
    }

    const responseTime = Date.now() - startTime;

    // Log performance
    console.log(`[Competitive Intel] Generated for ${intelligence.accountName} in ${responseTime}ms`);

    // Warn if over target
    if (responseTime > 5000) {
      console.warn(`[Competitive Intel] Generation exceeded 5s target: ${responseTime}ms`);
    }

    return res.json({
      success: true,
      data: intelligence,
      meta: {
        generatedAt: intelligence.generatedAt,
        responseTimeMs: responseTime,
        dataCompleteness: intelligence.dataCompleteness,
        riskLevel: intelligence.riskLevel
      }
    });
  } catch (error) {
    console.error('[Competitive Intel] Error generating intelligence:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate competitive intelligence'
      }
    });
  }
});

/**
 * POST /api/intelligence/competitive/mention
 *
 * Record a new competitive mention for a customer.
 *
 * Request Body:
 * - customerId (required): UUID of the customer
 * - competitorName (required): Name of the competitor mentioned
 * - sourceType (required): 'meeting', 'email', 'support_ticket', 'qbr', 'manual'
 * - sourceText (required): The text containing the mention
 * - sourceId (optional): UUID of the source record
 * - context (optional): Additional context
 * - mentionedBy (optional): Who mentioned the competitor
 * - mentionedAt (optional): When it was mentioned (defaults to now)
 */
router.post('/competitive/mention', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      competitorName,
      sourceType,
      sourceText,
      sourceId,
      context,
      mentionedBy,
      mentionedAt
    } = req.body;

    // Validate required fields
    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required'
        }
      });
    }

    if (!competitorName) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_COMPETITOR_NAME',
          message: 'Competitor name is required'
        }
      });
    }

    if (!sourceType) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SOURCE_TYPE',
          message: 'Source type is required'
        }
      });
    }

    if (!sourceText) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SOURCE_TEXT',
          message: 'Source text is required'
        }
      });
    }

    const validSourceTypes = ['meeting', 'email', 'support_ticket', 'qbr', 'manual'];
    if (!validSourceTypes.includes(sourceType)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SOURCE_TYPE',
          message: `Source type must be one of: ${validSourceTypes.join(', ')}`
        }
      });
    }

    const mention = await competitiveIntelligenceService.recordMention({
      customerId,
      competitorName,
      sourceType,
      sourceId,
      sourceText,
      context,
      mentionedBy,
      mentionedAt
    });

    if (!mention) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'RECORD_FAILED',
          message: 'Failed to record competitive mention'
        }
      });
    }

    console.log(`[Competitive Intel] Recorded mention of ${competitorName} for customer ${customerId}`);

    return res.status(201).json({
      success: true,
      data: mention,
      message: 'Competitive mention recorded successfully'
    });
  } catch (error) {
    console.error('[Competitive Intel] Error recording mention:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to record competitive mention'
      }
    });
  }
});

/**
 * GET /api/intelligence/competitive/battle-card/:competitorId
 *
 * Get battle card for a specific competitor.
 */
router.get('/competitive/battle-card/:competitorId', async (req: Request, res: Response) => {
  try {
    const { competitorId } = req.params;

    if (!competitorId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_COMPETITOR_ID',
          message: 'Competitor ID is required'
        }
      });
    }

    const battleCard = await competitiveIntelligenceService.getBattleCard(competitorId);

    if (!battleCard) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'BATTLE_CARD_NOT_FOUND',
          message: 'No battle card found for this competitor'
        }
      });
    }

    return res.json({
      success: true,
      data: battleCard
    });
  } catch (error) {
    console.error('[Competitive Intel] Error fetching battle card:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch battle card'
      }
    });
  }
});

/**
 * POST /api/intelligence/competitive/detect
 *
 * Detect competitors from text using AI.
 * Useful for real-time detection in meeting transcripts or emails.
 *
 * Request Body:
 * - text (required): Text to analyze for competitor mentions
 * - customerId (optional): Customer context
 */
router.post('/competitive/detect', async (req: Request, res: Response) => {
  try {
    const { text, customerId } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TEXT',
          message: 'Text to analyze is required'
        }
      });
    }

    // List of known competitors to detect
    // In production, this would come from the competitors table
    const knownCompetitors = [
      'CompetitorX', 'CompetitorY', 'CompetitorZ',
      'Gainsight', 'ChurnZero', 'Totango', 'ClientSuccess',
      'Planhat', 'Catalyst', 'Vitally', 'Custify'
    ];

    const textLower = text.toLowerCase();
    const detectedCompetitors: Array<{
      name: string;
      confidence: number;
      context: string;
    }> = [];

    knownCompetitors.forEach(competitor => {
      const competitorLower = competitor.toLowerCase();
      if (textLower.includes(competitorLower)) {
        // Extract surrounding context
        const index = textLower.indexOf(competitorLower);
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + competitor.length + 50);
        const context = text.substring(start, end).trim();

        detectedCompetitors.push({
          name: competitor,
          confidence: 1.0,
          context: `...${context}...`
        });
      }
    });

    return res.json({
      success: true,
      data: {
        competitorsDetected: detectedCompetitors.length > 0,
        competitors: detectedCompetitors,
        analyzedLength: text.length
      }
    });
  } catch (error) {
    console.error('[Competitive Intel] Error detecting competitors:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to detect competitors'
      }
    });
  }
});

/**
 * GET /api/intelligence/competitive/alerts/:customerId
 *
 * Get active competitive alerts for a customer.
 * These are triggered based on competitive mention patterns.
 */
router.get('/competitive/alerts/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required'
        }
      });
    }

    // Generate intelligence to check for alert conditions
    const intelligence = await competitiveIntelligenceService.generateIntelligence(customerId);

    if (!intelligence) {
      return res.json({
        success: true,
        data: {
          alerts: [],
          riskLevel: 'unknown'
        }
      });
    }

    const alerts: Array<{
      type: string;
      priority: 'critical' | 'high' | 'medium';
      message: string;
      competitor?: string;
      detectedAt: string;
    }> = [];

    // Check for new competitor evaluation
    if (intelligence.activeThreats.length > 0) {
      intelligence.activeThreats.forEach(threat => {
        alerts.push({
          type: 'active_evaluation',
          priority: 'critical',
          message: `${threat.competitorName} is being actively evaluated`,
          competitor: threat.competitorName,
          detectedAt: threat.lastMentioned || new Date().toISOString()
        });
      });
    }

    // Check for mention frequency spike
    const recentTrend = intelligence.mentionTrend.slice(-2);
    if (recentTrend.length === 2 && recentTrend[1].count > recentTrend[0].count * 2) {
      alerts.push({
        type: 'mention_spike',
        priority: 'high',
        message: `Competitive mentions have doubled compared to last quarter`,
        detectedAt: new Date().toISOString()
      });
    }

    // Check for "evaluating alternatives" language
    if (intelligence.riskScore >= 70) {
      alerts.push({
        type: 'high_risk',
        priority: 'critical',
        message: `Account has critical competitive risk score (${intelligence.riskScore}/100)`,
        detectedAt: new Date().toISOString()
      });
    }

    return res.json({
      success: true,
      data: {
        alerts: alerts.sort((a, b) => {
          const priorityOrder = { critical: 0, high: 1, medium: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }),
        riskLevel: intelligence.riskLevel,
        riskScore: intelligence.riskScore
      }
    });
  } catch (error) {
    console.error('[Competitive Intel] Error fetching alerts:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch competitive alerts'
      }
    });
  }
});

export default router;
