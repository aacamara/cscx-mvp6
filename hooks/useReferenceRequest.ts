/**
 * useReferenceRequest Hook (PRD-043)
 *
 * Custom hook for managing reference requests, pool management, and call tracking.
 * Supports readiness assessment, email generation, and reference matching.
 */

import { useState, useCallback } from 'react';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// Types
export type ReferenceAvailability = 'available' | 'busy' | 'limited' | 'inactive' | 'declined';
export type CallStatus = 'requested' | 'scheduled' | 'completed' | 'no_show' | 'cancelled' | 'rescheduled';
export type CallOutcome = 'positive' | 'neutral' | 'negative' | 'deal_won' | 'deal_lost';

export interface ReadinessSignals {
  healthScore: { value: number; status: 'good' | 'warning' | 'bad' };
  npsScore?: { value: number; status: 'good' | 'warning' | 'bad' };
  relationshipTenure: { months: number; status: 'good' | 'warning' | 'bad' };
  activeIssues: { count: number; status: 'good' | 'bad' };
  lastReferenceCall?: { daysAgo: number; status: 'good' | 'warning' | 'bad' };
  existingReference?: { isActive: boolean; availability: string };
}

export interface Champion {
  name: string;
  email: string;
  title?: string;
}

export interface ReadinessAssessment {
  eligible: boolean;
  score: number;
  signals: ReadinessSignals;
  champion?: Champion;
  recommendation: 'proceed' | 'wait' | 'not_recommended';
  reasons: string[];
  wins: string[];
}

export interface CustomerReference {
  id: string;
  customerId: string;
  customerName?: string;
  stakeholderName: string;
  stakeholderEmail: string;
  stakeholderTitle?: string;
  isActive: boolean;
  availabilityStatus: ReferenceAvailability;
  maxCallsPerMonth: number;
  currentMonthCalls: number;
  preferredFormat: 'phone' | 'video' | 'either';
  preferredDuration: '15min' | '30min' | '45min' | '60min';
  topics: string[];
  industries: string[];
  totalCallsCompleted: number;
  lastCallDate?: string;
  averageRating?: number;
  enrolledAt: string;
  notes?: string;
}

export interface MatchedReference extends CustomerReference {
  matchScore: number;
  matchReasons: string[];
}

export interface ReferenceCall {
  id: string;
  referenceId: string;
  customerId: string;
  prospectCompany: string;
  prospectContactName?: string;
  prospectContactEmail?: string;
  prospectIndustry?: string;
  callStatus: CallStatus;
  scheduledAt?: string;
  completedAt?: string;
  durationMinutes?: number;
  callFormat?: 'phone' | 'video';
  referenceRating?: number;
  prospectRating?: number;
  referenceFeedback?: string;
  prospectFeedback?: string;
  outcome?: CallOutcome;
  dealInfluenced: boolean;
  dealValue?: number;
  createdAt: string;
}

export interface ReferencePoolStats {
  totalReferences: number;
  activeReferences: number;
  availableReferences: number;
  totalCallsThisMonth: number;
  totalCallsAllTime: number;
  averageRating: number;
  topIndustries: { industry: string; count: number }[];
  topTopics: { topic: string; count: number }[];
}

export interface ReferenceEmail {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  recipients: string[];
}

export interface ProspectInfo {
  companyName: string;
  industry?: string;
  size?: string;
  challenges?: string[];
  evaluationStage?: 'early' | 'mid' | 'final';
  contactName?: string;
  contactTitle?: string;
}

export interface CallDetails {
  duration?: string;
  format?: 'phone' | 'video' | 'either';
  topics?: string[];
  proposedDate?: string;
}

interface UseReferenceRequestReturn {
  // State
  loading: boolean;
  error: string | null;
  readiness: ReadinessAssessment | null;
  email: ReferenceEmail | null;
  pool: {
    references: CustomerReference[];
    stats: ReferencePoolStats;
    total: number;
  } | null;
  matches: MatchedReference[];
  customerStatus: {
    isReference: boolean;
    reference?: CustomerReference;
    calls: ReferenceCall[];
    stats: {
      totalCalls: number;
      completedCalls: number;
      averageRating: number | null;
      lastCallDate: string | null;
      dealsInfluenced: number;
      totalDealValue: number;
    };
  } | null;

