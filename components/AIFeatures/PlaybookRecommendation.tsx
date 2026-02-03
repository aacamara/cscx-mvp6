/**
 * Playbook Recommendation Component (PRD-232)
 *
 * Displays AI-powered playbook recommendations with fit scores,
 * reasoning, alternative options, and trigger information.
 */

import React, { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

type TriggerType = 'automatic' | 'suggested' | 'manual';
type RecommendationStatus = 'pending_approval' | 'started' | 'active' | 'declined' | 'completed';

interface PlaybookOption {
  playbook_id: string;
  playbook_name: string;
  fit_score: number;
  key_reasons: string[];
}

interface TriggerEvent {
  type: string;
  details?: string;
}

interface Playbook {
  id: string;
  name: string;
  description: string;
  duration_days: number;
  steps_count: number;
}

interface PlaybookRecommendation {
  recommendation_id: string;
  customer_id: string;
  customer_name: string;
  recommended_playbook: Playbook;
  fit_score: number;
  reasoning: string[];
  alternative_playbooks: PlaybookOption[];
  trigger_type: TriggerType;
  trigger_event?: TriggerEvent;
  status: RecommendationStatus;
}

interface PlaybookRecommendationCardProps {
  customerId: string;
  customerName?: string;
  compact?: boolean;
  onPlaybookStarted?: (executionId: string) => void;
}

interface PendingRecommendation {
  id: string;
  customer_id: string;
  customer_name: string;
  recommended_playbook: Playbook;
  fit_score: number;
  reasoning: string[];
  trigger_type: TriggerType;
  trigger_event?: TriggerEvent;
  status: RecommendationStatus;
  alternative_playbooks: PlaybookOption[];
}

interface PlaybookRecommendationListProps {
  onPlaybookStarted?: (customerId: string, executionId: string) => void;
}

// ============================================================================
// API
// ============================================================================

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

async function fetchRecommendation(customerId: string): Promise<PlaybookRecommendation | null> {
  try {
    const response = await fetch(`${API_BASE}/customers/${customerId}/recommended-playbook`);
    if (!response.ok) throw new Error('Failed to fetch recommendation');
    return await response.json();
  } catch (error) {
    console.error('Error fetching playbook recommendation:', error);
    return null;
  }
}

async function startPlaybook(
  customerId: string,
  playbookId: string,
  recommendationId?: string
): Promise<{ success: boolean; execution_id?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/customers/${customerId}/start-playbook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playbook_id: playbookId,
        recommendation_id: recommendationId,
      }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error starting playbook:', error);
    return { success: false, error: 'Network error' };
  }
}

async function fetchPendingRecommendations(): Promise<PendingRecommendation[]> {
  try {
    const response = await fetch(`${API_BASE}/playbook-recommendations`);
    if (!response.ok) throw new Error('Failed to fetch recommendations');
    const data = await response.json();
    return data.recommendations || [];
  } catch (error) {
    console.error('Error fetching pending recommendations:', error);
    return [];
  }
}

async function approveRecommendation(
  recommendationId: string,
  customerId: string,
  playbookId: string
): Promise<{ success: boolean; execution_id?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/playbook-recommendations/${recommendationId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customerId, playbook_id: playbookId }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error approving recommendation:', error);
    return { success: false, error: 'Network error' };
  }
}

async function declineRecommendation(
  recommendationId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/playbook-recommendations/${recommendationId}/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error declining recommendation:', error);
    return { success: false, error: 'Network error' };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getFitScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function getFitScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-500/20 border-green-500/30';
  if (score >= 60) return 'bg-yellow-500/20 border-yellow-500/30';
  if (score >= 40) return 'bg-orange-500/20 border-orange-500/30';
  return 'bg-red-500/20 border-red-500/30';
}

function getTriggerTypeLabel(type: TriggerType): string {
  switch (type) {
    case 'automatic': return 'Auto-Triggered';
    case 'suggested': return 'AI Suggested';
    case 'manual': return 'Manual Selection';
    default: return type;
  }
}

function getTriggerTypeBadgeColor(type: TriggerType): string {
  switch (type) {
    case 'automatic': return 'bg-purple-500/20 text-purple-400';
    case 'suggested': return 'bg-blue-500/20 text-blue-400';
    case 'manual': return 'bg-gray-500/20 text-gray-400';
    default: return 'bg-gray-500/20 text-gray-400';
  }
}

