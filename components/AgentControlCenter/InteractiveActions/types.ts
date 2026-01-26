// Interactive Actions Type Definitions
import type { CSAgentType } from '../../../types/agents';

// ============================================
// Core Types
// ============================================

export type ActionType = 'meeting' | 'email' | 'document';
export type ActionStatus = 'idle' | 'in_progress' | 'pending_approval' | 'completed' | 'cancelled';

export interface ActionStep {
  id: string;
  title: string;
  description?: string;
  isComplete: boolean;
  isActive: boolean;
}

// ============================================
// Contact Types
// ============================================

export interface Contact {
  id: string;
  email: string;
  name: string;
  title?: string;
  company?: string;
  avatarUrl?: string;
  source: 'stakeholder' | 'google' | 'recent' | 'manual';
}

export interface ContactSearchResult {
  contacts: Contact[];
  hasMore: boolean;
}

// ============================================
// Meeting Types
// ============================================

export type MeetingType =
  | 'kickoff'
  | 'qbr'
  | 'check_in'
  | 'training'
  | 'implementation'
  | 'executive_briefing'
  | 'health_check'
  | 'escalation'
  | 'renewal_discussion'
  | 'feature_training'
  | 'usage_review';

export interface MeetingTypeConfig {
  id: MeetingType;
  label: string;
  icon: string;
  defaultDuration: number; // minutes
  description: string;
  suggestedAgenda?: string[];
}

export interface TimeSlot {
  start: Date;
  end: Date;
  duration: number; // minutes
  available: boolean;
}

export interface AvailabilityResponse {
  slots: TimeSlot[];
  timezone: string;
  nextPageToken?: string;
}

export interface MeetingFormData {
  type: MeetingType | null;
  title: string;
  selectedSlot: TimeSlot | null;
  attendees: Contact[];
  message: string;
  enhancedMessage?: string;
  addMeetLink: boolean;
  sendReminder: boolean;
}

export interface MeetingRequest {
  title: string;
  type: MeetingType;
  startTime: string; // ISO string
  endTime: string;
  attendees: string[]; // emails
  description: string;
  addMeetLink: boolean;
  sendNotifications: boolean;
}

// ============================================
// Email Types
// ============================================

export type EmailTemplate =
  | 'welcome'
  | 'agenda'
  | 'follow_up'
  | 'check_in'
  | 'value_summary'
  | 'tips'
  | 'best_practices'
  | 'proposal'
  | 'recovery_plan'
  | 'executive_summary'
  | 'custom';

export interface EmailTemplateConfig {
  id: EmailTemplate;
  label: string;
  icon: string;
  subject: string;
  bodyTemplate: string;
}

export interface EmailFormData {
  recipients: Contact[];
  cc: Contact[];
  bcc: Contact[];
  template: EmailTemplate | null;
  subject: string;
  body: string;
  enhancedBody?: string;
  attachments: DriveFile[];
}

export interface EmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  attachments?: string[]; // file IDs
}

// ============================================
// Document Types
// ============================================

export type DocumentType =
  | 'qbr_deck'
  | 'meeting_notes'
  | 'success_plan'
  | 'onboarding_plan'
  | 'usage_report'
  | 'training_docs'
  | 'renewal_proposal'
  | 'save_play'
  | 'escalation_report'
  | 'account_plan'
  | 'success_story';

export interface DocumentTemplateConfig {
  id: DocumentType;
  label: string;
  icon: string;
  description: string;
  fileType: 'doc' | 'sheet' | 'slide';
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  iconLink?: string;
  modifiedTime?: string;
}

export interface DocumentFormData {
  template: DocumentType | null;
  title: string;
  folder?: string;
  shareWith: Contact[];
}

// ============================================
// AI Enhancement Types
// ============================================

export interface EnhanceRequest {
  text: string;
  context: {
    type: 'email' | 'meeting_description' | 'document';
    customerName?: string;
    tone?: 'professional' | 'friendly' | 'formal' | 'casual';
    agentType?: CSAgentType;
    additionalContext?: string;
  };
}

export interface EnhanceResponse {
  enhanced: string;
  suggestions?: string[];
}

// ============================================
// Agent-Specific Configurations
// ============================================

export interface AgentActionConfig {
  meetingTypes: MeetingType[];
  emailTemplates: EmailTemplate[];
  documentTemplates: DocumentType[];
}

