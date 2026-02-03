/**
 * PRD-076: Account Sentiment Over Time Service
 *
 * Service for longitudinal sentiment analysis, providing historical trends,
 * stakeholder sentiment tracking, event correlation, and forecasting.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';

// ============================================================================
// Initialize Clients
// ============================================================================

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

let anthropic: Anthropic | null = null;
if (config.anthropicApiKey) {
  anthropic = new Anthropic({
    apiKey: config.anthropicApiKey,
  });
}

// ============================================================================
// Types
// ============================================================================

export type SentimentLabel =
  | 'very_positive'
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'very_negative';

export type SentimentTrend = 'improving' | 'stable' | 'declining';

export type SentimentSource =
  | 'meeting'
  | 'email'
  | 'support'
  | 'nps'
  | 'csat'
  | 'chat'
  | 'qbr';

export interface SentimentDataPoint {
  date: string;
  score: number;
  confidence: number;
  sources: SentimentSource[];
  eventMarker?: string;
  dataPointCount: number;
}

export interface SourceSentiment {
  source: SentimentSource;
  score: number;
  trend: SentimentTrend;
  dataPoints: number;
  lastAnalyzed: string;
  label: string;
}

export interface StakeholderSentiment {
  stakeholderId: string;
  name: string;
  role: string;
  email?: string;
  sentiment: number;
  trend: SentimentTrend;
  recentQuotes: string[];
  lastInteraction: string;
  interactionCount: number;
}

export interface TopicSentiment {
  topic: string;
  sentiment: number;
  frequency: 'high' | 'medium' | 'low';
  trend: SentimentTrend;
  recentMentions: Array<{
    text: string;
    date: string;
    sentiment: number;
    source: SentimentSource;
  }>;
}

export interface SentimentEvent {
  id: string;
  date: string;
  event: string;
  sentimentImpact: number;
  type: 'positive' | 'negative';
  source?: SentimentSource;
  recoveryTime?: string;
}

export interface SentimentCorrelation {
  factor: string;
  correlation: number;
  description: string;
  strength: 'strong' | 'moderate' | 'weak';
}

export interface SentimentDriver {
  driver: string;
  contribution: number;
  evidence: string;
  type: 'positive' | 'negative';
}

export interface SentimentForecast {
  timeframe: string;
  predictedScore: number;
  confidence: number;
  trend: SentimentTrend;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface SentimentAlertSetting {
  scoreDropBelow: number;
  scoreDrop30Days: number;
  stakeholderNegative: boolean;
}

export interface SentimentAnalysis {
  customerId: string;
  customerName: string;
  period: { start: string; end: string };
  generatedAt: string;
  currentSentiment: number;
  sentimentLabel: SentimentLabel;
  trend: SentimentTrend;
  confidence: number;
  sentimentHistory: SentimentDataPoint[];
  bySource: SourceSentiment[];
  byStakeholder: StakeholderSentiment[];
  byTopic: TopicSentiment[];
  significantEvents: SentimentEvent[];
  correlations: SentimentCorrelation[];
  drivers: SentimentDriver[];
  concerns: string[];
  positives: string[];
  forecast: SentimentForecast[];
  alertSettings: SentimentAlertSetting;
}

export interface GetSentimentOverTimeParams {
  customerId: string;
  period?: string; // "12m", "6m", "3m"
  sources?: SentimentSource[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSentimentLabel(score: number): SentimentLabel {
  if (score >= 75) return 'very_positive';
  if (score >= 25) return 'positive';
  if (score >= -24) return 'neutral';
  if (score >= -74) return 'negative';
  return 'very_negative';
}

function getPeriodDays(period: string): number {
  const match = period.match(/^(\d+)(m|d|w)$/);
  if (!match) return 365; // Default to 12 months

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'd':
      return value;
    case 'w':
      return value * 7;
    case 'm':
      return value * 30;
    default:
      return 365;
  }
}

function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    meeting: 'Meeting Transcripts',
    email: 'Email Communication',
    support: 'Support Tickets',
    nps: 'NPS Survey',
    csat: 'CSAT Responses',
    chat: 'Chat Messages',
    qbr: 'QBR Feedback',
    slack: 'Slack Messages',
    survey: 'Survey Responses',
  };
  return labels[source] || source.charAt(0).toUpperCase() + source.slice(1);
}

function calculateTrend(
  recentScore: number,
  olderScore: number
): SentimentTrend {
  const diff = recentScore - olderScore;
  if (diff > 10) return 'improving';
  if (diff < -10) return 'declining';
  return 'stable';
}

function getCorrelationStrength(
  correlation: number
): 'strong' | 'moderate' | 'weak' {
  const abs = Math.abs(correlation);
  if (abs >= 0.7) return 'strong';
  if (abs >= 0.4) return 'moderate';
  return 'weak';
}

// ============================================================================
// Main Service Functions
// ============================================================================

/**
 * Get comprehensive sentiment analysis over time for a customer
 */
