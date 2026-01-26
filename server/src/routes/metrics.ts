/**
 * Metrics API Routes
 * Endpoints for CS metrics, surveys, and QBR generation
 */

import { Router, Request, Response } from 'express';
import metricsService, {
  calculateDashboardMetrics,
  calculateCustomerMetrics,
  calculateNPS,
  calculateCSAT,
  calculateCES,
  calculateHealthScore,
  evaluateNRRBenchmark,
  evaluateGRRBenchmark,
  evaluateNPSBenchmark,
  HealthScoreComponents
} from '../services/metrics.js';
import { surveyService } from '../services/google/surveys.js';
import { qbrSlidesService } from '../services/google/qbrSlides.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

const router = Router();
const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);

// ============================================
// DASHBOARD METRICS
// ============================================

/**
 * GET /api/metrics/dashboard
 * Get aggregated dashboard metrics for all customers
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const metrics = await calculateDashboardMetrics(start, end, userId);
    res.json(metrics);
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/metrics/customer/:customerId
 * Get metrics for a specific customer
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const metrics = await calculateCustomerMetrics(customerId);
    res.json(metrics);
  } catch (error) {
    console.error('Customer metrics error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// HEALTH SCORE
// ============================================

/**
 * POST /api/metrics/health-score/calculate
 * Calculate health score from components
 */
