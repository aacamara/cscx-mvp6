/**
 * NPS Service
 *
 * PRD-091: NPS Score Drop - Recovery Workflow
 *
 * Handles NPS response processing, drop detection, sentiment analysis,
 * and recovery workflow initiation.
 */

import { v4 as uuidv4 } from 'uuid';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import { recalculateHealthScore } from '../usage/health-score.js';
import { sendSlackAlert } from '../notifications/slack.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Types
// ============================================

export type NPSCategory = 'promoter' | 'passive' | 'detractor';

export type RecoveryStatus = 'pending' | 'in_progress' | 'resolved' | 'unresolved';

export type FeedbackCategory = 'product' | 'support' | 'value' | 'relationship' | 'other';

export interface NpsResponse {
  id: string;
  customerId: string;
  respondentEmail: string;
  respondentName?: string;
  respondentRole?: string;
  score: number;
  category: NPSCategory;
  feedback?: string;
  feedbackAnalysis?: FeedbackAnalysis;
  surveyId?: string;
  surveyCampaign?: string;
  submittedAt: Date;
  processedAt?: Date;
  recoveryInitiated: boolean;
  recoveryStatus?: RecoveryStatus;
  createdAt: Date;
}

export interface FeedbackAnalysis {
  sentiment: 'positive' | 'negative' | 'mixed' | 'neutral';
  sentimentScore: number; // -1 to 1
  themes: string[];
  category: FeedbackCategory;
  mentionsCompetitor: boolean;
  competitorName?: string;
  actionableItems: string[];
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface NpsDropResult {
  shouldAlert: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  previousScore: number | null;
  newScore: number;
  previousCategory: NPSCategory | null;
  newCategory: NPSCategory;
  pointDrop: number | null;
  isFirstDetractor: boolean;
  isRecurringDetractor: boolean;
}

export interface NpsHistory {
  currentScore: number | null;
  currentCategory: NPSCategory | null;
  averageScore: number | null;
  responseCount: number;
  trend: 'improving' | 'stable' | 'declining';
  history: NpsResponse[];
  detractorCount: number;
  lastRecoveryAttempt?: Date;
}

export interface CreateNpsResponseInput {
  customerId: string;
  respondentEmail: string;
  respondentName?: string;
  respondentRole?: string;
  score: number;
  feedback?: string;
  surveyId?: string;
  surveyCampaign?: string;
  submittedAt: string | Date;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get NPS category from score
 */
export function getNpsCategory(score: number): NPSCategory {
  if (score >= 9) return 'promoter';
  if (score >= 7) return 'passive';
  return 'detractor';
}

/**
 * Calculate NPS score from responses
 */
export function calculateNpsScore(responses: NpsResponse[]): number | null {
  if (responses.length === 0) return null;

  const promoters = responses.filter(r => r.category === 'promoter').length;
  const detractors = responses.filter(r => r.category === 'detractor').length;

  const promoterPercent = (promoters / responses.length) * 100;
  const detractorPercent = (detractors / responses.length) * 100;

  return Math.round(promoterPercent - detractorPercent);
}

// ============================================
// Core NPS Service
// ============================================

/**
 * Create a new NPS response and process for drops
 */
export async function createNpsResponse(
  input: CreateNpsResponseInput,
  organizationId: string | null = null
): Promise<{ response: NpsResponse; dropResult: NpsDropResult | null }> {
  const id = uuidv4();
  const score = input.score;
  const category = getNpsCategory(score);
  const submittedAt = new Date(input.submittedAt);

  // Get previous responses for comparison
  const previousResponses = await getPreviousResponses(input.customerId, organizationId);

  // Detect NPS drop
  const dropResult = await detectNpsDrop({
    responseId: id,
    customerId: input.customerId,
    newScore: score,
    previousResponses,
  });

  // Analyze feedback if provided
  let feedbackAnalysis: FeedbackAnalysis | undefined;
  if (input.feedback && input.feedback.trim().length > 0) {
    feedbackAnalysis = await analyzeFeedback(input.feedback, score);
  }

  // Create the response record
  const npsResponse: NpsResponse = {
    id,
    customerId: input.customerId,
    respondentEmail: input.respondentEmail,
    respondentName: input.respondentName,
    respondentRole: input.respondentRole,
    score,
    category,
    feedback: input.feedback,
    feedbackAnalysis,
    surveyId: input.surveyId,
    surveyCampaign: input.surveyCampaign,
    submittedAt,
    processedAt: new Date(),
    recoveryInitiated: false,
    createdAt: new Date(),
  };

  // Save to database
  if (supabase) {
    await supabase.from('nps_responses').insert({
      id: npsResponse.id,
      customer_id: npsResponse.customerId,
      respondent_email: npsResponse.respondentEmail,
      respondent_name: npsResponse.respondentName,
      respondent_role: npsResponse.respondentRole,
      score: npsResponse.score,
      category: npsResponse.category,
      feedback: npsResponse.feedback,
      feedback_analysis: npsResponse.feedbackAnalysis,
      survey_id: npsResponse.surveyId,
      survey_campaign: npsResponse.surveyCampaign,
      submitted_at: npsResponse.submittedAt.toISOString(),
      processed_at: npsResponse.processedAt?.toISOString(),
      recovery_initiated: npsResponse.recoveryInitiated,
      created_at: npsResponse.createdAt.toISOString(),
      ...(organizationId ? { organization_id: organizationId } : {}),
    });
  }

  return { response: npsResponse, dropResult };
}

/**
 * Get previous NPS responses for a customer
 */
async function getPreviousResponses(customerId: string, organizationId: string | null = null): Promise<NpsResponse[]> {
  if (!supabase) return [];

  let query = supabase
    .from('nps_responses')
    .select('*')
    .eq('customer_id', customerId)
    .order('submitted_at', { ascending: false })
    .limit(10);

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query;

  if (error || !data) return [];

  return data.map(mapDbNpsResponse);
}

/**
 * Detect NPS drop and determine severity
 */
export async function detectNpsDrop(input: {
  responseId: string;
  customerId: string;
  newScore: number;
  previousResponses: NpsResponse[];
}): Promise<NpsDropResult | null> {
  const { newScore, previousResponses } = input;

  // Get most recent previous score
  const previousResponse = previousResponses.length > 0 ? previousResponses[0] : null;
  const previousScore = previousResponse?.score ?? null;
  const previousCategory = previousScore !== null ? getNpsCategory(previousScore) : null;

  const newCategory = getNpsCategory(newScore);

  // Check for detractor history
  const detractorResponses = previousResponses.filter(r => r.category === 'detractor');
  const isFirstDetractor = newCategory === 'detractor' && detractorResponses.length === 0;
  const isRecurringDetractor = newCategory === 'detractor' && detractorResponses.length > 0;

  // Calculate point drop
  const pointDrop = previousScore !== null ? previousScore - newScore : null;

  // Determine if this warrants an alert
  const isDetractor = newCategory === 'detractor';
  const categoryDropped = previousCategory !== null && (
    (previousCategory === 'promoter' && newCategory !== 'promoter') ||
    (previousCategory === 'passive' && newCategory === 'detractor')
  );
  const significantPointDrop = pointDrop !== null && pointDrop >= 3;

  // No alert needed
  if (!isDetractor && !categoryDropped && !significantPointDrop) {
    return null;
  }

  // Determine severity
  let severity: 'low' | 'medium' | 'high' | 'critical';
  if (isDetractor && previousCategory === 'promoter') {
    severity = 'critical'; // Promoter -> Detractor is critical
  } else if (isDetractor && previousCategory === 'passive') {
    severity = 'high'; // Passive -> Detractor is high
  } else if (isDetractor && previousCategory === null) {
    severity = 'high'; // First-time detractor is high
  } else if (previousCategory === 'promoter' && newCategory === 'passive') {
    severity = 'medium'; // Promoter -> Passive is medium
  } else if (significantPointDrop && newCategory !== 'detractor') {
    severity = 'medium'; // Significant drop but not detractor
  } else {
    severity = 'low';
  }

  return {
    shouldAlert: true,
    severity,
    previousScore,
    newScore,
    previousCategory,
    newCategory,
    pointDrop,
    isFirstDetractor,
    isRecurringDetractor,
  };
}

/**
 * Analyze feedback using Claude
 */
export async function analyzeFeedback(
  feedback: string,
  score: number
): Promise<FeedbackAnalysis> {
  const defaultAnalysis: FeedbackAnalysis = {
    sentiment: score >= 7 ? 'positive' : score >= 5 ? 'neutral' : 'negative',
    sentimentScore: (score - 5) / 5, // Map 0-10 to -1 to 1
    themes: [],
    category: 'other',
    mentionsCompetitor: false,
    actionableItems: [],
    urgencyLevel: score <= 4 ? 'critical' : score <= 6 ? 'high' : 'medium',
  };

  if (!config.anthropicApiKey || !feedback.trim()) {
    return defaultAnalysis;
  }

  try {
    const anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `You are an expert at analyzing customer feedback for a B2B SaaS company. Analyze NPS survey feedback and extract insights.`,
      messages: [{
        role: 'user',
        content: `Analyze this NPS feedback (score: ${score}/10):

"${feedback}"

Return a JSON object with:
{
  "sentiment": "positive" | "negative" | "mixed" | "neutral",
  "sentimentScore": number between -1 (very negative) and 1 (very positive),
  "themes": ["theme1", "theme2"], // max 5 key themes/issues mentioned
  "category": "product" | "support" | "value" | "relationship" | "other",
  "mentionsCompetitor": boolean,
  "competitorName": "name if mentioned, null otherwise",
  "actionableItems": ["action1", "action2"], // specific things the CSM should do
  "urgencyLevel": "low" | "medium" | "high" | "critical"
}

Return ONLY valid JSON, no markdown.`
      }],
    });

