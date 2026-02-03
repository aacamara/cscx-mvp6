/**
 * High Contrast Toggle Component - PRD-273
 * Quick toggle button for high contrast mode in the header
 */

import React from 'react';
import { useTheme } from '../context/ThemeContext';

interface HighContrastToggleProps {
  compact?: boolean;
}

export function HighContrastToggle({ compact = false }: HighContrastToggleProps) {
  const { contrastMode, toggleHighContrast, isHighContrast } = useTheme();

  // Get icon based on current mode
  const getIcon = () => {
    if (contrastMode === 'high-light') {
      // Sun icon for high contrast light
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      );
    } else if (contrastMode === 'high-dark') {
      // Moon icon for high contrast dark
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      );
    }
    // Eye icon for normal mode
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>
    );
  };

  // Get tooltip text
  const getTooltip = () => {
    if (isHighContrast) {
      return `High Contrast ${contrastMode === 'high-light' ? 'Light' : 'Dark'} (Ctrl+Shift+H to toggle)`;
    }
    return 'Enable High Contrast Mode (Ctrl+Shift+H)';
  };

  if (compact) {
    return (
      <button
        onClick={toggleHighContrast}
        className={`p-1.5 rounded-md transition-colors ${
          isHighContrast
            ? 'bg-cscx-accent text-white'
            : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
        }`}
        title={getTooltip()}
        aria-label={getTooltip()}
        aria-pressed={isHighContrast}
      >
        {getIcon()}
      </button>
    );
  }

  return (
    <button
      onClick={toggleHighContrast}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
        isHighContrast
          ? 'bg-cscx-accent/20 border border-cscx-accent text-cscx-accent'
          : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800 border border-transparent'
      }`}
      title={getTooltip()}
      aria-label={getTooltip()}
      aria-pressed={isHighContrast}
    >
      {getIcon()}
      <span className="text-sm hidden sm:inline">
        {isHighContrast ? 'HC On' : 'HC Off'}
      </span>
    </button>
  );
}

export default HighContrastToggle;