export const AGENT_ACTION_CONFIGS: Record<CSAgentType, AgentActionConfig> = {
  onboarding: {
    meetingTypes: ['kickoff', 'training', 'implementation', 'check_in'],
    emailTemplates: ['welcome', 'agenda', 'follow_up', 'tips'],
    documentTemplates: ['onboarding_plan', 'success_plan', 'training_docs', 'meeting_notes'],
  },
  adoption: {
    meetingTypes: ['feature_training', 'usage_review', 'check_in'],
    emailTemplates: ['tips', 'best_practices', 'check_in', 'follow_up'],
    documentTemplates: ['usage_report', 'training_docs', 'meeting_notes'],
  },
  renewal: {
    meetingTypes: ['qbr', 'renewal_discussion', 'executive_briefing'],
    emailTemplates: ['proposal', 'value_summary', 'follow_up', 'executive_summary'],
    documentTemplates: ['renewal_proposal', 'qbr_deck', 'success_story'],
  },
  risk: {
    meetingTypes: ['health_check', 'escalation', 'check_in'],
    emailTemplates: ['check_in', 'recovery_plan', 'follow_up'],
    documentTemplates: ['save_play', 'escalation_report', 'meeting_notes'],
  },
  strategic: {
    meetingTypes: ['qbr', 'executive_briefing', 'check_in'],
    emailTemplates: ['executive_summary', 'value_summary', 'proposal'],
    documentTemplates: ['account_plan', 'qbr_deck', 'success_story'],
  },
};

// ============================================
// Meeting Type Configurations
// ============================================

export const MEETING_TYPE_CONFIGS: Record<MeetingType, MeetingTypeConfig> = {
  kickoff: {
    id: 'kickoff',
    label: 'Kickoff Meeting',
    icon: '🚀',
    defaultDuration: 60,
    description: 'Initial meeting to align on goals and next steps',
    suggestedAgenda: ['Introductions', 'Goals & Expectations', 'Timeline Review', 'Next Steps'],
  },
  qbr: {
    id: 'qbr',
    label: 'Quarterly Business Review',
    icon: '📊',
    defaultDuration: 60,
    description: 'Review progress, metrics, and strategic alignment',
    suggestedAgenda: ['Performance Review', 'ROI Analysis', 'Roadmap Discussion', 'Goals for Next Quarter'],
  },
  check_in: {
    id: 'check_in',
    label: 'Check-in Call',
    icon: '📞',
    defaultDuration: 30,
    description: 'Regular touchpoint to discuss progress and concerns',
  },
  training: {
    id: 'training',
    label: 'Training Session',
    icon: '📚',
    defaultDuration: 45,
    description: 'Product training and best practices walkthrough',
  },
  implementation: {
    id: 'implementation',
    label: 'Implementation Review',
    icon: '⚙️',
    defaultDuration: 45,
    description: 'Review setup progress and technical configurations',
  },
  executive_briefing: {
    id: 'executive_briefing',
    label: 'Executive Briefing',
    icon: '👔',
    defaultDuration: 30,
    description: 'High-level strategic discussion with executives',
  },
  health_check: {
    id: 'health_check',
    label: 'Health Check',
    icon: '🏥',
    defaultDuration: 30,
    description: 'Assess account health and identify concerns',
  },
  escalation: {
    id: 'escalation',
    label: 'Escalation Meeting',
    icon: '🚨',
    defaultDuration: 45,
    description: 'Address critical issues requiring immediate attention',
  },
  renewal_discussion: {
    id: 'renewal_discussion',
    label: 'Renewal Discussion',
    icon: '🔄',
    defaultDuration: 45,
    description: 'Discuss contract renewal terms and expansion',
  },
  feature_training: {
    id: 'feature_training',
    label: 'Feature Training',
    icon: '✨',
    defaultDuration: 30,
    description: 'Deep dive into specific product features',
  },
  usage_review: {
    id: 'usage_review',
    label: 'Usage Review',
    icon: '📈',
    defaultDuration: 30,
    description: 'Review product usage and adoption metrics',
  },
};

// ============================================
// Email Template Configurations
// ============================================

