/**
 * useZendeskTickets Hook (PRD-184)
 *
 * Custom hook for fetching and managing Zendesk tickets and support metrics.
 * Provides real-time ticket data, support metrics, and alert management.
 */

import { useState, useCallback, useEffect } from 'react';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// Types
// ============================================

export interface ZendeskTicket {
  id: string;
  zendesk_ticket_id: number;
  customer_id: string;
  subject: string;
  description: string;
  status: 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed';
  priority: 'urgent' | 'high' | 'normal' | 'low' | null;
  ticket_type: 'problem' | 'incident' | 'question' | 'task' | null;
  requester_email: string | null;
  assignee_name: string | null;
  tags: string[];
  satisfaction_rating: string | null;
  zendesk_created_at: string;
  zendesk_updated_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportMetrics {
  customer_id: string;
  metric_date: string;
  open_tickets: number;
  pending_tickets: number;
  escalations: number;
  avg_resolution_hours: number | null;
  csat_score: number | null;
  csat_responses: number;
  ticket_volume_7d: number;
  ticket_volume_30d: number;
  sla_breaches: number;
}

export interface ZendeskAlert {
  id: string;
  customer_id: string;
  ticket_id: string | null;
  alert_type: 'escalation' | 'sla_breach' | 'ticket_spike' | 'negative_csat';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  status: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
  created_at: string;
}

export interface ConnectionStatus {
  configured: boolean;
  connected: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: 'completed' | 'failed' | 'running';
  recordsSynced?: number;
  syncErrors?: string[];
  connection?: {
    subdomain: string;
    authType: 'oauth' | 'api_token';
    config: {
      syncSchedule: string;
      healthScoreWeight: number;
    };
  };
}

interface UseZendeskTicketsOptions {
  customerId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseZendeskTicketsReturn {
  // Ticket data
  tickets: ZendeskTicket[];
  totalTickets: number;
  ticketsLoading: boolean;
  ticketsError: string | null;

  // Metrics data
  metrics: SupportMetrics[];
  latestMetrics: SupportMetrics | null;
  metricsLoading: boolean;
  metricsError: string | null;

  // Alerts
  alerts: ZendeskAlert[];
  alertsLoading: boolean;
  pendingAlertCount: number;

  // Connection status
  connectionStatus: ConnectionStatus | null;
  connectionLoading: boolean;

  // Actions
  fetchTickets: (options?: { status?: string; limit?: number; offset?: number }) => Promise<void>;
  fetchMetrics: (options?: { days?: number }) => Promise<void>;
  fetchAlerts: () => Promise<void>;
  fetchConnectionStatus: () => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
  triggerSync: (incremental?: boolean) => Promise<{ success: boolean; error?: string }>;
  refresh: () => Promise<void>;
}

// ============================================
// Hook Implementation
// ============================================

export function useZendeskTickets(
  options: UseZendeskTicketsOptions = {}
): UseZendeskTicketsReturn {
  const { customerId, autoRefresh = false, refreshInterval = 60000 } = options;

  // Ticket state
  const [tickets, setTickets] = useState<ZendeskTicket[]>([]);
  const [totalTickets, setTotalTickets] = useState(0);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);

  // Metrics state
  const [metrics, setMetrics] = useState<SupportMetrics[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // Alerts state
  const [alerts, setAlerts] = useState<ZendeskAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(false);

  // Computed values
  const latestMetrics = metrics.length > 0 ? metrics[0] : null;
  const pendingAlertCount = alerts.filter(a => a.status === 'pending').length;

  /**
   * Fetch tickets for a customer
   */
  const fetchTickets = useCallback(async (
    fetchOptions: { status?: string; limit?: number; offset?: number } = {}
  ) => {
    if (!customerId) return;

    setTicketsLoading(true);
    setTicketsError(null);

    try {
      const params = new URLSearchParams();
      if (fetchOptions.status) params.append('status', fetchOptions.status);
      if (fetchOptions.limit) params.append('limit', fetchOptions.limit.toString());
      if (fetchOptions.offset) params.append('offset', fetchOptions.offset.toString());

      const response = await fetch(
        `${API_BASE}/integrations/zendesk/tickets/${customerId}?${params.toString()}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch tickets');
      }

      setTickets(data.tickets || []);
      setTotalTickets(data.total || 0);
    } catch (err) {
      setTicketsError(err instanceof Error ? err.message : 'Failed to fetch tickets');
    } finally {
      setTicketsLoading(false);
    }
  }, [customerId]);

  /**
   * Fetch support metrics for a customer
   */
  const fetchMetrics = useCallback(async (
    fetchOptions: { days?: number } = {}
  ) => {
    if (!customerId) return;

    setMetricsLoading(true);
    setMetricsError(null);

    try {
      const params = new URLSearchParams();
      if (fetchOptions.days) params.append('days', fetchOptions.days.toString());

      const response = await fetch(
        `${API_BASE}/integrations/zendesk/metrics/${customerId}?${params.toString()}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch metrics');
      }

      setMetrics(data.metrics || []);
    } catch (err) {
      setMetricsError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setMetricsLoading(false);
    }
  }, [customerId]);

  /**
   * Fetch alerts for a customer
   */
  const fetchAlerts = useCallback(async () => {
    if (!customerId) return;

    setAlertsLoading(true);

    try {
      const response = await fetch(
        `${API_BASE}/integrations/zendesk/alerts/${customerId}`
      );

      const data = await response.json();

      if (response.ok) {
        setAlerts(data.alerts || []);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setAlertsLoading(false);
    }
  }, [customerId]);

  /**
   * Fetch connection status
   */
  const fetchConnectionStatus = useCallback(async () => {
    setConnectionLoading(true);

    try {
      // Get userId from auth context or local storage
      const userId = localStorage.getItem('userId') || 'default-user';

      const response = await fetch(
        `${API_BASE}/integrations/zendesk/status?userId=${userId}`
      );

      const data = await response.json();

      if (response.ok) {
        setConnectionStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch connection status:', err);
    } finally {
      setConnectionLoading(false);
    }
  }, []);

  /**
   * Acknowledge an alert
   */
  const acknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/integrations/zendesk/alerts/${alertId}/acknowledge`,
        { method: 'POST' }
      );

      if (response.ok) {
        setAlerts(prev =>
          prev.map(a =>
            a.id === alertId ? { ...a, status: 'acknowledged' as const } : a
          )
        );
      }
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  }, []);

  /**
   * Dismiss an alert
   */
  const dismissAlert = useCallback(async (alertId: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/integrations/zendesk/alerts/${alertId}/dismiss`,
        { method: 'POST' }
      );

      if (response.ok) {
        setAlerts(prev =>
          prev.map(a =>
            a.id === alertId ? { ...a, status: 'dismissed' as const } : a
          )
        );
      }
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    }
  }, []);

