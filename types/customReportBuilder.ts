/**
 * Custom Report Builder Types
 * PRD-180: Custom Report Builder for CSCX.AI
 *
 * Types for creating, saving, executing, and scheduling custom reports.
 */

// ============================================
// Data Source Types
// ============================================

export type DataSourceType =
  | 'customers'
  | 'renewals'
  | 'health_scores'
  | 'engagements'
  | 'support_tickets'
  | 'revenue'
  | 'activities';

export interface DataSource {
  id: DataSourceType;
  name: string;
  description: string;
  available_fields: FieldDefinition[];
}

export interface FieldDefinition {
  id: string;
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'currency';
  source: DataSourceType;
  aggregatable: boolean;
  filterable: boolean;
  sortable: boolean;
  description?: string;
}

// ============================================
// Filter Types
// ============================================

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'between'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null';

export type FilterLogic = 'AND' | 'OR';

export interface ReportFilter {
  id: string;
  field_id: string;
  field_name: string;
  operator: FilterOperator;
  value: string | number | boolean | string[] | number[] | null;
  value2?: string | number | null; // For 'between' operator
}

export interface FilterGroup {
  logic: FilterLogic;
  filters: ReportFilter[];
}

// ============================================
// Column & Grouping Types
// ============================================

export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'count_distinct';

export interface ReportColumn {
  id: string;
  field_id: string;
  field_name: string;
  field_type: FieldDefinition['type'];
  display_name: string;
  aggregation?: AggregationType;
  format?: string;
  width?: number;
  visible: boolean;
  order: number;
}

export interface ReportGrouping {
  field_id: string;
  field_name: string;
  order: number;
}

export type SortDirection = 'asc' | 'desc';

export interface ReportSorting {
  field_id: string;
  field_name: string;
  direction: SortDirection;
  order: number;
}

// ============================================
// Visualization Types
// ============================================

export type VisualizationType =
  | 'table'
  | 'bar_chart'
  | 'line_chart'
  | 'pie_chart'
  | 'area_chart'
  | 'scatter_plot'
  | 'metric_card';

export interface VisualizationConfig {
  type: VisualizationType;
  title?: string;
  x_axis_field?: string;
  y_axis_field?: string;
  series_field?: string;
  show_legend?: boolean;
  show_data_labels?: boolean;
  colors?: string[];
}

// ============================================
// Report Configuration
// ============================================

export interface ReportConfig {
  data_source: DataSourceType;
  columns: ReportColumn[];
  filters: FilterGroup;
  groupings: ReportGrouping[];
  sortings: ReportSorting[];
  visualization: VisualizationConfig;
  limit?: number;
}

// ============================================
// Schedule Types
// ============================================

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'json';

export interface ReportSchedule {
  enabled: boolean;
  frequency: ScheduleFrequency;
  day_of_week?: number; // 0-6 for weekly
  day_of_month?: number; // 1-31 for monthly
  time: string; // HH:MM format
  timezone: string;
  recipients: string[];
  export_format: ExportFormat;
  last_run?: string;
  next_run?: string;
}

// ============================================
// Sharing & Permissions
// ============================================

export type SharePermission = 'view' | 'edit' | 'admin';

export interface ReportShare {
  user_id: string;
  user_name?: string;
  user_email?: string;
  permission: SharePermission;
  shared_at: string;
}

// ============================================
// Custom Report Entity
// ============================================

export interface CustomReport {
  id: string;
  name: string;
  description?: string;
  config: ReportConfig;
  created_by: string;
  created_by_name?: string;
  is_template: boolean;
  is_public: boolean;
  shared_with: ReportShare[];
  schedule?: ReportSchedule;
  tags?: string[];
  created_at: string;
  updated_at: string;
  last_executed_at?: string;
  execution_count: number;
}

// ============================================
// Report Execution Types
// ============================================

export interface ReportRow {
  [key: string]: string | number | boolean | null;
}

