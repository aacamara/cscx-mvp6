/**
 * Email Response Suggestions Types
 * PRD-215: Smart Email Response Suggestions
 *
 * Types for AI-powered email response generation that incorporates
 * customer context (health score, recent meetings, open issues, etc.)
 */

// ============================================
// Core Types
// ============================================

export type ResponseStyle = 'formal' | 'friendly' | 'brief';

export type DetectedIntent =
  | 'information_request'
  | 'support_request'
  | 'scheduling_request'
  | 'escalation'
  | 'feedback'
  | 'renewal_discussion'
  | 'general'
  | 'complaint'
  | 'thank_you';

export type UrgencyLevel = 'low' | 'normal' | 'high' | 'critical';

export type RecommendedAction =
  | 'respond_immediately'
  | 'respond_today'
  | 'respond_this_week'
  | 'schedule_call'
  | 'escalate'
  | 'forward_to_support';

export type SuggestionFeedback = 'used' | 'edited' | 'rejected';

// ============================================
// Email Context
// ============================================

/**
 * Incoming email information for suggestion generation
 */
export interface IncomingEmail {
  id: string;
  threadId: string;
  from: {
    email: string;
    name?: string;
  };
  to: string[];
  cc?: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  receivedAt: Date;
  previousMessages?: EmailThreadMessage[];
}

export interface EmailThreadMessage {
  from: string;
  bodyText: string;
  sentAt: Date;
  isInbound: boolean;
}

/**
 * Customer context for response generation
 */
export interface EmailCustomerContext {
  customerId: string;
  customerName: string;
  healthScore: number;
  arr?: number;
  stage?: string;
  industry?: string;
  renewalDate?: string;
  lastContactDate?: string;
  openSupportTickets?: SupportTicketSummary[];
  recentMeetings?: MeetingSummaryBrief[];
  riskSignals?: RiskSignalBrief[];
  upcomingEvents?: UpcomingEvent[];
}

export interface SupportTicketSummary {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: Date;
}

export interface MeetingSummaryBrief {
  title: string;
  date: Date;
  summary?: string;
  actionItems?: string[];
}

export interface RiskSignalBrief {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface UpcomingEvent {
  type: 'renewal' | 'qbr' | 'meeting' | 'milestone';
  title: string;
  date: Date;
}

/**
 * Stakeholder information for response personalization
 */
export interface StakeholderInfo {
  id?: string;
  name: string;
  email: string;
  role?: string;
  title?: string;
  department?: string;
  isDecisionMaker?: boolean;
  lastContactDate?: string;
}

// ============================================
// Response Suggestions
// ============================================

/**
 * A single email response suggestion
 */
export interface EmailResponseSuggestion {
  id: string;
  style: ResponseStyle;
  subject: string;
  greeting: string;
  body: string;
  closing: string;
  fullText: string; // Complete email text
  confidence: number; // 0-1 confidence score
  contextUsed: string[]; // What context was incorporated
  suggestedSendTime: string | null;
  talkingPoints?: string[];
}

/**
 * Full response from suggestion generation
 */
export interface EmailSuggestionResponse {
  suggestions: EmailResponseSuggestion[];
  detectedIntent: DetectedIntent;
  urgency: UrgencyLevel;
  recommendedAction: RecommendedAction;
  stakeholder?: StakeholderInfo;
  contextSummary: string;
  generatedAt: Date;
}

// ============================================
// API Request/Response Types
// ============================================

/**
 * Request to generate email response suggestions
 */
export interface SuggestResponseRequest {
  emailId: string;
  threadId?: string;
  customerId: string;
  stakeholderId?: string;
  emailContent?: {
    from: { email: string; name?: string };
    subject: string;
    bodyText: string;
    receivedAt?: string;
  };
}

/**
 * Request to send a suggestion (with optional edits)
 */
export interface SendSuggestionRequest {
  suggestionId: string;
  emailId: string;
  threadId?: string;
  edits?: {
    subject?: string;
    body?: string;
  };
  sendNow: boolean;
  scheduledTime?: string;
  logActivity?: boolean;
  createFollowUpTask?: boolean;
}

/**
 * Response after sending a suggestion
 */
export interface SendSuggestionResponse {
  success: boolean;
  messageId?: string;
  draftId?: string;
  error?: string;
  activityLogged?: boolean;
  followUpTaskId?: string;
}

/**
 * Request to provide feedback on a suggestion
 */
export interface SuggestionFeedbackRequest {
  suggestionId: string;
  emailId: string;
  feedback: SuggestionFeedback;
  rating?: number; // 1-5 stars
  notes?: string;
  originalText?: string;
  finalText?: string;
}

/**
 * Response after providing feedback
 */
export interface SuggestionFeedbackResponse {
  success: boolean;
  feedbackId?: string;
}

// ============================================
// Component Props
// ============================================

/**
 * Props for the EmailResponseSuggestions component
 */
export interface EmailResponseSuggestionsProps {
  email: IncomingEmail;
  customerId: string;
  customerName: string;
  stakeholder?: StakeholderInfo;
  onSend: (result: SendSuggestionResponse) => void;
  onDismiss?: () => void;
  autoGenerate?: boolean;
  className?: string;
}

/**
 * Props for individual suggestion card
 */
export interface SuggestionCardProps {
  suggestion: EmailResponseSuggestion;
  isSelected: boolean;
  isLoading: boolean;
  onSelect: () => void;
  onUse: () => void;
  onEdit: () => void;
}

// ============================================
// State Management
// ============================================

/**
 * State for email suggestions UI
 */
export interface EmailSuggestionsState {
  isLoading: boolean;
  suggestions: EmailResponseSuggestion[];
  selectedSuggestionId: string | null;
  detectedIntent: DetectedIntent | null;
  urgency: UrgencyLevel | null;
  recommendedAction: RecommendedAction | null;
  error: string | null;
  isEditing: boolean;
  editedContent: {
    subject: string;
    body: string;
  } | null;
  isSending: boolean;
}

/**
 * Hook return type for useEmailSuggestions
 */
export interface UseEmailSuggestionsReturn {
  state: EmailSuggestionsState;
  generateSuggestions: (request: SuggestResponseRequest) => Promise<void>;
  selectSuggestion: (id: string) => void;
  startEditing: () => void;
  updateEdit: (field: 'subject' | 'body', value: string) => void;
  cancelEdit: () => void;
  sendSuggestion: (options: { sendNow: boolean }) => Promise<SendSuggestionResponse>;
  provideFeedback: (feedback: SuggestionFeedback, rating?: number) => Promise<void>;
  reset: () => void;
}
