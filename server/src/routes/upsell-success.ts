/**
 * PRD-130: Upsell Success Measurement Routes
 * API endpoints for managing upsell success measurement
 */

import { Router, Request, Response } from 'express';
import {
  upsellSuccessService,
  CreateMeasurementRequest,
  UpdateProgressRequest,
  RecordReviewRequest,
  DocumentOutcomeRequest,
  ProgressStatus,
  OutcomeStatus,
} from '../services/upsell-success/index.js';

const router = Router();

// ============================================
// POST /api/upsell/:id/success-measurement
// Create measurement plan for an upsell
// ============================================
router.post('/:upsellId/success-measurement', async (req: Request, res: Response) => {
  try {
    const { upsellId } = req.params;
    const {
      customerId,
      products,
      arrIncrease,
      closeDate,
      salesRep,
      goals,
      source,
      opportunityId,
    } = req.body;

    if (!customerId || !products || !arrIncrease || !closeDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: customerId, products, arrIncrease, closeDate',
      });
    }

    const request: CreateMeasurementRequest = {
      customerId,
      opportunityId: opportunityId || upsellId,
      products: Array.isArray(products) ? products : [products],
      arrIncrease: parseFloat(arrIncrease),
      closeDate,
      salesRep,
      goals,
      source: source || 'api',
    };

    const measurement = await upsellSuccessService.createMeasurementPlan(request);

    res.status(201).json({
      success: true,
      data: measurement,
      message: 'Measurement plan created successfully',
    });
  } catch (error) {
    console.error('Create measurement plan error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to create measurement plan',
    });
  }
});

// ============================================
// GET /api/upsell/:id/progress
// Get progress for a measurement
// ============================================
router.get('/:measurementId/progress', async (req: Request, res: Response) => {
  try {
    const { measurementId } = req.params;

    const measurement = await upsellSuccessService.getMeasurement(measurementId);

    if (!measurement) {
      return res.status(404).json({
        success: false,
        error: 'Measurement not found',
      });
    }

    res.json({
      success: true,
      data: {
        id: measurement.id,
        progress: measurement.progress,
        metrics: measurement.successCriteria.metrics,
        checkpoints: measurement.measurementPlan.checkpoints,
        daysSinceClose: Math.floor(
          (Date.now() - measurement.upsellDetails.closeDate.getTime()) / (1000 * 60 * 60 * 24)
        ),
      },
    });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to get progress',
    });
  }
});

// ============================================
// PUT /api/upsell/:id/metrics
// Update metrics for a measurement
// ============================================
router.put('/:measurementId/metrics', async (req: Request, res: Response) => {
  try {
    const { measurementId } = req.params;
    const { metrics } = req.body;

    if (!metrics || !Array.isArray(metrics)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: metrics (array)',
      });
    }

    const request: UpdateProgressRequest = { metrics };
    const measurement = await upsellSuccessService.updateProgress(measurementId, request);

    res.json({
      success: true,
      data: {
        progress: measurement.progress,
        metrics: measurement.successCriteria.metrics,
      },
      message: 'Metrics updated successfully',
    });
  } catch (error) {
    console.error('Update metrics error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to update metrics',
    });
  }
});

// ============================================
// POST /api/upsell/:id/review
// Record a success review
// ============================================
router.post('/:measurementId/review', async (req: Request, res: Response) => {
  try {
    const { measurementId } = req.params;
    const {
      checkpointDay,
      reviewedBy,
      overallAssessment,
      findings,
      recommendations,
      nextSteps,
      documentUrl,
    } = req.body;

    if (!checkpointDay || !reviewedBy || !overallAssessment) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: checkpointDay, reviewedBy, overallAssessment',
      });
    }

    const request: RecordReviewRequest = {
      checkpointDay: parseInt(checkpointDay),
      reviewedBy,
      overallAssessment: overallAssessment as ProgressStatus,
      findings: findings || [],
      recommendations: recommendations || [],
      nextSteps: nextSteps || [],
      documentUrl,
    };

    const review = await upsellSuccessService.recordReview(measurementId, request);

    res.status(201).json({
      success: true,
      data: review,
      message: 'Review recorded successfully',
    });
  } catch (error) {
    console.error('Record review error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to record review',
    });
  }
});

