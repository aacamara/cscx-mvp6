/**
 * Pattern Recognition Routes (PRD-233)
 *
 * API endpoints for AI-powered behavioral pattern recognition:
 * - GET  /api/patterns/:customerId           - Get patterns for a customer
 * - GET  /api/patterns/:customerId/meeting   - Get patterns for meeting prep context
 * - POST /api/patterns/:customerId/refresh   - Force refresh pattern analysis
 * - GET  /api/patterns/portfolio             - Get pattern summary across portfolio
 * - GET  /api/patterns/alerts                - Get pattern-based alerts
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { applyOrgFilter } from '../middleware/orgFilter.js';
import {
  patternRecognitionService,
  analyzeCustomerPatterns,
  getPatternsForMeetingPrep,
  PatternType,
  PatternAnalysisResult,
  DetectedPattern
} from '../services/ai/pattern-recognition.js';

const router = Router();

// Initialize Supabase client if configured
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

/**
 * GET /api/patterns/:customerId
 *
 * Get behavioral patterns for a specific customer.
 *
 * Query Parameters:
 * - lookbackDays (optional): Number of days to analyze (default: 90)
 * - types (optional): Comma-separated list of pattern types to include
 * - includeAI (optional): Include AI-generated summary (default: true)
 */
router.get('/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const {
      lookbackDays = '90',
      types,
      includeAI = 'true'
    } = req.query;

    const patternTypes = types
      ? (types as string).split(',') as PatternType[]
      : undefined;

    const analysis = await analyzeCustomerPatterns({
      customerId,
      lookbackDays: parseInt(lookbackDays as string, 10),
      patternTypes,
      includeAISummary: includeAI === 'true'
    });

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('[PatternRecognition] Error analyzing patterns:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PATTERN_ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to analyze patterns'
      }
    });
  }
});

/**
 * GET /api/patterns/:customerId/meeting
 *
 * Get patterns specifically relevant for meeting preparation.
 *
 * Query Parameters:
 * - meetingType (optional): Type of meeting (qbr, check_in, renewal, etc.)
 */
router.get('/:customerId/meeting', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { meetingType = 'check_in' } = req.query;

    const meetingPatterns = await getPatternsForMeetingPrep(
      customerId,
      meetingType as string
    );

    res.json({
      success: true,
      data: {
        customerId,
        meetingType,
        ...meetingPatterns
      }
    });
  } catch (error) {
    console.error('[PatternRecognition] Error getting meeting patterns:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MEETING_PATTERN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get meeting patterns'
      }
    });
  }
});

/**
 * POST /api/patterns/:customerId/refresh
 *
 * Force refresh pattern analysis for a customer, bypassing cache.
 */
router.post('/:customerId/refresh', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { lookbackDays = 90 } = req.body;

    const analysis = await analyzeCustomerPatterns({
      customerId,
      lookbackDays,
      forceRefresh: true,
      includeAISummary: true
    });

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('[PatternRecognition] Error refreshing patterns:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PATTERN_REFRESH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to refresh patterns'
      }
    });
  }
});

/**
 * GET /api/patterns/portfolio
 *
 * Get pattern summary across the entire customer portfolio.
 * Useful for identifying trends and prioritizing attention.
 *
 * Query Parameters:
 * - severity (optional): Filter by pattern severity (critical, warning, positive, info)
 * - limit (optional): Maximum customers to analyze (default: 20)
 */
