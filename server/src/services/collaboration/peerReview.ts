/**
 * PRD-253: Peer Review Workflow Service
 *
 * Manages peer review requests for communications and actions.
 * Features:
 * - Review request creation and management
 * - Reviewer assignment with intelligent suggestions
 * - Inline and general commenting
 * - Decision tracking (approve/request changes/reject)
 * - Audit logging for compliance
 * - Analytics and metrics
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// ============================================
// TYPE DEFINITIONS (PRD-253)
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

export class PeerReviewService {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // REVIEW REQUESTS
  // ============================================

  /**
   * Create a new review request
   */
  async createReviewRequest(
    userId: string,
    input: CreateReviewRequestInput
  ): Promise<ReviewRequest> {
    if (!this.supabase) {
      throw new Error('Database not configured');
    }

    // Calculate auto-approve time if specified
    let autoApproveAt: Date | null = null;
    if (input.autoApproveHours) {
      autoApproveAt = new Date();
      autoApproveAt.setHours(autoApproveAt.getHours() + input.autoApproveHours);
    }

    // Parse due date
    let dueAt: Date | null = null;
    if (input.dueAt) {
      dueAt = new Date(input.dueAt);
    }

    const { data, error } = await (this.supabase as any)
      .from('review_requests')
      .insert({
        requested_by_user_id: userId,
        customer_id: input.customerId || null,
        content_type: input.contentType,
        content_id: input.contentId || null,
        content_snapshot: input.contentSnapshot,
        content_metadata: input.contentMetadata || {},
        review_type: input.reviewType || 'quality',
        focus_areas: input.focusAreas || null,
        urgency: input.urgency || 'normal',
        due_at: dueAt?.toISOString() || null,
        requires_approval: input.requiresApproval || false,
        auto_approve_at: autoApproveAt?.toISOString() || null,
        required_approvals: input.requiredApprovals || 1,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create review request: ${error.message}`);
    }

    // Log audit event
    await this.logAuditEvent(data.id, null, userId, 'requested', {
      contentType: input.contentType,
      reviewType: input.reviewType || 'quality',
      urgency: input.urgency || 'normal',
    });

    // Auto-assign reviewers if provided
    if (input.reviewerUserIds && input.reviewerUserIds.length > 0) {
      for (const reviewerUserId of input.reviewerUserIds) {
        await this.assignReviewer(data.id, userId, { reviewerUserId });
      }
    }

    return this.mapToReviewRequest(data);
  }

  /**
   * Get a review request by ID
   */
  async getReviewRequest(requestId: string): Promise<ReviewRequest | null> {
    if (!this.supabase) return null;

    const { data, error } = await (this.supabase as any)
      .from('review_requests')
      .select(`
        *,
        assignments:review_assignments(
          *,
          comments:review_comments(*)
        )
      `)
      .eq('id', requestId)
      .single();

    if (error || !data) return null;

    return this.mapToReviewRequest(data);
  }

  /**
   * Get review requests created by a user
   */
  async getMyRequests(
    userId: string,
    options: {
      status?: ReviewRequestStatus;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<PaginatedResponse<ReviewRequest>> {
    if (!this.supabase) {
      return { items: [], total: 0, page: 1, pageSize: 20, hasMore: false };
    }

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    let query = (this.supabase as any)
      .from('review_requests')
      .select('*, assignments:review_assignments(*)', { count: 'exact' })
      .eq('requested_by_user_id', userId);

    if (options.status) {
      query = query.eq('status', options.status);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Failed to fetch requests: ${error.message}`);
    }

    const items = (data || []).map((d: any) => this.mapToReviewRequest(d));
    const total = count || 0;

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: offset + items.length < total,
    };
  }

  /**
   * Update review request status
   */
  async updateRequestStatus(
    requestId: string,
    status: ReviewRequestStatus
  ): Promise<void> {
    if (!this.supabase) return;

    await (this.supabase as any)
      .from('review_requests')
      .update({ status })
      .eq('id', requestId);
  }

  /**
   * Cancel a review request
   */
  async cancelRequest(requestId: string, userId: string): Promise<void> {
    if (!this.supabase) return;

    await (this.supabase as any)
      .from('review_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId)
      .eq('requested_by_user_id', userId);

    await this.logAuditEvent(requestId, null, userId, 'cancelled', {});
  }

  // ============================================
  // REVIEWER ASSIGNMENTS
  // ============================================

  /**
   * Assign a reviewer to a request
   */
  async assignReviewer(
    requestId: string,
    userId: string,
    input: AssignReviewerInput
  ): Promise<ReviewAssignment> {
    if (!this.supabase) {
      throw new Error('Database not configured');
    }

    // Check if already assigned
    const { data: existing } = await (this.supabase as any)
      .from('review_assignments')
      .select('id')
      .eq('request_id', requestId)
      .eq('reviewer_user_id', input.reviewerUserId)
      .single();

    if (existing) {
      throw new Error('Reviewer is already assigned to this request');
    }

    const { data, error } = await (this.supabase as any)
      .from('review_assignments')
      .insert({
        request_id: requestId,
        reviewer_user_id: input.reviewerUserId,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to assign reviewer: ${error.message}`);
    }

    // Update request status to in_review if this is the first assignment
    const { data: request } = await (this.supabase as any)
      .from('review_requests')
      .select('status')
      .eq('id', requestId)
      .single();

    if (request?.status === 'pending') {
      await this.updateRequestStatus(requestId, 'in_review');
    }

    // Log audit event
    await this.logAuditEvent(requestId, data.id, userId, 'assigned', {
      reviewerUserId: input.reviewerUserId,
    });

    return this.mapToAssignment(data);
  }

  /**
   * Get assignments for a reviewer (their review queue)
   */
  async getReviewQueue(
    reviewerUserId: string,
    options: {
      status?: AssignmentStatus;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<PaginatedResponse<ReviewQueueItem>> {
    if (!this.supabase) {
      return { items: [], total: 0, page: 1, pageSize: 20, hasMore: false };
    }

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;

    let query = (this.supabase as any)
      .from('review_assignments')
      .select(`
        *,
        request:review_requests(*),
        comments:review_comments(*)
      `, { count: 'exact' })
      .eq('reviewer_user_id', reviewerUserId);

    if (options.status) {
      query = query.eq('status', options.status);
    } else {
      // Default: show pending and in_progress
      query = query.in('status', ['pending', 'in_progress']);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Failed to fetch review queue: ${error.message}`);
    }

    const items: ReviewQueueItem[] = (data || []).map((d: any) => {
      const assignment = this.mapToAssignment(d);
      const request = this.mapToReviewRequest(d.request);
      const unresolvedCommentCount = (d.comments || []).filter(
        (c: any) => !c.is_resolved
      ).length;

      const isOverdue = request.dueAt ? new Date() > request.dueAt : false;
      let timeRemaining: string | undefined;
      if (request.dueAt && !isOverdue) {
        const diff = request.dueAt.getTime() - Date.now();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        timeRemaining = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      }

      return {
        assignment,
        request,
        unresolvedCommentCount,
        isOverdue,
        timeRemaining,
      };
    });

    const total = count || 0;

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: offset + items.length < total,
    };
  }

  /**
   * Start reviewing (mark as in_progress)
   */
  async startReview(
    assignmentId: string,
    reviewerUserId: string
  ): Promise<ReviewAssignment> {
    if (!this.supabase) {
      throw new Error('Database not configured');
    }

    const { data, error } = await (this.supabase as any)
      .from('review_assignments')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .eq('id', assignmentId)
      .eq('reviewer_user_id', reviewerUserId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to start review: ${error.message}`);
    }

    await this.logAuditEvent(data.request_id, assignmentId, reviewerUserId, 'started', {});

    return this.mapToAssignment(data);
  }

  /**
   * Decline a review assignment
   */
  async declineAssignment(
    assignmentId: string,
    reviewerUserId: string,
    reason?: string
  ): Promise<void> {
    if (!this.supabase) return;

    const { data } = await (this.supabase as any)
      .from('review_assignments')
      .update({ status: 'declined' })
      .eq('id', assignmentId)
      .eq('reviewer_user_id', reviewerUserId)
      .select('request_id')
      .single();

    if (data) {
      await this.logAuditEvent(
        data.request_id,
        assignmentId,
        reviewerUserId,
        'declined',
        { reason }
      );
    }
  }

  /**
   * Submit review decision
   */
  async submitDecision(
    assignmentId: string,
    reviewerUserId: string,
    input: SubmitDecisionInput
  ): Promise<ReviewAssignment> {
    if (!this.supabase) {
      throw new Error('Database not configured');
    }

    const { data, error } = await (this.supabase as any)
      .from('review_assignments')
      .update({
        status: 'completed',
        decision: input.decision,
        overall_feedback: input.overallFeedback || null,
        rating: input.rating || null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', assignmentId)
      .eq('reviewer_user_id', reviewerUserId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to submit decision: ${error.message}`);
    }

    // Log the decision
    await this.logAuditEvent(
      data.request_id,
      assignmentId,
      reviewerUserId,
      input.decision as AuditAction,
      {
        feedback: input.overallFeedback,
        rating: input.rating,
      }
    );

    // Update request based on decision
    await this.updateRequestAfterDecision(data.request_id, input.decision);

    return this.mapToAssignment(data);
  }

  /**
   * Update request status after a reviewer decision
   */
  private async updateRequestAfterDecision(
    requestId: string,
    decision: ReviewDecision
  ): Promise<void> {
    if (!this.supabase) return;

    // Get request and all assignments
    const { data: request } = await (this.supabase as any)
      .from('review_requests')
      .select(`
        *,
        assignments:review_assignments(*)
      `)
      .eq('id', requestId)
      .single();

    if (!request) return;

    const completedAssignments = request.assignments.filter(
      (a: any) => a.status === 'completed'
    );
    const approvals = completedAssignments.filter(
      (a: any) => a.decision === 'approved'
    );
    const rejections = completedAssignments.filter(
      (a: any) => a.decision === 'rejected'
    );
    const changesRequested = completedAssignments.filter(
      (a: any) => a.decision === 'changes_requested'
    );

    // Update approval count
    await (this.supabase as any)
      .from('review_requests')
      .update({ approval_count: approvals.length })
      .eq('id', requestId);

    // Determine new status
    let newStatus: ReviewRequestStatus = request.status;

    if (rejections.length > 0) {
      newStatus = 'rejected';
    } else if (changesRequested.length > 0) {
      newStatus = 'changes_requested';
    } else if (approvals.length >= request.required_approvals) {
      newStatus = 'approved';
    }

    if (newStatus !== request.status) {
      await this.updateRequestStatus(requestId, newStatus);
    }
  }

  // ============================================
  // COMMENTS
  // ============================================

  /**
   * Add a comment to an assignment
   */
  async addComment(
    assignmentId: string,
    reviewerUserId: string,
    input: AddCommentInput
  ): Promise<ReviewComment> {
    if (!this.supabase) {
      throw new Error('Database not configured');
    }

    const { data, error } = await (this.supabase as any)
      .from('review_comments')
      .insert({
        assignment_id: assignmentId,
        reviewer_user_id: reviewerUserId,
        comment_type: input.commentType || 'general',
        selection_start: input.selectionStart || null,
        selection_end: input.selectionEnd || null,
        selection_text: input.selectionText || null,
        comment: input.comment,
        suggestion: input.suggestion || null,
        severity: input.severity || 'suggestion',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add comment: ${error.message}`);
    }

    // Get request ID for audit
    const { data: assignment } = await (this.supabase as any)
      .from('review_assignments')
      .select('request_id')
      .eq('id', assignmentId)
      .single();

    if (assignment) {
      await this.logAuditEvent(
        assignment.request_id,
        assignmentId,
        reviewerUserId,
        'commented',
        {
          commentId: data.id,
          severity: input.severity || 'suggestion',
          commentType: input.commentType || 'general',
        }
      );
    }

    return this.mapToComment(data);
  }

  /**
   * Get comments for an assignment
   */
  async getComments(assignmentId: string): Promise<ReviewComment[]> {
    if (!this.supabase) return [];

    const { data, error } = await (this.supabase as any)
      .from('review_comments')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch comments: ${error.message}`);
    }

    return (data || []).map((d: any) => this.mapToComment(d));
  }

  /**
   * Resolve a comment
   */
  async resolveComment(
    commentId: string,
    userId: string,
    input?: ResolveCommentInput
  ): Promise<ReviewComment> {
    if (!this.supabase) {
      throw new Error('Database not configured');
    }

    const { data, error } = await (this.supabase as any)
      .from('review_comments')
      .update({
        is_resolved: true,
        resolved_by_user_id: userId,
        resolved_at: new Date().toISOString(),
        resolution_note: input?.resolutionNote || null,
      })
      .eq('id', commentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to resolve comment: ${error.message}`);
    }

    // Get assignment and request for audit
    const { data: comment } = await (this.supabase as any)
      .from('review_comments')
      .select('assignment_id, review_assignments!inner(request_id)')
      .eq('id', commentId)
      .single();

    if (comment) {
      await this.logAuditEvent(
        comment.review_assignments.request_id,
        comment.assignment_id,
        userId,
        'resolved_comment',
        { commentId, resolutionNote: input?.resolutionNote }
      );
    }

    return this.mapToComment(data);
  }

  // ============================================
  // REVIEWER SUGGESTIONS
  // ============================================

  /**
   * Suggest reviewers based on various factors
   */
  async suggestReviewers(
    userId: string,
    requestInput: Partial<CreateReviewRequestInput>
  ): Promise<SuggestedReviewer[]> {
    if (!this.supabase) return [];

    // Get team members (excluding the requester)
    const { data: teamMembers } = await (this.supabase as any)
      .from('users')
      .select('id, name, email, team_id')
      .neq('id', userId)
      .limit(50);

    if (!teamMembers || teamMembers.length === 0) return [];

    const candidates: SuggestedReviewer[] = [];

    for (const member of teamMembers) {
      let score = 50; // Base score
      const reasons: string[] = [];

      // Factor 1: Previous review experience (more is better)
      const { count: reviewCount } = await (this.supabase as any)
        .from('review_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('reviewer_user_id', member.id)
        .eq('status', 'completed');

      if (reviewCount && reviewCount > 0) {
        score += Math.min(reviewCount * 2, 20);
        reasons.push(`${reviewCount} completed reviews`);
      }

      // Factor 2: Workload (fewer pending is better)
      const { count: pendingCount } = await (this.supabase as any)
        .from('review_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('reviewer_user_id', member.id)
        .in('status', ['pending', 'in_progress']);

      if (pendingCount !== null) {
        score -= pendingCount * 5;
        if (pendingCount === 0) {
          reasons.push('No pending reviews');
        } else if (pendingCount <= 2) {
          reasons.push(`Light workload (${pendingCount} pending)`);
        }
      }

      // Factor 3: Prior review relationship
      const { data: priorReviews } = await (this.supabase as any)
        .from('review_assignments')
        .select('id')
        .eq('reviewer_user_id', member.id)
        .in(
          'request_id',
          (this.supabase as any)
            .from('review_requests')
            .select('id')
            .eq('requested_by_user_id', userId)
        )
        .limit(1);

      if (priorReviews && priorReviews.length > 0) {
        score += 10;
        reasons.push('Has reviewed your content before');
      }

      // Factor 4: Customer experience (if customer specified)
      if (requestInput.customerId) {
        // Check if reviewer has experience with this customer
        const { data: customerExp } = await (this.supabase as any)
          .from('review_requests')
          .select('id')
          .eq('customer_id', requestInput.customerId)
          .in(
            'id',
            (this.supabase as any)
              .from('review_assignments')
              .select('request_id')
              .eq('reviewer_user_id', member.id)
          )
          .limit(1);

        if (customerExp && customerExp.length > 0) {
          score += 15;
          reasons.push('Experience with this customer');
        }
      }

      if (reasons.length === 0) {
        reasons.push('Available team member');
      }

      candidates.push({
        user: {
          id: member.id,
          name: member.name,
          email: member.email,
        },
        score,
        reasons,
      });
    }

    // Sort by score descending and return top 5
    return candidates.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * Get review analytics for a user
   */
  async getAnalytics(userId: string): Promise<ReviewAnalytics> {
    if (!this.supabase) {
      return {
        totalRequests: 0,
        pendingRequests: 0,
        approvedRequests: 0,
        changesRequestedCount: 0,
        rejectedRequests: 0,
        expiredRequests: 0,
        avgTurnaroundTimeMinutes: 0,
        avgRating: 0,
      };
    }

    // Get counts by status
    const statuses = ['pending', 'approved', 'changes_requested', 'rejected', 'expired'];
    const counts: Record<string, number> = {};

    for (const status of statuses) {
      const { count } = await (this.supabase as any)
        .from('review_requests')
        .select('*', { count: 'exact', head: true })
        .eq('requested_by_user_id', userId)
        .eq('status', status);

      counts[status] = count || 0;
    }

    // Calculate average turnaround time
    const { data: completedAssignments } = await (this.supabase as any)
      .from('review_assignments')
      .select('created_at, completed_at')
      .eq('status', 'completed')
      .not('completed_at', 'is', null);

    let avgTurnaroundTimeMinutes = 0;
    if (completedAssignments && completedAssignments.length > 0) {
      const totalMinutes = completedAssignments.reduce((sum: number, a: any) => {
        const created = new Date(a.created_at);
        const completed = new Date(a.completed_at);
        return sum + (completed.getTime() - created.getTime()) / 60000;
      }, 0);
      avgTurnaroundTimeMinutes = Math.round(totalMinutes / completedAssignments.length);
    }

    // Calculate average rating
    const { data: ratings } = await (this.supabase as any)
      .from('review_assignments')
      .select('rating')
      .in(
        'request_id',
        (this.supabase as any)
          .from('review_requests')
          .select('id')
          .eq('requested_by_user_id', userId)
      )
      .not('rating', 'is', null);

    let avgRating = 0;
    if (ratings && ratings.length > 0) {
      avgRating =
        ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length;
    }

    return {
      totalRequests: Object.values(counts).reduce((a, b) => a + b, 0),
      pendingRequests: counts.pending,
      approvedRequests: counts.approved,
      changesRequestedCount: counts.changes_requested,
      rejectedRequests: counts.rejected,
      expiredRequests: counts.expired,
      avgTurnaroundTimeMinutes,
      avgRating: Math.round(avgRating * 10) / 10,
    };
  }

  /**
   * Get turnaround time metrics
   */
  async getTurnaroundMetrics(userId: string): Promise<TurnaroundMetrics> {
    if (!this.supabase) {
      return {
        avgTimeToFirstReview: 0,
        avgTimeToDecision: 0,
        p50TurnaroundTime: 0,
        p90TurnaroundTime: 0,
        reviewsByUrgency: { low: 0, normal: 0, high: 0, urgent: 0 },
      };
    }

    // Get all completed reviews for this user's requests
    const { data: assignments } = await (this.supabase as any)
      .from('review_assignments')
      .select(`
        created_at,
        started_at,
        completed_at,
        request:review_requests!inner(urgency, requested_by_user_id)
      `)
      .eq('request.requested_by_user_id', userId)
      .eq('status', 'completed');

    if (!assignments || assignments.length === 0) {
      return {
        avgTimeToFirstReview: 0,
        avgTimeToDecision: 0,
        p50TurnaroundTime: 0,
        p90TurnaroundTime: 0,
        reviewsByUrgency: { low: 0, normal: 0, high: 0, urgent: 0 },
      };
    }

    // Calculate times
    const turnaroundTimes: number[] = [];
    const reviewsByUrgency: Record<string, number> = { low: 0, normal: 0, high: 0, urgent: 0 };
    let totalTimeToFirstReview = 0;
    let firstReviewCount = 0;

    for (const a of assignments) {
      const urgency = a.request.urgency || 'normal';
      reviewsByUrgency[urgency] = (reviewsByUrgency[urgency] || 0) + 1;

      if (a.completed_at) {
        const turnaround =
          (new Date(a.completed_at).getTime() - new Date(a.created_at).getTime()) / 60000;
        turnaroundTimes.push(turnaround);
      }

      if (a.started_at) {
        const timeToStart =
          (new Date(a.started_at).getTime() - new Date(a.created_at).getTime()) / 60000;
        totalTimeToFirstReview += timeToStart;
        firstReviewCount++;
      }
    }

    // Sort for percentiles
    turnaroundTimes.sort((a, b) => a - b);

    const p50Index = Math.floor(turnaroundTimes.length * 0.5);
    const p90Index = Math.floor(turnaroundTimes.length * 0.9);

    return {
      avgTimeToFirstReview: firstReviewCount > 0 ? Math.round(totalTimeToFirstReview / firstReviewCount) : 0,
      avgTimeToDecision: turnaroundTimes.length > 0
        ? Math.round(turnaroundTimes.reduce((a, b) => a + b, 0) / turnaroundTimes.length)
        : 0,
      p50TurnaroundTime: turnaroundTimes[p50Index] || 0,
      p90TurnaroundTime: turnaroundTimes[p90Index] || 0,
      reviewsByUrgency: reviewsByUrgency as TurnaroundMetrics['reviewsByUrgency'],
    };
  }

  /**
   * Get common feedback themes
   */
  async getFeedbackThemes(userId: string): Promise<FeedbackTheme[]> {
    if (!this.supabase) return [];

    // Get all comments for user's requests
    const { data: comments } = await (this.supabase as any)
      .from('review_comments')
      .select(`
        comment,
        severity,
        assignment:review_assignments!inner(
          request:review_requests!inner(requested_by_user_id)
        )
      `)
      .eq('assignment.request.requested_by_user_id', userId);

    if (!comments || comments.length === 0) return [];

    // Simple keyword-based theme extraction
    const themes: Map<string, { count: number; examples: string[]; severity: string }> =
      new Map();

    const keywordThemes: Record<string, string[]> = {
      'Clarity': ['unclear', 'confusing', 'clarify', 'vague', 'ambiguous'],
      'Tone': ['tone', 'professional', 'casual', 'formal', 'friendly'],
      'Accuracy': ['incorrect', 'wrong', 'accurate', 'fact', 'verify'],
      'Completeness': ['missing', 'incomplete', 'add', 'include', 'forgot'],
      'Grammar': ['typo', 'spelling', 'grammar', 'punctuation'],
      'Structure': ['structure', 'organize', 'flow', 'order', 'format'],
    };

    for (const c of comments) {
      const commentLower = c.comment.toLowerCase();
      for (const [theme, keywords] of Object.entries(keywordThemes)) {
        if (keywords.some((kw) => commentLower.includes(kw))) {
          const existing = themes.get(theme) || { count: 0, examples: [], severity: c.severity };
          existing.count++;
          if (existing.examples.length < 3) {
            existing.examples.push(c.comment.slice(0, 100));
          }
          themes.set(theme, existing);
        }
      }
    }

    return Array.from(themes.entries())
      .map(([theme, data]) => ({
        theme,
        count: data.count,
        examples: data.examples,
        severity: data.severity as FeedbackTheme['severity'],
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get reviewer workload distribution
   */
  async getReviewerWorkload(): Promise<ReviewerWorkload[]> {
    if (!this.supabase) return [];

    // Get all reviewers with their stats
    const { data: reviewers } = await (this.supabase as any)
      .from('users')
      .select('id, name')
      .limit(100);

    if (!reviewers) return [];

    const workloads: ReviewerWorkload[] = [];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    for (const reviewer of reviewers) {
      // Pending count
      const { count: pendingCount } = await (this.supabase as any)
        .from('review_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('reviewer_user_id', reviewer.id)
        .in('status', ['pending', 'in_progress']);

      // Completed this week
      const { count: completedThisWeek } = await (this.supabase as any)
        .from('review_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('reviewer_user_id', reviewer.id)
        .eq('status', 'completed')
        .gte('completed_at', oneWeekAgo.toISOString());

      // Average rating given
      const { data: ratings } = await (this.supabase as any)
        .from('review_assignments')
        .select('rating')
        .eq('reviewer_user_id', reviewer.id)
        .not('rating', 'is', null);

      let avgRating = 0;
      if (ratings && ratings.length > 0) {
        avgRating = ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length;
      }

      // Average turnaround
      const { data: turnarounds } = await (this.supabase as any)
        .from('review_assignments')
        .select('created_at, completed_at')
        .eq('reviewer_user_id', reviewer.id)
        .eq('status', 'completed')
        .not('completed_at', 'is', null);

      let avgTurnaround = 0;
      if (turnarounds && turnarounds.length > 0) {
        const total = turnarounds.reduce((sum: number, t: any) => {
          return sum + (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / 60000;
        }, 0);
        avgTurnaround = Math.round(total / turnarounds.length);
      }

      // Only include if they have any activity
      if ((pendingCount || 0) > 0 || (completedThisWeek || 0) > 0) {
        workloads.push({
          reviewerUserId: reviewer.id,
          reviewerName: reviewer.name,
          pendingCount: pendingCount || 0,
          completedThisWeek: completedThisWeek || 0,
          avgRatingGiven: Math.round(avgRating * 10) / 10,
          avgTurnaroundMinutes: avgTurnaround,
        });
      }
    }

    return workloads.sort((a, b) => b.completedThisWeek - a.completedThisWeek);
  }

  // ============================================
  // AUDIT LOG
  // ============================================

  /**
   * Log an audit event
   */
  private async logAuditEvent(
    requestId: string | null,
    assignmentId: string | null,
    userId: string,
    action: AuditAction,
    details: Record<string, any>
  ): Promise<void> {
    if (!this.supabase) return;

    await (this.supabase as any).from('review_audit_log').insert({
      request_id: requestId,
      assignment_id: assignmentId,
      user_id: userId,
      action,
      details,
    });
  }

  /**
   * Get audit log for a request
   */
  async getAuditLog(requestId: string): Promise<ReviewAuditLogEntry[]> {
    if (!this.supabase) return [];

    const { data, error } = await (this.supabase as any)
      .from('review_audit_log')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch audit log: ${error.message}`);
    }

    return (data || []).map((d: any) => ({
      id: d.id,
      requestId: d.request_id,
      assignmentId: d.assignment_id,
      userId: d.user_id,
      action: d.action,
      details: d.details || {},
      createdAt: new Date(d.created_at),
    }));
  }

  // ============================================
  // AUTO-APPROVAL HANDLING
  // ============================================

  /**
   * Process auto-approvals (run periodically)
   */
  async processAutoApprovals(): Promise<number> {
    if (!this.supabase) return 0;

    const now = new Date().toISOString();

    // Find requests that should be auto-approved
    const { data: toAutoApprove } = await (this.supabase as any)
      .from('review_requests')
      .select('id')
      .eq('status', 'pending')
      .not('auto_approve_at', 'is', null)
      .lte('auto_approve_at', now);

    if (!toAutoApprove || toAutoApprove.length === 0) return 0;

    let count = 0;
    for (const request of toAutoApprove) {
      await (this.supabase as any)
        .from('review_requests')
        .update({ status: 'approved' })
        .eq('id', request.id);

      await this.logAuditEvent(request.id, null, 'system', 'approved', {
        reason: 'Auto-approved due to timeout',
      });

      count++;
    }

    return count;
  }

  /**
   * Process expired requests (run periodically)
   */
  async processExpiredRequests(): Promise<number> {
    if (!this.supabase) return 0;

    const now = new Date().toISOString();

    // Find requests past due date without any response
    const { data: toExpire } = await (this.supabase as any)
      .from('review_requests')
      .select('id')
      .eq('status', 'pending')
      .not('due_at', 'is', null)
      .lte('due_at', now);

    if (!toExpire || toExpire.length === 0) return 0;

    let count = 0;
    for (const request of toExpire) {
      await (this.supabase as any)
        .from('review_requests')
        .update({ status: 'expired' })
        .eq('id', request.id);

      await this.logAuditEvent(request.id, null, 'system', 'expired', {
        reason: 'Review deadline passed without response',
      });

      count++;
    }

    return count;
  }

  // ============================================
  // MAPPERS
  // ============================================

  private mapToReviewRequest(data: any): ReviewRequest {
    return {
      id: data.id,
      requestedByUserId: data.requested_by_user_id,
      customerId: data.customer_id,
      contentType: data.content_type,
      contentId: data.content_id,
      contentSnapshot: data.content_snapshot,
      contentMetadata: data.content_metadata || {},
      reviewType: data.review_type,
      focusAreas: data.focus_areas,
      urgency: data.urgency,
      dueAt: data.due_at ? new Date(data.due_at) : undefined,
      status: data.status,
      requiresApproval: data.requires_approval,
      autoApproveAt: data.auto_approve_at ? new Date(data.auto_approve_at) : undefined,
      requiredApprovals: data.required_approvals,
      approvalCount: data.approval_count,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      assignments: data.assignments?.map((a: any) => this.mapToAssignment(a)),
    };
  }

  private mapToAssignment(data: any): ReviewAssignment {
    return {
      id: data.id,
      requestId: data.request_id,
      reviewerUserId: data.reviewer_user_id,
      status: data.status,
      decision: data.decision,
      overallFeedback: data.overall_feedback,
      rating: data.rating,
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      createdAt: new Date(data.created_at),
      comments: data.comments?.map((c: any) => this.mapToComment(c)),
    };
  }

  private mapToComment(data: any): ReviewComment {
    return {
      id: data.id,
      assignmentId: data.assignment_id,
      reviewerUserId: data.reviewer_user_id,
      commentType: data.comment_type,
      selectionStart: data.selection_start,
      selectionEnd: data.selection_end,
      selectionText: data.selection_text,
      comment: data.comment,
      suggestion: data.suggestion,
      severity: data.severity,
      isResolved: data.is_resolved,
      resolvedByUserId: data.resolved_by_user_id,
      resolvedAt: data.resolved_at ? new Date(data.resolved_at) : undefined,
      resolutionNote: data.resolution_note,
      createdAt: new Date(data.created_at),
    };
  }
}

// Singleton instance
export const peerReviewService = new PeerReviewService();
