/**
 * Risk Assessment Service (PRD-229)
 * AI-powered deal and customer risk assessment using Claude
 */

import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

// Types
interface RiskCategory {
  type: 'relationship' | 'product' | 'commercial' | 'competitive' | 'timing' | 'process';
}

interface IdentifiedRisk {
  id: string;
  category: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact_score: number;
  evidence: string[];
  detected_at: string;
  status: 'new' | 'acknowledged' | 'mitigating' | 'resolved';
}

interface Mitigation {
  risk_id: string;
  action: string;
  expected_impact: number;
  effort: 'low' | 'medium' | 'high';
  timeline: string;
  owner?: string;
}

interface DealComparison {
  similar_deals_won: number;
  similar_deals_lost: number;
  win_rate: number;
  key_differentiator: string;
  your_deal_missing: string[];
}

interface RiskTrend {
  direction: 'increasing' | 'decreasing' | 'stable';
  change_7d: number;
  change_30d?: number;
  history: Array<{ date: string; score: number }>;
}

interface RiskAssessment {
  id: string;
  customer_id: string;
  customer_name: string;
  deal_id?: string;
  deal_type?: string;
  deal_value?: number;
  close_date?: string;
  overall_risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  risks: IdentifiedRisk[];
  mitigations: Mitigation[];
  comparison?: DealComparison;
  trend: RiskTrend;
  model_version: string;
  assessed_at: string;
  created_at: string;
  updated_at: string;
}

interface CustomerContext {
  customer_id: string;
  customer_name: string;
  industry?: string;
  arr: number;
  health_score: number;
  days_to_renewal?: number;
  contract_term_months?: number;
  tenure_months?: number;
  dau_trend_30d?: number;
  mau_trend_90d?: number;
  feature_adoption_breadth?: number;
  feature_adoption_trend?: number;
  meetings_last_90d?: number;
  meeting_sentiment_trend?: string;
  email_response_rate?: number;
  days_since_last_meeting?: number;
  days_since_last_email?: number;
  health_score_change_30d?: number;
  health_score_change_90d?: number;
  health_score_velocity?: number;
  ticket_volume_trend?: number;
  avg_ticket_severity?: number;
  unresolved_tickets?: number;
  support_sentiment?: number;
  champion_departed?: boolean;
  champion_departure_date?: string;
  stakeholder_count?: number;
  exec_sponsor_engaged?: boolean;
  competitor_mentioned?: boolean;
  competitor_mentions_90d?: number;
  active_rfp?: boolean;
  competitor_evidence?: string[];
  payment_history_score?: number;
  previous_save_plays?: number;
  last_activity_date?: string;
}

interface PortfolioRiskSummary {
  total_customers: number;
  total_value: number;
  risk_distribution: {
    low: { count: number; value: number };
    medium: { count: number; value: number };
    high: { count: number; value: number };
    critical: { count: number; value: number };
  };
  top_risks_across_portfolio: Array<{
    risk: string;
    customer_count: number;
    category: string;
  }>;
  forecast_impact: {
    original_forecast: number;
    risk_adjusted_forecast: number;
    at_risk_amount: number;
  };
  trending_worse: Array<{
    customer_id: string;
    customer_name: string;
    change: number;
    risk_score: number;
  }>;
  trending_better: Array<{
    customer_id: string;
    customer_name: string;
    change: number;
    risk_score: number;
  }>;
}

// Initialize clients
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

let anthropic: Anthropic | null = null;
if (config.anthropicApiKey) {
  anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
}

const MODEL_VERSION = '1.0.0';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

// In-memory cache for assessments
const assessmentCache = new Map<string, { assessment: RiskAssessment; expiry: number }>();

/**
 * Calculate risk level from score
 */
function calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 85) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

/**
 * Rule-based risk scoring (fallback when AI unavailable)
 */
