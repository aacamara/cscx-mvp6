/**
 * Account Team Hook
 * PRD-072: Custom hook for fetching and managing account team data
 */

import { useState, useCallback, useEffect } from 'react';
import {
  AccountTeamResponse,
  AccountTeamMember,
  AccountTeamFilters,
  AddTeamMemberRequest,
  UpdateTeamMemberRequest,
  AccountTeamRole,
} from '../types/accountTeam';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

interface UseAccountTeamOptions {
  autoFetch?: boolean;
  initialFilters?: AccountTeamFilters;
}

interface UseAccountTeamReturn {
  // Team data
  data: AccountTeamResponse | null;
  loading: boolean;
  error: string | null;

  // Filters
  filters: AccountTeamFilters;
  setFilters: React.Dispatch<React.SetStateAction<AccountTeamFilters>>;

  // Actions
  fetchTeam: (customerId: string) => Promise<void>;
  refetch: () => Promise<void>;

  // Team management
  addMember: (customerId: string, request: AddTeamMemberRequest) => Promise<AccountTeamMember | null>;
  updateMember: (customerId: string, memberId: string, request: UpdateTeamMemberRequest) => Promise<boolean>;
  removeMember: (customerId: string, memberId: string) => Promise<boolean>;

  // Activity logging
  logActivity: (customerId: string, activity: {
    activityType: string;
    description: string;
    visibility?: 'team' | 'private';
  }) => Promise<boolean>;

  // Coordination
  scheduleSync: (customerId: string, sync: {
    topic: string;
    participants: string[];
    proposedDate: string;
  }) => Promise<boolean>;

  // UI state
  selectedMemberId: string | null;
  setSelectedMemberId: (id: string | null) => void;
  showHistorical: boolean;
  setShowHistorical: (show: boolean) => void;
}

export const useAccountTeam = (
  customerId?: string,
  options: UseAccountTeamOptions = {}
): UseAccountTeamReturn => {
  const { autoFetch = true, initialFilters = {} } = options;

  // Team data state
  const [data, setData] = useState<AccountTeamResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentCustomerId, setCurrentCustomerId] = useState<string | undefined>(customerId);

  // Filters
  const [filters, setFilters] = useState<AccountTeamFilters>({
    includeHistorical: false,
    roleFilter: 'all',
    statusFilter: 'all',
    ...initialFilters,
  });

  // UI state
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showHistorical, setShowHistorical] = useState(false);

  /**
   * Fetch account team data
   */
  const fetchTeam = useCallback(async (custId: string) => {
    setLoading(true);
    setError(null);
    setCurrentCustomerId(custId);

    try {
      const params = new URLSearchParams();

      if (filters.includeHistorical || showHistorical) {
        params.append('includeHistorical', 'true');
      }

      const response = await fetch(
        `${API_BASE}/intelligence/account-team/${custId}?${params.toString()}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch account team');
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('Account team fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters.includeHistorical, showHistorical]);

  /**
   * Refetch current customer team
   */
  const refetch = useCallback(async () => {
    if (currentCustomerId) {
      await fetchTeam(currentCustomerId);
    }
  }, [currentCustomerId, fetchTeam]);

  /**
   * Add a team member
   */
  const addMember = useCallback(async (
    custId: string,
    request: AddTeamMemberRequest
  ): Promise<AccountTeamMember | null> => {
    try {
      const response = await fetch(
        `${API_BASE}/intelligence/account-team/${custId}/members`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to add team member');
      }

      const result = await response.json();

      // Refetch to update the team list
      await refetch();

      return result.data;
    } catch (err) {
      console.error('Add team member error:', err);
      setError(err instanceof Error ? err.message : 'Failed to add team member');
      return null;
    }
  }, [refetch]);

  /**
   * Update a team member
   */
  const updateMember = useCallback(async (
    custId: string,
    memberId: string,
    request: UpdateTeamMemberRequest
  ): Promise<boolean> => {
    try {
      const response = await fetch(
        `${API_BASE}/intelligence/account-team/${custId}/members/${memberId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to update team member');
      }

      // Refetch to update the team list
      await refetch();

      return true;
    } catch (err) {
      console.error('Update team member error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update team member');
      return false;
    }
  }, [refetch]);

  /**
   * Remove a team member
   */
  const removeMember = useCallback(async (
    custId: string,
    memberId: string
  ): Promise<boolean> => {
    try {
      const response = await fetch(
        `${API_BASE}/intelligence/account-team/${custId}/members/${memberId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to remove team member');
      }

      // Refetch to update the team list
      await refetch();

      return true;
    } catch (err) {
      console.error('Remove team member error:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove team member');
      return false;
    }
  }, [refetch]);

  /**
   * Log team activity
   */
  const logActivity = useCallback(async (
    custId: string,
    activity: {
      activityType: string;
      description: string;
      visibility?: 'team' | 'private';
    }
  ): Promise<boolean> => {
    try {
      const response = await fetch(
        `${API_BASE}/intelligence/account-team/${custId}/activity`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activity),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to log activity');
      }

      // Refetch to update activity list
      await refetch();

      return true;
    } catch (err) {
      console.error('Log activity error:', err);
      return false;
    }
  }, [refetch]);

  /**
   * Schedule team sync
   */
  const scheduleSync = useCallback(async (
    custId: string,
    sync: {
      topic: string;
      participants: string[];
      proposedDate: string;
    }
  ): Promise<boolean> => {
    try {
      const response = await fetch(
        `${API_BASE}/intelligence/account-team/${custId}/sync`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sync),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to schedule sync');
      }

      // Refetch to update coordination events
      await refetch();

      return true;
    } catch (err) {
      console.error('Schedule sync error:', err);
      return false;
    }
  }, [refetch]);

  // Auto-fetch on mount and customerId changes
  useEffect(() => {
    if (autoFetch && customerId) {
      fetchTeam(customerId);
    }
  }, [autoFetch, customerId, fetchTeam]);

  // Update showHistorical in filters when toggled
  useEffect(() => {
    setFilters(prev => ({ ...prev, includeHistorical: showHistorical }));
  }, [showHistorical]);

  return {
    // Team data
    data,
    loading,
    error,

    // Filters
    filters,
    setFilters,

    // Actions
    fetchTeam,
    refetch,

    // Team management
    addMember,
    updateMember,
    removeMember,

    // Activity logging
    logActivity,

    // Coordination
    scheduleSync,

    // UI state
    selectedMemberId,
    setSelectedMemberId,
    showHistorical,
    setShowHistorical,
  };
};

export default useAccountTeam;
