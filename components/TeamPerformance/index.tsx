/**
 * Team Performance Dashboard
 * PRD-178: Team Performance Dashboard for CS Leaders
 *
 * Features:
 * - Team overview with key metrics
 * - Individual CSM performance table
 * - Goals tracking and progress
 * - Highlights and coaching opportunities
 * - Trend visualization
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  TeamPerformanceResponse,
  CSMMetrics,
  TeamGoal,
  TeamHighlight,
  TeamPerformanceFilters
} from '../../types/teamPerformance';
import { CSMDetailModal } from './CSMDetailModal';
import { TeamTrendChart } from './TeamTrendChart';

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
  return `$${amount.toFixed(0)}`;
};

const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
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

const getStatusColor = (status: 'on_track' | 'at_risk' | 'behind'): string => {
  switch (status) {
    case 'on_track': return 'text-green-400';
    case 'at_risk': return 'text-yellow-400';
    case 'behind': return 'text-red-400';
  }
};

const getStatusBg = (status: 'on_track' | 'at_risk' | 'behind'): string => {
  switch (status) {
    case 'on_track': return 'bg-green-500';
    case 'at_risk': return 'bg-yellow-500';
    case 'behind': return 'bg-red-500';
  }
};

const getHighlightStyle = (type: 'achievement' | 'improvement' | 'concern'): { bg: string; border: string; icon: string } => {
  switch (type) {
    case 'achievement':
      return { bg: 'bg-green-500/10', border: 'border-green-500/30', icon: '\uD83C\uDFC6' };
    case 'improvement':
      return { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: '\uD83D\uDCC8' };
    case 'concern':
      return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: '\u26A0\uFE0F' };
  }
};

// ============================================
// MAIN COMPONENT
// ============================================

interface TeamPerformanceDashboardProps {
  onSelectCSM?: (userId: string) => void;
}

export const TeamPerformanceDashboard: React.FC<TeamPerformanceDashboardProps> = ({
  onSelectCSM
}) => {
  // State
  const [data, setData] = useState<TeamPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TeamPerformanceFilters>({
    period: 'month',
    sort_by: 'retention',
    sort_order: 'desc'
  });
  const [selectedCSMId, setSelectedCSMId] = useState<string | null>(null);

  // Fetch team performance data
  const fetchTeamPerformance = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.period) params.append('period', filters.period);
      if (filters.sort_by) params.append('sort_by', filters.sort_by);
      if (filters.sort_order) params.append('sort_order', filters.sort_order);
      if (filters.team_id) params.append('team_id', filters.team_id);

      const response = await fetch(`${API_BASE}/reports/team-performance?${params}`);
      if (!response.ok) throw new Error('Failed to fetch team performance data');

      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        throw new Error(result.error?.message || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTeamPerformance();
  }, [fetchTeamPerformance]);

  // Handlers
  const handleSort = (field: 'retention' | 'nrr' | 'health' | 'activity' | 'portfolio' | 'name') => {
    setFilters(prev => ({
      ...prev,
      sort_by: field,
      sort_order: prev.sort_by === field && prev.sort_order === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handlePeriodChange = (period: 'month' | 'quarter' | 'year') => {
    setFilters(prev => ({ ...prev, period }));
  };

  const handleCSMClick = (csm: CSMMetrics) => {
    setSelectedCSMId(csm.user_id);
  };

  const handleCloseDetail = () => {
    setSelectedCSMId(null);
  };

  const handleExport = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/reports/team-performance/export?period=${filters.period}&format=csv`
      );
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `team-performance-${filters.period}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  // Loading state
  if (loading && !data) {
    return (
      <div className="p-8 text-center text-cscx-gray-400">
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
        Loading team performance...
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="p-8 text-center text-red-400">
        {error}
        <button
          onClick={fetchTeamPerformance}
          className="block mx-auto mt-2 text-sm text-cscx-accent hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { summary, csm_metrics, team_goals, highlights, trends, period } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Team Performance</h2>
          <p className="text-cscx-gray-400 text-sm mt-1">{period.label}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="flex gap-1 bg-cscx-gray-800 rounded-lg p-1">
            {(['month', 'quarter', 'year'] as const).map(p => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                  filters.period === p
                    ? 'bg-cscx-accent text-white'
                    : 'text-cscx-gray-400 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          {/* Export Button */}
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          {/* Refresh Button */}
          <button
            onClick={fetchTeamPerformance}
            className="p-2 text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800 rounded-lg transition-colors"
            title="Refresh"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Team Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Retention */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cscx-gray-400">Avg Retention</span>
            <span className={`text-xs font-medium ${summary.retention_change_wow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {summary.retention_change_wow >= 0 ? '+' : ''}{summary.retention_change_wow}%
            </span>
          </div>
          <p className="text-3xl font-bold text-white">{formatPercent(summary.avg_retention_rate)}</p>
          <p className="text-xs text-cscx-gray-500 mt-1">Target: 96%</p>
        </div>

        {/* NRR */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cscx-gray-400">Avg NRR</span>
            <span className={`text-xs font-medium ${summary.nrr_change_wow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {summary.nrr_change_wow >= 0 ? '+' : ''}{summary.nrr_change_wow}%
            </span>
          </div>
          <p className="text-3xl font-bold text-cscx-accent">{formatPercent(summary.avg_nrr)}</p>
          <p className="text-xs text-cscx-gray-500 mt-1">Target: 110%</p>
        </div>

        {/* Health */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cscx-gray-400">Avg Health</span>
            <span className={`text-xs font-medium ${summary.health_change_wow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {summary.health_change_wow >= 0 ? '+' : ''}{summary.health_change_wow}
            </span>
          </div>
          <p className="text-3xl font-bold text-white">{summary.avg_health_score}</p>
          <p className="text-xs text-cscx-gray-500 mt-1">Target: 80</p>
        </div>

        {/* Portfolio */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cscx-gray-400">Total ARR</span>
            <span className="text-xs text-cscx-gray-500">{summary.total_customers} customers</span>
          </div>
          <p className="text-3xl font-bold text-green-400">{formatCurrency(summary.total_arr)}</p>
          <p className="text-xs text-cscx-gray-500 mt-1">{summary.total_csms} CSMs</p>
        </div>
      </div>

      {/* Goals Progress & Highlights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Goals */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Team Goals Progress</h3>
          <div className="space-y-4">
            {team_goals.map(goal => (
              <div key={goal.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white capitalize">{goal.metric}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${getStatusBg(goal.status)}/20 ${getStatusColor(goal.status)}`}>
                      {goal.status.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-sm text-cscx-gray-400">
                    {goal.current_value}{goal.metric === 'health' || goal.metric === 'activity' ? '' : '%'} / {goal.target_value}{goal.metric === 'health' || goal.metric === 'activity' ? '' : '%'}
                  </span>
                </div>
                <div className="h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getStatusBg(goal.status)} transition-all duration-500`}
                    style={{ width: `${Math.min(100, goal.progress_pct)}%` }}
                  />
                </div>
                <p className="text-xs text-cscx-gray-500">{goal.progress_pct}% to target</p>
              </div>
            ))}
          </div>
        </div>

        {/* Highlights */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Highlights</h3>
          <div className="space-y-3">
            {highlights.map((highlight, index) => {
              const style = getHighlightStyle(highlight.type);
              return (
                <div
                  key={index}
                  onClick={() => highlight.csm_id && setSelectedCSMId(highlight.csm_id)}
                  className={`p-3 rounded-lg border ${style.bg} ${style.border} ${highlight.csm_id ? 'cursor-pointer hover:opacity-80' : ''} transition-opacity`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg">{style.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{highlight.title}</p>
                      <p className="text-xs text-cscx-gray-400 mt-0.5">{highlight.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {highlights.length === 0 && (
              <p className="text-cscx-gray-500 text-center py-4">No highlights this period</p>
            )}
          </div>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Team Trends</h3>
        <TeamTrendChart trends={trends} />
      </div>

      {/* CSM Performance Table */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-cscx-gray-800">
          <h3 className="text-lg font-semibold text-white">Individual Performance</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cscx-gray-800/50">
                <th
                  className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort('name')}
                >
                  CSM {filters.sort_by === 'name' && (filters.sort_order === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th
                  className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort('portfolio')}
                >
                  Portfolio {filters.sort_by === 'portfolio' && (filters.sort_order === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th
                  className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort('retention')}
                >
                  Retention {filters.sort_by === 'retention' && (filters.sort_order === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th
                  className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort('nrr')}
                >
                  NRR {filters.sort_by === 'nrr' && (filters.sort_order === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th
                  className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort('health')}
                >
                  Health Avg {filters.sort_by === 'health' && (filters.sort_order === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th
                  className="text-left px-4 py-3 text-cscx-gray-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => handleSort('activity')}
                >
                  Activity {filters.sort_by === 'activity' && (filters.sort_order === 'asc' ? '\u2191' : '\u2193')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cscx-gray-800">
              {csm_metrics.map((csm, index) => (
                <tr
                  key={csm.user_id}
                  onClick={() => handleCSMClick(csm)}
                  className="hover:bg-cscx-gray-800/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* Rank badge for top 3 */}
                      {index < 3 && filters.sort_by === 'retention' && filters.sort_order === 'desc' && (
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                          index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                          index === 1 ? 'bg-gray-400/20 text-gray-300' :
                          'bg-amber-600/20 text-amber-500'
                        }`}>
                          {index + 1}
                        </span>
                      )}
                      <div>
                        <p className="text-white font-medium">{csm.user_name}</p>
                        <p className="text-cscx-gray-500 text-xs">{csm.customer_count} customers</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white font-medium">{formatCurrency(csm.portfolio_value)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${csm.retention_rate >= 96 ? 'text-green-400' : csm.retention_rate >= 90 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {formatPercent(csm.retention_rate)}
                      </span>
                      <span className={`text-xs ${getTrendColor(csm.retention_trend)}`}>
                        {getTrendIcon(csm.retention_trend)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${csm.net_revenue_retention >= 110 ? 'text-green-400' : csm.net_revenue_retention >= 100 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {formatPercent(csm.net_revenue_retention)}
                      </span>
                      <span className={`text-xs ${getTrendColor(csm.nrr_trend)}`}>
                        {getTrendIcon(csm.nrr_trend)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${csm.health_score_avg >= 80 ? 'text-green-400' : csm.health_score_avg >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {csm.health_score_avg}
                      </span>
                      <span className={`text-xs ${getTrendColor(csm.health_trend)}`}>
                        {getTrendIcon(csm.health_trend)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${csm.activity_score >= 80 ? 'bg-green-500' : csm.activity_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${csm.activity_score}%` }}
                        />
                      </div>
                      <span className="text-xs text-cscx-gray-400">{csm.activity_score}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-cscx-gray-800 text-sm text-cscx-gray-400">
          Showing {csm_metrics.length} team members
        </div>
      </div>

      {/* CSM Detail Modal */}
      {selectedCSMId && (
        <CSMDetailModal
          userId={selectedCSMId}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
};

export default TeamPerformanceDashboard;
