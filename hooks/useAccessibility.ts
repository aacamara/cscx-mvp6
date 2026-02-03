/**
 * useAccessibility Hook - PRD-273 High Contrast Mode
 * Provides accessibility preferences and utilities
 * Includes contrast mode, reduced motion, and screen reader announcements
 */

import { useState, useEffect, useCallback } from 'react';
import { useTheme, ContrastMode } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

// Accessibility preferences interface
export interface AccessibilityPreferences {
  contrastMode: ContrastMode;
  reducedMotion: boolean;
  fontSize: 'normal' | 'large' | 'x-large';
  screenReaderOptimized: boolean;
  focusIndicatorEnhanced: boolean;
}

// Default preferences
const defaultPreferences: AccessibilityPreferences = {
  contrastMode: 'normal',
  reducedMotion: false,
  fontSize: 'normal',
  screenReaderOptimized: false,
  focusIndicatorEnhanced: false,
};

interface UseAccessibilityReturn {
  preferences: AccessibilityPreferences;
  updatePreferences: (updates: Partial<AccessibilityPreferences>) => Promise<void>;
  resetPreferences: () => Promise<void>;
  loading: boolean;
  error: string | null;
  // Convenience accessors
  isHighContrast: boolean;
  contrastMode: ContrastMode;
  setContrastMode: (mode: ContrastMode) => void;
  toggleHighContrast: () => void;
  prefersReducedMotion: boolean;
  // Utilities
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  getContrastColor: (normalColor: string, highContrastColor: string) => string;
}

export function useAccessibility(): UseAccessibilityReturn {
  const { contrastMode, setContrastMode, toggleHighContrast, isHighContrast } = useTheme();
  const { getAuthHeaders } = useAuth();
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check OS preference for reduced motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Fetch preferences from backend
  const fetchPreferences = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/users/preferences/accessibility`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences({
          ...defaultPreferences,
          ...data.preferences,
          contrastMode, // Use context value
        });
      }
    } catch (err) {
      console.error('Failed to fetch accessibility preferences:', err);
      setError('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, contrastMode]);

  // Update preferences
  const updatePreferences = useCallback(async (updates: Partial<AccessibilityPreferences>) => {
    try {
      setError(null);

      // Handle contrast mode separately through context
      if (updates.contrastMode !== undefined) {
        setContrastMode(updates.contrastMode);
      }

      const newPreferences = { ...preferences, ...updates };
      setPreferences(newPreferences);

      // Persist to backend
      const response = await fetch(`${API_URL}/api/users/preferences/accessibility`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(newPreferences),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      // Apply font size
      if (updates.fontSize) {
        applyFontSize(updates.fontSize);
      }

      // Apply enhanced focus indicators
      if (updates.focusIndicatorEnhanced !== undefined) {
        applyFocusIndicators(updates.focusIndicatorEnhanced);
      }
    } catch (err) {
      console.error('Failed to update accessibility preferences:', err);
      setError('Failed to save preferences');
      throw err;
    }
  }, [preferences, setContrastMode, getAuthHeaders]);

  // Reset preferences to defaults
  const resetPreferences = useCallback(async () => {
    try {
      setError(null);
      await updatePreferences(defaultPreferences);
      setContrastMode('normal');
    } catch (err) {
      console.error('Failed to reset preferences:', err);
      setError('Failed to reset preferences');
    }
  }, [updatePreferences, setContrastMode]);

  // Screen reader announcement
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    // Create or find the live region
    let liveRegion = document.getElementById('cscx-live-region');

    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'cscx-live-region';
      liveRegion.setAttribute('aria-live', priority);
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

    // Update the priority if different
    liveRegion.setAttribute('aria-live', priority);

    // Clear and set the message (triggers announcement)
    liveRegion.textContent = '';
    setTimeout(() => {
      if (liveRegion) {
        liveRegion.textContent = message;
      }
    }, 100);
  }, []);

  // Get appropriate color based on contrast mode
  const getContrastColor = useCallback((normalColor: string, highContrastColor: string) => {
    return isHighContrast ? highContrastColor : normalColor;
  }, [isHighContrast]);

  // Initialize: Check OS preferences
  useEffect(() => {
    // Check reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(motionQuery.matches);

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
      setPreferences(prev => ({ ...prev, reducedMotion: e.matches }));
    };

    motionQuery.addEventListener('change', handleMotionChange);

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  // Fetch preferences on mount
  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  // Sync contrast mode from context
  useEffect(() => {
    setPreferences(prev => ({ ...prev, contrastMode }));
  }, [contrastMode]);

  // Apply font size on load
  useEffect(() => {
    if (preferences.fontSize !== 'normal') {
      applyFontSize(preferences.fontSize);
    }
  }, [preferences.fontSize]);

  // Apply focus indicators on load
  useEffect(() => {
    if (preferences.focusIndicatorEnhanced) {
      applyFocusIndicators(true);
    }
  }, [preferences.focusIndicatorEnhanced]);

  return {
    preferences,
    updatePreferences,
    resetPreferences,
    loading,
    error,
    isHighContrast,
    contrastMode,
    setContrastMode,
    toggleHighContrast,
    prefersReducedMotion,
    announce,
    getContrastColor,
  };
}

// Helper: Apply font size to document
function applyFontSize(size: 'normal' | 'large' | 'x-large') {
  const root = document.documentElement;
  root.classList.remove('font-size-large', 'font-size-x-large');

  switch (size) {
    case 'large':
      root.classList.add('font-size-large');
      break;
    case 'x-large':
      root.classList.add('font-size-x-large');
      break;
    default:
      break;
  }
}

// Helper: Apply enhanced focus indicators
function applyFocusIndicators(enhanced: boolean) {
  const root = document.documentElement;
  if (enhanced) {
    root.classList.add('focus-enhanced');
  } else {
    root.classList.remove('focus-enhanced');
  }
}

export default useAccessibility;
