/**
 * Survey Routes
 * PRD-142: Survey Completed -> Analysis + Action
 *
 * API endpoints for survey responses, analysis, and follow-up workflows.
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import {
  createSurveyResponse,
  getSurveyResponses,
  getCustomerSurveyHistory,
  updateFollowUpStatus,
  generateFollowUpEmail,
  getSurveyAnalytics,
  notifyCsmOfSurveyResponse,
  getSurveyCategory,
  SurveyType,
  SurveyCategory,
} from '../services/survey/index.js';
import { triggerEngine } from '../triggers/engine.js';
import type { CustomerEvent } from '../triggers/index.js';
import { applyOrgFilter } from '../middleware/orgFilter.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// ============================================
// Survey Response CRUD
// ============================================

/**
 * POST /api/surveys/response
 * Record a new survey response
 */
router.post('/response', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      stakeholderId,
      surveyId,
      surveyType,
      surveyName,
      surveyCampaign,
      respondentEmail,
      respondentName,
      respondentRole,
      score,
      maxScore,
      verbatim,
      answers,
      submittedAt,
    } = req.body;

    // Validation
    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }
    if (!surveyId) {
      return res.status(400).json({ error: 'surveyId is required' });
    }
    if (!surveyType || !['nps', 'csat', 'onboarding', 'qbr', 'custom'].includes(surveyType)) {
      return res.status(400).json({ error: 'surveyType must be one of: nps, csat, onboarding, qbr, custom' });
    }
    if (!respondentEmail) {
      return res.status(400).json({ error: 'respondentEmail is required' });
    }

    // Create the survey response
    const { response: surveyResponse, dropResult } = await createSurveyResponse({
      customerId,
      stakeholderId,
      surveyId,
      surveyType,
      surveyName: surveyName || `${surveyType.toUpperCase()} Survey`,
      surveyCampaign,
      respondentEmail,
      respondentName,
      respondentRole,
      score,
      maxScore,
      verbatim,
      answers,
      submittedAt: submittedAt || new Date().toISOString(),
    });

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

    // Process through trigger engine
    const event: CustomerEvent = {
      id: surveyResponse.id,
      type: 'survey_response',
      customerId,
      customerName: customer?.name,
      data: {
        surveyType: surveyResponse.survey.type,
        surveyName: surveyResponse.survey.name,
        score: surveyResponse.response.score,
        maxScore: surveyResponse.response.maxScore,
        category: surveyResponse.category,
        verbatim: surveyResponse.response.verbatim,
        analysis: surveyResponse.analysis,
        respondent: surveyResponse.respondent,
        isDetractor: surveyResponse.category === 'detractor',
        isScoreDrop: dropResult?.shouldAlert ?? false,
        scoreDropAmount: dropResult?.pointDrop ?? undefined,
        previousCategory: dropResult?.previousCategory ?? undefined,
      },
      timestamp: new Date(),
      source: `${surveyType}_survey`,
    };

    await triggerEngine.processEvent(event);

    // Notify CSM for detractors, score drops, or urgent feedback
    const shouldNotify = dropResult?.shouldAlert ||
      surveyResponse.category === 'detractor' ||
      surveyResponse.analysis?.urgency === 'high' ||
      surveyResponse.analysis?.mentionsCompetitor;

    if (shouldNotify && customer) {
      await notifyCsmOfSurveyResponse(surveyResponse, dropResult, customer);
    }

    res.status(201).json({
      response: surveyResponse,
      dropDetected: dropResult?.shouldAlert ?? false,
      dropResult: dropResult || null,
      notificationSent: shouldNotify,
    });
  } catch (error) {
    console.error('Error creating survey response:', error);
    res.status(500).json({ error: 'Failed to create survey response' });
  }
});

/**
 * GET /api/surveys/responses
 * List survey responses with filters
 */
