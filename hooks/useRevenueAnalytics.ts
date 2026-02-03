/**
 * useRevenueAnalytics Hook
 * PRD-158: Revenue Analytics Report
 *
 * Custom hook for fetching and managing revenue analytics data.
 * Supports period filtering, data caching, and CSV export functionality.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  RevenueAnalyticsResponse,
  RevenueAnalyticsSummary,
  RevenueMovement,
  RevenueTrend,
  SegmentBreakdown,
  CSMBreakdown,
  ConcentrationAnalysis,
  RevenueAnalyticsQuery,
  RevenueHistoryQuery,
  calculateGRR,
  calculateNRR,
  calculateLogoRetention,
  calculateARPA,
  formatSegmentLabel
} from '../types/revenueAnalytics';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// Types
// ============================================

export type PeriodOption =
  | 'current_month'
  | 'current_quarter'
  | 'current_year'
  | 'last_month'
  | 'last_quarter'
  | 'last_year';

export type MovementType = 'all' | 'new' | 'expansion' | 'contraction' | 'churn' | 'reactivation';

export interface UseRevenueAnalyticsFilters {
  period: PeriodOption;
  segment?: 'enterprise' | 'mid-market' | 'smb';
  csm_id?: string;
  movementType?: MovementType;
}

export interface UseRevenueAnalyticsOptions {
  autoFetch?: boolean;
  initialFilters?: Partial<UseRevenueAnalyticsFilters>;
}

export interface UseRevenueAnalyticsReturn {
  // Data
  data: RevenueAnalyticsResponse | null;
  summary: RevenueAnalyticsSummary | null;
  movements: RevenueMovement[];
  filteredMovements: RevenueMovement[];
  trends: RevenueTrend[];
  bySegment: SegmentBreakdown[];
  byCSM: CSMBreakdown[];
  concentration: ConcentrationAnalysis | null;

  // State
  loading: boolean;
  error: string | null;
  filters: UseRevenueAnalyticsFilters;

  // Actions
  fetchAnalytics: () => Promise<void>;
  fetchConcentration: () => Promise<void>;
  fetchHistory: (periods?: number) => Promise<RevenueTrend[]>;
  setFilters: (filters: Partial<UseRevenueAnalyticsFilters>) => void;
  resetFilters: () => void;
  refetch: () => Promise<void>;
  exportToCsv: () => void;
  clearError: () => void;
}

// ============================================
// Default Filters
// ============================================

const DEFAULT_FILTERS: UseRevenueAnalyticsFilters = {
  period: 'current_quarter',
  movementType: 'all'
};

// ============================================
// Hook Implementation
// ============================================

export function useRevenueAnalytics(
  options: UseRevenueAnalyticsOptions = {}
): UseRevenueAnalyticsReturn {
  const { autoFetch = true, initialFilters = {} } = options;

  // State
  const [data, setData] = useState<RevenueAnalyticsResponse | null>(null);
  const [concentration, setConcentration] = useState<ConcentrationAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<UseRevenueAnalyticsFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters
  });

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('period', filters.period);
      if (filters.segment) {
        params.append('segment', filters.segment);
      }
      if (filters.csm_id) {
        params.append('csm_id', filters.csm_id);
      }

      const response = await fetch(`${API_BASE}/reports/revenue-analytics?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch revenue analytics');
      }

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error?.message || 'Failed to fetch revenue analytics');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('[useRevenueAnalytics] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters.period, filters.segment, filters.csm_id]);

  // Fetch concentration analysis
  const fetchConcentration = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/reports/revenue-analytics/concentration`);

      if (!response.ok) {
        throw new Error('Failed to fetch concentration analysis');
      }

      const result = await response.json();

      if (result.success) {
        setConcentration(result.data.analysis);
      }
    } catch (err) {
      console.error('[useRevenueAnalytics] Concentration error:', err);
    }
  }, []);

  // Fetch history/trends
  const fetchHistory = useCallback(async (periods: number = 12): Promise<RevenueTrend[]> => {
    try {
      const response = await fetch(`${API_BASE}/reports/revenue-analytics/history?periods=${periods}`);

      if (!response.ok) {
        throw new Error('Failed to fetch revenue history');
      }

      const result = await response.json();

      if (result.success) {
        return result.data.trends;
      }
      return [];
    } catch (err) {
      console.error('[useRevenueAnalytics] History error:', err);
      return [];
    }
  }, []);

  // Update filters
  const setFilters = useCallback((newFilters: Partial<UseRevenueAnalyticsFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Reset filters to defaults
  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  // Refetch all data
  const refetch = useCallback(async () => {
    await Promise.all([fetchAnalytics(), fetchConcentration()]);
  }, [fetchAnalytics, fetchConcentration]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Filter movements client-side
  const filteredMovements = useMemo((): RevenueMovement[] => {
    if (!data?.movements) return [];

    if (filters.movementType === 'all') {
      return data.movements;
    }

    return data.movements.filter(m => m.type === filters.movementType);
  }, [data?.movements, filters.movementType]);

  // Export to CSV
  const exportToCsv = useCallback(() => {
    if (!data) {
      console.warn('No data to export');
      return;
    }

    // Build CSV content
    const lines: string[] = [];

    // Summary section
    lines.push('REVENUE ANALYTICS REPORT');
    lines.push(`Period,${data.summary.period_label}`);
    lines.push('');
    lines.push('SUMMARY');
    lines.push(`Total ARR,$${data.summary.totals.ending_arr}`);
    lines.push(`MRR,$${data.summary.totals.ending_mrr}`);
    lines.push(`Customers,${data.summary.totals.customer_count}`);
    lines.push(`ARR Change,$${data.summary.totals.arr_change}`);
    lines.push(`ARR Change %,${data.summary.totals.arr_change_percent}%`);
    lines.push('');
    lines.push('REVENUE MOVEMENTS');
    lines.push(`New Business,$${data.summary.movements.new_business}`);
    lines.push(`Expansion,$${data.summary.movements.expansion}`);
    lines.push(`Contraction,$${data.summary.movements.contraction}`);
    lines.push(`Churn,$${data.summary.movements.churn}`);
    lines.push(`Net Change,$${data.summary.movements.net_change}`);
    lines.push('');
    lines.push('RETENTION METRICS');
    lines.push(`Gross Revenue Retention,${data.summary.retention.gross_retention}%`);
    lines.push(`Net Revenue Retention,${data.summary.retention.net_retention}%`);
    lines.push(`Logo Retention,${data.summary.retention.logo_retention}%`);
    lines.push('');
    lines.push('AVERAGES');
    lines.push(`ARPA,$${data.summary.averages.arpa}`);
    lines.push(`Lifetime Value,$${data.summary.averages.lifetime_value}`);
    lines.push('');

    // Movements detail
    lines.push('MOVEMENT DETAILS');
    lines.push('Customer,Type,Date,Previous ARR,New ARR,Change,Reason');
    data.movements.forEach(m => {
      const row = [
        `"${m.customer_name}"`,
        m.type,
        m.movement_date,
        m.previous_arr,
        m.new_arr,
        m.change_amount,
        `"${m.reason || ''}"`
      ].join(',');
      lines.push(row);
    });
    lines.push('');

    // Segment breakdown
    lines.push('SEGMENT BREAKDOWN');
    lines.push('Segment,ARR,% of Total,Customers,NRR,GRR,Change');
    data.by_segment.forEach(s => {
      const row = [
        s.segment_label,
        s.arr,
        `${s.arr_percent}%`,
        s.customer_count,
        `${s.nrr}%`,
        `${s.grr}%`,
        s.change_amount
      ].join(',');
      lines.push(row);
    });
    lines.push('');

    // CSM breakdown
    lines.push('CSM BREAKDOWN');
    lines.push('CSM,ARR,Customers,NRR,Expansion,Contraction,Churn,Net Change');
    data.by_csm.forEach(c => {
      const row = [
        `"${c.csm_name}"`,
        c.arr,
        c.customer_count,
        `${c.nrr}%`,
        c.expansion,
        c.contraction,
        c.churn,
        c.net_change
      ].join(',');
      lines.push(row);
    });

    // Create and trigger download
    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `revenue-analytics-${filters.period}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }, [data, filters.period]);

  // Auto-fetch on mount and filter changes
  useEffect(() => {
    if (autoFetch) {
      fetchAnalytics();
      fetchConcentration();
    }
  }, [autoFetch, fetchAnalytics, fetchConcentration]);

  return {
    // Data
    data,
    summary: data?.summary || null,
    movements: data?.movements || [],
    filteredMovements,
    trends: data?.trends || [],
    bySegment: data?.by_segment || [],
    byCSM: data?.by_csm || [],
    concentration,

    // State
    loading,
    error,
    filters,

    // Actions
    fetchAnalytics,
    fetchConcentration,
    fetchHistory,
    setFilters,
    resetFilters,
    refetch,
    exportToCsv,
    clearError
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Format currency with proper locale
 */
