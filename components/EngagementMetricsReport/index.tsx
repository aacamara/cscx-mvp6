/**
 * PRD-157: Engagement Metrics Report Component
 *
 * Comprehensive engagement analytics dashboard that tracks all customer touchpoints
 * and interactions, providing visibility into relationship depth, communication patterns,
 * and engagement health across the portfolio.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

type EngagementCategory = 'high' | 'healthy' | 'low' | 'at_risk';
type EngagementTrend = 'improving' | 'stable' | 'declining';

interface EngagementActivities {
  emails_sent: number;
  emails_received: number;
  meetings_held: number;
  meeting_minutes: number;
  calls_made: number;
  qbrs_completed: number;
}

interface EngagementQuality {
  response_rate: number;
  avg_response_time_hours: number;
  stakeholders_engaged: number;
  executive_touchpoints: number;
}

interface EngagementScore {
  engagement_score: number;
  category: EngagementCategory;
  trend: EngagementTrend;
  change_from_last_period: number;
}

interface LastContact {
  date: string;
  type: string;
  days_ago: number;
}

interface EngagementMetrics {
  customer_id: string;
  customer_name?: string;
  period: string;
  activities: EngagementActivities;
  quality: EngagementQuality;
  score: EngagementScore;
  last_contact: LastContact;
}

interface PortfolioSummary {
  avg_score: number;
  score_change: number;
  high_engaged_count: number;
  healthy_count: number;
  low_count: number;
  at_risk_count: number;
  total_customers: number;
  distribution: {
    high: { count: number; percent: number };
    healthy: { count: number; percent: number };
    low: { count: number; percent: number };
    at_risk: { count: number; percent: number };
  };
}

interface TrendPoint {
  period: string;
  score: number;
  activities_count: number;
  emails_sent: number;
  meetings_held: number;
}

interface Correlation {
  metric: string;
  correlation: number;
  sample_size: number;
  insight: string;
}

interface EngagementActivity {
  id: string;
  customer_id: string;
  type: string;
  direction: string;
  date: string;
  duration_minutes?: number;
  participants: string[];
  stakeholder_level?: string;
  response_received?: boolean;
  source: string;
  subject?: string;
}

interface StakeholderCoverage {
  name: string;
  role: string;
  last_contact_date: string;
  engagement_level: 'high' | 'medium' | 'low';
  touchpoints_this_period: number;
}

// ============================================
// API Constants
// ============================================

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// Component Props
// ============================================

interface EngagementMetricsReportProps {
  customerId?: string; // If provided, show customer detail view
  onSelectCustomer?: (customerId: string) => void;
  onBack?: () => void;
}

// ============================================
// Main Component
// ============================================

export const EngagementMetricsReport: React.FC<EngagementMetricsReportProps> = ({
  customerId,
  onSelectCustomer,
  onBack,
}) => {
  const { getAuthHeaders } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('quarter');

  // Portfolio view state
  const [portfolioData, setPortfolioData] = useState<{
    customers: EngagementMetrics[];
    summary: PortfolioSummary;
  } | null>(null);

  // Customer detail view state
  const [customerMetrics, setCustomerMetrics] = useState<EngagementMetrics | null>(null);
  const [customerTrends, setCustomerTrends] = useState<TrendPoint[]>([]);
  const [customerActivities, setCustomerActivities] = useState<EngagementActivity[]>([]);
  const [stakeholderCoverage, setStakeholderCoverage] = useState<StakeholderCoverage[]>([]);

  // Correlation state
  const [correlations, setCorrelations] = useState<Correlation[]>([]);

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<EngagementCategory | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  // ============================================
  // Data Fetching
  // ============================================

  const fetchPortfolioData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/reports/engagement-metrics?period=${period}`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) throw new Error('Failed to fetch engagement metrics');

      const result = await response.json();
      setPortfolioData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load engagement data');
    } finally {
      setLoading(false);
    }
  }, [period, getAuthHeaders]);

  const fetchCustomerDetail = useCallback(async (custId: string) => {
    setLoading(true);
    setError(null);

    try {
      // Fetch metrics, trends, and activities in parallel
      const [metricsRes, trendsRes, activitiesRes] = await Promise.all([
        fetch(`${API_BASE}/reports/engagement-metrics/${custId}?period=${period}`, {
          headers: getAuthHeaders(),
        }),
        fetch(`${API_BASE}/reports/engagement-metrics/${custId}/trends?periods=6`, {
          headers: getAuthHeaders(),
        }),
        fetch(`${API_BASE}/reports/engagement-metrics/${custId}/activities`, {
          headers: getAuthHeaders(),
        }),
      ]);

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setCustomerMetrics(metricsData.data);
      }

      if (trendsRes.ok) {
        const trendsData = await trendsRes.json();
        setCustomerTrends(trendsData.data || []);
      }

      if (activitiesRes.ok) {
        const activitiesData = await activitiesRes.json();
        setCustomerActivities(activitiesData.data || []);
      }

      // Mock stakeholder coverage (would come from API)
      setStakeholderCoverage([
        { name: 'Sarah Chen', role: 'VP Operations', last_contact_date: '2026-01-15', engagement_level: 'high', touchpoints_this_period: 8 },
        { name: 'Mike Johnson', role: 'Champion', last_contact_date: '2026-01-22', engagement_level: 'high', touchpoints_this_period: 12 },
        { name: 'Lisa Wang', role: 'User', last_contact_date: '2026-01-08', engagement_level: 'medium', touchpoints_this_period: 4 },
        { name: 'Tom Davis', role: 'User', last_contact_date: '2025-12-15', engagement_level: 'low', touchpoints_this_period: 1 },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer engagement data');
    } finally {
      setLoading(false);
    }
  }, [period, getAuthHeaders]);

  const fetchCorrelations = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE}/reports/engagement-metrics/correlation/health`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const result = await response.json();
        setCorrelations(result.data || []);
      }
    } catch {
      // Non-critical, silently fail
    }
  }, [getAuthHeaders]);

  // ============================================
  // Effects
  // ============================================

  useEffect(() => {
    if (customerId) {
      fetchCustomerDetail(customerId);
    } else {
      fetchPortfolioData();
      fetchCorrelations();
    }
  }, [customerId, fetchPortfolioData, fetchCustomerDetail, fetchCorrelations]);

  // ============================================
  // Helpers
  // ============================================

  const getCategoryColor = (category: EngagementCategory): string => {
    switch (category) {
      case 'high': return 'text-green-400';
      case 'healthy': return 'text-blue-400';
      case 'low': return 'text-yellow-400';
      case 'at_risk': return 'text-red-400';
    }
  };

  const getCategoryBg = (category: EngagementCategory): string => {
    switch (category) {
      case 'high': return 'bg-green-500/20 border-green-500/30';
      case 'healthy': return 'bg-blue-500/20 border-blue-500/30';
      case 'low': return 'bg-yellow-500/20 border-yellow-500/30';
      case 'at_risk': return 'bg-red-500/20 border-red-500/30';
    }
  };

  const getTrendIcon = (trend: EngagementTrend): string => {
    switch (trend) {
      case 'improving': return '\u2191';
      case 'declining': return '\u2193';
      case 'stable': return '\u2194';
    }
  };

  const getTrendColor = (trend: EngagementTrend): string => {
    switch (trend) {
      case 'improving': return 'text-green-400';
      case 'declining': return 'text-red-400';
      case 'stable': return 'text-gray-400';
    }
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatActivityType = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // ============================================
  // Filter Logic
  // ============================================

  const filteredCustomers = portfolioData?.customers.filter(customer => {
    // Category filter
    if (categoryFilter && customer.score.category !== categoryFilter) {
      return false;
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return customer.customer_name?.toLowerCase().includes(search);
    }

    return true;
  }) || [];

  // ============================================
  // Render: Loading/Error States
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-cscx-accent border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
        {error}
        <button
          onClick={() => customerId ? fetchCustomerDetail(customerId) : fetchPortfolioData()}
          className="ml-4 text-sm underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // ============================================
  // Render: Customer Detail View
  // ============================================

  if (customerId && customerMetrics) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={onBack}
              className="text-sm text-cscx-gray-400 hover:text-white mb-2"
            >
              &larr; Back to Portfolio
            </button>
            <h2 className="text-2xl font-bold text-white">
              Engagement: {customerMetrics.customer_name}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as 'month' | 'quarter' | 'year')}
              className="px-3 py-2 bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg text-white text-sm"
            >
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          </div>
        </div>

        {/* Engagement Score Banner */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-cscx-gray-400 uppercase tracking-wider">Engagement Score</p>
              <div className="flex items-baseline gap-3 mt-1">
                <span className={`text-4xl font-bold ${getCategoryColor(customerMetrics.score.category)}`}>
                  {customerMetrics.score.engagement_score}
                </span>
                <span className="text-cscx-gray-400">/100</span>
                <span className={`px-2 py-1 text-xs rounded-full border ${getCategoryBg(customerMetrics.score.category)}`}>
                  {customerMetrics.score.category.replace('_', ' ')}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-cscx-gray-400">Trend</p>
              <p className={`text-2xl font-medium ${getTrendColor(customerMetrics.score.trend)}`}>
                {getTrendIcon(customerMetrics.score.trend)} {customerMetrics.score.change_from_last_period > 0 ? '+' : ''}
                {customerMetrics.score.change_from_last_period}
              </p>
            </div>
          </div>
        </div>

        {/* Activity Breakdown */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Activity Breakdown ({customerMetrics.period})</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center p-3 bg-cscx-gray-800/50 rounded-lg">
              <p className="text-2xl font-bold text-white">{customerMetrics.activities.emails_sent}</p>
              <p className="text-xs text-cscx-gray-400">Emails Sent</p>
            </div>
            <div className="text-center p-3 bg-cscx-gray-800/50 rounded-lg">
              <p className="text-2xl font-bold text-white">{customerMetrics.activities.emails_received}</p>
              <p className="text-xs text-cscx-gray-400">Emails Received</p>
            </div>
            <div className="text-center p-3 bg-cscx-gray-800/50 rounded-lg">
              <p className="text-2xl font-bold text-white">{Math.round(customerMetrics.quality.response_rate * 100)}%</p>
              <p className="text-xs text-cscx-gray-400">Response Rate</p>
            </div>
            <div className="text-center p-3 bg-cscx-gray-800/50 rounded-lg">
              <p className="text-2xl font-bold text-white">{customerMetrics.activities.meetings_held}</p>
              <p className="text-xs text-cscx-gray-400">Meetings Held</p>
            </div>
            <div className="text-center p-3 bg-cscx-gray-800/50 rounded-lg">
              <p className="text-2xl font-bold text-white">{(customerMetrics.activities.meeting_minutes / 60).toFixed(1)}h</p>
              <p className="text-xs text-cscx-gray-400">Meeting Time</p>
            </div>
            <div className="text-center p-3 bg-cscx-gray-800/50 rounded-lg">
              <p className="text-2xl font-bold text-white">{customerMetrics.activities.qbrs_completed}</p>
              <p className="text-xs text-cscx-gray-400">QBRs</p>
            </div>
          </div>
        </div>

        {/* Stakeholder Coverage */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Stakeholder Coverage</h3>
          <div className="space-y-3">
            {stakeholderCoverage.map((stakeholder, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-cscx-gray-800/30 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-cscx-accent/20 flex items-center justify-center text-cscx-accent font-medium">
                    {stakeholder.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-white font-medium">{stakeholder.name}</p>
                    <p className="text-xs text-cscx-gray-400">{stakeholder.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-white">{stakeholder.touchpoints_this_period} touchpoints</p>
                    <p className="text-xs text-cscx-gray-400">Last: {formatDate(stakeholder.last_contact_date)}</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${
                    stakeholder.engagement_level === 'high' ? 'bg-green-500' :
                    stakeholder.engagement_level === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Engagement Trend Chart */}
        {customerTrends.length > 0 && (
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Engagement Trend (6 Months)</h3>
            <div className="h-48 flex items-end justify-between gap-2">
              {customerTrends.map((point, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-cscx-accent/60 rounded-t"
                    style={{ height: `${point.score}%` }}
                  />
                  <p className="text-xs text-cscx-gray-400 mt-2">{point.period}</p>
                  <p className="text-xs text-white">{point.score}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activities */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Activities</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {customerActivities.slice(0, 15).map((activity) => (
              <div key={activity.id} className="flex items-center gap-4 p-3 bg-cscx-gray-800/30 rounded-lg">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  activity.type === 'email' ? 'bg-blue-500/20 text-blue-400' :
                  activity.type === 'meeting' ? 'bg-green-500/20 text-green-400' :
                  activity.type === 'call' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {activity.type === 'email' ? '\u2709' :
                   activity.type === 'meeting' ? '\u{1F4C5}' :
                   activity.type === 'call' ? '\u{1F4DE}' : '\u2605'}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-white">{activity.subject || formatActivityType(activity.type)}</p>
                  <p className="text-xs text-cscx-gray-400">
                    {formatActivityType(activity.type)} - {activity.direction}
                    {activity.duration_minutes && ` - ${activity.duration_minutes} min`}
                  </p>
                </div>
                <p className="text-xs text-cscx-gray-500">{formatDate(activity.date)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // Render: Portfolio View
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Engagement Metrics Report</h2>
          <p className="text-sm text-cscx-gray-400">Track customer touchpoints and relationship health</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as 'month' | 'quarter' | 'year')}
          className="px-4 py-2 bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg text-white"
        >
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
        </select>
      </div>

      {/* Portfolio Summary Cards */}
      {portfolioData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-5">
            <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Avg Engagement</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-bold text-white">{portfolioData.summary.avg_score}</span>
              <span className="text-cscx-gray-400">/100</span>
            </div>
            <p className={`text-sm mt-1 ${portfolioData.summary.score_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {portfolioData.summary.score_change >= 0 ? '+' : ''}{portfolioData.summary.score_change} vs last period
            </p>
          </div>

          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-5">
            <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Highly Engaged</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-bold text-green-400">{portfolioData.summary.high_engaged_count}</span>
            </div>
            <p className="text-sm text-cscx-gray-400 mt-1">
              {portfolioData.summary.distribution.high.percent}% of portfolio
            </p>
          </div>

          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-5">
            <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">At Risk</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-bold text-red-400">{portfolioData.summary.at_risk_count}</span>
            </div>
            <p className="text-sm text-cscx-gray-400 mt-1">Need attention</p>
          </div>

          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-5">
            <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Total Customers</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-bold text-white">{portfolioData.summary.total_customers}</span>
            </div>
            <p className="text-sm text-cscx-gray-400 mt-1">In portfolio</p>
          </div>
        </div>
      )}

      {/* Engagement Distribution */}
      {portfolioData && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Engagement Distribution</h3>
          <div className="space-y-3">
            {[
              { key: 'high' as const, label: 'High (80+)', color: 'bg-green-500' },
              { key: 'healthy' as const, label: 'Healthy (60-79)', color: 'bg-blue-500' },
              { key: 'low' as const, label: 'Low (40-59)', color: 'bg-yellow-500' },
              { key: 'at_risk' as const, label: 'At Risk (<40)', color: 'bg-red-500' },
            ].map(({ key, label, color }) => (
              <div key={key} className="flex items-center gap-4">
                <div className="w-28 text-sm text-cscx-gray-300">{label}</div>
                <div className="flex-1 h-6 bg-cscx-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${color} transition-all duration-500`}
                    style={{ width: `${portfolioData.summary.distribution[key].percent}%` }}
                  />
                </div>
                <div className="w-20 text-right">
                  <span className="text-white font-medium">{portfolioData.summary.distribution[key].count}</span>
                  <span className="text-cscx-gray-400 text-sm ml-1">({portfolioData.summary.distribution[key].percent}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Correlations Insights */}
      {correlations.length > 0 && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Engagement Insights</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {correlations.map((corr, idx) => (
              <div key={idx} className="p-4 bg-cscx-gray-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-white">{corr.metric}</p>
                  <span className={`text-sm font-bold ${
                    corr.correlation > 0.6 ? 'text-green-400' :
                    corr.correlation > 0.4 ? 'text-yellow-400' : 'text-cscx-gray-400'
                  }`}>
                    {corr.correlation > 0 ? '+' : ''}{(corr.correlation * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-cscx-gray-400">{corr.insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2.5 pl-10 bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
          />
          <svg className="absolute left-3 top-3 w-4 h-4 text-cscx-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as EngagementCategory | '')}
          className="px-4 py-2.5 bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg text-white focus:outline-none focus:border-cscx-accent"
        >
          <option value="">All Categories</option>
          <option value="high">High Engaged</option>
          <option value="healthy">Healthy</option>
          <option value="low">Low Engaged</option>
          <option value="at_risk">At Risk</option>
        </select>
      </div>

      {/* Customer Table */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cscx-gray-800/50 border-b border-cscx-gray-800">
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Customer</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Score</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Category</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Trend</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Emails</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Meetings</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Response Rate</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Last Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cscx-gray-800">
              {filteredCustomers.map((customer) => (
                <tr
                  key={customer.customer_id}
                  className="hover:bg-cscx-gray-800/30 transition-colors cursor-pointer"
                  onClick={() => onSelectCustomer?.(customer.customer_id)}
                >
                  <td className="px-4 py-3 text-white font-medium">
                    {customer.customer_name || 'Unknown'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-lg font-bold ${getCategoryColor(customer.score.category)}`}>
                      {customer.score.engagement_score}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full border ${getCategoryBg(customer.score.category)}`}>
                      {customer.score.category.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`${getTrendColor(customer.score.trend)}`}>
                      {getTrendIcon(customer.score.trend)} {customer.score.change_from_last_period > 0 ? '+' : ''}
                      {customer.score.change_from_last_period}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-cscx-gray-300">
                    {customer.activities.emails_sent}/{customer.activities.emails_received}
                  </td>
                  <td className="px-4 py-3 text-cscx-gray-300">
                    {customer.activities.meetings_held}
                  </td>
                  <td className="px-4 py-3 text-cscx-gray-300">
                    {Math.round(customer.quality.response_rate * 100)}%
                  </td>
                  <td className="px-4 py-3 text-cscx-gray-300">
                    {customer.last_contact.days_ago === 999 ? 'Never' : `${customer.last_contact.days_ago}d ago`}
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-cscx-gray-400">
                    No customers match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EngagementMetricsReport;
