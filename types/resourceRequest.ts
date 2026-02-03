/**
 * Technical Resource Request Types
 * PRD-245: Type definitions for resource requests, matching, and scheduling
 */

// ============================================
// Engagement Types
// ============================================

export type EngagementType =
  | 'implementation'
  | 'training'
  | 'technical_review'
  | 'architecture_session'
  | 'troubleshooting'
  | 'integration'
  | 'migration'
  | 'optimization'
  | 'security_review'
  | 'other';

export const ENGAGEMENT_TYPE_LABELS: Record<EngagementType, string> = {
  implementation: 'Implementation',
  training: 'Training',
  technical_review: 'Technical Review',
  architecture_session: 'Architecture Session',
  troubleshooting: 'Troubleshooting',
  integration: 'Integration',
  migration: 'Migration',
  optimization: 'Optimization',
  security_review: 'Security Review',
  other: 'Other'
};

// ============================================
// Status Types
// ============================================

export type RequestStatus =
  | 'pending'
  | 'matching'
  | 'assigned'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'declined';

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Pending',
  matching: 'Finding Resources',
  assigned: 'Assigned',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  declined: 'Declined'
};

export type UrgencyLevel = 'low' | 'normal' | 'high' | 'critical';

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  critical: 'Critical'
};

export const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  low: 'text-gray-500',
  normal: 'text-blue-500',
  high: 'text-orange-500',
  critical: 'text-red-500'
};

export type FlexibilityType = 'exact_dates' | 'flexible_week' | 'flexible_month' | 'asap';

// ============================================
// Resource Types
// ============================================

export type ResourceType =
  | 'solutions_architect'
  | 'solutions_engineer'
  | 'technical_account_manager'
  | 'implementation_specialist'
  | 'support_engineer'
  | 'trainer'
  | 'consultant';

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  solutions_architect: 'Solutions Architect',
  solutions_engineer: 'Solutions Engineer',
  technical_account_manager: 'Technical Account Manager',
  implementation_specialist: 'Implementation Specialist',
  support_engineer: 'Support Engineer',
  trainer: 'Trainer',
  consultant: 'Consultant'
};

// ============================================
// Skill Types
// ============================================

export type SkillCategory = 'technical' | 'product' | 'industry' | 'certification' | 'soft_skill';

export interface ResourceSkill {
  id: string;
  name: string;
  category: SkillCategory;
  description?: string;
  is_active: boolean;
}

export interface UserSkill {
  user_id: string;
  skill_id: string;
  skill_name?: string;
  skill_category?: SkillCategory;
  proficiency_level: number; // 1-5
  verified: boolean;
  verified_by_user_id?: string;
  verified_at?: string;
  years_experience?: number;
  notes?: string;
}

// ============================================
// Resource Pool
// ============================================

export interface ResourcePoolMember {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  resource_type: ResourceType;
  max_weekly_hours: number;
  target_utilization: number;
  timezone: string;
  working_hours: {
    start: string;
    end: string;
    days: number[];
  };
  specializations: string[];
  bio?: string;
  is_available_for_requests: boolean;
  skills: UserSkill[];
  current_utilization?: number;
}

// ============================================
// Resource Request
// ============================================

export interface ResourceRequest {
  id: string;
  customer_id: string;
  customer_name?: string;
  requested_by_user_id: string;
  requested_by_name?: string;

  // Request details
  engagement_type: EngagementType;
  title: string;
  description?: string;
  customer_context?: string;
  required_skills: string[];
  preferred_skills: string[];

  // Time requirements
  estimated_hours?: number;
  start_date?: string;
  end_date?: string;
  urgency: UrgencyLevel;
  flexibility: FlexibilityType;

  // Assignment
  status: RequestStatus;
  assigned_resource_id?: string;
  assigned_resource_name?: string;
  assigned_by_user_id?: string;
  assigned_at?: string;

  // Scheduling
  scheduled_start?: string;
  scheduled_end?: string;
  calendar_event_ids: string[];
  meeting_links: { title: string; url: string }[];

  // Completion
  actual_hours?: number;
  outcome_summary?: string;
  deliverables: { name: string; url?: string; type: string }[];
  csm_rating?: number;
  csm_feedback?: string;
  resource_rating?: number;
  resource_feedback?: string;
  completed_at?: string;

