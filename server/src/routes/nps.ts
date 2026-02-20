/**
 * NPS Routes
 *
 * PRD-091: NPS Score Drop - Recovery Workflow
 *
 * API endpoints for NPS survey responses, history, and recovery workflows.
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import {
  createNpsResponse,
  getNpsHistory,
  initiateRecovery,
  updateRecoveryStatus,
  sendNpsDropNotification,
  getNpsCategory,
} from '../services/nps/index.js';
import { triggerEngine } from '../triggers/engine.js';
import type { CustomerEvent } from '../triggers/index.js';
import { applyOrgFilter } from '../middleware/orgFilter.js';

const router = Router();
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// ============================================
// NPS Response Ingestion
// ============================================

/**
 * POST /api/nps/responses
 * Ingest a new NPS survey response
 */
router.post('/responses', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      respondentEmail,
      respondentName,
      respondentRole,
      score,
      feedback,
      surveyId,
      surveyCampaign,
      submittedAt,
    } = req.body;

    // Validation
    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    if (!respondentEmail) {
      return res.status(400).json({ error: 'respondentEmail is required' });
    }

    if (score === undefined || score === null || typeof score !== 'number') {
      return res.status(400).json({ error: 'score must be a number' });
    }

    if (score < 0 || score > 10) {
      return res.status(400).json({ error: 'score must be between 0 and 10' });
    }

    // Create the NPS response
    const { response: npsResponse, dropResult } = await createNpsResponse({
      customerId,
      respondentEmail,
      respondentName,
      respondentRole,
      score,
      feedback,
      surveyId,
      surveyCampaign,
      submittedAt: submittedAt || new Date().toISOString(),
    }, req.organizationId);

    // Get customer info for context
    let customer: { id: string; name: string; arr?: number; healthScore?: number } | null = null;
    if (supabase) {
      let custQuery = supabase
        .from('customers')
        .select('id, name, arr, health_score');
      custQuery = applyOrgFilter(custQuery, req);
      const { data } = await custQuery
        .eq('id', customerId)
        .single();
      if (data) {
        customer = {
          id: data.id,
          name: data.name,
          arr: data.arr,
          healthScore: data.health_score,
        };
      }
    }

    // If there's a drop, trigger the recovery workflow
    if (dropResult?.shouldAlert) {
      // Process through trigger engine
      const event: CustomerEvent = {
        id: npsResponse.id,
        type: 'nps_response',
        customerId,
        customerName: customer?.name,
        data: {
          score: npsResponse.score,
          category: npsResponse.category,
          previousScore: dropResult.previousScore,
          previousCategory: dropResult.previousCategory,
          pointDrop: dropResult.pointDrop,
          feedback: npsResponse.feedback,
          feedbackAnalysis: npsResponse.feedbackAnalysis,
          respondentEmail: npsResponse.respondentEmail,
          respondentName: npsResponse.respondentName,
          respondentRole: npsResponse.respondentRole,
          severity: dropResult.severity,
        },
        timestamp: new Date(),
        source: 'nps_survey',
      };

      // Fire any matching triggers
      await triggerEngine.processEvent(event);

      // Auto-initiate recovery for critical/high severity
      if (dropResult.severity === 'critical' || dropResult.severity === 'high') {
        await initiateRecovery(npsResponse.id, dropResult.severity, req.organizationId);

        // Send Slack notification if webhook configured
        const slackWebhook = process.env.SLACK_NPS_WEBHOOK_URL || process.env.SLACK_ALERTS_WEBHOOK_URL;
        if (slackWebhook && customer) {
          await sendNpsDropNotification(slackWebhook, npsResponse, dropResult, customer);
        }
      }
    }

    res.status(201).json({
      response: npsResponse,
      dropDetected: dropResult?.shouldAlert ?? false,
      dropResult: dropResult || null,
    });
  } catch (error) {
    console.error('Error creating NPS response:', error);
    res.status(500).json({ error: 'Failed to create NPS response' });
  }
});

/**
 * GET /api/nps/responses
 * List NPS responses with filters
 */
router.get('/responses', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      category,
      startDate,
      endDate,
      recoveryStatus,
      limit = '50',
      offset = '0',
    } = req.query;

    if (!supabase) {
      return res.json({ responses: [], total: 0 });
    }

    let query = supabase
      .from('nps_responses')
      .select('*, customers(id, name)', { count: 'exact' })
      .order('submitted_at', { ascending: false });

    query = applyOrgFilter(query, req);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (startDate) {
      query = query.gte('submitted_at', startDate);
    }

    if (endDate) {
      query = query.lte('submitted_at', endDate);
    }

    if (recoveryStatus) {
      query = query.eq('recovery_status', recoveryStatus);
    }

    query = query.range(
      parseInt(offset as string),
      parseInt(offset as string) + parseInt(limit as string) - 1
    );

    const { data, count, error } = await query;

    if (error) throw error;

    res.json({
      responses: data || [],
      total: count || 0,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error('Error listing NPS responses:', error);
    res.status(500).json({ error: 'Failed to list NPS responses' });
  }
});

