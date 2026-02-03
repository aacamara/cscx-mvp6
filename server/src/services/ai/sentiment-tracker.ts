/**
 * PRD-076: Account Sentiment Over Time Service
 *
 * Comprehensive sentiment tracking service for longitudinal analysis:
 * - Timeline visualization with event markers
 * - Stakeholder sentiment breakdown
 * - Topic sentiment deep dive
 * - Sentiment drivers analysis
 * - Correlation analysis
 * - Sentiment forecasting
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import crypto from 'crypto';

// Initialize clients
let anthropic: Anthropic | null = null;
if (config.anthropicApiKey) {
  anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
}

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================================================
// Types
// ============================================================================

export type SentimentSource = 'email' | 'meeting' | 'support' | 'survey' | 'chat' | 'qbr';
export type SentimentTrend = 'improving' | 'stable' | 'declining';
export type SentimentLabel = 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';

export interface DateRange {
  start: string;
  end: string;
}

export interface SentimentDataPoint {
  date: string;
  score: number;
  confidence: number;
  sources: SentimentSource[];
  eventMarker?: string;
  dataPointCount?: number;
}

export interface SentimentEvent {
  id: string;
  date: string;
  event: string;
  sentimentImpact: number;
  type: 'positive' | 'negative';
  recoveryDays?: number;
}

export interface SourceSentiment {
  source: SentimentSource;
  score: number | null;
  trend: SentimentTrend;
  dataPoints: number;
  lastAnalyzed: string | null;
}

export interface StakeholderSentiment {
  stakeholderId: string;
  stakeholderName: string;
  role: string;
  sentiment: number;
  trend: SentimentTrend;
  recentQuotes: string[];
  lastInteraction: string | null;
  engagementLevel: 'high' | 'medium' | 'low';
}

export interface TopicSentiment {
  topic: string;
  sentiment: number | null;
  frequency: 'high' | 'medium' | 'low';
  trend: SentimentTrend;
  recentMentions: Array<{
    date: string;
    quote: string;
    sentiment: number;
    source: SentimentSource;
  }>;
}

export interface SentimentDriver {
  driver: string;
  contribution: number;
  type: 'positive' | 'negative';
  evidence: string;
  frequency: number;
  trend: SentimentTrend;
}

export interface SentimentCorrelation {
  factor: string;
  correlation: number;
  strength: 'strong' | 'moderate' | 'weak';
  description: string;
}

export interface SentimentForecast {
  timeframe: string;
  predictedSentiment: number;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface SentimentAlertSetting {
  id: string;
  condition: string;
  alertType: 'email' | 'slack' | 'in_app';
  status: 'active' | 'inactive' | 'triggered';
  triggeredAt?: string;
  thresholdValue?: number;
}

export interface SentimentAnalysisResponse {
  customerId: string;
  customerName: string;
  period: DateRange;
  updatedAt: string;

  currentSentiment: number;
  sentimentLabel: SentimentLabel;
  trend: SentimentTrend;
  confidence: number;
  dataPointCount: number;

  sentimentHistory: SentimentDataPoint[];
  bySource: SourceSentiment[];
  byStakeholder: StakeholderSentiment[];
  byTopic: TopicSentiment[];

  significantEvents: SentimentEvent[];
  correlations: SentimentCorrelation[];

  positiveDrivers: SentimentDriver[];
  negativeDrivers: SentimentDriver[];

  concerns: string[];
  positives: string[];

  forecast: SentimentForecast[];
  alertSettings: SentimentAlertSetting[];
}

export interface GetSentimentParams {
  customerId: string;
  period?: string;
  sources?: SentimentSource[];
  includeStakeholders?: boolean;
  includeTopics?: boolean;
  includeForecasts?: boolean;
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

function parsePeriod(period: string): { start: Date; end: Date } {
  const end = new Date();
  let start: Date;

  if (period.endsWith('m')) {
    const months = parseInt(period.slice(0, -1), 10) || 12;
    start = new Date(end);
    start.setMonth(start.getMonth() - months);
  } else if (period.endsWith('d')) {
    const days = parseInt(period.slice(0, -1), 10) || 30;
    start = new Date(end);
    start.setDate(start.getDate() - days);
  } else {
    start = new Date(end);
    start.setMonth(start.getMonth() - 12);
  }

  return { start, end };
}

function calculateTrend(recentAvg: number, olderAvg: number): SentimentTrend {
  if (recentAvg > olderAvg + 10) return 'improving';
  if (recentAvg < olderAvg - 10) return 'declining';
  return 'stable';
}

function getCorrelationStrength(coefficient: number): 'strong' | 'moderate' | 'weak' {
  const abs = Math.abs(coefficient);
  if (abs >= 0.7) return 'strong';
  if (abs >= 0.4) return 'moderate';
  return 'weak';
}

// ============================================================================
// Main Service Functions
// ============================================================================

/**
 * Get comprehensive sentiment analysis for a customer
 */
