/**
 * Gmail Integration Types
 * PRD-190: Gmail Integration for CSCX.AI
 *
 * Types for email thread sync, customer matching, metrics,
 * templates, and AI-assisted composition.
 */

// ============================================
// Email Thread Types
// ============================================

export interface GmailThread {
  id: string;
  gmailThreadId: string;
  subject: string;
  snippet: string;
  participants: string[];
  messageCount: number;
  lastMessageAt: Date;
  firstMessageAt?: Date;
  isUnread: boolean;
  isStarred: boolean;
  isArchived: boolean;
  labels: string[];
  customerId?: string;
  customerName?: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  gmailMessageId: string;
  from: EmailParticipantInfo;
  to: string[];
  cc: string[];
  bcc?: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  sentAt: Date;
  isInbound: boolean;
  hasAttachments: boolean;
  attachments?: EmailAttachmentInfo[];
}

export interface EmailParticipantInfo {
  email: string;
  name?: string;
}

export interface EmailAttachmentInfo {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

// ============================================
// Customer Email Matching
// ============================================

export interface CustomerEmailMatch {
  customerId: string;
  customerName: string;
  matchType: 'domain' | 'stakeholder' | 'thread_participant';
  confidence: number;
  matchedEmails: string[];
}

export interface EmailDomainMapping {
  domain: string;
  customerId: string;
  customerName: string;
  stakeholderCount: number;
}

// ============================================
// Email Metrics Types
// ============================================

export interface CustomerEmailMetrics {
  customerId: string;
  customerName?: string;
  period: string; // e.g., '2026-01', 'last_30_days'
  emailsSent: number;
  emailsReceived: number;
  avgResponseHours: number | null;
  totalThreads: number;
  avgThreadDepth: number | null;
  lastOutboundAt: Date | null;
  lastInboundAt: Date | null;
  stakeholdersContacted: number;
  uniqueRecipients: number;
  engagementScore: number;
}

export interface EmailMetricsSummary {
  totalEmailsSent: number;
  totalEmailsReceived: number;
  avgResponseTime: number | null;
  customersEngaged: number;
  silentCustomers: number; // No email in 30+ days
  topEngaged: Array<{
    customerId: string;
    customerName: string;
    emailCount: number;
    engagementScore: number;
  }>;
}

export interface EmailFrequencyTrend {
  period: string;
  sent: number;
  received: number;
  threads: number;
}

// ============================================
// Email Template Types
// ============================================

export type EmailTemplateCategory =
  | 'check_in'
  | 'follow_up'
  | 'welcome'
  | 'qbr'
  | 'renewal'
  | 'escalation'
  | 'custom';

export interface EmailTemplate {
  id: string;
  name: string;
  description?: string;
  category: EmailTemplateCategory;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  variables: string[];
  isAiGenerated: boolean;
  isActive: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariable {
  name: string;
  description: string;
  type: 'string' | 'number' | 'date' | 'list';
  required: boolean;
  defaultValue?: string;
  example?: string;
}

// Standard variable categories
export const TEMPLATE_VARIABLE_CATEGORIES = {
  customer: [
    { name: 'customer.name', description: 'Company name', type: 'string' as const },
    { name: 'customer.arr', description: 'Annual recurring revenue', type: 'number' as const },
    { name: 'customer.health_score', description: 'Current health score', type: 'number' as const },
    { name: 'customer.tier', description: 'Customer tier', type: 'string' as const },
    { name: 'customer.industry', description: 'Industry', type: 'string' as const },
  ],
  stakeholder: [
    { name: 'stakeholder.first_name', description: 'First name', type: 'string' as const },
    { name: 'stakeholder.last_name', description: 'Last name', type: 'string' as const },
    { name: 'stakeholder.full_name', description: 'Full name', type: 'string' as const },
    { name: 'stakeholder.title', description: 'Job title', type: 'string' as const },
    { name: 'stakeholder.email', description: 'Email address', type: 'string' as const },
  ],
  csm: [
    { name: 'csm.first_name', description: 'CSM first name', type: 'string' as const },
    { name: 'csm.last_name', description: 'CSM last name', type: 'string' as const },
    { name: 'csm.email', description: 'CSM email', type: 'string' as const },
    { name: 'csm.calendar_link', description: 'CSM calendar booking link', type: 'string' as const },
    { name: 'csm.phone', description: 'CSM phone number', type: 'string' as const },
  ],
  meeting: [
    { name: 'meeting.topic', description: 'Meeting topic', type: 'string' as const },
    { name: 'meeting.date', description: 'Meeting date', type: 'date' as const },
    { name: 'meeting.summary', description: 'Meeting summary', type: 'string' as const },
    { name: 'meeting.action_items', description: 'Action items list', type: 'list' as const },
  ],
  renewal: [
    { name: 'renewal.date', description: 'Renewal date', type: 'date' as const },
    { name: 'renewal.amount', description: 'Renewal amount', type: 'number' as const },
    { name: 'renewal.days_until', description: 'Days until renewal', type: 'number' as const },
    { name: 'renewal.achievements', description: 'Customer achievements', type: 'list' as const },
  ],
  qbr: [
    { name: 'qbr.quarter', description: 'Quarter (Q1, Q2, etc.)', type: 'string' as const },
    { name: 'qbr.year', description: 'Year', type: 'number' as const },
    { name: 'qbr.proposed_times', description: 'Proposed meeting times', type: 'list' as const },
    { name: 'qbr.scheduled_date', description: 'Scheduled date', type: 'date' as const },
  ],
  product: [
    { name: 'product.name', description: 'Product name', type: 'string' as const },
    { name: 'product.version', description: 'Product version', type: 'string' as const },
  ],
  other: [
    { name: 'days_since_contact', description: 'Days since last contact', type: 'number' as const },
    { name: 'current_date', description: 'Current date', type: 'date' as const },
  ],
};

// ============================================
// Email Composition Types
// ============================================

export interface ComposeEmailRequest {
  customerId: string;
  stakeholderIds?: string[];
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  templateId?: string;
  variables?: Record<string, string | number | string[]>;
  threadId?: string; // For replies
  inReplyTo?: string;
  attachments?: File[];
  saveAsDraft?: boolean;
  requiresApproval?: boolean;
}

export interface ComposeEmailResponse {
  success: boolean;
  messageId?: string;
  draftId?: string;
  approvalId?: string;
  error?: string;
}

export interface EmailDraftData {
  id: string;
  gmailDraftId?: string;
  customerId?: string;
  customerName?: string;
  templateId?: string;
  templateName?: string;
  recipients: {
    to: string[];
    cc: string[];
    bcc: string[];
  };
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  variablesUsed?: Record<string, string | number | string[]>;
  isAiGenerated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// AI-Assisted Email Generation
// ============================================

export interface GenerateEmailRequest {
  customerId: string;
  purpose: EmailPurpose;
  recipientIds?: string[];
  context?: {
    recentActivity?: string;
    healthScore?: number;
    renewalDate?: string;
    lastContactDays?: number;
    meetingNotes?: string;
    customContext?: string;
  };
  tone?: 'formal' | 'friendly' | 'brief';
  templateId?: string;
}

export type EmailPurpose =
  | 'check_in'
  | 'follow_up'
  | 'welcome'
  | 'qbr_invite'
  | 'qbr_follow_up'
  | 'renewal_intro'
  | 'renewal_reminder'
  | 'escalation_acknowledgment'
  | 'feature_announcement'
  | 'silence_outreach'
  | 'thank_you'
  | 'custom';

export interface GenerateEmailResponse {
  success: boolean;
  email?: {
    subject: string;
    bodyHtml: string;
    bodyText: string;
    suggestedRecipients: string[];
    reasoning: string;
  };
  alternatives?: Array<{
    subject: string;
    bodyHtml: string;
    tone: string;
  }>;
  error?: string;
}

// ============================================
// Email Actions Types
// ============================================

export type EmailAction =
  | 'mark_read'
  | 'mark_unread'
  | 'archive'
  | 'unarchive'
  | 'star'
  | 'unstar'
  | 'trash'
  | 'add_label'
  | 'remove_label';

export interface EmailActionRequest {
  threadId: string;
  action: EmailAction;
  labelId?: string; // For add_label/remove_label
}

export interface EmailActionResponse {
  success: boolean;
  threadId: string;
  action: EmailAction;
  error?: string;
}

// ============================================
// Email Sync Types
// ============================================

export interface SyncCustomerEmailsRequest {
  customerId: string;
  domain?: string;
  stakeholderEmails?: string[];
  maxResults?: number;
  sinceDays?: number;
}

export interface SyncCustomerEmailsResponse {
  success: boolean;
  threadsFound: number;
  threadsSynced: number;
  metricsUpdated: boolean;
  newThreadIds: string[];
  error?: string;
}

export interface EmailSyncStatus {
  lastSyncAt: Date | null;
  threadCount: number;
  isConnected: boolean;
  userEmail: string | null;
}

// ============================================
// Hook State Types
// ============================================

export interface GmailIntegrationState {
  // Connection
  isConnected: boolean;
  userEmail: string | null;
  isConnecting: boolean;
  connectionError: string | null;

