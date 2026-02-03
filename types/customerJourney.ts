/**
 * Customer Journey Map Types
 * PRD-159: Customer Journey Map Report
 *
 * Types for visualizing and analyzing customer journeys
 * through lifecycle stages with events, milestones, and health tracking.
 */

// ============================================
// JOURNEY STAGES
// ============================================

export type JourneyStage =
  | 'prospect'
  | 'onboarding'
  | 'adoption'
  | 'growth'
  | 'maturity'
  | 'renewal'
  | 'at_risk'
  | 'churned';

export interface JourneyStageDefinition {
  id: JourneyStage;
  name: string;
  description: string;
  color: string;
  icon: string;
  typicalDurationDays: number;
  successCriteria: string[];
  keyMetrics: string[];
}

export const JOURNEY_STAGES: JourneyStageDefinition[] = [
  {
    id: 'prospect',
    name: 'Prospect',
    description: 'Pre-contract engagement and evaluation',
    color: '#6B7280', // gray
    icon: 'search',
    typicalDurationDays: 30,
    successCriteria: ['Contract signed', 'Stakeholders identified'],
    keyMetrics: ['Engagement score', 'Response rate']
  },
  {
    id: 'onboarding',
    name: 'Onboarding',
    description: 'Initial setup and activation',
    color: '#3B82F6', // blue
    icon: 'rocket',
    typicalDurationDays: 45,
    successCriteria: ['Technical setup complete', 'First value milestone achieved', 'Training completed'],
    keyMetrics: ['Time to first value', 'Onboarding completion %', 'Training completion rate']
  },
  {
    id: 'adoption',
    name: 'Adoption',
    description: 'Growing usage and feature exploration',
    color: '#8B5CF6', // purple
    icon: 'trending-up',
    typicalDurationDays: 90,
    successCriteria: ['Core features adopted', 'DAU targets met', 'Positive feedback received'],
    keyMetrics: ['Feature adoption rate', 'DAU/MAU ratio', 'Support ticket volume']
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'Expanding usage and value realization',
    color: '#10B981', // green
    icon: 'chart-up',
    typicalDurationDays: 180,
    successCriteria: ['Expansion opportunities identified', 'Case study potential', 'Multi-team usage'],
    keyMetrics: ['Expansion revenue', 'NPS score', 'Reference willingness']
  },
  {
    id: 'maturity',
    name: 'Maturity',
    description: 'Stable, high-value customer relationship',
    color: '#059669', // emerald
    icon: 'crown',
    typicalDurationDays: 365,
    successCriteria: ['Consistent high health', 'Advocacy activities', 'Strategic partnership'],
    keyMetrics: ['Health score trend', 'Expansion rate', 'Advocacy score']
  },
  {
    id: 'renewal',
    name: 'Renewal',
    description: 'Contract renewal period',
    color: '#F59E0B', // amber
    icon: 'refresh',
    typicalDurationDays: 60,
    successCriteria: ['Renewal confirmed', 'Terms negotiated', 'Contract signed'],
    keyMetrics: ['Renewal probability', 'Contract value change', 'Time to close']
  },
  {
    id: 'at_risk',
    name: 'At Risk',
    description: 'Customer showing churn indicators',
    color: '#EF4444', // red
    icon: 'alert-triangle',
    typicalDurationDays: 0,
    successCriteria: ['Risk mitigated', 'Health recovered', 'Engagement restored'],
    keyMetrics: ['Risk score', 'Days since engagement', 'Support escalations']
  },
  {
    id: 'churned',
    name: 'Churned',
    description: 'Customer has ended relationship',
    color: '#6B7280', // gray
    icon: 'x-circle',
    typicalDurationDays: 0,
    successCriteria: ['Exit interview completed', 'Data exported', 'Win-back opportunity assessed'],
    keyMetrics: ['Reason for churn', 'Lifetime value', 'Win-back potential']
  }
];

// ============================================
// JOURNEY EVENTS
// ============================================

export type JourneyEventType =
  | 'milestone'
  | 'meeting'
  | 'email'
  | 'call'
  | 'support_ticket'
  | 'health_change'
  | 'risk_signal'
  | 'contract_event'
  | 'usage_event'
  | 'nps_response'
  | 'expansion'
  | 'escalation'
  | 'note'
  | 'stage_change';

export type EventSentiment = 'positive' | 'neutral' | 'negative';
export type EventImportance = 'high' | 'medium' | 'low';

export interface JourneyEvent {
  id: string;
  customerId: string;
  type: JourneyEventType;
  title: string;
  description?: string;
  timestamp: string;
  stage: JourneyStage;
  sentiment?: EventSentiment;
  importance: EventImportance;
  metadata?: Record<string, unknown>;

  // Event-specific fields
  participants?: string[];
  outcome?: string;
  linkedEventIds?: string[];
  source?: string;
}