  // Metadata
  priority_score: number;
  match_metadata?: ResourceMatchMetadata;
  created_at: string;
  updated_at: string;
}

// ============================================
// Resource Matching
// ============================================

export interface ResourceMatchMetadata {
  algorithm_version: string;
  matched_at: string;
  top_matches: ResourceMatchScore[];
}

export interface ResourceMatchScore {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  resource_type: ResourceType;
  match_score: number; // 0-100
  skill_match_score: number;
  availability_score: number;
  workload_score: number;
  experience_score: number;
  details: ResourceMatchDetails;
}

export interface ResourceMatchDetails {
  matched_required_skills: {
    skill_id: string;
    skill_name: string;
    proficiency: number;
    verified: boolean;
  }[];
  matched_preferred_skills: {
    skill_id: string;
    skill_name: string;
    proficiency: number;
    verified: boolean;
  }[];
  missing_required_skills: string[];
  available_hours_in_range: number;
  current_utilization: number;
  similar_customer_experience: number;
  past_engagement_rating?: number;
}

// ============================================
// Availability
// ============================================

export interface ResourceAvailability {
  id: string;
  user_id: string;
  date: string;
  available_hours: number;
  booked_hours: number;
  is_available: boolean;
  notes?: string;
}

export interface AvailabilitySlot {
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
}

// ============================================
// Time Tracking
// ============================================

export type ActivityType =
  | 'preparation'
  | 'meeting'
  | 'implementation'
  | 'documentation'
  | 'review'
  | 'training'
  | 'troubleshooting'
  | 'follow_up'
  | 'other';

export interface ResourceEngagement {
  id: string;
  request_id: string;
  resource_user_id: string;
  date: string;
  hours_logged: number;
  activity_type: ActivityType;
  notes?: string;
  billable: boolean;
  created_at: string;
}

// ============================================
// Request History
// ============================================

export type RequestAction =
  | 'created'
  | 'updated'
  | 'assigned'
  | 'accepted'
  | 'declined'
  | 'scheduled'
  | 'started'
  | 'completed'
  | 'cancelled'
  | 'time_logged';

export interface ResourceRequestHistory {
  id: string;
  request_id: string;
  changed_by_user_id?: string;
  changed_by_name?: string;
  action: RequestAction;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  notes?: string;
  created_at: string;
}

// ============================================
// Resource Manager Dashboard
// ============================================

export interface ResourceManagerQueue {
  pending_requests: ResourceRequest[];
  urgent_requests: ResourceRequest[];
  overdue_requests: ResourceRequest[];
  total_pending: number;
  total_in_progress: number;
}

export interface ResourceUtilization {
  user_id: string;
  full_name: string;
  resource_type: ResourceType;
  current_week_utilization: number;
  current_month_utilization: number;
  target_utilization: number;
  booked_hours_this_week: number;
  available_hours_this_week: number;
  active_engagements: number;
  status: 'under_utilized' | 'optimal' | 'over_utilized';
}

export interface UtilizationDashboard {
  resources: ResourceUtilization[];
  team_avg_utilization: number;
  total_active_engagements: number;
  capacity_alerts: {
    type: 'overloaded' | 'underutilized' | 'upcoming_conflict';
    resource_name: string;
    message: string;
  }[];
}

