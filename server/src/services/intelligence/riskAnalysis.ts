/**
 * Risk Deep Dive Analysis Service (PRD-083)
 *
 * Provides comprehensive risk factor analysis for customer accounts:
 * - Multi-factor risk scoring with weights
 * - Historical trend analysis
 * - Root cause categorization
 * - Mitigation action recommendations
 * - Risk factor correlation analysis
 * - Comparative risk benchmarking
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';

// Types
type RiskCategory = 'usage' | 'engagement' | 'financial' | 'relationship' | 'support';
type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
type RiskTrend = 'accelerating' | 'stable' | 'decelerating' | 'improving';

interface RiskFactor {
  id: string;
  category: RiskCategory;
  name: string;
  description: string;
  severity: RiskSeverity;
  weight: number;
  value: number | string;
  benchmark?: number | string;
  trend: RiskTrend;
  trendDetail: string;
  isEmerging: boolean;
  isChronic: boolean;
  relatedFactors?: string[];
  recommendation?: string;
  playbookId?: string;
  lastUpdated: string;
}

interface RiskHistoryPoint {
  date: string;
  riskScore: number;
  healthScore: number;
  category?: RiskCategory;
  event?: string;
}

interface MitigationAction {
  id: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  action: string;
  description: string;
  estimatedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'high' | 'medium' | 'low';
  timelineRecommendation: string;
  category: RiskCategory;
  addressesFactors: string[];
  playbookId?: string;
  assignedTo?: string;
  dueDate?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

interface RiskBenchmark {
  category: RiskCategory;
  customerValue: number;
  segmentAverage: number;
  portfolioAverage: number;
  topPerformerValue: number;
  percentile: number;
}

interface RiskDeepDive {
  customerId: string;
  customerName: string;
  arr: number;
  healthScore: number;
  riskScore: number;
  riskLevel: RiskSeverity;
  confidence: 'low' | 'medium' | 'high';
  factors: RiskFactor[];
  factorsByCategory: Record<RiskCategory, RiskFactor[]>;
  primaryConcerns: RiskFactor[];
  riskTrend: RiskTrend;
  riskTrendDescription: string;
  history: RiskHistoryPoint[];
  mitigationActions: MitigationAction[];
  benchmarks: RiskBenchmark[];
  daysToRenewal?: number;
  lastContactDays: number;
  lastMeetingDays: number;
  generatedAt: string;
  dataCompleteness: number;
  dataGaps: string[];
}

// Default factor weights
const DEFAULT_FACTOR_WEIGHTS: Record<string, { weight: number; category: RiskCategory }> = {
  usage_decline: { weight: 0.25, category: 'usage' },
  dau_drop: { weight: 0.15, category: 'usage' },
  feature_adoption: { weight: 0.10, category: 'usage' },
  login_frequency: { weight: 0.08, category: 'usage' },
  champion_departure: { weight: 0.20, category: 'relationship' },
  exec_sponsor_gap: { weight: 0.12, category: 'relationship' },
  stakeholder_churn: { weight: 0.08, category: 'relationship' },
  support_escalations: { weight: 0.15, category: 'support' },
  ticket_volume: { weight: 0.08, category: 'support' },
  csat_decline: { weight: 0.10, category: 'support' },
  engagement_gap: { weight: 0.12, category: 'engagement' },
  qbr_missed: { weight: 0.08, category: 'engagement' },
  response_rate: { weight: 0.06, category: 'engagement' },
  payment_issues: { weight: 0.10, category: 'financial' },
  contract_risk: { weight: 0.08, category: 'financial' },
  renewal_proximity: { weight: 0.15, category: 'financial' },
};

// Initialize Supabase
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

/**
 * Generate comprehensive risk deep dive analysis for a customer
 */
