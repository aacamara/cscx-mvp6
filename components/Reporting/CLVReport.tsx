/**
 * Customer Lifetime Value Report
 * PRD-173: Customer Lifetime Value Report
 *
 * Features:
 * - CLV Summary with key metrics
 * - Tier Distribution visualization
 * - Top CLV Customers table
 * - CLV Drivers analysis
 * - Customer Detail Modal
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CLVReportResponse,
  CustomerCLV,
  CustomerCLVDetail,
  CLVFilters,
  CLVTier,
  CLV_TIER_THRESHOLDS
} from '../../types/clv';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
};

const formatFullCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const getTierColor = (tier: CLVTier): string => {
  switch (tier) {
    case 'platinum': return 'text-purple-400';
    case 'gold': return 'text-yellow-400';
    case 'silver': return 'text-gray-300';
    case 'bronze': return 'text-orange-400';
  }
};

const getTierBgColor = (tier: CLVTier): string => {
  switch (tier) {
    case 'platinum': return 'bg-purple-500';
    case 'gold': return 'bg-yellow-500';
    case 'silver': return 'bg-gray-400';
    case 'bronze': return 'bg-orange-500';
  }
};

const getTierBgLight = (tier: CLVTier): string => {
  switch (tier) {
    case 'platinum': return 'bg-purple-500/20';
    case 'gold': return 'bg-yellow-500/20';
    case 'silver': return 'bg-gray-400/20';
    case 'bronze': return 'bg-orange-500/20';
  }
};

// ============================================
// CLV DETAIL MODAL
// ============================================

interface CLVDetailModalProps {
  customerId: string;
  data: CustomerCLVDetail | null;
  loading: boolean;
  onClose: () => void;
  onViewFullDetail?: (customerId: string) => void;
}

const CLVDetailModal: React.FC<CLVDetailModalProps> = ({
  customerId,
  data,
  loading,
  onClose,
  onViewFullDetail
}) => {
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8 max-w-2xl w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full" />
            <span className="ml-3 text-cscx-gray-400">Loading CLV details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { clv, drivers, history, recommendations, comparison } = data;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-cscx-gray-900 border-b border-cscx-gray-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${getTierBgColor(clv.clv_tier)}`} />
            <div>
              <h2 className="text-lg font-semibold text-white">{clv.customer_name}</h2>
              <p className="text-sm text-cscx-gray-400">{clv.segment} | {clv.clv_tier.charAt(0).toUpperCase() + clv.clv_tier.slice(1)} Tier</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-cscx-gray-400 hover:text-white p-2 rounded-lg hover:bg-cscx-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* CLV Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-cscx-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-cscx-gray-400 uppercase">Total CLV</p>
              <p className={`text-2xl font-bold ${getTierColor(clv.clv_tier)}`}>{formatCurrency(clv.total_clv)}</p>
            </div>
            <div className="bg-cscx-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-cscx-gray-400 uppercase">Current ARR</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(clv.current.arr)}</p>
            </div>
            <div className="bg-cscx-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-cscx-gray-400 uppercase">Percentile</p>
              <p className="text-2xl font-bold text-cscx-accent">{clv.clv_percentile}th</p>
            </div>
            <div className="bg-cscx-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-cscx-gray-400 uppercase">Tenure</p>
              <p className="text-2xl font-bold text-white">{Math.round(clv.historical.months_as_customer / 12)}+ yrs</p>
            </div>
          </div>

          {/* Historical vs Predicted */}
          <div className="bg-cscx-gray-800/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-3">CLV Breakdown</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-cscx-gray-400">Historical Revenue</span>
                <span className="text-sm font-medium text-white">{formatFullCurrency(clv.historical.total_revenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-cscx-gray-400">Predicted Future Value</span>
                <span className="text-sm font-medium text-green-400">{formatFullCurrency(clv.predicted.predicted_clv)}</span>
              </div>
              <div className="border-t border-cscx-gray-700 pt-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Total CLV</span>
                <span className="text-sm font-bold text-cscx-accent">{formatFullCurrency(clv.total_clv)}</span>
              </div>
            </div>
          </div>

          {/* Prediction Details */}
          <div className="bg-cscx-gray-800/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Prediction Factors</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-cscx-gray-400">Est. Remaining Lifetime</p>
                <p className="text-lg font-medium text-white">{clv.predicted.remaining_lifetime_months} months</p>
              </div>
              <div>
                <p className="text-xs text-cscx-gray-400">Churn Probability</p>
                <p className={`text-lg font-medium ${clv.predicted.churn_probability > 0.2 ? 'text-red-400' : 'text-green-400'}`}>
                  {Math.round(clv.predicted.churn_probability * 100)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-cscx-gray-400">Expansion Probability</p>
                <p className="text-lg font-medium text-green-400">{Math.round(clv.predicted.expansion_probability * 100)}%</p>
              </div>
              <div>
                <p className="text-xs text-cscx-gray-400">CLV Range (80% CI)</p>
                <p className="text-lg font-medium text-white">
                  {formatCurrency(clv.predicted.clv_range.low)} - {formatCurrency(clv.predicted.clv_range.high)}
                </p>
              </div>
            </div>
          </div>

          {/* Comparison */}
          <div className="bg-cscx-gray-800/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Comparison</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-cscx-gray-400">vs Segment Average ({formatCurrency(comparison.segment_avg)})</span>
                <span className={`text-sm font-medium ${comparison.vs_segment >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {comparison.vs_segment >= 0 ? '+' : ''}{formatCurrency(comparison.vs_segment)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-cscx-gray-400">vs Portfolio Average ({formatCurrency(comparison.portfolio_avg)})</span>
                <span className={`text-sm font-medium ${comparison.vs_portfolio >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {comparison.vs_portfolio >= 0 ? '+' : ''}{formatCurrency(comparison.vs_portfolio)}
                </span>
              </div>
            </div>
          </div>

          {/* CLV Drivers */}
          <div className="bg-cscx-gray-800/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-3">CLV Drivers</h3>
            <div className="space-y-2">
              {drivers.map((driver, idx) => (
                <div key={idx} className="flex items-center justify-between py-1">
                  <span className="text-sm text-cscx-gray-300">{driver.factor}</span>
                  <span className={`text-sm font-medium ${driver.direction === 'positive' ? 'text-green-400' : 'text-red-400'}`}>
                    {driver.direction === 'positive' ? '+' : '-'}{formatCurrency(Math.abs(driver.impact))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="bg-cscx-gray-800/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Recommendations</h3>
              <ul className="space-y-2">
                {recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-cscx-gray-300">
                    <span className="text-cscx-accent">*</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          {onViewFullDetail && (
            <div className="flex justify-end">
              <button
                onClick={() => onViewFullDetail(customerId)}
                className="px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/90 text-white rounded-lg text-sm font-medium transition-colors"
              >
                View Full Customer Detail
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

interface CLVReportProps {
  onSelectCustomer?: (customerId: string) => void;
}

export const CLVReport: React.FC<CLVReportProps> = ({ onSelectCustomer }) => {
  // State
  const [data, setData] = useState<CLVReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CLVFilters>({
    sort_by: 'clv',
    sort_order: 'desc',
    search: ''
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<CustomerCLVDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch CLV report
  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.segment) params.append('segment', filters.segment);
      if (filters.tier) params.append('tier', filters.tier);
      if (filters.min_clv) params.append('min_clv', String(filters.min_clv));
      if (filters.sort_by) params.append('sort_by', filters.sort_by);
      if (filters.sort_order) params.append('sort_order', filters.sort_order);
      if (filters.search) params.append('search', filters.search);

      const response = await fetch(`${API_BASE}/reports/clv?${params}`);
      if (!response.ok) throw new Error('Failed to fetch CLV report');

      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        throw new Error(result.error?.message || 'Failed to load CLV report');
      }
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
      const response = await fetch(`${API_BASE}/reports/clv/${customerId}`);
      if (!response.ok) throw new Error('Failed to fetch customer CLV detail');

      const result = await response.json();
      if (result.success) {
        setDetailData(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch customer CLV detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerDetail(selectedCustomerId);
    }
  }, [selectedCustomerId, fetchCustomerDetail]);

  // Handlers
  const handleSort = (field: 'clv' | 'arr' | 'name') => {
    setFilters(prev => ({
      ...prev,
      sort_by: field,
      sort_order: prev.sort_by === field && prev.sort_order === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleTierFilter = (tier: CLVTier | 'all') => {
    setFilters(prev => ({ ...prev, tier: tier === 'all' ? undefined : tier }));
  };

  const handleCustomerClick = (customer: CustomerCLV) => {
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
        Loading CLV report...
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="p-8 text-center text-red-400">
        {error}
        <button
          onClick={fetchReport}
          className="block mx-auto mt-2 text-sm text-cscx-accent hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { summary, customers, distribution, top_drivers } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Customer Lifetime Value Report</h2>
          <p className="text-cscx-gray-400 text-sm mt-1">
            Portfolio CLV analysis and predictions
          </p>
        </div>
        <button
          onClick={fetchReport}
          className="px-4 py-2 text-sm bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* CLV Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-sm text-cscx-gray-400 uppercase tracking-wider">Total CLV</p>
          <p className="text-3xl font-bold text-cscx-accent mt-1">{formatCurrency(summary.total_clv)}</p>
          <p className="text-sm text-cscx-gray-400 mt-1">{summary.total_customers} customers</p>
        </div>
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-sm text-cscx-gray-400 uppercase tracking-wider">Average CLV</p>
          <p className="text-3xl font-bold text-white mt-1">{formatCurrency(summary.avg_clv)}</p>
          <p className={`text-sm mt-1 ${summary.clv_change_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {summary.clv_change_percent >= 0 ? '+' : ''}{summary.clv_change_percent}% vs last year
          </p>
        </div>
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-sm text-cscx-gray-400 uppercase tracking-wider">CLV/CAC Ratio</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{summary.clv_cac_ratio}x</p>
          <p className="text-sm text-cscx-gray-400 mt-1">Target: 3.0x+</p>
        </div>
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-sm text-cscx-gray-400 uppercase tracking-wider">Median CLV</p>
          <p className="text-3xl font-bold text-white mt-1">{formatCurrency(summary.median_clv)}</p>
          <p className="text-sm text-cscx-gray-400 mt-1">50th percentile</p>
        </div>
      </div>

      {/* Tier Distribution */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-white mb-4">CLV Distribution by Tier</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {summary.tiers.map((tier) => (
            <div
              key={tier.tier}
              onClick={() => handleTierFilter(tier.tier)}
              className={`p-4 rounded-lg cursor-pointer transition-all ${
                filters.tier === tier.tier
                  ? `${getTierBgLight(tier.tier)} border border-current ${getTierColor(tier.tier)}`
                  : 'bg-cscx-gray-800/50 hover:bg-cscx-gray-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium capitalize ${getTierColor(tier.tier)}`}>
                  {tier.tier}
                </span>
                <span className={`w-3 h-3 rounded-full ${getTierBgColor(tier.tier)}`} />
              </div>
              <p className="text-2xl font-bold text-white">{tier.customer_count}</p>
              <p className="text-sm text-cscx-gray-400">{formatCurrency(tier.total_clv)} total</p>
              <div className="mt-2 h-2 bg-cscx-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getTierBgColor(tier.tier)}`}
                  style={{ width: `${tier.pct_of_portfolio}%` }}
                />
              </div>
              <p className="text-xs text-cscx-gray-500 mt-1">{tier.pct_of_portfolio}% of portfolio CLV</p>
            </div>
          ))}
        </div>
        {filters.tier && (
          <button
            onClick={() => handleTierFilter('all')}
            className="mt-3 text-sm text-cscx-accent hover:underline"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* CLV Drivers */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-white mb-4">CLV Drivers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {top_drivers.map((driver, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg ${
                driver.direction === 'positive' ? 'bg-green-500/10' : 'bg-red-500/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">{driver.factor}</span>
                <span className={`font-semibold ${
                  driver.direction === 'positive' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {driver.direction === 'positive' ? '+' : ''}{formatCurrency(driver.impact)}
                </span>
              </div>
              <p className="text-sm text-cscx-gray-400 mt-1">{driver.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top CLV Customers Table */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-cscx-gray-800">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Top CLV Customers</h3>
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
                  onClick={() => handleSort('clv')}
                >
                  Total CLV {filters.sort_by === 'clv' && (filters.sort_order === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th
                  className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort('arr')}
                >
                  Current ARR {filters.sort_by === 'arr' && (filters.sort_order === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">
                  Tier
                </th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">
                  Predicted CLV
                </th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">
                  Percentile
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cscx-gray-800">
              {customers.slice(0, 20).map((customer) => (
                <tr
                  key={customer.customer_id}
                  onClick={() => handleCustomerClick(customer)}
                  className="hover:bg-cscx-gray-800/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${getTierBgColor(customer.clv_tier)}`} />
                      <div>
                        <p className="text-white font-medium">{customer.customer_name}</p>
                        <p className="text-cscx-gray-500 text-xs">{customer.segment}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${getTierColor(customer.clv_tier)}`}>
                      {formatCurrency(customer.total_clv)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white">
                    {formatCurrency(customer.current.arr)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded capitalize ${getTierBgLight(customer.clv_tier)} ${getTierColor(customer.clv_tier)}`}>
                      {customer.clv_tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-green-400">
                    {formatCurrency(customer.predicted.predicted_clv)}
                  </td>
                  <td className="px-4 py-3 text-cscx-gray-300">
                    {customer.clv_percentile}th
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
          Showing {Math.min(20, customers.length)} of {customers.length} customers
        </div>
      </div>

      {/* Distribution Chart */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-white mb-4">CLV Distribution</h3>
        <div className="space-y-3">
          {distribution.buckets.map((bucket, idx) => (
            <div key={idx} className="flex items-center gap-4">
              <span className="text-sm text-cscx-gray-400 w-24">{bucket.range_label}</span>
              <div className="flex-1 h-6 bg-cscx-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cscx-accent rounded-full transition-all duration-500"
                  style={{ width: `${bucket.pct_of_total}%` }}
                />
              </div>
              <span className="text-sm text-white w-20 text-right">{bucket.count} cust</span>
              <span className="text-sm text-cscx-gray-400 w-24 text-right">{bucket.pct_of_total}%</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-cscx-gray-800 grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xs text-cscx-gray-400">25th Percentile</p>
            <p className="text-lg font-semibold text-white">{formatCurrency(distribution.percentiles.p25)}</p>
          </div>
          <div>
            <p className="text-xs text-cscx-gray-400">Median (50th)</p>
            <p className="text-lg font-semibold text-white">{formatCurrency(distribution.percentiles.p50)}</p>
          </div>
          <div>
            <p className="text-xs text-cscx-gray-400">75th Percentile</p>
            <p className="text-lg font-semibold text-white">{formatCurrency(distribution.percentiles.p75)}</p>
          </div>
          <div>
            <p className="text-xs text-cscx-gray-400">90th Percentile</p>
            <p className="text-lg font-semibold text-cscx-accent">{formatCurrency(distribution.percentiles.p90)}</p>
          </div>
        </div>
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomerId && (
        <CLVDetailModal
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

export default CLVReport;
