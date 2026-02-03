/**
 * PRD-144: Renewal Won -> Celebration + Planning
 * TypeScript types for renewal celebration and planning automation
 */

// ============================================
// Core Types
// ============================================

export type CelebrationStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'skipped';

export type PlanningStatus =
  | 'not_started'
  | 'scheduled'
  | 'in_progress'
  | 'completed';

export type RecognitionType =
  | 'champion_thank_you'
  | 'executive_sponsor_acknowledgment'
  | 'decision_maker_appreciation'
  | 'team_recognition';

export type ExpansionTiming =
  | 'warm_up'          // 1-2 weeks post-renewal
  | 'ready_to_engage'  // 3-4 weeks post-renewal
  | 'active_pursuit';  // Expansion conversation ongoing

export type RenewalSource =
  | 'salesforce'
  | 'contract_signed'
  | 'pipeline_update'
  | 'manual';

// ============================================
// Recognition Action
// ============================================

export interface RecognitionAction {
  id: string;
  stakeholderId: string;
  stakeholderName: string;
  stakeholderRole: string;
  recognitionType: RecognitionType;
  status: CelebrationStatus;
  draftId: string | null;
  draftContent?: {
    subject: string;
    body: string;
  };
  sentAt: Date | null;
  notes?: string;
}

// ============================================
// Renewal Celebration
// ============================================

