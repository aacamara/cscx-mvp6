/**
 * Churn Post-Mortem Types (PRD-124)
 * Type definitions for automated churn post-mortem workflows
 */

// ============================================
// Core Types
// ============================================

export type ChurnReason =
  | 'price_value'
  | 'product_gaps'
  | 'poor_onboarding'
  | 'champion_left'
  | 'strategic_ma'
  | 'competitive'
  | 'support_issues'
  | 'relationship'
  | 'budget_cuts'
  | 'other';

export type ChurnPostMortemStatus =
  | 'initiated'
  | 'data_gathered'
  | 'analysis_pending'
  | 'review_scheduled'
  | 'completed'
  | 'closed';

export type WinBackPotential = 'high' | 'medium' | 'low' | 'none';

export type ChurnDetectionSource =
  | 'stage_change'
  | 'non_renewal'
  | 'cancellation'
  | 'deactivation'
  | 'manual';

// ============================================
// Health Score History
// ============================================

export interface HealthScorePoint {
  date: string;
  score: number;
  color: 'green' | 'yellow' | 'red';
  notes?: string;
}

// ============================================
// Risk Signals
// ============================================

export interface RiskSignal {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: string;
  resolvedAt?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// Support Summary
// ============================================

export interface SupportSummary {
  totalTickets: number;
  openTickets: number;
  avgResolutionTime: number; // in hours
  escalations: number;
  csat: number | null;
  recentIssues: Array<{
    id: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
  }>;
}

// ============================================
// Meeting Sentiment
// ============================================

export interface SentimentSummary {
  meetingId: string;
  date: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number; // -1 to 1
  keyTopics: string[];
  concerns: string[];
  attendees: string[];
}

// ============================================
// Usage Trend
// ============================================

export interface UsageTrend {
  period: string; // e.g., '30d', '90d'
  activeUsers: {
    current: number;
    previous: number;
    trend: 'up' | 'down' | 'stable';
    percentChange: number;
  };
  loginFrequency: {
    current: number;
    previous: number;
    trend: 'up' | 'down' | 'stable';
    percentChange: number;
  };
  featureAdoption: {
    current: number;
    previous: number;
    trend: 'up' | 'down' | 'stable';
    percentChange: number;
  };
  dataPoints: Array<{
    date: string;
    activeUsers: number;
    sessions: number;
    features: number;
  }>;
}

// ============================================
// Save Play Summary
// ============================================

export interface SavePlaySummary {
  id: string;
  name: string;
  type: string;
  startedAt: string;
  completedAt?: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  outcome?: 'successful' | 'unsuccessful';
  actions: Array<{
    action: string;
    completedAt?: string;
    result?: string;
  }>;
}

// ============================================
// Timeline Event
// ============================================

export interface TimelineEvent {
  id: string;
  date: string;
  type: 'email' | 'meeting' | 'call' | 'note' | 'milestone' | 'risk' | 'support' | 'product' | 'contract';
  title: string;
  description?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  importance: 'low' | 'medium' | 'high';
  participants?: string[];
  metadata?: Record<string, unknown>;
}

// ============================================
// Data Compilation
// ============================================

export interface ChurnDataCompilation {
  id: string;
  postMortemId: string;
  healthScoreHistory: HealthScorePoint[];
  riskSignals: RiskSignal[];
  supportSummary: SupportSummary;
  meetingSentiments: SentimentSummary[];
  usageTrend: UsageTrend;
  savePlays: SavePlaySummary[];
  interactionTimeline: TimelineEvent[];
  compiledAt: string;
  compiledBy: string;
}

// ============================================
// Root Causes
// ============================================

export interface RootCauses {
  primary: ChurnReason | null;
  contributing: ChurnReason[];
  customNotes: string;
}

// ============================================
// Analysis
// ============================================

export interface ChurnAnalysis {
  id: string;
  postMortemId: string;
  documentId: string;
  earlyWarningSignals: string[];
  missedOpportunities: string[];
  lessonsLearned: string[];
  recommendations: string[];
  executiveSummary: string;
  customerSnapshot: CustomerSnapshot;
  churnTimeline: ChurnTimelineEvent[];
  generatedAt: string;
  generatedBy: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface CustomerSnapshot {
  name: string;
  industry?: string;
  arr: number;
  segment?: string;
  tier?: string;
  tenure: number; // months as customer
  healthScoreAtChurn: number;
  csmName?: string;
  primaryContact?: {
    name: string;
    email: string;
    title?: string;
  };
  products: string[];
  contractStartDate?: string;
  renewalDate?: string;
}

export interface ChurnTimelineEvent {
  date: string;
  event: string;
  significance: 'critical' | 'major' | 'minor';
  category: 'engagement' | 'product' | 'support' | 'relationship' | 'contract' | 'external';
}

// ============================================
// Win-Back Assessment
// ============================================

export interface WinBackAssessment {
  potential: WinBackPotential;
  triggers: string[];
  reminderDate: string | null;
  notes?: string;
}

// ============================================
// Review
// ============================================

export interface PostMortemReview {
  scheduledAt: string | null;
  attendees: string[];
  outcome: string | null;
}

// ============================================
// Main Churn Post-Mortem Interface
// ============================================

export interface ChurnPostMortem {
  id: string;
  customerId: string;
  customerName?: string; // Joined from customers table
  churnDate: string;
  arrLost: number;
  status: ChurnPostMortemStatus;
  detectionSource: ChurnDetectionSource;
  detectedAt: string;
  detectedBy?: string;
  rootCauses: RootCauses;
  dataCompilation?: ChurnDataCompilation;
  analysis?: ChurnAnalysis;
  winBackAssessment: WinBackAssessment;
  review: PostMortemReview;
  documentId?: string;
  documentUrl?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  createdBy?: string;
  assignedTo?: string;
}

// ============================================
// Churn Patterns
// ============================================

export type ChurnPatternType = 'root_cause' | 'segment' | 'seasonal' | 'csm' | 'early_warning';

export interface ChurnPattern {
  id: string;
  patternType: ChurnPatternType;
  patternName: string;
  patternDescription?: string;
  occurrenceCount: number;
  affectedArr: number;
  breakdownData: Record<string, unknown>;
  periodStart?: string;
  periodEnd?: string;
  lastUpdated: string;
}

export interface ChurnPatternAnalysis {
  rootCauseDistribution: Array<{
    reason: ChurnReason;
    count: number;
    arr: number;
    percentage: number;
  }>;
  segmentTrends: Array<{
    segment: string;
    churns: number;
    arr: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  seasonalPatterns: Array<{
    period: string;
    churns: number;
    arr: number;
  }>;
  earlyWarningIndicators: Array<{
    indicator: string;
    occurrences: number;
    leadTimeAvg: number; // days before churn
  }>;
  csmPerformance: Array<{
    csmName: string;
    totalCustomers: number;
    churns: number;
    retentionRate: number;
  }>;
}

// ============================================
// Churn Events
// ============================================

export type ChurnEventType =
  | 'churn_detected'
  | 'post_mortem_initiated'
  | 'data_compiled'
  | 'analysis_generated'
  | 'root_cause_set'
  | 'review_scheduled'
  | 'review_completed'
  | 'post_mortem_completed'
  | 'win_back_reminder_set'
  | 'stakeholder_notified';

export interface ChurnEvent {
  id: string;
  postMortemId?: string;
  customerId: string;
  eventType: ChurnEventType;
  eventData: Record<string, unknown>;
  triggeredBy: string;
  createdAt: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface InitiatePostMortemRequest {
  customerId: string;
  churnDate?: string;
  detectionSource?: ChurnDetectionSource;
  arrLost?: number;
}

export interface InitiatePostMortemResponse {
  success: boolean;
  postMortem: ChurnPostMortem;
  message: string;
}

export interface SetRootCauseRequest {
  primary: ChurnReason;
  contributing?: ChurnReason[];
  customNotes?: string;
}

export interface CompletePostMortemRequest {
  lessonsLearned?: string[];
  recommendations?: string[];
  reviewOutcome?: string;
  winBackAssessment?: WinBackAssessment;
}

export interface ChurnPatternsResponse {
  success: boolean;
  patterns: ChurnPatternAnalysis;
  period: {
    start: string;
    end: string;
  };
}

// ============================================
// Churn Reason Labels
// ============================================

export const CHURN_REASON_LABELS: Record<ChurnReason, string> = {
  price_value: 'Price/Value',
  product_gaps: 'Product/Feature Gaps',
  poor_onboarding: 'Poor Onboarding',
  champion_left: 'Champion Departure',
  strategic_ma: 'Strategic/M&A',
  competitive: 'Competitive Displacement',
  support_issues: 'Support Issues',
  relationship: 'Relationship Breakdown',
  budget_cuts: 'Budget Cuts',
  other: 'Other'
};

export const CHURN_STATUS_LABELS: Record<ChurnPostMortemStatus, string> = {
  initiated: 'Initiated',
  data_gathered: 'Data Gathered',
  analysis_pending: 'Analysis Pending',
  review_scheduled: 'Review Scheduled',
  completed: 'Completed',
  closed: 'Closed'
};

export const WIN_BACK_POTENTIAL_LABELS: Record<WinBackPotential, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None'
};
