/**
 * useKeyDates Hook (PRD-109)
 *
 * Custom hook for managing key customer dates and reminders.
 * Supports CRUD operations, filtering, and Slack notifications.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  KeyDate,
  KeyDateReminder,
  KeyDateFilters,
  CreateKeyDateInput,
  UpdateKeyDateInput,
  UseKeyDatesReturn,
  ReminderUrgency,
  KeyDateType,
} from '../types/keyDates';

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

// ============================================
// Hook Implementation
// ============================================

export function useKeyDates(
  initialFilters: Partial<KeyDateFilters> = {}
): UseKeyDatesReturn {
  // State
  const [keyDates, setKeyDates] = useState<KeyDate[]>([]);
  const [upcomingReminders, setUpcomingReminders] = useState<KeyDateReminder[]>([]);
  const [selectedKeyDate, setSelectedKeyDate] = useState<KeyDate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<KeyDateFilters>(initialFilters);

  // ============================================
  // Fetch Key Dates
  // ============================================

  const fetchKeyDates = useCallback(async (queryFilters?: KeyDateFilters) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      const activeFilters = queryFilters || filters;

      if (activeFilters.customerId) params.append('customerId', activeFilters.customerId);
      if (activeFilters.stakeholderId) params.append('stakeholderId', activeFilters.stakeholderId);
      if (activeFilters.dateType) params.append('dateType', activeFilters.dateType);
      if (activeFilters.fromDate) params.append('fromDate', activeFilters.fromDate);
      if (activeFilters.toDate) params.append('toDate', activeFilters.toDate);
      if (activeFilters.upcoming) params.append('upcoming', 'true');
      if (activeFilters.search) params.append('search', activeFilters.search);

      const response = await fetch(`${API_BASE}/key-dates?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch key dates');
      }

      setKeyDates(data.data.keyDates);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('[useKeyDates] Error fetching key dates:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // ============================================
  // Fetch Upcoming Reminders
  // ============================================

  const fetchUpcomingReminders = useCallback(async (days: number = 30) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/key-dates/upcoming?days=${days}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch upcoming reminders');
      }

      setUpcomingReminders(data.data.reminders);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      console.error('[useKeyDates] Error fetching reminders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================
  // Create Key Date
  // ============================================

  const createKeyDate = useCallback(async (input: CreateKeyDateInput): Promise<KeyDate> => {
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/key-dates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create key date');
      }

      // Add to local state
      setKeyDates(prev => [...prev, data.data].sort((a, b) =>
        a.dateValue.localeCompare(b.dateValue)
      ));

      return data.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create key date';
      setError(message);
      throw err;
    }
  }, []);

  // ============================================
  // Update Key Date
  // ============================================

  const updateKeyDate = useCallback(async (
    id: string,
    input: UpdateKeyDateInput
  ): Promise<KeyDate> => {
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/key-dates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to update key date');
      }

      // Update local state
      setKeyDates(prev =>
        prev.map(kd => kd.id === id ? data.data : kd)
          .sort((a, b) => a.dateValue.localeCompare(b.dateValue))
      );

      if (selectedKeyDate?.id === id) {
        setSelectedKeyDate(data.data);
      }

      return data.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update key date';
      setError(message);
      throw err;
    }
  }, [selectedKeyDate]);

  // ============================================
  // Delete Key Date
  // ============================================

  const deleteKeyDate = useCallback(async (id: string): Promise<void> => {
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/key-dates/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to delete key date');
      }

      // Remove from local state
      setKeyDates(prev => prev.filter(kd => kd.id !== id));

      if (selectedKeyDate?.id === id) {
        setSelectedKeyDate(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete key date';
      setError(message);
      throw err;
    }
  }, [selectedKeyDate]);

  // ============================================
  // Dismiss Reminder
  // ============================================

  const dismissReminder = useCallback(async (reminderId: string): Promise<void> => {
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/key-dates/reminder/${reminderId}/dismiss`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to dismiss reminder');
      }

      // Update local state
      setUpcomingReminders(prev =>
        prev.map(r => r.id === reminderId ? { ...r, status: 'dismissed' as const } : r)
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to dismiss reminder';
      setError(message);
      throw err;
    }
  }, []);

  // ============================================
  // Filter Management
  // ============================================

  const setFilters = useCallback((newFilters: Partial<KeyDateFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const selectKeyDate = useCallback((keyDate: KeyDate | null) => {
    setSelectedKeyDate(keyDate);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ============================================
  // Initial Fetch
  // ============================================

  useEffect(() => {
    fetchKeyDates();
  }, [fetchKeyDates]);

  return {
    keyDates,
    upcomingReminders,
    selectedKeyDate,
    loading,
    error,
    filters,
    fetchKeyDates,
    fetchUpcomingReminders,
    createKeyDate,
    updateKeyDate,
    deleteKeyDate,
    dismissReminder,
    setFilters,
    selectKeyDate,
    clearError,
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Format date for display
 */
