/**
 * HealthInsights Component
 *
 * AI-powered health score insights and recommendations panel.
 * Displays health trends, AI-generated insights, predictions, and interventions.
 */

import React, { useState, useEffect, useCallback } from 'react';

// Types
interface HealthInsight {
  id: string;
  category: string;
  severity: 'info' | 'warning' | 'critical' | 'positive';
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  confidence: number;
  dataPoints: string[];
}

interface HealthPredictionPoint {
  daysAhead: number;
  predictedScore: number;
  confidenceInterval: { low: number; high: number };
  keyFactors: string[];
}

interface InterventionRecommendation {
  intervention: string;
  description: string;
  expectedHealthImpact: number;
  confidence: number;
  timeToImpactDays: number;
  effort: 'low' | 'medium' | 'high';
  priority: number;
  category: string;
}

interface HealthScoreBreakdown {
  usage: number;
  engagement: number;
  risk: number;
  business: number;
  overall: number;
}

interface HealthInsightsResponse {
  customerId: string;
  customerName: string;
  generatedAt: string;
  currentHealth: number;
  previousHealth: number | null;
  trend: 'improving' | 'stable' | 'declining' | 'volatile';
  scoreBreakdown: HealthScoreBreakdown;
  insights: HealthInsight[];
  predictions: HealthPredictionPoint[];
  interventions: InterventionRecommendation[];
  executiveSummary: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  arrAtRisk: number;
  daysToRenewal: number | null;
  confidence: number;
  dataQuality: 'poor' | 'fair' | 'good' | 'excellent';
  lastDataUpdate: string | null;
}

interface HealthInsightsProps {
  customerId: string;
  customerName: string;
  compact?: boolean;
  onActionClick?: (action: string, data: any) => void;
}

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

