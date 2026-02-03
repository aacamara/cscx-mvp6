/**
 * Data Quality Types
 * PRD-133: Data Quality Issue -> Cleanup
 *
 * Provides types for data quality monitoring, issue detection,
 * guided cleanup, and automated enrichment.
 */

// ============================================
// Issue Types
// ============================================

export type IssueType = 'missing' | 'invalid' | 'stale' | 'duplicate' | 'inconsistent';
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IssueStatus = 'open' | 'fixed' | 'ignored' | 'escalated';

// Field categories for classification
export type FieldCategory =
  | 'contact_info'
  | 'contract'
  | 'usage'
  | 'billing'
  | 'stakeholder'
  | 'general';

// ============================================
// Data Quality Issue
// ============================================

export interface DataQualityIssue {
  id: string;
  customer_id: string;
  customer_name: string;
  issue_type: IssueType;
  severity: IssueSeverity;
  field: string;
  field_category: FieldCategory;
  table: string;
  current_value: unknown;
  suggested_value: unknown;
  source: string;
  detected_at: string;
  status: IssueStatus;
  fixed_at: string | null;
  fixed_by: string | null;
  impact: string[];
  auto_fixable: boolean;
  fix_requires_approval: boolean;
}

// ============================================
// Data Quality Score
// ============================================

export interface DataQualityScore {
  customer_id: string;
  customer_name: string;
  overall_score: number;
  field_scores: Record<string, number>;
  open_issues: number;
  critical_issues: number;
  high_issues: number;
  medium_issues: number;
  low_issues: number;
  calculated_at: string;
  trend: 'improving' | 'stable' | 'declining';
  score_change: number;
}

// ============================================
// Portfolio Quality Overview
// ============================================

export interface QualityBucket {
  count: number;
  pct: number;
}

export interface PortfolioQualityOverview {
  total_customers: number;
  avg_quality_score: number;
  score_change_wow: number;
  excellent: QualityBucket;  // 90-100
  good: QualityBucket;       // 70-89
  needs_attention: QualityBucket;  // 50-69
  poor: QualityBucket;       // 0-49
  issue_breakdown: {
    total_issues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  type_breakdown: Record<IssueType, number>;
  field_breakdown: Record<FieldCategory, number>;
  resolution_stats: {
    fixed_this_week: number;
    avg_resolution_time_hours: number;
    auto_fixed: number;
  };
}

// ============================================
// Issue List Response
// ============================================

export interface IssueListFilters {
  status?: IssueStatus | 'all';
  severity?: IssueSeverity | 'all';
  issue_type?: IssueType | 'all';
  field_category?: FieldCategory | 'all';
  customer_id?: string;
  search?: string;
  sort_by?: 'severity' | 'detected_at' | 'customer' | 'field';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface IssueListResponse {
  issues: DataQualityIssue[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  summary: {
    total: number;
    by_severity: Record<IssueSeverity, number>;
    by_type: Record<IssueType, number>;
    by_status: Record<IssueStatus, number>;
  };
}

// ============================================
// Customer Quality Detail
// ============================================

export interface CustomerQualityDetail {
  customer: {
    id: string;
    name: string;
    arr: number;
    industry: string | null;
    status: string;
  };
  quality_score: DataQualityScore;
  issues: DataQualityIssue[];
  history: Array<{
    date: string;
    score: number;
    open_issues: number;
  }>;
  recommended_actions: Array<{
    priority: number;
    action: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
  }>;
}

// ============================================
// Fix Issue Request/Response
// ============================================

export interface FixIssueRequest {
  new_value?: unknown;
  fix_method: 'manual' | 'suggested' | 'auto';
  notes?: string;
}

export interface FixIssueResponse {
  success: boolean;
  issue: DataQualityIssue;
  message: string;
  undo_available: boolean;
  undo_token?: string;
}

// ============================================
// Bulk Operations
// ============================================

export interface BulkFixRequest {
  issue_ids: string[];
  fix_method: 'suggested' | 'auto';
  notes?: string;
}

export interface BulkFixResponse {
  success: boolean;
  fixed_count: number;
  failed_count: number;
  results: Array<{
    issue_id: string;
    success: boolean;
    message: string;
  }>;
}

export interface BulkIgnoreRequest {
  issue_ids: string[];
  reason: string;
}

// ============================================
// Scan Request/Response
// ============================================

export interface ScanRequest {
  customer_ids?: string[];
  fields?: string[];
  force?: boolean;
}

export interface ScanResponse {
  success: boolean;
  scan_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  customers_scanned: number;
  new_issues_found: number;
  issues_resolved: number;
  duration_ms: number;
}

// ============================================
// Validation Rules
// ============================================

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  field: string;
  field_category: FieldCategory;
  rule_type: 'required' | 'format' | 'range' | 'freshness' | 'consistency' | 'uniqueness';
  severity: IssueSeverity;
  enabled: boolean;
  config: Record<string, unknown>;
}

// ============================================
// Source Reconciliation
// ============================================

export interface ReconciliationResult {
  field: string;
  cscx_value: unknown;
  external_value: unknown;
  source: string;
  match: boolean;
  authoritative_source: 'cscx' | 'external' | 'manual_review';
  suggested_action: 'keep_cscx' | 'use_external' | 'merge' | 'review';
}

export interface ReconciliationReport {
  customer_id: string;
  customer_name: string;
  source: string;
  total_fields: number;
  matched_fields: number;
  mismatched_fields: number;
  results: ReconciliationResult[];
  generated_at: string;
}

// ============================================
// Reporting
// ============================================

export interface QualityTrend {
  date: string;
  avg_score: number;
  total_issues: number;
  critical_issues: number;
  fixed_issues: number;
}

export interface QualityReport {
  overview: PortfolioQualityOverview;
  trends: QualityTrend[];
  top_issues: DataQualityIssue[];
  customers_needing_attention: DataQualityScore[];
  automation_impact: {
    auto_fixes_this_month: number;
    time_saved_hours: number;
    accuracy_rate: number;
  };
}

// ============================================
// API Response Types
// ============================================

export interface DataQualityResponse {
  overview: PortfolioQualityOverview;
  customers: DataQualityScore[];
  trends: QualityTrend[];
  top_issues: DataQualityIssue[];
}

// ============================================
// Thresholds
// ============================================

export const QUALITY_THRESHOLDS = {
  excellent: { min: 90, max: 100 },
  good: { min: 70, max: 89 },
  needs_attention: { min: 50, max: 69 },
  poor: { min: 0, max: 49 }
};

export type QualityCategory = 'excellent' | 'good' | 'needs_attention' | 'poor';

// ============================================
// Severity Weights for Scoring
// ============================================

export const SEVERITY_WEIGHTS = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3
};

// ============================================
// Issue Type Labels
// ============================================

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  missing: 'Missing Data',
  invalid: 'Invalid Format',
  stale: 'Stale Data',
  duplicate: 'Duplicate Record',
  inconsistent: 'Inconsistent Data'
};

export const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

export const FIELD_CATEGORY_LABELS: Record<FieldCategory, string> = {
  contact_info: 'Contact Information',
  contract: 'Contract Details',
  usage: 'Usage Data',
  billing: 'Billing Information',
  stakeholder: 'Stakeholder Data',
  general: 'General Information'
};
