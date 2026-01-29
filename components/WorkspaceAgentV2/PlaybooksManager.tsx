/**
 * Playbooks Manager - Browse and execute playbook templates
 * Part of WorkspaceAgent V2 Dashboard (WAD-004)
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Types
// ============================================

interface PlaybookStage {
  name: string;
  description?: string;
  duration_days?: number;
  actions: string[];
}

interface Playbook {
  id: string;
  name: string;
  description?: string;
  type: 'onboarding' | 'renewal' | 'expansion' | 'risk' | 'qbr' | 'custom';
  stages: PlaybookStage[];
  total_duration_days?: number;
  created_at: string;
}

interface PlaybooksManagerProps {
  customerId?: string;
  customerName?: string;
}

// ============================================
// Constants
// ============================================

const PLAYBOOK_TYPE_COLORS: Record<string, string> = {
  onboarding: 'bg-green-500/20 text-green-400 border-green-500/30',
  renewal: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  expansion: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  risk: 'bg-red-500/20 text-red-400 border-red-500/30',
  qbr: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  custom: 'bg-cscx-gray-700 text-cscx-gray-300 border-cscx-gray-600',
};

const PLAYBOOK_TYPE_ICONS: Record<string, string> = {
  onboarding: '🚀',
  renewal: '🔄',
  expansion: '📈',
  risk: '⚠️',
  qbr: '📊',
  custom: '📋',
};

// ============================================
// Component
// ============================================

export const PlaybooksManager: React.FC<PlaybooksManagerProps> = ({
  customerId,
  customerName,
}) => {
  const { getAuthHeaders } = useAuth();

  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlaybookId, setExpandedPlaybookId] = useState<string | null>(null);

  // Fetch playbooks on mount
  useEffect(() => {
    fetchPlaybooks();
  }, []);

  const fetchPlaybooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/playbooks`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch playbooks: ${response.status}`);
      }
      const data = await response.json();
      setPlaybooks(data.playbooks || data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch playbooks');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (playbookId: string) => {
    setExpandedPlaybookId((prev) => (prev === playbookId ? null : playbookId));
  };

  const handleStartPlaybook = async (playbookId: string) => {
    if (!customerId) return;

    try {
      const response = await fetch(`${API_URL}/api/playbooks/${playbookId}/execute`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ customer_id: customerId }),
      });
      if (!response.ok) {
        throw new Error(`Failed to start playbook: ${response.status}`);
      }
      // Could show success toast or redirect to execution view
    } catch (err) {
      console.error('Failed to start playbook:', err);
    }
  };

  const formatDuration = (days?: number): string => {
    if (!days) return 'Variable';
    if (days === 1) return '1 day';
    if (days < 7) return `${days} days`;
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    if (remainingDays === 0) return `${weeks} week${weeks > 1 ? 's' : ''}`;
    return `${weeks}w ${remainingDays}d`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-cscx-accent border-t-transparent" />
          <span className="ml-3 text-cscx-gray-400">Loading playbooks...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-white mb-2">Failed to Load Playbooks</h3>
          <p className="text-cscx-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchPlaybooks}
            className="px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (playbooks.length === 0) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Playbooks Yet</h3>
          <p className="text-cscx-gray-400 max-w-md mx-auto">
            Playbooks are multi-stage workflows for customer success processes like onboarding,
            renewals, and QBRs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">📋</div>
            <div>
              <h3 className="text-lg font-semibold text-white">Playbooks</h3>
              <p className="text-sm text-cscx-gray-400">{playbooks.length} playbook templates</p>
            </div>
          </div>
          {customerId && (
            <div className="text-sm text-cscx-gray-400">
              Customer: <span className="text-white">{customerName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Playbook Cards */}
      <div className="grid gap-4">
        {playbooks.map((playbook) => {
          const isExpanded = expandedPlaybookId === playbook.id;
          return (
            <div
              key={playbook.id}
              className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl overflow-hidden"
            >
              {/* Playbook Header */}
              <button
                onClick={() => toggleExpanded(playbook.id)}
                className="w-full p-4 flex items-start justify-between gap-4 hover:bg-cscx-gray-800/30 transition-colors text-left"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="text-2xl">
                    {PLAYBOOK_TYPE_ICONS[playbook.type] || '📋'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-white font-medium">{playbook.name}</h4>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full border ${
                          PLAYBOOK_TYPE_COLORS[playbook.type] || PLAYBOOK_TYPE_COLORS.custom
                        }`}
                      >
                        {playbook.type}
                      </span>
                    </div>

                    {playbook.description && (
                      <p className="text-sm text-cscx-gray-400 mt-1 line-clamp-2">
                        {playbook.description}
                      </p>
                    )}

                    {/* Quick Stats */}
                    <div className="flex items-center gap-4 mt-3 text-sm">
                      <div className="flex items-center gap-1 text-cscx-gray-400">
                        <span>📊</span>
                        <span>{playbook.stages?.length || 0} stages</span>
                      </div>
                      <div className="flex items-center gap-1 text-cscx-gray-400">
                        <span>⏱️</span>
                        <span>{formatDuration(playbook.total_duration_days)}</span>
                      </div>
                    </div>

                    {/* Stage Timeline Preview */}
                    {playbook.stages && playbook.stages.length > 0 && (
                      <div className="flex items-center gap-1 mt-3">
                        {playbook.stages.slice(0, 5).map((stage, idx) => (
                          <React.Fragment key={idx}>
                            <div
                              className="h-2 bg-cscx-accent/40 rounded-full"
                              style={{
                                width: `${Math.max(20, (stage.duration_days || 1) * 10)}px`,
                              }}
                              title={stage.name}
                            />
                            {idx < playbook.stages.length - 1 && idx < 4 && (
                              <div className="w-1 h-1 bg-cscx-gray-600 rounded-full" />
                            )}
                          </React.Fragment>
                        ))}
                        {playbook.stages.length > 5 && (
                          <span className="text-xs text-cscx-gray-500 ml-2">
                            +{playbook.stages.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-cscx-gray-400">{isExpanded ? '▼' : '▶'}</span>
                </div>
              </button>

              {/* Expanded Stage Details */}
              {isExpanded && (
                <div className="border-t border-cscx-gray-800 p-4 bg-cscx-gray-800/20">
                  <h5 className="text-sm font-medium text-white mb-3">Stages</h5>
                  <div className="space-y-3">
                    {playbook.stages?.map((stage, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 bg-cscx-gray-900 rounded-lg"
                      >
                        <div className="w-6 h-6 bg-cscx-accent/20 text-cscx-accent rounded-full flex items-center justify-center text-xs font-medium">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h6 className="text-white font-medium">{stage.name}</h6>
                            {stage.duration_days && (
                              <span className="text-xs text-cscx-gray-400">
                                {formatDuration(stage.duration_days)}
                              </span>
                            )}
                          </div>
                          {stage.description && (
                            <p className="text-sm text-cscx-gray-400 mt-1">{stage.description}</p>
                          )}
                          {stage.actions && stage.actions.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {stage.actions.map((action, aIdx) => (
                                <span
                                  key={aIdx}
                                  className="px-2 py-0.5 text-xs bg-cscx-gray-800 text-cscx-gray-400 rounded"
                                >
                                  {action}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Start Button */}
                  <div className="mt-4 pt-4 border-t border-cscx-gray-800">
                    <button
                      onClick={() => handleStartPlaybook(playbook.id)}
                      disabled={!customerId}
                      className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                        customerId
                          ? 'bg-cscx-accent hover:bg-cscx-accent/80 text-white'
                          : 'bg-cscx-gray-700 text-cscx-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <span>▶</span>
                      {customerId
                        ? `Start Playbook for ${customerName}`
                        : 'Select a customer to start'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlaybooksManager;
