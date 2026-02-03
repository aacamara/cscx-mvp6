/**
 * Activity Feed Analysis Component
 * PRD-172: Activity tracking and analysis report
 *
 * Features:
 * - Activity Summary metrics
 * - Activity by Type breakdown
 * - Customers without recent activity (gaps)
 * - CSM Productivity metrics
 * - Activity trend chart
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityFeedResponse,
  ActivityType,
  ActivityGap,
  CSMProductivity,
  ActivityTrendPoint,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_COLORS,
} from '../../types/activityFeed';
import { ActivityTrendChart } from './ActivityTrendChart';

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

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDaysAgo = (days: number): string => {
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
};

const getHealthColor = (color: 'green' | 'yellow' | 'red'): string => {
  switch (color) {
    case 'green': return 'text-green-400';
    case 'yellow': return 'text-yellow-400';
    case 'red': return 'text-red-400';
    default: return 'text-gray-400';
  }
};

const getHealthBg = (color: 'green' | 'yellow' | 'red'): string => {
  switch (color) {
    case 'green': return 'bg-green-500';
    case 'yellow': return 'bg-yellow-500';
    case 'red': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
};

const getRiskBadge = (level: 'low' | 'medium' | 'high'): { bg: string; text: string } => {
  switch (level) {
    case 'high': return { bg: 'bg-red-500/20', text: 'text-red-400' };
    case 'medium': return { bg: 'bg-yellow-500/20', text: 'text-yellow-400' };
    case 'low': return { bg: 'bg-green-500/20', text: 'text-green-400' };
    default: return { bg: 'bg-gray-500/20', text: 'text-gray-400' };
  }
};

const getActivityIcon = (type: ActivityType): string => {
  switch (type) {
    case 'email': return '\u2709';
    case 'meeting': return '\uD83D\uDCC5';
    case 'call': return '\uD83D\uDCDE';
    case 'note': return '\uD83D\uDCDD';
    case 'task': return '\u2611';
    case 'document': return '\uD83D\uDCC4';
    default: return '\u2022';
  }
};

// ============================================
// PERIOD OPTIONS
// ============================================

type PeriodOption = 'today' | 'this_week' | 'this_month' | 'this_quarter';

const PERIOD_OPTIONS: { value: PeriodOption; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_quarter', label: 'This Quarter' },
];

// ============================================
// MAIN COMPONENT
// ============================================

interface ActivityFeedAnalysisProps {
  onSelectCustomer?: (customerId: string) => void;
}

export const ActivityFeedAnalysis: React.FC<ActivityFeedAnalysisProps> = ({
  onSelectCustomer,
}) => {
  // State
  const [data, setData] = useState<ActivityFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodOption>('this_week');
  const [gapThreshold, setGapThreshold] = useState(7);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        period,
        gap_threshold_days: gapThreshold.toString(),
      });

      const response = await fetch(`${API_BASE}/reports/activity-feed?${params}`);
      if (!response.ok) throw new Error('Failed to fetch activity feed');

      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        throw new Error(result.error || 'Failed to load data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [period, gapThreshold]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Loading state
  if (loading && !data) {
    return (
      <div className="p-8 text-center text-cscx-gray-400">
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
        Loading activity feed...
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="p-8 text-center text-red-400">
        {error}
        <button
          onClick={fetchData}
          className="block mx-auto mt-2 text-sm text-cscx-accent hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { summary, metrics, by_type, gaps, recent_activities, trends, csm_productivity } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Activity Feed Analysis</h2>
          <p className="text-cscx-gray-400 text-sm mt-1">
            Track and analyze customer engagement activities
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodOption)}
            className="px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cscx-accent"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Refresh button */}
          <button
            onClick={fetchData}
            className="px-4 py-2 text-sm bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Total Activities</p>
          <p className="text-3xl font-bold text-white mt-1">{summary.total_activities}</p>
          <p className="text-sm text-cscx-gray-500 mt-1">{PERIOD_OPTIONS.find(p => p.value === period)?.label}</p>
        </div>
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Avg per Customer</p>
          <p className="text-3xl font-bold text-cscx-accent mt-1">{summary.avg_per_customer}</p>
          <p className="text-sm text-cscx-gray-500 mt-1">activities</p>
        </div>
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Coverage Rate</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{summary.coverage_rate}%</p>
          <p className="text-sm text-cscx-gray-500 mt-1">customers touched</p>
        </div>
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Activity Gaps</p>
          <p className="text-3xl font-bold text-yellow-400 mt-1">{summary.customers_with_gaps}</p>
          <p className="text-sm text-cscx-gray-500 mt-1">need attention</p>
        </div>
      </div>

      {/* Activity by Type and Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Activity Type */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4">By Activity Type</h3>
          <div className="space-y-3">
            {by_type.map(({ type, count, percentage }) => (
              <div key={type} className="flex items-center gap-3">
                <span className="text-lg w-6">{getActivityIcon(type)}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-sm">{ACTIVITY_TYPE_LABELS[type]}</span>
                    <span className="text-cscx-gray-400 text-sm">{count}</span>
                  </div>
                  <div className="h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: ACTIVITY_TYPE_COLORS[type],
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Trend Chart */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Activity Trend (30 days)</h3>
          <ActivityTrendChart trends={trends} />
        </div>
      </div>

      {/* Customers Without Recent Activity */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-cscx-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Customers Without Recent Activity</h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-cscx-gray-400">Gap threshold:</label>
            <select
              value={gapThreshold}
              onChange={(e) => setGapThreshold(parseInt(e.target.value, 10))}
              className="px-2 py-1 bg-cscx-gray-800 border border-cscx-gray-700 rounded text-white text-sm focus:outline-none focus:border-cscx-accent"
            >
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="21">21 days</option>
              <option value="30">30 days</option>
            </select>
          </div>
        </div>

        {gaps.length > 0 ? (
          <div className="divide-y divide-cscx-gray-800">
            {gaps.map((gap) => {
              const riskStyle = getRiskBadge(gap.risk_level);
              return (
                <div
                  key={gap.customer_id}
                  onClick={() => onSelectCustomer?.(gap.customer_id)}
                  className="flex items-center justify-between p-4 hover:bg-cscx-gray-800/30 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${getHealthBg(gap.health_color)}`} />
                    <div>
                      <p className="text-white font-medium">{gap.customer_name}</p>
                      <p className="text-xs text-cscx-gray-500">
                        {gap.last_activity_type
                          ? `Last: ${ACTIVITY_TYPE_LABELS[gap.last_activity_type]} - ${formatDaysAgo(gap.days_since_activity)}`
                          : 'No activity recorded'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-cscx-gray-400 text-sm">{formatCurrency(gap.arr)}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${riskStyle.bg} ${riskStyle.text} capitalize`}>
                      {gap.risk_level}
                    </span>
                    <span className="text-cscx-gray-500 text-sm">{gap.csm_name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-cscx-gray-500">
            No customers with activity gaps at the current threshold
          </div>
        )}
      </div>

      {/* CSM Productivity */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-cscx-gray-800">
          <h3 className="text-lg font-semibold text-white">CSM Productivity</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cscx-gray-800/50">
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">CSM</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Activities</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Customers Touched</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Coverage</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Avg/Customer</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">This Week</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cscx-gray-800">
              {csm_productivity.map((csm) => (
                <tr key={csm.csm_id} className="hover:bg-cscx-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-white font-medium">{csm.csm_name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white">{csm.total_activities}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-cscx-gray-300">
                      {csm.customers_touched} / {csm.total_customers}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-cscx-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            csm.coverage_rate >= 80 ? 'bg-green-500' : csm.coverage_rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${csm.coverage_rate}%` }}
                        />
                      </div>
                      <span className="text-cscx-gray-300 text-xs">{csm.coverage_rate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-cscx-gray-300">{csm.avg_activities_per_customer}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white">{csm.activities_this_week}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={csm.trend_change >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {csm.trend_change >= 0 ? '+' : ''}{csm.trend_change}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-cscx-gray-800">
          <h3 className="text-lg font-semibold text-white">Recent Activities</h3>
        </div>

        <div className="divide-y divide-cscx-gray-800 max-h-96 overflow-y-auto">
          {recent_activities.map((activity) => (
            <div
              key={activity.id}
              onClick={() => onSelectCustomer?.(activity.customer_id)}
              className="flex items-center gap-4 p-4 hover:bg-cscx-gray-800/30 cursor-pointer transition-colors"
            >
              <span className="text-xl">{getActivityIcon(activity.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm truncate">{activity.description}</p>
                <p className="text-xs text-cscx-gray-500">
                  {activity.customer_name} - {activity.csm_name}
                </p>
              </div>
              <span className="text-xs text-cscx-gray-500 whitespace-nowrap">
                {formatDate(activity.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ActivityFeedAnalysis;
