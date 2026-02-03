/**
 * Deal Desk Integration Types
 * PRD-244: Deal Desk Integration
 *
 * Types for Deal Desk request management, approval workflows,
 * and analytics.
 */

// ============================================
// Core Enums and Types
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
// Request Type Configuration
// ============================================

export interface DealDeskRequestTypeConfig {
  id: string;
  name: string;
  description: string;
  approvalThresholdPct: number | null; // Auto-approve if discount below this
  approvalThresholdArr: number | null; // Requires higher approval above this ARR
  slaHours: number;
  requiredFields: string[];
  active: boolean;
}

export const REQUEST_TYPE_LABELS: Record<DealDeskRequestType, string> = {
  discount: 'Discount Request',
  payment_terms: 'Payment Terms',
  contract_amendment: 'Contract Amendment',
  custom_pricing: 'Custom Pricing',
  bundle: 'Bundle/Package',
};

export const REQUEST_TYPE_DESCRIPTIONS: Record<DealDeskRequestType, string> = {
  discount: 'Request a discount from standard pricing',
  payment_terms: 'Request non-standard payment terms (Net 60, quarterly, etc.)',
  contract_amendment: 'Modify existing contract terms',
  custom_pricing: 'Request custom pricing structure',
  bundle: 'Create a custom bundle or package deal',
};

// ============================================
// Urgency Configuration
// ============================================

export const URGENCY_CONFIG: Record<DealDeskUrgency, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  slaMultiplier: number;
}> = {
  low: {
    label: 'Low',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500/30',
    slaMultiplier: 1.5,
  },
  normal: {
    label: 'Normal',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    slaMultiplier: 1.0,
  },
  high: {
    label: 'High',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/30',
    slaMultiplier: 0.5,
  },
  critical: {
    label: 'Critical',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    slaMultiplier: 0.25,
  },
};

// ============================================
// Status Configuration
// ============================================

export const STATUS_CONFIG: Record<DealDeskRequestStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  pending: {
    label: 'Pending',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/30',
  },
  in_review: {
    label: 'In Review',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
  },
  approved: {
    label: 'Approved',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
  },
  rejected: {
    label: 'Rejected',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
  },
  changes_requested: {
    label: 'Changes Requested',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30',
  },
  withdrawn: {
    label: 'Withdrawn',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500/30',
  },
};

// ============================================
// Attachment
// ============================================

export interface DealDeskAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}

// ============================================
// Deal Desk Request
// ============================================

export interface DealDeskRequest {
  id: string;
  customerId: string;
  customerName: string;
  submittedByUserId: string;
  submittedByName: string;
  requestTypeId: string;
  requestType: DealDeskRequestType;
  urgency: DealDeskUrgency;
  status: DealDeskRequestStatus;

  // Financial context
  currentArr: number;
  proposedArr: number | null;
  discountRequestedPct: number | null;
  discountApprovedPct: number | null;
  contractTermMonths: number | null;

  // Request details
  title: string;
  justification: string;
  competitiveSituation: string | null;
  customerCommitment: string | null;
  attachments: DealDeskAttachment[];

  // Related entities
  renewalPipelineId: string | null;
  expansionOpportunityId: string | null;
  salesforceOpportunityId: string | null;

  // Assignment
  assignedToUserId: string | null;
  assignedToName: string | null;
  assignedAt: string | null;

  // Resolution
  decisionByUserId: string | null;
  decisionByName: string | null;
  decisionAt: string | null;
  decisionNotes: string | null;
  conditions: string | null;

  // SLA tracking
  slaDueAt: string;
  slaBreached: boolean;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Computed
  daysUntilSlaDue: number;
  approvalLevelsRequired: number;
  currentApprovalLevel: number;
}

// ============================================
// Multi-Level Approval
// ============================================

export interface DealDeskApproval {
  id: string;
  requestId: string;
  approvalLevel: number;
  approverUserId: string;
  approverName: string;
  approverRole: ApproverRole;
  status: DealDeskApprovalStatus;
  notes: string | null;
  decidedAt: string | null;
  createdAt: string;
}

// ============================================
// Comment / Discussion Thread
// ============================================