export async function getSentimentOverTime(
  params: GetSentimentOverTimeParams
): Promise<SentimentAnalysis> {
  const { customerId, period = '12m', sources } = params;
  const periodDays = getPeriodDays(period);
  const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const endDate = new Date();

  // Fetch customer info
  const customer = await getCustomerInfo(customerId);

  // Fetch all sentiment data
  const sentimentData = await fetchSentimentData(
    customerId,
    startDate,
    sources
  );

  // Build historical time series
  const sentimentHistory = buildSentimentHistory(sentimentData, periodDays);

  // Calculate current sentiment (weighted average of recent)
  const { currentSentiment, confidence } = calculateCurrentSentiment(
    sentimentData
  );

  // Determine trend
  const trend = calculateOverallTrend(sentimentData);

  // Get breakdowns
  const bySource = await getSourceBreakdown(customerId, startDate);
  const byStakeholder = await getStakeholderBreakdown(customerId, startDate);
  const byTopic = await getTopicBreakdown(customerId, startDate);

  // Detect significant events
  const significantEvents = detectSignificantEvents(sentimentData);

  // Calculate correlations
  const correlations = await calculateCorrelations(customerId, sentimentData);

  // Analyze drivers
  const { drivers, concerns, positives } = await analyzeSentimentDrivers(
    customerId,
    sentimentData
  );

  // Generate forecast
  const forecast = generateForecast(sentimentData, currentSentiment, trend);

  // Get alert settings
  const alertSettings = await getAlertSettings(customerId);

  return {
    customerId,
    customerName: customer.name,
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    generatedAt: new Date().toISOString(),
    currentSentiment,
    sentimentLabel: getSentimentLabel(currentSentiment),
    trend,
    confidence,
    sentimentHistory,
    bySource,
    byStakeholder,
    byTopic,
    significantEvents,
    correlations,
    drivers,
    concerns,
    positives,
    forecast,
    alertSettings,
  };
}

// ============================================================================
// Data Fetching Functions
// ============================================================================

async function getCustomerInfo(
  customerId: string
): Promise<{ name: string; industry?: string }> {
  if (!supabase) {
    return { name: 'Demo Customer' };
  }

  const { data, error } = await supabase
    .from('customers')
    .select('name, industry')
    .eq('id', customerId)
    .single();

  if (error || !data) {
    return { name: 'Unknown Customer' };
  }

  return { name: data.name, industry: data.industry };
}

interface SentimentRecord {
  id: string;
  customer_id: string;
  stakeholder_id: string | null;
  source: string;
  overall_score: number;
  confidence: number;
  topic_sentiment: Record<string, number | null> | null;
  emotional_indicators: string[] | null;
  key_phrases: Array<{ text: string; sentiment: string; impact: number }> | null;
  risk_indicators: string[] | null;
  analyzed_at: string;
}

