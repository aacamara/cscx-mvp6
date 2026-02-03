/**
 * Voice Settings Component (PRD-264)
 *
 * Settings panel for configuring voice command preferences.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Types
// ============================================

interface VoiceSettings {
  voiceEnabled: boolean;
  continuousListening: boolean;
  speechRate: number;
  voiceResponseEnabled: boolean;
  summaryMode: boolean;
  confirmDestructiveActions: boolean;
  language: string;
}

interface VoiceSettingsProps {
  onSettingsChange?: (settings: VoiceSettings) => void;
  className?: string;
}

// ============================================
// Available Languages
// ============================================

const LANGUAGES = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'it-IT', name: 'Italian' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
];

// ============================================
// Component
// ============================================

export const VoiceSettings: React.FC<VoiceSettingsProps> = ({
  onSettingsChange,
  className = '',
}) => {
  const { getAuthHeaders } = useAuth();
  const [settings, setSettings] = useState<VoiceSettings>({
    voiceEnabled: true,
    continuousListening: false,
    speechRate: 1.0,
    voiceResponseEnabled: true,
    summaryMode: false,
    confirmDestructiveActions: true,
    language: 'en-US',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testVoiceText, setTestVoiceText] = useState('');

  // ============================================
  // Load Settings
  // ============================================

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/voice/settings`, {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to load voice settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // Save Settings
  // ============================================

  const saveSettings = async (newSettings: Partial<VoiceSettings>) => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_URL}/api/voice/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(newSettings),
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        onSettingsChange?.(data.settings);
        setMessage({ type: 'success', text: 'Settings saved' });
        setTimeout(() => setMessage(null), 2000);
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Failed to save voice settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // Handlers
  // ============================================

  const handleToggle = (key: keyof VoiceSettings) => {
    const newValue = !settings[key];
    setSettings({ ...settings, [key]: newValue });
    saveSettings({ [key]: newValue });
  };

  const handleSpeechRateChange = (value: number) => {
    setSettings({ ...settings, speechRate: value });
    saveSettings({ speechRate: value });
  };

  const handleLanguageChange = (value: string) => {
    setSettings({ ...settings, language: value });
    saveSettings({ language: value });
  };

  const testVoice = () => {
    const text = testVoiceText || 'Hello! This is how your voice responses will sound.';
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = settings.speechRate;
    utterance.lang = settings.language;
    window.speechSynthesis.speak(utterance);
  };

  // ============================================
  // Render
  // ============================================

  if (isLoading) {
    return (
      <div className={`p-4 bg-cscx-gray-900 rounded-xl ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-cscx-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-cscx-gray-900 rounded-xl border border-cscx-gray-800 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-cscx-gray-800">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-cscx-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          Voice Settings
        </h3>
        <p className="text-sm text-cscx-gray-400 mt-1">
          Configure how voice commands work on your device
        </p>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`mx-4 mt-4 p-2 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-green-900/30 text-green-400 border border-green-600/30'
            : 'bg-red-900/30 text-red-400 border border-red-600/30'
        }`}>
          {message.text}
        </div>
      )}

      {/* Settings List */}
      <div className="divide-y divide-cscx-gray-800">
        {/* Voice Enabled */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-white font-medium">Voice Commands</p>
            <p className="text-sm text-cscx-gray-400">Enable voice command processing</p>
          </div>
          <Toggle
            enabled={settings.voiceEnabled}
            onChange={() => handleToggle('voiceEnabled')}
            disabled={isSaving}
          />
        </div>

        {/* Voice Response */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-white font-medium">Voice Responses</p>
            <p className="text-sm text-cscx-gray-400">Read responses aloud using text-to-speech</p>
          </div>
          <Toggle
            enabled={settings.voiceResponseEnabled}
            onChange={() => handleToggle('voiceResponseEnabled')}
            disabled={isSaving}
          />
        </div>

        {/* Continuous Listening */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-white font-medium">Continuous Listening</p>
            <p className="text-sm text-cscx-gray-400">Keep listening after each command</p>
          </div>
          <Toggle
            enabled={settings.continuousListening}
            onChange={() => handleToggle('continuousListening')}
            disabled={isSaving}
          />
        </div>

        {/* Confirm Actions */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-white font-medium">Confirm Actions</p>
            <p className="text-sm text-cscx-gray-400">Ask before sending emails or booking meetings</p>
          </div>
          <Toggle
            enabled={settings.confirmDestructiveActions}
            onChange={() => handleToggle('confirmDestructiveActions')}
            disabled={isSaving}
          />
        </div>

        {/* Summary Mode */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-white font-medium">Summary Mode</p>
            <p className="text-sm text-cscx-gray-400">Shorten long responses for voice output</p>
          </div>
          <Toggle
            enabled={settings.summaryMode}
            onChange={() => handleToggle('summaryMode')}
            disabled={isSaving}
          />
        </div>

        {/* Speech Rate */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white font-medium">Speech Rate</p>
              <p className="text-sm text-cscx-gray-400">How fast responses are spoken</p>
            </div>
            <span className="text-cscx-accent font-medium">{settings.speechRate.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={settings.speechRate}
            onChange={(e) => handleSpeechRateChange(parseFloat(e.target.value))}
            disabled={isSaving}
            className="w-full h-2 bg-cscx-gray-700 rounded-lg appearance-none cursor-pointer accent-cscx-accent"
          />
          <div className="flex justify-between text-xs text-cscx-gray-500 mt-1">
            <span>Slower</span>
            <span>Normal</span>
            <span>Faster</span>
          </div>
        </div>

        {/* Language */}
        <div className="p-4">
          <div className="mb-2">
            <p className="text-white font-medium">Language</p>
            <p className="text-sm text-cscx-gray-400">Voice recognition and response language</p>
          </div>
          <select
            value={settings.language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            disabled={isSaving}
            className="w-full bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cscx-accent"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Test Voice */}
        <div className="p-4">
          <div className="mb-2">
            <p className="text-white font-medium">Test Voice</p>
            <p className="text-sm text-cscx-gray-400">Preview how responses will sound</p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={testVoiceText}
              onChange={(e) => setTestVoiceText(e.target.value)}
              placeholder="Enter text to test..."
              className="flex-1 bg-cscx-gray-800 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-cscx-gray-500 focus:outline-none focus:border-cscx-accent"
            />
            <button
              onClick={testVoice}
              disabled={isSaving}
              className="px-4 py-2 bg-cscx-accent hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Test
            </button>
          </div>
        </div>
      </div>

      {/* Available Commands */}
      <div className="p-4 border-t border-cscx-gray-800">
        <h4 className="text-white font-medium mb-3">Available Commands</h4>
        <div className="grid gap-2">
          <CommandExample icon="arrow" pattern="Go to [customer]" description="Navigate to customer" />
          <CommandExample icon="info" pattern="Tell me about [customer]" description="Get customer summary" />
          <CommandExample icon="mail" pattern="Draft email to [customer]" description="Start email draft" />
          <CommandExample icon="calendar" pattern="Schedule meeting with [customer]" description="Book meeting" />
          <CommandExample icon="tasks" pattern="Show my tasks" description="View all tasks" />
          <CommandExample icon="health" pattern="What is the health score for [customer]" description="Check health" />
        </div>
      </div>
    </div>
  );
};

// ============================================
// Toggle Component
// ============================================

interface ToggleProps {
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({ enabled, onChange, disabled }) => (
  <button
    onClick={onChange}
    disabled={disabled}
    className={`
      relative inline-flex h-6 w-11 items-center rounded-full transition-colors
      ${enabled ? 'bg-cscx-accent' : 'bg-cscx-gray-700'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    `}
    role="switch"
    aria-checked={enabled}
  >
    <span
      className={`
        inline-block h-4 w-4 rounded-full bg-white transition-transform
        ${enabled ? 'translate-x-6' : 'translate-x-1'}
      `}
    />
  </button>
);

// ============================================
// Command Example Component
// ============================================

interface CommandExampleProps {
  icon: 'arrow' | 'info' | 'mail' | 'calendar' | 'tasks' | 'health';
  pattern: string;
  description: string;
}

const CommandExample: React.FC<CommandExampleProps> = ({ icon, pattern, description }) => {
  const icons = {
    arrow: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    ),
    info: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    mail: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    ),
    calendar: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    ),
    tasks: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    ),
    health: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    ),
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-cscx-gray-800/50">
      <div className="w-8 h-8 rounded-lg bg-cscx-gray-700 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-cscx-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icons[icon]}
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">&quot;{pattern}&quot;</p>
        <p className="text-xs text-cscx-gray-500">{description}</p>
      </div>
    </div>
  );
};

export default VoiceSettings;
