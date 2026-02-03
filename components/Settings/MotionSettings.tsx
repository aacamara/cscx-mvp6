/**
 * Motion Settings Component
 * PRD-275: Reduced Motion Option
 *
 * UI for managing motion/animation preferences with:
 * - 4 motion levels (full, partial, reduced, none)
 * - System preference respect/override
 * - Visual preview of current setting
 */

import React, { useState } from 'react';
import { useReducedMotion, MOTION_LEVELS, MotionPreference } from '../../hooks/useReducedMotion';

interface MotionSettingsProps {
  onClose?: () => void;
  compact?: boolean;
}

export function MotionSettings({ onClose, compact = false }: MotionSettingsProps) {
  const {
    motionPreference,
    prefersReducedMotion,
    effectiveMotionLevel,
    isLoading,
    error,
    setMotionPreference,
    resetToSystem,
    announce,
  } = useReducedMotion();

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Handle motion level change
  const handleMotionChange = async (level: MotionPreference) => {
    try {
      setSaving(true);
      await setMotionPreference(level);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to change motion preference:', err);
    } finally {
      setSaving(false);
    }
  };

  // Handle reset
  const handleReset = async () => {
    try {
      setSaving(true);
      await resetToSystem();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to reset motion preference:', err);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="rounded-full h-6 w-6 border-2 border-cscx-accent border-t-transparent"
             style={{ animation: 'none' }}>
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  // Compact mode for quick toggle
  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium hc-text">Motion Preference</span>
          <div className="flex gap-1">
            {(['full', 'reduced', 'none'] as MotionPreference[]).map((level) => (
              <button
                key={level}
                onClick={() => handleMotionChange(level)}
                disabled={saving}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  effectiveMotionLevel === level
                    ? 'bg-cscx-accent text-white'
                    : 'bg-cscx-gray-800 text-cscx-gray-300 hover:bg-cscx-gray-700 hc-bg hc-text hc-border'
                }`}
                aria-pressed={effectiveMotionLevel === level}
              >
                {level === 'full' ? 'Full' : level === 'reduced' ? 'Reduced' : 'None'}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-cscx-gray-400 hc-text-muted">
          System preference: {prefersReducedMotion ? 'Reduced motion' : 'Full motion'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold hc-text">Motion Settings</h2>
          <p className="text-sm text-cscx-gray-400 hc-text-muted">
            Control animations and transitions
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-cscx-gray-400 hover:text-white rounded-lg hc-text"
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
          Motion settings saved
        </div>
      )}

      {/* System Preference Status */}
      <div className="p-4 rounded-lg bg-cscx-gray-800/50 border border-cscx-gray-700 hc-bg hc-border">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            prefersReducedMotion ? 'bg-cscx-warning' : 'bg-cscx-success'
          }`} />
          <div>
            <p className="text-sm font-medium hc-text">
              System Preference: {prefersReducedMotion ? 'Reduced Motion' : 'Full Motion'}
            </p>
            <p className="text-xs text-cscx-gray-400 hc-text-muted">
              {prefersReducedMotion
                ? 'Your OS prefers reduced motion. We respect this by default.'
                : 'Your OS has no motion preference set.'}
            </p>
          </div>
        </div>
      </div>

      {/* Motion Levels */}
      <div className="space-y-3">
        <label className="block text-sm font-medium hc-text">
          Motion Level
        </label>
        <div className="grid gap-3">
          {MOTION_LEVELS.map((level) => (
            <MotionLevelButton
              key={level.id}
              level={level}
              isSelected={motionPreference === level.id}
              isEffective={effectiveMotionLevel === level.id && motionPreference === 'system'}
              onClick={() => handleMotionChange(level.id)}
              disabled={saving}
              prefersReducedMotion={prefersReducedMotion}
            />
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-3">
        <label className="block text-sm font-medium hc-text">
          Preview
        </label>
        <MotionPreview effectiveLevel={effectiveMotionLevel} />
      </div>

      {/* Current Setting Summary */}
      <div className="p-4 rounded-lg bg-cscx-gray-900 border border-cscx-gray-800 hc-bg hc-border">
        <h3 className="text-sm font-medium mb-2 hc-text">Current Setting</h3>
        <div className="text-xs text-cscx-gray-400 hc-text-muted space-y-1">
          <p><strong>User Preference:</strong> {motionPreference === 'system' ? 'Follow System' : motionPreference}</p>
          <p><strong>Effective Level:</strong> {effectiveMotionLevel}</p>
          <p><strong>Animations:</strong> {
            effectiveMotionLevel === 'full' ? 'All enabled' :
            effectiveMotionLevel === 'partial' ? 'Subtle only (150ms max)' :
            effectiveMotionLevel === 'reduced' ? 'Minimal (50ms)' :
            'Disabled'
          }</p>
        </div>
      </div>

      {/* Reset Button */}
      <div className="pt-4 border-t border-cscx-gray-800 hc-border">
        <button
          onClick={handleReset}
          disabled={saving || motionPreference === 'system'}
          className={`w-full px-4 py-2 text-sm rounded-lg transition-colors ${
            motionPreference === 'system'
              ? 'text-cscx-gray-500 cursor-not-allowed'
              : 'text-cscx-gray-400 hover:text-white hover:bg-cscx-gray-800 hc-text hc-border'
          }`}
        >
          Reset to System Default
        </button>
      </div>
    </div>
  );
}

// Motion level button component
function MotionLevelButton({
  level,
  isSelected,
  isEffective,
  onClick,
  disabled,
  prefersReducedMotion,
}: {
  level: typeof MOTION_LEVELS[number];
  isSelected: boolean;
  isEffective: boolean;
  onClick: () => void;
  disabled: boolean;
  prefersReducedMotion: boolean;
}) {
  // Show what system preference maps to
  const systemNote = level.id === 'system'
    ? ` (currently ${prefersReducedMotion ? 'reduced' : 'full'})`
    : '';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-4 rounded-lg border-2 text-left transition-colors ${
        isSelected
          ? 'border-cscx-accent ring-2 ring-cscx-accent/30 bg-cscx-accent/10'
          : isEffective
          ? 'border-cscx-gray-600 bg-cscx-gray-800/50'
          : 'border-cscx-gray-700 hover:border-cscx-gray-600 hc-border'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      aria-pressed={isSelected}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium hc-text">
            {level.label}
            {systemNote}
          </p>
          <p className="text-xs text-cscx-gray-400 hc-text-muted mt-1">
            {level.description}
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-cscx-gray-500 hc-text-muted">
            {level.animationDuration}
          </span>
          {isSelected && (
            <div className="mt-1">
              <svg className="w-5 h-5 text-cscx-accent" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// Motion preview component
function MotionPreview({ effectiveLevel }: { effectiveLevel: string }) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handlePreview = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 1000);
  };

  // Get animation duration based on level
  const getDuration = () => {
    switch (effectiveLevel) {
      case 'full': return '300ms';
      case 'partial': return '150ms';
      case 'reduced': return '50ms';
      case 'none': return '0ms';
      default: return '300ms';
    }
  };

  return (
    <div className="p-4 rounded-lg bg-cscx-gray-800/50 border border-cscx-gray-700 hc-bg hc-border">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm hc-text">Animation Preview</p>
        <button
          onClick={handlePreview}
          className="px-3 py-1 text-xs bg-cscx-accent text-white rounded-md hover:opacity-90"
        >
          Test Animation
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Slide animation */}
        <div className="text-center">
          <div className="h-16 bg-cscx-gray-700 rounded-lg overflow-hidden mb-2">
            <div
              className="h-full w-1/2 bg-cscx-accent rounded-lg"
              style={{
                transform: isAnimating ? 'translateX(100%)' : 'translateX(0)',
                transition: effectiveLevel === 'none' ? 'none' : `transform ${getDuration()} ease-out`,
              }}
            />
          </div>
          <p className="text-xs text-cscx-gray-400 hc-text-muted">Slide</p>
        </div>

        {/* Fade animation */}
        <div className="text-center">
          <div className="h-16 bg-cscx-gray-700 rounded-lg overflow-hidden mb-2 flex items-center justify-center">
            <div
              className="w-8 h-8 bg-cscx-accent rounded-full"
              style={{
                opacity: isAnimating ? 0 : 1,
                transition: effectiveLevel === 'none' ? 'none' : `opacity ${getDuration()} ease-out`,
              }}
            />
          </div>
          <p className="text-xs text-cscx-gray-400 hc-text-muted">Fade</p>
        </div>

        {/* Scale animation */}
        <div className="text-center">
          <div className="h-16 bg-cscx-gray-700 rounded-lg overflow-hidden mb-2 flex items-center justify-center">
            <div
              className="w-8 h-8 bg-cscx-accent rounded-lg"
              style={{
                transform: isAnimating ? 'scale(1.5)' : 'scale(1)',
                transition: effectiveLevel === 'none' ? 'none' : `transform ${getDuration()} ease-out`,
              }}
            />
          </div>
          <p className="text-xs text-cscx-gray-400 hc-text-muted">Scale</p>
        </div>
      </div>

      {/* Loading indicator example */}
      <div className="mt-4 pt-4 border-t border-cscx-gray-700">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div
              className="w-6 h-6 border-2 border-cscx-accent border-t-transparent rounded-full mx-auto"
              style={{
                animation: effectiveLevel === 'none' || effectiveLevel === 'reduced'
                  ? 'none'
                  : 'spin 1s linear infinite',
              }}
            />
            <p className="text-xs text-cscx-gray-400 mt-2 hc-text-muted">Spinner</p>
          </div>
          {(effectiveLevel === 'none' || effectiveLevel === 'reduced') && (
            <p className="text-xs text-cscx-warning">
              Continuous animations are replaced with static indicators
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default MotionSettings;
