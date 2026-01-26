/**
 * useAgenticMode Hook
 * Provides agentic mode status and execution functions
 */

import { useState, useEffect, useCallback } from 'react';
import { agenticModeApi, AgenticModeSettings } from '../services/agenticModeApi';

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

interface UseAgenticModeReturn {
  isEnabled: boolean;
  settings: AgenticModeSettings | null;
  loading: boolean;
  error: string | null;
  executeGoal: (goal: string, customerId?: string) => Promise<AgenticExecutionResult>;
  resumeExecution: (stateId: string, approved: boolean) => Promise<AgenticExecutionResult>;
  refresh: () => Promise<void>;
}

export function useAgenticMode(userId?: string): UseAgenticModeReturn {
  const [settings, setSettings] = useState<AgenticModeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await agenticModeApi.getSettings(userId);
      setSettings(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch agentic mode settings:', err);
      setError('Failed to load agentic mode settings');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const executeGoal = useCallback(async (
    goal: string,
    customerId?: string
  ): Promise<AgenticExecutionResult> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userId) headers['x-user-id'] = userId;

    const response = await fetch(`${API_URL}/api/agentic/execute`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ goal, customerId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to execute goal');
    }

    return response.json();
  }, [userId]);

  const resumeExecution = useCallback(async (
    stateId: string,
    approved: boolean
  ): Promise<AgenticExecutionResult> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userId) headers['x-user-id'] = userId;

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

  return {
    isEnabled: settings?.config?.enabled ?? false,
    settings,
    loading,
    error,
    executeGoal,
    resumeExecution,
    refresh: fetchSettings,
  };
}

export default useAgenticMode;
