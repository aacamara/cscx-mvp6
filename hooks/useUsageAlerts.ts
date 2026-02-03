/**
 * Usage Alerts Hook (PRD-086)
 *
 * React hook for managing usage drop alerts, including:
 * - Fetching alerts with filtering
 * - Acknowledging, resolving, and dismissing alerts
 * - Triggering check-in workflows
 * - Managing alert configurations
 */

import { useState, useEffect, useCallback, useReducer } from 'react';
import type {
  UsageAlert,
  UsageAlertFilters,
  UsageAlertSummary,
  AlertConfiguration,
  UsageAlertDashboardState,
  UsageAlertAction,
  AlertActionResponse,
  WorkflowTriggerResponse,
  DetectionRunResponse,
  AlertStatus,
} from '../types/usageAlert';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// Reducer
// ============================================

const initialState: UsageAlertDashboardState = {
  alerts: [],
  loading: true,
  error: null,
  selectedAlertId: null,
  filters: {
    status: 'open',
    severity: 'all',
    metricType: 'all',
    limit: 50,
    offset: 0,
  },
  summary: null,
  configurations: [],
};

function usageAlertReducer(
  state: UsageAlertDashboardState,
  action: UsageAlertAction
): UsageAlertDashboardState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ALERTS':
      return { ...state, alerts: action.payload, loading: false };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'SELECT_ALERT':
      return { ...state, selectedAlertId: action.payload };
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    case 'SET_SUMMARY':
      return { ...state, summary: action.payload };
    case 'UPDATE_ALERT':
      return {
        ...state,
        alerts: state.alerts.map((a) =>
          a.id === action.payload.id ? action.payload : a
        ),
      };
    case 'SET_CONFIGURATIONS':
      return { ...state, configurations: action.payload };
    default:
      return state;
  }
}

// ============================================
// Main Hook
// ============================================

