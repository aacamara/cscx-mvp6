/**
 * Success Metrics Hook
 * PRD-069: Custom hook for fetching and managing account success metrics
 */

import { useState, useCallback, useEffect } from 'react';
import {
  SuccessMetricsResponse,
  GoalDetailResponse,
  SuccessGoal,
  SuccessMetric,
  CreateGoalRequest,
  UpdateGoalRequest,
  UpdateMetricRequest,
  SuccessMetricsFilters
} from '../types/successMetrics';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// Hook Options
// ============================================

interface UseSuccessMetricsOptions {
  customerId: string;
  autoFetch?: boolean;
  initialFilters?: SuccessMetricsFilters;
}

// ============================================
// Hook Return Type
// ============================================

interface UseSuccessMetricsReturn {
  // Main data
  data: SuccessMetricsResponse | null;
  loading: boolean;
  error: string | null;

  // Filters
  filters: SuccessMetricsFilters;
  setFilters: React.Dispatch<React.SetStateAction<SuccessMetricsFilters>>;

  // Actions
  fetchMetrics: () => Promise<void>;
  refetch: () => Promise<void>;

  // Goal operations
  selectedGoalId: string | null;
  goalDetail: GoalDetailResponse | null;
  goalDetailLoading: boolean;
  fetchGoalDetail: (goalId: string) => Promise<void>;
  clearGoalDetail: () => void;
  createGoal: (goal: CreateGoalRequest) => Promise<SuccessGoal | null>;
  updateGoal: (goalId: string, updates: UpdateGoalRequest) => Promise<SuccessGoal | null>;
  deleteGoal: (goalId: string) => Promise<boolean>;

  // Metric operations
  updateMetric: (metricId: string, updates: UpdateMetricRequest) => Promise<SuccessMetric | null>;

  // Value report
  valueReportLoading: boolean;
  generateValueReport: (format?: 'json' | 'markdown') => Promise<any>;
  downloadValueReport: () => Promise<void>;

  // Computed values
  successScore: number;
  goalsOnTrack: number;
  goalsAtRisk: number;
  totalValueDelivered: number;
  roiPercent: number;
}

// ============================================
// Hook Implementation
// ============================================