export interface AssignmentRecommendation {
  request_id: string;
  request_title: string;
  customer_name: string;
  urgency: UrgencyLevel;
  recommended_resources: ResourceMatchScore[];
  recommendation_reason: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateResourceRequestPayload {
  customer_id: string;
  engagement_type: EngagementType;
  title: string;
  description?: string;
  customer_context?: string;
  required_skills?: string[];
  preferred_skills?: string[];
  estimated_hours?: number;
  start_date?: string;
  end_date?: string;
  urgency?: UrgencyLevel;
  flexibility?: FlexibilityType;
}

export interface UpdateResourceRequestPayload {
  title?: string;
  description?: string;
  customer_context?: string;
  required_skills?: string[];
  preferred_skills?: string[];
  estimated_hours?: number;
  start_date?: string;
  end_date?: string;
  urgency?: UrgencyLevel;
  flexibility?: FlexibilityType;
  status?: RequestStatus;
}

export interface AssignResourcePayload {
  resource_user_id: string;
  assigned_by_user_id: string;
  notes?: string;
}

export interface ScheduleEngagementPayload {
  scheduled_start: string;
  scheduled_end: string;
  create_calendar_event?: boolean;
  meeting_link?: string;
}

export interface LogTimePayload {
  date: string;
  hours_logged: number;
  activity_type: ActivityType;
  notes?: string;
  billable?: boolean;
}

export interface CompleteRequestPayload {
  outcome_summary: string;
  deliverables?: { name: string; url?: string; type: string }[];
  csm_rating?: number;
  csm_feedback?: string;
  resource_rating?: number;
  resource_feedback?: string;
}

// ============================================
// Filter Types
// ============================================

export interface ResourceRequestFilters {
  status?: RequestStatus | 'all';
  urgency?: UrgencyLevel | 'all';
  engagement_type?: EngagementType | 'all';
  customer_id?: string;
  assigned_resource_id?: string;
  requested_by_user_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  sort_by?: 'created_at' | 'urgency' | 'start_date' | 'status';
  sort_order?: 'asc' | 'desc';
}

// ============================================
// Hooks Return Types
// ============================================

export interface UseResourceRequestsReturn {
  // Data
  requests: ResourceRequest[];
  loading: boolean;
  error: string | null;

  // Filters
  filters: ResourceRequestFilters;
  setFilters: React.Dispatch<React.SetStateAction<ResourceRequestFilters>>;

  // Actions
  fetchRequests: () => Promise<void>;
  createRequest: (payload: CreateResourceRequestPayload) => Promise<ResourceRequest | null>;
  updateRequest: (id: string, payload: UpdateResourceRequestPayload) => Promise<boolean>;
  cancelRequest: (id: string, reason?: string) => Promise<boolean>;
  refetch: () => Promise<void>;

  // Single request
  selectedRequest: ResourceRequest | null;
  selectRequest: (id: string) => Promise<void>;
  clearSelectedRequest: () => void;

  // Resource matching
  matches: ResourceMatchScore[];
  matchesLoading: boolean;
  fetchMatches: (requestId: string) => Promise<void>;

  // Assignment
  assignResource: (requestId: string, payload: AssignResourcePayload) => Promise<boolean>;
  acceptAssignment: (requestId: string) => Promise<boolean>;
  declineAssignment: (requestId: string, reason?: string) => Promise<boolean>;

  // Scheduling
  scheduleEngagement: (requestId: string, payload: ScheduleEngagementPayload) => Promise<boolean>;

  // Time tracking
  timeEntries: ResourceEngagement[];
  logTime: (requestId: string, payload: LogTimePayload) => Promise<boolean>;
  fetchTimeEntries: (requestId: string) => Promise<void>;

  // Completion
  completeRequest: (requestId: string, payload: CompleteRequestPayload) => Promise<boolean>;

  // History
  history: ResourceRequestHistory[];
  fetchHistory: (requestId: string) => Promise<void>;
}

export interface UseResourceManagerReturn {
  // Queue
  queue: ResourceManagerQueue | null;
  queueLoading: boolean;
  fetchQueue: () => Promise<void>;

  // Utilization
  utilization: UtilizationDashboard | null;
  utilizationLoading: boolean;
  fetchUtilization: () => Promise<void>;

  // Recommendations
  recommendations: AssignmentRecommendation[];
  recommendationsLoading: boolean;
  fetchRecommendations: () => Promise<void>;

  // Bulk actions
  bulkAssign: (assignments: { requestId: string; resourceUserId: string }[]) => Promise<boolean>;
}

export interface UseResourcePoolReturn {
  // Resources
  resources: ResourcePoolMember[];
  loading: boolean;
  error: string | null;
  fetchResources: () => Promise<void>;

  // Skills
  skills: ResourceSkill[];
  skillsLoading: boolean;
  fetchSkills: () => Promise<void>;

  // Availability
  availability: Map<string, ResourceAvailability[]>;
  fetchAvailability: (userId: string, startDate: string, endDate: string) => Promise<void>;
  updateAvailability: (userId: string, date: string, hours: number) => Promise<boolean>;
}
