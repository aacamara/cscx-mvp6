/**
 * Quiet Accounts Hook
 * PRD-106: Custom hook for fetching and managing quiet account alerts
 *
 * Provides:
 * - Portfolio-level quiet account detection
 * - Individual account detail and suggestions
 * - Interaction recording for re-engagement tracking
 * - Check-in email generation
 */

import { useState, useCallback, useEffect } from 'react';
import {
  QuietAccountsResponse,
  QuietAccountDetailResponse,
  QuietAccountAlert,
  QuietAccountSummary,
  QuietAccountFilters,
  ReEngagementSuggestion,
  CheckInEmailDraft,
  InteractionType,
  QuietSeverity,
  CustomerSegment,
} from '../types/quietAccount';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

interface UseQuietAccountsOptions {
  autoFetch?: boolean;
  initialFilters?: QuietAccountFilters;
  pollInterval?: number; // Polling interval in ms (0 = disabled)
}

interface UseQuietAccountsReturn {
  // Portfolio data
  accounts: QuietAccountAlert[];
  summary: QuietAccountSummary | null;
  loading: boolean;
  error: string | null;

  // Filters
  filters: QuietAccountFilters;
  setFilters: React.Dispatch<React.SetStateAction<QuietAccountFilters>>;

  // Actions
  fetchQuietAccounts: () => Promise<void>;
  refetch: () => Promise<void>;

  // Account detail
  selectedAccountId: string | null;
  accountDetail: QuietAccountDetailResponse | null;
  accountDetailLoading: boolean;
  fetchAccountDetail: (customerId: string) => Promise<void>;
  clearAccountDetail: () => void;

  // Re-engagement
  recordInteraction: (customerId: string, type: InteractionType, date?: string) => Promise<boolean>;
  markReEngaged: (customerId: string, interactionType?: InteractionType) => Promise<boolean>;

  // Email draft
  fetchCheckInEmail: (customerId: string) => Promise<CheckInEmailDraft | null>;

  // Alert management
  markAlertSent: (customerId: string) => Promise<boolean>;
  excludeFromAlerts: (customerId: string, reason: string, excludeUntil?: string) => Promise<boolean>;

  // Manual scan
  runScan: () => Promise<{ found: number; events: any[] }>;
}

