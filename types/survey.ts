/**
 * CSCX.AI Survey Types
 * PRD-142: Survey Completed -> Analysis + Action
 *
 * Unified survey response types for NPS, CSAT, onboarding, QBR, and custom surveys.
 */

// ============================================
// Survey Types
// ============================================

export type SurveyType = 'nps' | 'csat' | 'onboarding' | 'qbr' | 'custom';

export type SurveyCategory = 'promoter' | 'passive' | 'detractor' | 'n/a';

export type Sentiment = 'positive' | 'neutral' | 'negative';

export type Urgency = 'high' | 'medium' | 'low';

export type FollowUpType =
  | 'thank_you'
  | 'reference_request'
  | 'engagement_opportunity'
  | 'concern_acknowledgment'
  | 'issue_resolution'
  | 'check_in';

export type LoopClosureStatus =
  | 'pending'
  | 'acknowledged'
  | 'follow_up_sent'
  | 'issue_addressed'
  | 're_surveyed'
  | 'closed';

// ============================================
// Survey Response
// ============================================

export interface SurveyResponse {
  id: string;
  customerId: string;
  stakeholderId: string | null;
  survey: {
    id: string;
    type: SurveyType;
    name: string;
    campaign?: string;
  };
  respondent: {
    email: string;
    name?: string;
    role?: string;
  };
  response: {
    score: number | null;
    maxScore: number;
    verbatim: string | null;
    answers: Record<string, unknown>;
    submittedAt: Date;
  };
  analysis: SurveyAnalysis | null;
  category: SurveyCategory;
  followUp: FollowUpState;
  csmNotified: boolean;
  notifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SurveyAnalysis {
  sentiment: Sentiment;
  sentimentScore: number; // -1 to 1
  urgency: Urgency;
  themes: string[];
  keyPoints: string[];
  scoreChange: number | null;
  previousScore: number | null;
  previousCategory: SurveyCategory | null;
  mentionsCompetitor: boolean;
  competitorName?: string;
  actionableItems: string[];
  suggestedFollowUp: FollowUpType;
}

export interface FollowUpState {
  required: boolean;
  type: FollowUpType | null;
  draftId: string | null;
  draftContent?: {
    subject: string;
    body: string;
  };
  sent: boolean;
  sentAt: Date | null;
  closedLoop: boolean;
  closedAt: Date | null;
  status: LoopClosureStatus;
  notes?: string;
}

// ============================================
// Survey Configuration
// ============================================

export interface SurveyConfig {
  id: string;
  type: SurveyType;
  name: string;
  description?: string;
  scoreRanges: {
    promoter: { min: number; max: number };
    passive: { min: number; max: number };
    detractor: { min: number; max: number };
  };
  maxScore: number;
  notificationRules: {
    notifyOnDetractor: boolean;
    notifyOnScoreDrop: number; // Threshold for point drop
    notifyOnUrgentFeedback: boolean;
    notifyOnCompetitorMention: boolean;
  };
  autoFollowUp: {
    enabled: boolean;
    promoterTemplate?: string;
    passiveTemplate?: string;
    detractorTemplate?: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Survey Trend Analysis
// ============================================

export interface SurveyTrend {
  customerId: string;
  surveyType: SurveyType;
  period: 'week' | 'month' | 'quarter' | 'year';
  metrics: {
    responseCount: number;
    averageScore: number | null;
    npsScore: number | null;
    categoryBreakdown: {
      promoter: number;
      passive: number;
      detractor: number;
    };
    trend: 'improving' | 'stable' | 'declining';
    trendPercentage: number;
  };
  themes: Array<{
    theme: string;
    count: number;
    sentiment: Sentiment;
  }>;
  comparisonPeriod?: {
    averageScore: number | null;
    npsScore: number | null;
    categoryBreakdown: {
      promoter: number;
      passive: number;
      detractor: number;
    };
  };
}

// ============================================
// Survey Notification
// ============================================

export interface SurveyNotification {
  id: string;
  surveyResponseId: string;
  customerId: string;
  type: 'detractor_alert' | 'score_drop' | 'urgent_feedback' | 'competitor_mention' | 'follow_up_reminder';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metadata: {
    score?: number;
    previousScore?: number;
    category?: SurveyCategory;
    themes?: string[];
    verbatimExcerpt?: string;
  };
  channels: Array<'in_app' | 'email' | 'slack'>;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  createdAt: Date;
}

// ============================================
// API Input/Output Types
// ============================================

export interface CreateSurveyResponseInput {
  customerId: string;
  stakeholderId?: string;
  surveyId: string;
  surveyType: SurveyType;
  surveyName: string;
  surveyCampaign?: string;
  respondentEmail: string;
  respondentName?: string;
  respondentRole?: string;
  score: number | null;
  maxScore?: number;
  verbatim?: string;
  answers?: Record<string, unknown>;
  submittedAt?: string | Date;
}

export interface SurveyResponseWithCustomer extends SurveyResponse {
  customer: {
    id: string;
    name: string;
    arr?: number;
    healthScore?: number;
    stage?: string;
  };
}

export interface SurveyAnalyticsResult {
  totalResponses: number;
  byType: Record<SurveyType, {
    count: number;
    averageScore: number | null;
    npsScore: number | null;
    categoryBreakdown: {
      promoter: number;
      passive: number;
      detractor: number;
    };
  }>;
  overallTrend: 'improving' | 'stable' | 'declining';
  topThemes: Array<{
    theme: string;
    count: number;
    surveyTypes: SurveyType[];
    sentiment: Sentiment;
  }>;
  followUpMetrics: {
    totalRequired: number;
    sent: number;
    loopsClosed: number;
    closeRate: number;
  };
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
}

export interface GenerateFollowUpInput {
  surveyResponseId: string;
  customizePrompt?: string;
  tone?: 'formal' | 'friendly' | 'empathetic';
}

export interface GenerateFollowUpResult {
  subject: string;
  body: string;
  talkingPoints: string[];
  suggestedActions: string[];
  sentiment: Sentiment;
}

// ============================================
// Webhook Payloads
// ============================================

export interface DelightedWebhookPayload {
  person: {
    email: string;
    name?: string;
  };
  survey_response: {
    id: string;
    score: number;
    comment?: string;
    created_at: string;
  };
}

export interface SurveyMonkeyWebhookPayload {
  object_type: string;
  object_id: string;
  event_type: string;
  event_datetime: string;
  resources: {
    survey_id: string;
    response_id: string;
  };
}

export interface TypeformWebhookPayload {
  form_response: {
    form_id: string;
    token: string;
    submitted_at: string;
    hidden?: Record<string, string>;
    answers: Array<{
      type: string;
      field: { id: string; type: string; ref: string };
      number?: number;
      email?: string;
      text?: string;
    }>;
  };
}

// ============================================
// Survey Response Events (for triggers)
// ============================================

export interface SurveyResponseEvent {
  id: string;
  type: 'survey_response';
  customerId: string;
  customerName?: string;
  data: {
    surveyType: SurveyType;
    surveyName: string;
    score: number | null;
    maxScore: number;
    category: SurveyCategory;
    verbatim?: string;
    analysis?: SurveyAnalysis;
    respondent: {
      email: string;
      name?: string;
      role?: string;
    };
    isDetractor: boolean;
    isScoreDrop: boolean;
    scoreDropAmount?: number;
    previousCategory?: SurveyCategory;
  };
  timestamp: Date;
  source: string;
}
