/**
 * Real-Time Sentiment Analysis Service (PRD-218)
 *
 * AI-powered sentiment analysis for customer communications:
 * - Email threads
 * - Meeting transcripts
 * - Support tickets
 * - Slack messages
 * - NPS/survey responses
 *
 * Uses Claude API for nuanced sentiment understanding.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import crypto from 'crypto';

// Initialize Anthropic client
let anthropic: Anthropic | null = null;
if (config.anthropicApiKey) {
  anthropic = new Anthropic({
    apiKey: config.anthropicApiKey,
  });
}

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================================================
// Types
// ============================================================================

export type CommunicationSource = 'email' | 'meeting' | 'support' | 'slack' | 'survey';
export type AlertLevel = 'info' | 'warning' | 'critical';
export type SentimentTrend = 'improving' | 'stable' | 'declining';

export interface CommunicationText {
  source: CommunicationSource;
  customer_id: string;
  stakeholder_id?: string;
  content: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

export interface KeyPhrase {
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact: number;
}

export interface TopicSentiment {
  product: number | null;
  support: number | null;
  pricing: number | null;
  relationship: number | null;
}

export interface SentimentResult {
  sentiment_id: string;
  overall_score: number;          // -100 to +100
  confidence: number;             // 0 to 1
  emotional_indicators: string[]; // e.g., ["frustrated", "concerned", "appreciative"]
  topic_sentiment: TopicSentiment;
  key_phrases: KeyPhrase[];
  risk_indicators: string[];
  alert_triggered: boolean;
  alert_level?: AlertLevel;
}

export interface CustomerSentimentSummary {
  customer_id: string;
  current_score: number;
  trend: SentimentTrend;
  change_7d: number;
  change_30d: number;
  topic_breakdown: TopicSentiment;
  recent_interactions: Array<{
    source: CommunicationSource;
    score: number;
    date: string;
    snippet: string;
  }>;
  historical_data: Array<{
    date: string;
    score: number;
  }>;
}

export interface SentimentAlert {
  id: string;
  customer_id: string;
  sentiment_analysis_id: string;
  alert_type: string;
  alert_level: AlertLevel;
  message: string;
  acknowledged_at?: string;
  created_at: string;
}

export interface AnalyzeSentimentParams {
  source: CommunicationSource;
  customer_id: string;
  stakeholder_id?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Constants
// ============================================================================

// Alert trigger thresholds
const ALERT_THRESHOLDS = {
  SINGLE_INTERACTION_NEGATIVE: -30,
  ROLLING_7D_DROP: 20,
  NEGATIVE_SPIKE_COUNT: 3,
  NEGATIVE_SPIKE_HOURS: 24,
};

// Risk keywords to detect
const RISK_KEYWORDS = [
  'cancel',
  'frustrated',
  'disappointed',
  'competitor',
  'alternative',
  'unacceptable',
  'escalate',
  'terminate',
  'lawsuit',
  'legal',
  'breach',
  'refund',
  'unhappy',
  'worst',
  'terrible',
  'horrible',
];

// ============================================================================
// Core Analysis Functions
// ============================================================================

/**
 * Analyze sentiment of a communication using Claude
 */
