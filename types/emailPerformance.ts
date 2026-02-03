/**
 * Email Performance Report Types (PRD-167)
 * Tracks email outreach effectiveness, response rates, and engagement patterns
 */

// ============================================
// Enums
// ============================================

export type EmailType =
  | 'check_in'
  | 'qbr_invite'
  | 'renewal'
  | 'onboarding'
  | 'follow_up'
  | 'product_update'
  | 'escalation'
  | 'other';

export type EmailDirection = 'sent' | 'received';

export type PerformanceCategory = 'excellent' | 'good' | 'fair' | 'poor';

export type ResponseStatus = 'responded' | 'no_response' | 'pending';

// ============================================
// Email Record Types
// ============================================

export interface EmailRecord {
  id: string;
  thread_id: string;
  customer_id: string;
  csm_id: string;

  direction: EmailDirection;
  sender: string;
  recipients: string[];

  subject: string;
  email_type: EmailType;

  sent_at: string;
  day_of_week: number; // 0-6, Sunday = 0
  hour_of_day: number; // 0-23

  // Response tracking
  responded: boolean;
  response_time_hours?: number;
  response_status: ResponseStatus;
}

// ============================================
// Email Metrics Types
// ============================================

export interface EmailVolumeMetrics {
  sent: number;
  received: number;
  threads: number;
}

export interface EmailResponseMetrics {
  rate: number; // 0-1 (percentage as decimal)
  avg_response_hours: number;
  median_response_hours: number;
  unanswered: number;
  pending: number;
}

export interface EmailTypePerformance {
  type: EmailType;
  sent: number;
  received: number;
  response_rate: number;
  avg_response_hours: number;
}

export interface EmailTimingAnalysis {
  best_day: string;
  best_day_rate: number;
  best_hour: number;
  best_hour_rate: number;
  worst_day: string;
  worst_day_rate: number;
  by_day: {
    day: string;
    day_index: number;
    sent: number;
    response_rate: number;
  }[];
  by_hour: {
    hour: number;
    sent: number;
    response_rate: number;
  }[];
}

export interface CustomerEmailMetrics {
  customer_id: string;
  customer_name: string;
  period: string;

  volume: EmailVolumeMetrics;
  response: EmailResponseMetrics;
  by_type: EmailTypePerformance[];
  timing: EmailTimingAnalysis;
}

// ============================================
// Unresponsive Contact Types
// ============================================

export interface UnresponsiveContact {
  contact_email: string;
  contact_name: string;
  customer_id: string;
  customer_name: string;
  emails_sent: number;
  last_email_date: string;
  days_since_last_email: number;
  total_unanswered: number;
}

// ============================================
// Contact Engagement Types
// ============================================

export interface ContactEngagement {
  email: string;
  name: string;
  role?: string;
  emails_sent: number;
  emails_received: number;
  response_rate: number;
  avg_response_hours: number;
  last_contact_date: string;
  engagement_level: 'high' | 'medium' | 'low' | 'unresponsive';
}

// ============================================
// Email Thread Types
// ============================================

export interface EmailThread {
  thread_id: string;
  subject: string;
  email_type: EmailType;
  message_count: number;
  started_at: string;
  last_message_at: string;
  initiator: 'csm' | 'customer';
  status: 'active' | 'closed' | 'awaiting_reply';
  participants: string[];
  response_time_hours?: number;
}

// ============================================
// Portfolio Summary Types
// ============================================

export interface EmailPerformanceSummary {
  period: string;
  total_sent: number;
  total_received: number;
  total_threads: number;
  overall_response_rate: number;
  avg_response_hours: number;
  change_vs_last_period: {
    sent: number;
    response_rate: number;
    avg_response_hours: number;
  };
  performance_category: PerformanceCategory;
  unresponsive_count: number;
}

export interface CustomerEmailStats {
  customer_id: string;
  customer_name: string;
  arr?: number;
  segment?: string;
  health_score?: number;
  emails_sent: number;
  emails_received: number;
  response_rate: number;
  avg_response_hours: number;
  unresponsive_contacts: number;
  last_email_date: string;
  days_since_contact: number;
  performance_category: PerformanceCategory;
}

// ============================================
// API Response Types
// ============================================

export interface EmailPerformanceReportResponse {
  summary: EmailPerformanceSummary;
  by_customer: CustomerEmailStats[];
  by_type: EmailTypePerformance[];
  timing_analysis: EmailTimingAnalysis;
  unresponsive: UnresponsiveContact[];
}

export interface CustomerEmailDetailResponse {
  metrics: CustomerEmailMetrics;
  recent_threads: EmailThread[];
  contacts: ContactEngagement[];
  trends: EmailTrendPoint[];
}

// ============================================
// Trend Types
// ============================================

export interface EmailTrendPoint {
  period: string;
  sent: number;
  received: number;
  response_rate: number;
  avg_response_hours: number;
}

// ============================================
// Benchmark Types
// ============================================

export interface EmailBenchmarks {
  response_rate: {
    excellent: number; // >= this value
    good: number;
    fair: number;
    // below fair is poor
  };
  response_time_hours: {
    excellent: number; // <= this value
    good: number;
    fair: number;
  };
  email_cadence_per_month: {
    enterprise: { min: number; max: number };
    mid_market: { min: number; max: number };
    smb: { min: number; max: number };
  };
}

// ============================================
// Email Type Best Practices
// ============================================

export interface EmailTypeBestPractice {
  type: EmailType;
  display_name: string;
  best_day: string;
  best_time: string;
  expected_response_rate: { min: number; max: number };
  tips: string[];
}

// ============================================
// Filter/Query Types
// ============================================

export interface EmailPerformanceFilters {
  csm_id?: string;
  customer_id?: string;
  period?: 'week' | 'month' | 'quarter' | 'year';
  email_type?: EmailType;
  start_date?: string;
  end_date?: string;
  min_response_rate?: number;
  max_response_rate?: number;
}