export interface RenewalCelebration {
  id: string;
  customerId: string;
  customerName: string;
  renewalId: string;
  renewal: {
    arr: number;
    change: number; // ARR change (positive = expansion, negative = contraction)
    changePercent: number;
    term: string; // e.g., "1 year", "2 years", "month-to-month"
    closedAt: Date;
    yearNumber: number; // Year of relationship (1st, 2nd, 3rd renewal, etc.)
    isStrategic: boolean;
    isMultiYear: boolean;
  };
  celebration: {
    customerOutreach: {
      status: CelebrationStatus;
      templateUsed: string | null;
      draftId: string | null;
      draftContent?: {
        subject: string;
        body: string;
      };
      sentAt: Date | null;
      responseReceived: boolean;
      responseAt: Date | null;
    };
    internalAnnouncement: {
      status: CelebrationStatus;
      channel: string;
      messageId: string | null;
      sentAt: Date | null;
      reactions: number;
    };
    stakeholderRecognition: RecognitionAction[];
    giftConsideration?: {
      recommended: boolean;
      tier: 'standard' | 'premium' | 'executive';
      suggestions: string[];
      approved: boolean;
      sentAt: Date | null;
    };
  };
  planning: {
    status: PlanningStatus;
    successPlanMeeting: {
      scheduled: boolean;
      scheduledAt: Date | null;
      meetingId: string | null;
      completed: boolean;
      completedAt: Date | null;
    };
    goalSettingSession: {
      inviteSent: boolean;
      inviteSentAt: Date | null;
      scheduled: boolean;
      scheduledAt: Date | null;
    };
    expansionAssessment: {
      completed: boolean;
      completedAt: Date | null;
      opportunities: ExpansionOpportunity[];
      timing: ExpansionTiming;
      coordinatedWithSales: boolean;
    };
    relationshipDeepening: {
      planCreated: boolean;
      planId: string | null;
      actions: string[];
    };
    nextSteps: PlanningNextStep[];
  };
  csmId: string;
  csmName?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Expansion Opportunity
// ============================================

export interface ExpansionOpportunity {
  id: string;
  type: 'upsell' | 'cross_sell' | 'additional_seats' | 'new_team';
  name: string;
  description: string;
  estimatedValue: number;
  confidence: 'low' | 'medium' | 'high';
  timing: string; // e.g., "Q2 2026"
  signals: string[];
}

// ============================================
// Planning Next Step
// ============================================

export interface PlanningNextStep {
  id: string;
  title: string;
  description?: string;
  dueDate: Date | null;
  assignee?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completedAt: Date | null;
}

// ============================================
// Celebration Template
// ============================================

export interface CelebrationTemplate {
  id: string;
  name: string;
  type: 'customer_outreach' | 'internal_announcement' | 'stakeholder_recognition';
  tenure: 'first_year' | 'multi_year' | 'strategic';
  subject?: string;
  body: string;
  variables: string[]; // Placeholders like {{customerName}}, {{yearNumber}}, etc.
  isActive: boolean;
}

// ============================================
// API Request/Response Types
// ============================================

export interface TriggerCelebrationInput {
  customerId: string;
  renewalId: string;
  source: RenewalSource;
  renewalData: {
    arr: number;
    change: number;
    term: string;
    closedAt: string | Date;
    yearNumber?: number;
    isStrategic?: boolean;
    isMultiYear?: boolean;
  };
  skipCelebration?: boolean;
}

export interface CelebrationListResponse {
  celebrations: RenewalCelebration[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  summary: {
    pending: number;
    inProgress: number;
    completed: number;
    totalArrCelebrated: number;
  };
}

export interface CelebrationDetailResponse {
  celebration: RenewalCelebration;
  templates: CelebrationTemplate[];
  recommendations: CelebrationRecommendation[];
  timeline: CelebrationTimelineEvent[];
}

export interface CelebrationRecommendation {
  type: 'outreach' | 'recognition' | 'planning' | 'expansion';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  suggestedAction: string;
  dueWithin?: string; // e.g., "24 hours", "2 weeks"
}

export interface CelebrationTimelineEvent {
  id: string;
  timestamp: Date;
  type: 'renewal_detected' | 'celebration_started' | 'outreach_sent' | 'announcement_posted' | 'meeting_scheduled' | 'planning_completed';
  description: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// Draft Generation
// ============================================

export interface GenerateOutreachDraftInput {
  celebrationId: string;
  templateId?: string;
  tone?: 'formal' | 'warm' | 'enthusiastic';
  customInstructions?: string;
}

export interface GenerateOutreachDraftResult {
  subject: string;
  body: string;
  suggestedSendTime?: Date;
  personalizationNotes: string[];
}

export interface GenerateAnnouncementInput {
  celebrationId: string;
  channel?: string;
  includeMetrics?: boolean;
  highlightAchievements?: boolean;
}

export interface GenerateAnnouncementResult {
  message: string;
  suggestedChannel: string;
  attachmentSuggestions?: string[];
}

// ============================================
// Metrics
// ============================================

export interface CelebrationMetrics {
  period: {
    startDate: string;
    endDate: string;
  };
  totalRenewals: number;
  celebratedCount: number;
  celebrationRate: number; // percentage
  customerResponseRate: number; // percentage of responses to celebrations
  averageTimeToOutreach: number; // hours
  planningCompletionRate: number; // percentage
  arrCelebrated: number;
  byTenure: {
    firstYear: number;
    multiYear: number;
    strategic: number;
  };
  topRecognizedStakeholders: Array<{
    name: string;
    count: number;
    lastRecognizedAt: Date;
  }>;
}

// ============================================
// Event Types (for triggers)
// ============================================

export interface RenewalWonEvent {
  id: string;
  type: 'renewal_won';
  customerId: string;
  customerName: string;
  data: {
    renewalId: string;
    arr: number;
    arrChange: number;
    term: string;
    yearNumber: number;
    closedAt: Date;
    source: RenewalSource;
    champion?: {
      id: string;
      name: string;
      email: string;
    };
    executiveSponsor?: {
      id: string;
      name: string;
      email: string;
    };
  };
  timestamp: Date;
  source: string;
}

// ============================================
// Constants
// ============================================

export const CELEBRATION_TIMING = {
  CUSTOMER_OUTREACH_HOURS: 24,
  INTERNAL_ANNOUNCEMENT_HOURS: 24,
  PLANNING_MEETING_DAYS: 14,
  EXPANSION_WARM_UP_DAYS: 14,
} as const;

export const GIFT_TIERS: Record<string, { minArr: number; suggestions: string[] }> = {
  standard: {
    minArr: 0,
    suggestions: ['Handwritten thank you card', 'Company branded gift', 'Digital gift card'],
  },
  premium: {
    minArr: 50000,
    suggestions: ['Curated gift basket', 'Experience voucher', 'Premium merchandise'],
  },
  executive: {
    minArr: 100000,
    suggestions: ['Executive experience', 'Personalized gift', 'Donation in their name'],
  },
};

export const TENURE_LABELS: Record<number, string> = {
  1: 'First Year',
  2: 'Second Year',
  3: 'Third Year',
  4: 'Fourth Year',
  5: 'Fifth Year',
};

export const STATUS_LABELS: Record<CelebrationStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  skipped: 'Skipped',
};

export const STATUS_COLORS: Record<CelebrationStatus, string> = {
  pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  skipped: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};
