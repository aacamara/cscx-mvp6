/**
 * Agentic Mode Context
 * Provides shared state for agentic mode across components
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { agenticModeApi, AgenticModeSettings, AgenticPreset } from '../services/agenticModeApi';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface AgenticExecutionResult {
  success: boolean;
  status: string;
  message: string;
  stateId?: string;
  pendingApproval?: {
    toolName: string;
    toolInput: any;
    riskLevel: string;
    reason: string;
  };
  actions?: Array<{
    toolName: string;
    input: any;
    result: any;
  }>;
}

interface AgenticModeContextValue {
  isEnabled: boolean;
  settings: AgenticModeSettings | null;
  presets: Record<string, AgenticPreset>;
  loading: boolean;
  error: string | null;
  toggle: (enabled: boolean) => Promise<void>;
  applyPreset: (presetName: string) => Promise<void>;
  executeGoal: (goal: string, customerId?: string) => Promise<AgenticExecutionResult>;
  resumeExecution: (stateId: string, approved: boolean) => Promise<AgenticExecutionResult>;
  refresh: () => Promise<void>;
}

const AgenticModeContext = createContext<AgenticModeContextValue | null>(null);

interface AgenticModeProviderProps {
  children: ReactNode;
  userId?: string;
}

export const AgenticModeProvider: React.FC<AgenticModeProviderProps> = ({ children, userId }) => {
  const [settings, setSettings] = useState<AgenticModeSettings | null>(null);
  const [presets, setPresets] = useState<Record<string, AgenticPreset>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [settingsData, presetsData] = await Promise.all([
        agenticModeApi.getSettings(userId),
        agenticModeApi.getPresets(),
      ]);
      setSettings(settingsData);
      setPresets(presetsData);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch agentic mode data:', err);
      setError('Failed to load agentic mode settings');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggle = useCallback(async (enabled: boolean) => {
    try {
      const updatedSettings = await agenticModeApi.toggle(enabled, userId);
      setSettings(updatedSettings);
      console.log(`[AgenticMode] Toggled to: ${enabled}`);
    } catch (err) {
      console.error('Failed to toggle agentic mode:', err);
      setError('Failed to toggle mode');
      throw err;
    }
  }, [userId]);

  const applyPreset = useCallback(async (presetName: string) => {
    try {
      const updatedSettings = await agenticModeApi.applyPreset(presetName, userId);
      setSettings(updatedSettings);
      console.log(`[AgenticMode] Applied preset: ${presetName}`);
    } catch (err) {
      console.error('Failed to apply preset:', err);
      setError('Failed to apply preset');
      throw err;
    }
  }, [userId]);

  const executeGoal = useCallback(async (
    goal: string,
    customerId?: string
  ): Promise<AgenticExecutionResult> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userId) headers['x-user-id'] = userId;

    console.log(`[AgenticMode] Executing goal: "${goal.substring(0, 50)}..."`);

    const response = await fetch(`${API_URL}/api/agentic/execute`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ goal, customerId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to execute goal');
    }

    const result = await response.json();
    console.log(`[AgenticMode] Execution result:`, result.status);
    return result;
  }, [userId]);

  const resumeExecution = useCallback(async (
    stateId: string,
    approved: boolean
  ): Promise<AgenticExecutionResult> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userId) headers['x-user-id'] = userId;

    console.log(`[AgenticMode] Resuming execution, approved: ${approved}`);

    const response = await fetch(`${API_URL}/api/agentic/resume`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ stateId, approved }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to resume execution');
    }

    return response.json();
  }, [userId]);

  const isEnabled = settings?.config?.enabled ?? false;

  return (
    <AgenticModeContext.Provider value={{
      isEnabled,
      settings,
      presets,
      loading,
      error,
      toggle,
      applyPreset,
      executeGoal,
      resumeExecution,
      refresh: fetchData,
    }}>
      {children}
    </AgenticModeContext.Provider>
  );
};

export const useAgenticMode = (): AgenticModeContextValue => {
  const context = useContext(AgenticModeContext);
  if (!context) {
    throw new Error('useAgenticMode must be used within an AgenticModeProvider');
  }
  return context;
};

export default AgenticModeContext;
