/**
 * Event Engagement Types
 * PRD-018: Event Attendance Upload and Engagement Scoring
 *
 * Types for event attendance tracking, engagement scoring,
 * advocacy candidate detection, and event recommendations.
 */

// ============================================
// Event Types
// ============================================

export type EventType = 'webinar' | 'user_group' | 'training' | 'conference' | 'workshop' | 'meetup' | 'other';

export type AttendanceStatus = 'attended' | 'registered' | 'no_show' | 'cancelled';

export type EngagementLevel = 'high' | 'good' | 'medium' | 'low';

export type EngagementTrendDirection = 'rising' | 'stable' | 'declining';

export type ParticipationDepth = 'passive' | 'active' | 'engaged' | 'contributor';

// ============================================
// Event Attendance Records
// ============================================

/**
 * Individual event attendance record
 */
export interface EventAttendanceRecord {
  id: string;
  event_id: string;
  event_name: string;
  event_type: EventType;
  event_date: string;
  customer_id: string;
  customer_name: string;
  user_id?: string;
  user_email: string;
  user_name: string;
  attendance_status: AttendanceStatus;
  registration_date?: string;
  check_in_time?: string;
  check_out_time?: string;
  duration_minutes?: number;
  participation_score?: number;
  asked_questions?: boolean;
  submitted_feedback?: boolean;
  notes?: string;
  source_platform?: string;
  created_at: string;
}

/**
 * Event definition
 */
export interface EventDefinition {
  id: string;
  name: string;
  type: EventType;
  date: string;
  duration_minutes?: number;
  description?: string;
  host?: string;
  capacity?: number;
  registered_count?: number;
  attended_count?: number;
  topics?: string[];
  recording_url?: string;
}

// ============================================
// Engagement Scoring
// ============================================

/**
 * Engagement score components with weights
 */
export interface EngagementScoreComponents {
  event_frequency: number;      // 30% - Number of events attended
  event_recency: number;        // 25% - Days since last event
  event_diversity: number;      // 20% - Variety of event types
  participation_depth: number;  // 15% - Q&A, feedback submitted
  consistency: number;          // 10% - Regular attendance pattern
}

/**
 * Customer event engagement score
 */
export interface CustomerEventEngagement {
  customer_id: string;
  customer_name: string;
  engagement_score: number;
  engagement_level: EngagementLevel;
  trend: EngagementTrendDirection;
  score_components: EngagementScoreComponents;
  total_events_available: number;
  events_attended: number;
  attendance_rate: number;
  unique_users_attending: number;
  last_event_date: string | null;
  days_since_last_event: number;
  event_type_breakdown: Record<EventType, number>;
  notable_participation?: string[];
  calculated_at: string;
}

/**
 * User-level event engagement
 */
export interface UserEventEngagement {
  user_id: string;
  user_email: string;
  user_name: string;
  customer_id: string;
  customer_name: string;
  events_attended: number;
  event_types: EventType[];
  last_event_date: string | null;
  participation_score: number;
  is_active_participant: boolean;
}

// ============================================
// Analysis Results
// ============================================

/**
 * Event attendance upload result
 */
export interface AttendanceUploadResult {
  success: boolean;
  file_id: string;
  total_records: number;
  unique_users: number;
  unique_customers: number;
  unique_events: number;
  event_type_counts: Record<EventType, number>;
  date_range: {
    start: string;
    end: string;
  };
  unmapped_customers: number;
  errors: string[];
  warnings: string[];
}

/**
 * Event summary statistics
 */
export interface EventSummary {
  event_type: EventType;
  event_count: number;
  total_attendees: number;
  avg_attendance: number;
  unique_customers: number;
}

/**
 * Engagement analysis result
 */
export interface EngagementAnalysisResult {
  summary: {
    total_records: number;
    unique_users: number;
    unique_customers: number;
    total_events: number;
    date_range: { start: string; end: string };
  };
  event_summary: EventSummary[];
  engagement_distribution: {
    high: { count: number; percent: number };
    good: { count: number; percent: number };
    medium: { count: number; percent: number };
    low: { count: number; percent: number };
  };
  leaderboard: CustomerEventEngagement[];
  advocacy_candidates: AdvocacyCandidate[];
  declining_engagement: DecliningEngagementAlert[];
  recommendations: EventInvitationRecommendation[];
}