export interface DealDeskComment {
  id: string;
  requestId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  comment: string;
  isInternal: boolean; // Internal vs visible to CSM
  createdAt: string;
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

// Default approval rules
export const DEFAULT_APPROVAL_RULES: ApprovalRule[] = [
  {
    id: 'standard-discount',
    requestType: 'discount',
    conditions: { discountPct: { max: 10 }, arr: { max: 50000 } },
    approvalLevels: [{ level: 1, role: 'deal_desk_analyst', required: true }],
  },
  {
    id: 'large-discount',
    requestType: 'discount',
    conditions: { discountPct: { max: 25 }, arr: { max: 200000 } },
    approvalLevels: [
      { level: 1, role: 'deal_desk_analyst', required: true },
      { level: 2, role: 'deal_desk_manager', required: true },
    ],
  },
  {
    id: 'strategic-discount',
    requestType: 'discount',
    conditions: {}, // No limits = all others
    approvalLevels: [
      { level: 1, role: 'deal_desk_analyst', required: true },
      { level: 2, role: 'deal_desk_manager', required: true },
      { level: 3, role: 'finance_vp', required: true },
    ],
  },
  {
    id: 'payment-terms-standard',
    requestType: 'payment_terms',
    conditions: { arr: { max: 100000 } },
    approvalLevels: [{ level: 1, role: 'deal_desk_analyst', required: true }],
  },
  {
    id: 'payment-terms-large',
    requestType: 'payment_terms',
    conditions: {},
    approvalLevels: [
      { level: 1, role: 'deal_desk_analyst', required: true },
      { level: 2, role: 'finance_vp', required: true },
    ],
  },
  {
    id: 'contract-amendment',
    requestType: 'contract_amendment',
    conditions: {},
    approvalLevels: [
      { level: 1, role: 'deal_desk_analyst', required: true },
      { level: 2, role: 'deal_desk_manager', required: true },
    ],
  },
  {
    id: 'custom-pricing',
    requestType: 'custom_pricing',
    conditions: {},
    approvalLevels: [
      { level: 1, role: 'deal_desk_analyst', required: true },
      { level: 2, role: 'deal_desk_manager', required: true },
      { level: 3, role: 'finance_vp', required: true },
    ],
  },
  {
    id: 'bundle-standard',
    requestType: 'bundle',
    conditions: { arr: { max: 100000 } },
    approvalLevels: [{ level: 1, role: 'deal_desk_analyst', required: true }],
  },
  {
    id: 'bundle-large',
    requestType: 'bundle',
    conditions: {},
    approvalLevels: [
      { level: 1, role: 'deal_desk_analyst', required: true },
      { level: 2, role: 'deal_desk_manager', required: true },
    ],
  },
];

// ============================================
// Create Request DTO
// ============================================

export interface CreateDealDeskRequestDTO {
  customerId: string;
  requestType: DealDeskRequestType;
  urgency: DealDeskUrgency;
  title: string;
  justification: string;

  // Financial context (optional, will be auto-populated)
  currentArr?: number;
  proposedArr?: number;
  discountRequestedPct?: number;
  contractTermMonths?: number;

  // Additional details
  competitiveSituation?: string;
  customerCommitment?: string;

