/**
 * Survey Service
 * PRD-142: Survey Completed -> Analysis + Action
 *
 * Unified survey response processing with AI analysis, segmented handling,
 * CSM notifications, and follow-up generation.
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

export type SurveyType = 'nps' | 'csat' | 'onboarding' | 'qbr' | 'custom';
export type SurveyCategory = 'promoter' | 'passive' | 'detractor' | 'n/a';
export type Sentiment = 'positive' | 'neutral' | 'negative';
export type Urgency = 'high' | 'medium' | 'low';
export type FollowUpType = 'thank_you' | 'reference_request' | 'engagement_opportunity' | 'concern_acknowledgment' | 'issue_resolution' | 'check_in';
export type LoopClosureStatus = 'pending' | 'acknowledged' | 'follow_up_sent' | 'issue_addressed' | 're_surveyed' | 'closed';

export interface SurveyResponse {
  id: string;
  customerId: string;
  stakeholderId: string | null;
  survey: {
    id: string;
    type: SurveyType;
    name: string;
    campaign?: string;
  };
  respondent: {
    email: string;
    name?: string;
    role?: string;
  };
  response: {
    score: number | null;
    maxScore: number;
    verbatim: string | null;
    answers: Record<string, unknown>;
    submittedAt: Date;
  };
  analysis: SurveyAnalysis | null;
  category: SurveyCategory;
  followUp: FollowUpState;
  csmNotified: boolean;
  notifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SurveyAnalysis {
  sentiment: Sentiment;
  sentimentScore: number;
  urgency: Urgency;
  themes: string[];
  keyPoints: string[];
  scoreChange: number | null;
  previousScore: number | null;
  previousCategory: SurveyCategory | null;
  mentionsCompetitor: boolean;
  competitorName?: string;
  actionableItems: string[];
  suggestedFollowUp: FollowUpType;
}

export interface FollowUpState {
  required: boolean;
  type: FollowUpType | null;
  draftId: string | null;
  draftContent?: { subject: string; body: string };
  sent: boolean;
  sentAt: Date | null;
  closedLoop: boolean;
  closedAt: Date | null;
  status: LoopClosureStatus;
  notes?: string;
}

export interface CreateSurveyResponseInput {
  customerId: string;
  stakeholderId?: string;
  surveyId: string;
  surveyType: SurveyType;
  surveyName: string;
  surveyCampaign?: string;
  respondentEmail: string;
  respondentName?: string;
  respondentRole?: string;
  score: number | null;
  maxScore?: number;
  verbatim?: string;
  answers?: Record<string, unknown>;
  submittedAt?: string | Date;
}

export interface SurveyDropResult {
  shouldAlert: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  previousScore: number | null;
  newScore: number | null;
  previousCategory: SurveyCategory | null;
  newCategory: SurveyCategory;
  pointDrop: number | null;
  isFirstDetractor: boolean;
  isRecurringDetractor: boolean;
  isUrgent: boolean;
}

// ============================================
// Score Categorization
// ============================================

/**
 * Get category based on survey type and score
 */
export function getSurveyCategory(
  score: number | null,
  maxScore: number,
  surveyType: SurveyType
): SurveyCategory {
  if (score === null) return 'n/a';

  // Normalize score to 0-10 scale for comparison
  const normalizedScore = (score / maxScore) * 10;

  // NPS uses standard 0-10 with 9-10 promoter, 7-8 passive, 0-6 detractor
  if (surveyType === 'nps') {
    if (score >= 9) return 'promoter';
    if (score >= 7) return 'passive';
    return 'detractor';
  }

  // CSAT (typically 1-5 or 1-7) normalized
  if (surveyType === 'csat') {
    if (normalizedScore >= 8) return 'promoter';
    if (normalizedScore >= 6) return 'passive';
    return 'detractor';
  }

  // QBR and onboarding surveys (custom scoring)
  if (normalizedScore >= 7.5) return 'promoter';
  if (normalizedScore >= 5) return 'passive';
  return 'detractor';
}

// ============================================
// Create Survey Response
// ============================================

/**
 * Create and process a new survey response
 */
