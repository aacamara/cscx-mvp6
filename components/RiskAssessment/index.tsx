/**
 * Risk Assessment Component (PRD-229)
 * AI-powered deal and customer risk assessment display
 */

import React, { useState, useEffect, useCallback } from 'react';

// Types
interface IdentifiedRisk {
  id: string;
  category: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact_score: number;
  evidence: string[];
  detected_at: string;
  status: 'new' | 'acknowledged' | 'mitigating' | 'resolved';
}

interface Mitigation {
  risk_id: string;
  action: string;
  expected_impact: number;
  effort: 'low' | 'medium' | 'high';
  timeline: string;
  owner?: string;
}

interface DealComparison {
  similar_deals_won: number;
  similar_deals_lost: number;
  win_rate: number;
  key_differentiator: string;
  your_deal_missing: string[];
}

interface RiskTrend {
  direction: 'increasing' | 'decreasing' | 'stable';
  change_7d: number;
  change_30d?: number;
  history: Array<{ date: string; score: number }>;
}

interface RiskAssessment {
  id: string;
  customer_id: string;
  customer_name: string;
  deal_id?: string;
  deal_type?: string;
  deal_value?: number;
  close_date?: string;
  overall_risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  risks: IdentifiedRisk[];
  mitigations: Mitigation[];
  comparison?: DealComparison;
  trend: RiskTrend;
  model_version: string;
  assessed_at: string;
}

interface RiskAssessmentProps {
  customerId: string;
  dealId?: string;
  compact?: boolean;
  onStartMitigation?: (riskId: string, action: string) => void;
  className?: string;
}

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// Risk level colors and labels
const RISK_COLORS = {
  low: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', bar: 'bg-green-500' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', bar: 'bg-yellow-500' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', bar: 'bg-orange-500' },
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', bar: 'bg-red-500' }
};

const SEVERITY_ICONS = {
  low: '●',
  medium: '▲',
  high: '■',
  critical: '◆'
};

const CATEGORY_LABELS: Record<string, string> = {
  relationship: 'Relationship',
  product: 'Product/Health',
  commercial: 'Commercial',
  competitive: 'Competitive',
  timing: 'Timing',
  process: 'Process'
};