export async function getSentimentAnalysis(
  params: GetSentimentParams
): Promise<SentimentAnalysisResponse> {
  const {
    customerId,
    period = '12m',
    includeStakeholders = true,
    includeTopics = true,
    includeForecasts = true,
  } = params;

  const { start, end } = parsePeriod(period);

  // Get customer info
  const customerInfo = await getCustomerInfo(customerId);

  // Get sentiment history
  const sentimentHistory = await getSentimentHistory(customerId, start, end);

  // Calculate current sentiment and trend
  const { currentSentiment, trend, confidence, dataPointCount } = calculateCurrentSentiment(sentimentHistory);

  // Get breakdowns
  const bySource = await getSentimentBySource(customerId, start, end);
  const byStakeholder = includeStakeholders ? await getSentimentByStakeholder(customerId, start, end) : [];
  const byTopic = includeTopics ? await getSentimentByTopic(customerId, start, end) : [];

  // Get events and correlations
  const significantEvents = await getSignificantEvents(customerId, start, end);
  const correlations = await getSentimentCorrelations(customerId);

  // Get drivers
  const { positiveDrivers, negativeDrivers } = await getSentimentDrivers(customerId);

  // Generate insights
  const { concerns, positives } = generateInsights(bySource, byStakeholder, byTopic, sentimentHistory);

  // Get forecasts
  const forecast = includeForecasts ? await getSentimentForecasts(customerId, currentSentiment, trend) : [];

  // Get alert settings
  const alertSettings = await getAlertSettings(customerId);

  return {
    customerId,
    customerName: customerInfo?.name || 'Unknown Customer',
    period: {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    },
    updatedAt: new Date().toISOString(),

    currentSentiment,
    sentimentLabel: getSentimentLabel(currentSentiment),
    trend,
    confidence,
    dataPointCount,

    sentimentHistory,
    bySource,
    byStakeholder,
    byTopic,

    significantEvents,
    correlations,

    positiveDrivers,
    negativeDrivers,

    concerns,
    positives,

    forecast,
    alertSettings,
  };
}

// ============================================================================
// Data Fetching Functions
// ============================================================================

async function getCustomerInfo(customerId: string): Promise<{ name: string; industry?: string } | null> {
  if (!supabase) return null;

  const { data } = await supabase
    .from('customers')
    .select('name, industry')
    .eq('id', customerId)
    .single();

  return data;
}

