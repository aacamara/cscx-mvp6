/**
 * Risk Deep Dive Component (PRD-083)
 *
 * Comprehensive risk factor analysis view for customer accounts.
 * Features:
 * - Risk score overview with severity indicator
 * - Contributing factors with weights and trends
 * - Historical trend visualization
 * - Mitigation action recommendations
 * - Benchmark comparisons
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  RiskDeepDive,
  RiskFactor,
  MitigationAction,
  RiskTrendAnalysis,
  MitigationPlan,
  RiskCategory,
  RiskSeverity,
} from '../../types/riskDeepDive';
import { RiskTrendChart } from './RiskTrendChart';
import { MitigationPlanModal } from './MitigationPlanModal';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const getSeverityColor = (severity: RiskSeverity): string => {
  switch (severity) {
    case 'critical':
      return 'text-red-500';
    case 'high':
      return 'text-orange-400';
    case 'medium':
      return 'text-yellow-400';
    case 'low':
      return 'text-green-400';
  }
};

const getSeverityBg = (severity: RiskSeverity): string => {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/20 border-red-500/30';
    case 'high':
      return 'bg-orange-500/20 border-orange-500/30';
    case 'medium':
      return 'bg-yellow-500/20 border-yellow-500/30';
    case 'low':
      return 'bg-green-500/20 border-green-500/30';
  }
};

const getCategoryIcon = (category: RiskCategory): string => {
  switch (category) {
    case 'usage':
      return '\u{1F4CA}'; // chart icon
    case 'engagement':
      return '\u{1F4AC}'; // speech bubble
    case 'financial':
      return '\u{1F4B0}'; // money bag
    case 'relationship':
      return '\u{1F465}'; // people
    case 'support':
      return '\u{1F6E0}'; // tools
  }
};

const getPriorityColor = (priority: MitigationAction['priority']): string => {
  switch (priority) {
    case 'urgent':
      return 'bg-red-500';
    case 'high':
      return 'bg-orange-500';
    case 'medium':
      return 'bg-yellow-500';
    case 'low':
      return 'bg-green-500';
  }
};

const getTrendIcon = (trend: string): string => {
  switch (trend) {
    case 'accelerating':
      return '\u2191\u2191';
    case 'improving':
      return '\u2193';
    case 'decelerating':
      return '\u2193';
    case 'stable':
      return '\u2192';
    default:
      return '\u2192';
  }
};

const getTrendColor = (trend: string): string => {
  switch (trend) {
    case 'accelerating':
      return 'text-red-400';
    case 'improving':
      return 'text-green-400';
    case 'decelerating':
      return 'text-yellow-400';
    default:
      return 'text-gray-400';
  }
};

// ============================================
// MAIN COMPONENT
// ============================================

interface RiskDeepDiveProps {
  customerId: string;
  customerName?: string;
  onClose?: () => void;
  onScheduleAction?: (action: MitigationAction) => void;
  onGenerateSavePlay?: () => void;
}

export const RiskDeepDiveComponent: React.FC<RiskDeepDiveProps> = ({
  customerId,
  customerName,
  onClose,
  onScheduleAction,
  onGenerateSavePlay,
}) => {
  // State
  const [data, setData] = useState<RiskDeepDive | null>(null);
  const [trends, setTrends] = useState<RiskTrendAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<RiskCategory | 'all'>('all');
  const [showMitigationModal, setShowMitigationModal] = useState(false);
  const [mitigationPlan, setMitigationPlan] = useState<MitigationPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  // Fetch deep dive data
  const fetchDeepDive = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/customers/${customerId}/risk/deep-dive`);
      if (!response.ok) throw new Error('Failed to fetch risk analysis');

      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        throw new Error(result.error?.message || 'Failed to fetch risk analysis');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  // Fetch trend data
  const fetchTrends = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/customers/${customerId}/risk/trends?period=90`);
      if (!response.ok) return;

      const result = await response.json();
      if (result.success) {
        setTrends(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch trends:', err);
    }
  }, [customerId]);

  // Generate mitigation plan
  const generateMitigation = async () => {
    setPlanLoading(true);
    try {
      const response = await fetch(`${API_BASE}/customers/${customerId}/risk/mitigation`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to generate mitigation plan');

      const result = await response.json();
      if (result.success) {
        setMitigationPlan(result.data);
        setShowMitigationModal(true);
      }
    } catch (err) {
      console.error('Failed to generate mitigation plan:', err);
    } finally {
      setPlanLoading(false);
    }
  };

  useEffect(() => {
    fetchDeepDive();
    fetchTrends();
  }, [fetchDeepDive, fetchTrends]);

  // Filter factors by category
  const filteredFactors =
    selectedCategory === 'all'
      ? data?.factors || []
      : data?.factorsByCategory[selectedCategory] || [];

  // Loading state
  if (loading && !data) {
    return (
      <div className="p-8 text-center text-cscx-gray-400">
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
        Analyzing risk factors...
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="p-8 text-center text-red-400">
        {error}
        <button
          onClick={fetchDeepDive}
          className="block mx-auto mt-2 text-sm text-cscx-accent hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Risk Deep Dive</h2>
          <p className="text-cscx-gray-400 text-sm mt-1">
            {data.customerName} | ARR: {formatCurrency(data.arr)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={generateMitigation}
            disabled={planLoading}
            className="px-4 py-2 text-sm bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {planLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            )}
            Generate Save Play
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-cscx-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Risk Score Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main Score Card */}
        <div
          className={`col-span-1 lg:col-span-2 bg-cscx-gray-900 border rounded-xl p-6 ${getSeverityBg(data.riskLevel)}`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-cscx-gray-400 uppercase tracking-wider">Risk Score</span>
            <span
              className={`px-3 py-1 text-xs font-semibold uppercase rounded-full ${getSeverityBg(data.riskLevel)} ${getSeverityColor(data.riskLevel)}`}
            >
              {data.riskLevel}
            </span>
          </div>
          <div className="flex items-end gap-4">
            <span className={`text-5xl font-bold ${getSeverityColor(data.riskLevel)}`}>
              {data.riskScore}
            </span>
            <span className="text-2xl text-cscx-gray-500 mb-1">/100</span>
            <span className={`text-lg mb-1 ${getTrendColor(data.riskTrend)}`}>
              {getTrendIcon(data.riskTrend)}
            </span>
          </div>
          <p className="text-sm text-cscx-gray-400 mt-3">{data.riskTrendDescription}</p>
          {data.confidence !== 'high' && (
            <p className="text-xs text-yellow-500 mt-2">
              Data completeness: {data.dataCompleteness}% (confidence: {data.confidence})
            </p>
          )}
        </div>

        {/* Quick Stats */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase mb-2">Days to Renewal</p>
          <p
            className={`text-2xl font-bold ${
              data.daysToRenewal && data.daysToRenewal <= 30
                ? 'text-red-400'
                : data.daysToRenewal && data.daysToRenewal <= 60
                  ? 'text-yellow-400'
                  : 'text-white'
            }`}
          >
            {data.daysToRenewal ?? 'N/A'}
          </p>
          <p className="text-xs text-cscx-gray-500 mt-1">
            Health Score: {data.healthScore}
          </p>
        </div>

        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase mb-2">Last Contact</p>
          <p
            className={`text-2xl font-bold ${
              data.lastContactDays > 30 ? 'text-red-400' : 'text-white'
            }`}
          >
            {data.lastContactDays} days
          </p>
          <p className="text-xs text-cscx-gray-500 mt-1">
            Last meeting: {data.lastMeetingDays} days ago
          </p>
        </div>
      </div>

      {/* Primary Concerns */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Primary Concerns</h3>
        <div className="space-y-3">
          {data.primaryConcerns.map((factor, idx) => (
            <div
              key={factor.id}
              className={`flex items-center justify-between p-4 rounded-lg border ${getSeverityBg(factor.severity)}`}
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl">{getCategoryIcon(factor.category)}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{idx + 1}. {factor.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${getSeverityBg(factor.severity)} ${getSeverityColor(factor.severity)}`}
                    >
                      Impact: {factor.weight}%
                    </span>
                  </div>
                  <p className="text-sm text-cscx-gray-400 mt-1">{factor.description}</p>
                  {factor.trendDetail && (
                    <p className="text-xs text-cscx-gray-500 mt-1">
                      Trend: {factor.trendDetail} {getTrendIcon(factor.trend)}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className={`text-sm font-medium ${getTrendColor(factor.trend)}`}>
                  {factor.trend}
                </span>
                {factor.isEmerging && (
                  <span className="block text-xs text-yellow-500">Emerging</span>
                )}
                {factor.isChronic && (
                  <span className="block text-xs text-orange-500">Chronic</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trend Chart & Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Trend */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Risk Trend (90 days)</h3>
          {trends ? (
            <RiskTrendChart history={trends.history} />
          ) : (
            <div className="h-48 flex items-center justify-center text-cscx-gray-500">
              Loading trend data...
            </div>
          )}
          {trends?.projection && (
            <p className="text-xs text-cscx-gray-500 mt-2">
              30-day projection: {Math.round(trends.projection.expectedScore30Days)} (
              {Math.round(trends.projection.confidence * 100)}% confidence)
            </p>
          )}
        </div>

        {/* Recommended Actions */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Recommended Actions</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {data.mitigationActions.map((action, idx) => (
              <div
                key={action.id}
                className="flex items-start gap-3 p-3 bg-cscx-gray-800/50 rounded-lg hover:bg-cscx-gray-800 transition-colors cursor-pointer"
                onClick={() => onScheduleAction?.(action)}
              >
                <span
                  className={`w-2 h-2 rounded-full mt-2 ${getPriorityColor(action.priority)}`}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{action.action}</p>
                  <p className="text-xs text-cscx-gray-400 mt-1">{action.timelineRecommendation}</p>
                </div>
                <span className="text-xs text-cscx-gray-500 capitalize">{action.priority}</span>
              </div>
            ))}
          </div>
          <button
            onClick={generateMitigation}
            className="w-full mt-4 py-2 text-sm text-cscx-accent border border-cscx-accent/30 rounded-lg hover:bg-cscx-accent/10 transition-colors"
          >
            View Full Mitigation Plan
          </button>
        </div>
      </div>

      {/* All Risk Factors */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-cscx-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">All Contributing Factors</h3>
            <div className="flex gap-1 bg-cscx-gray-800 rounded-lg p-1">
              {(['all', 'usage', 'engagement', 'relationship', 'support', 'financial'] as const).map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                      selectedCategory === cat
                        ? 'bg-cscx-accent text-white'
                        : 'text-cscx-gray-400 hover:text-white'
                    }`}
                  >
                    {cat === 'all' ? 'All' : getCategoryIcon(cat as RiskCategory)}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cscx-gray-800/50">
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Factor</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Category</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Severity</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Weight</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Trend</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cscx-gray-800">
              {filteredFactors.map((factor) => (
                <tr key={factor.id} className="hover:bg-cscx-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-white font-medium">{factor.name}</p>
                      <p className="text-xs text-cscx-gray-500">{factor.description}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="capitalize text-cscx-gray-300">{factor.category}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded capitalize ${getSeverityBg(factor.severity)} ${getSeverityColor(factor.severity)}`}
                    >
                      {factor.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white">{factor.weight}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`${getTrendColor(factor.trend)}`}>
                      {getTrendIcon(factor.trend)} {factor.trend}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-cscx-gray-400 text-xs">{factor.recommendation}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredFactors.length === 0 && (
          <div className="p-8 text-center text-cscx-gray-500">
            No risk factors in this category
          </div>
        )}
      </div>

      {/* Data Gaps Warning */}
      {data.dataGaps.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <h4 className="text-sm font-medium text-yellow-400 mb-2">Data Gaps Detected</h4>
          <ul className="text-xs text-cscx-gray-400 space-y-1">
            {data.dataGaps.map((gap, idx) => (
              <li key={idx}>- {gap}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Mitigation Plan Modal */}
      {showMitigationModal && mitigationPlan && (
        <MitigationPlanModal
          plan={mitigationPlan}
          onClose={() => setShowMitigationModal(false)}
          onScheduleAction={onScheduleAction}
        />
      )}
    </div>
  );
};

export default RiskDeepDiveComponent;