export async function createSurveyResponse(
  input: CreateSurveyResponseInput
): Promise<{ response: SurveyResponse; dropResult: SurveyDropResult | null }> {
  const id = uuidv4();
  const maxScore = input.maxScore || (input.surveyType === 'nps' ? 10 : input.surveyType === 'csat' ? 5 : 10);
  const category = getSurveyCategory(input.score, maxScore, input.surveyType);
  const submittedAt = input.submittedAt ? new Date(input.submittedAt) : new Date();

  // Get previous responses for comparison
  const previousResponses = await getPreviousResponses(input.customerId, input.surveyType);

  // Detect score drop
  const dropResult = await detectSurveyDrop({
    customerId: input.customerId,
    newScore: input.score,
    maxScore,
    surveyType: input.surveyType,
    previousResponses,
  });

  // Analyze verbatim feedback
  let analysis: SurveyAnalysis | null = null;
  if (input.verbatim?.trim() || dropResult?.shouldAlert) {
    analysis = await analyzeSurveyResponse({
      score: input.score,
      maxScore,
      verbatim: input.verbatim || '',
      surveyType: input.surveyType,
      category,
      previousScore: dropResult?.previousScore ?? null,
      previousCategory: dropResult?.previousCategory ?? null,
    });
  }

  // Determine follow-up requirements
  const followUp = determineFollowUp(category, analysis, dropResult);

  // Create response object
  const surveyResponse: SurveyResponse = {
    id,
    customerId: input.customerId,
    stakeholderId: input.stakeholderId || null,
    survey: {
      id: input.surveyId,
      type: input.surveyType,
      name: input.surveyName,
      campaign: input.surveyCampaign,
    },
    respondent: {
      email: input.respondentEmail,
      name: input.respondentName,
      role: input.respondentRole,
    },
    response: {
      score: input.score,
      maxScore,
      verbatim: input.verbatim || null,
      answers: input.answers || {},
      submittedAt,
    },
    analysis,
    category,
    followUp,
    csmNotified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Save to database
  if (supabase) {
    await supabase.from('survey_responses').insert({
      id: surveyResponse.id,
      customer_id: surveyResponse.customerId,
      stakeholder_id: surveyResponse.stakeholderId,
      survey_id: surveyResponse.survey.id,
      survey_type: surveyResponse.survey.type,
      survey_name: surveyResponse.survey.name,
      survey_campaign: surveyResponse.survey.campaign,
      respondent_email: surveyResponse.respondent.email,
      respondent_name: surveyResponse.respondent.name,
      respondent_role: surveyResponse.respondent.role,
      score: surveyResponse.response.score,
      max_score: surveyResponse.response.maxScore,
      verbatim: surveyResponse.response.verbatim,
      answers: surveyResponse.response.answers,
      submitted_at: surveyResponse.response.submittedAt.toISOString(),
      analysis: surveyResponse.analysis,
      category: surveyResponse.category,
      follow_up: surveyResponse.followUp,
      csm_notified: surveyResponse.csmNotified,
      created_at: surveyResponse.createdAt.toISOString(),
      updated_at: surveyResponse.updatedAt.toISOString(),
    });
  }

  return { response: surveyResponse, dropResult };
}

// ============================================
// Drop Detection
// ============================================

/**
 * Detect significant score drops
 */
async function detectSurveyDrop(input: {
  customerId: string;
  newScore: number | null;
  maxScore: number;
  surveyType: SurveyType;
  previousResponses: SurveyResponse[];
}): Promise<SurveyDropResult | null> {
  const { newScore, maxScore, surveyType, previousResponses } = input;

  const newCategory = getSurveyCategory(newScore, maxScore, surveyType);
  const previousResponse = previousResponses.length > 0 ? previousResponses[0] : null;
  const previousScore = previousResponse?.response.score ?? null;
  const previousCategory = previousScore !== null
    ? getSurveyCategory(previousScore, previousResponse?.response.maxScore || maxScore, surveyType)
    : null;

  // Check detractor history
  const detractorResponses = previousResponses.filter(r => r.category === 'detractor');
  const isFirstDetractor = newCategory === 'detractor' && detractorResponses.length === 0;
  const isRecurringDetractor = newCategory === 'detractor' && detractorResponses.length > 0;

  // Calculate point drop (normalized to 10-point scale)
  let pointDrop: number | null = null;
  if (previousScore !== null && newScore !== null) {
    const normalizedPrevious = (previousScore / (previousResponse?.response.maxScore || maxScore)) * 10;
    const normalizedNew = (newScore / maxScore) * 10;
    pointDrop = Math.round((normalizedPrevious - normalizedNew) * 10) / 10;
  }

  // Determine if alert is needed
  const isDetractor = newCategory === 'detractor';
  const categoryDropped = previousCategory !== null && (
    (previousCategory === 'promoter' && newCategory !== 'promoter') ||
    (previousCategory === 'passive' && newCategory === 'detractor')
  );
  const significantPointDrop = pointDrop !== null && pointDrop >= 2;

  if (!isDetractor && !categoryDropped && !significantPointDrop) {
    return null;
  }

  // Determine severity
  let severity: 'low' | 'medium' | 'high' | 'critical';
  let isUrgent = false;

  if (isDetractor && previousCategory === 'promoter') {
    severity = 'critical';
    isUrgent = true;
  } else if (isDetractor && previousCategory === 'passive') {
    severity = 'high';
    isUrgent = true;
  } else if (isDetractor && previousCategory === null) {
    severity = 'high';
  } else if (previousCategory === 'promoter' && newCategory === 'passive') {
    severity = 'medium';
  } else if (significantPointDrop && newCategory !== 'detractor') {
    severity = 'medium';
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
    isUrgent,
  };
}

// ============================================
// AI Analysis
// ============================================

/**
 * Analyze survey response with Claude
 */
async function analyzeSurveyResponse(input: {
  score: number | null;
  maxScore: number;
  verbatim: string;
  surveyType: SurveyType;
  category: SurveyCategory;
  previousScore: number | null;
  previousCategory: SurveyCategory | null;
}): Promise<SurveyAnalysis> {
  const scoreChange = input.previousScore !== null && input.score !== null
    ? input.score - input.previousScore
    : null;

  const defaultAnalysis: SurveyAnalysis = {
    sentiment: input.category === 'detractor' ? 'negative' : input.category === 'promoter' ? 'positive' : 'neutral',
    sentimentScore: input.score !== null ? (input.score / input.maxScore) * 2 - 1 : 0,
    urgency: input.category === 'detractor' ? 'high' : 'medium',
    themes: [],
    keyPoints: [],
    scoreChange,
    previousScore: input.previousScore,
    previousCategory: input.previousCategory,
    mentionsCompetitor: false,
    actionableItems: [],
    suggestedFollowUp: getSuggestedFollowUp(input.category),
  };

  if (!config.anthropicApiKey || !input.verbatim?.trim()) {
    return defaultAnalysis;
  }

  try {
    const anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });

    const surveyContext = {
      nps: 'Net Promoter Score (0-10, measure of loyalty)',
      csat: 'Customer Satisfaction (typically 1-5, measure of immediate satisfaction)',
      onboarding: 'Onboarding Survey (feedback on initial experience)',
      qbr: 'Quarterly Business Review feedback',
      custom: 'Custom survey feedback',
    };

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: `You are an expert Customer Success analyst specializing in survey feedback analysis for B2B SaaS companies. Your analysis directly impacts customer retention and satisfaction.`,
      messages: [{
        role: 'user',
        content: `Analyze this ${input.surveyType.toUpperCase()} survey response:

## Survey Context
- Type: ${surveyContext[input.surveyType]}
- Score: ${input.score !== null ? `${input.score}/${input.maxScore}` : 'Not provided'}
- Category: ${input.category}
${input.previousScore !== null ? `- Previous Score: ${input.previousScore}/${input.maxScore} (${input.previousCategory})` : ''}
${scoreChange !== null ? `- Score Change: ${scoreChange > 0 ? '+' : ''}${scoreChange}` : ''}

## Verbatim Feedback
"${input.verbatim}"

## Required Analysis

Return a JSON object with:
{
  "sentiment": "positive" | "neutral" | "negative",
  "sentimentScore": number between -1 (very negative) and 1 (very positive),
  "urgency": "low" | "medium" | "high",
  "themes": ["theme1", "theme2"], // max 5 key themes/issues
  "keyPoints": ["point1", "point2"], // max 5 important takeaways
  "mentionsCompetitor": boolean,
  "competitorName": "name if mentioned, null otherwise",
  "actionableItems": ["action1", "action2"], // specific CSM actions, max 5
  "suggestedFollowUp": "thank_you" | "reference_request" | "engagement_opportunity" | "concern_acknowledgment" | "issue_resolution" | "check_in"
}

Urgency Guide:
- HIGH: Immediate churn risk, competitor mention, explicit dissatisfaction, unresolved issues
- MEDIUM: Constructive feedback, minor concerns, passive responses
- LOW: Positive feedback, satisfied customers, general praise

Return ONLY valid JSON.`,
      }],
    });

    const textBlock = message.content.find(block => block.type === 'text');
    const responseText = textBlock?.type === 'text' ? textBlock.text : '';

    let jsonString = responseText.trim();
    if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }

    const parsed = JSON.parse(jsonString);

    return {
      sentiment: parsed.sentiment || defaultAnalysis.sentiment,
      sentimentScore: typeof parsed.sentimentScore === 'number' ? parsed.sentimentScore : defaultAnalysis.sentimentScore,
      urgency: parsed.urgency || defaultAnalysis.urgency,
      themes: Array.isArray(parsed.themes) ? parsed.themes.slice(0, 5) : [],
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.slice(0, 5) : [],
      scoreChange,
      previousScore: input.previousScore,
      previousCategory: input.previousCategory,
      mentionsCompetitor: Boolean(parsed.mentionsCompetitor),
      competitorName: parsed.competitorName || undefined,
      actionableItems: Array.isArray(parsed.actionableItems) ? parsed.actionableItems.slice(0, 5) : [],
      suggestedFollowUp: parsed.suggestedFollowUp || defaultAnalysis.suggestedFollowUp,
    };
  } catch (error) {
    console.error('Error analyzing survey response:', error);
    return defaultAnalysis;
  }
}

