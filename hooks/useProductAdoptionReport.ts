/**
 * Product Adoption Report Hook
 * PRD-159: Custom hook for fetching and managing product adoption report data
 */

import { useState, useCallback, useEffect } from 'react';
import {
  ProductAdoptionPortfolioResponse,
  ProductAdoptionCustomerResponse,
  AdoptionCorrelationResponse,
  ProductAdoptionFilters,
  CustomerAdoptionSummary
} from '../types/productAdoptionReport';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

interface UseProductAdoptionReportOptions {
  autoFetch?: boolean;
  initialFilters?: ProductAdoptionFilters;
}

interface UseProductAdoptionReportReturn {
  // Portfolio data
  data: ProductAdoptionPortfolioResponse | null;
  loading: boolean;
  error: string | null;

  // Filters
  filters: ProductAdoptionFilters;
  setFilters: React.Dispatch<React.SetStateAction<ProductAdoptionFilters>>;

  // Actions
  fetchPortfolio: () => Promise<void>;
  refetch: () => Promise<void>;

  // Customer detail
  selectedCustomerId: string | null;
  customerDetail: ProductAdoptionCustomerResponse | null;
  customerDetailLoading: boolean;
  fetchCustomerDetail: (customerId: string) => Promise<void>;
  clearCustomerDetail: () => void;

  // Correlation data
  correlationData: AdoptionCorrelationResponse | null;
  correlationLoading: boolean;
  fetchCorrelation: (outcome?: 'health' | 'retention' | 'expansion') => Promise<void>;

  // CSV Export
  exportToCsv: () => void;
}

export const useProductAdoptionReport = (
  options: UseProductAdoptionReportOptions = {}
): UseProductAdoptionReportReturn => {
  const { autoFetch = true, initialFilters = {} } = options;

  // Portfolio state
  const [data, setData] = useState<ProductAdoptionPortfolioResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProductAdoptionFilters>({
    level_filter: 'all',
    sort_by: 'score',
    sort_order: 'desc',
    search: '',
    ...initialFilters
  });

  // Customer detail state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<ProductAdoptionCustomerResponse | null>(null);
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false);

  // Correlation state
  const [correlationData, setCorrelationData] = useState<AdoptionCorrelationResponse | null>(null);
  const [correlationLoading, setCorrelationLoading] = useState(false);

  /**
   * Fetch portfolio data with current filters
   */
  const fetchPortfolio = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (filters.level_filter && filters.level_filter !== 'all') {
        params.append('level_filter', filters.level_filter);
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
      if (filters.csm_id) {
        params.append('csm_id', filters.csm_id);
      }

      const response = await fetch(`${API_BASE}/reports/product-adoption?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch product adoption data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('Product adoption portfolio fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  /**
   * Fetch customer adoption detail
   */
  const fetchCustomerDetail = useCallback(async (customerId: string) => {
    setSelectedCustomerId(customerId);
    setCustomerDetailLoading(true);

    try {
      const params = new URLSearchParams();
      if (filters.period) {
        params.append('period', filters.period);
      }

      const response = await fetch(
        `${API_BASE}/reports/product-adoption/${customerId}?${params}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch customer adoption detail');
      }

      const result = await response.json();
      setCustomerDetail(result);
    } catch (err) {
      console.error('Customer adoption detail fetch error:', err);
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
   * Fetch adoption correlation data
   */
  const fetchCorrelation = useCallback(async (
    outcome?: 'health' | 'retention' | 'expansion'
  ) => {
    setCorrelationLoading(true);

    try {
      const params = new URLSearchParams();
      if (outcome) {
        params.append('outcome', outcome);
      }

      const response = await fetch(
        `${API_BASE}/reports/product-adoption/correlation?${params}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch adoption correlation');
      }

      const result = await response.json();
      setCorrelationData(result);
    } catch (err) {
      console.error('Adoption correlation fetch error:', err);
      setCorrelationData(null);
    } finally {
      setCorrelationLoading(false);
    }
  }, []);

  /**
   * Export customer adoption data to CSV
   */
  const exportToCsv = useCallback(() => {
    if (!data?.customers || data.customers.length === 0) {
      console.warn('No data to export');
      return;
    }

    const customers = data.customers;
    const headers = [
      'Customer Name',
      'Adoption Score',
      'Level',
      'Trend',
      'Score Change',
      'ARR',
      'Segment',
      'Features Using',
      'Features Available',
      'Top Gap',
      'Days Since New Feature'
    ];

    const rows = customers.map((c: CustomerAdoptionSummary) => [
      c.customer_name,
      c.adoption_score,
      c.level,
      c.trend,
      c.score_change,
      c.arr,
      c.segment,
      c.features_using,
      c.features_available,
      c.top_gap || '',
      c.days_since_new_feature ?? ''
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
    link.setAttribute('download', `product-adoption-report-${new Date().toISOString().split('T')[0]}.csv`);
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

    // Correlation data
    correlationData,
    correlationLoading,
    fetchCorrelation,

    // CSV Export
    exportToCsv
  };
};

export default useProductAdoptionReport;