  // Related entities
  renewalPipelineId?: string;
  expansionOpportunityId?: string;
  salesforceOpportunityId?: string;
}

// ============================================
// Queue Filters
// ============================================

export interface DealDeskQueueFilters {
  requestType?: DealDeskRequestType[];
  urgency?: DealDeskUrgency[];
  status?: DealDeskRequestStatus[];
  submitterId?: string;
  assigneeId?: string;
  segment?: string;
  search?: string;
  sortBy?: 'submissionDate' | 'arrAtStake' | 'slaDue' | 'urgency';
  sortOrder?: 'asc' | 'desc';
  showSlaBreached?: boolean;
}

export const DEFAULT_QUEUE_FILTERS: DealDeskQueueFilters = {
  status: ['pending', 'in_review'],
  sortBy: 'slaDue',
  sortOrder: 'asc',
  showSlaBreached: true,
};

// ============================================
// Analytics Types
// ============================================

export interface DealDeskAnalyticsSummary {
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
  requestTypeName: string;
  total: number;
  approved: number;
  rejected: number;
  approvalRate: number;
  avgDiscountApproved: number | null;
}

export interface TurnaroundByUrgency {
  urgency: DealDeskUrgency;
  urgencyLabel: string;
  avgHours: number;
  medianHours: number;
  count: number;
}

export interface DiscountTrendBySegment {
  segment: string;
  month: string;
  avgDiscountRequested: number;
  avgDiscountApproved: number;
  requestCount: number;
}

export interface WinRateCorrelation {
  withDealDesk: {
    deals: number;
    wonDeals: number;
    winRate: number;
    avgDiscountApplied: number;
  };
  withoutDealDesk: {
    deals: number;
    wonDeals: number;
    winRate: number;
    avgDiscountApplied: number;
  };
  correlation: number;
}

export interface RevenueImpactAnalysis {
  period: string;
  discountGiven: number;
  revenueRetained: number;
  netImpact: number;
  dealsCount: number;
}

export interface DealDeskAnalytics {
  summary: DealDeskAnalyticsSummary;
  approvalRateByType: ApprovalRateByType[];
  turnaroundByUrgency: TurnaroundByUrgency[];
  discountTrendsBySegment: DiscountTrendBySegment[];
  winRateCorrelation: WinRateCorrelation;
  revenueImpact: RevenueImpactAnalysis[];
  generatedAt: string;
  period: {
    start: string;
    end: string;
  };
}

// ============================================
// API Response Types
// ============================================

export interface DealDeskRequestAPIResponse {
  success: boolean;
  data: DealDeskRequest;
  meta?: {
    approvals: DealDeskApproval[];
    comments: DealDeskComment[];
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface DealDeskQueueAPIResponse {
  success: boolean;
  data: {
    requests: DealDeskRequest[];
    summary: {
      total: number;
      pending: number;
      inReview: number;
      slaBreached: number;
      totalArrAtStake: number;
    };
  };
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface DealDeskAnalyticsAPIResponse {
  success: boolean;
  data: DealDeskAnalytics;
  meta: {
    generatedAt: string;
    responseTimeMs: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

// ============================================
// Justification Template
// ============================================

export interface JustificationTemplate {
  sections: {
    name: string;
    label: string;
    placeholder: string;
    required: boolean;
  }[];
}

export const JUSTIFICATION_TEMPLATES: Record<DealDeskRequestType, JustificationTemplate> = {
  discount: {
    sections: [
      {
        name: 'business_case',
        label: 'Business Case',
        placeholder: 'Why is this discount necessary to close the deal?',
        required: true,
      },
      {
        name: 'competitive_pressure',
        label: 'Competitive Pressure',
        placeholder: 'What competitors are offering and their pricing?',
        required: false,
      },
      {
        name: 'customer_value',
        label: 'Long-term Customer Value',
        placeholder: 'Expected LTV, expansion potential, strategic value',
        required: true,
      },
      {
        name: 'commitment',
        label: 'Customer Commitment',
        placeholder: 'What is the customer committing to in exchange?',
        required: true,
      },
    ],
  },
  payment_terms: {
    sections: [
      {
        name: 'business_case',
        label: 'Business Case',
        placeholder: 'Why does the customer need different payment terms?',
        required: true,
      },
      {
        name: 'customer_creditworthiness',
        label: 'Customer Creditworthiness',
        placeholder: 'Information about customer financial stability',
        required: true,
      },
      {
        name: 'terms_requested',
        label: 'Terms Requested',
        placeholder: 'Specific payment terms being requested (Net 60, quarterly, etc.)',
        required: true,
      },
    ],
  },
  contract_amendment: {
    sections: [
      {
        name: 'current_terms',
        label: 'Current Terms',
        placeholder: 'Summary of existing contract terms',
        required: true,
      },
      {
        name: 'proposed_changes',
        label: 'Proposed Changes',
        placeholder: 'What changes are being requested?',
        required: true,
      },
      {
        name: 'rationale',
        label: 'Rationale',
        placeholder: 'Why are these changes necessary?',
        required: true,
      },
    ],
  },
  custom_pricing: {
    sections: [
      {
        name: 'standard_pricing',
        label: 'Standard Pricing',
        placeholder: 'What would standard pricing be for this customer?',
        required: true,
      },
      {
        name: 'custom_structure',
        label: 'Custom Structure Requested',
        placeholder: 'Describe the custom pricing structure',
        required: true,
      },
      {
        name: 'justification',
        label: 'Justification',
        placeholder: 'Why is custom pricing warranted?',
        required: true,
      },
    ],
  },
  bundle: {
    sections: [
      {
        name: 'products_included',
        label: 'Products/Services Included',
        placeholder: 'List all products and services in the bundle',
        required: true,
      },
      {
        name: 'bundle_discount',
        label: 'Bundle Discount',
        placeholder: 'What discount is being applied to the bundle?',
        required: true,
      },
      {
        name: 'strategic_value',
        label: 'Strategic Value',
        placeholder: 'Why is this bundle strategically valuable?',
        required: true,
      },
    ],
  },
};

// ============================================
// Notification Types
// ============================================

export interface DealDeskNotification {
  id: string;
  requestId: string;
  recipientUserId: string;
  type: 'status_change' | 'assignment' | 'comment' | 'sla_warning' | 'decision';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

// ============================================
// Salesforce Sync
// ============================================

export interface SalesforceOpportunityUpdate {
  opportunityId: string;
  discountApproved: number | null;
  dealDeskApprovalDate: string | null;
  dealDeskNotes: string | null;
  pricingStatus: 'Deal Desk Approved' | 'Deal Desk Rejected' | 'Pending Deal Desk';
}
