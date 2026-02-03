/**
 * Year-over-Year Comparison Report Component
 * PRD-177: Year-over-Year Comparison Report
 *
 * Features:
 * - Compare metrics across calendar/fiscal years
 * - Support multiple metrics (retention, NRR, health score, etc.)
 * - Highlight significant variances with explanations
 * - Drill-down by segment or cohort
 * - Visual trend indicators
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

type MetricType = 'retention' | 'nrr' | 'grr' | 'health_score' | 'arr' | 'customer_count' | 'expansion' | 'churn';

interface YoYPeriodData {
  period: string;
  thisYear: number;
  lastYear: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

interface YoYAnnualSummary {
  thisYearValue: number;
  lastYearValue: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  thisYearLabel: string;
  lastYearLabel: string;
}

interface YoYKeyDriver {
  driver: string;
  impact: string;
  contribution: number;
}

interface YoYMetricComparison {
  metric: MetricType;
  metricLabel: string;
  unit: string;
  periods: YoYPeriodData[];
  annualSummary: YoYAnnualSummary;
  keyDrivers: YoYKeyDriver[];
  insights: string[];
  generatedAt: string;
}

interface YoYSegmentComparison {
  segment: string;
  segmentLabel: string;
  thisYearValue: number;
  lastYearValue: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  customerCount: number;
}

interface YoYCohortComparison {
  cohort: string;
  cohortLabel: string;
  thisYearValue: number;
  lastYearValue: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

interface YoYComparisonReport {
  metric: MetricType;
  comparison: YoYMetricComparison;
  bySegment: YoYSegmentComparison[];
  byCohort: YoYCohortComparison[];
  seasonalPatterns: {
    bestQuarter: string;
    worstQuarter: string;
    seasonalVariance: number;
  };
}

interface MetricOption {
  value: MetricType;
  label: string;
}

// ============================================
// Component Props
// ============================================

interface YoYComparisonProps {
  initialMetric?: MetricType;
  onBack?: () => void;
}

// ============================================
// Main Component
// ============================================

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/reports/yoy`;

export const YoYComparison: React.FC<YoYComparisonProps> = ({
  initialMetric = 'retention',
  onBack,
}) => {
  const { getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>(initialMetric);
  const [availableMetrics, setAvailableMetrics] = useState<MetricOption[]>([]);
  const [report, setReport] = useState<YoYComparisonReport | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'segments' | 'cohorts'>('overview');

  // Fetch available metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/metrics`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error('Failed to fetch metrics');

      const result = await response.json();
      if (result.success) {
        setAvailableMetrics(result.data.metrics);
      }
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  }, [getAuthHeaders]);

  // Fetch YoY comparison data
  const fetchYoYData = useCallback(async (metric: MetricType) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/${metric}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error('Failed to fetch YoY comparison');

      const result = await response.json();
      if (result.success) {
        setReport(result.data);
      } else {
        throw new Error(result.error?.message || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load YoY comparison');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  // Initial data fetch
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    fetchYoYData(selectedMetric);
  }, [selectedMetric, fetchYoYData]);

  // Helper functions
  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <span className="text-green-400 text-lg">&#8593;</span>;
      case 'down':
        return <span className="text-red-400 text-lg">&#8595;</span>;
      default:
        return <span className="text-gray-400 text-lg">&#8594;</span>;
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable', isPositiveGood: boolean = true) => {
    if (trend === 'stable') return 'text-gray-400';
    if (isPositiveGood) {
      return trend === 'up' ? 'text-green-400' : 'text-red-400';
    }
    return trend === 'up' ? 'text-red-400' : 'text-green-400';
  };

  const formatValue = (value: number, unit: string): string => {
    if (unit === '$') {
      if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
      return `$${value.toFixed(0)}`;
    }
    if (unit === '%') return `${value.toFixed(1)}%`;
    if (unit === '#') return value.toFixed(0);
    return `${value.toFixed(1)}${unit}`;
  };

  const formatChange = (change: number, unit: string): string => {
    const sign = change > 0 ? '+' : '';
    if (unit === '$') {
      if (Math.abs(change) >= 1000000) return `${sign}$${(change / 1000000).toFixed(1)}M`;
      if (Math.abs(change) >= 1000) return `${sign}$${(change / 1000).toFixed(0)}K`;
      return `${sign}$${change.toFixed(0)}`;
    }
    if (unit === '%') return `${sign}${change.toFixed(1)}%`;
    return `${sign}${change.toFixed(1)}${unit}`;
  };

  // Determine if positive change is good for this metric
  const isPositiveGood = (metric: MetricType): boolean => {
    return metric !== 'churn';
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
        <p className="text-cscx-gray-400">Loading Year-over-Year comparison...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-8 text-center text-red-400">
        <p>{error}</p>
        <button
          onClick={() => fetchYoYData(selectedMetric)}
          className="mt-4 text-sm text-cscx-accent hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center text-cscx-gray-400">
        No data available
      </div>
    );
  }

  const { comparison, bySegment, byCohort, seasonalPatterns } = report;
  const positiveIsGood = isPositiveGood(selectedMetric);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          {onBack && (
            <button
              onClick={onBack}
              className="text-cscx-gray-400 hover:text-white text-sm mb-2 flex items-center gap-1"
            >
              &#8592; Back
            </button>
          )}
          <h2 className="text-xl font-bold text-white">Year-over-Year Comparison</h2>
          <p className="text-cscx-gray-400 text-sm">
            Compare key metrics across fiscal years
          </p>
        </div>
        <select
          value={selectedMetric}
          onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
          className="px-4 py-2 bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg text-white text-sm min-w-[200px]"
        >
          {availableMetrics.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Annual Summary Card */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          {comparison.metricLabel} - Annual Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-cscx-gray-800/50 rounded-lg">
            <p className="text-cscx-gray-400 text-sm">{comparison.annualSummary.thisYearLabel}</p>
            <p className="text-3xl font-bold text-white mt-1">
              {formatValue(comparison.annualSummary.thisYearValue, comparison.unit)}
            </p>
          </div>
          <div className="p-4 bg-cscx-gray-800/50 rounded-lg">
            <p className="text-cscx-gray-400 text-sm">{comparison.annualSummary.lastYearLabel}</p>
            <p className="text-3xl font-bold text-cscx-gray-300 mt-1">
              {formatValue(comparison.annualSummary.lastYearValue, comparison.unit)}
            </p>
          </div>
          <div className="p-4 bg-cscx-gray-800/50 rounded-lg">
            <p className="text-cscx-gray-400 text-sm">YoY Change</p>
            <div className="flex items-center gap-2 mt-1">
              {getTrendIcon(comparison.annualSummary.trend)}
              <span className={`text-3xl font-bold ${getTrendColor(comparison.annualSummary.trend, positiveIsGood)}`}>
                {formatChange(comparison.annualSummary.change, comparison.unit)}
              </span>
            </div>
            <p className="text-cscx-gray-500 text-sm mt-1">
              ({comparison.annualSummary.changePercent > 0 ? '+' : ''}
              {comparison.annualSummary.changePercent.toFixed(1)}%)
            </p>
          </div>
        </div>
      </div>

      {/* Quarterly Comparison Table */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Quarterly Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cscx-gray-800">
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Period</th>
                <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">This Year</th>
                <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Last Year</th>
                <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Change</th>
                <th className="text-center px-4 py-3 text-cscx-gray-400 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cscx-gray-800">
              {comparison.periods.map((period) => (
                <tr key={period.period} className="hover:bg-cscx-gray-800/30">
                  <td className="px-4 py-3 text-white font-medium">{period.period}</td>
                  <td className="px-4 py-3 text-white text-right">
                    {formatValue(period.thisYear, comparison.unit)}
                  </td>
                  <td className="px-4 py-3 text-cscx-gray-400 text-right">
                    {formatValue(period.lastYear, comparison.unit)}
                  </td>
                  <td className={`px-4 py-3 text-right ${getTrendColor(period.trend, positiveIsGood)}`}>
                    {formatChange(period.change, comparison.unit)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                        period.trend === 'up'
                          ? positiveIsGood
                            ? 'bg-green-500/20'
                            : 'bg-red-500/20'
                          : period.trend === 'down'
                          ? positiveIsGood
                            ? 'bg-red-500/20'
                            : 'bg-green-500/20'
                          : 'bg-gray-500/20'
                      }`}
                    >
                      {getTrendIcon(period.trend)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabs for Segments and Cohorts */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
        <div className="flex border-b border-cscx-gray-800">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'overview'
                ? 'text-white bg-cscx-gray-800 border-b-2 border-cscx-accent'
                : 'text-cscx-gray-400 hover:text-white'
            }`}
          >
            Key Drivers
          </button>
          <button
            onClick={() => setActiveTab('segments')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'segments'
                ? 'text-white bg-cscx-gray-800 border-b-2 border-cscx-accent'
                : 'text-cscx-gray-400 hover:text-white'
            }`}
          >
            By Segment
          </button>
          <button
            onClick={() => setActiveTab('cohorts')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'cohorts'
                ? 'text-white bg-cscx-gray-800 border-b-2 border-cscx-accent'
                : 'text-cscx-gray-400 hover:text-white'
            }`}
          >
            By Cohort
          </button>
        </div>

        <div className="p-6">
          {/* Key Drivers Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-md font-semibold text-white mb-4">Key Drivers of Change</h4>
                <div className="space-y-3">
                  {comparison.keyDrivers.map((driver, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 bg-cscx-gray-800/30 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="text-white">{driver.driver}</p>
                        <p className="text-cscx-gray-500 text-sm">{driver.impact}</p>
                      </div>
                      <div className="text-right">
                        <div className="w-24 h-2 bg-cscx-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cscx-accent rounded-full"
                            style={{ width: `${driver.contribution}%` }}
                          />
                        </div>
                        <p className="text-cscx-gray-500 text-xs mt-1">{driver.contribution}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Insights */}
              <div>
                <h4 className="text-md font-semibold text-white mb-4">Insights</h4>
                <div className="space-y-2">
                  {comparison.insights.map((insight, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-cscx-gray-800/30 rounded-lg"
                    >
                      <span className="text-cscx-accent mt-0.5">&#9679;</span>
                      <p className="text-cscx-gray-300">{insight}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seasonal Patterns */}
              <div>
                <h4 className="text-md font-semibold text-white mb-4">Seasonal Patterns</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-cscx-gray-400 text-sm">Best Quarter</p>
                    <p className="text-xl font-bold text-green-400">{seasonalPatterns.bestQuarter}</p>
                  </div>
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-cscx-gray-400 text-sm">Weakest Quarter</p>
                    <p className="text-xl font-bold text-red-400">{seasonalPatterns.worstQuarter}</p>
                  </div>
                  <div className="p-4 bg-cscx-gray-800/50 rounded-lg">
                    <p className="text-cscx-gray-400 text-sm">Seasonal Variance</p>
                    <p className="text-xl font-bold text-white">
                      {seasonalPatterns.seasonalVariance.toFixed(1)}{comparison.unit}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Segments Tab */}
          {activeTab === 'segments' && (
            <div>
              <h4 className="text-md font-semibold text-white mb-4">Performance by Segment</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-cscx-gray-800">
                      <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Segment</th>
                      <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">This Year</th>
                      <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Last Year</th>
                      <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Change</th>
                      <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Customers</th>
                      <th className="text-center px-4 py-3 text-cscx-gray-400 font-medium">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cscx-gray-800">
                    {bySegment.map((seg) => (
                      <tr key={seg.segment} className="hover:bg-cscx-gray-800/30">
                        <td className="px-4 py-3 text-white font-medium">{seg.segmentLabel}</td>
                        <td className="px-4 py-3 text-white text-right">
                          {formatValue(seg.thisYearValue, comparison.unit)}
                        </td>
                        <td className="px-4 py-3 text-cscx-gray-400 text-right">
                          {formatValue(seg.lastYearValue, comparison.unit)}
                        </td>
                        <td className={`px-4 py-3 text-right ${getTrendColor(seg.trend, positiveIsGood)}`}>
                          {formatChange(seg.change, comparison.unit)}
                        </td>
                        <td className="px-4 py-3 text-cscx-gray-400 text-right">{seg.customerCount}</td>
                        <td className="px-4 py-3 text-center">{getTrendIcon(seg.trend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cohorts Tab */}
          {activeTab === 'cohorts' && (
            <div>
              <h4 className="text-md font-semibold text-white mb-4">Performance by Cohort</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-cscx-gray-800">
                      <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Cohort</th>
                      <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">This Year</th>
                      <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Last Year</th>
                      <th className="text-right px-4 py-3 text-cscx-gray-400 font-medium">Change</th>
                      <th className="text-center px-4 py-3 text-cscx-gray-400 font-medium">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cscx-gray-800">
                    {byCohort.map((cohort) => (
                      <tr key={cohort.cohort} className="hover:bg-cscx-gray-800/30">
                        <td className="px-4 py-3 text-white font-medium">{cohort.cohortLabel}</td>
                        <td className="px-4 py-3 text-white text-right">
                          {formatValue(cohort.thisYearValue, comparison.unit)}
                        </td>
                        <td className="px-4 py-3 text-cscx-gray-400 text-right">
                          {formatValue(cohort.lastYearValue, comparison.unit)}
                        </td>
                        <td className={`px-4 py-3 text-right ${getTrendColor(cohort.trend, positiveIsGood)}`}>
                          {formatChange(cohort.change, comparison.unit)}
                        </td>
                        <td className="px-4 py-3 text-center">{getTrendIcon(cohort.trend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button className="px-4 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm hover:bg-cscx-gray-700 transition-colors">
          Export PDF
        </button>
        <button className="px-4 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm hover:bg-cscx-gray-700 transition-colors">
          Export Excel
        </button>
        <button className="px-4 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm hover:bg-cscx-gray-700 transition-colors">
          Schedule Monthly
        </button>
      </div>

      {/* Generated timestamp */}
      <p className="text-cscx-gray-600 text-xs text-right">
        Generated: {new Date(comparison.generatedAt).toLocaleString()}
      </p>
    </div>
  );
};

export default YoYComparison;
