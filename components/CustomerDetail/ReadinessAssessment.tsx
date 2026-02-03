/**
 * ReadinessAssessment Component (PRD-085)
 *
 * Displays account readiness assessment for major milestones.
 * Shows dimension scores, gap analysis, and actionable checklists.
 */

import React, { useState, useEffect, useCallback } from 'react';

// ============================================
// Types
// ============================================

type MilestoneType = 'renewal' | 'expansion' | 'qbr' | 'onboarding_complete' | 'executive_briefing';
type DimensionStatus = 'strong' | 'good' | 'gap' | 'critical';
type GapPriority = 'critical' | 'high' | 'medium' | 'low';

interface DataPoint {
  metric: string;
  value: string | number;
  benchmark: string | number | null;
  trend: 'up' | 'down' | 'stable' | 'unknown';
  impact: 'positive' | 'negative' | 'neutral';
}

interface ReadinessDimension {
  name: string;
  score: number;
  weight: number;
  status: DimensionStatus;
  description: string;
  dataPoints: DataPoint[];
  recommendations: string[];
}

interface ReadinessGap {
  dimension: string;
  score: number;
  priority: GapPriority;
  issue: string;
  impact: string;
  suggestedAction: string;
  effort: 'low' | 'medium' | 'high';
  timeToAddress: string;
  isBlocker: boolean;
}

interface ChecklistItem {
  id: string;
  task: string;
  description: string;
  dueDate: string | null;
  priority: GapPriority;
  dimension: string;
  completed: boolean;
  completedAt: string | null;
  assignee: string | null;
  notes: string | null;
}

interface ReadinessAssessmentData {
  assessmentId: string;
  customerId: string;
  customerName: string;
  milestoneType: MilestoneType;
  milestoneDate: string | null;
  daysUntilMilestone: number | null;
  overallScore: number;
  overallStatus: DimensionStatus;
  trend: 'improving' | 'stable' | 'declining';
  dimensions: {
    productAdoption: ReadinessDimension;
    stakeholderEngagement: ReadinessDimension;
    valueRealization: ReadinessDimension;
    supportHealth: ReadinessDimension;
    executiveAlignment: ReadinessDimension;
    financialHealth: ReadinessDimension;
  };
  gaps: ReadinessGap[];
  checklist: ChecklistItem[];
  aiSummary: string;
  aiRecommendations: string[];
  riskFactors: string[];
  successFactors: string[];
  assessedAt: string;
  dataQuality: 'poor' | 'fair' | 'good' | 'excellent';
  confidence: number;
}

interface ReadinessAssessmentProps {
  customerId: string;
  customerName: string;
  milestoneType?: MilestoneType;
  milestoneDate?: string;
  compact?: boolean;
  onActionClick?: (action: string, data: any) => void;
}

// ============================================
// Constants
// ============================================

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

const MILESTONE_LABELS: Record<MilestoneType, string> = {
  renewal: 'Renewal',
  expansion: 'Expansion',
  qbr: 'QBR',
  onboarding_complete: 'Onboarding',
  executive_briefing: 'Exec Briefing',
};

const STATUS_COLORS: Record<DimensionStatus, { bg: string; text: string; border: string }> = {
  strong: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  good: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  gap: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
};

const PRIORITY_COLORS: Record<GapPriority, { bg: string; text: string; dot: string }> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400', dot: 'bg-orange-500' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500' },
  low: { bg: 'bg-gray-500/10', text: 'text-gray-400', dot: 'bg-gray-500' },
};

// ============================================
// Component
// ============================================