  /**
   * Trigger a sync operation
   */
  const triggerSync = useCallback(async (incremental = true): Promise<{ success: boolean; error?: string }> => {
    try {
      const userId = localStorage.getItem('userId') || 'default-user';

      const response = await fetch(
        `${API_BASE}/integrations/zendesk/sync`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, incremental })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error };
      }

      // Refresh data after sync
      await fetchTickets();
      await fetchMetrics();
      await fetchConnectionStatus();

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Sync failed'
      };
    }
  }, [fetchTickets, fetchMetrics, fetchConnectionStatus]);

  /**
   * Refresh all data
   */
  const refresh = useCallback(async () => {
    await Promise.all([
      fetchTickets(),
      fetchMetrics(),
      fetchAlerts(),
      fetchConnectionStatus()
    ]);
  }, [fetchTickets, fetchMetrics, fetchAlerts, fetchConnectionStatus]);

  // Initial fetch
  useEffect(() => {
    if (customerId) {
      fetchTickets();
      fetchMetrics();
      fetchAlerts();
    }
    fetchConnectionStatus();
  }, [customerId, fetchTickets, fetchMetrics, fetchAlerts, fetchConnectionStatus]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !customerId) return;

    const interval = setInterval(() => {
      fetchTickets();
      fetchMetrics();
      fetchAlerts();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, customerId, fetchTickets, fetchMetrics, fetchAlerts]);

  return {
    // Ticket data
    tickets,
    totalTickets,
    ticketsLoading,
    ticketsError,

    // Metrics data
    metrics,
    latestMetrics,
    metricsLoading,
    metricsError,

    // Alerts
    alerts,
    alertsLoading,
    pendingAlertCount,

    // Connection status
    connectionStatus,
    connectionLoading,

    // Actions
    fetchTickets,
    fetchMetrics,
    fetchAlerts,
    fetchConnectionStatus,
    acknowledgeAlert,
    dismissAlert,
    triggerSync,
    refresh
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get priority color class
 */
export function getPriorityColor(priority: string | null): string {
  switch (priority) {
    case 'urgent':
      return 'text-red-500';
    case 'high':
      return 'text-orange-500';
    case 'normal':
      return 'text-yellow-500';
    case 'low':
      return 'text-gray-500';
    default:
      return 'text-gray-400';
  }
}

/**
 * Get priority badge class
 */
export function getPriorityBadge(priority: string | null): string {
  switch (priority) {
    case 'urgent':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'high':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'normal':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'low':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

/**
 * Get status badge class
 */
export function getStatusBadge(status: string): string {
  switch (status) {
    case 'new':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'open':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'pending':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'hold':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'solved':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'closed':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

/**
 * Get alert severity badge
 */
export function getAlertSeverityBadge(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-600/20 text-red-400 border-red-600/30';
    case 'high':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'medium':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'low':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

/**
 * Format resolution time
 */
export function formatResolutionTime(hours: number | null): string {
  if (hours === null) return '-';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

/**
 * Get CSAT status
 */
export function getCsatStatus(score: number | null): { label: string; color: string } {
  if (score === null) return { label: 'N/A', color: 'text-gray-400' };
  if (score >= 80) return { label: 'Excellent', color: 'text-green-400' };
  if (score >= 60) return { label: 'Good', color: 'text-yellow-400' };
  if (score >= 40) return { label: 'Fair', color: 'text-orange-400' };
  return { label: 'Poor', color: 'text-red-400' };
}

export default useZendeskTickets;
