/**
 * Risk Assessment Routes (PRD-229)
 * API endpoints for AI-powered risk assessment
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { applyOrgFilter } from '../middleware/orgFilter.js';
import {
  riskAssessmentService,
  assessRisk,
  getPortfolioRiskSummary,
  getAssessmentByCustomerId,
  updateMitigationStatus,
  createMitigationAction
} from '../services/riskAssessment.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Initialize Supabase client if configured
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

/**
 * GET /api/risk-assessment/customer/:customerId
 * Get risk assessment for a specific customer
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { refresh } = req.query;
    const forceRefresh = refresh === 'true';

    // Get customer data
    let customer = null;
    if (supabase) {
      let custQuery = supabase
        .from('customers')
        .select('*');
      custQuery = applyOrgFilter(custQuery, req);
      const { data, error } = await custQuery
        .eq('id', customerId)
        .single();

      if (error) {
        console.error('Failed to fetch customer:', error);
      } else {
        customer = data;
      }
    }

    if (!customer) {
      // Try to get existing assessment
      const existingAssessment = await getAssessmentByCustomerId(customerId);
      if (existingAssessment && !forceRefresh) {
        return res.json({
          success: true,
          data: existingAssessment
        });
      }

      // Return mock data for demo
      customer = {
        id: customerId,
        name: 'Demo Customer',
        industry: 'Technology',
        arr: 150000,
        health_score: 65
      };
    }

    // Build customer context for risk assessment
    const context = {
      customer_id: customer.id,
      customer_name: customer.name,
      industry: customer.industry,
      arr: customer.arr || 0,
      health_score: customer.health_score || 70,
      // Additional metrics would come from other sources
      days_to_renewal: customer.metadata?.days_to_renewal,
      champion_departed: customer.metadata?.champion_departed,
      stakeholder_count: customer.metadata?.stakeholder_count || 2,
      exec_sponsor_engaged: customer.metadata?.exec_sponsor_engaged ?? true,
      days_since_last_meeting: customer.metadata?.days_since_last_meeting || 14,
      meeting_sentiment_trend: customer.metadata?.meeting_sentiment_trend || 'stable',
      competitor_mentioned: customer.metadata?.competitor_mentioned,
      unresolved_tickets: customer.metadata?.unresolved_tickets || 0
    };

    // Generate risk assessment
    const assessment = await assessRisk(context, undefined, undefined, undefined, undefined, forceRefresh);

    res.json({
      success: true,
      data: assessment
    });
  } catch (error) {
    console.error('Risk assessment error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RISK_ASSESSMENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to assess risk'
      }
    });
  }
});

/**
 * GET /api/risk-assessment/deal/:dealId
 * Get risk assessment for a specific deal
 */
router.get('/deal/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { refresh } = req.query;
    const forceRefresh = refresh === 'true';

    // In a real implementation, you would fetch deal data from your CRM
    // For now, return a mock assessment

    const mockContext = {
      customer_id: 'demo-customer-' + dealId,
      customer_name: 'TechCorp Industries',
      industry: 'Technology',
      arr: 150000,
      health_score: 55,
      days_to_renewal: 62,
      champion_departed: true,
      champion_departure_date: '2026-01-15',
      stakeholder_count: 3,
      exec_sponsor_engaged: false,
      days_since_last_meeting: 21,
      meeting_sentiment_trend: 'declining' as const,
      competitor_mentioned: true,
      competitor_evidence: ['Mentioned "looking at options" in Jan 20 meeting', 'Requested feature comparison'],
      unresolved_tickets: 3
    };

    const assessment = await assessRisk(
      mockContext,
      dealId,
      'renewal',
      150000,
      '2026-03-31',
      forceRefresh
    );

    res.json({
      success: true,
      data: assessment
    });
  } catch (error) {
    console.error('Deal risk assessment error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DEAL_RISK_ASSESSMENT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to assess deal risk'
      }
    });
  }
});

/**
 * POST /api/risk-assessment/assess
 * Generate a new risk assessment with custom data
 */