export interface ReportExecutionResult {
  report_id: string;
  report_name: string;
  executed_at: string;
  execution_time_ms: number;
  total_rows: number;
  columns: ReportColumn[];
  rows: ReportRow[];
  groupings?: ReportGrouping[];
  summary?: {
    [key: string]: number; // aggregated values
  };
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateReportRequest {
  name: string;
  description?: string;
  config: ReportConfig;
  is_template?: boolean;
  is_public?: boolean;
  tags?: string[];
}

export interface UpdateReportRequest {
  name?: string;
  description?: string;
  config?: ReportConfig;
  is_template?: boolean;
  is_public?: boolean;
  tags?: string[];
}

export interface ScheduleReportRequest {
  frequency: ScheduleFrequency;
  day_of_week?: number;
  day_of_month?: number;
  time: string;
  timezone: string;
  recipients: string[];
  export_format: ExportFormat;
}

export interface ShareReportRequest {
  user_id: string;
  permission: SharePermission;
}

export interface ListReportsResponse {
  reports: CustomReport[];
  total: number;
  page: number;
  page_size: number;
}

export interface ReportListFilters {
  search?: string;
  created_by?: string;
  is_template?: boolean;
  data_source?: DataSourceType;
  tags?: string[];
  sort_by?: 'name' | 'created_at' | 'updated_at' | 'execution_count';
  sort_order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

// ============================================
// UI State Types
// ============================================

export type BuilderStep = 'source' | 'columns' | 'filters' | 'grouping' | 'visualization' | 'preview';

export interface BuilderState {
  current_step: BuilderStep;
  report: Partial<CustomReport>;
  preview_data: ReportExecutionResult | null;
  is_dirty: boolean;
  is_saving: boolean;
  is_executing: boolean;
  errors: { [key: string]: string };
}

// ============================================
// Data Source Definitions (Constants)
// ============================================

export const DATA_SOURCES: DataSource[] = [
  {
    id: 'customers',
    name: 'Customers',
    description: 'Customer accounts and health scores',
    available_fields: [
      { id: 'name', name: 'Customer Name', type: 'string', source: 'customers', aggregatable: false, filterable: true, sortable: true },
      { id: 'arr', name: 'ARR', type: 'currency', source: 'customers', aggregatable: true, filterable: true, sortable: true },
      { id: 'health_score', name: 'Health Score', type: 'number', source: 'customers', aggregatable: true, filterable: true, sortable: true },
      { id: 'segment', name: 'Segment', type: 'string', source: 'customers', aggregatable: false, filterable: true, sortable: true },
      { id: 'industry', name: 'Industry', type: 'string', source: 'customers', aggregatable: false, filterable: true, sortable: true },
      { id: 'csm_name', name: 'CSM Name', type: 'string', source: 'customers', aggregatable: false, filterable: true, sortable: true },
      { id: 'stage', name: 'Stage', type: 'string', source: 'customers', aggregatable: false, filterable: true, sortable: true },
      { id: 'created_at', name: 'Created Date', type: 'date', source: 'customers', aggregatable: false, filterable: true, sortable: true },
      { id: 'renewal_date', name: 'Renewal Date', type: 'date', source: 'customers', aggregatable: false, filterable: true, sortable: true },
      { id: 'days_since_contact', name: 'Days Since Last Contact', type: 'number', source: 'customers', aggregatable: true, filterable: true, sortable: true },
    ]
  },
  {
    id: 'renewals',
    name: 'Renewals',
    description: 'Renewal pipeline and forecasts',
    available_fields: [
      { id: 'customer_name', name: 'Customer Name', type: 'string', source: 'renewals', aggregatable: false, filterable: true, sortable: true },
      { id: 'renewal_date', name: 'Renewal Date', type: 'date', source: 'renewals', aggregatable: false, filterable: true, sortable: true },
      { id: 'current_arr', name: 'Current ARR', type: 'currency', source: 'renewals', aggregatable: true, filterable: true, sortable: true },
      { id: 'forecasted_arr', name: 'Forecasted ARR', type: 'currency', source: 'renewals', aggregatable: true, filterable: true, sortable: true },
      { id: 'renewal_probability', name: 'Renewal Probability', type: 'number', source: 'renewals', aggregatable: true, filterable: true, sortable: true },
      { id: 'risk_level', name: 'Risk Level', type: 'string', source: 'renewals', aggregatable: false, filterable: true, sortable: true },
      { id: 'days_to_renewal', name: 'Days to Renewal', type: 'number', source: 'renewals', aggregatable: true, filterable: true, sortable: true },
    ]
  },
  {
    id: 'health_scores',
    name: 'Health Scores',
    description: 'Health score history and trends',
    available_fields: [
      { id: 'customer_name', name: 'Customer Name', type: 'string', source: 'health_scores', aggregatable: false, filterable: true, sortable: true },
      { id: 'score', name: 'Health Score', type: 'number', source: 'health_scores', aggregatable: true, filterable: true, sortable: true },
      { id: 'score_date', name: 'Score Date', type: 'date', source: 'health_scores', aggregatable: false, filterable: true, sortable: true },
      { id: 'score_change', name: 'Score Change', type: 'number', source: 'health_scores', aggregatable: true, filterable: true, sortable: true },
      { id: 'risk_category', name: 'Risk Category', type: 'string', source: 'health_scores', aggregatable: false, filterable: true, sortable: true },
      { id: 'primary_risk_factor', name: 'Primary Risk Factor', type: 'string', source: 'health_scores', aggregatable: false, filterable: true, sortable: true },
    ]
  },
  {
    id: 'engagements',
    name: 'Engagements',
    description: 'Customer engagement activities',
    available_fields: [
      { id: 'customer_name', name: 'Customer Name', type: 'string', source: 'engagements', aggregatable: false, filterable: true, sortable: true },
      { id: 'activity_type', name: 'Activity Type', type: 'string', source: 'engagements', aggregatable: false, filterable: true, sortable: true },
      { id: 'activity_date', name: 'Activity Date', type: 'date', source: 'engagements', aggregatable: false, filterable: true, sortable: true },
      { id: 'csm_name', name: 'CSM Name', type: 'string', source: 'engagements', aggregatable: false, filterable: true, sortable: true },
      { id: 'engagement_score', name: 'Engagement Score', type: 'number', source: 'engagements', aggregatable: true, filterable: true, sortable: true },
      { id: 'activity_count', name: 'Activity Count', type: 'number', source: 'engagements', aggregatable: true, filterable: true, sortable: true },
    ]
  },
  {
    id: 'support_tickets',
    name: 'Support Tickets',
    description: 'Support ticket data and metrics',
    available_fields: [
      { id: 'customer_name', name: 'Customer Name', type: 'string', source: 'support_tickets', aggregatable: false, filterable: true, sortable: true },
      { id: 'ticket_id', name: 'Ticket ID', type: 'string', source: 'support_tickets', aggregatable: false, filterable: true, sortable: true },
      { id: 'subject', name: 'Subject', type: 'string', source: 'support_tickets', aggregatable: false, filterable: true, sortable: false },
      { id: 'status', name: 'Status', type: 'string', source: 'support_tickets', aggregatable: false, filterable: true, sortable: true },
      { id: 'priority', name: 'Priority', type: 'string', source: 'support_tickets', aggregatable: false, filterable: true, sortable: true },
      { id: 'created_at', name: 'Created Date', type: 'date', source: 'support_tickets', aggregatable: false, filterable: true, sortable: true },
      { id: 'resolution_time', name: 'Resolution Time (hrs)', type: 'number', source: 'support_tickets', aggregatable: true, filterable: true, sortable: true },
      { id: 'ticket_count', name: 'Ticket Count', type: 'number', source: 'support_tickets', aggregatable: true, filterable: true, sortable: true },
    ]
  },
  {
    id: 'revenue',
    name: 'Revenue',
    description: 'Revenue movements and metrics',
    available_fields: [
      { id: 'customer_name', name: 'Customer Name', type: 'string', source: 'revenue', aggregatable: false, filterable: true, sortable: true },
      { id: 'movement_type', name: 'Movement Type', type: 'string', source: 'revenue', aggregatable: false, filterable: true, sortable: true },
      { id: 'movement_date', name: 'Movement Date', type: 'date', source: 'revenue', aggregatable: false, filterable: true, sortable: true },
      { id: 'previous_arr', name: 'Previous ARR', type: 'currency', source: 'revenue', aggregatable: true, filterable: true, sortable: true },
      { id: 'new_arr', name: 'New ARR', type: 'currency', source: 'revenue', aggregatable: true, filterable: true, sortable: true },
      { id: 'change_amount', name: 'Change Amount', type: 'currency', source: 'revenue', aggregatable: true, filterable: true, sortable: true },
    ]
  },
  {
    id: 'activities',
    name: 'Activities',
    description: 'CSM activities and tasks',
    available_fields: [
      { id: 'csm_name', name: 'CSM Name', type: 'string', source: 'activities', aggregatable: false, filterable: true, sortable: true },
      { id: 'customer_name', name: 'Customer Name', type: 'string', source: 'activities', aggregatable: false, filterable: true, sortable: true },
      { id: 'activity_type', name: 'Activity Type', type: 'string', source: 'activities', aggregatable: false, filterable: true, sortable: true },
      { id: 'activity_date', name: 'Activity Date', type: 'date', source: 'activities', aggregatable: false, filterable: true, sortable: true },
      { id: 'status', name: 'Status', type: 'string', source: 'activities', aggregatable: false, filterable: true, sortable: true },
      { id: 'duration_minutes', name: 'Duration (mins)', type: 'number', source: 'activities', aggregatable: true, filterable: true, sortable: true },
    ]
  }
];

export const FILTER_OPERATORS: { [key: string]: FilterOperator[] } = {
  string: ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'in', 'not_in', 'is_null', 'is_not_null'],
  number: ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal', 'between', 'is_null', 'is_not_null'],
  currency: ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal', 'between', 'is_null', 'is_not_null'],
  date: ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal', 'between', 'is_null', 'is_not_null'],
  boolean: ['equals', 'not_equals', 'is_null', 'is_not_null']
};

export const OPERATOR_LABELS: { [key in FilterOperator]: string } = {
  equals: 'equals',
  not_equals: 'does not equal',
  contains: 'contains',
  not_contains: 'does not contain',
  starts_with: 'starts with',
  ends_with: 'ends with',
  greater_than: 'is greater than',
  less_than: 'is less than',
  greater_than_or_equal: 'is greater than or equal to',
  less_than_or_equal: 'is less than or equal to',
  between: 'is between',
  in: 'is one of',
  not_in: 'is not one of',
  is_null: 'is empty',
  is_not_null: 'is not empty'
};
