/**
 * PRD-253: Peer Review Workflow Types
 *
 * TypeScript interfaces for the peer review system.
 */
export type ReviewContentType = 'email_draft' | 'proposal' | 'document' | 'action' | 'escalation_response';
export type ReviewType = 'quality' | 'accuracy' | 'compliance' | 'coaching';
export type ReviewUrgency = 'low' | 'normal' | 'high' | 'urgent';
export type ReviewRequestStatus = 'pending' | 'in_review' | 'approved' | 'changes_requested' | 'rejected' | 'expired' | 'cancelled';
export type AssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'declined';
export type ReviewDecision = 'approved' | 'changes_requested' | 'rejected';
export type CommentType = 'inline' | 'general';
export type CommentSeverity = 'critical' | 'important' | 'suggestion';
export type AuditAction = 'requested' | 'assigned' | 'started' | 'commented' | 'resolved_comment' | 'approved' | 'changes_requested' | 'rejected' | 'declined' | 'sent' | 'expired' | 'cancelled';
export interface ReviewRequest {
    id: string;
    requestedByUserId: string;
    customerId?: string;
    contentType: ReviewContentType;
    contentId?: string;
    contentSnapshot: string;
    contentMetadata: Record<string, any>;
    reviewType: ReviewType;
    focusAreas?: string;
    urgency: ReviewUrgency;
    dueAt?: Date;
    status: ReviewRequestStatus;
    requiresApproval: boolean;
    autoApproveAt?: Date;
    requiredApprovals: number;
    approvalCount: number;
    createdAt: Date;
    updatedAt: Date;
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
    rating?: number;
    startedAt?: Date;
    completedAt?: Date;
    createdAt: Date;
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
    user?: User;
}
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
export interface CreateReviewRequestInput {
    customerId?: string;
    contentType: ReviewContentType;
    contentId?: string;
    contentSnapshot: string;
    contentMetadata?: Record<string, any>;
    reviewType?: ReviewType;
    focusAreas?: string;
    urgency?: ReviewUrgency;
    dueAt?: string;
    requiresApproval?: boolean;
    autoApproveHours?: number;
    requiredApprovals?: number;
    reviewerUserIds?: string[];
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
    avgTimeToFirstReview: number;
    avgTimeToDecision: number;
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
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}
export interface SuggestedReviewer {
    user: User;
    score: number;
    reasons: string[];
}
export interface ReviewQueueItem {
    assignment: ReviewAssignment;
    request: ReviewRequest;
    unresolvedCommentCount: number;
    isOverdue: boolean;
    timeRemaining?: string;
}
//# sourceMappingURL=peerReview.d.ts.map