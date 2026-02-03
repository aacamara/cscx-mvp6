/**
 * Custom Reports List
 * PRD-180: List and manage saved custom reports
 *
 * Features:
 * - Search and filter reports
 * - Sort by name, date, or execution count
 * - Quick actions: Run, Edit, Duplicate, Delete
 * - Template indicators
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CustomReport,
  DataSourceType,
  ReportListFilters
} from '../../../types/customReportBuilder';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// Helper Functions
// ============================================

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const getDataSourceLabel = (source: DataSourceType): string => {
  const labels: Record<DataSourceType, string> = {
    customers: 'Customers',
    renewals: 'Renewals',
    health_scores: 'Health Scores',
    engagements: 'Engagements',
    support_tickets: 'Support Tickets',
    revenue: 'Revenue',
    activities: 'Activities'
  };
  return labels[source] || source;
};

// ============================================
// Main Component
// ============================================

interface CustomReportsListProps {
  onCreateNew: () => void;
  onEdit: (reportId: string) => void;
  onRun: (reportId: string) => void;
}

export const CustomReportsList: React.FC<CustomReportsListProps> = ({
  onCreateNew,
  onEdit,
  onRun
}) => {
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportListFilters>({
    search: '',
    sort_by: 'updated_at',
    sort_order: 'desc',
    page: 1,
    page_size: 20
  });
  const [showTemplatesOnly, setShowTemplatesOnly] = useState(false);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (showTemplatesOnly) params.append('is_template', 'true');
      if (filters.sort_by) params.append('sort_by', filters.sort_by);
      if (filters.sort_order) params.append('sort_order', filters.sort_order);
      if (filters.page) params.append('page', String(filters.page));
      if (filters.page_size) params.append('page_size', String(filters.page_size));

      const response = await fetch(`${API_BASE}/reports/custom?${params}`);
      if (!response.ok) throw new Error('Failed to fetch reports');

      const result = await response.json();
      setReports(result.data.reports);
      setTotal(result.data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  }, [filters, showTemplatesOnly]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleDelete = async (reportId: string, reportName: string) => {
    if (!confirm(`Are you sure you want to delete "${reportName}"?`)) return;

    try {
      const response = await fetch(`${API_BASE}/reports/custom/${reportId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete report');

      fetchReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete report');
    }
  };

  const handleDuplicate = async (reportId: string, reportName: string) => {
    const newName = prompt('Enter name for duplicated report:', `${reportName} (Copy)`);
    if (!newName) return;

    try {
      const response = await fetch(`${API_BASE}/reports/custom/${reportId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });

      if (!response.ok) throw new Error('Failed to duplicate report');

      fetchReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate report');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Custom Reports</h2>
          <p className="text-gray-400 text-sm mt-1">
            Build and manage your custom reports
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="px-4 py-2 bg-cscx-accent text-white rounded-lg hover:bg-cscx-accent/80 transition-colors flex items-center gap-2"
        >
          <span>+</span>
          <span>Create Report</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-64">
          <input
            type="text"
            value={filters.search || ''}
            onChange={e => setFilters({ ...filters, search: e.target.value, page: 1 })}
            placeholder="Search reports..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-cscx-accent focus:outline-none"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={showTemplatesOnly}
            onChange={e => setShowTemplatesOnly(e.target.checked)}
            className="rounded border-gray-600 bg-gray-800 text-cscx-accent focus:ring-cscx-accent"
          />
          Templates Only
        </label>

        <select
          value={`${filters.sort_by}_${filters.sort_order}`}
          onChange={e => {
            const [sort_by, sort_order] = e.target.value.split('_') as [typeof filters.sort_by, typeof filters.sort_order];
            setFilters({ ...filters, sort_by, sort_order });
          }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
        >
          <option value="updated_at_desc">Recently Updated</option>
          <option value="created_at_desc">Recently Created</option>
          <option value="name_asc">Name (A-Z)</option>
          <option value="name_desc">Name (Z-A)</option>
          <option value="execution_count_desc">Most Used</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cscx-accent"></div>
        </div>
      )}

      {/* Reports Grid */}
      {!isLoading && reports.length === 0 && (
        <div className="text-center py-12 bg-gray-900/50 rounded-xl border border-gray-800">
          <p className="text-gray-400 mb-4">
            {filters.search || showTemplatesOnly
              ? 'No reports match your filters.'
              : 'No custom reports yet. Create your first report to get started.'}
          </p>
          <button
            onClick={onCreateNew}
            className="px-4 py-2 bg-cscx-accent text-white rounded hover:bg-cscx-accent/80 transition-colors"
          >
            Create Your First Report
          </button>
        </div>
      )}

      {!isLoading && reports.length > 0 && (
        <div className="grid gap-4">
          {reports.map(report => (
            <div
              key={report.id}
              className="bg-gray-900/50 rounded-xl border border-gray-800 p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-white truncate">{report.name}</h3>
                    {report.is_template && (
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                        Template
                      </span>
                    )}
                    {report.is_public && (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                        Public
                      </span>
                    )}
                  </div>
                  {report.description && (
                    <p className="text-sm text-gray-400 mb-2 line-clamp-2">{report.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-cscx-accent"></span>
                      {getDataSourceLabel(report.config.data_source)}
                    </span>
                    <span>{report.config.columns.length} columns</span>
                    <span>{report.config.filters.filters.length} filters</span>
                    <span>Updated {formatDate(report.updated_at)}</span>
                    {report.execution_count > 0 && (
                      <span>Run {report.execution_count}x</span>
                    )}
                  </div>
                  {report.tags && report.tags.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      {report.tags.slice(0, 5).map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onRun(report.id)}
                    className="px-3 py-1.5 bg-cscx-accent text-white text-sm rounded hover:bg-cscx-accent/80 transition-colors"
                  >
                    Run
                  </button>
                  <button
                    onClick={() => onEdit(report.id)}
                    className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded hover:bg-gray-600 transition-colors"
                  >
                    Edit
                  </button>
                  <div className="relative group">
                    <button className="px-2 py-1.5 text-gray-400 hover:text-white transition-colors">
                      ...
                    </button>
                    <div className="absolute right-0 top-full mt-1 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      <button
                        onClick={() => handleDuplicate(report.id, report.name)}
                        className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => handleDelete(report.id, report.name)}
                        className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && total > (filters.page_size || 20) && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Showing {((filters.page || 1) - 1) * (filters.page_size || 20) + 1} to{' '}
            {Math.min((filters.page || 1) * (filters.page_size || 20), total)} of {total} reports
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
              disabled={(filters.page || 1) <= 1}
              className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
              disabled={(filters.page || 1) * (filters.page_size || 20) >= total}
              className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomReportsList;
