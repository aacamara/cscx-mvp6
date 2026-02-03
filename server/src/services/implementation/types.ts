/**
 * PRD-123: Contract Signed → Implementation
 * Type definitions for implementation workflow
 */

// ============================================
// Implementation Project Types
// ============================================

export type ImplementationStatus =
  | 'initiated'
  | 'planning'
  | 'executing'
  | 'closing'
  | 'completed'
  | 'on_hold'
  | 'cancelled';

export type MilestoneStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'at_risk'
  | 'blocked';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type SignatureSource = 'docusign' | 'pandadoc' | 'salesforce' | 'manual';

export type ProvisioningStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

// ============================================
// Implementation Project
// ============================================

export interface ImplementationTeam {
  csmId: string | null;
  csmName?: string;
  implementationLeadId: string | null;
  implementationLeadName?: string;
  technicalResourceIds: string[];
  technicalResourceNames?: string[];
  executiveSponsorId: string | null;
  executiveSponsorName?: string;
}

export interface KickoffMeeting {
  scheduledAt: Date | null;
  calendarEventId: string | null;
  deckDocumentId: string | null;
  agendaDocumentId: string | null;
  meetLink?: string;
  attendees?: string[];
}

export interface HandoffPackage {
  documentId: string | null;
  salesNotes: string;
  technicalRequirements: TechnicalRequirement[];
  stakeholderMap: Stakeholder[];
  successCriteria: string[];
  competitiveContext?: string;
  customerGoals: string[];
  timelineCommitments?: string[];
  specialTerms?: string[];
  completedAt: Date | null;
}

export interface TechnicalRequirement {
  requirement: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
}

export interface Stakeholder {
  name: string;
  email: string;
  title: string;
  role: 'decision_maker' | 'champion' | 'user' | 'technical' | 'executive' | 'influencer';
  influence: 'low' | 'medium' | 'high';
  notes?: string;
}

export interface ImplementationProject {
  id: string;
  customerId: string;
  customerName?: string;
  contractId: string | null;
  userId: string;

  status: ImplementationStatus;
  startDate: Date;
  targetGoLiveDate: Date | null;
  actualGoLiveDate: Date | null;

  team: ImplementationTeam;
  kickoffMeeting: KickoffMeeting;
  handoffPackage: HandoffPackage;

  provisioningStatus: ProvisioningStatus;
  provisioningRequestId: string | null;
  provisioningNotes: string | null;

  welcomeEmailSentAt: Date | null;
  welcomeEmailDraftId: string | null;

  source: SignatureSource;
  externalReferenceId: string | null;
  metadata: Record<string, any>;