    const textBlock = message.content.find(block => block.type === 'text');
    const responseText = textBlock?.type === 'text' ? textBlock.text : '';

    // Parse the response
    let jsonString = responseText.trim();
    if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }

    const parsed = JSON.parse(jsonString);
    return {
      sentiment: parsed.sentiment || defaultAnalysis.sentiment,
      sentimentScore: typeof parsed.sentimentScore === 'number' ? parsed.sentimentScore : defaultAnalysis.sentimentScore,
      themes: Array.isArray(parsed.themes) ? parsed.themes.slice(0, 5) : [],
      category: parsed.category || 'other',
      mentionsCompetitor: Boolean(parsed.mentionsCompetitor),
      competitorName: parsed.competitorName || undefined,
      actionableItems: Array.isArray(parsed.actionableItems) ? parsed.actionableItems : [],
      urgencyLevel: parsed.urgencyLevel || defaultAnalysis.urgencyLevel,
    };
  } catch (error) {
    console.error('Error analyzing feedback:', error);
    return defaultAnalysis;
  }
}

/**
 * Get NPS history for a customer
 */
export async function getNpsHistory(customerId: string, organizationId: string | null = null): Promise<NpsHistory> {
  if (!supabase) {
    return {
      currentScore: null,
      currentCategory: null,
      averageScore: null,
      responseCount: 0,
      trend: 'stable',
      history: [],
      detractorCount: 0,
    };
  }

  let query = supabase
    .from('nps_responses')
    .select('*')
    .eq('customer_id', customerId)
    .order('submitted_at', { ascending: false });

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return {
      currentScore: null,
      currentCategory: null,
      averageScore: null,
      responseCount: 0,
      trend: 'stable',
      history: [],
      detractorCount: 0,
    };
  }

  const responses = data.map(mapDbNpsResponse);
  const currentResponse = responses[0];
  const scores = responses.map(r => r.score);
  const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10;
  const detractorCount = responses.filter(r => r.category === 'detractor').length;

  // Calculate trend based on last 3 responses
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (responses.length >= 3) {
    const recent = responses.slice(0, 3);
    const avgRecent = recent.reduce((sum, r) => sum + r.score, 0) / recent.length;
    const older = responses.slice(3, 6);
    if (older.length > 0) {
      const avgOlder = older.reduce((sum, r) => sum + r.score, 0) / older.length;
      if (avgRecent - avgOlder > 1) trend = 'improving';
      else if (avgOlder - avgRecent > 1) trend = 'declining';
    }
  }

  // Get last recovery attempt
  const recoveredResponses = responses.filter(r => r.recoveryInitiated);
  const lastRecoveryAttempt = recoveredResponses.length > 0
    ? recoveredResponses[0].createdAt
    : undefined;

  return {
    currentScore: currentResponse.score,
    currentCategory: currentResponse.category,
    averageScore,
    responseCount: responses.length,
    trend,
    history: responses,
    detractorCount,
    lastRecoveryAttempt,
  };
}

