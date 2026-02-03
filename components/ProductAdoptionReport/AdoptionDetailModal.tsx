/**
 * Adoption Detail Modal
 * PRD-159: Detailed adoption view for a specific customer
 */

import React from 'react';
import {
  ProductAdoptionCustomerResponse,
  FeatureStatus,
  ADOPTION_THRESHOLDS
} from '../../types/productAdoptionReport';

// ============================================
// HELPER FUNCTIONS
// ============================================

const getAdoptionColor = (score: number): string => {
  if (score >= ADOPTION_THRESHOLDS.power.min) return 'text-purple-400';
  if (score >= ADOPTION_THRESHOLDS.active.min) return 'text-green-400';
  if (score >= ADOPTION_THRESHOLDS.exploring.min) return 'text-yellow-400';
  return 'text-red-400';
};

const getStatusColor = (status: FeatureStatus): string => {
  switch (status) {
    case 'power_user': return 'bg-purple-500 text-white';
    case 'active': return 'bg-green-500 text-white';
    case 'exploring': return 'bg-yellow-500 text-black';
    case 'not_started': return 'bg-cscx-gray-700 text-cscx-gray-400';
  }
};

const getStatusLabel = (status: FeatureStatus): string => {
  switch (status) {
    case 'power_user': return 'Power User';
    case 'active': return 'Active';
    case 'exploring': return 'Exploring';
    case 'not_started': return 'Not Started';
  }
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

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
};

const getPriorityColor = (priority: 'high' | 'medium' | 'low'): string => {
  switch (priority) {
    case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'low': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  }
};

// ============================================
// COMPONENT
// ============================================

interface AdoptionDetailModalProps {
  customerId: string;
  data: ProductAdoptionCustomerResponse | null;
  loading: boolean;
  onClose: () => void;
  onViewFullDetail: (customerId: string) => void;
}

