/**
 * Theme Context - PRD-273 High Contrast Mode
 * Provides theme management including high contrast modes
 * Supports OS preference detection and keyboard shortcuts
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';

// Contrast mode types
export type ContrastMode = 'normal' | 'high-light' | 'high-dark';

// Theme context interface
export interface ThemeContextType {
  contrastMode: ContrastMode;
  setContrastMode: (mode: ContrastMode) => void;
  toggleHighContrast: () => void;
  isHighContrast: boolean;
  loading: boolean;
  error: string | null;
}

// Default context value
const defaultContext: ThemeContextType = {
  contrastMode: 'normal',
  setContrastMode: () => {},
  toggleHighContrast: () => {},
  isHighContrast: false,
  loading: true,
  error: null,
};

const ThemeContext = createContext<ThemeContextType>(defaultContext);

// Local storage key for persistence
const THEME_STORAGE_KEY = 'cscx-contrast-mode';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { userId, getAuthHeaders } = useAuth();
  const [contrastMode, setContrastModeState] = useState<ContrastMode>('normal');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || '';

  // Fetch user preferences from backend
  const fetchPreferences = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/users/preferences/accessibility`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.preferences?.contrastMode) {
          setContrastModeState(data.preferences.contrastMode);
          localStorage.setItem(THEME_STORAGE_KEY, data.preferences.contrastMode);
        }
      }
    } catch (err) {
      console.error('Failed to fetch accessibility preferences:', err);
      // Fallback to localStorage
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ContrastMode | null;
      if (stored) {
        setContrastModeState(stored);
      }
    } finally {
      setLoading(false);
    }
  }, [API_URL, getAuthHeaders]);

  // Save preferences to backend
  const savePreferences = useCallback(async (mode: ContrastMode) => {
    try {
      await fetch(`${API_URL}/api/users/preferences/accessibility`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          contrastMode: mode,
        }),
      });
    } catch (err) {
      console.error('Failed to save accessibility preferences:', err);
      setError('Failed to save preferences');
    }
  }, [API_URL, getAuthHeaders]);

  // Set contrast mode with persistence
  const setContrastMode = useCallback((mode: ContrastMode) => {
    setContrastModeState(mode);
    localStorage.setItem(THEME_STORAGE_KEY, mode);
    savePreferences(mode);
  }, [savePreferences]);

  // Toggle high contrast mode
  const toggleHighContrast = useCallback(() => {
    setContrastMode(prevMode => {
      if (prevMode === 'normal') {
        // Determine which high contrast to use based on OS preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return prefersDark ? 'high-dark' : 'high-light';
      }
      return 'normal';
    });
  }, [setContrastMode]);

  // Initialize: Check OS preference and load saved preference
  useEffect(() => {
    // First check localStorage for immediate feedback
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ContrastMode | null;
    if (stored) {
      setContrastModeState(stored);
    } else {
      // Check OS preference for high contrast
      const prefersHighContrast = window.matchMedia('(prefers-contrast: more)');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

      if (prefersHighContrast.matches) {
        const mode = prefersDark.matches ? 'high-dark' : 'high-light';
        setContrastModeState(mode);
        localStorage.setItem(THEME_STORAGE_KEY, mode);
      }
    }

    // Then fetch from backend (may override)
    if (userId) {
      fetchPreferences();
    } else {
      setLoading(false);
    }
  }, [userId, fetchPreferences]);

  // Listen for OS preference changes
  useEffect(() => {
    const highContrastQuery = window.matchMedia('(prefers-contrast: more)');
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleHighContrastChange = (e: MediaQueryListEvent) => {
      if (e.matches && contrastMode === 'normal') {
        const mode = darkModeQuery.matches ? 'high-dark' : 'high-light';
        setContrastMode(mode);
      }
    };

    highContrastQuery.addEventListener('change', handleHighContrastChange);

    return () => {
      highContrastQuery.removeEventListener('change', handleHighContrastChange);
    };
  }, [contrastMode, setContrastMode]);

  // Keyboard shortcut: Ctrl+Shift+H
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        toggleHighContrast();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleHighContrast]);

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;

    // Remove all contrast classes
    root.classList.remove('high-contrast-light', 'high-contrast-dark');

    // Add appropriate class
    if (contrastMode === 'high-light') {
      root.classList.add('high-contrast-light');
    } else if (contrastMode === 'high-dark') {
      root.classList.add('high-contrast-dark');
    }
  }, [contrastMode]);

  const value: ThemeContextType = {
    contrastMode,
    setContrastMode,
    toggleHighContrast,
    isHighContrast: contrastMode !== 'normal',
    loading,
    error,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook to use theme context
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;