async function getSentimentHistory(
  customerId: string,
  start: Date,
  end: Date
): Promise<SentimentDataPoint[]> {
  if (!supabase) {
    return generateMockHistory(start, end);
  }

  // Get weekly aggregated sentiment
  const { data: analyses } = await supabase
    .from('sentiment_analyses')
    .select('overall_score, confidence, source, analyzed_at')
    .eq('customer_id', customerId)
    .gte('analyzed_at', start.toISOString())
    .lte('analyzed_at', end.toISOString())
    .order('analyzed_at', { ascending: true });

  if (!analyses || analyses.length === 0) {
    return generateMockHistory(start, end);
  }

  // Group by week
  const weeklyData = new Map<string, { scores: number[]; confidence: number[]; sources: Set<string> }>();

  for (const analysis of analyses) {
    const date = new Date(analysis.analyzed_at);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weeklyData.has(weekKey)) {
      weeklyData.set(weekKey, { scores: [], confidence: [], sources: new Set() });
    }

    const week = weeklyData.get(weekKey)!;
    week.scores.push(analysis.overall_score);
    week.confidence.push(analysis.confidence || 0.7);
    week.sources.add(analysis.source);
  }

  // Get events for markers
  const { data: events } = await supabase
    .from('sentiment_events')
    .select('event_date, event_description')
    .eq('customer_id', customerId)
    .gte('event_date', start.toISOString().split('T')[0])
    .lte('event_date', end.toISOString().split('T')[0]);

  const eventsByWeek = new Map<string, string>();
  if (events) {
    for (const event of events) {
      const eventDate = new Date(event.event_date);
      const weekStart = new Date(eventDate);
      weekStart.setDate(eventDate.getDate() - eventDate.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      eventsByWeek.set(weekKey, event.event_description);
    }
  }

  return Array.from(weeklyData.entries()).map(([date, data]) => ({
    date,
    score: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
    confidence: Math.round((data.confidence.reduce((a, b) => a + b, 0) / data.confidence.length) * 100),
    sources: Array.from(data.sources) as SentimentSource[],
    eventMarker: eventsByWeek.get(date),
    dataPointCount: data.scores.length,
  }));
}

function generateMockHistory(start: Date, end: Date): SentimentDataPoint[] {
  const history: SentimentDataPoint[] = [];
  const current = new Date(start);

  while (current <= end) {
    const weekStart = new Date(current);
    weekStart.setDate(current.getDate() - current.getDay());

    const baseScore = 50 + Math.sin(history.length * 0.3) * 20;
    const noise = (Math.random() - 0.5) * 10;

    history.push({
      date: weekStart.toISOString().split('T')[0],
      score: Math.round(Math.max(-100, Math.min(100, baseScore + noise))),
      confidence: 75 + Math.round(Math.random() * 15),
      sources: ['email', 'meeting'] as SentimentSource[],
      dataPointCount: 3 + Math.floor(Math.random() * 5),
    });

    current.setDate(current.getDate() + 7);
  }

  return history;
}

function calculateCurrentSentiment(history: SentimentDataPoint[]): {
  currentSentiment: number;
  trend: SentimentTrend;
  confidence: number;
  dataPointCount: number;
} {
  if (history.length === 0) {
    return { currentSentiment: 50, trend: 'stable', confidence: 50, dataPointCount: 0 };
  }

  // Recent 3 data points weighted average
  const recent = history.slice(-3);
  const weights = [0.5, 0.3, 0.2];
  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < recent.length; i++) {
    const weight = weights[i] || 0.1;
    weightedSum += recent[recent.length - 1 - i].score * weight;
    totalWeight += weight;
  }

  const currentSentiment = Math.round(weightedSum / totalWeight);

  // Calculate trend
  const recentAvg = recent.reduce((a, b) => a + b.score, 0) / recent.length;
  const older = history.slice(-6, -3);
  const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b.score, 0) / older.length : recentAvg;
  const trend = calculateTrend(recentAvg, olderAvg);

  // Average confidence
  const confidence = Math.round(recent.reduce((a, b) => a + b.confidence, 0) / recent.length);

  // Total data points
  const dataPointCount = history.reduce((a, b) => a + (b.dataPointCount || 1), 0);

  return { currentSentiment, trend, confidence, dataPointCount };
}

