/**
 * Health Portfolio Hook
 * PRD-153: Custom hook for fetching and managing health portfolio data
 */

import { useState, useCallback, useEffect } from 'react';
import {
  HealthPortfolioResponse,
  CustomerHealthDetail,
  CohortComparisonResponse,
  HealthPortfolioFilters,
  CustomerHealthSummary
} from '../types/healthPortfolio';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

interface UseHealthPortfolioOptions {
  autoFetch?: boolean;
  initialFilters?: HealthPortfolioFilters;
}

interface UseHealthPortfolioReturn {
  // Portfolio data
  data: HealthPortfolioResponse | null;
  loading: boolean;
  error: string | null;

  // Filters
  filters: HealthPortfolioFilters;
  setFilters: React.Dispatch<React.SetStateAction<HealthPortfolioFilters>>;

  // Actions
  fetchPortfolio: () => Promise<void>;
  refetch: () => Promise<void>;

  // Customer detail
  selectedCustomerId: string | null;
  customerDetail: CustomerHealthDetail | null;
  customerDetailLoading: boolean;
  fetchCustomerDetail: (customerId: string) => Promise<void>;
  clearCustomerDetail: () => void;

  // Cohort comparison
  cohortData: CohortComparisonResponse | null;
  cohortLoading: boolean;
  fetchCohortComparison: (dimension: 'segment' | 'csm' | 'industry' | 'tenure') => Promise<void>;

  // CSV Export
  exportToCsv: () => void;
}

export const useHealthPortfolio = (
  options: UseHealthPortfolioOptions = {}
): UseHealthPortfolioReturn => {
  const { autoFetch = true, initialFilters = {} } = options;

  // Portfolio state
  const [data, setData] = useState<HealthPortfolioResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<HealthPortfolioFilters>({
    health_filter: 'all',
    sort_by: 'score',
    sort_order: 'desc',
    search: '',
    ...initialFilters
  });

  // Customer detail state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerHealthDetail | null>(null);
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false);

  // Cohort comparison state
  const [cohortData, setCohortData] = useState<CohortComparisonResponse | null>(null);
  const [cohortLoading, setCohortLoading] = useState(false);

  /**
   * Fetch portfolio data with current filters
   */
  const fetchPortfolio = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (filters.health_filter && filters.health_filter !== 'all') {
        params.append('health_filter', filters.health_filter);
      }
      if (filters.search) {
        params.append('search', filters.search);
      }
      if (filters.sort_by) {
        params.append('sort_by', filters.sort_by);
      }
      if (filters.sort_order) {
        params.append('sort_order', filters.sort_order);
      }
      if (filters.segment) {
        params.append('segment', filters.segment);
      }

      const response = await fetch(`${API_BASE}/reports/health-portfolio?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch health portfolio data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('Health portfolio fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  /**
   * Fetch customer health detail
   */
  const fetchCustomerDetail = useCallback(async (customerId: string) => {
    setSelectedCustomerId(customerId);
    setCustomerDetailLoading(true);

    try {
      const response = await fetch(`${API_BASE}/reports/health-portfolio/${customerId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch customer health detail');
      }

      const result = await response.json();
      setCustomerDetail(result);
    } catch (err) {
      console.error('Customer detail fetch error:', err);
      setCustomerDetail(null);
    } finally {
      setCustomerDetailLoading(false);
    }
  }, []);

  /**
   * Clear customer detail selection
   */
  const clearCustomerDetail = useCallback(() => {
    setSelectedCustomerId(null);
    setCustomerDetail(null);
  }, []);

  /**
   * Fetch cohort comparison data
   */
  const fetchCohortComparison = useCallback(async (
    dimension: 'segment' | 'csm' | 'industry' | 'tenure'
  ) => {
    setCohortLoading(true);

    try {
      const response = await fetch(
        `${API_BASE}/reports/health-portfolio/compare?dimension=${dimension}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch cohort comparison');
      }

      const result = await response.json();
      setCohortData(result);
    } catch (err) {
      console.error('Cohort comparison fetch error:', err);
      setCohortData(null);
    } finally {
      setCohortLoading(false);
    }
  }, []);

  /**
   * Export customer health data to CSV
   */
  const exportToCsv = useCallback(() => {
    if (!data?.customers || data.customers.length === 0) {
      console.warn('No data to export');
      return;
    }

    const customers = data.customers;
    const headers = [
      'Customer Name',
      'Health Score',
      'Category',
      'Trend',
      'Score Change',
      'ARR',
      'Segment',
      'Renewal Date',
      'Days to Renewal',
      'Active Risks',
      'Lowest Component'
    ];

    const rows = customers.map((c: CustomerHealthSummary) => [
      c.customer_name,
      c.health_score,
      c.category,
      c.trend,
      c.score_change,
      c.arr,
      c.segment,
      c.renewal_date || '',
      c.days_to_renewal ?? '',
      c.active_risks,
      c.lowest_component || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // Escape cells containing commas or quotes
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
    link.setAttribute('download', `health-portfolio-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }, [data]);

  /**
   * Refetch data (alias for fetchPortfolio)
   */
  const refetch = fetchPortfolio;

  // Auto-fetch on mount and filter changes
  useEffect(() => {
    if (autoFetch) {
      fetchPortfolio();
    }
  }, [autoFetch, fetchPortfolio]);

  return {
    // Portfolio data
    data,
    loading,
    error,

    // Filters
    filters,
    setFilters,

    // Actions
    fetchPortfolio,
    refetch,

    // Customer detail
    selectedCustomerId,
    customerDetail,
    customerDetailLoading,
    fetchCustomerDetail,
    clearCustomerDetail,

    // Cohort comparison
    cohortData,
    cohortLoading,
    fetchCohortComparison,

    // CSV Export
    exportToCsv
  };
};

export default useHealthPortfolio;
