/**
 * CADGRenewalPipelinePreview - Editable renewal pipeline preview for CADG-generated pipelines
 * Allows users to filter, sort, and customize renewal views before exporting to Google Sheets
 * Works in General Mode - no specific customer context required
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface RenewalPipelineEntry {
  id: string;
  customerName: string;
  arr: number;
  renewalDate: string;
  daysUntilRenewal: number;
  probability: number;
  healthScore: number;
  owner: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  tier: string;
  segment: string;
  npsScore: number | null;
  lastContactDate: string;
  enabled: boolean;
}

export interface RenewalPipelineSummary {
  totalRenewals: number;
  totalArr: number;
  avgProbability: number;
  avgHealthScore: number;
  lowRiskCount: number;
  mediumRiskCount: number;
  highRiskCount: number;
  criticalRiskCount: number;
  renewingThisMonth: number;
  renewingThisMonthArr: number;
  renewingThisQuarter: number;
  renewingThisQuarterArr: number;
}

export interface RenewalPipelineFilters {
  riskLevels: ('low' | 'medium' | 'high' | 'critical')[];
  owners: string[];
  tiers: string[];
  segments: string[];
  dateRange: {
    type: 'all' | 'this_month' | 'this_quarter' | 'next_quarter' | 'next_6_months' | 'this_year' | 'custom';
    startDate?: string;
    endDate?: string;
  };
  arrThreshold: {
    min: number | null;
    max: number | null;
  };
  groupBy: 'none' | 'month' | 'quarter' | 'owner' | 'risk_level' | 'tier';
  sortBy: 'renewal_date' | 'arr' | 'probability' | 'health' | 'customer_name';
  sortDirection: 'asc' | 'desc';
}

export interface RenewalPipelineColumn {
  id: string;
  name: string;
  enabled: boolean;
  width?: string;
}

export interface RenewalPipelineData {
  title: string;
  createdDate: string;
  lastUpdated: string;
  summary: RenewalPipelineSummary;
  renewals: RenewalPipelineEntry[];
  filters: RenewalPipelineFilters;
  columns: RenewalPipelineColumn[];
  availableOwners: string[];
  availableTiers: string[];
  availableSegments: string[];
  notes: string;
}

interface CADGRenewalPipelinePreviewProps {
  pipeline: RenewalPipelineData;
  onSave: (pipeline: RenewalPipelineData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Options
// ============================================
const RISK_LEVEL_OPTIONS: ('low' | 'medium' | 'high' | 'critical')[] = ['low', 'medium', 'high', 'critical'];
const DATE_RANGE_OPTIONS = ['all', 'this_month', 'this_quarter', 'next_quarter', 'next_6_months', 'this_year', 'custom'] as const;
const GROUP_BY_OPTIONS = ['none', 'month', 'quarter', 'owner', 'risk_level', 'tier'] as const;
const SORT_BY_OPTIONS = ['renewal_date', 'arr', 'probability', 'health', 'customer_name'] as const;

const RISK_LABELS: Record<string, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  critical: 'Critical',
};

const RISK_COLORS: Record<string, string> = {
  low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const DATE_RANGE_LABELS: Record<string, string> = {
  all: 'All Time',
  this_month: 'This Month',
  this_quarter: 'This Quarter',
  next_quarter: 'Next Quarter',
  next_6_months: 'Next 6 Months',
  this_year: 'This Year',
  custom: 'Custom Range',
};

const GROUP_BY_LABELS: Record<string, string> = {
  none: 'No Grouping',
  month: 'By Month',
  quarter: 'By Quarter',
  owner: 'By Owner',
  risk_level: 'By Risk Level',
  tier: 'By Tier',
};

const SORT_BY_LABELS: Record<string, string> = {
  renewal_date: 'Renewal Date',
  arr: 'ARR',
  probability: 'Probability',
  health: 'Health Score',
  customer_name: 'Customer Name',
};

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Component
// ============================================

export const CADGRenewalPipelinePreview: React.FC<CADGRenewalPipelinePreviewProps> = ({
  pipeline,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();
  const [editedPipeline, setEditedPipeline] = useState<RenewalPipelineData>({ ...pipeline });
  const [activeTab, setActiveTab] = useState<'overview' | 'renewals' | 'filters' | 'columns'>('overview');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Filter and sort renewals based on current filters
  const filteredRenewals = useMemo(() => {
    let result = editedPipeline.renewals.filter(r => r.enabled);

    // Apply risk level filter
    if (editedPipeline.filters.riskLevels.length > 0) {
      result = result.filter(r => editedPipeline.filters.riskLevels.includes(r.riskLevel));
    }

    // Apply owner filter
    if (editedPipeline.filters.owners.length > 0) {
      result = result.filter(r => editedPipeline.filters.owners.includes(r.owner));
    }

    // Apply tier filter
    if (editedPipeline.filters.tiers.length > 0) {
      result = result.filter(r => editedPipeline.filters.tiers.includes(r.tier));
    }

    // Apply segment filter
    if (editedPipeline.filters.segments.length > 0) {
      result = result.filter(r => editedPipeline.filters.segments.includes(r.segment));
    }

    // Apply ARR threshold
    if (editedPipeline.filters.arrThreshold.min !== null) {
      result = result.filter(r => r.arr >= (editedPipeline.filters.arrThreshold.min || 0));
    }
    if (editedPipeline.filters.arrThreshold.max !== null) {
      result = result.filter(r => r.arr <= (editedPipeline.filters.arrThreshold.max || Infinity));
    }

    // Apply date range filter
    const now = new Date();
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const quarterEnd = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
    const nextQuarterEnd = new Date(now.getFullYear(), (currentQuarter + 2) * 3, 0);
    const sixMonthsEnd = new Date(now.getFullYear(), now.getMonth() + 6, 0);
    const yearEnd = new Date(now.getFullYear(), 11, 31);

    switch (editedPipeline.filters.dateRange.type) {
      case 'this_month':
        result = result.filter(r => new Date(r.renewalDate) <= thisMonthEnd);
        break;
      case 'this_quarter':
        result = result.filter(r => new Date(r.renewalDate) <= quarterEnd);
        break;
      case 'next_quarter':
        result = result.filter(r => {
          const d = new Date(r.renewalDate);
          return d > quarterEnd && d <= nextQuarterEnd;
        });
        break;
      case 'next_6_months':
        result = result.filter(r => new Date(r.renewalDate) <= sixMonthsEnd);
        break;
      case 'this_year':
        result = result.filter(r => new Date(r.renewalDate) <= yearEnd);
        break;
      case 'custom':
        if (editedPipeline.filters.dateRange.startDate) {
          result = result.filter(r => new Date(r.renewalDate) >= new Date(editedPipeline.filters.dateRange.startDate!));
        }
        if (editedPipeline.filters.dateRange.endDate) {
          result = result.filter(r => new Date(r.renewalDate) <= new Date(editedPipeline.filters.dateRange.endDate!));
        }
        break;
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (editedPipeline.filters.sortBy) {
        case 'renewal_date':
          comparison = new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime();
          break;
        case 'arr':
          comparison = a.arr - b.arr;
          break;
        case 'probability':
          comparison = a.probability - b.probability;
          break;
        case 'health':
          comparison = a.healthScore - b.healthScore;
          break;
        case 'customer_name':
          comparison = a.customerName.localeCompare(b.customerName);
          break;
      }
      return editedPipeline.filters.sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [editedPipeline.renewals, editedPipeline.filters]);

  // Calculate live summary based on filtered renewals
  const liveSummary = useMemo(() => {
    const now = new Date();
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const quarterEnd = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);

    return {
      totalRenewals: filteredRenewals.length,
      totalArr: filteredRenewals.reduce((sum, r) => sum + r.arr, 0),
      avgProbability: filteredRenewals.length > 0
        ? Math.round(filteredRenewals.reduce((sum, r) => sum + r.probability, 0) / filteredRenewals.length)
        : 0,
      avgHealthScore: filteredRenewals.length > 0
        ? Math.round(filteredRenewals.reduce((sum, r) => sum + r.healthScore, 0) / filteredRenewals.length)
        : 0,
      lowRiskCount: filteredRenewals.filter(r => r.riskLevel === 'low').length,
      mediumRiskCount: filteredRenewals.filter(r => r.riskLevel === 'medium').length,
      highRiskCount: filteredRenewals.filter(r => r.riskLevel === 'high').length,
      criticalRiskCount: filteredRenewals.filter(r => r.riskLevel === 'critical').length,
      renewingThisMonth: filteredRenewals.filter(r => new Date(r.renewalDate) <= thisMonthEnd).length,
      renewingThisMonthArr: filteredRenewals.filter(r => new Date(r.renewalDate) <= thisMonthEnd).reduce((sum, r) => sum + r.arr, 0),
      renewingThisQuarter: filteredRenewals.filter(r => new Date(r.renewalDate) <= quarterEnd).length,
      renewingThisQuarterArr: filteredRenewals.filter(r => new Date(r.renewalDate) <= quarterEnd).reduce((sum, r) => sum + r.arr, 0),
    };
  }, [filteredRenewals]);

  // Handlers
  const markChanged = () => setHasChanges(true);

  const toggleRenewal = (id: string) => {
    setEditedPipeline(prev => ({
      ...prev,
      renewals: prev.renewals.map(r =>
        r.id === id ? { ...r, enabled: !r.enabled } : r
      ),
    }));
    markChanged();
  };

  const toggleAllRenewals = (enabled: boolean) => {
    setEditedPipeline(prev => ({
      ...prev,
      renewals: prev.renewals.map(r => ({ ...r, enabled })),
    }));
    markChanged();
  };

  const toggleRiskLevel = (level: 'low' | 'medium' | 'high' | 'critical') => {
    setEditedPipeline(prev => {
      const levels = prev.filters.riskLevels.includes(level)
        ? prev.filters.riskLevels.filter(l => l !== level)
        : [...prev.filters.riskLevels, level];
      return {
        ...prev,
        filters: { ...prev.filters, riskLevels: levels },
      };
    });
    markChanged();
  };

  const toggleOwner = (owner: string) => {
    setEditedPipeline(prev => {
      const owners = prev.filters.owners.includes(owner)
        ? prev.filters.owners.filter(o => o !== owner)
        : [...prev.filters.owners, owner];
      return {
        ...prev,
        filters: { ...prev.filters, owners },
      };
    });
    markChanged();
  };

  const toggleTier = (tier: string) => {
    setEditedPipeline(prev => {
      const tiers = prev.filters.tiers.includes(tier)
        ? prev.filters.tiers.filter(t => t !== tier)
        : [...prev.filters.tiers, tier];
      return {
        ...prev,
        filters: { ...prev.filters, tiers },
      };
    });
    markChanged();
  };

  const toggleSegment = (segment: string) => {
    setEditedPipeline(prev => {
      const segments = prev.filters.segments.includes(segment)
        ? prev.filters.segments.filter(s => s !== segment)
        : [...prev.filters.segments, segment];
      return {
        ...prev,
        filters: { ...prev.filters, segments },
      };
    });
    markChanged();
  };

  const setDateRange = (type: typeof DATE_RANGE_OPTIONS[number]) => {
    setEditedPipeline(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        dateRange: { ...prev.filters.dateRange, type },
      },
    }));
    markChanged();
  };

  const setGroupBy = (groupBy: typeof GROUP_BY_OPTIONS[number]) => {
    setEditedPipeline(prev => ({
      ...prev,
      filters: { ...prev.filters, groupBy },
    }));
    markChanged();
  };

  const setSortBy = (sortBy: typeof SORT_BY_OPTIONS[number]) => {
    setEditedPipeline(prev => ({
      ...prev,
      filters: { ...prev.filters, sortBy },
    }));
    markChanged();
  };

  const toggleSortDirection = () => {
    setEditedPipeline(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        sortDirection: prev.filters.sortDirection === 'asc' ? 'desc' : 'asc',
      },
    }));
    markChanged();
  };

  const setArrMin = (min: number | null) => {
    setEditedPipeline(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        arrThreshold: { ...prev.filters.arrThreshold, min },
      },
    }));
    markChanged();
  };

  const setArrMax = (max: number | null) => {
    setEditedPipeline(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        arrThreshold: { ...prev.filters.arrThreshold, max },
      },
    }));
    markChanged();
  };

  const toggleColumn = (id: string) => {
    setEditedPipeline(prev => ({
      ...prev,
      columns: prev.columns.map(c =>
        c.id === id ? { ...c, enabled: !c.enabled } : c
      ),
    }));
    markChanged();
  };

  const setNotes = (notes: string) => {
    setEditedPipeline(prev => ({ ...prev, notes }));
    markChanged();
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        ...editedPipeline,
        summary: liveSummary,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges && !window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
      return;
    }
    onCancel();
  };

  // Format helpers
  const formatCurrency = (value: number) => `$${value.toLocaleString()}`;
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Risk distribution for progress bar
  const riskTotal = liveSummary.lowRiskCount + liveSummary.mediumRiskCount + liveSummary.highRiskCount + liveSummary.criticalRiskCount;
  const lowPct = riskTotal > 0 ? (liveSummary.lowRiskCount / riskTotal) * 100 : 0;
  const mediumPct = riskTotal > 0 ? (liveSummary.mediumRiskCount / riskTotal) * 100 : 0;
  const highPct = riskTotal > 0 ? (liveSummary.highRiskCount / riskTotal) * 100 : 0;
  const criticalPct = riskTotal > 0 ? (liveSummary.criticalRiskCount / riskTotal) * 100 : 0;

  return (
    <div className="bg-cscx-gray-800 rounded-lg overflow-hidden border border-gray-700">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-teal-600/20 to-cyan-600/20 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-xl">📊</span>
              Renewal Pipeline Preview
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Review and customize your renewal pipeline before exporting
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 text-sm bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Saving...
                </>
              ) : (
                <>
                  <span>💾</span>
                  Save Pipeline
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {(['overview', 'renewals', 'filters', 'columns'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-teal-600/30 text-teal-300 border border-teal-500/40'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Total Renewals</p>
                <p className="text-2xl font-bold text-white">{liveSummary.totalRenewals}</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Total ARR</p>
                <p className="text-2xl font-bold text-teal-400">{formatCurrency(liveSummary.totalArr)}</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Avg Probability</p>
                <p className="text-2xl font-bold text-white">{liveSummary.avgProbability}%</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Avg Health</p>
                <p className="text-2xl font-bold text-white">{liveSummary.avgHealthScore}/100</p>
              </div>
            </div>

            {/* Risk Distribution */}
            <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
              <h4 className="text-sm font-medium text-white mb-3">Risk Distribution</h4>
              <div className="flex h-4 rounded-full overflow-hidden bg-gray-800">
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${lowPct}%` }}
                  title={`Low Risk: ${liveSummary.lowRiskCount}`}
                />
                <div
                  className="bg-amber-500 transition-all"
                  style={{ width: `${mediumPct}%` }}
                  title={`Medium Risk: ${liveSummary.mediumRiskCount}`}
                />
                <div
                  className="bg-orange-500 transition-all"
                  style={{ width: `${highPct}%` }}
                  title={`High Risk: ${liveSummary.highRiskCount}`}
                />
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${criticalPct}%` }}
                  title={`Critical: ${liveSummary.criticalRiskCount}`}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-emerald-400">Low: {liveSummary.lowRiskCount}</span>
                <span className="text-amber-400">Medium: {liveSummary.mediumRiskCount}</span>
                <span className="text-orange-400">High: {liveSummary.highRiskCount}</span>
                <span className="text-red-400">Critical: {liveSummary.criticalRiskCount}</span>
              </div>
            </div>

            {/* Time-Based Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                <p className="text-xs text-gray-400 uppercase tracking-wide">This Month</p>
                <p className="text-xl font-bold text-white">{liveSummary.renewingThisMonth} renewals</p>
                <p className="text-sm text-teal-400">{formatCurrency(liveSummary.renewingThisMonthArr)}</p>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                <p className="text-xs text-gray-400 uppercase tracking-wide">This Quarter</p>
                <p className="text-xl font-bold text-white">{liveSummary.renewingThisQuarter} renewals</p>
                <p className="text-sm text-teal-400">{formatCurrency(liveSummary.renewingThisQuarterArr)}</p>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
              <label className="text-xs text-gray-400 uppercase tracking-wide block mb-2">Notes</label>
              <textarea
                value={editedPipeline.notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add notes about this renewal pipeline..."
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500"
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Renewals Tab */}
        {activeTab === 'renewals' && (
          <div className="space-y-3">
            {/* Bulk Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleAllRenewals(true)}
                  className="px-2 py-1 text-xs text-teal-400 hover:text-teal-300 hover:bg-teal-900/30 rounded transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={() => toggleAllRenewals(false)}
                  className="px-2 py-1 text-xs text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 rounded transition-colors"
                >
                  Clear All
                </button>
              </div>
              <p className="text-xs text-gray-400">
                {filteredRenewals.length} of {editedPipeline.renewals.length} renewals shown
              </p>
            </div>

            {/* Renewal Cards */}
            {filteredRenewals.map(renewal => (
              <div
                key={renewal.id}
                className={`bg-gray-900/50 rounded-lg border transition-all ${
                  renewal.enabled ? 'border-gray-700' : 'border-gray-800 opacity-50'
                }`}
              >
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={renewal.enabled}
                        onChange={() => toggleRenewal(renewal.id)}
                        className="w-4 h-4 rounded border-gray-600 text-teal-500 focus:ring-teal-500 focus:ring-offset-gray-800"
                      />
                      <div>
                        <p className="font-medium text-white">{renewal.customerName}</p>
                        <p className="text-xs text-gray-400">{renewal.tier} • {renewal.segment}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 text-xs rounded border ${RISK_COLORS[renewal.riskLevel]}`}>
                        {RISK_LABELS[renewal.riskLevel]}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500">ARR</p>
                      <p className="text-teal-400 font-medium">{formatCurrency(renewal.arr)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Renewal</p>
                      <p className="text-white">{formatDate(renewal.renewalDate)}</p>
                      <p className="text-gray-400">{renewal.daysUntilRenewal} days</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Probability</p>
                      <p className={`font-medium ${
                        renewal.probability >= 80 ? 'text-emerald-400' :
                        renewal.probability >= 60 ? 'text-amber-400' :
                        'text-red-400'
                      }`}>{renewal.probability}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Health</p>
                      <p className={`font-medium ${
                        renewal.healthScore >= 70 ? 'text-emerald-400' :
                        renewal.healthScore >= 50 ? 'text-amber-400' :
                        'text-red-400'
                      }`}>{renewal.healthScore}/100</p>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-gray-500">Owner: <span className="text-gray-300">{renewal.owner}</span></span>
                    <span className="text-gray-500">Last Contact: <span className="text-gray-300">{formatDate(renewal.lastContactDate)}</span></span>
                  </div>
                </div>
              </div>
            ))}

            {filteredRenewals.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <p>No renewals match the current filters</p>
              </div>
            )}
          </div>
        )}

        {/* Filters Tab */}
        {activeTab === 'filters' && (
          <div className="space-y-4">
            {/* Date Range */}
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
              <label className="text-xs text-gray-400 uppercase tracking-wide block mb-2">Date Range</label>
              <div className="flex flex-wrap gap-2">
                {DATE_RANGE_OPTIONS.map(option => (
                  <button
                    key={option}
                    onClick={() => setDateRange(option)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      editedPipeline.filters.dateRange.type === option
                        ? 'bg-teal-600/30 text-teal-300 border-teal-500/40'
                        : 'text-gray-400 border-gray-600 hover:text-white hover:border-gray-500'
                    }`}
                  >
                    {DATE_RANGE_LABELS[option]}
                  </button>
                ))}
              </div>
              {editedPipeline.filters.dateRange.type === 'custom' && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="date"
                    value={editedPipeline.filters.dateRange.startDate || ''}
                    onChange={e => {
                      setEditedPipeline(prev => ({
                        ...prev,
                        filters: {
                          ...prev.filters,
                          dateRange: { ...prev.filters.dateRange, startDate: e.target.value },
                        },
                      }));
                      markChanged();
                    }}
                    className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                  />
                  <span className="text-gray-400 self-center">to</span>
                  <input
                    type="date"
                    value={editedPipeline.filters.dateRange.endDate || ''}
                    onChange={e => {
                      setEditedPipeline(prev => ({
                        ...prev,
                        filters: {
                          ...prev.filters,
                          dateRange: { ...prev.filters.dateRange, endDate: e.target.value },
                        },
                      }));
                      markChanged();
                    }}
                    className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                  />
                </div>
              )}
            </div>

            {/* Risk Levels */}
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
              <label className="text-xs text-gray-400 uppercase tracking-wide block mb-2">Risk Levels</label>
              <div className="flex flex-wrap gap-2">
                {RISK_LEVEL_OPTIONS.map(level => (
                  <button
                    key={level}
                    onClick={() => toggleRiskLevel(level)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      editedPipeline.filters.riskLevels.includes(level)
                        ? RISK_COLORS[level]
                        : 'text-gray-500 border-gray-700 hover:text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    {RISK_LABELS[level]}
                  </button>
                ))}
              </div>
            </div>

            {/* ARR Threshold */}
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
              <label className="text-xs text-gray-400 uppercase tracking-wide block mb-2">ARR Threshold</label>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Min</label>
                  <input
                    type="number"
                    placeholder="No minimum"
                    value={editedPipeline.filters.arrThreshold.min ?? ''}
                    onChange={e => setArrMin(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500"
                  />
                </div>
                <span className="text-gray-500 mt-5">-</span>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Max</label>
                  <input
                    type="number"
                    placeholder="No maximum"
                    value={editedPipeline.filters.arrThreshold.max ?? ''}
                    onChange={e => setArrMax(e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500"
                  />
                </div>
              </div>
            </div>

            {/* Owners */}
            {editedPipeline.availableOwners.length > 0 && (
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                <label className="text-xs text-gray-400 uppercase tracking-wide block mb-2">Owners</label>
                <div className="flex flex-wrap gap-2">
                  {editedPipeline.availableOwners.map(owner => (
                    <button
                      key={owner}
                      onClick={() => toggleOwner(owner)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        editedPipeline.filters.owners.includes(owner)
                          ? 'bg-teal-600/30 text-teal-300 border-teal-500/40'
                          : 'text-gray-400 border-gray-600 hover:text-white hover:border-gray-500'
                      }`}
                    >
                      {owner}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tiers */}
            {editedPipeline.availableTiers.length > 0 && (
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                <label className="text-xs text-gray-400 uppercase tracking-wide block mb-2">Tiers</label>
                <div className="flex flex-wrap gap-2">
                  {editedPipeline.availableTiers.map(tier => (
                    <button
                      key={tier}
                      onClick={() => toggleTier(tier)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        editedPipeline.filters.tiers.includes(tier)
                          ? 'bg-teal-600/30 text-teal-300 border-teal-500/40'
                          : 'text-gray-400 border-gray-600 hover:text-white hover:border-gray-500'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Group By */}
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
              <label className="text-xs text-gray-400 uppercase tracking-wide block mb-2">Group By</label>
              <div className="flex flex-wrap gap-2">
                {GROUP_BY_OPTIONS.map(option => (
                  <button
                    key={option}
                    onClick={() => setGroupBy(option)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      editedPipeline.filters.groupBy === option
                        ? 'bg-teal-600/30 text-teal-300 border-teal-500/40'
                        : 'text-gray-400 border-gray-600 hover:text-white hover:border-gray-500'
                    }`}
                  >
                    {GROUP_BY_LABELS[option]}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort By */}
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
              <label className="text-xs text-gray-400 uppercase tracking-wide block mb-2">Sort By</label>
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap gap-2 flex-1">
                  {SORT_BY_OPTIONS.map(option => (
                    <button
                      key={option}
                      onClick={() => setSortBy(option)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        editedPipeline.filters.sortBy === option
                          ? 'bg-teal-600/30 text-teal-300 border-teal-500/40'
                          : 'text-gray-400 border-gray-600 hover:text-white hover:border-gray-500'
                      }`}
                    >
                      {SORT_BY_LABELS[option]}
                    </button>
                  ))}
                </div>
                <button
                  onClick={toggleSortDirection}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  {editedPipeline.filters.sortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Columns Tab */}
        {activeTab === 'columns' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Select which columns to include in the export
            </p>
            <div className="grid grid-cols-2 gap-2">
              {editedPipeline.columns.map(col => (
                <button
                  key={col.id}
                  onClick={() => toggleColumn(col.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${
                    col.enabled
                      ? 'bg-teal-600/20 text-teal-300 border-teal-500/40'
                      : 'text-gray-400 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <span className={col.enabled ? 'text-teal-400' : 'text-gray-500'}>
                    {col.enabled ? '✓' : '○'}
                  </span>
                  <span className="text-sm">{col.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CADGRenewalPipelinePreview;