async function getSentimentBySource(
  customerId: string,
  start: Date,
  end: Date
): Promise<SourceSentiment[]> {
  if (!supabase) {
    return [
      { source: 'email', score: 45, trend: 'declining', dataPoints: 89, lastAnalyzed: new Date().toISOString() },
      { source: 'meeting', score: 58, trend: 'stable', dataPoints: 24, lastAnalyzed: new Date().toISOString() },
      { source: 'support', score: 35, trend: 'improving', dataPoints: 12, lastAnalyzed: new Date().toISOString() },
      { source: 'survey', score: 70, trend: 'stable', dataPoints: 2, lastAnalyzed: new Date().toISOString() },
    ];
  }

  const sources: SentimentSource[] = ['email', 'meeting', 'support', 'survey', 'chat', 'qbr'];
  const results: SourceSentiment[] = [];

  for (const source of sources) {
    const { data: analyses } = await supabase
      .from('sentiment_analyses')
      .select('overall_score, analyzed_at')
      .eq('customer_id', customerId)
      .eq('source', source)
      .gte('analyzed_at', start.toISOString())
      .lte('analyzed_at', end.toISOString())
      .order('analyzed_at', { ascending: false });

    if (analyses && analyses.length > 0) {
      const avgScore = Math.round(analyses.reduce((a, b) => a + b.overall_score, 0) / analyses.length);
      const recentAvg = analyses.slice(0, Math.ceil(analyses.length / 2)).reduce((a, b) => a + b.overall_score, 0) / Math.ceil(analyses.length / 2);
      const olderAvg = analyses.slice(Math.ceil(analyses.length / 2)).reduce((a, b) => a + b.overall_score, 0) / Math.max(1, analyses.length - Math.ceil(analyses.length / 2));

      results.push({
        source,
        score: avgScore,
        trend: calculateTrend(recentAvg, olderAvg),
        dataPoints: analyses.length,
        lastAnalyzed: analyses[0].analyzed_at,
      });
    }
  }

  return results;
}

async function getSentimentByStakeholder(
  customerId: string,
  start: Date,
  end: Date
): Promise<StakeholderSentiment[]> {
  if (!supabase) {
    return [
      {
        stakeholderId: '1',
        stakeholderName: 'Sarah Chen',
        role: 'VP Operations',
        sentiment: 72,
        trend: 'stable',
        recentQuotes: ['The team really values the product', 'Great support this quarter'],
        lastInteraction: new Date().toISOString(),
        engagementLevel: 'high',
      },
      {
        stakeholderId: '2',
        stakeholderName: 'Mike Lee',
        role: 'Director',
        sentiment: 45,
        trend: 'declining',
        recentQuotes: ['Some frustration with recent bugs'],
        lastInteraction: new Date().toISOString(),
        engagementLevel: 'medium',
      },
    ];
  }

  const { data: stakeholderData } = await supabase
    .from('stakeholder_sentiment')
    .select(`
      stakeholder_id,
      sentiment_score,
      trend,
      engagement_level,
      last_interaction_at,
      notable_quotes,
      stakeholders!inner(name, role)
    `)
    .eq('customer_id', customerId)
    .gte('period_start', start.toISOString().split('T')[0])
    .lte('period_end', end.toISOString().split('T')[0])
    .order('last_interaction_at', { ascending: false });

  if (!stakeholderData || stakeholderData.length === 0) {
    return [];
  }

  // Deduplicate by stakeholder
  const seen = new Set<string>();
  const results: StakeholderSentiment[] = [];

  for (const row of stakeholderData) {
    if (seen.has(row.stakeholder_id)) continue;
    seen.add(row.stakeholder_id);

    const stakeholder = row.stakeholders as { name: string; role: string };

    results.push({
      stakeholderId: row.stakeholder_id,
      stakeholderName: stakeholder.name,
      role: stakeholder.role,
      sentiment: row.sentiment_score,
      trend: row.trend as SentimentTrend,
      recentQuotes: row.notable_quotes || [],
      lastInteraction: row.last_interaction_at,
      engagementLevel: row.engagement_level as 'high' | 'medium' | 'low',
    });
  }

  return results;
}

