/**
 * AI Analysis Routes
 * Endpoints for Claude-powered sheet analysis
 */

import { Router, Request, Response } from 'express';
import { sheetAnalyzer, AnalysisType } from '../services/ai/sheet-analyzer.js';

const router = Router();

/**
 * GET /api/ai-analysis/types
 * Get available analysis types
 */
router.get('/types', (_req: Request, res: Response) => {
  const types = sheetAnalyzer.getAnalysisTypes();
  res.json({ types });
});

/**
 * POST /api/ai-analysis/analyze
 * Run AI analysis on a Google Sheet
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    // Use header or fallback to demo user for development
    const userId = (req.headers['x-user-id'] as string) || 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';

    const {
      spreadsheetId,
      sheetName,
      analysisType,
      customPrompt,
      options,
    } = req.body;

    console.log('[AI Analysis] Request received:', {
      userId,
      spreadsheetId,
      analysisType,
      hasSheetName: !!sheetName,
    });

    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Spreadsheet ID is required' });
    }

    if (!analysisType) {
      return res.status(400).json({ error: 'Analysis type is required' });
    }

    // Validate analysis type
    const validTypes: AnalysisType[] = [
      'health_score',
      'renewal_risk',
      'usage_trends',
      'qbr_prep',
      'nps_analysis',
      'weekly_digest',
      'adoption_metrics',
      'churn_prediction',
      'custom',
    ];

    if (!validTypes.includes(analysisType)) {
      return res.status(400).json({
        error: `Invalid analysis type. Valid types: ${validTypes.join(', ')}`,
      });
    }

    // Run analysis
    const result = await sheetAnalyzer.analyze({
      userId,
      spreadsheetId,
      sheetName,
      analysisType,
      customPrompt,
      options,
    });

    res.json(result);
  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/ai-analysis/quick
 * Quick analysis with just a spreadsheet URL
 */
router.post('/quick', async (req: Request, res: Response) => {
  try {
    // Use header or fallback to demo user for development
    const userId = (req.headers['x-user-id'] as string) || 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';

    const { spreadsheetUrl, analysisType = 'health_score' } = req.body;

    if (!spreadsheetUrl) {
      return res.status(400).json({ error: 'Spreadsheet URL is required' });
    }

    // Extract spreadsheet ID from URL
    const match = spreadsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid Google Sheets URL' });
    }

    const spreadsheetId = match[1];

    // Run analysis
    const result = await sheetAnalyzer.analyze({
      userId,
      spreadsheetId,
      analysisType,
      options: {
        includeRecommendations: true,
        includeAlerts: true,
      },
    });

    res.json(result);
  } catch (error) {
    console.error('Quick analysis error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: (error as Error).message,
    });
  }
});

export default router;
