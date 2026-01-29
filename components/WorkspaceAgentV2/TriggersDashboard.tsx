/**
 * Triggers Dashboard - View and manage event-driven triggers
 * Part of WorkspaceAgent V2 Dashboard (WAD-003)
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Types
// ============================================

interface TriggerCondition {
  type: string;
  field?: string;
  operator?: string;
  value?: string | number | boolean;
}

interface TriggerAction {
  type: string;
  tool_name?: string;
  parameters?: Record<string, unknown>;
}

interface Trigger {
  id: string;
  name: string;
  description?: string;
  type: 'email' | 'calendar' | 'health_score' | 'renewal' | 'custom';
  conditions: TriggerCondition[];
  actions: TriggerAction[];
  enabled: boolean;
  fire_count: number;
  last_fired_at?: string;
  created_at: string;
}

// ============================================
// Constants
// ============================================

const TRIGGER_TYPE_COLORS: Record<string, string> = {
  email: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  calendar: 'bg-green-500/20 text-green-400 border-green-500/30',
  health_score: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  renewal: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  custom: 'bg-cscx-gray-700 text-cscx-gray-300 border-cscx-gray-600',
};

const TRIGGER_TYPE_ICONS: Record<string, string> = {
  email: '📧',
  calendar: '📅',
  health_score: '💚',
  renewal: '🔄',
  custom: '⚡',
};

// ============================================
// Component
// ============================================

export const TriggersDashboard: React.FC = () => {
  const { getAuthHeaders } = useAuth();

  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Fetch triggers on mount
  useEffect(() => {
    fetchTriggers();
  }, []);

  const fetchTriggers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/triggers`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch triggers: ${response.status}`);
      }
      const data = await response.json();
      setTriggers(data.triggers || data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch triggers');
    } finally {
      setLoading(false);
    }
  };

  const toggleTrigger = async (triggerId: string, enabled: boolean) => {
    setTogglingId(triggerId);
    try {
      const action = enabled ? 'enable' : 'disable';
      const response = await fetch(`${API_URL}/api/triggers/${triggerId}/${action}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to ${action} trigger: ${response.status}`);
      }
      // Update local state
      setTriggers((prev) =>
        prev.map((t) => (t.id === triggerId ? { ...t, enabled } : t))
      );
    } catch (err) {
      console.error('Failed to toggle trigger:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const formatConditions = (conditions: TriggerCondition[]): string => {
    if (!conditions || conditions.length === 0) return 'No conditions';
    if (conditions.length === 1) {
      const c = conditions[0];
      return `${c.type}${c.field ? ` (${c.field})` : ''}`;
    }
    return `${conditions.length} conditions`;
  };

  const formatLastFired = (timestamp?: string): string => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-cscx-accent border-t-transparent" />
          <span className="ml-3 text-cscx-gray-400">Loading triggers...</span>
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
          <h3 className="text-xl font-semibold text-white mb-2">Failed to Load Triggers</h3>
          <p className="text-cscx-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchTriggers}
            className="px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (triggers.length === 0) {
    return (
      <div className="bg-cscx-gray-900 border border-cscx-gray-800 rounded-xl p-8">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⚡</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Triggers Yet</h3>
          <p className="text-cscx-gray-400 max-w-md mx-auto mb-6">
            Triggers automatically execute actions when specific events occur. Create your first
            trigger to automate customer success workflows.
          </p>
          <button className="px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors flex items-center gap-2 mx-auto">
            <span>+</span> Create Trigger
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
            <div className="text-2xl">⚡</div>
            <div>
              <h3 className="text-lg font-semibold text-white">Triggers</h3>
              <p className="text-sm text-cscx-gray-400">
                {triggers.filter((t) => t.enabled).length} active of {triggers.length} triggers
              </p>
            </div>
          </div>
          <button className="px-4 py-2 bg-cscx-accent hover:bg-cscx-accent/80 text-white text-sm rounded-lg transition-colors flex items-center gap-2">
            <span>+</span> New Trigger
          </button>
        </div>
      </div>

      {/* Trigger Cards */}
      <div className="grid gap-4">
        {triggers.map((trigger) => (
          <div
            key={trigger.id}
            className={`bg-cscx-gray-900 border rounded-xl p-4 transition-all ${
              trigger.enabled
                ? 'border-cscx-gray-800'
                : 'border-cscx-gray-800/50 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {/* Icon */}
                <div className="text-2xl">{TRIGGER_TYPE_ICONS[trigger.type] || '⚡'}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-white font-medium">{trigger.name}</h4>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full border ${
                        TRIGGER_TYPE_COLORS[trigger.type] || TRIGGER_TYPE_COLORS.custom
                      }`}
                    >
                      {trigger.type.replace('_', ' ')}
                    </span>
                  </div>

                  {trigger.description && (
                    <p className="text-sm text-cscx-gray-400 mt-1">{trigger.description}</p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-3 text-sm">
                    <div className="flex items-center gap-1 text-cscx-gray-400">
                      <span>📋</span>
                      <span>{formatConditions(trigger.conditions)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-cscx-gray-400">
                      <span>🎯</span>
                      <span>{trigger.actions?.length || 0} actions</span>
                    </div>
                    <div className="flex items-center gap-1 text-cscx-gray-400">
                      <span>🔥</span>
                      <span>{trigger.fire_count} fires</span>
                    </div>
                    <div className="flex items-center gap-1 text-cscx-gray-400">
                      <span>🕒</span>
                      <span>{formatLastFired(trigger.last_fired_at)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Toggle */}
              <button
                onClick={() => toggleTrigger(trigger.id, !trigger.enabled)}
                disabled={togglingId === trigger.id}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  trigger.enabled ? 'bg-cscx-accent' : 'bg-cscx-gray-700'
                } ${togglingId === trigger.id ? 'opacity-50' : ''}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                    trigger.enabled ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TriggersDashboard;
