/**
 * Gong Service Types (PRD-193)
 *
 * Server-side type definitions for Gong API integration.
 */

// ============================================================================
// Gong API Response Types
// ============================================================================

export interface GongApiCall {
  id: string;
  metaData: {
    title: string;
    scheduled: string;
    started: string;
    duration: number;
    primaryUserId: string;
    direction: 'Inbound' | 'Outbound' | 'Conference';
    scope: string;
    workspaceId: string;
    url: string;
  };
  parties: GongApiParty[];
  content?: {
    structure?: {
      callHighlights?: string;
      callOutcome?: string;
      trackers?: GongApiTracker[];
    };
    pointsOfInterest?: GongApiPointOfInterest[];
  };
  collaboration?: {
    publicComments?: GongApiComment[];
  };
}

export interface GongApiParty {
  id: string;
  emailAddress?: string;
  name?: string;
  title?: string;
  userId?: string;
  speakerId?: string;
  affiliation?: 'Internal' | 'External' | 'Unknown';
  methods?: string[];
  context?: {
    system?: string;
    objects?: Array<{
      objectType: string;
      objectId: string;
      fields?: Array<{ name: string; value: string }>;
    }>;
  };
}

export interface GongApiTracker {
  id: string;
  name: string;
  count: number;
  occurrences: Array<{
    startTime: number;
    speakerId: string;
    phrases?: string[];
  }>;
}

export interface GongApiPointOfInterest {
  id: string;
  type: string;
  startTime: number;
  speakerId?: string;
  snippet?: string;
}

export interface GongApiComment {
  id: string;
  commentorUserId: string;
  commented: string;
  comment: string;
  inReplyTo?: string;
}

export interface GongApiTranscript {
  callId: string;
  transcript: Array<{
    speakerId: string;
    topic?: string;
    sentences: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  }>;
}

// ============================================================================
// Gong API List Responses
// ============================================================================

export interface GongApiCallsListResponse {
  requestId: string;
  records: {
    totalRecords: number;
    currentPageSize: number;
    currentPageNumber: number;
    cursor?: string;
  };
  calls: GongApiCall[];
}

export interface GongApiTranscriptResponse {
  requestId: string;
  callTranscripts: GongApiTranscript[];
}

export interface GongApiUsersResponse {
  requestId: string;
  records: {
    totalRecords: number;
    currentPageSize: number;
    currentPageNumber: number;
  };
  users: Array<{
    id: string;
    emailAddress: string;
    firstName: string;
    lastName: string;
    title?: string;
    active: boolean;
    settings?: {
      timezone?: string;
    };
  }>;
}

// ============================================================================
// Service Internal Types
// ============================================================================

export interface GongCallSyncOptions {
  fromDateTime?: string;
  toDateTime?: string;
  workspaceId?: string;
  cursor?: string;
  limit?: number;
}

export interface GongCallExtensiveOptions {
  callId: string;
  includeTranscript?: boolean;
  includeTrackers?: boolean;
  includeComments?: boolean;
  includePointsOfInterest?: boolean;
}

export interface GongCustomerMatchConfig {
  emailDomainWeight: number;
  companyNameWeight: number;
  crmIdWeight: number;
  minConfidenceThreshold: number;
}

export interface GongSyncResult {
  callsSynced: number;
  transcriptsSynced: number;
  insightsExtracted: number;
  riskSignalsCreated: number;
  customersMatched: number;
  errors: string[];
  duration: number;
}

// ============================================================================
// Risk Detection Types
// ============================================================================

export interface RiskSignalConfig {
  type: string;
  keywords: string[];
  sentimentThreshold?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export const RISK_SIGNAL_CONFIGS: RiskSignalConfig[] = [
  {
    type: 'competitor_evaluation',
    keywords: ['competitor', 'alternative', 'looking at', 'evaluating', 'comparing'],
    severity: 'high',
    description: 'Customer mentioned evaluating competitors',
  },
  {
    type: 'budget_concerns',
    keywords: ['budget', 'cost', 'expensive', 'pricing', 'discount', 'reduce spend'],
    severity: 'medium',
    description: 'Customer expressed budget or pricing concerns',
  },
  {
    type: 'contract_concerns',
    keywords: ['contract', 'renewal', 'cancel', 'downgrade', 'terms'],
    severity: 'high',
    description: 'Customer raised contract or renewal concerns',
  },
  {
    type: 'frustration',
    keywords: ['frustrated', 'disappointed', 'unhappy', 'not working', 'broken', 'issue'],
    sentimentThreshold: -30,
    severity: 'medium',
    description: 'Customer expressed frustration or disappointment',
  },
  {
    type: 'support_escalation',
    keywords: ['escalate', 'manager', 'supervisor', 'executive', 'leadership'],
    severity: 'high',
    description: 'Customer requested escalation or executive involvement',
  },
  {
    type: 'champion_departure',
    keywords: ['leaving', 'new role', 'transition', 'handover', 'replacement'],
    severity: 'critical',
    description: 'Key stakeholder may be leaving the account',
  },
];

// ============================================================================
// Sentiment Analysis Types
// ============================================================================

export interface SentimentAnalysisResult {
  score: number; // -100 to 100
  label: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  confidence: number;
  segments: Array<{
    speaker: string;
    text: string;
    score: number;
    startTime: number;
  }>;
}

export function getSentimentLabel(score: number): 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative' {
  if (score >= 50) return 'very_positive';
  if (score >= 20) return 'positive';
  if (score >= -20) return 'neutral';
  if (score >= -50) return 'negative';
  return 'very_negative';
}

// ============================================================================
// Database Schema Types
// ============================================================================

export interface GongCallRow {
  id: string;
  gong_call_id: string;
  customer_id?: string;
  meeting_id?: string;
  title: string;
  duration_seconds: number;
  participants: GongApiParty[];
  gong_url: string;
  summary?: string;
  sentiment_score?: number;
  sentiment_label?: string;
  call_date: string;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface GongInsightRow {
  id: string;
  gong_call_id: string;
  insight_type: string;
  content: string;
  timestamp_seconds: number;
  speaker?: string;
  confidence?: number;
  created_at: string;
}

export interface GongTranscriptRow {
  id: string;
  gong_call_id: string;
  transcript_text: string;
  speakers: object;
  word_count: number;
  created_at: string;
}

export interface GongRiskSignalRow {
  id: string;
  customer_id: string;
  call_id: string;
  signal_type: string;
  severity: string;
  description: string;
  evidence: string;
  call_date: string;
  acknowledged: boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
  created_at: string;
}

export interface GongConnectionRow {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  workspace_id?: string;
  workspace_name?: string;
  scopes: string[];
  connected_at: string;
  updated_at: string;
}