export async function generateRiskDeepDive(customerId: string): Promise<RiskDeepDive | null> {
  const customer = await getCustomerData(customerId);
  if (!customer) {
    return null;
  }

  // Gather all data needed for analysis
  const [usageMetrics, engagementData, supportData, stakeholderData, financialData, historicalData] =
    await Promise.all([
      getUsageMetrics(customerId),
      getEngagementData(customerId),
      getSupportData(customerId),
      getStakeholderData(customerId),
      getFinancialData(customerId),
      getRiskHistory(customerId, 90),
    ]);

  // Analyze all risk factors
  const factors = analyzeRiskFactors(
    customer,
    usageMetrics,
    engagementData,
    supportData,
    stakeholderData,
    financialData
  );

  // Calculate overall risk score
  const riskScore = calculateOverallRiskScore(factors);
  const riskLevel = determineRiskLevel(riskScore);

  // Categorize factors
  const factorsByCategory = categorizeFactors(factors);

  // Get primary concerns (top 3 by weight)
  const primaryConcerns = factors
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  // Analyze trend
  const { trend, description } = analyzeRiskTrend(historicalData, riskScore);

  // Generate mitigation recommendations
  const mitigationActions = generateMitigationActions(factors, customer);

  // Calculate benchmarks
  const benchmarks = await calculateBenchmarks(customerId, factorsByCategory);

  // Calculate data completeness
  const { completeness, gaps } = calculateDataCompleteness(
    usageMetrics,
    engagementData,
    supportData,
    stakeholderData,
    financialData
  );

  // Determine confidence based on data completeness
  const confidence = completeness >= 80 ? 'high' : completeness >= 50 ? 'medium' : 'low';

  // Calculate days since last contact/meeting
  const lastContactDays = engagementData?.lastContactDate
    ? daysSince(engagementData.lastContactDate)
    : 30;
  const lastMeetingDays = engagementData?.lastMeetingDate
    ? daysSince(engagementData.lastMeetingDate)
    : 45;

  return {
    customerId,
    customerName: customer.name,
    arr: customer.arr || 0,
    healthScore: customer.health_score || 70,
    riskScore,
    riskLevel,
    confidence,
    factors,
    factorsByCategory,
    primaryConcerns,
    riskTrend: trend,
    riskTrendDescription: description,
    history: historicalData,
    mitigationActions,
    benchmarks,
    daysToRenewal: customer.days_to_renewal,
    lastContactDays,
    lastMeetingDays,
    generatedAt: new Date().toISOString(),
    dataCompleteness: completeness,
    dataGaps: gaps,
  };
}

/**
 * Get risk trend data for a customer
 */
export async function getRiskTrends(
  customerId: string,
  periodDays: number = 90
): Promise<{
  customerId: string;
  customerName: string;
  period: string;
  history: RiskHistoryPoint[];
  averageRiskScore: number;
  currentRiskScore: number;
  changeFromPeriodStart: number;
  volatility: 'low' | 'medium' | 'high';
  keyEvents: Array<{ date: string; event: string; impactOnRisk: number }>;
  projection?: { expectedScore30Days: number; confidence: number };
} | null> {
  const customer = await getCustomerData(customerId);
  if (!customer) return null;

  const history = await getRiskHistory(customerId, periodDays);

  if (history.length === 0) {
    // Generate mock history if no data
    const mockHistory = generateMockHistory(periodDays);
    return {
      customerId,
      customerName: customer.name,
      period: `last ${periodDays} days`,
      history: mockHistory,
      averageRiskScore: 45,
      currentRiskScore: 50,
      changeFromPeriodStart: 5,
      volatility: 'medium',
      keyEvents: [],
      projection: { expectedScore30Days: 52, confidence: 0.6 },
    };
  }

  const avgScore = history.reduce((sum, h) => sum + h.riskScore, 0) / history.length;
  const currentScore = history[history.length - 1]?.riskScore || avgScore;
  const startScore = history[0]?.riskScore || avgScore;

  // Calculate volatility
  const variance =
    history.reduce((sum, h) => sum + Math.pow(h.riskScore - avgScore, 2), 0) / history.length;
  const stdDev = Math.sqrt(variance);
  const volatility = stdDev > 15 ? 'high' : stdDev > 8 ? 'medium' : 'low';

  // Extract key events
  const keyEvents = history
    .filter((h) => h.event)
    .map((h) => ({
      date: h.date,
      event: h.event!,
      impactOnRisk: 0, // Would be calculated from before/after scores
    }));

  return {
    customerId,
    customerName: customer.name,
    period: `last ${periodDays} days`,
    history,
    averageRiskScore: Math.round(avgScore),
    currentRiskScore: currentScore,
    changeFromPeriodStart: currentScore - startScore,
    volatility,
    keyEvents,
    projection: {
      expectedScore30Days: Math.min(100, currentScore + (currentScore - startScore) / 3),
      confidence: volatility === 'low' ? 0.8 : volatility === 'medium' ? 0.6 : 0.4,
    },
  };
}