router.get('/responses', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      surveyType,
      category,
      startDate,
      endDate,
      followUpRequired,
      limit = '50',
      offset = '0',
    } = req.query;

    const { responses, total } = await getSurveyResponses({
      customerId: customerId as string | undefined,
      surveyType: surveyType as SurveyType | undefined,
      category: category as SurveyCategory | undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      followUpRequired: followUpRequired !== undefined ? followUpRequired === 'true' : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({
      responses,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error('Error listing survey responses:', error);
    res.status(500).json({ error: 'Failed to list survey responses' });
  }
});

/**
 * GET /api/surveys/responses/:responseId
 * Get a single survey response
 */
router.get('/responses/:responseId', async (req: Request, res: Response) => {
  try {
    const { responseId } = req.params;

    if (!supabase) {
      return res.status(404).json({ error: 'Survey response not found' });
    }

    const { data, error } = await supabase
      .from('survey_responses')
      .select('*, customers(id, name, arr, health_score)')
      .eq('id', responseId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Survey response not found' });
    }

    res.json({ response: data });
  } catch (error) {
    console.error('Error getting survey response:', error);
    res.status(500).json({ error: 'Failed to get survey response' });
  }
});

// ============================================
// Customer Survey History
// ============================================

/**
 * GET /api/surveys/customer/:customerId
 * Get survey history for a customer
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const history = await getCustomerSurveyHistory(customerId);

    res.json(history);
  } catch (error) {
    console.error('Error getting customer survey history:', error);
    res.status(500).json({ error: 'Failed to get survey history' });
  }
});

// ============================================
// Follow-Up Management
// ============================================

/**
 * PUT /api/surveys/:id/follow-up
 * Update follow-up status for a survey response
 */
router.put('/:id/follow-up', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, sent, closedLoop, notes, draftId, draftContent } = req.body;

    const result = await updateFollowUpStatus(id, {
      status,
      sent,
      closedLoop,
      notes,
      draftId,
      draftContent,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({ success: true, message: result.message });
  } catch (error) {
    console.error('Error updating follow-up status:', error);
    res.status(500).json({ error: 'Failed to update follow-up status' });
  }
});

/**
 * POST /api/surveys/:id/generate-follow-up
 * Generate a follow-up email draft using AI
 */
router.post('/:id/generate-follow-up', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { customizePrompt, tone } = req.body;

    const result = await generateFollowUpEmail(id, { customizePrompt, tone });

    if (!result) {
      return res.status(404).json({ error: 'Survey response not found or could not generate follow-up' });
    }

    res.json({
      draft: result,
      message: 'Follow-up email draft generated successfully',
    });
  } catch (error) {
    console.error('Error generating follow-up:', error);
    res.status(500).json({ error: 'Failed to generate follow-up email' });
  }
});

/**
 * POST /api/surveys/:id/send-follow-up
 * Mark follow-up as sent
 */
router.post('/:id/send-follow-up', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await updateFollowUpStatus(id, {
      sent: true,
      status: 'follow_up_sent',
    });

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({ success: true, message: 'Follow-up marked as sent' });
  } catch (error) {
    console.error('Error marking follow-up as sent:', error);
    res.status(500).json({ error: 'Failed to mark follow-up as sent' });
  }
});

/**
 * POST /api/surveys/:id/close-loop
 * Close the feedback loop for a survey response
 */
router.post('/:id/close-loop', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const result = await updateFollowUpStatus(id, {
      closedLoop: true,
      status: 'closed',
      notes,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({ success: true, message: 'Loop closed successfully' });
  } catch (error) {
    console.error('Error closing loop:', error);
    res.status(500).json({ error: 'Failed to close loop' });
  }
});

// ============================================
// Survey Analytics
// ============================================

/**
 * GET /api/surveys/analysis
 * Get survey analytics and trends
 */
