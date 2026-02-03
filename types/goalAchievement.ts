/**
 * Goal Achievement Types
 * PRD-137: Goal Achieved -> Success Documentation
 *
 * When customers achieve defined success goals, this feature:
 * - Documents wins automatically
 * - Celebrates achievements
 * - Leverages success stories for renewals and marketing
 */

// ============================================
// Goal Types
// ============================================

export type GoalType = 'success_plan' | 'kpi' | 'onboarding' | 'roi' | 'custom';

export type MarketingPotentialLevel = 'high' | 'medium' | 'low' | 'none';

export type AchievementStatus = 'pending' | 'verified' | 'documented' | 'celebrated' | 'marketed';

// ============================================
// Evidence Types
// ============================================

export interface Evidence {
  id: string;
  type: 'metric' | 'screenshot' | 'document' | 'testimonial' | 'email';
  title: string;
  description: string;
  url?: string;
  value?: number | string;
  collectedAt: string;
}

// ============================================
// Goal Definition
// ============================================

export interface Goal {
  id: string;
  customerId: string;
  name: string;
  type: GoalType;
  description: string;
  targetValue: number | string;
  targetDate?: string;
  kpiMetric?: string;
  status: 'active' | 'achieved' | 'missed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Goal Achievement
// ============================================

export interface GoalAchievement {
  id: string;
  customerId: string;
  customerName: string;
  goal: {
    id: string;
    name: string;
    type: GoalType;
    originalTarget: number | string;
    achievedResult: number | string;
    description?: string;
  };
  achievement: {
    achievedAt: string;
    timeToAchieve: number; // days
    percentOverTarget?: number;
    evidence: Evidence[];
    contributingFactors: string[];
    customerQuotes: string[];
  };
  documentation: {
    summaryDocId?: string;
    summaryDocUrl?: string;
    celebrationSent: boolean;
    celebrationSentAt?: string;
    customerNotified: boolean;
    customerNotifiedAt?: string;
    marketingFlagged: boolean;
    marketingFlaggedAt?: string;
    internalAnnouncementSent: boolean;
    internalAnnouncementSentAt?: string;
  };
  marketingPotential: {
    caseStudyCandidate: boolean;
    testimonialCandidate: boolean;
    referenceCandidate: boolean;
    socialProofCandidate: boolean;
    score: number; // 0-100
    reasons: string[];
  };
  status: AchievementStatus;
  csmId?: string;
  csmName?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Success Record
// ============================================

export interface SuccessRecord {
  id: string;
  achievementId: string;
  customerId: string;
  customerName: string;
  goalDescription: string;
  achievementDetails: string;
  metricsAndEvidence: string;
  timelineToAchievement: string;
  contributingFactors: string[];
  customerQuotes: string[];
  industryCategory: string;
  useCase: string;
  createdAt: string;
}

// ============================================
// Value Repository Entry
// ============================================

export interface ValueRepositoryEntry {
  id: string;
  customerId: string;
  customerName: string;
  industry: string;
  useCase: string;
  achievementType: GoalType;
  title: string;
  summary: string;
  quantifiedValue: string;
  timeframe: string;
  searchTags: string[];
  availableFor: ('qbr' | 'renewal' | 'sales' | 'marketing')[];
  createdAt: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface RecordAchievementRequest {
  customerId: string;
  goalId?: string;
  goalType: GoalType;
  goalName: string;
  originalTarget: number | string;
  achievedResult: number | string;
  evidence?: Omit<Evidence, 'id'>[];
  contributingFactors?: string[];
  customerQuotes?: string[];
  verificationMethod?: 'automatic' | 'manual';
}

export interface CelebrationOptions {
  sendSlackAnnouncement: boolean;
  sendCustomerEmail: boolean;
  addToWinsDashboard: boolean;
  updateCustomerRecord: boolean;
  customMessage?: string;
}

export interface MarketingFlagRequest {
  achievementId: string;
  caseStudyCandidate: boolean;
  testimonialCandidate: boolean;
  referenceCandidate: boolean;
  socialProofCandidate: boolean;
  notes?: string;
}

// ============================================
// Dashboard Types
// ============================================

export interface AchievementSummary {
  totalAchievements: number;
  achievementsThisMonth: number;
  achievementsThisQuarter: number;
  pendingCelebrations: number;
  marketingOpportunities: number;
  byType: Record<GoalType, number>;
  topIndustries: { industry: string; count: number }[];
  topUseCases: { useCase: string; count: number }[];
  recentAchievements: GoalAchievement[];
}

export interface CustomerSuccessTimeline {
  customerId: string;
  customerName: string;
  achievements: Array<{
    id: string;
    goalName: string;
    achievedAt: string;
    type: GoalType;
    value: string;
  }>;
  totalGoalsAchieved: number;
  avgTimeToAchieve: number;
  nextGoals: Goal[];
}

// ============================================
// Filters
// ============================================

export interface AchievementFilters {
  customerId?: string;
  goalType?: GoalType;
  status?: AchievementStatus;
  marketingCandidate?: boolean;
  dateFrom?: string;
  dateTo?: string;
  industry?: string;
  useCase?: string;
  search?: string;
  sortBy?: 'date' | 'customer' | 'type' | 'marketing_score';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// ============================================
// API Response Types
// ============================================

export interface GoalAchievementResponse {
  success: boolean;
  data: GoalAchievement;
  message?: string;
}

export interface AchievementListResponse {
  success: boolean;
  data: GoalAchievement[];
  total: number;
  summary: AchievementSummary;
}

export interface ValueRepositoryResponse {
  success: boolean;
  data: ValueRepositoryEntry[];
  total: number;
  filters: {
    industries: string[];
    useCases: string[];
    achievementTypes: GoalType[];
  };
}
