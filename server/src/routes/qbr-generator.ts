/**
 * QBR Generator Routes
 * PRD-220: Intelligent QBR Generator
 *
 * API endpoints for AI-powered QBR deck generation
 */

import { Router, Request, Response } from 'express';
import { qbrGeneratorService, type QBRGenerateRequest, type Quarter } from '../services/qbr/qbrGenerator.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { applyOrgFilter } from '../middleware/orgFilter.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

/**
 * POST /api/qbr/generate
 * Generate a new QBR presentation/document
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || req.body.userId;
    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' }
      });
    }

    const {
      customerId,
      quarter,
      year,
      format = 'presentation',
      includeSections,
      customData
    } = req.body;

    if (!customerId) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Customer ID is required' }
      });
    }

    if (!quarter || !['Q1', 'Q2', 'Q3', 'Q4'].includes(quarter)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Valid quarter (Q1-Q4) is required' }
      });
    }

    const currentYear = new Date().getFullYear();
    const requestYear = year || currentYear;
    if (requestYear < 2020 || requestYear > currentYear + 1) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid year' }
      });
    }

    const request: QBRGenerateRequest = {
      customerId,
      quarter: quarter as Quarter,
      year: requestYear,
      format: format as 'presentation' | 'document' | 'both',
      includeSections,
      customData
    };

    // Generate QBR
    const result = await qbrGeneratorService.generateQBR(userId, request);

    res.status(201).json({
      success: true,
      message: 'QBR generated successfully',
      qbr: {
        id: result.id,
        customerId: result.customerId,
        customerName: result.customerName,
        quarter: result.quarter,
        year: result.year,
        status: result.status,
        presentationId: result.presentationId,
        presentationUrl: result.presentationUrl,
        documentId: result.documentId,
        documentUrl: result.documentUrl,
        generatedAt: result.generatedAt
      },
      content: result.content
    });
  } catch (error) {
    console.error('QBR generation error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to generate QBR'
      }
    });
  }
});

/**
 * GET /api/qbr/customer/:customerId
 * Get all QBRs for a customer
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const qbrs = await qbrGeneratorService.getCustomerQBRs(customerId);

    res.json({
      success: true,
      qbrs,
      count: qbrs.length
    });
  } catch (error) {
    console.error('Error fetching customer QBRs:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch QBRs' }
    });
  }
});

/**
 * GET /api/qbr/:qbrId
 * Get a specific QBR by ID
 */
router.get('/:qbrId', async (req: Request, res: Response) => {
  try {
    const { qbrId } = req.params;

    const qbr = await qbrGeneratorService.getQBR(qbrId);

    if (!qbr) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'QBR not found' }
      });
    }

    res.json({
      success: true,
      qbr
    });
  } catch (error) {
    console.error('Error fetching QBR:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch QBR' }
    });
  }
});

/**
 * PATCH /api/qbr/:qbrId/status
 * Update QBR status
 */
router.patch('/:qbrId/status', async (req: Request, res: Response) => {
  try {
    const { qbrId } = req.params;
    const { status } = req.body;

    if (!['generating', 'draft', 'ready', 'presented'].includes(status)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid status' }
      });
    }

    await qbrGeneratorService.updateQBRStatus(qbrId, status);

    res.json({
      success: true,
      message: 'QBR status updated'
    });
  } catch (error) {
    console.error('Error updating QBR status:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update QBR status' }
    });
  }
});

/**
 * GET /api/qbr/preview/:customerId
 * Preview QBR data without generating presentation
 */