  milestones?: ImplementationMilestone[];
  tasks?: ImplementationTask[];

  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Milestones and Tasks
// ============================================

export interface ImplementationMilestone {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  dueDate: Date | null;
  completedDate: Date | null;
  status: MilestoneStatus;
  owner: string | null;
  ownerId: string | null;
  sequenceNumber: number;
  dependsOn: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ImplementationTask {
  id: string;
  projectId: string;
  milestoneId: string | null;
  title: string;
  description: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  status: MilestoneStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  assigneeName: string | null;
  externalTaskId: string | null;
  externalSystem: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Contract Signature Events
// ============================================

export interface ContractSignatureEvent {
  id: string;
  source: SignatureSource;
  externalEventId: string | null;
  externalEnvelopeId: string | null;
  eventType: string;
  eventData: Record<string, any>;
  signatureCompleted: boolean;
  allPartiesSigned: boolean;
  contractId: string | null;
  customerId: string | null;
  implementationProjectId: string | null;
  processed: boolean;
  processedAt: Date | null;
  processingError: string | null;
  rawPayload: Record<string, any>;
  createdAt: Date;
}

// ============================================
// Webhook Payloads
// ============================================

export interface DocuSignEnvelopeCompletedWebhook {
  event: 'envelope-completed' | 'envelope-sent' | 'envelope-delivered' | 'envelope-signed';
  apiVersion: string;
  uri: string;
  retryCount: number;
  configurationId: string;
  generatedDateTime: string;
  data: {
    accountId: string;
    userId: string;
    envelopeId: string;
    envelopeSummary: {
      status: string;
      emailSubject: string;
      completedDateTime?: string;
      recipients: {
        signers: Array<{
          recipientId: string;
          email: string;
          name: string;
          status: string;
          signedDateTime?: string;
        }>;
      };
      envelopeDocuments?: Array<{
        documentId: string;
        name: string;
        type: string;
      }>;
    };
  };
}

export interface PandaDocDocumentCompletedWebhook {
  event: string;
  data: {
    id: string;
    name: string;
    status: string;
    date_completed?: string;
    recipients: Array<{
      email: string;
      first_name: string;
      last_name: string;
      role: string;
      has_completed: boolean;
    }>;
    metadata?: Record<string, any>;
  };
}

export interface SalesforceOpportunityWebhook {
  event: 'opportunity_closed_won' | 'opportunity_stage_change';
  data: {
    opportunityId: string;
    accountId: string;
    accountName: string;
    stage: string;
    amount: number;
    closeDate: string;
    ownerEmail: string;
    contractIds?: string[];
    products?: Array<{
      name: string;
      quantity: number;
    }>;
    metadata?: Record<string, any>;
  };
}

// ============================================
// Request/Response Types
// ============================================

export interface InitiateImplementationRequest {
  customerId: string;
  contractId?: string;
  source?: SignatureSource;
  externalReferenceId?: string;

  // Optional overrides
  targetGoLiveDays?: number;
  csmId?: string;
  implementationLeadId?: string;

  // Pre-populated data
  handoffData?: Partial<HandoffPackage>;
  contractData?: {
    companyName: string;
    arr: number;
    termLengthMonths?: number;
    products?: string[];
    slaRequirements?: string[];
  };
}

export interface InitiateImplementationResponse {
  project: ImplementationProject;
  milestones: ImplementationMilestone[];
  notifications: NotificationResult[];
}

export interface NotificationResult {
  type: 'csm' | 'implementation_lead' | 'executive_sponsor' | 'customer';
  success: boolean;
  error?: string;
  emailDraftId?: string;
}

export interface ScheduleKickoffRequest {
  projectId: string;
  proposedTimes?: Date[];
  duration?: number; // minutes
  attendeeEmails: string[];
  includeCustomer?: boolean;
}

export interface ScheduleKickoffResponse {
  success: boolean;
  calendarEventId?: string;
  meetLink?: string;
  scheduledAt?: Date;
  availableSlots?: Array<{ start: Date; end: Date }>;
}

// ============================================
// Handoff Template
// ============================================

export interface HandoffTemplateSection {
  name: string;
  key: string;
  required: boolean;
  prompt: string;
}

export interface HandoffTemplate {
  id: string;
  userId: string | null;
  name: string;
  description: string | null;
  sections: HandoffTemplateSection[];
  autoPopulate: boolean;
  requireApproval: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Default Milestone Templates
// ============================================

export interface MilestoneTemplate {
  name: string;
  description: string;
  daysFromStart: number;
  owner: 'csm' | 'implementation_lead' | 'customer' | 'technical';
  tasks?: Array<{
    title: string;
    description?: string;
    priority: TaskPriority;
  }>;
}

export const DEFAULT_MILESTONES: MilestoneTemplate[] = [
  {
    name: 'Kickoff Meeting',
    description: 'Initial kickoff meeting with all stakeholders',
    daysFromStart: 5,
    owner: 'csm',
    tasks: [
      { title: 'Schedule kickoff meeting', priority: 'high' },
      { title: 'Prepare kickoff deck', priority: 'high' },
      { title: 'Send calendar invites', priority: 'medium' },
      { title: 'Review handoff package', priority: 'medium' },
    ],
  },
  {
    name: 'Technical Setup',
    description: 'Complete technical configuration and integrations',
    daysFromStart: 14,
    owner: 'technical',
    tasks: [
      { title: 'Provision user accounts', priority: 'high' },
      { title: 'Configure SSO/authentication', priority: 'high' },
      { title: 'Set up integrations', priority: 'medium' },
      { title: 'Validate data migration', priority: 'medium' },
    ],
  },
  {
    name: 'Initial Training',
    description: 'Train primary users on the platform',
    daysFromStart: 21,
    owner: 'csm',
    tasks: [
      { title: 'Schedule training sessions', priority: 'high' },
      { title: 'Prepare training materials', priority: 'medium' },
      { title: 'Conduct admin training', priority: 'high' },
      { title: 'Conduct end-user training', priority: 'medium' },
    ],
  },
  {
    name: 'First Value Check',
    description: 'Review initial adoption and gather feedback',
    daysFromStart: 30,
    owner: 'csm',
    tasks: [
      { title: 'Schedule value check meeting', priority: 'medium' },
      { title: 'Review usage metrics', priority: 'medium' },
      { title: 'Document feedback', priority: 'low' },
    ],
  },
  {
    name: 'Go-Live',
    description: 'Full production deployment and rollout',
    daysFromStart: 60,
    owner: 'implementation_lead',
    tasks: [
      { title: 'Final UAT signoff', priority: 'critical' },
      { title: 'Production deployment', priority: 'critical' },
      { title: 'Cutover communication', priority: 'high' },
      { title: 'Monitor initial usage', priority: 'high' },
    ],
  },
  {
    name: 'First QBR',
    description: 'First quarterly business review',
    daysFromStart: 90,
    owner: 'csm',
    tasks: [
      { title: 'Prepare QBR presentation', priority: 'medium' },
      { title: 'Compile success metrics', priority: 'medium' },
      { title: 'Schedule QBR meeting', priority: 'low' },
    ],
  },
];
