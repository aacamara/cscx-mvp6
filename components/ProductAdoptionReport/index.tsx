/**
 * Product Adoption Report
 * PRD-159: Portfolio-wide product adoption visualization
 *
 * Features:
 * - Portfolio Overview with adoption distribution
 * - Customer Adoption Matrix (sortable/filterable table)
 * - Feature Adoption Rates
 * - Adoption Detail Modal
 * - Low Adopters Attention List
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ProductAdoptionPortfolioResponse,
  CustomerAdoptionSummary,
  ProductAdoptionCustomerResponse,
  ProductAdoptionFilters,
  AdoptionLevel,
  ADOPTION_THRESHOLDS
} from '../../types/productAdoptionReport';
import { AdoptionDetailModal } from './AdoptionDetailModal';
import { FeatureAdoptionChart } from './FeatureAdoptionChart';

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

const getAdoptionColor = (score: number): string => {
  if (score >= ADOPTION_THRESHOLDS.power.min) return 'text-purple-400';
  if (score >= ADOPTION_THRESHOLDS.active.min) return 'text-green-400';
  if (score >= ADOPTION_THRESHOLDS.exploring.min) return 'text-yellow-400';
  return 'text-red-400';
};

const getAdoptionBgColor = (level: AdoptionLevel): string => {
  switch (level) {
    case 'power': return 'bg-purple-500';
    case 'active': return 'bg-green-500';
    case 'exploring': return 'bg-yellow-500';
    case 'low': return 'bg-red-500';
  }
};

const getAdoptionBgLight = (level: AdoptionLevel): string => {
  switch (level) {
    case 'power': return 'bg-purple-500/20';
    case 'active': return 'bg-green-500/20';
    case 'exploring': return 'bg-yellow-500/20';
    case 'low': return 'bg-red-500/20';
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

const getLevelLabel = (level: AdoptionLevel): string => {
  switch (level) {
    case 'power': return 'Power (80+)';
    case 'active': return 'Active (60-79)';
    case 'exploring': return 'Exploring (40-59)';
    case 'low': return 'Low (<40)';
  }
};

// ============================================
// MAIN COMPONENT
// ============================================

interface ProductAdoptionReportProps {
  onSelectCustomer?: (customerId: string) => void;
}

export const ProductAdoptionReport: React.FC<ProductAdoptionReportProps> = ({
  onSelectCustomer
}) => {
  // State
  const [data, setData] = useState<ProductAdoptionPortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProductAdoptionFilters>({
    level_filter: 'all',
    sort_by: 'score',
    sort_order: 'desc',
    search: ''
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<ProductAdoptionCustomerResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch portfolio data
  const fetchPortfolio = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.level_filter && filters.level_filter !== 'all') {
        params.append('level_filter', filters.level_filter);
      }
      if (filters.search) params.append('search', filters.search);
      if (filters.sort_by) params.append('sort_by', filters.sort_by);
      if (filters.sort_order) params.append('sort_order', filters.sort_order);
      if (filters.segment) params.append('segment', filters.segment);

      const response = await fetch(`${API_BASE}/reports/product-adoption?${params}`);
      if (!response.ok) throw new Error('Failed to fetch product adoption data');

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
      const response = await fetch(`${API_BASE}/reports/product-adoption/${customerId}`);
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
  const handleSort = (field: 'score' | 'arr' | 'features' | 'name' | 'change') => {
    setFilters(prev => ({
      ...prev,
      sort_by: field,
      sort_order: prev.sort_by === field && prev.sort_order === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleLevelFilter = (level: 'all' | AdoptionLevel) => {
    setFilters(prev => ({ ...prev, level_filter: level }));
  };

  const handleCustomerClick = (customer: CustomerAdoptionSummary) => {
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
        Loading product adoption report...
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

  const { overview, customers, feature_adoption_rates, low_adopters } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Product Adoption Report</h2>
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

      {/* Portfolio Adoption Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Average Score */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cscx-gray-400 uppercase tracking-wider">Avg Score</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className={`text-4xl font-bold ${getAdoptionColor(overview.avg_adoption_score)}`}>
              {overview.avg_adoption_score}
            </p>
            <span className="text-lg text-cscx-gray-500">/100</span>
          </div>
          <p className={`text-sm mt-2 ${overview.score_change_mom >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {overview.score_change_mom >= 0 ? '+' : ''}{overview.score_change_mom} vs last month
          </p>
        </div>

        {/* High Adopters */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cscx-gray-400 uppercase tracking-wider">High Adopters</span>
            <span className="w-3 h-3 rounded-full bg-purple-500" />
          </div>
          <p className="text-4xl font-bold text-purple-400">
            {overview.power.count + overview.active.count}
          </p>
          <p className="text-sm text-cscx-gray-400 mt-1">
            {overview.power.pct + overview.active.pct}% of portfolio
          </p>
        </div>

        {/* Low Adopters */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cscx-gray-400 uppercase tracking-wider">Need Attention</span>
            <span className="w-3 h-3 rounded-full bg-red-500" />
          </div>
          <p className="text-4xl font-bold text-red-400">{overview.low.count}</p>
          <p className="text-sm text-cscx-gray-400 mt-1">
            {formatCurrency(overview.low.arr)} ARR at risk
          </p>
        </div>
      </div>

      {/* Adoption Distribution */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Adoption Distribution</h3>
        <div className="space-y-3">
          {/* Power */}
          <div
            onClick={() => handleLevelFilter('power')}
            className={`flex items-center gap-4 p-2 rounded-lg cursor-pointer transition-colors ${
              filters.level_filter === 'power' ? 'bg-purple-500/20' : 'hover:bg-cscx-gray-800'
            }`}
          >
            <div className="w-24 text-sm text-cscx-gray-400">{getLevelLabel('power')}</div>
            <div className="flex-1 h-6 bg-cscx-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all duration-500"
                style={{ width: `${overview.power.pct}%` }}
              />
            </div>
            <div className="w-20 text-right">
              <span className="text-white font-medium">{overview.power.count}</span>
              <span className="text-cscx-gray-500 text-sm ml-1">({overview.power.pct}%)</span>
            </div>
          </div>

          {/* Active */}
          <div
            onClick={() => handleLevelFilter('active')}
            className={`flex items-center gap-4 p-2 rounded-lg cursor-pointer transition-colors ${
              filters.level_filter === 'active' ? 'bg-green-500/20' : 'hover:bg-cscx-gray-800'
            }`}
          >
            <div className="w-24 text-sm text-cscx-gray-400">{getLevelLabel('active')}</div>
            <div className="flex-1 h-6 bg-cscx-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${overview.active.pct}%` }}
              />
            </div>
            <div className="w-20 text-right">
              <span className="text-white font-medium">{overview.active.count}</span>
              <span className="text-cscx-gray-500 text-sm ml-1">({overview.active.pct}%)</span>
            </div>
          </div>

          {/* Exploring */}
          <div
            onClick={() => handleLevelFilter('exploring')}
            className={`flex items-center gap-4 p-2 rounded-lg cursor-pointer transition-colors ${
              filters.level_filter === 'exploring' ? 'bg-yellow-500/20' : 'hover:bg-cscx-gray-800'
            }`}
          >
            <div className="w-24 text-sm text-cscx-gray-400">{getLevelLabel('exploring')}</div>
            <div className="flex-1 h-6 bg-cscx-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500 transition-all duration-500"
                style={{ width: `${overview.exploring.pct}%` }}
              />
            </div>
            <div className="w-20 text-right">
              <span className="text-white font-medium">{overview.exploring.count}</span>
              <span className="text-cscx-gray-500 text-sm ml-1">({overview.exploring.pct}%)</span>
            </div>
          </div>

          {/* Low */}
          <div
            onClick={() => handleLevelFilter('low')}
            className={`flex items-center gap-4 p-2 rounded-lg cursor-pointer transition-colors ${
              filters.level_filter === 'low' ? 'bg-red-500/20' : 'hover:bg-cscx-gray-800'
            }`}
          >
            <div className="w-24 text-sm text-cscx-gray-400">{getLevelLabel('low')}</div>
            <div className="flex-1 h-6 bg-cscx-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all duration-500"
                style={{ width: `${overview.low.pct}%` }}
              />
            </div>
            <div className="w-20 text-right">
              <span className="text-white font-medium">{overview.low.count}</span>
              <span className="text-cscx-gray-500 text-sm ml-1">({overview.low.pct}%)</span>
            </div>
          </div>
        </div>

        {filters.level_filter !== 'all' && (
          <button
            onClick={() => handleLevelFilter('all')}
            className="mt-4 text-sm text-cscx-accent hover:underline"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Feature Adoption Rates & Low Adopters Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature Adoption Rates */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Top Features by Adoption</h3>
          <FeatureAdoptionChart features={feature_adoption_rates.slice(0, 8)} />
        </div>

        {/* Low Adopters Needing Attention */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Low Adopters Needing Attention</h3>
          <div className="space-y-3">
            {low_adopters.map(customer => (
              <div
                key={customer.customer_id}
                onClick={() => handleCustomerClick(customer)}
                className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/30 rounded-lg cursor-pointer hover:bg-red-500/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${getAdoptionBgColor(customer.level)}`} />
                  <div>
                    <p className="text-white font-medium">{customer.customer_name}</p>
                    <p className="text-xs text-cscx-gray-400">
                      Score: {customer.adoption_score} | Using {customer.features_using}/{customer.features_available} features
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-cscx-gray-300">{formatCurrency(customer.arr)}</p>
                  {customer.top_gap && (
                    <p className="text-xs text-yellow-400">Gap: {customer.top_gap}</p>
                  )}
                </div>
              </div>
            ))}
            {low_adopters.length === 0 && (
              <p className="text-cscx-gray-500 text-center py-4">No low adopters needing immediate attention</p>
            )}
          </div>
        </div>
      </div>

      {/* Customer Adoption Matrix */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-cscx-gray-800">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Customer Adoption Matrix</h3>
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
                {(['all', 'power', 'active', 'exploring', 'low'] as const).map(level => (
                  <button
                    key={level}
                    onClick={() => handleLevelFilter(level)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                      filters.level_filter === level
                        ? 'bg-cscx-accent text-white'
                        : 'text-cscx-gray-400 hover:text-white'
                    }`}
                  >
                    {level}
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
                  onClick={() => handleSort('features')}
                >
                  Features {filters.sort_by === 'features' && (filters.sort_order === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th
                  className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort('arr')}
                >
                  ARR {filters.sort_by === 'arr' && (filters.sort_order === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">
                  Top Gap
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
                      <div className={`w-2 h-2 rounded-full ${getAdoptionBgColor(customer.level)}`} />
                      <div>
                        <p className="text-white font-medium">{customer.customer_name}</p>
                        <p className="text-cscx-gray-500 text-xs">{customer.segment}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-12 h-2 rounded-full ${getAdoptionBgLight(customer.level)}`}>
                        <div
                          className={`h-full rounded-full ${getAdoptionBgColor(customer.level)}`}
                          style={{ width: `${customer.adoption_score}%` }}
                        />
                      </div>
                      <span className={`font-medium ${getAdoptionColor(customer.adoption_score)}`}>
                        {customer.adoption_score}
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
                    <span className="text-white">
                      {customer.features_using}
                      <span className="text-cscx-gray-500">/{customer.features_available}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white font-medium">{formatCurrency(customer.arr)}</span>
                  </td>
                  <td className="px-4 py-3 text-cscx-gray-300">
                    {customer.top_gap ? (
                      <span className="text-yellow-400 text-sm">{customer.top_gap}</span>
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

      {/* Adoption Detail Modal */}
      {selectedCustomerId && (
        <AdoptionDetailModal
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

export default ProductAdoptionReport;
