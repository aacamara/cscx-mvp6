/**
 * Engagement Score Breakdown Component
 * PRD-070: Detailed engagement score visualization with contributing factors
 *
 * Features:
 * - Overall engagement score with gauge visualization
 * - Score composition breakdown by component
 * - Individual factor details per component
 * - Historical trend chart
 * - Peer comparison
 * - Impact analysis
 * - Actionable recommendations
 */

import React, { useState } from 'react';
import { useEngagementScore } from '../../hooks/useEngagementScore';
import {
  EngagementStatus,
  TrendDirection,
  EngagementFactor,
  EngagementHistoryPoint,
} from '../../types/engagementScoreBreakdown';

// ============================================
// TYPES
// ============================================

interface EngagementScoreBreakdownProps {
  customerId: string;
  onBack?: () => void;
  onScheduleMeeting?: (data: Record<string, unknown>) => void;
  onSendEmail?: (data: Record<string, unknown>) => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const getStatusColor = (status: EngagementStatus): string => {
  switch (status) {
    case 'healthy':
      return 'text-green-400';
    case 'warning':
      return 'text-yellow-400';
    case 'critical':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
};

const getStatusBg = (status: EngagementStatus): string => {
  switch (status) {
    case 'healthy':
      return 'bg-green-500';
    case 'warning':
      return 'bg-yellow-500';
    case 'critical':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

const getStatusBgLight = (status: EngagementStatus): string => {
  switch (status) {
    case 'healthy':
      return 'bg-green-500/20';
    case 'warning':
      return 'bg-yellow-500/20';
    case 'critical':
      return 'bg-red-500/20';
    default:
      return 'bg-gray-500/20';
  }
};

const getTrendIcon = (trend: TrendDirection | 'improving' | 'stable' | 'declining'): string => {
  switch (trend) {
    case 'up':
    case 'improving':
      return '\u2191';
    case 'down':
    case 'declining':
      return '\u2193';
    case 'flat':
    case 'stable':
      return '\u2192';
    default:
      return '\u2192';
  }
};

const getTrendColor = (trend: TrendDirection | 'improving' | 'stable' | 'declining'): string => {
  switch (trend) {
    case 'up':
    case 'improving':
      return 'text-green-400';
    case 'down':
    case 'declining':
      return 'text-red-400';
    case 'flat':
    case 'stable':
      return 'text-gray-400';
    default:
      return 'text-gray-400';
  }
};

const getFactorStatusIcon = (status: EngagementStatus): string => {
  switch (status) {
    case 'healthy':
      return '\u2713';
    case 'warning':
      return '\u25CF';
    case 'critical':
      return '\u26A0';
    default:
      return '\u25CF';
  }
};

const formatPercentile = (percentile: number): string => {
  const suffix = percentile === 1 ? 'st' : percentile === 2 ? 'nd' : percentile === 3 ? 'rd' : 'th';
  return `${percentile}${suffix}`;
};

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * Gauge visualization for overall score
 */
const ScoreGauge: React.FC<{ score: number; trend: string; changeAmount?: number }> = ({
  score,
  trend,
  changeAmount,
}) => {
  const status: EngagementStatus = score >= 70 ? 'healthy' : score >= 50 ? 'warning' : 'critical';
  const rotation = (score / 100) * 180 - 90; // -90 to 90 degrees

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-24 overflow-hidden">
        {/* Background arc */}
        <div className="absolute inset-0">
          <svg viewBox="0 0 200 100" className="w-full h-full">
            {/* Background segments */}
            <path
              d="M 10 100 A 90 90 0 0 1 190 100"
              fill="none"
              stroke="#374151"
              strokeWidth="16"
              strokeLinecap="round"
            />
            {/* Colored arc based on score */}
            <path
              d="M 10 100 A 90 90 0 0 1 190 100"
              fill="none"
              stroke={status === 'healthy' ? '#22c55e' : status === 'warning' ? '#eab308' : '#ef4444'}
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 283} 283`}
            />
          </svg>
        </div>
        {/* Needle */}
        <div
          className="absolute bottom-0 left-1/2 w-1 h-16 bg-white origin-bottom transition-transform duration-500"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        />
        {/* Center circle */}
        <div className="absolute bottom-0 left-1/2 w-4 h-4 bg-white rounded-full transform -translate-x-1/2 translate-y-1/2" />
      </div>
      {/* Score display */}
      <div className="text-center mt-2">
        <span className={`text-4xl font-bold ${getStatusColor(status)}`}>{score}</span>
        <span className="text-xl text-cscx-gray-500">/100</span>
      </div>
      {/* Trend */}
      <div className={`flex items-center gap-1 mt-1 ${getTrendColor(trend as TrendDirection)}`}>
        <span>{getTrendIcon(trend as TrendDirection)}</span>
        {changeAmount !== undefined && (
          <span className="text-sm">
            {changeAmount > 0 ? '+' : ''}{changeAmount} from last period
          </span>
        )}
        {changeAmount === undefined && <span className="text-sm capitalize">{trend}</span>}
      </div>
    </div>
  );
};

/**
 * Score composition table
 */
const ScoreComposition: React.FC<{
  composition: Array<{
    name: string;
    score: number;
    weight: number;
    contribution: number;
    status: EngagementStatus;
  }>;
  overall: number;
}> = ({ composition, overall }) => {
  return (
    <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Score Composition</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-cscx-gray-800">
            <th className="text-left py-2 text-cscx-gray-400 font-medium">Component</th>
            <th className="text-left py-2 text-cscx-gray-400 font-medium">Score</th>
            <th className="text-left py-2 text-cscx-gray-400 font-medium">Weight</th>
            <th className="text-left py-2 text-cscx-gray-400 font-medium">Contribution</th>
            <th className="text-left py-2 text-cscx-gray-400 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-cscx-gray-800">
          {composition.map((comp) => (
            <tr key={comp.name}>
              <td className="py-3 text-white font-medium">{comp.name}</td>
              <td className="py-3 text-white">{comp.score}/100</td>
              <td className="py-3 text-cscx-gray-300">{Math.round(comp.weight * 100)}%</td>
              <td className="py-3 text-white">{comp.contribution} pts</td>
              <td className="py-3">
                <span className={`inline-flex items-center gap-1 ${getStatusColor(comp.status)}`}>
                  {getFactorStatusIcon(comp.status)} {comp.status}
                </span>
              </td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className="py-3 text-white">Total</td>
            <td className="py-3"></td>
            <td className="py-3 text-cscx-gray-300">100%</td>
            <td className="py-3 text-white">{overall} pts</td>
            <td className="py-3"></td>
          </tr>
        </tbody>
      </table>

      {/* Stacked bar visualization */}
      <div className="mt-4 h-4 rounded-full overflow-hidden flex bg-cscx-gray-800">
        {composition.map((comp) => (
          <div
            key={comp.name}
            className={`${getStatusBg(comp.status)} transition-all`}
            style={{ width: `${comp.contribution}%` }}
            title={`${comp.name}: ${comp.contribution} pts`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-cscx-gray-500">
        {composition.map((comp) => (
          <span key={comp.name}>{comp.name}</span>
        ))}
      </div>
    </div>
  );
};

/**
 * Factor details table
 */
const FactorDetails: React.FC<{
  title: string;
  score: number;
  factors: EngagementFactor[];
  highlights: { positive: string[]; concerns: string[]; rootCause?: string[] };
  actions: string[];
  onActionClick?: (action: string) => void;
}> = ({ title, score, factors, highlights, actions, onActionClick }) => {
  const status: EngagementStatus = score >= 70 ? 'healthy' : score >= 50 ? 'warning' : 'critical';

  return (
    <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <span className={`text-xl font-bold ${getStatusColor(status)}`}>{score}/100</span>
      </div>

      {/* Factor table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cscx-gray-800">
              <th className="text-left py-2 text-cscx-gray-400 font-medium">Factor</th>
              <th className="text-left py-2 text-cscx-gray-400 font-medium">Current</th>
              <th className="text-left py-2 text-cscx-gray-400 font-medium">Target</th>
              <th className="text-left py-2 text-cscx-gray-400 font-medium">Score</th>
              <th className="text-left py-2 text-cscx-gray-400 font-medium">Weight</th>
              <th className="text-left py-2 text-cscx-gray-400 font-medium">Status</th>
              <th className="text-left py-2 text-cscx-gray-400 font-medium">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cscx-gray-800">
            {factors.map((factor) => (
              <tr key={factor.name}>
                <td className="py-2 text-white">{factor.name}</td>
                <td className="py-2 text-white">
                  {factor.current}
                  {factor.healthyRange.unit !== 'days' && factor.healthyRange.unit}
                </td>
                <td className="py-2 text-cscx-gray-400">
                  {factor.healthyRange.unit === 'days' ? `< ${factor.target}` : factor.target}
                  {factor.healthyRange.unit !== 'days' && factor.healthyRange.unit}
                </td>
                <td className="py-2 text-white">{Math.round((factor.contribution / factor.weight) * 100)}</td>
                <td className="py-2 text-cscx-gray-400">{Math.round(factor.weight * 100)}%</td>
                <td className="py-2">
                  <span className={getStatusColor(factor.status)}>
                    {getFactorStatusIcon(factor.status)}
                  </span>
                </td>
                <td className="py-2">
                  <span className={getTrendColor(factor.trend)}>
                    {getTrendIcon(factor.trend)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Highlights */}
      {(highlights.positive.length > 0 || highlights.concerns.length > 0) && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-cscx-gray-300">Highlights:</p>
          {highlights.positive.map((item, idx) => (
            <p key={`pos-${idx}`} className="text-sm text-green-400 flex items-start gap-2">
              <span>\u2713</span> {item}
            </p>
          ))}
          {highlights.concerns.map((item, idx) => (
            <p key={`con-${idx}`} className="text-sm text-yellow-400 flex items-start gap-2">
              <span>\u26A0</span> {item}
            </p>
          ))}
        </div>
      )}

      {/* Root cause analysis */}
      {highlights.rootCause && highlights.rootCause.length > 0 && (
        <div className="mt-4 p-3 bg-cscx-gray-800/50 rounded-lg">
          <p className="text-sm font-medium text-cscx-gray-300 mb-2">Root Cause Analysis:</p>
          <ol className="list-decimal list-inside space-y-1">
            {highlights.rootCause.map((cause, idx) => (
              <li key={idx} className="text-sm text-cscx-gray-400">{cause}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Actions */}
      {actions.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-cscx-gray-300">Recommended Actions:</p>
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => onActionClick?.(action)}
              className="block text-sm text-cscx-accent hover:underline"
            >
              {idx + 1}. {action}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Trend chart component
 */
const TrendChart: React.FC<{ history: EngagementHistoryPoint[] }> = ({ history }) => {
  if (history.length === 0) return null;

  const maxScore = 100;
  const chartHeight = 120;

  return (
    <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Engagement Trend</h3>

      {/* Chart */}
      <div className="relative h-32">
        <svg viewBox={`0 0 ${history.length * 60} ${chartHeight}`} className="w-full h-full">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((val) => (
            <line
              key={val}
              x1="0"
              y1={chartHeight - (val / maxScore) * chartHeight}
              x2={history.length * 60}
              y2={chartHeight - (val / maxScore) * chartHeight}
              stroke="#374151"
              strokeWidth="1"
              strokeDasharray="4"
            />
          ))}

          {/* Overall line */}
          <polyline
            fill="none"
            stroke="#e63946"
            strokeWidth="2"
            points={history.map((point, idx) =>
              `${idx * 60 + 30},${chartHeight - (point.overall / maxScore) * chartHeight}`
            ).join(' ')}
          />

          {/* Points */}
          {history.map((point, idx) => (
            <circle
              key={idx}
              cx={idx * 60 + 30}
              cy={chartHeight - (point.overall / maxScore) * chartHeight}
              r="4"
              fill="#e63946"
            />
          ))}
        </svg>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-around mt-2 text-xs text-cscx-gray-500">
        {history.map((point) => (
          <span key={point.date}>{point.month}</span>
        ))}
      </div>

      {/* Data table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-cscx-gray-800">
              <th className="text-left py-2 text-cscx-gray-400">Month</th>
              <th className="text-left py-2 text-cscx-gray-400">Communication</th>
              <th className="text-left py-2 text-cscx-gray-400">Product</th>
              <th className="text-left py-2 text-cscx-gray-400">Relationship</th>
              <th className="text-left py-2 text-cscx-gray-400">Overall</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cscx-gray-800">
            {history.map((point) => (
              <tr key={point.date}>
                <td className="py-1 text-cscx-gray-300">{point.month}</td>
                <td className="py-1 text-white">{point.communication}</td>
                <td className="py-1 text-white">{point.product}</td>
                <td className="py-1 text-white">{point.relationship}</td>
                <td className="py-1 text-white font-medium">{point.overall}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Peer comparison component
 */
const PeerComparisonCard: React.FC<{
  comparison: {
    overall: { customerScore: number; peerAvg: number; percentile: number };
    communication: { customerScore: number; peerAvg: number; percentile: number };
    product: { customerScore: number; peerAvg: number; percentile: number };
    relationship: { customerScore: number; peerAvg: number; percentile: number };
  };
}> = ({ comparison }) => {
  const rows = [
    { label: 'Overall', data: comparison.overall },
    { label: 'Communication', data: comparison.communication },
    { label: 'Product', data: comparison.product },
    { label: 'Relationship', data: comparison.relationship },
  ];

  return (
    <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Peer Comparison</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-cscx-gray-800">
            <th className="text-left py-2 text-cscx-gray-400 font-medium">Factor</th>
            <th className="text-left py-2 text-cscx-gray-400 font-medium">Score</th>
            <th className="text-left py-2 text-cscx-gray-400 font-medium">Peer Avg</th>
            <th className="text-left py-2 text-cscx-gray-400 font-medium">Percentile</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-cscx-gray-800">
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="py-2 text-white">{row.label}</td>
              <td className="py-2 text-white">{row.data.customerScore}</td>
              <td className="py-2 text-cscx-gray-400">{row.data.peerAvg}</td>
              <td className="py-2">
                <span className={row.data.percentile >= 50 ? 'text-green-400' : 'text-yellow-400'}>
                  {formatPercentile(row.data.percentile)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 p-3 bg-cscx-gray-800/50 rounded-lg">
        <p className="text-sm text-cscx-gray-300">
          <strong>Insight:</strong>{' '}
          {comparison.overall.percentile >= 50
            ? 'Above average on communication, below on product engagement'
            : 'Below average engagement - improvement opportunities identified'}
        </p>
      </div>
    </div>
  );
};

/**
 * Impact analysis component
 */
const ImpactAnalysisCard: React.FC<{
  currentScore: number;
  impact: {
    improvement: {
      targetScore: number;
      renewalProbabilityChange: number;
      expansionLikelihoodChange: number;
      referencePotential: string;
    };
    decline: {
      targetScore: number;
      churnRiskChange: number;
      healthScoreImpact: number;
      recommendation: string;
    };
  };
}> = ({ currentScore, impact }) => {
  return (
    <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Impact Analysis</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Improvement scenario */}
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <h4 className="font-medium text-green-400 mb-2">
            If engagement improves to {impact.improvement.targetScore}
          </h4>
          <ul className="space-y-1 text-sm text-cscx-gray-300">
            <li>Renewal probability: +{impact.improvement.renewalProbabilityChange}%</li>
            <li>Expansion likelihood: +{impact.improvement.expansionLikelihoodChange}%</li>
            <li>Reference potential: {impact.improvement.referencePotential}</li>
          </ul>
        </div>

        {/* Decline scenario */}
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <h4 className="font-medium text-red-400 mb-2">
            If engagement drops to {impact.decline.targetScore}
          </h4>
          <ul className="space-y-1 text-sm text-cscx-gray-300">
            <li>Churn risk: +{impact.decline.churnRiskChange}%</li>
            <li>Health score impact: {impact.decline.healthScoreImpact} points</li>
            <li className="text-yellow-400">{impact.decline.recommendation}</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

/**
 * Recommendations component
 */
const RecommendationsCard: React.FC<{
  recommendations: Array<{
    id: string;
    category: string;
    priority: string;
    title: string;
    description: string;
    impact: string;
    actions: Array<{ id: string; label: string; type: string }>;
  }>;
  onActionClick?: (actionType: string, data?: Record<string, unknown>) => void;
}> = ({ recommendations, onActionClick }) => {
  const priorityColors = {
    high: 'border-red-500/50 bg-red-500/10',
    medium: 'border-yellow-500/50 bg-yellow-500/10',
    low: 'border-blue-500/50 bg-blue-500/10',
  };

  return (
    <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Recommended Actions (Priority Order)</h3>
      <div className="space-y-4">
        {recommendations.map((rec, idx) => (
          <div
            key={rec.id}
            className={`p-4 border rounded-lg ${priorityColors[rec.priority as keyof typeof priorityColors]}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg font-bold text-cscx-gray-400">{idx + 1}.</span>
              <div className="flex-1">
                <h4 className="font-medium text-white">{rec.title}</h4>
                <p className="text-sm text-cscx-gray-400 mt-1">{rec.description}</p>
                <p className="text-xs text-cscx-gray-500 mt-1 italic">{rec.impact}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {rec.actions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => onActionClick?.(action.type)}
                      className="px-3 py-1 text-xs font-medium bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const EngagementScoreBreakdown: React.FC<EngagementScoreBreakdownProps> = ({
  customerId,
  onBack,
  onScheduleMeeting,
  onSendEmail,
}) => {
  const {
    data,
    loading,
    error,
    refetch,
    trends,
    period,
    setPeriod,
    exportToCSV,
  } = useEngagementScore(customerId);

  const [activeTab, setActiveTab] = useState<'overview' | 'communication' | 'product' | 'relationship'>('overview');

  // Handle action clicks
  const handleActionClick = (actionType: string, actionData?: Record<string, unknown>) => {
    switch (actionType) {
      case 'schedule_meeting':
        onScheduleMeeting?.(actionData || {});
        break;
      case 'send_email':
        onSendEmail?.(actionData || {});
        break;
      default:
        console.log('Action clicked:', actionType, actionData);
    }
  };

  // Loading state
  if (loading && !data) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto mb-2" />
        <p className="text-cscx-gray-400">Loading engagement breakdown...</p>
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="p-8 text-center text-red-400">
        <p>{error}</p>
        <button
          onClick={refetch}
          className="mt-4 text-sm text-cscx-accent hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-cscx-gray-400">
        No engagement data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          {onBack && (
            <button
              onClick={onBack}
              className="text-cscx-gray-400 hover:text-white text-sm mb-2 flex items-center gap-1"
            >
              \u2190 Back
            </button>
          )}
          <h2 className="text-2xl font-bold text-white">
            Engagement Score Breakdown: {data.customer.name}
          </h2>
          <p className="text-cscx-gray-400 text-sm mt-1">
            Period: Last {period.replace('d', ' days')} | Updated: {new Date(data.updatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as '7d' | '14d' | '30d' | '60d' | '90d')}
            className="px-3 py-2 bg-cscx-gray-900 border border-cscx-gray-800 rounded-lg text-white text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="14d">Last 14 days</option>
            <option value="30d">Last 30 days</option>
            <option value="60d">Last 60 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button
            onClick={refetch}
            className="px-3 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg text-sm transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            className="px-3 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg text-sm transition-colors"
          >
            Export
          </button>
        </div>
      </div>

      {/* Overall Score */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-lg font-semibold text-white mb-2">Overall Engagement Score</h3>
            <ScoreGauge
              score={data.score.overall}
              trend={data.score.trend}
            />
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4">
            {data.composition.map((comp) => (
              <div key={comp.name} className="text-center p-3 bg-cscx-gray-800/50 rounded-lg">
                <p className="text-xs text-cscx-gray-400 uppercase">{comp.name}</p>
                <p className={`text-xl font-bold ${getStatusColor(comp.status)}`}>{comp.score}</p>
                <p className="text-xs text-cscx-gray-500">{Math.round(comp.weight * 100)}% weight</p>
              </div>
            ))}
          </div>
        </div>

        {/* Risk factors */}
        {data.score.riskFactors.length > 0 && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm font-medium text-red-400 mb-1">Risk Factors:</p>
            <ul className="list-disc list-inside text-sm text-cscx-gray-300">
              {data.score.riskFactors.map((risk, idx) => (
                <li key={idx}>{risk}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-cscx-gray-800">
        {(['overview', 'communication', 'product', 'relationship'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'text-cscx-accent border-b-2 border-cscx-accent'
                : 'text-cscx-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ScoreComposition
            composition={data.composition}
            overall={data.score.overall}
          />
          <TrendChart history={data.history} />
          <PeerComparisonCard comparison={data.peerComparison} />
          <ImpactAnalysisCard
            currentScore={data.score.overall}
            impact={data.impactAnalysis}
          />
          <div className="lg:col-span-2">
            <RecommendationsCard
              recommendations={data.score.recommendations}
              onActionClick={handleActionClick}
            />
          </div>
        </div>
      )}

      {activeTab === 'communication' && (
        <FactorDetails
          title="Communication Engagement"
          score={data.componentDetails.communication.score}
          factors={data.componentDetails.communication.factors}
          highlights={data.componentDetails.communication.highlights}
          actions={data.componentDetails.communication.actions}
          onActionClick={(action) => console.log('Action:', action)}
        />
      )}

      {activeTab === 'product' && (
        <FactorDetails
          title="Product Engagement"
          score={data.componentDetails.product.score}
          factors={data.componentDetails.product.factors}
          highlights={data.componentDetails.product.highlights}
          actions={data.componentDetails.product.actions}
          onActionClick={(action) => console.log('Action:', action)}
        />
      )}

      {activeTab === 'relationship' && (
        <FactorDetails
          title="Relationship Engagement"
          score={data.componentDetails.relationship.score}
          factors={data.componentDetails.relationship.factors}
          highlights={data.componentDetails.relationship.highlights}
          actions={data.componentDetails.relationship.actions}
          onActionClick={(action) => console.log('Action:', action)}
        />
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 p-4 bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl">
        <button
          onClick={() => handleActionClick('schedule_meeting')}
          className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg text-sm transition-colors"
        >
          Schedule Engagement Review
        </button>
        <button
          onClick={exportToCSV}
          className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg text-sm transition-colors"
        >
          Export Breakdown
        </button>
        <button
          onClick={() => console.log('Set alerts')}
          className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg text-sm transition-colors"
        >
          Set Alerts
        </button>
        <button
          onClick={() => console.log('Compare periods')}
          className="px-4 py-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg text-sm transition-colors"
        >
          Compare Periods
        </button>
      </div>
    </div>
  );
};

export default EngagementScoreBreakdown;
