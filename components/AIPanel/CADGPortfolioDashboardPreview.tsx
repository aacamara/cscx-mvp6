/**
 * CADGPortfolioDashboardPreview - Editable portfolio dashboard preview for CADG-generated dashboards
 * Allows users to filter, sort, and customize customer portfolio views before exporting to Google Sheets
 * Works in General Mode - no specific customer context required
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface PortfolioCustomerEntry {
  id: string;
  name: string;
  arr: number;
  healthScore: number;
  tier: string;
  segment: string;
  renewalDate: string;
  daysUntilRenewal: number;
  owner: string;
  riskLevel: 'healthy' | 'at_risk' | 'critical';
  lastActivityDate: string;
  npsScore: number | null;
  enabled: boolean;
}

export interface PortfolioSummary {
  totalCustomers: number;
  totalArr: number;
  avgHealthScore: number;
  avgNps: number;
  healthyCount: number;
  atRiskCount: number;
  criticalCount: number;
  renewingThisQuarter: number;
  renewingThisQuarterArr: number;
}

export interface PortfolioFilters {
  healthLevels: ('healthy' | 'at_risk' | 'critical')[];
  segments: string[];
  tiers: string[];
  owners: string[];
  dateRange: {
    type: 'all' | 'this_quarter' | 'next_quarter' | 'this_year' | 'custom';
    startDate?: string;
    endDate?: string;
  };
  sortBy: 'name' | 'arr' | 'health' | 'renewal' | 'nps';
  sortDirection: 'asc' | 'desc';
}

export interface PortfolioColumn {
  id: string;
  name: string;
  enabled: boolean;
  width?: string;
}

export interface PortfolioDashboardData {
  title: string;
  createdDate: string;
  lastUpdated: string;
  summary: PortfolioSummary;
  customers: PortfolioCustomerEntry[];
  filters: PortfolioFilters;
  columns: PortfolioColumn[];
  availableSegments: string[];
  availableTiers: string[];
  availableOwners: string[];
  notes: string;
}

// No customer context needed for General Mode
export interface CustomerData {
  id: string | null;
  name: string;
}

interface CADGPortfolioDashboardPreviewProps {
  dashboard: PortfolioDashboardData;
  onSave: (dashboard: PortfolioDashboardData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Options
// ============================================
const HEALTH_LEVEL_OPTIONS: ('healthy' | 'at_risk' | 'critical')[] = ['healthy', 'at_risk', 'critical'];
const DATE_RANGE_OPTIONS = ['all', 'this_quarter', 'next_quarter', 'this_year', 'custom'] as const;
const SORT_BY_OPTIONS = ['name', 'arr', 'health', 'renewal', 'nps'] as const;

const HEALTH_LABELS: Record<string, string> = {
  healthy: 'Healthy',
  at_risk: 'At Risk',
  critical: 'Critical',
};

const HEALTH_COLORS: Record<string, string> = {
  healthy: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  at_risk: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const DATE_RANGE_LABELS: Record<string, string> = {
  all: 'All Time',
  this_quarter: 'This Quarter',
  next_quarter: 'Next Quarter',
  this_year: 'This Year',
  custom: 'Custom Range',
};

const SORT_BY_LABELS: Record<string, string> = {
  name: 'Customer Name',
  arr: 'ARR',
  health: 'Health Score',
  renewal: 'Renewal Date',
  nps: 'NPS Score',
};

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Component
// ============================================

export const CADGPortfolioDashboardPreview: React.FC<CADGPortfolioDashboardPreviewProps> = ({
  dashboard,
  onSave,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();
  const [editedDashboard, setEditedDashboard] = useState<PortfolioDashboardData>({ ...dashboard });
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'filters' | 'columns'>('overview');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Filter and sort customers based on current filters
  const filteredCustomers = useMemo(() => {
    let result = editedDashboard.customers.filter(c => c.enabled);

    // Apply health filter
    if (editedDashboard.filters.healthLevels.length > 0) {
      result = result.filter(c => editedDashboard.filters.healthLevels.includes(c.riskLevel));
    }

    // Apply segment filter
    if (editedDashboard.filters.segments.length > 0) {
      result = result.filter(c => editedDashboard.filters.segments.includes(c.segment));
    }

    // Apply tier filter
    if (editedDashboard.filters.tiers.length > 0) {
      result = result.filter(c => editedDashboard.filters.tiers.includes(c.tier));
    }

    // Apply owner filter
    if (editedDashboard.filters.owners.length > 0) {
      result = result.filter(c => editedDashboard.filters.owners.includes(c.owner));
    }

    // Apply date range filter
    if (editedDashboard.filters.dateRange.type !== 'all') {
      const now = new Date();
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const quarterStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
      const quarterEnd = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
      const nextQuarterStart = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 1);
      const nextQuarterEnd = new Date(now.getFullYear(), (currentQuarter + 2) * 3, 0);
      const yearEnd = new Date(now.getFullYear(), 11, 31);

      result = result.filter(c => {
        const renewalDate = new Date(c.renewalDate);
        switch (editedDashboard.filters.dateRange.type) {
          case 'this_quarter':
            return renewalDate >= quarterStart && renewalDate <= quarterEnd;
          case 'next_quarter':
            return renewalDate >= nextQuarterStart && renewalDate <= nextQuarterEnd;
          case 'this_year':
            return renewalDate <= yearEnd;
          case 'custom':
            const start = editedDashboard.filters.dateRange.startDate ? new Date(editedDashboard.filters.dateRange.startDate) : new Date(0);
            const end = editedDashboard.filters.dateRange.endDate ? new Date(editedDashboard.filters.dateRange.endDate) : new Date('9999-12-31');
            return renewalDate >= start && renewalDate <= end;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (editedDashboard.filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'arr':
          comparison = a.arr - b.arr;
          break;
        case 'health':
          comparison = a.healthScore - b.healthScore;
          break;
        case 'renewal':
          comparison = new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime();
          break;
        case 'nps':
          comparison = (a.npsScore || -100) - (b.npsScore || -100);
          break;
      }
      return editedDashboard.filters.sortDirection === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [editedDashboard.customers, editedDashboard.filters]);

  // Calculate summary based on filtered customers
  const calculatedSummary = useMemo<PortfolioSummary>(() => {
    const enabledCustomers = filteredCustomers;
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const quarterStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
    const quarterEnd = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);

    return {
      totalCustomers: enabledCustomers.length,
      totalArr: enabledCustomers.reduce((sum, c) => sum + c.arr, 0),
      avgHealthScore: enabledCustomers.length > 0
        ? Math.round(enabledCustomers.reduce((sum, c) => sum + c.healthScore, 0) / enabledCustomers.length)
        : 0,
      avgNps: enabledCustomers.filter(c => c.npsScore !== null).length > 0
        ? Math.round(enabledCustomers.filter(c => c.npsScore !== null).reduce((sum, c) => sum + (c.npsScore || 0), 0) / enabledCustomers.filter(c => c.npsScore !== null).length)
        : 0,
      healthyCount: enabledCustomers.filter(c => c.riskLevel === 'healthy').length,
      atRiskCount: enabledCustomers.filter(c => c.riskLevel === 'at_risk').length,
      criticalCount: enabledCustomers.filter(c => c.riskLevel === 'critical').length,
      renewingThisQuarter: enabledCustomers.filter(c => {
        const renewal = new Date(c.renewalDate);
        return renewal >= quarterStart && renewal <= quarterEnd;
      }).length,
      renewingThisQuarterArr: enabledCustomers.filter(c => {
        const renewal = new Date(c.renewalDate);
        return renewal >= quarterStart && renewal <= quarterEnd;
      }).reduce((sum, c) => sum + c.arr, 0),
    };
  }, [filteredCustomers]);

  // Helper to mark changes
  const markChanged = () => {
    if (!hasChanges) setHasChanges(true);
  };

  // ============================================
  // Customer Handlers
  // ============================================
  const toggleCustomerEnabled = (customerId: string) => {
    setEditedDashboard(prev => ({
      ...prev,
      customers: prev.customers.map(c => c.id === customerId ? { ...c, enabled: !c.enabled } : c),
    }));
    markChanged();
  };

  const toggleAllCustomers = (enabled: boolean) => {
    setEditedDashboard(prev => ({
      ...prev,
      customers: prev.customers.map(c => ({ ...c, enabled })),
    }));
    markChanged();
  };

  // ============================================
  // Filter Handlers
  // ============================================
  const toggleHealthFilter = (level: 'healthy' | 'at_risk' | 'critical') => {
    setEditedDashboard(prev => {
      const current = prev.filters.healthLevels;
      const newLevels = current.includes(level)
        ? current.filter(l => l !== level)
        : [...current, level];
      return {
        ...prev,
        filters: { ...prev.filters, healthLevels: newLevels },
      };
    });
    markChanged();
  };

  const toggleSegmentFilter = (segment: string) => {
    setEditedDashboard(prev => {
      const current = prev.filters.segments;
      const newSegments = current.includes(segment)
        ? current.filter(s => s !== segment)
        : [...current, segment];
      return {
        ...prev,
        filters: { ...prev.filters, segments: newSegments },
      };
    });
    markChanged();
  };

  const toggleTierFilter = (tier: string) => {
    setEditedDashboard(prev => {
      const current = prev.filters.tiers;
      const newTiers = current.includes(tier)
        ? current.filter(t => t !== tier)
        : [...current, tier];
      return {
        ...prev,
        filters: { ...prev.filters, tiers: newTiers },
      };
    });
    markChanged();
  };

  const toggleOwnerFilter = (owner: string) => {
    setEditedDashboard(prev => {
      const current = prev.filters.owners;
      const newOwners = current.includes(owner)
        ? current.filter(o => o !== owner)
        : [...current, owner];
      return {
        ...prev,
        filters: { ...prev.filters, owners: newOwners },
      };
    });
    markChanged();
  };

  const setDateRangeType = (type: PortfolioFilters['dateRange']['type']) => {
    setEditedDashboard(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        dateRange: { ...prev.filters.dateRange, type },
      },
    }));
    markChanged();
  };

  const setCustomDateRange = (startDate: string, endDate: string) => {
    setEditedDashboard(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        dateRange: { type: 'custom', startDate, endDate },
      },
    }));
    markChanged();
  };

  const setSortBy = (sortBy: PortfolioFilters['sortBy']) => {
    setEditedDashboard(prev => ({
      ...prev,
      filters: { ...prev.filters, sortBy },
    }));
    markChanged();
  };

  const toggleSortDirection = () => {
    setEditedDashboard(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        sortDirection: prev.filters.sortDirection === 'asc' ? 'desc' : 'asc',
      },
    }));
    markChanged();
  };

  const clearAllFilters = () => {
    setEditedDashboard(prev => ({
      ...prev,
      filters: {
        healthLevels: ['healthy', 'at_risk', 'critical'],
        segments: prev.availableSegments,
        tiers: prev.availableTiers,
        owners: prev.availableOwners,
        dateRange: { type: 'all' },
        sortBy: 'health',
        sortDirection: 'asc',
      },
    }));
    markChanged();
  };

  // ============================================
  // Column Handlers
  // ============================================
  const toggleColumn = (columnId: string) => {
    setEditedDashboard(prev => ({
      ...prev,
      columns: prev.columns.map(col => col.id === columnId ? { ...col, enabled: !col.enabled } : col),
    }));
    markChanged();
  };

  // ============================================
  // Notes Handler
  // ============================================
  const setNotes = (notes: string) => {
    setEditedDashboard(prev => ({ ...prev, notes }));
    markChanged();
  };

  // ============================================
  // Save Handler
  // ============================================
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update summary before saving
      const dashboardToSave = {
        ...editedDashboard,
        summary: calculatedSummary,
        lastUpdated: new Date().toISOString().slice(0, 10),
      };
      await onSave(dashboardToSave);
    } catch (err) {
      console.error('Failed to save portfolio dashboard:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // Render Tabs
  // ============================================
  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">Dashboard Title</label>
        <input
          type="text"
          value={editedDashboard.title}
          onChange={(e) => {
            setEditedDashboard(prev => ({ ...prev, title: e.target.value }));
            markChanged();
          }}
          className="w-full bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-cscx-gray-800/30 border border-cscx-gray-700/30 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Customers</div>
          <div className="text-2xl font-bold text-white">{calculatedSummary.totalCustomers}</div>
        </div>
        <div className="bg-cscx-gray-800/30 border border-cscx-gray-700/30 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total ARR</div>
          <div className="text-2xl font-bold text-emerald-400">${calculatedSummary.totalArr.toLocaleString()}</div>
        </div>
        <div className="bg-cscx-gray-800/30 border border-cscx-gray-700/30 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Avg Health Score</div>
          <div className="text-2xl font-bold text-white">{calculatedSummary.avgHealthScore}</div>
        </div>
        <div className="bg-cscx-gray-800/30 border border-cscx-gray-700/30 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Avg NPS</div>
          <div className="text-2xl font-bold text-white">{calculatedSummary.avgNps}</div>
        </div>
      </div>

      {/* Health Distribution */}
      <div className="bg-cscx-gray-800/30 border border-cscx-gray-700/30 rounded-lg p-4">
        <div className="text-sm font-medium text-gray-300 mb-3">Health Distribution</div>
        <div className="flex gap-4">
          <div className="flex-1 text-center">
            <div className="text-emerald-400 text-xl font-bold">{calculatedSummary.healthyCount}</div>
            <div className="text-xs text-gray-500">Healthy</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-amber-400 text-xl font-bold">{calculatedSummary.atRiskCount}</div>
            <div className="text-xs text-gray-500">At Risk</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-red-400 text-xl font-bold">{calculatedSummary.criticalCount}</div>
            <div className="text-xs text-gray-500">Critical</div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="flex h-2 mt-3 rounded-full overflow-hidden bg-gray-700">
          {calculatedSummary.totalCustomers > 0 && (
            <>
              <div
                className="bg-emerald-500"
                style={{ width: `${(calculatedSummary.healthyCount / calculatedSummary.totalCustomers) * 100}%` }}
              />
              <div
                className="bg-amber-500"
                style={{ width: `${(calculatedSummary.atRiskCount / calculatedSummary.totalCustomers) * 100}%` }}
              />
              <div
                className="bg-red-500"
                style={{ width: `${(calculatedSummary.criticalCount / calculatedSummary.totalCustomers) * 100}%` }}
              />
            </>
          )}
        </div>
      </div>

      {/* Renewal This Quarter */}
      <div className="bg-cscx-gray-800/30 border border-cscx-gray-700/30 rounded-lg p-4">
        <div className="text-sm font-medium text-gray-300 mb-3">Renewals This Quarter</div>
        <div className="flex justify-between items-center">
          <div>
            <div className="text-2xl font-bold text-white">{calculatedSummary.renewingThisQuarter}</div>
            <div className="text-xs text-gray-500">Customers</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-400">${calculatedSummary.renewingThisQuarterArr.toLocaleString()}</div>
            <div className="text-xs text-gray-500">ARR at Stake</div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">Notes</label>
        <textarea
          value={editedDashboard.notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this dashboard..."
          rows={3}
          className="w-full bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 resize-none"
        />
      </div>
    </div>
  );

  const renderCustomersTab = () => (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          Showing {filteredCustomers.length} of {editedDashboard.customers.length} customers
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => toggleAllCustomers(true)}
            className="text-xs px-2 py-1 rounded bg-cscx-gray-700/50 text-gray-300 hover:bg-cscx-gray-600/50"
          >
            Select All
          </button>
          <button
            onClick={() => toggleAllCustomers(false)}
            className="text-xs px-2 py-1 rounded bg-cscx-gray-700/50 text-gray-300 hover:bg-cscx-gray-600/50"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Sort by:</span>
        <select
          value={editedDashboard.filters.sortBy}
          onChange={(e) => setSortBy(e.target.value as PortfolioFilters['sortBy'])}
          className="bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded px-2 py-1 text-xs text-white focus:outline-none"
        >
          {SORT_BY_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{SORT_BY_LABELS[opt]}</option>
          ))}
        </select>
        <button
          onClick={toggleSortDirection}
          className="text-xs px-2 py-1 rounded bg-cscx-gray-700/50 text-gray-300 hover:bg-cscx-gray-600/50"
        >
          {editedDashboard.filters.sortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
        </button>
      </div>

      {/* Customer List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {filteredCustomers.map((customer) => (
          <div
            key={customer.id}
            className={`bg-cscx-gray-800/30 border rounded-lg p-3 ${
              customer.enabled ? 'border-cscx-gray-700/30' : 'border-gray-700/20 opacity-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={customer.enabled}
                  onChange={() => toggleCustomerEnabled(customer.id)}
                  className="w-4 h-4 rounded border-gray-600 bg-cscx-gray-700"
                />
                <div>
                  <div className="font-medium text-white">{customer.name}</div>
                  <div className="text-xs text-gray-500">{customer.tier} • {customer.segment}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Health Score */}
                <div className="text-center">
                  <div className={`text-sm font-semibold ${
                    customer.healthScore >= 70 ? 'text-emerald-400' :
                    customer.healthScore >= 40 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {customer.healthScore}
                  </div>
                  <div className="text-[10px] text-gray-500">Health</div>
                </div>
                {/* ARR */}
                <div className="text-center">
                  <div className="text-sm font-semibold text-white">${(customer.arr / 1000).toFixed(0)}K</div>
                  <div className="text-[10px] text-gray-500">ARR</div>
                </div>
                {/* Renewal */}
                <div className="text-center">
                  <div className={`text-sm font-semibold ${
                    customer.daysUntilRenewal <= 30 ? 'text-red-400' :
                    customer.daysUntilRenewal <= 90 ? 'text-amber-400' : 'text-gray-300'
                  }`}>
                    {customer.daysUntilRenewal}d
                  </div>
                  <div className="text-[10px] text-gray-500">Renewal</div>
                </div>
                {/* Status Badge */}
                <span className={`px-2 py-0.5 text-xs rounded-full border ${HEALTH_COLORS[customer.riskLevel]}`}>
                  {HEALTH_LABELS[customer.riskLevel]}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
              <span>Owner: {customer.owner}</span>
              <span>Last Activity: {customer.lastActivityDate}</span>
              {customer.npsScore !== null && <span>NPS: {customer.npsScore}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderFiltersTab = () => (
    <div className="space-y-6">
      {/* Health Level Filter */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">Health Levels</label>
        </div>
        <div className="flex flex-wrap gap-2">
          {HEALTH_LEVEL_OPTIONS.map(level => (
            <button
              key={level}
              onClick={() => toggleHealthFilter(level)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                editedDashboard.filters.healthLevels.includes(level)
                  ? HEALTH_COLORS[level]
                  : 'bg-cscx-gray-800/30 border-cscx-gray-700/30 text-gray-500'
              }`}
            >
              {HEALTH_LABELS[level]}
            </button>
          ))}
        </div>
      </div>

      {/* Segment Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Segments</label>
        <div className="flex flex-wrap gap-2">
          {editedDashboard.availableSegments.map(segment => (
            <button
              key={segment}
              onClick={() => toggleSegmentFilter(segment)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                editedDashboard.filters.segments.includes(segment)
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : 'bg-cscx-gray-800/30 border-cscx-gray-700/30 text-gray-500'
              }`}
            >
              {segment}
            </button>
          ))}
        </div>
      </div>

      {/* Tier Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Tiers</label>
        <div className="flex flex-wrap gap-2">
          {editedDashboard.availableTiers.map(tier => (
            <button
              key={tier}
              onClick={() => toggleTierFilter(tier)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                editedDashboard.filters.tiers.includes(tier)
                  ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                  : 'bg-cscx-gray-800/30 border-cscx-gray-700/30 text-gray-500'
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {/* Owner Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Owners</label>
        <div className="flex flex-wrap gap-2">
          {editedDashboard.availableOwners.map(owner => (
            <button
              key={owner}
              onClick={() => toggleOwnerFilter(owner)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                editedDashboard.filters.owners.includes(owner)
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                  : 'bg-cscx-gray-800/30 border-cscx-gray-700/30 text-gray-500'
              }`}
            >
              {owner}
            </button>
          ))}
        </div>
      </div>

      {/* Date Range Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Renewal Date Range</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {DATE_RANGE_OPTIONS.map(type => (
            <button
              key={type}
              onClick={() => setDateRangeType(type)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                editedDashboard.filters.dateRange.type === type
                  ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                  : 'bg-cscx-gray-800/30 border-cscx-gray-700/30 text-gray-500'
              }`}
            >
              {DATE_RANGE_LABELS[type]}
            </button>
          ))}
        </div>
        {editedDashboard.filters.dateRange.type === 'custom' && (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Start Date</label>
              <input
                type="date"
                value={editedDashboard.filters.dateRange.startDate || ''}
                onChange={(e) => setCustomDateRange(e.target.value, editedDashboard.filters.dateRange.endDate || '')}
                className="w-full bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded px-2 py-1.5 text-sm text-white focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">End Date</label>
              <input
                type="date"
                value={editedDashboard.filters.dateRange.endDate || ''}
                onChange={(e) => setCustomDateRange(editedDashboard.filters.dateRange.startDate || '', e.target.value)}
                className="w-full bg-cscx-gray-800/50 border border-cscx-gray-700/50 rounded px-2 py-1.5 text-sm text-white focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Clear Filters */}
      <button
        onClick={clearAllFilters}
        className="w-full py-2 text-sm text-gray-400 hover:text-white border border-dashed border-gray-600 rounded-lg hover:border-gray-500 transition-colors"
      >
        Clear All Filters
      </button>
    </div>
  );

  const renderColumnsTab = () => (
    <div className="space-y-4">
      <div className="text-sm text-gray-400 mb-4">
        Select which columns to include in the exported spreadsheet
      </div>
      <div className="space-y-2">
        {editedDashboard.columns.map((column) => (
          <div
            key={column.id}
            className="flex items-center justify-between bg-cscx-gray-800/30 border border-cscx-gray-700/30 rounded-lg p-3"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={column.enabled}
                onChange={() => toggleColumn(column.id)}
                className="w-4 h-4 rounded border-gray-600 bg-cscx-gray-700"
              />
              <span className={column.enabled ? 'text-white' : 'text-gray-500'}>{column.name}</span>
            </div>
            {column.width && (
              <span className="text-xs text-gray-500">{column.width}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // ============================================
  // Main Render
  // ============================================
  return (
    <div className="bg-cscx-gray-800 rounded-xl border border-cscx-gray-700/50 overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-b border-cscx-gray-700/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Portfolio Dashboard</h3>
              <p className="text-sm text-gray-400">Review and customize your customer portfolio</p>
            </div>
          </div>
          {hasChanges && (
            <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded">Unsaved changes</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-cscx-gray-700/50">
        {(['overview', 'customers', 'filters', 'columns'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'customers' && renderCustomersTab()}
        {activeTab === 'filters' && renderFiltersTab()}
        {activeTab === 'columns' && renderColumnsTab()}
      </div>

      {/* Footer */}
      <div className="border-t border-cscx-gray-700/50 p-4 bg-cscx-gray-800/50">
        <div className="flex items-center justify-between">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Exporting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export to Google Sheets
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CADGPortfolioDashboardPreview;