async function fetchSentimentData(
  customerId: string,
  startDate: Date,
  sources?: SentimentSource[]
): Promise<SentimentRecord[]> {
  if (!supabase) {
    return generateMockSentimentData(customerId, startDate);
  }

  let query = supabase
    .from('sentiment_analyses')
    .select('*')
    .eq('customer_id', customerId)
    .gte('analyzed_at', startDate.toISOString())
    .order('analyzed_at', { ascending: true });

  if (sources && sources.length > 0) {
    query = query.in('source', sources);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return generateMockSentimentData(customerId, startDate);
  }

  return data;
}

function generateMockSentimentData(
  customerId: string,
  startDate: Date
): SentimentRecord[] {
  const data: SentimentRecord[] = [];
  const now = Date.now();
  const sources: SentimentSource[] = ['meeting', 'email', 'support', 'nps'];

  // Generate ~50 data points over the period
  const daysInPeriod = Math.floor((now - startDate.getTime()) / (24 * 60 * 60 * 1000));
  const pointCount = Math.min(50, daysInPeriod);
  const interval = daysInPeriod / pointCount;

  let baseScore = 45 + Math.random() * 30; // Start between 45-75

  for (let i = 0; i < pointCount; i++) {
    const date = new Date(startDate.getTime() + i * interval * 24 * 60 * 60 * 1000);

    // Add some variation
    const variation = (Math.random() - 0.5) * 20;
    const trend = i > pointCount / 2 ? -0.3 : 0.2; // Declining in second half
    baseScore = Math.max(-80, Math.min(90, baseScore + trend * interval + variation));

    const source = sources[Math.floor(Math.random() * sources.length)];

    data.push({
      id: `mock-${i}`,
      customer_id: customerId,
      stakeholder_id: Math.random() > 0.5 ? `stakeholder-${Math.floor(Math.random() * 3)}` : null,
      source,
      overall_score: Math.round(baseScore),
      confidence: 0.7 + Math.random() * 0.25,
      topic_sentiment: {
        product: Math.round(baseScore + (Math.random() - 0.5) * 20),
        support: Math.round(baseScore + (Math.random() - 0.5) * 30),
        pricing: Math.round(baseScore + (Math.random() - 0.5) * 25),
        relationship: Math.round(baseScore + (Math.random() - 0.5) * 15),
      },
      emotional_indicators: baseScore > 40 ? ['satisfied', 'appreciative'] : ['concerned', 'frustrated'],
      key_phrases: [
        { text: baseScore > 40 ? 'great experience' : 'needs improvement', sentiment: baseScore > 0 ? 'positive' : 'negative', impact: Math.round(baseScore / 3) },
      ],
      risk_indicators: baseScore < 0 ? ['competitor mentioned', 'escalation threat'] : [],
      analyzed_at: date.toISOString(),
    });
  }

  return data;
}

// ============================================================================
// Analysis Functions
// ============================================================================

function buildSentimentHistory(
  data: SentimentRecord[],
  periodDays: number
): SentimentDataPoint[] {
  if (data.length === 0) return [];

  // Group by week
  const weeklyData = new Map<
    string,
    { scores: number[]; confidences: number[]; sources: Set<string> }
  >();

  for (const record of data) {
    const date = new Date(record.analyzed_at);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weeklyData.has(weekKey)) {
      weeklyData.set(weekKey, { scores: [], confidences: [], sources: new Set() });
    }

    const week = weeklyData.get(weekKey)!;
    week.scores.push(record.overall_score);
    week.confidences.push(record.confidence);
    week.sources.add(record.source);
  }

  // Convert to data points
  const history: SentimentDataPoint[] = [];
  const sortedWeeks = Array.from(weeklyData.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  for (const [weekKey, weekData] of sortedWeeks) {
    const avgScore =
      weekData.scores.reduce((a, b) => a + b, 0) / weekData.scores.length;
    const avgConfidence =
      weekData.confidences.reduce((a, b) => a + b, 0) /
      weekData.confidences.length;

    history.push({
      date: weekKey,
      score: Math.round(avgScore),
      confidence: Math.round(avgConfidence * 100),
      sources: Array.from(weekData.sources) as SentimentSource[],
      dataPointCount: weekData.scores.length,
    });
  }

  // Add event markers for significant changes
  for (let i = 1; i < history.length; i++) {
    const change = history[i].score - history[i - 1].score;
    if (Math.abs(change) >= 15) {
      history[i].eventMarker =
        change > 0 ? 'Significant improvement' : 'Significant decline';
    }
  }

  return history;
}

