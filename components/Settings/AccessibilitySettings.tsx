/**
 * Accessibility Settings Component - PRD-273 High Contrast Mode
 * UI for managing high contrast mode and other accessibility preferences
 */

import React, { useState } from 'react';
import { useAccessibility } from '../../hooks/useAccessibility';
import { ContrastMode } from '../../context/ThemeContext';

interface AccessibilitySettingsProps {
  onClose?: () => void;
  compact?: boolean;
}

export function AccessibilitySettings({ onClose, compact = false }: AccessibilitySettingsProps) {
  const {
    preferences,
    updatePreferences,
    resetPreferences,
    loading,
    error,
    contrastMode,
    setContrastMode,
    announce,
  } = useAccessibility();

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Handle contrast mode change
  const handleContrastChange = async (mode: ContrastMode) => {
    try {
      setSaving(true);
      setContrastMode(mode);
      announce(`Contrast mode changed to ${getContrastModeLabel(mode)}`);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to change contrast mode:', err);
    } finally {
      setSaving(false);
    }
  };

  // Handle font size change
  const handleFontSizeChange = async (size: 'normal' | 'large' | 'x-large') => {
    try {
      setSaving(true);
      await updatePreferences({ fontSize: size });
      announce(`Font size changed to ${size}`);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to change font size:', err);
    } finally {
      setSaving(false);
    }
  };

  // Handle toggle changes
  const handleToggle = async (key: keyof typeof preferences, value: boolean) => {
    try {
      setSaving(true);
      await updatePreferences({ [key]: value });
      announce(`${key} ${value ? 'enabled' : 'disabled'}`);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error(`Failed to toggle ${key}:`, err);
    } finally {
      setSaving(false);
    }
  };

  // Reset all settings
  const handleReset = async () => {
    try {
      setSaving(true);
      await resetPreferences();
      announce('Accessibility settings reset to defaults');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to reset preferences:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-cscx-accent border-t-transparent" />
      </div>
    );
  }

  // Compact mode for quick toggle
  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium hc-text">High Contrast Mode</span>
          <div className="flex gap-1">
            {(['normal', 'high-light', 'high-dark'] as ContrastMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => handleContrastChange(mode)}
                disabled={saving}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  contrastMode === mode
                    ? 'bg-cscx-accent text-white'
                    : 'bg-cscx-gray-800 text-cscx-gray-300 hover:bg-cscx-gray-700 hc-bg hc-text hc-border'
                }`}
                aria-pressed={contrastMode === mode}
              >
                {getContrastModeLabel(mode)}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-cscx-gray-400 hc-text-muted">
          Press <kbd className="px-1 py-0.5 bg-cscx-gray-800 rounded text-cscx-gray-300 hc-bg hc-text">Ctrl+Shift+H</kbd> to toggle
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold hc-text">Accessibility Settings</h2>
          <p className="text-sm text-cscx-gray-400 hc-text-muted">
            Customize display for better visibility
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-cscx-gray-400 hover:text-white rounded-lg transition-colors hc-text"
            aria-label="Close settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm" role="alert">
          {error}
        </div>
      )}

      {/* Success message */}
      {saveSuccess && (
        <div className="p-3 bg-green-500/20 border border-green-500 rounded-lg text-green-400 text-sm" role="status">
          Settings saved successfully
        </div>
      )}

      {/* Contrast Mode */}
      <div className="space-y-3">
        <label className="block text-sm font-medium hc-text">
          Contrast Mode
        </label>
        <div className="grid grid-cols-3 gap-2">
          <ContrastModeButton
            mode="normal"
            current={contrastMode}
            onClick={handleContrastChange}
            disabled={saving}
            label="Normal"
            description="Default colors"
          />
          <ContrastModeButton
            mode="high-light"
            current={contrastMode}
            onClick={handleContrastChange}
            disabled={saving}
            label="High Contrast Light"
            description="Black on white"
          />
          <ContrastModeButton
            mode="high-dark"
            current={contrastMode}
            onClick={handleContrastChange}
            disabled={saving}
            label="High Contrast Dark"
            description="White on black"
          />
        </div>
        <p className="text-xs text-cscx-gray-400 hc-text-muted">
          Keyboard shortcut: <kbd className="px-1 py-0.5 bg-cscx-gray-800 rounded hc-bg hc-text">Ctrl+Shift+H</kbd>
        </p>
      </div>

      {/* Contrast Preview */}
      <div className="p-4 rounded-lg border hc-bg hc-border">
        <h3 className="font-medium mb-2 hc-text">Preview</h3>
        <p className="text-sm hc-text-muted mb-3">
          This is how text will appear with the current contrast settings.
        </p>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 rounded hc-btn-primary text-sm">
            Primary Button
          </button>
          <button className="px-3 py-1.5 rounded hc-btn-secondary text-sm hc-border">
            Secondary Button
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <span className="px-2 py-1 rounded text-xs hc-success-bg hc-success-text">Success</span>
          <span className="px-2 py-1 rounded text-xs hc-warning-bg hc-warning-text">Warning</span>
          <span className="px-2 py-1 rounded text-xs hc-error-bg hc-error-text">Error</span>
        </div>
      </div>

      {/* Font Size */}
      <div className="space-y-3">
        <label className="block text-sm font-medium hc-text">
          Font Size
        </label>
        <div className="flex gap-2">
          {(['normal', 'large', 'x-large'] as const).map((size) => (
            <button
              key={size}
              onClick={() => handleFontSizeChange(size)}
              disabled={saving}
              className={`px-4 py-2 rounded-lg transition-colors ${
                preferences.fontSize === size
                  ? 'bg-cscx-accent text-white'
                  : 'bg-cscx-gray-800 text-cscx-gray-300 hover:bg-cscx-gray-700 hc-bg hc-text hc-border'
              }`}
              aria-pressed={preferences.fontSize === size}
            >
              <span className={size === 'large' ? 'text-lg' : size === 'x-large' ? 'text-xl' : ''}>
                {size === 'normal' ? 'A' : size === 'large' ? 'A' : 'A'}
              </span>
              <span className="ml-2 text-xs opacity-75">{size}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Additional Options */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium hc-text">Additional Options</h3>

        {/* Enhanced Focus Indicators */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm hc-text">Enhanced Focus Indicators</p>
            <p className="text-xs text-cscx-gray-400 hc-text-muted">
              Larger, more visible focus outlines
            </p>
          </div>
          <ToggleSwitch
            checked={preferences.focusIndicatorEnhanced}
            onChange={(checked) => handleToggle('focusIndicatorEnhanced', checked)}
            disabled={saving}
            label="Enhanced focus indicators"
          />
        </div>

        {/* Reduced Motion */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm hc-text">Reduced Motion</p>
            <p className="text-xs text-cscx-gray-400 hc-text-muted">
              Minimize animations and transitions
            </p>
          </div>
          <ToggleSwitch
            checked={preferences.reducedMotion}
            onChange={(checked) => handleToggle('reducedMotion', checked)}
            disabled={saving}
            label="Reduced motion"
          />
        </div>

        {/* Screen Reader Optimized */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm hc-text">Screen Reader Optimized</p>
            <p className="text-xs text-cscx-gray-400 hc-text-muted">
              Enhanced ARIA labels and descriptions
            </p>
          </div>
          <ToggleSwitch
            checked={preferences.screenReaderOptimized}
            onChange={(checked) => handleToggle('screenReaderOptimized', checked)}
            disabled={saving}
            label="Screen reader optimized"
          />
        </div>
      </div>

      {/* Reset Button */}
      <div className="pt-4 border-t border-cscx-gray-800 hc-border">
        <button
          onClick={handleReset}
          disabled={saving}
          className="w-full px-4 py-2 text-sm text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800 rounded-lg transition-colors hc-text hc-border"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}

// Contrast mode button component
function ContrastModeButton({
  mode,
  current,
  onClick,
  disabled,
  label,
  description,
}: {
  mode: ContrastMode;
  current: ContrastMode;
  onClick: (mode: ContrastMode) => void;
  disabled: boolean;
  label: string;
  description: string;
}) {
  const isSelected = current === mode;

  // Preview colors
  const getPreviewClasses = () => {
    switch (mode) {
      case 'high-light':
        return 'bg-white text-black border-black';
      case 'high-dark':
        return 'bg-black text-white border-white';
      default:
        return 'bg-cscx-gray-900 text-white border-cscx-gray-700';
    }
  };

  return (
    <button
      onClick={() => onClick(mode)}
      disabled={disabled}
      className={`p-3 rounded-lg border-2 transition-all text-left ${
        isSelected
          ? 'border-cscx-accent ring-2 ring-cscx-accent/30'
          : 'border-cscx-gray-700 hover:border-cscx-gray-600 hc-border'
      }`}
      aria-pressed={isSelected}
    >
      <div className={`h-8 mb-2 rounded border ${getPreviewClasses()}`}>
        <span className="text-xs px-1">Aa</span>
      </div>
      <p className="text-xs font-medium hc-text">{label}</p>
      <p className="text-xs text-cscx-gray-400 hc-text-muted">{description}</p>
    </button>
  );
}

// Toggle switch component
function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? 'bg-cscx-accent' : 'bg-cscx-gray-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// Helper function
function getContrastModeLabel(mode: ContrastMode): string {
  switch (mode) {
    case 'high-light':
      return 'Light';
    case 'high-dark':
      return 'Dark';
    default:
      return 'Normal';
  }
}

export default AccessibilitySettings;
