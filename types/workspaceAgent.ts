/**
 * CSCX.AI Agentic Google Workspace Types
 * Full integration with Google Workspace, Meeting Intelligence, Voice, and Automation
 * Based on CSCX System Prompt capabilities
 */

// ============================================
// Connection & Auth
// ============================================

export interface WorkspaceConnection {
  status: 'connected' | 'disconnected' | 'expired' | 'partial';
  gmail: ServiceStatus;
  calendar: ServiceStatus;
  drive: ServiceStatus;
  docs: ServiceStatus;
  sheets: ServiceStatus;
  slides: ServiceStatus;
  lastSync: Date | null;
  userEmail?: string;
  scopes: string[];
}

export interface ServiceStatus {
  connected: boolean;
  lastSync: Date | null;
  error?: string;
}

// ============================================
// Gmail Types
// ============================================

export interface EmailThread {
  id: string;
  subject: string;
  snippet: string;
  participants: EmailParticipant[];
  messageCount: number;
  unreadCount: number;
  lastMessageDate: Date;
  labels: string[];
  isCustomerThread: boolean;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'urgent';
  summary?: string;
  actionItems?: string[];
}

export interface EmailParticipant {
  name: string;
  email: string;
  role: 'customer' | 'internal' | 'external';
  isStakeholder: boolean;
}

export interface EmailDraft {
  id: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  purpose: EmailPurpose;
  tone: 'formal' | 'friendly' | 'urgent';
  attachments?: EmailAttachment[];
  scheduledFor?: Date;
  replyToMessageId?: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'sent' | 'failed';
  aiGenerated: boolean;
  suggestions?: string[];
  templateUsed?: EmailTemplate;
}

export interface EmailAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  driveFileId?: string;
}

export type EmailPurpose =
  | 'kickoff'
  | 'check_in'
  | 'follow_up'
  | 'milestone'
  | 'qbr_invite'
  | 'renewal'
  | 'escalation'
  | 'thank_you'
  | 'feature_announcement'
  | 'survey_request'
  | 'nps_request'
  | 'success_celebration'
  | 'onboarding_welcome'
  | 'executive_review'
  | 'custom';

export type EmailTemplate =
  | 'qbr_invitation'
  | 'meeting_follow_up'
  | 'renewal_reminder_90'
  | 'renewal_reminder_60'
  | 'renewal_reminder_30'
  | 'renewal_reminder_14'
  | 'renewal_reminder_7'
  | 'health_check_in'
  | 'feature_announcement'
  | 'escalation_notification'
  | 'success_milestone'
  | 'onboarding_welcome'
  | 'nps_survey'
  | 'executive_business_review';

export interface EmailLabel {
  id: string;
  name: string;
  color?: string;
  messageCount: number;
}

// ============================================
// Calendar Types
// ============================================

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  attendees: EventAttendee[];
  meetingLink?: string;
  location?: string;
  isCustomerMeeting: boolean;
  customerName?: string;
  eventType: MeetingType;
  status: 'confirmed' | 'tentative' | 'cancelled';
  notes?: string;
  actionItems?: string[];
  recurrence?: RecurrenceRule;
  reminders?: EventReminder[];
}

export interface EventAttendee {
  email: string;
  name?: string;
  responseStatus: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  isCustomer: boolean;
  isOrganizer?: boolean;
}

export interface EventReminder {
  method: 'email' | 'popup';
  minutes: number;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  daysOfWeek?: string[];
  endDate?: Date;
  count?: number;
}

export type MeetingType =
  | 'kickoff'
  | 'check_in'
  | 'qbr'
  | 'training'
  | 'escalation'
  | 'renewal'
  | 'discovery'
  | 'internal'
  | 'executive_review'
  | 'onboarding'
  | 'support'
  | 'other';

export interface AvailabilitySlot {
  start: Date;
  end: Date;
  score: number; // 0-100, higher = better time
  reason?: string;
  conflicts?: string[];
}

export interface MeetingProposal {
  id: string;
  title: string;
  description: string;
  duration: number; // minutes
  attendees: string[];
  proposedSlots: AvailabilitySlot[];
  selectedSlot?: AvailabilitySlot;
  meetingType: MeetingType;
  status: 'proposing' | 'pending_response' | 'confirmed' | 'declined';
  includeMeetLink: boolean;
  includeZoomLink?: boolean;
  sendInvites: boolean;
}

// ============================================
// Google Drive Types
// ============================================

export interface DriveDocument {
  id: string;
  name: string;
  mimeType: string;
  type: 'document' | 'spreadsheet' | 'presentation' | 'pdf' | 'folder' | 'other';
  webViewLink: string;
  webEditLink?: string;
  downloadUrl?: string;
  lastModified: Date;
  lastModifiedBy?: string;
  size?: number;
  isCustomerDoc: boolean;
  customerName?: string;
  category?: DocumentCategory;
  sharedWith?: string[];
  permissions?: FilePermission[];
}