function getSuggestedFollowUp(category: SurveyCategory): FollowUpType {
  switch (category) {
    case 'promoter': return 'thank_you';
    case 'passive': return 'engagement_opportunity';
    case 'detractor': return 'concern_acknowledgment';
    default: return 'check_in';
  }
}

// ============================================
// Follow-Up Determination
// ============================================

function determineFollowUp(
  category: SurveyCategory,
  analysis: SurveyAnalysis | null,
  dropResult: SurveyDropResult | null
): FollowUpState {
  const isDetractor = category === 'detractor';
  const isUrgent = dropResult?.isUrgent || analysis?.urgency === 'high';
  const required = isDetractor || isUrgent || (analysis?.mentionsCompetitor ?? false);

  let type: FollowUpType | null = null;
  if (required) {
    if (isDetractor) {
      type = 'concern_acknowledgment';
    } else if (category === 'promoter') {
      type = analysis?.urgency === 'low' ? 'reference_request' : 'thank_you';
    } else {
      type = 'engagement_opportunity';
    }
  }

  return {
    required,
    type,
    draftId: null,
    sent: false,
    sentAt: null,
    closedLoop: false,
    closedAt: null,
    status: 'pending',
  };
}

// ============================================
// Get Previous Responses
// ============================================

async function getPreviousResponses(
  customerId: string,
  surveyType?: SurveyType
): Promise<SurveyResponse[]> {
  if (!supabase) return [];

  let query = supabase
    .from('survey_responses')
    .select('*')
    .eq('customer_id', customerId)
    .order('submitted_at', { ascending: false })
    .limit(10);

  if (surveyType) {
    query = query.eq('survey_type', surveyType);
  }

  const { data, error } = await query;

  if (error || !data) return [];

  return data.map(mapDbSurveyResponse);
}

