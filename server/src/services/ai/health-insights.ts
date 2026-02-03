/**
 * AI-Powered Health Insights Service
 *
 * Uses Claude to analyze customer health data and generate actionable insights,
 * predictions, and intervention recommendations.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { v4 as uuidv4 } from 'uuid';

// Initialize clients
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

let anthropic: Anthropic | null = null;
if (config.anthropicApiKey) {
  anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
}

// Types
export type InsightSeverity = 'info' | 'warning' | 'critical' | 'positive';
export type InsightCategory = 'usage' | 'engagement' | 'support' | 'business' | 'stakeholder' | 'renewal' | 'opportunity';
export type TrendDirection = 'improving' | 'stable' | 'declining' | 'volatile';

export interface HealthInsight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  confidence: number;
  dataPoints: string[];
  timeframe?: string;
}

export interface HealthPredictionPoint {
  daysAhead: number;
  predictedScore: number;
  confidenceInterval: { low: number; high: number };
  keyFactors: string[];
}

export interface InterventionRecommendation {
  intervention: string;
  description: string;
  expectedHealthImpact: number;
  confidence: number;
  timeToImpactDays: number;
  effort: 'low' | 'medium' | 'high';
  priority: number;
  category: InsightCategory;
}

export interface HealthScoreBreakdown {
  usage: number;
  engagement: number;
  risk: number;
  business: number;
  overall: number;
}

export interface HealthInsightsResponse {
  customerId: string;
  customerName: string;
  generatedAt: string;
  currentHealth: number;
  previousHealth: number | null;
  trend: TrendDirection;
  scoreBreakdown: HealthScoreBreakdown;
  insights: HealthInsight[];
  predictions: HealthPredictionPoint[];
  interventions: InterventionRecommendation[];
  executiveSummary: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  arrAtRisk: number;
  daysToRenewal: number | null;
  confidence: number;
  dataQuality: 'poor' | 'fair' | 'good' | 'excellent';
  lastDataUpdate: string | null;
}

export interface PortfolioHealthSummary {
  totalCustomers: number;
  avgHealth: number;
  healthDistribution: {
    critical: number;
    atRisk: number;
    healthy: number;
    excellent: number;
  };
  trendingDown: number;
  trendingUp: number;
  totalArrAtRisk: number;
  topRisks: Array<{
    customerId: string;
    customerName: string;
    health: number;
    arr: number;
    daysToRenewal: number | null;
    topInsight: string;
  }>;
  recommendedFocus: string[];
}

/**
 * Generate comprehensive health insights for a customer using Claude
 */
