/**
 * Health Score Portfolio View
 * PRD-153: Portfolio-wide health score visualization
 *
 * Features:
 * - Portfolio Overview with health distribution
 * - Customer Health Matrix (sortable/filterable table)
 * - Health Score Detail Modal
 * - Trend Analysis
 * - Attention Alerts
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  HealthPortfolioResponse,
  CustomerHealthSummary,
  CustomerHealthDetail,
  HealthPortfolioFilters,
  HealthCategory,
  HEALTH_THRESHOLDS
} from '../../types/healthPortfolio';
import { HealthDetailModal } from './HealthDetailModal';
import { PortfolioTrendChart } from './PortfolioTrendChart';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const getHealthColor = (score: number): string => {
  if (score >= HEALTH_THRESHOLDS.healthy.min) return 'text-green-400';
  if (score >= HEALTH_THRESHOLDS.warning.min) return 'text-yellow-400';
  return 'text-red-400';
};

const getHealthBgColor = (category: HealthCategory): string => {
  switch (category) {
    case 'healthy': return 'bg-green-500';
    case 'warning': return 'bg-yellow-500';
    case 'critical': return 'bg-red-500';
  }
};

const getHealthBgLight = (category: HealthCategory): string => {
  switch (category) {
    case 'healthy': return 'bg-green-500/20';
    case 'warning': return 'bg-yellow-500/20';
    case 'critical': return 'bg-red-500/20';
  }
};

const getTrendIcon = (trend: 'improving' | 'stable' | 'declining'): string => {
  switch (trend) {
    case 'improving': return '\u2191';
    case 'declining': return '\u2193';
    case 'stable': return '\u2192';
  }
};

const getTrendColor = (trend: 'improving' | 'stable' | 'declining'): string => {
  switch (trend) {
    case 'improving': return 'text-green-400';
    case 'declining': return 'text-red-400';
    case 'stable': return 'text-gray-400';
  }
};

// ============================================
// MAIN COMPONENT
// ============================================

interface HealthScorePortfolioProps {
  onSelectCustomer?: (customerId: string) => void;
}

export const HealthScorePortfolio: React.FC<HealthScorePortfolioProps> = ({
  onSelectCustomer
}) => {
  // State
  const [data, setData] = useState<HealthPortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<HealthPortfolioFilters>({
    health_filter: 'all',
    sort_by: 'score',
    sort_order: 'desc',
    search: ''
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<CustomerHealthDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch portfolio data
  const fetchPortfolio = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.health_filter && filters.health_filter !== 'all') {
        params.append('health_filter', filters.health_filter);
      }
      if (filters.search) params.append('search', filters.search);
      if (filters.sort_by) params.append('sort_by', filters.sort_by);
      if (filters.sort_order) params.append('sort_order', filters.sort_order);
      if (filters.segment) params.append('segment', filters.segment);

      const response = await fetch(`${API_BASE}/reports/health-portfolio?${params}`);
      if (!response.ok) throw new Error('Failed to fetch health portfolio');

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch customer detail
  const fetchCustomerDetail = useCallback(async (customerId: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`${API_BASE}/reports/health-portfolio/${customerId}`);
      if (!response.ok) throw new Error('Failed to fetch customer detail');

      const result = await response.json();
      setDetailData(result);
    } catch (err) {
      console.error('Failed to fetch customer detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerDetail(selectedCustomerId);
    }
  }, [selectedCustomerId, fetchCustomerDetail]);

  // Handlers
  const handleSort = (field: 'score' | 'arr' | 'renewal' | 'name' | 'change') => {
    setFilters(prev => ({
      ...prev,
      sort_by: field,
      sort_order: prev.sort_by === field && prev.sort_order === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleHealthFilter = (category: 'all' | HealthCategory) => {
    setFilters(prev => ({ ...prev, health_filter: category }));
  };

  const handleCustomerClick = (customer: CustomerHealthSummary) => {
    setSelectedCustomerId(customer.customer_id);
  };

  const handleCloseDetail = () => {
    setSelectedCustomerId(null);
    setDetailData(null);
  };

  const handleViewFullDetail = (customerId: string) => {
    handleCloseDetail();
    onSelectCustomer?.(customerId);
  };

  // Loading state
  if (loading && !data) {
    return (
      <div className="p-8 text-center text-cscx-gray-400">
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
        Loading health portfolio...
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="p-8 text-center text-red-400">
        {error}
        <button
          onClick={fetchPortfolio}
          className="block mx-auto mt-2 text-sm text-cscx-accent hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { overview, customers, trends, alerts } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Health Score Portfolio</h2>
          <p className="text-cscx-gray-400 text-sm mt-1">
            Last updated: {new Date().toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={fetchPortfolio}
          className="px-4 py-2 text-sm bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Portfolio Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Healthy */}
        <div
          onClick={() => handleHealthFilter('healthy')}
          className={`bg-cscx-gray-900 border rounded-xl p-4 cursor-pointer transition-all ${
            filters.health_filter === 'healthy' ? 'border-green-500 ring-1 ring-green-500' : 'border-cscx-gray-800 hover:border-green-500/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cscx-gray-400 uppercase tracking-wider">Healthy</span>
            <span className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <p className="text-3xl font-bold text-green-400">{overview.healthy.count}</p>
          <p className="text-sm text-cscx-gray-400 mt-1">{formatCurrency(overview.healthy.arr)} ARR</p>
          <p className="text-xs text-cscx-gray-500 mt-1">{overview.healthy.pct}% of portfolio</p>
        </div>

        {/* Warning */}
        <div
          onClick={() => handleHealthFilter('warning')}
          className={`bg-cscx-gray-900 border rounded-xl p-4 cursor-pointer transition-all ${
            filters.health_filter === 'warning' ? 'border-yellow-500 ring-1 ring-yellow-500' : 'border-cscx-gray-800 hover:border-yellow-500/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cscx-gray-400 uppercase tracking-wider">Warning</span>
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
          </div>
          <p className="text-3xl font-bold text-yellow-400">{overview.warning.count}</p>
          <p className="text-sm text-cscx-gray-400 mt-1">{formatCurrency(overview.warning.arr)} ARR</p>
          <p className="text-xs text-cscx-gray-500 mt-1">{overview.warning.pct}% of portfolio</p>
        </div>

        {/* Critical */}
        <div
          onClick={() => handleHealthFilter('critical')}
          className={`bg-cscx-gray-900 border rounded-xl p-4 cursor-pointer transition-all ${
            filters.health_filter === 'critical' ? 'border-red-500 ring-1 ring-red-500' : 'border-cscx-gray-800 hover:border-red-500/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cscx-gray-400 uppercase tracking-wider">Critical</span>
            <span className="w-3 h-3 rounded-full bg-red-500" />
          </div>
          <p className="text-3xl font-bold text-red-400">{overview.critical.count}</p>
          <p className="text-sm text-cscx-gray-400 mt-1">{formatCurrency(overview.critical.arr)} ARR</p>
          <p className="text-xs text-cscx-gray-500 mt-1">{overview.critical.pct}% of portfolio</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-cscx-gray-400 uppercase">Average Health</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-2xl font-bold ${getHealthColor(overview.avg_health_score)}`}>
                {overview.avg_health_score}
              </span>
              <span className={`text-sm ${overview.score_change_wow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {overview.score_change_wow >= 0 ? '+' : ''}{overview.score_change_wow} vs last week
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-cscx-gray-400 uppercase">Total Customers</p>
            <p className="text-2xl font-bold text-white mt-1">{overview.total_customers}</p>
          </div>
          <div>
            <p className="text-xs text-cscx-gray-400 uppercase">Total ARR</p>
            <p className="text-2xl font-bold text-cscx-accent mt-1">{formatCurrency(overview.total_arr)}</p>
          </div>
          <div>
            <p className="text-xs text-cscx-gray-400 uppercase">Trend Changes</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-green-400">{getTrendIcon('improving')} {overview.changes.improved}</span>
              <span className="text-sm text-gray-400">{getTrendIcon('stable')} {overview.changes.stable}</span>
              <span className="text-sm text-red-400">{getTrendIcon('declining')} {overview.changes.declined}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Trend Chart & Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Health Trend (30 days)</h3>
          <PortfolioTrendChart trends={trends} />
        </div>

        {/* Attention Needed */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Attention Needed</h3>
          <div className="space-y-3">
            {alerts.steep_declines.map(customer => (
              <div
                key={customer.customer_id}
                onClick={() => handleCustomerClick(customer)}
                className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/30 rounded-lg cursor-pointer hover:bg-red-500/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-red-400 font-bold">{getTrendIcon('declining')}</span>
                  <div>
                    <p className="text-white font-medium">{customer.customer_name}</p>
                    <p className="text-xs text-cscx-gray-400">
                      Dropped {Math.abs(customer.score_change)} points
                    </p>
                  </div>
                </div>
                <span className={`font-medium ${getHealthColor(customer.health_score)}`}>
                  {customer.health_score}
                </span>
              </div>
            ))}
            {alerts.renewals_at_risk.map(customer => (
              <div
                key={`renewal-${customer.customer_id}`}
                onClick={() => handleCustomerClick(customer)}
                className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg cursor-pointer hover:bg-yellow-500/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-yellow-400">!</span>
                  <div>
                    <p className="text-white font-medium">{customer.customer_name}</p>
                    <p className="text-xs text-cscx-gray-400">
                      Renewal in {customer.days_to_renewal} days, score: {customer.health_score}
                    </p>
                  </div>
                </div>
                <span className={`font-medium ${getHealthColor(customer.health_score)}`}>
                  {customer.health_score}
                </span>
              </div>
            ))}
            {alerts.steep_declines.length === 0 && alerts.renewals_at_risk.length === 0 && (
              <p className="text-cscx-gray-500 text-center py-4">No alerts at this time</p>
            )}
          </div>
        </div>
      </div>

      {/* Customer Health Matrix */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-cscx-gray-800">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Customer Health Matrix</h3>
            <div className="flex flex-wrap gap-2">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={filters.search || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="px-3 py-1.5 pl-8 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent w-48"
                />
                <svg className="absolute left-2.5 top-2 w-4 h-4 text-cscx-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {/* Filter buttons */}
              <div className="flex gap-1 bg-cscx-gray-800 rounded-lg p-1">
                {(['all', 'healthy', 'warning', 'critical'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => handleHealthFilter(cat)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                      filters.health_filter === cat
                        ? 'bg-cscx-accent text-white'
                        : 'text-cscx-gray-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cscx-gray-800/50">
                <th
                  className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort('name')}
                >
                  Customer {filters.sort_by === 'name' && (filters.sort_order === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th
                  className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort('score')}
                >
                  Score {filters.sort_by === 'score' && (filters.sort_order === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th
                  className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort('change')}
                >
                  Trend {filters.sort_by === 'change' && (filters.sort_order === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th
                  className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort('arr')}
                >
                  ARR {filters.sort_by === 'arr' && (filters.sort_order === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th
                  className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort('renewal')}
                >
                  Renewal {filters.sort_by === 'renewal' && (filters.sort_order === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">
                  Risk
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cscx-gray-800">
              {customers.map((customer) => (
                <tr
                  key={customer.customer_id}
                  onClick={() => handleCustomerClick(customer)}
                  className="hover:bg-cscx-gray-800/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${getHealthBgColor(customer.category)}`} />
                      <div>
                        <p className="text-white font-medium">{customer.customer_name}</p>
                        <p className="text-cscx-gray-500 text-xs">{customer.segment}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-12 h-2 rounded-full ${getHealthBgLight(customer.category)}`}>
                        <div
                          className={`h-full rounded-full ${getHealthBgColor(customer.category)}`}
                          style={{ width: `${customer.health_score}%` }}
                        />
                      </div>
                      <span className={`font-medium ${getHealthColor(customer.health_score)}`}>
                        {customer.health_score}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1 ${getTrendColor(customer.trend)}`}>
                      {getTrendIcon(customer.trend)}
                      {customer.score_change !== 0 && (
                        <span className="text-sm">
                          {customer.score_change > 0 ? '+' : ''}{customer.score_change}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white font-medium">{formatCurrency(customer.arr)}</span>
                  </td>
                  <td className="px-4 py-3 text-cscx-gray-300">
                    {customer.days_to_renewal !== null ? (
                      <span className={customer.days_to_renewal <= 30 ? 'text-red-400' : customer.days_to_renewal <= 90 ? 'text-yellow-400' : ''}>
                        {customer.days_to_renewal} days
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {customer.active_risks > 0 ? (
                      <span className="px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400 rounded">
                        {customer.active_risks}
                      </span>
                    ) : (
                      <span className="text-cscx-gray-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {customers.length === 0 && (
          <div className="p-8 text-center text-cscx-gray-500">
            No customers match the current filters
          </div>
        )}

        <div className="p-4 border-t border-cscx-gray-800 text-sm text-cscx-gray-400">
          Showing {customers.length} of {overview.total_customers} customers
        </div>
      </div>

      {/* Health Detail Modal */}
      {selectedCustomerId && (
        <HealthDetailModal
          customerId={selectedCustomerId}
          data={detailData}
          loading={detailLoading}
          onClose={handleCloseDetail}
          onViewFullDetail={handleViewFullDetail}
        />
      )}
    </div>
  );
};

export default HealthScorePortfolio;
