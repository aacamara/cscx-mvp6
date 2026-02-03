/**
 * PRD-163: Renewal Forecast Report
 * Comprehensive renewal forecasting dashboard with pipeline, calendar, and detail views
 */

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// TYPES
// ============================================

type RenewalStage = 'not_started' | 'prep' | 'value_review' | 'proposal_sent' | 'negotiation' | 'verbal_commit' | 'closed';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface RenewalChecklistItem {
  id: string;
  item_key: string;
  item_label: string;
  timing_days: number;
  is_completed: boolean;
  sort_order: number;
}

interface Renewal {
  id: string;
  customer_id: string;
  customer_name: string;
  renewal_date: string;
  days_to_renewal: number;
  current_arr: number;
  proposed_arr?: number;
  stage: RenewalStage;
  probability: number;
  risk_level: RiskLevel;
  health_score?: number;
  engagement_score?: number;
  nps_score?: number;
  readiness_score: number;
  checklist?: RenewalChecklistItem[];
  notes?: string;
}

interface RenewalForecast {
  period: string;
  period_start: string;
  period_end: string;
  pipeline: {
    total_renewals: number;
    total_arr: number;
    weighted_arr: number;
  };
  forecast: {
    commit: number;
    likely: number;
    at_risk: number;
  };
  by_stage: { stage: RenewalStage; count: number; arr: number }[];
  by_risk: { risk_level: RiskLevel; count: number; arr: number }[];
  by_month: { month: string; count: number; arr: number; weighted_arr: number }[];
}

interface RenewalCalendarEntry {
  date: string;
  count: number;
  total_arr: number;
  renewals: { id: string; customer_name: string; arr: number; risk_level: RiskLevel }[];
}

interface RenewalForecastResponse {
  forecast: RenewalForecast;
  renewals: Renewal[];
  calendar: RenewalCalendarEntry[];
  generated_at: string;
}

interface RenewalDetailResponse {
  renewal: Renewal;
  checklist: RenewalChecklistItem[];
  recommendations: string[];
  risk_factors: { factor: string; status: string; value: string | number; description: string }[];
}

// ============================================
// CONSTANTS
// ============================================

const STAGE_LABELS: Record<RenewalStage, string> = {
  not_started: 'Not Started',
  prep: 'Prep',
  value_review: 'Value Review',
  proposal_sent: 'Proposal Sent',
  negotiation: 'Negotiation',
  verbal_commit: 'Verbal Commit',
  closed: 'Closed',
};

