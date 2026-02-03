/**
 * PRD-114: Customer Milestone Alert Types
 * Type definitions for customer milestones tracking and celebration
 */

// ============================================
// Enums and Constants
// ============================================

export type MilestoneType = 'time' | 'usage' | 'adoption' | 'business' | 'custom';

export type CelebrationType =
  | 'email'
  | 'social'
  | 'gift'
  | 'case_study'
  | 'internal_only'
  | 'phone_call'
  | 'meeting';

export type MilestoneOperator = '>=' | '>' | '=' | '<' | '<=';

// ============================================
// Milestone Definition Types
// ============================================

/**
 * Condition for triggering a milestone
 */
export interface MilestoneCondition {
  metric: string;
  operator: MilestoneOperator;
  threshold: number;
}

/**
 * Celebration suggestion for a milestone
 */
export interface CelebrationSuggestion {
  action: string;
  description?: string;
  priority?: number;
}

/**
 * Milestone definition - configures what milestones to track
 */
export interface MilestoneDefinition {
  id: string;
  type: MilestoneType;
  name: string;
  description?: string;
  condition: MilestoneCondition;
  celebration_template?: string;
  celebration_suggestions: string[];
  enabled: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

/**
 * Request to create/update a milestone definition
 */
export interface MilestoneDefinitionInput {
  type: MilestoneType;
  name: string;
  description?: string;
  condition: MilestoneCondition;
  celebration_template?: string;
  celebration_suggestions?: string[];
  enabled?: boolean;
  priority?: number;
}

// ============================================
// Customer Milestone Types
// ============================================

/**
 * A milestone achieved by a customer
 */
export interface CustomerMilestone {
  id: string;
  customer_id: string;
  customer_name?: string;
  definition_id?: string;
  milestone_type: MilestoneType;
  milestone_name: string;
  milestone_value?: string;
  threshold_value?: string;
  time_to_milestone?: number; // Days from customer start
  achieved_at: string;
  celebrated: boolean;
  celebrated_at?: string;
  celebration_type?: CelebrationType;
  celebration_notes?: string;
  csm_notified: boolean;
  csm_notified_at?: string;
  metadata?: MilestoneMetadata;
  created_at: string;
}

/**
 * Additional context about a milestone
 */
export interface MilestoneMetadata {
  customer_arr?: number;
  customer_health_score?: number;
  customer_since?: string;
  celebration_ideas?: string[];
  related_milestones?: string[];
  [key: string]: unknown;
}

/**
 * Request to record a celebration
 */
export interface CelebrateMilestoneInput {
  milestone_id: string;
  celebration_type: CelebrationType;
  notes?: string;
}

// ============================================
// Milestone Alert Types
// ============================================

/**
 * Milestone alert for CSM notification
 */
export interface MilestoneAlert {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_arr?: number;
  customer_health_score?: number;
  customer_since?: string;
  milestone_type: MilestoneType;
  milestone_name: string;
  milestone_value: string;
  achieved_at: string;
  time_to_milestone_days?: number;
  celebration_suggestions: string[];
  celebrated: boolean;
  priority: 'low' | 'medium' | 'high';
}

/**
 * Summary of pending milestone alerts
 */
export interface MilestoneAlertSummary {
  total_uncelebrated: number;
  by_type: Record<MilestoneType, number>;
  high_priority_count: number;
  recent_milestones: MilestoneAlert[];
}

// ============================================
// API Response Types
// ============================================

/**
 * Response for listing milestones
 */
export interface MilestonesListResponse {
  milestones: CustomerMilestone[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  summary: {
    total_milestones: number;
    celebrated_count: number;
    pending_celebration_count: number;
  };
}

/**
 * Response for milestone definitions
 */
export interface MilestoneDefinitionsResponse {
  definitions: MilestoneDefinition[];
  total: number;
}

/**
 * Customer context for milestone alerts
 */
export interface MilestoneCustomerContext {
  id: string;
  name: string;
  arr: number;
  health_score: number;
  customer_since: string;
  days_as_customer: number;
  stage: string;
  csm_id?: string;
  csm_name?: string;
  recent_milestones: CustomerMilestone[];
  upcoming_milestones?: MilestoneDefinition[];
}

// ============================================
// Milestone Check Types
// ============================================

/**
 * Result of checking a customer for milestones
 */
export interface MilestoneCheckResult {
  customer_id: string;
  checked_at: string;
  new_milestones: CustomerMilestone[];
  metrics_snapshot: Record<string, number>;
}

/**
 * Usage metric for milestone tracking
 */
export interface CustomerUsageMetric {
  id: string;
  customer_id: string;
  metric_name: string;
  metric_value: number;
  metric_unit?: string;
  period_start?: string;
  period_end?: string;
  recorded_at: string;
}

// ============================================
// Hook/Component Types
// ============================================

/**
 * Filters for milestone queries
 */
export interface MilestoneFilters {
  customer_id?: string;
  type?: MilestoneType;
  celebrated?: boolean;
  start_date?: string;
  end_date?: string;
  search?: string;
  sort_by?: 'achieved_at' | 'milestone_name' | 'customer_name' | 'type';
  sort_order?: 'asc' | 'desc';
}

/**
 * Hook return type for useMilestones
 */
export interface UseMilestonesReturn {
  // Data
  milestones: CustomerMilestone[];
  alerts: MilestoneAlert[];
  definitions: MilestoneDefinition[];
  loading: boolean;
  error: string | null;

  // Filters
  filters: MilestoneFilters;
  setFilters: React.Dispatch<React.SetStateAction<MilestoneFilters>>;

  // Actions
  fetchMilestones: () => Promise<void>;
  celebrateMilestone: (input: CelebrateMilestoneInput) => Promise<boolean>;
  dismissMilestone: (milestoneId: string) => Promise<boolean>;
  checkMilestones: (customerId: string) => Promise<MilestoneCheckResult | null>;
  refetch: () => Promise<void>;

  // Selected milestone
  selectedMilestone: CustomerMilestone | null;
  setSelectedMilestone: (milestone: CustomerMilestone | null) => void;

  // Summary
  summary: MilestoneAlertSummary | null;
}

// ============================================
// Slack Alert Format
// ============================================

/**
 * Milestone alert formatted for Slack
 */
export interface MilestoneSlackAlert {
  customer_name: string;
  milestone_name: string;
  milestone_value: string;
  achieved_at: string;
  time_to_milestone: string;
  customer_context: {
    customer_since: string;
    arr: string;
    health_score: string;
    health_emoji: string;
  };
  celebration_ideas: string[];
  action_buttons: Array<{
    text: string;
    action: string;
  }>;
}
