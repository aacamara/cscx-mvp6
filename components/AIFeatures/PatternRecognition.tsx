/**
 * Pattern Recognition Component (PRD-233)
 *
 * Displays AI-detected behavioral patterns for customers:
 * - Pattern cards with severity indicators
 * - Pattern type filtering
 * - Meeting prep integration
 * - Actionable insights and recommendations
 */

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ==================== Types ====================

type PatternType =
  | 'communication'
  | 'engagement'
  | 'risk'
  | 'success'
  | 'meeting'
  | 'stakeholder'
  | 'usage';

type PatternSeverity = 'info' | 'warning' | 'critical' | 'positive';

interface DetectedPattern {
  id: string;
  customerId: string;
  type: PatternType;
  name: string;
  description: string;
  severity: PatternSeverity;
  confidence: 'low' | 'medium' | 'high';
  confidenceScore: number;
  insight: string;
  suggestedAction?: string;
  detectedAt: string;
}

interface PatternAnalysisResult {
  customerId: string;
  customerName: string;
  patterns: DetectedPattern[];
  summary: string;
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  topInsights: string[];
  recommendedActions: string[];
  analysisTimestamp: string;
  dataQuality: number;
}

interface MeetingPatternResult {
  customerId: string;
  meetingType: string;
  relevantPatterns: DetectedPattern[];
  meetingInsights: string[];
  preparationTips: string[];
}

// ==================== Props ====================

interface PatternRecognitionProps {
  customerId: string;
  customerName?: string;
  meetingType?: string;
  compact?: boolean;
  onPatternClick?: (pattern: DetectedPattern) => void;
}

// ==================== Component ====================

