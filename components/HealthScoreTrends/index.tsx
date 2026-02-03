/**
 * Health Score Trend Analysis Dashboard
 *
 * PRD-060 (interpreted as Health Score Trend Analysis)
 * Combined with PRD-153 (Health Score Portfolio View) and PRD-170 (Trend Analysis Report)
 *
 * Features:
 * - Portfolio health overview with distribution
 * - Individual customer health trends with charts
 * - Anomaly detection and alerts
 * - Forecasting and predictions
 * - Period-over-period comparisons
 */

import React, { useState, useEffect, useCallback } from 'react';
import { HealthScoreChart } from './HealthScoreChart';
import { CustomerHealthCard } from './CustomerHealthCard';
import { TrendInsightCard } from './TrendInsightCard';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ===== Type Definitions =====

interface HealthScoreDataPoint {
  date: string;
  score: number;
  previousScore?: number;
  change: number;
  changePercent: number;
}

interface TrendDirection {
  direction: 'up' | 'down' | 'stable';
  strength: 'strong' | 'moderate' | 'weak';
  slope: number;
  description: string;
}

interface Forecast {
  nextPeriod: number;
  confidenceLow: number;
  confidenceHigh: number;
  methodology: string;
}

interface Anomaly {
  date: string;
  expected: number;
  actual: number;
  deviation: number;
  severity: 'info' | 'warning' | 'critical';
  description: string;
}

interface CustomerHealthTrend {
  customerId: string;
  customerName: string;
  currentScore: number;
  category: 'healthy' | 'warning' | 'critical';
  trend: TrendDirection;
  dataPoints: HealthScoreDataPoint[];
  forecast?: Forecast;
  anomalies: Anomaly[];
  lowestComponent?: string;
  arr?: number;
  renewalDate?: string;
  daysToRenewal?: number;
}

interface PortfolioHealthOverview {
  totalCustomers: number;
  totalArr: number;
  avgHealthScore: number;
  scoreChangeWoW: number;
  distribution: {
    healthy: { count: number; arr: number; percentage: number };
    warning: { count: number; arr: number; percentage: number };
    critical: { count: number; arr: number; percentage: number };
  };
  changes: {
    improved: number;
    declined: number;
    stable: number;
  };
  trendDirection: TrendDirection;
}

interface PortfolioTrendData {
  date: string;
  avgScore: number;
  healthyPct: number;
  warningPct: number;
  criticalPct: number;
  totalCustomers: number;
}

interface TrendInsight {
  type: 'improvement' | 'decline' | 'anomaly' | 'forecast' | 'risk';
  metric: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  customerId?: string;
  customerName?: string;
}

interface HealthScoreTrendAnalysis {
  overview: PortfolioHealthOverview;
  customers: CustomerHealthTrend[];
  portfolioTrend: PortfolioTrendData[];
  alerts: {
    newCritical: CustomerHealthTrend[];
    steepDeclines: CustomerHealthTrend[];
    renewalsAtRisk: CustomerHealthTrend[];
  };
  insights: TrendInsight[];
  generatedAt: string;
}

interface HealthScoreTrendsProps {
  onSelectCustomer?: (customerId: string) => void;
}

// ===== Main Component =====