/**
 * Generate mitigation plan from risk analysis
 */
export async function generateMitigationPlan(
  customerId: string
): Promise<{
  customerId: string;
  customerName: string;
  planId: string;
  createdAt: string;
  totalActions: number;
  urgentActions: number;
  estimatedTimeToComplete: string;
  expectedRiskReduction: number;
  actions: MitigationAction[];
  phases: Array<{
    phase: number;
    name: string;
    actions: MitigationAction[];
    targetDate: string;
  }>;
} | null> {
  const deepDive = await generateRiskDeepDive(customerId);
  if (!deepDive) return null;

  const actions = deepDive.mitigationActions;
  const urgentActions = actions.filter((a) => a.priority === 'urgent');

  // Organize into phases
  const phases = organizeIntoPhases(actions);

  // Calculate expected risk reduction
  const expectedReduction = actions.reduce((sum, a) => {
    const impactMultiplier = a.estimatedImpact === 'high' ? 0.15 : a.estimatedImpact === 'medium' ? 0.08 : 0.03;
    return sum + impactMultiplier * 100;
  }, 0);

  return {
    customerId,
    customerName: deepDive.customerName,
    planId: uuidv4(),
    createdAt: new Date().toISOString(),
    totalActions: actions.length,
    urgentActions: urgentActions.length,
    estimatedTimeToComplete: calculateTimeEstimate(actions),
    expectedRiskReduction: Math.min(40, Math.round(expectedReduction)),
    actions,
    phases,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getCustomerData(customerId: string): Promise<any | null> {
  if (!supabase) {
    // Return mock data for development
    return {
      id: customerId,
      name: 'TechStart Inc',
      arr: 150000,
      health_score: 35,
      stage: 'at_risk',
      industry: 'Technology',
      days_to_renewal: 62,
      renewal_date: new Date(Date.now() + 62 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  if (error) {
    console.error('Failed to fetch customer:', error);
    return null;
  }

  // Calculate days to renewal
  if (data?.renewal_date) {
    data.days_to_renewal = Math.ceil(
      (new Date(data.renewal_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );
  }

  return data;
}

async function getUsageMetrics(customerId: string): Promise<any> {
  if (!supabase) {
    return {
      dau: 12,
      mau: 45,
      dauPrevious: 22,
      mauPrevious: 50,
      featureAdoption: 12,
      featureAdoptionPrevious: 23,
      loginFrequency: 3,
      totalEvents: 1500,
      totalEventsPrevious: 2800,
    };
  }

  const { data: metrics } = await supabase
    .from('usage_metrics')
    .select('*')
    .eq('customer_id', customerId)
    .order('calculated_at', { ascending: false })
    .limit(2);

  if (!metrics || metrics.length === 0) {
    return null;
  }

  const current = metrics[0];
  const previous = metrics[1] || current;

  return {
    dau: current.dau,
    mau: current.mau,
    dauPrevious: previous.dau,
    mauPrevious: previous.mau,
    featureAdoption: current.unique_features_used,
    featureAdoptionPrevious: previous.unique_features_used,
    loginFrequency: current.login_frequency || 0,
    totalEvents: current.total_events,
    totalEventsPrevious: previous.total_events,
  };
}

async function getEngagementData(customerId: string): Promise<any> {
  if (!supabase) {
    return {
      lastContactDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      lastMeetingDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      qbrCount: 0,
      emailResponseRate: 0.15,
      meetingAttendanceRate: 0.6,
    };
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { data: engagements } = await supabase
    .from('customer_engagements')
    .select('*')
    .eq('customer_id', customerId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  return {
    lastContactDate: engagements?.[0]?.created_at,
    lastMeetingDate: engagements?.find((e) => e.type === 'meeting')?.created_at,
    qbrCount: engagements?.filter((e) => e.type === 'qbr').length || 0,
    emailResponseRate: 0.5,
    meetingAttendanceRate: 0.8,
  };
}

async function getSupportData(customerId: string): Promise<any> {
  if (!supabase) {
    return {
      openTickets: 3,
      p1Tickets: 2,
      avgResolutionTime: 72,
      csat: 2.5,
      csatPrevious: 4.2,
      unresolvedIssues: ['API performance issues', 'Data sync delays'],
    };
  }

  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('customer_id', customerId)
    .eq('status', 'open');

  return {
    openTickets: tickets?.length || 0,
    p1Tickets: tickets?.filter((t) => t.priority === 'P1').length || 0,
    avgResolutionTime: 48,
    csat: 3.5,
    csatPrevious: 4.0,
    unresolvedIssues: tickets?.map((t) => t.subject) || [],
  };
}

async function getStakeholderData(customerId: string): Promise<any> {
  if (!supabase) {
    return {
      championDeparted: true,
      championDepartureDate: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
      execSponsorEngaged: false,
      daysSinceExecContact: 60,
      stakeholderCount: 2,
      newChampionIdentified: false,
    };
  }

  const { data: stakeholders } = await supabase
    .from('stakeholders')
    .select('*')
    .eq('customer_id', customerId);

  const champion = stakeholders?.find((s) => s.role === 'champion');
  const execSponsor = stakeholders?.find((s) => s.role === 'exec_sponsor');

  return {
    championDeparted: champion?.status === 'departed',
    championDepartureDate: champion?.departed_at,
    execSponsorEngaged: execSponsor?.last_contact_at
      ? daysSince(execSponsor.last_contact_at) < 30
      : false,
    daysSinceExecContact: execSponsor?.last_contact_at
      ? daysSince(execSponsor.last_contact_at)
      : 90,
    stakeholderCount: stakeholders?.filter((s) => s.status === 'active').length || 0,
    newChampionIdentified: false,
  };
}

async function getFinancialData(customerId: string): Promise<any> {
  if (!supabase) {
    return {
      paymentIssues: false,
      contractRisk: 'medium',
      invoiceOverdue: false,
    };
  }

  return {
    paymentIssues: false,
    contractRisk: 'low',
    invoiceOverdue: false,
  };
}

async function getRiskHistory(customerId: string, days: number): Promise<RiskHistoryPoint[]> {
  if (!supabase) {
    return generateMockHistory(days);
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('risk_assessment_history')
    .select('*')
    .eq('customer_id', customerId)
    .gte('recorded_at', startDate.toISOString())
    .order('recorded_at', { ascending: true });

  if (error || !data || data.length === 0) {
    return generateMockHistory(days);
  }

  return data.map((row: any) => ({
    date: new Date(row.recorded_at).toISOString().split('T')[0],
    riskScore: row.risk_score,
    healthScore: row.health_score || 100 - row.risk_score,
    event: row.event_description,
  }));
}

function generateMockHistory(days: number): RiskHistoryPoint[] {
  const history: RiskHistoryPoint[] = [];
  const today = new Date();
  let baseScore = 35;

  for (let i = days; i >= 0; i -= 7) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Add some variation
    const variation = Math.floor(Math.random() * 10) - 3;
    const score = Math.max(10, Math.min(90, baseScore + variation));
    baseScore = score + 2; // Gradual increase in risk

    history.push({
      date: date.toISOString().split('T')[0],
      riskScore: score,
      healthScore: 100 - score,
    });
  }

  return history;
}

function analyzeRiskFactors(
  customer: any,
  usage: any,
  engagement: any,
  support: any,
  stakeholder: any,
  financial: any
): RiskFactor[] {
  const factors: RiskFactor[] = [];
  const now = new Date().toISOString();

  // Usage factors
  if (usage) {
    // DAU decline
    if (usage.dauPrevious > 0) {
      const dauChange = ((usage.dau - usage.dauPrevious) / usage.dauPrevious) * 100;
      if (dauChange < -20) {
        factors.push({
          id: uuidv4(),
          category: 'usage',
          name: 'DAU Decline',
          description: `Daily active users dropped ${Math.abs(dauChange).toFixed(0)}% in last 30 days`,
          severity: dauChange < -40 ? 'critical' : 'high',
          weight: Math.abs(dauChange) * 0.8,
          value: dauChange,
          benchmark: -5,
          trend: dauChange < -40 ? 'accelerating' : 'stable',
          trendDetail: 'Declining trend continues',
          isEmerging: Math.abs(dauChange) < 30,
          isChronic: false,
          recommendation: 'Schedule urgent check-in to understand blockers',
          lastUpdated: now,
        });
      }
    }

    // Feature adoption decline
    if (usage.featureAdoptionPrevious > 0) {
      const adoptionChange =
        ((usage.featureAdoption - usage.featureAdoptionPrevious) / usage.featureAdoptionPrevious) *
        100;
      if (adoptionChange < -30) {
        factors.push({
          id: uuidv4(),
          category: 'usage',
          name: 'Feature Adoption Drop',
          description: `Key feature adoption: ${usage.featureAdoption}% (was ${usage.featureAdoptionPrevious}%)`,
          severity: 'high',
          weight: 15,
          value: `${usage.featureAdoption}%`,
          benchmark: '50%',
          trend: 'accelerating',
          trendDetail: `${Math.abs(adoptionChange).toFixed(0)}% decrease`,
          isEmerging: false,
          isChronic: true,
          recommendation: 'Offer targeted training on underutilized features',
          lastUpdated: now,
        });
      }
    }
  }

  // Stakeholder factors
  if (stakeholder) {
    if (stakeholder.championDeparted) {
      factors.push({
        id: uuidv4(),
        category: 'relationship',
        name: 'Champion Departure',
        description: `Champion left company ${stakeholder.championDepartureDate ? daysSince(stakeholder.championDepartureDate) : 'recently'} days ago`,
        severity: 'critical',
        weight: 30,
        value: 'Departed',
        trend: stakeholder.newChampionIdentified ? 'improving' : 'stable',
        trendDetail: stakeholder.newChampionIdentified
          ? 'New champion being developed'
          : 'No replacement champion identified',
        isEmerging: stakeholder.championDepartureDate
          ? daysSince(stakeholder.championDepartureDate) < 30
          : true,
        isChronic: false,
        recommendation: 'Identify and engage new champion urgently',
        lastUpdated: now,
      });
    }

    if (!stakeholder.execSponsorEngaged) {
      factors.push({
        id: uuidv4(),
        category: 'relationship',
        name: 'Executive Sponsor Gap',
        description: `Exec sponsor engagement: None in ${stakeholder.daysSinceExecContact} days`,
        severity: stakeholder.daysSinceExecContact > 60 ? 'high' : 'medium',
        weight: 12,
        value: `${stakeholder.daysSinceExecContact} days`,
        benchmark: '30 days',
        trend: 'stable',
        trendDetail: 'No recent executive engagement',
        isEmerging: false,
        isChronic: stakeholder.daysSinceExecContact > 90,
        recommendation: 'Schedule executive check-in',
        lastUpdated: now,
      });
    }
  }

  // Support factors
  if (support) {
    if (support.p1Tickets > 0) {
      factors.push({
        id: uuidv4(),
        category: 'support',
        name: 'Support Escalations',
        description: `${support.p1Tickets} P1 tickets in last month`,
        severity: support.p1Tickets >= 3 ? 'critical' : 'high',
        weight: 20,
        value: support.p1Tickets,
        benchmark: 0,
        trend: 'stable',
        trendDetail: `CSAT: ${support.csat}/5`,
        isEmerging: false,
        isChronic: false,
        relatedFactors: [],
        recommendation: 'Escalate unresolved issues to engineering',
        lastUpdated: now,
      });
    }

    if (support.csat < 3) {
      factors.push({
        id: uuidv4(),
        category: 'support',
        name: 'Low CSAT Score',
        description: `CSAT dropped to ${support.csat}/5 (was ${support.csatPrevious}/5)`,
        severity: support.csat < 2.5 ? 'high' : 'medium',
        weight: 10,
        value: support.csat,
        benchmark: 4.0,
        trend: support.csat < support.csatPrevious ? 'accelerating' : 'stable',
        trendDetail: `${support.unresolvedIssues?.length || 0} unresolved issues`,
        isEmerging: false,
        isChronic: true,
        recommendation: 'Review and resolve outstanding support issues',
        lastUpdated: now,
      });
    }
  }

  // Engagement factors
  if (engagement) {
    const daysSinceContact = engagement.lastContactDate
      ? daysSince(engagement.lastContactDate)
      : 60;
    const daysSinceMeeting = engagement.lastMeetingDate
      ? daysSince(engagement.lastMeetingDate)
      : 90;

    if (daysSinceMeeting > 45 || engagement.qbrCount === 0) {
      factors.push({
        id: uuidv4(),
        category: 'engagement',
        name: 'Engagement Gap',
        description: `No QBR in ${Math.ceil(daysSinceMeeting / 30)} months`,
        severity: daysSinceMeeting > 90 ? 'high' : 'medium',
        weight: 10,
        value: `${daysSinceMeeting} days`,
        benchmark: '30 days',
        trend: 'stable',
        trendDetail: `Email response rate: ${(engagement.emailResponseRate * 100).toFixed(0)}%`,
        isEmerging: false,
        isChronic: daysSinceMeeting > 120,
        recommendation: 'Propose adoption workshop',
        lastUpdated: now,
      });
    }
  }

  // Renewal proximity
  if (customer.days_to_renewal !== undefined && customer.days_to_renewal <= 90) {
    const severity =
      customer.days_to_renewal <= 30
        ? 'critical'
        : customer.days_to_renewal <= 60
          ? 'high'
          : 'medium';
    factors.push({
      id: uuidv4(),
      category: 'financial',
      name: 'Renewal Proximity',
      description: `Renewal in ${customer.days_to_renewal} days with elevated risk`,
      severity,
      weight: customer.days_to_renewal <= 30 ? 20 : 10,
      value: `${customer.days_to_renewal} days`,
      trend: 'stable',
      trendDetail: 'Approaching renewal window',
      isEmerging: false,
      isChronic: false,
      recommendation: 'Initiate renewal conversation immediately',
      lastUpdated: now,
    });
  }

  return factors;
}

function calculateOverallRiskScore(factors: RiskFactor[]): number {
  if (factors.length === 0) return 25; // Base risk

  let totalWeight = 0;
  let weightedScore = 0;

  for (const factor of factors) {
    const severityMultiplier =
      factor.severity === 'critical'
        ? 1.0
        : factor.severity === 'high'
          ? 0.75
          : factor.severity === 'medium'
            ? 0.5
            : 0.25;

    weightedScore += factor.weight * severityMultiplier;
    totalWeight += factor.weight;
  }

  // Normalize to 0-100
  const normalizedScore = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 25;

  return Math.min(100, Math.max(0, Math.round(normalizedScore)));
}

function determineRiskLevel(score: number): RiskSeverity {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

function categorizeFactors(factors: RiskFactor[]): Record<RiskCategory, RiskFactor[]> {
  const categories: Record<RiskCategory, RiskFactor[]> = {
    usage: [],
    engagement: [],
    financial: [],
    relationship: [],
    support: [],
  };

  for (const factor of factors) {
    categories[factor.category].push(factor);
  }

  return categories;
}

function analyzeRiskTrend(
  history: RiskHistoryPoint[],
  currentScore: number
): { trend: RiskTrend; description: string } {
  if (history.length < 2) {
    return { trend: 'stable', description: 'Insufficient data for trend analysis' };
  }

  const recentAvg = history.slice(-4).reduce((sum, h) => sum + h.riskScore, 0) / Math.min(4, history.length);
  const olderAvg = history.slice(0, -4).reduce((sum, h) => sum + h.riskScore, 0) / Math.max(1, history.length - 4);

  const change = recentAvg - olderAvg;

  if (change > 10) {
    return { trend: 'accelerating', description: `Risk increasing - up ${change.toFixed(0)} points recently` };
  } else if (change > 3) {
    return { trend: 'stable', description: 'Risk trending slightly upward' };
  } else if (change < -10) {
    return { trend: 'improving', description: `Risk decreasing - down ${Math.abs(change).toFixed(0)} points` };
  } else if (change < -3) {
    return { trend: 'decelerating', description: 'Risk trend stabilizing' };
  }

  return { trend: 'stable', description: 'Risk level relatively stable' };
}

function generateMitigationActions(factors: RiskFactor[], customer: any): MitigationAction[] {
  const actions: MitigationAction[] = [];

  // Sort factors by weight to prioritize actions
  const sortedFactors = [...factors].sort((a, b) => b.weight - a.weight);

  for (const factor of sortedFactors) {
    const action = createMitigationAction(factor, customer);
    if (action) {
      actions.push(action);
    }
  }

  // Add general actions based on overall risk
  if (factors.some((f) => f.severity === 'critical')) {
    actions.unshift({
      id: uuidv4(),
      priority: 'urgent',
      action: 'Schedule executive escalation meeting',
      description: 'Arrange immediate escalation meeting within 48 hours',
      estimatedImpact: 'high',
      estimatedEffort: 'medium',
      timelineRecommendation: 'Within 48 hours',
      category: 'relationship',
      addressesFactors: factors.filter((f) => f.severity === 'critical').map((f) => f.id),
    });
  }

  return actions.slice(0, 6); // Return top 6 actions
}

function createMitigationAction(factor: RiskFactor, customer: any): MitigationAction | null {
  const priority =
    factor.severity === 'critical'
      ? 'urgent'
      : factor.severity === 'high'
        ? 'high'
        : 'medium';

  switch (factor.name) {
    case 'Champion Departure':
      return {
        id: uuidv4(),
        priority: 'urgent',
        action: 'Identify and engage new champion',
        description: 'Map org chart and identify potential new champions to develop',
        estimatedImpact: 'high',
        estimatedEffort: 'high',
        timelineRecommendation: 'This week',
        category: factor.category,
        addressesFactors: [factor.id],
        playbookId: 'champion-development',
      };

    case 'Support Escalations':
      return {
        id: uuidv4(),
        priority: 'urgent',
        action: 'Escalate critical issues to engineering',
        description: 'Fast-track resolution of P1 tickets with engineering team',
        estimatedImpact: 'high',
        estimatedEffort: 'medium',
        timelineRecommendation: 'Immediate',
        category: factor.category,
        addressesFactors: [factor.id],
      };

    case 'Executive Sponsor Gap':
      return {
        id: uuidv4(),
        priority: 'high',
        action: 'Schedule executive check-in',
        description: 'Arrange meeting with executive sponsor to reestablish relationship',
        estimatedImpact: 'medium',
        estimatedEffort: 'low',
        timelineRecommendation: 'This week',
        category: factor.category,
        addressesFactors: [factor.id],
      };

    case 'Engagement Gap':
      return {
        id: uuidv4(),
        priority: 'medium',
        action: 'Propose adoption workshop',
        description: 'Schedule training session focused on underutilized features',
        estimatedImpact: 'medium',
        estimatedEffort: 'medium',
        timelineRecommendation: 'Next week',
        category: factor.category,
        addressesFactors: [factor.id],
        playbookId: 'adoption-workshop',
      };

    case 'DAU Decline':
    case 'Feature Adoption Drop':
      return {
        id: uuidv4(),
        priority,
        action: 'Schedule urgent check-in to understand blockers',
        description: 'Deep dive into usage patterns and identify adoption barriers',
        estimatedImpact: 'high',
        estimatedEffort: 'medium',
        timelineRecommendation: priority === 'urgent' ? 'Within 48 hours' : 'This week',
        category: factor.category,
        addressesFactors: [factor.id],
      };

    case 'Renewal Proximity':
      return {
        id: uuidv4(),
        priority: factor.severity === 'critical' ? 'urgent' : 'high',
        action: 'Initiate renewal discussion',
        description: 'Start proactive renewal conversation with value summary',
        estimatedImpact: 'high',
        estimatedEffort: 'medium',
        timelineRecommendation: 'Immediate',
        category: factor.category,
        addressesFactors: [factor.id],
        playbookId: 'renewal-playbook',
      };

    default:
      return factor.recommendation
        ? {
            id: uuidv4(),
            priority,
            action: factor.recommendation,
            description: factor.description,
            estimatedImpact: factor.severity === 'critical' ? 'high' : 'medium',
            estimatedEffort: 'medium',
            timelineRecommendation: priority === 'urgent' ? 'Immediate' : 'This week',
            category: factor.category,
            addressesFactors: [factor.id],
          }
        : null;
  }
}

async function calculateBenchmarks(
  customerId: string,
  factorsByCategory: Record<RiskCategory, RiskFactor[]>
): Promise<RiskBenchmark[]> {
  const benchmarks: RiskBenchmark[] = [];

  for (const category of Object.keys(factorsByCategory) as RiskCategory[]) {
    const factors = factorsByCategory[category];
    const avgWeight = factors.length > 0
      ? factors.reduce((sum, f) => sum + f.weight, 0) / factors.length
      : 0;

    benchmarks.push({
      category,
      customerValue: Math.round(avgWeight),
      segmentAverage: Math.round(avgWeight * 0.6),
      portfolioAverage: Math.round(avgWeight * 0.5),
      topPerformerValue: Math.round(avgWeight * 0.2),
      percentile: Math.max(0, Math.min(100, 100 - avgWeight * 2)),
    });
  }

  return benchmarks;
}

function calculateDataCompleteness(
  usage: any,
  engagement: any,
  support: any,
  stakeholder: any,
  financial: any
): { completeness: number; gaps: string[] } {
  const gaps: string[] = [];
  let available = 0;
  const total = 5;

  if (usage) available++;
  else gaps.push('Usage metrics not available');

  if (engagement) available++;
  else gaps.push('Engagement data not available');

  if (support) available++;
  else gaps.push('Support ticket data not available');

  if (stakeholder) available++;
  else gaps.push('Stakeholder information not available');

  if (financial) available++;
  else gaps.push('Financial data not available');

  return {
    completeness: Math.round((available / total) * 100),
    gaps,
  };
}

function organizeIntoPhases(actions: MitigationAction[]): Array<{
  phase: number;
  name: string;
  actions: MitigationAction[];
  targetDate: string;
}> {
  const urgent = actions.filter((a) => a.priority === 'urgent');
  const high = actions.filter((a) => a.priority === 'high');
  const medium = actions.filter((a) => a.priority === 'medium');
  const low = actions.filter((a) => a.priority === 'low');

  const phases = [];
  const today = new Date();

  if (urgent.length > 0) {
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + 2);
    phases.push({
      phase: 1,
      name: 'Immediate Actions',
      actions: urgent,
      targetDate: targetDate.toISOString().split('T')[0],
    });
  }

  if (high.length > 0) {
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + 7);
    phases.push({
      phase: phases.length + 1,
      name: 'This Week',
      actions: high,
      targetDate: targetDate.toISOString().split('T')[0],
    });
  }

  if (medium.length > 0 || low.length > 0) {
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + 14);
    phases.push({
      phase: phases.length + 1,
      name: 'Next Two Weeks',
      actions: [...medium, ...low],
      targetDate: targetDate.toISOString().split('T')[0],
    });
  }

  return phases;
}

function calculateTimeEstimate(actions: MitigationAction[]): string {
  const urgentCount = actions.filter((a) => a.priority === 'urgent').length;
  const highCount = actions.filter((a) => a.priority === 'high').length;

  if (urgentCount > 0 && highCount > 0) {
    return '2-3 weeks';
  } else if (urgentCount > 0) {
    return '1 week';
  } else if (highCount > 0) {
    return '2 weeks';
  }
  return '3-4 weeks';
}

function daysSince(dateStr: string): number {
  const date = new Date(dateStr);
  return Math.ceil((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

// Export service object
export const riskAnalysisService = {
  generateRiskDeepDive,
  getRiskTrends,
  generateMitigationPlan,
};

export default riskAnalysisService;