export interface JourneyMilestone {
  id: string;
  customerId: string;
  name: string;
  description: string;
  targetDate: string;
  achievedDate?: string;
  stage: JourneyStage;
  status: 'pending' | 'achieved' | 'missed' | 'at_risk';
  impact: 'critical' | 'high' | 'medium' | 'low';
  relatedEventIds?: string[];
}

// ============================================
// JOURNEY STAGE TRACKING
// ============================================

export interface JourneyStageRecord {
  id: string;
  customerId: string;
  stage: JourneyStage;
  enteredAt: string;
  exitedAt?: string;
  durationDays?: number;
  healthScoreAtEntry: number;
  healthScoreAtExit?: number;
  exitReason?: string;
  nextStage?: JourneyStage;
}

// ============================================
// HEALTH OVER JOURNEY
// ============================================

export interface JourneyHealthPoint {
  date: string;
  healthScore: number;
  stage: JourneyStage;
  change?: number;
  changeReason?: string;
}

// ============================================
// FRICTION POINTS
// ============================================

export interface FrictionPoint {
  id: string;
  customerId?: string; // null for aggregate friction points
  stage: JourneyStage;
  type: string;
  description: string;
  occurrenceCount: number;
  avgDelayDays: number;
  impact: 'high' | 'medium' | 'low';
  recommendations: string[];
  affectedCustomerIds?: string[];
}

// ============================================
// JOURNEY MAP DATA
// ============================================

export interface CustomerJourneyMap {
  customerId: string;
  customerName: string;
  currentStage: JourneyStage;
  journeyStartDate: string;
  daysSinceStart: number;

  // Current state
  healthScore: number;
  healthTrend: 'improving' | 'stable' | 'declining';
  arr: number;

  // Stage history
  stageHistory: JourneyStageRecord[];
  currentStageEntry: string;
  daysInCurrentStage: number;

  // Events timeline
  events: JourneyEvent[];
  recentEvents: JourneyEvent[];

  // Milestones
  milestones: JourneyMilestone[];
  nextMilestone?: JourneyMilestone;
  achievedMilestones: number;
  totalMilestones: number;

  // Health over time
  healthHistory: JourneyHealthPoint[];

  // Friction points
  frictionPoints: FrictionPoint[];

  // Summary stats
  stats: {
    totalMeetings: number;
    totalEmails: number;
    totalSupportTickets: number;
    avgResponseTime: number;
    npsScore?: number;
    expansionCount: number;
    escalationCount: number;
  };
}

// ============================================
// JOURNEY COMPARISON
// ============================================

export interface JourneyComparison {
  customers: CustomerJourneyMap[];
  averages: {
    timeToOnboard: number;
    timeToFirstValue: number;
    avgHealthScore: number;
    avgTimeInStage: Record<JourneyStage, number>;
  };
  benchmarks: {
    topPerformers: string[]; // customer IDs
    atRiskCustomers: string[];
    fastestOnboarding: string[];
  };
}

// ============================================
// JOURNEY ANALYTICS
// ============================================

export interface JourneyAnalytics {
  period: string;

  // Stage distribution
  stageDistribution: Record<JourneyStage, number>;

  // Transitions
  stageTransitions: Array<{
    from: JourneyStage;
    to: JourneyStage;
    count: number;
    avgDaysToTransition: number;
  }>;

  // Health by stage
  healthByStage: Record<JourneyStage, {
    avgHealth: number;
    minHealth: number;
    maxHealth: number;
    customerCount: number;
  }>;

  // Common friction points
  topFrictionPoints: FrictionPoint[];

  // Milestone completion rates
  milestoneCompletionRates: Record<string, number>;

  // Time to value metrics
  timeToValue: {
    avg: number;
    median: number;
    p90: number;
  };

  // Churn correlation
  churnCorrelation: Array<{
    factor: string;
    correlation: number;
    description: string;
  }>;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface JourneyMapRequest {
  customerId: string;
  dateRange?: {
    start: string;
    end: string;
  };
  includeEvents?: boolean;
  includeMilestones?: boolean;
  includeHealthHistory?: boolean;
  eventTypes?: JourneyEventType[];
}

export interface JourneyMapResponse {
  success: boolean;
  data: CustomerJourneyMap;
  meta: {
    generatedAt: string;
    dataCompleteness: number;
    eventCount: number;
    milestoneCount: number;
  };
}

export interface JourneyAnalyticsRequest {
  period?: 'week' | 'month' | 'quarter' | 'year';
  segment?: string;
  csmId?: string;
  stages?: JourneyStage[];
}

export interface JourneyAnalyticsResponse {
  success: boolean;
  data: JourneyAnalytics;
  meta: {
    generatedAt: string;
    customerCount: number;
    period: string;
  };
}