  // Threads
  threads: GmailThread[];
  selectedThread: GmailThread | null;
  selectedMessages: GmailMessage[];
  isLoadingThreads: boolean;
  threadsError: string | null;
  nextPageToken: string | null;

  // Customer threads
  customerThreads: Map<string, GmailThread[]>;
  isLoadingCustomerThreads: boolean;

  // Compose
  isComposing: boolean;
  draftData: EmailDraftData | null;
  isSending: boolean;
  sendError: string | null;

  // Templates
  templates: EmailTemplate[];
  isLoadingTemplates: boolean;

  // Metrics
  metrics: CustomerEmailMetrics | null;
  isLoadingMetrics: boolean;

  // AI
  isGeneratingEmail: boolean;
  generatedEmail: GenerateEmailResponse['email'] | null;

  // Sync
  isSyncing: boolean;
  lastSyncAt: Date | null;
}

export interface UseGmailIntegrationReturn {
  state: GmailIntegrationState;

  // Connection
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  checkConnection: () => Promise<void>;

  // Threads
  loadThreads: (options?: { query?: string; maxResults?: number; pageToken?: string }) => Promise<void>;
  loadThread: (threadId: string) => Promise<void>;
  loadCustomerThreads: (customerId: string) => Promise<void>;
  refreshThreads: () => Promise<void>;

  // Actions
  markAsRead: (threadId: string) => Promise<void>;
  markAsUnread: (threadId: string) => Promise<void>;
  archiveThread: (threadId: string) => Promise<void>;
  starThread: (threadId: string) => Promise<void>;
  unstarThread: (threadId: string) => Promise<void>;

  // Compose
  startCompose: (options?: { customerId?: string; stakeholderIds?: string[]; templateId?: string }) => void;
  cancelCompose: () => void;
  sendEmail: (request: ComposeEmailRequest) => Promise<ComposeEmailResponse>;
  saveDraft: (request: ComposeEmailRequest) => Promise<ComposeEmailResponse>;

  // Templates
  loadTemplates: (category?: EmailTemplateCategory) => Promise<void>;
  applyTemplate: (templateId: string, variables: Record<string, string | number | string[]>) => void;

  // AI
  generateEmail: (request: GenerateEmailRequest) => Promise<void>;

  // Metrics
  loadMetrics: (customerId: string, period?: string) => Promise<void>;

  // Sync
  syncCustomerEmails: (request: SyncCustomerEmailsRequest) => Promise<SyncCustomerEmailsResponse>;
}