export async function analyzeSentiment(
  params: AnalyzeSentimentParams
): Promise<SentimentResult> {
  const { source, customer_id, stakeholder_id, content, metadata } = params;

  // Generate content hash for deduplication
  const contentHash = crypto.createHash('sha256').update(content).digest('hex');

  // Check if we've already analyzed this exact content
  if (supabase) {
    const { data: existing } = await supabase
      .from('sentiment_analyses')
      .select('*')
      .eq('content_hash', contentHash)
      .eq('customer_id', customer_id)
      .single();

    if (existing) {
      return {
        sentiment_id: existing.id,
        overall_score: existing.overall_score,
        confidence: existing.confidence,
        emotional_indicators: existing.emotional_indicators || [],
        topic_sentiment: existing.topic_sentiment || { product: null, support: null, pricing: null, relationship: null },
        key_phrases: existing.key_phrases || [],
        risk_indicators: existing.risk_indicators || [],
        alert_triggered: false,
        alert_level: undefined,
      };
    }
  }

  // Get customer context for better analysis
  const customerContext = await getCustomerContext(customer_id);
  const previousTrend = await getRecentSentimentTrend(customer_id);

  // Analyze with Claude
  const analysis = await performClaudeAnalysis(content, source, customerContext, previousTrend);

  // Generate unique ID
  const sentimentId = crypto.randomUUID();

  // Detect risk keywords in content
  const detectedRiskKeywords = detectRiskKeywords(content);
  const riskIndicators = [...new Set([...analysis.risk_indicators, ...detectedRiskKeywords])];

  // Determine if alert should be triggered
  const { alertTriggered, alertLevel, alertMessage } = evaluateAlertConditions(
    analysis.overall_score,
    customer_id,
    riskIndicators
  );

  // Store the analysis
  if (supabase) {
    await supabase.from('sentiment_analyses').insert({
      id: sentimentId,
      customer_id,
      stakeholder_id: stakeholder_id || null,
      source,
      source_id: (metadata?.source_id as string) || null,
      content_hash: contentHash,
      overall_score: analysis.overall_score,
      confidence: analysis.confidence,
      topic_sentiment: analysis.topic_sentiment,
      emotional_indicators: analysis.emotional_indicators,
      key_phrases: analysis.key_phrases,
      risk_indicators: riskIndicators,
      analyzed_at: new Date().toISOString(),
    });

    // Create alert if triggered
    if (alertTriggered && alertLevel) {
      await createSentimentAlert(
        customer_id,
        sentimentId,
        alertLevel,
        alertMessage || 'Negative sentiment detected'
      );
    }
  }

  return {
    sentiment_id: sentimentId,
    overall_score: analysis.overall_score,
    confidence: analysis.confidence,
    emotional_indicators: analysis.emotional_indicators,
    topic_sentiment: analysis.topic_sentiment,
    key_phrases: analysis.key_phrases,
    risk_indicators: riskIndicators,
    alert_triggered: alertTriggered,
    alert_level: alertLevel,
  };
}

/**
 * Perform sentiment analysis using Claude API
 */
