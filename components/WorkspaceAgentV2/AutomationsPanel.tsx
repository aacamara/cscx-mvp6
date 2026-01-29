/**
 * Automations Panel - View and create natural language automations
 * Part of WorkspaceAgent V2 Dashboard (WAD-006)
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Types
// ============================================

interface Automation {
  id: string;
  name: string;
  description: string;
  natural_language?: string;
  schedule?: string;
  enabled: boolean;
  run_count: number;
  last_run_at?: string;
  next_run_at?: string;
  created_at: string;
}

// ============================================
// Component
// ============================================

export const AutomationsPanel: React.FC = () => {
  const { getAuthHeaders } = useAuth();

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [newAutomationText, setNewAutomationText] = useState('');
  const [creating, setCreating] = useState(false);

  // Fetch automations on mount
  useEffect(() => {
    fetchAutomations();
  }, []);

  const fetchAutomations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/automations`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch automations: ${response.status}`);
      }
      const data = await response.json();
      setAutomations(data.automations || data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch automations');
    } finally {
      setLoading(false);
    }
  };

  const toggleAutomation = async (automationId: string, enabled: boolean) => {
    setTogglingId(automationId);
    try {
      const response = await fetch(`${API_URL}/api/automations/${automationId}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) {
        throw new Error(`Failed to update automation: ${response.status}`);
      }
      setAutomations((prev) =>
        prev.map((a) => (a.id === automationId ? { ...a, enabled } : a))
      );
    } catch (err) {
      console.error('Failed to toggle automation:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreateAutomation = async () => {
    if (!newAutomationText.trim()) return;

    setCreating(true);
    try {
      const response = await fetch(`${API_URL}/api/automations`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ natural_language: newAutomationText }),
      });
      if (!response.ok) {
        throw new Error(`Failed to create automation: ${response.status}`);
      }
      const newAutomation = await response.json();
      setAutomations((prev) => [newAutomation, ...prev]);
      setNewAutomationText('');
    } catch (err) {
      console.error('Failed to create automation:', err);
    } finally {
      setCreating(false);
    }
  };

  const formatTimestamp = (timestamp?: string): string => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs < 0) {
      // Future date
      const futureMins = Math.abs(diffMins);
      const futureHours = Math.floor(futureMins / 60);
      const futureDays = Math.floor(futureHours / 24);
      if (futureMins < 60) return `in ${futureMins}m`;
      if (futureHours < 24) return `in ${futureHours}h`;
      return `in ${futureDays}d`;
    }

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const parseSchedule = (schedule?: string): string => {
    if (!schedule) return 'Manual';
    // Basic cron-like parsing for common patterns
    if (schedule.includes('daily')) return 'Daily';
    if (schedule.includes('weekly')) return 'Weekly';
    if (schedule.includes('hourly')) return 'Hourly';
    if (schedule.includes('monthly')) return 'Monthly';
    return schedule;
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-cscx-accent border-t-transparent" />
          <span className="ml-3 text-cscx-gray-400">Loading automations...</span>
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
          <h3 className="text-xl font-semibold text-white mb-2">Failed to Load Automations</h3>
          <p className="text-cscx-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchAutomations}
            className="px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
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
            <div className="text-2xl">🤖</div>
            <div>
              <h3 className="text-lg font-semibold text-white">Automations</h3>
              <p className="text-sm text-cscx-gray-400">
                {automations.filter((a) => a.enabled).length} active of {automations.length}{' '}
                automations
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Create New Automation */}
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-4">
        <h4 className="text-sm font-medium text-white mb-3">Create Automation</h4>
        <div className="flex gap-3">
          <input
            type="text"
            value={newAutomationText}
            onChange={(e) => setNewAutomationText(e.target.value)}
            placeholder="Describe your automation in natural language... (e.g., 'Send weekly summary email every Monday at 9am')"
            className="flex-1 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-4 py-2 text-white placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleCreateAutomation();
              }
            }}
          />
          <button
            onClick={handleCreateAutomation}
            disabled={creating || !newAutomationText.trim()}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              creating || !newAutomationText.trim()
                ? 'bg-cscx-gray-700 text-cscx-gray-500 cursor-not-allowed'
                : 'bg-cscx-accent hover:bg-cscx-accent/80 text-white'
            }`}
          >
            {creating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Creating...
              </>
            ) : (
              <>
                <span>+</span> Create
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-cscx-gray-500 mt-2">
          Tip: Be specific about timing, actions, and conditions for best results.
        </p>
      </div>

      {/* Empty state */}
      {automations.length === 0 ? (
        <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8">
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-xl font-semibold text-white mb-2">No Automations Yet</h3>
            <p className="text-cscx-gray-400 max-w-md mx-auto">
              Create your first automation using natural language above. Describe what you want
              to automate and when it should run.
            </p>
          </div>
        </div>
      ) : (
        /* Automation Cards */
        <div className="grid gap-4">
          {automations.map((automation) => (
            <div
              key={automation.id}
              className={`bg-cscx-gray-900 border rounded-xl p-4 transition-all ${
                automation.enabled
                  ? 'border-cscx-gray-800'
                  : 'border-cscx-gray-800/50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="text-2xl">🤖</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-medium">{automation.name}</h4>

                    {/* Natural Language Description */}
                    <p className="text-sm text-cscx-gray-400 mt-1">
                      {automation.natural_language || automation.description}
                    </p>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-3 text-sm flex-wrap">
                      <div className="flex items-center gap-1 text-cscx-gray-400">
                        <span>📅</span>
                        <span>{parseSchedule(automation.schedule)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-cscx-gray-400">
                        <span>🔄</span>
                        <span>{automation.run_count} runs</span>
                      </div>
                      <div className="flex items-center gap-1 text-cscx-gray-400">
                        <span>🕒</span>
                        <span>Last: {formatTimestamp(automation.last_run_at)}</span>
                      </div>
                      {automation.next_run_at && (
                        <div className="flex items-center gap-1 text-green-400">
                          <span>⏰</span>
                          <span>Next: {formatTimestamp(automation.next_run_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => toggleAutomation(automation.id, !automation.enabled)}
                  disabled={togglingId === automation.id}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    automation.enabled ? 'bg-cscx-accent' : 'bg-cscx-gray-700'
                  } ${togglingId === automation.id ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                      automation.enabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutomationsPanel;