// ============================================
// Get Survey Responses
// ============================================

export async function getSurveyResponses(filters: {
  customerId?: string;
  surveyType?: SurveyType;
  category?: SurveyCategory;
  startDate?: Date;
  endDate?: Date;
  followUpRequired?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ responses: SurveyResponse[]; total: number }> {
  if (!supabase) {
    return { responses: [], total: 0 };
  }

  let query = supabase
    .from('survey_responses')
    .select('*, customers(id, name, arr, health_score)', { count: 'exact' })
    .order('submitted_at', { ascending: false });

  if (filters.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }
  if (filters.surveyType) {
    query = query.eq('survey_type', filters.surveyType);
  }
  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  if (filters.startDate) {
    query = query.gte('submitted_at', filters.startDate.toISOString());
  }
  if (filters.endDate) {
    query = query.lte('submitted_at', filters.endDate.toISOString());
  }
  if (filters.followUpRequired !== undefined) {
    query = query.eq('follow_up->required', filters.followUpRequired);
  }

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching survey responses:', error);
    return { responses: [], total: 0 };
  }

  return {
    responses: (data || []).map(mapDbSurveyResponse),
    total: count || 0,
  };
}

// ============================================
// Get Customer Survey History
// ============================================

export async function getCustomerSurveyHistory(customerId: string): Promise<{
  responses: SurveyResponse[];
  byType: Record<SurveyType, {
    count: number;
    averageScore: number | null;
    latestScore: number | null;
    trend: 'improving' | 'stable' | 'declining';
  }>;
  overallTrend: 'improving' | 'stable' | 'declining';
  detractorCount: number;
  loopsClosed: number;
  loopsOpen: number;
}> {
  const responses = await getPreviousResponses(customerId);

  const byType: Record<SurveyType, { count: number; scores: number[]; latestScore: number | null }> = {
    nps: { count: 0, scores: [], latestScore: null },
    csat: { count: 0, scores: [], latestScore: null },
    onboarding: { count: 0, scores: [], latestScore: null },
    qbr: { count: 0, scores: [], latestScore: null },
    custom: { count: 0, scores: [], latestScore: null },
  };

  let detractorCount = 0;
  let loopsClosed = 0;
  let loopsOpen = 0;

  for (const response of responses) {
    const type = response.survey.type;
    byType[type].count++;
    if (response.response.score !== null) {
      const normalizedScore = (response.response.score / response.response.maxScore) * 10;
      byType[type].scores.push(normalizedScore);
      if (byType[type].latestScore === null) {
        byType[type].latestScore = normalizedScore;
      }
    }
    if (response.category === 'detractor') {
      detractorCount++;
    }
    if (response.followUp.closedLoop) {
      loopsClosed++;
    } else if (response.followUp.required) {
      loopsOpen++;
    }
  }

  const calculateTrend = (scores: number[]): 'improving' | 'stable' | 'declining' => {
    if (scores.length < 2) return 'stable';
    const recent = scores.slice(0, Math.ceil(scores.length / 2));
    const older = scores.slice(Math.ceil(scores.length / 2));
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    if (recentAvg - olderAvg > 0.5) return 'improving';
    if (olderAvg - recentAvg > 0.5) return 'declining';
    return 'stable';
  };

  const typeSummary: Record<SurveyType, {
    count: number;
    averageScore: number | null;
    latestScore: number | null;
    trend: 'improving' | 'stable' | 'declining';
  }> = {} as any;

  for (const type of Object.keys(byType) as SurveyType[]) {
    const data = byType[type];
    typeSummary[type] = {
      count: data.count,
      averageScore: data.scores.length > 0
        ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length * 10) / 10
        : null,
      latestScore: data.latestScore !== null ? Math.round(data.latestScore * 10) / 10 : null,
      trend: calculateTrend(data.scores),
    };
  }

  const allScores = Object.values(byType).flatMap(t => t.scores);
  const overallTrend = calculateTrend(allScores);

  return {
    responses,
    byType: typeSummary,
    overallTrend,
    detractorCount,
    loopsClosed,
    loopsOpen,
  };
}

// ============================================
// Update Follow-Up Status
// ============================================

