/**
 * Agent Performance Dashboard
 * Real-time metrics and charts for agent performance
 * Shows execution stats, success rates, and usage analytics
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

interface MetricsSummary {
  executions: {
    today: number;
    week: number;
    month: number;
    total: number;
    change: { today: number; week: number; month: number };
  };
  successRate: number;
  errorRate: number;
  avgDuration: number;
  avgDurationFormatted: string;
  activeRuns: number;
  totalTokens: { input: number; output: number };
  topAgents: Array<{ name: string; count: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
  lastUpdated: string;
}

interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  label?: string;
}

interface ExecutionsData {
  timeSeries: TimeSeriesPoint[];
  period: string;
  granularity: string;
  summary: {
    total: number;
    average: number;
    peak: number;
    low: number;
  };
}

interface ApprovalStats {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  approvalRate: number;
  avgResponseTime: number;
  avgResponseTimeFormatted: string;
  byType: Array<{ type: string; count: number; approvalRate: number }>;
  byAgent: Array<{ agent: string; total: number; approved: number; rejected: number }>;
}

interface PerformanceStats {
  avgDuration: number;
  medianDuration: number;
  p95Duration: number;
  avgTokens: { input: number; output: number };
  throughput: number;
  durationByAgent: Array<{ agent: string; avgDuration: number }>;
  durationTrend: TimeSeriesPoint[];
  avgDurationFormatted: string;
  medianDurationFormatted: string;
  p95DurationFormatted: string;
}

type TimePeriod = 'day' | 'week' | 'month' | 'quarter';

interface Props {
  className?: string;
}

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Main Component
// ============================================

export function AgentDashboard({ className = '' }: Props) {
  const { getAuthHeaders } = useAuth();
  const [period, setPeriod] = useState<TimePeriod>('week');
  const [loading, setLoading] = useState(true);

  // Data states
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [executions, setExecutions] = useState<ExecutionsData | null>(null);
  const [approvals, setApprovals] = useState<ApprovalStats | null>(null);
  const [performance, setPerformance] = useState<PerformanceStats | null>(null);

  // Build headers
  const buildHeaders = useCallback((): Record<string, string> => {
    const headers = getAuthHeaders();
    if (!headers['x-user-id']) {
      headers['x-user-id'] = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';
    }
    return headers;
  }, [getAuthHeaders]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    const headers = buildHeaders();

    try {
      const [summaryRes, executionsRes, approvalsRes, performanceRes] = await Promise.all([
        fetch(`${API_URL}/api/agent-metrics/summary`, { headers }),
        fetch(`${API_URL}/api/agent-metrics/executions?period=${period}`, { headers }),
        fetch(`${API_URL}/api/agent-metrics/approvals?period=${period}`, { headers }),
        fetch(`${API_URL}/api/agent-metrics/performance?period=${period}`, { headers }),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (executionsRes.ok) setExecutions(await executionsRes.json());
      if (approvalsRes.ok) setApprovals(await approvalsRes.json());
      if (performanceRes.ok) setPerformance(await performanceRes.json());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [buildHeaders, period]);

  // Initial fetch and refresh
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">&#128200;</div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Performance Dashboard</h1>
          <p className="text-sm text-gray-400">
            Last updated: {summary?.lastUpdated ? new Date(summary.lastUpdated).toLocaleTimeString() : 'N/A'}
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2">
          {(['day', 'week', 'month', 'quarter'] as TimePeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-cscx-accent text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-5 gap-4">
        <MetricCard
          title="Total Executions"
          value={summary?.executions.week.toString() || '0'}
          subtitle="This week"
          change={summary?.executions.change.week}
          icon="&#128200;"
        />
        <MetricCard
          title="Success Rate"
          value={`${summary?.successRate || 0}%`}
          subtitle="Completed successfully"
          trend={summary?.successRate ? (summary.successRate >= 90 ? 'up' : summary.successRate >= 70 ? 'neutral' : 'down') : 'neutral'}
          icon="&#9989;"
          valueColor={summary?.successRate && summary.successRate >= 90 ? 'text-green-400' : 'text-yellow-400'}
        />
        <MetricCard
          title="Error Rate"
          value={`${summary?.errorRate || 0}%`}
          subtitle="Failed executions"
          trend={summary?.errorRate ? (summary.errorRate <= 5 ? 'up' : summary.errorRate <= 15 ? 'neutral' : 'down') : 'neutral'}
          icon="&#10060;"
          valueColor={summary?.errorRate && summary.errorRate <= 5 ? 'text-green-400' : 'text-red-400'}
        />
        <MetricCard
          title="Avg Duration"
          value={summary?.avgDurationFormatted || '-'}
          subtitle="Per execution"
          icon="&#9201;"
        />
        <MetricCard
          title="Active Now"
          value={summary?.activeRuns.toString() || '0'}
          subtitle="Running agents"
          icon="&#128640;"
          valueColor="text-blue-400"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Executions Chart */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Executions Over Time</h3>
          {executions && executions.timeSeries.length > 0 ? (
            <SimpleBarChart
              data={executions.timeSeries}
              height={200}
              color="#e63946"
            />
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">
              No execution data available
            </div>
          )}
          {executions?.summary && (
            <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Total</span>
                <p className="text-white font-medium">{executions.summary.total}</p>
              </div>
              <div>
                <span className="text-gray-500">Average</span>
                <p className="text-white font-medium">{executions.summary.average}/day</p>
              </div>
              <div>
                <span className="text-gray-500">Peak</span>
                <p className="text-white font-medium">{executions.summary.peak}</p>
              </div>
              <div>
                <span className="text-gray-500">Low</span>
                <p className="text-white font-medium">{executions.summary.low}</p>
              </div>
            </div>
          )}
        </div>

        {/* Success Rate Chart */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Status Breakdown</h3>
          {summary?.statusBreakdown && summary.statusBreakdown.length > 0 ? (
            <div className="space-y-3">
              {summary.statusBreakdown.map((item) => {
                const total = summary.statusBreakdown.reduce((sum, s) => sum + s.count, 0);
                const percent = total > 0 ? (item.count / total) * 100 : 0;
                const color = item.status === 'completed' ? 'bg-green-500' :
                              item.status === 'failed' ? 'bg-red-500' :
                              item.status === 'running' ? 'bg-blue-500' : 'bg-yellow-500';

                return (
                  <div key={item.status}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-300 capitalize">{item.status.replace('_', ' ')}</span>
                      <span className="text-white font-medium">{item.count} ({percent.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${color} transition-all`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">
              No status data available
            </div>
          )}
        </div>
      </div>

      {/* Second Charts Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Top Agents */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Top Agents by Usage</h3>
          {summary?.topAgents && summary.topAgents.length > 0 ? (
            <div className="space-y-3">
              {summary.topAgents.map((agent, index) => {
                const maxCount = summary.topAgents[0].count;
                const percent = maxCount > 0 ? (agent.count / maxCount) * 100 : 0;

                return (
                  <div key={agent.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">#{index + 1}</span>
                        <span className="text-gray-300 truncate max-w-[150px]">{agent.name}</span>
                      </div>
                      <span className="text-white font-medium">{agent.count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cscx-accent transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-gray-500">
              No agent data available
            </div>
          )}
        </div>

        {/* Approval Stats */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Approval Metrics</h3>
          {approvals ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-700/50 rounded">
                  <p className="text-2xl font-bold text-green-400">{approvals.approved}</p>
                  <p className="text-xs text-gray-400">Approved</p>
                </div>
                <div className="text-center p-3 bg-gray-700/50 rounded">
                  <p className="text-2xl font-bold text-red-400">{approvals.rejected}</p>
                  <p className="text-xs text-gray-400">Rejected</p>
                </div>
              </div>

              <div className="text-center">
                <p className="text-3xl font-bold text-white">{approvals.approvalRate}%</p>
                <p className="text-sm text-gray-400">Approval Rate</p>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Pending</span>
                <span className="text-yellow-400 font-medium">{approvals.pending}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Avg Response Time</span>
                <span className="text-white font-medium">{approvals.avgResponseTimeFormatted}</span>
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">
              No approval data available
            </div>
          )}
        </div>

        {/* Performance Stats */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Performance</h3>
          {performance ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-gray-700/50 rounded">
                  <p className="text-lg font-bold text-white">{performance.avgDurationFormatted}</p>
                  <p className="text-xs text-gray-400">Avg</p>
                </div>
                <div className="text-center p-2 bg-gray-700/50 rounded">
                  <p className="text-lg font-bold text-white">{performance.medianDurationFormatted}</p>
                  <p className="text-xs text-gray-400">Median</p>
                </div>
                <div className="text-center p-2 bg-gray-700/50 rounded">
                  <p className="text-lg font-bold text-white">{performance.p95DurationFormatted}</p>
                  <p className="text-xs text-gray-400">P95</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Throughput</span>
                <span className="text-white font-medium">{performance.throughput}/hour</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Avg Tokens</span>
                <span className="text-white font-medium">
                  {performance.avgTokens.input + performance.avgTokens.output}
                </span>
              </div>

              {/* Duration by Agent */}
              {performance.durationByAgent.length > 0 && (
                <div className="pt-2 border-t border-gray-700">
                  <p className="text-xs text-gray-500 uppercase mb-2">Fastest Agents</p>
                  {performance.durationByAgent.slice(0, 3).map((agent) => (
                    <div key={agent.agent} className="flex items-center justify-between text-sm py-1">
                      <span className="text-gray-300 truncate max-w-[120px]">{agent.agent}</span>
                      <span className="text-green-400 text-xs">{(agent.avgDuration / 1000).toFixed(2)}s</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">
              No performance data available
            </div>
          )}
        </div>
      </div>

      {/* Token Usage */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Token Usage</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-white">
              {((summary?.totalTokens.input || 0) + (summary?.totalTokens.output || 0)).toLocaleString()}
            </p>
            <p className="text-sm text-gray-400">Total Tokens</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-400">
              {(summary?.totalTokens.input || 0).toLocaleString()}
            </p>
            <p className="text-sm text-gray-400">Input Tokens</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-400">
              {(summary?.totalTokens.output || 0).toLocaleString()}
            </p>
            <p className="text-sm text-gray-400">Output Tokens</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon?: string;
  valueColor?: string;
}

function MetricCard({ title, value, subtitle, change, trend, icon, valueColor = 'text-white' }: MetricCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">{title}</span>
        {icon && <span className="text-xl" dangerouslySetInnerHTML={{ __html: icon }} />}
      </div>

      <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>

      <div className="flex items-center justify-between mt-2">
        {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}

        {change !== undefined && (
          <span className={`text-xs font-medium ${
            change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-gray-400'
          }`}>
            {change > 0 ? '+' : ''}{change}%
          </span>
        )}

        {trend && (
          <span className={`text-xs ${
            trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'
          }`}>
            {trend === 'up' ? '&#9650;' : trend === 'down' ? '&#9660;' : '&#8212;'}
          </span>
        )}
      </div>
    </div>
  );
}

interface SimpleBarChartProps {
  data: TimeSeriesPoint[];
  height?: number;
  color?: string;
}

function SimpleBarChart({ data, height = 200, color = '#e63946' }: SimpleBarChartProps) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const barWidth = Math.max(100 / data.length - 1, 2);

  return (
    <div className="relative" style={{ height }}>
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between text-xs text-gray-500">
        <span>{maxValue}</span>
        <span>{Math.round(maxValue / 2)}</span>
        <span>0</span>
      </div>

      {/* Chart area */}
      <div className="ml-10 h-full flex items-end gap-1">
        {data.map((point, index) => {
          const barHeight = (point.value / maxValue) * (height - 24);

          return (
            <div
              key={index}
              className="flex flex-col items-center justify-end"
              style={{ width: `${barWidth}%` }}
            >
              <div
                className="w-full rounded-t transition-all hover:opacity-80"
                style={{
                  height: barHeight,
                  backgroundColor: color,
                  minHeight: point.value > 0 ? 4 : 0,
                }}
                title={point.label || `${point.timestamp}: ${point.value}`}
              />
              {data.length <= 14 && (
                <span className="text-xs text-gray-500 mt-1 truncate max-w-full">
                  {new Date(point.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AgentDashboard;
