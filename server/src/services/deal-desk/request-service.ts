/**
 * Deal Desk Request Service
 * PRD-244: Deal Desk Integration
 *
 * Core service for managing Deal Desk requests including creation,
 * assignment, status updates, and multi-level approvals.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { approvalRulesEngine, ApprovalRulesEngine } from './approval-rules.js';
import {
  DealDeskRequestRow,
  DealDeskApprovalRow,
  DealDeskCommentRow,
  CreateRequestDTO,
  QueueFilters,
  ApprovalDecision,
  RequestChangesDTO,
  DealDeskRequestType,
  DealDeskRequestStatus,
  DealDeskUrgency,
  ApproverRole,
} from './types.js';

// ============================================
// SLA Configuration
// ============================================

const BASE_SLA_HOURS: Record<DealDeskRequestType, number> = {
  discount: 24,
  payment_terms: 48,
  contract_amendment: 72,
  custom_pricing: 72,
  bundle: 48,
};

const URGENCY_MULTIPLIERS: Record<DealDeskUrgency, number> = {
  low: 1.5,
  normal: 1.0,
  high: 0.5,
  critical: 0.25,
};

// ============================================
// Request Service
// ============================================

export class DealDeskRequestService {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Create a new Deal Desk request
   */
  async createRequest(dto: CreateRequestDTO): Promise<DealDeskRequestRow | null> {
    if (!this.supabase) {
      console.warn('[DealDesk] Supabase not configured, returning mock data');
      return this.createMockRequest(dto);
    }

    try {
      // Get customer data for auto-population
      const customer = await this.getCustomer(dto.customerId);
      const currentArr = dto.currentArr || customer?.arr || 0;

      // Calculate SLA due date
      const baseSla = BASE_SLA_HOURS[dto.requestType];
      const urgencyMultiplier = URGENCY_MULTIPLIERS[dto.urgency];
      const slaHours = Math.max(4, baseSla * urgencyMultiplier); // Minimum 4 hours
      const slaDueAt = new Date(Date.now() + slaHours * 60 * 60 * 1000);

      // Get required approval levels
      const approvalLevels = approvalRulesEngine.getRequiredApprovals({
        requestType: dto.requestType,
        discountRequestedPct: dto.discountRequestedPct || null,
        currentArr,
        contractTermMonths: dto.contractTermMonths || null,
      });

      // Create the request
      const { data: request, error } = await this.supabase
        .from('deal_desk_requests')
        .insert({
          customer_id: dto.customerId,
          submitted_by_user_id: dto.submittedByUserId,
          request_type: dto.requestType,
          urgency: dto.urgency,
          status: 'pending',
          current_arr: currentArr,
          proposed_arr: dto.proposedArr,
          discount_requested_pct: dto.discountRequestedPct,
          contract_term_months: dto.contractTermMonths,
          title: dto.title,
          justification: dto.justification,
          competitive_situation: dto.competitiveSituation,
          customer_commitment: dto.customerCommitment,
          attachments: dto.attachments || [],
          renewal_pipeline_id: dto.renewalPipelineId,
          expansion_opportunity_id: dto.expansionOpportunityId,
          salesforce_opportunity_id: dto.salesforceOpportunityId,
          sla_due_at: slaDueAt.toISOString(),
          sla_breached: false,
        })
        .select()
        .single();

      if (error) {
        console.error('[DealDesk] Error creating request:', error);
        throw new Error(`Failed to create request: ${error.message}`);
      }

      // Create approval records for each required level
      for (const level of approvalLevels) {
        await this.supabase.from('deal_desk_approvals').insert({
          request_id: request.id,
          approval_level: level.level,
          approver_role: level.role,
          status: 'pending',
        });
      }

      console.log(`[DealDesk] Created request ${request.id} with ${approvalLevels.length} approval levels`);
      return request as DealDeskRequestRow;
    } catch (error) {
      console.error('[DealDesk] Error in createRequest:', error);
      throw error;
    }
  }

  /**
   * Get a single request by ID with enriched data
   */
  async getRequest(
    requestId: string
  ): Promise<{
    request: DealDeskRequestRow;
    customerName: string;
    submitterName: string;
    assigneeName: string | null;
    approvals: DealDeskApprovalRow[];
    comments: DealDeskCommentRow[];
  } | null> {
    if (!this.supabase) {
      return null;
    }

    try {
      // Get request
      const { data: request, error } = await this.supabase
        .from('deal_desk_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (error || !request) {
        return null;
      }

      // Get customer name
      const customer = await this.getCustomer(request.customer_id);

      // Get submitter name
      const submitter = await this.getUser(request.submitted_by_user_id);

      // Get assignee name if assigned
      let assigneeName: string | null = null;
      if (request.assigned_to_user_id) {
        const assignee = await this.getUser(request.assigned_to_user_id);
        assigneeName = assignee?.name || assignee?.email || null;
      }

      // Get approvals
      const { data: approvals } = await this.supabase
        .from('deal_desk_approvals')
        .select('*')
        .eq('request_id', requestId)
        .order('approval_level', { ascending: true });

      // Get comments
      const { data: comments } = await this.supabase
        .from('deal_desk_comments')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });

      return {
        request: request as DealDeskRequestRow,
        customerName: customer?.name || 'Unknown Customer',
        submitterName: submitter?.name || submitter?.email || 'Unknown User',
        assigneeName,
        approvals: (approvals || []) as DealDeskApprovalRow[],
        comments: (comments || []) as DealDeskCommentRow[],
      };
    } catch (error) {
      console.error('[DealDesk] Error in getRequest:', error);
      return null;
    }
  }

  /**
   * Get queue of requests with filters
   */
  async getQueue(filters: QueueFilters): Promise<{
    requests: DealDeskRequestRow[];
    total: number;
    summary: {
      pending: number;
      inReview: number;
      slaBreached: number;
      totalArrAtStake: number;
    };
  }> {
    if (!this.supabase) {
      return {
        requests: [],
        total: 0,
        summary: { pending: 0, inReview: 0, slaBreached: 0, totalArrAtStake: 0 },
      };
    }

    try {
      // Check and update SLA breaches
      await this.updateSlaBreaches();

      let query = this.supabase
        .from('deal_desk_requests')
        .select('*', { count: 'exact' });

      // Apply filters
      if (filters.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }
      if (filters.requestType && filters.requestType.length > 0) {
        query = query.in('request_type', filters.requestType);
      }
      if (filters.urgency && filters.urgency.length > 0) {
        query = query.in('urgency', filters.urgency);
      }
      if (filters.submitterId) {
        query = query.eq('submitted_by_user_id', filters.submitterId);
      }
      if (filters.assigneeId) {
        query = query.eq('assigned_to_user_id', filters.assigneeId);
      }
      if (filters.showSlaBreached) {
        query = query.eq('sla_breached', true);
      }
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,justification.ilike.%${filters.search}%`);
      }

      // Apply sorting
      const sortColumn = this.getSortColumn(filters.sortBy);
      const ascending = filters.sortOrder === 'asc';
      query = query.order(sortColumn, { ascending });

      // Apply pagination
      const page = filters.page || 1;
      const pageSize = filters.pageSize || 20;
      const offset = (page - 1) * pageSize;
      query = query.range(offset, offset + pageSize - 1);

      const { data: requests, count, error } = await query;

      if (error) {
        console.error('[DealDesk] Error fetching queue:', error);
        throw error;
      }

      // Get summary stats
      const summary = await this.getQueueSummary();

      return {
        requests: (requests || []) as DealDeskRequestRow[],
        total: count || 0,
        summary,
      };
    } catch (error) {
      console.error('[DealDesk] Error in getQueue:', error);
      throw error;
    }
  }

  /**
   * Assign request to a Deal Desk analyst
   */
  async assignRequest(
    requestId: string,
    assigneeUserId: string
  ): Promise<DealDeskRequestRow | null> {
    if (!this.supabase) return null;

    try {
      const { data, error } = await this.supabase
        .from('deal_desk_requests')
        .update({
          assigned_to_user_id: assigneeUserId,
          assigned_at: new Date().toISOString(),
          status: 'in_review',
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) {
        console.error('[DealDesk] Error assigning request:', error);
        return null;
      }

      console.log(`[DealDesk] Assigned request ${requestId} to ${assigneeUserId}`);
      return data as DealDeskRequestRow;
    } catch (error) {
      console.error('[DealDesk] Error in assignRequest:', error);
      return null;
    }
  }

  /**
   * Claim a request (self-assign)
   */
  async claimRequest(
    requestId: string,
    userId: string
  ): Promise<DealDeskRequestRow | null> {
    return this.assignRequest(requestId, userId);
  }

  /**
   * Process approval decision (approve/reject at current level)
   */
  async processApproval(
    requestId: string,
    decision: ApprovalDecision
  ): Promise<{
    request: DealDeskRequestRow;
    fullyApproved: boolean;
    nextLevel: number | null;
  } | null> {
    if (!this.supabase) return null;

    try {
      // Get current approval state
      const { data: approvals } = await this.supabase
        .from('deal_desk_approvals')
        .select('*')
        .eq('request_id', requestId)
        .order('approval_level', { ascending: true });

      if (!approvals || approvals.length === 0) {
        throw new Error('No approval records found');
      }

      // Find the current pending approval level
      const pendingApproval = approvals.find((a) => a.status === 'pending');
      if (!pendingApproval) {
        throw new Error('No pending approvals found');
      }

      // Update the approval record
      await this.supabase
        .from('deal_desk_approvals')
        .update({
          approver_user_id: decision.approverUserId,
          status: decision.status,
          notes: decision.notes,
          decided_at: new Date().toISOString(),
        })
        .eq('id', pendingApproval.id);

      // Handle rejection
      if (decision.status === 'rejected') {
        await this.supabase
          .from('deal_desk_requests')
          .update({
            status: 'rejected',
            decision_by_user_id: decision.approverUserId,
            decision_at: new Date().toISOString(),
            decision_notes: decision.notes,
          })
          .eq('id', requestId);

        const { data: request } = await this.supabase
          .from('deal_desk_requests')
          .select('*')
          .eq('id', requestId)
          .single();

        return {
          request: request as DealDeskRequestRow,
          fullyApproved: false,
          nextLevel: null,
        };
      }

      // Check if there are more approval levels
      const nextPending = approvals.find(
        (a) => a.approval_level > pendingApproval.approval_level && a.status === 'pending'
      );

      if (nextPending) {
        // More approvals needed
        const { data: request } = await this.supabase
          .from('deal_desk_requests')
          .select('*')
          .eq('id', requestId)
          .single();

        return {
          request: request as DealDeskRequestRow,
          fullyApproved: false,
          nextLevel: nextPending.approval_level,
        };
      }

      // All approvals complete - mark as approved
      await this.supabase
        .from('deal_desk_requests')
        .update({
          status: 'approved',
          decision_by_user_id: decision.approverUserId,
          decision_at: new Date().toISOString(),
          decision_notes: decision.notes,
          discount_approved_pct: decision.discountApprovedPct,
          conditions: decision.conditions,
        })
        .eq('id', requestId);

      const { data: request } = await this.supabase
        .from('deal_desk_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      console.log(`[DealDesk] Request ${requestId} fully approved`);

      return {
        request: request as DealDeskRequestRow,
        fullyApproved: true,
        nextLevel: null,
      };
    } catch (error) {
      console.error('[DealDesk] Error in processApproval:', error);
      return null;
    }
  }

  /**
   * Request changes from the submitter
   */
  async requestChanges(
    requestId: string,
    dto: RequestChangesDTO
  ): Promise<DealDeskRequestRow | null> {
    if (!this.supabase) return null;

    try {
      // Update status
      const { data: request, error } = await this.supabase
        .from('deal_desk_requests')
        .update({
          status: 'changes_requested',
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) {
        console.error('[DealDesk] Error requesting changes:', error);
        return null;
      }

      // Add comment explaining what changes are needed
      await this.supabase.from('deal_desk_comments').insert({
        request_id: requestId,
        user_id: dto.requestedByUserId,
        comment: `Changes Requested: ${dto.message}`,
        is_internal: false,
      });

      return request as DealDeskRequestRow;
    } catch (error) {
      console.error('[DealDesk] Error in requestChanges:', error);
      return null;
    }
  }

  /**
   * Add a comment to a request
   */
  async addComment(
    requestId: string,
    userId: string,
    comment: string,
    isInternal: boolean = true
  ): Promise<DealDeskCommentRow | null> {
    if (!this.supabase) return null;

    try {
      const { data, error } = await this.supabase
        .from('deal_desk_comments')
        .insert({
          request_id: requestId,
          user_id: userId,
          comment,
          is_internal: isInternal,
        })
        .select()
        .single();

      if (error) {
        console.error('[DealDesk] Error adding comment:', error);
        return null;
      }

      return data as DealDeskCommentRow;
    } catch (error) {
      console.error('[DealDesk] Error in addComment:', error);
      return null;
    }
  }

  /**
   * Get comments for a request
   */
  async getComments(
    requestId: string,
    includeInternal: boolean = true
  ): Promise<DealDeskCommentRow[]> {
    if (!this.supabase) return [];

    try {
      let query = this.supabase
        .from('deal_desk_comments')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });

      if (!includeInternal) {
        query = query.eq('is_internal', false);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[DealDesk] Error fetching comments:', error);
        return [];
      }

      return (data || []) as DealDeskCommentRow[];
    } catch (error) {
      console.error('[DealDesk] Error in getComments:', error);
      return [];
    }
  }

  /**
   * Withdraw a request
   */
  async withdrawRequest(requestId: string): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const { error } = await this.supabase
        .from('deal_desk_requests')
        .update({ status: 'withdrawn' })
        .eq('id', requestId)
        .in('status', ['pending', 'changes_requested']);

      if (error) {
        console.error('[DealDesk] Error withdrawing request:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[DealDesk] Error in withdrawRequest:', error);
      return false;
    }
  }

  /**
   * Delegate approval authority (for out-of-office)
   */
  async delegateApproval(
    fromUserId: string,
    toUserId: string,
    requestId?: string
  ): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      // If specific request, update that approval
      if (requestId) {
        await this.supabase
          .from('deal_desk_approvals')
          .update({ approver_user_id: toUserId })
          .eq('request_id', requestId)
          .eq('approver_user_id', fromUserId)
          .eq('status', 'pending');
      } else {
        // Create delegation record for all pending approvals
        await this.supabase.from('deal_desk_delegations').insert({
          from_user_id: fromUserId,
          to_user_id: toUserId,
          active: true,
          created_at: new Date().toISOString(),
        });
      }

      return true;
    } catch (error) {
      console.error('[DealDesk] Error in delegateApproval:', error);
      return false;
    }
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private async getCustomer(customerId: string): Promise<any> {
    if (!this.supabase) return null;
    const { data } = await this.supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();
    return data;
  }

  private async getUser(userId: string): Promise<any> {
    if (!this.supabase) return null;
    const { data } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    return data;
  }

  private getSortColumn(sortBy?: string): string {
    const mapping: Record<string, string> = {
      submission_date: 'created_at',
      arr_at_stake: 'current_arr',
      sla_due: 'sla_due_at',
      urgency: 'urgency',
    };
    return mapping[sortBy || 'sla_due'] || 'sla_due_at';
  }

  private async updateSlaBreaches(): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('deal_desk_requests')
      .update({ sla_breached: true })
      .in('status', ['pending', 'in_review'])
      .lt('sla_due_at', new Date().toISOString())
      .eq('sla_breached', false);
  }

  private async getQueueSummary(): Promise<{
    pending: number;
    inReview: number;
    slaBreached: number;
    totalArrAtStake: number;
  }> {
    if (!this.supabase) {
      return { pending: 0, inReview: 0, slaBreached: 0, totalArrAtStake: 0 };
    }

    const [pendingResult, inReviewResult, slaBreachedResult, arrResult] = await Promise.all([
      this.supabase
        .from('deal_desk_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      this.supabase
        .from('deal_desk_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'in_review'),
      this.supabase
        .from('deal_desk_requests')
        .select('*', { count: 'exact', head: true })
        .eq('sla_breached', true)
        .in('status', ['pending', 'in_review']),
      this.supabase
        .from('deal_desk_requests')
        .select('current_arr')
        .in('status', ['pending', 'in_review']),
    ]);

    const totalArr = (arrResult.data || []).reduce((sum, r) => sum + (r.current_arr || 0), 0);

    return {
      pending: pendingResult.count || 0,
      inReview: inReviewResult.count || 0,
      slaBreached: slaBreachedResult.count || 0,
      totalArrAtStake: totalArr,
    };
  }

  private createMockRequest(dto: CreateRequestDTO): DealDeskRequestRow {
    const now = new Date().toISOString();
    const slaHours = BASE_SLA_HOURS[dto.requestType] * URGENCY_MULTIPLIERS[dto.urgency];
    const slaDueAt = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    return {
      id: `mock-${Date.now()}`,
      customer_id: dto.customerId,
      submitted_by_user_id: dto.submittedByUserId,
      request_type_id: dto.requestType,
      request_type: dto.requestType,
      urgency: dto.urgency,
      status: 'pending',
      current_arr: dto.currentArr || 50000,
      proposed_arr: dto.proposedArr || null,
      discount_requested_pct: dto.discountRequestedPct || null,
      discount_approved_pct: null,
      contract_term_months: dto.contractTermMonths || null,
      title: dto.title,
      justification: dto.justification,
      competitive_situation: dto.competitiveSituation || null,
      customer_commitment: dto.customerCommitment || null,
      attachments: dto.attachments || [],
      renewal_pipeline_id: dto.renewalPipelineId || null,
      expansion_opportunity_id: dto.expansionOpportunityId || null,
      salesforce_opportunity_id: dto.salesforceOpportunityId || null,
      assigned_to_user_id: null,
      assigned_at: null,
      decision_by_user_id: null,
      decision_at: null,
      decision_notes: null,
      conditions: null,
      sla_due_at: slaDueAt.toISOString(),
      sla_breached: false,
      created_at: now,
      updated_at: now,
    };
  }
}

// Singleton instance
export const dealDeskRequestService = new DealDeskRequestService();