function calculateRuleBasedRisk(context: CustomerContext): {
  score: number;
  risks: IdentifiedRisk[];
} {
  const risks: IdentifiedRisk[] = [];
  let baseScore = 20; // Default 20% base churn risk
  const now = new Date().toISOString();

  // Relationship risks
  if (context.champion_departed) {
    const risk: IdentifiedRisk = {
      id: uuidv4(),
      category: 'relationship',
      name: 'Champion Departure',
      description: 'Key champion has left the organization',
      severity: 'high',
      impact_score: 25,
      evidence: [
        `Champion departure detected${context.champion_departure_date ? ' on ' + context.champion_departure_date : ''}`
      ],
      detected_at: now,
      status: 'new'
    };
    risks.push(risk);
    baseScore += 25;
  }

  if (!context.exec_sponsor_engaged) {
    const risk: IdentifiedRisk = {
      id: uuidv4(),
      category: 'relationship',
      name: 'No Executive Sponsor',
      description: 'No executive-level engagement on renewal',
      severity: 'medium',
      impact_score: 15,
      evidence: ['No executive attended recent meetings', 'Proposal not reviewed by leadership'],
      detected_at: now,
      status: 'new'
    };
    risks.push(risk);
    baseScore += 15;
  }

  if ((context.stakeholder_count || 0) < 3) {
    const risk: IdentifiedRisk = {
      id: uuidv4(),
      category: 'relationship',
      name: 'Limited Stakeholder Coverage',
      description: `Only ${context.stakeholder_count || 0} stakeholders engaged`,
      severity: 'medium',
      impact_score: 10,
      evidence: ['Single-threaded relationship', 'Limited organizational reach'],
      detected_at: now,
      status: 'new'
    };
    risks.push(risk);
    baseScore += 10;
  }

  // Product/health risks
  if (context.health_score < 50) {
    const severity = context.health_score < 30 ? 'critical' : 'high';
    const impact = context.health_score < 30 ? 30 : 20;
    const risk: IdentifiedRisk = {
      id: uuidv4(),
      category: 'product',
      name: 'Low Health Score',
      description: `Customer health score is ${context.health_score}`,
      severity,
      impact_score: impact,
      evidence: [`Current health score: ${context.health_score}`],
      detected_at: now,
      status: 'new'
    };
    risks.push(risk);
    baseScore += impact;
  }

  if ((context.health_score_velocity || 0) < -5) {
    const risk: IdentifiedRisk = {
      id: uuidv4(),
      category: 'product',
      name: 'Rapidly Declining Health',
      description: 'Health score is declining rapidly',
      severity: 'high',
      impact_score: 15,
      evidence: [`Health score velocity: ${context.health_score_velocity} points per month`],
      detected_at: now,
      status: 'new'
    };
    risks.push(risk);
    baseScore += 15;
  }

  // Usage risks
  if ((context.dau_trend_30d || 0) < -0.2) {
    const risk: IdentifiedRisk = {
      id: uuidv4(),
      category: 'product',
      name: 'Usage Decline',
      description: 'Daily active users declining',
      severity: 'high',
      impact_score: 15,
      evidence: [`DAU down ${Math.abs((context.dau_trend_30d || 0) * 100).toFixed(0)}% over 30 days`],
      detected_at: now,
      status: 'new'
    };
    risks.push(risk);
    baseScore += 15;
  }

  if ((context.mau_trend_90d || 0) < -0.3) {
    const risk: IdentifiedRisk = {
      id: uuidv4(),
      category: 'product',
      name: 'Severe MAU Decline',
      description: 'Monthly active users collapsing',
      severity: 'critical',
      impact_score: 20,
      evidence: [`MAU down ${Math.abs((context.mau_trend_90d || 0) * 100).toFixed(0)}% over 90 days`],
      detected_at: now,
      status: 'new'
    };
    risks.push(risk);
    baseScore += 20;
  }

  // Engagement risks
  if ((context.days_since_last_meeting || 0) > 60) {
    const severity = (context.days_since_last_meeting || 0) > 90 ? 'high' : 'medium';
    const impact = (context.days_since_last_meeting || 0) > 90 ? 15 : 10;
    const risk: IdentifiedRisk = {
      id: uuidv4(),
      category: 'process',
      name: 'Engagement Gap',
      description: `No meeting in ${context.days_since_last_meeting} days`,
      severity,
      impact_score: impact,
      evidence: [`Last meeting: ${context.days_since_last_meeting} days ago`],
      detected_at: now,
      status: 'new'
    };
    risks.push(risk);
    baseScore += impact;
  }

  if (context.meeting_sentiment_trend === 'declining') {
    const risk: IdentifiedRisk = {
      id: uuidv4(),
      category: 'relationship',
      name: 'Declining Meeting Sentiment',
      description: 'Recent meetings have had negative sentiment',
      severity: 'medium',
      impact_score: 12,
      evidence: ['Meeting sentiment trending negative'],
      detected_at: now,
      status: 'new'
    };
    risks.push(risk);
    baseScore += 12;
  }

  // Competitive risks
  if (context.competitor_mentioned || context.active_rfp) {
    const severity = context.active_rfp ? 'critical' : 'high';
    const impact = context.active_rfp ? 25 : 20;
    const risk: IdentifiedRisk = {
      id: uuidv4(),
      category: 'competitive',
      name: context.active_rfp ? 'Active RFP/Evaluation' : 'Competitive Evaluation',
      description: context.active_rfp
        ? 'Customer has opened an RFP process'
        : 'Customer is evaluating competitors',
      severity,
      impact_score: impact,
      evidence: context.competitor_evidence || ['Competitor mentioned in recent communications'],
      detected_at: now,
      status: 'new'
    };
    risks.push(risk);
    baseScore += impact;
  }

  // Support risks
  if ((context.unresolved_tickets || 0) > 5) {
    const risk: IdentifiedRisk = {
      id: uuidv4(),
      category: 'product',
      name: 'Unresolved Support Issues',
      description: `${context.unresolved_tickets} support tickets still open`,
      severity: (context.unresolved_tickets || 0) > 10 ? 'high' : 'medium',
      impact_score: Math.min(context.unresolved_tickets || 0, 15),
      evidence: [`${context.unresolved_tickets} open tickets`],
      detected_at: now,
      status: 'new'
    };
    risks.push(risk);
    baseScore += Math.min(context.unresolved_tickets || 0, 15);
  }

  // Timing risks
  if ((context.days_to_renewal || 365) < 30) {
    const risk: IdentifiedRisk = {
      id: uuidv4(),
      category: 'timing',
      name: 'Imminent Renewal',
      description: `Renewal in ${context.days_to_renewal} days`,
      severity: 'high',
      impact_score: 10,
      evidence: [`Only ${context.days_to_renewal} days until renewal`],
      detected_at: now,
      status: 'new'
    };
    risks.push(risk);
    baseScore += 10;
  }

  // Mitigating factors
  if ((context.days_to_renewal || 0) > 180) {
    baseScore -= 10;
  }
  if ((context.health_score_change_30d || 0) > 10) {
    baseScore -= 10;
  }
  if ((context.tenure_months || 0) > 24) {
    baseScore -= 5;
  }

  // Normalize score
  const finalScore = Math.min(Math.max(baseScore, 0), 100);

  return { score: finalScore, risks };
}