export function formatKeyDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format relative days
 */
export function formatDaysUntil(daysUntil: number): string {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  if (daysUntil < 0) return `${Math.abs(daysUntil)} days ago`;
  return `${daysUntil} days away`;
}

/**
 * Get urgency color
 */
export function getUrgencyColor(urgency: ReminderUrgency): string {
  const colors: Record<ReminderUrgency, string> = {
    critical: 'text-red-400 bg-red-900/30 border-red-600',
    high: 'text-orange-400 bg-orange-900/30 border-orange-600',
    medium: 'text-yellow-400 bg-yellow-900/30 border-yellow-600',
    low: 'text-green-400 bg-green-900/30 border-green-600',
  };
  return colors[urgency];
}

/**
 * Get urgency badge classes
 */
export function getUrgencyBadge(urgency: ReminderUrgency): string {
  const badges: Record<ReminderUrgency, string> = {
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-yellow-500 text-black',
    low: 'bg-green-600 text-white',
  };
  return badges[urgency];
}

/**
 * Get date type icon
 */
export function getDateTypeIcon(dateType: KeyDateType): string {
  const icons: Record<KeyDateType, string> = {
    contract_anniversary: 'DocumentTextIcon',
    renewal: 'ArrowPathIcon',
    go_live_anniversary: 'RocketLaunchIcon',
    stakeholder_birthday: 'CakeIcon',
    company_founding: 'BuildingOfficeIcon',
    custom_milestone: 'FlagIcon',
  };
  return icons[dateType];
}

/**
 * Get date type color
 */
export function getDateTypeColor(dateType: KeyDateType): string {
  const colors: Record<KeyDateType, string> = {
    contract_anniversary: 'text-blue-400',
    renewal: 'text-purple-400',
    go_live_anniversary: 'text-green-400',
    stakeholder_birthday: 'text-pink-400',
    company_founding: 'text-amber-400',
    custom_milestone: 'text-cyan-400',
  };
  return colors[dateType];
}

/**
 * Calculate days until date
 */
export function calculateDaysUntil(dateValue: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateValue);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Check if date is in reminder window
 */
export function isInReminderWindow(dateValue: string, reminderDays: number): boolean {
  const daysUntil = calculateDaysUntil(dateValue);
  return daysUntil >= 0 && daysUntil <= reminderDays;
}

/**
 * Check if message is a key dates command
 */
export function isKeyDatesCommand(message: string): boolean {
  const patterns = [
    /what.*key dates/i,
    /upcoming.*dates/i,
    /important.*dates/i,
    /customer.*anniversar/i,
    /contract.*anniversar/i,
    /renewal.*coming/i,
    /birthday.*reminder/i,
    /key date reminder/i,
    /show me.*reminders/i,
  ];

  return patterns.some(pattern => pattern.test(message));
}

export default useKeyDates;
