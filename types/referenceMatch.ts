/**
 * PRD-129: Reference Needed -> Match + Request
 * TypeScript types for reference request matching and coordination
 */

// ============================================
// ENUMS & TYPE ALIASES
// ============================================

export type ReferenceRequestType = 'sales' | 'marketing' | 'analyst' | 'other';

export type ReferenceRequestStatus =
  | 'pending_match'
  | 'pending_approval'
  | 'pending_request'
  | 'awaiting_response'
  | 'scheduled'
  | 'completed'
  | 'cancelled';

export type ReferenceFormat = 'call' | 'case_study' | 'video' | 'any';

export type CSMApprovalStatus = 'pending' | 'approved' | 'rejected';

export type ReferenceResponseStatus = 'accepted' | 'declined' | 'no_response';

// ============================================
// CORE INTERFACES
// ============================================

/**
 * Requirements for a reference request
 */
export interface ReferenceRequirements {
  industry: string[];
  useCase: string[];
  companySize: string;
  features: string[];
  geography: string[];
  format: ReferenceFormat;
}

/**
 * Submitter information
 */
export interface RequestSubmitter {
  id: string;
  name: string;
  email: string;
  team?: string;
  dealId?: string;
  dealName?: string;
}

/**
 * Outcome of a completed reference
 */
export interface ReferenceOutcome {
  status: 'completed' | 'cancelled' | 'no_response';
  completedDate?: string;
  format?: ReferenceFormat;
  feedbackFromRequester?: string;
  feedbackFromCustomer?: string;
  impactOnDeal?: string;
  qualityScore?: number; // 1-5
  notes?: string;
}

/**
 * Individual match for a reference request
 */
export interface ReferenceMatch {
  id: string;
  requestId: string;
  customerId: string;
  customerName: string;
  matchScore: number; // 0-100
  matchReasons: string[];
  eligibilityScore: number; // 0-100
  eligibilityFactors: EligibilityFactor[];
  lastReferenceDate: string | null;
  referenceCount: number;
  csmApproval: CSMApprovalStatus;
  csmId?: string;
  csmName?: string;
  csmNotes: string | null;
  approvedAt?: string;
  createdAt: string;
}

/**
 * Individual eligibility factor assessment
 */
export interface EligibilityFactor {
  factor: string;
  status: 'pass' | 'warning' | 'fail';
  value: string | number;
  threshold?: string | number;
  weight: number;
  description: string;
}

/**
 * Main reference request
 */