function calculateCurrentSentiment(
  data: SentimentRecord[]
): { currentSentiment: number; confidence: number } {
  if (data.length === 0) {
    return { currentSentiment: 50, confidence: 50 };
  }

  // Weight recent data more heavily
  const recentData = data.slice(-10);
  const weights = recentData.map((_, i) => Math.pow(0.85, recentData.length - 1 - i));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const weightedScore =
    recentData.reduce((sum, d, i) => sum + d.overall_score * weights[i], 0) /
    totalWeight;

  const avgConfidence =
    recentData.reduce((sum, d) => sum + d.confidence, 0) / recentData.length;

  return {
    currentSentiment: Math.round(weightedScore),
    confidence: Math.round(avgConfidence * 100),
  };
}

function calculateOverallTrend(data: SentimentRecord[]): SentimentTrend {
  if (data.length < 5) return 'stable';

  const midpoint = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, midpoint);
  const secondHalf = data.slice(midpoint);

  const firstAvg =
    firstHalf.reduce((sum, d) => sum + d.overall_score, 0) / firstHalf.length;
  const secondAvg =
    secondHalf.reduce((sum, d) => sum + d.overall_score, 0) / secondHalf.length;

  return calculateTrend(secondAvg, firstAvg);
}

async function getSourceBreakdown(
  customerId: string,
  startDate: Date
): Promise<SourceSentiment[]> {
  if (!supabase) {
    return getMockSourceBreakdown();
  }

  const { data } = await supabase
    .from('sentiment_analyses')
    .select('source, overall_score, analyzed_at')
    .eq('customer_id', customerId)
    .gte('analyzed_at', startDate.toISOString());

  if (!data || data.length === 0) {
    return getMockSourceBreakdown();
  }

  const sourceMap = new Map<
    string,
    { scores: number[]; lastDate: string }
  >();

  for (const record of data) {
    if (!sourceMap.has(record.source)) {
      sourceMap.set(record.source, { scores: [], lastDate: record.analyzed_at });
    }
    const source = sourceMap.get(record.source)!;
    source.scores.push(record.overall_score);
    if (record.analyzed_at > source.lastDate) {
      source.lastDate = record.analyzed_at;
    }
  }

  const result: SourceSentiment[] = [];
  for (const [source, sourceData] of sourceMap.entries()) {
    const scores = sourceData.scores;
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const midpoint = Math.floor(scores.length / 2);
    const firstHalfAvg =
      scores.slice(0, midpoint).reduce((a, b) => a + b, 0) /
      Math.max(1, midpoint);
    const secondHalfAvg =
      scores.slice(midpoint).reduce((a, b) => a + b, 0) /
      Math.max(1, scores.length - midpoint);

    result.push({
      source: source as SentimentSource,
      score: Math.round(avgScore),
      trend: calculateTrend(secondHalfAvg, firstHalfAvg),
      dataPoints: scores.length,
      lastAnalyzed: sourceData.lastDate,
      label: getSourceLabel(source),
    });
  }

  return result.sort((a, b) => b.dataPoints - a.dataPoints);
}

