/**
 * Engagement Metrics Report Component
 * PRD-157: Comprehensive engagement analytics dashboard
 *
 * Features:
 * - Portfolio engagement overview with distribution
 * - Customer-level engagement detail view
 * - Activity breakdown and trends
 * - Stakeholder coverage visualization
 * - Correlation insights
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  EngagementMetrics,
  PortfolioEngagementSummary,
  EngagementTrendPoint,
  EngagementActivity,
  EngagementCategory,
} from '../../types';

interface EngagementMetricsReportProps {
  customerId?: string;
  onSelectCustomer?: (customerId: string, customerName?: string) => void;
  onBack?: () => void;
}

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/reports/engagement-metrics`;

export const EngagementMetricsReport: React.FC<EngagementMetricsReportProps> = ({
  customerId,
  onSelectCustomer,
  onBack,
}) => {
  const { getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('quarter');

  // Portfolio view state
  const [portfolioData, setPortfolioData] = useState<{
    customers: EngagementMetrics[];
    summary: PortfolioEngagementSummary;
  } | null>(null);

  // Customer detail view state
  const [customerMetrics, setCustomerMetrics] = useState<EngagementMetrics | null>(null);
  const [customerTrends, setCustomerTrends] = useState<EngagementTrendPoint[]>([]);
  const [customerActivities, setCustomerActivities] = useState<EngagementActivity[]>([]);

  // Fetch portfolio data
  const fetchPortfolioData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}?period=${period}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch engagement metrics');
      }

      const result = await response.json();
      if (result.success) {
        setPortfolioData(result.data);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load engagement metrics');
    } finally {
      setLoading(false);
    }
  }, [period, getAuthHeaders]);

  // Fetch customer detail data
  const fetchCustomerData = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      // Fetch metrics, trends, and activities in parallel
      const [metricsRes, trendsRes, activitiesRes] = await Promise.all([
        fetch(`${API_BASE}/${id}?period=${period}`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/${id}/trends?periods=6`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/${id}/activities`, { headers: getAuthHeaders() }),
      ]);

      if (!metricsRes.ok || !trendsRes.ok || !activitiesRes.ok) {
        throw new Error('Failed to fetch customer engagement data');
      }

      const [metricsResult, trendsResult, activitiesResult] = await Promise.all([
        metricsRes.json(),
        trendsRes.json(),
        activitiesRes.json(),
      ]);

      if (metricsResult.success) {
        setCustomerMetrics(metricsResult.data);
      }
      if (trendsResult.success) {
        setCustomerTrends(trendsResult.data);
      }
      if (activitiesResult.success) {
        setCustomerActivities(activitiesResult.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer engagement data');
    } finally {
      setLoading(false);
    }
  }, [period, getAuthHeaders]);

  // Effect to fetch data based on view
  useEffect(() => {
    if (customerId) {
      fetchCustomerData(customerId);
    } else {
      fetchPortfolioData();
    }
  }, [customerId, fetchPortfolioData, fetchCustomerData]);

  // Helper functions
  const getCategoryColor = (category: EngagementCategory) => {
    switch (category) {
      case 'high':
        return 'text-green-400';
      case 'healthy':
        return 'text-blue-400';
      case 'low':
        return 'text-yellow-400';
      case 'at_risk':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getCategoryBg = (category: EngagementCategory) => {
    switch (category) {
      case 'high':
        return 'bg-green-500/20 border-green-500/30';
      case 'healthy':
        return 'bg-blue-500/20 border-blue-500/30';
      case 'low':
        return 'bg-yellow-500/20 border-yellow-500/30';
      case 'at_risk':
        return 'bg-red-500/20 border-red-500/30';
      default:
        return 'bg-gray-500/20 border-gray-500/30';
    }
  };

  const getTrendIcon = (trend: 'improving' | 'stable' | 'declining') => {
    switch (trend) {
      case 'improving':
        return <span className="text-green-400">&#8593;</span>;
      case 'declining':
        return <span className="text-red-400">&#8595;</span>;
      default:
        return <span className="text-gray-400">&#8594;</span>;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
        <p className="text-cscx-gray-400">Loading engagement metrics...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-8 text-center text-red-400">
        <p>{error}</p>
        <button
          onClick={() => customerId ? fetchCustomerData(customerId) : fetchPortfolioData()}
          className="mt-4 text-sm text-cscx-accent hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // Customer Detail View
  if (customerId && customerMetrics) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <button
              onClick={onBack}
              className="text-cscx-gray-400 hover:text-white text-sm mb-2 flex items-center gap-1"
            >
              &#8592; Back to Portfolio
            </button>
            <h2 className="text-xl font-bold text-white">
              Engagement: {customerMetrics.customer_name || 'Customer'}
            </h2>
          </div>
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

        {/* Score Card */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-cscx-gray-400 text-sm">Engagement Score</p>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-4xl font-bold ${getCategoryColor(customerMetrics.score.category)}`}>
                  {customerMetrics.score.engagement_score}
                </span>
                <span className="text-2xl text-cscx-gray-500">/100</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getCategoryBg(customerMetrics.score.category)}`}>
                  {customerMetrics.score.category.replace('_', ' ')}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2">
                {getTrendIcon(customerMetrics.score.trend)}
                <span className={`text-lg font-medium ${
                  customerMetrics.score.change_from_last_period > 0 ? 'text-green-400' :
                  customerMetrics.score.change_from_last_period < 0 ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {customerMetrics.score.change_from_last_period > 0 ? '+' : ''}
                  {customerMetrics.score.change_from_last_period} pts
                </span>
              </div>
              <p className="text-cscx-gray-500 text-sm">vs last period</p>
            </div>
          </div>
        </div>

        {/* Activity Breakdown */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Activity Breakdown ({period})</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 bg-cscx-gray-800/50 rounded-lg">
              <p className="text-cscx-gray-400 text-sm">Emails Sent</p>
              <p className="text-2xl font-bold text-white">{customerMetrics.activities.emails_sent}</p>
            </div>
            <div className="p-4 bg-cscx-gray-800/50 rounded-lg">
              <p className="text-cscx-gray-400 text-sm">Emails Received</p>
              <p className="text-2xl font-bold text-white">{customerMetrics.activities.emails_received}</p>
            </div>
            <div className="p-4 bg-cscx-gray-800/50 rounded-lg">
              <p className="text-cscx-gray-400 text-sm">Response Rate</p>
              <p className="text-2xl font-bold text-white">{Math.round(customerMetrics.quality.response_rate * 100)}%</p>
            </div>
            <div className="p-4 bg-cscx-gray-800/50 rounded-lg">
              <p className="text-cscx-gray-400 text-sm">Meetings Held</p>
              <p className="text-2xl font-bold text-white">{customerMetrics.activities.meetings_held}</p>
            </div>
            <div className="p-4 bg-cscx-gray-800/50 rounded-lg">
              <p className="text-cscx-gray-400 text-sm">Meeting Time</p>
              <p className="text-2xl font-bold text-white">{formatDuration(customerMetrics.activities.meeting_minutes)}</p>
            </div>
            <div className="p-4 bg-cscx-gray-800/50 rounded-lg">
              <p className="text-cscx-gray-400 text-sm">QBRs</p>
              <p className="text-2xl font-bold text-white">{customerMetrics.activities.qbrs_completed}</p>
            </div>
          </div>
        </div>

        {/* Stakeholder Coverage */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Stakeholder Coverage</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-cscx-gray-800/50 rounded-lg">
              <p className="text-cscx-gray-400 text-sm">Stakeholders Engaged</p>
              <p className="text-2xl font-bold text-white">{customerMetrics.quality.stakeholders_engaged}</p>
            </div>
            <div className="p-4 bg-cscx-gray-800/50 rounded-lg">
              <p className="text-cscx-gray-400 text-sm">Executive Touchpoints</p>
              <p className="text-2xl font-bold text-white">{customerMetrics.quality.executive_touchpoints}</p>
            </div>
          </div>
        </div>

        {/* Engagement Trend */}
        {customerTrends.length > 0 && (
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Engagement Trend (6 Months)</h3>
            <div className="h-32 flex items-end gap-2">
              {customerTrends.map((point, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-cscx-accent/60 rounded-t transition-all hover:bg-cscx-accent"
                    style={{ height: `${point.score}%` }}
                    title={`Score: ${point.score}`}
                  />
                  <p className="text-xs text-cscx-gray-500 mt-2">{point.period}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activities */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Activities</h3>
          {customerActivities.length === 0 ? (
            <p className="text-cscx-gray-400 text-center py-4">No recent activities</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {customerActivities.slice(0, 10).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-4 p-3 bg-cscx-gray-800/30 rounded-lg"
                >
                  <div className="w-10 h-10 bg-cscx-gray-800 rounded-full flex items-center justify-center text-lg">
                    {activity.type === 'email' && '📧'}
                    {activity.type === 'meeting' && '📅'}
                    {activity.type === 'call' && '📞'}
                    {activity.type === 'qbr' && '📊'}
                    {activity.type === 'message' && '💬'}
                    {activity.type === 'event' && '🎉'}
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm">
                      {activity.subject || `${activity.type} - ${activity.direction}`}
                    </p>
                    <p className="text-cscx-gray-500 text-xs">
                      {formatDate(activity.date)}
                      {activity.duration_minutes && ` - ${formatDuration(activity.duration_minutes)}`}
                    </p>
                  </div>
                  {activity.stakeholder_level && (
                    <span className="px-2 py-1 bg-cscx-gray-800 rounded text-xs text-cscx-gray-400">
                      {activity.stakeholder_level}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Last Contact */}
        {customerMetrics.last_contact.date && (
          <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Last Contact</h3>
            <p className="text-cscx-gray-300">
              {customerMetrics.last_contact.type} - {formatDate(customerMetrics.last_contact.date)}
              <span className={`ml-2 ${customerMetrics.last_contact.days_ago > 30 ? 'text-red-400' : 'text-cscx-gray-500'}`}>
                ({customerMetrics.last_contact.days_ago} days ago)
              </span>
            </p>
          </div>
        )}
      </div>
    );
  }

  // Portfolio View
  if (!portfolioData) {
    return (
      <div className="p-8 text-center text-cscx-gray-400">
        No engagement data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white">Engagement Metrics Report</h2>
          <p className="text-cscx-gray-400 text-sm">Track customer engagement across your portfolio</p>
        </div>
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

      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Avg Score</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-bold text-white">{portfolioData.summary.avg_score}</span>
            <span className="text-cscx-gray-500">/100</span>
            {portfolioData.summary.score_change !== 0 && (
              <span className={`text-sm ${portfolioData.summary.score_change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {portfolioData.summary.score_change > 0 ? '+' : ''}{portfolioData.summary.score_change}
              </span>
            )}
          </div>
        </div>
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">High Engaged</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{portfolioData.summary.high_engaged_count}</p>
          <p className="text-xs text-cscx-gray-500">{portfolioData.summary.distribution.high.percent}% of portfolio</p>
        </div>
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">Healthy</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{portfolioData.summary.healthy_count}</p>
          <p className="text-xs text-cscx-gray-500">{portfolioData.summary.distribution.healthy.percent}% of portfolio</p>
        </div>
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
          <p className="text-xs text-cscx-gray-400 uppercase tracking-wider">At Risk</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{portfolioData.summary.at_risk_count}</p>
          <p className="text-xs text-cscx-gray-500">Need attention</p>
        </div>
      </div>

      {/* Engagement Distribution */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Engagement Distribution</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <span className="w-24 text-sm text-cscx-gray-400">High (80+)</span>
            <div className="flex-1 h-6 bg-cscx-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${portfolioData.summary.distribution.high.percent}%` }}
              />
            </div>
            <span className="w-20 text-sm text-cscx-gray-300 text-right">
              {portfolioData.summary.distribution.high.count} ({portfolioData.summary.distribution.high.percent}%)
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="w-24 text-sm text-cscx-gray-400">Healthy (60-79)</span>
            <div className="flex-1 h-6 bg-cscx-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${portfolioData.summary.distribution.healthy.percent}%` }}
              />
            </div>
            <span className="w-20 text-sm text-cscx-gray-300 text-right">
              {portfolioData.summary.distribution.healthy.count} ({portfolioData.summary.distribution.healthy.percent}%)
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="w-24 text-sm text-cscx-gray-400">Low (40-59)</span>
            <div className="flex-1 h-6 bg-cscx-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500 transition-all"
                style={{ width: `${portfolioData.summary.distribution.low.percent}%` }}
              />
            </div>
            <span className="w-20 text-sm text-cscx-gray-300 text-right">
              {portfolioData.summary.distribution.low.count} ({portfolioData.summary.distribution.low.percent}%)
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="w-24 text-sm text-cscx-gray-400">At Risk (&lt;40)</span>
            <div className="flex-1 h-6 bg-cscx-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all"
                style={{ width: `${portfolioData.summary.distribution.at_risk.percent}%` }}
              />
            </div>
            <span className="w-20 text-sm text-cscx-gray-300 text-right">
              {portfolioData.summary.distribution.at_risk.count} ({portfolioData.summary.distribution.at_risk.percent}%)
            </span>
          </div>
        </div>
      </div>

      {/* Customers Needing Attention */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Customers Needing Attention</h3>
        {portfolioData.customers.filter(c => c.score.category === 'at_risk' || c.score.category === 'low').length === 0 ? (
          <p className="text-cscx-gray-400 text-center py-4">All customers are well-engaged</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cscx-gray-800">
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Score</th>
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Last Contact</th>
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Issue</th>
                  <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cscx-gray-800">
                {portfolioData.customers
                  .filter(c => c.score.category === 'at_risk' || c.score.category === 'low')
                  .slice(0, 10)
                  .map((customer) => (
                    <tr
                      key={customer.customer_id}
                      className="hover:bg-cscx-gray-800/30 cursor-pointer transition-colors"
                      onClick={() => onSelectCustomer?.(customer.customer_id, customer.customer_name)}
                    >
                      <td className="px-4 py-3 text-white">{customer.customer_name || customer.customer_id}</td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${getCategoryColor(customer.score.category)}`}>
                          {customer.score.engagement_score}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-cscx-gray-300">
                        {customer.last_contact.days_ago > 0 ? `${customer.last_contact.days_ago} days ago` : 'Today'}
                      </td>
                      <td className="px-4 py-3 text-cscx-gray-400">
                        {customer.last_contact.days_ago > 30 && 'No recent contact'}
                        {customer.quality.response_rate < 0.3 && 'Low response rate'}
                        {customer.quality.executive_touchpoints === 0 && 'No exec touchpoint'}
                        {customer.last_contact.days_ago <= 30 &&
                          customer.quality.response_rate >= 0.3 &&
                          customer.quality.executive_touchpoints > 0 &&
                          'Low overall engagement'}
                      </td>
                      <td className="px-4 py-3">
                        {getTrendIcon(customer.score.trend)}
                        <span className="ml-1 text-cscx-gray-400">
                          {customer.score.change_from_last_period > 0 ? '+' : ''}
                          {customer.score.change_from_last_period}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* All Customers Table */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          All Customers ({portfolioData.summary.total_customers})
        </h3>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-cscx-gray-900">
              <tr className="border-b border-cscx-gray-800">
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Customer</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Score</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Category</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Emails</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Meetings</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Last Contact</th>
                <th className="text-left px-4 py-3 text-cscx-gray-400 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cscx-gray-800">
              {portfolioData.customers.map((customer) => (
                <tr
                  key={customer.customer_id}
                  className="hover:bg-cscx-gray-800/30 cursor-pointer transition-colors"
                  onClick={() => onSelectCustomer?.(customer.customer_id, customer.customer_name)}
                >
                  <td className="px-4 py-3 text-white">{customer.customer_name || customer.customer_id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            customer.score.engagement_score >= 80 ? 'bg-green-500' :
                            customer.score.engagement_score >= 60 ? 'bg-blue-500' :
                            customer.score.engagement_score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${customer.score.engagement_score}%` }}
                        />
                      </div>
                      <span className="font-medium text-white">{customer.score.engagement_score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getCategoryBg(customer.score.category)}`}>
                      {customer.score.category.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-cscx-gray-300">
                    {customer.activities.emails_sent}/{customer.activities.emails_received}
                  </td>
                  <td className="px-4 py-3 text-cscx-gray-300">{customer.activities.meetings_held}</td>
                  <td className="px-4 py-3 text-cscx-gray-300">
                    {customer.last_contact.days_ago > 0 ? `${customer.last_contact.days_ago}d ago` : 'Today'}
                  </td>
                  <td className="px-4 py-3">
                    {getTrendIcon(customer.score.trend)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EngagementMetricsReport;