router.post('/assess', async (req: Request, res: Response) => {
  try {
    const {
      customer_id,
      customer_name,
      industry,
      arr,
      health_score,
      deal_id,
      deal_type,
      deal_value,
      close_date,
      ...additionalContext
    } = req.body;

    if (!customer_id || !customer_name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'customer_id and customer_name are required'
        }
      });
    }

    const context = {
      customer_id,
      customer_name,
      industry,
      arr: arr || 0,
      health_score: health_score || 70,
      ...additionalContext
    };

    const assessment = await assessRisk(
      context,
      deal_id,
      deal_type,
      deal_value,
      close_date,
      true // Force refresh for new assessment
    );

    res.status(201).json({
      success: true,
      data: assessment
    });
  } catch (error) {
    console.error('Risk assessment creation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RISK_ASSESSMENT_CREATION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create risk assessment'
      }
    });
  }
});

/**
 * GET /api/risk-assessment/portfolio
 * Get portfolio-level risk summary
 */
router.get('/portfolio', async (req: Request, res: Response) => {
  try {
    const { csm_id } = req.query;
    const summary = await getPortfolioRiskSummary(csm_id as string | undefined);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Portfolio risk summary error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PORTFOLIO_RISK_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get portfolio risk summary'
      }
    });
  }
});

/**
 * GET /api/risk-assessment/customer/:customerId/history
 * Get risk assessment history for a customer
 */
router.get('/customer/:customerId/history', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { days = '90' } = req.query;
    const daysBack = parseInt(days as string, 10);

    if (!supabase) {
      // Return mock history
      const history = [];
      const today = new Date();
      for (let i = daysBack; i >= 0; i -= 7) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        history.push({
          date: date.toISOString().split('T')[0],
          risk_score: Math.floor(40 + Math.random() * 30),
          risk_level: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
        });
      }

      return res.json({
        success: true,
        data: {
          customer_id: customerId,
          history,
          period_days: daysBack
        }
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const { data, error } = await supabase
      .from('risk_assessment_history')
      .select('*')
      .eq('customer_id', customerId)
      .gte('recorded_at', startDate.toISOString())
      .order('recorded_at', { ascending: true });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        customer_id: customerId,
        history: (data || []).map(row => ({
          date: new Date(row.recorded_at).toISOString().split('T')[0],
          risk_score: row.risk_score,
          risk_level: row.risk_level
        })),
        period_days: daysBack
      }
    });
  } catch (error) {
    console.error('Risk history error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RISK_HISTORY_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get risk history'
      }
    });
  }
});

/**
 * PATCH /api/risk-assessment/customer/:customerId/risks/:riskId
 * Update status of an identified risk
 */
router.patch('/customer/:customerId/risks/:riskId', async (req: Request, res: Response) => {
  try {
    const { customerId, riskId } = req.params;
    const { status } = req.body;

    if (!status || !['acknowledged', 'mitigating', 'resolved'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Status must be one of: acknowledged, mitigating, resolved'
        }
      });
    }

    await updateMitigationStatus(customerId, riskId, status);

    res.json({
      success: true,
      message: `Risk status updated to ${status}`
    });
  } catch (error) {
    console.error('Risk status update error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RISK_UPDATE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update risk status'
      }
    });
  }
});

/**
 * POST /api/risk-assessment/customer/:customerId/mitigations
 * Create a mitigation action
 */
router.post('/customer/:customerId/mitigations', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { risk_id, action, deal_id } = req.body;

    if (!risk_id || !action) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'risk_id and action are required'
        }
      });
    }

    const result = await createMitigationAction(customerId, risk_id, action, deal_id);

    res.status(201).json({
      success: true,
      data: {
        id: result.id,
        customer_id: customerId,
        risk_id,
        action,
        status: 'pending',
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Mitigation creation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MITIGATION_CREATION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create mitigation action'
      }
    });
  }
});

