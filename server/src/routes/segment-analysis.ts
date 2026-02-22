/**
 * Customer Segmentation Analysis API Routes
 * PRD-175: Customer Segmentation Analysis
 *
 * Provides endpoints for:
 * - Segment overview and listing
 * - Segment profile details
 * - Segment comparison
 * - Segment movement tracking
 * - Custom segment creation
 */

import { Router, Request, Response } from 'express';
import segmentAnalysisService from '../services/segmentAnalysis.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/reports/segment-analysis
 * Get segment analysis overview with all segments
 *
 * Query params:
 * - sort_by: 'name' | 'arr' | 'count' | 'health' | 'nrr' | 'churn'
 * - sort_order: 'asc' | 'desc'
 * - movement_period: '7d' | '30d' | '90d' | 'quarter'
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      sort_by = 'arr',
      sort_order = 'desc',
      movement_period = '30d'
    } = req.query;

    // Fetch all data in parallel
    const [overview, segments, comparison, movements] = await Promise.all([
      segmentAnalysisService.getSegmentOverview(),
      segmentAnalysisService.getSegments(),
      segmentAnalysisService.getSegmentComparison(),
      segmentAnalysisService.getSegmentMovements(movement_period as '7d' | '30d' | '90d' | 'quarter')
    ]);

    // Sort segments
    let sortedSegments = [...segments];
    sortedSegments.sort((a, b) => {
      let comparison = 0;
      switch (sort_by) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'arr':
          comparison = a.total_arr - b.total_arr;
          break;
        case 'count':
          comparison = a.customer_count - b.customer_count;
          break;
        default:
          comparison = b.total_arr - a.total_arr;
      }
      return sort_order === 'asc' ? comparison : -comparison;
    });

    res.json({
      overview,
      segments: sortedSegments,
      comparison,
      recent_movements: movements
    });
  } catch (error) {
    console.error('Segment analysis error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch segment analysis data' }
    });
  }
});

/**
 * GET /api/reports/segment-analysis/segments
 * Get list of all segments
 */
router.get('/segments', async (req: Request, res: Response) => {
  try {
    const segments = await segmentAnalysisService.getSegments();
    res.json({ segments });
  } catch (error) {
    console.error('Segments list error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch segments' }
    });
  }
});

/**
 * GET /api/reports/segment-analysis/segments/:segmentId
 * Get detailed profile for a specific segment
 */
router.get('/segments/:segmentId', async (req: Request, res: Response) => {
  try {
    const { segmentId } = req.params;

    const [profile, customers] = await Promise.all([
      segmentAnalysisService.getSegmentProfile(segmentId),
      segmentAnalysisService.getSegmentCustomers(segmentId)
    ]);

    if (!profile) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Segment not found' }
      });
    }

    res.json({
      profile,
      customers
    });
  } catch (error) {
    console.error('Segment profile error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch segment profile' }
    });
  }
});

/**
 * GET /api/reports/segment-analysis/segments/:segmentId/customers
 * Get customers in a specific segment
 *
 * Query params:
 * - sort_by: 'name' | 'arr' | 'health' | 'renewal' | 'tenure'
 * - sort_order: 'asc' | 'desc'
 * - search: string
 * - risk_filter: 'all' | 'low' | 'medium' | 'high'
 */
router.get('/segments/:segmentId/customers', async (req: Request, res: Response) => {
  try {
    const { segmentId } = req.params;
    const {
      sort_by = 'arr',
      sort_order = 'desc',
      search,
      risk_filter
    } = req.query;

    let customers = await segmentAnalysisService.getSegmentCustomers(segmentId);

    // Filter by search
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      customers = customers.filter(c =>
        c.name.toLowerCase().includes(searchLower) ||
        c.industry.toLowerCase().includes(searchLower)
      );
    }

    // Filter by risk level
    if (risk_filter && risk_filter !== 'all') {
      customers = customers.filter(c => c.risk_level === risk_filter);
    }

    // Sort customers
    customers.sort((a: any, b: any) => {
      let comparison = 0;
      switch (sort_by) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'arr':
          comparison = a.arr - b.arr;
          break;
        case 'health':
          comparison = a.health_score - b.health_score;
          break;
        case 'renewal':
          comparison = (a.days_to_renewal || 999) - (b.days_to_renewal || 999);
          break;
        case 'tenure':
          comparison = a.tenure_months - b.tenure_months;
          break;
        default:
          comparison = b.arr - a.arr;
      }
      return sort_order === 'asc' ? comparison : -comparison;
    });

    res.json({ customers });
  } catch (error) {
    console.error('Segment customers error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch segment customers' }
    });
  }
});

/**
 * GET /api/reports/segment-analysis/compare
 * Get segment comparison metrics
 */
router.get('/compare', async (req: Request, res: Response) => {
  try {
    const comparison = await segmentAnalysisService.getSegmentComparison();
    res.json(comparison);
  } catch (error) {
    console.error('Segment comparison error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch segment comparison' }
    });
  }
});

/**
 * GET /api/reports/segment-analysis/movements
 * Get segment movement history
 *
 * Query params:
 * - period: '7d' | '30d' | '90d' | 'quarter'
 */
router.get('/movements', async (req: Request, res: Response) => {
  try {
    const { period = '30d' } = req.query;
    const movements = await segmentAnalysisService.getSegmentMovements(
      period as '7d' | '30d' | '90d' | 'quarter'
    );
    res.json(movements);
  } catch (error) {
    console.error('Segment movements error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch segment movements' }
    });
  }
});

/**
 * POST /api/reports/segment-analysis/segments
 * Create a new custom segment
 */
router.post('/segments', async (req: Request, res: Response) => {
  try {
    const { name, description, criteria, is_dynamic, color } = req.body;

    // Validate required fields
    if (!name || !criteria || !Array.isArray(criteria) || criteria.length === 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Name and at least one criteria are required' }
      });
    }

    // Validate criteria structure
    for (const criterion of criteria) {
      if (!criterion.attribute || !criterion.operator || criterion.value === undefined) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Each criterion must have attribute, operator, and value' }
        });
      }
    }

    const segment = await segmentAnalysisService.createSegment({
      name,
      description,
      criteria,
      is_dynamic: is_dynamic ?? true,
      color
    });

    res.status(201).json({ segment });
  } catch (error) {
    console.error('Create segment error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create segment' }
    });
  }
});

export { router as segmentAnalysisRoutes };
export default router;
