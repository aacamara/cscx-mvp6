/**
 * useAccountBriefing Hook (PRD-056)
 *
 * Custom hook for fetching and managing account briefings.
 * Supports both ID-based and name-based lookups with fuzzy matching.
 */

import { useState, useCallback } from 'react';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// Types
interface QuickStats {
  arr: number;
  arrTrend: string;
  arrChangePercent: number;
  healthScore: number;
  healthTrend: string;
  stage: string;
  renewalDate: string | null;
  daysUntilRenewal: number | null;
  csmName: string | null;
}

interface KeyStakeholder {
  name: string;
  role: string;
  email: string | null;
  sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Unknown';
  lastContact: string | null;
}

interface HealthIndicator {
  name: string;
  score: number;
  maxScore: number;
  explanation: string;
}

interface RiskSignal {
  type: string;
  severity: 'High' | 'Medium' | 'Low';
  description: string;
  detectedAt: string;
}

interface RecentActivity {
  date: string;
  type: string;
  description: string;
}

interface ExpansionOpportunity {
  name: string;
  potential: number;
  stage: string;
  probability: number;
}

interface RecommendedAction {
  action: string;
  priority: 'High' | 'Medium' | 'Low';
  reason: string;
}

export interface AccountBriefing {
  customerId: string;
  accountName: string;
  generatedAt: string;
  quickStats: QuickStats;
  executiveSummary: string;
  keyStakeholders: KeyStakeholder[];
  healthIndicators: HealthIndicator[];
  activeRiskSignals: RiskSignal[];
  recentActivity: RecentActivity[];
  expansionOpportunities: ExpansionOpportunity[];
  recommendedActions: RecommendedAction[];
  dataCompleteness: number;
}

interface AccountSuggestion {
  id: string;
  name: string;
  arr: number;
  healthScore: number;
  stage: string;
}

interface UseAccountBriefingOptions {
  focusArea?: 'health' | 'renewal' | 'stakeholders' | 'usage';
  timePeriod?: string;
}

interface UseAccountBriefingReturn {
  briefing: AccountBriefing | null;
  loading: boolean;
  error: string | null;
  suggestions: AccountSuggestion[];
  fetchBriefingById: (customerId: string) => Promise<void>;
  fetchBriefingByName: (accountName: string) => Promise<void>;
  parseCommand: (command: string) => Promise<{
    accountName: string | null;
    focusArea: string | null;
    timePeriod: string | null;
  }>;
  selectSuggestion: (suggestion: AccountSuggestion) => Promise<void>;
  clearBriefing: () => void;
  clearError: () => void;
}

export function useAccountBriefing(
  options: UseAccountBriefingOptions = {}
): UseAccountBriefingReturn {
  const [briefing, setBriefing] = useState<AccountBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AccountSuggestion[]>([]);

  const { focusArea, timePeriod } = options;

  const fetchBriefingById = useCallback(async (customerId: string) => {
    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const params = new URLSearchParams();
      if (focusArea) params.append('focusArea', focusArea);
      if (timePeriod) params.append('timePeriod', timePeriod);

      const response = await fetch(
        `${API_BASE}/intelligence/account-briefing/${customerId}?${params.toString()}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch briefing');
      }

      setBriefing(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setBriefing(null);
    } finally {
      setLoading(false);
    }
  }, [focusArea, timePeriod]);

  const fetchBriefingByName = useCallback(async (accountName: string) => {
    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const response = await fetch(`${API_BASE}/intelligence/account-briefing/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName, focusArea, timePeriod })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 300 && data.error?.suggestions) {
          // Multiple matches found
          setSuggestions(data.error.suggestions);
          setError(data.error.message);
          setBriefing(null);
          return;
        } else if (response.status === 404 && data.error?.suggestions) {
          // Not found but has suggestions
          setSuggestions(data.error.suggestions);
          setError(data.error.message);
          setBriefing(null);
          return;
        }
        throw new Error(data.error?.message || 'Failed to fetch briefing');
      }

      setBriefing(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setBriefing(null);
    } finally {
      setLoading(false);
    }
  }, [focusArea, timePeriod]);

  const parseCommand = useCallback(async (command: string) => {
    try {
      const response = await fetch(`${API_BASE}/intelligence/parse-command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          accountName: null,
          focusArea: null,
          timePeriod: null
        };
      }

      return data.data;
    } catch {
      return {
        accountName: null,
        focusArea: null,
        timePeriod: null
      };
    }
  }, []);

  const selectSuggestion = useCallback(async (suggestion: AccountSuggestion) => {
    setSuggestions([]);
    await fetchBriefingById(suggestion.id);
  }, [fetchBriefingById]);

  const clearBriefing = useCallback(() => {
    setBriefing(null);
    setError(null);
    setSuggestions([]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setSuggestions([]);
  }, []);

  return {
    briefing,
    loading,
    error,
    suggestions,
    fetchBriefingById,
    fetchBriefingByName,
    parseCommand,
    selectSuggestion,
    clearBriefing,
    clearError
  };
}

/**
 * Utility function to detect if a message is an account briefing command
 */
export function isAccountBriefingCommand(message: string): boolean {
  const patterns = [
    /tell me about\s+/i,
    /brief me on\s+/i,
    /what(?:'s| is) the (?:story|status|deal) with\s+/i,
    /give me (?:the )?rundown on\s+/i,
    /account (?:summary|briefing|overview) for\s+/i,
    /how is\s+.+\s+doing/i,
    /what do we know about\s+/i
  ];

  return patterns.some(pattern => pattern.test(message));
}

/**
 * Extract account name from a natural language command (client-side)
 */
export function extractAccountName(command: string): string | null {
  const patterns = [
    /tell me about\s+(.+?)(?:\s+health|\s+renewal|\s+usage|\s+stakeholders|\s+this|\s+last|\?|$)/i,
    /brief me on\s+(.+?)(?:\s+health|\s+renewal|\s+usage|\s+stakeholders|\s+this|\s+last|\?|$)/i,
    /what(?:'s| is) the (?:story|status|deal) with\s+(.+?)(?:\s+health|\s+renewal|\s+usage|\s+stakeholders|\s+this|\s+last|\?|$)/i,
    /give me (?:the )?rundown on\s+(.+?)(?:\s+health|\s+renewal|\s+usage|\s+stakeholders|\s+this|\s+last|\?|$)/i,
    /account (?:summary|briefing|overview) for\s+(.+?)(?:\s+health|\s+renewal|\s+usage|\s+stakeholders|\s+this|\s+last|\?|$)/i,
    /how is\s+(.+?)\s+doing/i,
    /what do we know about\s+(.+?)(?:\s+health|\s+renewal|\s+usage|\s+stakeholders|\s+this|\s+last|\?|$)/i
  ];

  for (const pattern of patterns) {
    const match = command.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

export default useAccountBriefing;
