/**
 * Readiness Assessment Service (PRD-085)
 *
 * Evaluates account readiness across multiple dimensions before major milestones
 * (renewal, expansion, QBR). Provides readiness score, gap analysis, and
 * actionable checklists.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { ClaudeService } from '../claude.js';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Types
// ============================================

export type MilestoneType = 'renewal' | 'expansion' | 'qbr' | 'onboarding_complete' | 'executive_briefing';
export type DimensionStatus = 'strong' | 'good' | 'gap' | 'critical';
export type GapPriority = 'critical' | 'high' | 'medium' | 'low';
export type ActionEffort = 'low' | 'medium' | 'high';

export interface ReadinessDimension {
  name: string;
  score: number;
  weight: number;
  status: DimensionStatus;
  description: string;
  dataPoints: DataPoint[];
  recommendations: string[];
}

export interface DataPoint {
  metric: string;
  value: string | number;
  benchmark: string | number | null;
  trend: 'up' | 'down' | 'stable' | 'unknown';
  impact: 'positive' | 'negative' | 'neutral';
}

export interface ReadinessGap {
  dimension: string;
  score: number;
  priority: GapPriority;
  issue: string;
  impact: string;
  suggestedAction: string;
  effort: ActionEffort;
  timeToAddress: string;
  isBlocker: boolean;
}

export interface ChecklistItem {
  id: string;
  task: string;
  description: string;
  dueDate: string | null;
  priority: GapPriority;
  dimension: string;
  completed: boolean;
  completedAt: string | null;
  assignee: string | null;
  notes: string | null;
}

export interface ReadinessAssessmentResult {
  assessmentId: string;
  customerId: string;
  customerName: string;
  milestoneType: MilestoneType;
  milestoneDate: string | null;
  daysUntilMilestone: number | null;
  overallScore: number;
  overallStatus: DimensionStatus;
  trend: 'improving' | 'stable' | 'declining';
  dimensions: {
    productAdoption: ReadinessDimension;
    stakeholderEngagement: ReadinessDimension;
    valueRealization: ReadinessDimension;
    supportHealth: ReadinessDimension;
    executiveAlignment: ReadinessDimension;
    financialHealth: ReadinessDimension;
  };
  gaps: ReadinessGap[];
  checklist: ChecklistItem[];
  aiSummary: string;
  aiRecommendations: string[];
  riskFactors: string[];
  successFactors: string[];
  assessedAt: string;
  dataQuality: 'poor' | 'fair' | 'good' | 'excellent';
  confidence: number;
}

export interface ReadinessHistoryEntry {
  assessmentId: string;
  assessedAt: string;
  milestoneType: MilestoneType;
  overallScore: number;
  dimensionScores: Record<string, number>;
  outcome: 'success' | 'partial' | 'failed' | 'pending' | null;
  outcomeNotes: string | null;
}

export interface AssessmentOptions {
  milestoneType: MilestoneType;
  milestoneDate?: string;
  includeChecklist?: boolean;
  includeAiAnalysis?: boolean;
  customWeights?: Partial<Record<string, number>>;
}

// ============================================
// Dimension Weights by Milestone Type
// ============================================

const DIMENSION_WEIGHTS: Record<MilestoneType, Record<string, number>> = {
  renewal: {
    productAdoption: 0.20,
    stakeholderEngagement: 0.20,
    valueRealization: 0.25,
    supportHealth: 0.15,
    executiveAlignment: 0.15,
    financialHealth: 0.05,
  },
  expansion: {
    productAdoption: 0.25,
    stakeholderEngagement: 0.15,
    valueRealization: 0.30,
    supportHealth: 0.10,
    executiveAlignment: 0.10,
    financialHealth: 0.10,
  },
  qbr: {
    productAdoption: 0.20,
    stakeholderEngagement: 0.25,
    valueRealization: 0.20,
    supportHealth: 0.15,
    executiveAlignment: 0.15,
    financialHealth: 0.05,
  },
  onboarding_complete: {
    productAdoption: 0.30,
    stakeholderEngagement: 0.25,
    valueRealization: 0.15,
    supportHealth: 0.15,
    executiveAlignment: 0.10,
    financialHealth: 0.05,
  },
  executive_briefing: {
    productAdoption: 0.15,
    stakeholderEngagement: 0.15,
    valueRealization: 0.30,
    supportHealth: 0.10,
    executiveAlignment: 0.25,
    financialHealth: 0.05,
  },
};

// ============================================
// Score Thresholds
// ============================================

const SCORE_THRESHOLDS = {
  strong: 80,
  good: 65,
  gap: 45,
  critical: 0,
};

function getStatus(score: number): DimensionStatus {
  if (score >= SCORE_THRESHOLDS.strong) return 'strong';
  if (score >= SCORE_THRESHOLDS.good) return 'good';
  if (score >= SCORE_THRESHOLDS.gap) return 'gap';
  return 'critical';
}

function getGapPriority(score: number, weight: number): GapPriority {
  const impact = (100 - score) * weight;
  if (score < 30) return 'critical';
  if (score < 50 || impact > 15) return 'high';
  if (score < 65 || impact > 10) return 'medium';
  return 'low';
}

// ============================================
// Data Collection Functions
// ============================================

async function getCustomerData(customerId: string): Promise<any> {
  if (!supabase) {
    return getMockCustomerData(customerId);
  }

  const { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  if (error || !customer) {
    console.warn(`Customer not found: ${customerId}, using mock data`);
    return getMockCustomerData(customerId);
  }

  return customer;
}

async function getHealthScoreHistory(customerId: string): Promise<any[]> {
  if (!supabase) return [];

  const { data } = await supabase
    .from('health_score_history')
    .select('*')
    .eq('customer_id', customerId)
    .order('recorded_at', { ascending: false })
    .limit(10);

  return data || [];
}

async function getStakeholders(customerId: string): Promise<any[]> {
  if (!supabase) return getMockStakeholders();

  const { data } = await supabase
    .from('stakeholders')
    .select('*')
    .eq('customer_id', customerId);

  return data || getMockStakeholders();
}

async function getSupportTickets(customerId: string): Promise<any[]> {
  if (!supabase) return getMockSupportTickets();

  const { data } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('customer_id', customerId)
    .eq('status', 'open');

  return data || getMockSupportTickets();
}

async function getRenewalInfo(customerId: string): Promise<any | null> {
  if (!supabase) return getMockRenewalInfo();

  const { data } = await supabase
    .from('renewal_pipeline')
    .select('*')
    .eq('customer_id', customerId)
    .order('renewal_date', { ascending: true })
    .limit(1)
    .single();

  return data || getMockRenewalInfo();
}

async function getMeetingHistory(customerId: string): Promise<any[]> {
  if (!supabase) return getMockMeetingHistory();

  const { data } = await supabase
    .from('meetings')
    .select('*')
    .eq('customer_id', customerId)
    .order('scheduled_at', { ascending: false })
    .limit(20);

  return data || getMockMeetingHistory();
}

async function getUsageMetrics(customerId: string): Promise<any | null> {
  if (!supabase) return getMockUsageMetrics();

  const { data } = await supabase
    .from('usage_metrics')
    .select('*')
    .eq('customer_id', customerId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single();

  return data || getMockUsageMetrics();
}

// ============================================
// Dimension Scoring Functions
// ============================================

function scoreProductAdoption(
  customer: any,
  usageMetrics: any | null,
  healthHistory: any[]
): ReadinessDimension {
  const dataPoints: DataPoint[] = [];
  let totalScore = 0;
  let weights = 0;

  // Feature adoption rate
  const featureAdoption = usageMetrics?.feature_adoption_rate ?? customer.featureAdoption ?? 70;
  dataPoints.push({
    metric: 'Feature Adoption Rate',
    value: `${featureAdoption}%`,
    benchmark: '75%',
    trend: featureAdoption > 70 ? 'up' : 'stable',
    impact: featureAdoption >= 75 ? 'positive' : featureAdoption >= 50 ? 'neutral' : 'negative',
  });
  totalScore += featureAdoption * 0.3;
  weights += 0.3;

  // Active users
  const activeUserPercent = usageMetrics?.active_user_percent ?? 65;
  dataPoints.push({
    metric: 'Active User %',
    value: `${activeUserPercent}%`,
    benchmark: '60%',
    trend: 'stable',
    impact: activeUserPercent >= 60 ? 'positive' : 'negative',
  });
  totalScore += Math.min(100, activeUserPercent * 1.5) * 0.3;
  weights += 0.3;

  // Login frequency
  const loginFrequency = usageMetrics?.weekly_logins ?? 3;
  const loginScore = Math.min(100, loginFrequency * 20);
  dataPoints.push({
    metric: 'Weekly Logins',
    value: loginFrequency,
    benchmark: 5,
    trend: loginFrequency >= 5 ? 'up' : 'stable',
    impact: loginFrequency >= 4 ? 'positive' : loginFrequency >= 2 ? 'neutral' : 'negative',
  });
  totalScore += loginScore * 0.2;
  weights += 0.2;

  // Usage trend
  const recentHealth = healthHistory[0]?.usage_score ?? 70;
  const olderHealth = healthHistory[3]?.usage_score ?? 70;
  const usageTrend = recentHealth - olderHealth;
  const trendScore = 50 + usageTrend;
  dataPoints.push({
    metric: 'Usage Trend',
    value: `${usageTrend >= 0 ? '+' : ''}${usageTrend}pts`,
    benchmark: '+5pts',
    trend: usageTrend > 0 ? 'up' : usageTrend < 0 ? 'down' : 'stable',
    impact: usageTrend > 0 ? 'positive' : usageTrend < -5 ? 'negative' : 'neutral',
  });
  totalScore += Math.max(0, Math.min(100, trendScore)) * 0.2;
  weights += 0.2;

  const score = Math.round(totalScore / weights);
  const status = getStatus(score);

  const recommendations: string[] = [];
  if (featureAdoption < 60) recommendations.push('Schedule feature adoption workshop');
  if (activeUserPercent < 50) recommendations.push('Identify and engage inactive users');
  if (loginFrequency < 3) recommendations.push('Implement re-engagement campaign');
  if (usageTrend < -5) recommendations.push('Investigate declining usage patterns');

  return {
    name: 'Product Adoption',
    score,
    weight: 0.2,
    status,
    description: getAdoptionDescription(score),
    dataPoints,
    recommendations,
  };
}

function scoreStakeholderEngagement(
  customer: any,
  stakeholders: any[],
  meetings: any[]
): ReadinessDimension {
  const dataPoints: DataPoint[] = [];
  let totalScore = 0;
  let weights = 0;

  // Number of engaged stakeholders
  const engagedStakeholders = stakeholders.filter(s =>
    s.last_contact && new Date(s.last_contact) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  ).length;
  const stakeholderScore = Math.min(100, engagedStakeholders * 25);
  dataPoints.push({
    metric: 'Engaged Stakeholders',
    value: engagedStakeholders,
    benchmark: 4,
    trend: engagedStakeholders >= 3 ? 'stable' : 'down',
    impact: engagedStakeholders >= 3 ? 'positive' : 'negative',
  });
  totalScore += stakeholderScore * 0.3;
  weights += 0.3;

  // Champion identified
  const hasChampion = stakeholders.some(s => s.role_type === 'champion' || s.is_champion);
  dataPoints.push({
    metric: 'Champion Identified',
    value: hasChampion ? 'Yes' : 'No',
    benchmark: 'Yes',
    trend: 'stable',
    impact: hasChampion ? 'positive' : 'negative',
  });
  totalScore += (hasChampion ? 100 : 30) * 0.2;
  weights += 0.2;

  // Executive sponsor engaged
  const execSponsor = stakeholders.find(s =>
    s.role?.toLowerCase().includes('vp') ||
    s.role?.toLowerCase().includes('director') ||
    s.role?.toLowerCase().includes('c-level') ||
    s.title?.toLowerCase().includes('chief')
  );
  const execEngaged = execSponsor &&
    execSponsor.last_contact &&
    new Date(execSponsor.last_contact) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  dataPoints.push({
    metric: 'Executive Sponsor Engaged',
    value: execEngaged ? 'Yes (last 90 days)' : 'No recent contact',
    benchmark: 'Yes',
    trend: execEngaged ? 'stable' : 'down',
    impact: execEngaged ? 'positive' : 'negative',
  });
  totalScore += (execEngaged ? 100 : 40) * 0.25;
  weights += 0.25;

  // Meeting frequency
  const recentMeetings = meetings.filter(m =>
    new Date(m.scheduled_at) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  ).length;
  const meetingScore = Math.min(100, recentMeetings * 33);
  dataPoints.push({
    metric: 'Meetings (last 90 days)',
    value: recentMeetings,
    benchmark: 3,
    trend: recentMeetings >= 3 ? 'stable' : 'down',
    impact: recentMeetings >= 2 ? 'positive' : 'negative',
  });
  totalScore += meetingScore * 0.25;
  weights += 0.25;

  const score = Math.round(totalScore / weights);
  const status = getStatus(score);

  const recommendations: string[] = [];
  if (!hasChampion) recommendations.push('Identify and cultivate a customer champion');
  if (!execEngaged) recommendations.push('Schedule executive briefing or sponsor meeting');
  if (recentMeetings < 2) recommendations.push('Increase meeting cadence');
  if (engagedStakeholders < 3) recommendations.push('Expand stakeholder relationships (multi-threading)');

  return {
    name: 'Stakeholder Engagement',
    score,
    weight: 0.2,
    status,
    description: getEngagementDescription(score),
    dataPoints,
    recommendations,
  };
}

function scoreValueRealization(customer: any, usageMetrics: any | null): ReadinessDimension {
  const dataPoints: DataPoint[] = [];
  let totalScore = 0;
  let weights = 0;

  // ROI documented
  const roiDocumented = customer.roi_documented ?? customer.valueRealized ?? false;
  dataPoints.push({
    metric: 'ROI Documented',
    value: roiDocumented ? 'Yes' : 'No',
    benchmark: 'Yes',
    trend: 'stable',
    impact: roiDocumented ? 'positive' : 'negative',
  });
  totalScore += (roiDocumented ? 100 : 40) * 0.3;
  weights += 0.3;

  // Success metrics achieved
  const successMetricsPercent = customer.success_metrics_achieved ?? 65;
  dataPoints.push({
    metric: 'Success Metrics Achieved',
    value: `${successMetricsPercent}%`,
    benchmark: '80%',
    trend: successMetricsPercent >= 70 ? 'up' : 'stable',
    impact: successMetricsPercent >= 75 ? 'positive' : successMetricsPercent >= 50 ? 'neutral' : 'negative',
  });
  totalScore += successMetricsPercent * 0.35;
  weights += 0.35;

  // Time to value
  const ttv = customer.time_to_value_days ?? 45;
  const ttvScore = ttv <= 30 ? 100 : ttv <= 60 ? 75 : ttv <= 90 ? 50 : 25;
  dataPoints.push({
    metric: 'Time to Value',
    value: `${ttv} days`,
    benchmark: '30 days',
    trend: 'stable',
    impact: ttv <= 45 ? 'positive' : ttv <= 75 ? 'neutral' : 'negative',
  });
  totalScore += ttvScore * 0.2;
  weights += 0.2;

  // Business outcomes tracked
  const outcomesTracked = customer.business_outcomes_count ?? 2;
  const outcomesScore = Math.min(100, outcomesTracked * 25);
  dataPoints.push({
    metric: 'Business Outcomes Tracked',
    value: outcomesTracked,
    benchmark: 4,
    trend: 'stable',
    impact: outcomesTracked >= 3 ? 'positive' : 'neutral',
  });
  totalScore += outcomesScore * 0.15;
  weights += 0.15;

  const score = Math.round(totalScore / weights);
  const status = getStatus(score);

  const recommendations: string[] = [];
  if (!roiDocumented) recommendations.push('Document ROI and business impact');
  if (successMetricsPercent < 60) recommendations.push('Review and refine success metrics');
  if (outcomesTracked < 3) recommendations.push('Identify additional business outcomes to track');

  return {
    name: 'Value Realization',
    score,
    weight: 0.25,
    status,
    description: getValueDescription(score),
    dataPoints,
    recommendations,
  };
}

function scoreSupportHealth(customer: any, tickets: any[]): ReadinessDimension {
  const dataPoints: DataPoint[] = [];
  let totalScore = 0;
  let weights = 0;

  // Open P1/P2 tickets
  const criticalTickets = tickets.filter(t =>
    t.priority === 'P1' || t.priority === 'P2' || t.priority === 'critical' || t.priority === 'high'
  ).length;
  const criticalScore = criticalTickets === 0 ? 100 : criticalTickets === 1 ? 60 : criticalTickets === 2 ? 30 : 10;
  dataPoints.push({
    metric: 'Critical Open Tickets',
    value: criticalTickets,
    benchmark: 0,
    trend: criticalTickets === 0 ? 'stable' : 'down',
    impact: criticalTickets === 0 ? 'positive' : 'negative',
  });
  totalScore += criticalScore * 0.35;
  weights += 0.35;

  // Total open tickets
  const openTickets = tickets.length;
  const openScore = openTickets === 0 ? 100 : openTickets <= 2 ? 80 : openTickets <= 5 ? 60 : 30;
  dataPoints.push({
    metric: 'Total Open Tickets',
    value: openTickets,
    benchmark: 'Less than 3',
    trend: openTickets <= 3 ? 'stable' : 'down',
    impact: openTickets <= 2 ? 'positive' : openTickets <= 4 ? 'neutral' : 'negative',
  });
  totalScore += openScore * 0.25;
  weights += 0.25;

  // CSAT score
  const csat = customer.csat_score ?? customer.csatScore ?? 4.2;
  const csatScore = Math.min(100, (csat / 5) * 100);
  dataPoints.push({
    metric: 'CSAT Score',
    value: csat.toFixed(1),
    benchmark: '4.5',
    trend: csat >= 4.5 ? 'up' : csat >= 4.0 ? 'stable' : 'down',
    impact: csat >= 4.5 ? 'positive' : csat >= 3.5 ? 'neutral' : 'negative',
  });
  totalScore += csatScore * 0.25;
  weights += 0.25;

  // Average resolution time
  const avgResolution = customer.avg_ticket_resolution_hours ?? 24;
  const resolutionScore = avgResolution <= 8 ? 100 : avgResolution <= 24 ? 80 : avgResolution <= 48 ? 60 : 30;
  dataPoints.push({
    metric: 'Avg Resolution Time',
    value: `${avgResolution}h`,
    benchmark: '24h',
    trend: avgResolution <= 24 ? 'stable' : 'down',
    impact: avgResolution <= 12 ? 'positive' : avgResolution <= 36 ? 'neutral' : 'negative',
  });
  totalScore += resolutionScore * 0.15;
  weights += 0.15;

  const score = Math.round(totalScore / weights);
  const status = getStatus(score);

  const recommendations: string[] = [];
  if (criticalTickets > 0) recommendations.push(`Escalate and resolve ${criticalTickets} critical ticket(s)`);
  if (openTickets > 3) recommendations.push('Schedule support review meeting');
  if (csat < 4.0) recommendations.push('Investigate CSAT decline and implement improvements');

  return {
    name: 'Support Health',
    score,
    weight: 0.15,
    status,
    description: getSupportDescription(score),
    dataPoints,
    recommendations,
  };
}

function scoreExecutiveAlignment(
  customer: any,
  stakeholders: any[],
  meetings: any[]
): ReadinessDimension {
  const dataPoints: DataPoint[] = [];
  let totalScore = 0;
  let weights = 0;

  // Executive sponsor identified
  const execSponsor = stakeholders.find(s =>
    s.role?.toLowerCase().includes('vp') ||
    s.role?.toLowerCase().includes('director') ||
    s.role?.toLowerCase().includes('c-level') ||
    s.title?.toLowerCase().includes('chief') ||
    s.is_executive_sponsor
  );
  const hasSponsor = !!execSponsor;
  dataPoints.push({
    metric: 'Executive Sponsor',
    value: hasSponsor ? execSponsor.name || 'Identified' : 'Not Identified',
    benchmark: 'Identified',
    trend: 'stable',
    impact: hasSponsor ? 'positive' : 'negative',
  });
  totalScore += (hasSponsor ? 100 : 30) * 0.3;
  weights += 0.3;

  // Last executive meeting
  const execMeetings = meetings.filter(m =>
    m.attendees?.some((a: any) =>
      a.title?.toLowerCase().includes('vp') ||
      a.title?.toLowerCase().includes('director') ||
      a.title?.toLowerCase().includes('chief')
    ) || m.is_executive_meeting
  );
  const lastExecMeeting = execMeetings[0]?.scheduled_at;
  const daysSinceExec = lastExecMeeting
    ? Math.floor((Date.now() - new Date(lastExecMeeting).getTime()) / (24 * 60 * 60 * 1000))
    : 180;
  const execMeetingScore = daysSinceExec <= 30 ? 100 : daysSinceExec <= 60 ? 80 : daysSinceExec <= 90 ? 60 : 30;
  dataPoints.push({
    metric: 'Days Since Exec Meeting',
    value: daysSinceExec,
    benchmark: 'Less than 30',
    trend: daysSinceExec <= 60 ? 'stable' : 'down',
    impact: daysSinceExec <= 45 ? 'positive' : daysSinceExec <= 90 ? 'neutral' : 'negative',
  });
  totalScore += execMeetingScore * 0.3;
  weights += 0.3;

  // Strategic alignment documented
  const strategicAlignment = customer.strategic_alignment_score ?? 70;
  dataPoints.push({
    metric: 'Strategic Alignment',
    value: `${strategicAlignment}%`,
    benchmark: '80%',
    trend: strategicAlignment >= 75 ? 'up' : 'stable',
    impact: strategicAlignment >= 80 ? 'positive' : strategicAlignment >= 60 ? 'neutral' : 'negative',
  });
  totalScore += strategicAlignment * 0.25;
  weights += 0.25;

  // Internal exec sponsor (your side)
  const hasInternalSponsor = customer.internal_exec_sponsor ?? true;
  dataPoints.push({
    metric: 'Internal Exec Sponsor',
    value: hasInternalSponsor ? 'Assigned' : 'Not Assigned',
    benchmark: 'Assigned',
    trend: 'stable',
    impact: hasInternalSponsor ? 'positive' : 'negative',
  });
  totalScore += (hasInternalSponsor ? 100 : 50) * 0.15;
  weights += 0.15;

  const score = Math.round(totalScore / weights);
  const status = getStatus(score);

  const recommendations: string[] = [];
  if (!hasSponsor) recommendations.push('Identify and engage executive sponsor');
  if (daysSinceExec > 60) recommendations.push('Schedule executive briefing');
  if (strategicAlignment < 70) recommendations.push('Align on strategic objectives and roadmap');

  return {
    name: 'Executive Alignment',
    score,
    weight: 0.15,
    status,
    description: getExecutiveDescription(score),
    dataPoints,
    recommendations,
  };
}

function scoreFinancialHealth(customer: any, renewalInfo: any | null): ReadinessDimension {
  const dataPoints: DataPoint[] = [];
  let totalScore = 0;
  let weights = 0;

  // Payment status
  const paymentStatus = customer.payment_status ?? 'current';
  const paymentScore = paymentStatus === 'current' ? 100 : paymentStatus === 'late' ? 50 : 20;
  dataPoints.push({
    metric: 'Payment Status',
    value: paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1),
    benchmark: 'Current',
    trend: 'stable',
    impact: paymentStatus === 'current' ? 'positive' : 'negative',
  });
  totalScore += paymentScore * 0.3;
  weights += 0.3;

  // ARR trend
  const arrGrowth = customer.arr_growth_yoy ?? 5;
  const arrScore = arrGrowth >= 10 ? 100 : arrGrowth >= 0 ? 70 : arrGrowth >= -10 ? 40 : 20;
  dataPoints.push({
    metric: 'ARR Growth YoY',
    value: `${arrGrowth >= 0 ? '+' : ''}${arrGrowth}%`,
    benchmark: '+10%',
    trend: arrGrowth > 0 ? 'up' : arrGrowth < 0 ? 'down' : 'stable',
    impact: arrGrowth >= 5 ? 'positive' : arrGrowth >= 0 ? 'neutral' : 'negative',
  });
  totalScore += arrScore * 0.25;
  weights += 0.25;

  // Renewal likelihood (if applicable)
  const renewalLikelihood = renewalInfo?.likelihood ?? customer.renewal_probability ?? 75;
  dataPoints.push({
    metric: 'Renewal Likelihood',
    value: `${renewalLikelihood}%`,
    benchmark: '85%',
    trend: renewalLikelihood >= 80 ? 'up' : 'stable',
    impact: renewalLikelihood >= 85 ? 'positive' : renewalLikelihood >= 70 ? 'neutral' : 'negative',
  });
  totalScore += renewalLikelihood * 0.25;
  weights += 0.25;

  // Contract value vs benchmark
  const contractValue = customer.arr ?? customer.contract_value ?? 50000;
  const segmentBenchmark = customer.segment === 'enterprise' ? 100000 : customer.segment === 'mid-market' ? 30000 : 10000;
  const valueScore = Math.min(100, (contractValue / segmentBenchmark) * 80);
  dataPoints.push({
    metric: 'Contract Value',
    value: `$${(contractValue / 1000).toFixed(0)}K`,
    benchmark: `$${(segmentBenchmark / 1000).toFixed(0)}K`,
    trend: 'stable',
    impact: contractValue >= segmentBenchmark ? 'positive' : 'neutral',
  });
  totalScore += valueScore * 0.2;
  weights += 0.2;

  const score = Math.round(totalScore / weights);
  const status = getStatus(score);

  const recommendations: string[] = [];
  if (paymentStatus !== 'current') recommendations.push('Address payment issues with finance team');
  if (arrGrowth < 0) recommendations.push('Investigate revenue decline and develop retention strategy');
  if (renewalLikelihood < 70) recommendations.push('Develop renewal action plan');

  return {
    name: 'Financial Health',
    score,
    weight: 0.05,
    status,
    description: getFinancialDescription(score),
    dataPoints,
    recommendations,
  };
}

// ============================================
// Description Generators
// ============================================

function getAdoptionDescription(score: number): string {
  if (score >= 80) return 'Excellent product adoption with strong usage patterns';
  if (score >= 65) return 'Good adoption levels, some room for feature expansion';
  if (score >= 45) return 'Moderate adoption, needs attention to improve engagement';
  return 'Critical adoption gaps requiring immediate intervention';
}

function getEngagementDescription(score: number): string {
  if (score >= 80) return 'Strong stakeholder relationships across multiple contacts';
  if (score >= 65) return 'Good engagement, could expand to additional stakeholders';
  if (score >= 45) return 'Limited stakeholder engagement, needs relationship building';
  return 'Critical engagement gaps, risk of relationship loss';
}

function getValueDescription(score: number): string {
  if (score >= 80) return 'Strong value realization with documented ROI';
  if (score >= 65) return 'Good progress on value metrics, needs documentation';
  if (score >= 45) return 'Value realization unclear, needs success metric review';
  return 'Critical value gaps, customer may not see ROI';
}

function getSupportDescription(score: number): string {
  if (score >= 80) return 'Excellent support health with high satisfaction';
  if (score >= 65) return 'Good support relationship, minor issues to address';
  if (score >= 45) return 'Support concerns present, needs proactive management';
  return 'Critical support issues requiring immediate attention';
}

function getExecutiveDescription(score: number): string {
  if (score >= 80) return 'Strong executive alignment and sponsorship';
  if (score >= 65) return 'Good executive relationship, could strengthen further';
  if (score >= 45) return 'Limited executive engagement, needs uplevel';
  return 'No executive alignment, significant risk';
}

function getFinancialDescription(score: number): string {
  if (score >= 80) return 'Healthy financial relationship with growth potential';
  if (score >= 65) return 'Stable financial health, on track for renewal';
  if (score >= 45) return 'Some financial concerns to monitor';
  return 'Financial health issues requiring attention';
}

// ============================================
// Gap Analysis
// ============================================

function analyzeGaps(dimensions: Record<string, ReadinessDimension>): ReadinessGap[] {
  const gaps: ReadinessGap[] = [];

  for (const [key, dimension] of Object.entries(dimensions)) {
    if (dimension.status === 'gap' || dimension.status === 'critical') {
      const priority = getGapPriority(dimension.score, dimension.weight);

      gaps.push({
        dimension: dimension.name,
        score: dimension.score,
        priority,
        issue: getGapIssue(dimension),
        impact: getGapImpact(dimension, priority),
        suggestedAction: dimension.recommendations[0] || 'Review and address dimension issues',
        effort: getEffortEstimate(dimension),
        timeToAddress: getTimeEstimate(priority),
        isBlocker: dimension.status === 'critical' && dimension.weight >= 0.15,
      });
    }
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  gaps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return gaps;
}

function getGapIssue(dimension: ReadinessDimension): string {
  const lowPoints = dimension.dataPoints.filter(dp => dp.impact === 'negative');
  if (lowPoints.length > 0) {
    return lowPoints.map(dp => `${dp.metric}: ${dp.value}`).join(', ');
  }
  return `${dimension.name} score below threshold (${dimension.score}/100)`;
}

function getGapImpact(dimension: ReadinessDimension, priority: GapPriority): string {
  const impacts: Record<string, Record<GapPriority, string>> = {
    'Product Adoption': {
      critical: 'High risk of churn due to low engagement',
      high: 'Customer may not renew due to underutilization',
      medium: 'Potential for downsell or limited expansion',
      low: 'Missed opportunity for deeper adoption',
    },
    'Stakeholder Engagement': {
      critical: 'No relationships to protect during challenges',
      high: 'Limited visibility into customer priorities',
      medium: 'Risk of being blindsided by decisions',
      low: 'Could strengthen multi-threading',
    },
    'Value Realization': {
      critical: 'Customer cannot justify renewal internally',
      high: 'Weak renewal position without ROI proof',
      medium: 'Harder to justify expansion/upsell',
      low: 'Missing opportunity for case study',
    },
    'Support Health': {
      critical: 'Unresolved issues blocking success',
      high: 'Customer frustration affecting relationship',
      medium: 'Support issues may come up in renewal',
      low: 'Minor friction in customer experience',
    },
    'Executive Alignment': {
      critical: 'No executive sponsorship for renewal',
      high: 'Decisions made without your input',
      medium: 'Limited strategic partnership perception',
      low: 'Could elevate relationship level',
    },
    'Financial Health': {
      critical: 'Contract at risk due to payment issues',
      high: 'Revenue decline indicates dissatisfaction',
      medium: 'Limited expansion potential',
      low: 'Room for growth in contract value',
    },
  };

  return impacts[dimension.name]?.[priority] || 'Impact on milestone success';
}

function getEffortEstimate(dimension: ReadinessDimension): ActionEffort {
  if (dimension.score < 30) return 'high';
  if (dimension.score < 50) return 'medium';
  return 'low';
}

function getTimeEstimate(priority: GapPriority): string {
  switch (priority) {
    case 'critical': return '1-3 days';
    case 'high': return '1 week';
    case 'medium': return '2 weeks';
    case 'low': return '1 month';
  }
}

// ============================================
// Checklist Generation
// ============================================

function generateChecklist(
  gaps: ReadinessGap[],
  dimensions: Record<string, ReadinessDimension>,
  milestoneDate: string | null
): ChecklistItem[] {
  const checklist: ChecklistItem[] = [];
  const now = new Date();
  const milestone = milestoneDate ? new Date(milestoneDate) : null;

  // Add items from gaps
  for (const gap of gaps) {
    const dueDate = calculateDueDate(now, milestone, gap.priority);

    checklist.push({
      id: uuidv4(),
      task: gap.suggestedAction,
      description: `Address ${gap.dimension} gap: ${gap.issue}`,
      dueDate,
      priority: gap.priority,
      dimension: gap.dimension,
      completed: false,
      completedAt: null,
      assignee: null,
      notes: null,
    });
  }

  // Add additional recommendations from dimensions
  for (const dimension of Object.values(dimensions)) {
    for (let i = 1; i < dimension.recommendations.length; i++) {
      const rec = dimension.recommendations[i];
      const existingTask = checklist.find(c => c.task === rec);
      if (!existingTask) {
        checklist.push({
          id: uuidv4(),
          task: rec,
          description: `Improve ${dimension.name}`,
          dueDate: calculateDueDate(now, milestone, 'medium'),
          priority: 'medium',
          dimension: dimension.name,
          completed: false,
          completedAt: null,
          assignee: null,
          notes: null,
        });
      }
    }
  }

  // Sort by priority and due date
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  checklist.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    return 0;
  });

  return checklist;
}

function calculateDueDate(now: Date, milestone: Date | null, priority: GapPriority): string {
  const days = { critical: 3, high: 7, medium: 14, low: 30 };
  const priorityDays = days[priority];

  if (milestone) {
    const daysUntilMilestone = Math.floor((milestone.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const adjustedDays = Math.min(priorityDays, Math.max(1, daysUntilMilestone - 5));
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + adjustedDays);
    return dueDate.toISOString().split('T')[0];
  }

  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + priorityDays);
  return dueDate.toISOString().split('T')[0];
}

// ============================================
// AI Analysis
// ============================================

async function generateAiAnalysis(
  customer: any,
  dimensions: Record<string, ReadinessDimension>,
  gaps: ReadinessGap[],
  milestoneType: MilestoneType
): Promise<{ summary: string; recommendations: string[]; riskFactors: string[]; successFactors: string[] }> {
  const claudeService = new ClaudeService();

  const prompt = `Analyze this account readiness assessment for a ${milestoneType}:

Customer: ${customer.name}
Industry: ${customer.industry || 'Unknown'}
Segment: ${customer.segment || 'Unknown'}
ARR: $${(customer.arr || 0).toLocaleString()}

Dimension Scores:
${Object.values(dimensions).map(d => `- ${d.name}: ${d.score}/100 (${d.status})`).join('\n')}

Key Gaps:
${gaps.map(g => `- ${g.dimension}: ${g.issue} (${g.priority} priority)`).join('\n')}

Provide a JSON response with:
1. "summary": A 2-3 sentence executive summary of readiness
2. "recommendations": Array of 3-5 specific actions to improve readiness
3. "riskFactors": Array of 2-3 key risks to the ${milestoneType}
4. "successFactors": Array of 2-3 positive factors supporting success

Respond only with valid JSON.`;

  try {
    const response = await claudeService.generateContent(prompt);
    const parsed = JSON.parse(response);
    return {
      summary: parsed.summary || 'Assessment complete. Review gaps and take action.',
      recommendations: parsed.recommendations || [],
      riskFactors: parsed.riskFactors || [],
      successFactors: parsed.successFactors || [],
    };
  } catch (error) {
    console.error('AI analysis failed:', error);
    return {
      summary: generateFallbackSummary(dimensions, gaps, milestoneType),
      recommendations: gaps.slice(0, 5).map(g => g.suggestedAction),
      riskFactors: gaps.filter(g => g.isBlocker).map(g => `${g.dimension}: ${g.issue}`),
      successFactors: Object.values(dimensions)
        .filter(d => d.status === 'strong')
        .map(d => `Strong ${d.name} (${d.score}/100)`),
    };
  }
}

function generateFallbackSummary(
  dimensions: Record<string, ReadinessDimension>,
  gaps: ReadinessGap[],
  milestoneType: MilestoneType
): string {
  const avgScore = Math.round(
    Object.values(dimensions).reduce((sum, d) => sum + d.score, 0) / Object.keys(dimensions).length
  );
  const criticalGaps = gaps.filter(g => g.priority === 'critical').length;

  if (criticalGaps > 0) {
    return `Account requires immediate attention before ${milestoneType}. ${criticalGaps} critical gap(s) must be addressed. Overall readiness: ${avgScore}/100.`;
  }
  if (avgScore >= 75) {
    return `Account is well-positioned for ${milestoneType} with strong fundamentals. Minor gaps exist but are manageable. Overall readiness: ${avgScore}/100.`;
  }
  if (avgScore >= 50) {
    return `Account needs improvement before ${milestoneType}. Address identified gaps to strengthen position. Overall readiness: ${avgScore}/100.`;
  }
  return `Account has significant gaps that must be addressed before ${milestoneType}. Prioritize critical issues immediately. Overall readiness: ${avgScore}/100.`;
}

// ============================================
// Mock Data Functions
// ============================================

function getMockCustomerData(customerId: string): any {
  return {
    id: customerId,
    name: `Customer ${customerId.slice(0, 8)}`,
    industry: 'Technology',
    segment: 'mid-market',
    arr: 75000,
    healthScore: 72,
    featureAdoption: 68,
    csat_score: 4.2,
    renewal_probability: 75,
    payment_status: 'current',
    arr_growth_yoy: 5,
    success_metrics_achieved: 65,
    time_to_value_days: 45,
    business_outcomes_count: 2,
    strategic_alignment_score: 70,
  };
}

function getMockStakeholders(): any[] {
  return [
    { id: '1', name: 'John Smith', role: 'Director of Operations', is_champion: true, last_contact: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
    { id: '2', name: 'Sarah Johnson', role: 'VP of Technology', last_contact: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString() },
    { id: '3', name: 'Mike Wilson', role: 'Product Manager', last_contact: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
  ];
}

function getMockSupportTickets(): any[] {
  return [
    { id: '1', priority: 'P2', status: 'open', created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
    { id: '2', priority: 'P3', status: 'open', created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
  ];
}

function getMockRenewalInfo(): any {
  return {
    renewal_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    likelihood: 75,
    contract_value: 75000,
  };
}

function getMockMeetingHistory(): any[] {
  return [
    { id: '1', scheduled_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), type: 'check-in' },
    { id: '2', scheduled_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(), type: 'qbr' },
    { id: '3', scheduled_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), type: 'executive', is_executive_meeting: true },
  ];
}

function getMockUsageMetrics(): any {
  return {
    feature_adoption_rate: 68,
    active_user_percent: 62,
    weekly_logins: 4,
  };
}

// ============================================
// Main Assessment Function
// ============================================

export async function assessReadiness(
  customerId: string,
  options: AssessmentOptions
): Promise<ReadinessAssessmentResult> {
  const { milestoneType, milestoneDate, includeChecklist = true, includeAiAnalysis = true, customWeights } = options;

  // Collect data
  const [customer, healthHistory, stakeholders, tickets, renewalInfo, meetings, usageMetrics] = await Promise.all([
    getCustomerData(customerId),
    getHealthScoreHistory(customerId),
    getStakeholders(customerId),
    getSupportTickets(customerId),
    getRenewalInfo(customerId),
    getMeetingHistory(customerId),
    getUsageMetrics(customerId),
  ]);

  // Get weights for milestone type
  const weights = { ...DIMENSION_WEIGHTS[milestoneType], ...customWeights };

  // Score each dimension
  const dimensions = {
    productAdoption: scoreProductAdoption(customer, usageMetrics, healthHistory),
    stakeholderEngagement: scoreStakeholderEngagement(customer, stakeholders, meetings),
    valueRealization: scoreValueRealization(customer, usageMetrics),
    supportHealth: scoreSupportHealth(customer, tickets),
    executiveAlignment: scoreExecutiveAlignment(customer, stakeholders, meetings),
    financialHealth: scoreFinancialHealth(customer, renewalInfo),
  };

  // Apply custom weights
  for (const [key, dimension] of Object.entries(dimensions)) {
    if (weights[key] !== undefined) {
      dimension.weight = weights[key];
    }
  }

  // Calculate overall score
  let overallScore = 0;
  let totalWeight = 0;
  for (const dimension of Object.values(dimensions)) {
    overallScore += dimension.score * dimension.weight;
    totalWeight += dimension.weight;
  }
  overallScore = Math.round(overallScore / totalWeight);

  // Determine trend
  const previousAssessment = await getPreviousAssessment(customerId, milestoneType);
  const trend = previousAssessment
    ? overallScore > previousAssessment.overallScore + 3
      ? 'improving'
      : overallScore < previousAssessment.overallScore - 3
        ? 'declining'
        : 'stable'
    : 'stable';

  // Analyze gaps
  const gaps = analyzeGaps(dimensions);

  // Generate checklist
  const checklist = includeChecklist
    ? generateChecklist(gaps, dimensions, milestoneDate || null)
    : [];

  // Calculate days until milestone
  const daysUntilMilestone = milestoneDate
    ? Math.floor((new Date(milestoneDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null;

  // Generate AI analysis
  let aiAnalysis = { summary: '', recommendations: [] as string[], riskFactors: [] as string[], successFactors: [] as string[] };
  if (includeAiAnalysis) {
    aiAnalysis = await generateAiAnalysis(customer, dimensions, gaps, milestoneType);
  }

  // Calculate data quality
  const dataQuality = calculateDataQuality(customer, stakeholders, meetings, usageMetrics);

  // Calculate confidence
  const confidence = calculateConfidence(dataQuality, Object.values(dimensions));

  const result: ReadinessAssessmentResult = {
    assessmentId: uuidv4(),
    customerId,
    customerName: customer.name,
    milestoneType,
    milestoneDate: milestoneDate || null,
    daysUntilMilestone,
    overallScore,
    overallStatus: getStatus(overallScore),
    trend,
    dimensions,
    gaps,
    checklist,
    aiSummary: aiAnalysis.summary,
    aiRecommendations: aiAnalysis.recommendations,
    riskFactors: aiAnalysis.riskFactors,
    successFactors: aiAnalysis.successFactors,
    assessedAt: new Date().toISOString(),
    dataQuality,
    confidence,
  };

  // Save assessment
  await saveAssessment(result);

  return result;
}

// ============================================
// Helper Functions
// ============================================

function calculateDataQuality(
  customer: any,
  stakeholders: any[],
  meetings: any[],
  usageMetrics: any
): 'poor' | 'fair' | 'good' | 'excellent' {
  let score = 0;

  if (customer.arr) score += 1;
  if (customer.industry) score += 1;
  if (stakeholders.length >= 3) score += 2;
  if (stakeholders.length >= 1) score += 1;
  if (meetings.length >= 3) score += 2;
  if (usageMetrics?.feature_adoption_rate) score += 2;
  if (customer.csat_score) score += 1;

  if (score >= 8) return 'excellent';
  if (score >= 6) return 'good';
  if (score >= 4) return 'fair';
  return 'poor';
}

function calculateConfidence(dataQuality: string, dimensions: ReadinessDimension[]): number {
  const qualityMultiplier = { excellent: 1.0, good: 0.85, fair: 0.7, poor: 0.5 };
  const baseConfidence = qualityMultiplier[dataQuality as keyof typeof qualityMultiplier] || 0.7;

  // Adjust based on data point availability
  const avgDataPoints = dimensions.reduce((sum, d) => sum + d.dataPoints.length, 0) / dimensions.length;
  const dataPointBonus = Math.min(0.1, avgDataPoints * 0.02);

  return Math.round((baseConfidence + dataPointBonus) * 100);
}

async function getPreviousAssessment(customerId: string, milestoneType: MilestoneType): Promise<any | null> {
  if (!supabase) return null;

  const { data } = await supabase
    .from('readiness_assessments')
    .select('overall_score, assessed_at')
    .eq('customer_id', customerId)
    .eq('milestone_type', milestoneType)
    .order('assessed_at', { ascending: false })
    .limit(1)
    .single();

  return data ? { overallScore: data.overall_score } : null;
}

async function saveAssessment(result: ReadinessAssessmentResult): Promise<void> {
  if (!supabase) {
    console.log('Supabase not configured, skipping assessment save');
    return;
  }

  try {
    await supabase.from('readiness_assessments').insert({
      id: result.assessmentId,
      customer_id: result.customerId,
      milestone_type: result.milestoneType,
      milestone_date: result.milestoneDate,
      overall_score: result.overallScore,
      dimension_scores: {
        productAdoption: result.dimensions.productAdoption.score,
        stakeholderEngagement: result.dimensions.stakeholderEngagement.score,
        valueRealization: result.dimensions.valueRealization.score,
        supportHealth: result.dimensions.supportHealth.score,
        executiveAlignment: result.dimensions.executiveAlignment.score,
        financialHealth: result.dimensions.financialHealth.score,
      },
      gaps: result.gaps,
      checklist: result.checklist,
      assessed_at: result.assessedAt,
    });
  } catch (error) {
    console.error('Failed to save assessment:', error);
  }
}

// ============================================
// History Functions
// ============================================

export async function getReadinessHistory(
  customerId: string,
  milestoneType?: MilestoneType,
  limit: number = 10
): Promise<ReadinessHistoryEntry[]> {
  if (!supabase) return [];

  let query = supabase
    .from('readiness_assessments')
    .select('id, assessed_at, milestone_type, overall_score, dimension_scores, outcome, outcome_notes')
    .eq('customer_id', customerId)
    .order('assessed_at', { ascending: false })
    .limit(limit);

  if (milestoneType) {
    query = query.eq('milestone_type', milestoneType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch readiness history:', error);
    return [];
  }

  return (data || []).map(row => ({
    assessmentId: row.id,
    assessedAt: row.assessed_at,
    milestoneType: row.milestone_type,
    overallScore: row.overall_score,
    dimensionScores: row.dimension_scores,
    outcome: row.outcome,
    outcomeNotes: row.outcome_notes,
  }));
}

// ============================================
// Checklist Management
// ============================================

export async function updateChecklistItem(
  assessmentId: string,
  itemId: string,
  updates: Partial<ChecklistItem>
): Promise<boolean> {
  if (!supabase) return false;

  const { data: assessment, error: fetchError } = await supabase
    .from('readiness_assessments')
    .select('checklist')
    .eq('id', assessmentId)
    .single();

  if (fetchError || !assessment) return false;

  const checklist = assessment.checklist as ChecklistItem[];
  const itemIndex = checklist.findIndex(item => item.id === itemId);

  if (itemIndex === -1) return false;

  checklist[itemIndex] = { ...checklist[itemIndex], ...updates };

  if (updates.completed && !checklist[itemIndex].completedAt) {
    checklist[itemIndex].completedAt = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from('readiness_assessments')
    .update({ checklist })
    .eq('id', assessmentId);

  return !updateError;
}

export async function recordOutcome(
  assessmentId: string,
  outcome: 'success' | 'partial' | 'failed',
  notes?: string
): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('readiness_assessments')
    .update({
      outcome,
      outcome_notes: notes || null,
      outcome_recorded_at: new Date().toISOString(),
    })
    .eq('id', assessmentId);

  return !error;
}

// Export service
export const readinessAssessmentService = {
  assessReadiness,
  getReadinessHistory,
  updateChecklistItem,
  recordOutcome,
};
