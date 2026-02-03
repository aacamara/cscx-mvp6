/**
 * CSCX.AI Custom Report Builder Service
 * PRD-180: Custom Report Builder
 *
 * Business logic for creating, saving, executing, and scheduling custom reports.
 * Supports drag-and-drop report building with multiple data sources, filters,
 * groupings, and visualization options.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Types (Server-side mirrors of client types)
// ============================================

type DataSourceType = 'customers' | 'renewals' | 'health_scores' | 'engagements' | 'support_tickets' | 'revenue' | 'activities';
type FilterOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'greater_than_or_equal' | 'less_than_or_equal' | 'between' | 'in' | 'not_in' | 'is_null' | 'is_not_null';
type FilterLogic = 'AND' | 'OR';
type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'count_distinct';
type VisualizationType = 'table' | 'bar_chart' | 'line_chart' | 'pie_chart' | 'area_chart' | 'scatter_plot' | 'metric_card';
type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';
type ExportFormat = 'csv' | 'excel' | 'pdf' | 'json';
type SharePermission = 'view' | 'edit' | 'admin';

interface ReportFilter {
  id: string;
  field_id: string;
  field_name: string;
  operator: FilterOperator;
  value: string | number | boolean | string[] | number[] | null;
  value2?: string | number | null;
}

interface FilterGroup {
  logic: FilterLogic;
  filters: ReportFilter[];
}

interface ReportColumn {
  id: string;
  field_id: string;
  field_name: string;
  field_type: 'string' | 'number' | 'date' | 'boolean' | 'currency';
  display_name: string;
  aggregation?: AggregationType;
  format?: string;
  width?: number;
  visible: boolean;
  order: number;
}

interface ReportGrouping {
  field_id: string;
  field_name: string;
  order: number;
}

interface ReportSorting {
  field_id: string;
  field_name: string;
  direction: 'asc' | 'desc';
  order: number;
}

interface VisualizationConfig {
  type: VisualizationType;
  title?: string;
  x_axis_field?: string;
  y_axis_field?: string;
  series_field?: string;
  show_legend?: boolean;
  show_data_labels?: boolean;
  colors?: string[];
}

interface ReportConfig {
  data_source: DataSourceType;
  columns: ReportColumn[];
  filters: FilterGroup;
  groupings: ReportGrouping[];
  sortings: ReportSorting[];
  visualization: VisualizationConfig;
  limit?: number;
}

interface ReportSchedule {
  enabled: boolean;
  frequency: ScheduleFrequency;
  day_of_week?: number;
  day_of_month?: number;
  time: string;
  timezone: string;
  recipients: string[];
  export_format: ExportFormat;
  last_run?: string;
  next_run?: string;
}

interface ReportShare {
  user_id: string;
  user_name?: string;
  user_email?: string;
  permission: SharePermission;
  shared_at: string;
}

interface CustomReport {
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

interface ReportRow {
  [key: string]: string | number | boolean | null;
}

interface ReportExecutionResult {
  report_id: string;
  report_name: string;
  executed_at: string;
  execution_time_ms: number;
  total_rows: number;
  columns: ReportColumn[];
  rows: ReportRow[];
  groupings?: ReportGrouping[];
  summary?: { [key: string]: number };
}

interface ListReportsFilters {
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
// Mock Data for Development
// ============================================

const MOCK_CUSTOMERS = [
  { id: '1', name: 'Acme Corp', arr: 250000, health_score: 85, segment: 'Enterprise', industry: 'Technology', csm_name: 'Sarah Johnson', stage: 'Active', created_at: '2024-01-15', renewal_date: '2026-06-15', days_since_contact: 5 },
  { id: '2', name: 'TechStart Inc', arr: 180000, health_score: 42, segment: 'Enterprise', industry: 'SaaS', csm_name: 'Mike Chen', stage: 'At Risk', created_at: '2024-03-01', renewal_date: '2026-04-01', days_since_contact: 22 },
  { id: '3', name: 'GlobalRetail', arr: 150000, health_score: 78, segment: 'Enterprise', industry: 'Retail', csm_name: 'Sarah Johnson', stage: 'Active', created_at: '2024-02-15', renewal_date: '2026-05-15', days_since_contact: 8 },
  { id: '4', name: 'DataFlow Systems', arr: 95000, health_score: 38, segment: 'Mid-Market', industry: 'Data', csm_name: 'Mike Chen', stage: 'At Risk', created_at: '2024-04-01', renewal_date: '2026-03-01', days_since_contact: 15 },
  { id: '5', name: 'CloudNine Solutions', arr: 75000, health_score: 72, segment: 'Mid-Market', industry: 'Cloud', csm_name: 'Lisa Wang', stage: 'Active', created_at: '2024-05-15', renewal_date: '2026-08-15', days_since_contact: 3 },
  { id: '6', name: 'MegaInc', arr: 320000, health_score: 88, segment: 'Enterprise', industry: 'Finance', csm_name: 'Lisa Wang', stage: 'Active', created_at: '2024-06-01', renewal_date: '2026-09-01', days_since_contact: 2 },
  { id: '7', name: 'StartupXYZ', arr: 45000, health_score: 65, segment: 'SMB', industry: 'Technology', csm_name: 'Tom Roberts', stage: 'Active', created_at: '2024-07-01', renewal_date: '2026-07-01', days_since_contact: 12 },
  { id: '8', name: 'SmallBiz Pro', arr: 18000, health_score: 45, segment: 'SMB', industry: 'Services', csm_name: 'Tom Roberts', stage: 'At Risk', created_at: '2024-08-01', renewal_date: '2026-02-01', days_since_contact: 30 },
  { id: '9', name: 'Enterprise Plus', arr: 520000, health_score: 92, segment: 'Enterprise', industry: 'Manufacturing', csm_name: 'Sarah Johnson', stage: 'Active', created_at: '2024-09-01', renewal_date: '2026-12-01', days_since_contact: 1 },
  { id: '10', name: 'FinServ Global', arr: 450000, health_score: 35, segment: 'Enterprise', industry: 'Finance', csm_name: 'Mike Chen', stage: 'At Risk', created_at: '2024-10-01', renewal_date: '2026-03-15', days_since_contact: 25 },
];

const MOCK_REPORTS: CustomReport[] = [
  {
    id: 'report-1',
    name: 'At-Risk High-Value Accounts',
    description: 'Accounts with health score below 50 and ARR over $100K, grouped by CSM',
    config: {
      data_source: 'customers',
      columns: [
        { id: 'col-1', field_id: 'name', field_name: 'Customer Name', field_type: 'string', display_name: 'Customer', visible: true, order: 0 },
        { id: 'col-2', field_id: 'arr', field_name: 'ARR', field_type: 'currency', display_name: 'ARR', visible: true, order: 1 },
        { id: 'col-3', field_id: 'health_score', field_name: 'Health Score', field_type: 'number', display_name: 'Health', visible: true, order: 2 },
        { id: 'col-4', field_id: 'csm_name', field_name: 'CSM Name', field_type: 'string', display_name: 'CSM', visible: true, order: 3 },
        { id: 'col-5', field_id: 'days_since_contact', field_name: 'Days Since Last Contact', field_type: 'number', display_name: 'Days Silent', visible: true, order: 4 },
      ],
      filters: {
        logic: 'AND',
        filters: [
          { id: 'f-1', field_id: 'health_score', field_name: 'Health Score', operator: 'less_than', value: 50 },
          { id: 'f-2', field_id: 'arr', field_name: 'ARR', operator: 'greater_than', value: 100000 },
        ]
      },
      groupings: [{ field_id: 'csm_name', field_name: 'CSM Name', order: 0 }],
      sortings: [{ field_id: 'arr', field_name: 'ARR', direction: 'desc', order: 0 }],
      visualization: { type: 'table' },
      limit: 100
    },
    created_by: 'user-1',
    created_by_name: 'Admin User',
    is_template: true,
    is_public: true,
    shared_with: [],
    tags: ['risk', 'high-value', 'health-score'],
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    execution_count: 47
  },
  {
    id: 'report-2',
    name: 'Monthly Revenue by Segment',
    description: 'Total ARR breakdown by customer segment',
    config: {
      data_source: 'customers',
      columns: [
        { id: 'col-1', field_id: 'segment', field_name: 'Segment', field_type: 'string', display_name: 'Segment', visible: true, order: 0 },
        { id: 'col-2', field_id: 'arr', field_name: 'ARR', field_type: 'currency', display_name: 'Total ARR', aggregation: 'sum', visible: true, order: 1 },
        { id: 'col-3', field_id: 'name', field_name: 'Customer Name', field_type: 'string', display_name: 'Customer Count', aggregation: 'count', visible: true, order: 2 },
      ],
      filters: { logic: 'AND', filters: [] },
      groupings: [{ field_id: 'segment', field_name: 'Segment', order: 0 }],
      sortings: [{ field_id: 'arr', field_name: 'ARR', direction: 'desc', order: 0 }],
      visualization: { type: 'pie_chart', title: 'ARR by Segment', show_legend: true },
      limit: 100
    },
    created_by: 'user-1',
    created_by_name: 'Admin User',
    is_template: false,
    is_public: false,
    shared_with: [],
    tags: ['revenue', 'segment'],
    created_at: '2026-01-20T14:00:00Z',
    updated_at: '2026-01-28T09:00:00Z',
    execution_count: 23
  }
];

// ============================================
// Service Class
// ============================================

class CustomReportBuilderService {
  private supabase: SupabaseClient | null = null;
  private reports: Map<string, CustomReport> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    // Initialize with mock reports
    MOCK_REPORTS.forEach(r => this.reports.set(r.id, r));
  }

  // ============================================
  // Report CRUD Operations
  // ============================================

  async createReport(
    data: {
      name: string;
      description?: string;
      config: ReportConfig;
      is_template?: boolean;
      is_public?: boolean;
      tags?: string[];
    },
    userId: string,
    userName?: string
  ): Promise<CustomReport> {
    const now = new Date().toISOString();
    const report: CustomReport = {
      id: uuidv4(),
      name: data.name,
      description: data.description,
      config: data.config,
      created_by: userId,
      created_by_name: userName,
      is_template: data.is_template || false,
      is_public: data.is_public || false,
      shared_with: [],
      tags: data.tags || [],
      created_at: now,
      updated_at: now,
      execution_count: 0
    };

    if (this.supabase) {
      try {
        const { data: inserted, error } = await this.supabase
          .from('custom_reports')
          .insert({
            id: report.id,
            name: report.name,
            description: report.description,
            config: report.config,
            created_by: report.created_by,
            is_template: report.is_template,
            is_public: report.is_public,
            shared_with: report.shared_with,
            tags: report.tags,
            created_at: report.created_at,
            updated_at: report.updated_at,
            execution_count: report.execution_count
          })
          .select()
          .single();

        if (error) throw error;
        return { ...report, ...inserted };
      } catch (error) {
        console.error('Error creating report in Supabase:', error);
      }
    }

    // Store in memory
    this.reports.set(report.id, report);
    return report;
  }

  async getReport(reportId: string, userId: string): Promise<CustomReport | null> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('custom_reports')
          .select('*')
          .eq('id', reportId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') return null;
          throw error;
        }

        // Check permissions
        if (data.created_by !== userId && !data.is_public) {
          const hasAccess = data.shared_with?.some((s: ReportShare) => s.user_id === userId);
          if (!hasAccess) return null;
        }

        return data as CustomReport;
      } catch (error) {
        console.error('Error fetching report from Supabase:', error);
      }
    }

    const report = this.reports.get(reportId);
    if (!report) return null;

    // Check permissions
    if (report.created_by !== userId && !report.is_public) {
      const hasAccess = report.shared_with.some(s => s.user_id === userId);
      if (!hasAccess) return null;
    }

    return report;
  }

  async updateReport(
    reportId: string,
    data: {
      name?: string;
      description?: string;
      config?: ReportConfig;
      is_template?: boolean;
      is_public?: boolean;
      tags?: string[];
    },
    userId: string
  ): Promise<CustomReport | null> {
    const existing = await this.getReport(reportId, userId);
    if (!existing) return null;

    // Check edit permission
    if (existing.created_by !== userId) {
      const share = existing.shared_with.find(s => s.user_id === userId);
      if (!share || (share.permission !== 'edit' && share.permission !== 'admin')) {
        return null;
      }
    }

    const updated: CustomReport = {
      ...existing,
      name: data.name ?? existing.name,
      description: data.description ?? existing.description,
      config: data.config ?? existing.config,
      is_template: data.is_template ?? existing.is_template,
      is_public: data.is_public ?? existing.is_public,
      tags: data.tags ?? existing.tags,
      updated_at: new Date().toISOString()
    };

    if (this.supabase) {
      try {
        const { data: result, error } = await this.supabase
          .from('custom_reports')
          .update({
            name: updated.name,
            description: updated.description,
            config: updated.config,
            is_template: updated.is_template,
            is_public: updated.is_public,
            tags: updated.tags,
            updated_at: updated.updated_at
          })
          .eq('id', reportId)
          .select()
          .single();

        if (error) throw error;
        return result as CustomReport;
      } catch (error) {
        console.error('Error updating report in Supabase:', error);
      }
    }

    this.reports.set(reportId, updated);
    return updated;
  }

  async deleteReport(reportId: string, userId: string): Promise<boolean> {
    const existing = await this.getReport(reportId, userId);
    if (!existing) return false;

    // Only owner or admin can delete
    if (existing.created_by !== userId) {
      const share = existing.shared_with.find(s => s.user_id === userId);
      if (!share || share.permission !== 'admin') {
        return false;
      }
    }

    if (this.supabase) {
      try {
        const { error } = await this.supabase
          .from('custom_reports')
          .delete()
          .eq('id', reportId);

        if (error) throw error;
        return true;
      } catch (error) {
        console.error('Error deleting report from Supabase:', error);
      }
    }

    this.reports.delete(reportId);
    return true;
  }

  async listReports(
    filters: ListReportsFilters,
    userId: string
  ): Promise<{ reports: CustomReport[]; total: number }> {
    let reports: CustomReport[] = [];
    let total = 0;

    const page = filters.page || 1;
    const pageSize = filters.page_size || 20;

    if (this.supabase) {
      try {
        let query = this.supabase
          .from('custom_reports')
          .select('*', { count: 'exact' });

        // Filter by access
        query = query.or(`created_by.eq.${userId},is_public.eq.true`);

        if (filters.search) {
          query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
        }

        if (filters.is_template !== undefined) {
          query = query.eq('is_template', filters.is_template);
        }

        if (filters.data_source) {
          query = query.eq('config->>data_source', filters.data_source);
        }

        if (filters.created_by) {
          query = query.eq('created_by', filters.created_by);
        }

        // Sorting
        const sortField = filters.sort_by || 'updated_at';
        const sortOrder = filters.sort_order === 'asc' ? true : false;
        query = query.order(sortField, { ascending: sortOrder });

        // Pagination
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;

        reports = (data || []) as CustomReport[];
        total = count || 0;

        return { reports, total };
      } catch (error) {
        console.error('Error listing reports from Supabase:', error);
      }
    }

    // In-memory filtering
    let allReports = Array.from(this.reports.values());

    // Filter by access
    allReports = allReports.filter(r =>
      r.created_by === userId ||
      r.is_public ||
      r.shared_with.some(s => s.user_id === userId)
    );

    if (filters.search) {
      const search = filters.search.toLowerCase();
      allReports = allReports.filter(r =>
        r.name.toLowerCase().includes(search) ||
        (r.description?.toLowerCase().includes(search))
      );
    }

    if (filters.is_template !== undefined) {
      allReports = allReports.filter(r => r.is_template === filters.is_template);
    }

    if (filters.data_source) {
      allReports = allReports.filter(r => r.config.data_source === filters.data_source);
    }

    if (filters.created_by) {
      allReports = allReports.filter(r => r.created_by === filters.created_by);
    }

    // Sorting
    const sortField = filters.sort_by || 'updated_at';
    const sortOrder = filters.sort_order === 'asc' ? 1 : -1;
    allReports.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortField] as string | number;
      const bVal = (b as Record<string, unknown>)[sortField] as string | number;
      if (aVal < bVal) return -1 * sortOrder;
      if (aVal > bVal) return 1 * sortOrder;
      return 0;
    });

    total = allReports.length;

    // Pagination
    const from = (page - 1) * pageSize;
    reports = allReports.slice(from, from + pageSize);

    return { reports, total };
  }

  // ============================================
  // Report Execution
  // ============================================

  async executeReport(reportId: string, userId: string): Promise<ReportExecutionResult> {
    const startTime = Date.now();

    const report = await this.getReport(reportId, userId);
    if (!report) {
      throw new Error('Report not found or access denied');
    }

    // Fetch and filter data based on config
    const rows = await this.fetchAndProcessData(report.config);

    // Update execution stats
    await this.incrementExecutionCount(reportId);

    const executionTime = Date.now() - startTime;

    return {
      report_id: report.id,
      report_name: report.name,
      executed_at: new Date().toISOString(),
      execution_time_ms: executionTime,
      total_rows: rows.length,
      columns: report.config.columns.filter(c => c.visible),
      rows,
      groupings: report.config.groupings.length > 0 ? report.config.groupings : undefined,
      summary: this.calculateSummary(rows, report.config.columns)
    };
  }

  async executeReportConfig(config: ReportConfig): Promise<ReportExecutionResult> {
    const startTime = Date.now();

    const rows = await this.fetchAndProcessData(config);
    const executionTime = Date.now() - startTime;

    return {
      report_id: 'preview',
      report_name: 'Preview',
      executed_at: new Date().toISOString(),
      execution_time_ms: executionTime,
      total_rows: rows.length,
      columns: config.columns.filter(c => c.visible),
      rows,
      groupings: config.groupings.length > 0 ? config.groupings : undefined,
      summary: this.calculateSummary(rows, config.columns)
    };
  }

  private async fetchAndProcessData(config: ReportConfig): Promise<ReportRow[]> {
    let rawData: Record<string, unknown>[] = [];

    // Fetch data from appropriate source
    if (config.data_source === 'customers') {
      rawData = await this.fetchCustomersData();
    } else {
      // For other data sources, generate mock data
      rawData = this.generateMockDataForSource(config.data_source);
    }

    // Apply filters
    let filtered = this.applyFilters(rawData, config.filters);

    // Apply sorting
    filtered = this.applySorting(filtered, config.sortings);

    // Apply limit
    if (config.limit && config.limit > 0) {
      filtered = filtered.slice(0, config.limit);
    }

    // Map to report rows with only selected columns
    const rows: ReportRow[] = filtered.map(item => {
      const row: ReportRow = {};
      for (const col of config.columns) {
        if (col.visible) {
          row[col.field_id] = (item[col.field_id] as string | number | boolean | null) ?? null;
        }
      }
      return row;
    });

    // Apply groupings if needed
    if (config.groupings.length > 0) {
      return this.applyGroupings(rows, config);
    }

    return rows;
  }

  private async fetchCustomersData(): Promise<Record<string, unknown>[]> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('customers')
          .select('*');

        if (error) throw error;

        return (data || []).map(c => ({
          id: c.id,
          name: c.name,
          arr: c.arr || 0,
          health_score: c.health_score || 0,
          segment: c.segment || 'Unknown',
          industry: c.industry || 'Unknown',
          csm_name: c.csm_name || 'Unassigned',
          stage: c.stage || 'Active',
          created_at: c.created_at,
          renewal_date: c.renewal_date,
          days_since_contact: Math.floor(Math.random() * 30) // Mock for now
        }));
      } catch (error) {
        console.error('Error fetching customers from Supabase:', error);
      }
    }

    return MOCK_CUSTOMERS;
  }

  private generateMockDataForSource(source: DataSourceType): Record<string, unknown>[] {
    // Generate appropriate mock data for each source type
    switch (source) {
      case 'renewals':
        return MOCK_CUSTOMERS.map(c => ({
          customer_name: c.name,
          renewal_date: c.renewal_date,
          current_arr: c.arr,
          forecasted_arr: c.arr * (0.9 + Math.random() * 0.3),
          renewal_probability: 50 + Math.random() * 50,
          risk_level: c.health_score < 50 ? 'High' : c.health_score < 70 ? 'Medium' : 'Low',
          days_to_renewal: Math.floor(Math.random() * 180)
        }));

      case 'health_scores':
        return MOCK_CUSTOMERS.map(c => ({
          customer_name: c.name,
          score: c.health_score,
          score_date: new Date().toISOString().split('T')[0],
          score_change: Math.floor(Math.random() * 20) - 10,
          risk_category: c.health_score < 40 ? 'Critical' : c.health_score < 60 ? 'At Risk' : c.health_score < 80 ? 'Healthy' : 'Thriving',
          primary_risk_factor: c.health_score < 50 ? ['Usage Drop', 'Champion Left', 'Support Issues'][Math.floor(Math.random() * 3)] : null
        }));

      case 'engagements':
        return MOCK_CUSTOMERS.flatMap(c => [
          { customer_name: c.name, activity_type: 'Email', activity_date: '2026-01-15', csm_name: c.csm_name, engagement_score: 60 + Math.random() * 40, activity_count: Math.floor(Math.random() * 10) + 1 },
          { customer_name: c.name, activity_type: 'Meeting', activity_date: '2026-01-20', csm_name: c.csm_name, engagement_score: 70 + Math.random() * 30, activity_count: Math.floor(Math.random() * 5) + 1 },
        ]);

      case 'support_tickets':
        return MOCK_CUSTOMERS.flatMap(c => Array.from({ length: Math.floor(Math.random() * 5) }, (_, i) => ({
          customer_name: c.name,
          ticket_id: `TKT-${c.id}-${i + 1}`,
          subject: ['Login Issue', 'Performance Problem', 'Feature Request', 'Billing Question'][Math.floor(Math.random() * 4)],
          status: ['Open', 'In Progress', 'Resolved', 'Closed'][Math.floor(Math.random() * 4)],
          priority: ['Low', 'Medium', 'High', 'Critical'][Math.floor(Math.random() * 4)],
          created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          resolution_time: Math.floor(Math.random() * 72),
          ticket_count: 1
        })));

      case 'revenue':
        return MOCK_CUSTOMERS.map(c => ({
          customer_name: c.name,
          movement_type: ['New', 'Expansion', 'Contraction', 'Renewal'][Math.floor(Math.random() * 4)],
          movement_date: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          previous_arr: c.arr * (0.8 + Math.random() * 0.2),
          new_arr: c.arr,
          change_amount: c.arr * (Math.random() * 0.3 - 0.1)
        }));

      case 'activities':
        return MOCK_CUSTOMERS.flatMap(c => [
          { csm_name: c.csm_name, customer_name: c.name, activity_type: 'Call', activity_date: '2026-01-25', status: 'Completed', duration_minutes: 30 + Math.floor(Math.random() * 60) },
          { csm_name: c.csm_name, customer_name: c.name, activity_type: 'Email', activity_date: '2026-01-27', status: 'Completed', duration_minutes: 10 + Math.floor(Math.random() * 20) },
        ]);

      default:
        return [];
    }
  }

  private applyFilters(data: Record<string, unknown>[], filterGroup: FilterGroup): Record<string, unknown>[] {
    if (filterGroup.filters.length === 0) return data;

    return data.filter(item => {
      const results = filterGroup.filters.map(filter => this.evaluateFilter(item, filter));

      if (filterGroup.logic === 'AND') {
        return results.every(r => r);
      } else {
        return results.some(r => r);
      }
    });
  }

  private evaluateFilter(item: Record<string, unknown>, filter: ReportFilter): boolean {
    const value = item[filter.field_id];
    const filterValue = filter.value;

    switch (filter.operator) {
      case 'equals':
        return value === filterValue;
      case 'not_equals':
        return value !== filterValue;
      case 'contains':
        return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
      case 'not_contains':
        return !String(value).toLowerCase().includes(String(filterValue).toLowerCase());
      case 'starts_with':
        return String(value).toLowerCase().startsWith(String(filterValue).toLowerCase());
      case 'ends_with':
        return String(value).toLowerCase().endsWith(String(filterValue).toLowerCase());
      case 'greater_than':
        return Number(value) > Number(filterValue);
      case 'less_than':
        return Number(value) < Number(filterValue);
      case 'greater_than_or_equal':
        return Number(value) >= Number(filterValue);
      case 'less_than_or_equal':
        return Number(value) <= Number(filterValue);
      case 'between':
        return Number(value) >= Number(filterValue) && Number(value) <= Number(filter.value2);
      case 'in':
        return Array.isArray(filterValue) && filterValue.includes(value as string | number);
      case 'not_in':
        return Array.isArray(filterValue) && !filterValue.includes(value as string | number);
      case 'is_null':
        return value === null || value === undefined || value === '';
      case 'is_not_null':
        return value !== null && value !== undefined && value !== '';
      default:
        return true;
    }
  }

  private applySorting(data: Record<string, unknown>[], sortings: ReportSorting[]): Record<string, unknown>[] {
    if (sortings.length === 0) return data;

    return [...data].sort((a, b) => {
      for (const sort of sortings) {
        const aVal = a[sort.field_id];
        const bVal = b[sort.field_id];
        const direction = sort.direction === 'asc' ? 1 : -1;

        if (aVal === bVal) continue;
        if (aVal === null || aVal === undefined) return 1 * direction;
        if (bVal === null || bVal === undefined) return -1 * direction;

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * direction;
        }

        return String(aVal).localeCompare(String(bVal)) * direction;
      }
      return 0;
    });
  }

  private applyGroupings(rows: ReportRow[], config: ReportConfig): ReportRow[] {
    if (config.groupings.length === 0) return rows;

    const groupField = config.groupings[0].field_id;
    const groups = new Map<string | number | boolean | null, ReportRow[]>();

    for (const row of rows) {
      const key = row[groupField];
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    }

    // Aggregate rows within groups
    const aggregatedRows: ReportRow[] = [];
    for (const [groupValue, groupRows] of groups) {
      const aggregatedRow: ReportRow = {};
      aggregatedRow[groupField] = groupValue;

      for (const col of config.columns) {
        if (col.aggregation && col.field_id !== groupField) {
          aggregatedRow[col.field_id] = this.aggregate(groupRows, col.field_id, col.aggregation);
        }
      }

      aggregatedRows.push(aggregatedRow);
    }

    return aggregatedRows;
  }

  private aggregate(rows: ReportRow[], fieldId: string, aggregation: AggregationType): number {
    const values = rows
      .map(r => r[fieldId])
      .filter((v): v is number => typeof v === 'number');

    switch (aggregation) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'avg':
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      case 'min':
        return values.length > 0 ? Math.min(...values) : 0;
      case 'max':
        return values.length > 0 ? Math.max(...values) : 0;
      case 'count':
        return rows.length;
      case 'count_distinct':
        return new Set(rows.map(r => r[fieldId])).size;
      default:
        return 0;
    }
  }

  private calculateSummary(rows: ReportRow[], columns: ReportColumn[]): { [key: string]: number } {
    const summary: { [key: string]: number } = {};

    for (const col of columns) {
      if (col.field_type === 'number' || col.field_type === 'currency') {
        const values = rows
          .map(r => r[col.field_id])
          .filter((v): v is number => typeof v === 'number');

        if (values.length > 0) {
          summary[`${col.field_id}_sum`] = values.reduce((a, b) => a + b, 0);
          summary[`${col.field_id}_avg`] = summary[`${col.field_id}_sum`] / values.length;
          summary[`${col.field_id}_min`] = Math.min(...values);
          summary[`${col.field_id}_max`] = Math.max(...values);
        }
      }
    }

    summary['row_count'] = rows.length;
    return summary;
  }

  private async incrementExecutionCount(reportId: string): Promise<void> {
    if (this.supabase) {
      try {
        await this.supabase
          .from('custom_reports')
          .update({
            execution_count: this.supabase.rpc('increment', { x: 1 }),
            last_executed_at: new Date().toISOString()
          })
          .eq('id', reportId);
      } catch (error) {
        console.error('Error incrementing execution count:', error);
      }
    }

    const report = this.reports.get(reportId);
    if (report) {
      report.execution_count++;
      report.last_executed_at = new Date().toISOString();
    }
  }

  // ============================================
  // Schedule Management
  // ============================================

  async scheduleReport(
    reportId: string,
    schedule: {
      frequency: ScheduleFrequency;
      day_of_week?: number;
      day_of_month?: number;
      time: string;
      timezone: string;
      recipients: string[];
      export_format: ExportFormat;
    },
    userId: string
  ): Promise<CustomReport | null> {
    const report = await this.getReport(reportId, userId);
    if (!report) return null;

    // Check edit permission
    if (report.created_by !== userId) {
      const share = report.shared_with.find(s => s.user_id === userId);
      if (!share || (share.permission !== 'edit' && share.permission !== 'admin')) {
        return null;
      }
    }

    const nextRun = this.calculateNextRun(schedule);

    const reportSchedule: ReportSchedule = {
      enabled: true,
      frequency: schedule.frequency,
      day_of_week: schedule.day_of_week,
      day_of_month: schedule.day_of_month,
      time: schedule.time,
      timezone: schedule.timezone,
      recipients: schedule.recipients,
      export_format: schedule.export_format,
      next_run: nextRun
    };

    const updated: CustomReport = {
      ...report,
      schedule: reportSchedule,
      updated_at: new Date().toISOString()
    };

    if (this.supabase) {
      try {
        const { error } = await this.supabase
          .from('custom_reports')
          .update({ schedule: reportSchedule, updated_at: updated.updated_at })
          .eq('id', reportId);

        if (error) throw error;
      } catch (error) {
        console.error('Error scheduling report:', error);
      }
    }

    this.reports.set(reportId, updated);
    return updated;
  }

  async removeSchedule(reportId: string, userId: string): Promise<CustomReport | null> {
    const report = await this.getReport(reportId, userId);
    if (!report) return null;

    const updated: CustomReport = {
      ...report,
      schedule: undefined,
      updated_at: new Date().toISOString()
    };

    if (this.supabase) {
      try {
        const { error } = await this.supabase
          .from('custom_reports')
          .update({ schedule: null, updated_at: updated.updated_at })
          .eq('id', reportId);

        if (error) throw error;
      } catch (error) {
        console.error('Error removing schedule:', error);
      }
    }

    this.reports.set(reportId, updated);
    return updated;
  }

  private calculateNextRun(schedule: { frequency: ScheduleFrequency; day_of_week?: number; day_of_month?: number; time: string; timezone: string }): string {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);

    let nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);

    // If time already passed today, move to next occurrence
    if (nextRun <= now) {
      switch (schedule.frequency) {
        case 'daily':
          nextRun.setDate(nextRun.getDate() + 1);
          break;
        case 'weekly':
          const targetDay = schedule.day_of_week || 1; // Default Monday
          const currentDay = nextRun.getDay();
          let daysUntil = targetDay - currentDay;
          if (daysUntil <= 0) daysUntil += 7;
          nextRun.setDate(nextRun.getDate() + daysUntil);
          break;
        case 'monthly':
          const targetDate = schedule.day_of_month || 1;
          nextRun.setMonth(nextRun.getMonth() + 1);
          nextRun.setDate(Math.min(targetDate, new Date(nextRun.getFullYear(), nextRun.getMonth() + 1, 0).getDate()));
          break;
        case 'quarterly':
          const currentMonth = nextRun.getMonth();
          const nextQuarterMonth = Math.floor(currentMonth / 3) * 3 + 3;
          nextRun.setMonth(nextQuarterMonth);
          nextRun.setDate(schedule.day_of_month || 1);
          break;
      }
    }

    return nextRun.toISOString();
  }

  // ============================================
  // Sharing Management
  // ============================================

  async shareReport(
    reportId: string,
    shareData: { user_id: string; permission: SharePermission; user_name?: string; user_email?: string },
    userId: string
  ): Promise<CustomReport | null> {
    const report = await this.getReport(reportId, userId);
    if (!report) return null;

    // Only owner or admin can share
    if (report.created_by !== userId) {
      const share = report.shared_with.find(s => s.user_id === userId);
      if (!share || share.permission !== 'admin') {
        return null;
      }
    }

    const existingShare = report.shared_with.find(s => s.user_id === shareData.user_id);
    if (existingShare) {
      existingShare.permission = shareData.permission;
    } else {
      report.shared_with.push({
        user_id: shareData.user_id,
        user_name: shareData.user_name,
        user_email: shareData.user_email,
        permission: shareData.permission,
        shared_at: new Date().toISOString()
      });
    }

    report.updated_at = new Date().toISOString();

    if (this.supabase) {
      try {
        const { error } = await this.supabase
          .from('custom_reports')
          .update({ shared_with: report.shared_with, updated_at: report.updated_at })
          .eq('id', reportId);

        if (error) throw error;
      } catch (error) {
        console.error('Error sharing report:', error);
      }
    }

    this.reports.set(reportId, report);
    return report;
  }

  async removeShare(reportId: string, targetUserId: string, userId: string): Promise<CustomReport | null> {
    const report = await this.getReport(reportId, userId);
    if (!report) return null;

    // Only owner or admin can remove shares
    if (report.created_by !== userId) {
      const share = report.shared_with.find(s => s.user_id === userId);
      if (!share || share.permission !== 'admin') {
        return null;
      }
    }

    report.shared_with = report.shared_with.filter(s => s.user_id !== targetUserId);
    report.updated_at = new Date().toISOString();

    if (this.supabase) {
      try {
        const { error } = await this.supabase
          .from('custom_reports')
          .update({ shared_with: report.shared_with, updated_at: report.updated_at })
          .eq('id', reportId);

        if (error) throw error;
      } catch (error) {
        console.error('Error removing share:', error);
      }
    }

    this.reports.set(reportId, report);
    return report;
  }

  // ============================================
  // Data Sources & Fields
  // ============================================

  getDataSources(): { id: DataSourceType; name: string; description: string }[] {
    return [
      { id: 'customers', name: 'Customers', description: 'Customer accounts and health scores' },
      { id: 'renewals', name: 'Renewals', description: 'Renewal pipeline and forecasts' },
      { id: 'health_scores', name: 'Health Scores', description: 'Health score history and trends' },
      { id: 'engagements', name: 'Engagements', description: 'Customer engagement activities' },
      { id: 'support_tickets', name: 'Support Tickets', description: 'Support ticket data and metrics' },
      { id: 'revenue', name: 'Revenue', description: 'Revenue movements and metrics' },
      { id: 'activities', name: 'Activities', description: 'CSM activities and tasks' }
    ];
  }

  getFieldsForDataSource(dataSource: DataSourceType): {
    id: string;
    name: string;
    type: string;
    aggregatable: boolean;
    filterable: boolean;
    sortable: boolean;
  }[] {
    const fieldsBySource: Record<DataSourceType, { id: string; name: string; type: string; aggregatable: boolean; filterable: boolean; sortable: boolean }[]> = {
      customers: [
        { id: 'name', name: 'Customer Name', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'arr', name: 'ARR', type: 'currency', aggregatable: true, filterable: true, sortable: true },
        { id: 'health_score', name: 'Health Score', type: 'number', aggregatable: true, filterable: true, sortable: true },
        { id: 'segment', name: 'Segment', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'industry', name: 'Industry', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'csm_name', name: 'CSM Name', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'stage', name: 'Stage', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'created_at', name: 'Created Date', type: 'date', aggregatable: false, filterable: true, sortable: true },
        { id: 'renewal_date', name: 'Renewal Date', type: 'date', aggregatable: false, filterable: true, sortable: true },
        { id: 'days_since_contact', name: 'Days Since Last Contact', type: 'number', aggregatable: true, filterable: true, sortable: true },
      ],
      renewals: [
        { id: 'customer_name', name: 'Customer Name', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'renewal_date', name: 'Renewal Date', type: 'date', aggregatable: false, filterable: true, sortable: true },
        { id: 'current_arr', name: 'Current ARR', type: 'currency', aggregatable: true, filterable: true, sortable: true },
        { id: 'forecasted_arr', name: 'Forecasted ARR', type: 'currency', aggregatable: true, filterable: true, sortable: true },
        { id: 'renewal_probability', name: 'Renewal Probability', type: 'number', aggregatable: true, filterable: true, sortable: true },
        { id: 'risk_level', name: 'Risk Level', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'days_to_renewal', name: 'Days to Renewal', type: 'number', aggregatable: true, filterable: true, sortable: true },
      ],
      health_scores: [
        { id: 'customer_name', name: 'Customer Name', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'score', name: 'Health Score', type: 'number', aggregatable: true, filterable: true, sortable: true },
        { id: 'score_date', name: 'Score Date', type: 'date', aggregatable: false, filterable: true, sortable: true },
        { id: 'score_change', name: 'Score Change', type: 'number', aggregatable: true, filterable: true, sortable: true },
        { id: 'risk_category', name: 'Risk Category', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'primary_risk_factor', name: 'Primary Risk Factor', type: 'string', aggregatable: false, filterable: true, sortable: true },
      ],
      engagements: [
        { id: 'customer_name', name: 'Customer Name', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'activity_type', name: 'Activity Type', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'activity_date', name: 'Activity Date', type: 'date', aggregatable: false, filterable: true, sortable: true },
        { id: 'csm_name', name: 'CSM Name', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'engagement_score', name: 'Engagement Score', type: 'number', aggregatable: true, filterable: true, sortable: true },
        { id: 'activity_count', name: 'Activity Count', type: 'number', aggregatable: true, filterable: true, sortable: true },
      ],
      support_tickets: [
        { id: 'customer_name', name: 'Customer Name', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'ticket_id', name: 'Ticket ID', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'subject', name: 'Subject', type: 'string', aggregatable: false, filterable: true, sortable: false },
        { id: 'status', name: 'Status', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'priority', name: 'Priority', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'created_at', name: 'Created Date', type: 'date', aggregatable: false, filterable: true, sortable: true },
        { id: 'resolution_time', name: 'Resolution Time (hrs)', type: 'number', aggregatable: true, filterable: true, sortable: true },
        { id: 'ticket_count', name: 'Ticket Count', type: 'number', aggregatable: true, filterable: true, sortable: true },
      ],
      revenue: [
        { id: 'customer_name', name: 'Customer Name', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'movement_type', name: 'Movement Type', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'movement_date', name: 'Movement Date', type: 'date', aggregatable: false, filterable: true, sortable: true },
        { id: 'previous_arr', name: 'Previous ARR', type: 'currency', aggregatable: true, filterable: true, sortable: true },
        { id: 'new_arr', name: 'New ARR', type: 'currency', aggregatable: true, filterable: true, sortable: true },
        { id: 'change_amount', name: 'Change Amount', type: 'currency', aggregatable: true, filterable: true, sortable: true },
      ],
      activities: [
        { id: 'csm_name', name: 'CSM Name', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'customer_name', name: 'Customer Name', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'activity_type', name: 'Activity Type', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'activity_date', name: 'Activity Date', type: 'date', aggregatable: false, filterable: true, sortable: true },
        { id: 'status', name: 'Status', type: 'string', aggregatable: false, filterable: true, sortable: true },
        { id: 'duration_minutes', name: 'Duration (mins)', type: 'number', aggregatable: true, filterable: true, sortable: true },
      ]
    };

    return fieldsBySource[dataSource] || [];
  }

  // ============================================
  // Templates
  // ============================================

  async getTemplates(): Promise<CustomReport[]> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('custom_reports')
          .select('*')
          .eq('is_template', true)
          .order('execution_count', { ascending: false });

        if (error) throw error;
        return data as CustomReport[];
      } catch (error) {
        console.error('Error fetching templates:', error);
      }
    }

    return Array.from(this.reports.values()).filter(r => r.is_template);
  }

  async duplicateReport(reportId: string, newName: string, userId: string, userName?: string): Promise<CustomReport | null> {
    const source = await this.getReport(reportId, userId);
    if (!source) return null;

    return this.createReport(
      {
        name: newName,
        description: source.description,
        config: source.config,
        tags: source.tags
      },
      userId,
      userName
    );
  }
}

// Export singleton instance
export const customReportBuilderService = new CustomReportBuilderService();