export const HealthScoreTrends: React.FC<HealthScoreTrendsProps> = ({
  onSelectCustomer
}) => {
  const [analysis, setAnalysis] = useState<HealthScoreTrendAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState(90);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerHealthTrend | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'alerts' | 'forecast'>('overview');
  const [healthFilter, setHealthFilter] = useState<'all' | 'healthy' | 'warning' | 'critical'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'trend' | 'arr'>('score');

  const fetchAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/health-trends/portfolio?days=${selectedDays}`);

      if (!response.ok) {
        throw new Error('Failed to fetch health score trends');
      }

      const data = await response.json();

      if (data.success) {
        setAnalysis(data.data);
      } else {
        throw new Error(data.error?.message || 'Unknown error');
      }
    } catch (err) {
      console.error('Error fetching health trends:', err);
      setError(err instanceof Error ? err.message : 'Failed to load health trends');
    } finally {
      setLoading(false);
    }
  }, [selectedDays]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Get color classes for health category
  const getCategoryColor = (category: 'healthy' | 'warning' | 'critical') => {
    switch (category) {
      case 'healthy':
        return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' };
      case 'warning':
        return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' };
      case 'critical':
        return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' };
    }
  };

  // Get trend icon
  const getTrendIcon = (direction: 'up' | 'down' | 'stable') => {
    switch (direction) {
      case 'up':
        return <span className="text-green-400">&#8593;</span>;
      case 'down':
        return <span className="text-red-400">&#8595;</span>;
      case 'stable':
        return <span className="text-gray-400">&#8594;</span>;
    }
  };

  // Filter and sort customers
  const getFilteredCustomers = () => {
    if (!analysis) return [];

    let filtered = [...analysis.customers];

    // Apply health filter
    if (healthFilter !== 'all') {
      filtered = filtered.filter(c => c.category === healthFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return a.currentScore - b.currentScore; // Worst first
        case 'trend':
          return a.trend.slope - b.trend.slope; // Most declining first
        case 'arr':
          return (b.arr || 0) - (a.arr || 0); // Highest ARR first
        default:
          return 0;
      }
    });

    return filtered;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full" />
        <span className="ml-3 text-cscx-gray-400">Loading health score trends...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400 mb-2">Failed to load health score trends</p>
        <p className="text-cscx-gray-500 text-sm mb-4">{error}</p>
        <button
          onClick={fetchAnalysis}
          className="px-4 py-2 bg-cscx-accent text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const filteredCustomers = getFilteredCustomers();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Health Score Trends</h2>
          <p className="text-cscx-gray-400 text-sm mt-1">
            Portfolio health analysis and trend insights
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Time Period Selector */}
          <select
            value={selectedDays}
            onChange={(e) => setSelectedDays(parseInt(e.target.value))}
            className="px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cscx-accent"
          >
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 6 months</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={fetchAnalysis}
            className="px-4 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm hover:bg-cscx-gray-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-cscx-gray-900 rounded-lg w-fit">
        {(['overview', 'customers', 'alerts', 'forecast'] as const).map((tab) => (
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
        <div className="space-y-6">
          {/* Portfolio Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Average Health Score */}
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-5">
              <p className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">Avg Health Score</p>
              <div className="flex items-baseline gap-2">
                <p className={`text-3xl font-bold ${
                  analysis.overview.avgHealthScore >= 70 ? 'text-green-400' :
                  analysis.overview.avgHealthScore >= 40 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {analysis.overview.avgHealthScore}
                </p>
                <div className={`flex items-center text-sm ${
                  analysis.overview.scoreChangeWoW > 0 ? 'text-green-400' :
                  analysis.overview.scoreChangeWoW < 0 ? 'text-red-400' : 'text-cscx-gray-400'
                }`}>
                  {analysis.overview.scoreChangeWoW > 0 ? '+' : ''}{analysis.overview.scoreChangeWoW}
                  <span className="text-xs text-cscx-gray-500 ml-1">WoW</span>
                </div>
              </div>
              <p className="text-xs text-cscx-gray-500 mt-2">{analysis.overview.trendDirection.description}</p>
            </div>

            {/* Total Customers */}
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-5">
              <p className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">Total Customers</p>
              <p className="text-3xl font-bold text-white">{analysis.overview.totalCustomers}</p>
              <div className="flex gap-2 mt-2">
                <span className="text-xs text-green-400">{analysis.overview.changes.improved} improved</span>
                <span className="text-xs text-cscx-gray-500">|</span>
                <span className="text-xs text-red-400">{analysis.overview.changes.declined} declined</span>
              </div>
            </div>

            {/* Total ARR */}
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-5">
              <p className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">Total ARR</p>
              <p className="text-3xl font-bold text-cscx-accent">{formatCurrency(analysis.overview.totalArr)}</p>
              <p className="text-xs text-cscx-gray-500 mt-2">
                {formatCurrency(analysis.overview.distribution.critical.arr)} at risk
              </p>
            </div>

            {/* At Risk Count */}
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-5">
              <p className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">Needs Attention</p>
              <p className="text-3xl font-bold text-red-400">
                {analysis.overview.distribution.critical.count + analysis.overview.distribution.warning.count}
              </p>
              <p className="text-xs text-cscx-gray-500 mt-2">
                {analysis.overview.distribution.critical.count} critical, {analysis.overview.distribution.warning.count} warning
              </p>
            </div>
          </div>

          {/* Health Distribution */}
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Health Distribution</h3>
            <div className="flex gap-4">
              {/* Healthy */}
              <div className="flex-1 text-center">
                <div className="w-16 h-16 mx-auto bg-green-500/20 border-2 border-green-500/40 rounded-full flex items-center justify-center mb-2">
                  <span className="text-2xl font-bold text-green-400">{analysis.overview.distribution.healthy.count}</span>
                </div>
                <p className="text-sm text-white font-medium">Healthy</p>
                <p className="text-xs text-cscx-gray-400">{analysis.overview.distribution.healthy.percentage}%</p>
                <p className="text-xs text-cscx-gray-500 mt-1">{formatCurrency(analysis.overview.distribution.healthy.arr)}</p>
              </div>

              {/* Warning */}
              <div className="flex-1 text-center">
                <div className="w-16 h-16 mx-auto bg-yellow-500/20 border-2 border-yellow-500/40 rounded-full flex items-center justify-center mb-2">
                  <span className="text-2xl font-bold text-yellow-400">{analysis.overview.distribution.warning.count}</span>
                </div>
                <p className="text-sm text-white font-medium">Warning</p>
                <p className="text-xs text-cscx-gray-400">{analysis.overview.distribution.warning.percentage}%</p>
                <p className="text-xs text-cscx-gray-500 mt-1">{formatCurrency(analysis.overview.distribution.warning.arr)}</p>
              </div>

              {/* Critical */}
              <div className="flex-1 text-center">
                <div className="w-16 h-16 mx-auto bg-red-500/20 border-2 border-red-500/40 rounded-full flex items-center justify-center mb-2">
                  <span className="text-2xl font-bold text-red-400">{analysis.overview.distribution.critical.count}</span>
                </div>
                <p className="text-sm text-white font-medium">Critical</p>
                <p className="text-xs text-cscx-gray-400">{analysis.overview.distribution.critical.percentage}%</p>
                <p className="text-xs text-cscx-gray-500 mt-1">{formatCurrency(analysis.overview.distribution.critical.arr)}</p>
              </div>
            </div>

            {/* Distribution Bar */}
            <div className="mt-6">
              <div className="flex h-4 rounded-full overflow-hidden">
                <div
                  className="bg-green-500 transition-all"
                  style={{ width: `${analysis.overview.distribution.healthy.percentage}%` }}
                />
                <div
                  className="bg-yellow-500 transition-all"
                  style={{ width: `${analysis.overview.distribution.warning.percentage}%` }}
                />
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${analysis.overview.distribution.critical.percentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Portfolio Trend Chart */}
          {analysis.portfolioTrend.length > 0 && (
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Portfolio Health Trend</h3>
              <HealthScoreChart
                dataPoints={analysis.portfolioTrend.map(p => ({
                  date: p.date,
                  score: p.avgScore,
                  change: 0,
                  changePercent: 0
                }))}
                height={200}
              />
            </div>
          )}

          {/* Key Insights */}
          {analysis.insights.length > 0 && (
            <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Key Insights</h3>
              <div className="space-y-3">
                {analysis.insights.slice(0, 5).map((insight, index) => (
                  <TrendInsightCard
                    key={index}
                    insight={insight}
                    onClick={insight.customerId ? () => onSelectCustomer?.(insight.customerId!) : undefined}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Customers Tab */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value as any)}
              className="px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cscx-accent"
            >
              <option value="all">All Health Levels</option>
              <option value="healthy">Healthy Only</option>
              <option value="warning">Warning Only</option>
              <option value="critical">Critical Only</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cscx-accent"
            >
              <option value="score">Sort by Score</option>
              <option value="trend">Sort by Trend</option>
              <option value="arr">Sort by ARR</option>
            </select>

            <span className="text-sm text-cscx-gray-400">
              Showing {filteredCustomers.length} of {analysis.customers.length} customers
            </span>
          </div>

          {/* Customer Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredCustomers.map(customer => (
              <CustomerHealthCard
                key={customer.customerId}
                customer={customer}
                onClick={() => {
                  setSelectedCustomer(customer);
                  onSelectCustomer?.(customer.customerId);
                }}
              />
            ))}
          </div>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-cscx-gray-400">No customers match the selected filters</p>
            </div>
          )}
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          {/* New Critical */}
          {analysis.alerts.newCritical.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-red-400 mb-4">
                New Critical Accounts ({analysis.alerts.newCritical.length})
              </h3>
              <div className="space-y-3">
                {analysis.alerts.newCritical.map(customer => (
                  <div
                    key={customer.customerId}
                    className="flex items-center justify-between p-3 bg-cscx-gray-900/50 rounded-lg cursor-pointer hover:bg-cscx-gray-800/50 transition-colors"
                    onClick={() => onSelectCustomer?.(customer.customerId)}
                  >
                    <div>
                      <p className="text-white font-medium">{customer.customerName}</p>
                      <p className="text-sm text-cscx-gray-400">Dropped to critical status</p>
                    </div>
                    <div className="text-right">
                      <p className="text-red-400 font-bold">{customer.currentScore}</p>
                      <p className="text-xs text-cscx-gray-500">{customer.trend.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Steep Declines */}
          {analysis.alerts.steepDeclines.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-yellow-400 mb-4">
                Steep Declines ({analysis.alerts.steepDeclines.length})
              </h3>
              <div className="space-y-3">
                {analysis.alerts.steepDeclines.map(customer => (
                  <div
                    key={customer.customerId}
                    className="flex items-center justify-between p-3 bg-cscx-gray-900/50 rounded-lg cursor-pointer hover:bg-cscx-gray-800/50 transition-colors"
                    onClick={() => onSelectCustomer?.(customer.customerId)}
                  >
                    <div>
                      <p className="text-white font-medium">{customer.customerName}</p>
                      <p className="text-sm text-cscx-gray-400">
                        {customer.trend.slope < 0 ? 'Declining' : 'Declining'} {Math.abs(customer.trend.slope).toFixed(1)} points/week
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${getCategoryColor(customer.category).text}`}>{customer.currentScore}</p>
                      {customer.arr && <p className="text-xs text-cscx-gray-500">{formatCurrency(customer.arr)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Renewals at Risk */}
          {analysis.alerts.renewalsAtRisk.length > 0 && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-orange-400 mb-4">
                Renewals at Risk ({analysis.alerts.renewalsAtRisk.length})
              </h3>
              <div className="space-y-3">
                {analysis.alerts.renewalsAtRisk.map(customer => (
                  <div
                    key={customer.customerId}
                    className="flex items-center justify-between p-3 bg-cscx-gray-900/50 rounded-lg cursor-pointer hover:bg-cscx-gray-800/50 transition-colors"
                    onClick={() => onSelectCustomer?.(customer.customerId)}
                  >
                    <div>
                      <p className="text-white font-medium">{customer.customerName}</p>
                      <p className="text-sm text-cscx-gray-400">
                        Renewal in {customer.daysToRenewal} days
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${getCategoryColor(customer.category).text}`}>{customer.currentScore}</p>
                      <span className={`px-2 py-0.5 text-xs rounded ${getCategoryColor(customer.category).bg} ${getCategoryColor(customer.category).text}`}>
                        {customer.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Alerts */}
          {analysis.alerts.newCritical.length === 0 &&
           analysis.alerts.steepDeclines.length === 0 &&
           analysis.alerts.renewalsAtRisk.length === 0 && (
            <div className="text-center py-12 bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl">
              <p className="text-green-400 text-lg font-medium mb-2">No Critical Alerts</p>
              <p className="text-cscx-gray-400">Your portfolio is looking healthy</p>
            </div>
          )}
        </div>
      )}

      {/* Forecast Tab */}
      {activeTab === 'forecast' && (
        <div className="space-y-6">
          {/* Portfolio Forecast */}
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Portfolio Health Forecast</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-cscx-gray-800/50 rounded-lg">
                <p className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">Current</p>
                <p className={`text-3xl font-bold ${
                  analysis.overview.avgHealthScore >= 70 ? 'text-green-400' :
                  analysis.overview.avgHealthScore >= 40 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {analysis.overview.avgHealthScore}
                </p>
              </div>
              <div className="text-center p-4 bg-cscx-gray-800/50 rounded-lg">
                <p className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">Trend</p>
                <div className="flex items-center justify-center gap-2">
                  {getTrendIcon(analysis.overview.trendDirection.direction)}
                  <span className="text-xl font-medium text-white capitalize">
                    {analysis.overview.trendDirection.direction}
                  </span>
                </div>
                <p className="text-xs text-cscx-gray-500 mt-1">{analysis.overview.trendDirection.strength}</p>
              </div>
              <div className="text-center p-4 bg-cscx-gray-800/50 rounded-lg">
                <p className="text-xs text-cscx-gray-400 uppercase tracking-wider mb-1">Projected</p>
                <p className="text-3xl font-bold text-white">
                  {Math.round(analysis.overview.avgHealthScore + analysis.overview.trendDirection.slope * 4)}
                </p>
                <p className="text-xs text-cscx-gray-500 mt-1">in 4 weeks</p>
              </div>
            </div>
          </div>

          {/* Customer Forecasts */}
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Customer Forecasts</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-cscx-gray-400 uppercase tracking-wider border-b border-cscx-gray-800">
                    <th className="pb-3 pr-4">Customer</th>
                    <th className="pb-3 pr-4">Current</th>
                    <th className="pb-3 pr-4">Trend</th>
                    <th className="pb-3 pr-4">Forecast</th>
                    <th className="pb-3">Confidence</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {analysis.customers.slice(0, 10).map(customer => (
                    <tr
                      key={customer.customerId}
                      className="border-b border-cscx-gray-800/50 hover:bg-cscx-gray-800/30 cursor-pointer transition-colors"
                      onClick={() => onSelectCustomer?.(customer.customerId)}
                    >
                      <td className="py-3 pr-4">
                        <p className="text-white font-medium">{customer.customerName}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`font-bold ${getCategoryColor(customer.category).text}`}>
                          {customer.currentScore}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1">
                          {getTrendIcon(customer.trend.direction)}
                          <span className="text-cscx-gray-300">{customer.trend.slope > 0 ? '+' : ''}{customer.trend.slope.toFixed(1)}/wk</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        {customer.forecast ? (
                          <span className="text-white">{customer.forecast.nextPeriod}</span>
                        ) : (
                          <span className="text-cscx-gray-500">-</span>
                        )}
                      </td>
                      <td className="py-3">
                        {customer.forecast ? (
                          <span className="text-xs text-cscx-gray-400">
                            {customer.forecast.confidenceLow}-{customer.forecast.confidenceHigh}
                          </span>
                        ) : (
                          <span className="text-cscx-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedCustomer.customerName}</h3>
                  <span className={`px-2 py-1 text-xs rounded ${getCategoryColor(selectedCustomer.category).bg} ${getCategoryColor(selectedCustomer.category).text}`}>
                    {selectedCustomer.category}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-cscx-gray-400 hover:text-white"
                >
                  Close
                </button>
              </div>

              {/* Score Display */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-cscx-gray-800 rounded-lg">
                  <p className="text-xs text-cscx-gray-400 uppercase mb-1">Score</p>
                  <p className={`text-3xl font-bold ${getCategoryColor(selectedCustomer.category).text}`}>
                    {selectedCustomer.currentScore}
                  </p>
                </div>
                <div className="text-center p-4 bg-cscx-gray-800 rounded-lg">
                  <p className="text-xs text-cscx-gray-400 uppercase mb-1">Trend</p>
                  <div className="flex items-center justify-center gap-1">
                    {getTrendIcon(selectedCustomer.trend.direction)}
                    <span className="text-white">{selectedCustomer.trend.slope > 0 ? '+' : ''}{selectedCustomer.trend.slope}</span>
                  </div>
                </div>
                <div className="text-center p-4 bg-cscx-gray-800 rounded-lg">
                  <p className="text-xs text-cscx-gray-400 uppercase mb-1">ARR</p>
                  <p className="text-xl font-bold text-cscx-accent">
                    {selectedCustomer.arr ? formatCurrency(selectedCustomer.arr) : '-'}
                  </p>
                </div>
              </div>

              {/* Trend Chart */}
              {selectedCustomer.dataPoints.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-cscx-gray-400 uppercase mb-3">Health Score History</h4>
                  <HealthScoreChart
                    dataPoints={selectedCustomer.dataPoints}
                    height={150}
                  />
                </div>
              )}

              {/* Forecast */}
              {selectedCustomer.forecast && (
                <div className="mb-6 p-4 bg-cscx-gray-800 rounded-lg">
                  <h4 className="text-sm font-medium text-cscx-gray-400 uppercase mb-2">Forecast</h4>
                  <p className="text-white">
                    Projected score: <span className="font-bold">{selectedCustomer.forecast.nextPeriod}</span>
                    <span className="text-cscx-gray-400 text-sm ml-2">
                      (confidence: {selectedCustomer.forecast.confidenceLow}-{selectedCustomer.forecast.confidenceHigh})
                    </span>
                  </p>
                </div>
              )}

              {/* Anomalies */}
              {selectedCustomer.anomalies.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-cscx-gray-400 uppercase mb-3">Anomalies Detected</h4>
                  <div className="space-y-2">
                    {selectedCustomer.anomalies.map((anomaly, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg ${
                          anomaly.severity === 'critical' ? 'bg-red-500/10 border border-red-500/30' :
                          anomaly.severity === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/30' :
                          'bg-blue-500/10 border border-blue-500/30'
                        }`}
                      >
                        <p className={`text-sm font-medium ${
                          anomaly.severity === 'critical' ? 'text-red-400' :
                          anomaly.severity === 'warning' ? 'text-yellow-400' :
                          'text-blue-400'
                        }`}>
                          {anomaly.description}
                        </p>
                        <p className="text-xs text-cscx-gray-500 mt-1">
                          {anomaly.date} - Expected: {anomaly.expected}, Actual: {anomaly.actual}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    onSelectCustomer?.(selectedCustomer.customerId);
                    setSelectedCustomer(null);
                  }}
                  className="flex-1 px-4 py-2 bg-cscx-accent text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  View Customer Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthScoreTrends;