export type DocumentCategory =
  | 'contract'
  | 'proposal'
  | 'qbr'
  | 'training'
  | 'meeting_notes'
  | 'success_plan'
  | 'onboarding_plan'
  | 'report'
  | 'executive_summary'
  | 'other';

export interface FilePermission {
  email: string;
  role: 'owner' | 'writer' | 'commenter' | 'reader';
  type: 'user' | 'group' | 'domain' | 'anyone';
}

export interface CustomerFolder {
  id: string;
  name: string;
  customerName: string;
  documentCount: number;
  lastActivity: Date;
  subfolders: FolderStructure[];
  recentDocs: DriveDocument[];
}

export interface FolderStructure {
  id: string;
  name: string;
  path: string;
  documentCount: number;
}

// ============================================
// Google Docs Types
// ============================================

export interface GoogleDoc {
  id: string;
  title: string;
  content: string;
  revisionId?: string;
  comments?: DocComment[];
  suggestedChanges?: SuggestedEdit[];
}

export interface DocComment {
  id: string;
  author: string;
  content: string;
  resolved: boolean;
  createdAt: Date;
  replies?: DocComment[];
}

export interface SuggestedEdit {
  id: string;
  author: string;
  originalText: string;
  suggestedText: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface DocTemplate {
  id: string;
  name: string;
  type: DocTemplateType;
  description: string;
  variables: string[]; // {{customer_name}}, {{date}}, etc.
  previewUrl?: string;
}

export type DocTemplateType =
  | 'qbr'
  | 'meeting_notes'
  | 'proposal'
  | 'executive_summary'
  | 'customer_report'
  | 'onboarding_plan'
  | 'success_plan'
  | 'renewal_proposal'
  | 'escalation_report';

export interface DocCreateRequest {
  title: string;
  content?: string;
  template?: DocTemplateType;
  templateVariables?: Record<string, string>;
  folderId?: string;
}

// ============================================
// Google Sheets Types
// ============================================

export interface GoogleSheet {
  id: string;
  title: string;
  sheets: SheetTab[];
  lastModified: Date;
}

export interface SheetTab {
  id: number;
  name: string;
  rowCount: number;
  columnCount: number;
  frozenRowCount?: number;
  frozenColumnCount?: number;
}

export interface SheetData {
  range: string;
  values: any[][];
  formulas?: string[][];
}

export interface SheetCreateRequest {
  title: string;
  sheets: SheetTabConfig[];
  folderId?: string;
}

export interface SheetTabConfig {
  name: string;
  headers: string[];
  data?: any[][];
  formatting?: SheetFormatting;
  conditionalFormatting?: ConditionalFormat[];
}

export interface SheetFormatting {
  headerBold?: boolean;
  headerBackground?: string;
  alternatingColors?: boolean;
}

export interface ConditionalFormat {
  range: string;
  rule: 'greaterThan' | 'lessThan' | 'equals' | 'contains';
  value: any;
  format: { backgroundColor?: string; textColor?: string; bold?: boolean };
}

// ============================================
// Google Slides Types
// ============================================

export interface GoogleSlides {
  id: string;
  title: string;
  slides: Slide[];
  pageSize: { width: number; height: number };
}

export interface Slide {
  id: string;
  layout: SlideLayout;
  elements: SlideElement[];
  speakerNotes?: string;
}

export type SlideLayout =
  | 'title'
  | 'title_body'
  | 'section_header'
  | 'two_column'
  | 'blank'
  | 'title_and_two_columns'
  | 'caption_only';

export interface SlideElement {
  type: 'text' | 'image' | 'shape' | 'table' | 'chart' | 'video';
  content?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface SlidesCreateRequest {
  title: string;
  template?: string;
  slides?: SlideConfig[];
  folderId?: string;
}

export interface SlideConfig {
  layout: SlideLayout;
  title?: string;
  body?: string;
  notes?: string;
  imageUrl?: string;
}

// ============================================
// Meeting Intelligence Types
// ============================================

export type MeetingPlatform = 'zoom' | 'google_meet' | 'teams' | 'webex' | 'otter' | 'fireflies';

export interface MeetingRecording {
  id: string;
  platform: MeetingPlatform;
  title: string;
  startTime: Date;
  duration: number; // minutes
  participants: MeetingParticipant[];
  recordingUrl?: string;
  transcriptAvailable: boolean;
  customerId?: string;
  customerName?: string;
}

export interface MeetingParticipant {
  name: string;
  email?: string;
  joinTime: Date;
  leaveTime?: Date;
  duration: number;
  isCustomer: boolean;
  attentionScore?: number;
}

export interface MeetingTranscript {
  id: string;
  meetingId: string;
  platform: MeetingPlatform;
  fullText: string;
  segments: TranscriptSegment[];
  speakers: string[];
  duration: number;
  language: string;
}

export interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number; // seconds
  endTime: number;
  confidence?: number;
}

export interface MeetingSummary {
  id: string;
  meetingId: string;
  format: 'executive' | 'detailed' | 'action_items_only' | 'email_ready';
  overview: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  decisions: string[];
  followUps: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  customerSignals: CustomerSignal[];
  generatedAt: Date;
}

export interface ActionItem {
  id: string;
  description: string;
  owner?: string;
  dueDate?: Date;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
  source: 'meeting' | 'email' | 'manual';
  sourceMeetingId?: string;
}

export interface CustomerSignal {
  type: 'risk' | 'opportunity' | 'feedback' | 'competitor_mention';
  description: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  quote?: string;
  timestamp?: number;
}

// ============================================
// Voice Agent Types
// ============================================

export interface VoiceConfig {
  enabled: boolean;
  voiceId: string;
  speakingRate: number;
  pitch: number;
  language: string;
}

export interface TranscriptionRequest {
  audioUrl?: string;
  audioStream?: any;
  language: string;
  speakerDiarization: boolean;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptSegment[];
  speakers: string[];
  confidence: number;
  duration: number;
}

export interface SpeechSynthesisRequest {
  text: string;
  voiceId: string;
  speakingRate?: number;
  pitch?: number;
  format?: 'mp3' | 'wav' | 'ogg';
}

export interface MeetingBot {
  id: string;
  name: string;
  meetingUrl: string;
  status: 'pending' | 'joining' | 'active' | 'completed' | 'failed';
  capabilities: MeetingBotCapability[];
  startedAt?: Date;
  endedAt?: Date;
}

export type MeetingBotCapability =
  | 'transcription'
  | 'note_taking'
  | 'action_tracking'
  | 'real_time_summary'
  | 'sentiment_analysis';

// ============================================
// Health Score Types
// ============================================

export interface HealthScore {
  customerId: string;
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  trend: 'improving' | 'stable' | 'declining';
  previousScore?: number;
  signals: HealthSignals;
  factors: HealthFactor[];
  recommendations: string[];
  calculatedAt: Date;
  nextRecalculation?: Date;
}

export interface HealthSignals {
  productUsage: UsageSignal;
  engagement: EngagementSignal;
  support: SupportSignal;
  nps: NPSSignal;
  contract: ContractSignal;
  stakeholder: StakeholderSignal;
}

export interface UsageSignal {
  loginFrequency: number;
  featureAdoption: number; // percentage
  usageVsEntitlement: number; // percentage
  activeUsers: number;
  trend: 'up' | 'stable' | 'down';
  score: number; // 0-100
}

export interface EngagementSignal {
  meetingFrequency: number; // per month
  emailResponseTime: number; // hours average
  eventAttendance: number; // percentage
  lastContactDays: number;
  score: number;
}

export interface SupportSignal {
  ticketVolume: number;
  avgSeverity: number;
  resolutionSatisfaction: number;
  openTickets: number;
  escalations: number;
  score: number;
}

export interface NPSSignal {
  latestScore: number;
  previousScore?: number;
  trend: 'promoter' | 'passive' | 'detractor' | 'unknown';
  lastSurveyDate?: Date;
  score: number;
}

export interface ContractSignal {
  daysToRenewal: number;
  expansionHistory: number; // percentage growth
  paymentStatus: 'current' | 'late' | 'at_risk';
  contractValue: number;
  score: number;
}

export interface StakeholderSignal {
  championStrength: 'strong' | 'moderate' | 'weak' | 'none';
  executiveEngagement: boolean;
  turnoverRisk: 'low' | 'medium' | 'high';
  decisionMakerAccess: boolean;
  score: number;
}

export interface HealthFactor {
  name: string;
  weight: number;
  score: number;
  impact: 'positive' | 'neutral' | 'negative';
  description: string;
}

export interface HealthScoreAlert {
  id: string;
  customerId: string;
  customerName: string;
  alertType: 'score_drop' | 'threshold_breach' | 'trend_change' | 'renewal_risk';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  previousScore: number;
  currentScore: number;
  triggeredAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
}

// ============================================
// QBR Generation Types
// ============================================

export interface QBRPackage {
  id: string;
  customerId: string;
  customerName: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  year: number;
  status: 'generating' | 'draft' | 'pending_review' | 'approved' | 'presented';
  documentId?: string;
  presentationId?: string;
  documentUrl?: string;
  presentationUrl?: string;
  sections: QBRSection[];
  generatedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface QBRSection {
  name: QBRSectionType;
  included: boolean;
  content?: string;
  data?: any;
}

export type QBRSectionType =
  | 'executive_summary'
  | 'usage_metrics'
  | 'health_score_analysis'
  | 'goals_progress'
  | 'key_achievements'
  | 'challenges_addressed'
  | 'support_summary'
  | 'product_roadmap_alignment'
  | 'success_stories'
  | 'recommendations'
  | 'next_quarter_goals'
  | 'appendix';

export interface QBRGenerateRequest {
  customerId: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  year: number;
  format: 'document' | 'presentation' | 'both';
  includeSections: QBRSectionType[];
  customData?: Record<string, any>;
}

// ============================================
// Renewal Management Types
// ============================================

export interface RenewalPlaybook {
  id: string;
  customerId: string;
  customerName: string;
  renewalDate: Date;
  status: 'not_started' | 'in_progress' | 'completed' | 'at_risk';
  stages: RenewalStage[];
  probability: number; // 0-100
  riskFactors: string[];
  positiveIndicators: string[];
  recommendedActions: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RenewalStage {
  name: string;
  daysBeforeRenewal: number;
  status: 'pending' | 'completed' | 'skipped';
  completedAt?: Date;
  actions: RenewalAction[];
}

export interface RenewalAction {
  id: string;
  type: 'email' | 'meeting' | 'call' | 'task' | 'escalation';
  description: string;
  status: 'pending' | 'completed' | 'skipped';
  dueDate?: Date;
  completedAt?: Date;
  notes?: string;
}

export interface RenewalReminder {
  id: string;
  customerId: string;
  renewalDate: Date;
  reminderDays: number[]; // [90, 60, 30, 14, 7]
  actions: ('email' | 'task' | 'meeting' | 'escalation')[];
  createdAt: Date;
  nextReminderDate?: Date;
}

// ============================================
// Onboarding Types
// ============================================

export interface OnboardingPlan {
  id: string;
  customerId: string;
  customerName: string;
  product: string;
  tier: string;
  startDate: Date;
  targetCompletionDate: Date;
  status: 'not_started' | 'in_progress' | 'completed' | 'at_risk';
  milestones: OnboardingMilestone[];
  stakeholders: OnboardingStakeholder[];
  successMetrics: SuccessMetric[];
  resources: OnboardingResource[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OnboardingMilestone {
  id: string;
  name: string;
  description: string;
  targetDate: Date;
  completedDate?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  tasks: OnboardingTask[];
  dependencies?: string[];
}

export interface OnboardingTask {
  id: string;
  name: string;
  owner: 'customer' | 'csm' | 'implementation' | 'support';
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: Date;
}

export interface OnboardingStakeholder {
  name: string;
  email: string;
  role: string;
  responsibilities: string[];
  communicationPreference?: 'email' | 'slack' | 'phone';
}

export interface SuccessMetric {
  name: string;
  target: number;
  current: number;
  unit: string;
  status: 'on_track' | 'at_risk' | 'achieved' | 'not_started';
}

export interface OnboardingResource {
  name: string;
  type: 'document' | 'video' | 'training' | 'link';
  url: string;
  description?: string;
}

// ============================================
// Apps Script Automation Types
// ============================================

export interface AppsScript {
  id: string;
  name: string;
  description: string;
  code: string;
  status: 'draft' | 'deployed' | 'active' | 'paused' | 'error';
  triggers: ScriptTrigger[];
  lastRun?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScriptTrigger {
  id: string;
  type: TriggerType;
  functionName: string;
  config: TriggerConfig;
  enabled: boolean;
  lastTriggered?: Date;
}

export type TriggerType =
  | 'time_driven'
  | 'spreadsheet_on_edit'
  | 'spreadsheet_on_change'
  | 'spreadsheet_on_form_submit'
  | 'document_on_open'
  | 'calendar_on_event_updated'
  | 'form_on_submit';

export interface TriggerConfig {
  // Time-driven
  frequency?: 'everyMinutes' | 'everyHours' | 'everyDays' | 'everyWeeks' | 'everyMonths';
  interval?: number;
  atHour?: number;
  dayOfWeek?: number;

  // Event-driven
  spreadsheetId?: string;
  documentId?: string;
  calendarId?: string;
  formId?: string;
}

export interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  category: 'health_monitoring' | 'renewal_tracking' | 'meeting_processing' | 'email_monitoring' | 'data_sync' | 'qbr_generation';
  code: string;
  requiredParams: string[];
}

// ============================================
// Knowledge Base Types (Enhanced)
// ============================================

export interface CustomerKnowledge {
  customerId: string;
  customerName: string;
  contacts: CustomerContact[];
  health: HealthScore;
  contract: ContractInfo;
  interactions: CustomerInteraction[];
  actionItems: ActionItem[];
  risks: RiskEntry[];
  opportunities: OpportunityEntry[];
  successMetrics: SuccessMetric[];
  timeline: TimelineEntry[];
  insights: CustomerInsight;
}

export interface CustomerContact {
  id: string;
  name: string;
  email: string;
  role: string;
  title?: string;
  influenceLevel: 'champion' | 'decision_maker' | 'influencer' | 'user' | 'blocker';
  communicationPreference?: 'email' | 'phone' | 'slack' | 'in_person';
  lastContact?: Date;
  notes?: string;
}

export interface ContractInfo {
  id: string;
  startDate: Date;
  renewalDate: Date;
  value: number;
  products: string[];
  usageLimits?: Record<string, number>;
  overageRate?: number;
  paymentStatus: 'current' | 'late' | 'at_risk';
}

export interface CustomerInteraction {
  id: string;
  type: 'meeting' | 'email' | 'call' | 'ticket' | 'note';
  date: Date;
  summary: string;
  participants: string[];
  actionItems: ActionItem[];
  decisions: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  source?: string;
}

export interface RiskEntry {
  id: string;
  type: 'churn' | 'downgrade' | 'competitor' | 'champion_loss' | 'technical' | 'relationship';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  identifiedDate: Date;
  mitigationPlan?: string;
  status: 'open' | 'mitigating' | 'resolved' | 'escalated';
}

export interface OpportunityEntry {
  id: string;
  type: 'expansion' | 'upsell' | 'cross_sell' | 'referral' | 'case_study';
  potentialValue?: number;
  probability: number;
  description: string;
  nextSteps?: string;
  status: 'identified' | 'qualifying' | 'pursuing' | 'won' | 'lost';
}

export interface TimelineEntry {
  id: string;
  date: Date;
  type: KnowledgeEntryType;
  title: string;
  description: string;
  source?: string;
  relatedIds?: string[];
}

export type KnowledgeEntryType =
  | 'meeting_notes'
  | 'action_item'
  | 'decision'
  | 'insight'
  | 'risk_signal'
  | 'opportunity'
  | 'feature_request'
  | 'escalation'
  | 'milestone'
  | 'communication'
  | 'health_change'
  | 'contract_event';

export interface CustomerInsight {
  relationshipSummary: string;
  keyStakeholders: string[];
  mainUseCases: string[];
  successFactors: string[];
  riskFactors: string[];
  expansionOpportunities: string[];
  communicationPreferences: string;
  lastUpdated: Date;
}

// ============================================
// Agent Actions (Enhanced)
// ============================================

export type WorkspaceAction =
  // Email Actions
  | { type: 'SUMMARIZE_EMAILS'; customerId: string }
  | { type: 'DRAFT_EMAIL'; customerId: string; purpose: EmailPurpose; context?: string; template?: EmailTemplate }
  | { type: 'SEND_EMAIL'; draftId: string }
  | { type: 'SCHEDULE_EMAIL'; draftId: string; sendAt: Date }
  | { type: 'SEARCH_EMAILS'; query: string; customerId?: string }
  | { type: 'REPLY_TO_THREAD'; threadId: string; body: string }
  | { type: 'CREATE_LABEL'; name: string; color?: string }
  | { type: 'APPLY_LABEL'; messageIds: string[]; labelId: string }

  // Calendar Actions
  | { type: 'CHECK_AVAILABILITY'; attendees: string[]; duration: number; workingHoursOnly?: boolean }
  | { type: 'SCHEDULE_MEETING'; proposal: MeetingProposal }
  | { type: 'UPDATE_MEETING'; eventId: string; updates: Partial<CalendarEvent> }
  | { type: 'CANCEL_MEETING'; eventId: string; sendCancellation: boolean }
  | { type: 'CREATE_RECURRING_MEETING'; baseEvent: CalendarEvent; recurrence: RecurrenceRule }
  | { type: 'LIST_MEETINGS'; customerId?: string; timeRange: { start: Date; end: Date } }

  // Document Actions
  | { type: 'CREATE_DOCUMENT'; request: DocCreateRequest }
  | { type: 'EDIT_DOCUMENT'; documentId: string; operations: DocEditOperation[] }
  | { type: 'CREATE_FROM_TEMPLATE'; templateId: string; variables: Record<string, string>; folderId?: string }
  | { type: 'FIND_DOCUMENTS'; customerId: string; query?: string; category?: DocumentCategory }
  | { type: 'SHARE_DOCUMENT'; documentId: string; email: string; role: 'reader' | 'commenter' | 'writer' }

  // Spreadsheet Actions
  | { type: 'CREATE_SPREADSHEET'; request: SheetCreateRequest }
  | { type: 'UPDATE_SPREADSHEET'; spreadsheetId: string; range: string; values: any[][] }
  | { type: 'APPEND_TO_SHEET'; spreadsheetId: string; sheetName: string; values: any[][] }
  | { type: 'READ_SPREADSHEET'; spreadsheetId: string; range?: string }

  // Presentation Actions
  | { type: 'CREATE_PRESENTATION'; request: SlidesCreateRequest }
  | { type: 'EDIT_PRESENTATION'; presentationId: string; operations: SlideEditOperation[] }

  // Meeting Intelligence Actions
  | { type: 'GET_MEETING_TRANSCRIPT'; meetingId: string; platform: MeetingPlatform }
  | { type: 'SUMMARIZE_MEETING'; transcript: string; format: MeetingSummary['format']; customerId?: string }
  | { type: 'EXTRACT_ACTION_ITEMS'; transcript: string }
  | { type: 'LIST_RECENT_MEETINGS'; platform?: MeetingPlatform; days?: number; customerId?: string }
  | { type: 'DEPLOY_MEETING_BOT'; meetingUrl: string; capabilities: MeetingBotCapability[] }

  // Health Score Actions
  | { type: 'CALCULATE_HEALTH_SCORE'; customerId: string; signals?: Partial<HealthSignals> }
  | { type: 'GET_HEALTH_TREND'; customerId: string; days?: number }
  | { type: 'SET_HEALTH_ALERT'; customerId: string; threshold: number }

  // QBR Actions
  | { type: 'GENERATE_QBR'; request: QBRGenerateRequest }
  | { type: 'PREPARE_QBR'; customerId: string }

  // Renewal Actions
  | { type: 'CREATE_RENEWAL_PLAYBOOK'; customerId: string; renewalDate: Date }
  | { type: 'CHECK_RENEWAL_HEALTH'; customerId: string }
  | { type: 'DRAFT_RENEWAL'; customerId: string }
  | { type: 'SET_RENEWAL_REMINDERS'; customerId: string; renewalDate: Date; reminderDays: number[] }

  // Onboarding Actions
  | { type: 'CREATE_ONBOARDING_PLAN'; customerId: string; product: string; tier: string; startDate: Date }
  | { type: 'UPDATE_ONBOARDING_STATUS'; planId: string; milestoneId: string; status: OnboardingMilestone['status'] }

  // Knowledge Base Actions
  | { type: 'SAVE_TO_KNOWLEDGE_BASE'; customerId: string; entryType: KnowledgeEntryType; title: string; content: string; tags?: string[] }
  | { type: 'SEARCH_KNOWLEDGE_BASE'; query: string; customerId?: string; entryTypes?: KnowledgeEntryType[] }
  | { type: 'GET_CUSTOMER_TIMELINE'; customerId: string; limit?: number }
  | { type: 'GET_CUSTOMER_INSIGHTS'; customerId: string }

  // Automation Actions
  | { type: 'CREATE_AUTOMATION'; script: AppsScript }
  | { type: 'EXECUTE_AUTOMATION'; scriptId: string; functionName: string; params?: any[] }
  | { type: 'CREATE_TRIGGER'; scriptId: string; trigger: Omit<ScriptTrigger, 'id'> }

  // Voice Actions
  | { type: 'TRANSCRIBE_AUDIO'; request: TranscriptionRequest }
  | { type: 'SYNTHESIZE_SPEECH'; request: SpeechSynthesisRequest };

export interface DocEditOperation {
  type: 'insert' | 'replace' | 'delete' | 'add_comment';
  location?: 'start' | 'end' | 'cursor';
  search?: string;
  text?: string;
  comment?: string;
}

export interface SlideEditOperation {
  type: 'add_slide' | 'delete_slide' | 'update_text' | 'add_image' | 'reorder';
  slideIndex?: number;
  config?: SlideConfig;
  imageUrl?: string;
  newIndex?: number;
}

export interface ActionResult {
  success: boolean;
  action: WorkspaceAction;
  data?: any;
  error?: string;
  requiresApproval?: boolean;
  approvalId?: string;
  executionTime?: number;
}

// ============================================
// Agent Memory & Learning
// ============================================

export interface WorkspacePreference {
  id: string;
  type: 'email_tone' | 'meeting_time' | 'communication_style' | 'follow_up_frequency' | 'document_format' | 'approval_threshold';
  value: string;
  learnedFrom: 'user_feedback' | 'behavior_analysis' | 'explicit_setting';
  confidence: number;
  createdAt: Date;
  usageCount: number;
}

export interface AgentMemory {
  customerId?: string;
  preferences: WorkspacePreference[];
  recentActions: AgentAction[];
  learnedPatterns: LearnedPattern[];
  sessionContext: SessionContext;
}

export interface AgentAction {
  id: string;
  action: string;
  context: string;
  timestamp: Date;
  outcome: 'success' | 'modified' | 'rejected';
  feedback?: string;
}

export interface LearnedPattern {
  id: string;
  pattern: string;
  description: string;
  confidence: number;
  examples: string[];
}

export interface SessionContext {
  activeCustomerId?: string;
  activeCustomerName?: string;
  pendingApprovals: PendingApproval[];
  recentDocuments: string[];
  recentMeetings: string[];
  conversationHistory: ConversationEntry[];
}

export interface PendingApproval {
  id: string;
  actionType: string;
  description: string;
  parameters: Record<string, any>;
  createdAt: Date;
  expiresAt?: Date;
}

export interface ConversationEntry {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actionsTaken?: string[];
}

// ============================================
// CSM Quick Actions (Enhanced)
// ============================================

export interface QuickAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: QuickActionCategory;
  action: WorkspaceAction;
  requiresApproval: boolean;
  estimatedTime?: string;
  tags?: string[];
}

export type QuickActionCategory =
  | 'email'
  | 'calendar'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'meeting_intelligence'
  | 'health_score'
  | 'qbr'
  | 'renewal'
  | 'onboarding'
  | 'automation'
  | 'knowledge'
  | 'analysis';

export const CSM_QUICK_ACTIONS: QuickAction[] = [
  // ===== EMAIL ACTIONS =====
  {
    id: 'summarize_emails',
    name: 'Summarize Emails',
    description: 'AI summary of recent customer emails with sentiment',
    icon: '📧',
    category: 'email',
    action: { type: 'SUMMARIZE_EMAILS', customerId: '' },
    requiresApproval: false,
    tags: ['read', 'analysis'],
  },
  {
    id: 'draft_checkin',
    name: 'Draft Check-in',
    description: 'Create personalized check-in email',
    icon: '✉️',
    category: 'email',
    action: { type: 'DRAFT_EMAIL', customerId: '', purpose: 'check_in' },
    requiresApproval: true,
    tags: ['communication', 'engagement'],
  },
  {
    id: 'draft_followup',
    name: 'Draft Follow-up',
    description: 'Create follow-up from last meeting',
    icon: '📝',
    category: 'email',
    action: { type: 'DRAFT_EMAIL', customerId: '', purpose: 'follow_up' },
    requiresApproval: true,
    tags: ['communication', 'meeting'],
  },
  {
    id: 'draft_renewal',
    name: 'Draft Renewal Email',
    description: 'Create renewal discussion email',
    icon: '🔄',
    category: 'email',
    action: { type: 'DRAFT_RENEWAL', customerId: '' },
    requiresApproval: true,
    tags: ['renewal', 'communication'],
  },
  {
    id: 'draft_escalation',
    name: 'Draft Escalation',
    description: 'Create escalation response email',
    icon: '🚨',
    category: 'email',
    action: { type: 'DRAFT_EMAIL', customerId: '', purpose: 'escalation' },
    requiresApproval: true,
    tags: ['escalation', 'urgent'],
  },

  // ===== CALENDAR ACTIONS =====
  {
    id: 'find_availability',
    name: 'Find Meeting Times',
    description: 'Check calendar availability for stakeholders',
    icon: '📅',
    category: 'calendar',
    action: { type: 'CHECK_AVAILABILITY', attendees: [], duration: 30 },
    requiresApproval: false,
    tags: ['scheduling', 'calendar'],
  },
  {
    id: 'schedule_qbr',
    name: 'Schedule QBR',
    description: 'Find time and schedule quarterly review',
    icon: '🗓️',
    category: 'calendar',
    action: { type: 'SCHEDULE_MEETING', proposal: {} as MeetingProposal },
    requiresApproval: true,
    tags: ['qbr', 'scheduling'],
  },
  {
    id: 'schedule_checkin',
    name: 'Schedule Check-in',
    description: 'Book a regular check-in meeting',
    icon: '📆',
    category: 'calendar',
    action: { type: 'SCHEDULE_MEETING', proposal: {} as MeetingProposal },
    requiresApproval: true,
    tags: ['engagement', 'scheduling'],
  },

  // ===== DOCUMENT ACTIONS =====
  {
    id: 'find_docs',
    name: 'Find Customer Docs',
    description: 'Search Drive for customer-related files',
    icon: '📁',
    category: 'document',
    action: { type: 'FIND_DOCUMENTS', customerId: '' },
    requiresApproval: false,
    tags: ['search', 'documents'],
  },
  {
    id: 'create_meeting_notes',
    name: 'Create Meeting Notes',
    description: 'Create meeting notes document from template',
    icon: '📋',
    category: 'document',
    action: { type: 'CREATE_DOCUMENT', request: { title: '', template: 'meeting_notes' } },
    requiresApproval: false,
    tags: ['meeting', 'notes'],
  },
  {
    id: 'create_success_plan',
    name: 'Create Success Plan',
    description: 'Generate customer success plan document',
    icon: '🎯',
    category: 'document',
    action: { type: 'CREATE_DOCUMENT', request: { title: '', template: 'success_plan' } },
    requiresApproval: true,
    tags: ['planning', 'success'],
  },

  // ===== MEETING INTELLIGENCE ACTIONS =====
  {
    id: 'get_transcript',
    name: 'Get Meeting Transcript',
    description: 'Retrieve transcript from recent meeting',
    icon: '🎙️',
    category: 'meeting_intelligence',
    action: { type: 'LIST_RECENT_MEETINGS', days: 7 },
    requiresApproval: false,
    tags: ['meeting', 'transcript'],
  },
  {
    id: 'summarize_meeting',
    name: 'Summarize Meeting',
    description: 'Generate AI summary from meeting transcript',
    icon: '📊',
    category: 'meeting_intelligence',
    action: { type: 'SUMMARIZE_MEETING', transcript: '', format: 'detailed' },
    requiresApproval: false,
    tags: ['meeting', 'summary', 'analysis'],
  },
  {
    id: 'extract_actions',
    name: 'Extract Action Items',
    description: 'Pull action items from meeting transcript',
    icon: '✅',
    category: 'meeting_intelligence',
    action: { type: 'EXTRACT_ACTION_ITEMS', transcript: '' },
    requiresApproval: false,
    tags: ['meeting', 'actions'],
  },

  // ===== HEALTH SCORE ACTIONS =====
  {
    id: 'calculate_health',
    name: 'Calculate Health Score',
    description: 'Compute current customer health score',
    icon: '💚',
    category: 'health_score',
    action: { type: 'CALCULATE_HEALTH_SCORE', customerId: '' },
    requiresApproval: false,
    tags: ['health', 'analysis'],
  },
  {
    id: 'health_trend',
    name: 'View Health Trend',
    description: 'See health score trend over time',
    icon: '📈',
    category: 'health_score',
    action: { type: 'GET_HEALTH_TREND', customerId: '', days: 90 },
    requiresApproval: false,
    tags: ['health', 'trend'],
  },

  // ===== QBR ACTIONS =====
  {
    id: 'prepare_qbr',
    name: 'Prepare QBR Materials',
    description: 'Generate QBR deck with usage data',
    icon: '📊',
    category: 'qbr',
    action: { type: 'PREPARE_QBR', customerId: '' },
    requiresApproval: true,
    tags: ['qbr', 'presentation'],
  },
  {
    id: 'generate_qbr_full',
    name: 'Generate Full QBR',
    description: 'Create complete QBR document and slides',
    icon: '🎯',
    category: 'qbr',
    action: { type: 'GENERATE_QBR', request: {} as QBRGenerateRequest },
    requiresApproval: true,
    tags: ['qbr', 'document', 'presentation'],
  },

  // ===== RENEWAL ACTIONS =====
  {
    id: 'renewal_health_check',
    name: 'Renewal Health Check',
    description: 'Assess renewal readiness and risks',
    icon: '🔍',
    category: 'renewal',
    action: { type: 'CHECK_RENEWAL_HEALTH', customerId: '' },
    requiresApproval: false,
    tags: ['renewal', 'health'],
  },
  {
    id: 'create_renewal_playbook',
    name: 'Create Renewal Playbook',
    description: 'Set up renewal workflow and reminders',
    icon: '📖',
    category: 'renewal',
    action: { type: 'CREATE_RENEWAL_PLAYBOOK', customerId: '', renewalDate: new Date() },
    requiresApproval: true,
    tags: ['renewal', 'automation'],
  },

  // ===== KNOWLEDGE BASE ACTIONS =====
  {
    id: 'search_knowledge',
    name: 'Search Knowledge',
    description: 'Search customer knowledge base',
    icon: '🔎',
    category: 'knowledge',
    action: { type: 'SEARCH_KNOWLEDGE_BASE', query: '' },
    requiresApproval: false,
    tags: ['search', 'knowledge'],
  },
  {
    id: 'get_insights',
    name: 'Get Customer Insights',
    description: 'AI-generated customer analysis',
    icon: '💡',
    category: 'knowledge',
    action: { type: 'GET_CUSTOMER_INSIGHTS', customerId: '' },
    requiresApproval: false,
    tags: ['insights', 'analysis'],
  },
  {
    id: 'view_timeline',
    name: 'View Timeline',
    description: 'See customer interaction history',
    icon: '📜',
    category: 'knowledge',
    action: { type: 'GET_CUSTOMER_TIMELINE', customerId: '' },
    requiresApproval: false,
    tags: ['timeline', 'history'],
  },
];

// ============================================
// Context for Agent
// ============================================

export interface WorkspaceContext {
  customerId: string;
  customerName: string;
  stakeholders: EmailParticipant[];
  recentEmails: EmailThread[];
  upcomingMeetings: CalendarEvent[];
  relevantDocs: DriveDocument[];
  healthScore: number;
  healthGrade: HealthScore['grade'];
  healthTrend: HealthScore['trend'];
  renewalDate?: Date;
  daysToRenewal?: number;
  lastContactDate?: Date;
  daysSinceContact?: number;
  openActionItems: ActionItem[];
  activeRisks: RiskEntry[];
  opportunities: OpportunityEntry[];
  recentMeetingSummaries: MeetingSummary[];
}

// ============================================
// Workflow Execution Types
// ============================================

export interface WorkflowExecution {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  steps: WorkflowStep[];
  currentStep: number;
  context: Record<string, any>;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  action: WorkspaceAction;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'awaiting_approval';
  result?: ActionResult;
  startedAt?: Date;
  completedAt?: Date;
}

export type WorkflowTemplate =
  | 'meeting_follow_up'
  | 'qbr_preparation'
  | 'risk_intervention'
  | 'renewal_automation'
  | 'onboarding_sequence'
  | 'health_check'
  | 'escalation_response';

export interface WorkflowDefinition {
  id: WorkflowTemplate;
  name: string;
  description: string;
  steps: Omit<WorkflowStep, 'id' | 'status' | 'result' | 'startedAt' | 'completedAt'>[];
  triggers?: WorkflowTrigger[];
}

export interface WorkflowTrigger {
  type: 'health_score_drop' | 'renewal_approaching' | 'meeting_completed' | 'email_received' | 'manual';
  condition?: Record<string, any>;
}