export async function updateFollowUpStatus(
  responseId: string,
  update: {
    status?: LoopClosureStatus;
    sent?: boolean;
    closedLoop?: boolean;
    notes?: string;
    draftId?: string;
    draftContent?: { subject: string; body: string };
  }
): Promise<{ success: boolean; message: string }> {
  if (!supabase) {
    return { success: false, message: 'Database not available' };
  }

  const { data: existing, error: fetchError } = await supabase
    .from('survey_responses')
    .select('follow_up')
    .eq('id', responseId)
    .single();

  if (fetchError || !existing) {
    return { success: false, message: 'Survey response not found' };
  }

  const currentFollowUp = existing.follow_up as FollowUpState;
  const updatedFollowUp: FollowUpState = {
    ...currentFollowUp,
    status: update.status || currentFollowUp.status,
    sent: update.sent ?? currentFollowUp.sent,
    sentAt: update.sent ? new Date() : currentFollowUp.sentAt,
    closedLoop: update.closedLoop ?? currentFollowUp.closedLoop,
    closedAt: update.closedLoop ? new Date() : currentFollowUp.closedAt,
    notes: update.notes || currentFollowUp.notes,
    draftId: update.draftId || currentFollowUp.draftId,
    draftContent: update.draftContent || currentFollowUp.draftContent,
  };

  const { error: updateError } = await supabase
    .from('survey_responses')
    .update({
      follow_up: updatedFollowUp,
      updated_at: new Date().toISOString(),
    })
    .eq('id', responseId);

  if (updateError) {
    return { success: false, message: 'Failed to update follow-up status' };
  }

  return { success: true, message: `Follow-up status updated to ${updatedFollowUp.status}` };
}

// ============================================
// Generate Follow-Up Email
// ============================================

export async function generateFollowUpEmail(
  responseId: string,
  options?: { customizePrompt?: string; tone?: 'formal' | 'friendly' | 'empathetic' }
): Promise<{ subject: string; body: string; talkingPoints: string[]; suggestedActions: string[] } | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('survey_responses')
    .select('*, customers(id, name, arr, health_score)')
    .eq('id', responseId)
    .single();

  if (error || !data) return null;

  const response = mapDbSurveyResponse(data);
  const customer = data.customers as { id: string; name: string; arr?: number; health_score?: number };
  const tone = options?.tone || (response.category === 'detractor' ? 'empathetic' : 'friendly');

  if (!config.anthropicApiKey) {
    return generateFallbackFollowUp(response, customer);
  }

  try {
    const anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });

    const categoryContext = {
      promoter: 'This is a highly satisfied customer. Express gratitude and explore advocacy opportunities.',
      passive: 'This customer is satisfied but not enthusiastic. Focus on deepening engagement.',
      detractor: 'This customer is dissatisfied. Acknowledge concerns, apologize where appropriate, and propose solutions.',
      'n/a': 'No score was provided. Focus on gathering more feedback.',
    };

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: `You are a Customer Success Manager writing a personalized follow-up email after receiving survey feedback. Your emails should be genuine, action-oriented, and appropriate for B2B relationships.`,
      messages: [{
        role: 'user',
        content: `Write a follow-up email for this survey response:

## Customer Context
- Company: ${customer.name}
- ARR: ${customer.arr ? `$${customer.arr.toLocaleString()}` : 'Unknown'}
- Health Score: ${customer.health_score ?? 'Unknown'}/100

## Survey Response
- Type: ${response.survey.type.toUpperCase()} (${response.survey.name})
- Score: ${response.response.score !== null ? `${response.response.score}/${response.response.maxScore}` : 'Not provided'}
- Category: ${response.category}
- Respondent: ${response.respondent.name || 'Unknown'} (${response.respondent.email})${response.respondent.role ? ` - ${response.respondent.role}` : ''}

## Feedback
"${response.response.verbatim || 'No verbatim feedback provided'}"

## Analysis
${response.analysis ? `- Themes: ${response.analysis.themes.join(', ') || 'None identified'}
- Key Points: ${response.analysis.keyPoints.join(', ') || 'None identified'}
- Urgency: ${response.analysis.urgency}
${response.analysis.mentionsCompetitor ? `- COMPETITOR MENTIONED: ${response.analysis.competitorName || 'Unknown'}` : ''}` : 'No analysis available'}

## Requirements
- Tone: ${tone}
- Context: ${categoryContext[response.category]}
${options?.customizePrompt ? `- Special Instructions: ${options.customizePrompt}` : ''}

Return JSON:
{
  "subject": "Compelling subject line",
  "body": "Full email body with proper formatting",
  "talkingPoints": ["Point 1", "Point 2"],
  "suggestedActions": ["Action 1", "Action 2"]
}

Return ONLY valid JSON.`,
      }],
    });

    const textBlock = message.content.find(block => block.type === 'text');
    const responseText = textBlock?.type === 'text' ? textBlock.text : '';

    let jsonString = responseText.trim();
    if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }

    const parsed = JSON.parse(jsonString);

    // Update the response with the draft
    await updateFollowUpStatus(responseId, {
      draftContent: {
        subject: parsed.subject,
        body: parsed.body,
      },
    });

    return {
      subject: parsed.subject,
      body: parsed.body,
      talkingPoints: parsed.talkingPoints || [],
      suggestedActions: parsed.suggestedActions || [],
    };
  } catch (error) {
    console.error('Error generating follow-up email:', error);
    return generateFallbackFollowUp(response, customer);
  }
}

