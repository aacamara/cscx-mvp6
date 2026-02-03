/**
 * Time Allocation Hook
 * PRD-161: Custom hook for fetching and managing time allocation data
 */

import { useState, useCallback, useEffect } from 'react';
import {
  TimeAllocationResponse,
  CSMTimeDetailResponse,
  TimeAllocationFilters,
  TimeEntry,
  CreateTimeEntryRequest,
  ActivityBreakdown,
  CustomerTimeBreakdown,
  CSMTimeBreakdown,
  WeeklyTrend,
  OptimizationSuggestion,
  TimeAllocationSummary
} from '../types/timeAllocation';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

interface UseTimeAllocationOptions {
  autoFetch?: boolean;
  initialFilters?: TimeAllocationFilters;
}

interface UseTimeAllocationReturn {
  // Report data
  data: TimeAllocationResponse | null;
  loading: boolean;
  error: string | null;

  // Filters
  filters: TimeAllocationFilters;
  setFilters: React.Dispatch<React.SetStateAction<TimeAllocationFilters>>;

  // Actions
  fetchReport: () => Promise<void>;
  refetch: () => Promise<void>;

  // CSM detail
  selectedCsmId: string | null;
  csmDetail: CSMTimeDetailResponse | null;
  csmDetailLoading: boolean;
  fetchCsmDetail: (csmId: string) => Promise<void>;
  clearCsmDetail: () => void;

  // Time entry management
  createTimeEntry: (entry: CreateTimeEntryRequest) => Promise<TimeEntry | null>;
  createEntryLoading: boolean;

  // CSV Export
  exportToCsv: () => void;

  // Derived data helpers
  getSummary: () => TimeAllocationSummary | null;
  getActivityBreakdown: () => ActivityBreakdown[];
  getCustomerBreakdown: () => CustomerTimeBreakdown[];
  getCsmBreakdown: () => CSMTimeBreakdown[];
  getTrends: () => WeeklyTrend[];
  getRecommendations: () => OptimizationSuggestion[];
}

export const useTimeAllocation = (
  options: UseTimeAllocationOptions = {}
): UseTimeAllocationReturn => {
  const { autoFetch = true, initialFilters = {} } = options;

  // Report state
  const [data, setData] = useState<TimeAllocationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TimeAllocationFilters>({
    period: 'month',
    ...initialFilters
  });

  // CSM detail state
  const [selectedCsmId, setSelectedCsmId] = useState<string | null>(null);
  const [csmDetail, setCsmDetail] = useState<CSMTimeDetailResponse | null>(null);
  const [csmDetailLoading, setCsmDetailLoading] = useState(false);

  // Time entry state
  const [createEntryLoading, setCreateEntryLoading] = useState(false);

  /**
   * Fetch time allocation report with current filters
   */
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (filters.period) {
        params.append('period', filters.period);
      }
      if (filters.csm_id) {
        params.append('csm_id', filters.csm_id);
      }
      if (filters.team_id) {
        params.append('team_id', filters.team_id);
      }
      if (filters.start_date) {
        params.append('start_date', filters.start_date);
      }
      if (filters.end_date) {
        params.append('end_date', filters.end_date);
      }

      const response = await fetch(`${API_BASE}/reports/time-allocation?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch time allocation data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('Time allocation fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  /**
   * Fetch CSM time detail
   */
  const fetchCsmDetail = useCallback(async (csmId: string) => {
    setSelectedCsmId(csmId);
    setCsmDetailLoading(true);

    try {
      const params = new URLSearchParams();
      if (filters.period) {
        params.append('period', filters.period);
      }

      const response = await fetch(`${API_BASE}/reports/time-allocation/${csmId}?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch CSM time detail');
      }

      const result = await response.json();
      setCsmDetail(result);
    } catch (err) {
      console.error('CSM detail fetch error:', err);
      setCsmDetail(null);
    } finally {
      setCsmDetailLoading(false);
    }
  }, [filters.period]);

  /**
   * Clear CSM detail selection
   */
  const clearCsmDetail = useCallback(() => {
    setSelectedCsmId(null);
    setCsmDetail(null);
  }, []);

  /**
   * Create a new time entry
   */
  const createTimeEntry = useCallback(async (entry: CreateTimeEntryRequest): Promise<TimeEntry | null> => {
    setCreateEntryLoading(true);

    try {
      const response = await fetch(`${API_BASE}/reports/time-allocation/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(entry)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to create time entry');
      }

      const result = await response.json();

      // Refresh the report after creating an entry
      await fetchReport();

      return result;
    } catch (err) {
      console.error('Create time entry error:', err);
      return null;
    } finally {
      setCreateEntryLoading(false);
    }
  }, [fetchReport]);

  /**
   * Export time allocation data to CSV
   */
  const exportToCsv = useCallback(() => {
    if (!data) {
      console.warn('No data to export');
      return;
    }

    // Export customer breakdown
    const headers = [
      'Customer Name',
      'Hours',
      'ARR',
      'Hours per $10K ARR',
      'Efficiency'
    ];

    const rows = data.by_customer.map(c => [
      c.customer_name,
      c.hours,
      c.arr,
      c.hours_per_10k_arr,
      c.efficiency_status
    ]);

    const csvContent = [
      `Time Allocation Report - ${data.summary.period_label}`,
      '',
      `Total Hours: ${data.summary.total_hours}`,
      `Customer-Facing: ${data.summary.customer_facing_pct}%`,
      `Admin: ${data.summary.admin_pct}%`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(','))
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `time-allocation-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }, [data]);

  /**
   * Refetch data (alias for fetchReport)
   */
  const refetch = fetchReport;

  // Derived data helpers
  const getSummary = useCallback(() => data?.summary || null, [data]);
  const getActivityBreakdown = useCallback(() => data?.by_activity || [], [data]);
  const getCustomerBreakdown = useCallback(() => data?.by_customer || [], [data]);
  const getCsmBreakdown = useCallback(() => data?.by_csm || [], [data]);
  const getTrends = useCallback(() => data?.trends || [], [data]);
  const getRecommendations = useCallback(() => data?.recommendations || [], [data]);

  // Auto-fetch on mount and filter changes
  useEffect(() => {
    if (autoFetch) {
      fetchReport();
    }
  }, [autoFetch, fetchReport]);

  return {
    // Report data
    data,
    loading,
    error,

    // Filters
    filters,
    setFilters,

    // Actions
    fetchReport,
    refetch,

    // CSM detail
    selectedCsmId,
    csmDetail,
    csmDetailLoading,
    fetchCsmDetail,
    clearCsmDetail,

    // Time entry management
    createTimeEntry,
    createEntryLoading,

    // CSV Export
    exportToCsv,

    // Derived data helpers
    getSummary,
    getActivityBreakdown,
    getCustomerBreakdown,
    getCsmBreakdown,
    getTrends,
    getRecommendations
  };
};

export default useTimeAllocation;
