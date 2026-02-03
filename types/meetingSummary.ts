/**
 * Meeting Summary Types (PRD-213)
 *
 * AI-powered meeting summarization for CSCX.AI
 * Supports Zoom, Otter.ai, and manual transcript uploads
 */

// ============================================
// Core Meeting Summary Types
// ============================================

export type TranscriptSource = 'zoom' | 'otter' | 'manual';

export type OwnerType = 'customer' | 'csm' | 'internal' | string;

export type SentimentType = 'positive' | 'neutral' | 'negative' | 'mixed';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ActionItemStatus = 'pending_review' | 'approved' | 'created' | 'completed';

export type ActionItemPriority = 'high' | 'medium' | 'low';

// ============================================
// Action Items
// ============================================

export interface ActionItem {
  id: string;
  description: string;
  suggestedOwner: OwnerType;
  suggestedDueDate: string | null;
  priority: ActionItemPriority;
  status: ActionItemStatus;
  taskId?: string; // If converted to a task
  createdAt?: string;
}

// ============================================
// Commitments
// ============================================

export interface Commitment {
  id: string;
  description: string;
  party: 'us' | 'customer' | 'mutual';
  deadline?: string;
  context?: string;
}

// ============================================
// Risk Signals
// ============================================

export interface RiskSignal {
  id: string;
  type: 'competitor_mention' | 'budget_concern' | 'champion_departure' |
        'dissatisfaction' | 'timeline_pressure' | 'stakeholder_alignment' | 'other';
  severity: RiskLevel;
  description: string;
  quote?: string; // Direct quote from transcript
  detectedAt?: string;
}

// ============================================
// Expansion Signals
// ============================================

export interface ExpansionSignal {
  id: string;
  type: 'new_features' | 'more_licenses' | 'new_teams' | 'new_use_cases' | 'other';
  description: string;
  potentialValue?: number;
  confidence: number; // 0-100
  quote?: string;
}

// ============================================
// Meeting Attendee
// ============================================

export interface MeetingAttendee {
  name: string;
  email?: string;
  role?: string;
  company?: string;
  isInternal?: boolean;
}

// ============================================
// Meeting Metadata
// ============================================

export interface MeetingMetadata {
  title: string;
  meetingDate: string;
  durationMinutes?: number;
  attendees: MeetingAttendee[];
  meetingType?: 'qbr' | 'check_in' | 'kickoff' | 'training' | 'escalation' | 'renewal' | 'other';
  calendarEventId?: string;
  recordingUrl?: string;
  transcriptUrl?: string;
}

// ============================================
// Meeting Summary
// ============================================

export interface MeetingSummary {
  id: string;
  meetingId: string;
  customerId: string;
  customerName?: string;

  // Core summary content
  executiveSummary: string;
  keyPoints: string[];
  decisions: string[];

  // Extracted items
  actionItems: ActionItem[];
  commitments: Commitment[];

  // Signals
  riskSignals: RiskSignal[];
  expansionSignals: ExpansionSignal[];
  overallRiskLevel: RiskLevel;

  // Sentiment
  overallSentiment: SentimentType;
  sentimentScore: number; // -100 to 100

  // Recommendations
  followUpRecommendations: string[];

  // Quality indicators
  confidenceScore: number; // 0-100
  transcriptWordCount?: number;

  // Status
  status: 'processing' | 'ready' | 'approved' | 'archived';
  reviewedBy?: string;
  reviewedAt?: string;

  // Integration
  driveDocId?: string;
  driveDocUrl?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface AnalyzeMeetingRequest {
  meetingId?: string; // Optional - will be generated if not provided
  transcriptSource: TranscriptSource;
  transcriptContent: string;
  customerId: string;
  meetingMetadata: MeetingMetadata;
}

export interface AnalyzeMeetingResponse {
  success: boolean;
  meetingId: string;
  status: 'processing' | 'completed' | 'failed';
  summary?: MeetingSummary;
  error?: string;
  processingTimeMs?: number;
}

export interface GetMeetingSummaryResponse {
  success: boolean;
  summary?: MeetingSummary;
  error?: string;
}

export interface ApproveSummaryRequest {
  edits?: {
    executiveSummary?: string;
    keyPoints?: string[];
    decisions?: string[];
    actionItems?: ActionItem[];
    commitments?: Commitment[];
    followUpRecommendations?: string[];
  };
  createTasks?: boolean;
  saveToDrive?: boolean;
  sendEmail?: boolean;
  emailRecipients?: string[];
}

export interface ApproveSummaryResponse {
  success: boolean;
  summary?: MeetingSummary;
  tasksCreated?: number;
  driveDocUrl?: string;
  emailSent?: boolean;
  error?: string;
}

// ============================================
// Webhook Payloads
// ============================================

export interface ZoomWebhookPayload {
  event: 'recording.completed' | 'meeting.ended';
  payload: {
    object: {
      id: string;
      uuid: string;
      topic: string;
      host_email: string;
      duration: number;
      start_time: string;
      recording_files?: Array<{
        file_type: string;
        download_url: string;
        recording_type: string;
      }>;
    };
  };
}

export interface OtterWebhookPayload {
  event: 'transcript_ready';
  meetingId: string;
  title: string;
  participants: string[];
  durationMinutes: number;
  transcript: string;
  startTime: string;
  endTime: string;
}

// ============================================
// Processing Status
// ============================================

export interface ProcessingStatus {
  meetingId: string;
  status: 'queued' | 'processing' | 'analyzing' | 'saving' | 'completed' | 'failed';
  progress: number; // 0-100
  stage?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  estimatedTimeRemaining?: number; // seconds
}

// ============================================
// UI State Types
// ============================================

export interface MeetingSummaryEdits {
  executiveSummary?: string;
  keyPoints?: string[];
  decisions?: string[];
  actionItems?: ActionItem[];
  commitments?: Commitment[];
  followUpRecommendations?: string[];
}

export interface MeetingSummaryReviewState {
  summary: MeetingSummary | null;
  edits: MeetingSummaryEdits;
  selectedActionItems: string[]; // IDs of action items to create as tasks
  isEditing: boolean;
  isSaving: boolean;
  isApproving: boolean;
}

// ============================================
// Export Helper Types
// ============================================

export interface MeetingSummaryExport {
  format: 'pdf' | 'docx' | 'markdown' | 'json';
  includeTranscript?: boolean;
  includeRawAnalysis?: boolean;
}

// ============================================
// Search/Filter Types
// ============================================

export interface MeetingSummaryFilters {
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  sentiment?: SentimentType;
  riskLevel?: RiskLevel;
  hasUnresolvedActions?: boolean;
  status?: MeetingSummary['status'];
}

export interface MeetingSummarySearchResult {
  summaries: MeetingSummary[];
  total: number;
  page: number;
  pageSize: number;
}