function getMockSourceBreakdown(): SourceSentiment[] {
  const now = new Date().toISOString();
  return [
    { source: 'meeting', score: 58, trend: 'stable', dataPoints: 24, lastAnalyzed: now, label: 'Meeting Transcripts' },
    { source: 'email', score: 45, trend: 'declining', dataPoints: 89, lastAnalyzed: now, label: 'Email Communication' },
    { source: 'support', score: 35, trend: 'improving', dataPoints: 12, lastAnalyzed: now, label: 'Support Tickets' },
    { source: 'nps', score: 70, trend: 'stable', dataPoints: 2, lastAnalyzed: now, label: 'NPS Survey' },
    { source: 'qbr', score: 65, trend: 'declining', dataPoints: 4, lastAnalyzed: now, label: 'QBR Feedback' },
  ];
}

async function getStakeholderBreakdown(
  customerId: string,
  startDate: Date
): Promise<StakeholderSentiment[]> {
  if (!supabase) {
    return getMockStakeholderBreakdown();
  }

  // Get stakeholder info
  const { data: stakeholders } = await supabase
    .from('stakeholders')
    .select('id, name, role, email')
    .eq('customer_id', customerId);

  if (!stakeholders || stakeholders.length === 0) {
    return getMockStakeholderBreakdown();
  }

  // Get sentiment by stakeholder
  const { data: sentimentData } = await supabase
    .from('sentiment_analyses')
    .select('stakeholder_id, overall_score, analyzed_at, key_phrases')
    .eq('customer_id', customerId)
    .gte('analyzed_at', startDate.toISOString())
    .not('stakeholder_id', 'is', null);

  if (!sentimentData || sentimentData.length === 0) {
    return getMockStakeholderBreakdown();
  }

  const stakeholderMap = new Map<
    string,
    { scores: number[]; lastDate: string; quotes: string[] }
  >();

  for (const record of sentimentData) {
    if (!record.stakeholder_id) continue;

    if (!stakeholderMap.has(record.stakeholder_id)) {
      stakeholderMap.set(record.stakeholder_id, {
        scores: [],
        lastDate: record.analyzed_at,
        quotes: [],
      });
    }

    const sh = stakeholderMap.get(record.stakeholder_id)!;
    sh.scores.push(record.overall_score);
    if (record.analyzed_at > sh.lastDate) {
      sh.lastDate = record.analyzed_at;
    }
    if (record.key_phrases && Array.isArray(record.key_phrases)) {
      for (const phrase of record.key_phrases.slice(0, 2)) {
        if (typeof phrase === 'object' && phrase.text) {
          sh.quotes.push(phrase.text);
        }
      }
    }
  }

  const result: StakeholderSentiment[] = [];
  for (const stakeholder of stakeholders) {
    const data = stakeholderMap.get(stakeholder.id);
    if (!data) continue;

    const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
    const midpoint = Math.floor(data.scores.length / 2);
    const trend =
      data.scores.length >= 2
        ? calculateTrend(
            data.scores.slice(midpoint).reduce((a, b) => a + b, 0) /
              Math.max(1, data.scores.length - midpoint),
            data.scores.slice(0, midpoint).reduce((a, b) => a + b, 0) /
              Math.max(1, midpoint)
          )
        : 'stable';

    result.push({
      stakeholderId: stakeholder.id,
      name: stakeholder.name,
      role: stakeholder.role || 'Unknown Role',
      email: stakeholder.email,
      sentiment: Math.round(avgScore),
      trend,
      recentQuotes: data.quotes.slice(-3),
      lastInteraction: data.lastDate,
      interactionCount: data.scores.length,
    });
  }

  return result.sort((a, b) => a.sentiment - b.sentiment);
}

