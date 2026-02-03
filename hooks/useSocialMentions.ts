/**
 * useSocialMentions Hook (PRD-019)
 *
 * React hook for social mention sentiment tracking functionality:
 * - Upload and process mention data
 * - Get sentiment metrics
 * - Manage customer matches
 * - Handle response tracking
 */

import { useState, useEffect, useCallback } from 'react';
import {
  SocialMention,
  SocialPlatform,
  MentionSentiment,
  SocialSentimentSummary,
  PlatformBreakdown,
  MentionTheme,
  AdvocateOpportunity,
  CustomerMatch,
  ResponseDraft,
} from '../types/socialMention';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ============================================================================
// Types
// ============================================================================

export interface SentimentMetrics {
  overall_sentiment_score: number;
  total_mentions: number;
  date_range: {
    start: string;
    end: string;
  };
  sentiment_breakdown: {
    positive: number;
    neutral: number;
    negative: number;
    positive_pct: number;
    neutral_pct: number;
    negative_pct: number;
  };
  platform_breakdown: PlatformBreakdown[];
  response_rate: number;
  requires_attention: number;
}

export interface UploadResponse {
  success: boolean;
  upload_id: string;
  result: {
    total_rows: number;
    parsed_mentions: number;
    failed_rows: number;
    platforms: SocialPlatform[];
    date_range: {
      start: string;
      end: string;
    };
  };
  summary: SocialSentimentSummary;
}

export interface MentionsResponse {
  mentions: SocialMention[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface CustomerMentionsResponse {
  customer_id: string;
  mentions: SocialMention[];
  sentiment_summary: {
    total: number;
    positive: number;
    neutral: number;
    negative: number;
    avg_score: number;
  };
}

// ============================================================================
// Hook: useSocialMentions
// ============================================================================

interface UseSocialMentionsReturn {
  // State
  metrics: SentimentMetrics | null;
  mentions: SocialMention[];
  themes: MentionTheme[];
  advocates: AdvocateOpportunity[];
  highRiskMentions: SocialMention[];
  loading: boolean;
  error: string | null;

  // Actions
  uploadMentions: (fileContent: string, fileName?: string, sourceTool?: string) => Promise<UploadResponse | null>;
  fetchMetrics: (days?: number) => Promise<void>;
  fetchMentions: (filters?: MentionFilters) => Promise<void>;
  fetchThemes: (days?: number) => Promise<void>;
  fetchAdvocates: () => Promise<void>;
  fetchHighRisk: () => Promise<void>;
  refresh: () => Promise<void>;
}

interface MentionFilters {
  customer_id?: string;
  platform?: SocialPlatform;
  sentiment?: MentionSentiment;
  requires_response?: boolean;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export function useSocialMentions(): UseSocialMentionsReturn {
  const [metrics, setMetrics] = useState<SentimentMetrics | null>(null);
  const [mentions, setMentions] = useState<SocialMention[]>([]);
  const [themes, setThemes] = useState<MentionTheme[]>([]);
  const [advocates, setAdvocates] = useState<AdvocateOpportunity[]>([]);
  const [highRiskMentions, setHighRiskMentions] = useState<SocialMention[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadMentions = useCallback(async (
    fileContent: string,
    fileName?: string,
    sourceTool?: string
  ): Promise<UploadResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/social/mentions/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_content: fileContent,
          file_name: fileName,
          source_tool: sourceTool,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }

      const data = await response.json();
      return data as UploadResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMetrics = useCallback(async (days: number = 30): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/social/sentiment?days=${days}`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
      setError('Failed to load sentiment metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMentions = useCallback(async (filters: MentionFilters = {}): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.customer_id) params.append('customer_id', filters.customer_id);
      if (filters.platform) params.append('platform', filters.platform);
      if (filters.sentiment) params.append('sentiment', filters.sentiment);
      if (filters.requires_response !== undefined) params.append('requires_response', String(filters.requires_response));
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      if (filters.page) params.append('page', String(filters.page));
      if (filters.limit) params.append('limit', String(filters.limit));

      const response = await fetch(`${API_URL}/api/social/mentions?${params}`);
      if (response.ok) {
        const data: MentionsResponse = await response.json();
        setMentions(data.mentions);
      }
    } catch (err) {
      console.error('Failed to fetch mentions:', err);
      setError('Failed to load mentions');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchThemes = useCallback(async (days: number = 30): Promise<void> => {
    try {
      const response = await fetch(`${API_URL}/api/social/themes?days=${days}`);
      if (response.ok) {
        const data = await response.json();
        setThemes(data.themes || []);
      }
    } catch (err) {
      console.error('Failed to fetch themes:', err);
    }
  }, []);

  const fetchAdvocates = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${API_URL}/api/social/advocates`);
      if (response.ok) {
        const data = await response.json();
        setAdvocates(data.advocates || []);
      }
    } catch (err) {
      console.error('Failed to fetch advocates:', err);
    }
  }, []);

  const fetchHighRisk = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${API_URL}/api/social/high-risk`);
      if (response.ok) {
        const data = await response.json();
        setHighRiskMentions(data.high_risk_mentions || []);
      }
    } catch (err) {
      console.error('Failed to fetch high-risk mentions:', err);
    }
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all([
      fetchMetrics(),
      fetchMentions(),
      fetchThemes(),
      fetchAdvocates(),
      fetchHighRisk(),
    ]);
  }, [fetchMetrics, fetchMentions, fetchThemes, fetchAdvocates, fetchHighRisk]);

  return {
    metrics,
    mentions,
    themes,
    advocates,
    highRiskMentions,
    loading,
    error,
    uploadMentions,
    fetchMetrics,
    fetchMentions,
    fetchThemes,
    fetchAdvocates,
    fetchHighRisk,
    refresh,
  };
}

// ============================================================================
// Hook: useCustomerSocialMentions
// ============================================================================

interface UseCustomerSocialMentionsReturn {
  mentions: SocialMention[];
  sentimentSummary: CustomerMentionsResponse['sentiment_summary'] | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCustomerSocialMentions(customerId: string | null): UseCustomerSocialMentionsReturn {
  const [mentions, setMentions] = useState<SocialMention[]>([]);
  const [sentimentSummary, setSentimentSummary] = useState<CustomerMentionsResponse['sentiment_summary'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!customerId) {
      setMentions([]);
      setSentimentSummary(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/social/customer/${customerId}/mentions`);
      if (response.ok) {
        const data: CustomerMentionsResponse = await response.json();
        setMentions(data.mentions);
        setSentimentSummary(data.sentiment_summary);
      }
    } catch (err) {
      console.error('Failed to fetch customer mentions:', err);
      setError('Failed to load customer mentions');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    mentions,
    sentimentSummary,
    loading,
    error,
    refresh: fetchData,
  };
}