export const PatternRecognition: React.FC<PatternRecognitionProps> = ({
  customerId,
  customerName,
  meetingType,
  compact = false,
  onPatternClick
}) => {
  const [analysis, setAnalysis] = useState<PatternAnalysisResult | null>(null);
  const [meetingPatterns, setMeetingPatterns] = useState<MeetingPatternResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<PatternType | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch patterns
  const fetchPatterns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch main pattern analysis
      const analysisResponse = await fetch(`${API_BASE}/patterns/${customerId}`);
      const analysisData = await analysisResponse.json();

      if (analysisData.success) {
        setAnalysis(analysisData.data);
      } else {
        throw new Error(analysisData.error?.message || 'Failed to fetch patterns');
      }

      // If meeting type provided, fetch meeting-specific patterns
      if (meetingType) {
        const meetingResponse = await fetch(
          `${API_BASE}/patterns/${customerId}/meeting?meetingType=${meetingType}`
        );
        const meetingData = await meetingResponse.json();

        if (meetingData.success) {
          setMeetingPatterns(meetingData.data);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [customerId, meetingType]);

  // Refresh patterns
  const refreshPatterns = async () => {
    try {
      setRefreshing(true);
      const response = await fetch(`${API_BASE}/patterns/${customerId}/refresh`, {
        method: 'POST'
      });
      const data = await response.json();

      if (data.success) {
        setAnalysis(data.data);
      }
    } catch (err) {
      console.error('Error refreshing patterns:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  // Filter patterns by type
  const filteredPatterns = analysis?.patterns.filter(
    p => selectedType === 'all' || p.type === selectedType
  ) || [];

  // Helpers
  const getSeverityColor = (severity: PatternSeverity) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'warning': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'positive': return 'text-green-400 bg-green-500/10 border-green-500/30';
      default: return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    }
  };

  const getSeverityIcon = (severity: PatternSeverity) => {
    switch (severity) {
      case 'critical': return '!';
      case 'warning': return '*';
      case 'positive': return '+';
      default: return 'i';
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-yellow-400';
      default: return 'text-green-400';
    }
  };

  const getTypeIcon = (type: PatternType) => {
    const icons: Record<PatternType, string> = {
      communication: 'M',
      engagement: 'E',
      risk: 'R',
      success: 'S',
      meeting: 'C',
      stakeholder: 'P',
      usage: 'U'
    };
    return icons[type] || '?';
  };

  const getTypeLabel = (type: PatternType) => {
    const labels: Record<PatternType, string> = {
      communication: 'Communication',
      engagement: 'Engagement',
      risk: 'Risk',
      success: 'Success',
      meeting: 'Meeting',
      stakeholder: 'Stakeholder',
      usage: 'Usage'
    };
    return labels[type] || type;
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-500/20 text-green-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className={`bg-cscx-gray-900 rounded-xl ${compact ? 'p-4' : 'p-6'}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-cscx-accent border-t-transparent rounded-full" />
          <span className="ml-3 text-cscx-gray-400">Analyzing patterns...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`bg-cscx-gray-900 rounded-xl ${compact ? 'p-4' : 'p-6'}`}>
        <div className="text-center py-6">
          <p className="text-red-400 mb-3">{error}</p>
          <button
            onClick={fetchPatterns}
            className="px-4 py-2 bg-cscx-accent hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Compact view for meeting prep
  if (compact && meetingPatterns) {
    return (
      <div className="bg-cscx-gray-900 rounded-xl p-4 border border-cscx-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="w-5 h-5 bg-cscx-accent/20 rounded flex items-center justify-center text-cscx-accent text-xs">
              P
            </span>
            Pattern Insights
          </h4>
          {analysis && (
            <span className={`text-xs px-2 py-0.5 rounded ${getRiskLevelColor(analysis.overallRiskLevel)}`}>
              {analysis.overallRiskLevel.toUpperCase()} RISK
            </span>
          )}
        </div>

        {/* Meeting Insights */}
        {meetingPatterns.meetingInsights.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-cscx-gray-500 uppercase mb-2">Key Insights</p>
            <ul className="space-y-1">
              {meetingPatterns.meetingInsights.slice(0, 3).map((insight, i) => (
                <li key={i} className="text-xs text-cscx-gray-300 flex items-start gap-2">
                  <span className="text-cscx-accent">-</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Preparation Tips */}
        {meetingPatterns.preparationTips.length > 0 && (
          <div>
            <p className="text-xs text-cscx-gray-500 uppercase mb-2">Preparation Tips</p>
            <ul className="space-y-1">
              {meetingPatterns.preparationTips.slice(0, 3).map((tip, i) => (
                <li key={i} className="text-xs text-cscx-gray-300 flex items-start gap-2">
                  <span className="text-green-400">*</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pattern count indicator */}
        {meetingPatterns.relevantPatterns.length > 0 && (
          <div className="mt-3 pt-3 border-t border-cscx-gray-800 flex items-center justify-between">
            <span className="text-xs text-cscx-gray-500">
              {meetingPatterns.relevantPatterns.length} pattern(s) detected
            </span>
            <button
              onClick={() => onPatternClick?.(meetingPatterns.relevantPatterns[0])}
              className="text-xs text-cscx-accent hover:underline"
            >
              View details
            </button>
          </div>
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className="bg-cscx-gray-900 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            Pattern Recognition
            <span className="text-xs px-2 py-1 bg-cscx-accent/20 text-cscx-accent rounded">
              AI
            </span>
          </h3>
          <p className="text-sm text-cscx-gray-400 mt-1">
            {customerName || analysis?.customerName || 'Customer'} - Behavioral analysis
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Data quality indicator */}
          {analysis && (
            <div className="flex items-center gap-1 px-2 py-1 bg-cscx-gray-800 rounded text-xs">
              <span className="text-cscx-gray-500">Data:</span>
              <span className={analysis.dataQuality >= 70 ? 'text-green-400' : analysis.dataQuality >= 40 ? 'text-yellow-400' : 'text-red-400'}>
                {analysis.dataQuality}%
              </span>
            </div>
          )}

          {/* Refresh button */}
          <button
            onClick={refreshPatterns}
            disabled={refreshing}
            className="p-2 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Summary Section */}
      {analysis && (
        <div className="mb-6 p-4 bg-cscx-gray-800/50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-white">Analysis Summary</span>
            <span className={`text-sm font-semibold ${getRiskLevelColor(analysis.overallRiskLevel)}`}>
              {analysis.overallRiskLevel.toUpperCase()} RISK
            </span>
          </div>
          <p className="text-sm text-cscx-gray-300">{analysis.summary}</p>

          {/* Top Insights */}
          {analysis.topInsights.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-cscx-gray-500 uppercase mb-2">Top Insights</p>
              <ul className="space-y-1">
                {analysis.topInsights.map((insight, i) => (
                  <li key={i} className="text-sm text-cscx-gray-300 flex items-start gap-2">
                    <span className="text-cscx-accent">{i + 1}.</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Type Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSelectedType('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            selectedType === 'all'
              ? 'bg-cscx-accent text-white'
              : 'bg-cscx-gray-800 text-cscx-gray-400 hover:text-white'
          }`}
        >
          All ({analysis?.patterns.length || 0})
        </button>
        {(['risk', 'warning', 'communication', 'engagement', 'stakeholder', 'meeting', 'usage', 'success'] as PatternType[]).map(type => {
          const count = analysis?.patterns.filter(p => p.type === type).length || 0;
          if (count === 0) return null;
          return (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                selectedType === type
                  ? 'bg-cscx-accent text-white'
                  : 'bg-cscx-gray-800 text-cscx-gray-400 hover:text-white'
              }`}
            >
              {getTypeLabel(type)} ({count})
            </button>
          );
        })}
      </div>

      {/* Patterns List */}
      <div className="space-y-3">
        {filteredPatterns.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-cscx-gray-500">No patterns detected for this filter</p>
          </div>
        ) : (
          filteredPatterns.map(pattern => (
            <div
              key={pattern.id}
              onClick={() => onPatternClick?.(pattern)}
              className={`p-4 rounded-lg border cursor-pointer hover:bg-opacity-20 transition-colors ${getSeverityColor(pattern.severity)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {/* Severity indicator */}
                  <div className={`w-8 h-8 rounded flex items-center justify-center font-bold ${
                    pattern.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                    pattern.severity === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                    pattern.severity === 'positive' ? 'bg-green-500/20 text-green-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {getSeverityIcon(pattern.severity)}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white">{pattern.name}</h4>
                      <span className="text-xs px-2 py-0.5 bg-cscx-gray-700 rounded">
                        {getTypeLabel(pattern.type)}
                      </span>
                    </div>
                    <p className="text-sm text-cscx-gray-300 mt-1">{pattern.description}</p>

                    {/* Suggested action */}
                    {pattern.suggestedAction && (
                      <div className="mt-2 flex items-start gap-2">
                        <span className="text-xs text-green-400 font-medium">ACTION:</span>
                        <span className="text-xs text-cscx-gray-400">{pattern.suggestedAction}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Confidence badge */}
                <div className={`text-xs px-2 py-1 rounded ${getConfidenceBadge(pattern.confidence)}`}>
                  {pattern.confidence} ({pattern.confidenceScore}%)
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recommended Actions */}
      {analysis && analysis.recommendedActions.length > 0 && (
        <div className="mt-6 p-4 bg-cscx-gray-800/30 rounded-lg">
          <h4 className="text-sm font-semibold text-white mb-3">Recommended Actions</h4>
          <ul className="space-y-2">
            {analysis.recommendedActions.map((action, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-5 h-5 bg-cscx-accent/20 rounded flex items-center justify-center text-cscx-accent text-xs flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-cscx-gray-300">{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Analysis timestamp */}
      {analysis && (
        <div className="mt-4 text-xs text-cscx-gray-500 text-right">
          Last analyzed: {new Date(analysis.analysisTimestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default PatternRecognition;