export const RiskAssessment: React.FC<RiskAssessmentProps> = ({
  customerId,
  dealId,
  compact = false,
  onStartMitigation,
  className = ''
}) => {
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRisks, setExpandedRisks] = useState<Set<string>>(new Set());

  // Fetch risk assessment
  const fetchAssessment = useCallback(async (refresh: boolean = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const endpoint = dealId
        ? `${API_BASE}/risk-assessment/deal/${dealId}`
        : `${API_BASE}/risk-assessment/customer/${customerId}`;

      const response = await fetch(`${endpoint}${refresh ? '?refresh=true' : ''}`);

      if (!response.ok) {
        throw new Error('Failed to fetch risk assessment');
      }

      const data = await response.json();
      if (data.success) {
        setAssessment(data.data);
      } else {
        throw new Error(data.error?.message || 'Failed to load assessment');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load risk assessment');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customerId, dealId]);

  useEffect(() => {
    fetchAssessment();
  }, [fetchAssessment]);

  // Toggle risk expansion
  const toggleRiskExpansion = (riskId: string) => {
    setExpandedRisks(prev => {
      const next = new Set(prev);
      if (next.has(riskId)) {
        next.delete(riskId);
      } else {
        next.add(riskId);
      }
      return next;
    });
  };

  // Handle mitigation start
  const handleStartMitigation = async (riskId: string, action: string) => {
    if (onStartMitigation) {
      onStartMitigation(riskId, action);
    } else {
      // Default: update risk status
      try {
        await fetch(`${API_BASE}/risk-assessment/customer/${customerId}/risks/${riskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'mitigating' })
        });
        fetchAssessment();
      } catch (err) {
        console.error('Failed to update risk status:', err);
      }
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className={`bg-cscx-gray-900 border border-zinc-800 rounded-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-zinc-800 rounded w-1/3 mb-4"></div>
          <div className="h-16 bg-zinc-800 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-zinc-800 rounded w-3/4"></div>
            <div className="h-4 bg-zinc-800 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`bg-cscx-gray-900 border border-zinc-800 rounded-lg p-6 ${className}`}>
        <div className="text-red-400 flex items-center gap-2">
          <span className="text-xl">!</span>
          <span>{error}</span>
        </div>
        <button
          onClick={() => fetchAssessment()}
          className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!assessment) return null;

  const colors = RISK_COLORS[assessment.risk_level];

  // Compact view (for sidebar/cards)
  if (compact) {
    return (
      <div className={`bg-cscx-gray-900 border border-zinc-800 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-zinc-300">Risk Score</h3>
          <span className={`text-xs px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
            {assessment.risk_level.toUpperCase()}
          </span>
        </div>

        <div className="flex items-end gap-3 mb-3">
          <span className={`text-3xl font-bold ${colors.text}`}>
            {assessment.overall_risk_score}
          </span>
          <span className="text-sm text-zinc-500 mb-1">/ 100</span>
          {assessment.trend.change_7d !== 0 && (
            <span className={`text-sm mb-1 ${assessment.trend.change_7d > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {assessment.trend.change_7d > 0 ? '+' : ''}{assessment.trend.change_7d}
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${colors.bar} transition-all duration-500`}
            style={{ width: `${assessment.overall_risk_score}%` }}
          />
        </div>

        {/* Top risk */}
        {assessment.risks.length > 0 && (
          <div className="mt-3 text-xs text-zinc-400">
            Top risk: {assessment.risks[0].name}
          </div>
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className={`bg-cscx-gray-900 border border-zinc-800 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            {dealId ? 'Deal Risk Assessment' : 'Customer Risk Assessment'}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">
              Updated {new Date(assessment.assessed_at).toLocaleDateString()}
            </span>
            <button
              onClick={() => fetchAssessment(true)}
              disabled={refreshing}
              className="p-1.5 hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"
              title="Refresh assessment"
            >
              <svg
                className={`w-4 h-4 text-zinc-400 ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Risk Score Display */}
        <div className="flex items-center gap-6">
          <div className="flex-shrink-0">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center border-4 ${colors.border} ${colors.bg}`}>
              <span className={`text-3xl font-bold ${colors.text}`}>
                {assessment.overall_risk_score}
              </span>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-lg font-semibold ${colors.text} uppercase`}>
                {assessment.risk_level} Risk
              </span>
              {assessment.trend.direction !== 'stable' && (
                <span className={`text-sm ${
                  assessment.trend.direction === 'increasing' ? 'text-red-400' : 'text-green-400'
                }`}>
                  {assessment.trend.direction === 'increasing' ? '↑' : '↓'} {Math.abs(assessment.trend.change_7d)} this week
                </span>
              )}
            </div>

            {/* Trend mini chart */}
            {assessment.trend.history.length > 1 && (
              <div className="flex items-end gap-1 h-8 mb-2">
                {assessment.trend.history.map((point, i) => (
                  <div
                    key={i}
                    className={`w-4 ${RISK_COLORS[
                      point.score >= 85 ? 'critical' :
                      point.score >= 70 ? 'high' :
                      point.score >= 50 ? 'medium' : 'low'
                    ].bar} rounded-t transition-all`}
                    style={{ height: `${Math.max(point.score, 10)}%` }}
                    title={`${point.date}: ${point.score}`}
                  />
                ))}
              </div>
            )}

            <div className="text-sm text-zinc-400">
              Confidence: {Math.round(assessment.confidence * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* Identified Risks */}
      <div className="p-6 border-b border-zinc-800">
        <h3 className="text-sm font-medium text-zinc-300 mb-4 uppercase tracking-wide">
          Identified Risks ({assessment.risks.length})
        </h3>

        <div className="space-y-3">
          {assessment.risks
            .sort((a, b) => b.impact_score - a.impact_score)
            .map(risk => {
              const riskColors = RISK_COLORS[risk.severity];
              const isExpanded = expandedRisks.has(risk.id);
              const mitigation = assessment.mitigations.find(m => m.risk_id === risk.id);

              return (
                <div
                  key={risk.id}
                  className={`border ${riskColors.border} rounded-lg overflow-hidden`}
                >
                  <div
                    className={`p-4 ${riskColors.bg} cursor-pointer`}
                    onClick={() => toggleRiskExpansion(risk.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className={`${riskColors.text} text-lg`}>
                          {SEVERITY_ICONS[risk.severity]}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{risk.name}</span>
                            <span className="text-xs px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">
                              {CATEGORY_LABELS[risk.category] || risk.category}
                            </span>
                            {risk.status !== 'new' && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                risk.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                                risk.status === 'mitigating' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {risk.status}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-400 mt-1">{risk.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-medium ${riskColors.text}`}>
                          +{risk.impact_score} pts
                        </span>
                        <svg
                          className={`w-5 h-5 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 bg-zinc-900/50 border-t border-zinc-800">
                      {/* Evidence */}
                      <div className="mb-4">
                        <h4 className="text-xs font-medium text-zinc-500 uppercase mb-2">Evidence</h4>
                        <ul className="space-y-1">
                          {risk.evidence.map((ev, i) => (
                            <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                              <span className="text-zinc-600">-</span>
                              <span>{ev}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Mitigation */}
                      {mitigation && (
                        <div className="p-3 bg-zinc-800/50 rounded-lg">
                          <h4 className="text-xs font-medium text-zinc-500 uppercase mb-2">
                            Recommended Mitigation
                          </h4>
                          <p className="text-sm text-white mb-2">{mitigation.action}</p>
                          <div className="flex items-center gap-4 text-xs text-zinc-400">
                            <span>
                              Impact: <span className="text-green-400">-{mitigation.expected_impact}%</span>
                            </span>
                            <span>Effort: {mitigation.effort}</span>
                            <span>Timeline: {mitigation.timeline}</span>
                          </div>
                          {risk.status === 'new' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartMitigation(risk.id, mitigation.action);
                              }}
                              className="mt-3 px-4 py-1.5 bg-cscx-accent hover:bg-cscx-accent/80 text-white text-sm rounded transition-colors"
                            >
                              Start Mitigation
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

          {assessment.risks.length === 0 && (
            <div className="text-center py-8 text-zinc-500">
              No significant risks identified
            </div>
          )}
        </div>
      </div>

      {/* Comparison to Similar Deals */}
      {assessment.comparison && (
        <div className="p-6 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-300 mb-4 uppercase tracking-wide">
            Comparison to Similar Deals
          </h3>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
              <div className="text-2xl font-bold text-white">
                {Math.round(assessment.comparison.win_rate * 100)}%
              </div>
              <div className="text-xs text-zinc-500">Win Rate</div>
            </div>
            <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
              <div className="text-2xl font-bold text-green-400">
                {assessment.comparison.similar_deals_won}
              </div>
              <div className="text-xs text-zinc-500">Similar Won</div>
            </div>
            <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
              <div className="text-2xl font-bold text-red-400">
                {assessment.comparison.similar_deals_lost}
              </div>
              <div className="text-xs text-zinc-500">Similar Lost</div>
            </div>
          </div>

          {assessment.comparison.your_deal_missing.length > 0 && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <h4 className="text-sm font-medium text-yellow-400 mb-2">
                Missing from Won Deals Pattern
              </h4>
              <ul className="space-y-1">
                {assessment.comparison.your_deal_missing.map((item, i) => (
                  <li key={i} className="text-sm text-zinc-300 flex items-center gap-2">
                    <span className="text-yellow-500">!</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchAssessment(true)}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition-colors"
          >
            Refresh Analysis
          </button>
          <button
            className="px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg text-sm transition-colors"
          >
            Export Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default RiskAssessment;
