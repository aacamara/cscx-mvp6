/**
 * useFontSize Hook
 * PRD-274: Font Size Customization
 *
 * Custom hook for font size management with:
 * - Keyboard shortcuts (Ctrl+/- for increase/decrease, Ctrl+0 for reset)
 * - Easy access to font size actions
 * - Screen reader announcements for accessibility
 */

import { useEffect, useCallback } from 'react';
import { useFontSizeContext } from '../context/FontSizeContext';
import {
  FontSizePreset,
  FONT_SIZE_SHORTCUTS,
  getFontSizeOption,
} from '../types/fontSettings';

interface UseFontSizeOptions {
  /**
   * Enable keyboard shortcuts (Ctrl+/-, Ctrl+0)
   * Default: true
   */
  enableKeyboardShortcuts?: boolean;

  /**
   * Announce changes to screen readers
   * Default: true
   */
  announceChanges?: boolean;

  /**
   * Custom callback when font size changes
   */
  onFontSizeChange?: (preset: FontSizePreset, scale: number) => void;
}

interface UseFontSizeReturn {
  // Current state
  fontSize: FontSizePreset;
  fontScale: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  setFontSize: (preset: FontSizePreset) => void;
  increase: () => void;
  decrease: () => void;
  reset: () => void;

  // Metadata
  currentOption: ReturnType<typeof getFontSizeOption>;
  canIncrease: boolean;
  canDecrease: boolean;

  // Utilities
  getPercentage: () => string;
  getBaseSize: () => string;
}

/**
 * Hook for managing font size with keyboard shortcuts
 */
export function useFontSize(options: UseFontSizeOptions = {}): UseFontSizeReturn {
  const {
    enableKeyboardShortcuts = true,
    announceChanges = true,
    onFontSizeChange,
  } = options;

  const {
    fontSize,
    fontScale,
    isLoading,
    error,
    setFontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    getCurrentOption,
  } = useFontSizeContext();

  const currentOption = getCurrentOption();

  /**
   * Check if we can increase font size
   */
  const canIncrease = fontSize !== 'xxlarge';

  /**
   * Check if we can decrease font size
   */
  const canDecrease = fontSize !== 'small';

  /**
   * Announce font size change to screen readers
   */
  const announceToScreenReader = useCallback((message: string) => {
    if (!announceChanges) return;

    // Create or get the live region
    let liveRegion = document.getElementById('font-size-announcer');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'font-size-announcer';
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

    // Clear and set new message
    liveRegion.textContent = '';
    setTimeout(() => {
      if (liveRegion) {
        liveRegion.textContent = message;
      }
    }, 100);
  }, [announceChanges]);

  /**
   * Handle increase with announcement
   */
  const increase = useCallback(() => {
    if (!canIncrease) {
      announceToScreenReader('Font size is at maximum');
      return;
    }

    increaseFontSize();

    // Get the new option after increase
    const presets: FontSizePreset[] = ['small', 'normal', 'large', 'xlarge', 'xxlarge'];
    const currentIndex = presets.indexOf(fontSize);
    const newPreset = presets[currentIndex + 1];
    const newOption = getFontSizeOption(newPreset);

    announceToScreenReader(`Font size increased to ${newOption.label} (${newOption.percentage})`);
    onFontSizeChange?.(newPreset, newOption.scale);
  }, [canIncrease, increaseFontSize, fontSize, announceToScreenReader, onFontSizeChange]);

  /**
   * Handle decrease with announcement
   */
  const decrease = useCallback(() => {
    if (!canDecrease) {
      announceToScreenReader('Font size is at minimum');
      return;
    }

    decreaseFontSize();

    // Get the new option after decrease
    const presets: FontSizePreset[] = ['small', 'normal', 'large', 'xlarge', 'xxlarge'];
    const currentIndex = presets.indexOf(fontSize);
    const newPreset = presets[currentIndex - 1];
    const newOption = getFontSizeOption(newPreset);

    announceToScreenReader(`Font size decreased to ${newOption.label} (${newOption.percentage})`);
    onFontSizeChange?.(newPreset, newOption.scale);
  }, [canDecrease, decreaseFontSize, fontSize, announceToScreenReader, onFontSizeChange]);

  /**
   * Handle reset with announcement
   */
  const reset = useCallback(() => {
    resetFontSize();
    announceToScreenReader('Font size reset to normal (100%)');
    onFontSizeChange?.('normal', 1);
  }, [resetFontSize, announceToScreenReader, onFontSizeChange]);

  /**
   * Handle font size change with announcement
   */
  const handleSetFontSize = useCallback((preset: FontSizePreset) => {
    setFontSize(preset);
    const option = getFontSizeOption(preset);
    announceToScreenReader(`Font size changed to ${option.label} (${option.percentage})`);
    onFontSizeChange?.(preset, option.scale);
  }, [setFontSize, announceToScreenReader, onFontSizeChange]);

  /**
   * Get percentage string
   */
  const getPercentage = useCallback(() => {
    return currentOption.percentage;
  }, [currentOption]);

  /**
   * Get base size string
   */
  const getBaseSize = useCallback(() => {
    return currentOption.baseSize;
  }, [currentOption]);

  /**
   * Keyboard shortcut handler
   */
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if we're in an input field
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Find matching shortcut
      const shortcut = FONT_SIZE_SHORTCUTS.find(s => {
        const keyMatch = event.key === s.key;
        const ctrlMatch = s.ctrlKey ? event.ctrlKey : true;
        const metaMatch = s.metaKey ? event.metaKey : true;

        // For Ctrl shortcuts, require Ctrl (or Cmd on Mac)
        if (s.ctrlKey && !s.metaKey) {
          return keyMatch && (event.ctrlKey || event.metaKey);
        }

        return keyMatch && ctrlMatch && metaMatch;
      });

      if (!shortcut) return;

      // Prevent default browser zoom behavior
      event.preventDefault();

      switch (shortcut.action) {
        case 'increase':
          increase();
          break;
        case 'decrease':
          decrease();
          break;
        case 'reset':
          reset();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcuts, increase, decrease, reset]);

  return {
    // State
    fontSize,
    fontScale,
    isLoading,
    error,

    // Actions
    setFontSize: handleSetFontSize,
    increase,
    decrease,
    reset,

    // Metadata
    currentOption,
    canIncrease,
    canDecrease,

    // Utilities
    getPercentage,
    getBaseSize,
  };
}

/**
 * Simplified hook that just returns current font size info
 * Use when you don't need actions or keyboard shortcuts
 */
export function useFontSizeInfo() {
  const { fontSize, fontScale, getCurrentOption } = useFontSizeContext();

  return {
    fontSize,
    fontScale,
    option: getCurrentOption(),
  };
}

export default useFontSize;