async function getSentimentByTopic(
  customerId: string,
  start: Date,
  end: Date
): Promise<TopicSentiment[]> {
  if (!supabase) {
    return [
      {
        topic: 'Product Value',
        sentiment: 75,
        frequency: 'high',
        trend: 'stable',
        recentMentions: [
          { date: new Date().toISOString(), quote: 'Saving us 20 hours/week', sentiment: 80, source: 'meeting' },
        ],
      },
      {
        topic: 'Support Experience',
        sentiment: 35,
        frequency: 'medium',
        trend: 'improving',
        recentMentions: [
          { date: new Date().toISOString(), quote: 'Better response than last time', sentiment: 40, source: 'support' },
        ],
      },
      {
        topic: 'Feature Quality',
        sentiment: 55,
        frequency: 'medium',
        trend: 'improving',
        recentMentions: [],
      },
      {
        topic: 'Price/Value',
        sentiment: 40,
        frequency: 'low',
        trend: 'declining',
        recentMentions: [],
      },
    ];
  }

  const { data: topicData } = await supabase
    .from('topic_sentiment')
    .select('topic, sentiment_score, trend, frequency, mention_count')
    .eq('customer_id', customerId)
    .gte('period_start', start.toISOString().split('T')[0])
    .lte('period_end', end.toISOString().split('T')[0])
    .order('mention_count', { ascending: false });

  if (!topicData || topicData.length === 0) {
    // Return default topics
    return [
      { topic: 'Product Value', sentiment: null, frequency: 'low', trend: 'stable', recentMentions: [] },
      { topic: 'Support Experience', sentiment: null, frequency: 'low', trend: 'stable', recentMentions: [] },
      { topic: 'Feature Quality', sentiment: null, frequency: 'low', trend: 'stable', recentMentions: [] },
      { topic: 'Price/Value', sentiment: null, frequency: 'low', trend: 'stable', recentMentions: [] },
    ];
  }

  const results: TopicSentiment[] = [];

  for (const topic of topicData) {
    // Get recent mentions
    const { data: mentions } = await supabase
      .from('topic_mentions')
      .select('quote, quote_sentiment, source, mentioned_at')
      .eq('customer_id', customerId)
      .eq('topic', topic.topic)
      .order('mentioned_at', { ascending: false })
      .limit(3);

    results.push({
      topic: topic.topic,
      sentiment: topic.sentiment_score,
      frequency: topic.frequency as 'high' | 'medium' | 'low',
      trend: topic.trend as SentimentTrend,
      recentMentions: (mentions || []).map(m => ({
        date: m.mentioned_at,
        quote: m.quote,
        sentiment: m.quote_sentiment,
        source: m.source as SentimentSource,
      })),
    });
  }

  return results;
}

async function getSignificantEvents(
  customerId: string,
  start: Date,
  end: Date
): Promise<SentimentEvent[]> {
  if (!supabase) {
    return [
      { id: '1', date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), event: 'Successful QBR', sentimentImpact: 18, type: 'positive' },
      { id: '2', date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), event: 'Major bug reported', sentimentImpact: -22, type: 'negative', recoveryDays: 21 },
      { id: '3', date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), event: 'Support escalation resolved', sentimentImpact: 15, type: 'positive' },
    ];
  }

  const { data: events } = await supabase
    .from('sentiment_events')
    .select('id, event_date, event_description, event_type, sentiment_impact, recovery_days')
    .eq('customer_id', customerId)
    .gte('event_date', start.toISOString().split('T')[0])
    .lte('event_date', end.toISOString().split('T')[0])
    .order('event_date', { ascending: false })
    .limit(10);

  return (events || []).map(e => ({
    id: e.id,
    date: e.event_date,
    event: e.event_description,
    sentimentImpact: e.sentiment_impact,
    type: e.event_type as 'positive' | 'negative',
    recoveryDays: e.recovery_days,
  }));
}

