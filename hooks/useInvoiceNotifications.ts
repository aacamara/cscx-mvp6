/**
 * Invoice Notifications Hook
 * PRD-125: Custom hook for invoice CSM notifications
 */

import { useState, useCallback, useEffect } from 'react';
import {
  InvoiceNotification,
  InvoiceNotificationFilters,
  InvoiceDashboard,
  InvoiceNotificationPreferences,
} from '../types/invoice';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// Types
// ============================================

interface UseInvoiceNotificationsOptions {
  csmId: string;
  autoFetch?: boolean;
  initialFilters?: InvoiceNotificationFilters;
}

interface UseInvoiceNotificationsReturn {
  // Notifications data
  notifications: InvoiceNotification[];
  loading: boolean;
  error: string | null;

  // Pagination
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };

  // Summary stats
  summary: {
    totalPending: number;
    totalOverdue: number;
    totalAtRisk: number;
    totalAmount: number;
  };

  // Filters
  filters: InvoiceNotificationFilters;
  setFilters: React.Dispatch<React.SetStateAction<InvoiceNotificationFilters>>;

  // Actions
  fetchNotifications: (page?: number) => Promise<void>;
  refetch: () => Promise<void>;
  acknowledgeNotification: (id: string, actionTaken?: string) => Promise<void>;
  updateInvoiceStatus: (invoiceId: string, status: string, paymentDate?: Date) => Promise<void>;

  // Dashboard
  dashboard: InvoiceDashboard | null;
  dashboardLoading: boolean;
  fetchDashboard: () => Promise<void>;

  // Pending invoices (quick access)
  pendingNotifications: InvoiceNotification[];
  pendingLoading: boolean;
  fetchPending: () => Promise<void>;

  // Customer detail
  customerNotifications: InvoiceNotification[];
  customerLoading: boolean;
  fetchCustomerNotifications: (customerId: string) => Promise<void>;

  // Preferences
  preferences: InvoiceNotificationPreferences | null;
  preferencesLoading: boolean;
  fetchPreferences: () => Promise<void>;
  updatePreferences: (prefs: Partial<InvoiceNotificationPreferences>) => Promise<void>;

  // Utilities
  formatCurrency: (amount: number, currency?: string) => string;
  formatDate: (date: Date | string) => string;
  getDaysUntilDue: (dueDate: Date | string) => number;
  getRiskLevel: (riskScore: number) => 'low' | 'medium' | 'high';
}

// ============================================
// Hook Implementation
// ============================================

