/**
 * Cross-Reference Engine Service
 * PRD-021: Multi-File Upload Cross-Reference Analysis
 *
 * Analyzes correlations across multiple data sources,
 * identifies patterns, and generates holistic insights.
 */

import { v4 as uuidv4 } from 'uuid';
import { ClaudeService } from '../claude.js';
import { GeminiService } from '../gemini.js';
import {
  TimelineEvent,
  UnifiedTimeline,
  HealthSnapshot,
  TimelineMilestone,
  EventSource
} from './timelineBuilder.js';

// ============================================
// TYPES
// ============================================

export type CorrelationType = 'temporal' | 'causal' | 'inverse' | 'clustering' | 'anomaly';
export type CorrelationStrength = 'weak' | 'moderate' | 'strong' | 'very_strong';

export interface CorrelationChainLink {
  event: string;
  date: string;
  delayDays?: number;
  impact?: string;
}

export interface Correlation {
  id: string;
  type: CorrelationType;
  strength: CorrelationStrength;
  confidence: number;
  sources: EventSource[];
  title: string;
  description: string;
  events: TimelineEvent[];
  chain: CorrelationChainLink[];
  insight: string;
  recommendation?: string;
}

export interface CorrelationPattern {
  patternId: string;
  name: string;
  description: string;
  frequency: number;
  correlations: Correlation[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface RiskSignal {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: EventSource | EventSource[];
  title: string;
  description: string;
  evidence: string[];
  detectedAt: string;
  impactScore: number;
  urgency: number;
}

export interface RootCauseAnalysis {
  primaryIssue: {
    title: string;
    description: string;
    triggeredAt: string;
    sources: EventSource[];
  };
  secondaryIssues: Array<{
    title: string;
    description: string;
    relationship: string;
  }>;
  cascadeChain: CorrelationChainLink[];
  confidenceScore: number;
}

export interface MultiSignalRiskAssessment {
  signalSources: Array<{
    source: EventSource;
    riskIndicator: string;
    weight: 'low' | 'medium' | 'high' | 'critical';
    score: number;
  }>;
  combinedRiskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  compoundingFactors: string[];
}

export interface CustomerHealthView {
  customerId: string;
  customerName: string;
  unifiedHealthScore: number;
  category: 'healthy' | 'warning' | 'critical';
  trend: 'improving' | 'stable' | 'declining';
  componentScores: {
    usage: number;
    support: number;
    sentiment: number;
    financial: number;
    engagement: number;
  };
  weightedFactors: Array<{
    factor: string;
    weight: number;
    score: number;
    contribution: number;
  }>;
}

export interface HolisticInsight {
  type: 'opportunity' | 'risk' | 'trend' | 'anomaly' | 'recommendation';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  sources: EventSource[];
  supportingData: Record<string, string | number>;
  confidence: number;
  actionable: boolean;
  suggestedActions?: string[];
}

export interface ActionRecommendation {
  priority: 'immediate' | 'short_term' | 'medium_term';
  timeframe: string;
  action: string;
  description: string;
  expectedOutcome: string;
  assignedTo?: string;
  relatedCorrelations: string[];
}

export interface CrossReferenceAnalysisResult {
  sessionId: string;
  customerId: string;
  customerName: string;
  analyzedAt: string;
  processingDuration: number;
  correlations: Correlation[];
  patterns: CorrelationPattern[];
  riskAssessment: MultiSignalRiskAssessment;
  riskSignals: RiskSignal[];
  rootCauseAnalysis: RootCauseAnalysis | null;
  healthView: CustomerHealthView;
  insights: HolisticInsight[];
  recommendations: ActionRecommendation[];
  executiveSummary: {
    headline: string;
    keyFindings: string[];
    criticalIssues: string[];
    opportunities: string[];
    nextSteps: string[];
  };
}

// ============================================
// CROSS-REFERENCE ENGINE
// ============================================

export class CrossReferenceEngine {
  private claude: ClaudeService;
  private gemini: GeminiService;

  constructor() {
    this.claude = new ClaudeService();
    this.gemini = new GeminiService();
  }

  /**
   * Run full cross-reference analysis on a unified timeline
   */
  async analyze(
    sessionId: string,
    timeline: UnifiedTimeline,
    options: {
      correlationThreshold?: number;
      maxCorrelations?: number;
      includeRootCause?: boolean;
      generateRecommendations?: boolean;
    } = {}
  ): Promise<CrossReferenceAnalysisResult> {
    const startTime = Date.now();
    const {
      correlationThreshold = 0.5,
      maxCorrelations = 50,
      includeRootCause = true,
      generateRecommendations = true
    } = options;

    // Step 1: Find correlations
    const correlations = this.findCorrelations(timeline, correlationThreshold);
    const limitedCorrelations = correlations.slice(0, maxCorrelations);

    // Step 2: Identify patterns
    const patterns = this.identifyPatterns(limitedCorrelations);

    // Step 3: Assess multi-signal risk
    const riskAssessment = this.assessRisk(timeline, limitedCorrelations);
    const riskSignals = this.detectRiskSignals(timeline);

    // Step 4: Perform root cause analysis if needed
    let rootCauseAnalysis: RootCauseAnalysis | null = null;
    if (includeRootCause && riskAssessment.riskLevel !== 'low') {
      rootCauseAnalysis = await this.analyzeRootCause(timeline, limitedCorrelations, riskSignals);
    }

    // Step 5: Calculate unified health view
    const healthView = this.calculateHealthView(timeline);

    // Step 6: Generate holistic insights
    const insights = await this.generateInsights(
      timeline,
      limitedCorrelations,
      riskAssessment,
      healthView
    );

    // Step 7: Generate recommendations
    let recommendations: ActionRecommendation[] = [];
    if (generateRecommendations) {
      recommendations = await this.generateRecommendations(
        timeline,
        limitedCorrelations,
        riskSignals,
        insights
      );
    }

    // Step 8: Generate executive summary
    const executiveSummary = await this.generateExecutiveSummary(
      timeline,
      healthView,
      riskAssessment,
      insights,
      recommendations
    );

    return {
      sessionId,
      customerId: timeline.customerId,
      customerName: timeline.customerName,
      analyzedAt: new Date().toISOString(),
      processingDuration: Date.now() - startTime,
      correlations: limitedCorrelations,
      patterns,
      riskAssessment,
      riskSignals,
      rootCauseAnalysis,
      healthView,
      insights,
      recommendations,
      executiveSummary
    };
  }

  /**
   * Find correlations between events
   */
  private findCorrelations(
    timeline: UnifiedTimeline,
    threshold: number
  ): Correlation[] {
    const correlations: Correlation[] = [];
    const events = timeline.events;

    // Temporal correlations - events that happen in sequence
    correlations.push(...this.findTemporalCorrelations(events, threshold));

    // Clustering correlations - events that happen together
    correlations.push(...this.findClusteringCorrelations(events, timeline.eventsByDate));

    // Causal correlations - events that seem to cause others
    correlations.push(...this.findCausalCorrelations(events, threshold));

    // Inverse correlations - negative relationships
    correlations.push(...this.findInverseCorrelations(timeline.healthSnapshots));

    // Anomaly detection
    correlations.push(...this.findAnomalies(events, timeline.healthSnapshots));

    // Sort by confidence and strength
    correlations.sort((a, b) => {
      const strengthOrder = { very_strong: 4, strong: 3, moderate: 2, weak: 1 };
      const aScore = strengthOrder[a.strength] * a.confidence;
      const bScore = strengthOrder[b.strength] * b.confidence;
      return bScore - aScore;
    });

    return correlations;
  }

  /**
   * Find temporal correlations (A -> B sequences)
   */
  private findTemporalCorrelations(events: TimelineEvent[], threshold: number): Correlation[] {
    const correlations: Correlation[] = [];

    // Look for common patterns
    // Pattern 1: Feature launch -> Support spike
    const featureEvents = events.filter(e =>
      e.type.includes('feature') || e.type.includes('launch') || e.type.includes('release')
    );
    const supportEvents = events.filter(e => e.source === 'support');

    for (const feature of featureEvents) {
      const featureDate = new Date(feature.date);
      const subsequentSupport = supportEvents.filter(s => {
        const supportDate = new Date(s.date);
        const daysDiff = (supportDate.getTime() - featureDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff > 0 && daysDiff <= 30;
      });

      if (subsequentSupport.length >= 3) {
        correlations.push({
          id: uuidv4(),
          type: 'temporal',
          strength: subsequentSupport.length >= 10 ? 'very_strong' : subsequentSupport.length >= 5 ? 'strong' : 'moderate',
          confidence: Math.min(0.95, 0.5 + subsequentSupport.length * 0.05),
          sources: ['usage', 'support'],
          title: 'Feature Launch -> Support Spike',
          description: `${feature.title} followed by ${subsequentSupport.length} support tickets within 30 days`,
          events: [feature, ...subsequentSupport.slice(0, 5)],
          chain: [
            { event: feature.title, date: feature.date },
            { event: `${subsequentSupport.length} support tickets`, date: subsequentSupport[0]?.date, delayDays: Math.round((new Date(subsequentSupport[0]?.date).getTime() - featureDate.getTime()) / (1000 * 60 * 60 * 24)) }
          ],
          insight: 'The feature launch may have caused confusion leading to increased support burden.',
          recommendation: 'Consider additional training or documentation for this feature.'
        });
      }
    }

    // Pattern 2: Support issues -> NPS drop
    const npsEvents = events.filter(e => e.source === 'nps');
    for (const nps of npsEvents) {
      const npsDate = new Date(nps.date);
      const priorSupport = supportEvents.filter(s => {
        const supportDate = new Date(s.date);
        const daysDiff = (npsDate.getTime() - supportDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff > 0 && daysDiff <= 45;
      });

      const escalations = priorSupport.filter(s => s.metrics?.escalated === 1);
      const npsScore = nps.metrics?.nps_score as number;

      if (escalations.length >= 2 && npsScore !== undefined && npsScore < 30) {
        correlations.push({
          id: uuidv4(),
          type: 'temporal',
          strength: 'strong',
          confidence: 0.85,
          sources: ['support', 'nps'],
          title: 'Support Escalations -> NPS Drop',
          description: `${escalations.length} escalations in 45 days before NPS score of ${npsScore}`,
          events: [...escalations.slice(0, 3), nps],
          chain: [
            { event: `${escalations.length} escalations`, date: escalations[0]?.date },
            { event: `NPS: ${npsScore}`, date: nps.date, delayDays: 45 }
          ],
          insight: 'Support escalations are strongly correlated with NPS decline.',
          recommendation: 'Address root causes of escalations to improve satisfaction.'
        });
      }
    }

    // Pattern 3: Usage decline -> Churn signals
    const usageEvents = events.filter(e => e.source === 'usage').sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (let i = 1; i < usageEvents.length; i++) {
      const prev = usageEvents[i - 1];
      const curr = usageEvents[i];
      const prevCount = (prev.metrics?.total_events as number) || 0;
      const currCount = (curr.metrics?.total_events as number) || 0;

      if (prevCount > 0 && currCount < prevCount * 0.7) {
        // 30%+ drop in usage
        correlations.push({
          id: uuidv4(),
          type: 'temporal',
          strength: currCount < prevCount * 0.5 ? 'very_strong' : 'strong',
          confidence: 0.9,
          sources: ['usage'],
          title: 'Significant Usage Decline',
          description: `Usage dropped ${Math.round((1 - currCount / prevCount) * 100)}% from ${prev.date} to ${curr.date}`,
          events: [prev, curr],
          chain: [
            { event: `${prevCount} events`, date: prev.date },
            { event: `${currCount} events`, date: curr.date, impact: 'Usage declining' }
          ],
          insight: 'Significant usage decline detected which often precedes churn.',
          recommendation: 'Schedule a check-in to understand any blockers.'
        });
      }
    }

    return correlations;
  }

  /**
   * Find clustering correlations (events that occur together)
   */
  private findClusteringCorrelations(
    events: TimelineEvent[],
    eventsByDate: Map<string, TimelineEvent[]>
  ): Correlation[] {
    const correlations: Correlation[] = [];

    for (const [date, dateEvents] of eventsByDate) {
      // Multiple critical events on same day
      const criticalEvents = dateEvents.filter(e => e.severity === 'critical');
      if (criticalEvents.length >= 2) {
        const sources = [...new Set(criticalEvents.map(e => e.source))];
        correlations.push({
          id: uuidv4(),
          type: 'clustering',
          strength: criticalEvents.length >= 4 ? 'very_strong' : 'strong',
          confidence: 0.9,
          sources,
          title: 'Critical Event Cluster',
          description: `${criticalEvents.length} critical events from ${sources.length} sources on ${date}`,
          events: criticalEvents,
          chain: criticalEvents.map(e => ({ event: e.title, date: e.date })),
          insight: 'Multiple critical events occurring together indicate a systemic issue.',
          recommendation: 'Prioritize immediate intervention for this account.'
        });
      }

      // Mix of support and sentiment signals
      const supportEvents = dateEvents.filter(e => e.source === 'support');
      const npsEvents = dateEvents.filter(e => e.source === 'nps');
      const meetingEvents = dateEvents.filter(e => e.source === 'meeting');

      if (supportEvents.length > 0 && (npsEvents.length > 0 || meetingEvents.length > 0)) {
        const negativeNPS = npsEvents.filter(e => (e.metrics?.nps_score as number) < 30);
        const concernMeetings = meetingEvents.filter(e => e.severity === 'warning' || e.severity === 'critical');

        if (negativeNPS.length > 0 || concernMeetings.length > 0) {
          correlations.push({
            id: uuidv4(),
            type: 'clustering',
            strength: 'moderate',
            confidence: 0.75,
            sources: ['support', npsEvents.length > 0 ? 'nps' : 'meeting'],
            title: 'Multi-Channel Dissatisfaction',
            description: `Support issues coinciding with negative sentiment signals on ${date}`,
            events: [...supportEvents, ...negativeNPS, ...concernMeetings],
            chain: [
              { event: `${supportEvents.length} support tickets`, date },
              { event: 'Negative sentiment detected', date }
            ],
            insight: 'Customer expressing dissatisfaction through multiple channels.',
            recommendation: 'Coordinate cross-functional response.'
          });
        }
      }
    }

    return correlations;
  }

  /**
   * Find causal correlations
   */
  private findCausalCorrelations(events: TimelineEvent[], threshold: number): Correlation[] {
    const correlations: Correlation[] = [];

    // Payment delays following satisfaction decline
    const invoiceEvents = events.filter(e => e.source === 'invoice');
    const sentimentEvents = events.filter(e =>
      e.source === 'nps' || e.source === 'meeting'
    );

    for (const invoice of invoiceEvents) {
      const daysLate = (invoice.metrics?.days_late as number) || 0;
      if (daysLate > 15) {
        const invoiceDate = new Date(invoice.date);

        // Look for preceding negative sentiment
        const priorNegative = sentimentEvents.filter(s => {
          const sentimentDate = new Date(s.date);
          const daysDiff = (invoiceDate.getTime() - sentimentDate.getTime()) / (1000 * 60 * 60 * 24);
          return daysDiff > 0 && daysDiff <= 60 &&
            (s.severity === 'warning' || s.severity === 'critical' ||
              (s.metrics?.nps_score as number) < 30);
        });

        if (priorNegative.length > 0) {
          correlations.push({
            id: uuidv4(),
            type: 'causal',
            strength: 'moderate',
            confidence: 0.7,
            sources: ['invoice', priorNegative[0].source],
            title: 'Dissatisfaction -> Payment Delay',
            description: `Payment ${daysLate} days late, following ${priorNegative.length} negative sentiment signals`,
            events: [...priorNegative.slice(0, 3), invoice],
            chain: [
              { event: 'Negative sentiment', date: priorNegative[0].date },
              { event: `Invoice ${daysLate} days late`, date: invoice.date, impact: 'Financial risk' }
            ],
            insight: 'Dissatisfaction may be manifesting in delayed payments.',
            recommendation: 'Address satisfaction issues to restore payment regularity.'
          });
        }
      }
    }

    return correlations;
  }

  /**
   * Find inverse correlations
   */
  private findInverseCorrelations(healthSnapshots: HealthSnapshot[]): Correlation[] {
    const correlations: Correlation[] = [];

    if (healthSnapshots.length < 3) return correlations;

    // Look for inverse relationships between components
    for (let i = 2; i < healthSnapshots.length; i++) {
      const current = healthSnapshots[i];
      const previous = healthSnapshots[i - 2]; // 2 weeks ago

      // Support burden (inverse of sentiment)
      const sentimentDrop = previous.components.sentiment - current.components.sentiment;
      const engagementChange = current.components.engagement - previous.components.engagement;

      if (sentimentDrop > 15 && engagementChange < -10) {
        correlations.push({
          id: uuidv4(),
          type: 'inverse',
          strength: 'moderate',
          confidence: 0.65,
          sources: ['nps', 'email', 'meeting'],
          title: 'Sentiment Drop -> Engagement Decline',
          description: `Sentiment dropped ${sentimentDrop}pts, engagement dropped ${Math.abs(engagementChange)}pts`,
          events: [],
          chain: [
            { event: `Sentiment: ${previous.components.sentiment} -> ${current.components.sentiment}`, date: previous.date },
            { event: `Engagement: ${previous.components.engagement} -> ${current.components.engagement}`, date: current.date }
          ],
          insight: 'Declining sentiment correlates with reduced engagement.',
          recommendation: 'Re-engage with value-focused outreach.'
        });
      }
    }

    return correlations;
  }

  /**
   * Find anomalies in the data
   */
  private findAnomalies(events: TimelineEvent[], healthSnapshots: HealthSnapshot[]): Correlation[] {
    const correlations: Correlation[] = [];

    // Look for sudden health score drops
    for (let i = 1; i < healthSnapshots.length; i++) {
      const current = healthSnapshots[i];
      const previous = healthSnapshots[i - 1];
      const drop = previous.score - current.score;

      if (drop >= 15) {
        correlations.push({
          id: uuidv4(),
          type: 'anomaly',
          strength: drop >= 25 ? 'very_strong' : 'strong',
          confidence: 0.85,
          sources: ['system'],
          title: 'Sudden Health Score Drop',
          description: `Health score dropped ${drop} points in one week (${previous.score} -> ${current.score})`,
          events: [],
          chain: [
            { event: `Health: ${previous.score}`, date: previous.date },
            { event: `Health: ${current.score}`, date: current.date, impact: 'Risk signal' }
          ],
          insight: 'Rapid health score decline indicates urgent attention needed.',
          recommendation: 'Investigate recent changes and contact customer immediately.'
        });
      }
    }

    // Look for unusual activity patterns
    const usageEvents = events.filter(e => e.source === 'usage');
    if (usageEvents.length > 0) {
      const avgEvents = usageEvents.reduce((sum, e) =>
        sum + ((e.metrics?.total_events as number) || 0), 0
      ) / usageEvents.length;

      for (const event of usageEvents) {
        const count = (event.metrics?.total_events as number) || 0;
        if (count < avgEvents * 0.3 && avgEvents > 10) {
          correlations.push({
            id: uuidv4(),
            type: 'anomaly',
            strength: 'moderate',
            confidence: 0.7,
            sources: ['usage'],
            title: 'Unusually Low Activity',
            description: `Only ${count} events on ${event.date}, compared to average of ${Math.round(avgEvents)}`,
            events: [event],
            chain: [{ event: `${count} events (avg: ${Math.round(avgEvents)})`, date: event.date }],
            insight: 'Activity significantly below normal may indicate issues.',
            recommendation: 'Check for technical issues or user blockers.'
          });
        }
      }
    }

    return correlations;
  }

  /**
   * Identify recurring patterns from correlations
   */
  private identifyPatterns(correlations: Correlation[]): CorrelationPattern[] {
    const patterns: CorrelationPattern[] = [];

    // Group similar correlations
    const byTitle = new Map<string, Correlation[]>();
    for (const corr of correlations) {
      const key = corr.title;
      const group = byTitle.get(key) || [];
      group.push(corr);
      byTitle.set(key, group);
    }

    for (const [title, group] of byTitle) {
      if (group.length >= 2) {
        const avgConfidence = group.reduce((sum, c) => sum + c.confidence, 0) / group.length;
        const riskLevel = group.some(c => c.strength === 'very_strong') ? 'critical' :
          group.some(c => c.strength === 'strong') ? 'high' :
            group.length >= 3 ? 'medium' : 'low';

        patterns.push({
          patternId: uuidv4(),
          name: title,
          description: `This pattern occurred ${group.length} times`,
          frequency: group.length,
          correlations: group,
          riskLevel
        });
      }
    }

    // Sort by frequency and risk
    patterns.sort((a, b) => {
      const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return (riskOrder[b.riskLevel] * b.frequency) - (riskOrder[a.riskLevel] * a.frequency);
    });

    return patterns;
  }

  /**
   * Assess overall multi-signal risk
   */
  private assessRisk(
    timeline: UnifiedTimeline,
    correlations: Correlation[]
  ): MultiSignalRiskAssessment {
    const signalSources: MultiSignalRiskAssessment['signalSources'] = [];

    // Check each source
    const sources: EventSource[] = ['usage', 'support', 'nps', 'meeting', 'invoice'];

    for (const source of sources) {
      const sourceEvents = timeline.eventsBySource.get(source) || [];
      if (sourceEvents.length === 0) continue;

      const criticalCount = sourceEvents.filter(e => e.severity === 'critical').length;
      const warningCount = sourceEvents.filter(e => e.severity === 'warning').length;

      let score = 0;
      let weight: 'low' | 'medium' | 'high' | 'critical' = 'low';
      let riskIndicator = 'Normal activity';

      // Calculate risk based on source
      switch (source) {
        case 'usage':
          const usageDecline = sourceEvents.some(e =>
            e.type === 'Significant Usage Decline' || e.title.includes('decline')
          );
          score = usageDecline ? 30 : 80;
          weight = usageDecline ? 'high' : 'low';
          riskIndicator = usageDecline ? 'Usage declining' : 'Stable usage';
          break;

        case 'support':
          const escalations = sourceEvents.filter(e => e.metrics?.escalated === 1).length;
          const avgCsat = sourceEvents.filter(e => e.metrics?.csat).reduce((sum, e) =>
            sum + (e.metrics?.csat as number), 0
          ) / Math.max(1, sourceEvents.filter(e => e.metrics?.csat).length);

          score = Math.max(0, 100 - escalations * 15 - (avgCsat < 3 ? 20 : 0));
          weight = escalations >= 3 ? 'critical' : escalations >= 1 ? 'high' : avgCsat < 3 ? 'medium' : 'low';
          riskIndicator = escalations > 0 ? `${escalations} escalations` : avgCsat < 3 ? 'Low CSAT' : 'Normal support';
          break;

        case 'nps':
          const latestNPS = sourceEvents[sourceEvents.length - 1];
          const npsScore = (latestNPS?.metrics?.nps_score as number) || 50;
          score = npsScore + 50; // Convert -100 to 100 scale to 0-150, then cap
          score = Math.min(100, Math.max(0, score));
          weight = npsScore < 0 ? 'critical' : npsScore < 30 ? 'high' : npsScore < 50 ? 'medium' : 'low';
          riskIndicator = `NPS: ${npsScore}`;
          break;

        case 'meeting':
          const concernMeetings = sourceEvents.filter(e =>
            e.severity === 'warning' || e.severity === 'critical'
          ).length;
          score = Math.max(0, 100 - concernMeetings * 20);
          weight = concernMeetings >= 2 ? 'high' : concernMeetings >= 1 ? 'medium' : 'low';
          riskIndicator = concernMeetings > 0 ? `${concernMeetings} concern meetings` : 'Positive meetings';
          break;

        case 'invoice':
          const latePayments = sourceEvents.filter(e =>
            (e.metrics?.days_late as number) > 0
          ).length;
          const outstanding = sourceEvents.filter(e =>
            e.metrics?.status === 'pending' || e.metrics?.status === 'overdue'
          ).length;
          score = Math.max(0, 100 - latePayments * 15 - outstanding * 10);
          weight = latePayments >= 2 ? 'high' : latePayments >= 1 || outstanding >= 2 ? 'medium' : 'low';
          riskIndicator = latePayments > 0 ? `${latePayments} late payments` : 'On-time payments';
          break;
      }

      signalSources.push({ source, riskIndicator, weight, score });
    }

    // Calculate combined score
    const weights = { low: 0.5, medium: 1, high: 1.5, critical: 2 };
    const totalWeight = signalSources.reduce((sum, s) => sum + weights[s.weight], 0);
    const combinedRiskScore = totalWeight > 0
      ? Math.round(signalSources.reduce((sum, s) => sum + s.score * weights[s.weight], 0) / totalWeight)
      : 70;

    // Determine risk level
    const criticalSignals = signalSources.filter(s => s.weight === 'critical').length;
    const highSignals = signalSources.filter(s => s.weight === 'high').length;

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (criticalSignals >= 2 || (criticalSignals >= 1 && highSignals >= 2)) {
      riskLevel = 'critical';
    } else if (criticalSignals >= 1 || highSignals >= 2) {
      riskLevel = 'high';
    } else if (highSignals >= 1 || combinedRiskScore < 60) {
      riskLevel = 'medium';
    }

    // Identify compounding factors
    const compoundingFactors: string[] = [];
    if (signalSources.filter(s => s.weight === 'high' || s.weight === 'critical').length >= 3) {
      compoundingFactors.push('Multiple high-risk signals from different sources');
    }
    const correlatedSources = new Set(correlations.flatMap(c => c.sources));
    if (correlatedSources.size >= 3) {
      compoundingFactors.push('Cross-source correlations detected');
    }

    return {
      signalSources,
      combinedRiskScore,
      riskLevel,
      compoundingFactors
    };
  }

  /**
   * Detect specific risk signals
   */
  private detectRiskSignals(timeline: UnifiedTimeline): RiskSignal[] {
    const signals: RiskSignal[] = [];
    const now = new Date();

    // Usage decline signal
    const usageEvents = timeline.eventsBySource.get('usage') || [];
    if (usageEvents.length >= 2) {
      const recent = usageEvents.slice(-2);
      const older = recent[0];
      const newer = recent[1];
      const olderCount = (older.metrics?.total_events as number) || 0;
      const newerCount = (newer.metrics?.total_events as number) || 0;

      if (olderCount > 0 && newerCount < olderCount * 0.75) {
        signals.push({
          type: 'usage_decline',
          severity: newerCount < olderCount * 0.5 ? 'critical' : 'high',
          source: 'usage',
          title: 'Usage Declining',
          description: `${Math.round((1 - newerCount / olderCount) * 100)}% decrease in usage`,
          evidence: [`${olderCount} events -> ${newerCount} events`],
          detectedAt: newer.date,
          impactScore: Math.round((1 - newerCount / olderCount) * 100),
          urgency: 80
        });
      }
    }

    // Support spike signal
    const supportEvents = timeline.eventsBySource.get('support') || [];
    const escalations = supportEvents.filter(e => e.metrics?.escalated === 1);
    if (escalations.length >= 2) {
      signals.push({
        type: 'support_spike',
        severity: escalations.length >= 5 ? 'critical' : 'high',
        source: 'support',
        title: 'Support Escalations',
        description: `${escalations.length} support escalations detected`,
        evidence: escalations.map(e => e.title),
        detectedAt: escalations[escalations.length - 1].date,
        impactScore: Math.min(100, escalations.length * 15),
        urgency: 90
      });
    }

    // NPS drop signal
    const npsEvents = timeline.eventsBySource.get('nps') || [];
    if (npsEvents.length >= 2) {
      const recent = npsEvents.slice(-2);
      const olderNPS = (recent[0].metrics?.nps_score as number) || 0;
      const newerNPS = (recent[1].metrics?.nps_score as number) || 0;

      if (newerNPS < olderNPS - 20) {
        signals.push({
          type: 'nps_drop',
          severity: newerNPS < 0 ? 'critical' : 'high',
          source: 'nps',
          title: 'NPS Dropped',
          description: `NPS dropped ${olderNPS - newerNPS} points`,
          evidence: [`NPS: ${olderNPS} -> ${newerNPS}`],
          detectedAt: recent[1].date,
          impactScore: Math.abs(olderNPS - newerNPS),
          urgency: 85
        });
      }
    }

    // Payment delay signal
    const invoiceEvents = timeline.eventsBySource.get('invoice') || [];
    const lateInvoices = invoiceEvents.filter(e => (e.metrics?.days_late as number) > 15);
    if (lateInvoices.length > 0) {
      const totalLate = lateInvoices.reduce((sum, e) => sum + ((e.metrics?.amount as number) || 0), 0);
      signals.push({
        type: 'payment_delay',
        severity: totalLate > 20000 ? 'critical' : lateInvoices.length >= 2 ? 'high' : 'medium',
        source: 'invoice',
        title: 'Payment Delays',
        description: `$${totalLate.toLocaleString()} outstanding with ${lateInvoices.length} late invoices`,
        evidence: lateInvoices.map(e => `${e.title} - ${e.metrics?.days_late} days late`),
        detectedAt: lateInvoices[lateInvoices.length - 1].date,
        impactScore: Math.min(100, totalLate / 500),
        urgency: 70
      });
    }

    return signals;
  }

  /**
   * Perform root cause analysis
   */
  private async analyzeRootCause(
    timeline: UnifiedTimeline,
    correlations: Correlation[],
    riskSignals: RiskSignal[]
  ): Promise<RootCauseAnalysis | null> {
    if (correlations.length === 0 && riskSignals.length === 0) {
      return null;
    }

    // Find the earliest correlation in the chain
    const temporalCorrelations = correlations.filter(c => c.type === 'temporal' || c.type === 'causal');
    if (temporalCorrelations.length === 0) {
      return null;
    }

    // Sort by date to find the trigger event
    const allEvents = temporalCorrelations.flatMap(c => c.events);
    allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const triggerEvent = allEvents[0];
    if (!triggerEvent) return null;

    // Build the cascade chain
    const cascadeChain: CorrelationChainLink[] = [];
    const addedEvents = new Set<string>();

    for (const corr of temporalCorrelations) {
      for (const link of corr.chain) {
        if (!addedEvents.has(link.event)) {
          cascadeChain.push(link);
          addedEvents.add(link.event);
        }
      }
    }

    cascadeChain.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Identify secondary issues
    const secondaryIssues = correlations
      .filter(c => c.type !== 'temporal')
      .slice(0, 3)
      .map(c => ({
        title: c.title,
        description: c.description,
        relationship: `${c.type} correlation with ${c.strength} strength`
      }));

    return {
      primaryIssue: {
        title: temporalCorrelations[0].title,
        description: temporalCorrelations[0].insight,
        triggeredAt: triggerEvent.date,
        sources: temporalCorrelations[0].sources
      },
      secondaryIssues,
      cascadeChain,
      confidenceScore: temporalCorrelations[0].confidence
    };
  }

  /**
   * Calculate unified customer health view
   */
  private calculateHealthView(timeline: UnifiedTimeline): CustomerHealthView {
    const latestSnapshot = timeline.healthSnapshots[timeline.healthSnapshots.length - 1];
    const previousSnapshot = timeline.healthSnapshots[timeline.healthSnapshots.length - 2];

    // Calculate support score from events
    const supportEvents = timeline.eventsBySource.get('support') || [];
    const escalations = supportEvents.filter(e => e.metrics?.escalated === 1).length;
    const supportScore = Math.max(0, 100 - escalations * 15);

    // Calculate engagement from meetings and emails
    const meetingEvents = timeline.eventsBySource.get('meeting') || [];
    const emailEvents = timeline.eventsBySource.get('email') || [];
    const engagementScore = Math.min(100, 50 + meetingEvents.length * 10 + emailEvents.length * 2);

    const componentScores = {
      usage: latestSnapshot?.components.usage || 70,
      support: supportScore,
      sentiment: latestSnapshot?.components.sentiment || 70,
      financial: latestSnapshot?.components.financial || 80,
      engagement: engagementScore
    };

    const weights = {
      usage: 0.25,
      support: 0.20,
      sentiment: 0.25,
      financial: 0.15,
      engagement: 0.15
    };

    const weightedFactors = Object.entries(componentScores).map(([factor, score]) => ({
      factor,
      weight: weights[factor as keyof typeof weights],
      score,
      contribution: Math.round(score * weights[factor as keyof typeof weights])
    }));

    const unifiedHealthScore = weightedFactors.reduce((sum, f) => sum + f.contribution, 0);

    const trend = previousSnapshot
      ? latestSnapshot.score > previousSnapshot.score + 5
        ? 'improving'
        : latestSnapshot.score < previousSnapshot.score - 5
          ? 'declining'
          : 'stable'
      : 'stable';

    return {
      customerId: timeline.customerId,
      customerName: timeline.customerName,
      unifiedHealthScore: Math.round(unifiedHealthScore),
      category: unifiedHealthScore >= 70 ? 'healthy' : unifiedHealthScore >= 40 ? 'warning' : 'critical',
      trend,
      componentScores,
      weightedFactors
    };
  }

  /**
   * Generate holistic insights
   */
  private async generateInsights(
    timeline: UnifiedTimeline,
    correlations: Correlation[],
    riskAssessment: MultiSignalRiskAssessment,
    healthView: CustomerHealthView
  ): Promise<HolisticInsight[]> {
    const insights: HolisticInsight[] = [];

    // Risk insights
    if (riskAssessment.riskLevel === 'critical' || riskAssessment.riskLevel === 'high') {
      insights.push({
        type: 'risk',
        priority: riskAssessment.riskLevel,
        title: 'Multi-Signal Risk Detected',
        description: `${riskAssessment.signalSources.filter(s => s.weight === 'high' || s.weight === 'critical').length} high-risk signals detected across different data sources.`,
        sources: riskAssessment.signalSources.map(s => s.source),
        supportingData: {
          combined_score: riskAssessment.combinedRiskScore,
          signal_count: riskAssessment.signalSources.length
        },
        confidence: 0.9,
        actionable: true,
        suggestedActions: ['Schedule executive check-in', 'Create account recovery plan', 'Assign dedicated support contact']
      });
    }

    // Trend insights
    if (healthView.trend === 'declining') {
      const lowestComponent = healthView.weightedFactors.reduce((min, f) =>
        f.score < min.score ? f : min
      );

      insights.push({
        type: 'trend',
        priority: 'high',
        title: 'Declining Health Trend',
        description: `Health score is declining, primarily driven by ${lowestComponent.factor} (score: ${lowestComponent.score}).`,
        sources: ['system'],
        supportingData: {
          health_score: healthView.unifiedHealthScore,
          lowest_component: lowestComponent.factor,
          lowest_score: lowestComponent.score
        },
        confidence: 0.85,
        actionable: true,
        suggestedActions: [`Focus on improving ${lowestComponent.factor}`]
      });
    }

    // Correlation insights
    for (const corr of correlations.slice(0, 5)) {
      insights.push({
        type: corr.type === 'anomaly' ? 'anomaly' : 'trend',
        priority: corr.strength === 'very_strong' ? 'critical' : corr.strength === 'strong' ? 'high' : 'medium',
        title: corr.title,
        description: corr.insight,
        sources: corr.sources,
        supportingData: {
          confidence: corr.confidence,
          strength: corr.strength
        },
        confidence: corr.confidence,
        actionable: !!corr.recommendation,
        suggestedActions: corr.recommendation ? [corr.recommendation] : undefined
      });
    }

    // Opportunity insights
    const positiveEvents = timeline.events.filter(e => e.severity === 'positive');
    if (positiveEvents.length > timeline.events.length * 0.3) {
      insights.push({
        type: 'opportunity',
        priority: 'medium',
        title: 'Strong Engagement Signals',
        description: `${positiveEvents.length} positive signals detected, indicating potential for expansion.`,
        sources: [...new Set(positiveEvents.map(e => e.source))],
        supportingData: {
          positive_count: positiveEvents.length,
          positive_pct: Math.round((positiveEvents.length / timeline.events.length) * 100)
        },
        confidence: 0.75,
        actionable: true,
        suggestedActions: ['Explore expansion opportunities', 'Request case study', 'Identify upsell potential']
      });
    }

    return insights;
  }

  /**
   * Generate action recommendations
   */
  private async generateRecommendations(
    timeline: UnifiedTimeline,
    correlations: Correlation[],
    riskSignals: RiskSignal[],
    insights: HolisticInsight[]
  ): Promise<ActionRecommendation[]> {
    const recommendations: ActionRecommendation[] = [];

    // Immediate actions for critical signals
    const criticalSignals = riskSignals.filter(s => s.severity === 'critical');
    if (criticalSignals.length > 0) {
      recommendations.push({
        priority: 'immediate',
        timeframe: 'This Week',
        action: 'Executive Apology Call',
        description: 'Schedule a call with executive sponsor to acknowledge issues and commit to resolution.',
        expectedOutcome: 'Restore confidence and demonstrate commitment to customer success.',
        assignedTo: 'CSM + Account Executive',
        relatedCorrelations: criticalSignals.map(s => s.type)
      });

      recommendations.push({
        priority: 'immediate',
        timeframe: 'This Week',
        action: 'Assign Dedicated Support Contact',
        description: 'Provide single point of contact for all support issues to improve response times.',
        expectedOutcome: 'Faster resolution and improved customer experience.',
        assignedTo: 'Support Manager',
        relatedCorrelations: criticalSignals.filter(s => s.type === 'support_spike').map(s => s.type)
      });
    }

    // Short-term actions based on correlations
    const featureCorrelations = correlations.filter(c => c.title.includes('Feature'));
    if (featureCorrelations.length > 0) {
      recommendations.push({
        priority: 'short_term',
        timeframe: '2-4 Weeks',
        action: 'Feature Retraining Program',
        description: 'Conduct personalized training sessions for features causing confusion.',
        expectedOutcome: 'Improved feature adoption and reduced support burden.',
        assignedTo: 'CSM + Training Team',
        relatedCorrelations: featureCorrelations.map(c => c.id)
      });
    }

    // Engagement recommendations
    const engagementDecline = insights.some(i =>
      i.type === 'trend' && i.title.toLowerCase().includes('engagement')
    );
    if (engagementDecline) {
      recommendations.push({
        priority: 'short_term',
        timeframe: '2-4 Weeks',
        action: 'Re-engagement Campaign',
        description: 'Targeted outreach to disengaged users with value-focused messaging.',
        expectedOutcome: 'Increase active user count and feature adoption.',
        assignedTo: 'CSM',
        relatedCorrelations: []
      });
    }

    // Medium-term strategic recommendations
    if (riskSignals.length > 0) {
      recommendations.push({
        priority: 'medium_term',
        timeframe: '1-3 Months',
        action: 'Account Recovery Plan',
        description: 'Document comprehensive recovery strategy with milestones and success metrics.',
        expectedOutcome: 'Structured approach to account stabilization and growth.',
        assignedTo: 'CSM + Account Team',
        relatedCorrelations: riskSignals.map(s => s.type)
      });

      recommendations.push({
        priority: 'medium_term',
        timeframe: '1-3 Months',
        action: 'NPS Follow-up Survey',
        description: 'Conduct follow-up survey to measure improvement after interventions.',
        expectedOutcome: 'Validate recovery progress and identify remaining issues.',
        assignedTo: 'CSM',
        relatedCorrelations: riskSignals.filter(s => s.type === 'nps_drop').map(s => s.type)
      });
    }

    return recommendations;
  }

  /**
   * Generate executive summary
   */
  private async generateExecutiveSummary(
    timeline: UnifiedTimeline,
    healthView: CustomerHealthView,
    riskAssessment: MultiSignalRiskAssessment,
    insights: HolisticInsight[],
    recommendations: ActionRecommendation[]
  ): Promise<{
    headline: string;
    keyFindings: string[];
    criticalIssues: string[];
    opportunities: string[];
    nextSteps: string[];
  }> {
    // Generate headline based on health
    let headline: string;
    if (riskAssessment.riskLevel === 'critical') {
      headline = `CRITICAL: ${timeline.customerName} requires immediate intervention - multi-signal churn risk detected`;
    } else if (riskAssessment.riskLevel === 'high') {
      headline = `HIGH RISK: ${timeline.customerName} showing concerning signals across ${riskAssessment.signalSources.filter(s => s.weight === 'high').length} areas`;
    } else if (healthView.trend === 'improving') {
      headline = `POSITIVE: ${timeline.customerName} health improving - consider expansion opportunities`;
    } else {
      headline = `STABLE: ${timeline.customerName} account summary - ${healthView.unifiedHealthScore}/100 health score`;
    }

    // Key findings from insights
    const keyFindings = insights
      .filter(i => i.confidence >= 0.7)
      .slice(0, 5)
      .map(i => i.description);

    // Critical issues
    const criticalIssues = [
      ...insights.filter(i => i.priority === 'critical').map(i => i.title),
      ...riskAssessment.signalSources
        .filter(s => s.weight === 'critical')
        .map(s => `${s.source}: ${s.riskIndicator}`)
    ];

    // Opportunities
    const opportunities = insights
      .filter(i => i.type === 'opportunity')
      .map(i => i.title);

    // Next steps from recommendations
    const nextSteps = recommendations
      .filter(r => r.priority === 'immediate')
      .map(r => r.action);

    if (nextSteps.length === 0) {
      nextSteps.push(...recommendations.slice(0, 3).map(r => r.action));
    }

    return {
      headline,
      keyFindings,
      criticalIssues,
      opportunities,
      nextSteps
    };
  }
}

// Export singleton instance
export const crossReferenceEngine = new CrossReferenceEngine();