// ============================================
// POST /api/upsell/:id/outcome
// Document the final outcome
// ============================================
router.post('/:measurementId/outcome', async (req: Request, res: Response) => {
  try {
    const { measurementId } = req.params;
    const { status, evidence, lessonsLearned, healthScoreAfter } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: status',
      });
    }

    const request: DocumentOutcomeRequest = {
      status: status as OutcomeStatus,
      evidence: evidence || [],
      lessonsLearned: lessonsLearned || [],
      healthScoreAfter: healthScoreAfter !== undefined ? parseInt(healthScoreAfter) : undefined,
    };

    const outcome = await upsellSuccessService.documentOutcome(measurementId, request);

    res.json({
      success: true,
      data: outcome,
      message: 'Outcome documented successfully',
    });
  } catch (error) {
    console.error('Document outcome error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to document outcome',
    });
  }
});

// ============================================
// GET /api/upsell/outcomes
// Get outcome analysis for all measurements
// ============================================
router.get('/outcomes', async (req: Request, res: Response) => {
  try {
    const analysis = await upsellSuccessService.getOutcomeAnalysis();
    const summaries = await upsellSuccessService.getMeasurementSummaries();

    res.json({
      success: true,
      data: {
        analysis,
        summaries,
        totals: {
          total: summaries.length,
          onTrack: summaries.filter((s) => s.progressStatus === 'on_track').length,
          atRisk: summaries.filter((s) => s.progressStatus === 'at_risk').length,
          behind: summaries.filter((s) => s.progressStatus === 'behind').length,
          exceeding: summaries.filter((s) => s.progressStatus === 'exceeding').length,
          successfulOutcomes: summaries.filter((s) => s.outcomeStatus === 'success').length,
          totalArrExpansion: summaries.reduce((sum, s) => sum + s.arrIncrease, 0),
        },
      },
    });
  } catch (error) {
    console.error('Get outcomes error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to get outcomes',
    });
  }
});

// ============================================
// GET /api/upsell/measurements
// Get all measurement summaries
// ============================================
router.get('/measurements', async (req: Request, res: Response) => {
  try {
    const { status, outcomeStatus, limit } = req.query;

    const summaries = await upsellSuccessService.getMeasurementSummaries({
      status: status as ProgressStatus | undefined,
      outcomeStatus: outcomeStatus as OutcomeStatus | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      data: summaries,
      count: summaries.length,
    });
  } catch (error) {
    console.error('Get measurements error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to get measurements',
    });
  }
});

// ============================================
// GET /api/upsell/checkpoints/upcoming
// Get upcoming checkpoints requiring attention
// ============================================
router.get('/checkpoints/upcoming', async (req: Request, res: Response) => {
  try {
    const { days } = req.query;
    const checkpoints = await upsellSuccessService.getUpcomingCheckpoints(
      days ? parseInt(days as string) : 7
    );

    res.json({
      success: true,
      data: checkpoints,
      count: checkpoints.length,
    });
  } catch (error) {
    console.error('Get upcoming checkpoints error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to get upcoming checkpoints',
    });
  }
});

// ============================================
// GET /api/upsell/customer/:customerId/measurements
// Get all measurements for a customer
// ============================================
router.get('/customer/:customerId/measurements', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const measurements = await upsellSuccessService.getCustomerMeasurements(customerId);

    res.json({
      success: true,
      data: measurements,
      count: measurements.length,
    });
  } catch (error) {
    console.error('Get customer measurements error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to get customer measurements',
    });
  }
});

// ============================================
// GET /api/upsell/:id
// Get full measurement details
// ============================================
router.get('/:measurementId', async (req: Request, res: Response) => {
  try {
    const { measurementId } = req.params;
    const measurement = await upsellSuccessService.getMeasurement(measurementId);

    if (!measurement) {
      return res.status(404).json({
        success: false,
        error: 'Measurement not found',
      });
    }

    res.json({
      success: true,
      data: measurement,
    });
  } catch (error) {
    console.error('Get measurement error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Failed to get measurement',
    });
  }
});

export default router;
