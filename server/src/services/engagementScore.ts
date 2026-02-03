/**
 * Engagement Score Service
 * PRD-070: Engagement Score Breakdown calculation and analytics
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// TYPES
// ============================================

export type EngagementStatus = 'healthy' | 'warning' | 'critical';
export type EngagementTrend = 'improving' | 'stable' | 'declining';
export type TrendDirection = 'up' | 'flat' | 'down';

export interface EngagementFactor {
  name: string;
  current: number;
  target: number;
  weight: number;
  contribution: number;
  status: EngagementStatus;
  trend: TrendDirection;
  healthyRange: {
    min: number;
    max?: number;
    unit: string;
  };
}

export interface ComponentDetail {
  score: number;
  weight: number;
  factors: EngagementFactor[];
  highlights: {
    positive: string[];
    concerns: string[];
    rootCause?: string[];
  };
  actions: string[];
}

export interface EngagementScoreBreakdown {
  overall: number;
  trend: EngagementTrend;
  components: {
    communication: ComponentDetail;
    product: ComponentDetail;
    relationship: ComponentDetail;
  };
  riskFactors: string[];
  recommendations: EngagementRecommendation[];
}

export interface EngagementRecommendation {
  id: string;
  category: 'communication' | 'product' | 'relationship';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  actions: Array<{
    id: string;
    label: string;
    type: string;
    data?: Record<string, unknown>;
  }>;
}

export interface EngagementHistoryPoint {
  date: string;
  month: string;
  communication: number;
  product: number;
  relationship: number;
  overall: number;
}

export interface PeerComparison {
  overall: { customerScore: number; peerAvg: number; percentile: number };
  communication: { customerScore: number; peerAvg: number; percentile: number };
  product: { customerScore: number; peerAvg: number; percentile: number };
  relationship: { customerScore: number; peerAvg: number; percentile: number };
}

export interface ImpactAnalysis {
  improvement: {
    targetScore: number;
    renewalProbabilityChange: number;
    expansionLikelihoodChange: number;
    referencePotential: 'high' | 'medium' | 'low';
  };
  decline: {
    targetScore: number;
    churnRiskChange: number;
    healthScoreImpact: number;
    recommendation: string;
  };
}

// ============================================
// CONSTANTS
// ============================================

const ENGAGEMENT_WEIGHTS = {
  communication: 0.50,
  product: 0.40,
  relationship: 0.10,
};

const ENGAGEMENT_THRESHOLDS = {
  healthy: { min: 70 },
  warning: { min: 50, max: 69 },
  critical: { min: 0, max: 49 },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getStatus(score: number): EngagementStatus {
  if (score >= ENGAGEMENT_THRESHOLDS.healthy.min) return 'healthy';
  if (score >= ENGAGEMENT_THRESHOLDS.warning.min) return 'warning';
  return 'critical';
}

function getTrend(current: number, previous: number): EngagementTrend {
  const change = current - previous;
  if (change >= 5) return 'improving';
  if (change <= -5) return 'declining';
  return 'stable';
}

function getFactorTrend(current: number, previous: number): TrendDirection {
  const change = current - previous;
  if (change > 0) return 'up';
  if (change < 0) return 'down';
  return 'flat';
}

function calculateDaysToRenewal(renewalDate: string | null): number | null {
  if (!renewalDate) return null;
  const renewal = new Date(renewalDate);
  const now = new Date();
  const diffTime = renewal.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// ============================================
// MOCK DATA GENERATORS
// ============================================

function generateMockCommunicationData(baseScore: number): ComponentDetail {
  const emailResponseRate = Math.min(100, Math.max(40, baseScore + Math.random() * 20 - 10));
  const responseTime = Math.max(4, 48 - (baseScore / 100) * 30 + Math.random() * 10);
  const meetingAttendance = Math.min(100, Math.max(60, baseScore - 5 + Math.random() * 15));
  const proactiveOutreach = Math.max(0, Math.floor(baseScore / 30) + Math.floor(Math.random() * 2));

  const factors: EngagementFactor[] = [
    {
      name: 'Email Response Rate',
      current: Math.round(emailResponseRate),
      target: 70,
      weight: 0.15,
      contribution: Math.round(emailResponseRate >= 70 ? 15 : (emailResponseRate / 70) * 15),
      status: getStatus(emailResponseRate >= 70 ? 100 : (emailResponseRate / 70) * 100),
      trend: Math.random() > 0.5 ? 'up' : 'flat',
      healthyRange: { min: 70, unit: '%' },
    },
    {
      name: 'Response Time',
      current: Math.round(responseTime),
      target: 24,
      weight: 0.10,
      contribution: Math.round(responseTime <= 24 ? 10 : Math.max(0, (24 / responseTime) * 10)),
      status: getStatus(responseTime <= 24 ? 100 : Math.max(0, (1 - (responseTime - 24) / 24) * 100)),
      trend: responseTime <= 24 ? 'up' : 'down',
      healthyRange: { min: 24, unit: 'hours' },
    },
    {
      name: 'Meeting Attendance',
      current: Math.round(meetingAttendance),
      target: 90,
      weight: 0.15,
      contribution: Math.round((meetingAttendance / 90) * 15),
      status: getStatus((meetingAttendance / 90) * 100),
      trend: meetingAttendance >= 85 ? 'up' : 'down',
      healthyRange: { min: 90, unit: '%' },
    },
    {
      name: 'Proactive Outreach',
      current: proactiveOutreach,
      target: 1,
      weight: 0.10,
      contribution: Math.round(proactiveOutreach >= 1 ? 10 : proactiveOutreach * 10),
      status: getStatus(proactiveOutreach >= 1 ? 100 : proactiveOutreach * 100),
      trend: proactiveOutreach >= 2 ? 'up' : 'flat',
      healthyRange: { min: 1, unit: '/month' },
    },
  ];

  const score = Math.round(factors.reduce((sum, f) => sum + f.contribution, 0) * 2);
  const highlights = {
    positive: [] as string[],
    concerns: [] as string[],
  };

  if (emailResponseRate >= 70) {
    highlights.positive.push(`Excellent email responsiveness (${Math.round(emailResponseRate)}% vs 70% target)`);
  }
  if (proactiveOutreach >= 2) {
    highlights.positive.push(`Customer initiated ${proactiveOutreach} conversations this month`);
  }
  if (meetingAttendance < 90) {
    highlights.concerns.push(`Meeting attendance dipped (${Math.round(meetingAttendance)}% vs 90% target)`);
  }
  if (responseTime > 24) {
    highlights.concerns.push(`Response time above target (${Math.round(responseTime)}h vs 24h target)`);
  }

  const actions: string[] = [];
  if (meetingAttendance < 90) {
    actions.push('Send calendar reminders day before meetings');
  }
  if (proactiveOutreach >= 2) {
    actions.push('Acknowledge their proactive engagement');
  }

  return {
    score,
    weight: ENGAGEMENT_WEIGHTS.communication,
    factors,
    highlights,
    actions,
  };
}

function generateMockProductData(baseScore: number): ComponentDetail {
  const loginFrequency = Math.max(0.5, (baseScore / 100) * 4 + Math.random() * 1);
  const featureBreadth = Math.min(100, Math.max(20, baseScore - 10 + Math.random() * 20));
  const sessionDuration = Math.max(5, (baseScore / 100) * 20 + Math.random() * 10);
  const activeUserPercent = Math.min(100, Math.max(30, baseScore - 15 + Math.random() * 20));

  const factors: EngagementFactor[] = [
    {
      name: 'Login Frequency',
      current: Math.round(loginFrequency * 10) / 10,
      target: 3,
      weight: 0.15,
      contribution: Math.round(Math.min(15, (loginFrequency / 3) * 15)),
      status: getStatus((loginFrequency / 3) * 100),
      trend: loginFrequency >= 3 ? 'up' : 'down',
      healthyRange: { min: 3, unit: '/week' },
    },
    {
      name: 'Feature Breadth',
      current: Math.round(featureBreadth),
      target: 50,
      weight: 0.10,
      contribution: Math.round(Math.min(10, (featureBreadth / 50) * 10)),
      status: getStatus((featureBreadth / 50) * 100),
      trend: featureBreadth >= 45 ? 'up' : 'flat',
      healthyRange: { min: 50, unit: '%' },
    },
    {
      name: 'Session Duration',
      current: Math.round(sessionDuration),
      target: 15,
      weight: 0.05,
      contribution: Math.round(Math.min(5, (sessionDuration / 15) * 5)),
      status: getStatus((sessionDuration / 15) * 100),
      trend: sessionDuration >= 15 ? 'up' : 'flat',
      healthyRange: { min: 15, unit: 'min' },
    },
    {
      name: 'Active User %',
      current: Math.round(activeUserPercent),
      target: 70,
      weight: 0.10,
      contribution: Math.round(Math.min(10, (activeUserPercent / 70) * 10)),
      status: getStatus((activeUserPercent / 70) * 100),
      trend: activeUserPercent >= 65 ? 'up' : 'down',
      healthyRange: { min: 70, unit: '%' },
    },
  ];

  const score = Math.round(factors.reduce((sum, f) => sum + f.contribution, 0) * 2.5);
  const highlights = {
    positive: [] as string[],
    concerns: [] as string[],
    rootCause: [] as string[],
  };

  if (featureBreadth >= 45) {
    highlights.positive.push(`Feature breadth improving (${Math.round(featureBreadth)}% up from previous period)`);
  }
  if (loginFrequency < 3) {
    highlights.concerns.push(`Login frequency below target (${loginFrequency.toFixed(1)} vs 3/week)`);
  }
  if (activeUserPercent < 70) {
    highlights.concerns.push(`Active users declining (was ${Math.round(activeUserPercent + 7)}% last month)`);
  }
  if (loginFrequency < 3 || activeUserPercent < 70) {
    highlights.rootCause = [
      'Power users may be on holiday or transitioning',
      'Feature requests pending (users waiting for capability)',
    ];
  }

  const actions: string[] = [];
  if (loginFrequency < 3) {
    actions.push('Schedule usage review meeting');
  }
  if (featureBreadth < 50) {
    actions.push('Address top feature request status');
  }
  if (activeUserPercent < 70) {
    actions.push('Identify inactive users for re-engagement');
  }

  return {
    score,
    weight: ENGAGEMENT_WEIGHTS.product,
    factors,
    highlights,
    actions,
  };
}

function generateMockRelationshipData(baseScore: number): ComponentDetail {
  const stakeholderDepth = Math.max(1, Math.floor(baseScore / 25) + Math.floor(Math.random() * 2));
  const executiveDaysAgo = Math.max(7, Math.floor(120 - baseScore) + Math.floor(Math.random() * 30));
  const championActive = baseScore > 60 && Math.random() > 0.3;

  const factors: EngagementFactor[] = [
    {
      name: 'Stakeholder Depth',
      current: stakeholderDepth,
      target: 3,
      weight: 0.05,
      contribution: Math.round(Math.min(5, (stakeholderDepth / 3) * 5)),
      status: getStatus(stakeholderDepth >= 3 ? 100 : (stakeholderDepth / 3) * 100),
      trend: stakeholderDepth >= 3 ? 'up' : 'flat',
      healthyRange: { min: 3, unit: 'contacts' },
    },
    {
      name: 'Executive Access',
      current: executiveDaysAgo,
      target: 90,
      weight: 0.03,
      contribution: Math.round(executiveDaysAgo <= 90 ? 3 : Math.max(0, (90 / executiveDaysAgo) * 3)),
      status: getStatus(executiveDaysAgo <= 90 ? 80 : Math.max(0, (1 - (executiveDaysAgo - 90) / 90) * 100)),
      trend: executiveDaysAgo <= 60 ? 'up' : 'down',
      healthyRange: { min: 90, unit: 'days' },
    },
    {
      name: 'Champion Activity',
      current: championActive ? 1 : 0,
      target: 1,
      weight: 0.02,
      contribution: championActive ? 2 : 0,
      status: championActive ? 'healthy' : 'warning',
      trend: championActive ? 'up' : 'flat',
      healthyRange: { min: 1, unit: '/month' },
    },
  ];

  const score = Math.round(factors.reduce((sum, f) => sum + f.contribution, 0) * 10);
  const highlights = {
    positive: [] as string[],
    concerns: [] as string[],
  };

  if (stakeholderDepth >= 3) {
    highlights.positive.push(`Good multi-threading (${stakeholderDepth} engaged stakeholders)`);
  }
  if (championActive) {
    highlights.positive.push('Champion engaged and active');
  }
  if (executiveDaysAgo > 90) {
    highlights.concerns.push(`Exec sponsor not contacted in ${executiveDaysAgo} days`);
  }

  const actions: string[] = [];
  if (executiveDaysAgo > 60) {
    actions.push(`Schedule exec check-in (overdue by ${executiveDaysAgo - 60} days)`);
  }

  return {
    score,
    weight: ENGAGEMENT_WEIGHTS.relationship,
    factors,
    highlights,
    actions,
  };
}

function generateMockHistory(baseScore: number, months: number = 6): EngagementHistoryPoint[] {
  const history: EngagementHistoryPoint[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthVariation = Math.sin(i / 2) * 10 + Math.random() * 8 - 4;

    const communication = Math.round(Math.min(100, Math.max(40, baseScore * 1.1 + monthVariation)));
    const product = Math.round(Math.min(100, Math.max(30, baseScore * 0.9 + monthVariation - 5)));
    const relationship = Math.round(Math.min(100, Math.max(50, baseScore + Math.random() * 10 - 5)));
    const overall = Math.round(
      communication * ENGAGEMENT_WEIGHTS.communication +
      product * ENGAGEMENT_WEIGHTS.product +
      relationship * ENGAGEMENT_WEIGHTS.relationship
    );

    history.push({
      date: date.toISOString().split('T')[0],
      month: date.toLocaleString('en-US', { month: 'short' }),
      communication,
      product,
      relationship,
      overall,
    });
  }

  return history;
}

function generatePeerComparison(scores: { communication: number; product: number; relationship: number; overall: number }): PeerComparison {
  const peerAvgOverall = 68;
  const peerAvgCommunication = 70;
  const peerAvgProduct = 66;
  const peerAvgRelationship = 68;

  return {
    overall: {
      customerScore: scores.overall,
      peerAvg: peerAvgOverall,
      percentile: Math.round(Math.min(99, Math.max(1, 50 + (scores.overall - peerAvgOverall) * 2.5))),
    },
    communication: {
      customerScore: scores.communication,
      peerAvg: peerAvgCommunication,
      percentile: Math.round(Math.min(99, Math.max(1, 50 + (scores.communication - peerAvgCommunication) * 2))),
    },
    product: {
      customerScore: scores.product,
      peerAvg: peerAvgProduct,
      percentile: Math.round(Math.min(99, Math.max(1, 50 + (scores.product - peerAvgProduct) * 2))),
    },
    relationship: {
      customerScore: scores.relationship,
      peerAvg: peerAvgRelationship,
      percentile: Math.round(Math.min(99, Math.max(1, 50 + (scores.relationship - peerAvgRelationship) * 2))),
    },
  };
}

function generateImpactAnalysis(currentScore: number): ImpactAnalysis {
  return {
    improvement: {
      targetScore: 85,
      renewalProbabilityChange: 15,
      expansionLikelihoodChange: 25,
      referencePotential: 'high',
    },
    decline: {
      targetScore: 60,
      churnRiskChange: 40,
      healthScoreImpact: -12,
      recommendation: 'Save play may be needed',
    },
  };
}

function generateRecommendations(
  communication: ComponentDetail,
  product: ComponentDetail,
  relationship: ComponentDetail
): EngagementRecommendation[] {
  const recommendations: EngagementRecommendation[] = [];

  // Product engagement recommendation (typically highest impact)
  if (product.score < 70) {
    recommendations.push({
      id: generateId(),
      category: 'product',
      priority: 'high',
      title: 'Improve Product Engagement',
      description: 'Re-engage inactive users with personalized outreach',
      impact: 'Highest impact on overall engagement score',
      actions: [
        { id: generateId(), label: 'View Inactive Users', type: 'view_users' },
        { id: generateId(), label: 'Create Re-engagement Campaign', type: 'create_campaign' },
        { id: generateId(), label: 'Schedule Feature Training', type: 'schedule_meeting' },
      ],
    });
  }

  // Executive relationship recommendation
  const execFactor = relationship.factors.find(f => f.name === 'Executive Access');
  if (execFactor && execFactor.current > 60) {
    recommendations.push({
      id: generateId(),
      category: 'relationship',
      priority: 'medium',
      title: 'Executive Relationship',
      description: `Schedule quarterly check-in (last contact: ${execFactor.current} days ago)`,
      impact: 'Strengthens strategic partnership',
      actions: [
        { id: generateId(), label: 'Draft Exec Meeting Request', type: 'send_email' },
        { id: generateId(), label: 'Schedule Exec Meeting', type: 'schedule_meeting' },
      ],
    });
  }

  // Meeting attendance recommendation
  const meetingFactor = communication.factors.find(f => f.name === 'Meeting Attendance');
  if (meetingFactor && meetingFactor.current < 90) {
    recommendations.push({
      id: generateId(),
      category: 'communication',
      priority: 'low',
      title: 'Meeting Attendance',
      description: 'Add calendar reminders for all attendees',
      impact: 'Improves communication score',
      actions: [
        { id: generateId(), label: 'Configure Reminders', type: 'schedule_meeting' },
      ],
    });
  }

  return recommendations;
}

// ============================================
// SERVICE CLASS
// ============================================

class EngagementScoreService {
  /**
   * Get engagement score breakdown for a customer
   */
  async getEngagementScoreBreakdown(
    customerId: string,
    period: string = '30d',
    _comparePeriod: string = 'previous'
  ): Promise<{
    customer: {
      id: string;
      name: string;
      arr: number;
      segment: string;
      industry?: string;
      renewalDate?: string;
      daysToRenewal?: number;
    };
    score: EngagementScoreBreakdown;
    composition: Array<{
      name: string;
      score: number;
      weight: number;
      contribution: number;
      status: EngagementStatus;
    }>;
    componentDetails: {
      communication: ComponentDetail;
      product: ComponentDetail;
      relationship: ComponentDetail;
    };
    history: EngagementHistoryPoint[];
    trendAnalysis: Array<{ pattern: string; insight: string; recommendation?: string }>;
    peerComparison: PeerComparison;
    impactAnalysis: ImpactAnalysis;
    updatedAt: string;
  } | null> {
    try {
      let customer: any = null;

      // Fetch customer from Supabase
      if (supabase) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single();

        if (!error && data) {
          customer = data;
        }
      }

      // Mock customer if not found
      if (!customer) {
        customer = {
          id: customerId,
          name: 'Acme Corporation',
          arr: 120000,
          health_score: 72,
          industry: 'Technology',
          segment: 'Enterprise',
          renewal_date: '2026-06-15',
        };
      }

      const baseScore = customer.health_score || 70;

      // Generate component data
      const communication = generateMockCommunicationData(baseScore);
      const product = generateMockProductData(baseScore);
      const relationship = generateMockRelationshipData(baseScore);

      // Calculate overall score
      const overall = Math.round(
        communication.score * communication.weight +
        product.score * product.weight +
        relationship.score * relationship.weight
      );

      // Generate history
      const history = generateMockHistory(baseScore);
      const previousScore = history[history.length - 2]?.overall || overall;

      // Generate recommendations
      const recommendations = generateRecommendations(communication, product, relationship);

      // Identify risk factors
      const riskFactors: string[] = [];
      if (product.score < 60) riskFactors.push('Low product engagement');
      if (communication.factors.some(f => f.name === 'Meeting Attendance' && f.current < 85)) {
        riskFactors.push('Declining meeting attendance');
      }
      const execFactor = relationship.factors.find(f => f.name === 'Executive Access');
      if (execFactor && execFactor.current > 90) {
        riskFactors.push('Executive relationship needs attention');
      }

      // Trend analysis
      const trendAnalysis = [
        {
          pattern: 'Communication consistently strong',
          insight: 'Customer maintains good responsiveness',
        },
        {
          pattern: 'Product engagement volatile',
          insight: 'Holiday impact visible in usage patterns',
          recommendation: 'Consider seasonal adjustment in expectations',
        },
        {
          pattern: 'Relationship stable but exec engagement lagging',
          insight: 'Multi-threading is good but executive sponsor needs attention',
        },
      ];

      return {
        customer: {
          id: customer.id,
          name: customer.name,
          arr: customer.arr || 0,
          segment: customer.segment || customer.industry || 'Unknown',
          industry: customer.industry,
          renewalDate: customer.renewal_date,
          daysToRenewal: calculateDaysToRenewal(customer.renewal_date),
        },
        score: {
          overall,
          trend: getTrend(overall, previousScore),
          components: {
            communication,
            product,
            relationship,
          },
          riskFactors,
          recommendations,
        },
        composition: [
          {
            name: 'Communication',
            score: communication.score,
            weight: communication.weight,
            contribution: Math.round(communication.score * communication.weight),
            status: getStatus(communication.score),
          },
          {
            name: 'Product',
            score: product.score,
            weight: product.weight,
            contribution: Math.round(product.score * product.weight),
            status: getStatus(product.score),
          },
          {
            name: 'Relationship',
            score: relationship.score,
            weight: relationship.weight,
            contribution: Math.round(relationship.score * relationship.weight),
            status: getStatus(relationship.score),
          },
        ],
        componentDetails: {
          communication,
          product,
          relationship,
        },
        history,
        trendAnalysis,
        peerComparison: generatePeerComparison({
          communication: communication.score,
          product: product.score,
          relationship: relationship.score,
          overall,
        }),
        impactAnalysis: generateImpactAnalysis(overall),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Engagement score breakdown error:', error);
      return null;
    }
  }

  /**
   * Get engagement score trends for a customer
   */
  async getEngagementTrends(
    customerId: string,
    months: number = 6
  ): Promise<EngagementHistoryPoint[]> {
    try {
      let customer: any = null;

      if (supabase) {
        const { data } = await supabase
          .from('customers')
          .select('health_score')
          .eq('id', customerId)
          .single();

        if (data) {
          customer = data;
        }
      }

      const baseScore = customer?.health_score || 70;
      return generateMockHistory(baseScore, months);
    } catch (error) {
      console.error('Engagement trends error:', error);
      return [];
    }
  }

  /**
   * Get alerts for engagement score changes
   */
  async getEngagementAlerts(customerId: string): Promise<Array<{
    type: string;
    severity: 'high' | 'medium' | 'critical';
    message: string;
    threshold: number;
    currentValue: number;
    triggeredAt: string;
  }>> {
    try {
      const breakdown = await this.getEngagementScoreBreakdown(customerId);
      if (!breakdown) return [];

      const alerts: Array<{
        type: string;
        severity: 'high' | 'medium' | 'critical';
        message: string;
        threshold: number;
        currentValue: number;
        triggeredAt: string;
      }> = [];

      // Check for overall score drop
      const recentHistory = breakdown.history.slice(-2);
      if (recentHistory.length === 2) {
        const scoreChange = recentHistory[1].overall - recentHistory[0].overall;
        if (scoreChange <= -10) {
          alerts.push({
            type: 'score_drop',
            severity: 'high',
            message: `Engagement score dropped ${Math.abs(scoreChange)} points`,
            threshold: -10,
            currentValue: scoreChange,
            triggeredAt: new Date().toISOString(),
          });
        }
      }

      // Check for critical components
      breakdown.composition.forEach(comp => {
        if (comp.score < 50) {
          alerts.push({
            type: 'component_critical',
            severity: 'medium',
            message: `${comp.name} engagement is critical (${comp.score}/100)`,
            threshold: 50,
            currentValue: comp.score,
            triggeredAt: new Date().toISOString(),
          });
        }
      });

      // Check for overall critical
      if (breakdown.score.overall < 50) {
        alerts.push({
          type: 'overall_critical',
          severity: 'critical',
          message: `Overall engagement score is critical (${breakdown.score.overall}/100)`,
          threshold: 50,
          currentValue: breakdown.score.overall,
          triggeredAt: new Date().toISOString(),
        });
      }

      return alerts;
    } catch (error) {
      console.error('Engagement alerts error:', error);
      return [];
    }
  }
}

export const engagementScoreService = new EngagementScoreService();
