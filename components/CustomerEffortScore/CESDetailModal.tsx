/**
 * CES Detail Modal
 * PRD-160: Detailed CES view for a specific customer
 */

import React from 'react';
import {
  CustomerCESDetail,
  CESCategory,
  CESTrend,
  CES_THRESHOLDS
} from '../../types/customerEffortScore';
import { CESDistributionChart } from './CESDistributionChart';
import { TouchpointTable } from './TouchpointTable';
import { FeedbackThemesPanel } from './FeedbackThemesPanel';

interface CESDetailModalProps {
  customerId: string;
  data: CustomerCESDetail | null;
  loading: boolean;
  onClose: () => void;
  onViewFullDetail?: (customerId: string) => void;
}

const getCESColor = (score: number): string => {
  if (score >= CES_THRESHOLDS.low_effort.min) return 'text-green-400';
  if (score >= CES_THRESHOLDS.neutral.min) return 'text-yellow-400';
  return 'text-red-400';
};

const getCategoryLabel = (category: CESCategory): string => {
  switch (category) {
    case 'low_effort': return 'Low Effort';
    case 'neutral': return 'Neutral';
    case 'high_effort': return 'High Effort';
  }
};

const getCategoryColor = (category: CESCategory): string => {
  switch (category) {
    case 'low_effort': return 'text-green-400 bg-green-500/20';
    case 'neutral': return 'text-yellow-400 bg-yellow-500/20';
    case 'high_effort': return 'text-red-400 bg-red-500/20';
  }
};

const getTrendIcon = (trend: CESTrend): string => {
  switch (trend) {
    case 'improving': return '\u2191';
    case 'worsening': return '\u2193';
    case 'stable': return '\u2192';
  }
};

const getTrendColor = (trend: CESTrend): string => {
  switch (trend) {
    case 'improving': return 'text-green-400';
    case 'worsening': return 'text-red-400';
    case 'stable': return 'text-gray-400';
  }
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const CESDetailModal: React.FC<CESDetailModalProps> = ({
  customerId,
  data,
  loading,
  onClose,
  onViewFullDetail
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-cscx-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            {loading ? 'Loading...' : data?.customer.name || 'Customer CES Detail'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-cscx-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-cscx-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full" />
            </div>
          ) : data ? (
            <>
              {/* Customer Info & CES Score */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Info */}
                <div className="bg-cscx-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm text-cscx-gray-400 uppercase tracking-wider mb-3">Customer</h4>
                  <div className="space-y-2">
                    <p className="text-white font-medium text-lg">{data.customer.name}</p>
                    <div className="flex items-center gap-4 text-sm text-cscx-gray-400">
                      <span>{data.customer.segment}</span>
                      <span>|</span>
                      <span>{formatCurrency(data.customer.arr)} ARR</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-cscx-gray-400">Health Score:</span>
                      <span className={`font-medium ${
                        data.customer.health_score >= 70 ? 'text-green-400' :
                        data.customer.health_score >= 40 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {data.customer.health_score}
                      </span>
                    </div>
                  </div>
                </div>

                {/* CES Score */}
                <div className="bg-cscx-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm text-cscx-gray-400 uppercase tracking-wider mb-3">Average CES</h4>
                  <div className="flex items-center gap-4">
                    <span className={`text-4xl font-bold ${getCESColor(data.current_ces)}`}>
                      {data.current_ces.toFixed(1)}
                    </span>
                    <span className="text-2xl text-cscx-gray-500">/7</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(data.category)}`}>
                      {getCategoryLabel(data.category)}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1 mt-2 ${getTrendColor(data.trend)}`}>
                    <span>{getTrendIcon(data.trend)}</span>
                    <span className="text-sm">
                      {data.trend_change > 0 ? '+' : ''}{data.trend_change.toFixed(1)} vs last period
                    </span>
                  </div>
                </div>
              </div>

              {/* Distribution */}
              <div className="bg-cscx-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm text-cscx-gray-400 uppercase tracking-wider mb-3">Score Distribution</h4>
                <CESDistributionChart distribution={data.distribution} />
              </div>

              {/* By Touchpoint */}
              <div className="bg-cscx-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm text-cscx-gray-400 uppercase tracking-wider mb-3">CES by Touchpoint</h4>
                <TouchpointTable touchpoints={data.by_touchpoint} />
              </div>

              {/* Recent Surveys */}
              <div className="bg-cscx-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm text-cscx-gray-400 uppercase tracking-wider mb-3">Recent Responses</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-cscx-gray-400 text-left">
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Touchpoint</th>
                        <th className="pb-2">Score</th>
                        <th className="pb-2">Feedback</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cscx-gray-700">
                      {data.recent_surveys.slice(0, 5).map((survey) => (
                        <tr key={survey.id} className="text-cscx-gray-300">
                          <td className="py-2">
                            {survey.days_ago === 0 ? 'Today' :
                             survey.days_ago === 1 ? 'Yesterday' :
                             `${survey.days_ago} days ago`}
                          </td>
                          <td className="py-2">{survey.touchpoint.replace('_', ' ')}</td>
                          <td className="py-2">
                            {survey.score ? (
                              <span className={getCESColor(survey.score)}>{survey.score}</span>
                            ) : (
                              <span className="text-cscx-gray-500">-</span>
                            )}
                          </td>
                          <td className="py-2">
                            {survey.feedback ? (
                              <span className="italic">"{survey.feedback}"</span>
                            ) : (
                              <span className="text-cscx-gray-500">No feedback</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Feedback Themes */}
              {data.feedback_themes.length > 0 && (
                <div className="bg-cscx-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm text-cscx-gray-400 uppercase tracking-wider mb-3">Feedback Themes</h4>
                  <FeedbackThemesPanel themes={data.feedback_themes} />
                </div>
              )}

              {/* Recommendations */}
              {data.recommendations.length > 0 && (
                <div className="bg-cscx-gray-800/50 rounded-lg p-4">
                  <h4 className="text-sm text-cscx-gray-400 uppercase tracking-wider mb-3">Recommendations</h4>
                  <ul className="space-y-2">
                    {data.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-cscx-gray-300">
                        <span className="text-cscx-accent mt-0.5">*</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-cscx-gray-500">
              Failed to load customer data
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-cscx-gray-800 flex justify-end gap-3">
          {data && onViewFullDetail && (
            <button
              onClick={() => onViewFullDetail(customerId)}
              className="px-4 py-2 text-sm bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors"
            >
              View Full Customer Detail
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CESDetailModal;