  // Actions
  assessReadiness: (customerId: string) => Promise<ReadinessAssessment | null>;
  generateRequest: (
    customerId: string,
    options: {
      stakeholderEmail: string;
      stakeholderName: string;
      stakeholderTitle?: string;
      csmName: string;
      csmEmail: string;
      csmTitle?: string;
      prospect?: ProspectInfo;
      callDetails?: CallDetails;
      urgency?: 'standard' | 'high' | 'critical';
      customMessage?: string;
    }
  ) => Promise<{ email: ReferenceEmail; readiness: ReadinessAssessment } | null>;
  fetchPool: (options?: {
    activeOnly?: boolean;
    availableOnly?: boolean;
    industry?: string;
    limit?: number;
    offset?: number;
  }) => Promise<void>;
  matchReferences: (criteria: {
    industry?: string;
    companySize?: string;
    topics?: string[];
    preferredFormat?: 'phone' | 'video' | 'either';
    maxDuration?: '15min' | '30min' | '45min' | '60min';
    urgency?: 'standard' | 'high' | 'critical';
  }) => Promise<MatchedReference[]>;
  getCustomerStatus: (customerId: string) => Promise<void>;
  enrollReference: (params: {
    customerId: string;
    stakeholderName: string;
    stakeholderEmail: string;
    stakeholderTitle?: string;
    preferredFormat?: 'phone' | 'video' | 'either';
    preferredDuration?: '15min' | '30min' | '45min' | '60min';
    topics?: string[];
    industries?: string[];
    maxCallsPerMonth?: number;
    notes?: string;
  }) => Promise<CustomerReference | null>;
  updateAvailability: (
    referenceId: string,
    availability: ReferenceAvailability,
    maxCallsPerMonth?: number
  ) => Promise<boolean>;
  createCall: (params: {
    referenceId: string;
    prospectCompany: string;
    prospectContactName?: string;
    prospectContactEmail?: string;
    prospectIndustry?: string;
    scheduledAt?: string;
    callFormat?: 'phone' | 'video';
  }) => Promise<ReferenceCall | null>;
  updateCallStatus: (
    callId: string,
    status: CallStatus,
    metadata?: {
      completedAt?: string;
      durationMinutes?: number;
      referenceRating?: number;
      prospectRating?: number;
      referenceFeedback?: string;
      prospectFeedback?: string;
      outcome?: CallOutcome;
      dealInfluenced?: boolean;
      dealValue?: number;
    }
  ) => Promise<boolean>;
  clearError: () => void;
  clearEmail: () => void;
}

