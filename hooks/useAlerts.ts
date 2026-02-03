/**
 * useAlerts Hook (PRD-221)
 *
 * React hook for intelligent alert filtering with:
 * - Bundled/individual alert fetching
 * - Real-time updates via WebSocket
 * - Feedback submission
 * - Preference management
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';

// ============================================
// Types
// ============================================

export type AlertType =
  | 'health_score_drop'
  | 'health_score_critical'
  | 'usage_drop'
  | 'usage_spike'
  | 'renewal_approaching'
  | 'engagement_drop'
  | 'champion_left'
  | 'nps_detractor'
  | 'support_escalation'
  | 'contract_expiring'
  | 'expansion_signal'
  | 'adoption_stalled'
  | 'invoice_overdue'
  | 'stakeholder_inactive'
  | 'custom';

export type DeliveryRecommendation = 'immediate' | 'digest' | 'suppress';

export type AlertFeedbackType = 'helpful' | 'not_helpful' | 'already_knew' | 'false_positive';

export type AlertStatus = 'unread' | 'read' | 'actioned' | 'dismissed' | 'snoozed';

export interface ScoreFactor {
  factor: string;
  weight: number;
  value: number;
  contribution: number;
  explanation: string;
}

export interface AlertScore {
  rawAlertId: string;
  impactScore: number;
  urgencyScore: number;
  confidenceScore: number;
  finalScore: number;
  factors: ScoreFactor[];
  deliveryRecommendation: DeliveryRecommendation;
  filtered: boolean;
  filterReason?: string;
}

export interface Alert {
  id: string;
  type: AlertType;
  customerId: string;
  customerName?: string;
  title: string;
  description: string;
  metricChange?: {
    metric: string;
    previousValue: number;
    currentValue: number;
    changePercent: number;
  };
  metadata?: Record<string, unknown>;
  source?: string;
  createdAt: Date;
  score: AlertScore;
  status: AlertStatus;
  readAt?: Date;
  snoozeUntil?: Date;
}

export interface AlertBundle {
  bundleId: string;
  customerId: string;
  customerName: string;
  alerts: Alert[];
  bundleScore: number;
  title: string;
  summary: string;
  recommendedAction: string;
  alertCount: number;
  createdAt: Date;
  status: AlertStatus;
}

export interface AlertPreferences {
  immediateThreshold: number;
  digestThreshold: number;
  suppressThreshold: number;
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  allowCriticalDuringQuiet: boolean;
  criticalThreshold: number;
  filterMinorHealthChanges: boolean;
  minorHealthChangeThreshold: number;
  filterSeasonalPatterns: boolean;
  filterActivePlaybooks: boolean;
}

export interface AlertStats {
  totalAlerts: number;
  priorityCount: number;
  digestCount: number;
  suppressedCount: number;
  byType: Record<string, number>;
  byCustomer: Record<string, number>;
  averageScore: number;
  feedbackStats: {
    helpful: number;
    notHelpful: number;
    alreadyKnew: number;
    falsePositive: number;
  };
}

export interface UseAlertsOptions {
  format?: 'bundled' | 'individual';
  minScore?: number;
  status?: AlertStatus;
  customerId?: string;
  types?: AlertType[];
  autoRefresh?: boolean;
  refreshInterval?: number; // ms
}

export interface UseAlertsReturn {
  // Data
  bundles: AlertBundle[];
  alerts: Alert[];
  stats: AlertStats | null;
  preferences: AlertPreferences | null;
  suppressedCount: number;
  digestCount: number;
  totalCount: number;

  // State
  loading: boolean;
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
  markAsRead: (alertId: string) => Promise<void>;
  markBundleAsRead: (bundleId: string) => Promise<void>;
  snooze: (alertId: string, hours?: number) => Promise<void>;
  dismiss: (alertId: string) => Promise<void>;
  submitFeedback: (alertId: string, feedback: AlertFeedbackType, notes?: string) => Promise<void>;
  updatePreferences: (updates: Partial<AlertPreferences>) => Promise<void>;
}

// ============================================
// API Functions
// ============================================

const API_URL = import.meta.env.VITE_API_URL || '';

async function fetchWithAuth(url: string, options: RequestInit = {}, getAuthHeaders: () => Record<string, string>) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || error.error?.message || 'Request failed');
  }

  return response.json();
}

// ============================================
// Hook Implementation
// ============================================

export function useAlerts(options: UseAlertsOptions = {}): UseAlertsReturn {
  const {
    format = 'bundled',
    minScore,
    status,
    customerId,
    types,
    autoRefresh = false,
    refreshInterval = 60000, // 1 minute default
  } = options;

  const { getAuthHeaders } = useAuth();
  const { connected } = useWebSocket();

  // State
  const [bundles, setBundles] = useState<AlertBundle[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [preferences, setPreferences] = useState<AlertPreferences | null>(null);
  const [suppressedCount, setSuppressedCount] = useState(0);
  const [digestCount, setDigestCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('format', format);
    if (minScore !== undefined) params.set('min_score', String(minScore));
    if (status) params.set('status', status);
    if (customerId) params.set('customer_id', customerId);
    if (types && types.length > 0) params.set('types', types.join(','));
    return params.toString();
  }, [format, minScore, status, customerId, types]);

  // Fetch alerts
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await fetchWithAuth(
        `${API_URL}/api/alerts?${queryParams}`,
        {},
        getAuthHeaders
      );

      if (result.success && result.data) {
        if (format === 'bundled') {
          setBundles(result.data.bundles || []);
          setAlerts([]);
        } else {
          setAlerts(result.data.alerts || []);
          setBundles([]);
        }
        setSuppressedCount(result.data.suppressedCount || 0);
        setDigestCount(result.data.digestCount || 0);
        setTotalCount(result.data.totalCount || 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  }, [queryParams, format, getAuthHeaders]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const result = await fetchWithAuth(
        `${API_URL}/api/alerts/stats`,
        {},
        getAuthHeaders
      );

      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch alert stats:', err);
    }
  }, [getAuthHeaders]);

  // Fetch preferences
  const fetchPreferences = useCallback(async () => {
    try {
      const result = await fetchWithAuth(
        `${API_URL}/api/alerts/preferences`,
        {},
        getAuthHeaders
      );

      if (result.success && result.data) {
        setPreferences(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch preferences:', err);
    }
  }, [getAuthHeaders]);

  // Mark alert as read
  const markAsRead = useCallback(async (alertId: string) => {
    try {
      await fetchWithAuth(
        `${API_URL}/api/alerts/${alertId}/read`,
        { method: 'POST' },
        getAuthHeaders
      );

      // Update local state
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, status: 'read' as AlertStatus, readAt: new Date() } : a
      ));
      setBundles(prev => prev.map(b => ({
        ...b,
        alerts: b.alerts.map(a =>
          a.id === alertId ? { ...a, status: 'read' as AlertStatus, readAt: new Date() } : a
        ),
      })));
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
    }
  }, [getAuthHeaders]);

  // Mark bundle as read
  const markBundleAsRead = useCallback(async (bundleId: string) => {
    try {
      await fetchWithAuth(
        `${API_URL}/api/alerts/bundles/${bundleId}/read`,
        { method: 'POST' },
        getAuthHeaders
      );

      // Update local state
      setBundles(prev => prev.map(b =>
        b.bundleId === bundleId
          ? {
              ...b,
              status: 'read' as AlertStatus,
              alerts: b.alerts.map(a => ({ ...a, status: 'read' as AlertStatus, readAt: new Date() })),
            }
          : b
      ));
    } catch (err) {
      console.error('Failed to mark bundle as read:', err);
    }
  }, [getAuthHeaders]);

  // Snooze alert
  const snooze = useCallback(async (alertId: string, hours: number = 24) => {
    try {
      const result = await fetchWithAuth(
        `${API_URL}/api/alerts/${alertId}/snooze`,
        {
          method: 'POST',
          body: JSON.stringify({ hours }),
        },
        getAuthHeaders
      );

      const snoozeUntil = new Date(result.snoozeUntil);

      // Update local state
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, status: 'snoozed' as AlertStatus, snoozeUntil } : a
      ));
      setBundles(prev => prev.map(b => ({
        ...b,
        alerts: b.alerts.map(a =>
          a.id === alertId ? { ...a, status: 'snoozed' as AlertStatus, snoozeUntil } : a
        ),
      })));
    } catch (err) {
      console.error('Failed to snooze alert:', err);
    }
  }, [getAuthHeaders]);

  // Dismiss alert
  const dismiss = useCallback(async (alertId: string) => {
    try {
      await fetchWithAuth(
        `${API_URL}/api/alerts/${alertId}/dismiss`,
        { method: 'POST' },
        getAuthHeaders
      );

      // Remove from local state
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      setBundles(prev => prev.map(b => ({
        ...b,
        alerts: b.alerts.filter(a => a.id !== alertId),
        alertCount: b.alerts.filter(a => a.id !== alertId).length,
      })).filter(b => b.alertCount > 0));
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    }
  }, [getAuthHeaders]);

  // Submit feedback
  const submitFeedback = useCallback(async (
    alertId: string,
    feedback: AlertFeedbackType,
    notes?: string
  ) => {
    try {
      await fetchWithAuth(
        `${API_URL}/api/alerts/${alertId}/feedback`,
        {
          method: 'POST',
          body: JSON.stringify({ feedback, notes }),
        },
        getAuthHeaders
      );

      // Refresh stats after feedback
      await fetchStats();
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      throw err;
    }
  }, [getAuthHeaders, fetchStats]);

  // Update preferences
  const updatePreferences = useCallback(async (updates: Partial<AlertPreferences>) => {
    try {
      const result = await fetchWithAuth(
        `${API_URL}/api/alerts/preferences`,
        {
          method: 'PUT',
          body: JSON.stringify(updates),
        },
        getAuthHeaders
      );

      if (result.success && result.data) {
        setPreferences(result.data);
      }

      // Refresh alerts with new preferences
      await refresh();
    } catch (err) {
      console.error('Failed to update preferences:', err);
      throw err;
    }
  }, [getAuthHeaders, refresh]);

  // Initial fetch
  useEffect(() => {
    refresh();
    fetchStats();
    fetchPreferences();
  }, [refresh, fetchStats, fetchPreferences]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refresh]);

  // WebSocket real-time updates
  useEffect(() => {
    if (!connected) return;

    // WebSocket events would trigger refresh here
    // This integrates with the existing WebSocket context
  }, [connected, refresh]);

  return {
    bundles,
    alerts,
    stats,
    preferences,
    suppressedCount,
    digestCount,
    totalCount,
    loading,
    error,
    refresh,
    markAsRead,
    markBundleAsRead,
    snooze,
    dismiss,
    submitFeedback,
    updatePreferences,
  };
}

// ============================================
// Priority Helpers
// ============================================

export function getAlertPriorityLevel(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score >= 85) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

export function getAlertPriorityColor(score: number): string {
  const level = getAlertPriorityLevel(score);
  switch (level) {
    case 'critical': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-yellow-500';
    case 'low': return 'bg-gray-500';
  }
}

export function getAlertTypeLabel(type: AlertType): string {
  const labels: Record<AlertType, string> = {
    health_score_drop: 'Health Drop',
    health_score_critical: 'Critical Health',
    usage_drop: 'Usage Drop',
    usage_spike: 'Usage Spike',
    renewal_approaching: 'Renewal Soon',
    engagement_drop: 'Engagement Drop',
    champion_left: 'Champion Left',
    nps_detractor: 'NPS Detractor',
    support_escalation: 'Escalation',
    contract_expiring: 'Contract Expiring',
    expansion_signal: 'Expansion Signal',
    adoption_stalled: 'Adoption Stalled',
    invoice_overdue: 'Invoice Overdue',
    stakeholder_inactive: 'Inactive Stakeholder',
    custom: 'Custom',
  };
  return labels[type] || type;
}

export default useAlerts;
