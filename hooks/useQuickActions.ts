/**
 * useQuickActions Hook - PRD-265
 *
 * React hook for quick action widget data and operations.
 * Provides:
 * - Priority customer data
 * - Today's tasks
 * - Portfolio overview
 * - Quick action execution (notes, tasks, calls)
 * - Widget configuration management
 * - Automatic refresh with caching
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Types
// ============================================

export type WidgetType =
  | 'customer_quick_view'
  | 'portfolio_overview'
  | 'tasks_today'
  | 'quick_compose'
  | 'notification_summary';

export type WidgetSize = 'small' | 'medium' | 'large';

export type QuickActionType =
  | 'quick_note'
  | 'check_health'
  | 'create_task'
  | 'voice_note'
  | 'call_contact';

export interface CustomerSummary {
  id: string;
  name: string;
  healthScore: number;
  healthTrend: 'up' | 'down' | 'stable';
  arr: number;
  renewalDate: string | null;
  isAtRisk: boolean;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
}

export interface TaskSummary {
  id: string;
  title: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  customerId?: string;
  customerName?: string;
  isOverdue: boolean;
}

export interface PortfolioOverview {
  totalCustomers: number;
  totalArr: number;
  avgHealthScore: number;
  atRiskCount: number;
  renewalsThisMonth: number;
  pendingTasksCount: number;
  pendingApprovalsCount: number;
}

export interface NotificationSummary {
  id: string;
  type: string;
  title: string;
  body: string;
  priority: string;
  customerId?: string;
  createdAt: string;
}

export interface WidgetConfig {
  id: string;
  userId: string;
  widgetType: WidgetType;
  size: WidgetSize;
  position: number;
  settings: {
    customerIds?: string[];
    defaultAction?: QuickActionType;
    refreshInterval?: number;
    theme?: 'light' | 'dark' | 'system';
  };
  createdAt: string;
  updatedAt: string;
}

export interface QuickNoteInput {
  customerId: string;
  content: string;
  isVoiceNote?: boolean;
  audioUrl?: string;
}

export interface QuickTaskInput {
  customerId?: string;
  title: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

// ============================================
// Hook: usePriorityCustomers
// ============================================

export function usePriorityCustomers(limit: number = 5, customerIds?: string[]) {
  const { getAuthHeaders } = useAuth();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ limit: limit.toString() });
      if (customerIds?.length) {
        params.set('customerIds', customerIds.join(','));
      }

      const response = await fetch(
        `${API_URL}/api/quick-actions/customers/priority?${params}`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch priority customers');
      }

      const { data } = await response.json();
      setCustomers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }, [limit, customerIds?.join(','), getAuthHeaders]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return { customers, loading, error, refetch: fetchCustomers };
}

// ============================================
// Hook: useTasksToday
// ============================================

export function useTasksToday(limit: number = 10) {
  const { getAuthHeaders } = useAuth();
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/api/quick-actions/tasks/today?limit=${limit}`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }

      const { data } = await response.json();
      setTasks(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [limit, getAuthHeaders]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return { tasks, loading, error, refetch: fetchTasks };
}

// ============================================
// Hook: usePortfolioOverview
// ============================================

export function usePortfolioOverview() {
  const { getAuthHeaders } = useAuth();
  const [portfolio, setPortfolio] = useState<PortfolioOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/api/quick-actions/portfolio`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch portfolio overview');
      }

      const { data } = await response.json();
      setPortfolio(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch portfolio');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  return { portfolio, loading, error, refetch: fetchPortfolio };
}

// ============================================
// Hook: useWidgetData
// ============================================

export function useWidgetData(
  widgetType: WidgetType,
  refreshInterval: number = 15 // minutes
) {
  const { getAuthHeaders } = useAuth();
  const [data, setData] = useState<{
    customers?: CustomerSummary[];
    tasks?: TaskSummary[];
    portfolio?: PortfolioOverview;
    notifications?: NotificationSummary[];
    lastUpdated?: string;
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/api/quick-actions/widgets/${widgetType}/data`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch widget data');
      }

      const { data: widgetData } = await response.json();
      setData(widgetData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [widgetType, getAuthHeaders]);

  useEffect(() => {
    fetchData();

    if (refreshInterval > 0) {
      intervalRef.current = setInterval(fetchData, refreshInterval * 60 * 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, refreshInterval]);

  return { ...data, loading, error, refetch: fetchData };
}

// ============================================
// Hook: useQuickActions
// ============================================

export function useQuickActions() {
  const { getAuthHeaders } = useAuth();
  const [executing, setExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    data?: any;
    error?: string;
  } | null>(null);

  /**
   * Create a quick note for a customer
   */
  const createNote = useCallback(async (input: QuickNoteInput) => {
    setExecuting(true);
    setLastResult(null);

    try {
      const response = await fetch(`${API_URL}/api/quick-actions/note`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      const result = await response.json();
      setLastResult(result.success ? { success: true, data: result.data } : { success: false, error: result.error?.message });
      return result;
    } catch (err) {
      const error = { success: false, error: err instanceof Error ? err.message : 'Failed to create note' };
      setLastResult(error);
      return error;
    } finally {
      setExecuting(false);
    }
  }, [getAuthHeaders]);

  /**
   * Create a voice note
   */
  const createVoiceNote = useCallback(async (input: QuickNoteInput) => {
    setExecuting(true);
    setLastResult(null);

    try {
      const response = await fetch(`${API_URL}/api/quick-actions/voice-note`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      const result = await response.json();
      setLastResult(result.success ? { success: true, data: result.data } : { success: false, error: result.error?.message });
      return result;
    } catch (err) {
      const error = { success: false, error: err instanceof Error ? err.message : 'Failed to create voice note' };
      setLastResult(error);
      return error;
    } finally {
      setExecuting(false);
    }
  }, [getAuthHeaders]);

  /**
   * Create a quick task
   */
  const createTask = useCallback(async (input: QuickTaskInput) => {
    setExecuting(true);
    setLastResult(null);

    try {
      const response = await fetch(`${API_URL}/api/quick-actions/task`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      const result = await response.json();
      setLastResult(result.success ? { success: true, data: result.data } : { success: false, error: result.error?.message });
      return result;
    } catch (err) {
      const error = { success: false, error: err instanceof Error ? err.message : 'Failed to create task' };
      setLastResult(error);
      return error;
    } finally {
      setExecuting(false);
    }
  }, [getAuthHeaders]);

  /**
   * Check customer health
   */
  const checkHealth = useCallback(async (customerId: string) => {
    setExecuting(true);
    setLastResult(null);

    try {
      const response = await fetch(
        `${API_URL}/api/quick-actions/customer/${customerId}/health`,
        { headers: getAuthHeaders() }
      );

      const result = await response.json();
      setLastResult(result.success ? { success: true, data: result.data } : { success: false, error: result.error?.message });
      return result;
    } catch (err) {
      const error = { success: false, error: err instanceof Error ? err.message : 'Failed to check health' };
      setLastResult(error);
      return error;
    } finally {
      setExecuting(false);
    }
  }, [getAuthHeaders]);

  /**
   * Get call info for customer
   */
  const getCallInfo = useCallback(async (customerId: string) => {
    setExecuting(true);
    setLastResult(null);

    try {
      const response = await fetch(
        `${API_URL}/api/quick-actions/customer/${customerId}/call`,
        { headers: getAuthHeaders() }
      );

      const result = await response.json();
      setLastResult(result.success ? { success: true, data: result.data } : { success: false, error: result.error?.message });
      return result;
    } catch (err) {
      const error = { success: false, error: err instanceof Error ? err.message : 'Failed to get call info' };
      setLastResult(error);
      return error;
    } finally {
      setExecuting(false);
    }
  }, [getAuthHeaders]);

  /**
   * Initiate a phone call
   */
  const callContact = useCallback(async (customerId: string) => {
    const result = await getCallInfo(customerId);
    if (result.success && result.data?.callUrl) {
      window.location.href = result.data.callUrl;
    }
    return result;
  }, [getCallInfo]);

  return {
    executing,
    lastResult,
    createNote,
    createVoiceNote,
    createTask,
    checkHealth,
    getCallInfo,
    callContact,
  };
}

// ============================================
// Hook: useWidgetConfigs
// ============================================

export function useWidgetConfigs() {
  const { getAuthHeaders } = useAuth();
  const [configs, setConfigs] = useState<WidgetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchConfigs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/quick-actions/widgets`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch widget configs');
      }

      const { data } = await response.json();
      setConfigs(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch configs');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const saveConfig = useCallback(async (config: Partial<WidgetConfig>) => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/quick-actions/widgets`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Failed to save widget config');
      }

      const { data } = await response.json();
      await fetchConfigs(); // Refresh configs
      return { success: true, config: data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to save' };
    } finally {
      setSaving(false);
    }
  }, [getAuthHeaders, fetchConfigs]);

  const deleteConfig = useCallback(async (configId: string) => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/quick-actions/widgets/${configId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to delete widget config');
      }

      await fetchConfigs(); // Refresh configs
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete' };
    } finally {
      setSaving(false);
    }
  }, [getAuthHeaders, fetchConfigs]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  return {
    configs,
    loading,
    error,
    saving,
    refetch: fetchConfigs,
    saveConfig,
    deleteConfig,
  };
}

// ============================================
// Default Export
// ============================================

export default {
  usePriorityCustomers,
  useTasksToday,
  usePortfolioOverview,
  useWidgetData,
  useQuickActions,
  useWidgetConfigs,
};
