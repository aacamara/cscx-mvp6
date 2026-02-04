/**
 * CADGAtRiskOverviewPreview - Editable at-risk customer overview for CADG-generated overviews
 * Allows users to filter, sort, and customize at-risk customer views before exporting to Google Sheets
 * Works in General Mode - no specific customer context required
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface AtRiskCustomerEntry {
  id: string;
  customerName: string;
  arr: number;
  healthScore: number;
  riskLevel: 'medium' | 'high' | 'critical';
  riskScore: number;
  primaryRiskFactors: string[];
  daysAtRisk: number;
  owner: string;
  tier: string;
  segment: string;
  renewalDate: string | null;
  daysUntilRenewal: number | null;
  lastContactDate: string;
  hasSavePlay: boolean;
  savePlayStatus: 'active' | 'completed' | 'none';
  npsScore: number | null;
  enabled: boolean;
}

export interface AtRiskSummary {
  totalAtRisk: number;
  totalArrAtRisk: number;
  avgRiskScore: number;
  avgHealthScore: number;
  mediumRiskCount: number;
  highRiskCount: number;
  criticalRiskCount: number;
  withSavePlayCount: number;
  withoutSavePlayCount: number;
  renewingWithin30Days: number;
  renewingWithin30DaysArr: number;
  renewingWithin90Days: number;
  renewingWithin90DaysArr: number;
}

export interface AtRiskFilters {
  riskLevels: ('medium' | 'high' | 'critical')[];
  riskThreshold: number;
  owners: string[];
  tiers: string[];
  segments: string[];
  showSavePlaysOnly: boolean;
  showWithoutSavePlayOnly: boolean;
  renewalRange: {
    type: 'all' | 'within_30_days' | 'within_60_days' | 'within_90_days' | 'custom';
    startDate?: string;
    endDate?: string;
  };
  sortBy: 'risk_score' | 'health_score' | 'arr' | 'days_at_risk' | 'renewal_date' | 'customer_name';
  sortDirection: 'asc' | 'desc';
}

export interface AtRiskColumn {
  id: string;
  name: string;
  enabled: boolean;
  width?: string;
}

export interface AtRiskOverviewData {
  title: string;
  createdDate: string;
  lastUpdated: string;
  summary: AtRiskSummary;
  customers: AtRiskCustomerEntry[];
  filters: AtRiskFilters;
  columns: AtRiskColumn[];
  availableOwners: string[];
  availableTiers: string[];
  availableSegments: string[];
  notes: string;
}

interface CADGAtRiskOverviewPreviewProps {
  overview: AtRiskOverviewData;
  onSave: (overview: AtRiskOverviewData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Options
// ============================================
const RISK_LEVEL_OPTIONS: ('medium' | 'high' | 'critical')[] = ['medium', 'high', 'critical'];
const RENEWAL_RANGE_OPTIONS = ['all', 'within_30_days', 'within_60_days', 'within_90_days', 'custom'] as const;
const SORT_BY_OPTIONS = ['risk_score', 'health_score', 'arr', 'days_at_risk', 'renewal_date', 'customer_name'] as const;

const RISK_LABELS: Record<string, string> = {
  medium: 'Medium Risk',
  high: 'High Risk',
  critical: 'Critical',
};

const RISK_COLORS: Record<string, string> = {
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const SAVE_PLAY_LABELS: Record<string, string> = {
  active: 'Active',
  completed: 'Completed',
  none: 'No Save Play',
};

const SAVE_PLAY_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  none: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const RENEWAL_RANGE_LABELS: Record<string, string> = {
  all: 'All',
  within_30_days: 'Within 30 Days',
  within_60_days: 'Within 60 Days',
  within_90_days: 'Within 90 Days',
  custom: 'Custom Range',
};

const SORT_BY_LABELS: Record<string, string> = {
  risk_score: 'Risk Score',
  health_score: 'Health Score',
  arr: 'ARR',
  days_at_risk: 'Days at Risk',
  renewal_date: 'Renewal Date',
  customer_name: 'Customer Name',
};

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Component
// ============================================

export const CADGAtRiskOverviewPreview: React.FC<CADGAtRiskOverviewPreviewProps> = ({
  overview,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();
  const [editedOverview, setEditedOverview] = useState<AtRiskOverviewData>({ ...overview });
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'filters' | 'columns'>('overview');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Filter and sort customers based on current filters
  const filteredCustomers = useMemo(() => {
    let result = editedOverview.customers.filter(c => c.enabled);

    // Apply risk level filter
    if (editedOverview.filters.riskLevels.length > 0) {
      result = result.filter(c => editedOverview.filters.riskLevels.includes(c.riskLevel));
    }

    // Apply risk threshold filter
    result = result.filter(c => c.riskScore >= editedOverview.filters.riskThreshold);

    // Apply owner filter
    if (editedOverview.filters.owners.length > 0) {
      result = result.filter(c => editedOverview.filters.owners.includes(c.owner));
    }

    // Apply tier filter
    if (editedOverview.filters.tiers.length > 0) {
      result = result.filter(c => editedOverview.filters.tiers.includes(c.tier));
    }

    // Apply segment filter
    if (editedOverview.filters.segments.length > 0) {
      result = result.filter(c => editedOverview.filters.segments.includes(c.segment));
    }

    // Apply save play filter
    if (editedOverview.filters.showSavePlaysOnly) {
      result = result.filter(c => c.hasSavePlay);
    }
    if (editedOverview.filters.showWithoutSavePlayOnly) {
      result = result.filter(c => !c.hasSavePlay);
    }

    // Apply renewal range filter
    if (editedOverview.filters.renewalRange.type !== 'all') {
      result = result.filter(c => {
        if (c.daysUntilRenewal === null) return false;
        switch (editedOverview.filters.renewalRange.type) {
          case 'within_30_days': return c.daysUntilRenewal <= 30;
          case 'within_60_days': return c.daysUntilRenewal <= 60;
          case 'within_90_days': return c.daysUntilRenewal <= 90;
          case 'custom':
            if (editedOverview.filters.renewalRange.startDate && c.renewalDate) {
              if (c.renewalDate < editedOverview.filters.renewalRange.startDate) return false;
            }
            if (editedOverview.filters.renewalRange.endDate && c.renewalDate) {
              if (c.renewalDate > editedOverview.filters.renewalRange.endDate) return false;
            }
            return true;
          default: return true;
        }
      });
    }

    // Sort
    const sortMultiplier = editedOverview.filters.sortDirection === 'asc' ? 1 : -1;
    result.sort((a, b) => {
      switch (editedOverview.filters.sortBy) {
        case 'risk_score':
          return (a.riskScore - b.riskScore) * sortMultiplier;
        case 'health_score':
          return (a.healthScore - b.healthScore) * sortMultiplier;
        case 'arr':
          return (a.arr - b.arr) * sortMultiplier;
        case 'days_at_risk':
          return (a.daysAtRisk - b.daysAtRisk) * sortMultiplier;
        case 'renewal_date':
          const aDate = a.renewalDate || '9999-12-31';
          const bDate = b.renewalDate || '9999-12-31';
          return aDate.localeCompare(bDate) * sortMultiplier;
        case 'customer_name':
          return a.customerName.localeCompare(b.customerName) * sortMultiplier;
        default:
          return 0;
      }
    });

    return result;
  }, [editedOverview.customers, editedOverview.filters]);

  // Calculate summary from filtered customers
  const calculatedSummary = useMemo((): AtRiskSummary => {
    const enabledCustomers = filteredCustomers;
    return {
      totalAtRisk: enabledCustomers.length,
      totalArrAtRisk: enabledCustomers.reduce((sum, c) => sum + c.arr, 0),
      avgRiskScore: enabledCustomers.length > 0
        ? Math.round(enabledCustomers.reduce((sum, c) => sum + c.riskScore, 0) / enabledCustomers.length)
        : 0,
      avgHealthScore: enabledCustomers.length > 0
        ? Math.round(enabledCustomers.reduce((sum, c) => sum + c.healthScore, 0) / enabledCustomers.length)
        : 0,
      mediumRiskCount: enabledCustomers.filter(c => c.riskLevel === 'medium').length,
      highRiskCount: enabledCustomers.filter(c => c.riskLevel === 'high').length,
      criticalRiskCount: enabledCustomers.filter(c => c.riskLevel === 'critical').length,
      withSavePlayCount: enabledCustomers.filter(c => c.hasSavePlay).length,
      withoutSavePlayCount: enabledCustomers.filter(c => !c.hasSavePlay).length,
      renewingWithin30Days: enabledCustomers.filter(c => c.daysUntilRenewal !== null && c.daysUntilRenewal <= 30).length,
      renewingWithin30DaysArr: enabledCustomers
        .filter(c => c.daysUntilRenewal !== null && c.daysUntilRenewal <= 30)
        .reduce((sum, c) => sum + c.arr, 0),
      renewingWithin90Days: enabledCustomers.filter(c => c.daysUntilRenewal !== null && c.daysUntilRenewal <= 90).length,
      renewingWithin90DaysArr: enabledCustomers
        .filter(c => c.daysUntilRenewal !== null && c.daysUntilRenewal <= 90)
        .reduce((sum, c) => sum + c.arr, 0),
    };
  }, [filteredCustomers]);

  // Handle customer toggle
  const handleCustomerToggle = (customerId: string) => {
    setEditedOverview(prev => ({
      ...prev,
      customers: prev.customers.map(c =>
        c.id === customerId ? { ...c, enabled: !c.enabled } : c
      ),
    }));
    setHasChanges(true);
  };

  // Handle filter changes
  const handleFilterChange = (key: keyof AtRiskFilters, value: any) => {
    setEditedOverview(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  // Handle column toggle
  const handleColumnToggle = (columnId: string) => {
    setEditedOverview(prev => ({
      ...prev,
      columns: prev.columns.map(col =>
        col.id === columnId ? { ...col, enabled: !col.enabled } : col
      ),
    }));
    setHasChanges(true);
  };

  // Handle notes change
  const handleNotesChange = (notes: string) => {
    setEditedOverview(prev => ({ ...prev, notes }));
    setHasChanges(true);
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        ...editedOverview,
        summary: calculatedSummary,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (hasChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        return;
      }
    }
    onCancel();
  };

  // Handle select all / clear all
  const handleSelectAll = () => {
    setEditedOverview(prev => ({
      ...prev,
      customers: prev.customers.map(c => ({ ...c, enabled: true })),
    }));
    setHasChanges(true);
  };

  const handleClearAll = () => {
    setEditedOverview(prev => ({
      ...prev,
      customers: prev.customers.map(c => ({ ...c, enabled: false })),
    }));
    setHasChanges(true);
  };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverviewTab();
      case 'customers':
        return renderCustomersTab();
      case 'filters':
        return renderFiltersTab();
      case 'columns':
        return renderColumnsTab();
      default:
        return null;
    }
  };

  // Overview tab
  const renderOverviewTab = () => (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">At-Risk Customers</div>
          <div className="text-xl font-semibold text-white">{calculatedSummary.totalAtRisk}</div>
        </div>
        <div className="bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">ARR at Risk</div>
          <div className="text-xl font-semibold text-orange-400">${calculatedSummary.totalArrAtRisk.toLocaleString()}</div>
        </div>
        <div className="bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Avg Risk Score</div>
          <div className="text-xl font-semibold text-red-400">{calculatedSummary.avgRiskScore}/100</div>
        </div>
        <div className="bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Avg Health Score</div>
          <div className="text-xl font-semibold text-amber-400">{calculatedSummary.avgHealthScore}/100</div>
        </div>
      </div>

      {/* Risk Distribution */}
      <div className="bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Risk Distribution</h4>
        <div className="flex h-4 rounded-full overflow-hidden bg-cscx-gray-700">
          {calculatedSummary.totalAtRisk > 0 && (
            <>
              {calculatedSummary.criticalRiskCount > 0 && (
                <div
                  className="bg-red-500 h-full"
                  style={{ width: `${(calculatedSummary.criticalRiskCount / calculatedSummary.totalAtRisk) * 100}%` }}
                  title={`Critical: ${calculatedSummary.criticalRiskCount}`}
                />
              )}
              {calculatedSummary.highRiskCount > 0 && (
                <div
                  className="bg-orange-500 h-full"
                  style={{ width: `${(calculatedSummary.highRiskCount / calculatedSummary.totalAtRisk) * 100}%` }}
                  title={`High: ${calculatedSummary.highRiskCount}`}
                />
              )}
              {calculatedSummary.mediumRiskCount > 0 && (
                <div
                  className="bg-amber-500 h-full"
                  style={{ width: `${(calculatedSummary.mediumRiskCount / calculatedSummary.totalAtRisk) * 100}%` }}
                  title={`Medium: ${calculatedSummary.mediumRiskCount}`}
                />
              )}
            </>
          )}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Critical ({calculatedSummary.criticalRiskCount})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500" /> High ({calculatedSummary.highRiskCount})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Medium ({calculatedSummary.mediumRiskCount})
          </span>
        </div>
      </div>

      {/* Save Play Distribution */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">With Save Play</div>
          <div className="text-lg font-semibold text-emerald-400">{calculatedSummary.withSavePlayCount}</div>
        </div>
        <div className="bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Without Save Play</div>
          <div className="text-lg font-semibold text-gray-400">{calculatedSummary.withoutSavePlayCount}</div>
        </div>
      </div>

      {/* Renewal Urgency */}
      <div className="bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Renewal Urgency</h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Within 30 Days</span>
            <span className="text-sm font-medium text-red-400">
              {calculatedSummary.renewingWithin30Days} customers (${calculatedSummary.renewingWithin30DaysArr.toLocaleString()})
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Within 90 Days</span>
            <span className="text-sm font-medium text-orange-400">
              {calculatedSummary.renewingWithin90Days} customers (${calculatedSummary.renewingWithin90DaysArr.toLocaleString()})
            </span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-2">Notes</h4>
        <textarea
          value={editedOverview.notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add notes about this at-risk overview..."
          className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50 resize-none"
          rows={3}
        />
      </div>
    </div>
  );

  // Customers tab
  const renderCustomersTab = () => (
    <div className="space-y-3">
      {/* Bulk actions */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">
          {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''} shown
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleSelectAll}
            className="text-xs text-orange-400 hover:text-orange-300"
          >
            Select All
          </button>
          <span className="text-gray-600">|</span>
          <button
            onClick={handleClearAll}
            className="text-xs text-gray-400 hover:text-gray-300"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Customer list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {editedOverview.customers.map((customer) => (
          <div
            key={customer.id}
            className={`bg-cscx-gray-800/50 border rounded-lg p-3 transition-all ${
              customer.enabled
                ? 'border-orange-500/30'
                : 'border-cscx-gray-700/50 opacity-60'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={customer.enabled}
                onChange={() => handleCustomerToggle(customer.id)}
                className="mt-1 w-4 h-4 rounded border-cscx-gray-600 bg-cscx-gray-700 text-orange-500 focus:ring-orange-500/50"
              />

              {/* Customer info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-white truncate">{customer.customerName}</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full border ${RISK_COLORS[customer.riskLevel]}`}>
                    {RISK_LABELS[customer.riskLevel]}
                  </span>
                  <span className={`px-2 py-0.5 text-xs rounded-full border ${SAVE_PLAY_COLORS[customer.savePlayStatus]}`}>
                    {SAVE_PLAY_LABELS[customer.savePlayStatus]}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-400 flex-wrap">
                  <span className="text-orange-400 font-medium">${customer.arr.toLocaleString()} ARR</span>
                  <span>Risk: {customer.riskScore}/100</span>
                  <span>Health: {customer.healthScore}/100</span>
                  <span>{customer.daysAtRisk} days at risk</span>
                  {customer.renewalDate && (
                    <span className={customer.daysUntilRenewal && customer.daysUntilRenewal <= 30 ? 'text-red-400' : ''}>
                      Renewal: {customer.renewalDate} ({customer.daysUntilRenewal}d)
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {customer.primaryRiskFactors.slice(0, 3).map((factor, idx) => (
                    <span key={idx} className="px-1.5 py-0.5 text-xs bg-red-500/10 text-red-400 rounded">
                      {factor}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Owner: {customer.owner} | {customer.tier} | Last contact: {customer.lastContactDate}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Filters tab
  const renderFiltersTab = () => (
    <div className="space-y-4">
      {/* Risk Levels */}
      <div className="bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded-lg p-3">
        <h4 className="text-sm font-medium text-gray-300 mb-2">Risk Levels</h4>
        <div className="flex flex-wrap gap-2">
          {RISK_LEVEL_OPTIONS.map((level) => (
            <button
              key={level}
              onClick={() => {
                const newLevels = editedOverview.filters.riskLevels.includes(level)
                  ? editedOverview.filters.riskLevels.filter(l => l !== level)
                  : [...editedOverview.filters.riskLevels, level];
                handleFilterChange('riskLevels', newLevels);
              }}
              className={`px-3 py-1 text-xs rounded-full border transition-all ${
                editedOverview.filters.riskLevels.includes(level)
                  ? RISK_COLORS[level]
                  : 'border-cscx-gray-600 text-gray-500'
              }`}
            >
              {RISK_LABELS[level]}
            </button>
          ))}
        </div>
      </div>

      {/* Risk Threshold Slider */}
      <div className="bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded-lg p-3">
        <h4 className="text-sm font-medium text-gray-300 mb-2">
          Minimum Risk Threshold: {editedOverview.filters.riskThreshold}
        </h4>
        <input
          type="range"
          min="0"
          max="100"
          value={editedOverview.filters.riskThreshold}
          onChange={(e) => handleFilterChange('riskThreshold', parseInt(e.target.value))}
          className="w-full h-2 bg-cscx-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>

      {/* Renewal Range */}
      <div className="bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded-lg p-3">
        <h4 className="text-sm font-medium text-gray-300 mb-2">Renewal Range</h4>
        <select
          value={editedOverview.filters.renewalRange.type}
          onChange={(e) => handleFilterChange('renewalRange', {
            ...editedOverview.filters.renewalRange,
            type: e.target.value as typeof RENEWAL_RANGE_OPTIONS[number],
          })}
          className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700/50 rounded px-3 py-2 text-sm text-gray-300"
        >
          {RENEWAL_RANGE_OPTIONS.map((option) => (
            <option key={option} value={option}>{RENEWAL_RANGE_LABELS[option]}</option>
          ))}
        </select>
        {editedOverview.filters.renewalRange.type === 'custom' && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <input
              type="date"
              value={editedOverview.filters.renewalRange.startDate || ''}
              onChange={(e) => handleFilterChange('renewalRange', {
                ...editedOverview.filters.renewalRange,
                startDate: e.target.value,
              })}
              className="bg-cscx-gray-900/50 border border-cscx-gray-700/50 rounded px-2 py-1 text-sm text-gray-300"
            />
            <input
              type="date"
              value={editedOverview.filters.renewalRange.endDate || ''}
              onChange={(e) => handleFilterChange('renewalRange', {
                ...editedOverview.filters.renewalRange,
                endDate: e.target.value,
              })}
              className="bg-cscx-gray-900/50 border border-cscx-gray-700/50 rounded px-2 py-1 text-sm text-gray-300"
            />
          </div>
        )}
      </div>

      {/* Save Play Filters */}
      <div className="bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded-lg p-3">
        <h4 className="text-sm font-medium text-gray-300 mb-2">Save Play Filter</h4>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={editedOverview.filters.showSavePlaysOnly}
              onChange={(e) => {
                handleFilterChange('showSavePlaysOnly', e.target.checked);
                if (e.target.checked) handleFilterChange('showWithoutSavePlayOnly', false);
              }}
              className="w-4 h-4 rounded border-cscx-gray-600 bg-cscx-gray-700 text-orange-500"
            />
            Show only customers with save plays
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={editedOverview.filters.showWithoutSavePlayOnly}
              onChange={(e) => {
                handleFilterChange('showWithoutSavePlayOnly', e.target.checked);
                if (e.target.checked) handleFilterChange('showSavePlaysOnly', false);
              }}
              className="w-4 h-4 rounded border-cscx-gray-600 bg-cscx-gray-700 text-orange-500"
            />
            Show only customers without save plays
          </label>
        </div>
      </div>

      {/* Owners */}
      {editedOverview.availableOwners.length > 0 && (
        <div className="bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Owners</h4>
          <div className="flex flex-wrap gap-2">
            {editedOverview.availableOwners.map((owner) => (
              <button
                key={owner}
                onClick={() => {
                  const newOwners = editedOverview.filters.owners.includes(owner)
                    ? editedOverview.filters.owners.filter(o => o !== owner)
                    : [...editedOverview.filters.owners, owner];
                  handleFilterChange('owners', newOwners);
                }}
                className={`px-2 py-1 text-xs rounded border transition-all ${
                  editedOverview.filters.owners.includes(owner)
                    ? 'border-orange-500/50 bg-orange-500/20 text-orange-400'
                    : 'border-cscx-gray-600 text-gray-500'
                }`}
              >
                {owner}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tiers */}
      {editedOverview.availableTiers.length > 0 && (
        <div className="bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Tiers</h4>
          <div className="flex flex-wrap gap-2">
            {editedOverview.availableTiers.map((tier) => (
              <button
                key={tier}
                onClick={() => {
                  const newTiers = editedOverview.filters.tiers.includes(tier)
                    ? editedOverview.filters.tiers.filter(t => t !== tier)
                    : [...editedOverview.filters.tiers, tier];
                  handleFilterChange('tiers', newTiers);
                }}
                className={`px-2 py-1 text-xs rounded border transition-all ${
                  editedOverview.filters.tiers.includes(tier)
                    ? 'border-orange-500/50 bg-orange-500/20 text-orange-400'
                    : 'border-cscx-gray-600 text-gray-500'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sort Options */}
      <div className="bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded-lg p-3">
        <h4 className="text-sm font-medium text-gray-300 mb-2">Sort Options</h4>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={editedOverview.filters.sortBy}
            onChange={(e) => handleFilterChange('sortBy', e.target.value as typeof SORT_BY_OPTIONS[number])}
            className="bg-cscx-gray-900/50 border border-cscx-gray-700/50 rounded px-3 py-2 text-sm text-gray-300"
          >
            {SORT_BY_OPTIONS.map((option) => (
              <option key={option} value={option}>{SORT_BY_LABELS[option]}</option>
            ))}
          </select>
          <select
            value={editedOverview.filters.sortDirection}
            onChange={(e) => handleFilterChange('sortDirection', e.target.value as 'asc' | 'desc')}
            className="bg-cscx-gray-900/50 border border-cscx-gray-700/50 rounded px-3 py-2 text-sm text-gray-300"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>
    </div>
  );

  // Columns tab
  const renderColumnsTab = () => (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">
        Select which columns to include in the exported spreadsheet.
      </p>
      <div className="space-y-2">
        {editedOverview.columns.map((column) => (
          <label
            key={column.id}
            className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded-lg hover:border-orange-500/30 cursor-pointer transition-all"
          >
            <input
              type="checkbox"
              checked={column.enabled}
              onChange={() => handleColumnToggle(column.id)}
              className="w-4 h-4 rounded border-cscx-gray-600 bg-cscx-gray-700 text-orange-500 focus:ring-orange-500/50"
            />
            <span className={`text-sm ${column.enabled ? 'text-white' : 'text-gray-500'}`}>
              {column.name}
            </span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-cscx-gray-800 rounded-xl border border-cscx-gray-700 overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-900/30 via-red-900/20 to-amber-900/30 border-b border-cscx-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              {editedOverview.title}
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Review and customize before exporting to Google Sheets
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <span>Export</span>
                  <span>→</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-cscx-gray-700 px-4">
        <div className="flex gap-1 -mb-px">
          {(['overview', 'customers', 'filters', 'columns'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'overview' ? 'Overview' :
               tab === 'customers' ? `Customers (${filteredCustomers.length})` :
               tab === 'filters' ? 'Filters' :
               'Columns'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default CADGAtRiskOverviewPreview;
