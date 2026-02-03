/**
 * PRD-051: Handoff Introduction Email Types
 * Data models for CSM customer handoff management
 */

// ============================================
// Core Handoff Types
// ============================================

export type HandoffStatus = 'draft' | 'pending_approval' | 'sent' | 'completed' | 'cancelled';
export type HandoffReason = 'territory_change' | 'csm_departure' | 'portfolio_rebalancing' | 'promotion' | 'other';
export type TransitionType = 'permanent' | 'temporary';

export interface CustomerHandoff {
  id: string;
  customerId: string;
  customerName: string;
  outgoingCsmId: string;
  outgoingCsmName: string;
  outgoingCsmEmail: string;
  incomingCsmId: string;
  incomingCsmName: string;
  incomingCsmEmail: string;
  reason: HandoffReason;
  reasonDetails?: string;
  transitionType: TransitionType;
  status: HandoffStatus;
  effectiveDate: Date;
  transitionEndDate?: Date; // For temporary transitions
  customerContext: CustomerHandoffContext;
  briefingDocument?: HandoffBriefingDocument;
  communications: HandoffCommunications;
  transitionMeeting?: TransitionMeeting;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  createdBy: string;
}

// ============================================
// Customer Context Types
// ============================================

export interface CustomerHandoffContext {
  // Basic Info
  arr: number;
  healthScore: number;
  relationshipTenure: number; // months
  customerStatus: 'active' | 'at_risk' | 'onboarding' | 'expansion';
  renewalDate?: Date;

  // Contacts
  primaryContact: HandoffContact;
  keyStakeholders: HandoffContact[];

  // Relationship Details
  communicationStyle: 'formal' | 'casual' | 'direct' | 'collaborative';
  meetingCadence: string; // e.g., "Weekly", "Monthly", "Bi-weekly"
  preferredChannels: ('email' | 'phone' | 'video' | 'slack')[];

  // History
  relationshipHighlights: string[];
  previousEscalations: EscalationHistory[];
  ongoingInitiatives: OngoingInitiative[];

  // Opportunities & Risks
  expansionOpportunities: string[];
  knownRisks: string[];
  sensitivities: string[];

  // Notes
  customNotes?: string;
}

export interface HandoffContact {
  name: string;
  email: string;
  title?: string;
  phone?: string;
  role: 'primary' | 'executive_sponsor' | 'technical' | 'champion' | 'stakeholder';
  communicationNotes?: string;
}

export interface EscalationHistory {
  id: string;
  date: Date;
  issue: string;
  resolution: string;
  outcome: 'positive' | 'neutral' | 'negative';
}

export interface OngoingInitiative {
  id: string;
  name: string;
  status: 'planning' | 'in_progress' | 'blocked' | 'pending_customer';
  description: string;
  targetDate?: Date;
  keyMilestones?: string[];
}

// ============================================
// Briefing Document Types
// ============================================

export interface HandoffBriefingDocument {
  id: string;
  googleDocId?: string;
  googleDocUrl?: string;
  generatedAt: Date;
  sections: BriefingSection[];
  viewedAt?: Date;
  viewedBy?: string;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

export interface BriefingSection {
  title: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
}

// ============================================
// Communications Types
// ============================================

export interface HandoffCommunications {
  outgoingEmail: HandoffEmail;
  incomingEmail: HandoffEmail;
  customerNotified: boolean;
  customerNotifiedAt?: Date;
}

export interface HandoffEmail {
  id?: string;
  status: 'draft' | 'pending_review' | 'approved' | 'sent';
  subject: string;
  bodyHtml: string;
  bodyText: string;
  recipient: {
    name: string;
    email: string;
  };
  sentAt?: Date;
  gmailMessageId?: string;
  openedAt?: Date;
}

// ============================================
// Transition Meeting Types
// ============================================

export interface TransitionMeeting {
  id?: string;
  scheduled: boolean;
  type: 'three_way' | 'async';
  calendarEventId?: string;
  meetingLink?: string;
  scheduledAt?: Date;
  duration?: number; // minutes
  attendees: string[];
  agenda?: string[];
  notes?: string;
  completedAt?: Date;
}

// ============================================
// CSM Types (for handoff)
// ============================================

export interface HandoffCSM {
  id: string;
  name: string;
  email: string;
  title: string;
  tenure: number; // years
  segment: string;
  specializations: string[];
  currentWorkload: number;
  maxWorkload: number;
  isAvailable: boolean;
  bio?: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateHandoffRequest {
  customerId: string;
  incomingCsmId: string;
  reason: HandoffReason;
  reasonDetails?: string;
  transitionType: TransitionType;
  effectiveDate: string; // ISO date string
  transitionEndDate?: string;
  scheduleTransitionMeeting: boolean;
  notifyCustomer: boolean;
  customNotes?: string;
}

export interface GenerateHandoffEmailsRequest {
  handoffId: string;
  includeIncomingDraft: boolean;
}

export interface SendHandoffEmailsRequest {
  handoffId: string;
  sendOutgoingEmail: boolean;
  sendIncomingDraft: boolean;
}

export interface HandoffResponse {
  success: boolean;
  handoff?: CustomerHandoff;
  error?: string;
}

export interface HandoffEmailsResponse {
  success: boolean;
  outgoingEmail?: HandoffEmail;
  incomingEmail?: HandoffEmail;
  error?: string;
}

export interface HandoffBriefingResponse {
  success: boolean;
  briefing?: HandoffBriefingDocument;
  documentUrl?: string;
  error?: string;
}

export interface HandoffListResponse {
  success: boolean;
  handoffs: CustomerHandoff[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface HandoffDashboard {
  pendingHandoffs: CustomerHandoff[];
  inProgressHandoffs: CustomerHandoff[];
  recentlyCompleted: CustomerHandoff[];
  incomingHandoffs: CustomerHandoff[]; // Handoffs where user is incoming CSM
  stats: {
    totalPending: number;
    totalInProgress: number;
    completedThisMonth: number;
    avgCompletionDays: number;
  };
}

// ============================================
// Transition Notes Types
// ============================================

export interface CSMNote {
  id: string;
  customerId: string;
  csmId: string;
  category: 'relationship' | 'technical' | 'preference' | 'risk' | 'opportunity' | 'general';
  content: string;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNoteRequest {
  customerId: string;
  category: CSMNote['category'];
  content: string;
  isPrivate: boolean;
}
