/**
 * CADGTeamMetricsPreview - Editable team metrics dashboard preview for CADG-generated reports
 * Allows managers to filter, sort, and customize CSM performance views before exporting
 * Works in General Mode - no specific customer context required
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface CSMMetrics {
  id: string;
  name: string;
  email: string;
  customerCount: number;
  totalArr: number;
  avgHealthScore: number;
  healthyCount: number;
  atRiskCount: number;
  criticalCount: number;
  renewalRate: number;
  expansionRate: number;
  churnRate: number;
  npsScore: number | null;
  activitiesThisWeek: number;
  openTickets: number;
  avgResponseTime: number;
  enabled: boolean;
}

export interface TeamMetric {
  id: string;
  name: string;
  description: string;
  value: number;
  unit: string;
  benchmark: number | null;
  trend: 'up' | 'down' | 'stable';
  enabled: boolean;
}

export interface TeamMetricsFilters {
  csms: string[];
  timeRange: {
    type: 'last_7_days' | 'last_30_days' | 'last_90_days' | 'this_quarter' | 'custom';
    startDate?: string;
    endDate?: string;
  };
  showBenchmarks: boolean;
  sortBy: 'name' | 'arr' | 'health' | 'customers' | 'nps';
  sortDirection: 'asc' | 'desc';
}

export interface TeamMetricsColumn {
  id: string;
  name: string;
  enabled: boolean;
  width?: string;
}

export interface TeamMetricsSummary {
  totalCsms: number;
  totalCustomers: number;
  totalArr: number;
  avgHealthScore: number;
  avgNps: number;
  renewalRate: number;
  expansionRate: number;
  churnRate: number;
  healthyCount: number;
  atRiskCount: number;
  criticalCount: number;
}

export interface TeamMetricsData {
  title: string;
  createdDate: string;
  lastUpdated: string;
  summary: TeamMetricsSummary;
  csms: CSMMetrics[];
  metrics: TeamMetric[];
  filters: TeamMetricsFilters;
  columns: TeamMetricsColumn[];
  availableCsms: { id: string; name: string }[];
  notes: string;
}

interface CADGTeamMetricsPreviewProps {
  teamMetrics: TeamMetricsData;
  onSave: (teamMetrics: TeamMetricsData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Options
// ============================================
const TIME_RANGE_OPTIONS = ['last_7_days', 'last_30_days', 'last_90_days', 'this_quarter', 'custom'] as const;
const SORT_BY_OPTIONS = ['name', 'arr', 'health', 'customers', 'nps'] as const;

const TIME_RANGE_LABELS: Record<string, string> = {
  last_7_days: 'Last 7 Days',
  last_30_days: 'Last 30 Days',
  last_90_days: 'Last 90 Days',
  this_quarter: 'This Quarter',
  custom: 'Custom Range',
};

const SORT_BY_LABELS: Record<string, string> = {
  name: 'CSM Name',
  arr: 'ARR',
  health: 'Health Score',
  customers: 'Customer Count',
  nps: 'NPS Score',
};

const TREND_ICONS: Record<string, { icon: string; color: string }> = {
  up: { icon: '↑', color: 'text-emerald-400' },
  down: { icon: '↓', color: 'text-red-400' },
  stable: { icon: '→', color: 'text-amber-400' },
};

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Component
// ============================================

export const CADGTeamMetricsPreview: React.FC<CADGTeamMetricsPreviewProps> = ({
  teamMetrics,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();
  const [editedData, setEditedData] = useState<TeamMetricsData>({ ...teamMetrics });
  const [activeTab, setActiveTab] = useState<'overview' | 'csms' | 'metrics' | 'filters' | 'columns'>('overview');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Filter and sort CSMs based on current filters
  const filteredCsms = useMemo(() => {
    let result = editedData.csms.filter(c => c.enabled);

    // Apply CSM filter
    if (editedData.filters.csms.length > 0 && editedData.filters.csms.length < editedData.availableCsms.length) {
      result = result.filter(c => editedData.filters.csms.includes(c.id));
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (editedData.filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'arr':
          comparison = a.totalArr - b.totalArr;
          break;
        case 'health':
          comparison = a.avgHealthScore - b.avgHealthScore;
          break;
        case 'customers':
          comparison = a.customerCount - b.customerCount;
          break;
        case 'nps':
          comparison = (a.npsScore || -100) - (b.npsScore || -100);
          break;
      }
      return editedData.filters.sortDirection === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [editedData.csms, editedData.filters]);

  // Calculate summary based on filtered CSMs
  const calculatedSummary = useMemo<TeamMetricsSummary>(() => {
    const enabledCsms = filteredCsms;

    return {
      totalCsms: enabledCsms.length,
      totalCustomers: enabledCsms.reduce((sum, c) => sum + c.customerCount, 0),
      totalArr: enabledCsms.reduce((sum, c) => sum + c.totalArr, 0),
      avgHealthScore: enabledCsms.length > 0
        ? Math.round(enabledCsms.reduce((sum, c) => sum + c.avgHealthScore, 0) / enabledCsms.length)
        : 0,
      avgNps: enabledCsms.filter(c => c.npsScore !== null).length > 0
        ? Math.round(enabledCsms.filter(c => c.npsScore !== null).reduce((sum, c) => sum + (c.npsScore || 0), 0) / enabledCsms.filter(c => c.npsScore !== null).length)
        : 0,
      renewalRate: enabledCsms.length > 0
        ? Math.round(enabledCsms.reduce((sum, c) => sum + c.renewalRate, 0) / enabledCsms.length)
        : 0,
      expansionRate: enabledCsms.length > 0
        ? Math.round(enabledCsms.reduce((sum, c) => sum + c.expansionRate, 0) / enabledCsms.length)
        : 0,
      churnRate: enabledCsms.length > 0
        ? Math.round(enabledCsms.reduce((sum, c) => sum + c.churnRate, 0) / enabledCsms.length)
        : 0,
      healthyCount: enabledCsms.reduce((sum, c) => sum + c.healthyCount, 0),
      atRiskCount: enabledCsms.reduce((sum, c) => sum + c.atRiskCount, 0),
      criticalCount: enabledCsms.reduce((sum, c) => sum + c.criticalCount, 0),
    };
  }, [filteredCsms]);

  // Helper to mark changes
  const markChanged = () => {
    if (!hasChanges) setHasChanges(true);
  };

  // ============================================
  // CSM Handlers
  // ============================================
  const toggleCsmEnabled = (csmId: string) => {
    setEditedData(prev => ({
      ...prev,
      csms: prev.csms.map(c => c.id === csmId ? { ...c, enabled: !c.enabled } : c),
    }));
    markChanged();
  };

  const toggleAllCsms = (enabled: boolean) => {
    setEditedData(prev => ({
      ...prev,
      csms: prev.csms.map(c => ({ ...c, enabled })),
    }));
    markChanged();
  };

  // ============================================
  // Filter Handlers
  // ============================================
  const toggleCsmFilter = (csmId: string) => {
    setEditedData(prev => {
      const current = prev.filters.csms;
      const newCsms = current.includes(csmId)
        ? current.filter(id => id !== csmId)
        : [...current, csmId];
      return {
        ...prev,
        filters: { ...prev.filters, csms: newCsms },
      };
    });
    markChanged();
  };

  const setTimeRange = (type: TeamMetricsFilters['timeRange']['type']) => {
    setEditedData(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        timeRange: { ...prev.filters.timeRange, type },
      },
    }));
    markChanged();
  };

  const setCustomDateRange = (field: 'startDate' | 'endDate', value: string) => {
    setEditedData(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        timeRange: { ...prev.filters.timeRange, [field]: value },
      },
    }));
    markChanged();
  };

  const setSortBy = (sortBy: TeamMetricsFilters['sortBy']) => {
    setEditedData(prev => ({
      ...prev,
      filters: { ...prev.filters, sortBy },
    }));
    markChanged();
  };

  const toggleSortDirection = () => {
    setEditedData(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        sortDirection: prev.filters.sortDirection === 'asc' ? 'desc' : 'asc',
      },
    }));
    markChanged();
  };

  const toggleShowBenchmarks = () => {
    setEditedData(prev => ({
      ...prev,
      filters: { ...prev.filters, showBenchmarks: !prev.filters.showBenchmarks },
    }));
    markChanged();
  };

  // ============================================
  // Metric Handlers
  // ============================================
  const toggleMetricEnabled = (metricId: string) => {
    setEditedData(prev => ({
      ...prev,
      metrics: prev.metrics.map(m => m.id === metricId ? { ...m, enabled: !m.enabled } : m),
    }));
    markChanged();
  };

  // ============================================
  // Column Handlers
  // ============================================
  const toggleColumnEnabled = (columnId: string) => {
    setEditedData(prev => ({
      ...prev,
      columns: prev.columns.map(c => c.id === columnId ? { ...c, enabled: !c.enabled } : c),
    }));
    markChanged();
  };

  // ============================================
  // Notes Handler
  // ============================================
  const setNotes = (notes: string) => {
    setEditedData(prev => ({ ...prev, notes }));
    markChanged();
  };

  // ============================================
  // Save Handler
  // ============================================
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update summary with calculated values
      const finalData = {
        ...editedData,
        summary: calculatedSummary,
        lastUpdated: new Date().toISOString().slice(0, 10),
      };
      await onSave(finalData);
    } catch (error) {
      console.error('Failed to save team metrics:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // Cancel Handler
  // ============================================
  const handleCancel = () => {
    if (hasChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to cancel?');
      if (!confirmed) return;
    }
    onCancel();
  };

  // ============================================
  // Render Functions
  // ============================================

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-cscx-gray-700/30 rounded-lg p-4">
          <div className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">Total CSMs</div>
          <div className="text-2xl font-bold text-white">{calculatedSummary.totalCsms}</div>
        </div>
        <div className="bg-cscx-gray-700/30 rounded-lg p-4">
          <div className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">Total Customers</div>
          <div className="text-2xl font-bold text-white">{calculatedSummary.totalCustomers}</div>
        </div>
        <div className="bg-cscx-gray-700/30 rounded-lg p-4">
          <div className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">Total ARR</div>
          <div className="text-2xl font-bold text-white">${(calculatedSummary.totalArr / 1000000).toFixed(1)}M</div>
        </div>
        <div className="bg-cscx-gray-700/30 rounded-lg p-4">
          <div className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">Avg Health Score</div>
          <div className={`text-2xl font-bold ${
            calculatedSummary.avgHealthScore >= 70 ? 'text-emerald-400' :
            calculatedSummary.avgHealthScore >= 50 ? 'text-amber-400' : 'text-red-400'
          }`}>{calculatedSummary.avgHealthScore}</div>
        </div>
      </div>

      {/* Health Distribution */}
      <div className="bg-cscx-gray-700/30 rounded-lg p-4">
        <div className="text-sm font-medium text-white mb-3">Customer Health Distribution</div>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-4 rounded-full overflow-hidden bg-cscx-gray-600 flex">
            {calculatedSummary.totalCustomers > 0 && (
              <>
                <div
                  className="bg-emerald-500 h-full"
                  style={{ width: `${(calculatedSummary.healthyCount / (calculatedSummary.healthyCount + calculatedSummary.atRiskCount + calculatedSummary.criticalCount)) * 100}%` }}
                />
                <div
                  className="bg-amber-500 h-full"
                  style={{ width: `${(calculatedSummary.atRiskCount / (calculatedSummary.healthyCount + calculatedSummary.atRiskCount + calculatedSummary.criticalCount)) * 100}%` }}
                />
                <div
                  className="bg-red-500 h-full"
                  style={{ width: `${(calculatedSummary.criticalCount / (calculatedSummary.healthyCount + calculatedSummary.atRiskCount + calculatedSummary.criticalCount)) * 100}%` }}
                />
              </>
            )}
          </div>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-emerald-400">Healthy: {calculatedSummary.healthyCount}</span>
          <span className="text-amber-400">At Risk: {calculatedSummary.atRiskCount}</span>
          <span className="text-red-400">Critical: {calculatedSummary.criticalCount}</span>
        </div>
      </div>

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-cscx-gray-700/30 rounded-lg p-4">
          <div className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">Renewal Rate</div>
          <div className="text-xl font-bold text-emerald-400">{calculatedSummary.renewalRate}%</div>
          {editedData.filters.showBenchmarks && (
            <div className="text-xs text-cscx-gray-500 mt-1">Benchmark: 90%</div>
          )}
        </div>
        <div className="bg-cscx-gray-700/30 rounded-lg p-4">
          <div className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">Expansion Rate</div>
          <div className="text-xl font-bold text-blue-400">{calculatedSummary.expansionRate}%</div>
          {editedData.filters.showBenchmarks && (
            <div className="text-xs text-cscx-gray-500 mt-1">Benchmark: 15%</div>
          )}
        </div>
        <div className="bg-cscx-gray-700/30 rounded-lg p-4">
          <div className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">Churn Rate</div>
          <div className={`text-xl font-bold ${
            calculatedSummary.churnRate <= 5 ? 'text-emerald-400' :
            calculatedSummary.churnRate <= 10 ? 'text-amber-400' : 'text-red-400'
          }`}>{calculatedSummary.churnRate}%</div>
          {editedData.filters.showBenchmarks && (
            <div className="text-xs text-cscx-gray-500 mt-1">Benchmark: &lt;5%</div>
          )}
        </div>
        <div className="bg-cscx-gray-700/30 rounded-lg p-4">
          <div className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">Average NPS</div>
          <div className={`text-xl font-bold ${
            calculatedSummary.avgNps >= 40 ? 'text-emerald-400' :
            calculatedSummary.avgNps >= 20 ? 'text-amber-400' : 'text-red-400'
          }`}>{calculatedSummary.avgNps}</div>
          {editedData.filters.showBenchmarks && (
            <div className="text-xs text-cscx-gray-500 mt-1">Benchmark: 40</div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-cscx-gray-300 mb-2">Notes</label>
        <textarea
          value={editedData.notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 bg-cscx-gray-700/50 border border-cscx-gray-600 rounded-lg text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          rows={3}
          placeholder="Add notes about this report..."
        />
      </div>
    </div>
  );

  const renderCsmsTab = () => (
    <div className="space-y-4">
      {/* Bulk Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-cscx-gray-400">
          Showing {filteredCsms.length} of {editedData.csms.length} CSMs
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => toggleAllCsms(true)}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            Select All
          </button>
          <span className="text-cscx-gray-600">|</span>
          <button
            onClick={() => toggleAllCsms(false)}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* CSM Cards */}
      <div className="space-y-3">
        {editedData.csms.map((csm) => (
          <div
            key={csm.id}
            className={`bg-cscx-gray-700/30 rounded-lg p-4 border ${
              csm.enabled ? 'border-indigo-500/30' : 'border-cscx-gray-600/30 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={csm.enabled}
                  onChange={() => toggleCsmEnabled(csm.id)}
                  className="w-4 h-4 rounded border-cscx-gray-500 bg-cscx-gray-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                />
                <div>
                  <div className="text-white font-medium">{csm.name}</div>
                  <div className="text-xs text-cscx-gray-500">{csm.email}</div>
                </div>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                csm.avgHealthScore >= 70 ? 'bg-emerald-500/20 text-emerald-400' :
                csm.avgHealthScore >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
              }`}>
                Health: {csm.avgHealthScore}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-cscx-gray-500 text-xs">Customers</div>
                <div className="text-white font-medium">{csm.customerCount}</div>
              </div>
              <div>
                <div className="text-cscx-gray-500 text-xs">ARR</div>
                <div className="text-white font-medium">${(csm.totalArr / 1000000).toFixed(2)}M</div>
              </div>
              <div>
                <div className="text-cscx-gray-500 text-xs">Renewal Rate</div>
                <div className={`font-medium ${csm.renewalRate >= 90 ? 'text-emerald-400' : csm.renewalRate >= 80 ? 'text-amber-400' : 'text-red-400'}`}>
                  {csm.renewalRate}%
                </div>
              </div>
              <div>
                <div className="text-cscx-gray-500 text-xs">NPS</div>
                <div className="text-white font-medium">{csm.npsScore ?? 'N/A'}</div>
              </div>
            </div>

            {/* Health Distribution Mini */}
            <div className="mt-3 pt-3 border-t border-cscx-gray-600/30">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-emerald-400">● {csm.healthyCount} Healthy</span>
                <span className="text-amber-400">● {csm.atRiskCount} At Risk</span>
                <span className="text-red-400">● {csm.criticalCount} Critical</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderMetricsTab = () => (
    <div className="space-y-4">
      <div className="text-sm text-cscx-gray-400 mb-4">
        Select which metrics to include in the report
      </div>

      <div className="space-y-3">
        {editedData.metrics.map((metric) => (
          <div
            key={metric.id}
            className={`bg-cscx-gray-700/30 rounded-lg p-4 border ${
              metric.enabled ? 'border-indigo-500/30' : 'border-cscx-gray-600/30 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={metric.enabled}
                  onChange={() => toggleMetricEnabled(metric.id)}
                  className="w-4 h-4 rounded border-cscx-gray-500 bg-cscx-gray-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                />
                <div>
                  <div className="text-white font-medium flex items-center gap-2">
                    {metric.name}
                    <span className={TREND_ICONS[metric.trend].color}>
                      {TREND_ICONS[metric.trend].icon}
                    </span>
                  </div>
                  <div className="text-xs text-cscx-gray-500">{metric.description}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-medium">
                  {metric.unit === '$' ? `$${(metric.value / 1000000).toFixed(1)}M` : `${metric.value}${metric.unit}`}
                </div>
                {editedData.filters.showBenchmarks && metric.benchmark !== null && (
                  <div className="text-xs text-cscx-gray-500">
                    Benchmark: {metric.unit === '$' ? `$${(metric.benchmark / 1000000).toFixed(1)}M` : `${metric.benchmark}${metric.unit}`}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderFiltersTab = () => (
    <div className="space-y-6">
      {/* Time Range */}
      <div>
        <label className="block text-sm font-medium text-cscx-gray-300 mb-2">Time Range</label>
        <div className="flex flex-wrap gap-2">
          {TIME_RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => setTimeRange(option)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                editedData.filters.timeRange.type === option
                  ? 'bg-indigo-600 text-white'
                  : 'bg-cscx-gray-700/50 text-cscx-gray-300 hover:bg-cscx-gray-700'
              }`}
            >
              {TIME_RANGE_LABELS[option]}
            </button>
          ))}
        </div>

        {/* Custom Date Range */}
        {editedData.filters.timeRange.type === 'custom' && (
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-cscx-gray-500 mb-1">Start Date</label>
              <input
                type="date"
                value={editedData.filters.timeRange.startDate || ''}
                onChange={(e) => setCustomDateRange('startDate', e.target.value)}
                className="w-full px-3 py-2 bg-cscx-gray-700/50 border border-cscx-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-cscx-gray-500 mb-1">End Date</label>
              <input
                type="date"
                value={editedData.filters.timeRange.endDate || ''}
                onChange={(e) => setCustomDateRange('endDate', e.target.value)}
                className="w-full px-3 py-2 bg-cscx-gray-700/50 border border-cscx-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* CSM Filter */}
      <div>
        <label className="block text-sm font-medium text-cscx-gray-300 mb-2">Filter by CSM</label>
        <div className="flex flex-wrap gap-2">
          {editedData.availableCsms.map((csm) => (
            <button
              key={csm.id}
              onClick={() => toggleCsmFilter(csm.id)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                editedData.filters.csms.includes(csm.id)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-cscx-gray-700/50 text-cscx-gray-300 hover:bg-cscx-gray-700'
              }`}
            >
              {csm.name}
            </button>
          ))}
        </div>
      </div>

      {/* Sort Options */}
      <div>
        <label className="block text-sm font-medium text-cscx-gray-300 mb-2">Sort By</label>
        <div className="flex items-center gap-4">
          <select
            value={editedData.filters.sortBy}
            onChange={(e) => setSortBy(e.target.value as TeamMetricsFilters['sortBy'])}
            className="flex-1 px-3 py-2 bg-cscx-gray-700/50 border border-cscx-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {SORT_BY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {SORT_BY_LABELS[option]}
              </option>
            ))}
          </select>
          <button
            onClick={toggleSortDirection}
            className="p-2 bg-cscx-gray-700/50 border border-cscx-gray-600 rounded-lg text-white hover:bg-cscx-gray-700"
          >
            {editedData.filters.sortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Show Benchmarks Toggle */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={editedData.filters.showBenchmarks}
            onChange={toggleShowBenchmarks}
            className="w-4 h-4 rounded border-cscx-gray-500 bg-cscx-gray-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
          />
          <span className="text-sm text-cscx-gray-300">Show benchmark comparisons</span>
        </label>
      </div>
    </div>
  );

  const renderColumnsTab = () => (
    <div className="space-y-4">
      <div className="text-sm text-cscx-gray-400 mb-4">
        Select which columns to include in the exported spreadsheet
      </div>

      <div className="space-y-2">
        {editedData.columns.map((column) => (
          <label
            key={column.id}
            className="flex items-center justify-between p-3 bg-cscx-gray-700/30 rounded-lg cursor-pointer hover:bg-cscx-gray-700/50"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={column.enabled}
                onChange={() => toggleColumnEnabled(column.id)}
                className="w-4 h-4 rounded border-cscx-gray-500 bg-cscx-gray-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
              />
              <span className="text-white text-sm">{column.name}</span>
            </div>
            {column.width && (
              <span className="text-xs text-cscx-gray-500">{column.width}</span>
            )}
          </label>
        ))}
      </div>
    </div>
  );

  // ============================================
  // Main Render
  // ============================================
  return (
    <div className="bg-cscx-gray-800 rounded-xl overflow-hidden border border-indigo-500/30">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600/20 to-blue-600/20 border-b border-indigo-500/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <h3 className="text-lg font-semibold text-white">{editedData.title}</h3>
              <p className="text-sm text-indigo-300">
                {TIME_RANGE_LABELS[editedData.filters.timeRange.type]} • {calculatedSummary.totalCsms} CSMs • ${(calculatedSummary.totalArr / 1000000).toFixed(1)}M ARR
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-xs text-amber-400">Unsaved changes</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {(['overview', 'csms', 'metrics', 'filters', 'columns'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white'
                  : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-700/50'
              }`}
            >
              {tab === 'csms' ? 'CSMs' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[60vh] overflow-y-auto">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'csms' && renderCsmsTab()}
        {activeTab === 'metrics' && renderMetricsTab()}
        {activeTab === 'filters' && renderFiltersTab()}
        {activeTab === 'columns' && renderColumnsTab()}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-cscx-gray-800 border-t border-cscx-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-cscx-gray-500">
            Last updated: {editedData.lastUpdated}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-cscx-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Generating...
                </>
              ) : (
                <>
                  📄 Generate Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CADGTeamMetricsPreview;