async function getSentimentCorrelations(customerId: string): Promise<SentimentCorrelation[]> {
  if (!supabase) {
    return [
      { factor: 'Health Score', correlation: 0.85, strength: 'strong', description: 'Sentiment strongly correlates with health score' },
      { factor: 'Usage Volume', correlation: 0.72, strength: 'strong', description: 'Higher usage correlates with better sentiment' },
      { factor: 'Support Tickets', correlation: -0.65, strength: 'moderate', description: 'More tickets correlates with lower sentiment' },
      { factor: 'Meeting Frequency', correlation: 0.58, strength: 'moderate', description: 'Regular meetings improve sentiment' },
      { factor: 'Days Since Contact', correlation: -0.45, strength: 'moderate', description: 'Longer silence correlates with declining sentiment' },
    ];
  }

  // Calculate correlations if not cached
  await supabase.rpc('calculate_sentiment_correlations', { p_customer_id: customerId });

  const { data: correlations } = await supabase
    .from('sentiment_correlations')
    .select('factor, correlation_coefficient, sample_size')
    .eq('customer_id', customerId);

  return (correlations || []).map(c => ({
    factor: c.factor.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
    correlation: c.correlation_coefficient,
    strength: getCorrelationStrength(c.correlation_coefficient),
    description: generateCorrelationDescription(c.factor, c.correlation_coefficient),
  }));
}

function generateCorrelationDescription(factor: string, correlation: number): string {
  const direction = correlation >= 0 ? 'positive' : 'inverse';
  const strength = getCorrelationStrength(correlation);

  const factorNormalized = factor.toLowerCase().replace(/_/g, ' ');

  if (correlation >= 0) {
    return `Sentiment has a ${strength} ${direction} relationship with ${factorNormalized}`;
  } else {
    return `Higher ${factorNormalized} correlates with lower sentiment (${strength})`;
  }
}

async function getSentimentDrivers(customerId: string): Promise<{
  positiveDrivers: SentimentDriver[];
  negativeDrivers: SentimentDriver[];
}> {
  if (!supabase) {
    return {
      positiveDrivers: [
        { driver: 'Product value delivered', contribution: 30, type: 'positive', evidence: 'Saving us 20 hours/week', frequency: 5, trend: 'stable' },
        { driver: 'Champion relationship', contribution: 25, type: 'positive', evidence: 'Sarah is our biggest advocate', frequency: 3, trend: 'stable' },
        { driver: 'New features released', contribution: 15, type: 'positive', evidence: 'Analytics module is great', frequency: 2, trend: 'improving' },
      ],
      negativeDrivers: [
        { driver: 'Support response time', contribution: -15, type: 'negative', evidence: 'Takes too long to get help', frequency: 4, trend: 'improving' },
        { driver: 'Recent bugs', contribution: -10, type: 'negative', evidence: 'Reliability concerns', frequency: 2, trend: 'declining' },
        { driver: 'Missing features', contribution: -8, type: 'negative', evidence: 'Wish we had X capability', frequency: 2, trend: 'stable' },
      ],
    };
  }

  const { data: drivers } = await supabase
    .from('sentiment_drivers')
    .select('driver_name, driver_type, contribution, evidence, occurrence_count, trend')
    .eq('customer_id', customerId)
    .eq('active', true)
    .order('contribution', { ascending: false });

  const positiveDrivers: SentimentDriver[] = [];
  const negativeDrivers: SentimentDriver[] = [];

  for (const d of drivers || []) {
    const driver: SentimentDriver = {
      driver: d.driver_name,
      contribution: d.contribution,
      type: d.driver_type as 'positive' | 'negative',
      evidence: d.evidence || '',
      frequency: d.occurrence_count,
      trend: d.trend as SentimentTrend,
    };

    if (d.driver_type === 'positive') {
      positiveDrivers.push(driver);
    } else {
      negativeDrivers.push(driver);
    }
  }

  return { positiveDrivers, negativeDrivers };
}

