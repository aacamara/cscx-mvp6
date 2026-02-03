/**
 * Executive Sponsor Hook
 * PRD-246: Custom hook for managing executive sponsor data and operations
 */

import { useState, useCallback, useEffect } from 'react';
import {
  ExecutiveSponsor,
  ExecutiveAssignment,
  ExecutiveEngagement,
  ExecutiveMatch,
  SponsorPortfolio,
  SponsorDashboard,
  ImpactMetrics,
  QualificationResult,
  SponsorFilters,
  AssignmentFilters,
  EngagementFilters,
  CreateExecutiveSponsorRequest,
  CreateAssignmentRequest,
  CreateEngagementRequest,
  AssignmentStatus,
  EngagementCadence
} from '../types/executiveSponsor';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/executive-sponsors`;

// ============================================
// MAIN HOOK
// ============================================

interface UseExecutiveSponsorOptions {
  autoFetch?: boolean;
  sponsorId?: string;
}

interface UseExecutiveSponsorReturn {
  // Sponsors
  sponsors: ExecutiveSponsor[];
  sponsorsLoading: boolean;
  sponsorsError: string | null;
  fetchSponsors: (filters?: SponsorFilters) => Promise<void>;
  createSponsor: (request: CreateExecutiveSponsorRequest) => Promise<ExecutiveSponsor>;
  updateSponsor: (id: string, updates: Partial<ExecutiveSponsor>) => Promise<ExecutiveSponsor>;

  // Selected Sponsor
  selectedSponsor: ExecutiveSponsor | null;
  selectedSponsorLoading: boolean;
  fetchSponsor: (id: string) => Promise<void>;
  clearSelectedSponsor: () => void;

  // Portfolio
  portfolio: SponsorPortfolio | null;
  portfolioLoading: boolean;
  fetchPortfolio: (sponsorId: string) => Promise<void>;

  // Dashboard
  dashboard: SponsorDashboard | null;
  dashboardLoading: boolean;
  fetchDashboard: (sponsorId: string) => Promise<void>;

  // Assignments
  assignments: ExecutiveAssignment[];
  assignmentsLoading: boolean;
  fetchAssignments: (filters?: AssignmentFilters) => Promise<void>;
  createAssignment: (request: CreateAssignmentRequest) => Promise<ExecutiveAssignment>;
  updateAssignment: (id: string, status: AssignmentStatus, endReason?: string) => Promise<ExecutiveAssignment>;
  deleteAssignment: (id: string) => Promise<void>;

  // Matching
  matches: ExecutiveMatch[];
  matchesLoading: boolean;
  findMatches: (customerId: string) => Promise<void>;

  // Engagements
  engagements: ExecutiveEngagement[];
  engagementsLoading: boolean;
  fetchEngagements: (filters?: EngagementFilters) => Promise<void>;
  createEngagement: (request: CreateEngagementRequest) => Promise<ExecutiveEngagement>;

  // Impact Metrics
  impactMetrics: ImpactMetrics | null;
  impactMetricsLoading: boolean;
  fetchImpactMetrics: () => Promise<void>;

  // Qualified Accounts
  qualifiedAccounts: QualificationResult | null;
  qualifiedAccountsLoading: boolean;
  fetchQualifiedAccounts: () => Promise<void>;

  // Refetch
  refetch: () => Promise<void>;
}

export const useExecutiveSponsor = (
  options: UseExecutiveSponsorOptions = {}
): UseExecutiveSponsorReturn => {
  const { autoFetch = true, sponsorId } = options;

  // Sponsors state
  const [sponsors, setSponsors] = useState<ExecutiveSponsor[]>([]);
  const [sponsorsLoading, setSponsorsLoading] = useState(false);
  const [sponsorsError, setSponsorsError] = useState<string | null>(null);

  // Selected sponsor state
  const [selectedSponsor, setSelectedSponsor] = useState<ExecutiveSponsor | null>(null);
  const [selectedSponsorLoading, setSelectedSponsorLoading] = useState(false);

  // Portfolio state
  const [portfolio, setPortfolio] = useState<SponsorPortfolio | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  // Dashboard state
  const [dashboard, setDashboard] = useState<SponsorDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Assignments state
  const [assignments, setAssignments] = useState<ExecutiveAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  // Matches state
  const [matches, setMatches] = useState<ExecutiveMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);

  // Engagements state
  const [engagements, setEngagements] = useState<ExecutiveEngagement[]>([]);
  const [engagementsLoading, setEngagementsLoading] = useState(false);

  // Impact metrics state
  const [impactMetrics, setImpactMetrics] = useState<ImpactMetrics | null>(null);
  const [impactMetricsLoading, setImpactMetricsLoading] = useState(false);

  // Qualified accounts state
  const [qualifiedAccounts, setQualifiedAccounts] = useState<QualificationResult | null>(null);
  const [qualifiedAccountsLoading, setQualifiedAccountsLoading] = useState(false);

  // ============================================
  // SPONSORS
  // ============================================

  const fetchSponsors = useCallback(async (filters?: SponsorFilters) => {
    setSponsorsLoading(true);
    setSponsorsError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.active !== undefined) params.append('active', String(filters.active));
      if (filters?.has_capacity) params.append('has_capacity', 'true');
      if (filters?.industry) params.append('industry', filters.industry);
      if (filters?.specialty) params.append('specialty', filters.specialty);
      if (filters?.search) params.append('search', filters.search);

      const response = await fetch(`${API_BASE}?${params}`);
      if (!response.ok) throw new Error('Failed to fetch sponsors');

      const result = await response.json();
      setSponsors(result.sponsors || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch sponsors';
      setSponsorsError(message);
      console.error('Fetch sponsors error:', err);
    } finally {
      setSponsorsLoading(false);
    }
  }, []);

  const createSponsor = useCallback(async (request: CreateExecutiveSponsorRequest): Promise<ExecutiveSponsor> => {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to create sponsor');
    }

    const result = await response.json();
    setSponsors(prev => [result.sponsor, ...prev]);
    return result.sponsor;
  }, []);

  const updateSponsor = useCallback(async (id: string, updates: Partial<ExecutiveSponsor>): Promise<ExecutiveSponsor> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to update sponsor');
    }

    const result = await response.json();
    setSponsors(prev => prev.map(s => s.id === id ? result.sponsor : s));
    if (selectedSponsor?.id === id) {
      setSelectedSponsor(result.sponsor);
    }
    return result.sponsor;
  }, [selectedSponsor]);

  const fetchSponsor = useCallback(async (id: string) => {
    setSelectedSponsorLoading(true);

    try {
      const response = await fetch(`${API_BASE}/${id}`);
      if (!response.ok) throw new Error('Failed to fetch sponsor');

      const result = await response.json();
      setSelectedSponsor(result.sponsor);
    } catch (err) {
      console.error('Fetch sponsor error:', err);
      setSelectedSponsor(null);
    } finally {
      setSelectedSponsorLoading(false);
    }
  }, []);

  const clearSelectedSponsor = useCallback(() => {
    setSelectedSponsor(null);
    setPortfolio(null);
    setDashboard(null);
  }, []);

  // ============================================
  // PORTFOLIO & DASHBOARD
  // ============================================

  const fetchPortfolio = useCallback(async (id: string) => {
    setPortfolioLoading(true);

    try {
      const response = await fetch(`${API_BASE}/${id}/portfolio`);
      if (!response.ok) throw new Error('Failed to fetch portfolio');

      const result = await response.json();
      setPortfolio(result);
    } catch (err) {
      console.error('Fetch portfolio error:', err);
      setPortfolio(null);
    } finally {
      setPortfolioLoading(false);
    }
  }, []);

  const fetchDashboard = useCallback(async (id: string) => {
    setDashboardLoading(true);

    try {
      const response = await fetch(`${API_BASE}/${id}/dashboard`);
      if (!response.ok) throw new Error('Failed to fetch dashboard');

      const result = await response.json();
      setDashboard(result);
    } catch (err) {
      console.error('Fetch dashboard error:', err);
      setDashboard(null);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  // ============================================
  // ASSIGNMENTS
  // ============================================

  const fetchAssignments = useCallback(async (filters?: AssignmentFilters) => {
    setAssignmentsLoading(true);

    try {
      const params = new URLSearchParams();
      if (filters?.customer_id) params.append('customer_id', filters.customer_id);
      if (filters?.executive_sponsor_id) params.append('executive_sponsor_id', filters.executive_sponsor_id);
      if (filters?.status) params.append('status', filters.status);

      const response = await fetch(`${API_BASE}/assignments?${params}`);
      if (!response.ok) throw new Error('Failed to fetch assignments');

      const result = await response.json();
      setAssignments(result.assignments || []);
    } catch (err) {
      console.error('Fetch assignments error:', err);
    } finally {
      setAssignmentsLoading(false);
    }
  }, []);

  const createAssignment = useCallback(async (request: CreateAssignmentRequest): Promise<ExecutiveAssignment> => {
    const response = await fetch(`${API_BASE}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to create assignment');
    }

    const result = await response.json();
    setAssignments(prev => [result.assignment, ...prev]);
    return result.assignment;
  }, []);

  const updateAssignment = useCallback(async (
    id: string,
    status: AssignmentStatus,
    endReason?: string
  ): Promise<ExecutiveAssignment> => {
    const response = await fetch(`${API_BASE}/assignments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, end_reason: endReason })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to update assignment');
    }

    const result = await response.json();
    setAssignments(prev => prev.map(a => a.id === id ? result.assignment : a));
    return result.assignment;
  }, []);

  const deleteAssignment = useCallback(async (id: string) => {
    const response = await fetch(`${API_BASE}/assignments/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to delete assignment');
    }

    setAssignments(prev => prev.filter(a => a.id !== id));
  }, []);

  // ============================================
  // MATCHING
  // ============================================

  const findMatches = useCallback(async (customerId: string) => {
    setMatchesLoading(true);

    try {
      const response = await fetch(`${API_BASE}/matching/${customerId}`);
      if (!response.ok) throw new Error('Failed to find matches');

      const result = await response.json();
      setMatches(result.matches || []);
    } catch (err) {
      console.error('Find matches error:', err);
      setMatches([]);
    } finally {
      setMatchesLoading(false);
    }
  }, []);

  // ============================================
  // ENGAGEMENTS
  // ============================================

  const fetchEngagements = useCallback(async (filters?: EngagementFilters) => {
    setEngagementsLoading(true);

    try {
      const params = new URLSearchParams();
      if (filters?.customer_id) params.append('customer_id', filters.customer_id);
      if (filters?.executive_sponsor_id) params.append('executive_sponsor_id', filters.executive_sponsor_id);
      if (filters?.assignment_id) params.append('assignment_id', filters.assignment_id);
      if (filters?.engagement_type) params.append('engagement_type', filters.engagement_type);
      if (filters?.start_date) params.append('start_date', filters.start_date.toISOString());
      if (filters?.end_date) params.append('end_date', filters.end_date.toISOString());

      const response = await fetch(`${API_BASE}/engagements?${params}`);
      if (!response.ok) throw new Error('Failed to fetch engagements');

      const result = await response.json();
      setEngagements(result.engagements || []);
    } catch (err) {
      console.error('Fetch engagements error:', err);
    } finally {
      setEngagementsLoading(false);
    }
  }, []);

  const createEngagement = useCallback(async (request: CreateEngagementRequest): Promise<ExecutiveEngagement> => {
    const response = await fetch(`${API_BASE}/engagements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Failed to create engagement');
    }

    const result = await response.json();
    setEngagements(prev => [result.engagement, ...prev]);
    return result.engagement;
  }, []);

  // ============================================
  // IMPACT METRICS
  // ============================================

  const fetchImpactMetrics = useCallback(async () => {
    setImpactMetricsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/reports/impact-metrics`);
      if (!response.ok) throw new Error('Failed to fetch impact metrics');

      const result = await response.json();
      setImpactMetrics(result);
    } catch (err) {
      console.error('Fetch impact metrics error:', err);
      setImpactMetrics(null);
    } finally {
      setImpactMetricsLoading(false);
    }
  }, []);

  // ============================================
  // QUALIFIED ACCOUNTS
  // ============================================

  const fetchQualifiedAccounts = useCallback(async () => {
    setQualifiedAccountsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/qualified-accounts`);
      if (!response.ok) throw new Error('Failed to fetch qualified accounts');

      const result = await response.json();
      setQualifiedAccounts(result);
    } catch (err) {
      console.error('Fetch qualified accounts error:', err);
      setQualifiedAccounts(null);
    } finally {
      setQualifiedAccountsLoading(false);
    }
  }, []);

  // ============================================
  // REFETCH
  // ============================================

  const refetch = useCallback(async () => {
    await fetchSponsors();
    if (sponsorId) {
      await fetchSponsor(sponsorId);
      await fetchPortfolio(sponsorId);
      await fetchDashboard(sponsorId);
    }
  }, [fetchSponsors, fetchSponsor, fetchPortfolio, fetchDashboard, sponsorId]);

  // ============================================
  // AUTO-FETCH
  // ============================================

  useEffect(() => {
    if (autoFetch) {
      fetchSponsors();
    }
  }, [autoFetch, fetchSponsors]);

  useEffect(() => {
    if (sponsorId && autoFetch) {
      fetchSponsor(sponsorId);
      fetchPortfolio(sponsorId);
      fetchDashboard(sponsorId);
    }
  }, [sponsorId, autoFetch, fetchSponsor, fetchPortfolio, fetchDashboard]);

  return {
    // Sponsors
    sponsors,
    sponsorsLoading,
    sponsorsError,
    fetchSponsors,
    createSponsor,
    updateSponsor,

    // Selected Sponsor
    selectedSponsor,
    selectedSponsorLoading,
    fetchSponsor,
    clearSelectedSponsor,

    // Portfolio
    portfolio,
    portfolioLoading,
    fetchPortfolio,

    // Dashboard
    dashboard,
    dashboardLoading,
    fetchDashboard,

    // Assignments
    assignments,
    assignmentsLoading,
    fetchAssignments,
    createAssignment,
    updateAssignment,
    deleteAssignment,

    // Matching
    matches,
    matchesLoading,
    findMatches,

    // Engagements
    engagements,
    engagementsLoading,
    fetchEngagements,
    createEngagement,

    // Impact Metrics
    impactMetrics,
    impactMetricsLoading,
    fetchImpactMetrics,

    // Qualified Accounts
    qualifiedAccounts,
    qualifiedAccountsLoading,
    fetchQualifiedAccounts,

    // Refetch
    refetch
  };
};

export default useExecutiveSponsor;
