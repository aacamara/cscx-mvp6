/**
 * Font Size Context
 * PRD-274: Font Size Customization
 *
 * Provides global font size state management with:
 * - 5 preset size options (small to xxlarge)
 * - CSS custom property updates for real-time scaling
 * - LocalStorage persistence with API sync
 * - OS preference detection
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import {
  FontSizePreset,
  FontSizeContextValue,
  FontPreferences,
  FONT_SCALES,
  FONT_SIZE_OPTIONS,
  DEFAULT_FONT_PREFERENCES,
  getNextLargerPreset,
  getNextSmallerPreset,
  getFontSizeOption,
  isValidFontSizePreset,
} from '../types/fontSettings';
import { useAuth } from './AuthContext';

// LocalStorage key for font preferences
const FONT_PREFS_STORAGE_KEY = 'cscx-font-preferences';

// CSS custom property name
const FONT_SCALE_CSS_VAR = '--font-scale';

// Minimum font size in pixels (accessibility requirement)
const MIN_FONT_SIZE_PX = 12;

const FontSizeContext = createContext<FontSizeContextValue | undefined>(undefined);

interface FontSizeProviderProps {
  children: ReactNode;
}

export const FontSizeProvider: React.FC<FontSizeProviderProps> = ({ children }) => {
  const { getAuthHeaders, isAuthenticated } = useAuth();

  const [fontSize, setFontSizeState] = useState<FontSizePreset>('normal');
  const [fontScale, setFontScale] = useState<number>(1);
  const [respectOSPreference, setRespectOSPreferenceState] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Apply font scale to CSS custom property
   */
  const applyFontScale = useCallback((scale: number) => {
    // Ensure minimum font size is maintained
    const minScale = MIN_FONT_SIZE_PX / 16; // 0.75 minimum
    const safeScale = Math.max(scale, minScale);

    document.documentElement.style.setProperty(FONT_SCALE_CSS_VAR, String(safeScale));

    // Also update body class for Tailwind utilities
    document.body.classList.remove(
      'font-scale-small',
      'font-scale-normal',
      'font-scale-large',
      'font-scale-xlarge',
      'font-scale-xxlarge'
    );

    // Find matching preset for class
    const presets: FontSizePreset[] = ['small', 'normal', 'large', 'xlarge', 'xxlarge'];
    for (const preset of presets) {
      if (Math.abs(FONT_SCALES[preset] - safeScale) < 0.01) {
        document.body.classList.add(`font-scale-${preset}`);
        break;
      }
    }
  }, []);

  /**
   * Save preferences to localStorage
   */
  const saveToLocalStorage = useCallback((prefs: FontPreferences) => {
    try {
      localStorage.setItem(FONT_PREFS_STORAGE_KEY, JSON.stringify({
        ...prefs,
        lastUpdated: new Date().toISOString(),
      }));
    } catch (err) {
      console.error('Failed to save font preferences to localStorage:', err);
    }
  }, []);

  /**
   * Load preferences from localStorage
   */
  const loadFromLocalStorage = useCallback((): FontPreferences | null => {
    try {
      const stored = localStorage.getItem(FONT_PREFS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (isValidFontSizePreset(parsed.fontSize)) {
          return parsed as FontPreferences;
        }
      }
    } catch (err) {
      console.error('Failed to load font preferences from localStorage:', err);
    }
    return null;
  }, []);

  /**
   * Save preferences to API
   */
  const saveToAPI = useCallback(async (prefs: FontPreferences) => {
    if (!isAuthenticated) return;

    const API_URL = import.meta.env.VITE_API_URL || '';

    try {
      const response = await fetch(`${API_URL}/api/users/preferences/font-size`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          fontSize: prefs.fontSize,
          fontScale: prefs.fontScale,
          respectOSPreference: prefs.respectOSPreference,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save font preferences');
      }
    } catch (err) {
      console.error('Failed to save font preferences to API:', err);
      // Don't throw - localStorage is our fallback
    }
  }, [isAuthenticated, getAuthHeaders]);

  /**
   * Load preferences from API
   */
  const loadFromAPI = useCallback(async (): Promise<FontPreferences | null> => {
    if (!isAuthenticated) return null;

    const API_URL = import.meta.env.VITE_API_URL || '';

    try {
      const response = await fetch(`${API_URL}/api/users/preferences/font-size`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return data.data as FontPreferences;
        }
      }
    } catch (err) {
      console.error('Failed to load font preferences from API:', err);
    }
    return null;
  }, [isAuthenticated, getAuthHeaders]);

  /**
   * Detect OS font size preference
   */
  const detectOSPreference = useCallback((): FontSizePreset | null => {
    // Check for prefers-reduced-motion (some users need larger text)
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Check for system zoom level via devicePixelRatio
    const dpr = window.devicePixelRatio || 1;

    // If user has system zoom > 1.25, suggest larger text
    if (dpr > 1.5 || prefersReducedMotion) {
      return 'large';
    }

    return null;
  }, []);

  /**
   * Set font size preset
   */
  const setFontSize = useCallback((preset: FontSizePreset) => {
    const scale = FONT_SCALES[preset];

    setFontSizeState(preset);
    setFontScale(scale);
    applyFontScale(scale);

    const prefs: FontPreferences = {
      fontSize: preset,
      fontScale: scale,
      respectOSPreference,
    };

    saveToLocalStorage(prefs);
    saveToAPI(prefs);
    setError(null);
  }, [respectOSPreference, applyFontScale, saveToLocalStorage, saveToAPI]);

  /**
   * Increase font size to next preset
   */
  const increaseFontSize = useCallback(() => {
    const nextPreset = getNextLargerPreset(fontSize);
    if (nextPreset) {
      setFontSize(nextPreset);
    }
  }, [fontSize, setFontSize]);

  /**
   * Decrease font size to previous preset
   */
  const decreaseFontSize = useCallback(() => {
    const prevPreset = getNextSmallerPreset(fontSize);
    if (prevPreset) {
      setFontSize(prevPreset);
    }
  }, [fontSize, setFontSize]);

  /**
   * Reset to normal font size
   */
  const resetFontSize = useCallback(() => {
    setFontSize('normal');
  }, [setFontSize]);

  /**
   * Toggle OS preference respect
   */
  const setRespectOSPreference = useCallback((value: boolean) => {
    setRespectOSPreferenceState(value);

    const prefs: FontPreferences = {
      fontSize,
      fontScale,
      respectOSPreference: value,
    };

    saveToLocalStorage(prefs);
    saveToAPI(prefs);

    // If enabling OS preference, check and apply
    if (value) {
      const osPreference = detectOSPreference();
      if (osPreference && osPreference !== fontSize) {
        setFontSize(osPreference);
      }
    }
  }, [fontSize, fontScale, saveToLocalStorage, saveToAPI, detectOSPreference, setFontSize]);

  /**
   * Get current font size option metadata
   */
  const getCurrentOption = useCallback(() => {
    return getFontSizeOption(fontSize);
  }, [fontSize]);

  /**
   * Initialize preferences on mount
   */
  useEffect(() => {
    const initializePreferences = async () => {
      setIsLoading(true);

      try {
        // Priority: API > localStorage > OS preference > default
        let prefs: FontPreferences | null = null;

        // Try API first if authenticated
        if (isAuthenticated) {
          prefs = await loadFromAPI();
        }

        // Fall back to localStorage
        if (!prefs) {
          prefs = loadFromLocalStorage();
        }

        // If still no prefs and OS preference is respected, detect
        if (!prefs) {
          prefs = { ...DEFAULT_FONT_PREFERENCES };

          const osPreference = detectOSPreference();
          if (osPreference) {
            prefs.fontSize = osPreference;
            prefs.fontScale = FONT_SCALES[osPreference];
          }
        }

        // Apply preferences
        setFontSizeState(prefs.fontSize);
        setFontScale(prefs.fontScale);
        setRespectOSPreferenceState(prefs.respectOSPreference ?? true);
        applyFontScale(prefs.fontScale);

      } catch (err) {
        console.error('Failed to initialize font preferences:', err);
        setError('Failed to load font preferences');
        // Apply defaults on error
        applyFontScale(1);
      } finally {
        setIsLoading(false);
      }
    };

    initializePreferences();
  }, [isAuthenticated, loadFromAPI, loadFromLocalStorage, detectOSPreference, applyFontScale]);

  /**
   * Listen for OS preference changes
   */
  useEffect(() => {
    if (!respectOSPreference) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = () => {
      const osPreference = detectOSPreference();
      if (osPreference && osPreference !== fontSize) {
        setFontSize(osPreference);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [respectOSPreference, fontSize, detectOSPreference, setFontSize]);

  const contextValue: FontSizeContextValue = {
    // State
    fontSize,
    fontScale,
    respectOSPreference,
    isLoading,
    error,

    // Actions
    setFontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    setRespectOSPreference,

    // Metadata
    fontScales: FONT_SCALES,
    fontSizeOptions: FONT_SIZE_OPTIONS,
    getCurrentOption,
  };

  return (
    <FontSizeContext.Provider value={contextValue}>
      {children}
    </FontSizeContext.Provider>
  );
};

/**
 * Hook to use font size context
 */
export const useFontSizeContext = (): FontSizeContextValue => {
  const context = useContext(FontSizeContext);
  if (context === undefined) {
    throw new Error('useFontSizeContext must be used within a FontSizeProvider');
  }
  return context;
};

/**
 * Quick access hook for common values
 */
export const useFontScale = () => {
  const { fontScale, fontSize } = useFontSizeContext();
  return { fontScale, fontSize };
};
