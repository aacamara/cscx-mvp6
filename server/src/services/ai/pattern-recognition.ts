/**
 * AI Pattern Recognition Service (PRD-233)
 *
 * Identifies behavioral patterns across customer interactions to enhance meeting prep:
 * - Communication patterns (response times, preferred channels)
 * - Engagement patterns (active times, feature usage trends)
 * - Risk patterns (declining metrics, stakeholder changes)
 * - Success patterns (adoption milestones, expansion signals)
 * - Meeting patterns (attendance, follow-up completion)
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Initialize clients
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ==================== Types ====================

export type PatternType =
  | 'communication'
  | 'engagement'
  | 'risk'
  | 'success'
  | 'meeting'
  | 'stakeholder'
  | 'usage';

export type PatternSeverity = 'info' | 'warning' | 'critical' | 'positive';

export type PatternConfidence = 'low' | 'medium' | 'high';

export interface DetectedPattern {
  id: string;
  customerId: string;
  type: PatternType;
  name: string;
  description: string;
  severity: PatternSeverity;
  confidence: PatternConfidence;
  confidenceScore: number; // 0-100
  dataPoints: PatternDataPoint[];
  insight: string;
  suggestedAction?: string;
  relatedPatterns?: string[];
  detectedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface PatternDataPoint {
  source: string;
  value: string | number;
  timestamp: string;
  weight: number;
}

export interface PatternAnalysisResult {
  customerId: string;
  customerName: string;
  patterns: DetectedPattern[];
  summary: string;
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  topInsights: string[];
  recommendedActions: string[];
  analysisTimestamp: Date;
  dataQuality: number; // 0-100
}

export interface PatternRecognitionParams {
  customerId: string;
  lookbackDays?: number;
  patternTypes?: PatternType[];
  includeAISummary?: boolean;
  forceRefresh?: boolean;
}

export interface CustomerDataContext {
  customer: Record<string, unknown> | null;
  interactions: InteractionRecord[];
  usageMetrics: UsageMetricRecord[];
  meetings: MeetingRecord[];
  healthHistory: HealthHistoryRecord[];
  stakeholders: StakeholderRecord[];
  supportTickets: SupportTicketRecord[];
}

interface InteractionRecord {
  type: string;
  timestamp: string;
  sentiment?: string;
  responseTime?: number;
  channel?: string;
}

interface UsageMetricRecord {
  date: string;
  dau: number;
  mau: number;
  featuresUsed: string[];
  sessionDuration: number;
}

interface MeetingRecord {
  date: string;
  type: string;
  attendees: number;
  followUpCompleted: boolean;
  sentiment?: string;
}

interface HealthHistoryRecord {
  date: string;
  score: number;
}

interface StakeholderRecord {
  name: string;
  role: string;
  sentiment?: string;
  lastContact?: string;
  isChampion?: boolean;
}

interface SupportTicketRecord {
  date: string;
  priority: string;
  status: string;
  category?: string;
  resolutionTime?: number;
}

// ==================== Pattern Detection Rules ====================

const PATTERN_RULES: Record<PatternType, PatternRule[]> = {
  communication: [
    {
      name: 'Slow Response Pattern',
      check: (ctx) => {
        const avgResponseTime = calculateAverageResponseTime(ctx.interactions);
        return avgResponseTime > 48; // hours
      },
      severity: 'warning',
      insight: 'Customer typically takes longer to respond to communications',
      action: 'Consider scheduling follow-ups further in advance'
    },
    {
      name: 'Preferred Email Channel',
      check: (ctx) => {
        const emailRate = ctx.interactions.filter(i => i.channel === 'email').length / Math.max(ctx.interactions.length, 1);
        return emailRate > 0.7;
      },
      severity: 'info',
      insight: 'Customer prefers email communication over other channels',
      action: 'Prioritize email for important updates'
    },
    {
      name: 'Communication Gap',
      check: (ctx) => {
        const daysSinceLastContact = ctx.interactions.length > 0
          ? Math.floor((Date.now() - new Date(ctx.interactions[0].timestamp).getTime()) / (1000 * 60 * 60 * 24))
          : 999;
        return daysSinceLastContact > 30;
      },
      severity: 'warning',
      insight: 'No communication with customer in over 30 days',
      action: 'Schedule a check-in call to re-engage'
    }
  ],
  engagement: [
    {
      name: 'Declining Usage Trend',
      check: (ctx) => {
        if (ctx.usageMetrics.length < 2) return false;
        const recent = ctx.usageMetrics.slice(-7);
        const earlier = ctx.usageMetrics.slice(-14, -7);
        const recentAvg = recent.reduce((sum, m) => sum + m.dau, 0) / recent.length;
        const earlierAvg = earlier.reduce((sum, m) => sum + m.dau, 0) / Math.max(earlier.length, 1);
        return earlierAvg > 0 && (recentAvg / earlierAvg) < 0.7;
      },
      severity: 'warning',
      insight: 'Daily active users declining significantly',
      action: 'Investigate usage drop and schedule adoption review'
    },
    {
      name: 'Feature Concentration',
      check: (ctx) => {
        if (ctx.usageMetrics.length < 7) return false;
        const allFeatures = ctx.usageMetrics.flatMap(m => m.featuresUsed);
        const uniqueFeatures = new Set(allFeatures);
        return uniqueFeatures.size <= 3;
      },
      severity: 'info',
      insight: 'Customer primarily uses limited set of features',
      action: 'Offer training on underutilized features'
    },
    {
      name: 'High Engagement Pattern',
      check: (ctx) => {
        if (ctx.usageMetrics.length < 7) return false;
        const avgDau = ctx.usageMetrics.reduce((sum, m) => sum + m.dau, 0) / ctx.usageMetrics.length;
        const avgMau = ctx.usageMetrics.reduce((sum, m) => sum + m.mau, 0) / ctx.usageMetrics.length;
        return avgMau > 0 && (avgDau / avgMau) > 0.3;
      },
      severity: 'positive',
      insight: 'Customer shows high daily engagement (DAU/MAU > 30%)',
      action: 'Leverage for case study or referral opportunity'
    }
  ],
  risk: [
    {
      name: 'Health Score Decline',
      check: (ctx) => {
        if (ctx.healthHistory.length < 2) return false;
        const recent = ctx.healthHistory[ctx.healthHistory.length - 1]?.score || 0;
        const earlier = ctx.healthHistory[0]?.score || recent;
        return (earlier - recent) > 15;
      },
      severity: 'critical',
      insight: 'Health score has dropped significantly',
      action: 'Initiate risk mitigation playbook immediately'
    },
    {
      name: 'Support Ticket Spike',
      check: (ctx) => {
        const recentTickets = ctx.supportTickets.filter(t => {
          const ticketDate = new Date(t.date);
          return (Date.now() - ticketDate.getTime()) < 14 * 24 * 60 * 60 * 1000;
        });
        return recentTickets.length >= 5;
      },
      severity: 'warning',
      insight: 'Elevated support ticket volume in recent weeks',
      action: 'Review tickets and consider proactive escalation'
    },
    {
      name: 'Champion Risk',
      check: (ctx) => {
        const champions = ctx.stakeholders.filter(s => s.isChampion);
        if (champions.length === 0) return true;
        const hasNegativeChampion = champions.some(c => c.sentiment === 'negative');
        return hasNegativeChampion;
      },
      severity: 'critical',
      insight: 'Champion stakeholder showing negative sentiment or missing',
      action: 'Prioritize relationship building with key contacts'
    }
  ],
  success: [
    {
      name: 'Adoption Milestone',
      check: (ctx) => {
        if (ctx.usageMetrics.length < 7) return false;
        const recentFeatures = ctx.usageMetrics.slice(-7).flatMap(m => m.featuresUsed);
        const uniqueFeatures = new Set(recentFeatures);
        return uniqueFeatures.size >= 5;
      },
      severity: 'positive',
      insight: 'Customer actively using 5+ features',
      action: 'Celebrate milestone and discuss advanced use cases'
    },
    {
      name: 'Expansion Signal',
      check: (ctx) => {
        if (ctx.usageMetrics.length < 14) return false;
        const recent = ctx.usageMetrics.slice(-7);
        const earlier = ctx.usageMetrics.slice(-14, -7);
        const recentAvg = recent.reduce((sum, m) => sum + m.mau, 0) / recent.length;
        const earlierAvg = earlier.reduce((sum, m) => sum + m.mau, 0) / Math.max(earlier.length, 1);
        return earlierAvg > 0 && (recentAvg / earlierAvg) > 1.3;
      },
      severity: 'positive',
      insight: 'User base growing significantly - expansion opportunity',
      action: 'Discuss additional seats or premium features'
    }
  ],
  meeting: [
    {
      name: 'Low Meeting Attendance',
      check: (ctx) => {
        if (ctx.meetings.length < 3) return false;
        const avgAttendees = ctx.meetings.reduce((sum, m) => sum + m.attendees, 0) / ctx.meetings.length;
        return avgAttendees < 2;
      },
      severity: 'warning',
      insight: 'Meetings typically have low attendance',
      action: 'Confirm key stakeholders and value proposition before meetings'
    },
    {
      name: 'Follow-Up Gap',
      check: (ctx) => {
        if (ctx.meetings.length < 3) return false;
        const completionRate = ctx.meetings.filter(m => m.followUpCompleted).length / ctx.meetings.length;
        return completionRate < 0.5;
      },
      severity: 'warning',
      insight: 'Less than 50% of meeting follow-ups completed',
      action: 'Improve follow-up tracking and accountability'
    },
    {
      name: 'Consistent Meeting Cadence',
      check: (ctx) => {
        if (ctx.meetings.length < 4) return false;
        // Check for roughly regular intervals
        const intervals: number[] = [];
        for (let i = 1; i < ctx.meetings.length; i++) {
          const diff = new Date(ctx.meetings[i - 1].date).getTime() - new Date(ctx.meetings[i].date).getTime();
          intervals.push(Math.abs(diff) / (1000 * 60 * 60 * 24));
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
        return Math.sqrt(variance) < 7; // Low variance means consistent cadence
      },
      severity: 'positive',
      insight: 'Customer maintains consistent meeting schedule',
      action: 'Continue current cadence, customer values regular touchpoints'
    }
  ],
  stakeholder: [
    {
      name: 'Single Point of Contact',
      check: (ctx) => {
        const activeStakeholders = ctx.stakeholders.filter(s => {
          if (!s.lastContact) return false;
          const daysSince = (Date.now() - new Date(s.lastContact).getTime()) / (1000 * 60 * 60 * 24);
          return daysSince < 90;
        });
        return activeStakeholders.length <= 1;
      },
      severity: 'warning',
      insight: 'Relationship relies on single point of contact',
      action: 'Expand stakeholder engagement across the organization'
    },
    {
      name: 'Executive Disengagement',
      check: (ctx) => {
        const executives = ctx.stakeholders.filter(s =>
          s.role?.toLowerCase().includes('vp') ||
          s.role?.toLowerCase().includes('director') ||
          s.role?.toLowerCase().includes('c-level') ||
          s.role?.toLowerCase().includes('ceo') ||
          s.role?.toLowerCase().includes('cto')
        );
        if (executives.length === 0) return false;
        const engagedExecs = executives.filter(e => {
          if (!e.lastContact) return false;
          const daysSince = (Date.now() - new Date(e.lastContact).getTime()) / (1000 * 60 * 60 * 24);
          return daysSince < 60;
        });
        return engagedExecs.length === 0;
      },
      severity: 'warning',
      insight: 'No recent engagement with executive stakeholders',
      action: 'Plan executive outreach to maintain strategic alignment'
    },
    {
      name: 'Strong Champion Network',
      check: (ctx) => {
        const champions = ctx.stakeholders.filter(s => s.isChampion);
        const positiveChampions = champions.filter(c => c.sentiment === 'positive');
        return positiveChampions.length >= 2;
      },
      severity: 'positive',
      insight: 'Multiple positive champions identified',
      action: 'Nurture champion relationships for advocacy'
    }
  ],
  usage: [
    {
      name: 'Weekend Usage Pattern',
      check: (ctx) => {
        // This would require more detailed timestamp data
        // Simplified check based on session patterns
        if (ctx.usageMetrics.length < 14) return false;
        const avgSessionDuration = ctx.usageMetrics.reduce((sum, m) => sum + m.sessionDuration, 0) / ctx.usageMetrics.length;
        return avgSessionDuration > 30; // minutes
      },
      severity: 'positive',
      insight: 'High average session duration indicates deep engagement',
      action: 'Explore power user features and advanced workflows'
    },
    {
      name: 'Sporadic Usage',
      check: (ctx) => {
        if (ctx.usageMetrics.length < 14) return false;
        const activeDays = ctx.usageMetrics.filter(m => m.dau > 0).length;
        return activeDays < ctx.usageMetrics.length * 0.3;
      },
      severity: 'warning',
      insight: 'Inconsistent product usage patterns',
      action: 'Identify blockers and provide usage guidance'
    }
  ]
};

interface PatternRule {
  name: string;
  check: (ctx: CustomerDataContext) => boolean;
  severity: PatternSeverity;
  insight: string;
  action: string;
}

// ==================== Helper Functions ====================

function calculateAverageResponseTime(interactions: InteractionRecord[]): number {
  const responseTimes = interactions
    .filter(i => i.responseTime !== undefined)
    .map(i => i.responseTime as number);

  if (responseTimes.length === 0) return 0;
  return responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
}

function generatePatternId(): string {
  return `pat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function calculateConfidenceScore(dataPoints: number, rule: PatternRule): number {
  // Base confidence on data availability
  const dataScore = Math.min(dataPoints * 10, 50);
  // Add rule-based confidence
  const ruleScore = rule.severity === 'critical' ? 30 : rule.severity === 'warning' ? 20 : 15;
  return Math.min(dataScore + ruleScore, 100);
}

function getConfidenceLevel(score: number): PatternConfidence {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

// ==================== Pattern Recognition Service ====================

class PatternRecognitionService {
  private anthropic: Anthropic | null = null;

  constructor() {
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }
  }

  /**
   * Analyze customer data for behavioral patterns
   */
  async analyzePatterns(params: PatternRecognitionParams): Promise<PatternAnalysisResult> {
    const {
      customerId,
      lookbackDays = 90,
      patternTypes = Object.keys(PATTERN_RULES) as PatternType[],
      includeAISummary = true,
      forceRefresh = false
    } = params;

    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cached = await this.getCachedAnalysis(customerId);
      if (cached) return cached;
    }

    // Gather customer data
    const context = await this.gatherCustomerData(customerId, lookbackDays);

    if (!context.customer) {
      throw new Error('Customer not found');
    }

    // Detect patterns using rule-based system
    const detectedPatterns: DetectedPattern[] = [];

    for (const patternType of patternTypes) {
      const rules = PATTERN_RULES[patternType] || [];

      for (const rule of rules) {
        try {
          if (rule.check(context)) {
            const dataPoints = this.getRelevantDataPoints(context, patternType);
            const confidenceScore = calculateConfidenceScore(dataPoints.length, rule);

            detectedPatterns.push({
              id: generatePatternId(),
              customerId,
              type: patternType,
              name: rule.name,
              description: rule.insight,
              severity: rule.severity,
              confidence: getConfidenceLevel(confidenceScore),
              confidenceScore,
              dataPoints,
              insight: rule.insight,
              suggestedAction: rule.action,
              detectedAt: new Date(),
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            });
          }
        } catch (error) {
          console.error(`Error checking pattern ${rule.name}:`, error);
        }
      }
    }

    // Sort by severity and confidence
    detectedPatterns.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, positive: 2, info: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.confidenceScore - a.confidenceScore;
    });

    // Calculate overall risk level
    const overallRiskLevel = this.calculateOverallRiskLevel(detectedPatterns);

    // Calculate data quality
    const dataQuality = this.calculateDataQuality(context);

    // Generate AI-powered summary if requested
    let summary = this.generateBasicSummary(detectedPatterns);
    let topInsights = detectedPatterns.slice(0, 3).map(p => p.insight);
    let recommendedActions = detectedPatterns
      .filter(p => p.suggestedAction)
      .slice(0, 5)
      .map(p => p.suggestedAction as string);

    if (includeAISummary && this.anthropic) {
      try {
        const aiAnalysis = await this.generateAISummary(
          context,
          detectedPatterns,
          (context.customer as any)?.name || 'Customer'
        );
        summary = aiAnalysis.summary;
        topInsights = aiAnalysis.insights;
        recommendedActions = aiAnalysis.actions;
      } catch (error) {
        console.error('Error generating AI summary:', error);
      }
    }

    const result: PatternAnalysisResult = {
      customerId,
      customerName: (context.customer as any)?.name || 'Unknown',
      patterns: detectedPatterns,
      summary,
      overallRiskLevel,
      topInsights,
      recommendedActions,
      analysisTimestamp: new Date(),
      dataQuality
    };

    // Cache the result
    await this.cacheAnalysis(customerId, result);

    return result;
  }

  /**
   * Get patterns for meeting prep context
   */
  async getPatternsForMeeting(
    customerId: string,
    meetingType: string
  ): Promise<{
    relevantPatterns: DetectedPattern[];
    meetingInsights: string[];
    preparationTips: string[];
  }> {
    const analysis = await this.analyzePatterns({
      customerId,
      lookbackDays: 60,
      includeAISummary: false
    });

    // Filter patterns relevant to meeting context
    const meetingRelevantTypes: PatternType[] = ['communication', 'meeting', 'stakeholder', 'risk'];
    const relevantPatterns = analysis.patterns.filter(p => meetingRelevantTypes.includes(p.type));

    // Generate meeting-specific insights
    const meetingInsights: string[] = [];
    const preparationTips: string[] = [];

    // Communication patterns
    const commPatterns = relevantPatterns.filter(p => p.type === 'communication');
    if (commPatterns.some(p => p.name === 'Slow Response Pattern')) {
      meetingInsights.push('Customer typically responds slowly - allow extra follow-up time');
      preparationTips.push('Prepare a concise follow-up email template before the meeting');
    }
    if (commPatterns.some(p => p.name === 'Communication Gap')) {
      meetingInsights.push('Extended gap since last contact - re-establish rapport');
      preparationTips.push('Begin with relationship building before diving into business topics');
    }

    // Meeting patterns
    const meetPatterns = relevantPatterns.filter(p => p.type === 'meeting');
    if (meetPatterns.some(p => p.name === 'Low Meeting Attendance')) {
      meetingInsights.push('Meetings typically have low attendance');
      preparationTips.push('Confirm key stakeholders will attend and emphasize value of their presence');
    }
    if (meetPatterns.some(p => p.name === 'Follow-Up Gap')) {
      meetingInsights.push('Follow-up completion has been inconsistent');
      preparationTips.push('Assign clear owners to action items during the meeting');
    }

    // Risk patterns
    const riskPatterns = relevantPatterns.filter(p => p.type === 'risk');
    if (riskPatterns.some(p => p.severity === 'critical')) {
      meetingInsights.push('Critical risk signals detected - prepare to address concerns');
      preparationTips.push('Have contingency plans ready for difficult conversations');
    }

    // Stakeholder patterns
    const stakeholderPatterns = relevantPatterns.filter(p => p.type === 'stakeholder');
    if (stakeholderPatterns.some(p => p.name === 'Single Point of Contact')) {
      meetingInsights.push('Relationship relies on limited contacts');
      preparationTips.push('Identify and engage additional stakeholders during the meeting');
    }

    // Meeting type specific tips
    switch (meetingType) {
      case 'qbr':
        preparationTips.push('Prepare ROI metrics and value delivered summary');
        preparationTips.push('Have expansion opportunities ready to discuss');
        break;
      case 'renewal':
        preparationTips.push('Gather competitive intelligence before the meeting');
        preparationTips.push('Prepare value summary highlighting key wins');
        break;
      case 'escalation':
        preparationTips.push('Have root cause analysis documented');
        preparationTips.push('Prepare remediation plan with timeline');
        break;
    }

    return {
      relevantPatterns: relevantPatterns.slice(0, 10),
      meetingInsights: meetingInsights.slice(0, 5),
      preparationTips: preparationTips.slice(0, 7)
    };
  }

  // ==================== Data Gathering ====================

  private async gatherCustomerData(
    customerId: string,
    lookbackDays: number
  ): Promise<CustomerDataContext> {
    const cutoffDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    const [customer, interactions, usageMetrics, meetings, healthHistory, stakeholders, supportTickets] =
      await Promise.all([
        this.fetchCustomer(customerId),
        this.fetchInteractions(customerId, cutoffDate),
        this.fetchUsageMetrics(customerId, cutoffDate),
        this.fetchMeetings(customerId, cutoffDate),
        this.fetchHealthHistory(customerId, cutoffDate),
        this.fetchStakeholders(customerId),
        this.fetchSupportTickets(customerId, cutoffDate)
      ]);

    return {
      customer,
      interactions,
      usageMetrics,
      meetings,
      healthHistory,
      stakeholders,
      supportTickets
    };
  }

  private async fetchCustomer(customerId: string): Promise<Record<string, unknown> | null> {
    if (!supabase) {
      return {
        id: customerId,
        name: 'Demo Customer',
        health_score: 72,
        arr: 100000,
        stage: 'active'
      };
    }

    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    return data;
  }

  private async fetchInteractions(customerId: string, since: Date): Promise<InteractionRecord[]> {
    if (!supabase) {
      return [
        { type: 'email', timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), channel: 'email', responseTime: 24 },
        { type: 'meeting', timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), sentiment: 'positive' },
        { type: 'email', timestamp: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(), channel: 'email', responseTime: 48 }
      ];
    }

    try {
      const { data } = await supabase
        .from('agent_activity_log')
        .select('action_type, started_at, result_data')
        .eq('customer_id', customerId)
        .gte('started_at', since.toISOString())
        .order('started_at', { ascending: false });

      return (data || []).map(d => ({
        type: d.action_type,
        timestamp: d.started_at,
        sentiment: d.result_data?.sentiment,
        channel: d.action_type?.includes('email') ? 'email' : 'other'
      }));
    } catch {
      return [];
    }
  }

  private async fetchUsageMetrics(customerId: string, since: Date): Promise<UsageMetricRecord[]> {
    if (!supabase) {
      const metrics: UsageMetricRecord[] = [];
      for (let i = 0; i < 30; i++) {
        metrics.push({
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
          dau: Math.floor(50 + Math.random() * 30),
          mau: Math.floor(200 + Math.random() * 100),
          featuresUsed: ['dashboard', 'reports', 'analytics'].slice(0, Math.floor(Math.random() * 3) + 1),
          sessionDuration: Math.floor(15 + Math.random() * 30)
        });
      }
      return metrics;
    }

    try {
      const { data } = await supabase
        .from('usage_metrics')
        .select('*')
        .eq('customer_id', customerId)
        .gte('calculated_at', since.toISOString())
        .order('calculated_at', { ascending: false });

      return (data || []).map(d => ({
        date: d.calculated_at,
        dau: d.dau || 0,
        mau: d.mau || 0,
        featuresUsed: d.unique_features_used ? Array(d.unique_features_used).fill('feature') : [],
        sessionDuration: d.total_events ? Math.floor(d.total_events / 10) : 0
      }));
    } catch {
      return [];
    }
  }

  private async fetchMeetings(customerId: string, since: Date): Promise<MeetingRecord[]> {
    if (!supabase) {
      return [
        { date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), type: 'check_in', attendees: 3, followUpCompleted: true, sentiment: 'positive' },
        { date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(), type: 'qbr', attendees: 5, followUpCompleted: true, sentiment: 'positive' },
        { date: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString(), type: 'check_in', attendees: 2, followUpCompleted: false, sentiment: 'neutral' }
      ];
    }

    try {
      const { data } = await supabase
        .from('meetings')
        .select('*')
        .eq('customer_id', customerId)
        .gte('scheduled_at', since.toISOString())
        .order('scheduled_at', { ascending: false });

      return (data || []).map(d => ({
        date: d.scheduled_at,
        type: d.meeting_type || 'other',
        attendees: d.attendees?.length || 1,
        followUpCompleted: d.follow_up_status === 'completed',
        sentiment: d.sentiment
      }));
    } catch {
      return [];
    }
  }

  private async fetchHealthHistory(customerId: string, since: Date): Promise<HealthHistoryRecord[]> {
    if (!supabase) {
      return [
        { date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), score: 68 },
        { date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), score: 70 },
        { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), score: 72 },
        { date: new Date().toISOString(), score: 72 }
      ];
    }

    try {
      const { data } = await supabase
        .from('health_score_history')
        .select('calculated_at, score')
        .eq('customer_id', customerId)
        .gte('calculated_at', since.toISOString())
        .order('calculated_at', { ascending: true });

      return (data || []).map(d => ({
        date: d.calculated_at,
        score: d.score
      }));
    } catch {
      return [];
    }
  }

  private async fetchStakeholders(customerId: string): Promise<StakeholderRecord[]> {
    if (!supabase) {
      return [
        { name: 'John Smith', role: 'VP Engineering', sentiment: 'positive', lastContact: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), isChampion: true },
        { name: 'Sarah Johnson', role: 'Product Manager', sentiment: 'neutral', lastContact: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }
      ];
    }

    try {
      const { data } = await supabase
        .from('stakeholders')
        .select('*')
        .eq('customer_id', customerId);

      return (data || []).map(d => ({
        name: d.name,
        role: d.title || d.role,
        sentiment: d.metadata?.sentiment,
        lastContact: d.last_contact,
        isChampion: d.is_champion || d.metadata?.isChampion
      }));
    } catch {
      return [];
    }
  }

  private async fetchSupportTickets(customerId: string, since: Date): Promise<SupportTicketRecord[]> {
    if (!supabase) {
      return [
        { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), priority: 'medium', status: 'resolved', resolutionTime: 24 },
        { date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(), priority: 'low', status: 'resolved', resolutionTime: 48 }
      ];
    }

    try {
      const { data } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('customer_id', customerId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false });

      return (data || []).map(d => ({
        date: d.created_at,
        priority: d.priority,
        status: d.status,
        category: d.category,
        resolutionTime: d.resolution_time_hours
      }));
    } catch {
      return [];
    }
  }

  // ==================== Analysis Helpers ====================

  private getRelevantDataPoints(context: CustomerDataContext, type: PatternType): PatternDataPoint[] {
    const points: PatternDataPoint[] = [];

    switch (type) {
      case 'communication':
        context.interactions.slice(0, 5).forEach(i => {
          points.push({
            source: 'interaction',
            value: i.type,
            timestamp: i.timestamp,
            weight: 1
          });
        });
        break;
      case 'engagement':
      case 'usage':
        context.usageMetrics.slice(0, 7).forEach(m => {
          points.push({
            source: 'usage',
            value: m.dau,
            timestamp: m.date,
            weight: 1
          });
        });
        break;
      case 'risk':
        context.healthHistory.slice(-3).forEach(h => {
          points.push({
            source: 'health',
            value: h.score,
            timestamp: h.date,
            weight: 2
          });
        });
        break;
      case 'meeting':
        context.meetings.slice(0, 5).forEach(m => {
          points.push({
            source: 'meeting',
            value: m.type,
            timestamp: m.date,
            weight: 1
          });
        });
        break;
      case 'stakeholder':
        context.stakeholders.forEach(s => {
          points.push({
            source: 'stakeholder',
            value: s.name,
            timestamp: s.lastContact || new Date().toISOString(),
            weight: s.isChampion ? 2 : 1
          });
        });
        break;
      case 'success':
        if (context.customer) {
          points.push({
            source: 'customer',
            value: (context.customer as any).health_score || 0,
            timestamp: new Date().toISOString(),
            weight: 2
          });
        }
        break;
    }

    return points;
  }

  private calculateOverallRiskLevel(patterns: DetectedPattern[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalCount = patterns.filter(p => p.severity === 'critical').length;
    const warningCount = patterns.filter(p => p.severity === 'warning').length;
    const positiveCount = patterns.filter(p => p.severity === 'positive').length;

    if (criticalCount >= 2) return 'critical';
    if (criticalCount >= 1 || warningCount >= 3) return 'high';
    if (warningCount >= 1 && positiveCount < 2) return 'medium';
    return 'low';
  }

  private calculateDataQuality(context: CustomerDataContext): number {
    let score = 0;
    const maxScore = 100;

    // Customer data
    if (context.customer) score += 20;

    // Interactions (up to 20 points)
    score += Math.min(context.interactions.length * 2, 20);

    // Usage metrics (up to 20 points)
    score += Math.min(context.usageMetrics.length, 20);

    // Meetings (up to 15 points)
    score += Math.min(context.meetings.length * 3, 15);

    // Health history (up to 10 points)
    score += Math.min(context.healthHistory.length * 2, 10);

    // Stakeholders (up to 15 points)
    score += Math.min(context.stakeholders.length * 5, 15);

    return Math.min(score, maxScore);
  }

  private generateBasicSummary(patterns: DetectedPattern[]): string {
    const critical = patterns.filter(p => p.severity === 'critical');
    const warnings = patterns.filter(p => p.severity === 'warning');
    const positive = patterns.filter(p => p.severity === 'positive');

    const parts: string[] = [];

    if (critical.length > 0) {
      parts.push(`${critical.length} critical pattern(s) detected requiring immediate attention`);
    }
    if (warnings.length > 0) {
      parts.push(`${warnings.length} warning pattern(s) identified`);
    }
    if (positive.length > 0) {
      parts.push(`${positive.length} positive pattern(s) showing healthy engagement`);
    }

    if (parts.length === 0) {
      return 'No significant patterns detected. Continue monitoring for changes.';
    }

    return parts.join('. ') + '.';
  }

  // ==================== AI Summary Generation ====================

  private async generateAISummary(
    context: CustomerDataContext,
    patterns: DetectedPattern[],
    customerName: string
  ): Promise<{
    summary: string;
    insights: string[];
    actions: string[];
  }> {
    if (!this.anthropic) {
      return {
        summary: this.generateBasicSummary(patterns),
        insights: patterns.slice(0, 3).map(p => p.insight),
        actions: patterns.filter(p => p.suggestedAction).slice(0, 5).map(p => p.suggestedAction as string)
      };
    }

    const prompt = `Analyze these customer behavioral patterns and provide actionable insights.

Customer: ${customerName}
Health Score: ${(context.customer as any)?.health_score || 'Unknown'}
Stage: ${(context.customer as any)?.stage || 'Unknown'}

Detected Patterns:
${patterns.map(p => `- [${p.severity.toUpperCase()}] ${p.name}: ${p.description}`).join('\n')}

Recent Data Points:
- Interactions: ${context.interactions.length} in the analysis period
- Meetings: ${context.meetings.length} meetings tracked
- Stakeholders: ${context.stakeholders.length} identified
- Support Tickets: ${context.supportTickets.length} tickets

Generate a JSON response with:
{
  "summary": "2-3 sentence executive summary of the patterns and their implications",
  "insights": ["3-5 key insights from the patterns"],
  "actions": ["3-5 prioritized recommended actions"]
}

Focus on actionable, specific recommendations. Return only valid JSON.`;

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      });

      const textBlock = message.content.find(block => block.type === 'text');
      const responseText = textBlock?.type === 'text' ? textBlock.text : '';

      let jsonString = responseText.trim();
      if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/```json?\n?/g, '').replace(/```/g, '');
      }

      const parsed = JSON.parse(jsonString);
      return {
        summary: parsed.summary || this.generateBasicSummary(patterns),
        insights: parsed.insights || patterns.slice(0, 3).map(p => p.insight),
        actions: parsed.actions || patterns.filter(p => p.suggestedAction).slice(0, 5).map(p => p.suggestedAction as string)
      };
    } catch (error) {
      console.error('Error generating AI summary:', error);
      return {
        summary: this.generateBasicSummary(patterns),
        insights: patterns.slice(0, 3).map(p => p.insight),
        actions: patterns.filter(p => p.suggestedAction).slice(0, 5).map(p => p.suggestedAction as string)
      };
    }
  }

  // ==================== Caching ====================

  private async getCachedAnalysis(customerId: string): Promise<PatternAnalysisResult | null> {
    if (!supabase) return null;

    try {
      const { data } = await supabase
        .from('pattern_analysis_cache')
        .select('*')
        .eq('customer_id', customerId)
        .single();

      if (!data) return null;

      // Check if cache is still valid (24 hours)
      const cacheAge = Date.now() - new Date(data.created_at).getTime();
      if (cacheAge > 24 * 60 * 60 * 1000) return null;

      return data.analysis_data as PatternAnalysisResult;
    } catch {
      return null;
    }
  }

  private async cacheAnalysis(customerId: string, result: PatternAnalysisResult): Promise<void> {
    if (!supabase) return;

    try {
      await supabase
        .from('pattern_analysis_cache')
        .upsert({
          customer_id: customerId,
          analysis_data: result,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'customer_id'
        });
    } catch (error) {
      console.error('Error caching analysis:', error);
    }
  }
}

// ==================== Exports ====================

export const patternRecognitionService = new PatternRecognitionService();

export async function analyzeCustomerPatterns(
  params: PatternRecognitionParams
): Promise<PatternAnalysisResult> {
  return patternRecognitionService.analyzePatterns(params);
}

export async function getPatternsForMeetingPrep(
  customerId: string,
  meetingType: string
): Promise<{
  relevantPatterns: DetectedPattern[];
  meetingInsights: string[];
  preparationTips: string[];
}> {
  return patternRecognitionService.getPatternsForMeeting(customerId, meetingType);
}

export default patternRecognitionService;