// ============================================================================
// Hook: useMentionActions
// ============================================================================

interface UseMentionActionsReturn {
  matchToCustomer: (mentionId: string, authorInfo?: { bio?: string; location?: string }) => Promise<CustomerMatch[]>;
  confirmMatch: (mentionId: string, customerId: string) => Promise<boolean>;
  draftResponse: (mentionId: string) => Promise<ResponseDraft | null>;
  trackResponse: (mentionId: string, responseSent: boolean, responseText?: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

export function useMentionActions(): UseMentionActionsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchToCustomer = useCallback(async (
    mentionId: string,
    authorInfo?: { bio?: string; location?: string }
  ): Promise<CustomerMatch[]> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/social/mentions/${mentionId}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author_info: authorInfo }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.matches || [];
      }
      return [];
    } catch (err) {
      console.error('Failed to match mention:', err);
      setError('Failed to match mention to customer');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const confirmMatch = useCallback(async (mentionId: string, customerId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/social/mentions/${mentionId}/confirm-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId }),
      });

      return response.ok;
    } catch (err) {
      console.error('Failed to confirm match:', err);
      setError('Failed to confirm customer match');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const draftResponse = useCallback(async (mentionId: string): Promise<ResponseDraft | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/social/mentions/${mentionId}/draft-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        return data.draft;
      }
      return null;
    } catch (err) {
      console.error('Failed to draft response:', err);
      setError('Failed to generate response draft');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const trackResponse = useCallback(async (
    mentionId: string,
    responseSent: boolean,
    responseText?: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/social/mentions/${mentionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_sent: responseSent,
          response_text: responseText,
        }),
      });

      return response.ok;
    } catch (err) {
      console.error('Failed to track response:', err);
      setError('Failed to track response');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    matchToCustomer,
    confirmMatch,
    draftResponse,
    trackResponse,
    loading,
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

export function getSentimentLabel(sentiment: MentionSentiment | number): string {
  if (typeof sentiment === 'number') {
    if (sentiment >= 50) return 'Very Positive';
    if (sentiment >= 20) return 'Positive';
    if (sentiment >= 0) return 'Neutral';
    if (sentiment >= -30) return 'Cautious';
    return 'Negative';
  }
  return sentiment.charAt(0).toUpperCase() + sentiment.slice(1);
}

export function getPlatformIcon(platform: SocialPlatform): string {
  const icons: Record<SocialPlatform, string> = {
    twitter: 'X',
    linkedin: 'in',
    g2: 'G2',
    facebook: 'f',
    instagram: 'IG',
    reddit: 'r/',
    other: '?',
  };
  return icons[platform] || '?';
}

export function getPlatformColor(platform: SocialPlatform): string {
  const colors: Record<SocialPlatform, string> = {
    twitter: 'bg-gray-800',
    linkedin: 'bg-blue-700',
    g2: 'bg-orange-500',
    facebook: 'bg-blue-600',
    instagram: 'bg-pink-600',
    reddit: 'bg-orange-600',
    other: 'bg-gray-600',
  };
  return colors[platform] || 'bg-gray-600';
}

export function formatEngagement(engagement: { likes: number; shares: number; comments: number }): string {
  const total = engagement.likes + engagement.shares + engagement.comments;
  if (total >= 1000000) return `${(total / 1000000).toFixed(1)}M`;
  if (total >= 1000) return `${(total / 1000).toFixed(1)}K`;
  return String(total);
}

export function formatFollowers(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  useSocialMentions,
  useCustomerSocialMentions,
  useMentionActions,
  getSentimentColor,
  getSentimentBgColor,
  getSentimentLabel,
  getPlatformIcon,
  getPlatformColor,
  formatEngagement,
  formatFollowers,
};
