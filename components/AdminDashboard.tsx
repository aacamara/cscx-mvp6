/**
 * AdminDashboard - Platform Metrics Overview
 * PRD-5: Admin Dashboard View
 * Displays KPIs, user activity, and system health for admins
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

interface AdminMetrics {
  timestamp: string;
  period: {
    today: string;
    weekStart: string;
  };
  metrics: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    actionsToday: number;
    actionsThisWeek: number;
    errorRate: number;
    totalCustomers: number;
    atRiskCustomers: number;
    healthyCustomers: number;
    pendingApprovals: number;
    agentRunsToday: number;
    avgResponseTimeMs: number;
  };
  summary: {
    healthDistribution: {
      healthy: number;
      atRisk: number;
      other: number;
    };
    systemHealth: string;
  };
}

interface AdminDashboardProps {
  onClose?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const { getAuthHeaders } = useAuth();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/overview`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Admin access required');
        }
        throw new Error('Failed to fetch metrics');
      }
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchMetrics();
    // Refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMetrics();
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'good': return 'text-green-400';
      case 'degraded': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
      default: return 'text-cscx-gray-400';
    }
  };

  const getHealthBg = (health: string) => {
    switch (health) {
      case 'good': return 'bg-green-500/20 border-green-500/30';
      case 'degraded': return 'bg-yellow-500/20 border-yellow-500/30';
      case 'critical': return 'bg-red-500/20 border-red-500/30';
      default: return 'bg-cscx-gray-800 border-cscx-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cscx-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchMetrics}
          className="mt-4 px-4 py-2 bg-cscx-gray-800 text-white rounded-lg hover:bg-cscx-gray-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Admin Dashboard</h2>
          <p className="text-sm text-cscx-gray-400 mt-1">
            Platform metrics and system health
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-cscx-gray-400 hover:text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-cscx-gray-400 hover:text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* System Health Banner */}
      <div className={`rounded-xl p-4 border ${getHealthBg(metrics.summary.systemHealth)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${metrics.summary.systemHealth === 'good' ? 'bg-green-400' : metrics.summary.systemHealth === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'}`}></div>
            <span className={`font-medium ${getHealthColor(metrics.summary.systemHealth)}`}>
              System {metrics.summary.systemHealth === 'good' ? 'Healthy' : metrics.summary.systemHealth === 'degraded' ? 'Degraded' : 'Critical'}
            </span>
          </div>
          <span className="text-xs text-cscx-gray-400">
            Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* User Activity Metrics */}
      <div>
        <h3 className="text-sm font-medium text-cscx-gray-400 uppercase tracking-wider mb-3">User Activity</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Daily Active Users"
            value={metrics.metrics.dailyActiveUsers}
            icon="users"
          />
          <MetricCard
            label="Weekly Active Users"
            value={metrics.metrics.weeklyActiveUsers}
            icon="calendar"
          />
          <MetricCard
            label="Actions Today"
            value={metrics.metrics.actionsToday}
            icon="activity"
          />
          <MetricCard
            label="Actions This Week"
            value={metrics.metrics.actionsThisWeek}
            icon="trending"
          />
        </div>
      </div>

      {/* Customer Health */}
      <div>
        <h3 className="text-sm font-medium text-cscx-gray-400 uppercase tracking-wider mb-3">Customer Health</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total Customers"
            value={metrics.metrics.totalCustomers}
            icon="building"
          />
          <MetricCard
            label="Healthy"
            value={metrics.summary.healthDistribution.healthy}
            color="green"
            icon="check"
          />
          <MetricCard
            label="At Risk"
            value={metrics.metrics.atRiskCustomers}
            color="red"
            icon="alert"
          />
          <MetricCard
            label="Other"
            value={metrics.summary.healthDistribution.other}
            color="gray"
            icon="minus"
          />
        </div>
      </div>

      {/* System Metrics */}
      <div>
        <h3 className="text-sm font-medium text-cscx-gray-400 uppercase tracking-wider mb-3">System Performance</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Error Rate"
            value={`${metrics.metrics.errorRate.toFixed(2)}%`}
            color={metrics.metrics.errorRate > 5 ? 'red' : metrics.metrics.errorRate > 1 ? 'yellow' : 'green'}
            icon="error"
          />
          <MetricCard
            label="Agent Runs Today"
            value={metrics.metrics.agentRunsToday}
            icon="robot"
          />
          <MetricCard
            label="Pending Approvals"
            value={metrics.metrics.pendingApprovals}
            color={metrics.metrics.pendingApprovals > 0 ? 'yellow' : 'gray'}
            icon="clock"
          />
          <MetricCard
            label="Avg Response"
            value={`${metrics.metrics.avgResponseTimeMs}ms`}
            icon="speed"
          />
        </div>
      </div>

      {/* Health Distribution Chart */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-medium text-cscx-gray-400 uppercase tracking-wider mb-4">Health Distribution</h3>
        <div className="flex items-center gap-2 h-8">
          {metrics.summary.healthDistribution.healthy > 0 && (
            <div
              className="bg-green-500 h-full rounded-l"
              style={{ width: `${(metrics.summary.healthDistribution.healthy / metrics.metrics.totalCustomers) * 100}%` }}
              title={`Healthy: ${metrics.summary.healthDistribution.healthy}`}
            />
          )}
          {metrics.summary.healthDistribution.other > 0 && (
            <div
              className="bg-yellow-500 h-full"
              style={{ width: `${(metrics.summary.healthDistribution.other / metrics.metrics.totalCustomers) * 100}%` }}
              title={`Other: ${metrics.summary.healthDistribution.other}`}
            />
          )}
          {metrics.summary.healthDistribution.atRisk > 0 && (
            <div
              className="bg-red-500 h-full rounded-r"
              style={{ width: `${(metrics.summary.healthDistribution.atRisk / metrics.metrics.totalCustomers) * 100}%` }}
              title={`At Risk: ${metrics.summary.healthDistribution.atRisk}`}
            />
          )}
        </div>
        <div className="flex justify-between mt-2 text-xs text-cscx-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded"></span>
            Healthy ({metrics.summary.healthDistribution.healthy})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-yellow-500 rounded"></span>
            Other ({metrics.summary.healthDistribution.other})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-red-500 rounded"></span>
            At Risk ({metrics.summary.healthDistribution.atRisk})
          </span>
        </div>
      </div>
    </div>
  );
};

// Metric Card Component
const MetricCard: React.FC<{
  label: string;
  value: string | number;
  color?: 'green' | 'yellow' | 'red' | 'gray';
  icon?: string;
}> = ({ label, value, color, icon }) => {
  const colorClasses = {
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
    gray: 'text-cscx-gray-400'
  };

  const getIcon = () => {
    switch (icon) {
      case 'users':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />;
      case 'calendar':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />;
      case 'activity':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />;
      case 'trending':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />;
      case 'building':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />;
      case 'check':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />;
      case 'alert':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />;
      case 'error':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />;
      case 'robot':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />;
      case 'clock':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />;
      case 'speed':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />;
      default:
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />;
    }
  };

  return (
    <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color ? colorClasses[color] : 'text-white'}`}>
            {value}
          </p>
        </div>
        <svg className="w-5 h-5 text-cscx-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {getIcon()}
        </svg>
      </div>
    </div>
  );
};

export default AdminDashboard;