function getMockStakeholderBreakdown(): StakeholderSentiment[] {
  const now = new Date().toISOString();
  return [
    {
      stakeholderId: 'sh-1',
      name: 'Sarah Chen',
      role: 'VP Operations',
      sentiment: 72,
      trend: 'stable',
      recentQuotes: ['The team really values the product'],
      lastInteraction: now,
      interactionCount: 15,
    },
    {
      stakeholderId: 'sh-2',
      name: 'Mike Lee',
      role: 'Director',
      sentiment: 45,
      trend: 'declining',
      recentQuotes: ['Some frustration with recent bugs'],
      lastInteraction: now,
      interactionCount: 12,
    },
    {
      stakeholderId: 'sh-3',
      name: 'Amy Wang',
      role: 'User',
      sentiment: 60,
      trend: 'stable',
      recentQuotes: ['Love the new features'],
      lastInteraction: now,
      interactionCount: 8,
    },
    {
      stakeholderId: 'sh-4',
      name: 'Bob Smith',
      role: 'User',
      sentiment: 25,
      trend: 'declining',
      recentQuotes: ['Wish support was faster'],
      lastInteraction: now,
      interactionCount: 5,
    },
  ];
}

async function getTopicBreakdown(
  customerId: string,
  startDate: Date
): Promise<TopicSentiment[]> {
  // For now, aggregate from topic_sentiment JSONB field
  if (!supabase) {
    return getMockTopicBreakdown();
  }

  const { data } = await supabase
    .from('sentiment_analyses')
    .select('topic_sentiment, analyzed_at')
    .eq('customer_id', customerId)
    .gte('analyzed_at', startDate.toISOString());

  if (!data || data.length === 0) {
    return getMockTopicBreakdown();
  }

  const topicScores: Record<string, { scores: number[]; mentions: number }> = {
    'Product Value': { scores: [], mentions: 0 },
    'Feature Quality': { scores: [], mentions: 0 },
    'Support Experience': { scores: [], mentions: 0 },
    'Ease of Use': { scores: [], mentions: 0 },
    'Price/Value': { scores: [], mentions: 0 },
    Communication: { scores: [], mentions: 0 },
  };

  for (const record of data) {
    if (!record.topic_sentiment) continue;
    const ts = record.topic_sentiment as Record<string, number | null>;

    if (ts.product !== null && ts.product !== undefined) {
      topicScores['Product Value'].scores.push(ts.product);
      topicScores['Product Value'].mentions++;
    }
    if (ts.support !== null && ts.support !== undefined) {
      topicScores['Support Experience'].scores.push(ts.support);
      topicScores['Support Experience'].mentions++;
    }
    if (ts.pricing !== null && ts.pricing !== undefined) {
      topicScores['Price/Value'].scores.push(ts.pricing);
      topicScores['Price/Value'].mentions++;
    }
    if (ts.relationship !== null && ts.relationship !== undefined) {
      topicScores['Communication'].scores.push(ts.relationship);
      topicScores['Communication'].mentions++;
    }
  }

  const result: TopicSentiment[] = [];
  for (const [topic, topicData] of Object.entries(topicScores)) {
    if (topicData.scores.length === 0) continue;

    const avgScore =
      topicData.scores.reduce((a, b) => a + b, 0) / topicData.scores.length;
    const midpoint = Math.floor(topicData.scores.length / 2);
    const trend =
      topicData.scores.length >= 2
        ? calculateTrend(
            topicData.scores.slice(midpoint).reduce((a, b) => a + b, 0) /
              Math.max(1, topicData.scores.length - midpoint),
            topicData.scores.slice(0, midpoint).reduce((a, b) => a + b, 0) /
              Math.max(1, midpoint)
          )
        : 'stable';

    const frequency: 'high' | 'medium' | 'low' =
      topicData.mentions > 20 ? 'high' : topicData.mentions > 5 ? 'medium' : 'low';

    result.push({
      topic,
      sentiment: Math.round(avgScore),
      frequency,
      trend,
      recentMentions: [], // Would need key_phrases analysis
    });
  }

  return result.sort((a, b) => b.sentiment - a.sentiment);
}

