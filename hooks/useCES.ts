/**
 * Customer Effort Score Hook
 * PRD-160: Custom hook for fetching and managing CES report data
 */

import { useState, useCallback, useEffect } from 'react';
import {
  CESReportResponse,
  CustomerCESDetail,
  CESFilters,
  CESTrendPoint,
  CESByTouchpoint,
  PortfolioCES
} from '../types/customerEffortScore';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

interface UseCESOptions {
  autoFetch?: boolean;
  initialFilters?: CESFilters;
}

interface UseCESReturn {
  // Portfolio data
  data: CESReportResponse | null;
  loading: boolean;
  error: string | null;

  // Filters
  filters: CESFilters;
  setFilters: React.Dispatch<React.SetStateAction<CESFilters>>;

  // Actions
  fetchCESReport: () => Promise<void>;
  refetch: () => Promise<void>;

  // Customer detail
  selectedCustomerId: string | null;
  customerDetail: CustomerCESDetail | null;
  customerDetailLoading: boolean;
  fetchCustomerDetail: (customerId: string) => Promise<void>;
  clearCustomerDetail: () => void;

  // Touchpoint analysis
  touchpointData: CESByTouchpoint[] | null;
  fetchTouchpointAnalysis: (touchpoint?: string) => Promise<void>;

  // Submit survey response
  submitSurveyResponse: (surveyId: string, score: number, feedback?: string) => Promise<boolean>;
  submitting: boolean;

  // CSV Export
  exportToCsv: () => void;
}

export const useCES = (options: UseCESOptions = {}): UseCESReturn => {
  const { autoFetch = true, initialFilters = {} } = options;

  // Portfolio state
  const [data, setData] = useState<CESReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CESFilters>({
    period: 'quarter',
    ces_filter: 'all',
    sort_by: 'average',
    sort_order: 'desc',
    ...initialFilters
  });

  // Customer detail state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerCESDetail | null>(null);
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false);

  // Touchpoint analysis state
  const [touchpointData, setTouchpointData] = useState<CESByTouchpoint[] | null>(null);

  // Survey submission state
  const [submitting, setSubmitting] = useState(false);

  /**
   * Fetch CES report data with current filters
   */
  const fetchCESReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (filters.period) {
        params.append('period', filters.period);
      }
      if (filters.touchpoint) {
        params.append('touchpoint', filters.touchpoint);
      }
      if (filters.segment) {
        params.append('segment', filters.segment);
      }
      if (filters.ces_filter && filters.ces_filter !== 'all') {
        params.append('ces_filter', filters.ces_filter);
      }
      if (filters.customer_id) {
        params.append('customer_id', filters.customer_id);
      }

      const response = await fetch(`${API_BASE}/reports/ces?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch CES report data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('CES report fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  /**
   * Fetch customer CES detail
   */
  const fetchCustomerDetail = useCallback(async (customerId: string) => {
    setSelectedCustomerId(customerId);
    setCustomerDetailLoading(true);

    try {
      const params = new URLSearchParams();
      if (filters.period) {
        params.append('period', filters.period);
      }

      const response = await fetch(`${API_BASE}/reports/ces/${customerId}?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch customer CES detail');
      }

      const result = await response.json();
      setCustomerDetail(result);
    } catch (err) {
      console.error('Customer CES detail fetch error:', err);
      setCustomerDetail(null);
    } finally {
      setCustomerDetailLoading(false);
    }
  }, [filters.period]);

  /**
   * Clear customer detail selection
   */
  const clearCustomerDetail = useCallback(() => {
    setSelectedCustomerId(null);
    setCustomerDetail(null);
  }, []);

  /**
   * Fetch touchpoint analysis data
   */
  const fetchTouchpointAnalysis = useCallback(async (touchpoint?: string) => {
    try {
      const params = new URLSearchParams();
      if (filters.period) {
        params.append('period', filters.period);
      }
      if (touchpoint) {
        params.append('touchpoint', touchpoint);
      }

      const response = await fetch(`${API_BASE}/reports/ces/touchpoints?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch touchpoint analysis');
      }

      const result = await response.json();
      setTouchpointData(result.touchpoints);
    } catch (err) {
      console.error('Touchpoint analysis fetch error:', err);
      setTouchpointData(null);
    }
  }, [filters.period]);

  /**
   * Submit a CES survey response
   */
  const submitSurveyResponse = useCallback(async (
    surveyId: string,
    score: number,
    feedback?: string
  ): Promise<boolean> => {
    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/ces/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          survey_id: surveyId,
          score,
          feedback
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit survey response');
      }

      // Refetch data after submission
      await fetchCESReport();
      return true;
    } catch (err) {
      console.error('Survey submission error:', err);
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [fetchCESReport]);

  /**
   * Export CES data to CSV
   */
  const exportToCsv = useCallback(() => {
    if (!data?.summary?.by_touchpoint || data.summary.by_touchpoint.length === 0) {
      console.warn('No data to export');
      return;
    }

    const touchpoints = data.summary.by_touchpoint;
    const headers = [
      'Touchpoint',
      'Average CES',
      'Response Count',
      'Trend',
      'Trend Change'
    ];

    const rows = touchpoints.map((t) => [
      t.touchpoint_label,
      t.average.toFixed(1),
      t.count,
      t.trend,
      t.trend_change > 0 ? `+${t.trend_change.toFixed(1)}` : t.trend_change.toFixed(1)
    ]);

    // Add summary row
    const summary = data.summary.overall;
    rows.unshift([
      'OVERALL',
      summary.average.toFixed(1),
      summary.total_responses,
      summary.trend,
      summary.trend_change > 0 ? `+${summary.trend_change.toFixed(1)}` : summary.trend_change.toFixed(1)
    ]);

    const csvContent = [
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
    link.setAttribute('download', `ces-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }, [data]);

  /**
   * Refetch data (alias for fetchCESReport)
   */
  const refetch = fetchCESReport;

  // Auto-fetch on mount and filter changes
  useEffect(() => {
    if (autoFetch) {
      fetchCESReport();
    }
  }, [autoFetch, fetchCESReport]);

  return {
    // Portfolio data
    data,
    loading,
    error,

    // Filters
    filters,
    setFilters,

    // Actions
    fetchCESReport,
    refetch,

    // Customer detail
    selectedCustomerId,
    customerDetail,
    customerDetailLoading,
    fetchCustomerDetail,
    clearCustomerDetail,

    // Touchpoint analysis
    touchpointData,
    fetchTouchpointAnalysis,

    // Survey submission
    submitSurveyResponse,
    submitting,

    // CSV Export
    exportToCsv
  };
};

export default useCES;
