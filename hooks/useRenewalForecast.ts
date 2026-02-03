/**
 * useRenewalForecast Hook (PRD-059)
 *
 * Custom hook for fetching and managing renewal pipeline forecast data.
 * Supports filtering, sorting, and CSV export functionality.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  RenewalPipelineForecast,
  RenewalPrediction,
  RenewalForecastFilters,
  DEFAULT_FILTERS,
  TimeHorizon,
  RiskFilter,
} from '../types/renewalForecast';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// Hook Return Type
// ============================================

interface UseRenewalForecastReturn {
  // Data
  forecast: RenewalPipelineForecast | null;
  selectedPrediction: RenewalPrediction | null;
  filteredPredictions: RenewalPrediction[];

  // State
  loading: boolean;
  error: string | null;
  filters: RenewalForecastFilters;

  // Actions
  fetchForecast: () => Promise<void>;
  fetchCustomerForecast: (customerId: string) => Promise<void>;
  setFilters: (filters: Partial<RenewalForecastFilters>) => void;
  resetFilters: () => void;
  selectPrediction: (prediction: RenewalPrediction | null) => void;
  exportToCsv: () => Promise<void>;
  clearError: () => void;
}

// ============================================
// Hook Implementation
// ============================================

export function useRenewalForecast(
  initialFilters: Partial<RenewalForecastFilters> = {}
): UseRenewalForecastReturn {
  // State
  const [forecast, setForecast] = useState<RenewalPipelineForecast | null>(null);
  const [selectedPrediction, setSelectedPrediction] = useState<RenewalPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<RenewalForecastFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });

  // Fetch forecast data
  const fetchForecast = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('horizon', filters.horizon);
      if (filters.riskFilter !== 'all') {
        params.append('risk', filters.riskFilter);
      }
      if (filters.csmId) {
        params.append('csmId', filters.csmId);
      }
      if (filters.segment) {
        params.append('segment', filters.segment);
      }

      const response = await fetch(`${API_BASE}/intelligence/renewal-forecast?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch renewal forecast');
      }

      setForecast(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('[useRenewalForecast] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters.horizon, filters.riskFilter, filters.csmId, filters.segment]);

  // Fetch single customer forecast
  const fetchCustomerForecast = useCallback(async (customerId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/intelligence/renewal-forecast/${customerId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch customer forecast');
      }

      setSelectedPrediction(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('[useRenewalForecast] Error fetching customer forecast:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update filters
  const setFilters = useCallback((newFilters: Partial<RenewalForecastFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Reset filters to defaults
  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  // Select a prediction for detail view
  const selectPrediction = useCallback((prediction: RenewalPrediction | null) => {
    setSelectedPrediction(prediction);
  }, []);

  // Export to CSV
  const exportToCsv = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('format', 'csv');
      params.append('horizon', filters.horizon);

      const response = await fetch(`${API_BASE}/intelligence/renewal-forecast/export?${params}`);

      if (!response.ok) {
        throw new Error('Failed to export forecast');
      }

      // Get the blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `renewal-forecast-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      setError(message);
      console.error('[useRenewalForecast] Export error:', err);
    }
  }, [filters.horizon]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Filter and sort predictions client-side
  const filteredPredictions = useCallback((): RenewalPrediction[] => {
    if (!forecast?.predictions) return [];

    let filtered = [...forecast.predictions];

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(p =>
        p.customerName.toLowerCase().includes(searchLower) ||
        p.csmName?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    if (filters.sortBy) {
      filtered.sort((a, b) => {
        let comparison = 0;
        switch (filters.sortBy) {
          case 'renewal':
            comparison = new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime();
            break;
          case 'arr':
            comparison = a.currentArr - b.currentArr;
            break;
          case 'probability':
            comparison = a.probability - b.probability;
            break;
          case 'risk':
            const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            comparison = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
            break;
          case 'name':
            comparison = a.customerName.localeCompare(b.customerName);
            break;
        }
        return filters.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }, [forecast?.predictions, filters.search, filters.sortBy, filters.sortOrder]);

  // Fetch data on mount and when relevant filters change
  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  return {
    forecast,
    selectedPrediction,
    filteredPredictions: filteredPredictions(),
    loading,
    error,
    filters,
    fetchForecast,
    fetchCustomerForecast,
    setFilters,
    resetFilters,
    selectPrediction,
    exportToCsv,
    clearError,
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Format currency with proper locale
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date to readable string
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get days until renewal with color coding
 */
export function getDaysUntilRenewalColor(days: number): string {
  if (days <= 14) return 'text-red-400';
  if (days <= 30) return 'text-orange-400';
  if (days <= 60) return 'text-yellow-400';
  return 'text-cscx-gray-300';
}

/**
 * Calculate percentage safely
 */
export function calculatePercentage(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

/**
 * Check if command is a renewal forecast command
 */
export function isRenewalForecastCommand(message: string): boolean {
  const patterns = [
    /show me my renewal pipeline/i,
    /what renewals are coming up/i,
    /renewal forecast/i,
    /which renewals are at risk/i,
    /upcoming renewals/i,
    /renewal pipeline/i,
  ];

  return patterns.some(pattern => pattern.test(message));
}

export default useRenewalForecast;