/**
 * Initiate recovery workflow for an NPS response
 */
export async function initiateRecovery(
  responseId: string,
  priority?: 'normal' | 'high' | 'critical'
): Promise<{ success: boolean; message: string }> {
  if (!supabase) {
    return { success: false, message: 'Database not available' };
  }

  // Get the response
  const { data: response, error: fetchError } = await supabase
    .from('nps_responses')
    .select('*')
    .eq('id', responseId)
    .single();

  if (fetchError || !response) {
    return { success: false, message: 'NPS response not found' };
  }

  if (response.recovery_initiated) {
    return { success: false, message: 'Recovery already initiated' };
  }

  // Update the response
  await supabase
    .from('nps_responses')
    .update({
      recovery_initiated: true,
      recovery_status: 'pending',
    })
    .eq('id', responseId);

  // Get customer for context
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', response.customer_id)
    .single();

  // Create a risk signal
  await supabase.from('risk_signals').insert({
    id: uuidv4(),
    customer_id: response.customer_id,
    signal_type: 'nps_drop',
    severity: priority || (response.score <= 4 ? 'critical' : 'high'),
    title: `NPS Detractor Response - ${response.respondent_name || response.respondent_email}`,
    description: `Score: ${response.score}/10. ${response.feedback ? `Feedback: "${response.feedback.substring(0, 200)}..."` : 'No feedback provided.'}`,
    metadata: {
      response_id: responseId,
      respondent: {
        email: response.respondent_email,
        name: response.respondent_name,
        role: response.respondent_role,
      },
      score_change: {
        current_score: response.score,
        current_category: response.category,
      },
      feedback: {
        verbatim: response.feedback,
        analysis: response.feedback_analysis,
      },
      account_context: customer ? {
        arr: customer.arr,
        health_score: customer.health_score,
      } : undefined,
    },
    status: 'open',
    created_at: new Date().toISOString(),
  });

  // Update health score with NPS impact
  if (response.score <= 6) {
    const healthAdjustment = response.score <= 4 ? -20 : -10;
    await recalculateHealthScore(response.customer_id, `NPS detractor response (score: ${response.score})`);
  }

  // Create urgent task
  await supabase.from('plan_tasks').insert({
    id: uuidv4(),
    customer_id: response.customer_id,
    title: `URGENT: NPS Detractor Follow-up - ${response.respondent_name || response.respondent_email}`,
    description: `Score: ${response.score}/10\nFeedback: ${response.feedback || 'No feedback provided'}\n\nAction needed within 24 hours.`,
    status: 'pending',
    priority: priority || 'critical',
    due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    created_at: new Date().toISOString(),
  });

  return { success: true, message: 'Recovery workflow initiated' };
}