export const useSuccessMetrics = (
  options: UseSuccessMetricsOptions
): UseSuccessMetricsReturn => {
  const { customerId, autoFetch = true, initialFilters = {} } = options;

  // Main data state
  const [data, setData] = useState<SuccessMetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SuccessMetricsFilters>({
    period: 'all',
    includeBenchmarks: true,
    goalStatus: 'all',
    category: 'all',
    ...initialFilters
  });

  // Goal detail state
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [goalDetail, setGoalDetail] = useState<GoalDetailResponse | null>(null);
  const [goalDetailLoading, setGoalDetailLoading] = useState(false);

  // Value report state
  const [valueReportLoading, setValueReportLoading] = useState(false);

  // ============================================
  // Fetch Success Metrics
  // ============================================

  const fetchMetrics = useCallback(async () => {
    if (!customerId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (filters.period && filters.period !== 'all') {
        params.append('period', filters.period);
      }
      if (filters.includeBenchmarks !== undefined) {
        params.append('includeBenchmarks', String(filters.includeBenchmarks));
      }
      if (filters.startDate) {
        params.append('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params.append('endDate', filters.endDate);
      }

      const response = await fetch(
        `${API_BASE}/intelligence/success-metrics/${customerId}?${params}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to fetch success metrics');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('Success metrics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [customerId, filters]);

  // ============================================
  // Fetch Goal Detail
  // ============================================

  const fetchGoalDetail = useCallback(async (goalId: string) => {
    if (!customerId) return;

    setSelectedGoalId(goalId);
    setGoalDetailLoading(true);

    try {
      const response = await fetch(
        `${API_BASE}/intelligence/success-metrics/${customerId}/goals/${goalId}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch goal details');
      }

      const result = await response.json();
      setGoalDetail(result);
    } catch (err) {
      console.error('Goal detail fetch error:', err);
      setGoalDetail(null);
    } finally {
      setGoalDetailLoading(false);
    }
  }, [customerId]);

  const clearGoalDetail = useCallback(() => {
    setSelectedGoalId(null);
    setGoalDetail(null);
  }, []);

  // ============================================
  // Create Goal
  // ============================================

  const createGoal = useCallback(async (goal: CreateGoalRequest): Promise<SuccessGoal | null> => {
    if (!customerId) return null;

    try {
      const response = await fetch(
        `${API_BASE}/intelligence/success-metrics/${customerId}/goals`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(goal)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to create goal');
      }

      const newGoal = await response.json();

      // Refresh data to include the new goal
      await fetchMetrics();

      return newGoal;
    } catch (err) {
      console.error('Create goal error:', err);
      return null;
    }
  }, [customerId, fetchMetrics]);

  // ============================================
  // Update Goal
  // ============================================

  const updateGoal = useCallback(async (
    goalId: string,
    updates: UpdateGoalRequest
  ): Promise<SuccessGoal | null> => {
    if (!customerId) return null;

    try {
      const response = await fetch(
        `${API_BASE}/intelligence/success-metrics/${customerId}/goals/${goalId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update goal');
      }

      const updatedGoal = await response.json();

      // Refresh data
      await fetchMetrics();

      // Refresh goal detail if it's the selected one
      if (selectedGoalId === goalId) {
        await fetchGoalDetail(goalId);
      }

      return updatedGoal;
    } catch (err) {
      console.error('Update goal error:', err);
      return null;
    }
  }, [customerId, fetchMetrics, fetchGoalDetail, selectedGoalId]);

  // ============================================
  // Delete Goal
  // ============================================

  const deleteGoal = useCallback(async (goalId: string): Promise<boolean> => {
    if (!customerId) return false;

    try {
      const response = await fetch(
        `${API_BASE}/intelligence/success-metrics/${customerId}/goals/${goalId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete goal');
      }

      // Clear goal detail if it was the deleted one
      if (selectedGoalId === goalId) {
        clearGoalDetail();
      }

      // Refresh data
      await fetchMetrics();

      return true;
    } catch (err) {
      console.error('Delete goal error:', err);
      return false;
    }
  }, [customerId, fetchMetrics, selectedGoalId, clearGoalDetail]);

  // ============================================
  // Update Metric
  // ============================================

  const updateMetric = useCallback(async (
    metricId: string,
    updates: UpdateMetricRequest
  ): Promise<SuccessMetric | null> => {
    if (!customerId) return null;

    try {
      const response = await fetch(
        `${API_BASE}/intelligence/success-metrics/${customerId}/metrics/${metricId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update metric');
      }

      const updatedMetric = await response.json();

      // Refresh data to reflect changes
      await fetchMetrics();

      return updatedMetric;
    } catch (err) {
      console.error('Update metric error:', err);
      return null;
    }
  }, [customerId, fetchMetrics]);

  // ============================================
  // Generate Value Report
  // ============================================

  const generateValueReport = useCallback(async (
    format: 'json' | 'markdown' = 'json'
  ): Promise<any> => {
    if (!customerId) return null;

    setValueReportLoading(true);

    try {
      const response = await fetch(
        `${API_BASE}/intelligence/success-metrics/${customerId}/value-report?format=${format}`
      );

      if (!response.ok) {
        throw new Error('Failed to generate value report');
      }

      if (format === 'markdown') {
        return await response.text();
      }

      return await response.json();
    } catch (err) {
      console.error('Value report error:', err);
      return null;
    } finally {
      setValueReportLoading(false);
    }
  }, [customerId]);

  // ============================================
  // Download Value Report
  // ============================================

  const downloadValueReport = useCallback(async () => {
    const markdown = await generateValueReport('markdown');

    if (!markdown) {
      console.warn('No report data to download');
      return;
    }

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const customerName = data?.customerName || 'customer';
    const date = new Date().toISOString().split('T')[0];

    link.setAttribute('href', url);
    link.setAttribute('download', `success-report-${customerName.toLowerCase().replace(/\s+/g, '-')}-${date}.md`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }, [generateValueReport, data?.customerName]);

  // ============================================
  // Auto-fetch on mount and filter changes
  // ============================================

  useEffect(() => {
    if (autoFetch && customerId) {
      fetchMetrics();
    }
  }, [autoFetch, customerId, fetchMetrics]);

  // ============================================
  // Computed Values
  // ============================================

  const successScore = data?.overview?.score ?? 0;
  const goalsOnTrack = data?.overview?.goalsOnTrack ?? 0;
  const goalsAtRisk = data?.overview?.goalsAtRisk ?? 0;
  const totalValueDelivered = data?.valueSummary?.totalAnnualValue ?? 0;
  const roiPercent = data?.valueSummary?.roi?.roiPercent ?? 0;

  // ============================================
  // Return
  // ============================================

  return {
    // Main data
    data,
    loading,
    error,

    // Filters
    filters,
    setFilters,

    // Actions
    fetchMetrics,
    refetch: fetchMetrics,

    // Goal operations
    selectedGoalId,
    goalDetail,
    goalDetailLoading,
    fetchGoalDetail,
    clearGoalDetail,
    createGoal,
    updateGoal,
    deleteGoal,

    // Metric operations
    updateMetric,

    // Value report
    valueReportLoading,
    generateValueReport,
    downloadValueReport,

    // Computed values
    successScore,
    goalsOnTrack,
    goalsAtRisk,
    totalValueDelivered,
    roiPercent
  };
};

export default useSuccessMetrics;