router.get('/preview/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { quarter, year } = req.query;

    if (!supabase) {
      return res.status(500).json({
        error: { code: 'DATABASE_ERROR', message: 'Database not configured' }
      });
    }

    // Get current quarter if not specified
    const now = new Date();
    const currentQuarter = quarter as string || `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
    const currentYear = year ? parseInt(year as string) : now.getFullYear();

    // Fetch customer
    let custQuery = supabase
      .from('customers')
      .select('*');
    custQuery = applyOrgFilter(custQuery, req);
    const { data: customer, error: customerError } = await custQuery
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Customer not found' }
      });
    }

    // Fetch recent metrics
    const { data: metrics } = await supabase
      .from('usage_metrics')
      .select('*')
      .eq('customer_id', customerId)
      .order('metric_date', { ascending: false })
      .limit(10);

    // Fetch recent support tickets
    let ticketsQuery = supabase
      .from('support_tickets')
      .select('*');
    ticketsQuery = applyOrgFilter(ticketsQuery, req);
    const { data: tickets } = await ticketsQuery
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Fetch stakeholders
    const { data: stakeholders } = await supabase
      .from('stakeholders')
      .select('*')
      .eq('customer_id', customerId);

    // Calculate health trend
    let healthTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (metrics && metrics.length >= 2) {
      const recentScores = metrics.slice(0, 3).map(m => m.health_score || 0).filter(s => s > 0);
      const olderScores = metrics.slice(-3).map(m => m.health_score || 0).filter(s => s > 0);
      if (recentScores.length > 0 && olderScores.length > 0) {
        const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
        const olderAvg = olderScores.reduce((a, b) => a + b, 0) / olderScores.length;
        if (recentAvg > olderAvg + 5) healthTrend = 'improving';
        else if (recentAvg < olderAvg - 5) healthTrend = 'declining';
      }
    }

    // Calculate usage metrics
    const latestMetric = metrics && metrics.length > 0 ? metrics[0] : null;
    const activeUsers = latestMetric?.active_users || 50;
    const totalUsers = latestMetric?.total_users || 75;

    // Calculate support summary
    const resolvedTickets = tickets ? tickets.filter(t => t.status === 'resolved' || t.status === 'closed') : [];
    const openTickets = tickets ? tickets.filter(t => t.status === 'open' || t.status === 'in_progress') : [];

    res.json({
      success: true,
      preview: {
        customer: {
          id: customer.id,
          name: customer.name,
          arr: customer.arr || 0,
          healthScore: customer.health_score || 70,
          healthTrend,
          industry: customer.industry,
          renewalDate: customer.renewal_date
        },
        quarter: currentQuarter,
        year: currentYear,
        metrics: {
          activeUsers,
          totalUsers,
          adoptionRate: Math.round((activeUsers / totalUsers) * 100),
          usageTrend: healthTrend
        },
        support: {
          totalTickets: tickets?.length || 0,
          resolvedTickets: resolvedTickets.length,
          openTickets: openTickets.length,
          satisfactionScore: 4.2
        },
        stakeholders: (stakeholders || []).map(s => ({
          name: s.name,
          role: s.role,
          email: s.email
        })),
        dataAvailable: {
          metrics: (metrics?.length || 0) > 0,
          tickets: (tickets?.length || 0) > 0,
          stakeholders: (stakeholders?.length || 0) > 0
        }
      }
    });
  } catch (error) {
    console.error('QBR preview error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate preview' }
    });
  }
});

/**
 * POST /api/qbr/:qbrId/regenerate
 * Regenerate specific sections of a QBR
 */
router.post('/:qbrId/regenerate', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || req.body.userId;
    const { qbrId } = req.params;
    const { sections, customData } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' }
      });
    }

    // Get existing QBR
    const existingQbr = await qbrGeneratorService.getQBR(qbrId);
    if (!existingQbr) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'QBR not found' }
      });
    }

    // Regenerate with specified sections or full regeneration
    const result = await qbrGeneratorService.generateQBR(userId, {
      customerId: existingQbr.customerId,
      quarter: existingQbr.quarter,
      year: existingQbr.year,
      format: existingQbr.presentationId ? 'presentation' : 'document',
      includeSections: sections,
      customData
    });

    res.json({
      success: true,
      message: 'QBR regenerated successfully',
      qbr: result
    });
  } catch (error) {
    console.error('QBR regeneration error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to regenerate QBR' }
    });
  }
});

/**
 * GET /api/qbr/templates
 * Get available QBR templates
 */
router.get('/templates', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    templates: [
      {
        id: 'standard',
        name: 'Standard QBR',
        description: 'Comprehensive quarterly review with all sections',
        sections: [
          'executive_summary',
          'partnership_health',
          'usage_metrics',
          'key_achievements',
          'challenges_addressed',
          'support_summary',
          'product_roadmap',
          'recommendations',
          'next_quarter_goals'
        ]
      },
      {
        id: 'executive',
        name: 'Executive Summary',
        description: 'High-level overview for executive stakeholders',
        sections: [
          'executive_summary',
          'partnership_health',
          'key_achievements',
          'strategic_initiatives'
        ]
      },
      {
        id: 'tactical',
        name: 'Tactical Review',
        description: 'Detailed operational review',
        sections: [
          'usage_metrics',
          'support_summary',
          'challenges_addressed',
          'recommendations',
          'next_quarter_goals'
        ]
      }
    ]
  });
});

export default router;
