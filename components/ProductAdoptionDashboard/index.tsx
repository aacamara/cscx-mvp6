/**
 * Product Adoption Dashboard (PRD-064)
 *
 * Comprehensive dashboard showing product adoption metrics for a customer account,
 * including feature utilization, user engagement, adoption trends, and peer comparisons.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ProductAdoptionDashboard as DashboardData,
  AdoptionPeriod,
  ComparisonType,
  FeatureAdoption,
  Recommendation,
  RecommendationActionType,
  PeerComparison,
  TrendData,
  UserMetrics
} from '../../types/productAdoption';

interface ProductAdoptionDashboardProps {
  customerId: string;
  customerName?: string;
  onClose?: () => void;
}

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

export const ProductAdoptionDashboard: React.FC<ProductAdoptionDashboardProps> = ({
  customerId,
  customerName,
  onClose
}) => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<AdoptionPeriod>('30d');
  const [comparison, setComparison] = useState<ComparisonType>('peers');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/intelligence/adoption/${customerId}?period=${period}&comparison=${comparison}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch adoption dashboard');
      }

      const result = await response.json();

      if (result.success && result.data) {
        setDashboard(result.data);
      } else {
        throw new Error(result.error?.message || 'Failed to load dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [customerId, period, comparison]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleAction = async (
    actionType: RecommendationActionType,
    recommendationId: string,
    featureId?: string
  ) => {
    setActionLoading(recommendationId);

    try {
      const response = await fetch(
        `${API_BASE}/intelligence/adoption/${customerId}/actions/${actionType}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ featureId })
        }
      );

      const result = await response.json();

      if (result.success) {
        setActionFeedback(result.data.message || 'Action initiated successfully');
        setTimeout(() => setActionFeedback(null), 3000);
      }
    } catch (err) {
      setActionFeedback('Failed to execute action');
      setTimeout(() => setActionFeedback(null), 3000);
    } finally {
      setActionLoading(null);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getTrendIcon = (value: number): string => {
    if (value > 0) return '\u25B2';
    if (value < 0) return '\u25BC';
    return '\u25CF';
  };

  const getTrendColor = (value: number): string => {
    if (value > 0) return 'text-green-400';
    if (value < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  const getComparisonIcon = (comparison: 'above' | 'average' | 'below'): string => {
    if (comparison === 'above') return '\u25B2';
    if (comparison === 'below') return '\u25BC';
    return '\u25CF';
  };

  const getComparisonColor = (comparison: 'above' | 'average' | 'below'): string => {
    if (comparison === 'above') return 'text-green-400';
    if (comparison === 'below') return 'text-red-400';
    return 'text-yellow-400';
  };

  const getHealthStatusColor = (status: 'healthy' | 'warning' | 'critical'): string => {
    if (status === 'healthy') return 'bg-green-500';
    if (status === 'warning') return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low'): string => {
    if (priority === 'high') return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (priority === 'medium') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-3 border-cscx-accent border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-cscx-gray-400">Loading adoption dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4">{error || 'Failed to load dashboard'}</p>
        <button
          onClick={fetchDashboard}
          className="text-cscx-accent hover:underline"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Feedback Toast */}
      {actionFeedback && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg shadow-lg animate-fade-in">
          <p className="text-white text-sm">{actionFeedback}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Product Adoption Dashboard
          </h2>
          <p className="text-cscx-gray-400 mt-1">
            {dashboard.customerName} | Period: Last {period === '7d' ? '7 days' : period === '30d' ? '30 days' : period === '90d' ? '90 days' : 'all time'} | Updated: {new Date(dashboard.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Period Selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as AdoptionPeriod)}
            className="px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cscx-accent"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>

          {/* Comparison Selector */}
          <select
            value={comparison}
            onChange={(e) => setComparison(e.target.value as ComparisonType)}
            className="px-3 py-2 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cscx-accent"
          >
            <option value="peers">vs Peers</option>
            <option value="segment">vs Segment</option>
            <option value="all_customers">vs All</option>
          </select>

          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Adoption Score Card */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-cscx-gray-400 uppercase tracking-wider mb-2">
              Adoption Score
            </h3>
            <div className="flex items-baseline gap-3">
              <span className={`text-5xl font-bold ${getScoreColor(dashboard.adoptionScore)}`}>
                {dashboard.adoptionScore}
              </span>
              <span className="text-2xl text-cscx-gray-500">/100</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                dashboard.adoptionCategory === 'excellent' ? 'bg-green-500/20 text-green-400' :
                dashboard.adoptionCategory === 'good' ? 'bg-yellow-500/20 text-yellow-400' :
                dashboard.adoptionCategory === 'fair' ? 'bg-orange-500/20 text-orange-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {dashboard.adoptionCategory.charAt(0).toUpperCase() + dashboard.adoptionCategory.slice(1)}
              </span>
            </div>
            <div className={`flex items-center gap-1 mt-2 ${getTrendColor(dashboard.adoptionScoreTrend)}`}>
              <span>{getTrendIcon(dashboard.adoptionScoreTrend)}</span>
              <span>{dashboard.adoptionScoreTrend > 0 ? '+' : ''}{dashboard.adoptionScoreTrend} from last period</span>
            </div>
          </div>

          {/* Gauge Visualization */}
          <div className="relative w-36 h-36">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r="60"
                fill="none"
                stroke="#222"
                strokeWidth="14"
              />
              <circle
                cx="72"
                cy="72"
                r="60"
                fill="none"
                stroke={dashboard.adoptionScore >= 80 ? '#22c55e' : dashboard.adoptionScore >= 60 ? '#eab308' : dashboard.adoptionScore >= 40 ? '#f97316' : '#ef4444'}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${(dashboard.adoptionScore / 100) * 377} 377`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-3xl font-bold ${getScoreColor(dashboard.adoptionScore)}`}>
                {dashboard.adoptionScore}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Entitlement Usage */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Adoption vs Entitlement</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-cscx-gray-400 text-sm">
                <th className="pb-3">Metric</th>
                <th className="pb-3 text-right">Used</th>
                <th className="pb-3 text-right">Entitled</th>
                <th className="pb-3 text-right">Utilization</th>
              </tr>
            </thead>
            <tbody className="text-white">
              {dashboard.entitlementUsage.map((item, index) => (
                <tr key={index} className="border-t border-cscx-gray-800">
                  <td className="py-3">{item.name}</td>
                  <td className="py-3 text-right">{item.used.toLocaleString()}</td>
                  <td className="py-3 text-right">
                    {item.entitled === -1 ? 'Unlimited' : item.entitled.toLocaleString()}
                  </td>
                  <td className="py-3 text-right">
                    {item.utilizationPercentage === -1 ? (
                      '-'
                    ) : (
                      <span className={getScoreColor(item.utilizationPercentage)}>
                        {item.utilizationPercentage}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Engagement */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">User Engagement</h3>

          {/* Active Users */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-cscx-gray-400 mb-3">Active Users</h4>
            <div className="grid grid-cols-4 gap-4">
              <UserMetricCard
                label="DAU"
                value={dashboard.userMetrics.dau}
                change={dashboard.userMetrics.trends.dauChange}
              />
              <UserMetricCard
                label="WAU"
                value={dashboard.userMetrics.wau}
                change={dashboard.userMetrics.trends.wauChange}
              />
              <UserMetricCard
                label="MAU"
                value={dashboard.userMetrics.mau}
                change={dashboard.userMetrics.trends.mauChange}
              />
              <UserMetricCard
                label="Power Users"
                value={dashboard.userMetrics.powerUsers}
                suffix={`(${Math.round(dashboard.userMetrics.powerUserPercentage)}%)`}
              />
            </div>
          </div>

          {/* User Health */}
          <div>
            <h4 className="text-sm font-medium text-cscx-gray-400 mb-3">User Health</h4>
            <div className="space-y-2">
              <UserHealthBar
                label="Active (7d)"
                count={dashboard.userMetrics.userHealthBreakdown.active}
                total={dashboard.userMetrics.mau}
                color="bg-green-500"
              />
              <UserHealthBar
                label="Engaged (8-14d)"
                count={dashboard.userMetrics.userHealthBreakdown.engaged}
                total={dashboard.userMetrics.mau}
                color="bg-blue-500"
              />
              <UserHealthBar
                label="At Risk (15-30d)"
                count={dashboard.userMetrics.userHealthBreakdown.atRisk}
                total={dashboard.userMetrics.mau}
                color="bg-yellow-500"
              />
              <UserHealthBar
                label="Dormant (>30d)"
                count={dashboard.userMetrics.userHealthBreakdown.dormant}
                total={dashboard.userMetrics.mau}
                color="bg-red-500"
              />
            </div>

            {dashboard.userMetrics.dormantUsers > 0 && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">
                  <span className="font-medium">Dormant Users Alert:</span> {dashboard.userMetrics.dormantUsers} users haven't logged in 30+ days
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Feature Adoption */}
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Feature Adoption</h3>

          {/* Feature Matrix */}
          <div className="space-y-2 mb-6">
            {dashboard.featureAdoption.map((feature) => (
              <FeatureRow key={feature.featureId} feature={feature} />
            ))}
          </div>

          {/* Feature Journey Funnel */}
          <div className="p-4 bg-cscx-gray-800 rounded-lg">
            <h4 className="text-sm font-medium text-cscx-gray-400 mb-3">Feature Adoption Journey</h4>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">
                  {Math.round((dashboard.featureAdoptionSummary.coreFeaturesAdopted / dashboard.featureAdoptionSummary.coreFeaturesTotal) * 100)}%
                </p>
                <p className="text-xs text-cscx-gray-400">Core</p>
              </div>
              <div className="text-cscx-gray-600">\u2192</div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-400">
                  {Math.round((dashboard.featureAdoptionSummary.advancedFeaturesAdopted / dashboard.featureAdoptionSummary.advancedFeaturesTotal) * 100)}%
                </p>
                <p className="text-xs text-cscx-gray-400">Advanced</p>
              </div>
              <div className="text-cscx-gray-600">\u2192</div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-400">
                  {Math.round((dashboard.featureAdoptionSummary.powerFeaturesAdopted / dashboard.featureAdoptionSummary.powerFeaturesTotal) * 100)}%
                </p>
                <p className="text-xs text-cscx-gray-400">Power</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Peer Comparison */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Peer Comparison ({comparison === 'peers' ? 'Similar Customers' : comparison === 'segment' ? 'Same Segment' : 'All Customers'})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-cscx-gray-400 text-sm">
                <th className="pb-3">Metric</th>
                <th className="pb-3 text-right">{dashboard.customerName}</th>
                <th className="pb-3 text-right">Peer Avg</th>
                <th className="pb-3 text-right">Percentile</th>
                <th className="pb-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="text-white">
              {dashboard.peerComparison.map((item, index) => (
                <tr key={index} className="border-t border-cscx-gray-800">
                  <td className="py-3">{item.metric}</td>
                  <td className="py-3 text-right font-medium">{item.customerValue}{item.metric.includes('%') || item.metric.includes('Rate') ? '%' : ''}</td>
                  <td className="py-3 text-right text-cscx-gray-400">{item.peerAverage}{item.metric.includes('%') || item.metric.includes('Rate') ? '%' : ''}</td>
                  <td className="py-3 text-right">{item.percentile}th</td>
                  <td className="py-3 text-right">
                    <span className={`inline-flex items-center gap-1 ${getComparisonColor(item.comparison)}`}>
                      {getComparisonIcon(item.comparison)}
                      <span className="capitalize">{item.comparison}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Insight */}
        <div className="mt-4 p-4 bg-cscx-gray-800 rounded-lg">
          <p className="text-sm text-cscx-gray-300">
            <span className="font-medium text-white">Insight:</span>{' '}
            {dashboard.peerComparison.find(p => p.comparison === 'above')
              ? `Above average on ${dashboard.peerComparison.filter(p => p.comparison === 'above').map(p => p.metric.toLowerCase()).join(', ')}.`
              : 'Performing at or below peer averages.'
            }{' '}
            {dashboard.peerComparison.find(p => p.comparison === 'below') && (
              <>Consider: Improving {dashboard.peerComparison.filter(p => p.comparison === 'below')[0]?.metric.toLowerCase()} to match peer benchmarks.</>
            )}
          </p>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Recommendations</h3>

        {/* Immediate Actions */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-cscx-gray-400 mb-3">Immediate Actions</h4>
          <div className="space-y-3">
            {dashboard.recommendations
              .filter(r => r.type === 'immediate')
              .map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onAction={(actionType) => handleAction(actionType, rec.id, rec.metric)}
                  loading={actionLoading === rec.id}
                />
              ))}
          </div>
        </div>

        {/* Value Demonstration */}
        <div>
          <h4 className="text-sm font-medium text-cscx-gray-400 mb-3">Value Demonstration</h4>
          <div className="p-4 bg-cscx-gray-800 rounded-lg">
            <ul className="space-y-2 text-sm text-cscx-gray-300">
              <li>Users saved estimated <span className="text-white font-medium">{dashboard.valueSummary.estimatedHoursSaved} hours/month</span> using current features</li>
              <li>Top benefit: <span className="text-white font-medium">{dashboard.valueSummary.topBenefit}</span> {dashboard.valueSummary.topBenefitImpact}</li>
            </ul>
            <button
              onClick={() => handleAction('generate_report', 'value-report')}
              className="mt-4 px-4 py-2 bg-cscx-accent hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
            >
              Generate Adoption Report for Customer
            </button>
          </div>
        </div>
      </div>

      {/* Unused Features Opportunities */}
      {dashboard.unusedFeatures.length > 0 && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Unused Features (Opportunity)</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-cscx-gray-400 text-sm">
                  <th className="pb-3">Feature</th>
                  <th className="pb-3 text-right">Peer Usage</th>
                  <th className="pb-3 text-right">Value Prop</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-white">
                {dashboard.unusedFeatures.map((feature, index) => (
                  <tr key={index} className="border-t border-cscx-gray-800">
                    <td className="py-3">{feature.featureName}</td>
                    <td className="py-3 text-right text-cscx-gray-400">{feature.peerUsage}%</td>
                    <td className="py-3 text-right text-green-400">{feature.valueProp}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleAction('schedule_training', `feature-${feature.featureName.toLowerCase()}`)}
                        className="text-cscx-accent hover:underline text-sm"
                      >
                        Schedule Training
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adoption Milestones */}
      {dashboard.adoptionMilestones.length > 0 && (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Adoption Milestones</h3>
          <div className="space-y-4">
            {dashboard.adoptionMilestones.map((milestone, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 bg-cscx-accent rounded-full" />
                  {index < dashboard.adoptionMilestones.length - 1 && (
                    <div className="w-px h-8 bg-cscx-gray-700 mt-2" />
                  )}
                </div>
                <div>
                  <p className="text-white font-medium">{milestone.milestone}</p>
                  <p className="text-sm text-cscx-gray-400">{milestone.description}</p>
                  <p className="text-xs text-cscx-gray-500 mt-1">
                    {new Date(milestone.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface UserMetricCardProps {
  label: string;
  value: number;
  change?: number;
  suffix?: string;
}

const UserMetricCard: React.FC<UserMetricCardProps> = ({ label, value, change, suffix }) => (
  <div className="text-center p-3 bg-cscx-gray-800 rounded-lg">
    <p className="text-2xl font-bold text-white">{value}</p>
    <p className="text-xs text-cscx-gray-400">{label}</p>
    {change !== undefined && (
      <p className={`text-xs mt-1 ${change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-gray-400'}`}>
        {change > 0 ? '\u25B2' : change < 0 ? '\u25BC' : ''} {change > 0 ? '+' : ''}{change}%
      </p>
    )}
    {suffix && (
      <p className="text-xs text-cscx-gray-500">{suffix}</p>
    )}
  </div>
);

interface UserHealthBarProps {
  label: string;
  count: number;
  total: number;
  color: string;
}

const UserHealthBar: React.FC<UserHealthBarProps> = ({ label, count, total, color }) => {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 text-sm text-cscx-gray-400">{label}</div>
      <div className="flex-1 h-2 bg-cscx-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="w-20 text-right text-sm">
        <span className="text-white">{count}</span>
        <span className="text-cscx-gray-500"> ({Math.round(percentage)}%)</span>
      </div>
    </div>
  );
};

interface FeatureRowProps {
  feature: FeatureAdoption;
}

const FeatureRow: React.FC<FeatureRowProps> = ({ feature }) => (
  <div className="flex items-center gap-3 p-2 hover:bg-cscx-gray-800 rounded-lg transition-colors">
    <div className={`w-2 h-2 rounded-full ${
      feature.healthStatus === 'healthy' ? 'bg-green-500' :
      feature.healthStatus === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
    }`} />
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <span className="text-white">{feature.featureName}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${
          feature.category === 'core' ? 'bg-blue-500/20 text-blue-400' :
          feature.category === 'advanced' ? 'bg-purple-500/20 text-purple-400' :
          'bg-orange-500/20 text-orange-400'
        }`}>
          {feature.category}
        </span>
        {feature.isAdopted ? (
          <span className="text-green-400 text-sm">\u2713</span>
        ) : (
          <span className="text-red-400 text-sm">\u2717</span>
        )}
      </div>
    </div>
    <div className="text-right">
      <span className={`text-sm ${feature.usagePercentage >= 50 ? 'text-white' : 'text-cscx-gray-400'}`}>
        {feature.usagePercentage}%
      </span>
      <span className="text-xs text-cscx-gray-500 ml-2">
        vs {feature.peerUsage}% peer
      </span>
    </div>
  </div>
);

interface RecommendationCardProps {
  recommendation: Recommendation;
  onAction: (actionType: RecommendationActionType) => void;
  loading: boolean;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ recommendation, onAction, loading }) => (
  <div className="p-4 bg-cscx-gray-800 rounded-lg">
    <div className="flex items-start justify-between mb-2">
      <div>
        <div className="flex items-center gap-2">
          <h5 className="text-white font-medium">{recommendation.title}</h5>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            recommendation.priority === 'high' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
            recommendation.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
            'bg-blue-500/20 text-blue-400 border-blue-500/30'
          }`}>
            {recommendation.priority}
          </span>
        </div>
        <p className="text-sm text-cscx-gray-400 mt-1">{recommendation.description}</p>
      </div>
    </div>
    <div className="flex items-center gap-2 mt-3">
      {recommendation.actions.map((action, index) => (
        <button
          key={index}
          onClick={() => onAction(action.type)}
          disabled={loading}
          className="px-3 py-1.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : action.label}
        </button>
      ))}
    </div>
  </div>
);

export default ProductAdoptionDashboard;