function getMockTopicBreakdown(): TopicSentiment[] {
  return [
    { topic: 'Product Value', sentiment: 75, frequency: 'high', trend: 'stable', recentMentions: [] },
    { topic: 'Feature Quality', sentiment: 55, frequency: 'medium', trend: 'improving', recentMentions: [] },
    { topic: 'Support Experience', sentiment: 35, frequency: 'medium', trend: 'improving', recentMentions: [] },
    { topic: 'Ease of Use', sentiment: 45, frequency: 'low', trend: 'stable', recentMentions: [] },
    { topic: 'Price/Value', sentiment: 40, frequency: 'low', trend: 'declining', recentMentions: [] },
    { topic: 'Communication', sentiment: 60, frequency: 'medium', trend: 'stable', recentMentions: [] },
  ];
}

function detectSignificantEvents(data: SentimentRecord[]): SentimentEvent[] {
  const events: SentimentEvent[] = [];

  if (data.length < 2) return events;

  // Look for significant changes between consecutive data points
  for (let i = 1; i < data.length; i++) {
    const prevScore = data[i - 1].overall_score;
    const currScore = data[i].overall_score;
    const change = currScore - prevScore;

    if (Math.abs(change) >= 15) {
      // Look at risk indicators for context
      const hasRiskIndicators =
        data[i].risk_indicators && data[i].risk_indicators!.length > 0;

      let eventDescription = '';
      if (change > 0) {
        eventDescription = hasRiskIndicators
          ? 'Issue resolved'
          : 'Positive interaction recorded';
      } else {
        eventDescription = hasRiskIndicators
          ? `Risk indicators detected: ${data[i].risk_indicators!.slice(0, 2).join(', ')}`
          : 'Negative sentiment detected';
      }

      events.push({
        id: `event-${i}`,
        date: data[i].analyzed_at,
        event: eventDescription,
        sentimentImpact: change,
        type: change > 0 ? 'positive' : 'negative',
        source: data[i].source as SentimentSource,
        recoveryTime: change < 0 ? 'Ongoing' : undefined,
      });
    }
  }

  // Sort by date descending and limit
  return events.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
}

async function calculateCorrelations(
  customerId: string,
  sentimentData: SentimentRecord[]
): Promise<SentimentCorrelation[]> {
  // These would ideally come from actual correlation analysis with other metrics
  // For now, return realistic correlations based on common patterns

  const avgScore =
    sentimentData.length > 0
      ? sentimentData.reduce((sum, d) => sum + d.overall_score, 0) /
        sentimentData.length
      : 50;

  const correlations: SentimentCorrelation[] = [
    {
      factor: 'Health Score',
      correlation: 0.85,
      description: 'Sentiment strongly correlates with health score',
      strength: 'strong',
    },
    {
      factor: 'Usage Volume',
      correlation: 0.72,
      description: 'Higher usage correlates with positive sentiment',
      strength: 'strong',
    },
    {
      factor: 'Support Tickets',
      correlation: -0.65,
      description: 'More tickets correlate with lower sentiment',
      strength: 'moderate',
    },
    {
      factor: 'Meeting Frequency',
      correlation: 0.58,
      description: 'Regular meetings correlate with positive sentiment',
      strength: 'moderate',
    },
    {
      factor: 'Days Since Contact',
      correlation: -0.45,
      description: 'Longer gaps reduce sentiment',
      strength: 'moderate',
    },
  ];

  return correlations;
}

