/**
 * CSCX.AI Net Revenue Retention Report Routes
 * PRD-174: Net Revenue Retention Report
 *
 * API endpoints for NRR calculation, component breakdown, segment/CSM analysis,
 * cohort analysis, and NRR forecasting.
 */

import { Router, Request, Response } from 'express';
import { nrrReportService } from '../services/nrrReport.js';

const router = Router();

/**
 * GET /api/reports/nrr
 * Get comprehensive NRR report with trends, segments, CSM breakdown, and forecast
 *
 * Query params:
 *   - period_type: monthly | quarterly | annual (default: quarterly)
 *   - period: specific period identifier
 *   - segment: enterprise | mid-market | smb
 *   - csm_id: CSM identifier for filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { period_type, period, segment, csm_id } = req.query;

    const report = await nrrReportService.getNRRReport({
      period_type: period_type as 'monthly' | 'quarterly' | 'annual' | undefined,
      period: period as string | undefined,
      segment: segment as string | undefined,
      csm_id: csm_id as string | undefined
    });

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('NRR report error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'NRR_REPORT_ERROR',
        message: (error as Error).message || 'Failed to fetch NRR report'
      }
    });
  }
});

/**
 * GET /api/reports/nrr/breakdown
 * Get detailed breakdown of NRR components with individual movements
 *
 * Query params:
 *   - period: period identifier
 */
router.get('/breakdown', async (req: Request, res: Response) => {
  try {
    const { period } = req.query;

    const breakdown = await nrrReportService.getNRRBreakdown({
      period: period as string || 'current_quarter'
    });

    res.json({
      success: true,
      data: breakdown
    });
  } catch (error) {
    console.error('NRR breakdown error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'NRR_BREAKDOWN_ERROR',
        message: (error as Error).message || 'Failed to fetch NRR breakdown'
      }
    });
  }
});

/**
 * GET /api/reports/nrr/trends
 * Get historical NRR trends
 *
 * Query params:
 *   - periods: Number of periods to return (default: 12)
 *   - segment: Filter by segment
 *   - csm_id: Filter by CSM
 */
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const { periods: periodsStr, segment, csm_id } = req.query;
    const periods = parseInt(periodsStr as string) || 12;

    const trends = await nrrReportService.getNRRTrends(
      periods,
      segment as string | undefined,
      csm_id as string | undefined
    );

    res.json({
      success: true,
      data: {
        periods,
        trends
      }
    });
  } catch (error) {
    console.error('NRR trends error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'NRR_TRENDS_ERROR',
        message: (error as Error).message || 'Failed to fetch NRR trends'
      }
    });
  }
});

/**
 * GET /api/reports/nrr/cohorts
 * Get NRR analysis by customer cohort
 */
router.get('/cohorts', async (req: Request, res: Response) => {
  try {
    const cohorts = await nrrReportService.getNRRByCohort();

    res.json({
      success: true,
      data: {
        cohorts
      }
    });
  } catch (error) {
    console.error('NRR cohorts error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'NRR_COHORTS_ERROR',
        message: (error as Error).message || 'Failed to fetch NRR cohorts'
      }
    });
  }
});

/**
 * GET /api/reports/nrr/summary
 * Get a quick summary of current NRR metrics
 *
 * Query params:
 *   - period_type: monthly | quarterly | annual
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { period_type } = req.query;

    const report = await nrrReportService.getNRRReport({
      period_type: period_type as 'monthly' | 'quarterly' | 'annual' | undefined
    });

    // Return just the current metrics
    res.json({
      success: true,
      data: {
        nrr: report.current.rates.nrr,
        grr: report.current.rates.grr,
        expansion_rate: report.current.rates.expansion_rate,
        contraction_rate: report.current.rates.contraction_rate,
        churn_rate: report.current.rates.churn_rate,
        vs_target: report.current.comparisons.vs_target,
        vs_previous: report.current.comparisons.vs_previous_period,
        period_label: report.current.period_label
      }
    });
  } catch (error) {
    console.error('NRR summary error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'NRR_SUMMARY_ERROR',
        message: (error as Error).message || 'Failed to fetch NRR summary'
      }
    });
  }
});

/**
 * GET /api/reports/nrr/segments
 * Get NRR breakdown by segment
 */
router.get('/segments', async (req: Request, res: Response) => {
  try {
    const report = await nrrReportService.getNRRReport({});

    res.json({
      success: true,
      data: {
        segments: report.by_segment,
        overall_nrr: report.current.rates.nrr
      }
    });
  } catch (error) {
    console.error('NRR segments error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'NRR_SEGMENTS_ERROR',
        message: (error as Error).message || 'Failed to fetch NRR by segment'
      }
    });
  }
});

/**
 * GET /api/reports/nrr/csm
 * Get NRR breakdown by CSM with rankings
 */
router.get('/csm', async (req: Request, res: Response) => {
  try {
    const report = await nrrReportService.getNRRReport({});

    res.json({
      success: true,
      data: {
        csm_breakdown: report.by_csm,
        overall_nrr: report.current.rates.nrr
      }
    });
  } catch (error) {
    console.error('NRR by CSM error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'NRR_CSM_ERROR',
        message: (error as Error).message || 'Failed to fetch NRR by CSM'
      }
    });
  }
});

/**
 * GET /api/reports/nrr/forecast
 * Get NRR forecast for upcoming periods
 */
router.get('/forecast', async (req: Request, res: Response) => {
  try {
    const report = await nrrReportService.getNRRReport({});

    res.json({
      success: true,
      data: {
        forecast: report.forecast,
        current_nrr: report.current.rates.nrr,
        current_period: report.current.period_label
      }
    });
  } catch (error) {
    console.error('NRR forecast error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'NRR_FORECAST_ERROR',
        message: (error as Error).message || 'Failed to fetch NRR forecast'
      }
    });
  }
});

/**
 * GET /api/reports/nrr/drivers
 * Get top NRR drivers (expansion, contraction, churn reasons)
 */
router.get('/drivers', async (req: Request, res: Response) => {
  try {
    const { period } = req.query;

    const breakdown = await nrrReportService.getNRRBreakdown({
      period: period as string || 'current_quarter'
    });

    // Group drivers by type
    const expansionDrivers = breakdown.drivers.filter(d => d.type === 'expansion');
    const contractionDrivers = breakdown.drivers.filter(d => d.type === 'contraction');
    const churnDrivers = breakdown.drivers.filter(d => d.type === 'churn');

    res.json({
      success: true,
      data: {
        expansion: expansionDrivers,
        contraction: contractionDrivers,
        churn: churnDrivers,
        summary: {
          top_expansion_driver: expansionDrivers[0]?.category || 'N/A',
          top_contraction_driver: contractionDrivers[0]?.category || 'N/A',
          top_churn_driver: churnDrivers[0]?.category || 'N/A'
        }
      }
    });
  } catch (error) {
    console.error('NRR drivers error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'NRR_DRIVERS_ERROR',
        message: (error as Error).message || 'Failed to fetch NRR drivers'
      }
    });
  }
});

export default router;
