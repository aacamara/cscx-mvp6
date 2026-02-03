/**
 * CSCX.AI Net Revenue Retention Report Dashboard
 * PRD-174: Net Revenue Retention Report
 *
 * Comprehensive NRR analytics including waterfall visualization,
 * segment/CSM breakdown, cohort analysis, trend tracking, and forecasting.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

interface NRRComponents {
  starting_arr: number;
  expansion: number;
  contraction: number;
  churn: number;
  ending_arr: number;
}

interface NRRRates {
  nrr: number;
  grr: number;
  expansion_rate: number;
  contraction_rate: number;
  churn_rate: number;
}

interface NRRComparisons {
  vs_previous_period: number;
  vs_same_period_last_year: number;
  vs_target: number;
}

interface NRRMetrics {
  period: string;
  period_label: string;
  components: NRRComponents;
  rates: NRRRates;
  comparisons: NRRComparisons;
}

interface NRRTrend {
  period: string;
  period_label: string;
  nrr: number;
  grr: number;
  expansion: number;
  contraction: number;
  churn: number;
  starting_arr: number;
  ending_arr: number;
}

interface SegmentNRR {
  segment: string;
  segment_label: string;
  starting_arr: number;
  ending_arr: number;
  expansion: number;
  contraction: number;
  churn: number;
  nrr: number;
  grr: number;
  customer_count: number;
  arr_percent: number;
}

interface CSMNRR {
  csm_id: string;
  csm_name: string;
  starting_arr: number;
  ending_arr: number;
  expansion: number;
  contraction: number;
  churn: number;
  nrr: number;
  grr: number;
  customer_count: number;
  arr_percent: number;
  rank: number;
}

interface CohortNRR {
  cohort: string;
  cohort_label: string;
  start_date: string;
  customer_count: number;
  starting_arr: number;
  current_arr: number;
  nrr: number;
  grr: number;
  months_since_start: number;
}

interface NRRDriver {
  category: string;
  type: 'expansion' | 'contraction' | 'churn';
  amount: number;
  count: number;
  percent_of_total: number;
}

interface NRRForecast {
  period: string;
  period_label: string;
  projected_nrr: number;
  projected_arr: number;
  confidence_low: number;
  confidence_high: number;
  assumptions: string[];
}

interface NRRReportData {
  current: NRRMetrics;
  trends: NRRTrend[];
  by_segment: SegmentNRR[];
  by_csm: CSMNRR[];
  forecast: NRRForecast;
}

interface NRRBreakdownData {
  expansion_details: any[];
  contraction_details: any[];
  churn_details: any[];
  drivers: NRRDriver[];
}

interface NRRReportProps {
  onSelectCustomer?: (customerId: string) => void;
}

// ============================================
// Constants
// ============================================

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

const PERIOD_TYPE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' }
];

const NRR_TARGET = 110;

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

const formatPercent = (value: number, showSign = true): string => {
  if (showSign) {
    return `${value >= 0 ? '+' : ''}${value}%`;
  }
  return `${value}%`;
};

// ============================================
// Component
// ============================================

export const NRRReport: React.FC<NRRReportProps> = ({
  onSelectCustomer
}) => {
  const { getAuthHeaders } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly' | 'annual'>('quarterly');
  const [activeTab, setActiveTab] = useState<'waterfall' | 'trends' | 'segments' | 'csm' | 'cohorts' | 'drivers' | 'forecast'>('waterfall');
  const [data, setData] = useState<NRRReportData | null>(null);
  const [breakdown, setBreakdown] = useState<NRRBreakdownData | null>(null);
  const [cohorts, setCohorts] = useState<CohortNRR[]>([]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [reportRes, breakdownRes, cohortsRes] = await Promise.all([
        fetch(`${API_BASE}/reports/nrr?period_type=${periodType}`, {
          headers: getAuthHeaders()
        }),
        fetch(`${API_BASE}/reports/nrr/breakdown`, {
          headers: getAuthHeaders()
        }),
        fetch(`${API_BASE}/reports/nrr/cohorts`, {
          headers: getAuthHeaders()
        })
      ]);

      if (!reportRes.ok) throw new Error('Failed to fetch NRR report');
      if (!breakdownRes.ok) throw new Error('Failed to fetch NRR breakdown');
      if (!cohortsRes.ok) throw new Error('Failed to fetch NRR cohorts');

      const reportData = await reportRes.json();
      const breakdownData = await breakdownRes.json();
      const cohortsData = await cohortsRes.json();

      if (reportData.success) {
        setData(reportData.data);
      }
      if (breakdownData.success) {
        setBreakdown(breakdownData.data);
      }
      if (cohortsData.success) {
        setCohorts(cohortsData.data.cohorts || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load NRR report');
    } finally {
      setLoading(false);
    }
  }, [periodType, getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get NRR status color
  const getNRRColor = (nrr: number): string => {
    if (nrr >= NRR_TARGET) return 'text-green-400';
    if (nrr >= 100) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Get comparison badge color
  const getComparisonColor = (value: number): string => {
    if (value > 0) return 'text-green-400 bg-green-500/20';
    if (value < 0) return 'text-red-400 bg-red-500/20';
    return 'text-gray-400 bg-gray-500/20';
  };

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
          <h2 className="text-2xl font-bold text-white">Net Revenue Retention Report</h2>
          <p className="text-cscx-gray-400 mt-1">
            {data.current.period_label} - Dollar-based retention with expansion analysis
          </p>
        </div>

        <select
          value={periodType}
          onChange={(e) => setPeriodType(e.target.value as typeof periodType)}
          className="px-4 py-2 bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
        >
          {PERIOD_TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* NRR Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Retention */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Net Retention (NRR)</p>
          <p className={`text-3xl font-bold mt-1 ${getNRRColor(data.current.rates.nrr)}`}>
            {data.current.rates.nrr}%
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${getComparisonColor(data.current.comparisons.vs_previous_period)}`}>
              {formatPercent(data.current.comparisons.vs_previous_period)} vs prior
            </span>
          </div>
        </div>

        {/* Gross Retention */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Gross Retention (GRR)</p>
          <p className={`text-3xl font-bold mt-1 ${data.current.rates.grr >= 92 ? 'text-green-400' : data.current.rates.grr >= 88 ? 'text-yellow-400' : 'text-red-400'}`}>
            {data.current.rates.grr}%
          </p>
          <p className="text-sm text-cscx-gray-400 mt-2">
            Excludes expansion
          </p>
        </div>

        {/* vs Target */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">vs Target ({NRR_TARGET}%)</p>
          <p className={`text-3xl font-bold mt-1 ${data.current.comparisons.vs_target >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPercent(data.current.comparisons.vs_target)}
          </p>
          <p className="text-sm text-cscx-gray-400 mt-2">
            {data.current.comparisons.vs_target >= 0 ? 'On track' : 'Below target'}
          </p>
        </div>

        {/* Expansion Rate */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Expansion Rate</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">
            {data.current.rates.expansion_rate}%
          </p>
          <p className="text-sm text-cscx-gray-400 mt-2">
            Churn: {data.current.rates.churn_rate}%
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-cscx-gray-900 rounded-lg overflow-x-auto">
        {[
          { id: 'waterfall', label: 'Waterfall' },
          { id: 'trends', label: 'NRR Trend' },
          { id: 'segments', label: 'By Segment' },
          { id: 'csm', label: 'By CSM' },
          { id: 'cohorts', label: 'By Cohort' },
          { id: 'drivers', label: 'Drivers' },
          { id: 'forecast', label: 'Forecast' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
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
        {/* Revenue Waterfall */}
        {activeTab === 'waterfall' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Revenue Waterfall</h3>

            <div className="space-y-4">
              {/* Starting ARR */}
              <div className="flex items-center justify-between p-4 bg-cscx-gray-800/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-gray-500"></div>
                  <span className="text-white font-medium">Starting ARR</span>
                </div>
                <span className="text-xl font-bold text-white">
                  {formatCurrency(data.current.components.starting_arr)}
                </span>
              </div>

              {/* Expansion */}
              <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <div>
                    <span className="text-white font-medium">+ Expansion</span>
                    <span className="text-green-400 text-sm ml-2">({data.current.rates.expansion_rate}%)</span>
                  </div>
                </div>
                <span className="text-xl font-bold text-green-400">
                  +{formatCurrency(data.current.components.expansion)}
                </span>
              </div>

              {/* Contraction */}
              <div className="flex items-center justify-between p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-yellow-500"></div>
                  <div>
                    <span className="text-white font-medium">- Contraction</span>
                    <span className="text-yellow-400 text-sm ml-2">({data.current.rates.contraction_rate}%)</span>
                  </div>
                </div>
                <span className="text-xl font-bold text-yellow-400">
                  -{formatCurrency(data.current.components.contraction)}
                </span>
              </div>

              {/* Churn */}
              <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-red-500"></div>
                  <div>
                    <span className="text-white font-medium">- Churn</span>
                    <span className="text-red-400 text-sm ml-2">({data.current.rates.churn_rate}%)</span>
                  </div>
                </div>
                <span className="text-xl font-bold text-red-400">
                  -{formatCurrency(data.current.components.churn)}
                </span>
              </div>

              {/* Divider with NRR calculation */}
              <div className="border-t-2 border-dashed border-cscx-gray-700 pt-4 mt-4">
                <div className="flex items-center justify-center gap-4 text-cscx-gray-400 text-sm mb-4">
                  <span>NRR = (Starting + Expansion - Contraction - Churn) / Starting</span>
                </div>
              </div>

              {/* Ending ARR */}
              <div className="flex items-center justify-between p-4 bg-cscx-accent/10 border border-cscx-accent/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-cscx-accent"></div>
                  <span className="text-white font-medium">= Ending ARR</span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-cscx-accent">
                    {formatCurrency(data.current.components.ending_arr)}
                  </span>
                  <p className={`text-lg font-bold ${getNRRColor(data.current.rates.nrr)}`}>
                    NRR = {data.current.rates.nrr}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* NRR Trend */}
        {activeTab === 'trends' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-6">NRR Trend (12 Months)</h3>

            {/* NRR Chart */}
            <div className="h-64 flex items-end gap-1 mb-6">
              {data.trends.map((trend, idx) => {
                const maxNRR = Math.max(...data.trends.map(t => t.nrr), NRR_TARGET + 10);
                const minNRR = Math.min(...data.trends.map(t => t.nrr), 90);
                const range = maxNRR - minNRR;
                const height = ((trend.nrr - minNRR) / range) * 100;
                const targetHeight = ((NRR_TARGET - minNRR) / range) * 100;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center relative">
                    {/* Target line indicator */}
                    {idx === 0 && (
                      <div
                        className="absolute w-full border-t border-dashed border-cscx-accent z-10"
                        style={{ bottom: `${targetHeight * 1.8}px` }}
                      />
                    )}
                    <div className="w-full flex flex-col items-center">
                      <span className={`text-xs mb-1 ${getNRRColor(trend.nrr)}`}>
                        {trend.nrr}%
                      </span>
                      <div
                        className={`w-full rounded-t transition-all duration-500 ${
                          trend.nrr >= NRR_TARGET ? 'bg-green-500' : trend.nrr >= 100 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ height: `${height * 1.8}px`, minHeight: '20px' }}
                      />
                    </div>
                    <span className="text-xs text-cscx-gray-500 mt-2">{trend.period_label}</span>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-500"></div>
                <span className="text-cscx-gray-400">Above target ({NRR_TARGET}%+)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-yellow-500"></div>
                <span className="text-cscx-gray-400">100-{NRR_TARGET - 1}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-500"></div>
                <span className="text-cscx-gray-400">Below 100%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 border-t border-dashed border-cscx-accent"></div>
                <span className="text-cscx-gray-400">Target</span>
              </div>
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
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Starting</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Ending</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">NRR</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">GRR</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Expansion</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Contraction</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Churn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cscx-gray-800">
                {data.by_segment.map(segment => (
                  <tr key={segment.segment} className="hover:bg-cscx-gray-800/30">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white font-medium">{segment.segment_label}</p>
                        <p className="text-xs text-cscx-gray-400">{segment.customer_count} customers ({segment.arr_percent}% ARR)</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-white">{formatCurrency(segment.starting_arr)}</td>
                    <td className="px-4 py-3 text-right text-white">{formatCurrency(segment.ending_arr)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${getNRRColor(segment.nrr)}`}>
                      {segment.nrr}%
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${segment.grr >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {segment.grr}%
                    </td>
                    <td className="px-4 py-3 text-right text-green-400">
                      +{formatCurrency(segment.expansion)}
                    </td>
                    <td className="px-4 py-3 text-right text-yellow-400">
                      -{formatCurrency(segment.contraction)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-400">
                      -{formatCurrency(segment.churn)}
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
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Rank</th>
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">CSM</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">ARR</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">NRR</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">GRR</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Expansion</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Contraction</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Churn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cscx-gray-800">
                {data.by_csm.map(csm => (
                  <tr key={csm.csm_id} className="hover:bg-cscx-gray-800/30">
                    <td className="px-4 py-3">
                      <span className={`w-6 h-6 flex items-center justify-center rounded ${
                        csm.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                        csm.rank === 2 ? 'bg-gray-400/20 text-gray-400' :
                        csm.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-cscx-gray-700 text-cscx-gray-400'
                      } text-xs font-medium`}>
                        {csm.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white font-medium">{csm.csm_name}</p>
                        <p className="text-xs text-cscx-gray-400">{csm.customer_count} customers</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-white">
                      {formatCurrency(csm.ending_arr)}
                      <span className="text-cscx-gray-400 text-xs ml-1">({csm.arr_percent}%)</span>
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${getNRRColor(csm.nrr)}`}>
                      {csm.nrr}%
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${csm.grr >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {csm.grr}%
                    </td>
                    <td className="px-4 py-3 text-right text-green-400">
                      +{formatCurrency(csm.expansion)}
                    </td>
                    <td className="px-4 py-3 text-right text-yellow-400">
                      -{formatCurrency(csm.contraction)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-400">
                      -{formatCurrency(csm.churn)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Cohort Analysis */}
        {activeTab === 'cohorts' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">NRR by Customer Cohort</h3>
            <p className="text-cscx-gray-400 text-sm mb-6">
              Track NRR performance across customer cohorts based on sign-up date
            </p>

            <div className="space-y-3">
              {cohorts.map(cohort => (
                <div
                  key={cohort.cohort}
                  className="flex items-center gap-4 p-4 bg-cscx-gray-800/30 rounded-lg"
                >
                  <div className="w-24">
                    <p className="text-white font-medium">{cohort.cohort_label}</p>
                    <p className="text-xs text-cscx-gray-400">{cohort.months_since_start} months</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-3 bg-cscx-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${cohort.nrr >= NRR_TARGET ? 'bg-green-500' : cohort.nrr >= 100 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(100, (cohort.nrr / 130) * 100)}%` }}
                        />
                      </div>
                      <span className={`w-16 text-right font-bold ${getNRRColor(cohort.nrr)}`}>
                        {cohort.nrr}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right w-32">
                    <p className="text-white font-medium">{formatCurrency(cohort.current_arr)}</p>
                    <p className="text-xs text-cscx-gray-400">{cohort.customer_count} customers</p>
                  </div>
                </div>
              ))}
            </div>

            {cohorts.length === 0 && (
              <div className="text-center py-8 text-cscx-gray-400">
                No cohort data available
              </div>
            )}
          </div>
        )}

        {/* NRR Drivers */}
        {activeTab === 'drivers' && breakdown && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-6">NRR Drivers Analysis</h3>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Expansion Drivers */}
              <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
                <h4 className="text-green-400 font-medium mb-3">Top Expansion Drivers</h4>
                <div className="space-y-2">
                  {breakdown.drivers
                    .filter(d => d.type === 'expansion')
                    .slice(0, 5)
                    .map((driver, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-white text-sm">{driver.category}</span>
                        <div className="text-right">
                          <span className="text-green-400 font-medium">{formatCurrency(driver.amount)}</span>
                          <span className="text-cscx-gray-400 text-xs ml-2">({driver.percent_of_total}%)</span>
                        </div>
                      </div>
                    ))}
                  {breakdown.drivers.filter(d => d.type === 'expansion').length === 0 && (
                    <p className="text-cscx-gray-400 text-sm">No expansion data</p>
                  )}
                </div>
              </div>

              {/* Contraction Drivers */}
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4">
                <h4 className="text-yellow-400 font-medium mb-3">Top Contraction Drivers</h4>
                <div className="space-y-2">
                  {breakdown.drivers
                    .filter(d => d.type === 'contraction')
                    .slice(0, 5)
                    .map((driver, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-white text-sm">{driver.category}</span>
                        <div className="text-right">
                          <span className="text-yellow-400 font-medium">{formatCurrency(driver.amount)}</span>
                          <span className="text-cscx-gray-400 text-xs ml-2">({driver.percent_of_total}%)</span>
                        </div>
                      </div>
                    ))}
                  {breakdown.drivers.filter(d => d.type === 'contraction').length === 0 && (
                    <p className="text-cscx-gray-400 text-sm">No contraction data</p>
                  )}
                </div>
              </div>

              {/* Churn Drivers */}
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                <h4 className="text-red-400 font-medium mb-3">Top Churn Drivers</h4>
                <div className="space-y-2">
                  {breakdown.drivers
                    .filter(d => d.type === 'churn')
                    .slice(0, 5)
                    .map((driver, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-white text-sm">{driver.category}</span>
                        <div className="text-right">
                          <span className="text-red-400 font-medium">{formatCurrency(driver.amount)}</span>
                          <span className="text-cscx-gray-400 text-xs ml-2">({driver.percent_of_total}%)</span>
                        </div>
                      </div>
                    ))}
                  {breakdown.drivers.filter(d => d.type === 'churn').length === 0 && (
                    <p className="text-cscx-gray-400 text-sm">No churn data</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Forecast */}
        {activeTab === 'forecast' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-6">NRR Forecast</h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Forecast Summary */}
              <div className="bg-cscx-gray-800/50 rounded-lg p-6">
                <div className="text-center">
                  <p className="text-cscx-gray-400 text-sm uppercase tracking-wider">
                    Projected NRR - {data.forecast.period_label}
                  </p>
                  <p className={`text-5xl font-bold mt-2 ${getNRRColor(data.forecast.projected_nrr)}`}>
                    {data.forecast.projected_nrr}%
                  </p>
                  <p className="text-cscx-gray-400 text-sm mt-2">
                    Confidence range: {data.forecast.confidence_low}% - {data.forecast.confidence_high}%
                  </p>
                  <div className="mt-4 pt-4 border-t border-cscx-gray-700">
                    <p className="text-cscx-gray-400 text-sm">Projected ARR</p>
                    <p className="text-2xl font-bold text-white">
                      {formatCurrency(data.forecast.projected_arr)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Forecast Assumptions */}
              <div className="bg-cscx-gray-800/50 rounded-lg p-6">
                <h4 className="text-white font-medium mb-4">Forecast Assumptions</h4>
                <ul className="space-y-2">
                  {data.forecast.assumptions.map((assumption, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-cscx-accent mt-1">*</span>
                      <span className="text-cscx-gray-300">{assumption}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 pt-4 border-t border-cscx-gray-700">
                  <h4 className="text-white font-medium mb-2">Recommendations</h4>
                  <ul className="space-y-2 text-sm text-cscx-gray-300">
                    {data.forecast.projected_nrr < NRR_TARGET && (
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-400">!</span>
                        Focus on expansion to meet target
                      </li>
                    )}
                    {data.current.rates.churn_rate > 5 && (
                      <li className="flex items-start gap-2">
                        <span className="text-red-400">!</span>
                        High churn rate - review at-risk accounts
                      </li>
                    )}
                    {data.current.rates.expansion_rate > 10 && (
                      <li className="flex items-start gap-2">
                        <span className="text-green-400">+</span>
                        Strong expansion - continue growth plays
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats Footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg p-4 text-center">
          <p className="text-xs text-cscx-gray-400 uppercase">Starting ARR</p>
          <p className="text-lg font-bold text-white mt-1">{formatCurrency(data.current.components.starting_arr)}</p>
        </div>
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg p-4 text-center">
          <p className="text-xs text-cscx-gray-400 uppercase">Ending ARR</p>
          <p className="text-lg font-bold text-white mt-1">{formatCurrency(data.current.components.ending_arr)}</p>
        </div>
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg p-4 text-center">
          <p className="text-xs text-cscx-gray-400 uppercase">Net Change</p>
          <p className={`text-lg font-bold mt-1 ${
            data.current.components.ending_arr - data.current.components.starting_arr >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {formatCurrency(data.current.components.ending_arr - data.current.components.starting_arr)}
          </p>
        </div>
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg p-4 text-center">
          <p className="text-xs text-cscx-gray-400 uppercase">vs Last Year</p>
          <p className={`text-lg font-bold mt-1 ${getComparisonColor(data.current.comparisons.vs_same_period_last_year).split(' ')[0]}`}>
            {formatPercent(data.current.comparisons.vs_same_period_last_year)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default NRRReport;
