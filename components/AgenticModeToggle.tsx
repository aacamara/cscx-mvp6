/**
 * Agentic Mode Toggle Component
 * Allows CSMs to toggle between manual and agentic modes
 * Now uses shared AgenticModeContext for state synchronization
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAgenticMode } from '../context/AgenticModeContext';
import { agenticModeApi } from '../services/agenticModeApi';

interface AgenticModeToggleProps {
  userId?: string;
  compact?: boolean;
  onModeChange?: (enabled: boolean) => void;
}

interface ScheduleForm {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}

export const AgenticModeToggle: React.FC<AgenticModeToggleProps> = ({
  userId,
  compact = false,
  onModeChange,
}) => {
  // Use shared context for settings
  const { isEnabled, settings, presets, loading, error: contextError, toggle, applyPreset } = useAgenticMode();
  const [localError, setLocalError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>({
    startDate: '',
    endDate: '',
    startTime: '09:00',
    endTime: '17:00',
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const error = localError || contextError;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = async () => {
    if (!settings) return;

    try {
      const newEnabled = !isEnabled;
      await toggle(newEnabled);
      onModeChange?.(newEnabled);
      setLocalError(null);
    } catch (err) {
      console.error('Failed to toggle agentic mode:', err);
      setLocalError('Failed to toggle mode');
    }
  };

  const handlePresetSelect = async (presetName: string) => {
    try {
      await applyPreset(presetName);
      setShowDropdown(false);
      // Get the new enabled state after preset is applied
      onModeChange?.(presetName !== 'manual');
      setLocalError(null);
    } catch (err) {
      console.error('Failed to apply preset:', err);
      setLocalError('Failed to apply preset');
    }
  };

  const handleScheduleSave = async () => {
    try {
      if (!scheduleForm.startDate || !scheduleForm.endDate) {
        setLocalError('Please select start and end dates');
        return;
      }

      const schedule = {
        startTime: `${scheduleForm.startDate}T${scheduleForm.startTime}:00`,
        endTime: `${scheduleForm.endDate}T${scheduleForm.endTime}:00`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      await agenticModeApi.setSchedule(schedule, userId);
      setShowScheduler(false);
      setLocalError(null);
    } catch (err) {
      console.error('Failed to set schedule:', err);
      setLocalError('Failed to set schedule');
    }
  };

  const handleClearSchedule = async () => {
    try {
      await agenticModeApi.setSchedule(null, userId);
      setScheduleForm({ startDate: '', endDate: '', startTime: '09:00', endTime: '17:00' });
      setLocalError(null);
    } catch (err) {
      console.error('Failed to clear schedule:', err);
      setLocalError('Failed to clear schedule');
    }
  };

  const formatScheduleDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getPresetLabel = (preset: string | null): string => {
    if (!preset) return 'Manual';
    return preset.charAt(0).toUpperCase() + preset.slice(1);
  };

  const getStatusColor = (): string => {
    if (!isEnabled) return 'bg-gray-500';
    switch (settings.preset) {
      case 'vacation':
        return 'bg-blue-500';
      case 'supervised':
        return 'bg-yellow-500';
      case 'autonomous':
        return 'bg-green-500';
      default:
        return 'bg-cscx-accent';
    }
  };

  const getAutoApproveLevelLabel = (level: string): string => {
    switch (level) {
      case 'none':
        return 'Manual approval for all';
      case 'low_risk':
        return 'Auto-approve low-risk';
      case 'all':
        return 'Auto-approve all (except critical)';
      default:
        return level;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-cscx-gray-800 rounded-lg animate-pulse">
        <div className="w-3 h-3 rounded-full bg-cscx-gray-600" />
        <span className="text-xs text-cscx-gray-500">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/30 border border-red-600/50 rounded-lg">
        <span className="text-xs text-red-400">{error}</span>
      </div>
    );
  }

  // Ensure settings and config are fully loaded
  if (!settings || !settings.config) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-cscx-gray-800 rounded-lg">
        <div className="w-3 h-3 rounded-full bg-gray-500" />
        <span className="text-xs text-cscx-gray-400">Manual Mode</span>
      </div>
    );
  }

  if (compact) {
    return (
      <button
        onClick={handleToggle}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
          isEnabled
            ? 'bg-cscx-accent/20 border border-cscx-accent/50 hover:bg-cscx-accent/30'
            : 'bg-cscx-gray-800 border border-cscx-gray-700 hover:bg-cscx-gray-700'
        }`}
        title={isEnabled ? 'Agentic Mode: ON' : 'Agentic Mode: OFF'}
      >
        <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-cscx-accent animate-pulse' : 'bg-gray-500'}`} />
        <span className="text-xs font-medium">
          {isEnabled ? 'Agentic' : 'Manual'}
        </span>
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Main Toggle Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${
          isEnabled
            ? 'bg-cscx-accent/20 border border-cscx-accent/50 hover:bg-cscx-accent/30'
            : 'bg-cscx-gray-800 border border-cscx-gray-700 hover:bg-cscx-gray-700'
        }`}
      >
        {/* Status Indicator */}
        <span className={`w-3 h-3 rounded-full ${getStatusColor()} ${isEnabled ? 'animate-pulse' : ''}`} />

        {/* Label */}
        <div className="text-left">
          <div className="text-sm font-medium text-white">
            {isEnabled ? 'Agentic Mode' : 'Manual Mode'}
          </div>
          <div className="text-xs text-cscx-gray-400">
            {isEnabled
              ? `${getPresetLabel(settings.preset)} • ${settings.config.maxSteps} max steps`
              : 'Click to enable autonomous actions'}
          </div>
        </div>

        {/* Dropdown Arrow */}
        <svg
          className={`w-4 h-4 text-cscx-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-cscx-gray-900 border border-cscx-gray-700 rounded-lg shadow-xl z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-cscx-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">Agentic Mode Settings</span>
              <button
                onClick={handleToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isEnabled ? 'bg-cscx-accent' : 'bg-cscx-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-cscx-gray-400 mt-1">
              When enabled, agents can execute actions autonomously based on your settings.
            </p>
          </div>

          {/* Presets */}
          <div className="p-2">
            <div className="text-xs font-medium text-cscx-gray-400 px-2 py-1">Quick Presets</div>
            {Object.entries(presets).map(([name, preset]) => (
              <button
                key={name}
                onClick={() => handlePresetSelect(name)}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  settings?.preset === name
                    ? 'bg-cscx-accent/20 text-cscx-accent'
                    : 'hover:bg-cscx-gray-800 text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      {name === 'manual' && '🎛️'}
                      {name === 'vacation' && '🏖️'}
                      {name === 'supervised' && '👀'}
                      {name === 'autonomous' && '🚀'}
                      {preset.name}
                    </div>
                    <div className="text-xs text-cscx-gray-400">{preset.description}</div>
                  </div>
                  {settings?.preset === name && (
                    <svg className="w-4 h-4 text-cscx-accent" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Current Config Summary */}
          {isEnabled && (
            <div className="px-4 py-3 border-t border-cscx-gray-700 bg-cscx-gray-800/50">
              <div className="text-xs font-medium text-cscx-gray-400 mb-2">Current Configuration</div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-cscx-gray-400">Auto-Approve:</span>
                  <span className="text-white">{getAutoApproveLevelLabel(settings.config.autoApproveLevel)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-cscx-gray-400">Max Steps:</span>
                  <span className="text-white">{settings.config.maxSteps}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-cscx-gray-400">Pause on High-Risk:</span>
                  <span className={settings.config.pauseOnHighRisk ? 'text-green-400' : 'text-yellow-400'}>
                    {settings.config.pauseOnHighRisk ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Schedule Section */}
          <div className="px-4 py-3 border-t border-cscx-gray-700">
            {!showScheduler ? (
              <>
                {settings?.schedule?.startTime ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-cscx-gray-400">Scheduled Agentic Mode</div>
                      <button
                        onClick={handleClearSchedule}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white">
                      <span>📅</span>
                      <span>
                        {formatScheduleDate(settings.schedule.startTime)} - {formatScheduleDate(settings.schedule.endTime)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowScheduler(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-cscx-gray-400 hover:text-white border border-dashed border-cscx-gray-600 hover:border-cscx-gray-500 rounded-lg transition-colors"
                  >
                    <span>📅</span>
                    <span>Schedule vacation mode</span>
                  </button>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-white">Schedule Agentic Mode</div>
                  <button
                    onClick={() => setShowScheduler(false)}
                    className="text-xs text-cscx-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-cscx-gray-400 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={scheduleForm.startDate}
                      onChange={(e) => setScheduleForm(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm bg-cscx-gray-800 border border-cscx-gray-600 rounded text-white focus:border-cscx-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-cscx-gray-400 mb-1">End Date</label>
                    <input
                      type="date"
                      value={scheduleForm.endDate}
                      onChange={(e) => setScheduleForm(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm bg-cscx-gray-800 border border-cscx-gray-600 rounded text-white focus:border-cscx-accent focus:outline-none"
                    />
                  </div>
                </div>

                {/* Time Range */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-cscx-gray-400 mb-1">Active From</label>
                    <input
                      type="time"
                      value={scheduleForm.startTime}
                      onChange={(e) => setScheduleForm(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm bg-cscx-gray-800 border border-cscx-gray-600 rounded text-white focus:border-cscx-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-cscx-gray-400 mb-1">Active Until</label>
                    <input
                      type="time"
                      value={scheduleForm.endTime}
                      onChange={(e) => setScheduleForm(prev => ({ ...prev, endTime: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm bg-cscx-gray-800 border border-cscx-gray-600 rounded text-white focus:border-cscx-accent focus:outline-none"
                    />
                  </div>
                </div>

                <p className="text-xs text-cscx-gray-500">
                  During this period, agentic mode will be enabled with "Vacation" settings.
                </p>

                <button
                  onClick={handleScheduleSave}
                  className="w-full px-3 py-2 text-sm font-medium bg-cscx-accent hover:bg-cscx-accent/80 text-white rounded-lg transition-colors"
                >
                  Save Schedule
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgenticModeToggle;