router.get('/analysis', async (req: Request, res: Response) => {
  try {
    const { customerId, surveyType, startDate, endDate } = req.query;

    const analytics = await getSurveyAnalytics({
      customerId: customerId as string | undefined,
      surveyType: surveyType as SurveyType | undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json(analytics);
  } catch (error) {
    console.error('Error getting survey analytics:', error);
    res.status(500).json({ error: 'Failed to get survey analytics' });
  }
});

/**
 * GET /api/surveys/themes
 * Get aggregated themes from survey feedback
 */
router.get('/themes', async (req: Request, res: Response) => {
  try {
    const { period = '30', surveyType, category } = req.query;
    const days = parseInt(period as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    if (!supabase) {
      return res.json({ themes: [] });
    }

    let query = supabase
      .from('survey_responses')
      .select('analysis, category, survey_type')
      .gte('submitted_at', startDate.toISOString())
      .not('analysis', 'is', null);

    if (surveyType) {
      query = query.eq('survey_type', surveyType);
    }
    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Aggregate themes
    const themeCounts: Record<string, {
      count: number;
      categories: Record<string, number>;
      surveyTypes: Record<string, number>;
      sentiments: string[];
    }> = {};

    for (const response of data || []) {
      const analysis = response.analysis as { themes?: string[]; sentiment?: string } | null;
      if (!analysis?.themes) continue;

      for (const theme of analysis.themes) {
        if (!themeCounts[theme]) {
          themeCounts[theme] = { count: 0, categories: {}, surveyTypes: {}, sentiments: [] };
        }
        themeCounts[theme].count++;
        themeCounts[theme].categories[response.category] =
          (themeCounts[theme].categories[response.category] || 0) + 1;
        themeCounts[theme].surveyTypes[response.survey_type] =
          (themeCounts[theme].surveyTypes[response.survey_type] || 0) + 1;
        if (analysis.sentiment) {
          themeCounts[theme].sentiments.push(analysis.sentiment);
        }
      }
    }

    // Sort by count and format
    const themes = Object.entries(themeCounts)
      .map(([theme, data]) => {
        const sentimentCounts = data.sentiments.reduce((acc, s) => {
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        const dominantSentiment = Object.entries(sentimentCounts)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

        return {
          theme,
          count: data.count,
          categories: data.categories,
          surveyTypes: data.surveyTypes,
          sentiment: dominantSentiment,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    res.json({
      themes,
      period: { days, startDate: startDate.toISOString() },
    });
  } catch (error) {
    console.error('Error getting survey themes:', error);
    res.status(500).json({ error: 'Failed to get survey themes' });
  }
});

/**
 * GET /api/surveys/follow-up-report
 * Get follow-up completion metrics
 */
router.get('/follow-up-report', async (req: Request, res: Response) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    if (!supabase) {
      return res.json({
        totalRequired: 0,
        sent: 0,
        closed: 0,
        pending: 0,
        closeRate: 0,
        avgTimeToClose: null,
        byCategory: {},
        bySurveyType: {},
      });
    }

    const { data, error } = await supabase
      .from('survey_responses')
      .select('follow_up, category, survey_type, created_at')
      .gte('created_at', startDate.toISOString())
      .eq('follow_up->required', true);

    if (error) throw error;

    let totalRequired = 0;
    let sent = 0;
    let closed = 0;
    let totalCloseTime = 0;
    let closedCount = 0;
    const byCategory: Record<string, { required: number; sent: number; closed: number }> = {};
    const bySurveyType: Record<string, { required: number; sent: number; closed: number }> = {};

    for (const response of data || []) {
      const followUp = response.follow_up as {
        required: boolean;
        sent: boolean;
        closedLoop: boolean;
        closedAt?: string;
      };

      if (!followUp.required) continue;

      totalRequired++;
      if (followUp.sent) sent++;
      if (followUp.closedLoop) {
        closed++;
        if (followUp.closedAt) {
          const createdAt = new Date(response.created_at);
          const closedAt = new Date(followUp.closedAt);
          totalCloseTime += closedAt.getTime() - createdAt.getTime();
          closedCount++;
        }
      }

      // By category
      if (!byCategory[response.category]) {
        byCategory[response.category] = { required: 0, sent: 0, closed: 0 };
      }
      byCategory[response.category].required++;
      if (followUp.sent) byCategory[response.category].sent++;
      if (followUp.closedLoop) byCategory[response.category].closed++;

      // By survey type
      if (!bySurveyType[response.survey_type]) {
        bySurveyType[response.survey_type] = { required: 0, sent: 0, closed: 0 };
      }
      bySurveyType[response.survey_type].required++;
      if (followUp.sent) bySurveyType[response.survey_type].sent++;
      if (followUp.closedLoop) bySurveyType[response.survey_type].closed++;
    }

    const avgTimeToClose = closedCount > 0
      ? Math.round(totalCloseTime / closedCount / (1000 * 60 * 60 * 24)) // Days
      : null;

    res.json({
      totalRequired,
      sent,
      closed,
      pending: totalRequired - closed,
      closeRate: totalRequired > 0 ? Math.round(closed / totalRequired * 100) : 0,
      avgTimeToClose,
      byCategory,
      bySurveyType,
      period: { days, startDate: startDate.toISOString() },
    });
  } catch (error) {
    console.error('Error getting follow-up report:', error);
    res.status(500).json({ error: 'Failed to get follow-up report' });
  }
});

// ============================================
// Webhook Integrations
// ============================================

/**
 * POST /api/surveys/webhooks/delighted
 * Webhook endpoint for Delighted surveys
 */
router.post('/webhooks/delighted', async (req: Request, res: Response) => {
  try {
    const { person, survey_response } = req.body;

    const score = survey_response?.score;
    const email = person?.email;
    const name = person?.name;

    if (score === undefined || !email) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Find customer by email domain
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

    const { response, dropResult } = await createSurveyResponse({
      customerId,
      surveyId: survey_response?.id || `delighted-${Date.now()}`,
      surveyType: 'nps',
      surveyName: 'Delighted NPS',
      surveyCampaign: 'delighted',
      respondentEmail: email,
      respondentName: name,
      score,
      maxScore: 10,
      verbatim: survey_response?.comment,
      submittedAt: survey_response?.created_at || new Date().toISOString(),
    });

    res.json({
      success: true,
      responseId: response.id,
      dropDetected: dropResult?.shouldAlert,
    });
  } catch (error) {
    console.error('Error processing Delighted webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * POST /api/surveys/webhooks/typeform
 * Webhook endpoint for Typeform surveys
 */
router.post('/webhooks/typeform', async (req: Request, res: Response) => {
  try {
    const { form_response } = req.body;
    const answers = form_response?.answers || [];
    const hidden = form_response?.hidden || {};

    // Find score answer
    const scoreAnswer = answers.find((a: { type: string }) =>
      a.type === 'opinion_scale' || a.type === 'number'
    );
    const score = scoreAnswer?.number;

    // Find email
    const emailAnswer = answers.find((a: { type: string }) => a.type === 'email');
    const email = emailAnswer?.email || hidden.email;

    // Find comment
    const textAnswer = answers.find((a: { type: string }) => a.type === 'text');
    const feedback = textAnswer?.text;

    if (score === undefined || !email) {
      return res.status(400).json({ error: 'Invalid payload - missing score or email' });
    }

    // Get customer ID
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

    // Determine survey type from hidden fields or default to NPS
    const surveyType = (hidden.survey_type as SurveyType) || 'nps';
    const maxScore = surveyType === 'csat' ? 5 : 10;

    const { response, dropResult } = await createSurveyResponse({
      customerId,
      surveyId: form_response?.token || `typeform-${Date.now()}`,
      surveyType,
      surveyName: hidden.survey_name || `Typeform ${surveyType.toUpperCase()}`,
      surveyCampaign: 'typeform',
      respondentEmail: email,
      respondentName: hidden.name,
      respondentRole: hidden.role,
      score,
      maxScore,
      verbatim: feedback,
      submittedAt: form_response?.submitted_at || new Date().toISOString(),
    });

    res.json({
      success: true,
      responseId: response.id,
      dropDetected: dropResult?.shouldAlert,
    });
  } catch (error) {
    console.error('Error processing Typeform webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * POST /api/surveys/webhooks/surveymonkey
 * Webhook endpoint for SurveyMonkey
 */
router.post('/webhooks/surveymonkey', async (req: Request, res: Response) => {
  try {
    const { object_type, object_id, event_type, resources } = req.body;

    if (object_type !== 'response' || event_type !== 'response_completed') {
      return res.json({ success: true, message: 'Event ignored' });
    }

    // In a full implementation, you would fetch the response details
    // from SurveyMonkey API using the resources.response_id

    res.json({
      success: true,
      message: 'Webhook received. Full implementation requires SurveyMonkey API integration.',
      surveyId: resources?.survey_id,
      responseId: resources?.response_id,
    });
  } catch (error) {
    console.error('Error processing SurveyMonkey webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * POST /api/surveys/webhooks/generic
 * Generic webhook for custom survey integrations
 */
router.post('/webhooks/generic', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      surveyId,
      surveyType = 'custom',
      surveyName,
      respondentEmail,
      respondentName,
      respondentRole,
      score,
      maxScore,
      verbatim,
      answers,
      submittedAt,
    } = req.body;

    if (!customerId || !respondentEmail) {
      return res.status(400).json({
        error: 'customerId and respondentEmail are required',
      });
    }

    const { response, dropResult } = await createSurveyResponse({
      customerId,
      surveyId: surveyId || `generic-${Date.now()}`,
      surveyType,
      surveyName: surveyName || 'Custom Survey',
      respondentEmail,
      respondentName,
      respondentRole,
      score,
      maxScore: maxScore || 10,
      verbatim,
      answers,
      submittedAt: submittedAt || new Date().toISOString(),
    });

    res.json({
      success: true,
      responseId: response.id,
      dropDetected: dropResult?.shouldAlert,
      category: response.category,
    });
  } catch (error) {
    console.error('Error processing generic webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