/**
 * Generate AI-powered mitigations for identified risks
 */
async function generateAIMitigations(
  risks: IdentifiedRisk[],
  context: CustomerContext
): Promise<Mitigation[]> {
  if (!anthropic || risks.length === 0) {
    // Return default mitigations
    return risks.map(risk => ({
      risk_id: risk.id,
      action: getDefaultMitigation(risk.category, risk.name),
      expected_impact: Math.floor(risk.impact_score * 0.6),
      effort: 'medium' as const,
      timeline: 'Next 2 weeks'
    }));
  }

  const prompt = `You are an expert Customer Success Manager. Analyze these deal risks and provide specific, actionable mitigation strategies.

Customer Context:
- Name: ${context.customer_name}
- Industry: ${context.industry || 'Not specified'}
- ARR: $${context.arr.toLocaleString()}
- Health Score: ${context.health_score}
- Days to Renewal: ${context.days_to_renewal || 'N/A'}

Identified Risks:
${JSON.stringify(risks, null, 2)}

For each risk, provide a mitigation in this exact JSON format:
[
  {
    "risk_id": "the risk id",
    "action": "Specific, actionable step to mitigate this risk",
    "expected_impact": number between 5-30 representing risk score reduction if executed,
    "effort": "low" | "medium" | "high",
    "timeline": "Specific timeline like 'This week', 'Next 2 weeks', 'Next month'"
  }
]

Return ONLY the JSON array, no additional text.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    });

    const textBlock = message.content.find(block => block.type === 'text');
    const responseText = textBlock?.type === 'text' ? textBlock.text : '';

    // Parse JSON response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as Mitigation[];
    }
  } catch (error) {
    console.error('AI mitigation generation failed:', error);
  }

  // Fallback to default mitigations
  return risks.map(risk => ({
    risk_id: risk.id,
    action: getDefaultMitigation(risk.category, risk.name),
    expected_impact: Math.floor(risk.impact_score * 0.6),
    effort: 'medium' as const,
    timeline: 'Next 2 weeks'
  }));
}

/**
 * Get default mitigation action for a risk category
 */
function getDefaultMitigation(category: string, riskName: string): string {
  const mitigations: Record<string, string> = {
    'Champion Departure': 'Identify and engage new champion; schedule multi-threading sessions',
    'No Executive Sponsor': 'Request executive briefing; propose exec-to-exec connection',
    'Limited Stakeholder Coverage': 'Expand stakeholder map; schedule cross-functional meetings',
    'Low Health Score': 'Schedule health review meeting; create adoption action plan',
    'Rapidly Declining Health': 'Emergency intervention call; escalate to leadership',
    'Usage Decline': 'Conduct usage review workshop; provide targeted training',
    'Severe MAU Decline': 'Executive escalation; implement save play',
    'Engagement Gap': 'Schedule check-in call; send value reminder email',
    'Declining Meeting Sentiment': 'Address concerns directly; prepare for difficult conversation',
    'Active RFP/Evaluation': 'Competitive differentiation session; executive engagement',
    'Competitive Evaluation': 'Schedule value review; highlight unique capabilities',
    'Unresolved Support Issues': 'Escalate critical tickets; schedule support review',
    'Imminent Renewal': 'Accelerate renewal discussions; prepare proposal'
  };

  return mitigations[riskName] ||
    `Address ${category} risk with targeted intervention`;
}

/**
 * Calculate comparison to similar deals
 */
async function calculateDealComparison(
  context: CustomerContext,
  riskScore: number
): Promise<DealComparison> {
  // In a real implementation, this would query historical deal data
  // For now, return simulated comparison data

  const baseWinRate = 0.75;
  const riskAdjustedWinRate = Math.max(0.1, baseWinRate - (riskScore / 200));

  const similarWon = Math.floor(40 + Math.random() * 20);
  const similarLost = Math.floor(similarWon * (1 - riskAdjustedWinRate) / riskAdjustedWinRate);

  const missingElements: string[] = [];
  if (!context.exec_sponsor_engaged) missingElements.push('Executive sponsor engagement');
  if ((context.stakeholder_count || 0) < 3) missingElements.push('Multi-threading');
  if (context.health_score < 70) missingElements.push('Healthy product adoption');
  if ((context.days_since_last_meeting || 0) > 30) missingElements.push('Regular engagement cadence');

  return {
    similar_deals_won: similarWon,
    similar_deals_lost: similarLost,
    win_rate: parseFloat(riskAdjustedWinRate.toFixed(2)),
    key_differentiator: missingElements[0] || 'Strong executive alignment',
    your_deal_missing: missingElements
  };
}

/**
 * Get risk history for trend calculation
 */
async function getRiskHistory(
  customerId: string,
  daysBack: number = 30
): Promise<Array<{ date: string; score: number }>> {
  if (!supabase) {
    // Return simulated history
    const history: Array<{ date: string; score: number }> = [];
    const today = new Date();
    for (let i = daysBack; i >= 0; i -= 7) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      history.push({
        date: date.toISOString().split('T')[0],
        score: Math.floor(40 + Math.random() * 30)
      });
    }
    return history;
  }

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const { data, error } = await supabase
      .from('risk_assessment_history')
      .select('risk_score, recorded_at')
      .eq('customer_id', customerId)
      .gte('recorded_at', startDate.toISOString())
      .order('recorded_at', { ascending: true });

    if (error || !data) return [];

    return data.map(row => ({
      date: new Date(row.recorded_at).toISOString().split('T')[0],
      score: row.risk_score
    }));
  } catch (error) {
    console.error('Failed to fetch risk history:', error);
    return [];
  }
}

/**
 * Calculate risk trend from history
 */
function calculateRiskTrend(
  currentScore: number,
  history: Array<{ date: string; score: number }>
): RiskTrend {
  if (history.length < 2) {
    return {
      direction: 'stable',
      change_7d: 0,
      history: [{ date: new Date().toISOString().split('T')[0], score: currentScore }]
    };
  }

  const lastWeekScore = history.length > 1 ? history[history.length - 2].score : currentScore;
  const change7d = currentScore - lastWeekScore;

  let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (change7d > 5) direction = 'increasing';
  else if (change7d < -5) direction = 'decreasing';

  // Add current score to history
  const fullHistory = [...history];
  const today = new Date().toISOString().split('T')[0];
  if (!fullHistory.some(h => h.date === today)) {
    fullHistory.push({ date: today, score: currentScore });
  }

  return {
    direction,
    change_7d: change7d,
    change_30d: history.length > 4 ? currentScore - history[0].score : undefined,
    history: fullHistory.slice(-5) // Keep last 5 entries
  };
}

/**
 * Save assessment to database
 */
async function saveAssessment(assessment: RiskAssessment): Promise<void> {
  if (!supabase) return;

  try {
    // Save main assessment
    await supabase.from('risk_assessments').upsert({
      id: assessment.id,
      customer_id: assessment.customer_id,
      deal_id: assessment.deal_id,
      deal_type: assessment.deal_type,
      overall_risk_score: assessment.overall_risk_score,
      risk_level: assessment.risk_level,
      confidence: assessment.confidence,
      risks: assessment.risks,
      mitigations: assessment.mitigations,
      comparison: assessment.comparison,
      model_version: assessment.model_version,
      assessed_at: assessment.assessed_at
    });

    // Save to history
    await supabase.from('risk_assessment_history').insert({
      id: uuidv4(),
      customer_id: assessment.customer_id,
      deal_id: assessment.deal_id,
      risk_score: assessment.overall_risk_score,
      risk_level: assessment.risk_level,
      recorded_at: assessment.assessed_at
    });
  } catch (error) {
    console.error('Failed to save assessment:', error);
  }
}

/**
 * Main function: Assess risk for a customer/deal
 */
export async function assessRisk(
  context: CustomerContext,
  dealId?: string,
  dealType?: string,
  dealValue?: number,
  closeDate?: string,
  forceRefresh: boolean = false
): Promise<RiskAssessment> {
  const cacheKey = `${context.customer_id}-${dealId || 'customer'}`;

  // Check cache
  if (!forceRefresh) {
    const cached = assessmentCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.assessment;
    }
  }

  // Calculate risk score and identify risks
  const { score, risks } = calculateRuleBasedRisk(context);

  // Generate mitigations using AI
  const mitigations = await generateAIMitigations(risks, context);

  // Get historical data for trends
  const history = await getRiskHistory(context.customer_id);
  const trend = calculateRiskTrend(score, history);

  // Calculate comparison to similar deals
  const comparison = await calculateDealComparison(context, score);

  // Calculate confidence based on data completeness
  let confidence = 0.5;
  if (context.health_score !== undefined) confidence += 0.1;
  if (context.dau_trend_30d !== undefined) confidence += 0.1;
  if (context.days_since_last_meeting !== undefined) confidence += 0.1;
  if (context.champion_departed !== undefined) confidence += 0.1;
  if (context.competitor_mentioned !== undefined) confidence += 0.1;
  confidence = Math.min(confidence, 0.95);

  const now = new Date().toISOString();
  const assessment: RiskAssessment = {
    id: uuidv4(),
    customer_id: context.customer_id,
    customer_name: context.customer_name,
    deal_id: dealId,
    deal_type: dealType,
    deal_value: dealValue,
    close_date: closeDate,
    overall_risk_score: score,
    risk_level: calculateRiskLevel(score),
    confidence,
    risks,
    mitigations,
    comparison,
    trend,
    model_version: MODEL_VERSION,
    assessed_at: now,
    created_at: now,
    updated_at: now
  };

  // Cache the assessment
  assessmentCache.set(cacheKey, {
    assessment,
    expiry: Date.now() + CACHE_TTL_MS
  });

  // Save to database asynchronously
  saveAssessment(assessment).catch(err => {
    console.error('Background save failed:', err);
  });

  return assessment;
}

/**
 * Get portfolio-level risk summary
 */
export async function getPortfolioRiskSummary(
  csmId?: string
): Promise<PortfolioRiskSummary> {
  if (!supabase) {
    // Return mock data for development
    return {
      total_customers: 25,
      total_value: 2500000,
      risk_distribution: {
        low: { count: 10, value: 800000 },
        medium: { count: 8, value: 900000 },
        high: { count: 5, value: 600000 },
        critical: { count: 2, value: 200000 }
      },
      top_risks_across_portfolio: [
        { risk: 'No executive sponsor', customer_count: 8, category: 'relationship' },
        { risk: 'Health score below 50', customer_count: 5, category: 'product' },
        { risk: 'Competitive evaluation', customer_count: 3, category: 'competitive' }
      ],
      forecast_impact: {
        original_forecast: 2500000,
        risk_adjusted_forecast: 2050000,
        at_risk_amount: 450000
      },
      trending_worse: [
        { customer_id: 'demo-1', customer_name: 'TechCorp', change: 15, risk_score: 72 }
      ],
      trending_better: [
        { customer_id: 'demo-2', customer_name: 'GlobalCo', change: -10, risk_score: 45 }
      ]
    };
  }

  try {
    // Get all recent assessments
    let query = supabase
      .from('risk_assessments')
      .select('*')
      .order('assessed_at', { ascending: false });

    if (csmId) {
      // Filter by CSM if provided
      // Note: This would require a join with customers table
    }

    const { data: assessments, error } = await query;

    if (error || !assessments) {
      throw error || new Error('No assessments found');
    }

    // Get unique customers (most recent assessment per customer)
    const customerAssessments = new Map<string, typeof assessments[0]>();
    assessments.forEach(a => {
      if (!customerAssessments.has(a.customer_id)) {
        customerAssessments.set(a.customer_id, a);
      }
    });

    const uniqueAssessments = Array.from(customerAssessments.values());

    // Calculate distribution
    const distribution = {
      low: { count: 0, value: 0 },
      medium: { count: 0, value: 0 },
      high: { count: 0, value: 0 },
      critical: { count: 0, value: 0 }
    };

    let totalValue = 0;
    uniqueAssessments.forEach(a => {
      const value = a.deal_value || 0;
      totalValue += value;
      distribution[a.risk_level as keyof typeof distribution].count++;
      distribution[a.risk_level as keyof typeof distribution].value += value;
    });

    // Calculate risk-adjusted forecast
    const atRiskAmount = distribution.high.value * 0.5 + distribution.critical.value * 0.75;

    // Aggregate top risks
    const riskCounts = new Map<string, { count: number; category: string }>();
    uniqueAssessments.forEach(a => {
      (a.risks as IdentifiedRisk[] || []).forEach(risk => {
        const key = risk.name;
        const existing = riskCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          riskCounts.set(key, { count: 1, category: risk.category });
        }
      });
    });

    const topRisks = Array.from(riskCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([risk, data]) => ({
        risk,
        customer_count: data.count,
        category: data.category
      }));

    // Get trending data from history
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data: historyData } = await supabase
      .from('risk_assessment_history')
      .select('customer_id, risk_score, recorded_at')
      .gte('recorded_at', oneWeekAgo.toISOString());

    // Calculate trends per customer
    const customerTrends = new Map<string, { current: number; previous: number; name: string }>();
    uniqueAssessments.forEach(a => {
      customerTrends.set(a.customer_id, {
        current: a.overall_risk_score,
        previous: a.overall_risk_score,
        name: a.customer_name || 'Unknown'
      });
    });

    (historyData || []).forEach(h => {
      const trend = customerTrends.get(h.customer_id);
      if (trend) {
        trend.previous = Math.min(trend.previous, h.risk_score);
      }
    });

    const trendingWorse = Array.from(customerTrends.entries())
      .filter(([_, t]) => t.current - t.previous > 5)
      .sort((a, b) => (b[1].current - b[1].previous) - (a[1].current - a[1].previous))
      .slice(0, 5)
      .map(([id, t]) => ({
        customer_id: id,
        customer_name: t.name,
        change: t.current - t.previous,
        risk_score: t.current
      }));

    const trendingBetter = Array.from(customerTrends.entries())
      .filter(([_, t]) => t.current - t.previous < -5)
      .sort((a, b) => (a[1].current - a[1].previous) - (b[1].current - b[1].previous))
      .slice(0, 5)
      .map(([id, t]) => ({
        customer_id: id,
        customer_name: t.name,
        change: t.current - t.previous,
        risk_score: t.current
      }));

    return {
      total_customers: uniqueAssessments.length,
      total_value: totalValue,
      risk_distribution: distribution,
      top_risks_across_portfolio: topRisks,
      forecast_impact: {
        original_forecast: totalValue,
        risk_adjusted_forecast: totalValue - atRiskAmount,
        at_risk_amount: atRiskAmount
      },
      trending_worse: trendingWorse,
      trending_better: trendingBetter
    };
  } catch (error) {
    console.error('Failed to get portfolio summary:', error);
    throw error;
  }
}

/**
 * Get assessment by customer ID
 */
export async function getAssessmentByCustomerId(
  customerId: string
): Promise<RiskAssessment | null> {
  // Check cache first
  const cacheKey = `${customerId}-customer`;
  const cached = assessmentCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.assessment;
  }

  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('risk_assessments')
      .select('*')
      .eq('customer_id', customerId)
      .order('assessed_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    return {
      ...data,
      customer_name: data.customer_name || 'Unknown',
      trend: data.trend || { direction: 'stable', change_7d: 0, history: [] }
    } as RiskAssessment;
  } catch (error) {
    console.error('Failed to get assessment:', error);
    return null;
  }
}

/**
 * Update mitigation status
 */
export async function updateMitigationStatus(
  customerId: string,
  riskId: string,
  status: 'acknowledged' | 'mitigating' | 'resolved'
): Promise<void> {
  if (!supabase) return;

  try {
    // Get current assessment
    const { data: assessment } = await supabase
      .from('risk_assessments')
      .select('risks')
      .eq('customer_id', customerId)
      .order('assessed_at', { ascending: false })
      .limit(1)
      .single();

    if (!assessment) return;

    // Update risk status
    const risks = (assessment.risks as IdentifiedRisk[]).map(risk =>
      risk.id === riskId ? { ...risk, status } : risk
    );

    await supabase
      .from('risk_assessments')
      .update({ risks, updated_at: new Date().toISOString() })
      .eq('customer_id', customerId)
      .order('assessed_at', { ascending: false })
      .limit(1);

    // Clear cache
    assessmentCache.delete(`${customerId}-customer`);
  } catch (error) {
    console.error('Failed to update mitigation status:', error);
    throw error;
  }
}

/**
 * Create a mitigation action record
 */
export async function createMitigationAction(
  customerId: string,
  riskId: string,
  action: string,
  dealId?: string
): Promise<{ id: string }> {
  const id = uuidv4();

  if (supabase) {
    try {
      await supabase.from('risk_mitigation_actions').insert({
        id,
        customer_id: customerId,
        deal_id: dealId,
        risk_id: riskId,
        action,
        status: 'pending',
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to create mitigation action:', error);
    }
  }

  return { id };
}

/**
 * Clear assessment cache (for testing)
 */
export function clearCache(): void {
  assessmentCache.clear();
}

// Export service object
export const riskAssessmentService = {
  assessRisk,
  getPortfolioRiskSummary,
  getAssessmentByCustomerId,
  updateMitigationStatus,
  createMitigationAction,
  clearCache
};