function generateInsights(
  bySource: SourceSentiment[],
  byStakeholder: StakeholderSentiment[],
  byTopic: TopicSentiment[],
  history: SentimentDataPoint[]
): { concerns: string[]; positives: string[] } {
  const concerns: string[] = [];
  const positives: string[] = [];

  // Source-based insights
  for (const source of bySource) {
    if (source.trend === 'declining' && source.score !== null && source.score < 30) {
      concerns.push(`${source.source.charAt(0).toUpperCase() + source.source.slice(1)} sentiment is declining (${source.score})`);
    }
    if (source.trend === 'improving' && source.score !== null && source.score > 50) {
      positives.push(`${source.source.charAt(0).toUpperCase() + source.source.slice(1)} sentiment improving (${source.score})`);
    }
  }

  // Stakeholder-based insights
  for (const stakeholder of byStakeholder) {
    if (stakeholder.sentiment < 30 && stakeholder.trend === 'declining') {
      concerns.push(`${stakeholder.stakeholderName} (${stakeholder.role}) sentiment declining`);
    }
    if (stakeholder.sentiment > 70) {
      positives.push(`${stakeholder.stakeholderName} is a strong advocate (${stakeholder.sentiment})`);
    }
  }

  // Topic-based insights
  for (const topic of byTopic) {
    if (topic.sentiment !== null && topic.sentiment < 30) {
      concerns.push(`${topic.topic} sentiment needs attention (${topic.sentiment})`);
    }
    if (topic.sentiment !== null && topic.sentiment > 70) {
      positives.push(`Strong ${topic.topic.toLowerCase()} sentiment (${topic.sentiment})`);
    }
  }

  // Trend-based insights
  if (history.length >= 4) {
    const recent = history.slice(-2);
    const older = history.slice(-4, -2);
    const recentAvg = recent.reduce((a, b) => a + b.score, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b.score, 0) / older.length;

    if (recentAvg < olderAvg - 15) {
      concerns.push('Overall sentiment trend is declining significantly');
    }
    if (recentAvg > olderAvg + 15) {
      positives.push('Overall sentiment trend is improving significantly');
    }
  }

  return { concerns: concerns.slice(0, 5), positives: positives.slice(0, 5) };
}

async function getSentimentForecasts(
  customerId: string,
  currentSentiment: number,
  trend: SentimentTrend
): Promise<SentimentForecast[]> {
  if (!supabase) {
    const trendAdjustment = trend === 'improving' ? 3 : trend === 'declining' ? -5 : 0;

    return [
      {
        timeframe: '30 days',
        predictedSentiment: Math.max(-100, Math.min(100, currentSentiment + trendAdjustment)),
        confidence: 75,
        riskLevel: currentSentiment + trendAdjustment < 30 ? 'high' : currentSentiment + trendAdjustment < 50 ? 'medium' : 'low',
      },
      {
        timeframe: '60 days',
        predictedSentiment: Math.max(-100, Math.min(100, currentSentiment + trendAdjustment * 2)),
        confidence: 65,
        riskLevel: currentSentiment + trendAdjustment * 2 < 30 ? 'high' : currentSentiment + trendAdjustment * 2 < 50 ? 'medium' : 'low',
      },
      {
        timeframe: '90 days',
        predictedSentiment: Math.max(-100, Math.min(100, currentSentiment + trendAdjustment * 3)),
        confidence: 55,
        riskLevel: currentSentiment + trendAdjustment * 3 < 30 ? 'high' : currentSentiment + trendAdjustment * 3 < 50 ? 'medium' : 'low',
      },
    ];
  }

  const { data: forecasts } = await supabase
    .from('sentiment_forecasts')
    .select('timeframe_days, predicted_sentiment, confidence, risk_level')
    .eq('customer_id', customerId)
    .order('timeframe_days', { ascending: true });

  if (forecasts && forecasts.length > 0) {
    return forecasts.map(f => ({
      timeframe: `${f.timeframe_days} days`,
      predictedSentiment: f.predicted_sentiment,
      confidence: f.confidence,
      riskLevel: f.risk_level as 'low' | 'medium' | 'high',
    }));
  }

  // Generate forecasts based on trend
  const trendAdjustment = trend === 'improving' ? 3 : trend === 'declining' ? -5 : 0;

  return [
    {
      timeframe: '30 days',
      predictedSentiment: Math.max(-100, Math.min(100, currentSentiment + trendAdjustment)),
      confidence: 75,
      riskLevel: currentSentiment + trendAdjustment < 30 ? 'high' : currentSentiment + trendAdjustment < 50 ? 'medium' : 'low',
    },
    {
      timeframe: '60 days',
      predictedSentiment: Math.max(-100, Math.min(100, currentSentiment + trendAdjustment * 2)),
      confidence: 65,
      riskLevel: currentSentiment + trendAdjustment * 2 < 30 ? 'high' : currentSentiment + trendAdjustment * 2 < 50 ? 'medium' : 'low',
    },
    {
      timeframe: '90 days',
      predictedSentiment: Math.max(-100, Math.min(100, currentSentiment + trendAdjustment * 3)),
      confidence: 55,
      riskLevel: currentSentiment + trendAdjustment * 3 < 30 ? 'high' : currentSentiment + trendAdjustment * 3 < 50 ? 'medium' : 'low',
    },
  ];
}

