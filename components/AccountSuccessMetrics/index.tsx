/**
 * Account Success Metrics Dashboard
 * PRD-069: Comprehensive success metrics visualization for customer accounts
 *
 * Features:
 * - Success Score overview with gauge
 * - Goal progress tracking
 * - Value/ROI summary
 * - Metric trends
 * - Benchmark comparisons
 * - Action recommendations
 */

import React, { useState } from 'react';
import { useSuccessMetrics } from '../../hooks/useSuccessMetrics';
import {
  SuccessGoal,
  SuccessMetric,
  SUCCESS_SCORE_THRESHOLDS,
  CATEGORY_LABELS
} from '../../types/successMetrics';
import { GoalDetailModal } from './GoalDetailModal';
import { SuccessScoreGauge } from './SuccessScoreGauge';
import { ValueSummaryCard } from './ValueSummaryCard';
import { MetricTrendChart } from './MetricTrendChart';

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

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const getStatusIcon = (status: string): string => {
  switch (status) {
    case 'achieved':
    case 'exceeding':
      return '\u2713'; // checkmark
    case 'in_progress':
    case 'on_track':
      return '\u25CF'; // filled circle
    case 'at_risk':
    case 'not_met':
      return '\u26A0'; // warning
    default:
      return '\u25CB'; // empty circle
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'achieved':
    case 'exceeding':
      return 'text-green-400';
    case 'in_progress':
    case 'on_track':
      return 'text-blue-400';
    case 'at_risk':
    case 'not_met':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
};

const getStatusBgColor = (status: string): string => {
  switch (status) {
    case 'achieved':
    case 'exceeding':
      return 'bg-green-500';
    case 'in_progress':
    case 'on_track':
      return 'bg-blue-500';
    case 'at_risk':
    case 'not_met':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

const getProgressColor = (progress: number): string => {
  if (progress >= 100) return 'bg-green-500';
  if (progress >= 75) return 'bg-blue-500';
  if (progress >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
};

// ============================================
// MAIN COMPONENT
// ============================================

interface AccountSuccessMetricsProps {
  customerId: string;
  onViewCustomer?: (customerId: string) => void;
}

export const AccountSuccessMetrics: React.FC<AccountSuccessMetricsProps> = ({
  customerId,
  onViewCustomer
}) => {
  const {
    data,
    loading,
    error,
    refetch,
    fetchGoalDetail,
    goalDetail,
    goalDetailLoading,
    clearGoalDetail,
    selectedGoalId,
    downloadValueReport,
    valueReportLoading
  } = useSuccessMetrics({ customerId });

  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  // Loading state
  if (loading && !data) {
    return (
      <div className="p-8 text-center text-cscx-gray-400">
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
        Loading success metrics...
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400 mb-2">{error}</p>
        <button
          onClick={refetch}
          className="text-sm text-cscx-accent hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // No goals defined
  if (data && (!data.goals || data.goals.length === 0)) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cscx-gray-800 flex items-center justify-center">
          <svg className="w-8 h-8 text-cscx-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No Success Goals Defined</h3>
        <p className="text-cscx-gray-400 mb-4">
          Define success goals to track customer value and demonstrate ROI.
        </p>
        <button className="px-4 py-2 bg-cscx-accent hover:bg-red-700 text-white rounded-lg transition-colors">
          Define Goals
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { overview, goals, valueSummary, benchmarks, milestones, quotes } = data;

  // Separate goals by status for organization
  const atRiskGoals = goals.filter(g => g.status === 'at_risk');
  const inProgressGoals = goals.filter(g => g.status === 'in_progress');
  const achievedGoals = goals.filter(g => g.status === 'achieved');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Account Success Metrics</h2>
          <p className="text-cscx-gray-400 text-sm mt-1">
            {data.customerName} | Since {formatDate(data.contractStart)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refetch}
            className="px-4 py-2 text-sm bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button
            onClick={downloadValueReport}
            disabled={valueReportLoading}
            className="px-4 py-2 text-sm bg-cscx-accent hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {valueReportLoading ? (
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            Export Value Report
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Success Score Gauge */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-medium text-cscx-gray-400 uppercase tracking-wider mb-4">
            Overall Success Score
          </h3>
          <SuccessScoreGauge score={overview.score} label={overview.label} />
          <div className="mt-4 grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-white">
                {overview.goalsOnTrack}
                <span className="text-cscx-gray-500 text-sm font-normal"> / {overview.totalGoals}</span>
              </p>
              <p className="text-xs text-cscx-gray-400">Goals on track</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{overview.goalsAtRisk}</p>
              <p className="text-xs text-cscx-gray-400">Needs attention</p>
            </div>
          </div>
        </div>

        {/* Value Summary */}
        <ValueSummaryCard valueSummary={valueSummary} />

        {/* Benchmarks */}
        {benchmarks && benchmarks.length > 0 && (
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <h3 className="text-sm font-medium text-cscx-gray-400 uppercase tracking-wider mb-4">
              Benchmark Comparison
            </h3>
            <div className="space-y-4">
              {benchmarks.map((b, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-cscx-gray-300">{b.metric}</span>
                    <span className="text-white font-medium">{b.percentile}th percentile</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cscx-accent rounded-full transition-all"
                        style={{ width: `${b.percentile}%` }}
                      />
                    </div>
                    <span className="text-xs text-cscx-gray-500 w-16 text-right">
                      vs {b.peerAverage}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* At Risk Goals Alert */}
      {atRiskGoals.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-red-400 text-xl">{getStatusIcon('at_risk')}</span>
            <h3 className="text-lg font-semibold text-white">
              {atRiskGoals.length} Goal{atRiskGoals.length > 1 ? 's' : ''} At Risk
            </h3>
          </div>
          <div className="space-y-2">
            {atRiskGoals.map(goal => (
              <div
                key={goal.id}
                onClick={() => fetchGoalDetail(goal.id)}
                className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg cursor-pointer hover:bg-red-500/20 transition-colors"
              >
                <div>
                  <p className="text-white font-medium">{goal.title}</p>
                  <p className="text-sm text-cscx-gray-400">Owner: {goal.owner}</p>
                </div>
                <div className="text-right">
                  <p className="text-red-400 font-medium">{goal.progressPercent}%</p>
                  <p className="text-xs text-cscx-gray-500">progress</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goals Overview Table */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-cscx-gray-800">
          <h3 className="text-lg font-semibold text-white">Success Goals Overview</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cscx-gray-800/50">
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Goal</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Progress</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Owner</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Target Date</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cscx-gray-800">
              {goals.map((goal) => (
                <React.Fragment key={goal.id}>
                  <tr
                    onClick={() => setExpandedGoalId(expandedGoalId === goal.id ? null : goal.id)}
                    className="hover:bg-cscx-gray-800/30 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`text-lg ${getStatusColor(goal.status)}`}>
                          {getStatusIcon(goal.status)}
                        </span>
                        <span className="text-white font-medium">{goal.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${
                        goal.status === 'achieved' ? 'bg-green-500/20 text-green-400' :
                        goal.status === 'at_risk' ? 'bg-red-500/20 text-red-400' :
                        goal.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {goal.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${getProgressColor(goal.progressPercent)}`}
                            style={{ width: `${Math.min(100, goal.progressPercent)}%` }}
                          />
                        </div>
                        <span className="text-white font-medium w-12 text-right">
                          {goal.progressPercent}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-cscx-gray-300">
                      {goal.owner}
                      {goal.ownerTitle && (
                        <span className="text-cscx-gray-500 text-xs block">{goal.ownerTitle}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-cscx-gray-300">
                      {formatDate(goal.targetDate)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          fetchGoalDetail(goal.id);
                        }}
                        className="text-cscx-accent hover:text-red-300 transition-colors"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Metrics Row */}
                  {expandedGoalId === goal.id && (
                    <tr>
                      <td colSpan={6} className="bg-cscx-gray-800/30">
                        <div className="p-4">
                          <h4 className="text-sm font-medium text-cscx-gray-400 mb-3">
                            Metrics ({goal.metrics.length})
                          </h4>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-cscx-gray-500">
                                <th className="text-left py-2">Metric</th>
                                <th className="text-right py-2">Baseline</th>
                                <th className="text-right py-2">Target</th>
                                <th className="text-right py-2">Current</th>
                                <th className="text-right py-2">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {goal.metrics.map((metric) => (
                                <tr key={metric.id} className="border-t border-cscx-gray-700">
                                  <td className="py-2 text-white">{metric.name}</td>
                                  <td className="py-2 text-right text-cscx-gray-400">
                                    {metric.baseline} {metric.unit}
                                  </td>
                                  <td className="py-2 text-right text-cscx-gray-400">
                                    {metric.target} {metric.unit}
                                  </td>
                                  <td className="py-2 text-right text-white font-medium">
                                    {metric.current} {metric.unit}
                                  </td>
                                  <td className="py-2 text-right">
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                      metric.status === 'exceeding' ? 'bg-green-500/20 text-green-400' :
                                      metric.status === 'on_track' ? 'bg-blue-500/20 text-blue-400' :
                                      metric.status === 'at_risk' ? 'bg-yellow-500/20 text-yellow-400' :
                                      'bg-red-500/20 text-red-400'
                                    }`}>
                                      {metric.progressPercent}%
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trend Chart & Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Success Score Trend</h3>
          <MetricTrendChart
            data={data.trends.successScore}
            valueKey="progressPercent"
            color="#e63946"
          />
        </div>

        {/* Milestones */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Upcoming Milestones</h3>
          <div className="space-y-3">
            {milestones.map((milestone) => (
              <div
                key={milestone.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  milestone.status === 'at_risk' || milestone.status === 'overdue'
                    ? 'bg-red-500/10 border border-red-500/30'
                    : milestone.status === 'completed'
                    ? 'bg-green-500/10 border border-green-500/30'
                    : 'bg-cscx-gray-800 border border-cscx-gray-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`${
                    milestone.status === 'at_risk' || milestone.status === 'overdue' ? 'text-red-400' :
                    milestone.status === 'completed' ? 'text-green-400' :
                    milestone.status === 'on_track' ? 'text-blue-400' :
                    'text-gray-400'
                  }`}>
                    {milestone.status === 'completed' ? '\u2713' : '\u25CB'}
                  </span>
                  <span className="text-white">{milestone.title}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-cscx-gray-300">{formatDate(milestone.targetDate)}</p>
                  <p className={`text-xs capitalize ${
                    milestone.status === 'at_risk' || milestone.status === 'overdue' ? 'text-red-400' :
                    milestone.status === 'completed' ? 'text-green-400' :
                    milestone.status === 'on_track' ? 'text-blue-400' :
                    'text-gray-400'
                  }`}>
                    {milestone.status.replace('_', ' ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Customer Quotes */}
      {quotes && quotes.length > 0 && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Customer Feedback</h3>
          <div className="space-y-4">
            {quotes.map((quote, idx) => (
              <blockquote
                key={idx}
                className="border-l-4 border-cscx-accent pl-4 italic"
              >
                <p className="text-cscx-gray-300">"{quote.text}"</p>
                <footer className="mt-2 text-sm text-cscx-gray-500">
                  - {quote.author}, {quote.source} ({formatDate(quote.date)})
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <button className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New Goal
        </button>
        <button className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Update Metrics
        </button>
        <button className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share with Customer
        </button>
      </div>

      {/* Goal Detail Modal */}
      {selectedGoalId && (
        <GoalDetailModal
          goalId={selectedGoalId}
          data={goalDetail}
          loading={goalDetailLoading}
          onClose={clearGoalDetail}
        />
      )}
    </div>
  );
};

export default AccountSuccessMetrics;
