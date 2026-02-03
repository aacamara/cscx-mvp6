/**
 * Benchmark Report API Routes
 * PRD-171: Benchmark Report
 *
 * Endpoints for benchmark reporting, percentile rankings,
 * and customer comparisons against internal and segment standards.
 */

import { Router, Request, Response } from 'express';
import benchmarkReportService from '../services/benchmarkReport.js';

const router = Router();

// ============================================
// GET /api/reports/benchmark
// Get full portfolio benchmark report
// ============================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const { metric, segment } = req.query;

    const report = await benchmarkReportService.getBenchmarkReport({
      metric: metric as string | undefined,
      segment: segment as string | undefined
    });

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Benchmark report error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate benchmark report' }
    });
  }
});

// ============================================
// GET /api/reports/benchmark/portfolio
// Get portfolio-wide benchmark statistics
// ============================================
router.get('/portfolio', async (req: Request, res: Response) => {
  try {
    const { metric = 'health_score' } = req.query;

    const result = await benchmarkReportService.getPortfolioBenchmark(metric as string);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Portfolio benchmark error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch portfolio benchmark' }
    });
  }
});

// ============================================
// GET /api/reports/benchmark/segments
// Get segment-specific benchmarks
// ============================================
router.get('/segments', async (req: Request, res: Response) => {
  try {
    const segments = await benchmarkReportService.getSegmentBenchmarks();

    res.json({
      success: true,
      data: { segments }
    });
  } catch (error) {
    console.error('Segment benchmark error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch segment benchmarks' }
    });
  }
});

// ============================================
// GET /api/reports/benchmark/customer/:customerId
// Get customer benchmark detail with percentile ranking
// ============================================
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const result = await benchmarkReportService.getCustomerBenchmark(customerId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found' }
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Customer benchmark error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch customer benchmark' }
    });
  }
});

// ============================================
// GET /api/reports/benchmark/leaders
// Get top performers across metrics
// ============================================
router.get('/leaders', async (req: Request, res: Response) => {
  try {
    const { metric = 'health_score', limit = '5' } = req.query;

    const { top_performers } = await benchmarkReportService.getPortfolioBenchmark(metric as string);

    res.json({
      success: true,
      data: {
        metric,
        leaders: top_performers.slice(0, parseInt(limit as string, 10))
      }
    });
  } catch (error) {
    console.error('Leaders benchmark error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch leaders' }
    });
  }
});

// ============================================
// GET /api/reports/benchmark/laggards
// Get bottom performers for improvement focus
// ============================================
router.get('/laggards', async (req: Request, res: Response) => {
  try {
    const { metric = 'health_score', limit = '5' } = req.query;

    const { bottom_performers } = await benchmarkReportService.getPortfolioBenchmark(metric as string);

    res.json({
      success: true,
      data: {
        metric,
        laggards: bottom_performers.slice(0, parseInt(limit as string, 10))
      }
    });
  } catch (error) {
    console.error('Laggards benchmark error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch laggards' }
    });
  }
});

// ============================================
// GET /api/reports/benchmark/compare
// Compare customers against benchmark
// ============================================
router.get('/compare', async (req: Request, res: Response) => {
  try {
    const { customer_ids, metric = 'health_score' } = req.query;

    if (!customer_ids) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'customer_ids query parameter required' }
      });
    }

    const ids = (customer_ids as string).split(',');

    // Get benchmark for context
    const { benchmark } = await benchmarkReportService.getPortfolioBenchmark(metric as string);

    // Get individual customer benchmarks
    const comparisons = await Promise.all(
      ids.map(id => benchmarkReportService.getCustomerBenchmark(id))
    );

    res.json({
      success: true,
      data: {
        benchmark,
        customers: comparisons.filter(c => c !== null)
      }
    });
  } catch (error) {
    console.error('Compare benchmark error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to compare customers' }
    });
  }
});

export default router;