export const AdoptionDetailModal: React.FC<AdoptionDetailModalProps> = ({
  customerId,
  data,
  loading,
  onClose,
  onViewFullDetail
}) => {
  if (loading || !data) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  const { metrics, features, recommendations } = data;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-cscx-gray-900 border-b border-cscx-gray-800 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{metrics.customer_name}</h2>
            <p className="text-sm text-cscx-gray-400">Product Adoption Detail</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onViewFullDetail(customerId)}
              className="px-3 py-1.5 text-sm bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors"
            >
              View Full Profile
            </button>
            <button
              onClick={onClose}
              className="p-2 text-cscx-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Score Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-cscx-gray-800 rounded-xl p-4 text-center">
              <p className="text-xs text-cscx-gray-400 uppercase mb-1">Overall Score</p>
              <p className={`text-4xl font-bold ${getAdoptionColor(metrics.scores.overall_score)}`}>
                {metrics.scores.overall_score}
              </p>
              <p className={`text-sm mt-1 ${getTrendColor(metrics.scores.trend)}`}>
                {getTrendIcon(metrics.scores.trend)} {metrics.scores.change > 0 ? '+' : ''}{metrics.scores.change} pts
              </p>
            </div>

            <div className="bg-cscx-gray-800 rounded-xl p-4">
              <p className="text-xs text-cscx-gray-400 uppercase mb-2">Score Breakdown</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-cscx-gray-300">Breadth (features used)</span>
                  <span className="text-white font-medium">{metrics.scores.breadth_score}%</span>
                </div>
                <div className="h-2 bg-cscx-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${metrics.scores.breadth_score}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-sm text-cscx-gray-300">Depth (usage intensity)</span>
                  <span className="text-white font-medium">{metrics.scores.depth_score}%</span>
                </div>
                <div className="h-2 bg-cscx-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all"
                    style={{ width: `${metrics.scores.depth_score}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-cscx-gray-800 rounded-xl p-4">
              <p className="text-xs text-cscx-gray-400 uppercase mb-2">Feature Summary</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-cscx-gray-400">Power User</span>
                  <span className="text-purple-400 font-medium">{metrics.features.power_user}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cscx-gray-400">Active</span>
                  <span className="text-green-400 font-medium">{metrics.features.active}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cscx-gray-400">Exploring</span>
                  <span className="text-yellow-400 font-medium">{metrics.features.exploring}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cscx-gray-400">Not Started</span>
                  <span className="text-cscx-gray-500 font-medium">{metrics.features.not_started}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-cscx-gray-700 flex justify-between">
                <span className="text-cscx-gray-400">Total Features</span>
                <span className="text-white font-medium">
                  {metrics.features.using}/{metrics.features.total_available}
                </span>
              </div>
            </div>
          </div>

          {/* Feature Adoption Status */}
          <div className="bg-cscx-gray-800 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Feature Adoption Status</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cscx-gray-700">
                    <th className="text-left py-2 px-3 text-cscx-gray-400 font-medium">Feature</th>
                    <th className="text-left py-2 px-3 text-cscx-gray-400 font-medium">Status</th>
                    <th className="text-right py-2 px-3 text-cscx-gray-400 font-medium">Users</th>
                    <th className="text-right py-2 px-3 text-cscx-gray-400 font-medium">Uses</th>
                    <th className="text-left py-2 px-3 text-cscx-gray-400 font-medium">Last Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cscx-gray-700">
                  {features
                    .sort((a, b) => {
                      const statusOrder: Record<FeatureStatus, number> = {
                        power_user: 0,
                        active: 1,
                        exploring: 2,
                        not_started: 3
                      };
                      return statusOrder[a.status] - statusOrder[b.status];
                    })
                    .map((feature) => (
                      <tr key={feature.feature_id} className="hover:bg-cscx-gray-700/30">
                        <td className="py-2 px-3">
                          <div>
                            <p className="text-white">{feature.feature_name}</p>
                            <p className="text-xs text-cscx-gray-500">{feature.feature_category}</p>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(feature.status)}`}>
                            {getStatusLabel(feature.status)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-cscx-gray-300">
                          {feature.usage.unique_users}
                        </td>
                        <td className="py-2 px-3 text-right text-cscx-gray-300">
                          {feature.usage.total_uses}
                        </td>
                        <td className="py-2 px-3 text-cscx-gray-400">
                          {formatDate(feature.usage.last_used)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="bg-cscx-gray-800 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Adoption Recommendations</h3>
              <div className="space-y-3">
                {recommendations.map((rec, index) => (
                  <div
                    key={`${rec.feature_id}-${index}`}
                    className={`p-4 rounded-lg border ${getPriorityColor(rec.priority)}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className={`text-xs font-medium uppercase mr-2 ${
                          rec.priority === 'high' ? 'text-red-400' :
                          rec.priority === 'medium' ? 'text-yellow-400' : 'text-blue-400'
                        }`}>
                          {rec.priority} priority
                        </span>
                        <h4 className="text-white font-medium inline">{rec.feature_name}</h4>
                      </div>
                      <span className="text-xs text-cscx-gray-500">{rec.feature_category}</span>
                    </div>
                    <p className="text-sm text-cscx-gray-300 mb-2">{rec.reason}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-cscx-gray-400">
                        <strong className="text-white">Impact:</strong> {rec.potential_impact}
                      </span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-cscx-gray-700">
                      <p className="text-sm text-cscx-accent">
                        <strong>Suggested:</strong> {rec.suggested_action}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Top Features */}
            <div className="bg-cscx-gray-800 rounded-xl p-4">
              <h4 className="text-sm font-medium text-cscx-gray-400 uppercase mb-3">Top Features</h4>
              {metrics.highlights.top_features.length > 0 ? (
                <ul className="space-y-2">
                  {metrics.highlights.top_features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-white">
                      <span className="text-green-400">*</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-cscx-gray-500">No top features yet</p>
              )}
            </div>

            {/* Unused Valuable */}
            <div className="bg-cscx-gray-800 rounded-xl p-4">
              <h4 className="text-sm font-medium text-cscx-gray-400 uppercase mb-3">High-Value Unused</h4>
              {metrics.highlights.unused_valuable.length > 0 ? (
                <ul className="space-y-2">
                  {metrics.highlights.unused_valuable.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-yellow-400">
                      <span>!</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-green-400">All high-value features adopted</p>
              )}
            </div>

            {/* Recently Started */}
            <div className="bg-cscx-gray-800 rounded-xl p-4">
              <h4 className="text-sm font-medium text-cscx-gray-400 uppercase mb-3">Recently Started</h4>
              {metrics.highlights.recently_started.length > 0 ? (
                <ul className="space-y-2">
                  {metrics.highlights.recently_started.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-blue-400">
                      <span>+</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-cscx-gray-500">No new features in last 30 days</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdoptionDetailModal;