export function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

/**
 * Format currency with full precision
 */
export function formatCurrencyFull(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Format percentage with sign
 */
export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}%`;
}

/**
 * Get color class for retention metric
 */
export function getRetentionColor(value: number, target: number): string {
  if (value >= target) return 'text-green-400';
  if (value >= target * 0.95) return 'text-yellow-400';
  return 'text-red-400';
}

/**
 * Get color class for movement type
 */
export function getMovementColor(type: string): string {
  const colors: Record<string, string> = {
    new: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
    expansion: 'text-green-400 bg-green-500/20 border-green-500/30',
    contraction: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
    churn: 'text-red-400 bg-red-500/20 border-red-500/30',
    reactivation: 'text-purple-400 bg-purple-500/20 border-purple-500/30'
  };
  return colors[type] || 'text-gray-400 bg-gray-500/20 border-gray-500/30';
}

/**
 * Get color class for concentration risk
 */
export function getRiskColor(risk: string): string {
  const colors: Record<string, string> = {
    low: 'text-green-400 bg-green-500/20 border-green-500/30',
    medium: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
    high: 'text-red-400 bg-red-500/20 border-red-500/30'
  };
  return colors[risk] || 'text-gray-400';
}

/**
 * Check if a message is a revenue analytics command
 */
export function isRevenueAnalyticsCommand(message: string): boolean {
  const patterns = [
    /show me my revenue/i,
    /revenue analytics/i,
    /what'?s (our|my) arr/i,
    /net revenue retention/i,
    /nrr/i,
    /gross retention/i,
    /grr/i,
    /revenue movements/i,
    /show me expansion/i,
    /show me churn/i,
    /revenue concentration/i,
    /arpa/i,
    /average revenue per account/i
  ];

  return patterns.some(pattern => pattern.test(message));
}

/**
 * Period options for UI
 */
export const PERIOD_OPTIONS: Array<{ value: PeriodOption; label: string }> = [
  { value: 'current_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'current_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'current_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' }
];

/**
 * Re-export type utilities
 */
export {
  calculateGRR,
  calculateNRR,
  calculateLogoRetention,
  calculateARPA,
  formatSegmentLabel
};

export default useRevenueAnalytics;