function generateFallbackFollowUp(
  response: SurveyResponse,
  customer: { name: string }
): { subject: string; body: string; talkingPoints: string[]; suggestedActions: string[] } {
  const templates: Record<SurveyCategory, { subject: string; body: string }> = {
    promoter: {
      subject: `Thank you for your feedback, ${response.respondent.name || 'there'}!`,
      body: `Hi ${response.respondent.name || 'there'},

Thank you so much for taking the time to share your feedback about ${customer.name}'s experience with us. Your positive response means a lot to our team!

We're thrilled to hear you're satisfied with our partnership. Your success is our success.

Would you be open to sharing your experience in a brief case study or testimonial? It would help other companies like yours discover the value we can provide.

Best regards,
Your Customer Success Team`,
    },
    passive: {
      subject: `Your feedback matters - let's connect`,
      body: `Hi ${response.respondent.name || 'there'},

Thank you for sharing your feedback with us. We appreciate your honest input.

I noticed there might be opportunities for us to better support ${customer.name}. I'd love to schedule a brief call to understand your needs better and explore how we can deliver more value.

Would you have 15 minutes this week to connect?

Best regards,
Your Customer Success Team`,
    },
    detractor: {
      subject: `We hear you - let's make this right`,
      body: `Hi ${response.respondent.name || 'there'},

Thank you for sharing your candid feedback. I'm sorry to hear your experience hasn't met your expectations.

Your concerns are important to us, and I want to personally ensure we address them. I'd like to schedule a call at your earliest convenience to understand the issues you're facing and work together on solutions.

Please let me know when would be a good time to connect.

Best regards,
Your Customer Success Team`,
    },
    'n/a': {
      subject: `Thank you for your feedback`,
      body: `Hi ${response.respondent.name || 'there'},

Thank you for taking the time to share your thoughts with us.

I'd love to learn more about your experience and how we can better support ${customer.name}. Would you have time for a quick call this week?

Best regards,
Your Customer Success Team`,
    },
  };

  const template = templates[response.category];

  return {
    subject: template.subject,
    body: template.body,
    talkingPoints: [
      'Review recent activity and usage',
      'Discuss any outstanding concerns',
      'Align on success metrics',
    ],
    suggestedActions: [
      'Schedule follow-up call',
      'Update customer record',
      'Create action plan if needed',
    ],
  };
}

// ============================================
// Survey Analytics
// ============================================