export const HealthInsights: React.FC<HealthInsightsProps> = ({
  customerId,
  customerName,
  compact = false,
  onActionClick,
}) => {
  const [insights, setInsights] = useState<HealthInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'insights' | 'predictions' | 'actions'>('insights');
  const [feedbackGiven, setFeedbackGiven] = useState<Set<string>>(new Set());

  // Fetch insights
  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/health-insights/${customerId}`);
      const data = await response.json();

      if (data.success) {
        setInsights(data.data);
      } else {
        throw new Error(data.error?.message || 'Failed to fetch insights');
      }
    } catch (err) {
      console.error('Error fetching health insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  // Handle feedback submission
  const handleFeedback = async (insightId: string, helpful: boolean) => {
    try {
      await fetch(`${API_BASE}/health-insights/${customerId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId, helpful, actionTaken: false }),
      });
      setFeedbackGiven(prev => new Set([...prev, insightId]));
    } catch (err) {
      console.error('Error submitting feedback:', err);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/health-insights/${customerId}/refresh`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        setInsights(data.data);
      }
    } catch (err) {
      console.error('Error refreshing insights:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get color classes based on severity/score
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/20 border-red-500/30 text-red-400';
      case 'warning':
        return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
      case 'positive':
        return 'bg-green-500/20 border-green-500/30 text-green-400';
      default:
        return 'bg-blue-500/20 border-blue-500/30 text-blue-400';
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return { icon: '\u2191', color: 'text-green-400' };
      case 'declining':
        return { icon: '\u2193', color: 'text-red-400' };
      case 'volatile':
        return { icon: '\u2194', color: 'text-yellow-400' };
      default:
        return { icon: '\u2192', color: 'text-gray-400' };
    }
  };

  const getRiskLevelBadge = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-green-500/20 text-green-400 border-green-500/30';
    }
  };

  const getEffortBadge = (effort: string) => {
    switch (effort) {
      case 'low':
        return 'bg-green-500/20 text-green-400';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'high':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      usage: '\ud83d\udcca',
      engagement: '\ud83e\udd1d',
      support: '\ud83c\udfaf',
      business: '\ud83d\udcbc',
      stakeholder: '\ud83d\udc65',
      renewal: '\ud83d\udcc5',
      opportunity: '\ud83d\udca1',
    };
    return icons[category] || '\ud83d\udccc';
  };

  if (loading) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-cscx-accent border-t-transparent rounded-full" />
          <span className="ml-3 text-cscx-gray-400">Generating AI insights...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-6">
        <div className="text-center py-4">
          <p className="text-red-400 mb-2">{error}</p>
          <button
            onClick={fetchInsights}
            className="text-sm text-cscx-accent hover:underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!insights) return null;

  const trendInfo = getTrendIcon(insights.trend);

  // Compact view
  if (compact) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <span>\ud83e\udde0</span>
            AI Health Insights
          </h3>
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getRiskLevelBadge(insights.riskLevel)}`}>
            {insights.riskLevel}
          </span>
        </div>

        {/* Quick Summary */}
        <p className="text-xs text-cscx-gray-400 mb-3">{insights.executiveSummary}</p>

        {/* Top Insight */}
        {insights.insights.length > 0 && (
          <div className={`p-2 rounded-lg border mb-3 ${getSeverityColor(insights.insights[0].severity)}`}>
            <p className="text-xs font-medium">{insights.insights[0].title}</p>
            <p className="text-xs opacity-80 mt-1">{insights.insights[0].recommendation}</p>
          </div>
        )}

        {/* Top Action */}
        {insights.interventions.length > 0 && (
          <button
            onClick={() => onActionClick?.('intervention', insights.interventions[0])}
            className="w-full text-left p-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 rounded-lg transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-white">{insights.interventions[0].intervention}</span>
              <span className="text-xs text-green-400">+{insights.interventions[0].expectedHealthImpact} pts</span>
            </div>
          </button>
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl">
      {/* Header */}
      <div className="p-6 border-b border-cscx-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">\ud83e\udde0</span>
            <div>
              <h2 className="text-lg font-semibold text-white">AI Health Insights</h2>
              <p className="text-xs text-cscx-gray-400">
                Generated {new Date(insights.generatedAt).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getRiskLevelBadge(insights.riskLevel)}`}>
              {insights.riskLevel.charAt(0).toUpperCase() + insights.riskLevel.slice(1)} Risk
            </span>
            <button
              onClick={handleRefresh}
              className="p-2 text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800 rounded-lg transition-colors"
              title="Refresh insights"
            >
              \u21bb
            </button>
          </div>
        </div>

        {/* Health Score Overview */}
        <div className="grid grid-cols-4 gap-4">
          {/* Current Score */}
          <div className="text-center">
            <div className="relative inline-block">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="#222"
                  strokeWidth="6"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke={insights.currentHealth >= 80 ? '#22c55e' : insights.currentHealth >= 60 ? '#eab308' : insights.currentHealth >= 40 ? '#f97316' : '#ef4444'}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(insights.currentHealth / 100) * 226} 226`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-xl font-bold ${getHealthColor(insights.currentHealth)}`}>
                  {insights.currentHealth}
                </span>
              </div>
            </div>
            <p className="text-xs text-cscx-gray-400 mt-1">Current</p>
          </div>

          {/* Trend */}
          <div className="flex flex-col items-center justify-center">
            <span className={`text-3xl ${trendInfo.color}`}>{trendInfo.icon}</span>
            <p className="text-sm text-white capitalize mt-1">{insights.trend}</p>
            <p className="text-xs text-cscx-gray-400">Trend</p>
          </div>

          {/* ARR at Risk */}
          <div className="flex flex-col items-center justify-center">
            <span className={`text-xl font-bold ${insights.arrAtRisk > 0 ? 'text-red-400' : 'text-green-400'}`}>
              ${insights.arrAtRisk > 0 ? insights.arrAtRisk.toLocaleString() : '0'}
            </span>
            <p className="text-xs text-cscx-gray-400 mt-1">ARR at Risk</p>
          </div>

          {/* Renewal */}
          <div className="flex flex-col items-center justify-center">
            <span className={`text-xl font-bold ${
              insights.daysToRenewal !== null && insights.daysToRenewal <= 30 ? 'text-red-400' :
              insights.daysToRenewal !== null && insights.daysToRenewal <= 60 ? 'text-yellow-400' : 'text-white'
            }`}>
              {insights.daysToRenewal !== null ? `${insights.daysToRenewal}d` : '-'}
            </span>
            <p className="text-xs text-cscx-gray-400 mt-1">To Renewal</p>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="mt-4 p-3 bg-cscx-gray-800 rounded-lg">
          <p className="text-sm text-cscx-gray-300">{insights.executiveSummary}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-cscx-gray-800">
        {(['insights', 'predictions', 'actions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-cscx-accent border-b-2 border-cscx-accent'
                : 'text-cscx-gray-400 hover:text-white'
            }`}
          >
            {tab === 'insights' && `Insights (${insights.insights.length})`}
            {tab === 'predictions' && 'Predictions'}
            {tab === 'actions' && `Actions (${insights.interventions.length})`}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {/* Insights Tab */}
        {activeTab === 'insights' && (
          <div className="space-y-4">
            {insights.insights.map((insight) => (
              <div
                key={insight.id}
                className={`p-4 rounded-lg border ${getSeverityColor(insight.severity)}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{getCategoryIcon(insight.category)}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium">{insight.title}</h4>
                      <span className="text-xs opacity-70">{insight.confidence}% confidence</span>
                    </div>
                    <p className="text-sm opacity-90 mb-2">{insight.description}</p>

                    {insight.impact && (
                      <p className="text-xs opacity-80 mb-2">
                        <strong>Impact:</strong> {insight.impact}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs bg-black/20 px-2 py-1 rounded">
                        \u2192 {insight.recommendation}
                      </p>

                      {!feedbackGiven.has(insight.id) && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs opacity-70 mr-2">Helpful?</span>
                          <button
                            onClick={() => handleFeedback(insight.id, true)}
                            className="p-1 hover:bg-white/10 rounded"
                            title="Yes, helpful"
                          >
                            \ud83d\udc4d
                          </button>
                          <button
                            onClick={() => handleFeedback(insight.id, false)}
                            className="p-1 hover:bg-white/10 rounded"
                            title="Not helpful"
                          >
                            \ud83d\udc4e
                          </button>
                        </div>
                      )}
                      {feedbackGiven.has(insight.id) && (
                        <span className="text-xs opacity-50">Thanks for feedback!</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {insights.insights.length === 0 && (
              <p className="text-center text-cscx-gray-400 py-4">
                No insights available. Customer data may be limited.
              </p>
            )}
          </div>
        )}

        {/* Predictions Tab */}
        {activeTab === 'predictions' && (
          <div className="space-y-6">
            {/* Prediction Chart */}
            <div className="h-48 relative">
              <div className="absolute inset-0 flex items-end justify-around px-4">
                {/* Current */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 rounded-t-lg ${getHealthBg(insights.currentHealth)}`}
                    style={{ height: `${insights.currentHealth * 1.5}px` }}
                  />
                  <span className="text-xs text-cscx-gray-400 mt-2">Now</span>
                  <span className={`text-sm font-bold ${getHealthColor(insights.currentHealth)}`}>
                    {insights.currentHealth}
                  </span>
                </div>

                {/* Predictions */}
                {insights.predictions.map((pred) => (
                  <div key={pred.daysAhead} className="flex flex-col items-center">
                    <div className="relative">
                      {/* Confidence interval */}
                      <div
                        className="w-12 bg-cscx-gray-700 rounded-t-lg absolute bottom-0"
                        style={{ height: `${pred.confidenceInterval.high * 1.5}px` }}
                      />
                      {/* Predicted value */}
                      <div
                        className={`w-12 rounded-t-lg relative ${getHealthBg(pred.predictedScore)} opacity-70`}
                        style={{ height: `${pred.predictedScore * 1.5}px` }}
                      />
                    </div>
                    <span className="text-xs text-cscx-gray-400 mt-2">{pred.daysAhead}d</span>
                    <span className={`text-sm font-bold ${getHealthColor(pred.predictedScore)}`}>
                      {pred.predictedScore}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Prediction Details */}
            <div className="space-y-3">
              {insights.predictions.map((pred) => (
                <div key={pred.daysAhead} className="p-3 bg-cscx-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{pred.daysAhead}-Day Forecast</span>
                    <span className={`text-lg font-bold ${getHealthColor(pred.predictedScore)}`}>
                      {pred.predictedScore}
                      <span className="text-xs text-cscx-gray-400 ml-1">
                        ({pred.confidenceInterval.low}-{pred.confidenceInterval.high})
                      </span>
                    </span>
                  </div>
                  <ul className="text-xs text-cscx-gray-400 space-y-1">
                    {pred.keyFactors.map((factor, idx) => (
                      <li key={idx}>\u2022 {factor}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <p className="text-xs text-cscx-gray-500 text-center">
              Predictions based on historical trends and current metrics. Confidence: {insights.confidence}%
            </p>
          </div>
        )}

        {/* Actions Tab */}
        {activeTab === 'actions' && (
          <div className="space-y-4">
            {insights.interventions.map((intervention, idx) => (
              <div
                key={idx}
                className="p-4 bg-cscx-gray-800 rounded-lg border border-cscx-gray-700 hover:border-cscx-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-cscx-accent text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {intervention.priority}
                    </span>
                    <h4 className="font-medium text-white">{intervention.intervention}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded ${getEffortBadge(intervention.effort)}`}>
                      {intervention.effort} effort
                    </span>
                    <span className="text-green-400 font-medium">
                      +{intervention.expectedHealthImpact} pts
                    </span>
                  </div>
                </div>

                <p className="text-sm text-cscx-gray-400 mb-3">{intervention.description}</p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-cscx-gray-500">
                    <span>\u23f1 {intervention.timeToImpactDays} days to impact</span>
                    <span>{intervention.confidence}% confidence</span>
                  </div>

                  <button
                    onClick={() => onActionClick?.('intervention', intervention)}
                    className="px-3 py-1.5 bg-cscx-accent hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                  >
                    Take Action
                  </button>
                </div>
              </div>
            ))}

            {insights.interventions.length === 0 && (
              <p className="text-center text-cscx-gray-400 py-4">
                No interventions recommended. Customer appears healthy.
              </p>
            )}

            {/* Combined Impact */}
            {insights.interventions.length > 1 && (
              <div className="p-4 bg-cscx-accent/10 border border-cscx-accent/30 rounded-lg">
                <p className="text-sm text-cscx-accent">
                  <strong>Combined Impact:</strong> Taking all recommended actions could improve health by{' '}
                  <span className="font-bold">
                    +{insights.interventions.reduce((sum, i) => sum + i.expectedHealthImpact, 0)} points
                  </span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-cscx-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-cscx-gray-500">
          <span>Data quality: {insights.dataQuality}</span>
          {insights.lastDataUpdate && (
            <span>Last data: {new Date(insights.lastDataUpdate).toLocaleDateString()}</span>
          )}
        </div>
        <span className="text-xs text-cscx-gray-500">
          Powered by Claude AI
        </span>
      </div>
    </div>
  );
};

export default HealthInsights;