export const useInvoiceNotifications = (
  options: UseInvoiceNotificationsOptions
): UseInvoiceNotificationsReturn => {
  const { csmId, autoFetch = true, initialFilters = {} } = options;

  // Notifications state
  const [notifications, setNotifications] = useState<InvoiceNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [summary, setSummary] = useState({
    totalPending: 0,
    totalOverdue: 0,
    totalAtRisk: 0,
    totalAmount: 0,
  });
  const [filters, setFilters] = useState<InvoiceNotificationFilters>({
    status: 'all',
    ...initialFilters,
  });

  // Dashboard state
  const [dashboard, setDashboard] = useState<InvoiceDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Pending state
  const [pendingNotifications, setPendingNotifications] = useState<InvoiceNotification[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  // Customer state
  const [customerNotifications, setCustomerNotifications] = useState<InvoiceNotification[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);

  // Preferences state
  const [preferences, setPreferences] = useState<InvoiceNotificationPreferences | null>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(false);

  // ============================================
  // Fetch Functions
  // ============================================

  /**
   * Fetch notifications with filters and pagination
   */
  const fetchNotifications = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('pageSize', pagination.pageSize.toString());

      if (filters.status && filters.status !== 'all') {
        params.append('status', filters.status);
      }
      if (filters.customerId) {
        params.append('customerId', filters.customerId);
      }
      if (filters.minAmount !== undefined) {
        params.append('minAmount', filters.minAmount.toString());
      }
      if (filters.maxAmount !== undefined) {
        params.append('maxAmount', filters.maxAmount.toString());
      }
      if (filters.hasRiskFlags !== undefined) {
        params.append('hasRiskFlags', filters.hasRiskFlags.toString());
      }
      if (filters.acknowledged !== undefined) {
        params.append('acknowledged', filters.acknowledged.toString());
      }

      const response = await fetch(`${API_BASE}/invoices/csm/${csmId}?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch invoice notifications');
      }

      const result = await response.json();

      if (result.success) {
        setNotifications(result.notifications.map(parseNotification));
        setPagination(result.pagination);
        setSummary(result.summary);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('Invoice notifications fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [csmId, filters, pagination.pageSize]);

  /**
   * Fetch dashboard data
   */
  const fetchDashboard = useCallback(async () => {
    setDashboardLoading(true);

    try {
      const response = await fetch(`${API_BASE}/invoices/csm/${csmId}/dashboard`);

      if (!response.ok) {
        throw new Error('Failed to fetch invoice dashboard');
      }

      const result = await response.json();

      if (result.success) {
        setDashboard({
          ...result.dashboard,
          recentNotifications: result.dashboard.recentNotifications.map(parseNotification),
          upcomingDueDates: result.dashboard.upcomingDueDates.map((item: any) => ({
            ...item,
            notification: parseNotification(item.notification),
          })),
          riskAlerts: result.dashboard.riskAlerts.map((item: any) => ({
            ...item,
            notification: parseNotification(item.notification),
          })),
        });
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setDashboardLoading(false);
    }
  }, [csmId]);

  /**
   * Fetch pending notifications
   */
  const fetchPending = useCallback(async () => {
    setPendingLoading(true);

    try {
      const response = await fetch(`${API_BASE}/invoices/csm/${csmId}/pending`);

      if (!response.ok) {
        throw new Error('Failed to fetch pending invoices');
      }

      const result = await response.json();

      if (result.success) {
        setPendingNotifications(result.notifications.map(parseNotification));
      }
    } catch (err) {
      console.error('Pending invoices fetch error:', err);
    } finally {
      setPendingLoading(false);
    }
  }, [csmId]);

  /**
   * Fetch notifications for a specific customer
   */
  const fetchCustomerNotifications = useCallback(async (customerId: string) => {
    setCustomerLoading(true);

    try {
      const response = await fetch(`${API_BASE}/invoices/customer/${customerId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch customer invoices');
      }

      const result = await response.json();

      if (result.success) {
        setCustomerNotifications(result.notifications.map(parseNotification));
      }
    } catch (err) {
      console.error('Customer invoices fetch error:', err);
    } finally {
      setCustomerLoading(false);
    }
  }, []);

  /**
   * Fetch preferences
   */
  const fetchPreferences = useCallback(async () => {
    setPreferencesLoading(true);

    try {
      const response = await fetch(`${API_BASE}/invoices/preferences/${csmId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch preferences');
      }

      const result = await response.json();

      if (result.success) {
        setPreferences(result.preferences);
      }
    } catch (err) {
      console.error('Preferences fetch error:', err);
    } finally {
      setPreferencesLoading(false);
    }
  }, [csmId]);

  // ============================================
  // Action Functions
  // ============================================

  /**
   * Acknowledge a notification
   */
  const acknowledgeNotification = useCallback(async (id: string, actionTaken?: string) => {
    try {
      const response = await fetch(`${API_BASE}/invoices/${id}/acknowledge`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionTaken }),
      });

      if (!response.ok) {
        throw new Error('Failed to acknowledge notification');
      }

      const result = await response.json();

      if (result.success) {
        // Update local state
        setNotifications(prev =>
          prev.map(n =>
            n.id === id
              ? { ...n, acknowledgedAt: new Date(), actionTaken: actionTaken || null }
              : n
          )
        );
        setPendingNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (err) {
      console.error('Acknowledge error:', err);
      throw err;
    }
  }, []);

  /**
   * Update invoice status
   */
  const updateInvoiceStatus = useCallback(async (
    invoiceId: string,
    status: string,
    paymentDate?: Date
  ) => {
    try {
      const response = await fetch(`${API_BASE}/invoices/${invoiceId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, paymentDate: paymentDate?.toISOString() }),
      });

      if (!response.ok) {
        throw new Error('Failed to update invoice status');
      }

      // Refetch to get updated data
      await fetchNotifications(pagination.page);
    } catch (err) {
      console.error('Update status error:', err);
      throw err;
    }
  }, [fetchNotifications, pagination.page]);

  /**
   * Update preferences
   */
  const updatePreferences = useCallback(async (prefs: Partial<InvoiceNotificationPreferences>) => {
    try {
      const response = await fetch(`${API_BASE}/invoices/preferences/${csmId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      // Refetch preferences
      await fetchPreferences();
    } catch (err) {
      console.error('Update preferences error:', err);
      throw err;
    }
  }, [csmId, fetchPreferences]);

  // ============================================
  // Utility Functions
  // ============================================

  const formatCurrency = useCallback((amount: number, currency = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  }, []);

  const formatDate = useCallback((date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  const getDaysUntilDue = useCallback((dueDate: Date | string): number => {
    const d = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
    return Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  }, []);

  const getRiskLevel = useCallback((riskScore: number): 'low' | 'medium' | 'high' => {
    if (riskScore >= 60) return 'high';
    if (riskScore >= 30) return 'medium';
    return 'low';
  }, []);

  // ============================================
  // Effects
  // ============================================

  // Auto-fetch on mount and filter changes
  useEffect(() => {
    if (autoFetch) {
      fetchNotifications();
    }
  }, [autoFetch, fetchNotifications]);

  // ============================================
  // Return
  // ============================================

  return {
    // Notifications data
    notifications,
    loading,
    error,

    // Pagination
    pagination,

    // Summary stats
    summary,

    // Filters
    filters,
    setFilters,

    // Actions
    fetchNotifications,
    refetch: () => fetchNotifications(pagination.page),
    acknowledgeNotification,
    updateInvoiceStatus,

    // Dashboard
    dashboard,
    dashboardLoading,
    fetchDashboard,

    // Pending
    pendingNotifications,
    pendingLoading,
    fetchPending,

    // Customer
    customerNotifications,
    customerLoading,
    fetchCustomerNotifications,

    // Preferences
    preferences,
    preferencesLoading,
    fetchPreferences,
    updatePreferences,

    // Utilities
    formatCurrency,
    formatDate,
    getDaysUntilDue,
    getRiskLevel,
  };
};

// ============================================
// Helper Functions
// ============================================

/**
 * Parse notification dates from API response
 */
function parseNotification(notification: any): InvoiceNotification {
  return {
    ...notification,
    dueDate: new Date(notification.dueDate),
    notifiedAt: new Date(notification.notifiedAt),
    acknowledgedAt: notification.acknowledgedAt ? new Date(notification.acknowledgedAt) : null,
    paymentReceivedAt: notification.paymentReceivedAt ? new Date(notification.paymentReceivedAt) : null,
    createdAt: new Date(notification.createdAt),
    updatedAt: new Date(notification.updatedAt),
    customerContext: {
      ...notification.customerContext,
      renewalDate: notification.customerContext.renewalDate
        ? new Date(notification.customerContext.renewalDate)
        : null,
    },
  };
}

export default useInvoiceNotifications;
