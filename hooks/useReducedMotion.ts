/**
 * useReducedMotion Hook
 * PRD-275: Reduced Motion Option
 *
 * Custom hook for detecting and managing motion preferences.
 * Supports OS preference detection, user overrides, and persistence.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

// Motion preference levels
export type MotionPreference = 'full' | 'partial' | 'reduced' | 'none' | 'system';

// Motion level details for UI display
export interface MotionLevel {
  id: MotionPreference;
  label: string;
  description: string;
  animationDuration: string;
}

// All available motion levels
export const MOTION_LEVELS: MotionLevel[] = [
  {
    id: 'full',
    label: 'Full Motion',
    description: 'All animations enabled',
    animationDuration: 'Default',
  },
  {
    id: 'partial',
    label: 'Partial',
    description: 'Subtle, quick animations only',
    animationDuration: '150ms max',
  },
  {
    id: 'reduced',
    label: 'Reduced',
    description: 'Minimal essential animations',
    animationDuration: '50ms',
  },
  {
    id: 'none',
    label: 'None',
    description: 'No animations at all',
    animationDuration: '0ms',
  },
  {
    id: 'system',
    label: 'System',
    description: 'Follow OS preference',
    animationDuration: 'Auto',
  },
];

// Hook return interface
export interface UseReducedMotionReturn {
  // Current state
  motionPreference: MotionPreference;
  prefersReducedMotion: boolean;
  shouldReduceMotion: boolean;
  effectiveMotionLevel: Exclude<MotionPreference, 'system'>;
  isLoading: boolean;
  error: string | null;

  // Actions
  setMotionPreference: (preference: MotionPreference) => Promise<void>;
  resetToSystem: () => Promise<void>;

  // Utilities
  getMotionLevel: (id: MotionPreference) => MotionLevel | undefined;
  getMotionClass: () => string;
  announce: (message: string) => void;
}

/**
 * Hook for managing reduced motion preferences
 */
export function useReducedMotion(): UseReducedMotionReturn {
  const { getAuthHeaders } = useAuth();

  // OS preference state
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // User preference state
  const [motionPreference, setMotionPreferenceState] = useState<MotionPreference>('system');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detect OS preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Fetch user preference from backend
  useEffect(() => {
    const fetchPreference = async () => {
      try {
        const response = await fetch(`${API_URL}/api/users/preferences/motion`, {
          headers: getAuthHeaders(),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.preference) {
            setMotionPreferenceState(data.preference as MotionPreference);
          }
        }
      } catch (err) {
        console.error('Failed to fetch motion preference:', err);
        // Don't set error - just use default
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreference();
  }, [getAuthHeaders]);

  // Calculate effective motion level
  const effectiveMotionLevel: Exclude<MotionPreference, 'system'> = (() => {
    if (motionPreference === 'system') {
      return prefersReducedMotion ? 'reduced' : 'full';
    }
    return motionPreference;
  })();

  // Should reduce motion (for simple boolean checks)
  const shouldReduceMotion = effectiveMotionLevel === 'reduced' || effectiveMotionLevel === 'none';

  // Apply motion class to document
  useEffect(() => {
    const root = document.documentElement;

    // Remove all motion classes
    root.classList.remove('motion-full', 'motion-partial', 'motion-reduced', 'motion-none');

    // Add the effective motion class
    root.classList.add(`motion-${effectiveMotionLevel}`);
  }, [effectiveMotionLevel]);

  // Set motion preference
  const setMotionPreference = useCallback(async (preference: MotionPreference) => {
    try {
      setError(null);
      const previousPreference = motionPreference;
      setMotionPreferenceState(preference);

      // Persist to backend
      const response = await fetch(`${API_URL}/api/users/preferences/motion`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ preference }),
      });

      if (!response.ok) {
        // Revert on failure
        setMotionPreferenceState(previousPreference);
        throw new Error('Failed to save motion preference');
      }

      // Announce change for screen readers
      const level = MOTION_LEVELS.find(l => l.id === preference);
      announce(`Motion preference changed to ${level?.label || preference}`);
    } catch (err) {
      console.error('Failed to set motion preference:', err);
      setError('Failed to save preference');
      throw err;
    }
  }, [motionPreference, getAuthHeaders]);

  // Reset to system preference
  const resetToSystem = useCallback(async () => {
    await setMotionPreference('system');
    announce('Motion preference reset to follow system setting');
  }, [setMotionPreference]);

  // Get motion level info
  const getMotionLevel = useCallback((id: MotionPreference): MotionLevel | undefined => {
    return MOTION_LEVELS.find(level => level.id === id);
  }, []);

  // Get CSS class for current motion level
  const getMotionClass = useCallback((): string => {
    return `motion-${effectiveMotionLevel}`;
  }, [effectiveMotionLevel]);

  // Screen reader announcement
  const announce = useCallback((message: string) => {
    let liveRegion = document.getElementById('motion-announcer');

    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'motion-announcer';
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      liveRegion.style.cssText = `
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      `;
      document.body.appendChild(liveRegion);
    }

    // Clear and set message
    liveRegion.textContent = '';
    setTimeout(() => {
      if (liveRegion) {
        liveRegion.textContent = message;
      }
    }, 100);
  }, []);

  return {
    // State
    motionPreference,
    prefersReducedMotion,
    shouldReduceMotion,
    effectiveMotionLevel,
    isLoading,
    error,

    // Actions
    setMotionPreference,
    resetToSystem,

    // Utilities
    getMotionLevel,
    getMotionClass,
    announce,
  };
}

/**
 * Simple hook for just checking if motion should be reduced
 * Use when you don't need the full API
 */
export function useShouldReduceMotion(): boolean {
  const [shouldReduce, setShouldReduce] = useState(false);

  useEffect(() => {
    // Check if user has set a preference via class
    const root = document.documentElement;
    const hasReducedClass = root.classList.contains('motion-reduced') || root.classList.contains('motion-none');

    if (hasReducedClass) {
      setShouldReduce(true);
      return;
    }

    // Fall back to OS preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setShouldReduce(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setShouldReduce(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return shouldReduce;
}

/**
 * Hook for getting motion-safe animation props
 * Returns animation props that respect reduced motion settings
 */
export function useMotionSafeAnimation(defaultDuration = 200) {
  const shouldReduce = useShouldReduceMotion();

  return {
    duration: shouldReduce ? 0 : defaultDuration,
    animate: !shouldReduce,
    transition: shouldReduce ? 'none' : `all ${defaultDuration}ms ease-out`,
  };
}

export default useReducedMotion;
