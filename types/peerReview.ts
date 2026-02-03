/**
 * PRD-253: Peer Review Workflow Types
 *
 * TypeScript interfaces for the peer review system.
 */

// ============================================
// ENUMS
// ============================================

export type ReviewContentType =
  | 'email_draft'
  | 'proposal'
  | 'document'
  | 'action'
  | 'escalation_response';

export type ReviewType = 'quality' | 'accuracy' | 'compliance' | 'coaching';

export type ReviewUrgency = 'low' | 'normal' | 'high' | 'urgent';

export type ReviewRequestStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'changes_requested'
  | 'rejected'
  | 'expired'
  | 'cancelled';

export type AssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'declined';

export type ReviewDecision = 'approved' | 'changes_requested' | 'rejected';

export type CommentType = 'inline' | 'general';

export type CommentSeverity = 'critical' | 'important' | 'suggestion';

export type AuditAction =
  | 'requested'
  | 'assigned'
  | 'started'
  | 'commented'
  | 'resolved_comment'
  | 'approved'
  | 'changes_requested'
  | 'rejected'
  | 'declined'
  | 'sent'
  | 'expired'
  | 'cancelled';

// ============================================
// CORE INTERFACES
// ============================================

export interface ReviewRequest {
  id: string;
  requestedByUserId: string;
  customerId?: string;

  // Content
  contentType: ReviewContentType;
  contentId?: string;
  contentSnapshot: string;
  contentMetadata: Record<string, any>;

  // Request details
  reviewType: ReviewType;
  focusAreas?: string;
  urgency: ReviewUrgency;
  dueAt?: Date;

  // Status
  status: ReviewRequestStatus;
  requiresApproval: boolean;
  autoApproveAt?: Date;

  // Consensus
  requiredApprovals: number;
  approvalCount: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Populated fields (from joins)
  requestedByUser?: User;
  customer?: Customer;
  assignments?: ReviewAssignment[];
}

export interface ReviewAssignment {
  id: string;
  requestId: string;
  reviewerUserId: string;

  status: AssignmentStatus;
  decision?: ReviewDecision;
  overallFeedback?: string;
  rating?: number; // 1-5

  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;

  // Populated fields
  reviewerUser?: User;
  comments?: ReviewComment[];
}

export interface ReviewComment {
  id: string;
  assignmentId: string;
  reviewerUserId: string;

  commentType: CommentType;
  selectionStart?: number;
  selectionEnd?: number;
  selectionText?: string;

  comment: string;
  suggestion?: string;
  severity: CommentSeverity;

  isResolved: boolean;
  resolvedByUserId?: string;
  resolvedAt?: Date;
  resolutionNote?: string;

  createdAt: Date;

  // Populated fields
  reviewerUser?: User;
  resolvedByUser?: User;
}

export interface ReviewAuditLogEntry {
  id: string;
  requestId?: string;
  assignmentId?: string;
  userId: string;
  action: AuditAction;
  details: Record<string, any>;
  createdAt: Date;

  // Populated fields
  user?: User;
}

// ============================================
// USER & CUSTOMER (simplified for this module)
// ============================================

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  teamId?: string;
}

export interface Customer {
  id: string;
  name: string;
  industry?: string;
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

export interface CreateReviewRequestInput {
  customerId?: string;
  contentType: ReviewContentType;
  contentId?: string;
  contentSnapshot: string;
  contentMetadata?: Record<string, any>;
  reviewType?: ReviewType;
  focusAreas?: string;
  urgency?: ReviewUrgency;
  dueAt?: string; // ISO date string
  requiresApproval?: boolean;
  autoApproveHours?: number; // Convert to autoApproveAt
  requiredApprovals?: number;
  reviewerUserIds?: string[]; // Auto-assign reviewers
}

export interface AssignReviewerInput {
  reviewerUserId: string;
}

export interface SubmitDecisionInput {
  decision: ReviewDecision;
  overallFeedback?: string;
  rating?: number;
}

export interface AddCommentInput {
  commentType?: CommentType;
  selectionStart?: number;
  selectionEnd?: number;
  selectionText?: string;
  comment: string;
  suggestion?: string;
  severity?: CommentSeverity;
}

export interface ResolveCommentInput {
  resolutionNote?: string;
}

// ============================================
// ANALYTICS TYPES
// ============================================

export interface ReviewAnalytics {
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  changesRequestedCount: number;
  rejectedRequests: number;
  expiredRequests: number;
  avgTurnaroundTimeMinutes: number;
  avgRating: number;
}

export interface TurnaroundMetrics {
  avgTimeToFirstReview: number; // minutes
  avgTimeToDecision: number; // minutes
  p50TurnaroundTime: number;
  p90TurnaroundTime: number;
  reviewsByUrgency: Record<ReviewUrgency, number>;
}

export interface FeedbackTheme {
  theme: string;
  count: number;
  examples: string[];
  severity: CommentSeverity;
}

export interface ReviewerWorkload {
  reviewerUserId: string;
  reviewerName: string;
  pendingCount: number;
  completedThisWeek: number;
  avgRatingGiven: number;
  avgTurnaroundMinutes: number;
}

// ============================================
// PAGINATED RESPONSE
// ============================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================
// REVIEWER SUGGESTION
// ============================================

export interface SuggestedReviewer {
  user: User;
  score: number;
  reasons: string[];
}

// ============================================
// REVIEW QUEUE ITEM (for reviewer's queue view)
// ============================================

export interface ReviewQueueItem {
  assignment: ReviewAssignment;
  request: ReviewRequest;
  unresolvedCommentCount: number;
  isOverdue: boolean;
  timeRemaining?: string;
}
