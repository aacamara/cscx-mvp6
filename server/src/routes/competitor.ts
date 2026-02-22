/**
 * Competitor Intelligence Routes
 * PRD-094: Competitor Mentioned - Battle Card
 *
 * API endpoints for competitor detection, battle cards, and alerts
 */

import { Router, Request, Response } from 'express';
import {
  competitorIntelligenceService,
  competitorDetector,
  battleCardService,
} from '../services/competitor/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// Competitor Detection
// ============================================

/**
 * POST /api/competitor/scan
 * Scan text for competitor mentions
 */
router.post('/scan', async (req: Request, res: Response) => {
  try {
    const {
      text,
      sourceType,
      sourceId,
      sourceTitle,
      sourceUrl,
      customerId,
      customerName,
    } = req.body;

    if (!text || !sourceType || !sourceId || !customerId) {
      return res.status(400).json({
        error: 'text, sourceType, sourceId, and customerId are required',
      });
    }

    const alerts = await competitorIntelligenceService.scanForCompetitors({
      text,
      sourceType,
      sourceId,
      sourceTitle,
      sourceUrl,
      customerId,
      customerName,
    });

    res.json({
      detected: alerts.length > 0,
      alertCount: alerts.length,
      alerts,
    });
  } catch (error) {
    console.error('[Competitor Routes] Scan error:', error);
    res.status(500).json({ error: 'Failed to scan for competitors' });
  }
});

/**
 * POST /api/competitor/detect
 * Quick detection without creating alerts (for real-time UI)
 */
router.post('/detect', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const detections = competitorDetector.detect(text);

    res.json({
      detected: detections.length > 0,
      count: detections.length,
      competitors: detections.map(d => ({
        id: d.competitor.id,
        name: d.competitor.name,
        matchedAlias: d.matchedAlias,
        context: d.context,
        sentiment: d.sentiment,
        intentSignal: d.intentSignal,
        featuresMentioned: d.featuresMentioned,
        confidence: d.confidence,
      })),
    });
  } catch (error) {
    console.error('[Competitor Routes] Detection error:', error);
    res.status(500).json({ error: 'Failed to detect competitors' });
  }
});

// ============================================
// Competitor Mentions
// ============================================

/**
 * GET /api/competitor/mentions
 * Get recent competitor mentions
 */
router.get('/mentions', async (req: Request, res: Response) => {
  try {
    const { days = '7', limit = '20', riskLevel } = req.query;

    const mentions = await competitorIntelligenceService.getRecentMentions({
      days: parseInt(days as string),
      limit: parseInt(limit as string),
      riskLevel: riskLevel as string | undefined,
    });

    res.json({ mentions });
  } catch (error) {
    console.error('[Competitor Routes] Get mentions error:', error);
    res.status(500).json({ error: 'Failed to get competitor mentions' });
  }
});

/**
 * GET /api/competitor/mentions/customer/:customerId
 * Get competitor mentions for a specific customer
 */
router.get('/mentions/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { limit = '50', offset = '0', competitorId } = req.query;

    const result = await competitorIntelligenceService.getCustomerMentions(
      customerId,
      {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        competitorId: competitorId as string | undefined,
      }
    );

    res.json(result);
  } catch (error) {
    console.error('[Competitor Routes] Get customer mentions error:', error);
    res.status(500).json({ error: 'Failed to get customer mentions' });
  }
});

/**
 * POST /api/competitor/mentions/:mentionId/acknowledge
 * Acknowledge a competitor mention
 */
router.post('/mentions/:mentionId/acknowledge', async (req: Request, res: Response) => {
  try {
    const { mentionId } = req.params;
    const userId = req.headers['x-user-id'] as string || 'system';

    await competitorIntelligenceService.acknowledgeMention(mentionId, userId);

    res.json({ success: true });
  } catch (error) {
    console.error('[Competitor Routes] Acknowledge error:', error);
    res.status(500).json({ error: 'Failed to acknowledge mention' });
  }
});

// ============================================
// Competitors Management
// ============================================

/**
 * GET /api/competitor/competitors
 * Get all tracked competitors
 */
router.get('/competitors', async (req: Request, res: Response) => {
  try {
    const competitors = competitorIntelligenceService.getCompetitors();
    res.json({ competitors });
  } catch (error) {
    console.error('[Competitor Routes] Get competitors error:', error);
    res.status(500).json({ error: 'Failed to get competitors' });
  }
});

/**
 * GET /api/competitor/competitors/:competitorId
 * Get a specific competitor
 */
router.get('/competitors/:competitorId', async (req: Request, res: Response) => {
  try {
    const { competitorId } = req.params;
    const competitor = competitorIntelligenceService.getCompetitor(competitorId);

    if (!competitor) {
      return res.status(404).json({ error: 'Competitor not found' });
    }

    res.json({ competitor });
  } catch (error) {
    console.error('[Competitor Routes] Get competitor error:', error);
    res.status(500).json({ error: 'Failed to get competitor' });
  }
});

/**
 * POST /api/competitor/competitors
 * Add a new competitor
 */
router.post('/competitors', async (req: Request, res: Response) => {
  try {
    const { name, aliases, website, category, strengths, weaknesses } = req.body;

    if (!name || !aliases || !Array.isArray(aliases) || aliases.length === 0) {
      return res.status(400).json({
        error: 'name and aliases (array) are required',
      });
    }

    const competitor = await competitorIntelligenceService.addCompetitor({
      name,
      aliases,
      website,
      category: category || 'General',
      strengths: strengths || [],
      weaknesses: weaknesses || [],
    });

    res.status(201).json({ competitor });
  } catch (error) {
    console.error('[Competitor Routes] Add competitor error:', error);
    res.status(500).json({ error: 'Failed to add competitor' });
  }
});