export interface ReferenceRequest {
  id: string;
  requestType: ReferenceRequestType;
  requestedBy: RequestSubmitter;
  requirements: ReferenceRequirements;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  context?: string; // Additional context from requester
  matches: ReferenceMatch[];
  status: ReferenceRequestStatus;
  selectedMatchId: string | null;
  outcome: ReferenceOutcome | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/**
 * Customer reference profile for tracking reference history and preferences
 */
export interface CustomerReferenceProfile {
  customerId: string;
  customerName: string;
  isWilling: boolean;
  willingnessLastUpdated?: string;
  preferredFormats: ReferenceFormat[];
  topicsComfortable: string[];
  topicsToAvoid?: string[];
  availabilityNotes: string;
  preferredContactMethod?: 'email' | 'phone' | 'slack';
  preferredTimezone?: string;
  referenceCount: number;
  lastReferenceDate: string | null;
  maxReferencesPerQuarter: number;
  referencesThisQuarter: number;
  npsScore: number | null;
  healthScore: number | null;
  industry: string;
  companySize: string;
  useCases: string[];
  features: string[];
  geography: string;
  contractStatus: 'active' | 'churning' | 'churned' | 'trial';
  relationshipStrength: number; // 0-100
  recentSupportIssues: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Reference history entry
 */
export interface ReferenceHistoryEntry {
  id: string;
  customerId: string;
  requestId: string;
  requesterName: string;
  requesterTeam: string;
  format: ReferenceFormat;
  status: ReferenceResponseStatus;
  completedAt?: string;
  feedback?: string;
  qualityScore?: number;
  createdAt: string;
}

/**
 * Draft reference request email
 */
export interface ReferenceRequestDraft {
  matchId: string;
  customerId: string;
  customerName: string;
  contactEmail: string;
  contactName: string;
  subject: string;
  body: string;
  requesterContext: string;
  timeCommitment: string;
  incentive?: string;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

/**
 * Request body for creating a new reference request
 */
export interface CreateReferenceRequestBody {
  requestType: ReferenceRequestType;
  requestedBy: RequestSubmitter;
  requirements: ReferenceRequirements;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  context?: string;
}

/**
 * Response for listing reference requests
 */
export interface ReferenceRequestListResponse {
  requests: ReferenceRequest[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Response for matches
 */
export interface ReferenceMatchesResponse {
  request: ReferenceRequest;
  matches: ReferenceMatch[];
  matchingStats: {
    totalCustomersScanned: number;
    eligibleCustomers: number;
    topMatchScore: number;
    averageMatchScore: number;
    generatedAt: string;
  };
}

/**
 * Request body for CSM approval
 */
export interface MatchApprovalBody {
  csmId: string;
  csmName: string;
  approved: boolean;
  notes?: string;
}

/**
 * Request body for sending reference request
 */
export interface SendReferenceRequestBody {
  emailContent: string;
  contactEmail: string;
  contactName: string;
  csmId: string;
  incentive?: string;
}

/**
 * Filter options for reference requests
 */
export interface ReferenceRequestFilters {
  status?: ReferenceRequestStatus | ReferenceRequestStatus[];
  requestType?: ReferenceRequestType;
  requestedById?: string;
  urgency?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'dueDate' | 'urgency' | 'status';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Filter options for customer reference profiles
 */
export interface ReferenceProfileFilters {
  industry?: string;
  companySize?: string;
  isWilling?: boolean;
  minNpsScore?: number;
  minHealthScore?: number;
  format?: ReferenceFormat;
  features?: string[];
  geography?: string;
  maxReferencesPerQuarter?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

// ============================================
// CONSTANTS
// ============================================

export const REQUEST_TYPE_LABELS: Record<ReferenceRequestType, string> = {
  sales: 'Sales Reference',
  marketing: 'Marketing Campaign',
  analyst: 'Analyst Briefing',
  other: 'Other',
};

export const REQUEST_TYPE_COLORS: Record<ReferenceRequestType, string> = {
  sales: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  marketing: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  analyst: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  other: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export const STATUS_LABELS: Record<ReferenceRequestStatus, string> = {
  pending_match: 'Finding Matches',
  pending_approval: 'Awaiting CSM Approval',
  pending_request: 'Ready to Send',
  awaiting_response: 'Awaiting Customer Response',
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const STATUS_COLORS: Record<ReferenceRequestStatus, string> = {
  pending_match: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  pending_approval: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  pending_request: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  awaiting_response: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  scheduled: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export const URGENCY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const URGENCY_COLORS: Record<string, string> = {
  low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export const FORMAT_LABELS: Record<ReferenceFormat, string> = {
  call: 'Reference Call',
  case_study: 'Case Study',
  video: 'Video Testimonial',
  any: 'Any Format',
};

export const APPROVAL_LABELS: Record<CSMApprovalStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const APPROVAL_COLORS: Record<CSMApprovalStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// Eligibility thresholds as defined in PRD
export const ELIGIBILITY_THRESHOLDS = {
  healthScore: 75,
  npsPromoter: 9,
  maxRecentSupportIssues: 0,
  minRelationshipStrength: 60,
  maxReferencesPerQuarter: 2,
} as const;

// Match scoring weights
export const MATCH_WEIGHTS = {
  industry: 25,
  useCase: 20,
  companySize: 15,
  features: 15,
  geography: 10,
  referenceHistory: 15, // Penalize if overused
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate days since last reference
 */
export function daysSinceLastReference(lastReferenceDate: string | null): number | null {
  if (!lastReferenceDate) return null;
  const today = new Date();
  const lastRef = new Date(lastReferenceDate);
  const diffTime = today.getTime() - lastRef.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if customer is eligible based on core criteria
 */
export function isCustomerEligible(profile: CustomerReferenceProfile): boolean {
  if (!profile.isWilling) return false;
  if (profile.healthScore && profile.healthScore < ELIGIBILITY_THRESHOLDS.healthScore) return false;
  if (profile.npsScore && profile.npsScore < ELIGIBILITY_THRESHOLDS.npsPromoter) return false;
  if (profile.contractStatus !== 'active') return false;
  if (profile.recentSupportIssues > ELIGIBILITY_THRESHOLDS.maxRecentSupportIssues) return false;
  if (profile.referencesThisQuarter >= profile.maxReferencesPerQuarter) return false;
  return true;
}

/**
 * Get eligibility status color
 */
export function getEligibilityStatusColor(status: 'pass' | 'warning' | 'fail'): string {
  switch (status) {
    case 'pass':
      return 'text-green-400';
    case 'warning':
      return 'text-yellow-400';
    case 'fail':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

/**
 * Format match score as a percentage display
 */
export function formatMatchScore(score: number): string {
  return `${Math.round(score)}%`;
}

/**
 * Get match score color based on value
 */
export function getMatchScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

/**
 * Sort matches by score descending
 */
export function sortMatchesByScore(matches: ReferenceMatch[]): ReferenceMatch[] {
  return [...matches].sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Filter approved matches
 */
export function getApprovedMatches(matches: ReferenceMatch[]): ReferenceMatch[] {
  return matches.filter(m => m.csmApproval === 'approved');
}

/**
 * Check if request can be sent (has approved match)
 */
export function canSendRequest(request: ReferenceRequest): boolean {
  return (
    request.status === 'pending_request' &&
    request.selectedMatchId !== null &&
    request.matches.some(m => m.id === request.selectedMatchId && m.csmApproval === 'approved')
  );
}
