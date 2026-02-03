/**
 * Health Detail Modal
 * PRD-153: Component breakdown view for individual customer health
 */

import React from 'react';
import {
  CustomerHealthDetail,
  HEALTH_THRESHOLDS,
  COMPONENT_WEIGHTS
} from '../../types/healthPortfolio';

interface HealthDetailModalProps {
  customerId: string;
  data: CustomerHealthDetail | null;
  loading: boolean;
  onClose: () => void;
  onViewFullDetail: (customerId: string) => void;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const getHealthColor = (score: number): string => {
  if (score >= HEALTH_THRESHOLDS.healthy.min) return 'text-green-400';
  if (score >= HEALTH_THRESHOLDS.warning.min) return 'text-yellow-400';
  return 'text-red-400';
};

const getHealthBgColor = (score: number): string => {
  if (score >= HEALTH_THRESHOLDS.healthy.min) return 'bg-green-500';
  if (score >= HEALTH_THRESHOLDS.warning.min) return 'bg-yellow-500';
  return 'bg-red-500';
};

const getCategoryLabel = (category: 'healthy' | 'warning' | 'critical'): string => {
  return category.charAt(0).toUpperCase() + category.slice(1);
};

const getTrendLabel = (trend: 'improving' | 'stable' | 'declining'): string => {
  return trend.charAt(0).toUpperCase() + trend.slice(1);
};

const getTrendIcon = (trend: 'improving' | 'stable' | 'declining'): string => {
  switch (trend) {
    case 'improving': return '\u2191';
    case 'declining': return '\u2193';
    case 'stable': return '\u2192';
  }
};

export const HealthDetailModal: React.FC<HealthDetailModalProps> = ({
  customerId,
  data,
  loading,
  onClose,
  onViewFullDetail
}) => {
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8 max-w-2xl w-full mx-4">
          <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto" />
          <p className="text-cscx-gray-400 text-center mt-4">Loading health details...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8 max-w-2xl w-full mx-4">
          <p className="text-cscx-gray-400 text-center">Failed to load health details</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg mx-auto block"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const { customer, current_score, category, trend, components, lowest_component, history, risks, recommendations } = data;

  // Get history chart data (last 12 points)
  const chartHistory = history.slice(-12);
  const maxScore = Math.max(...chartHistory.map(h => h.score), 100);
  const minScore = Math.min(...chartHistory.map(h => h.score), 0);
  const range = maxScore - minScore || 1;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl max-w-3xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cscx-gray-800">
          <div>
            <h2 className="text-xl font-bold text-white">Health Score Detail</h2>
            <p className="text-cscx-gray-400">{customer.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Current Score Summary */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-cscx-gray-400 uppercase tracking-wider">Current Score</p>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-4xl font-bold ${getHealthColor(current_score)}`}>
                  {current_score}
                </span>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  category === 'healthy' ? 'bg-green-500/20 text-green-400' :
                  category === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {getCategoryLabel(category)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-cscx-gray-400 uppercase tracking-wider">Trend</p>
              <div className={`flex items-center gap-1 mt-1 ${
                trend === 'improving' ? 'text-green-400' :
                trend === 'declining' ? 'text-red-400' :
                'text-gray-400'
              }`}>
                <span className="text-2xl">{getTrendIcon(trend)}</span>
                <span className="text-lg font-medium">{getTrendLabel(trend)}</span>
              </div>
            </div>
          </div>

          {/* Component Breakdown */}
          <div className="bg-cscx-gray-800/50 rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-4">Score Components</h3>
            <div className="space-y-4">
              {/* Usage Score */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-cscx-gray-300">Usage Score</span>
                    <span className="text-xs text-cscx-gray-500">({(COMPONENT_WEIGHTS.usage * 100)}% weight)</span>
                    {lowest_component === 'usage' && (
                      <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">Lowest</span>
                    )}
                  </div>
                  <span className={`font-medium ${getHealthColor(components.usage_score)}`}>
                    {components.usage_score}/100
                  </span>
                </div>
                <div className="w-full h-2 bg-cscx-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getHealthBgColor(components.usage_score)} transition-all`}
                    style={{ width: `${components.usage_score}%` }}
                  />
                </div>
              </div>

              {/* Engagement Score */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-cscx-gray-300">Engagement Score</span>
                    <span className="text-xs text-cscx-gray-500">({(COMPONENT_WEIGHTS.engagement * 100)}% weight)</span>
                    {lowest_component === 'engagement' && (
                      <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">Lowest</span>
                    )}
                  </div>
                  <span className={`font-medium ${getHealthColor(components.engagement_score)}`}>
                    {components.engagement_score}/100
                  </span>
                </div>
                <div className="w-full h-2 bg-cscx-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getHealthBgColor(components.engagement_score)} transition-all`}
                    style={{ width: `${components.engagement_score}%` }}
                  />
                </div>
              </div>

              {/* Sentiment Score */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-cscx-gray-300">Sentiment Score</span>
                    <span className="text-xs text-cscx-gray-500">({(COMPONENT_WEIGHTS.sentiment * 100)}% weight)</span>
                    {lowest_component === 'sentiment' && (
                      <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">Lowest</span>
                    )}
                  </div>
                  <span className={`font-medium ${getHealthColor(components.sentiment_score)}`}>
                    {components.sentiment_score}/100
                  </span>
                </div>
                <div className="w-full h-2 bg-cscx-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getHealthBgColor(components.sentiment_score)} transition-all`}
                    style={{ width: `${components.sentiment_score}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Score History Chart */}
          <div className="bg-cscx-gray-800/50 rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-4">Score History (90 days)</h3>
            <div className="h-32 flex items-end gap-1">
              {chartHistory.map((point, index) => {
                const height = ((point.score - minScore) / range) * 100;
                return (
                  <div
                    key={point.date}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div
                      className={`w-full rounded-t ${getHealthBgColor(point.score)} transition-all hover:opacity-80`}
                      style={{ height: `${Math.max(height, 5)}%` }}
                      title={`${point.date}: ${point.score}`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-cscx-gray-500">
              <span>{chartHistory[0]?.date}</span>
              <span>Current: {current_score}</span>
              <span>{chartHistory[chartHistory.length - 1]?.date}</span>
            </div>
          </div>

          {/* Active Risks */}
          {risks.length > 0 && (
            <div className="bg-cscx-gray-800/50 rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-3">Active Risks ({risks.length})</h3>
              <div className="space-y-2">
                {risks.map((risk, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      risk.severity === 'high' ? 'bg-red-500/10 border border-red-500/30' :
                      risk.severity === 'medium' ? 'bg-yellow-500/10 border border-yellow-500/30' :
                      'bg-blue-500/10 border border-blue-500/30'
                    }`}
                  >
                    <span className={`px-2 py-0.5 text-xs font-medium rounded uppercase ${
                      risk.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                      risk.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {risk.severity}
                    </span>
                    <span className="text-sm text-white">{risk.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Actions */}
          {recommendations.length > 0 && (
            <div className="bg-cscx-gray-800/50 rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-3">Recommended Actions</h3>
              <div className="space-y-2">
                {recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start gap-3 p-2">
                    <span className="text-cscx-accent font-medium">{index + 1}.</span>
                    <span className="text-sm text-cscx-gray-300">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customer Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-cscx-gray-400">ARR</p>
              <p className="text-white font-medium">{formatCurrency(customer.arr)}</p>
            </div>
            <div>
              <p className="text-cscx-gray-400">Segment</p>
              <p className="text-white font-medium">{customer.industry || '-'}</p>
            </div>
            <div>
              <p className="text-cscx-gray-400">Renewal</p>
              <p className={`font-medium ${
                customer.days_to_renewal !== null && customer.days_to_renewal <= 30 ? 'text-red-400' :
                customer.days_to_renewal !== null && customer.days_to_renewal <= 90 ? 'text-yellow-400' :
                'text-white'
              }`}>
                {customer.days_to_renewal !== null ? `${customer.days_to_renewal} days` : '-'}
              </p>
            </div>
            <div>
              <p className="text-cscx-gray-400">Status</p>
              <p className="text-white font-medium capitalize">{customer.status.replace('_', ' ')}</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-cscx-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-cscx-gray-400 hover:text-white transition-colors"
          >
            Close
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => onViewFullDetail(customerId)}
              className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
            >
              View Full Customer Detail
            </button>
            {current_score < 50 && (
              <button className="px-4 py-2 bg-cscx-accent hover:bg-red-700 text-white rounded-lg transition-colors">
                Start Save Play
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthDetailModal;
