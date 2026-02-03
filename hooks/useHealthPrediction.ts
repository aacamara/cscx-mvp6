/**
 * Custom Hook for Health Prediction (PRD-231)
 */

import { useState, useCallback, useEffect } from 'react';
import {
  HealthPrediction,
  PortfolioHealthForecast,
  SimulationResult,
} from '../types/healthPrediction';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

interface UseHealthPredictionOptions {
  autoLoad?: boolean;
  customerId?: string;
}

interface UseHealthPredictionReturn {
  // Customer prediction state
  prediction: HealthPrediction | null;
  loading: boolean;
  error: string | null;

  // Portfolio forecast state
  portfolioForecast: PortfolioHealthForecast | null;
  portfolioLoading: boolean;
  portfolioError: string | null;

  // Simulation state
  simulation: SimulationResult | null;
  simulationLoading: boolean;

  // Actions
  fetchPrediction: (customerId: string) => Promise<HealthPrediction | null>;
  refreshPrediction: (customerId: string) => Promise<HealthPrediction | null>;
  fetchPortfolioForecast: () => Promise<PortfolioHealthForecast | null>;
  simulateInterventions: (customerId: string, interventions: string[]) => Promise<SimulationResult | null>;
  clearPrediction: () => void;
  clearSimulation: () => void;
}

export function useHealthPrediction(options: UseHealthPredictionOptions = {}): UseHealthPredictionReturn {
  const { autoLoad = false, customerId } = options;

  // Customer prediction state
  const [prediction, setPrediction] = useState<HealthPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Portfolio forecast state
  const [portfolioForecast, setPortfolioForecast] = useState<PortfolioHealthForecast | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);

  // Simulation state
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [simulationLoading, setSimulationLoading] = useState(false);

  /**
   * Fetch prediction for a customer
   */
  const fetchPrediction = useCallback(async (id: string): Promise<HealthPrediction | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/health-prediction/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch prediction: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setPrediction(data.data);
        return data.data;
      } else {
        throw new Error(data.error?.message || 'Unknown error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch prediction';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Refresh prediction (force recalculation)
   */
  const refreshPrediction = useCallback(async (id: string): Promise<HealthPrediction | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/health-prediction/${id}/refresh`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to refresh prediction: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setPrediction(data.data);
        return data.data;
      } else {
        throw new Error(data.error?.message || 'Unknown error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh prediction';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch portfolio-level forecast
   */
  const fetchPortfolioForecast = useCallback(async (): Promise<PortfolioHealthForecast | null> => {
    setPortfolioLoading(true);
    setPortfolioError(null);

    try {
      const response = await fetch(`${API_BASE}/health-prediction/portfolio/forecast`);
      if (!response.ok) {
        throw new Error(`Failed to fetch portfolio forecast: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setPortfolioForecast(data.data);
        return data.data;
      } else {
        throw new Error(data.error?.message || 'Unknown error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch portfolio forecast';
      setPortfolioError(message);
      return null;
    } finally {
      setPortfolioLoading(false);
    }
  }, []);

  /**
   * Simulate intervention impacts
   */
  const simulateInterventions = useCallback(async (
    id: string,
    interventions: string[]
  ): Promise<SimulationResult | null> => {
    setSimulationLoading(true);

    try {
      const response = await fetch(`${API_BASE}/health-prediction/${id}/simulation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ interventions }),
      });

      if (!response.ok) {
        throw new Error(`Failed to run simulation: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setSimulation(data.data);
        return data.data;
      } else {
        throw new Error(data.error?.message || 'Unknown error');
      }
    } catch (err) {
      console.error('Simulation error:', err);
      return null;
    } finally {
      setSimulationLoading(false);
    }
  }, []);

  /**
   * Clear prediction state
   */
  const clearPrediction = useCallback(() => {
    setPrediction(null);
    setError(null);
  }, []);

  /**
   * Clear simulation state
   */
  const clearSimulation = useCallback(() => {
    setSimulation(null);
  }, []);

  // Auto-load prediction if customerId is provided
  useEffect(() => {
    if (autoLoad && customerId) {
      fetchPrediction(customerId);
    }
  }, [autoLoad, customerId, fetchPrediction]);

  return {
    // Customer prediction state
    prediction,
    loading,
    error,

    // Portfolio forecast state
    portfolioForecast,
    portfolioLoading,
    portfolioError,

    // Simulation state
    simulation,
    simulationLoading,

    // Actions
    fetchPrediction,
    refreshPrediction,
    fetchPortfolioForecast,
    simulateInterventions,
    clearPrediction,
    clearSimulation,
  };
}

export default useHealthPrediction;