export const ReadinessAssessment: React.FC<ReadinessAssessmentProps> = ({
  customerId,
  customerName,
  milestoneType = 'renewal',
  milestoneDate,
  compact = false,
  onActionClick,
}) => {
  const [assessment, setAssessment] = useState<ReadinessAssessmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'gaps' | 'checklist' | 'details'>('overview');
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneType>(milestoneType);
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);

  // Fetch assessment
  const fetchAssessment = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        milestoneType: selectedMilestone,
        ...(milestoneDate && { milestoneDate }),
      });

      const response = await fetch(`${API_BASE}/readiness/${customerId}?${params}`);
      const data = await response.json();

      if (data.success) {
        setAssessment(data.data);
      } else {
        throw new Error(data.error?.message || 'Failed to fetch assessment');
      }
    } catch (err) {
      console.error('Error fetching readiness assessment:', err);
      setError(err instanceof Error ? err.message : 'Failed to load assessment');
    } finally {
      setLoading(false);
    }
  }, [customerId, selectedMilestone, milestoneDate]);

  useEffect(() => {
    fetchAssessment();
  }, [fetchAssessment]);

  // Toggle checklist item
  const toggleChecklistItem = async (itemId: string, completed: boolean) => {
    if (!assessment) return;

    try {
      const response = await fetch(
        `${API_BASE}/readiness/${assessment.assessmentId}/checklist/${itemId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed }),
        }
      );

      if (response.ok) {
        setAssessment(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            checklist: prev.checklist.map(item =>
              item.id === itemId
                ? { ...item, completed, completedAt: completed ? new Date().toISOString() : null }
                : item
            ),
          };
        });
      }
    } catch (err) {
      console.error('Error updating checklist item:', err);
    }
  };

  // Get score color
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 65) return 'text-blue-400';
    if (score >= 45) return 'text-amber-400';
    return 'text-red-400';
  };

  // Get status icon
  const getStatusIcon = (status: DimensionStatus): string => {
    switch (status) {
      case 'strong': return '\u2705'; // checkmark
      case 'good': return '\u2705';
      case 'gap': return '\u26A0\uFE0F'; // warning
      case 'critical': return '\uD83D\uDD34'; // red circle
    }
  };

  // Get trend icon
  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'improving': return '\u2197\uFE0F';
      case 'declining': return '\u2198\uFE0F';
      default: return '\u27A1\uFE0F';
    }
  };

  // Format date
  const formatDate = (date: string | null): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Render loading state
  if (loading) {
    return (
      <div className="bg-cscx-gray-900 rounded-lg border border-white/10 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/10 rounded w-1/3" />
          <div className="h-24 bg-white/10 rounded" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-white/10 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="bg-cscx-gray-900 rounded-lg border border-red-500/30 p-6">
        <div className="flex items-center gap-3 text-red-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
        <button
          onClick={fetchAssessment}
          className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!assessment) return null;

  // Calculate checklist progress
  const completedTasks = assessment.checklist.filter(i => i.completed).length;
  const totalTasks = assessment.checklist.length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Compact view
  if (compact) {
    return (
      <div className="bg-cscx-gray-900 rounded-lg border border-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white/80">
            {MILESTONE_LABELS[assessment.milestoneType]} Readiness
          </h3>
          <span className={`text-2xl font-bold ${getScoreColor(assessment.overallScore)}`}>
            {assessment.overallScore}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/60">
          <span className={STATUS_COLORS[assessment.overallStatus].text}>
            {getStatusIcon(assessment.overallStatus)} {assessment.overallStatus}
          </span>
          <span>|</span>
          <span>{assessment.gaps.length} gaps</span>
          <span>|</span>
          <span>{progressPercent}% complete</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cscx-gray-900 rounded-lg border border-white/10">
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Readiness Assessment</h2>
            <p className="text-sm text-white/60 mt-1">
              {customerName} - {MILESTONE_LABELS[assessment.milestoneType]}
              {assessment.milestoneDate && ` (${formatDate(assessment.milestoneDate)})`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedMilestone}
              onChange={(e) => setSelectedMilestone(e.target.value as MilestoneType)}
              className="bg-white/10 border border-white/20 rounded px-3 py-2 text-sm text-white"
            >
              <option value="renewal">Renewal</option>
              <option value="expansion">Expansion</option>
              <option value="qbr">QBR</option>
              <option value="onboarding_complete">Onboarding</option>
              <option value="executive_briefing">Exec Briefing</option>
            </select>
            <button
              onClick={fetchAssessment}
              className="p-2 hover:bg-white/10 rounded transition-colors"
              title="Refresh"
            >
              <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Score Overview */}
        <div className="grid grid-cols-4 gap-4">
          <div className={`p-4 rounded-lg ${STATUS_COLORS[assessment.overallStatus].bg} border ${STATUS_COLORS[assessment.overallStatus].border}`}>
            <div className="text-sm text-white/60 mb-1">Overall Score</div>
            <div className={`text-3xl font-bold ${getScoreColor(assessment.overallScore)}`}>
              {assessment.overallScore}
              <span className="text-base font-normal">/100</span>
            </div>
            <div className="text-xs text-white/50 mt-1">
              {getTrendIcon(assessment.trend)} {assessment.trend}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="text-sm text-white/60 mb-1">Days Until</div>
            <div className="text-2xl font-bold text-white">
              {assessment.daysUntilMilestone ?? 'N/A'}
            </div>
            <div className="text-xs text-white/50 mt-1">
              {assessment.milestoneDate ? formatDate(assessment.milestoneDate) : 'No date set'}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="text-sm text-white/60 mb-1">Gaps to Address</div>
            <div className="text-2xl font-bold text-white">
              {assessment.gaps.length}
            </div>
            <div className="text-xs text-white/50 mt-1">
              {assessment.gaps.filter(g => g.isBlocker).length} blockers
            </div>
          </div>

          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="text-sm text-white/60 mb-1">Checklist Progress</div>
            <div className="text-2xl font-bold text-white">
              {progressPercent}%
            </div>
            <div className="h-1.5 bg-white/10 rounded-full mt-2">
              <div
                className="h-full bg-cscx-accent rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10">
        <div className="flex gap-1 px-6">
          {(['overview', 'gaps', 'checklist', 'details'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'text-cscx-accent border-cscx-accent'
                  : 'text-white/60 border-transparent hover:text-white/80'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'gaps' && assessment.gaps.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-red-500/20 text-red-400">
                  {assessment.gaps.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* AI Summary */}
            {assessment.aiSummary && (
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <h3 className="text-sm font-medium text-white/80 mb-2">AI Summary</h3>
                <p className="text-sm text-white/70">{assessment.aiSummary}</p>
              </div>
            )}

            {/* Dimension Scores */}
            <div>
              <h3 className="text-sm font-medium text-white/80 mb-3">Dimension Scores</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(assessment.dimensions).map(([key, dimension]) => (
                  <div
                    key={key}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      STATUS_COLORS[dimension.status].bg
                    } ${STATUS_COLORS[dimension.status].border} hover:bg-white/10`}
                    onClick={() => setExpandedDimension(expandedDimension === key ? null : key)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{getStatusIcon(dimension.status)}</span>
                        <span className="text-sm font-medium text-white">{dimension.name}</span>
                      </div>
                      <span className={`text-lg font-bold ${getScoreColor(dimension.score)}`}>
                        {dimension.score}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 mt-1">{dimension.description}</p>

                    {/* Expanded Details */}
                    {expandedDimension === key && (
                      <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                        {dimension.dataPoints.map((dp, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="text-white/60">{dp.metric}</span>
                            <span className={`font-medium ${
                              dp.impact === 'positive' ? 'text-emerald-400' :
                              dp.impact === 'negative' ? 'text-red-400' : 'text-white/80'
                            }`}>
                              {dp.value}
                            </span>
                          </div>
                        ))}
                        {dimension.recommendations.length > 0 && (
                          <div className="pt-2 border-t border-white/10">
                            <div className="text-xs text-white/50 mb-1">Recommendations:</div>
                            <ul className="text-xs text-white/70 space-y-1">
                              {dimension.recommendations.map((rec, idx) => (
                                <li key={idx}>- {rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Risk and Success Factors */}
            <div className="grid grid-cols-2 gap-4">
              {assessment.riskFactors.length > 0 && (
                <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                  <h3 className="text-sm font-medium text-red-400 mb-2">Risk Factors</h3>
                  <ul className="text-sm text-white/70 space-y-1">
                    {assessment.riskFactors.map((risk, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">-</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {assessment.successFactors.length > 0 && (
                <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <h3 className="text-sm font-medium text-emerald-400 mb-2">Success Factors</h3>
                  <ul className="text-sm text-white/70 space-y-1">
                    {assessment.successFactors.map((factor, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5">+</span>
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Gaps Tab */}
        {activeTab === 'gaps' && (
          <div className="space-y-4">
            {assessment.gaps.length === 0 ? (
              <div className="text-center py-8 text-white/60">
                No significant gaps identified
              </div>
            ) : (
              assessment.gaps.map((gap, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${PRIORITY_COLORS[gap.priority].bg} ${
                    gap.isBlocker ? 'border-red-500/50' : 'border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[gap.priority].dot}`} />
                      <span className="font-medium text-white">{gap.dimension}</span>
                      {gap.isBlocker && (
                        <span className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-400">
                          Blocker
                        </span>
                      )}
                    </div>
                    <span className={`text-lg font-bold ${getScoreColor(gap.score)}`}>
                      {gap.score}/100
                    </span>
                  </div>
                  <p className="text-sm text-white/70 mb-2">{gap.issue}</p>
                  <div className="flex items-center gap-4 text-xs text-white/50">
                    <span>Impact: {gap.impact}</span>
                    <span>Effort: {gap.effort}</span>
                    <span>Time: {gap.timeToAddress}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="text-xs text-white/50 mb-1">Suggested Action:</div>
                    <p className="text-sm text-cscx-accent">{gap.suggestedAction}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Checklist Tab */}
        {activeTab === 'checklist' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-white/60">
                {completedTasks} of {totalTasks} tasks complete
              </span>
              <button
                onClick={() => onActionClick?.('create_tasks', assessment.checklist)}
                className="px-3 py-1.5 text-sm bg-cscx-accent/20 text-cscx-accent rounded hover:bg-cscx-accent/30 transition-colors"
              >
                Create Tasks
              </button>
            </div>
            {assessment.checklist.map((item) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  item.completed
                    ? 'bg-white/5 border-white/10 opacity-60'
                    : `${PRIORITY_COLORS[item.priority].bg} border-white/10`
                }`}
              >
                <button
                  onClick={() => toggleChecklistItem(item.id, !item.completed)}
                  className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                    item.completed
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-white/30 hover:border-white/50'
                  }`}
                >
                  {item.completed && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${item.completed ? 'line-through text-white/50' : 'text-white'}`}>
                      {item.task}
                    </span>
                    <span className={`px-1.5 py-0.5 text-xs rounded ${PRIORITY_COLORS[item.priority].bg} ${PRIORITY_COLORS[item.priority].text}`}>
                      {item.priority}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-0.5">{item.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                    <span>{item.dimension}</span>
                    {item.dueDate && <span>Due: {formatDate(item.dueDate)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            {/* AI Recommendations */}
            {assessment.aiRecommendations.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-white/80 mb-3">AI Recommendations</h3>
                <div className="space-y-2">
                  {assessment.aiRecommendations.map((rec, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-start gap-2">
                        <span className="text-cscx-accent font-medium">{idx + 1}.</span>
                        <span className="text-sm text-white/80">{rec}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assessment Metadata */}
            <div>
              <h3 className="text-sm font-medium text-white/80 mb-3">Assessment Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-white/50">Assessment ID</div>
                  <div className="text-sm text-white/80 font-mono">{assessment.assessmentId.slice(0, 8)}...</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-white/50">Assessed At</div>
                  <div className="text-sm text-white/80">{formatDate(assessment.assessedAt)}</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-white/50">Data Quality</div>
                  <div className={`text-sm font-medium ${
                    assessment.dataQuality === 'excellent' ? 'text-emerald-400' :
                    assessment.dataQuality === 'good' ? 'text-blue-400' :
                    assessment.dataQuality === 'fair' ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {assessment.dataQuality.charAt(0).toUpperCase() + assessment.dataQuality.slice(1)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-white/50">Confidence</div>
                  <div className="text-sm text-white/80">{assessment.confidence}%</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => onActionClick?.('generate_report', assessment)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-sm transition-colors"
              >
                Generate Full Report
              </button>
              <button
                onClick={() => onActionClick?.('view_history', { customerId })}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-sm transition-colors"
              >
                View Historical Assessments
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReadinessAssessment;
