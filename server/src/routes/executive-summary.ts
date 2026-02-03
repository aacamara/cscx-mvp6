/**
 * CSCX.AI Executive Summary Report Routes
 * PRD-179: Executive Summary Report
 *
 * API endpoints for generating and managing executive summary reports.
 */

import { Router, Request, Response } from 'express';
import { executiveSummaryService, GenerateReportOptions } from '../services/reports/executiveSummary.js';

const router = Router();

// ============================================
// Report Generation
// ============================================

/**
 * GET /api/reports/executive-summary
 * Generate an executive summary report for a specified period
 *
 * Query params:
 *   - period: month | quarter | year | custom (default: quarter)
 *   - startDate: ISO date string (required if period=custom)
 *   - endDate: ISO date string (required if period=custom)
 *   - includeNarrative: boolean (default: false)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const {
      period = 'quarter',
      startDate,
      endDate,
      includeNarrative,
    } = req.query;

    // Validate period
    const validPeriods = ['month', 'quarter', 'year', 'custom'];
    if (!validPeriods.includes(period as string)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PERIOD',
          message: `Period must be one of: ${validPeriods.join(', ')}`,
        },
      });
    }

    // Validate custom period dates
    if (period === 'custom' && (!startDate || !endDate)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_DATES',
          message: 'Custom period requires startDate and endDate query parameters',
        },
      });
    }

    const options: GenerateReportOptions = {
      period: period as 'month' | 'quarter' | 'year' | 'custom',
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      userId,
      includeNarrative: includeNarrative === 'true',
    };

    const report = await executiveSummaryService.generateReport(options);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('[ExecutiveSummary] Generate error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GENERATION_ERROR',
        message: (error as Error).message || 'Failed to generate executive summary',
      },
    });
  }
});

/**
 * POST /api/reports/executive-summary/generate
 * Generate an executive summary with custom targets
 *
 * Body:
 *   - period: month | quarter | year | custom
 *   - startDate: ISO date string (required if period=custom)
 *   - endDate: ISO date string (required if period=custom)
 *   - includeNarrative: boolean
 *   - targets: { grr, nrr, healthScore, timeToValue, nps }
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const {
      period = 'quarter',
      startDate,
      endDate,
      includeNarrative,
      targets,
    } = req.body;

    const options: GenerateReportOptions = {
      period,
      startDate,
      endDate,
      userId,
      includeNarrative,
      targets,
    };

    const report = await executiveSummaryService.generateReport(options);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('[ExecutiveSummary] Generate error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GENERATION_ERROR',
        message: (error as Error).message || 'Failed to generate executive summary',
      },
    });
  }
});

// ============================================
// Report History
// ============================================

/**
 * GET /api/reports/executive-summary/history
 * Get list of previously generated reports
 *
 * Query params:
 *   - limit: number (default: 10)
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const limit = parseInt(req.query.limit as string) || 10;

    const reports = await executiveSummaryService.getReportHistory(limit, userId);

    res.json({
      success: true,
      data: {
        reports,
        count: reports.length,
      },
    });
  } catch (error) {
    console.error('[ExecutiveSummary] History error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HISTORY_ERROR',
        message: (error as Error).message || 'Failed to fetch report history',
      },
    });
  }
});

/**
 * GET /api/reports/executive-summary/:reportId
 * Get a specific report by ID
 */
router.get('/:reportId', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;

    const report = await executiveSummaryService.getReport(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Report not found',
        },
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('[ExecutiveSummary] Get report error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: (error as Error).message || 'Failed to fetch report',
      },
    });
  }
});

// ============================================
// Report Scheduling
// ============================================

/**
 * POST /api/reports/executive-summary/schedule
 * Schedule recurring executive summary reports
 *
 * Body:
 *   - frequency: weekly | monthly | quarterly
 *   - dayOfWeek: 0-6 (for weekly)
 *   - dayOfMonth: 1-28 (for monthly)
 *   - distributionList: string[] (email addresses)
 */
router.post('/schedule', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User ID required',
        },
      });
    }

    const { frequency, dayOfWeek, dayOfMonth, distributionList } = req.body;

    // Validate frequency
    const validFrequencies = ['weekly', 'monthly', 'quarterly'];
    if (!validFrequencies.includes(frequency)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FREQUENCY',
          message: `Frequency must be one of: ${validFrequencies.join(', ')}`,
        },
      });
    }

    // Validate distribution list
    if (!distributionList || !Array.isArray(distributionList) || distributionList.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_DISTRIBUTION_LIST',
          message: 'At least one email address is required in distributionList',
        },
      });
    }

    const result = await executiveSummaryService.scheduleReport({
      frequency,
      dayOfWeek,
      dayOfMonth,
      distributionList,
      userId,
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'SCHEDULE_ERROR',
          message: result.error || 'Failed to schedule report',
        },
      });
    }

    res.json({
      success: true,
      data: {
        scheduleId: result.scheduleId,
        frequency,
        distributionList,
        message: `Executive summary scheduled to run ${frequency}`,
      },
    });
  } catch (error) {
    console.error('[ExecutiveSummary] Schedule error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SCHEDULE_ERROR',
        message: (error as Error).message || 'Failed to schedule report',
      },
    });
  }
});

// ============================================
// PDF Export (placeholder for future implementation)
// ============================================

/**
 * GET /api/reports/executive-summary/:reportId/pdf
 * Download report as PDF
 */
router.get('/:reportId/pdf', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;

    // For now, return a not implemented response
    // In production, this would use a PDF generation service
    res.status(501).json({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'PDF export is coming soon. Please use the web view for now.',
      },
    });
  } catch (error) {
    console.error('[ExecutiveSummary] PDF error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PDF_ERROR',
        message: (error as Error).message || 'Failed to generate PDF',
      },
    });
  }
});

export default router;