router.get('/portfolio', async (req: Request, res: Response) => {
  try {
    const { severity, limit = '20' } = req.query;
    const maxCustomers = parseInt(limit as string, 10);

    // Get customers to analyze
    let customers: Array<{ id: string; name: string; health_score?: number }> = [];

    if (supabase) {
      let portfolioCustQuery = supabase.from('customers').select('id, name, health_score');
      portfolioCustQuery = applyOrgFilter(portfolioCustQuery, req);
      const { data } = await portfolioCustQuery
        .order('health_score', { ascending: true })
        .limit(maxCustomers);

      customers = data || [];
    } else {
      // Demo data
      customers = [
        { id: 'demo-1', name: 'TechCorp Industries', health_score: 55 },
        { id: 'demo-2', name: 'GlobalFinance Corp', health_score: 72 },
        { id: 'demo-3', name: 'Acme Corporation', health_score: 85 }
      ];
    }

    // Analyze patterns for each customer
    const portfolioAnalysis: Array<{
      customerId: string;
      customerName: string;
      healthScore?: number;
      patternCount: number;
      criticalCount: number;
      warningCount: number;
      positiveCount: number;
      overallRiskLevel: string;
      topPatterns: Array<{ name: string; severity: string }>;
    }> = [];

    const allPatterns: DetectedPattern[] = [];

    for (const customer of customers.slice(0, Math.min(maxCustomers, 10))) {
      try {
        const analysis = await analyzeCustomerPatterns({
          customerId: customer.id,
          lookbackDays: 60,
          includeAISummary: false
        });

        const criticalCount = analysis.patterns.filter(p => p.severity === 'critical').length;
        const warningCount = analysis.patterns.filter(p => p.severity === 'warning').length;
        const positiveCount = analysis.patterns.filter(p => p.severity === 'positive').length;

        // Apply severity filter if specified
        let filteredPatterns = analysis.patterns;
        if (severity) {
          filteredPatterns = filteredPatterns.filter(p => p.severity === severity);
        }

        if (filteredPatterns.length > 0 || !severity) {
          portfolioAnalysis.push({
            customerId: customer.id,
            customerName: customer.name,
            healthScore: customer.health_score,
            patternCount: analysis.patterns.length,
            criticalCount,
            warningCount,
            positiveCount,
            overallRiskLevel: analysis.overallRiskLevel,
            topPatterns: filteredPatterns.slice(0, 3).map(p => ({
              name: p.name,
              severity: p.severity
            }))
          });

          allPatterns.push(...filteredPatterns);
        }
      } catch (err) {
        console.error(`Error analyzing patterns for ${customer.id}:`, err);
      }
    }

    // Calculate portfolio-level statistics
    const patternTypeCounts = allPatterns.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const severityCounts = allPatterns.reduce((acc, p) => {
      acc[p.severity] = (acc[p.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Sort by risk level
    portfolioAnalysis.sort((a, b) => {
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (riskOrder[a.overallRiskLevel as keyof typeof riskOrder] || 3) -
             (riskOrder[b.overallRiskLevel as keyof typeof riskOrder] || 3);
    });

    res.json({
      success: true,
      data: {
        customersAnalyzed: portfolioAnalysis.length,
        totalPatterns: allPatterns.length,
        severityCounts,
        patternTypeCounts,
        highRiskCustomers: portfolioAnalysis.filter(c => ['critical', 'high'].includes(c.overallRiskLevel)).length,
        customers: portfolioAnalysis
      }
    });
  } catch (error) {
    console.error('[PatternRecognition] Error analyzing portfolio:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PORTFOLIO_ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to analyze portfolio patterns'
      }
    });
  }
});

/**
 * GET /api/patterns/alerts
 *
 * Get pattern-based alerts that need attention.
 * Returns customers with critical or warning patterns.
 *
 * Query Parameters:
 * - minSeverity (optional): Minimum severity level (default: warning)
 * - limit (optional): Maximum alerts to return (default: 10)
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const { minSeverity = 'warning', limit = '10' } = req.query;
    const maxAlerts = parseInt(limit as string, 10);

    // Get recent customers that might have alerts
    let customers: Array<{ id: string; name: string }> = [];

    if (supabase) {
      let alertCustQuery = supabase.from('customers').select('id, name');
      alertCustQuery = applyOrgFilter(alertCustQuery, req);
      const { data } = await alertCustQuery
        .order('updated_at', { ascending: false })
        .limit(20);

      customers = data || [];
    } else {
      customers = [
        { id: 'demo-1', name: 'TechCorp Industries' },
        { id: 'demo-2', name: 'GlobalFinance Corp' }
      ];
    }

    const alerts: Array<{
      id: string;
      customerId: string;
      customerName: string;
      pattern: {
        name: string;
        type: string;
        severity: string;
        insight: string;
        suggestedAction?: string;
      };
      detectedAt: string;
    }> = [];

    for (const customer of customers) {
      if (alerts.length >= maxAlerts) break;

      try {
        const analysis = await analyzeCustomerPatterns({
          customerId: customer.id,
          lookbackDays: 30,
          includeAISummary: false
        });

        const severityLevels = ['critical', 'warning', 'positive', 'info'];
        const minIndex = severityLevels.indexOf(minSeverity as string);
        const relevantPatterns = analysis.patterns.filter(p => {
          const patternIndex = severityLevels.indexOf(p.severity);
          return patternIndex <= minIndex;
        });

        for (const pattern of relevantPatterns) {
          if (alerts.length >= maxAlerts) break;

          alerts.push({
            id: uuidv4(),
            customerId: customer.id,
            customerName: customer.name,
            pattern: {
              name: pattern.name,
              type: pattern.type,
              severity: pattern.severity,
              insight: pattern.insight,
              suggestedAction: pattern.suggestedAction
            },
            detectedAt: pattern.detectedAt.toISOString()
          });
        }
      } catch (err) {
        console.error(`Error checking patterns for ${customer.id}:`, err);
      }
    }

    // Sort by severity
    alerts.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, positive: 2, info: 3 };
      return (severityOrder[a.pattern.severity as keyof typeof severityOrder] || 3) -
             (severityOrder[b.pattern.severity as keyof typeof severityOrder] || 3);
    });

    res.json({
      success: true,
      data: {
        alertCount: alerts.length,
        alerts
      }
    });
  } catch (error) {
    console.error('[PatternRecognition] Error getting alerts:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PATTERN_ALERTS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get pattern alerts'
      }
    });
  }
});

/**
 * GET /api/patterns/types
 *
 * Get available pattern types and their descriptions.
 */
router.get('/types', async (_req: Request, res: Response) => {
  const patternTypes = [
    { type: 'communication', description: 'Communication patterns and preferences', examples: ['Response times', 'Preferred channels', 'Communication gaps'] },
    { type: 'engagement', description: 'Product engagement and usage trends', examples: ['Usage trends', 'Feature adoption', 'Session patterns'] },
    { type: 'risk', description: 'Risk indicators and warning signals', examples: ['Health decline', 'Support spikes', 'Champion risk'] },
    { type: 'success', description: 'Positive signals and expansion opportunities', examples: ['Adoption milestones', 'Expansion signals', 'Advocacy potential'] },
    { type: 'meeting', description: 'Meeting behavior and follow-up patterns', examples: ['Attendance patterns', 'Follow-up completion', 'Meeting cadence'] },
    { type: 'stakeholder', description: 'Stakeholder relationship patterns', examples: ['Contact concentration', 'Executive engagement', 'Champion network'] },
    { type: 'usage', description: 'Detailed usage behavior patterns', examples: ['Session duration', 'Usage consistency', 'Feature depth'] }
  ];

  res.json({
    success: true,
    data: patternTypes
  });
});

/**
 * POST /api/patterns/:customerId/acknowledge
 *
 * Acknowledge a pattern (mark as reviewed).
 */
router.post('/:customerId/acknowledge', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { patternId, acknowledgedBy } = req.body;

    if (!patternId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PATTERN_ID',
          message: 'patternId is required'
        }
      });
    }

    // In a full implementation, this would update the database
    // For now, just return success

    res.json({
      success: true,
      data: {
        patternId,
        customerId,
        acknowledgedBy,
        acknowledgedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[PatternRecognition] Error acknowledging pattern:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ACKNOWLEDGE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to acknowledge pattern'
      }
    });
  }
});

export const patternRecognitionRoutes = router;
export default router;