// ============================================
// Battle Cards
// ============================================

/**
 * GET /api/competitor/battlecards
 * Get all battle cards
 */
router.get('/battlecards', async (req: Request, res: Response) => {
  try {
    const battleCards = await competitorIntelligenceService.getAllBattleCards();

    res.json({
      battleCards: battleCards.map(card => ({
        id: card.id,
        competitorId: card.competitorId,
        competitorName: card.competitorName,
        version: card.version,
        lastUpdated: card.lastUpdated,
        overview: card.overview.slice(0, 200) + '...',
        differentiatorCount: card.keyDifferentiators.length,
        talkTrackCount: card.talkTracks.length,
        winRate: card.winRate,
      })),
    });
  } catch (error) {
    console.error('[Competitor Routes] Get battle cards error:', error);
    res.status(500).json({ error: 'Failed to get battle cards' });
  }
});

/**
 * GET /api/competitor/battlecards/:competitorId
 * Get battle card for a specific competitor
 */
router.get('/battlecards/:competitorId', async (req: Request, res: Response) => {
  try {
    const { competitorId } = req.params;
    const battleCard = await competitorIntelligenceService.getBattleCard(competitorId);

    if (!battleCard) {
      return res.status(404).json({ error: 'Battle card not found' });
    }

    res.json({ battleCard });
  } catch (error) {
    console.error('[Competitor Routes] Get battle card error:', error);
    res.status(500).json({ error: 'Failed to get battle card' });
  }
});

/**
 * PUT /api/competitor/battlecards/:competitorId
 * Update a battle card
 */
router.put('/battlecards/:competitorId', async (req: Request, res: Response) => {
  try {
    const { competitorId } = req.params;
    const updates = req.body;

    // Get existing battle card
    let battleCard = await battleCardService.getBattleCard(competitorId);

    if (!battleCard) {
      // Create new battle card
      battleCard = {
        id: `bc-${competitorId}`,
        competitorId,
        competitorName: updates.competitorName || competitorId,
        version: '1.0',
        lastUpdated: new Date(),
        overview: '',
        targetMarket: '',
        keyDifferentiators: [],
        talkTracks: [],
        objectionHandlers: [],
        resources: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // Apply updates
    const updatedCard = {
      ...battleCard,
      ...updates,
      lastUpdated: new Date(),
      updatedAt: new Date(),
    };

    await battleCardService.saveBattleCard(updatedCard);

    res.json({ battleCard: updatedCard });
  } catch (error) {
    console.error('[Competitor Routes] Update battle card error:', error);
    res.status(500).json({ error: 'Failed to update battle card' });
  }
});

// ============================================
// Analytics
// ============================================

/**
 * GET /api/competitor/analytics/portfolio
 * Get portfolio-wide competitor insights
 */
router.get('/analytics/portfolio', async (req: Request, res: Response) => {
  try {
    const { days = '30' } = req.query;
    const userId = req.headers['x-user-id'] as string | undefined;

    const insights = await competitorIntelligenceService.getPortfolioInsights({
      days: parseInt(days as string),
      userId,
    });

    res.json(insights);
  } catch (error) {
    console.error('[Competitor Routes] Get portfolio insights error:', error);
    res.status(500).json({ error: 'Failed to get portfolio insights' });
  }
});

/**
 * GET /api/competitor/analytics/:competitorId
 * Get analytics for a specific competitor
 */
router.get('/analytics/:competitorId', async (req: Request, res: Response) => {
  try {
    const { competitorId } = req.params;
    const { days = '90' } = req.query;

    const analytics = await competitorIntelligenceService.getCompetitorAnalytics(
      competitorId,
      { days: parseInt(days as string) }
    );

    if (!analytics) {
      return res.status(404).json({ error: 'No analytics available for this competitor' });
    }

    res.json(analytics);
  } catch (error) {
    console.error('[Competitor Routes] Get competitor analytics error:', error);
    res.status(500).json({ error: 'Failed to get competitor analytics' });
  }
});

// ============================================
// Quick Actions
// ============================================

/**
 * POST /api/competitor/actions/draft-response
 * Generate a draft response for a competitor mention
 */
router.post('/actions/draft-response', async (req: Request, res: Response) => {
  try {
    const { competitorId, mentionContext, customerName, featuresMentioned } = req.body;

    if (!competitorId) {
      return res.status(400).json({ error: 'competitorId is required' });
    }

    const battleCard = await battleCardService.getBattleCard(competitorId);

    if (!battleCard) {
      return res.status(404).json({ error: 'Battle card not found for this competitor' });
    }

    const response = battleCardService.generateSuggestedResponse(
      battleCard,
      {
        context: mentionContext,
        featuresMentioned: featuresMentioned || [],
      },
      { name: customerName }
    );

    const talkTrack = battleCardService.getSuggestedTalkTrack(battleCard, {
      context: mentionContext,
      featuresMentioned: featuresMentioned || [],
    });

    res.json({
      draftResponse: response,
      suggestedTalkTrack: talkTrack,
      keyDifferentiators: battleCard.keyDifferentiators.filter(d => d.importance === 'high'),
    });
  } catch (error) {
    console.error('[Competitor Routes] Draft response error:', error);
    res.status(500).json({ error: 'Failed to generate draft response' });
  }
});

export default router;