/**
 * GET /api/nps/responses/:responseId
 * Get a single NPS response
 */
router.get('/responses/:responseId', async (req: Request, res: Response) => {
  try {
    const { responseId } = req.params;

    if (!supabase) {
      return res.status(404).json({ error: 'NPS response not found' });
    }

    let query = supabase
      .from('nps_responses')
      .select('*, customers(id, name, arr, health_score)')
      .eq('id', responseId);

    query = applyOrgFilter(query, req);

    const { data, error } = await query.single();

    if (error || !data) {
      return res.status(404).json({ error: 'NPS response not found' });
    }

    res.json({ response: data });
  } catch (error) {
    console.error('Error getting NPS response:', error);
    res.status(500).json({ error: 'Failed to get NPS response' });
  }
});

// ============================================
// Customer NPS History
// ============================================

/**
 * GET /api/customers/:customerId/nps
 * Get NPS history for a customer
 */
router.get('/customers/:customerId/nps', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const history = await getNpsHistory(customerId, req.organizationId);

    res.json(history);
  } catch (error) {
    console.error('Error getting customer NPS history:', error);
    res.status(500).json({ error: 'Failed to get NPS history' });
  }
});

// ============================================
// Recovery Workflow
// ============================================

/**
 * POST /api/nps/responses/:responseId/initiate-recovery
 * Initiate recovery workflow for a response
 */