const STAGE_COLORS: Record<RenewalStage, string> = {
  not_started: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  prep: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  value_review: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  proposal_sent: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  negotiation: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  verbal_commit: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  closed: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const RISK_DOT_COLORS: Record<RiskLevel, string> = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

// ============================================
// HELPERS
// ============================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ============================================
// COMPONENT PROPS
// ============================================

interface RenewalForecastProps {
  onSelectCustomer?: (customerId: string) => void;
}

// ============================================
// MAIN COMPONENT
// ============================================

export const RenewalForecast: React.FC<RenewalForecastProps> = ({ onSelectCustomer }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RenewalForecastResponse | null>(null);
  const [selectedRenewal, setSelectedRenewal] = useState<string | null>(null);
  const [renewalDetail, setRenewalDetail] = useState<RenewalDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'pipeline' | 'calendar'>('overview');
  const [periodFilter, setPeriodFilter] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('');

  // Fetch forecast data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (periodFilter) params.append('period', periodFilter);
      if (riskFilter) params.append('risk_level', riskFilter);

      const res = await fetch(`${API_BASE}/reports/renewal-forecast?${params}`);
      if (!res.ok) throw new Error('Failed to fetch renewal forecast');
      const responseData = await res.json();
      setData(responseData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [periodFilter, riskFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch renewal detail
  const fetchRenewalDetail = useCallback(async (customerId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reports/renewal-forecast/${customerId}`);
      if (!res.ok) throw new Error('Failed to fetch renewal details');
      const detailData = await res.json();
      setRenewalDetail(detailData);
    } catch (err) {
      console.error('Failed to fetch renewal detail:', err);
      setRenewalDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Handle renewal selection
  const handleRenewalSelect = (renewal: Renewal) => {
    setSelectedRenewal(renewal.id);
    fetchRenewalDetail(renewal.customer_id);
  };

  // Handle checklist update
  const handleChecklistUpdate = async (renewalId: string, itemId: string, isCompleted: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/reports/renewal-forecast/${renewalId}/checklist/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: isCompleted }),
      });
      if (res.ok && renewalDetail) {
        // Refresh detail
        fetchRenewalDetail(renewalDetail.renewal.customer_id);
      }
    } catch (err) {
      console.error('Failed to update checklist:', err);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="p-8 text-center text-cscx-gray-400">
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
        Loading renewal forecast...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-400">
        {error}
        <button onClick={fetchData} className="block mx-auto mt-2 text-sm text-cscx-accent hover:underline">
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { forecast, renewals, calendar } = data;

  // Get high-risk renewals
  const highRiskRenewals = renewals.filter(r => r.risk_level === 'high' || r.risk_level === 'critical');

  return (
    <div className="space-y-6">
      {/* Header with Export */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Renewal Forecast</h2>
          <p className="text-cscx-gray-400 text-sm mt-1">
            {formatDate(forecast.period_start)} - {formatDate(forecast.period_end)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="px-3 py-2 bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-cscx-accent"
          >
            <option value="">Next 90 Days</option>
            <option value="Q1">Q1</option>
            <option value="Q2">Q2</option>
            <option value="Q3">Q3</option>
            <option value="Q4">Q4</option>
            <option value="year">Full Year</option>
          </select>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-3 py-2 bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-cscx-accent"
          >
            <option value="">All Risk Levels</option>
            <option value="low">Low Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="high">High Risk</option>
            <option value="critical">Critical</option>
          </select>
          <button className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg text-sm transition-colors">
            Export
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 p-1 bg-cscx-gray-900 rounded-lg w-fit">
        {(['overview', 'pipeline', 'calendar'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
              activeTab === tab
                ? 'bg-cscx-accent text-white'
                : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Forecast Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-5">
              <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Total Up for Renewal</p>
              <p className="text-3xl font-bold text-white mt-2">{formatCurrency(forecast.pipeline.total_arr)}</p>
              <p className="text-sm text-cscx-gray-500 mt-1">{forecast.pipeline.total_renewals} renewals</p>
            </div>
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-5">
              <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Weighted Forecast</p>
              <p className="text-3xl font-bold text-cscx-accent mt-2">{formatCurrency(forecast.pipeline.weighted_arr)}</p>
              <p className="text-sm text-cscx-gray-500 mt-1">
                {Math.round((forecast.pipeline.weighted_arr / forecast.pipeline.total_arr) * 100)}% probability
              </p>
            </div>
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-5">
              <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">At Risk</p>
              <p className="text-3xl font-bold text-red-400 mt-2">{formatCurrency(forecast.forecast.at_risk)}</p>
              <p className="text-sm text-cscx-gray-500 mt-1">
                {renewals.filter(r => r.probability < 70).length} renewals &lt;70%
              </p>
            </div>
          </div>

          {/* Forecast Breakdown */}
          <div className="grid grid-cols-2 gap-6">
            {/* By Probability */}
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Forecast Breakdown</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-green-400">Commit (&gt;90%)</span>
                    <span className="text-white font-medium">{formatCurrency(forecast.forecast.commit)}</span>
                  </div>
                  <div className="h-3 bg-cscx-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${(forecast.forecast.commit / forecast.pipeline.total_arr) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-yellow-400">Likely (70-90%)</span>
                    <span className="text-white font-medium">{formatCurrency(forecast.forecast.likely)}</span>
                  </div>
                  <div className="h-3 bg-cscx-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 rounded-full"
                      style={{ width: `${(forecast.forecast.likely / forecast.pipeline.total_arr) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-red-400">At Risk (&lt;70%)</span>
                    <span className="text-white font-medium">{formatCurrency(forecast.forecast.at_risk)}</span>
                  </div>
                  <div className="h-3 bg-cscx-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{ width: `${(forecast.forecast.at_risk / forecast.pipeline.total_arr) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* By Risk Level */}
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">By Risk Level</h3>
              <div className="space-y-3">
                {forecast.by_risk.map(({ risk_level, count, arr }) => (
                  <div key={risk_level} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${RISK_DOT_COLORS[risk_level]}`} />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-cscx-gray-300 capitalize">{risk_level} Risk</span>
                        <span className="text-white font-medium">{count} ({formatCurrency(arr)})</span>
                      </div>
                      <div className="h-2 bg-cscx-gray-800 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full ${RISK_DOT_COLORS[risk_level]} rounded-full`}
                          style={{ width: `${(arr / forecast.pipeline.total_arr) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Monthly Breakdown */}
          {forecast.by_month.length > 0 && (
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Monthly Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-cscx-gray-800">
                      <th className="text-left py-2 text-cscx-gray-400 font-medium">Month</th>
                      <th className="text-right py-2 text-cscx-gray-400 font-medium">Renewals</th>
                      <th className="text-right py-2 text-cscx-gray-400 font-medium">ARR</th>
                      <th className="text-right py-2 text-cscx-gray-400 font-medium">Weighted</th>
                      <th className="text-right py-2 text-cscx-gray-400 font-medium">Retention</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.by_month.map(({ month, count, arr, weighted_arr }) => (
                      <tr key={month} className="border-b border-cscx-gray-800/50">
                        <td className="py-3 text-white">{formatMonth(month)}</td>
                        <td className="py-3 text-right text-cscx-gray-300">{count}</td>
                        <td className="py-3 text-right text-white font-medium">{formatCurrency(arr)}</td>
                        <td className="py-3 text-right text-cscx-accent font-medium">{formatCurrency(weighted_arr)}</td>
                        <td className="py-3 text-right">
                          <span className={`${weighted_arr / arr >= 0.85 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {Math.round((weighted_arr / arr) * 100)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* High Risk Renewals */}
          {highRiskRenewals.length > 0 && (
            <div className="bg-cscx-gray-900 border border-red-500/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-red-400">!</span> High Risk Renewals ({highRiskRenewals.length})
              </h3>
              <div className="space-y-3">
                {highRiskRenewals.slice(0, 5).map(renewal => (
                  <div
                    key={renewal.id}
                    onClick={() => handleRenewalSelect(renewal)}
                    className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-white font-medium">{renewal.customer_name}</p>
                        <p className="text-sm text-cscx-gray-400 mt-1">
                          {formatCurrency(renewal.current_arr)} - {renewal.days_to_renewal} days to renewal
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className={`px-2 py-0.5 text-xs rounded-full border ${STAGE_COLORS[renewal.stage]}`}>
                            {STAGE_LABELS[renewal.stage]}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full border ${RISK_COLORS[renewal.risk_level]}`}>
                            {renewal.risk_level.charAt(0).toUpperCase() + renewal.risk_level.slice(1)} Risk
                          </span>
                          <span className="text-xs text-cscx-gray-500">
                            Health: {renewal.health_score || 'N/A'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-red-400">{renewal.probability}%</p>
                        <p className="text-xs text-cscx-gray-500">probability</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Pipeline Tab */}
      {activeTab === 'pipeline' && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cscx-gray-800/50 border-b border-cscx-gray-800">
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Customer</th>
                  <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">ARR</th>
                  <th className="text-center px-4 py-3 text-cscx-gray-400 font-medium">Days</th>
                  <th className="text-center px-4 py-3 text-cscx-gray-400 font-medium">Stage</th>
                  <th className="text-center px-4 py-3 text-cscx-gray-400 font-medium">Risk</th>
                  <th className="text-center px-4 py-3 text-cscx-gray-400 font-medium">Probability</th>
                  <th className="text-center px-4 py-3 text-cscx-gray-400 font-medium">Readiness</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cscx-gray-800">
                {renewals.map(renewal => (
                  <tr
                    key={renewal.id}
                    onClick={() => handleRenewalSelect(renewal)}
                    className="hover:bg-cscx-gray-800/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${RISK_DOT_COLORS[renewal.risk_level]}`} />
                        <span className="text-white font-medium">{renewal.customer_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-white font-medium">
                      {formatCurrency(renewal.current_arr)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`${renewal.days_to_renewal <= 30 ? 'text-red-400 font-medium' : 'text-cscx-gray-300'}`}>
                        {renewal.days_to_renewal}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full border ${STAGE_COLORS[renewal.stage]}`}>
                        {STAGE_LABELS[renewal.stage]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full border ${RISK_COLORS[renewal.risk_level]}`}>
                        {renewal.risk_level.charAt(0).toUpperCase() + renewal.risk_level.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-medium ${
                        renewal.probability >= 80 ? 'text-green-400' :
                        renewal.probability >= 60 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {renewal.probability}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              renewal.readiness_score >= 70 ? 'bg-green-500' :
                              renewal.readiness_score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${renewal.readiness_score}%` }}
                          />
                        </div>
                        <span className="text-xs text-cscx-gray-400 w-8">{renewal.readiness_score}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Calendar Tab */}
      {activeTab === 'calendar' && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Renewal Calendar</h3>
          <div className="space-y-3">
            {calendar.map(entry => (
              <div key={entry.date} className="p-4 bg-cscx-gray-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white font-medium">{formatDate(entry.date)}</p>
                  <p className="text-cscx-gray-400 text-sm">
                    {entry.count} renewal{entry.count !== 1 ? 's' : ''} - {formatCurrency(entry.total_arr)}
                  </p>
                </div>
                <div className="space-y-2">
                  {entry.renewals.map(r => (
                    <div
                      key={r.id}
                      onClick={() => {
                        const renewal = renewals.find(ren => ren.id === r.id);
                        if (renewal) handleRenewalSelect(renewal);
                      }}
                      className="flex items-center justify-between p-2 bg-cscx-gray-900/50 rounded hover:bg-cscx-gray-900 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${RISK_DOT_COLORS[r.risk_level]}`} />
                        <span className="text-cscx-gray-300">{r.customer_name}</span>
                      </div>
                      <span className="text-white font-medium">{formatCurrency(r.arr)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {calendar.length === 0 && (
              <p className="text-center text-cscx-gray-500 py-8">No renewals in selected period</p>
            )}
          </div>
        </div>
      )}

      {/* Renewal Detail Modal */}
      {selectedRenewal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {detailLoading ? (
              <div className="p-8 text-center text-cscx-gray-400">
                <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
                Loading details...
              </div>
            ) : renewalDetail ? (
              <>
                {/* Modal Header */}
                <div className="sticky top-0 bg-cscx-gray-900 border-b border-cscx-gray-800 p-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">
                    {renewalDetail.renewal.customer_name}
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedRenewal(null);
                      setRenewalDetail(null);
                    }}
                    className="p-2 hover:bg-cscx-gray-800 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-cscx-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 space-y-6">
                  {/* Overview */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-cscx-gray-800/50 rounded-lg">
                      <p className="text-xs text-cscx-gray-400 uppercase">Renewal Date</p>
                      <p className="text-xl font-bold text-white mt-1">
                        {formatDate(renewalDetail.renewal.renewal_date)}
                      </p>
                      <p className="text-sm text-cscx-gray-500">
                        {renewalDetail.renewal.days_to_renewal} days
                      </p>
                    </div>
                    <div className="p-4 bg-cscx-gray-800/50 rounded-lg">
                      <p className="text-xs text-cscx-gray-400 uppercase">Current ARR</p>
                      <p className="text-xl font-bold text-cscx-accent mt-1">
                        {formatCurrency(renewalDetail.renewal.current_arr)}
                      </p>
                      {renewalDetail.renewal.proposed_arr && (
                        <p className="text-sm text-green-400">
                          Proposed: {formatCurrency(renewalDetail.renewal.proposed_arr)}
                        </p>
                      )}
                    </div>
                    <div className="p-4 bg-cscx-gray-800/50 rounded-lg">
                      <p className="text-xs text-cscx-gray-400 uppercase">Probability</p>
                      <p className={`text-xl font-bold mt-1 ${
                        renewalDetail.renewal.probability >= 80 ? 'text-green-400' :
                        renewalDetail.renewal.probability >= 60 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {renewalDetail.renewal.probability}%
                      </p>
                    </div>
                    <div className="p-4 bg-cscx-gray-800/50 rounded-lg">
                      <p className="text-xs text-cscx-gray-400 uppercase">Risk Level</p>
                      <p className={`text-xl font-bold mt-1 capitalize ${
                        renewalDetail.renewal.risk_level === 'low' ? 'text-green-400' :
                        renewalDetail.renewal.risk_level === 'medium' ? 'text-yellow-400' :
                        renewalDetail.renewal.risk_level === 'high' ? 'text-orange-400' : 'text-red-400'
                      }`}>
                        {renewalDetail.renewal.risk_level}
                      </p>
                    </div>
                  </div>

                  {/* Risk Factors */}
                  <div>
                    <h4 className="text-sm font-medium text-cscx-gray-300 mb-3">Risk Factors</h4>
                    <div className="space-y-2">
                      {renewalDetail.risk_factors.map((factor, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-cscx-gray-800/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className={`w-3 h-3 rounded-full ${
                              factor.status === 'good' ? 'bg-green-500' :
                              factor.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                            }`} />
                            <span className="text-cscx-gray-300">{factor.factor}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-white font-medium">{factor.value}</span>
                            <p className="text-xs text-cscx-gray-500">{factor.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Readiness Checklist */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-cscx-gray-300">Readiness Checklist</h4>
                      <span className="text-sm text-cscx-accent">
                        {renewalDetail.renewal.readiness_score}% complete
                      </span>
                    </div>
                    <div className="space-y-2">
                      {renewalDetail.checklist.map(item => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 bg-cscx-gray-800/30 rounded-lg"
                        >
                          <button
                            onClick={() => handleChecklistUpdate(
                              renewalDetail.renewal.id,
                              item.id,
                              !item.is_completed
                            )}
                            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                              item.is_completed
                                ? 'bg-green-500 border-green-500'
                                : 'border-cscx-gray-600 hover:border-cscx-accent'
                            }`}
                          >
                            {item.is_completed && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          <div className="flex-1">
                            <span className={item.is_completed ? 'text-cscx-gray-500 line-through' : 'text-white'}>
                              {item.item_label}
                            </span>
                            <span className="text-xs text-cscx-gray-500 ml-2">
                              ({item.timing_days} days out)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendations */}
                  {renewalDetail.recommendations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-cscx-gray-300 mb-3">Recommended Actions</h4>
                      <div className="space-y-2">
                        {renewalDetail.recommendations.map((rec, idx) => (
                          <div key={idx} className="flex items-start gap-2 p-3 bg-cscx-accent/10 border border-cscx-accent/20 rounded-lg">
                            <span className="text-cscx-accent">-</span>
                            <span className="text-cscx-gray-300">{rec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t border-cscx-gray-800">
                    {onSelectCustomer && (
                      <button
                        onClick={() => {
                          onSelectCustomer(renewalDetail.renewal.customer_id);
                          setSelectedRenewal(null);
                          setRenewalDetail(null);
                        }}
                        className="flex-1 px-4 py-2 bg-cscx-accent hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                      >
                        View Customer 360
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedRenewal(null);
                        setRenewalDetail(null);
                      }}
                      className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-cscx-gray-400">
                Failed to load renewal details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RenewalForecast;