/**
 * Update recovery status
 */
export async function updateRecoveryStatus(
  responseId: string,
  status: RecoveryStatus,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  if (!supabase) {
    return { success: false, message: 'Database not available' };
  }

  const { error } = await supabase
    .from('nps_responses')
    .update({
      recovery_status: status,
      recovery_notes: notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', responseId);

  if (error) {
    return { success: false, message: 'Failed to update recovery status' };
  }

  return { success: true, message: `Recovery status updated to ${status}` };
}

/**
 * Send NPS drop Slack notification
 */
export async function sendNpsDropNotification(
  webhookUrl: string,
  response: NpsResponse,
  dropResult: NpsDropResult,
  customer: { id: string; name: string; arr?: number; healthScore?: number }
): Promise<boolean> {
  const categoryEmoji = {
    promoter: ':star:',
    passive: ':neutral_face:',
    detractor: ':rotating_light:',
  };

  const severityEmoji = {
    low: ':information_source:',
    medium: ':warning:',
    high: ':exclamation:',
    critical: ':rotating_light:',
  };

  const title = `NPS ${dropResult.severity.toUpperCase()} Alert: ${customer.name}`;

  let message = `*Score:* ${response.score}/10`;
  if (dropResult.previousScore !== null) {
    message += ` (was ${dropResult.previousScore} - ${dropResult.previousCategory} -> ${dropResult.newCategory})`;
  }
  message += `\n\n*Respondent:* ${response.respondentName || 'Unknown'} (${response.respondentEmail})`;
  if (response.respondentRole) {
    message += ` - ${response.respondentRole}`;
  }
  message += `\n*Submitted:* ${response.submittedAt.toLocaleString()}`;

  if (response.feedback) {
    message += `\n\n*Feedback:*\n"${response.feedback}"`;
  }

  if (response.feedbackAnalysis) {
    message += `\n\n*AI Analysis:*`;
    message += `\n- Sentiment: ${response.feedbackAnalysis.sentiment} (${response.feedbackAnalysis.sentimentScore.toFixed(2)})`;
    if (response.feedbackAnalysis.themes.length > 0) {
      message += `\n- Key Issues: ${response.feedbackAnalysis.themes.join(', ')}`;
    }
    if (response.feedbackAnalysis.mentionsCompetitor) {
      message += `\n- :warning: Competitor mentioned${response.feedbackAnalysis.competitorName ? `: ${response.feedbackAnalysis.competitorName}` : ''}`;
    }
    if (response.feedbackAnalysis.actionableItems.length > 0) {
      message += `\n\n*Recommended Actions:*`;
      response.feedbackAnalysis.actionableItems.forEach((item, i) => {
        message += `\n${i + 1}. ${item}`;
      });
    }
  }

  return sendSlackAlert(webhookUrl, {
    type: 'risk_signal',
    title,
    message,
    customer: {
      id: customer.id,
      name: customer.name,
      arr: customer.arr,
      healthScore: customer.healthScore,
    },
    priority: dropResult.severity === 'critical' ? 'urgent' : dropResult.severity === 'high' ? 'high' : 'medium',
    actionUrl: `/customers/${customer.id}?tab=nps`,
    fields: {
      'NPS Score': response.score,
      'Category': response.category,
      'Point Drop': dropResult.pointDrop,
    },
  });
}

/**
 * Map database record to NpsResponse
 */
function mapDbNpsResponse(row: Record<string, unknown>): NpsResponse {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    respondentEmail: row.respondent_email as string,
    respondentName: row.respondent_name as string | undefined,
    respondentRole: row.respondent_role as string | undefined,
    score: row.score as number,
    category: row.category as NPSCategory,
    feedback: row.feedback as string | undefined,
    feedbackAnalysis: row.feedback_analysis as FeedbackAnalysis | undefined,
    surveyId: row.survey_id as string | undefined,
    surveyCampaign: row.survey_campaign as string | undefined,
    submittedAt: new Date(row.submitted_at as string),
    processedAt: row.processed_at ? new Date(row.processed_at as string) : undefined,
    recoveryInitiated: row.recovery_initiated as boolean,
    recoveryStatus: row.recovery_status as RecoveryStatus | undefined,
    createdAt: new Date(row.created_at as string),
  };
}

export default {
  createNpsResponse,
  detectNpsDrop,
  analyzeFeedback,
  getNpsHistory,
  initiateRecovery,
  updateRecoveryStatus,
  sendNpsDropNotification,
  getNpsCategory,
  calculateNpsScore,
};