async function performClaudeAnalysis(
  content: string,
  source: CommunicationSource,
  customerContext: Record<string, unknown> | null,
  previousTrend: string
): Promise<{
  overall_score: number;
  confidence: number;
  emotional_indicators: string[];
  topic_sentiment: TopicSentiment;
  key_phrases: KeyPhrase[];
  risk_indicators: string[];
}> {
  if (!anthropic) {
    // Return mock analysis if Claude is not configured
    console.warn('[Sentiment] Claude API not configured, returning mock analysis');
    return generateMockAnalysis(content);
  }

  const prompt = `Analyze the sentiment of this customer communication.

Communication Context:
- Source: ${source}
- Customer: ${customerContext?.name || 'Unknown'}
- Previous sentiment trend: ${previousTrend}

Text to analyze:
${content}

Provide a detailed sentiment analysis. Return a JSON object with:
1. overall_score: Integer from -100 (very negative) to +100 (very positive)
2. confidence: Decimal from 0 to 1 indicating analysis confidence
3. emotional_indicators: Array of detected emotions (e.g., ["frustrated", "concerned", "appreciative"])
4. topic_sentiment: Object with sentiment scores for each topic (null if not mentioned):
   - product: sentiment about product/features (-100 to +100 or null)
   - support: sentiment about support/service (-100 to +100 or null)
   - pricing: sentiment about pricing/value (-100 to +100 or null)
   - relationship: sentiment about partnership/relationship (-100 to +100 or null)
5. key_phrases: Array of objects with:
   - text: The phrase
   - sentiment: "positive", "negative", or "neutral"
   - impact: Integer indicating contribution to overall score (-50 to +50)
6. risk_indicators: Array of concerning phrases or themes detected

Return ONLY valid JSON, no additional text.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Sentiment] Failed to parse Claude response:', responseText);
      return generateMockAnalysis(content);
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return {
      overall_score: Math.max(-100, Math.min(100, analysis.overall_score || 0)),
      confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5)),
      emotional_indicators: analysis.emotional_indicators || [],
      topic_sentiment: {
        product: analysis.topic_sentiment?.product ?? null,
        support: analysis.topic_sentiment?.support ?? null,
        pricing: analysis.topic_sentiment?.pricing ?? null,
        relationship: analysis.topic_sentiment?.relationship ?? null,
      },
      key_phrases: (analysis.key_phrases || []).map((kp: KeyPhrase) => ({
        text: kp.text,
        sentiment: kp.sentiment || 'neutral',
        impact: Math.max(-50, Math.min(50, kp.impact || 0)),
      })),
      risk_indicators: analysis.risk_indicators || [],
    };
  } catch (error) {
    console.error('[Sentiment] Claude analysis failed:', error);
    return generateMockAnalysis(content);
  }
}

/**
 * Generate mock analysis when Claude is not available
 */
function generateMockAnalysis(content: string): {
  overall_score: number;
  confidence: number;
  emotional_indicators: string[];
  topic_sentiment: TopicSentiment;
  key_phrases: KeyPhrase[];
  risk_indicators: string[];
} {
  const lowerContent = content.toLowerCase();

  // Simple keyword-based scoring
  let score = 0;
  const emotions: string[] = [];
  const phrases: KeyPhrase[] = [];

  // Positive indicators
  if (lowerContent.includes('thank')) { score += 15; emotions.push('appreciative'); }
  if (lowerContent.includes('great')) { score += 20; emotions.push('satisfied'); }
  if (lowerContent.includes('love')) { score += 25; emotions.push('enthusiastic'); }
  if (lowerContent.includes('excellent')) { score += 25; emotions.push('satisfied'); }
  if (lowerContent.includes('helpful')) { score += 15; emotions.push('appreciative'); }

  // Negative indicators
  if (lowerContent.includes('frustrated')) { score -= 30; emotions.push('frustrated'); }
  if (lowerContent.includes('disappointed')) { score -= 25; emotions.push('disappointed'); }
  if (lowerContent.includes('issue')) { score -= 15; emotions.push('concerned'); }
  if (lowerContent.includes('problem')) { score -= 15; emotions.push('concerned'); }
  if (lowerContent.includes('urgent')) { score -= 10; emotions.push('anxious'); }

  const riskIndicators = detectRiskKeywords(content);
  if (riskIndicators.length > 0) {
    score -= riskIndicators.length * 10;
  }

  return {
    overall_score: Math.max(-100, Math.min(100, score)),
    confidence: 0.6,
    emotional_indicators: [...new Set(emotions)],
    topic_sentiment: {
      product: null,
      support: null,
      pricing: null,
      relationship: null,
    },
    key_phrases: phrases,
    risk_indicators: riskIndicators,
  };
}

// ============================================================================
// Customer Sentiment Summary
// ============================================================================

/**
 * Get comprehensive sentiment summary for a customer
 */
export async function getCustomerSentiment(
  customerId: string
): Promise<CustomerSentimentSummary> {
  if (!supabase) {
    return getDefaultSentimentSummary(customerId);
  }

  // Get recent analyses
  const { data: analyses } = await supabase
    .from('sentiment_analyses')
    .select('*')
    .eq('customer_id', customerId)
    .order('analyzed_at', { ascending: false })
    .limit(50);

  if (!analyses || analyses.length === 0) {
    return getDefaultSentimentSummary(customerId);
  }

  // Calculate current score (weighted average of recent interactions)
  const currentScore = calculateWeightedScore(analyses.slice(0, 5));

  // Calculate trend
  const trend = calculateTrend(analyses);

  // Calculate changes
  const change7d = calculate7DayChange(analyses);
  const change30d = calculate30DayChange(analyses);

  // Aggregate topic sentiment
  const topicBreakdown = aggregateTopicSentiment(analyses);

  // Format recent interactions
  const recentInteractions = analyses.slice(0, 5).map(a => ({
    source: a.source as CommunicationSource,
    score: a.overall_score,
    date: a.analyzed_at,
    snippet: truncateContent(a.content_hash), // We don't store content, just hash
  }));

  // Build historical data (weekly averages)
  const historicalData = buildHistoricalData(analyses);

  return {
    customer_id: customerId,
    current_score: currentScore,
    trend,
    change_7d: change7d,
    change_30d: change30d,
    topic_breakdown: topicBreakdown,
    recent_interactions: recentInteractions,
    historical_data: historicalData,
  };
}

/**
 * Get sentiment alerts for a customer
 */
export async function getCustomerSentimentAlerts(
  customerId: string,
  unacknowledgedOnly: boolean = false
): Promise<SentimentAlert[]> {
  if (!supabase) {
    return [];
  }

  let query = supabase
    .from('sentiment_alerts')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (unacknowledgedOnly) {
    query = query.is('acknowledged_at', null);
  }

  const { data: alerts } = await query.limit(20);

  return (alerts || []).map(a => ({
    id: a.id,
    customer_id: a.customer_id,
    sentiment_analysis_id: a.sentiment_analysis_id,
    alert_type: a.alert_type,
    alert_level: a.alert_level as AlertLevel,
    message: a.message,
    acknowledged_at: a.acknowledged_at,
    created_at: a.created_at,
  }));
}

/**
 * Acknowledge a sentiment alert
 */
export async function acknowledgeSentimentAlert(alertId: string): Promise<boolean> {
  if (!supabase) {
    return false;
  }

  const { error } = await supabase
    .from('sentiment_alerts')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('id', alertId);

  return !error;
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Get portfolio-level sentiment summary
 */
export async function getPortfolioSentiment(): Promise<{
  average_score: number;
  at_risk_count: number;
  declining_count: number;
  customers_by_sentiment: {
    positive: number;
    neutral: number;
    negative: number;
    critical: number;
  };
}> {
  if (!supabase) {
    return {
      average_score: 65,
      at_risk_count: 0,
      declining_count: 0,
      customers_by_sentiment: {
        positive: 0,
        neutral: 0,
        negative: 0,
        critical: 0,
      },
    };
  }

  // Get latest sentiment for each customer
  const { data: latestScores } = await supabase
    .from('sentiment_analyses')
    .select('customer_id, overall_score')
    .order('analyzed_at', { ascending: false });

  if (!latestScores || latestScores.length === 0) {
    return {
      average_score: 65,
      at_risk_count: 0,
      declining_count: 0,
      customers_by_sentiment: {
        positive: 0,
        neutral: 0,
        negative: 0,
        critical: 0,
      },
    };
  }

  // Deduplicate by customer (keep latest)
  const customerScores = new Map<string, number>();
  for (const score of latestScores) {
    if (!customerScores.has(score.customer_id)) {
      customerScores.set(score.customer_id, score.overall_score);
    }
  }

  const scores = Array.from(customerScores.values());
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  return {
    average_score: Math.round(avgScore),
    at_risk_count: scores.filter(s => s < -30).length,
    declining_count: scores.filter(s => s < 0).length,
    customers_by_sentiment: {
      positive: scores.filter(s => s >= 50).length,
      neutral: scores.filter(s => s >= 0 && s < 50).length,
      negative: scores.filter(s => s >= -50 && s < 0).length,
      critical: scores.filter(s => s < -50).length,
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getCustomerContext(customerId: string): Promise<Record<string, unknown> | null> {
  if (!supabase) return null;

  const { data } = await supabase
    .from('customers')
    .select('name, industry, health_score, stage')
    .eq('id', customerId)
    .single();

  return data;
}

async function getRecentSentimentTrend(customerId: string): Promise<string> {
  if (!supabase) return 'unknown';

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { data } = await supabase
    .from('sentiment_analyses')
    .select('overall_score, analyzed_at')
    .eq('customer_id', customerId)
    .gte('analyzed_at', thirtyDaysAgo.toISOString())
    .order('analyzed_at', { ascending: true });

  if (!data || data.length < 2) return 'insufficient data';

  const firstHalf = data.slice(0, Math.floor(data.length / 2));
  const secondHalf = data.slice(Math.floor(data.length / 2));

  const firstAvg = firstHalf.reduce((a, b) => a + b.overall_score, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b.overall_score, 0) / secondHalf.length;

  if (secondAvg > firstAvg + 10) return 'improving';
  if (secondAvg < firstAvg - 10) return 'declining';
  return 'stable';
}

function detectRiskKeywords(content: string): string[] {
  const lowerContent = content.toLowerCase();
  return RISK_KEYWORDS.filter(keyword => lowerContent.includes(keyword));
}

async function evaluateAlertConditions(
  score: number,
  customerId: string,
  riskIndicators: string[]
): Promise<{
  alertTriggered: boolean;
  alertLevel?: AlertLevel;
  alertMessage?: string;
}> {
  // Check single interaction threshold
  if (score < ALERT_THRESHOLDS.SINGLE_INTERACTION_NEGATIVE) {
    return {
      alertTriggered: true,
      alertLevel: score < -60 ? 'critical' : 'warning',
      alertMessage: `Negative sentiment detected (score: ${score})`,
    };
  }

  // Check for risk keywords
  if (riskIndicators.length >= 2) {
    return {
      alertTriggered: true,
      alertLevel: 'warning',
      alertMessage: `Risk indicators detected: ${riskIndicators.slice(0, 3).join(', ')}`,
    };
  }

  // Check for negative spike (multiple negative interactions recently)
  if (supabase) {
    const hoursAgo = new Date(
      Date.now() - ALERT_THRESHOLDS.NEGATIVE_SPIKE_HOURS * 60 * 60 * 1000
    );

    const { data: recentNegative } = await supabase
      .from('sentiment_analyses')
      .select('id')
      .eq('customer_id', customerId)
      .lt('overall_score', 0)
      .gte('analyzed_at', hoursAgo.toISOString());

    if (recentNegative && recentNegative.length >= ALERT_THRESHOLDS.NEGATIVE_SPIKE_COUNT) {
      return {
        alertTriggered: true,
        alertLevel: 'critical',
        alertMessage: `Negative sentiment spike: ${recentNegative.length} negative interactions in ${ALERT_THRESHOLDS.NEGATIVE_SPIKE_HOURS} hours`,
      };
    }
  }

  return { alertTriggered: false };
}

async function createSentimentAlert(
  customerId: string,
  sentimentAnalysisId: string,
  alertLevel: AlertLevel,
  message: string
): Promise<void> {
  if (!supabase) return;

  await supabase.from('sentiment_alerts').insert({
    id: crypto.randomUUID(),
    customer_id: customerId,
    sentiment_analysis_id: sentimentAnalysisId,
    alert_type: alertLevel === 'critical' ? 'negative_spike' : 'low_sentiment',
    alert_level: alertLevel,
    message,
    created_at: new Date().toISOString(),
  });
}

function calculateWeightedScore(analyses: Array<{ overall_score: number }>): number {
  if (analyses.length === 0) return 50;

  // More recent analyses have higher weight
  const weights = analyses.map((_, i) => Math.pow(0.8, i));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const weightedSum = analyses.reduce(
    (sum, a, i) => sum + a.overall_score * weights[i],
    0
  );

  return Math.round(weightedSum / totalWeight);
}

function calculateTrend(analyses: Array<{ overall_score: number; analyzed_at: string }>): SentimentTrend {
  if (analyses.length < 3) return 'stable';

  const recent = analyses.slice(0, 3);
  const older = analyses.slice(3, 6);

  if (older.length === 0) return 'stable';

  const recentAvg = recent.reduce((a, b) => a + b.overall_score, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b.overall_score, 0) / older.length;

  if (recentAvg > olderAvg + 10) return 'improving';
  if (recentAvg < olderAvg - 10) return 'declining';
  return 'stable';
}

function calculate7DayChange(analyses: Array<{ overall_score: number; analyzed_at: string }>): number {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recent = analyses.filter(a => new Date(a.analyzed_at) >= sevenDaysAgo);
  const older = analyses.filter(a => new Date(a.analyzed_at) < sevenDaysAgo);

  if (recent.length === 0 || older.length === 0) return 0;

  const recentAvg = recent.reduce((a, b) => a + b.overall_score, 0) / recent.length;
  const olderAvg = older.slice(0, recent.length).reduce((a, b) => a + b.overall_score, 0) / Math.min(older.length, recent.length);

  return Math.round(recentAvg - olderAvg);
}

function calculate30DayChange(analyses: Array<{ overall_score: number; analyzed_at: string }>): number {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const recent = analyses.filter(
    a => new Date(a.analyzed_at) >= thirtyDaysAgo
  );
  const older = analyses.filter(
    a => new Date(a.analyzed_at) >= sixtyDaysAgo && new Date(a.analyzed_at) < thirtyDaysAgo
  );

  if (recent.length === 0 || older.length === 0) return 0;

  const recentAvg = recent.reduce((a, b) => a + b.overall_score, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b.overall_score, 0) / older.length;

  return Math.round(recentAvg - olderAvg);
}

function aggregateTopicSentiment(analyses: Array<{ topic_sentiment: TopicSentiment | null }>): TopicSentiment {
  const topics = { product: [] as number[], support: [] as number[], pricing: [] as number[], relationship: [] as number[] };

  for (const a of analyses) {
    if (a.topic_sentiment) {
      if (a.topic_sentiment.product !== null) topics.product.push(a.topic_sentiment.product);
      if (a.topic_sentiment.support !== null) topics.support.push(a.topic_sentiment.support);
      if (a.topic_sentiment.pricing !== null) topics.pricing.push(a.topic_sentiment.pricing);
      if (a.topic_sentiment.relationship !== null) topics.relationship.push(a.topic_sentiment.relationship);
    }
  }

  return {
    product: topics.product.length > 0 ? Math.round(topics.product.reduce((a, b) => a + b, 0) / topics.product.length) : null,
    support: topics.support.length > 0 ? Math.round(topics.support.reduce((a, b) => a + b, 0) / topics.support.length) : null,
    pricing: topics.pricing.length > 0 ? Math.round(topics.pricing.reduce((a, b) => a + b, 0) / topics.pricing.length) : null,
    relationship: topics.relationship.length > 0 ? Math.round(topics.relationship.reduce((a, b) => a + b, 0) / topics.relationship.length) : null,
  };
}

function buildHistoricalData(analyses: Array<{ overall_score: number; analyzed_at: string }>): Array<{ date: string; score: number }> {
  const weeklyData = new Map<string, number[]>();

  for (const a of analyses) {
    const date = new Date(a.analyzed_at);
    // Get week start (Sunday)
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weeklyData.has(weekKey)) {
      weeklyData.set(weekKey, []);
    }
    weeklyData.get(weekKey)!.push(a.overall_score);
  }

  return Array.from(weeklyData.entries())
    .map(([date, scores]) => ({
      date,
      score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8); // Last 8 weeks
}

function truncateContent(hash: string): string {
  return `Analysis ${hash.slice(0, 8)}...`;
}

function getDefaultSentimentSummary(customerId: string): CustomerSentimentSummary {
  return {
    customer_id: customerId,
    current_score: 50,
    trend: 'stable',
    change_7d: 0,
    change_30d: 0,
    topic_breakdown: {
      product: null,
      support: null,
      pricing: null,
      relationship: null,
    },
    recent_interactions: [],
    historical_data: [],
  };
}

// ============================================================================
// Exports
// ============================================================================

export const sentimentAnalyzer = {
  analyzeSentiment,
  getCustomerSentiment,
  getCustomerSentimentAlerts,
  acknowledgeSentimentAlert,
  getPortfolioSentiment,
};

export default sentimentAnalyzer;
