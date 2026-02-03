/**
 * Deal Desk Service Types (Server-side)
 * PRD-244: Deal Desk Integration
 */

// ============================================
// Core Types (Server-side duplicates for independence)
// ============================================

export type DealDeskRequestType =
  | 'discount'
  | 'payment_terms'
  | 'contract_amendment'
  | 'custom_pricing'
  | 'bundle';

export type DealDeskUrgency = 'low' | 'normal' | 'high' | 'critical';

export type DealDeskRequestStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'withdrawn';

export type DealDeskApprovalStatus = 'pending' | 'approved' | 'rejected';

export type ApproverRole =
  | 'deal_desk_analyst'
  | 'deal_desk_manager'
  | 'finance_vp'
  | 'cro';

// ============================================
// Database Row Types
// ============================================

export interface DealDeskRequestTypeRow {
  id: string;
  name: string;
  description: string | null;
  approval_threshold_pct: number | null;
  approval_threshold_arr: number | null;
  sla_hours: number;
  required_fields: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DealDeskRequestRow {
  id: string;
  customer_id: string;
  submitted_by_user_id: string;
  request_type_id: string;
  request_type: DealDeskRequestType;
  urgency: DealDeskUrgency;
  status: DealDeskRequestStatus;

  current_arr: number;
  proposed_arr: number | null;
  discount_requested_pct: number | null;
  discount_approved_pct: number | null;
  contract_term_months: number | null;

  title: string;
  justification: string;
  competitive_situation: string | null;
  customer_commitment: string | null;
  attachments: any[];

  renewal_pipeline_id: string | null;
  expansion_opportunity_id: string | null;
  salesforce_opportunity_id: string | null;

  assigned_to_user_id: string | null;
  assigned_at: string | null;

  decision_by_user_id: string | null;
  decision_at: string | null;
  decision_notes: string | null;
  conditions: string | null;

  sla_due_at: string;
  sla_breached: boolean;

  created_at: string;
  updated_at: string;
}

export interface DealDeskApprovalRow {
  id: string;
  request_id: string;
  approval_level: number;
  approver_user_id: string;
  approver_role: ApproverRole;
  status: DealDeskApprovalStatus;
  notes: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface DealDeskCommentRow {
  id: string;
  request_id: string;
  user_id: string;
  comment: string;
  is_internal: boolean;
  created_at: string;
}

// ============================================
// Service DTOs
// ============================================

export interface CreateRequestDTO {
  customerId: string;
  submittedByUserId: string;
  requestType: DealDeskRequestType;
  urgency: DealDeskUrgency;
  title: string;
  justification: string;
  currentArr?: number;
  proposedArr?: number;
  discountRequestedPct?: number;
  contractTermMonths?: number;
  competitiveSituation?: string;
  customerCommitment?: string;
  renewalPipelineId?: string;
  expansionOpportunityId?: string;
  salesforceOpportunityId?: string;
  attachments?: any[];
}

export interface QueueFilters {
  requestType?: DealDeskRequestType[];
  urgency?: DealDeskUrgency[];
  status?: DealDeskRequestStatus[];
  submitterId?: string;
  assigneeId?: string;
  segment?: string;
  search?: string;
  sortBy?: 'submission_date' | 'arr_at_stake' | 'sla_due' | 'urgency';
  sortOrder?: 'asc' | 'desc';
  showSlaBreached?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ApprovalDecision {
  approverUserId: string;
  approverRole: ApproverRole;
  status: 'approved' | 'rejected';
  notes?: string;
  discountApprovedPct?: number;
  conditions?: string;
}

export interface RequestChangesDTO {
  requestedByUserId: string;
  message: string;
}

// ============================================
// Approval Rules Engine
// ============================================

export interface ApprovalConditions {
  discountPct?: { max: number };
  arr?: { max: number };
  contractTerm?: { max: number };
}

export interface ApprovalLevel {
  level: number;
  role: ApproverRole;
  required: boolean;
}

export interface ApprovalRule {
  id: string;
  requestType: DealDeskRequestType;
  conditions: ApprovalConditions;
  approvalLevels: ApprovalLevel[];
}

// ============================================
// Analytics Types
// ============================================

export interface AnalyticsSummary {
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  avgTurnaroundHours: number;
  slaBreachRate: number;
  totalArrImpacted: number;
}

export interface ApprovalRateByType {
  requestType: DealDeskRequestType;
  total: number;
  approved: number;
  rejected: number;
  approvalRate: number;
  avgDiscountApproved: number | null;
}

export interface TurnaroundByUrgency {
  urgency: DealDeskUrgency;
  avgHours: number;
  medianHours: number;
  count: number;
}

export interface AnalyticsResult {
  summary: AnalyticsSummary;
  approvalRateByType: ApprovalRateByType[];
  turnaroundByUrgency: TurnaroundByUrgency[];
  period: {
    start: string;
    end: string;
  };
}

// ============================================
// Notification Types
// ============================================

export type NotificationType =
  | 'status_change'
  | 'assignment'
  | 'comment'
  | 'sla_warning'
  | 'decision';

export interface NotificationPayload {
  requestId: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  message: string;
}
