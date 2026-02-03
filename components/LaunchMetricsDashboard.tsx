/**
 * LaunchMetricsDashboard - Admin view for launch metrics
 * PRD: Compound Product Launch (CP-010)
 * Shows: signups, activation rate, import rate, session duration, top features
 */

import React, { useState, useEffect } from 'react';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

interface LaunchMetrics {
  signups: number;
  activatedUsers: number;
  activationRate: number;
  usersWithImports: number;
  importRate: number;
  avgSessionDuration: number; // in minutes
  avgFeaturesTriedPerUser: number;
  topFeatures: Array<{ feature: string; count: number }>;
  dailySignups: Array<{ date: string; count: number }>;
}

interface LaunchMetricsDashboardProps {
  isAdmin: boolean;
}

export function LaunchMetricsDashboard({ isAdmin }: LaunchMetricsDashboardProps) {
  const [metrics, setMetrics] = useState<LaunchMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'7' | '14' | '30'>('7');

  useEffect(() => {
    if (!isAdmin) return;

    const fetchMetrics = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/admin/launch-metrics?days=${period}`, {
          headers: { 'x-user-role': 'admin' },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch metrics');
        }

        const data = await response.json();
        setMetrics(data.metrics);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load metrics');
        // Use mock data for development
        setMetrics({
          signups: 12,
          activatedUsers: 9,
          activationRate: 75,
          usersWithImports: 4,
          importRate: 33,
          avgSessionDuration: 14,
          avgFeaturesTriedPerUser: 4.2,
          topFeatures: [
            { feature: 'Mock Onboarding', count: 9 },
            { feature: 'Customer List', count: 12 },
            { feature: 'CSV Import', count: 4 },
            { feature: 'Contract Upload', count: 3 },
          ],
          dailySignups: [
            { date: '2026-01-27', count: 2 },
            { date: '2026-01-28', count: 3 },
            { date: '2026-01-29', count: 2 },
            { date: '2026-01-30', count: 1 },
            { date: '2026-01-31', count: 2 },
            { date: '2026-02-01', count: 1 },
            { date: '2026-02-02', count: 1 },
          ],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [isAdmin, period]);

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-cscx-accent border-t-transparent mx-auto"></div>
        <p className="text-gray-400 mt-4">Loading metrics...</p>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="p-8 text-center text-red-400">
        <p>{error}</p>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="p-6 bg-cscx-gray-900 rounded-xl border border-cscx-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Launch Metrics</h2>
          <p className="text-gray-400 text-sm">Last {period} days</p>
        </div>
        <div className="flex gap-2">
          {(['7', '14', '30'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                period === p
                  ? 'bg-cscx-accent text-white'
                  : 'bg-cscx-gray-800 text-gray-400 hover:bg-cscx-gray-700'
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Signups"
          value={metrics.signups}
          format="number"
        />
        <MetricCard
          label="Activation Rate"
          value={metrics.activationRate}
          format="percent"
          subtitle={`${metrics.activatedUsers} activated`}
        />
        <MetricCard
          label="Import Rate"
          value={metrics.importRate}
          format="percent"
          subtitle={`${metrics.usersWithImports} users`}
        />
        <MetricCard
          label="Avg Session"
          value={metrics.avgSessionDuration}
          format="minutes"
        />
      </div>

      {/* Feature Discovery */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Features */}
        <div className="bg-cscx-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            Top Features Used
          </h3>
          <div className="space-y-3">
            {metrics.topFeatures.map((feature, index) => (
              <div key={feature.feature} className="flex items-center gap-3">
                <span className="text-gray-500 text-sm w-6">{index + 1}.</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-sm">{feature.feature}</span>
                    <span className="text-gray-400 text-sm">{feature.count} users</span>
                  </div>
                  <div className="h-1.5 bg-cscx-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cscx-accent rounded-full"
                      style={{ width: `${(feature.count / metrics.signups) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Features Tried */}
        <div className="bg-cscx-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            Feature Discovery
          </h3>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="text-5xl font-bold text-white mb-2">
                {metrics.avgFeaturesTriedPerUser.toFixed(1)}
              </div>
              <p className="text-gray-400">avg features tried per user</p>
              <p className="text-gray-500 text-sm mt-1">out of 8 total</p>
            </div>
          </div>
          <div className="h-2 bg-cscx-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cscx-accent to-orange-500 rounded-full"
              style={{ width: `${(metrics.avgFeaturesTriedPerUser / 8) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Daily Signups Chart */}
      <div className="mt-6 bg-cscx-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
          Daily Signups
        </h3>
        <div className="flex items-end gap-1 h-24">
          {metrics.dailySignups.map((day) => {
            const maxCount = Math.max(...metrics.dailySignups.map((d) => d.count));
            const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center"
              >
                <div
                  className="w-full bg-cscx-accent/60 hover:bg-cscx-accent rounded-t transition-colors"
                  style={{ height: `${Math.max(height, 4)}%` }}
                  title={`${day.date}: ${day.count} signups`}
                />
                <span className="text-xs text-gray-500 mt-1">
                  {new Date(day.date).getDate()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  format: 'number' | 'percent' | 'minutes';
  subtitle?: string;
}

function MetricCard({ label, value, format, subtitle }: MetricCardProps) {
  const formattedValue = () => {
    switch (format) {
      case 'percent':
        return `${value}%`;
      case 'minutes':
        return `${value} min`;
      default:
        return value.toString();
    }
  };

  return (
    <div className="bg-cscx-gray-800 rounded-lg p-4">
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{formattedValue()}</p>
      {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
    </div>
  );
}

export default LaunchMetricsDashboard;