export function useReferenceRequest(): UseReferenceRequestReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<ReadinessAssessment | null>(null);
  const [email, setEmail] = useState<ReferenceEmail | null>(null);
  const [pool, setPool] = useState<{
    references: CustomerReference[];
    stats: ReferencePoolStats;
    total: number;
  } | null>(null);
  const [matches, setMatches] = useState<MatchedReference[]>([]);
  const [customerStatus, setCustomerStatus] = useState<{
    isReference: boolean;
    reference?: CustomerReference;
    calls: ReferenceCall[];
    stats: {
      totalCalls: number;
      completedCalls: number;
      averageRating: number | null;
      lastCallDate: string | null;
      dealsInfluenced: number;
      totalDealValue: number;
    };
  } | null>(null);

  const assessReadiness = useCallback(async (customerId: string): Promise<ReadinessAssessment | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/references/customers/${customerId}/readiness`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to assess readiness');
      }

      setReadiness(data.data);
      return data.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const generateRequest = useCallback(async (
    customerId: string,
    options: {
      stakeholderEmail: string;
      stakeholderName: string;
      stakeholderTitle?: string;
      csmName: string;
      csmEmail: string;
      csmTitle?: string;
      prospect?: ProspectInfo;
      callDetails?: CallDetails;
      urgency?: 'standard' | 'high' | 'critical';
      customMessage?: string;
    }
  ): Promise<{ email: ReferenceEmail; readiness: ReadinessAssessment } | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/references/customers/${customerId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.readiness) {
          setReadiness(data.readiness);
        }
        throw new Error(data.error || 'Failed to generate request');
      }

      setEmail(data.email);
      setReadiness(data.readiness);
      return { email: data.email, readiness: data.readiness };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPool = useCallback(async (options: {
    activeOnly?: boolean;
    availableOnly?: boolean;
    industry?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.activeOnly !== undefined) params.append('activeOnly', String(options.activeOnly));
      if (options.availableOnly !== undefined) params.append('availableOnly', String(options.availableOnly));
      if (options.industry) params.append('industry', options.industry);
      if (options.limit) params.append('limit', String(options.limit));
      if (options.offset) params.append('offset', String(options.offset));

      const response = await fetch(`${API_BASE}/references/pool?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch pool');
      }

      setPool(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const matchReferences = useCallback(async (criteria: {
    industry?: string;
    companySize?: string;
    topics?: string[];
    preferredFormat?: 'phone' | 'video' | 'either';
    maxDuration?: '15min' | '30min' | '45min' | '60min';
    urgency?: 'standard' | 'high' | 'critical';
  }): Promise<MatchedReference[]> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/references/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(criteria),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to match references');
      }

      setMatches(data.data.matches);
      return data.data.matches;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getCustomerStatus = useCallback(async (customerId: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/references/customers/${customerId}/status`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get customer status');
      }

      setCustomerStatus(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const enrollReference = useCallback(async (params: {
    customerId: string;
    stakeholderName: string;
    stakeholderEmail: string;
    stakeholderTitle?: string;
    preferredFormat?: 'phone' | 'video' | 'either';
    preferredDuration?: '15min' | '30min' | '45min' | '60min';
    topics?: string[];
    industries?: string[];
    maxCallsPerMonth?: number;
    notes?: string;
  }): Promise<CustomerReference | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/references/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enroll reference');
      }

      return data.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateAvailability = useCallback(async (
    referenceId: string,
    availability: ReferenceAvailability,
    maxCallsPerMonth?: number
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/references/${referenceId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availability, maxCallsPerMonth }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update availability');
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const createCall = useCallback(async (params: {
    referenceId: string;
    prospectCompany: string;
    prospectContactName?: string;
    prospectContactEmail?: string;
    prospectIndustry?: string;
    scheduledAt?: string;
    callFormat?: 'phone' | 'video';
  }): Promise<ReferenceCall | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/references/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create call');
      }

      return data.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateCallStatus = useCallback(async (
    callId: string,
    status: CallStatus,
    metadata?: {
      completedAt?: string;
      durationMinutes?: number;
      referenceRating?: number;
      prospectRating?: number;
      referenceFeedback?: string;
      prospectFeedback?: string;
      outcome?: CallOutcome;
      dealInfluenced?: boolean;
      dealValue?: number;
    }
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/references/calls/${callId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...metadata }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update call status');
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearEmail = useCallback(() => {
    setEmail(null);
  }, []);

  return {
    loading,
    error,
    readiness,
    email,
    pool,
    matches,
    customerStatus,
    assessReadiness,
    generateRequest,
    fetchPool,
    matchReferences,
    getCustomerStatus,
    enrollReference,
    updateAvailability,
    createCall,
    updateCallStatus,
    clearError,
    clearEmail,
  };
}

/**
 * Utility function to detect if a message is a reference request command
 */
export function isReferenceRequestCommand(message: string): boolean {
  const patterns = [
    /request reference from\s+/i,
    /ask\s+.+\s+to be a reference/i,
    /reference request for\s+/i,
    /can\s+.+\s+be a reference/i,
    /add\s+.+\s+to reference pool/i,
    /check reference readiness for\s+/i,
    /find references for\s+/i,
    /match references to\s+/i,
  ];

  return patterns.some(pattern => pattern.test(message));
}

/**
 * Extract customer name from a reference request command
 */
export function extractCustomerName(command: string): string | null {
  const patterns = [
    /request reference from\s+(.+?)(?:\s+for|\s+about|\s*$)/i,
    /ask\s+(.+?)\s+to be a reference/i,
    /reference request for\s+(.+?)(?:\s+about|\s*$)/i,
    /can\s+(.+?)\s+be a reference/i,
    /add\s+(.+?)\s+to reference pool/i,
    /check reference readiness for\s+(.+?)(?:\s*$)/i,
  ];

  for (const pattern of patterns) {
    const match = command.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

export default useReferenceRequest;
