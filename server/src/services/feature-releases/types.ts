/**
 * PRD-099: High-Value Feature Released Alert
 * Type definitions for feature release service
 */

// ============================================
// Product Release Types
// ============================================

export interface ProductRelease {
  id: string;
  featureId: string;
  featureName: string;
  description: string | null;
  releaseDate: string;
  tierAvailability: ProductTier[];
  keywords: string[];
  documentationUrl: string | null;
  videoUrl: string | null;
  announcementContent: string | null;
  enablementResources: EnablementResources;
  category: string | null;
  status: ReleaseStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProductTier = 'starter' | 'professional' | 'enterprise';
export type ReleaseStatus = 'draft' | 'active' | 'deprecated';

export interface EnablementResources {
  videos?: EnablementVideo[];
  docs?: EnablementDoc[];
  trainings?: EnablementTraining[];
}

export interface EnablementVideo {
  title: string;
  url: string;
  durationMinutes?: number;
}

export interface EnablementDoc {
  title: string;
  url: string;
}

export interface EnablementTraining {
  title: string;
  date: string;
  registrationUrl?: string;
}

// ============================================
// Feature Request Types
// ============================================

export interface FeatureRequest {
  id: string;
  requestId: string;
  customerId: string;
  requesterName: string | null;
  requesterEmail: string | null;
  title: string;
  description: string | null;
  keywords: string[];
  priority: FeatureRequestPriority;
  status: FeatureRequestStatus;
  votes: number;
  linkedReleaseId: string | null;
  submittedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FeatureRequestPriority = 'low' | 'medium' | 'high' | 'critical';
export type FeatureRequestStatus = 'open' | 'under_review' | 'planned' | 'in_progress' | 'released' | 'declined';

// ============================================
// Release Customer Match Types
// ============================================

export interface ReleaseCustomerMatch {
  id: string;
  releaseId: string;
  customerId: string;
  matchReason: MatchReason;
  matchScore: number;
  matchDetails: MatchDetails;
  featureRequestId: string | null;
  csmUserId: string | null;
  alertSentAt: string | null;
  announcedAt: string | null;
  announcementMethod: AnnouncementMethod | null;
  adoptedAt: string | null;
  adoptionNotes: string | null;
  outreachTaskId: string | null;
  outreachTaskCreatedAt: string | null;
  outreachTaskDueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MatchReason = 'feature_request' | 'use_case' | 'usage_pattern' | 'keyword_match';
export type AnnouncementMethod = 'email' | 'call' | 'meeting' | 'slack';

export interface MatchDetails {
  featureRequestId?: string;
  usageMetrics?: Record<string, number>;
  matchedKeywords?: string[];
  customerGoals?: string[];
  relevanceExplanation?: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateReleaseRequest {
  featureId: string;
  featureName: string;
  description?: string;
  releaseDate?: string;
  tierAvailability?: ProductTier[];
  keywords?: string[];
  documentationUrl?: string;
  videoUrl?: string;
  announcementContent?: string;
  enablementResources?: EnablementResources;
  category?: string;
}

export interface PublishReleaseRequest {
  releaseId: string;
  minMatchScore?: number; // Minimum score for customer matching (default: 60)
  notifyCSMs?: boolean; // Whether to send Slack alerts
}

export interface MarkAnnouncedRequest {
  matchId: string;
  method: AnnouncementMethod;
  notes?: string;
}

export interface MarkAdoptedRequest {
  matchId: string;
  notes?: string;
}

// ============================================
// Alert Types
// ============================================

export interface FeatureReleaseAlertData {
  matchId: string;
  releaseId: string;
  customerId: string;
  customerName: string;
  customerArr: number;
  customerTier: string;
  customerHealthScore: number | null;
  championName?: string;
  championTitle?: string;

  featureName: string;
  featureDescription: string | null;
  releaseDate: string;

  matchReason: MatchReason;
  matchScore: number;
  matchDetails: MatchDetails;

  featureRequest?: {
    requestId: string;
    title: string;
    submittedAt: string;
  };

  usageHighlights?: {
    metric: string;
    value: string;
    relevance: string;
  }[];

  featureHighlights: string[];
  enablementResources: EnablementResources;
}

// ============================================
// Match Scoring Configuration
// ============================================

export interface MatchScoringConfig {
  // Weight for different match types (total should be 100)
  featureRequestWeight: number; // Direct feature request match
  keywordMatchWeight: number; // Keywords from goals/usage
  usagePatternWeight: number; // Usage patterns suggest need
  tierMatchWeight: number; // Customer tier matches feature tier

  // Bonus points
  championRequestBonus: number; // Champion made the request
  highUsageBonus: number; // High usage of related features
  recentRequestBonus: number; // Request made in last 90 days
}

export const DEFAULT_SCORING_CONFIG: MatchScoringConfig = {
  featureRequestWeight: 40,
  keywordMatchWeight: 25,
  usagePatternWeight: 20,
  tierMatchWeight: 15,
  championRequestBonus: 10,
  highUsageBonus: 10,
  recentRequestBonus: 5,
};

// ============================================
// Database Row Types (snake_case)
// ============================================

export interface ProductReleaseRow {
  id: string;
  feature_id: string;
  feature_name: string;
  description: string | null;
  release_date: string;
  tier_availability: string[];
  keywords: string[];
  documentation_url: string | null;
  video_url: string | null;
  announcement_content: string | null;
  enablement_resources: EnablementResources;
  category: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeatureRequestRow {
  id: string;
  request_id: string;
  customer_id: string;
  requester_name: string | null;
  requester_email: string | null;
  title: string;
  description: string | null;
  keywords: string[];
  priority: string;
  status: string;
  votes: number;
  linked_release_id: string | null;
  submitted_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReleaseCustomerMatchRow {
  id: string;
  release_id: string;
  customer_id: string;
  match_reason: string;
  match_score: number;
  match_details: MatchDetails;
  feature_request_id: string | null;
  csm_user_id: string | null;
  alert_sent_at: string | null;
  announced_at: string | null;
  announcement_method: string | null;
  adopted_at: string | null;
  adoption_notes: string | null;
  outreach_task_id: string | null;
  outreach_task_created_at: string | null;
  outreach_task_due_date: string | null;
  created_at: string;
  updated_at: string;
}
