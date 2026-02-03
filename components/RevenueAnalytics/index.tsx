/**
 * CSCX.AI Revenue Analytics Dashboard
 * PRD-158: Revenue Analytics Report
 *
 * Comprehensive revenue analytics including ARR/MRR tracking,
 * revenue movements, retention metrics, and concentration analysis.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

interface RevenueTotals {
  starting_arr: number;
  ending_arr: number;
  starting_mrr: number;
  ending_mrr: number;
  customer_count: number;
  arr_change: number;
  arr_change_percent: number;
}

interface RevenueMovementTotals {
  new_business: number;
  expansion: number;
  contraction: number;
  churn: number;
  net_change: number;
}

interface RetentionMetrics {
  gross_retention: number;
  net_retention: number;
  logo_retention: number;
  gross_retention_target: number;
  net_retention_target: number;
  logo_retention_target: number;
}

interface RevenueAverages {
  arpa: number;
  arpa_change: number;
  arpa_change_percent: number;
  lifetime_value: number;
}

interface RevenueSummary {
  period: string;
  period_label: string;
  totals: RevenueTotals;
  movements: RevenueMovementTotals;
  retention: RetentionMetrics;
  averages: RevenueAverages;
}

interface RevenueMovement {
  id: string;
  customer_id: string;
  customer_name: string;
  movement_date: string;
  type: 'new' | 'expansion' | 'contraction' | 'churn' | 'reactivation';
  previous_arr: number;
  new_arr: number;
  change_amount: number;
  reason?: string;
  source?: string;
}

interface RevenueTrend {
  period: string;
  period_label: string;
  arr: number;
  mrr: number;
  customer_count: number;
  nrr: number;
  grr: number;
}

interface SegmentBreakdown {
  segment: string;
  segment_label: string;
  arr: number;
  arr_percent: number;
  customer_count: number;
  nrr: number;
  grr: number;
  change_amount: number;
  change_percent: number;
  avg_arr: number;
}

interface CSMBreakdown {
  csm_id: string;
  csm_name: string;
  arr: number;
  arr_percent: number;
  customer_count: number;
  nrr: number;
  grr: number;
  expansion: number;
  contraction: number;
  churn: number;
  net_change: number;
}

interface ConcentrationAnalysis {
  total_arr: number;
  top_10: {
    top_n: number;
    arr: number;
    percent_of_total: number;
    customers: Array<{ id: string; name: string; arr: number; percent: number }>;
  };
  top_25: {
    top_n: number;
    arr: number;
    percent_of_total: number;
    customers: Array<{ id: string; name: string; arr: number; percent: number }>;
  };
  largest_customer: {
    id: string;
    name: string;
    arr: number;
    percent: number;
  };
  concentration_risk: 'low' | 'medium' | 'high';
  risk_threshold: number;
  risk_message: string;
}

interface RevenueAnalyticsData {
  summary: RevenueSummary;
  movements: RevenueMovement[];
  trends: RevenueTrend[];
  by_segment: SegmentBreakdown[];
  by_csm: CSMBreakdown[];
}

interface RevenueAnalyticsProps {
  onSelectCustomer?: (customerId: string) => void;
}

// ============================================
// Constants
// ============================================

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

const PERIOD_OPTIONS = [
  { value: 'current_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'current_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'current_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' }
];

// ============================================
// Helper Functions
// ============================================

const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
};

const formatCurrencyFull = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatPercent = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value}%`;
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// ============================================
// Component
// ============================================

export const RevenueAnalytics: React.FC<RevenueAnalyticsProps> = ({
  onSelectCustomer
}) => {
  const { getAuthHeaders } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('current_quarter');
  const [activeTab, setActiveTab] = useState<'overview' | 'movements' | 'segments' | 'csm' | 'concentration'>('overview');
  const [data, setData] = useState<RevenueAnalyticsData | null>(null);
  const [concentration, setConcentration] = useState<ConcentrationAnalysis | null>(null);
  const [movementFilter, setMovementFilter] = useState<string>('all');

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [analyticsRes, concentrationRes] = await Promise.all([
        fetch(`${API_BASE}/reports/revenue-analytics?period=${period}`, {
          headers: getAuthHeaders()
        }),
        fetch(`${API_BASE}/reports/revenue-analytics/concentration`, {
          headers: getAuthHeaders()
        })
      ]);

      if (!analyticsRes.ok) throw new Error('Failed to fetch revenue analytics');
      if (!concentrationRes.ok) throw new Error('Failed to fetch concentration analysis');

      const analyticsData = await analyticsRes.json();
      const concentrationData = await concentrationRes.json();

      if (analyticsData.success) {
        setData(analyticsData.data);
      }
      if (concentrationData.success) {
        setConcentration(concentrationData.data.analysis);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load revenue analytics');
    } finally {
      setLoading(false);
    }
  }, [period, getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get movement type color
  const getMovementColor = (type: string): string => {
    const colors: Record<string, string> = {
      new: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
      expansion: 'text-green-400 bg-green-500/20 border-green-500/30',
      contraction: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
      churn: 'text-red-400 bg-red-500/20 border-red-500/30',
      reactivation: 'text-purple-400 bg-purple-500/20 border-purple-500/30'
    };
    return colors[type] || 'text-gray-400 bg-gray-500/20 border-gray-500/30';
  };

  // Get retention metric color
  const getRetentionColor = (value: number, target: number): string => {
    if (value >= target) return 'text-green-400';
    if (value >= target * 0.95) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Get risk color
  const getRiskColor = (risk: string): string => {
    const colors: Record<string, string> = {
      low: 'text-green-400 bg-green-500/20 border-green-500/30',
      medium: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
      high: 'text-red-400 bg-red-500/20 border-red-500/30'
    };
    return colors[risk] || 'text-gray-400';
  };

  // Filter movements
  const filteredMovements = data?.movements.filter(m => {
    if (movementFilter === 'all') return true;
    return m.type === movementFilter;
  }) || [];

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-cscx-accent border-t-transparent" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Revenue Analytics</h2>
          <p className="text-cscx-gray-400 mt-1">
            {data.summary.period_label} - Portfolio revenue and retention metrics
          </p>
        </div>

        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-4 py-2 bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
        >
          {PERIOD_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total ARR */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Total ARR</p>
          <p className="text-2xl font-bold text-cscx-accent mt-1">
            {formatCurrency(data.summary.totals.ending_arr)}
          </p>
          <p className={`text-sm mt-1 ${data.summary.totals.arr_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(Math.abs(data.summary.totals.arr_change))} ({formatPercent(data.summary.totals.arr_change_percent)})
          </p>
        </div>

        {/* MRR */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">MRR</p>
          <p className="text-2xl font-bold text-white mt-1">
            {formatCurrency(data.summary.totals.ending_mrr)}
          </p>
          <p className="text-sm text-cscx-gray-400 mt-1">
            {data.summary.totals.customer_count} customers
          </p>
        </div>

        {/* Net Revenue Retention */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Net Retention</p>
          <p className={`text-2xl font-bold mt-1 ${getRetentionColor(data.summary.retention.net_retention, data.summary.retention.net_retention_target)}`}>
            {data.summary.retention.net_retention}%
          </p>
          <p className="text-sm text-cscx-gray-400 mt-1">
            Target: {data.summary.retention.net_retention_target}%
          </p>
        </div>

        {/* Gross Revenue Retention */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Gross Retention</p>
          <p className={`text-2xl font-bold mt-1 ${getRetentionColor(data.summary.retention.gross_retention, data.summary.retention.gross_retention_target)}`}>
            {data.summary.retention.gross_retention}%
          </p>
          <p className="text-sm text-cscx-gray-400 mt-1">
            Target: {data.summary.retention.gross_retention_target}%
          </p>
        </div>
      </div>

      {/* Revenue Movements Summary */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Revenue Movements</h3>
        <div className="space-y-3">
          {/* New Business */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <span className="text-white">New Business</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-48 h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${Math.min(100, (data.summary.movements.new_business / (data.summary.movements.new_business + data.summary.movements.expansion)) * 100)}%` }}
                />
              </div>
              <span className="text-green-400 font-medium w-24 text-right">
                +{formatCurrency(data.summary.movements.new_business)}
              </span>
            </div>
          </div>

          {/* Expansion */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-white">Expansion</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-48 h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${Math.min(100, (data.summary.movements.expansion / (data.summary.movements.new_business + data.summary.movements.expansion)) * 100)}%` }}
                />
              </div>
              <span className="text-green-400 font-medium w-24 text-right">
                +{formatCurrency(data.summary.movements.expansion)}
              </span>
            </div>
          </div>

          {/* Contraction */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
              <span className="text-white">Contraction</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-48 h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full"
                  style={{ width: `${Math.min(100, (data.summary.movements.contraction / (data.summary.movements.contraction + data.summary.movements.churn)) * 100 || 50)}%` }}
                />
              </div>
              <span className="text-red-400 font-medium w-24 text-right">
                -{formatCurrency(data.summary.movements.contraction)}
              </span>
            </div>
          </div>

          {/* Churn */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-white">Churn</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-48 h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full"
                  style={{ width: `${Math.min(100, (data.summary.movements.churn / (data.summary.movements.contraction + data.summary.movements.churn)) * 100 || 50)}%` }}
                />
              </div>
              <span className="text-red-400 font-medium w-24 text-right">
                -{formatCurrency(data.summary.movements.churn)}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-cscx-gray-800 pt-3 mt-3">
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold">Net Change</span>
              <span className={`text-xl font-bold ${data.summary.movements.net_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {data.summary.movements.net_change >= 0 ? '+' : ''}{formatCurrency(data.summary.movements.net_change)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-cscx-gray-900 rounded-lg w-fit">
        {[
          { id: 'overview', label: 'ARR Trend' },
          { id: 'movements', label: 'Movements' },
          { id: 'segments', label: 'By Segment' },
          { id: 'csm', label: 'By CSM' },
          { id: 'concentration', label: 'Concentration' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-cscx-accent text-white'
                : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
        {/* ARR Trend */}
        {activeTab === 'overview' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">ARR Trend (12 Months)</h3>
            <div className="h-64 flex items-end gap-2">
              {data.trends.map((trend, idx) => {
                const maxARR = Math.max(...data.trends.map(t => t.arr));
                const height = (trend.arr / maxARR) * 100;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex flex-col items-center">
                      <span className="text-xs text-cscx-gray-400 mb-1">
                        {formatCurrency(trend.arr)}
                      </span>
                      <div
                        className="w-full bg-gradient-to-t from-cscx-accent to-red-400 rounded-t transition-all duration-500"
                        style={{ height: `${height * 1.8}px` }}
                      />
                    </div>
                    <span className="text-xs text-cscx-gray-500">{trend.period_label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Movements Detail */}
        {activeTab === 'movements' && (
          <div>
            <div className="p-4 border-b border-cscx-gray-800 flex gap-2">
              {['all', 'expansion', 'contraction', 'churn', 'new'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setMovementFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    movementFilter === filter
                      ? 'bg-cscx-accent text-white border-cscx-accent'
                      : 'text-cscx-gray-400 border-cscx-gray-700 hover:border-cscx-gray-600'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
            <div className="divide-y divide-cscx-gray-800">
              {filteredMovements.length === 0 ? (
                <div className="p-8 text-center text-cscx-gray-400">
                  No movements found for this period
                </div>
              ) : (
                filteredMovements.map(movement => (
                  <div
                    key={movement.id}
                    className="p-4 hover:bg-cscx-gray-800/30 transition-colors cursor-pointer"
                    onClick={() => onSelectCustomer?.(movement.customer_id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded border ${getMovementColor(movement.type)}`}>
                          {movement.type.charAt(0).toUpperCase() + movement.type.slice(1)}
                        </span>
                        <div>
                          <p className="text-white font-medium">{movement.customer_name}</p>
                          <p className="text-sm text-cscx-gray-400">{movement.reason || 'No reason specified'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${movement.change_amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {movement.change_amount >= 0 ? '+' : ''}{formatCurrencyFull(movement.change_amount)}
                        </p>
                        <p className="text-sm text-cscx-gray-400">{formatDate(movement.movement_date)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Segment Breakdown */}
        {activeTab === 'segments' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cscx-gray-800/50 border-b border-cscx-gray-800">
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Segment</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">ARR</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">% Total</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Customers</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">NRR</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">GRR</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cscx-gray-800">
                {data.by_segment.map(segment => (
                  <tr key={segment.segment} className="hover:bg-cscx-gray-800/30">
                    <td className="px-4 py-3 text-white font-medium">{segment.segment_label}</td>
                    <td className="px-4 py-3 text-right text-white">{formatCurrency(segment.arr)}</td>
                    <td className="px-4 py-3 text-right text-cscx-gray-300">{segment.arr_percent}%</td>
                    <td className="px-4 py-3 text-right text-cscx-gray-300">{segment.customer_count}</td>
                    <td className={`px-4 py-3 text-right font-medium ${segment.nrr >= 100 ? 'text-green-400' : 'text-red-400'}`}>
                      {segment.nrr}%
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${segment.grr >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {segment.grr}%
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${segment.change_amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {segment.change_amount >= 0 ? '+' : ''}{formatCurrency(segment.change_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CSM Breakdown */}
        {activeTab === 'csm' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cscx-gray-800/50 border-b border-cscx-gray-800">
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">CSM</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">ARR</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Customers</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">NRR</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Expansion</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Contraction</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Net Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cscx-gray-800">
                {data.by_csm.map(csm => (
                  <tr key={csm.csm_id} className="hover:bg-cscx-gray-800/30">
                    <td className="px-4 py-3 text-white font-medium">{csm.csm_name}</td>
                    <td className="px-4 py-3 text-right text-white">{formatCurrency(csm.arr)}</td>
                    <td className="px-4 py-3 text-right text-cscx-gray-300">{csm.customer_count}</td>
                    <td className={`px-4 py-3 text-right font-medium ${csm.nrr >= 100 ? 'text-green-400' : 'text-red-400'}`}>
                      {csm.nrr}%
                    </td>
                    <td className="px-4 py-3 text-right text-green-400">
                      +{formatCurrency(csm.expansion)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-400">
                      -{formatCurrency(csm.contraction + csm.churn)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${csm.net_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {csm.net_change >= 0 ? '+' : ''}{formatCurrency(csm.net_change)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Concentration Analysis */}
        {activeTab === 'concentration' && concentration && (
          <div className="p-6 space-y-6">
            {/* Risk Alert */}
            <div className={`p-4 rounded-lg border ${getRiskColor(concentration.concentration_risk)}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {concentration.concentration_risk === 'high' ? '!!!' : concentration.concentration_risk === 'medium' ? '!!' : '!!!'}
                </span>
                <div>
                  <p className="font-medium">{concentration.risk_message}</p>
                  <p className="text-sm opacity-75 mt-1">
                    Risk threshold: {concentration.risk_threshold}% of total ARR
                  </p>
                </div>
              </div>
            </div>

            {/* Concentration Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-cscx-gray-800/50 rounded-lg p-4">
                <p className="text-sm text-cscx-gray-400">Largest Customer</p>
                <p className="text-xl font-bold text-white mt-1">{concentration.largest_customer.name}</p>
                <p className="text-cscx-accent font-medium">
                  {formatCurrency(concentration.largest_customer.arr)} ({concentration.largest_customer.percent}%)
                </p>
              </div>
              <div className="bg-cscx-gray-800/50 rounded-lg p-4">
                <p className="text-sm text-cscx-gray-400">Top 10 Customers</p>
                <p className="text-xl font-bold text-white mt-1">{concentration.top_10.percent_of_total}% of ARR</p>
                <p className="text-cscx-gray-300 font-medium">
                  {formatCurrency(concentration.top_10.arr)}
                </p>
              </div>
              <div className="bg-cscx-gray-800/50 rounded-lg p-4">
                <p className="text-sm text-cscx-gray-400">Top 25 Customers</p>
                <p className="text-xl font-bold text-white mt-1">{concentration.top_25.percent_of_total}% of ARR</p>
                <p className="text-cscx-gray-300 font-medium">
                  {formatCurrency(concentration.top_25.arr)}
                </p>
              </div>
            </div>

            {/* Top Customers Table */}
            <div>
              <h4 className="text-lg font-semibold text-white mb-3">Top 10 Customers by ARR</h4>
              <div className="space-y-2">
                {concentration.top_10.customers.map((customer, idx) => (
                  <div
                    key={customer.id}
                    className="flex items-center gap-4 p-3 bg-cscx-gray-800/30 rounded-lg hover:bg-cscx-gray-800/50 transition-colors cursor-pointer"
                    onClick={() => onSelectCustomer?.(customer.id)}
                  >
                    <span className="w-6 h-6 flex items-center justify-center bg-cscx-gray-700 rounded text-sm font-medium text-cscx-gray-300">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-white font-medium">{customer.name}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-32 h-2 bg-cscx-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cscx-accent rounded-full"
                          style={{ width: `${customer.percent * 3}%` }}
                        />
                      </div>
                      <span className="text-white font-medium w-20 text-right">
                        {formatCurrency(customer.arr)}
                      </span>
                      <span className="text-cscx-gray-400 w-12 text-right">
                        {customer.percent}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ARPA */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Average Revenue Per Account</p>
          <p className="text-2xl font-bold text-white mt-1">
            {formatCurrency(data.summary.averages.arpa)}
          </p>
          <p className={`text-sm mt-1 ${data.summary.averages.arpa_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPercent(data.summary.averages.arpa_change_percent)} vs previous period
          </p>
        </div>

        {/* Logo Retention */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Logo Retention</p>
          <p className={`text-2xl font-bold mt-1 ${getRetentionColor(data.summary.retention.logo_retention, data.summary.retention.logo_retention_target)}`}>
            {data.summary.retention.logo_retention}%
          </p>
          <p className="text-sm text-cscx-gray-400 mt-1">
            Target: {data.summary.retention.logo_retention_target}%
          </p>
        </div>

        {/* LTV */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Est. Lifetime Value</p>
          <p className="text-2xl font-bold text-white mt-1">
            {formatCurrency(data.summary.averages.lifetime_value)}
          </p>
          <p className="text-sm text-cscx-gray-400 mt-1">
            Based on current retention
          </p>
        </div>
      </div>
    </div>
  );
};

export default RevenueAnalytics;