export async function getSurveyAnalytics(filters: {
  customerId?: string;
  surveyType?: SurveyType;
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  totalResponses: number;
  byType: Record<SurveyType, {
    count: number;
    averageScore: number | null;
    categoryBreakdown: { promoter: number; passive: number; detractor: number };
  }>;
  overallNps: number | null;
  topThemes: Array<{ theme: string; count: number; sentiment: Sentiment }>;
  followUpMetrics: { required: number; sent: number; closed: number; closeRate: number };
  trend: 'improving' | 'stable' | 'declining';
}> {
  if (!supabase) {
    return {
      totalResponses: 0,
      byType: {
        nps: { count: 0, averageScore: null, categoryBreakdown: { promoter: 0, passive: 0, detractor: 0 } },
        csat: { count: 0, averageScore: null, categoryBreakdown: { promoter: 0, passive: 0, detractor: 0 } },
        onboarding: { count: 0, averageScore: null, categoryBreakdown: { promoter: 0, passive: 0, detractor: 0 } },
        qbr: { count: 0, averageScore: null, categoryBreakdown: { promoter: 0, passive: 0, detractor: 0 } },
        custom: { count: 0, averageScore: null, categoryBreakdown: { promoter: 0, passive: 0, detractor: 0 } },
      },
      overallNps: null,
      topThemes: [],
      followUpMetrics: { required: 0, sent: 0, closed: 0, closeRate: 0 },
      trend: 'stable',
    };
  }

  const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = filters.endDate || new Date();

  let query = supabase
    .from('survey_responses')
    .select('*')
    .gte('submitted_at', startDate.toISOString())
    .lte('submitted_at', endDate.toISOString());

  if (filters.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }
  if (filters.surveyType) {
    query = query.eq('survey_type', filters.surveyType);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error('Error fetching survey analytics:', error);
    return {
      totalResponses: 0,
      byType: {
        nps: { count: 0, averageScore: null, categoryBreakdown: { promoter: 0, passive: 0, detractor: 0 } },
        csat: { count: 0, averageScore: null, categoryBreakdown: { promoter: 0, passive: 0, detractor: 0 } },
        onboarding: { count: 0, averageScore: null, categoryBreakdown: { promoter: 0, passive: 0, detractor: 0 } },
        qbr: { count: 0, averageScore: null, categoryBreakdown: { promoter: 0, passive: 0, detractor: 0 } },
        custom: { count: 0, averageScore: null, categoryBreakdown: { promoter: 0, passive: 0, detractor: 0 } },
      },
      overallNps: null,
      topThemes: [],
      followUpMetrics: { required: 0, sent: 0, closed: 0, closeRate: 0 },
      trend: 'stable',
    };
  }

  const responses = data.map(mapDbSurveyResponse);

  // Aggregate by type
  const byType: Record<SurveyType, { scores: number[]; categories: SurveyCategory[] }> = {
    nps: { scores: [], categories: [] },
    csat: { scores: [], categories: [] },
    onboarding: { scores: [], categories: [] },
    qbr: { scores: [], categories: [] },
    custom: { scores: [], categories: [] },
  };

  const themeCounts: Record<string, { count: number; sentiments: Sentiment[] }> = {};
  let followUpRequired = 0;
  let followUpSent = 0;
  let followUpClosed = 0;

  for (const response of responses) {
    const type = response.survey.type;
    if (response.response.score !== null) {
      const normalized = (response.response.score / response.response.maxScore) * 10;
      byType[type].scores.push(normalized);
    }
    byType[type].categories.push(response.category);

    // Count themes
    if (response.analysis?.themes) {
      for (const theme of response.analysis.themes) {
        if (!themeCounts[theme]) {
          themeCounts[theme] = { count: 0, sentiments: [] };
        }
        themeCounts[theme].count++;
        themeCounts[theme].sentiments.push(response.analysis.sentiment);
      }
    }

    // Follow-up metrics
    if (response.followUp.required) followUpRequired++;
    if (response.followUp.sent) followUpSent++;
    if (response.followUp.closedLoop) followUpClosed++;
  }

  // Calculate metrics by type
  const byTypeSummary: Record<SurveyType, {
    count: number;
    averageScore: number | null;
    categoryBreakdown: { promoter: number; passive: number; detractor: number };
  }> = {} as any;

  for (const type of Object.keys(byType) as SurveyType[]) {
    const data = byType[type];
    byTypeSummary[type] = {
      count: data.categories.length,
      averageScore: data.scores.length > 0
        ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length * 10) / 10
        : null,
      categoryBreakdown: {
        promoter: data.categories.filter(c => c === 'promoter').length,
        passive: data.categories.filter(c => c === 'passive').length,
        detractor: data.categories.filter(c => c === 'detractor').length,
      },
    };
  }

  // Calculate overall NPS
  const npsData = byType.nps;
  let overallNps: number | null = null;
  if (npsData.categories.length > 0) {
    const promoterPct = npsData.categories.filter(c => c === 'promoter').length / npsData.categories.length * 100;
    const detractorPct = npsData.categories.filter(c => c === 'detractor').length / npsData.categories.length * 100;
    overallNps = Math.round(promoterPct - detractorPct);
  }

  // Top themes
  const topThemes = Object.entries(themeCounts)
    .map(([theme, data]) => {
      const sentimentCounts = data.sentiments.reduce((acc, s) => {
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {} as Record<Sentiment, number>);
      const dominantSentiment = Object.entries(sentimentCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] as Sentiment || 'neutral';
      return { theme, count: data.count, sentiment: dominantSentiment };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Calculate trend
  const allScores = Object.values(byType).flatMap(t => t.scores);
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (allScores.length >= 4) {
    const recent = allScores.slice(0, Math.floor(allScores.length / 2));
    const older = allScores.slice(Math.floor(allScores.length / 2));
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    if (recentAvg - olderAvg > 0.5) trend = 'improving';
    else if (olderAvg - recentAvg > 0.5) trend = 'declining';
  }

  return {
    totalResponses: responses.length,
    byType: byTypeSummary,
    overallNps,
    topThemes,
    followUpMetrics: {
      required: followUpRequired,
      sent: followUpSent,
      closed: followUpClosed,
      closeRate: followUpRequired > 0 ? Math.round(followUpClosed / followUpRequired * 100) : 0,
    },
    trend,
  };
}

// ============================================
// Notify CSM
// ============================================

export async function notifyCsmOfSurveyResponse(
  response: SurveyResponse,
  dropResult: SurveyDropResult | null,
  customer: { id: string; name: string; arr?: number; healthScore?: number }
): Promise<{ success: boolean; channels: string[] }> {
  const channels: string[] = [];

  // Update response as notified
  if (supabase) {
    await supabase
      .from('survey_responses')
      .update({
        csm_notified: true,
        notified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', response.id);
  }

  // Send Slack notification
  const slackWebhook = process.env.SLACK_SURVEY_WEBHOOK_URL || process.env.SLACK_ALERTS_WEBHOOK_URL;
  if (slackWebhook) {
    const categoryEmoji = {
      promoter: ':star:',
      passive: ':neutral_face:',
      detractor: ':rotating_light:',
      'n/a': ':question:',
    };

    const severityEmoji = {
      low: ':information_source:',
      medium: ':warning:',
      high: ':exclamation:',
      critical: ':rotating_light:',
    };

    const title = dropResult?.severity
      ? `${severityEmoji[dropResult.severity]} Survey ${dropResult.severity.toUpperCase()} Alert: ${customer.name}`
      : `${categoryEmoji[response.category]} New Survey Response: ${customer.name}`;

    let message = `*Survey:* ${response.survey.name} (${response.survey.type.toUpperCase()})`;
    message += `\n*Score:* ${response.response.score !== null ? `${response.response.score}/${response.response.maxScore}` : 'N/A'}`;
    message += ` ${categoryEmoji[response.category]} ${response.category.charAt(0).toUpperCase() + response.category.slice(1)}`;

    if (dropResult?.previousScore !== null) {
      message += ` (was ${dropResult.previousScore})`;
    }

    message += `\n*Respondent:* ${response.respondent.name || 'Unknown'} (${response.respondent.email})`;
    if (response.respondent.role) {
      message += ` - ${response.respondent.role}`;
    }

    if (response.response.verbatim) {
      message += `\n\n*Feedback:*\n"${response.response.verbatim.substring(0, 300)}${response.response.verbatim.length > 300 ? '...' : ''}"`;
    }

    if (response.analysis) {
      message += `\n\n*Analysis:*`;
      message += `\n- Sentiment: ${response.analysis.sentiment}`;
      message += `\n- Urgency: ${response.analysis.urgency}`;
      if (response.analysis.themes.length > 0) {
        message += `\n- Themes: ${response.analysis.themes.join(', ')}`;
      }
      if (response.analysis.mentionsCompetitor) {
        message += `\n- :warning: COMPETITOR MENTIONED${response.analysis.competitorName ? `: ${response.analysis.competitorName}` : ''}`;
      }
      if (response.analysis.actionableItems.length > 0) {
        message += `\n\n*Recommended Actions:*`;
        response.analysis.actionableItems.forEach((item, i) => {
          message += `\n${i + 1}. ${item}`;
        });
      }
    }

    const sent = await sendSlackAlert(slackWebhook, {
      type: response.category === 'detractor' ? 'risk_signal' : 'survey_response',
      title,
      message,
      customer: {
        id: customer.id,
        name: customer.name,
        arr: customer.arr,
        healthScore: customer.healthScore,
      },
      priority: dropResult?.severity === 'critical' ? 'urgent' : dropResult?.severity === 'high' ? 'high' : 'medium',
      actionUrl: `/customers/${customer.id}?tab=surveys`,
      fields: {
        'Survey Type': response.survey.type.toUpperCase(),
        'Score': response.response.score !== null ? `${response.response.score}/${response.response.maxScore}` : 'N/A',
        'Category': response.category,
      },
    });

    if (sent) channels.push('slack');
  }

  // Create in-app notification
  if (supabase) {
    await supabase.from('notifications').insert({
      id: uuidv4(),
      type: response.category === 'detractor' ? 'detractor_alert' : 'survey_response',
      customer_id: customer.id,
      title: `${response.survey.type.toUpperCase()} Response: ${customer.name}`,
      message: response.response.verbatim
        ? `Score: ${response.response.score}/${response.response.maxScore} - "${response.response.verbatim.substring(0, 100)}..."`
        : `Score: ${response.response.score}/${response.response.maxScore} from ${response.respondent.email}`,
      priority: dropResult?.severity || 'medium',
      metadata: {
        surveyResponseId: response.id,
        surveyType: response.survey.type,
        category: response.category,
        score: response.response.score,
      },
      read: false,
      created_at: new Date().toISOString(),
    });
    channels.push('in_app');
  }

  return { success: channels.length > 0, channels };
}

// ============================================
// Database Mapping
// ============================================

function mapDbSurveyResponse(row: Record<string, unknown>): SurveyResponse {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    stakeholderId: row.stakeholder_id as string | null,
    survey: {
      id: row.survey_id as string,
      type: row.survey_type as SurveyType,
      name: row.survey_name as string,
      campaign: row.survey_campaign as string | undefined,
    },
    respondent: {
      email: row.respondent_email as string,
      name: row.respondent_name as string | undefined,
      role: row.respondent_role as string | undefined,
    },
    response: {
      score: row.score as number | null,
      maxScore: row.max_score as number,
      verbatim: row.verbatim as string | null,
      answers: (row.answers as Record<string, unknown>) || {},
      submittedAt: new Date(row.submitted_at as string),
    },
    analysis: row.analysis as SurveyAnalysis | null,
    category: row.category as SurveyCategory,
    followUp: (row.follow_up as FollowUpState) || {
      required: false,
      type: null,
      draftId: null,
      sent: false,
      sentAt: null,
      closedLoop: false,
      closedAt: null,
      status: 'pending',
    },
    csmNotified: row.csm_notified as boolean,
    notifiedAt: row.notified_at ? new Date(row.notified_at as string) : undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ============================================
// Exports
// ============================================

export default {
  createSurveyResponse,
  getSurveyResponses,
  getCustomerSurveyHistory,
  updateFollowUpStatus,
  generateFollowUpEmail,
  getSurveyAnalytics,
  notifyCsmOfSurveyResponse,
  getSurveyCategory,
};
