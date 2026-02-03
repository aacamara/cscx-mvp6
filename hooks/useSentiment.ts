/**
 * useSentiment Hook (PRD-218)
 *
 * Provides sentiment analysis functionality across the application:
 * - Fetch customer sentiment summary
 * - Analyze text on-demand
 * - Manage sentiment alerts
 * - Get portfolio-level sentiment metrics
 */

import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ============================================================================
// Types
// ============================================================================

export type CommunicationSource = 'email' | 'meeting' | 'support' | 'slack' | 'survey';
export type AlertLevel = 'info' | 'warning' | 'critical';
export type SentimentTrend = 'improving' | 'stable' | 'declining';

export interface TopicSentiment {
  product: number | null;
  support: number | null;
  pricing: number | null;
  relationship: number | null;
}

export interface KeyPhrase {
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact: number;
}

export interface SentimentResult {
  sentiment_id: string;
  overall_score: number;
  confidence: number;
  emotional_indicators: string[];
  topic_sentiment: TopicSentiment;
  key_phrases: KeyPhrase[];
  risk_indicators: string[];
  alert_triggered: boolean;
  alert_level?: AlertLevel;
}

export interface RecentInteraction {
  source: CommunicationSource;
  score: number;
  date: string;
  snippet: string;
}

export interface HistoricalData {
  date: string;
  score: number;
}

export interface CustomerSentimentSummary {
  customer_id: string;
  current_score: number;
  trend: SentimentTrend;
  change_7d: number;
  change_30d: number;
  topic_breakdown: TopicSentiment;
  recent_interactions: RecentInteraction[];
  historical_data: HistoricalData[];
}

export interface SentimentAlert {
  id: string;
  customer_id: string;
  sentiment_analysis_id: string;
  alert_type: string;
  alert_level: AlertLevel;
  message: string;
  acknowledged_at?: string;
  created_at: string;
}

export interface PortfolioSentiment {
  average_score: number;
  at_risk_count: number;
  declining_count: number;
  customers_by_sentiment: {
    positive: number;
    neutral: number;
    negative: number;
    critical: number;
  };
}

export interface AnalyzeSentimentParams {
  source: CommunicationSource;
  customer_id: string;
  stakeholder_id?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Hook: useCustomerSentiment
// ============================================================================

interface UseCustomerSentimentReturn {
  summary: CustomerSentimentSummary | null;
  alerts: SentimentAlert[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<boolean>;
  analyzeText: (content: string, source: CommunicationSource) => Promise<SentimentResult | null>;
}

export function useCustomerSentiment(customerId: string | null): UseCustomerSentimentReturn {
  const [summary, setSummary] = useState<CustomerSentimentSummary | null>(null);
  const [alerts, setAlerts] = useState<SentimentAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!customerId) {
      setSummary(null);
      setAlerts([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [summaryRes, alertsRes] = await Promise.all([
        fetch(`${API_URL}/api/sentiment/customer/${customerId}`),
        fetch(`${API_URL}/api/sentiment/customer/${customerId}/alerts?unacknowledged=true`),
      ]);

      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data);
      }

      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.alerts || []);
      }
    } catch (err) {
      console.error('Failed to fetch sentiment data:', err);
      setError('Failed to load sentiment data');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const acknowledgeAlert = useCallback(async (alertId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/sentiment/alerts/${alertId}/acknowledge`, {
        method: 'POST',
      });

      if (response.ok) {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
      return false;
    }
  }, []);

  const analyzeText = useCallback(async (
    content: string,
    source: CommunicationSource
  ): Promise<SentimentResult | null> => {
    if (!customerId) return null;

    try {
      const response = await fetch(`${API_URL}/api/sentiment/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          customer_id: customerId,
          content,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // Refresh data after new analysis
        fetchData();
        return result;
      }
      return null;
    } catch (err) {
      console.error('Failed to analyze text:', err);
      return null;
    }
  }, [customerId, fetchData]);

  return {
    summary,
    alerts,
    loading,
    error,
    refresh: fetchData,
    acknowledgeAlert,
    analyzeText,
  };
}

// ============================================================================
// Hook: usePortfolioSentiment
// ============================================================================

interface UsePortfolioSentimentReturn {
  portfolio: PortfolioSentiment | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePortfolioSentiment(): UsePortfolioSentimentReturn {
  const [portfolio, setPortfolio] = useState<PortfolioSentiment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/sentiment/portfolio`);
      if (response.ok) {
        const data = await response.json();
        setPortfolio(data);
      }
    } catch (err) {
      console.error('Failed to fetch portfolio sentiment:', err);
      setError('Failed to load portfolio sentiment');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    portfolio,
    loading,
    error,
    refresh: fetchData,
  };
}

// ============================================================================
// Hook: useSentimentAnalyzer
// ============================================================================

interface UseSentimentAnalyzerReturn {
  analyze: (params: AnalyzeSentimentParams) => Promise<SentimentResult | null>;
  analyzing: boolean;
  lastResult: SentimentResult | null;
  error: string | null;
}

export function useSentimentAnalyzer(): UseSentimentAnalyzerReturn {
  const [analyzing, setAnalyzing] = useState(false);
  const [lastResult, setLastResult] = useState<SentimentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (params: AnalyzeSentimentParams): Promise<SentimentResult | null> => {
    setAnalyzing(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/sentiment/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (response.ok) {
        const result = await response.json();
        setLastResult(result);
        return result;
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Analysis failed');
    } catch (err) {
      console.error('Sentiment analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
      return null;
    } finally {
      setAnalyzing(false);
    }
  }, []);

  return {
    analyze,
    analyzing,
    lastResult,
    error,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getSentimentColor(score: number): string {
  if (score >= 50) return 'text-green-400';
  if (score >= 20) return 'text-green-300';
  if (score >= 0) return 'text-yellow-400';
  if (score >= -30) return 'text-orange-400';
  return 'text-red-400';
}

export function getSentimentBgColor(score: number): string {
  if (score >= 50) return 'bg-green-500';
  if (score >= 20) return 'bg-green-400';
  if (score >= 0) return 'bg-yellow-500';
  if (score >= -30) return 'bg-orange-500';
  return 'bg-red-500';
}

export function getSentimentLabel(score: number): string {
  if (score >= 50) return 'Very Positive';
  if (score >= 20) return 'Positive';
  if (score >= 0) return 'Neutral';
  if (score >= -30) return 'Cautious';
  if (score >= -60) return 'Negative';
  return 'Critical';
}

export function getTrendIcon(trend: SentimentTrend): string {
  switch (trend) {
    case 'improving': return 'trending_up';
    case 'declining': return 'trending_down';
    default: return 'trending_flat';
  }
}

export function getTrendColor(trend: SentimentTrend): string {
  switch (trend) {
    case 'improving': return 'text-green-400';
    case 'declining': return 'text-red-400';
    default: return 'text-gray-400';
  }
}

// Default export for convenience
export default {
  useCustomerSentiment,
  usePortfolioSentiment,
  useSentimentAnalyzer,
  getSentimentColor,
  getSentimentBgColor,
  getSentimentLabel,
  getTrendIcon,
  getTrendColor,
};
