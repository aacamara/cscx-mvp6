/**
 * Contract Amendment Types (PRD-042)
 *
 * TypeScript interfaces for contract amendment functionality.
 */

// ============================================
// Amendment Types
// ============================================

export type AmendmentType =
  | 'seat_addition'
  | 'seat_reduction'
  | 'feature_upgrade'
  | 'feature_downgrade'
  | 'term_extension'
  | 'term_modification'
  | 'scope_adjustment'
  | 'pricing_change'
  | 'other';

export type AmendmentStatus =
  | 'draft'
  | 'pending_review'
  | 'pending_customer'
  | 'pending_legal'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'cancelled';

export type ActorType = 'csm' | 'ae' | 'legal' | 'executive' | 'customer' | 'system';

// ============================================
// Core Interfaces
// ============================================

export interface ContractAmendment {
  id: string;
  customerId: string;
  contractId?: string;

  // Amendment details
  amendmentType: AmendmentType;
  description?: string;
  reason?: string;

  // Current contract terms
  currentSeats?: number;
  currentArr: number;
  currentTermEnd?: string;
  currentFeatures?: string[];

  // Proposed changes
  proposedSeats?: number;
  proposedArr: number;
  proposedTermEnd?: string;
  proposedFeatures?: string[];

  // Financial impact
  proratedCost: number;
  monthsRemaining: number;
  newAnnualRate: number;
  financialImpactDetails?: FinancialImpactDetails;

  // Status
  status: AmendmentStatus;

  // Approval workflow
  requiresLegalReview: boolean;
  requiresExecutiveApproval: boolean;
  legalApprovedAt?: string;
  legalApprovedBy?: string;
  executiveApprovedAt?: string;
  executiveApprovedBy?: string;

  // Communication
  emailSent: boolean;
  emailSentAt?: string;
  emailTo?: string[];
  emailCc?: string[];
  emailSubject?: string;
  emailBody?: string;

  // Customer response
  customerAcknowledged: boolean;
  customerAcknowledgedAt?: string;
  customerSigned: boolean;
  customerSignedAt?: string;
  docusignEnvelopeId?: string;

  // Ownership
  requestedBy?: string;
  requestedByName?: string;
  csmId?: string;
  aeId?: string;

  // Notes
  internalNotes?: string;
  customerFacingSummary?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface FinancialImpactDetails {
  annualDifference: number;
  monthlyDifference: number;
  proratedAmount: number;
  effectiveDate?: string;
  renewalImpact?: number;
  discountsApplied?: string[];
  calculationBreakdown?: string;
}

export interface AmendmentHistory {
  id: string;
  amendmentId: string;
  previousStatus?: AmendmentStatus;
  newStatus?: AmendmentStatus;
  action: string;
  actionDetails?: Record<string, unknown>;
  actorId?: string;
  actorName?: string;
  actorType?: ActorType;
  notes?: string;
  createdAt: string;
}

export interface AmendmentTemplate {
  id: string;
  name: string;
  amendmentType: AmendmentType;
  description?: string;
  emailSubjectTemplate?: string;
  emailBodyTemplate?: string;
  customerSummaryTemplate?: string;
  defaultRequiresLegal: boolean;
  defaultRequiresExecutive: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Request/Response Interfaces
// ============================================

export interface CreateAmendmentRequest {
  customerId: string;
  contractId?: string;
  amendmentType: AmendmentType;
  description?: string;
  reason?: string;

  // Proposed changes
  proposedSeats?: number;
  proposedFeatures?: string[];
  proposedTermEnd?: string;

  // Notes
  internalNotes?: string;

  // Options
  skipFinancialCalculation?: boolean;
}

export interface AmendmentFinancialImpact {
  customerId: string;
  customerName: string;
  contractId?: string;

  // Current state
  currentSeats: number;
  currentArr: number;
  currentTermEnd: string;
  monthsRemaining: number;

  // Proposed state
  proposedSeats: number;
  proposedArr: number;
  proposedTermEnd?: string;

  // Calculated impact
  proratedCost: number;
  newAnnualRate: number;
  annualDifference: number;
  monthlyDifference: number;

  // Per-seat pricing (if applicable)
  currentPricePerSeat?: number;
  proposedPricePerSeat?: number;
}

export interface GenerateAmendmentEmailRequest {
  amendmentId: string;
  contactName: string;
  contactEmail: string;
  ccEmails?: string[];
  customMessage?: string;
  includeLegalCc?: boolean;
  includeSalesCc?: boolean;
}

export interface AmendmentEmailResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  to: string[];
  cc: string[];
  amendment: ContractAmendment;
}

export interface UpdateAmendmentStatusRequest {
  status: AmendmentStatus;
  notes?: string;
  actorId?: string;
  actorName?: string;
  actorType?: ActorType;
}

export interface SendAmendmentEmailRequest {
  amendmentId: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  markAsSent?: boolean;
}

// ============================================
// List/Filter Interfaces
// ============================================

export interface AmendmentFilters {
  customerId?: string;
  contractId?: string;
  status?: AmendmentStatus | AmendmentStatus[];
  amendmentType?: AmendmentType | AmendmentType[];
  csmId?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

export interface AmendmentListResult {
  amendments: ContractAmendment[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AmendmentSummary {
  totalAmendments: number;
  byStatus: Record<AmendmentStatus, number>;
  byType: Record<AmendmentType, number>;
  totalProratedValue: number;
  totalNewArrValue: number;
  pendingApprovals: number;
  awaitingCustomer: number;
}

// ============================================
// UI State Interfaces
// ============================================

export interface AmendmentFormState {
  // Form inputs
  amendmentType: AmendmentType;
  proposedSeats?: number;
  proposedFeatures: string[];
  proposedTermEnd?: string;
  reason: string;
  internalNotes: string;

  // Contact info
  contactName: string;
  contactEmail: string;
  ccEmails: string[];

  // Options
  includeLegalCc: boolean;
  includeSalesCc: boolean;
}

export interface AmendmentComparisonView {
  label: string;
  current: string | number;
  proposed: string | number;
  difference?: string | number;
  highlight?: boolean;
}

// ============================================
// Constants
// ============================================

export const AMENDMENT_TYPE_LABELS: Record<AmendmentType, string> = {
  seat_addition: 'Add Users/Seats',
  seat_reduction: 'Reduce Users/Seats',
  feature_upgrade: 'Feature Upgrade',
  feature_downgrade: 'Feature Downgrade',
  term_extension: 'Term Extension',
  term_modification: 'Term Modification',
  scope_adjustment: 'Scope Adjustment',
  pricing_change: 'Pricing Change',
  other: 'Other',
};

export const AMENDMENT_STATUS_LABELS: Record<AmendmentStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  pending_customer: 'Awaiting Customer',
  pending_legal: 'Pending Legal',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  executed: 'Executed',
  cancelled: 'Cancelled',
};

export const AMENDMENT_STATUS_COLORS: Record<AmendmentStatus, string> = {
  draft: 'gray',
  pending_review: 'yellow',
  pending_customer: 'blue',
  pending_legal: 'purple',
  pending_approval: 'orange',
  approved: 'green',
  rejected: 'red',
  executed: 'green',
  cancelled: 'gray',
};

export const DEFAULT_AMENDMENT_FORM_STATE: AmendmentFormState = {
  amendmentType: 'seat_addition',
  proposedSeats: undefined,
  proposedFeatures: [],
  proposedTermEnd: undefined,
  reason: '',
  internalNotes: '',
  contactName: '',
  contactEmail: '',
  ccEmails: [],
  includeLegalCc: false,
  includeSalesCc: true,
};
