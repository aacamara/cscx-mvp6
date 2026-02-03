/**
 * Post-Call Processing Types
 * PRD-116: Type definitions for automated post-call analysis
 */

// ============================================
// Core Types
// ============================================

export interface ActionItem {
  description: string;
  owner: string;
  ownerType: 'internal' | 'customer';
  dueDate: string | null;
  priority: 'high' | 'medium' | 'low';
}

export interface Commitment {
  description: string;
  party: 'us' | 'customer';
  deadline?: string;
}

export interface RiskSignal {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface ExpansionSignal {
  type: string;
  description: string;
  potentialValue?: number;
}

export interface EmailDraft {
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
}

export type Sentiment = 'positive' | 'neutral' | 'negative' | 'mixed';

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'partial';

export type TriggerSource = 'zoom_webhook' | 'otter_webhook' | 'calendar' | 'manual';

export type TranscriptSource = 'zoom' | 'otter' | 'google_meet' | 'manual';

// ============================================
// Post-Call Processing Result
// ============================================

export interface PostCallProcessingResult {
  id: string;
  meetingId: string;
  customerId?: string;
  userId: string;

  // Transcript
  transcriptId?: string;
  transcriptSource?: TranscriptSource;
  transcriptText?: string;

  // Meeting info
  meetingTitle?: string;
  meetingDate?: Date;
  durationMinutes?: number;
  participants: Array<{ name: string; email?: string; role?: string }>;

  // Analysis results
  summary?: string;
  actionItems: ActionItem[];
  commitments: Commitment[];
  riskSignals: RiskSignal[];
  expansionSignals: ExpansionSignal[];
  competitorMentions: string[];
  sentiment?: Sentiment;
  sentimentScore?: number;

  // Follow-up email
  followUpEmailDraft?: EmailDraft;
  followUpEmailApprovalId?: string;

  // Created tasks
  tasksCreated: string[];

  // CRM sync
  crmUpdated: boolean;
  crmActivityId?: string;
  crmSyncError?: string;

  // Status
  status: ProcessingStatus;
  processingError?: string;
  retryCount: number;

  // Timestamps
  triggeredAt: Date;
  processingStartedAt?: Date;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Processing Queue Item
// ============================================

export interface ProcessingQueueItem {
  id: string;
  processingResultId?: string;
  userId: string;
  customerId?: string;

  triggerSource: TriggerSource;
  triggerData?: Record<string, unknown>;

  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number;

  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  nextAttemptAt?: Date;
  lastError?: string;

  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// ============================================
// Webhook Payloads
// ============================================

export interface ZoomMeetingEndedWebhook {
  event: 'meeting.ended';
  payload: {
    account_id: string;
    object: {
      id: string;
      uuid: string;
      host_id: string;
      topic: string;
      type: number;
      start_time: string;
      end_time: string;
      duration: number;
      timezone: string;
      participant_count?: number;
    };
  };
  event_ts: number;
}

export interface ZoomTranscriptCompletedWebhook {
  event: 'recording.transcript_completed';
  payload: {
    account_id: string;
    object: {
      id: string;
      uuid: string;
      meeting_id: string;
      host_id: string;
      topic: string;
      transcript_files: Array<{
        id: string;
        status: string;
        file_type: string;
        download_url: string;
      }>;
    };
  };
  event_ts: number;
}

export interface OtterTranscriptWebhook {
  event: 'transcript_ready' | 'meeting_started' | 'meeting_ended';
  meeting_id: string;
  title: string;
  participants?: string[];
  duration_minutes?: number;
  transcript?: string;
  summary?: string;
  action_items?: string[];
  start_time?: string;
  end_time?: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface TriggerPostCallRequest {
  meetingId: string;
  customerId?: string;
  transcriptText?: string;
  transcriptUrl?: string;
  meetingTitle?: string;
  meetingDate?: string;
  durationMinutes?: number;
  participants?: Array<{ name: string; email?: string; role?: string }>;
  source?: TranscriptSource;
}

export interface PostCallStatusResponse {
  id: string;
  status: ProcessingStatus;
  progress?: {
    step: string;
    percentage: number;
  };
  result?: Partial<PostCallProcessingResult>;
  error?: string;
}

// ============================================
// Analysis Input/Output
// ============================================

export interface TranscriptAnalysisInput {
  transcript: string;
  meetingTitle: string;
  customerName?: string;
  participants?: string[];
  meetingType?: string;
}

export interface TranscriptAnalysisOutput {
  summary: string;
  actionItems: ActionItem[];
  commitments: Commitment[];
  riskSignals: RiskSignal[];
  expansionSignals: ExpansionSignal[];
  competitorMentions: string[];
  sentiment: Sentiment;
  sentimentScore: number;
  keyTopics: string[];
  nextSteps: string[];
}

// ============================================
// Notification Types
// ============================================

export interface PostCallNotification {
  type: 'post_call_complete';
  userId: string;
  customerId?: string;
  customerName?: string;
  meetingTitle: string;
  summary: string;
  actionItemCount: number;
  riskSignalCount: number;
  sentiment: Sentiment;
  resultId: string;
  quickActions: Array<{
    label: string;
    action: string;
    url?: string;
  }>;
}

// ============================================
// Task Creation Types
// ============================================

export interface PostCallTask {
  title: string;
  description: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  assignee?: string;
  customerId?: string;
  linkedMeetingId?: string;
  source: 'post_call_processing';
}