export async function generateHealthInsights(
  customerId: string,
  options: {
    includeHistory?: boolean;
    includePredictions?: boolean;
    predictionHorizons?: number[];
  } = {}
): Promise<HealthInsightsResponse> {
  const {
    includeHistory = true,
    includePredictions = true,
    predictionHorizons = [30, 60, 90],
  } = options;

  // Gather all customer data
  const customerData = await gatherCustomerData(customerId);

  // Calculate score breakdown
  const scoreBreakdown = await calculateScoreBreakdown(customerId);

  // Determine trend
  const trend = determineTrend(customerData.healthHistory);

  // Calculate days to renewal
  let daysToRenewal: number | null = null;
  if (customerData.renewalDate) {
    daysToRenewal = Math.ceil(
      (new Date(customerData.renewalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );
  }

  // Calculate ARR at risk
  const arrAtRisk = scoreBreakdown.overall < 60 ? customerData.arr : 0;

  // Determine risk level
  const riskLevel = determineRiskLevel(scoreBreakdown.overall, daysToRenewal);

  // Determine data quality
  const dataQuality = determineDataQuality(customerData);

  // Generate AI insights using Claude
  const aiAnalysis = await generateAIInsights(customerData, scoreBreakdown, trend);

  // Generate predictions if requested
  let predictions: HealthPredictionPoint[] = [];
  if (includePredictions) {
    predictions = generatePredictions(customerData, scoreBreakdown, predictionHorizons);
  }

  return {
    customerId,
    customerName: customerData.name,
    generatedAt: new Date().toISOString(),
    currentHealth: scoreBreakdown.overall,
    previousHealth: customerData.previousHealth,
    trend,
    scoreBreakdown,
    insights: aiAnalysis.insights,
    predictions,
    interventions: aiAnalysis.interventions,
    executiveSummary: aiAnalysis.executiveSummary,
    riskLevel,
    arrAtRisk,
    daysToRenewal,
    confidence: aiAnalysis.confidence,
    dataQuality,
    lastDataUpdate: customerData.lastDataUpdate,
  };
}

/**
 * Gather all relevant customer data for analysis
 */
async function gatherCustomerData(customerId: string): Promise<{
  name: string;
  arr: number;
  industry: string | null;
  stage: string;
  renewalDate: string | null;
  healthScore: number;
  previousHealth: number | null;
  healthHistory: Array<{ date: string; score: number }>;
  usageMetrics: {
    dau: number;
    wau: number;
    mau: number;
    totalEvents: number;
    uniqueFeatures: number;
    trend: number;
  } | null;
  recentActivity: Array<{ type: string; date: string; description: string }>;
  stakeholderCount: number;
  hasChampion: boolean;
  lastDataUpdate: string | null;
}> {
  // Default values
  let data = {
    name: 'Unknown Customer',
    arr: 0,
    industry: null as string | null,
    stage: 'active',
    renewalDate: null as string | null,
    healthScore: 70,
    previousHealth: null as number | null,
    healthHistory: [] as Array<{ date: string; score: number }>,
    usageMetrics: null as {
      dau: number;
      wau: number;
      mau: number;
      totalEvents: number;
      uniqueFeatures: number;
      trend: number;
    } | null,
    recentActivity: [] as Array<{ type: string; date: string; description: string }>,
    stakeholderCount: 0,
    hasChampion: false,
    lastDataUpdate: null as string | null,
  };

  if (!supabase) {
    // Return mock data
    return {
      ...data,
      name: 'Demo Customer',
      arr: 75000,
      healthScore: 68,
      previousHealth: 72,
      healthHistory: generateMockHealthHistory(),
      usageMetrics: {
        dau: 45,
        wau: 120,
        mau: 180,
        totalEvents: 15000,
        uniqueFeatures: 8,
        trend: -0.05,
      },
    };
  }

  try {
    // Get customer info
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (customer) {
      data.name = customer.name;
      data.arr = customer.arr || 0;
      data.industry = customer.industry;
      data.stage = customer.stage || 'active';
      data.renewalDate = customer.renewal_date;
      data.healthScore = customer.health_score || 70;
    }

    // Get health history
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const { data: history } = await supabase
      .from('health_score_history')
      .select('calculated_at, score')
      .eq('customer_id', customerId)
      .gte('calculated_at', ninetyDaysAgo.toISOString())
      .order('calculated_at', { ascending: true });

    if (history && history.length > 0) {
      data.healthHistory = history.map(h => ({
        date: h.calculated_at.split('T')[0],
        score: h.score,
      }));
      if (history.length >= 2) {
        data.previousHealth = history[history.length - 2]?.score || null;
      }
    }

    // Get usage metrics
    const { data: metrics } = await supabase
      .from('usage_metrics')
      .select('*')
      .eq('customer_id', customerId)
      .order('calculated_at', { ascending: false })
      .limit(2);

    if (metrics && metrics.length > 0) {
      const current = metrics[0];
      const previous = metrics[1];
      const trend = previous
        ? (current.total_events - previous.total_events) / Math.max(previous.total_events, 1)
        : 0;

      data.usageMetrics = {
        dau: current.dau || 0,
        wau: current.wau || 0,
        mau: current.mau || 0,
        totalEvents: current.total_events || 0,
        uniqueFeatures: current.unique_features_used || 0,
        trend,
      };
      data.lastDataUpdate = current.calculated_at;
    }

    // Get recent activity
    const { data: activities } = await supabase
      .from('agent_activity_log')
      .select('action_type, started_at, result_data')
      .eq('customer_id', customerId)
      .order('started_at', { ascending: false })
      .limit(10);

    if (activities) {
      data.recentActivity = activities.map(a => ({
        type: a.action_type,
        date: a.started_at,
        description: a.result_data?.summary || a.action_type,
      }));
    }

    // Get stakeholder info from contracts
    const { data: contract } = await supabase
      .from('contracts')
      .select('extracted_data')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (contract?.extracted_data) {
      const stakeholders = (contract.extracted_data as any).stakeholders || [];
      data.stakeholderCount = stakeholders.length;
      data.hasChampion = stakeholders.some((s: any) =>
        s.role?.toLowerCase().includes('champion') ||
        s.role?.toLowerCase().includes('admin') ||
        s.approval_required
      );
    }
  } catch (error) {
    console.error('Error gathering customer data:', error);
  }

  return data;
}

/**
 * Calculate detailed score breakdown
 */
async function calculateScoreBreakdown(customerId: string): Promise<HealthScoreBreakdown> {
  // Weights
  const weights = {
    usage: 0.40,
    engagement: 0.30,
    risk: 0.20,
    business: 0.10,
  };

  // Default scores
  let usage = 65;
  let engagement = 60;
  let risk = 75;
  let business = 70;

  if (supabase) {
    try {
      // Get latest usage metrics
      const { data: metrics } = await supabase
        .from('usage_metrics')
        .select('*')
        .eq('customer_id', customerId)
        .order('calculated_at', { ascending: false })
        .limit(2);

      if (metrics && metrics.length > 0) {
        const current = metrics[0];
        const previous = metrics[1];

        // Calculate usage score
        const dauMauRatio = current.mau > 0 ? current.dau / current.mau : 0;
        usage = Math.min(100, Math.round(dauMauRatio * 400));

        if (previous) {
          const trend = (current.total_events - previous.total_events) / Math.max(previous.total_events, 1);
          if (trend > 0.1) usage = Math.min(100, usage + 10);
          else if (trend < -0.2) usage = Math.max(0, usage - 15);
        }

        // Feature diversity bonus
        if (current.unique_features_used >= 10) usage = Math.min(100, usage + 5);
        else if (current.unique_features_used <= 3) usage = Math.max(0, usage - 5);
      }

      // Calculate engagement score
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const { data: events } = await supabase
        .from('usage_events')
        .select('timestamp')
        .eq('customer_id', customerId)
        .gte('timestamp', thirtyDaysAgo.toISOString());

      if (events && events.length > 0) {
        const activeDays = new Set(events.map(e => e.timestamp.split('T')[0])).size;
        engagement = Math.round((activeDays / 30) * 100);
      } else {
        engagement = 20; // No recent engagement
      }

      // Calculate risk score (inverse - lower risk = higher score)
      risk = 75; // Base
      if (metrics && metrics.length >= 2) {
        const decline = (metrics[1].total_events - metrics[0].total_events) / Math.max(metrics[1].total_events, 1);
        if (decline > 0.3) risk -= 30;
        else if (decline > 0.15) risk -= 15;
      }

      // Check for inactivity
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const { count } = await supabase
        .from('usage_events')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .gte('timestamp', lastWeek.toISOString());

      if (count === 0) risk -= 20;

      // Calculate business score
      const { data: customer } = await supabase
        .from('customers')
        .select('arr, renewal_date, stage')
        .eq('id', customerId)
        .single();

      if (customer) {
        business = 70;
        if (customer.arr >= 100000) business += 10;
        else if (customer.arr >= 50000) business += 5;
        else if (customer.arr < 10000) business -= 5;

        if (customer.renewal_date) {
          const daysToRenewal = Math.floor(
            (new Date(customer.renewal_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
          );
          if (daysToRenewal <= 30) business += 5;
          else if (daysToRenewal > 180) business += 15;
        }

        if (customer.stage === 'at_risk') business -= 15;
        else if (customer.stage === 'active') business += 5;
      }
    } catch (error) {
      console.error('Error calculating score breakdown:', error);
    }
  }

  // Ensure all scores are within bounds
  usage = Math.max(0, Math.min(100, usage));
  engagement = Math.max(0, Math.min(100, engagement));
  risk = Math.max(0, Math.min(100, risk));
  business = Math.max(0, Math.min(100, business));

  const overall = Math.round(
    usage * weights.usage +
    engagement * weights.engagement +
    risk * weights.risk +
    business * weights.business
  );

  return {
    usage,
    engagement,
    risk,
    business,
    overall: Math.max(0, Math.min(100, overall)),
  };
}

/**
 * Determine health trend from history
 */
function determineTrend(history: Array<{ date: string; score: number }>): TrendDirection {
  if (history.length < 3) return 'stable';

  const recentScores = history.slice(-5);
  const avgRecent = recentScores.reduce((sum, h) => sum + h.score, 0) / recentScores.length;

  const olderScores = history.slice(0, Math.max(1, history.length - 5));
  const avgOlder = olderScores.reduce((sum, h) => sum + h.score, 0) / olderScores.length;

  const diff = avgRecent - avgOlder;

  // Check for volatility
  const variance = recentScores.reduce((sum, h) => sum + Math.pow(h.score - avgRecent, 2), 0) / recentScores.length;
  if (Math.sqrt(variance) > 10) return 'volatile';

  if (diff > 5) return 'improving';
  if (diff < -5) return 'declining';
  return 'stable';
}

/**
 * Determine overall risk level
 */
function determineRiskLevel(
  healthScore: number,
  daysToRenewal: number | null
): 'low' | 'medium' | 'high' | 'critical' {
  // Critical: Low health + imminent renewal
  if (healthScore < 40 || (healthScore < 50 && daysToRenewal !== null && daysToRenewal <= 30)) {
    return 'critical';
  }

  // High: Poor health or approaching renewal with issues
  if (healthScore < 55 || (healthScore < 65 && daysToRenewal !== null && daysToRenewal <= 60)) {
    return 'high';
  }

  // Medium: Below average health
  if (healthScore < 70) {
    return 'medium';
  }

  return 'low';
}

/**
 * Determine data quality based on available information
 */
function determineDataQuality(customerData: any): 'poor' | 'fair' | 'good' | 'excellent' {
  let score = 0;

  if (customerData.healthHistory.length >= 7) score += 25;
  else if (customerData.healthHistory.length >= 3) score += 15;

  if (customerData.usageMetrics) score += 25;

  if (customerData.recentActivity.length >= 5) score += 25;
  else if (customerData.recentActivity.length >= 1) score += 15;

  if (customerData.stakeholderCount >= 1) score += 15;
  if (customerData.hasChampion) score += 10;

  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

/**
 * Generate AI-powered insights using Claude
 */
async function generateAIInsights(
  customerData: any,
  scoreBreakdown: HealthScoreBreakdown,
  trend: TrendDirection
): Promise<{
  insights: HealthInsight[];
  interventions: InterventionRecommendation[];
  executiveSummary: string;
  confidence: number;
}> {
  // If no Anthropic client, return rule-based insights
  if (!anthropic) {
    return generateRuleBasedInsights(customerData, scoreBreakdown, trend);
  }

  const prompt = buildAnalysisPrompt(customerData, scoreBreakdown, trend);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return parseAIResponse(content.text, customerData, scoreBreakdown);
    }
  } catch (error) {
    console.error('Error generating AI insights:', error);
  }

  // Fallback to rule-based
  return generateRuleBasedInsights(customerData, scoreBreakdown, trend);
}

/**
 * Build prompt for Claude analysis
 */
function buildAnalysisPrompt(
  customerData: any,
  scoreBreakdown: HealthScoreBreakdown,
  trend: TrendDirection
): string {
  return `You are a Customer Success analyst. Analyze this customer's health data and provide actionable insights.

CUSTOMER DATA:
- Name: ${customerData.name}
- ARR: $${customerData.arr.toLocaleString()}
- Industry: ${customerData.industry || 'Unknown'}
- Status: ${customerData.stage}
- Days to Renewal: ${customerData.renewalDate ? Math.ceil((new Date(customerData.renewalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : 'Unknown'}

HEALTH SCORES:
- Overall: ${scoreBreakdown.overall}/100
- Usage: ${scoreBreakdown.usage}/100
- Engagement: ${scoreBreakdown.engagement}/100
- Risk: ${scoreBreakdown.risk}/100 (higher = lower risk)
- Business: ${scoreBreakdown.business}/100
- Trend: ${trend}

USAGE METRICS:
${customerData.usageMetrics ? `
- DAU: ${customerData.usageMetrics.dau}
- WAU: ${customerData.usageMetrics.wau}
- MAU: ${customerData.usageMetrics.mau}
- Total Events: ${customerData.usageMetrics.totalEvents}
- Features Used: ${customerData.usageMetrics.uniqueFeatures}
- Trend: ${(customerData.usageMetrics.trend * 100).toFixed(1)}%
` : 'No usage data available'}

STAKEHOLDERS:
- Count: ${customerData.stakeholderCount}
- Has Champion: ${customerData.hasChampion ? 'Yes' : 'No'}

RECENT ACTIVITY:
${customerData.recentActivity.slice(0, 5).map((a: any) => `- ${a.type}: ${a.description} (${a.date})`).join('\n') || 'No recent activity'}

Provide your analysis in this exact JSON format:
{
  "executiveSummary": "2-3 sentence summary of the customer's health status and key concerns",
  "insights": [
    {
      "category": "usage|engagement|support|business|stakeholder|renewal|opportunity",
      "severity": "info|warning|critical|positive",
      "title": "Brief title",
      "description": "Detailed explanation",
      "impact": "Business impact if not addressed",
      "recommendation": "Specific action to take",
      "dataPoints": ["Supporting data point 1", "Supporting data point 2"]
    }
  ],
  "interventions": [
    {
      "intervention": "Action name",
      "description": "What to do and why",
      "expectedHealthImpact": 5,
      "timeToImpactDays": 14,
      "effort": "low|medium|high",
      "priority": 1,
      "category": "usage|engagement|support|business|stakeholder|renewal|opportunity"
    }
  ],
  "confidence": 75
}

Generate 3-5 insights and 2-4 interventions prioritized by impact. Be specific and actionable.`;
}

/**
 * Parse Claude's response
 */
function parseAIResponse(
  responseText: string,
  customerData: any,
  scoreBreakdown: HealthScoreBreakdown
): {
  insights: HealthInsight[];
  interventions: InterventionRecommendation[];
  executiveSummary: string;
  confidence: number;
} {
  try {
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      executiveSummary: parsed.executiveSummary || 'Unable to generate summary.',
      insights: (parsed.insights || []).map((i: any, idx: number) => ({
        id: uuidv4(),
        category: i.category || 'business',
        severity: i.severity || 'info',
        title: i.title || 'Insight',
        description: i.description || '',
        impact: i.impact || '',
        recommendation: i.recommendation || '',
        confidence: parsed.confidence || 70,
        dataPoints: i.dataPoints || [],
      })),
      interventions: (parsed.interventions || []).map((i: any) => ({
        intervention: i.intervention || 'Action',
        description: i.description || '',
        expectedHealthImpact: i.expectedHealthImpact || 5,
        confidence: parsed.confidence || 70,
        timeToImpactDays: i.timeToImpactDays || 14,
        effort: i.effort || 'medium',
        priority: i.priority || 3,
        category: i.category || 'engagement',
      })),
      confidence: parsed.confidence || 70,
    };
  } catch (error) {
    console.error('Error parsing AI response:', error);
    return generateRuleBasedInsights(customerData, scoreBreakdown, 'stable');
  }
}

/**
 * Generate rule-based insights as fallback
 */
function generateRuleBasedInsights(
  customerData: any,
  scoreBreakdown: HealthScoreBreakdown,
  trend: TrendDirection
): {
  insights: HealthInsight[];
  interventions: InterventionRecommendation[];
  executiveSummary: string;
  confidence: number;
} {
  const insights: HealthInsight[] = [];
  const interventions: InterventionRecommendation[] = [];

  // Usage insights
  if (scoreBreakdown.usage < 40) {
    insights.push({
      id: uuidv4(),
      category: 'usage',
      severity: 'critical',
      title: 'Critical Usage Decline',
      description: `Product usage has dropped to critically low levels (${scoreBreakdown.usage}/100).`,
      impact: 'High churn risk if not addressed immediately.',
      recommendation: 'Schedule urgent health check call to identify blockers.',
      confidence: 85,
      dataPoints: [`Usage score: ${scoreBreakdown.usage}/100`],
    });

    interventions.push({
      intervention: 'Emergency Health Check',
      description: 'Schedule an urgent call to understand why usage has declined and identify blockers.',
      expectedHealthImpact: 15,
      confidence: 75,
      timeToImpactDays: 7,
      effort: 'low',
      priority: 1,
      category: 'usage',
    });
  } else if (scoreBreakdown.usage < 60) {
    insights.push({
      id: uuidv4(),
      category: 'usage',
      severity: 'warning',
      title: 'Below Average Usage',
      description: `Product usage is below expectations (${scoreBreakdown.usage}/100).`,
      impact: 'Customer may not be realizing full value from the product.',
      recommendation: 'Offer targeted training on underutilized features.',
      confidence: 80,
      dataPoints: [`Usage score: ${scoreBreakdown.usage}/100`],
    });
  }

  // Engagement insights
  if (scoreBreakdown.engagement < 30) {
    insights.push({
      id: uuidv4(),
      category: 'engagement',
      severity: 'critical',
      title: 'Severely Low Engagement',
      description: `Customer engagement is critically low (${scoreBreakdown.engagement}/100).`,
      impact: 'Customer may be silently churning.',
      recommendation: 'Executive outreach required immediately.',
      confidence: 90,
      dataPoints: [`Engagement score: ${scoreBreakdown.engagement}/100`],
    });

    interventions.push({
      intervention: 'Executive Escalation',
      description: 'Arrange executive-to-executive outreach to re-engage the customer.',
      expectedHealthImpact: 20,
      confidence: 70,
      timeToImpactDays: 14,
      effort: 'high',
      priority: 1,
      category: 'engagement',
    });
  } else if (scoreBreakdown.engagement < 50) {
    insights.push({
      id: uuidv4(),
      category: 'engagement',
      severity: 'warning',
      title: 'Declining Engagement',
      description: `Customer engagement is trending down (${scoreBreakdown.engagement}/100).`,
      impact: 'Reduced engagement often precedes churn.',
      recommendation: 'Increase touchpoint frequency and schedule a check-in.',
      confidence: 80,
      dataPoints: [`Engagement score: ${scoreBreakdown.engagement}/100`],
    });

    interventions.push({
      intervention: 'Proactive Check-in',
      description: 'Schedule a value-focused call to understand their current priorities and challenges.',
      expectedHealthImpact: 10,
      confidence: 75,
      timeToImpactDays: 7,
      effort: 'low',
      priority: 2,
      category: 'engagement',
    });
  }

  // Stakeholder insights
  if (!customerData.hasChampion) {
    insights.push({
      id: uuidv4(),
      category: 'stakeholder',
      severity: 'warning',
      title: 'No Identified Champion',
      description: 'No internal champion has been identified for this account.',
      impact: 'Lack of internal advocacy increases churn risk.',
      recommendation: 'Identify and cultivate a champion within the organization.',
      confidence: 75,
      dataPoints: [`Stakeholder count: ${customerData.stakeholderCount}`],
    });

    interventions.push({
      intervention: 'Champion Development',
      description: 'Identify power users who can become internal advocates and offer them special training or certification.',
      expectedHealthImpact: 12,
      confidence: 70,
      timeToImpactDays: 30,
      effort: 'medium',
      priority: 3,
      category: 'stakeholder',
    });
  }

  // Renewal insights
  if (customerData.renewalDate) {
    const daysToRenewal = Math.ceil(
      (new Date(customerData.renewalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );

    if (daysToRenewal <= 30 && scoreBreakdown.overall < 70) {
      insights.push({
        id: uuidv4(),
        category: 'renewal',
        severity: 'critical',
        title: 'Renewal at Risk',
        description: `Renewal in ${daysToRenewal} days with below-average health score.`,
        impact: `$${customerData.arr.toLocaleString()} ARR at immediate risk.`,
        recommendation: 'Initiate urgent renewal discussion and prepare value summary.',
        confidence: 90,
        dataPoints: [
          `Days to renewal: ${daysToRenewal}`,
          `Health score: ${scoreBreakdown.overall}/100`,
          `ARR: $${customerData.arr.toLocaleString()}`,
        ],
      });

      interventions.push({
        intervention: 'Urgent Renewal Meeting',
        description: 'Schedule renewal discussion with key stakeholders. Prepare ROI summary and success stories.',
        expectedHealthImpact: 15,
        confidence: 80,
        timeToImpactDays: 7,
        effort: 'high',
        priority: 1,
        category: 'renewal',
      });
    } else if (daysToRenewal <= 60) {
      insights.push({
        id: uuidv4(),
        category: 'renewal',
        severity: 'info',
        title: 'Renewal Approaching',
        description: `Renewal in ${daysToRenewal} days. Now is a good time to prepare.`,
        impact: 'Early preparation increases renewal success rate.',
        recommendation: 'Schedule QBR and begin renewal preparation.',
        confidence: 85,
        dataPoints: [`Days to renewal: ${daysToRenewal}`],
      });
    }
  }

  // Positive insights for healthy customers
  if (scoreBreakdown.overall >= 80) {
    insights.push({
      id: uuidv4(),
      category: 'opportunity',
      severity: 'positive',
      title: 'Strong Customer Health',
      description: `Customer health is excellent (${scoreBreakdown.overall}/100).`,
      impact: 'High likelihood of renewal and expansion.',
      recommendation: 'Explore expansion opportunities and request referrals.',
      confidence: 85,
      dataPoints: [`Health score: ${scoreBreakdown.overall}/100`],
    });

    interventions.push({
      intervention: 'Expansion Discovery',
      description: 'Schedule call to discuss additional use cases and teams that could benefit from the product.',
      expectedHealthImpact: 5,
      confidence: 80,
      timeToImpactDays: 21,
      effort: 'medium',
      priority: 3,
      category: 'opportunity',
    });
  }

  // Trend-based insights
  if (trend === 'declining') {
    insights.push({
      id: uuidv4(),
      category: 'business',
      severity: 'warning',
      title: 'Declining Health Trend',
      description: 'Customer health has been trending downward over recent weeks.',
      impact: 'Continued decline will lead to increased churn risk.',
      recommendation: 'Investigate root causes and implement corrective measures.',
      confidence: 80,
      dataPoints: [`Trend: ${trend}`],
    });
  } else if (trend === 'improving') {
    insights.push({
      id: uuidv4(),
      category: 'business',
      severity: 'positive',
      title: 'Improving Health Trend',
      description: 'Customer health has been trending upward over recent weeks.',
      impact: 'Positive momentum should be maintained and accelerated.',
      recommendation: 'Continue current engagement strategy and look for expansion.',
      confidence: 80,
      dataPoints: [`Trend: ${trend}`],
    });
  }

  // Generate executive summary
  let executiveSummary = '';
  if (scoreBreakdown.overall < 50) {
    executiveSummary = `${customerData.name} is in critical condition with a health score of ${scoreBreakdown.overall}/100. Immediate intervention is required to prevent churn. Key areas of concern: `;
    const concerns = [];
    if (scoreBreakdown.usage < 50) concerns.push('low product usage');
    if (scoreBreakdown.engagement < 50) concerns.push('declining engagement');
    if (scoreBreakdown.risk < 50) concerns.push('multiple risk signals');
    executiveSummary += concerns.join(', ') + '.';
  } else if (scoreBreakdown.overall < 70) {
    executiveSummary = `${customerData.name} shows moderate health (${scoreBreakdown.overall}/100) with some areas requiring attention. Proactive outreach is recommended to prevent further decline.`;
  } else {
    executiveSummary = `${customerData.name} is a healthy account (${scoreBreakdown.overall}/100) with ${trend === 'improving' ? 'positive momentum' : 'stable performance'}. Focus on expansion and reference opportunities.`;
  }

  return {
    insights: insights.slice(0, 5),
    interventions: interventions.sort((a, b) => a.priority - b.priority).slice(0, 4),
    executiveSummary,
    confidence: 75,
  };
}

/**
 * Generate health predictions
 */
function generatePredictions(
  customerData: any,
  scoreBreakdown: HealthScoreBreakdown,
  horizons: number[]
): HealthPredictionPoint[] {
  const predictions: HealthPredictionPoint[] = [];
  const currentScore = scoreBreakdown.overall;

  // Calculate velocity from history
  let velocity = 0;
  if (customerData.healthHistory.length >= 2) {
    const recent = customerData.healthHistory.slice(-7);
    if (recent.length >= 2) {
      const first = recent[0].score;
      const last = recent[recent.length - 1].score;
      const days = recent.length;
      velocity = (last - first) / days;
    }
  }

  // Apply mean reversion factor
  const meanHealth = 65;
  const reversionRate = 0.02;

  for (const days of horizons) {
    // Project score with velocity and mean reversion
    let projected = currentScore + (velocity * days);
    projected += (meanHealth - projected) * reversionRate * days;

    // Bound to 0-100
    projected = Math.max(0, Math.min(100, Math.round(projected)));

    // Calculate confidence interval (wider for further predictions)
    const uncertainty = Math.min(25, 5 + (days / 10));
    const confidenceInterval = {
      low: Math.max(0, projected - uncertainty),
      high: Math.min(100, projected + uncertainty),
    };

    // Identify key factors
    const keyFactors: string[] = [];
    if (scoreBreakdown.usage < 60) keyFactors.push('Low usage may continue to impact health');
    if (scoreBreakdown.engagement < 50) keyFactors.push('Engagement decline affecting score');
    if (customerData.renewalDate) {
      const daysToRenewal = Math.ceil(
        (new Date(customerData.renewalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );
      if (daysToRenewal <= days) keyFactors.push('Renewal within this period');
    }
    if (velocity < -0.1) keyFactors.push('Continuing downward trend');
    if (velocity > 0.1) keyFactors.push('Positive momentum maintained');

    predictions.push({
      daysAhead: days,
      predictedScore: projected,
      confidenceInterval,
      keyFactors: keyFactors.length > 0 ? keyFactors : ['Based on current trajectory'],
    });
  }

  return predictions;
}

/**
 * Generate mock health history for demo
 */
function generateMockHealthHistory(): Array<{ date: string; score: number }> {
  const history = [];
  const now = Date.now();

  for (let i = 90; i >= 0; i -= 7) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000);
    const baseScore = 70;
    const variation = Math.floor(Math.random() * 15) - 7;
    const trend = (90 - i) * -0.05; // Slight downward trend

    history.push({
      date: date.toISOString().split('T')[0],
      score: Math.max(40, Math.min(95, Math.round(baseScore + variation + trend))),
    });
  }

  return history;
}

/**
 * Get portfolio-level health summary
 */
export async function getPortfolioHealthSummary(): Promise<PortfolioHealthSummary> {
  const summary: PortfolioHealthSummary = {
    totalCustomers: 0,
    avgHealth: 0,
    healthDistribution: {
      critical: 0,
      atRisk: 0,
      healthy: 0,
      excellent: 0,
    },
    trendingDown: 0,
    trendingUp: 0,
    totalArrAtRisk: 0,
    topRisks: [],
    recommendedFocus: [],
  };

  if (!supabase) {
    // Return demo data
    return {
      ...summary,
      totalCustomers: 25,
      avgHealth: 68,
      healthDistribution: {
        critical: 2,
        atRisk: 5,
        healthy: 12,
        excellent: 6,
      },
      trendingDown: 4,
      trendingUp: 8,
      totalArrAtRisk: 350000,
      recommendedFocus: [
        'Focus on the 2 critical accounts first',
        'Schedule QBRs for the 5 at-risk accounts',
        'Explore expansion with healthy accounts',
      ],
    };
  }

  try {
    // Get all customers with health scores
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, health_score, arr, renewal_date, stage');

    if (!customers) return summary;

    summary.totalCustomers = customers.length;

    // Calculate distribution
    let totalHealth = 0;
    for (const customer of customers) {
      const health = customer.health_score || 70;
      totalHealth += health;

      if (health < 40) summary.healthDistribution.critical++;
      else if (health < 60) summary.healthDistribution.atRisk++;
      else if (health < 80) summary.healthDistribution.healthy++;
      else summary.healthDistribution.excellent++;

      // Calculate ARR at risk
      if (health < 60) {
        summary.totalArrAtRisk += customer.arr || 0;
      }
    }

    summary.avgHealth = Math.round(totalHealth / customers.length);

    // Get top risks
    const atRiskCustomers = customers
      .filter(c => (c.health_score || 70) < 60)
      .sort((a, b) => (a.health_score || 70) - (b.health_score || 70))
      .slice(0, 5);

    summary.topRisks = atRiskCustomers.map(c => {
      const daysToRenewal = c.renewal_date
        ? Math.ceil((new Date(c.renewal_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        : null;

      return {
        customerId: c.id,
        customerName: c.name,
        health: c.health_score || 70,
        arr: c.arr || 0,
        daysToRenewal,
        topInsight: c.health_score < 40 ? 'Critical health - immediate action required' : 'At risk - proactive outreach needed',
      };
    });

    // Generate focus recommendations
    if (summary.healthDistribution.critical > 0) {
      summary.recommendedFocus.push(`Address ${summary.healthDistribution.critical} critical accounts immediately`);
    }
    if (summary.healthDistribution.atRisk > 0) {
      summary.recommendedFocus.push(`Schedule check-ins with ${summary.healthDistribution.atRisk} at-risk accounts`);
    }
    if (summary.healthDistribution.excellent > 0) {
      summary.recommendedFocus.push(`Explore expansion with ${summary.healthDistribution.excellent} healthy accounts`);
    }
    if (summary.totalArrAtRisk > 0) {
      summary.recommendedFocus.push(`$${summary.totalArrAtRisk.toLocaleString()} ARR at risk - prioritize retention`);
    }
  } catch (error) {
    console.error('Error getting portfolio summary:', error);
  }

  return summary;
}

export default {
  generateHealthInsights,
  getPortfolioHealthSummary,
};