export interface UseUsageAlertsOptions {
  customerId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseUsageAlertsReturn {
  // State
  alerts: UsageAlert[];
  loading: boolean;
  error: string | null;
  selectedAlert: UsageAlert | null;
  filters: UsageAlertFilters;
  summary: UsageAlertSummary | null;
  configurations: AlertConfiguration[];

  // Actions
  fetchAlerts: () => Promise<void>;
  fetchSummary: () => Promise<void>;
  setFilters: (filters: Partial<UsageAlertFilters>) => void;
  selectAlert: (alertId: string | null) => void;
  acknowledgeAlert: (alertId: string) => Promise<AlertActionResponse>;
  startProgress: (alertId: string) => Promise<AlertActionResponse>;
  resolveAlert: (alertId: string, notes?: string) => Promise<AlertActionResponse>;
  dismissAlert: (alertId: string, reason?: string) => Promise<AlertActionResponse>;
  triggerWorkflow: (alertId: string) => Promise<WorkflowTriggerResponse>;
  runDetection: (customerId?: string) => Promise<DetectionRunResponse>;
  fetchConfigurations: () => Promise<void>;
  updateConfiguration: (config: Partial<AlertConfiguration> & { id: string }) => Promise<boolean>;
}

export function useUsageAlerts(options: UseUsageAlertsOptions = {}): UseUsageAlertsReturn {
  const { customerId, autoRefresh = false, refreshInterval = 60000 } = options;
  const [state, dispatch] = useReducer(usageAlertReducer, {
    ...initialState,
    filters: { ...initialState.filters, customerId },
  });

  // ============================================
  // Fetch Alerts
  // ============================================

  const fetchAlerts = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const params = new URLSearchParams();
      if (state.filters.status && state.filters.status !== 'all') {
        params.append('status', state.filters.status);
      }
      if (state.filters.severity && state.filters.severity !== 'all') {
        params.append('severity', state.filters.severity);
      }
      if (state.filters.metricType && state.filters.metricType !== 'all') {
        params.append('metric_type', state.filters.metricType);
      }
      if (state.filters.customerId) {
        params.append('customer_id', state.filters.customerId);
      }
      if (state.filters.limit) {
        params.append('limit', state.filters.limit.toString());
      }
      if (state.filters.offset) {
        params.append('offset', state.filters.offset.toString());
      }

      const response = await fetch(`${API_BASE}/usage-alerts?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch usage alerts');
      }

      const data = await response.json();
      dispatch({ type: 'SET_ALERTS', payload: data.alerts || [] });

      if (data.summary) {
        dispatch({ type: 'SET_SUMMARY', payload: data.summary });
      }
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        payload: err instanceof Error ? err.message : 'Failed to load alerts',
      });
    }
  }, [state.filters]);

  // ============================================
  // Fetch Summary
  // ============================================

  const fetchSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (customerId) {
        params.append('customer_id', customerId);
      }

      const response = await fetch(`${API_BASE}/usage-alerts/summary?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch alert summary');
      }

      const data = await response.json();
      dispatch({ type: 'SET_SUMMARY', payload: data });
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    }
  }, [customerId]);

  // ============================================
  // Alert Actions
  // ============================================

  const updateAlertStatus = useCallback(
    async (alertId: string, status: AlertStatus, notes?: string): Promise<AlertActionResponse> => {
      try {
        const response = await fetch(`${API_BASE}/usage-alerts/${alertId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, notes }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          return { success: false, error: errorData.error || 'Failed to update alert' };
        }

        const data = await response.json();
        if (data.alert) {
          dispatch({ type: 'UPDATE_ALERT', payload: data.alert });
        }
        return { success: true, alert: data.alert, message: data.message };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to update alert',
        };
      }
    },
    []
  );

  const acknowledgeAlert = useCallback(
    (alertId: string) => updateAlertStatus(alertId, 'acknowledged'),
    [updateAlertStatus]
  );

  const startProgress = useCallback(
    (alertId: string) => updateAlertStatus(alertId, 'in_progress'),
    [updateAlertStatus]
  );

  const resolveAlert = useCallback(
    (alertId: string, notes?: string) => updateAlertStatus(alertId, 'resolved', notes),
    [updateAlertStatus]
  );

  const dismissAlert = useCallback(
    (alertId: string, reason?: string) => updateAlertStatus(alertId, 'dismissed', reason),
    [updateAlertStatus]
  );

  // ============================================
  // Workflow Trigger
  // ============================================

  const triggerWorkflow = useCallback(
    async (alertId: string): Promise<WorkflowTriggerResponse> => {
      try {
        const response = await fetch(`${API_BASE}/v1/usage/drops/${alertId}/workflow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const errorData = await response.json();
          return { success: false, error: errorData.error || 'Failed to trigger workflow' };
        }

        const data = await response.json();

        // Refresh the alert to get updated workflow status
        await fetchAlerts();

        return {
          success: data.success,
          workflowId: data.workflow_id,
          steps: data.steps,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to trigger workflow',
        };
      }
    },
    [fetchAlerts]
  );

  // ============================================
  // Detection Run
  // ============================================

  const runDetection = useCallback(
    async (targetCustomerId?: string): Promise<DetectionRunResponse> => {
      try {
        const endpoint = targetCustomerId
          ? `${API_BASE}/v1/usage/detect-drops`
          : `${API_BASE}/v1/usage/detect-drops-all`;

        const body = targetCustomerId ? { customerId: targetCustomerId } : {};

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json();
          return {
            success: false,
            processed: 0,
            alertsGenerated: 0,
            results: [],
          };
        }

        const data = await response.json();

        // Refresh alerts after detection
        await fetchAlerts();

        return {
          success: data.success,
          processed: data.processed,
          alertsGenerated: data.alerts_generated,
          results: data.results || [],
        };
      } catch (err) {
        return {
          success: false,
          processed: 0,
          alertsGenerated: 0,
          results: [],
        };
      }
    },
    [fetchAlerts]
  );

  // ============================================
  // Configurations
  // ============================================

  const fetchConfigurations = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/usage-alerts/configurations`);
      if (!response.ok) {
        throw new Error('Failed to fetch configurations');
      }

      const data = await response.json();
      dispatch({ type: 'SET_CONFIGURATIONS', payload: data.configurations || [] });
    } catch (err) {
      console.error('Failed to fetch configurations:', err);
    }
  }, []);

  const updateConfiguration = useCallback(
    async (config: Partial<AlertConfiguration> & { id: string }): Promise<boolean> => {
      try {
        const response = await fetch(`${API_BASE}/usage-alerts/configurations/${config.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });

        if (!response.ok) {
          return false;
        }

        await fetchConfigurations();
        return true;
      } catch (err) {
        console.error('Failed to update configuration:', err);
        return false;
      }
    },
    [fetchConfigurations]
  );

  // ============================================
  // Filter Updates
  // ============================================

  const setFilters = useCallback((newFilters: Partial<UsageAlertFilters>) => {
    dispatch({ type: 'SET_FILTERS', payload: newFilters });
  }, []);

  const selectAlert = useCallback((alertId: string | null) => {
    dispatch({ type: 'SELECT_ALERT', payload: alertId });
  }, []);

  // ============================================
  // Effects
  // ============================================

  // Fetch on mount and filter change
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchAlerts, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchAlerts]);

  // ============================================
  // Return
  // ============================================

  const selectedAlert = state.selectedAlertId
    ? state.alerts.find((a) => a.id === state.selectedAlertId) || null
    : null;

  return {
    // State
    alerts: state.alerts,
    loading: state.loading,
    error: state.error,
    selectedAlert,
    filters: state.filters,
    summary: state.summary,
    configurations: state.configurations,

    // Actions
    fetchAlerts,
    fetchSummary,
    setFilters,
    selectAlert,
    acknowledgeAlert,
    startProgress,
    resolveAlert,
    dismissAlert,
    triggerWorkflow,
    runDetection,
    fetchConfigurations,
    updateConfiguration,
  };
}

// ============================================
// Additional Hooks
// ============================================

/**
 * Hook for a single alert's detail view
 */
export function useUsageAlertDetail(alertId: string | null) {
  const [alert, setAlert] = useState<UsageAlert | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!alertId) {
      setAlert(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/usage-alerts/${alertId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch alert');
        return res.json();
      })
      .then((data) => {
        setAlert(data.alert);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [alertId]);

  return { alert, loading, error };
}

/**
 * Hook for customer-specific usage alerts
 */
export function useCustomerUsageAlerts(customerId: string) {
  const [alerts, setAlerts] = useState<UsageAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/v1/usage/drops/${customerId}?status=all&limit=20`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch customer alerts');
      }

      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return { alerts, loading, error, refetch: fetchAlerts };
}

export default useUsageAlerts;