export const useQuietAccounts = (
  options: UseQuietAccountsOptions = {}
): UseQuietAccountsReturn => {
  const { autoFetch = true, initialFilters = {}, pollInterval = 0 } = options;

  // Portfolio state
  const [accounts, setAccounts] = useState<QuietAccountAlert[]>([]);
  const [summary, setSummary] = useState<QuietAccountSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<QuietAccountFilters>({
    sortBy: 'quiet_days',
    sortOrder: 'desc',
    ...initialFilters,
  });

  // Account detail state
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [accountDetail, setAccountDetail] = useState<QuietAccountDetailResponse | null>(null);
  const [accountDetailLoading, setAccountDetailLoading] = useState(false);

  /**
   * Fetch quiet accounts with current filters
   */
  const fetchQuietAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (filters.severity) {
        params.append('severity', filters.severity);
      }
      if (filters.segment) {
        params.append('segment', filters.segment);
      }
      if (filters.minQuietDays) {
        params.append('minQuietDays', String(filters.minQuietDays));
      }
      if (filters.maxQuietDays) {
        params.append('maxQuietDays', String(filters.maxQuietDays));
      }
      if (filters.csmId) {
        params.append('csmId', filters.csmId);
      }
      if (filters.sortBy) {
        params.append('sortBy', filters.sortBy);
      }
      if (filters.sortOrder) {
        params.append('sortOrder', filters.sortOrder);
      }
      if (filters.includeExcluded) {
        params.append('includeExcluded', 'true');
      }

      const response = await fetch(`${API_BASE}/quiet-accounts?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch quiet accounts');
      }

      const result = await response.json();

      if (result.success) {
        setAccounts(result.data.accounts);
        setSummary(result.data.summary);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('Quiet accounts fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  /**
   * Fetch account detail
   */
  const fetchAccountDetail = useCallback(async (customerId: string) => {
    setSelectedAccountId(customerId);
    setAccountDetailLoading(true);

    try {
      const response = await fetch(`${API_BASE}/quiet-accounts/${customerId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch account detail');
      }

      const result = await response.json();

      if (result.success) {
        setAccountDetail(result.data);
      } else {
        setAccountDetail(null);
      }
    } catch (err) {
      console.error('Account detail fetch error:', err);
      setAccountDetail(null);
    } finally {
      setAccountDetailLoading(false);
    }
  }, []);

  /**
   * Clear account detail selection
   */
  const clearAccountDetail = useCallback(() => {
    setSelectedAccountId(null);
    setAccountDetail(null);
  }, []);

  /**
   * Record an interaction (resets quiet status)
   */
  const recordInteraction = useCallback(
    async (customerId: string, type: InteractionType, date?: string): Promise<boolean> => {
      try {
        const response = await fetch(`${API_BASE}/quiet-accounts/${customerId}/interactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, date }),
        });

        if (!response.ok) {
          return false;
        }

        const result = await response.json();

        if (result.success) {
          // Refresh the accounts list
          await fetchQuietAccounts();
          return true;
        }

        return false;
      } catch (err) {
        console.error('Record interaction error:', err);
        return false;
      }
    },
    [fetchQuietAccounts]
  );

  /**
   * Mark account as re-engaged
   */
  const markReEngaged = useCallback(
    async (customerId: string, interactionType?: InteractionType): Promise<boolean> => {
      try {
        const response = await fetch(`${API_BASE}/quiet-accounts/${customerId}/re-engage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interactionType }),
        });

        if (!response.ok) {
          return false;
        }

        const result = await response.json();

        if (result.success) {
          // Remove from local state
          setAccounts((prev) => prev.filter((a) => a.customerId !== customerId));
          return true;
        }

        return false;
      } catch (err) {
        console.error('Mark re-engaged error:', err);
        return false;
      }
    },
    []
  );

  /**
   * Fetch check-in email draft
   */
  const fetchCheckInEmail = useCallback(
    async (customerId: string): Promise<CheckInEmailDraft | null> => {
      try {
        const response = await fetch(`${API_BASE}/quiet-accounts/${customerId}/check-in-email`);

        if (!response.ok) {
          return null;
        }

        const result = await response.json();
        return result.success ? result.data : null;
      } catch (err) {
        console.error('Fetch check-in email error:', err);
        return null;
      }
    },
    []
  );

  /**
   * Mark alert as sent
   */
  const markAlertSent = useCallback(async (customerId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/quiet-accounts/${customerId}/alert-sent`, {
        method: 'POST',
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      return result.success;
    } catch (err) {
      console.error('Mark alert sent error:', err);
      return false;
    }
  }, []);

  /**
   * Exclude account from alerts
   */
  const excludeFromAlerts = useCallback(
    async (customerId: string, reason: string, excludeUntil?: string): Promise<boolean> => {
      try {
        const response = await fetch(`${API_BASE}/quiet-accounts/${customerId}/exclude`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason, excludeUntil }),
        });

        if (!response.ok) {
          return false;
        }

        const result = await response.json();

        if (result.success) {
          // Remove from local state
          setAccounts((prev) => prev.filter((a) => a.customerId !== customerId));
          return true;
        }

        return false;
      } catch (err) {
        console.error('Exclude from alerts error:', err);
        return false;
      }
    },
    []
  );

  /**
   * Run manual scan for quiet accounts
   */
  const runScan = useCallback(async (): Promise<{ found: number; events: any[] }> => {
    try {
      const response = await fetch(`${API_BASE}/quiet-accounts/scan`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Scan failed');
      }

      const result = await response.json();

      if (result.success) {
        // Refresh the accounts list
        await fetchQuietAccounts();
        return {
          found: result.data.quietAccountsFound,
          events: result.data.events,
        };
      }

      return { found: 0, events: [] };
    } catch (err) {
      console.error('Run scan error:', err);
      return { found: 0, events: [] };
    }
  }, [fetchQuietAccounts]);

  /**
   * Refetch data (alias)
   */
  const refetch = fetchQuietAccounts;

  // Auto-fetch on mount and filter changes
  useEffect(() => {
    if (autoFetch) {
      fetchQuietAccounts();
    }
  }, [autoFetch, fetchQuietAccounts]);

  // Polling
  useEffect(() => {
    if (pollInterval <= 0) return;

    const interval = setInterval(() => {
      fetchQuietAccounts();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [pollInterval, fetchQuietAccounts]);

  return {
    // Portfolio data
    accounts,
    summary,
    loading,
    error,

    // Filters
    filters,
    setFilters,

    // Actions
    fetchQuietAccounts,
    refetch,

    // Account detail
    selectedAccountId,
    accountDetail,
    accountDetailLoading,
    fetchAccountDetail,
    clearAccountDetail,

    // Re-engagement
    recordInteraction,
    markReEngaged,

    // Email draft
    fetchCheckInEmail,

    // Alert management
    markAlertSent,
    excludeFromAlerts,

    // Manual scan
    runScan,
  };
};

export default useQuietAccounts;