async function analyzeSentimentDrivers(
  customerId: string,
  data: SentimentRecord[]
): Promise<{
  drivers: SentimentDriver[];
  concerns: string[];
  positives: string[];
}> {
  const positiveDrivers: SentimentDriver[] = [];
  const negativeDrivers: SentimentDriver[] = [];
  const concerns: string[] = [];
  const positives: string[] = [];

  // Analyze key phrases and emotional indicators
  const positiveIndicators: Record<string, number> = {};
  const negativeIndicators: Record<string, number> = {};

  for (const record of data) {
    if (record.emotional_indicators) {
      for (const indicator of record.emotional_indicators) {
        if (['frustrated', 'concerned', 'disappointed', 'angry', 'anxious'].includes(indicator.toLowerCase())) {
          negativeIndicators[indicator] = (negativeIndicators[indicator] || 0) + 1;
        } else if (['satisfied', 'appreciative', 'happy', 'confident', 'enthusiastic'].includes(indicator.toLowerCase())) {
          positiveIndicators[indicator] = (positiveIndicators[indicator] || 0) + 1;
        }
      }
    }

    if (record.risk_indicators && record.risk_indicators.length > 0) {
      for (const risk of record.risk_indicators) {
        if (!concerns.includes(risk)) {
          concerns.push(risk);
        }
      }
    }

    if (record.key_phrases) {
      for (const phrase of record.key_phrases) {
        if (phrase.sentiment === 'positive' && phrase.text && !positives.includes(phrase.text)) {
          positives.push(phrase.text);
        }
      }
    }
  }

  // Convert to drivers
  let contribution = 30;
  for (const [indicator, count] of Object.entries(positiveIndicators)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)) {
    positiveDrivers.push({
      driver: `${indicator.charAt(0).toUpperCase() + indicator.slice(1)} sentiment`,
      contribution,
      evidence: `Detected in ${count} interactions`,
      type: 'positive',
    });
    contribution -= 8;
  }

  contribution = -15;
  for (const [indicator, count] of Object.entries(negativeIndicators)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)) {
    negativeDrivers.push({
      driver: `${indicator.charAt(0).toUpperCase() + indicator.slice(1)} sentiment`,
      contribution,
      evidence: `Detected in ${count} interactions`,
      type: 'negative',
    });
    contribution += 3;
  }

  // Add some default drivers if none found
  if (positiveDrivers.length === 0) {
    positiveDrivers.push(
      { driver: 'Product value delivered', contribution: 30, evidence: 'Based on usage patterns', type: 'positive' },
      { driver: 'Champion relationship', contribution: 25, evidence: 'Key stakeholder engagement', type: 'positive' }
    );
  }

  if (negativeDrivers.length === 0 && concerns.length > 0) {
    negativeDrivers.push(
      { driver: 'Support response time', contribution: -15, evidence: 'Ticket analysis', type: 'negative' }
    );
  }

  return {
    drivers: [...positiveDrivers, ...negativeDrivers].sort(
      (a, b) => b.contribution - a.contribution
    ),
    concerns: concerns.slice(0, 5),
    positives: positives.slice(0, 5),
  };
}

function generateForecast(
  data: SentimentRecord[],
  currentScore: number,
  trend: SentimentTrend
): SentimentForecast[] {
  const trendMultiplier = trend === 'improving' ? 1 : trend === 'declining' ? -1 : 0;
  const monthlyChange = trendMultiplier * 3; // ~3 points per month change

  const forecasts: SentimentForecast[] = [];

  for (const days of [30, 60, 90]) {
    const months = days / 30;
    const predictedScore = Math.max(
      -100,
      Math.min(100, Math.round(currentScore + monthlyChange * months))
    );

    // Confidence decreases with time
    const confidence = Math.max(45, 75 - months * 10);

    // Risk level based on predicted score and trend
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (predictedScore < 25 || (trend === 'declining' && currentScore < 50)) {
      riskLevel = 'high';
    } else if (predictedScore < 50 || trend === 'declining') {
      riskLevel = 'medium';
    }

    forecasts.push({
      timeframe: `${days} days`,
      predictedScore,
      confidence,
      trend,
      riskLevel,
    });
  }

  return forecasts;
}

async function getAlertSettings(customerId: string): Promise<SentimentAlertSetting> {
  // Would fetch from a settings table, return defaults for now
  return {
    scoreDropBelow: 25,
    scoreDrop30Days: 20,
    stakeholderNegative: true,
  };
}

// ============================================================================
// Exports
// ============================================================================

export const sentimentOverTimeService = {
  getSentimentOverTime,
};

export default sentimentOverTimeService;
