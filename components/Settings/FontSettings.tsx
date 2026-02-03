/**
 * Font Settings Component
 * PRD-274: Font Size Customization
 *
 * UI for adjusting font size preferences including:
 * - Size preset selection with visual preview
 * - Quick adjustment buttons (increase/decrease/reset)
 * - OS preference toggle
 * - Keyboard shortcut reference
 */

import React, { useCallback } from 'react';
import { useFontSize } from '../../hooks/useFontSize';
import {
  FontSizePreset,
  FONT_SIZE_OPTIONS,
} from '../../types/fontSettings';

interface FontSettingsProps {
  /**
   * Compact mode shows only the essentials
   */
  compact?: boolean;

  /**
   * Show keyboard shortcuts reference
   */
  showShortcuts?: boolean;

  /**
   * Custom class name
   */
  className?: string;

  /**
   * Callback when settings change
   */
  onSettingsChange?: (preset: FontSizePreset) => void;
}

export const FontSettings: React.FC<FontSettingsProps> = ({
  compact = false,
  showShortcuts = true,
  className = '',
  onSettingsChange,
}) => {
  const {
    fontSize,
    fontScale,
    isLoading,
    setFontSize,
    increase,
    decrease,
    reset,
    currentOption,
    canIncrease,
    canDecrease,
  } = useFontSize({
    onFontSizeChange: (preset) => onSettingsChange?.(preset),
  });

  const handlePresetSelect = useCallback((preset: FontSizePreset) => {
    setFontSize(preset);
  }, [setFontSize]);

  if (isLoading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-4 w-4 bg-cscx-gray-700 rounded-full" />
          <div className="h-4 w-32 bg-cscx-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${className}`}
      role="region"
      aria-label="Font size settings"
    >
      {/* Header */}
      {!compact && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">Font Size</h3>
          <p className="text-sm text-cscx-gray-400 mt-1">
            Adjust the text size for better readability
          </p>
        </div>
      )}

      {/* Current Size Display */}
      <div className="flex items-center justify-between mb-4 p-3 bg-cscx-gray-900 rounded-lg border border-cscx-gray-800">
        <span className="text-sm text-cscx-gray-300">Current size:</span>
        <span className="font-semibold text-white">
          {currentOption.label} ({currentOption.percentage})
        </span>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={decrease}
          disabled={!canDecrease}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
            canDecrease
              ? 'border-cscx-gray-700 text-white hover:bg-cscx-gray-800 hover:border-cscx-gray-600'
              : 'border-cscx-gray-800 text-cscx-gray-600 cursor-not-allowed'
          }`}
          aria-label="Decrease font size"
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
            Smaller
          </span>
        </button>

        <button
          onClick={reset}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-cscx-gray-700 text-white hover:bg-cscx-gray-800 hover:border-cscx-gray-600 transition-colors"
          aria-label="Reset font size to normal"
        >
          Reset
        </button>

        <button
          onClick={increase}
          disabled={!canIncrease}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
            canIncrease
              ? 'border-cscx-gray-700 text-white hover:bg-cscx-gray-800 hover:border-cscx-gray-600'
              : 'border-cscx-gray-800 text-cscx-gray-600 cursor-not-allowed'
          }`}
          aria-label="Increase font size"
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Larger
          </span>
        </button>
      </div>

      {/* Preset Options */}
      {!compact && (
        <div className="space-y-2 mb-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-cscx-accent">
            Size Presets
          </label>
          <div className="grid grid-cols-1 gap-2">
            {FONT_SIZE_OPTIONS.map((option) => (
              <button
                key={option.preset}
                onClick={() => handlePresetSelect(option.preset)}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  fontSize === option.preset
                    ? 'border-cscx-accent bg-cscx-accent/10 text-white'
                    : 'border-cscx-gray-800 hover:border-cscx-gray-700 text-cscx-gray-300 hover:text-white'
                }`}
                aria-pressed={fontSize === option.preset}
                aria-label={`Set font size to ${option.label} (${option.percentage})`}
              >
                <span className="flex items-center gap-3">
                  {/* Visual size indicator */}
                  <span
                    className="font-semibold"
                    style={{ fontSize: `${14 * option.scale}px` }}
                  >
                    Aa
                  </span>
                  <span className="text-sm">{option.label}</span>
                </span>
                <span className="flex items-center gap-2 text-sm">
                  <span className="text-cscx-gray-500">{option.percentage}</span>
                  {fontSize === option.preset && (
                    <svg className="w-4 h-4 text-cscx-accent" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preview Text */}
      {!compact && (
        <div className="p-4 bg-cscx-gray-900 rounded-lg border border-cscx-gray-800 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-cscx-accent mb-2">
            Preview
          </p>
          <p
            className="text-white"
            style={{ fontSize: `${16 * fontScale}px` }}
          >
            The quick brown fox jumps over the lazy dog.
          </p>
          <p
            className="text-cscx-gray-400 mt-1"
            style={{ fontSize: `${14 * fontScale}px` }}
          >
            This is how body text will appear throughout the application.
          </p>
        </div>
      )}

      {/* Keyboard Shortcuts */}
      {showShortcuts && !compact && (
        <div className="p-3 bg-cscx-gray-900/50 rounded-lg border border-cscx-gray-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-cscx-gray-400 mb-2">
            Keyboard Shortcuts
          </p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between text-cscx-gray-400">
              <span>Increase size</span>
              <kbd className="px-2 py-0.5 bg-cscx-gray-800 rounded text-xs font-mono">
                Ctrl + Plus
              </kbd>
            </div>
            <div className="flex items-center justify-between text-cscx-gray-400">
              <span>Decrease size</span>
              <kbd className="px-2 py-0.5 bg-cscx-gray-800 rounded text-xs font-mono">
                Ctrl + Minus
              </kbd>
            </div>
            <div className="flex items-center justify-between text-cscx-gray-400">
              <span>Reset to normal</span>
              <kbd className="px-2 py-0.5 bg-cscx-gray-800 rounded text-xs font-mono">
                Ctrl + 0
              </kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Compact font size control for headers/toolbars
 */
export const FontSizeControl: React.FC<{
  className?: string;
}> = ({ className = '' }) => {
  const {
    currentOption,
    increase,
    decrease,
    reset,
    canIncrease,
    canDecrease,
  } = useFontSize();

  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      role="group"
      aria-label="Font size controls"
    >
      <button
        onClick={decrease}
        disabled={!canDecrease}
        className={`p-1.5 rounded transition-colors ${
          canDecrease
            ? 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
            : 'text-cscx-gray-700 cursor-not-allowed'
        }`}
        aria-label="Decrease font size"
        title="Decrease font size (Ctrl+-)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
        </svg>
      </button>

      <button
        onClick={reset}
        className="px-2 py-1 text-xs font-medium text-cscx-gray-400 hover:text-white rounded hover:bg-cscx-gray-800 transition-colors"
        aria-label={`Current font size: ${currentOption.label}. Click to reset.`}
        title="Reset font size (Ctrl+0)"
      >
        {currentOption.percentage}
      </button>

      <button
        onClick={increase}
        disabled={!canIncrease}
        className={`p-1.5 rounded transition-colors ${
          canIncrease
            ? 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800'
            : 'text-cscx-gray-700 cursor-not-allowed'
        }`}
        aria-label="Increase font size"
        title="Increase font size (Ctrl++)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
        </svg>
      </button>
    </div>
  );
};

export default FontSettings;
