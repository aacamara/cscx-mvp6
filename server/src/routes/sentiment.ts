/**
 * Sentiment Analysis Routes (PRD-218)
 *
 * API endpoints for real-time sentiment analysis of customer communications.
 */

import { Router, Request, Response } from 'express';
import {
  sentimentAnalyzer,
  type CommunicationSource,
  type AnalyzeSentimentParams,
} from '../services/ai/sentiment-analyzer.js';
import { config } from '../config/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// Demo user ID - ONLY used in development mode
const DEMO_USER_ID = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';

/**
 * Get user ID from request.
 * SECURITY: Demo user fallback ONLY allowed in development mode.
 */
const getUserId = (req: Request): string | null => {
  if ((req as any).userId) {
    return (req as any).userId;
  }

  if (config.nodeEnv === 'development') {
    return DEMO_USER_ID;
  }

  return null;
};

// Valid communication sources
const VALID_SOURCES: CommunicationSource[] = ['email', 'meeting', 'support', 'slack', 'survey'];

/**
 * POST /api/sentiment/analyze
 * Analyze sentiment of a communication
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { source, customer_id, stakeholder_id, content, metadata } = req.body;

    // Validate required fields
    if (!source) {
      return res.status(400).json({ error: 'source is required' });
    }

    if (!customer_id) {
      return res.status(400).json({ error: 'customer_id is required' });
    }

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    // Validate source type
    if (!VALID_SOURCES.includes(source)) {
      return res.status(400).json({
        error: `Invalid source. Valid sources: ${VALID_SOURCES.join(', ')}`,
      });
    }

    // Analyze sentiment
    const result = await sentimentAnalyzer.analyzeSentiment({
      source,
      customer_id,
      stakeholder_id,
      content,
      metadata,
    });

    res.json(result);
  } catch (error) {
    console.error('[Sentiment] Analysis error:', error);
    res.status(500).json({
      error: 'Sentiment analysis failed',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/sentiment/customer/:customerId
 * Get sentiment summary for a customer
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const summary = await sentimentAnalyzer.getCustomerSentiment(customerId);
    res.json(summary);
  } catch (error) {
    console.error('[Sentiment] Get customer sentiment error:', error);
    res.status(500).json({
      error: 'Failed to get customer sentiment',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/sentiment/customer/:customerId/alerts
 * Get sentiment alerts for a customer
 */
router.get('/customer/:customerId/alerts', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { customerId } = req.params;
    const unacknowledgedOnly = req.query.unacknowledged === 'true';

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const alerts = await sentimentAnalyzer.getCustomerSentimentAlerts(
      customerId,
      unacknowledgedOnly
    );

    res.json({ alerts });
  } catch (error) {
    console.error('[Sentiment] Get alerts error:', error);
    res.status(500).json({
      error: 'Failed to get sentiment alerts',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/sentiment/alerts/:alertId/acknowledge
 * Acknowledge a sentiment alert
 */
router.post('/alerts/:alertId/acknowledge', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { alertId } = req.params;

    if (!alertId) {
      return res.status(400).json({ error: 'alertId is required' });
    }

    const success = await sentimentAnalyzer.acknowledgeSentimentAlert(alertId);

    if (success) {
      res.json({ success: true, message: 'Alert acknowledged' });
    } else {
      res.status(404).json({ error: 'Alert not found or already acknowledged' });
    }
  } catch (error) {
    console.error('[Sentiment] Acknowledge alert error:', error);
    res.status(500).json({
      error: 'Failed to acknowledge alert',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/sentiment/portfolio
 * Get portfolio-level sentiment summary
 */
router.get('/portfolio', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const summary = await sentimentAnalyzer.getPortfolioSentiment();
    res.json(summary);
  } catch (error) {
    console.error('[Sentiment] Get portfolio sentiment error:', error);
    res.status(500).json({
      error: 'Failed to get portfolio sentiment',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/sentiment/batch
 * Analyze multiple communications in batch
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { communications } = req.body;

    if (!Array.isArray(communications)) {
      return res.status(400).json({ error: 'communications array is required' });
    }

    if (communications.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 communications per batch' });
    }

    // Process in parallel with concurrency limit
    const results = await Promise.all(
      communications.map(async (comm: AnalyzeSentimentParams) => {
        try {
          return {
            success: true,
            result: await sentimentAnalyzer.analyzeSentiment(comm),
          };
        } catch (error) {
          return {
            success: false,
            error: (error as Error).message,
            input: { customer_id: comm.customer_id, source: comm.source },
          };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;

    res.json({
      total: communications.length,
      successful: successCount,
      failed: communications.length - successCount,
      results,
    });
  } catch (error) {
    console.error('[Sentiment] Batch analysis error:', error);
    res.status(500).json({
      error: 'Batch analysis failed',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/sentiment/sources
 * Get available communication sources for analysis
 */
router.get('/sources', (_req: Request, res: Response) => {
  res.json({
    sources: VALID_SOURCES.map(source => ({
      id: source,
      name: source.charAt(0).toUpperCase() + source.slice(1),
      description: getSourceDescription(source),
    })),
  });
});

function getSourceDescription(source: CommunicationSource): string {
  const descriptions: Record<CommunicationSource, string> = {
    email: 'Email threads and messages',
    meeting: 'Meeting transcripts and recordings',
    support: 'Support tickets and interactions',
    slack: 'Slack channel messages',
    survey: 'NPS and survey responses',
  };
  return descriptions[source];
}

export default router;