router.post('/health-score/calculate', async (req: Request, res: Response) => {
  try {
    const { components, weights } = req.body;

    if (!components) {
      return res.status(400).json({ error: 'Components required' });
    }

    const result = calculateHealthScore(components as HealthScoreComponents, weights);
    res.json(result);
  } catch (error) {
    console.error('Health score calculation error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/metrics/health-score/:customerId
 * Update customer health score
 */
router.put('/health-score/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { score, components, notes } = req.body;

    const { data, error } = await supabase
      .from('customers')
      .update({
        health_score: score,
        health_components: components,
        health_notes: notes,
        health_updated_at: new Date().toISOString()
      })
      .eq('id', customerId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Health score update error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// NPS / CSAT / CES CALCULATIONS
// ============================================

/**
 * POST /api/metrics/nps/calculate
 * Calculate NPS from responses
 */
router.post('/nps/calculate', async (req: Request, res: Response) => {
  try {
    const { responses } = req.body;

    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ error: 'Responses array required' });
    }

    const result = calculateNPS(responses);
    const benchmark = evaluateNPSBenchmark(result.nps);

    res.json({ ...result, benchmark });
  } catch (error) {
    console.error('NPS calculation error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/metrics/csat/calculate
 * Calculate CSAT from responses
 */
router.post('/csat/calculate', async (req: Request, res: Response) => {
  try {
    const { responses, scale = 5 } = req.body;

    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ error: 'Responses array required' });
    }

    const csat = calculateCSAT(responses, scale);
    res.json({ csat, totalResponses: responses.length });
  } catch (error) {
    console.error('CSAT calculation error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/metrics/ces/calculate
 * Calculate CES from responses
 */
router.post('/ces/calculate', async (req: Request, res: Response) => {
  try {
    const { responses } = req.body;

    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ error: 'Responses array required' });
    }

    const ces = calculateCES(responses);
    res.json({ ces, totalResponses: responses.length });
  } catch (error) {
    console.error('CES calculation error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// SURVEYS
// ============================================

/**
 * POST /api/metrics/surveys/create
 * Create a new survey using Google Forms
 */
router.post('/surveys/create', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { surveyType, customizations } = req.body;

    if (!surveyType) {
      return res.status(400).json({ error: 'Survey type required' });
    }

    const result = await surveyService.createSurvey(userId, surveyType, customizations);
    res.json(result);
  } catch (error) {
    console.error('Survey creation error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/metrics/surveys/send
 * Send a survey to a customer via email
 */
router.post('/surveys/send', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId, surveyType, recipientEmail, recipientName } = req.body;

    if (!surveyType || !recipientEmail || !recipientName) {
      return res.status(400).json({
        error: 'Survey type, recipient email, and recipient name required'
      });
    }

    const result = await surveyService.sendSurveyEmail(
      userId,
      customerId,
      surveyType,
      recipientEmail,
      recipientName
    );

    res.json(result);
  } catch (error) {
    console.error('Survey send error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/metrics/surveys/:formId/responses
 * Get responses from a survey
 */
router.get('/surveys/:formId/responses', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { formId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const responses = await surveyService.getSurveyResponses(userId, formId);
    res.json(responses);
  } catch (error) {
    console.error('Survey responses error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/metrics/surveys/templates
 * Get available survey templates
 */
router.get('/surveys/templates', async (_req: Request, res: Response) => {
  try {
    const templates = surveyService.getSurveyTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Survey templates error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/metrics/nps/breakdown
 * Get NPS breakdown for time period
 */
router.get('/nps/breakdown', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const breakdown = await surveyService.getNPSBreakdown(userId, start, end);
    res.json(breakdown);
  } catch (error) {
    console.error('NPS breakdown error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// QBR GENERATION
// ============================================

/**
 * POST /api/metrics/qbr/generate
 * Generate QBR presentation for a customer
 */
router.post('/qbr/generate', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId, quarter, year } = req.body;

    if (!customerId || !quarter || !year) {
      return res.status(400).json({
        error: 'Customer ID, quarter, and year required'
      });
    }

    const result = await qbrSlidesService.generateQBRPresentation(
      userId,
      customerId,
      quarter,
      year
    );

    // Store QBR record in database
    await supabase.from('qbrs').insert({
      customer_id: customerId,
      quarter: `${quarter} ${year}`,
      status: 'draft',
      presentation_url: result.presentationUrl,
      created_at: new Date().toISOString()
    });

    res.json(result);
  } catch (error) {
    console.error('QBR generation error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/metrics/qbr/:customerId
 * Get QBR history for a customer
 */
router.get('/qbr/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const { data, error } = await supabase
      .from('qbrs')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('QBR history error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// BENCHMARKS
// ============================================

/**
 * POST /api/metrics/benchmarks/evaluate
 * Evaluate metrics against benchmarks
 */
router.post('/benchmarks/evaluate', async (req: Request, res: Response) => {
  try {
    const { metrics } = req.body;

    const evaluations: Record<string, { value: number; rating: string }> = {};

    if (metrics.nrr !== undefined) {
      evaluations.nrr = { value: metrics.nrr, rating: evaluateNRRBenchmark(metrics.nrr) };
    }
    if (metrics.grr !== undefined) {
      evaluations.grr = { value: metrics.grr, rating: evaluateGRRBenchmark(metrics.grr) };
    }
    if (metrics.nps !== undefined) {
      evaluations.nps = { value: metrics.nps, rating: evaluateNPSBenchmark(metrics.nps) };
    }

    res.json(evaluations);
  } catch (error) {
    console.error('Benchmark evaluation error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/metrics/benchmarks
 * Get all benchmark definitions
 */
router.get('/benchmarks', async (_req: Request, res: Response) => {
  const benchmarks = {
    nrr: { excellent: '>120%', good: '100-120%', fair: '90-100%', poor: '<90%' },
    grr: { excellent: '>95%', good: '90-95%', fair: '85-90%', poor: '<85%' },
    nps: { excellent: '>50', good: '20-50', fair: '0-20', poor: '<0' },
    csat: { excellent: '>90%', good: '80-90%', fair: '70-80%', poor: '<70%' },
    ltvCac: { excellent: '>4:1', good: '3:1', fair: '1:1-2:1', poor: '<1:1' },
    cacPayback: { excellent: '<6mo', good: '6-12mo', fair: '12-18mo', poor: '>18mo' },
    monthlyChurn: { excellent: '<0.5%', good: '0.5-1%', fair: '1-2%', poor: '>2%' },
    dauMau: { excellent: '>25%', good: '15-25%', fair: '10-15%', poor: '<10%' }
  };

  res.json(benchmarks);
});

// ============================================
// FORMULA REFERENCE
// ============================================

/**
 * GET /api/metrics/formulas
 * Get all metric formulas for reference
 */
router.get('/formulas', async (_req: Request, res: Response) => {
  const formulas = {
    revenue: {
      mrr: 'ARPU × Active Customers',
      arr: 'MRR × 12',
      netNewMRR: 'New + Expansion + Reactivation - Contraction - Churned',
      arpu: 'Total Revenue / Total Users'
    },
    retention: {
      nrr: '((Start MRR + Expansion - Contraction - Churn) / Start MRR) × 100',
      grr: '((Start MRR - Contraction - Churn) / Start MRR) × 100',
      customerChurn: '(Lost Customers / Start Customers) × 100',
      revenueChurn: '((Churned + Contraction MRR) / Start MRR) × 100'
    },
    ltv: {
      ltv: '(ARPU × Gross Margin) / Churn Rate',
      cac: 'Total S&M Cost / New Customers',
      ltvCac: 'LTV / CAC',
      cacPayback: 'CAC / (Monthly ARPU × Gross Margin)'
    },
    health: {
      healthScore: 'Σ(Metric Score × Weight)'
    },
    satisfaction: {
      nps: '% Promoters - % Detractors',
      csat: '(Satisfied / Total) × 100',
      ces: 'Sum of Scores / Total Responses'
    },
    adoption: {
      productAdoption: '(Active Users / Total Signups) × 100',
      featureAdoption: '(Feature Users / Total Active) × 100',
      dauMau: '(DAU / MAU) × 100',
      activation: '(Activated / Signups) × 100'
    }
  };

  res.json(formulas);
});

export { router as metricsRoutes };