function getStatusBadgeColor(status: RecommendationStatus): string {
  switch (status) {
    case 'pending_approval': return 'bg-yellow-500/20 text-yellow-400';
    case 'started': case 'active': return 'bg-green-500/20 text-green-400';
    case 'declined': return 'bg-red-500/20 text-red-400';
    case 'completed': return 'bg-blue-500/20 text-blue-400';
    default: return 'bg-gray-500/20 text-gray-400';
  }
}

function getStatusLabel(status: RecommendationStatus): string {
  switch (status) {
    case 'pending_approval': return 'Pending';
    case 'started': return 'Started';
    case 'active': return 'Active';
    case 'declined': return 'Declined';
    case 'completed': return 'Completed';
    default: return status;
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Fit Score Gauge - Visual representation of playbook fit
 */
const FitScoreGauge: React.FC<{ score: number; size?: 'sm' | 'md' | 'lg' }> = ({
  score,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-12 h-12 text-lg',
    md: 'w-16 h-16 text-xl',
    lg: 'w-20 h-20 text-2xl',
  };

  const circumference = 2 * Math.PI * 20;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className={`relative ${sizeClasses[size]} flex items-center justify-center`}>
      <svg className="absolute transform -rotate-90" viewBox="0 0 48 48">
        {/* Background circle */}
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={getFitScoreColor(score)}
        />
      </svg>
      <span className={`font-bold ${getFitScoreColor(score)}`}>{score}%</span>
    </div>
  );
};

/**
 * Reason List - Displays why a playbook was recommended
 */
const ReasonList: React.FC<{ reasons: string[] }> = ({ reasons }) => {
  return (
    <ul className="space-y-2">
      {reasons.map((reason, idx) => (
        <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
          <span className="text-green-400 mt-0.5 shrink-0">{'\u2713'}</span>
          <span>{reason}</span>
        </li>
      ))}
    </ul>
  );
};

/**
 * Alternative Playbook Card
 */
const AlternativeCard: React.FC<{
  option: PlaybookOption;
  onSelect?: () => void;
}> = ({ option, onSelect }) => {
  return (
    <div className="p-3 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors bg-gray-800/30">
      <div className="flex items-center justify-between mb-2">
        <h5 className="text-sm font-medium text-white">{option.playbook_name}</h5>
        <span className={`text-sm font-bold ${getFitScoreColor(option.fit_score)}`}>
          {option.fit_score}%
        </span>
      </div>
      <ul className="text-xs text-gray-400 space-y-1 mb-2">
        {option.key_reasons.slice(0, 2).map((reason, idx) => (
          <li key={idx}>{'\u2022'} {reason}</li>
        ))}
      </ul>
      {onSelect && (
        <button
          onClick={onSelect}
          className="w-full text-xs px-2 py-1.5 border border-gray-600 rounded hover:border-cscx-accent hover:text-cscx-accent transition-colors"
        >
          Select Instead
        </button>
      )}
    </div>
  );
};

/**
 * Trigger Event Banner
 */
const TriggerBanner: React.FC<{ event: TriggerEvent }> = ({ event }) => {
  const getEventIcon = (type: string): string => {
    if (type.includes('health')) return '\u26A0';
    if (type.includes('renewal')) return '\u23F0';
    if (type.includes('adoption')) return '\u{1F4CA}';
    if (type.includes('expansion')) return '\u{1F680}';
    return '\u26A1';
  };

  const getEventLabel = (type: string): string => {
    switch (type) {
      case 'health_score_drop': return 'Health Score Drop Detected';
      case 'renewal_approaching': return 'Renewal Approaching';
      case 'low_adoption': return 'Low Adoption Detected';
      case 'expansion_signal': return 'Expansion Opportunity';
      default: return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg mb-4">
      <span className="text-lg">{getEventIcon(event.type)}</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-orange-400">{getEventLabel(event.type)}</p>
        {event.details && (
          <p className="text-xs text-gray-400 mt-0.5">{event.details}</p>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Main Components
// ============================================================================

/**
 * Playbook Recommendation Card - Shows recommendation for a single customer
 */
export const PlaybookRecommendationCard: React.FC<PlaybookRecommendationCardProps> = ({
  customerId,
  customerName,
  compact = false,
  onPlaybookStarted,
}) => {
  const [recommendation, setRecommendation] = useState<PlaybookRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchRecommendation(customerId);
      if (data) {
        setRecommendation(data);
      } else {
        setError('No recommendation available');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recommendation');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStartPlaybook = async (playbookId?: string) => {
    if (!recommendation) return;

    setStarting(true);
    try {
      const result = await startPlaybook(
        customerId,
        playbookId || recommendation.recommended_playbook.id,
        recommendation.recommendation_id
      );

      if (result.success && result.execution_id) {
        onPlaybookStarted?.(result.execution_id);
        loadData(); // Refresh to show updated status
      } else {
        setError(result.error || 'Failed to start playbook');
      }
    } finally {
      setStarting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-cscx-accent border-t-transparent rounded-full" />
          <span className="ml-2 text-gray-400">Analyzing playbook options...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !recommendation) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="text-center py-4">
          <p className="text-gray-400">{error}</p>
          <button
            onClick={loadData}
            className="mt-2 text-sm text-cscx-accent hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!recommendation) {
    return null;
  }

  // Already started
  if (recommendation.status === 'started' || recommendation.status === 'active') {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <span className="text-green-400 text-xl">{'\u2713'}</span>
          </div>
          <div>
            <p className="text-white font-medium">Playbook Active</p>
            <p className="text-sm text-gray-400">
              {recommendation.recommended_playbook.name} is currently running
            </p>
          </div>
        </div>
      </div>
    );
  }

  const playbook = recommendation.recommended_playbook;

  // Compact view
  if (compact) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Recommended Playbook
          </span>
          <span className={`text-xs px-2 py-0.5 rounded ${getTriggerTypeBadgeColor(recommendation.trigger_type)}`}>
            {getTriggerTypeLabel(recommendation.trigger_type)}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <FitScoreGauge score={recommendation.fit_score} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">{playbook.name}</p>
            <p className="text-xs text-gray-500">
              {playbook.duration_days}d {'\u2022'} {playbook.steps_count} steps
            </p>
          </div>
          <button
            onClick={() => handleStartPlaybook()}
            disabled={starting}
            className="px-3 py-1.5 text-sm bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded transition-colors disabled:opacity-50"
          >
            {starting ? 'Starting...' : 'Start'}
          </button>
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Recommended Playbook
            {customerName && <span className="text-gray-400 font-normal"> - {customerName}</span>}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${getTriggerTypeBadgeColor(recommendation.trigger_type)}`}>
            {getTriggerTypeLabel(recommendation.trigger_type)}
          </span>
          <span className={`text-xs px-2 py-1 rounded ${getStatusBadgeColor(recommendation.status)}`}>
            {getStatusLabel(recommendation.status)}
          </span>
        </div>
      </div>

      {/* Trigger Event */}
      {recommendation.trigger_event && (
        <TriggerBanner event={recommendation.trigger_event} />
      )}

      {/* Main Recommendation */}
      <div className={`p-4 border rounded-lg ${getFitScoreBgColor(recommendation.fit_score)}`}>
        <div className="flex items-start gap-4">
          <FitScoreGauge score={recommendation.fit_score} size="lg" />
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-xl font-semibold text-white">{playbook.name}</h4>
                <p className="text-sm text-gray-400 mt-1">{playbook.description}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  <span>{playbook.duration_days} days</span>
                  <span>{'\u2022'}</span>
                  <span>{playbook.steps_count} steps</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reasoning */}
        <div className="mt-4 pt-4 border-t border-gray-600/50">
          <h5 className="text-sm font-medium text-gray-300 mb-2">Why this playbook:</h5>
          <ReasonList reasons={recommendation.reasoning} />
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => handleStartPlaybook()}
            disabled={starting}
            className="flex-1 px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {starting ? 'Starting Playbook...' : 'Start Playbook'}
          </button>
          <button
            onClick={() => loadData()}
            className="px-4 py-2 border border-gray-600 hover:border-gray-500 text-gray-300 rounded-lg transition-colors"
          >
            View Steps
          </button>
          {recommendation.alternative_playbooks.length > 0 && (
            <button
              onClick={() => setShowAlternatives(!showAlternatives)}
              className="px-4 py-2 border border-gray-600 hover:border-gray-500 text-gray-300 rounded-lg transition-colors"
            >
              {showAlternatives ? 'Hide' : 'Choose Different'}
            </button>
          )}
        </div>
      </div>

      {/* Alternatives */}
      {showAlternatives && recommendation.alternative_playbooks.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">
            Alternative Playbooks
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {recommendation.alternative_playbooks.map((option) => (
              <AlternativeCard
                key={option.playbook_id}
                option={option}
                onSelect={() => handleStartPlaybook(option.playbook_id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Playbook Recommendations List - Shows all pending recommendations
 */
export const PlaybookRecommendationsList: React.FC<PlaybookRecommendationListProps> = ({
  onPlaybookStarted,
}) => {
  const [recommendations, setRecommendations] = useState<PendingRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchPendingRecommendations();
      setRecommendations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (rec: PendingRecommendation) => {
    setProcessingId(rec.id);
    try {
      const result = await approveRecommendation(
        rec.id,
        rec.customer_id,
        rec.recommended_playbook.id
      );

      if (result.success && result.execution_id) {
        onPlaybookStarted?.(rec.customer_id, result.execution_id);
        loadData(); // Refresh list
      } else {
        setError(result.error || 'Failed to approve');
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (rec: PendingRecommendation) => {
    setProcessingId(rec.id);
    try {
      const result = await declineRecommendation(rec.id);
      if (result.success) {
        loadData(); // Refresh list
      } else {
        setError(result.error || 'Failed to decline');
      }
    } finally {
      setProcessingId(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-cscx-accent border-t-transparent rounded-full" />
          <span className="ml-2 text-gray-400">Loading recommendations...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="text-center py-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={loadData}
            className="mt-2 text-sm text-cscx-accent hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (recommendations.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">{'\u{1F4CB}'}</span>
          </div>
          <p className="text-gray-400">No pending playbook recommendations</p>
          <p className="text-sm text-gray-500 mt-1">
            AI will suggest playbooks when triggers are detected
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          Playbook Recommendations
          <span className="ml-2 text-sm font-normal text-gray-400">
            ({recommendations.length} pending)
          </span>
        </h2>
        <button
          onClick={loadData}
          className="text-sm text-gray-400 hover:text-white px-3 py-1 rounded hover:bg-gray-800"
        >
          Refresh
        </button>
      </div>

      {recommendations.map((rec) => (
        <div
          key={rec.id}
          className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
        >
          {/* Trigger Event */}
          {rec.trigger_event && (
            <TriggerBanner event={rec.trigger_event} />
          )}

          <div className="flex items-start gap-4">
            <FitScoreGauge score={rec.fit_score} size="md" />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-gray-400">{rec.customer_name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${getTriggerTypeBadgeColor(rec.trigger_type)}`}>
                  {getTriggerTypeLabel(rec.trigger_type)}
                </span>
              </div>

              <h4 className="text-white font-medium">{rec.recommended_playbook.name}</h4>
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                {rec.recommended_playbook.description}
              </p>

              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span>{rec.recommended_playbook.duration_days}d duration</span>
                <span>{rec.recommended_playbook.steps_count} steps</span>
              </div>

              {/* Top reasons */}
              <div className="mt-3 flex flex-wrap gap-2">
                {rec.reasoning.slice(0, 2).map((reason, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-1 bg-gray-800 text-gray-300 rounded"
                  >
                    {reason}
                  </span>
                ))}
                {rec.reasoning.length > 2 && (
                  <span className="text-xs px-2 py-1 text-gray-500">
                    +{rec.reasoning.length - 2} more
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => handleApprove(rec)}
                disabled={processingId === rec.id}
                className="px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {processingId === rec.id ? 'Starting...' : 'Approve'}
              </button>
              <button
                onClick={() => handleDecline(rec)}
                disabled={processingId === rec.id}
                className="px-4 py-2 border border-gray-600 hover:border-gray-500 text-gray-400 hover:text-white rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PlaybookRecommendationCard;