// ============================================
// Advocacy & Risk Detection
// ============================================

export type AdvocacyType = 'case_study' | 'reference' | 'advisory_board' | 'speaking' | 'beta_tester';

/**
 * Advocacy candidate from high engagement
 */
export interface AdvocacyCandidate {
  customer_id: string;
  customer_name: string;
  engagement_score: number;
  events_attended: number;
  total_events: number;
  notable_participation: string[];
  recommended_advocacy_types: AdvocacyType[];
  champion_contact?: {
    name: string;
    email: string;
    role?: string;
  };
  arr?: number;
  health_score?: number;
  reason: string;
}

/**
 * Declining engagement alert
 */
export interface DecliningEngagementAlert {
  customer_id: string;
  customer_name: string;
  current_score: number;
  previous_score: number;
  score_change: number;
  current_period_events: number;
  previous_period_events: number;
  events_missed: number;
  last_event_date: string | null;
  days_since_last_event: number;
  risk_level: 'warning' | 'critical';
  suggested_action: string;
  champion_contact?: {
    name: string;
    email: string;
  };
}

// ============================================
// Event Recommendations
// ============================================

/**
 * Event invitation recommendation
 */
export interface EventInvitationRecommendation {
  event: {
    id: string;
    name: string;
    type: EventType;
    date: string;
    description?: string;
  };
  recommended_customers: CustomerInviteRecommendation[];
}

/**
 * Individual customer invite recommendation
 */
export interface CustomerInviteRecommendation {
  customer_id: string;
  customer_name: string;
  reason: string;
  relevance_score: number;
  contact: {
    name: string;
    email: string;
    role?: string;
  };
  previous_attendance: {
    similar_events: number;
    total_events: number;
  };
}

// ============================================
// Advocacy Opportunities
// ============================================

/**
 * Created advocacy opportunity
 */
export interface AdvocacyOpportunity {
  id: string;
  customer_id: string;
  customer_name: string;
  engagement_score: number;
  advocacy_type: AdvocacyType;
  champion: {
    name: string;
    email: string;
    role?: string;
  };
  notes: string;
  arr?: number;
  status: 'created' | 'contacted' | 'in_progress' | 'completed' | 'declined';
  next_action: string;
  created_at: string;
}

/**
 * Event invitation record
 */
export interface EventInvitation {
  id: string;
  event_id: string;
  event_name: string;
  event_date: string;
  customer_id: string;
  customer_name: string;
  contact_email: string;
  contact_name: string;
  status: 'pending' | 'sent' | 'opened' | 'registered' | 'declined';
  sent_at?: string;
  email_subject?: string;
  email_body_preview?: string;
}

// ============================================
// Upload & Parsing
// ============================================

/**
 * Column mapping for attendance CSV
 */
export interface AttendanceColumnMapping {
  customer_name?: string;
  customer_id?: string;
  user_email?: string;
  user_name?: string;
  event_name?: string;
  event_type?: string;
  event_date?: string;
  attendance_status?: string;
  registration_date?: string;
  duration_minutes?: string;
  asked_questions?: string;
  submitted_feedback?: string;
}

/**
 * Field pattern suggestions
 */
export interface AttendanceFieldSuggestion {
  column: string;
  suggestedField: keyof AttendanceColumnMapping;
  confidence: number;
}

// ============================================
// API Request/Response Types
// ============================================

export interface UploadAttendanceRequest {
  file: File;
  columnMapping?: AttendanceColumnMapping;
}

export interface GetEngagementRequest {
  customerId?: string;
  period?: 'month' | 'quarter' | 'year' | 'all';
  includeUserLevel?: boolean;
}

export interface CreateAdvocacyRequest {
  customerIds: string[];
  advocacyTypes?: AdvocacyType[];
}

export interface SendInvitationsRequest {
  eventId: string;
  customerIds: string[];
  customSubject?: string;
  customBody?: string;
}

export interface EngagementResponse {
  success: boolean;
  data: EngagementAnalysisResult;
}

export interface AdvocacyResponse {
  success: boolean;
  opportunities: AdvocacyOpportunity[];
  count: number;
}

export interface InvitationResponse {
  success: boolean;
  invitations: EventInvitation[];
  sent_count: number;
  failed_count: number;
  errors?: string[];
}