async function getAlertSettings(customerId: string): Promise<SentimentAlertSetting[]> {
  if (!supabase) {
    return [
      { id: '1', condition: 'Score drops below 25', alertType: 'email', status: 'active', thresholdValue: 25 },
      { id: '2', condition: 'Score drops > 20 in 30 days', alertType: 'slack', status: 'active', thresholdValue: 20 },
      { id: '3', condition: 'Stakeholder becomes negative', alertType: 'in_app', status: 'active' },
    ];
  }

  const { data: settings } = await supabase
    .from('sentiment_alert_settings')
    .select('id, condition_type, condition_value, alert_channels, status, last_triggered_at')
    .eq('customer_id', customerId);

  return (settings || []).map(s => ({
    id: s.id,
    condition: formatAlertCondition(s.condition_type, s.condition_value),
    alertType: (s.alert_channels?.[0] || 'in_app') as 'email' | 'slack' | 'in_app',
    status: s.status as 'active' | 'inactive' | 'triggered',
    triggeredAt: s.last_triggered_at,
    thresholdValue: s.condition_value,
  }));
}

function formatAlertCondition(type: string, value: number | null): string {
  switch (type) {
    case 'score_below':
      return `Score drops below ${value}`;
    case 'drop_exceeds':
      return `Score drops > ${value} in 30 days`;
    case 'stakeholder_negative':
      return 'Stakeholder becomes negative';
    default:
      return type;
  }
}

// ============================================================================
// Update Functions
// ============================================================================

/**
 * Update alert settings for a customer
 */
export async function updateAlertSetting(
  customerId: string,
  settingId: string,
  updates: { status?: 'active' | 'inactive'; thresholdValue?: number }
): Promise<boolean> {
  if (!supabase) return false;

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.status) updateData.status = updates.status;
  if (updates.thresholdValue !== undefined) updateData.condition_value = updates.thresholdValue;

  const { error } = await supabase
    .from('sentiment_alert_settings')
    .update(updateData)
    .eq('id', settingId)
    .eq('customer_id', customerId);

  return !error;
}

/**
 * Add a sentiment event manually
 */
export async function addSentimentEvent(
  customerId: string,
  event: {
    date: string;
    description: string;
    type: 'positive' | 'negative';
    impact: number;
  }
): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('sentiment_events')
    .insert({
      customer_id: customerId,
      event_date: event.date,
      event_description: event.description,
      event_type: event.type,
      sentiment_impact: event.impact,
      auto_detected: false,
    })
    .select('id')
    .single();

  return error ? null : data?.id;
}

/**
 * Record a sentiment driver
 */
export async function recordSentimentDriver(
  customerId: string,
  driver: {
    name: string;
    type: 'positive' | 'negative';
    contribution: number;
    evidence?: string;
  }
): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('sentiment_drivers')
    .upsert({
      customer_id: customerId,
      driver_name: driver.name,
      driver_type: driver.type,
      contribution: driver.contribution,
      evidence: driver.evidence,
      last_detected_at: new Date().toISOString(),
    }, {
      onConflict: 'customer_id,driver_name,driver_type',
    });

  return !error;
}

// ============================================================================
// Exports
// ============================================================================

export const sentimentTracker = {
  getSentimentAnalysis,
  updateAlertSetting,
  addSentimentEvent,
  recordSentimentDriver,
};

export default sentimentTracker;