/**
 * GET /api/risk-assessment/alerts
 * Get risk alerts (threshold crossings)
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const { status = 'unacknowledged', limit = '20' } = req.query;

    if (!supabase) {
      // Return mock alerts for development
      return res.json({
        success: true,
        data: {
          alerts: [
            {
              id: uuidv4(),
              customer_id: 'demo-1',
              customer_name: 'TechCorp Industries',
              alert_type: 'threshold_crossed',
              previous_level: 'medium',
              current_level: 'high',
              previous_score: 55,
              current_score: 72,
              triggered_at: new Date().toISOString(),
              acknowledged: false
            },
            {
              id: uuidv4(),
              customer_id: 'demo-2',
              customer_name: 'GlobalFinance Corp',
              alert_type: 'new_critical_risk',
              current_level: 'critical',
              current_score: 85,
              triggered_at: new Date(Date.now() - 3600000).toISOString(),
              acknowledged: false
            }
          ],
          total: 2
        }
      });
    }

    let query = supabase
      .from('risk_alerts')
      .select('*')
      .order('triggered_at', { ascending: false })
      .limit(parseInt(limit as string, 10));

    if (status === 'unacknowledged') {
      query = query.eq('acknowledged', false);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        alerts: data || [],
        total: (data || []).length
      }
    });
  } catch (error) {
    console.error('Risk alerts error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RISK_ALERTS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get risk alerts'
      }
    });
  }
});

/**
 * PATCH /api/risk-assessment/alerts/:alertId/acknowledge
 * Acknowledge a risk alert
 */
router.patch('/alerts/:alertId/acknowledge', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { acknowledged_by } = req.body;

    if (!supabase) {
      return res.json({
        success: true,
        message: 'Alert acknowledged (in-memory mode)'
      });
    }

    const { error } = await supabase
      .from('risk_alerts')
      .update({
        acknowledged: true,
        acknowledged_by,
        acknowledged_at: new Date().toISOString()
      })
      .eq('id', alertId);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Alert acknowledged'
    });
  } catch (error) {
    console.error('Alert acknowledge error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ALERT_ACKNOWLEDGE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to acknowledge alert'
      }
    });
  }
});

/**
 * GET /api/risk-assessment/stats
 * Get risk assessment statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (!supabase) {
      // Return mock stats
      return res.json({
        success: true,
        data: {
          total_assessments: 125,
          assessments_this_month: 45,
          avg_risk_score: 52,
          high_risk_count: 12,
          critical_risk_count: 3,
          mitigations_in_progress: 18,
          mitigations_completed_this_month: 8
        }
      });
    }

    // Get assessment stats
    const { data: assessments } = await supabase
      .from('risk_assessments')
      .select('overall_risk_score, risk_level')
      .order('assessed_at', { ascending: false });

    const { data: recentAssessments } = await supabase
      .from('risk_assessments')
      .select('id')
      .gte('assessed_at', thirtyDaysAgo.toISOString());

    const { data: mitigations } = await supabase
      .from('risk_mitigation_actions')
      .select('status, completed_at')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const allAssessments = assessments || [];
    const avgRiskScore = allAssessments.length > 0
      ? Math.round(allAssessments.reduce((sum, a) => sum + a.overall_risk_score, 0) / allAssessments.length)
      : 0;

    const highRiskCount = allAssessments.filter(a => a.risk_level === 'high').length;
    const criticalRiskCount = allAssessments.filter(a => a.risk_level === 'critical').length;

    const allMitigations = mitigations || [];
    const mitigationsInProgress = allMitigations.filter(m => m.status === 'in_progress').length;
    const mitigationsCompleted = allMitigations.filter(m => m.status === 'completed').length;

    res.json({
      success: true,
      data: {
        total_assessments: allAssessments.length,
        assessments_this_month: (recentAssessments || []).length,
        avg_risk_score: avgRiskScore,
        high_risk_count: highRiskCount,
        critical_risk_count: criticalRiskCount,
        mitigations_in_progress: mitigationsInProgress,
        mitigations_completed_this_month: mitigationsCompleted
      }
    });
  } catch (error) {
    console.error('Risk stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RISK_STATS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get risk stats'
      }
    });
  }
});

export const riskAssessmentRoutes = router;
export default router;