export const EMAIL_TEMPLATE_CONFIGS: Record<EmailTemplate, EmailTemplateConfig> = {
  welcome: {
    id: 'welcome',
    label: 'Welcome Email',
    icon: '👋',
    subject: 'Welcome to {productName} - Let\'s Get Started!',
    bodyTemplate: `Hi {firstName},

Welcome to {productName}! We're thrilled to have you on board.

I'll be your dedicated Customer Success Manager, and I'm here to ensure you get the most value from our platform.

Here's what you can expect next:
• A kickoff meeting to align on your goals
• Access to our onboarding resources
• Regular check-ins to track your progress

Looking forward to partnering with you on this journey!

Best regards,
{csmName}`,
  },
  agenda: {
    id: 'agenda',
    label: 'Meeting Agenda',
    icon: '📋',
    subject: 'Agenda for Our Upcoming Meeting',
    bodyTemplate: `Hi {firstName},

Looking forward to our meeting! Here's the agenda:

{agenda}

Please let me know if you'd like to add anything to the discussion.

Best,
{csmName}`,
  },
  follow_up: {
    id: 'follow_up',
    label: 'Follow-up',
    icon: '📨',
    subject: 'Following Up on Our Conversation',
    bodyTemplate: `Hi {firstName},

Thank you for taking the time to meet with me. Here's a summary of what we discussed:

{summary}

Next Steps:
{nextSteps}

Please don't hesitate to reach out if you have any questions.

Best,
{csmName}`,
  },
  check_in: {
    id: 'check_in',
    label: 'Check-in',
    icon: '👀',
    subject: 'Quick Check-in - How\'s Everything Going?',
    bodyTemplate: `Hi {firstName},

I wanted to check in and see how things are going with {productName}.

Is there anything you need help with or any questions I can answer?

Looking forward to hearing from you!

Best,
{csmName}`,
  },
  value_summary: {
    id: 'value_summary',
    label: 'Value Summary',
    icon: '💎',
    subject: 'Your Impact with {productName}',
    bodyTemplate: `Hi {firstName},

I wanted to share some highlights of the value you've achieved with {productName}:

{valueHighlights}

We're excited about your progress and look forward to helping you achieve even more.

Best,
{csmName}`,
  },
  tips: {
    id: 'tips',
    label: 'Tips & Tricks',
    icon: '💡',
    subject: 'Pro Tips to Get More from {productName}',
    bodyTemplate: `Hi {firstName},

Here are some tips to help you get even more value from {productName}:

{tips}

Let me know if you'd like to schedule a session to dive deeper into any of these!

Best,
{csmName}`,
  },
  best_practices: {
    id: 'best_practices',
    label: 'Best Practices',
    icon: '⭐',
    subject: 'Best Practices for {featureName}',
    bodyTemplate: `Hi {firstName},

I noticed you've been using {featureName}, and I wanted to share some best practices:

{bestPractices}

Would you like to schedule a quick call to discuss these in more detail?

Best,
{csmName}`,
  },
  proposal: {
    id: 'proposal',
    label: 'Proposal',
    icon: '📄',
    subject: 'Renewal Proposal for {companyName}',
    bodyTemplate: `Hi {firstName},

Thank you for being a valued customer. Attached is our renewal proposal for your review.

Key highlights:
{proposalHighlights}

I'd love to schedule a call to discuss this in more detail and answer any questions.

Best,
{csmName}`,
  },
  recovery_plan: {
    id: 'recovery_plan',
    label: 'Recovery Plan',
    icon: '🔧',
    subject: 'Our Plan to Address Your Concerns',
    bodyTemplate: `Hi {firstName},

Thank you for sharing your feedback. We take your concerns seriously and have put together an action plan:

{recoveryPlan}

I'd like to schedule a call to discuss this in detail and ensure we're aligned.

Best,
{csmName}`,
  },
  executive_summary: {
    id: 'executive_summary',
    label: 'Executive Summary',
    icon: '📊',
    subject: '{companyName} Partnership Summary',
    bodyTemplate: `Hi {firstName},

Please find below an executive summary of our partnership:

{executiveSummary}

I'd be happy to schedule time to discuss any of these points in more detail.

Best,
{csmName}`,
  },
  custom: {
    id: 'custom',
    label: 'Custom Email',
    icon: '✏️',
    subject: '',
    bodyTemplate: '',
  },
};

// ============================================
// Document Template Configurations
// ============================================

export const DOCUMENT_TEMPLATE_CONFIGS: Record<DocumentType, DocumentTemplateConfig> = {
  qbr_deck: {
    id: 'qbr_deck',
    label: 'QBR Deck',
    icon: '📊',
    description: 'Quarterly business review presentation',
    fileType: 'slide',
  },
  meeting_notes: {
    id: 'meeting_notes',
    label: 'Meeting Notes',
    icon: '📝',
    description: 'Capture meeting discussions and action items',
    fileType: 'doc',
  },
  success_plan: {
    id: 'success_plan',
    label: 'Success Plan',
    icon: '🎯',
    description: 'Customer success roadmap and milestones',
    fileType: 'doc',
  },
  onboarding_plan: {
    id: 'onboarding_plan',
    label: 'Onboarding Plan',
    icon: '🚀',
    description: 'Onboarding timeline and checklist',
    fileType: 'doc',
  },
  usage_report: {
    id: 'usage_report',
    label: 'Usage Report',
    icon: '📈',
    description: 'Product usage and adoption metrics',
    fileType: 'sheet',
  },
  training_docs: {
    id: 'training_docs',
    label: 'Training Materials',
    icon: '📚',
    description: 'Training documentation and guides',
    fileType: 'doc',
  },
  renewal_proposal: {
    id: 'renewal_proposal',
    label: 'Renewal Proposal',
    icon: '🔄',
    description: 'Contract renewal terms and pricing',
    fileType: 'doc',
  },
  save_play: {
    id: 'save_play',
    label: 'Save Play',
    icon: '🛡️',
    description: 'At-risk customer retention strategy',
    fileType: 'doc',
  },
  escalation_report: {
    id: 'escalation_report',
    label: 'Escalation Report',
    icon: '🚨',
    description: 'Critical issue documentation and resolution',
    fileType: 'doc',
  },
  account_plan: {
    id: 'account_plan',
    label: 'Account Plan',
    icon: '📋',
    description: 'Strategic account planning document',
    fileType: 'doc',
  },
  success_story: {
    id: 'success_story',
    label: 'Success Story',
    icon: '🏆',
    description: 'Customer success case study',
    fileType: 'doc',
  },
};
