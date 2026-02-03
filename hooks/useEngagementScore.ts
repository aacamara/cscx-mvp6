/**
 * Engagement Score Hook
 * PRD-070: Custom hook for fetching and managing engagement score breakdown data
 */

import { useState, useCallback, useEffect } from 'react';
import {
  EngagementScoreResponse,
  EngagementHistoryPoint,
  EngagementAlert,
  EngagementRecommendation,
} from '../types/engagementScoreBreakdown';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/intelligence/engagement`;

// ============================================
// TYPES
// ============================================

interface UseEngagementScoreOptions {
  autoFetch?: boolean;
  period?: '7d' | '14d' | '30d' | '60d' | '90d';
  comparePeriod?: 'previous' | 'year_ago';
}

interface UseEngagementScoreReturn {
  // Main data
  data: EngagementScoreResponse | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchEngagementScore: (customerId: string) => Promise<void>;
  refetch: () => Promise<void>;

  // Trends
  trends: EngagementHistoryPoint[];
  trendsLoading: boolean;
  fetchTrends: (customerId: string, months?: number) => Promise<void>;

  // Alerts
  alerts: EngagementAlert[];
  alertsLoading: boolean;
  fetchAlerts: (customerId: string) => Promise<void>;

  // Recommendations
  recommendations: EngagementRecommendation[];

  // Export
  exportToCSV: () => void;

  // Options
  period: '7d' | '14d' | '30d' | '60d' | '90d';
  setPeriod: (period: '7d' | '14d' | '30d' | '60d' | '90d') => void;
}

// ============================================
// HOOK
// ============================================

export const useEngagementScore = (
  customerId?: string,
  options: UseEngagementScoreOptions = {}
): UseEngagementScoreReturn => {
  const {
    autoFetch = true,
    period: initialPeriod = '30d',
    comparePeriod = 'previous',
  } = options;

  // Main state
  const [data, setData] = useState<EngagementScoreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'7d' | '14d' | '30d' | '60d' | '90d'>(initialPeriod);
  const [currentCustomerId, setCurrentCustomerId] = useState<string | undefined>(customerId);

  // Trends state
  const [trends, setTrends] = useState<EngagementHistoryPoint[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);

  // Alerts state
  const [alerts, setAlerts] = useState<EngagementAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  /**
   * Fetch engagement score breakdown
   */
  const fetchEngagementScore = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setCurrentCustomerId(id);

    try {
      const params = new URLSearchParams();
      params.append('period', period);
      params.append('comparePeriod', comparePeriod);

      const response = await fetch(`${API_BASE}/${id}?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch engagement score');
      }

      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('Engagement score fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [period, comparePeriod]);

  /**
   * Fetch engagement trends
   */
  const fetchTrends = useCallback(async (id: string, months: number = 6) => {
    setTrendsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/${id}/trends?months=${months}`);

      if (!response.ok) {
        throw new Error('Failed to fetch engagement trends');
      }

      const result = await response.json();
      if (result.success) {
        setTrends(result.data);
      }
    } catch (err) {
      console.error('Engagement trends fetch error:', err);
    } finally {
      setTrendsLoading(false);
    }
  }, []);

  /**
   * Fetch engagement alerts
   */
  const fetchAlerts = useCallback(async (id: string) => {
    setAlertsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/${id}/alerts`);

      if (!response.ok) {
        throw new Error('Failed to fetch engagement alerts');
      }

      const result = await response.json();
      if (result.success) {
        setAlerts(result.data);
      }
    } catch (err) {
      console.error('Engagement alerts fetch error:', err);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  /**
   * Refetch data for current customer
   */
  const refetch = useCallback(async () => {
    if (currentCustomerId) {
      await fetchEngagementScore(currentCustomerId);
    }
  }, [currentCustomerId, fetchEngagementScore]);

  /**
   * Export engagement data to CSV
   */
  const exportToCSV = useCallback(() => {
    if (!data) {
      console.warn('No data to export');
      return;
    }

    const headers = [
      'Component',
      'Score',
      'Weight',
      'Contribution',
      'Status',
    ];

    const rows = data.composition.map(comp => [
      comp.name,
      comp.score,
      `${Math.round(comp.weight * 100)}%`,
      comp.contribution,
      comp.status,
    ]);

    // Add overall row
    rows.push([
      'Overall',
      data.score.overall,
      '100%',
      data.score.overall,
      data.score.trend,
    ]);

    const csvContent = [
      `Engagement Score Breakdown: ${data.customer.name}`,
      `Period: ${period} | Updated: ${data.updatedAt}`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(',')),
      '',
      'Factors:',
      'Component,Factor,Current,Target,Status,Trend',
      ...data.componentDetails.communication.factors.map(f =>
        `Communication,${f.name},${f.current},${f.target},${f.status},${f.trend}`
      ),
      ...data.componentDetails.product.factors.map(f =>
        `Product,${f.name},${f.current},${f.target},${f.status},${f.trend}`
      ),
      ...data.componentDetails.relationship.factors.map(f =>
        `Relationship,${f.name},${f.current},${f.target},${f.status},${f.trend}`
      ),
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `engagement-breakdown-${data.customer.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`
    );
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }, [data, period]);

  // Auto-fetch on mount and period changes
  useEffect(() => {
    if (autoFetch && customerId) {
      fetchEngagementScore(customerId);
      fetchTrends(customerId);
      fetchAlerts(customerId);
    }
  }, [autoFetch, customerId, fetchEngagementScore, fetchTrends, fetchAlerts]);

  // Refetch when period changes
  useEffect(() => {
    if (currentCustomerId && !loading) {
      refetch();
    }
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // Main data
    data,
    loading,
    error,

    // Actions
    fetchEngagementScore,
    refetch,

    // Trends
    trends,
    trendsLoading,
    fetchTrends,

    // Alerts
    alerts,
    alertsLoading,
    fetchAlerts,

    // Recommendations (derived from data)
    recommendations: data?.score.recommendations || [],

    // Export
    exportToCSV,

    // Options
    period,
    setPeriod,
  };
};

export default useEngagementScore;