router.post('/responses/:responseId/initiate-recovery', async (req: Request, res: Response) => {
  try {
    const { responseId } = req.params;
    const { priority } = req.body;

    const result = await initiateRecovery(responseId, priority, req.organizationId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({ success: true, message: result.message });
  } catch (error) {
    console.error('Error initiating recovery:', error);
    res.status(500).json({ error: 'Failed to initiate recovery' });
  }
});

/**
 * PATCH /api/nps/responses/:responseId/recovery
 * Update recovery status
 */
router.patch('/responses/:responseId/recovery', async (req: Request, res: Response) => {
  try {
    const { responseId } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    if (!['pending', 'in_progress', 'resolved', 'unresolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await updateRecoveryStatus(responseId, status, notes, req.organizationId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({ success: true, message: result.message });
  } catch (error) {
    console.error('Error updating recovery status:', error);
    res.status(500).json({ error: 'Failed to update recovery status' });
  }
});

// ============================================
// NPS Analytics
// ============================================

/**
 * GET /api/nps/analytics
 * Get NPS analytics and trends
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    if (!supabase) {
      return res.json({
        totalResponses: 0,
        npsScore: null,
        categoryBreakdown: { promoter: 0, passive: 0, detractor: 0 },
        averageScore: null,
        trend: 'stable',
      });
    }

    // Get responses in period
    const { data: responses, error } = await supabase
      .from('nps_responses')
      .select('score, category, submitted_at')
      .gte('submitted_at', startDate.toISOString())
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    if (!responses || responses.length === 0) {
      return res.json({
        totalResponses: 0,
        npsScore: null,
        categoryBreakdown: { promoter: 0, passive: 0, detractor: 0 },
        averageScore: null,
        trend: 'stable',
      });
    }

    // Calculate metrics
    const promoters = responses.filter(r => r.category === 'promoter').length;
    const passives = responses.filter(r => r.category === 'passive').length;
    const detractors = responses.filter(r => r.category === 'detractor').length;

    const promoterPercent = (promoters / responses.length) * 100;
    const detractorPercent = (detractors / responses.length) * 100;
    const npsScore = Math.round(promoterPercent - detractorPercent);

    const totalScore = responses.reduce((sum, r) => sum + r.score, 0);
    const averageScore = Math.round(totalScore / responses.length * 10) / 10;

    // Calculate trend (compare first half to second half of period)
    const midpoint = Math.floor(responses.length / 2);
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (responses.length >= 4) {
      const recentAvg = responses.slice(0, midpoint).reduce((s, r) => s + r.score, 0) / midpoint;
      const olderAvg = responses.slice(midpoint).reduce((s, r) => s + r.score, 0) / (responses.length - midpoint);
      if (recentAvg - olderAvg > 0.5) trend = 'improving';
      else if (olderAvg - recentAvg > 0.5) trend = 'declining';
    }

    res.json({
      totalResponses: responses.length,
      npsScore,
      categoryBreakdown: {
        promoter: promoters,
        passive: passives,
        detractor: detractors,
      },
      percentageBreakdown: {
        promoter: Math.round(promoterPercent),
        passive: Math.round((passives / responses.length) * 100),
        detractor: Math.round(detractorPercent),
      },
      averageScore,
      trend,
      period: { days, startDate: startDate.toISOString() },
    });
  } catch (error) {
    console.error('Error getting NPS analytics:', error);
    res.status(500).json({ error: 'Failed to get NPS analytics' });
  }
});

/**
 * GET /api/nps/themes
 * Get aggregated themes from feedback analysis
 */
router.get('/themes', async (req: Request, res: Response) => {
  try {
    const { period = '30', category } = req.query;
    const days = parseInt(period as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    if (!supabase) {
      return res.json({ themes: [] });
    }

    let query = supabase
      .from('nps_responses')
      .select('feedback_analysis, category')
      .gte('submitted_at', startDate.toISOString())
      .not('feedback_analysis', 'is', null);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Aggregate themes
    const themeCounts: Record<string, { count: number; categories: Record<string, number> }> = {};

    for (const response of data || []) {
      const analysis = response.feedback_analysis as { themes?: string[] } | null;
      if (!analysis?.themes) continue;

      for (const theme of analysis.themes) {
        if (!themeCounts[theme]) {
          themeCounts[theme] = { count: 0, categories: {} };
        }
        themeCounts[theme].count++;
        themeCounts[theme].categories[response.category] =
          (themeCounts[theme].categories[response.category] || 0) + 1;
      }
    }

    // Sort by count and format
    const themes = Object.entries(themeCounts)
      .map(([theme, data]) => ({
        theme,
        count: data.count,
        categories: data.categories,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    res.json({
      themes,
      period: { days, startDate: startDate.toISOString() },
    });
  } catch (error) {
    console.error('Error getting NPS themes:', error);
    res.status(500).json({ error: 'Failed to get NPS themes' });
  }
});

// ============================================
// Survey Webhook Integration
// ============================================

/**
 * POST /api/nps/webhooks/delighted
 * Webhook endpoint for Delighted NPS
 */
router.post('/webhooks/delighted', async (req: Request, res: Response) => {
  try {
    const { person, survey_response } = req.body;

    // Map Delighted payload to our format
    const score = survey_response?.score;
    const email = person?.email;
    const name = person?.name;

    if (score === undefined || !email) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Try to find customer by email domain
    let customerId: string | null = null;
    if (supabase) {
      const domain = email.split('@')[1];
      let custQuery = supabase
        .from('customers')
        .select('id');
      custQuery = applyOrgFilter(custQuery, req);
      const { data: customers } = await custQuery
        .ilike('name', `%${domain.split('.')[0]}%`)
        .limit(1);
      customerId = customers?.[0]?.id || null;
    }

    if (!customerId) {
      return res.status(400).json({ error: 'Could not identify customer' });
    }

    const { response: npsResponse, dropResult } = await createNpsResponse({
      customerId,
      respondentEmail: email,
      respondentName: name,
      score,
      feedback: survey_response?.comment,
      surveyId: survey_response?.id,
      surveyCampaign: 'delighted',
      submittedAt: survey_response?.created_at || new Date().toISOString(),
    }, req.organizationId);

    res.json({ success: true, responseId: npsResponse.id, dropDetected: dropResult?.shouldAlert });
  } catch (error) {
    console.error('Error processing Delighted webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * POST /api/nps/webhooks/typeform
 * Webhook endpoint for Typeform NPS
 */
router.post('/webhooks/typeform', async (req: Request, res: Response) => {
  try {
    const { form_response } = req.body;
    const answers = form_response?.answers || [];
    const hidden = form_response?.hidden || {};

    // Find score answer (typically type: "opinion_scale" or "number")
    const scoreAnswer = answers.find((a: Record<string, unknown>) =>
      a.type === 'opinion_scale' || a.type === 'number'
    );
    const score = scoreAnswer?.number;

    // Find email
    const emailAnswer = answers.find((a: Record<string, unknown>) => a.type === 'email');
    const email = emailAnswer?.email || hidden.email;

    // Find comment
    const textAnswer = answers.find((a: Record<string, unknown>) => a.type === 'text');
    const feedback = textAnswer?.text;

    if (score === undefined || !email) {
      return res.status(400).json({ error: 'Invalid payload - missing score or email' });
    }

    // Get customer ID from hidden fields or lookup
    let customerId = hidden.customer_id;
    if (!customerId && supabase) {
      const domain = email.split('@')[1];
      let custQuery = supabase
        .from('customers')
        .select('id');
      custQuery = applyOrgFilter(custQuery, req);
      const { data: customers } = await custQuery
        .ilike('name', `%${domain.split('.')[0]}%`)
        .limit(1);
      customerId = customers?.[0]?.id || null;
    }

    if (!customerId) {
      return res.status(400).json({ error: 'Could not identify customer' });
    }

    const { response: npsResponse, dropResult } = await createNpsResponse({
      customerId,
      respondentEmail: email,
      respondentName: hidden.name,
      respondentRole: hidden.role,
      score,
      feedback,
      surveyId: form_response?.token,
      surveyCampaign: 'typeform',
      submittedAt: form_response?.submitted_at || new Date().toISOString(),
    }, req.organizationId);

    res.json({ success: true, responseId: npsResponse.id, dropDetected: dropResult?.shouldAlert });
  } catch (error) {
    console.error('Error processing Typeform webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
