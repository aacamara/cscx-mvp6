/**
 * Agentic Mode API Service
 * Connects frontend to agentic mode settings on the backend
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface AgenticModeConfig {
  enabled: boolean;
  maxSteps: number;
  autoApproveLevel: 'none' | 'low_risk' | 'all';
  pauseOnHighRisk: boolean;
  notifyOnCompletion: boolean;
}

export interface AgenticModeSettings {
  config: AgenticModeConfig;
  preset: string | null;
  schedule: {
    startTime: string | null;
    endTime: string | null;
    timezone: string;
  } | null;
  lastUpdated: string;
}

export interface AgenticPreset {
  name: string;
  description: string;
  config: AgenticModeConfig;
}

class AgenticModeApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
  }

  /**
   * Get user's agentic mode settings
   */
  async getSettings(userId?: string): Promise<AgenticModeSettings> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userId) headers['x-user-id'] = userId;

    const response = await fetch(`${this.baseUrl}/api/agentic-mode/settings`, { headers });

    if (!response.ok) {
      throw new Error('Failed to get agentic mode settings');
    }

    const json = await response.json();
    // Backend wraps response in { success, data }
    return json.data || json;
  }

  /**
   * Toggle agentic mode on/off
   */
  async toggle(enabled: boolean, userId?: string): Promise<AgenticModeSettings> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userId) headers['x-user-id'] = userId;

    const response = await fetch(`${this.baseUrl}/api/agentic-mode/toggle`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ enabled }),
    });

    if (!response.ok) {
      throw new Error('Failed to toggle agentic mode');
    }

    const json = await response.json();
    return json.data || json;
  }

  /**
   * Apply a preset configuration
   */
  async applyPreset(preset: string, userId?: string): Promise<AgenticModeSettings> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userId) headers['x-user-id'] = userId;

    const response = await fetch(`${this.baseUrl}/api/agentic-mode/preset`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ preset }),
    });

    if (!response.ok) {
      throw new Error('Failed to apply preset');
    }

    const json = await response.json();
    return json.data || json;
  }

  /**
   * Update custom configuration
   */
  async updateConfig(config: Partial<AgenticModeConfig>, userId?: string): Promise<AgenticModeSettings> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userId) headers['x-user-id'] = userId;

    const response = await fetch(`${this.baseUrl}/api/agentic-mode/config`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error('Failed to update config');
    }

    const json = await response.json();
    return json.data || json;
  }

  /**
   * Set a schedule for auto-enabling/disabling
   */
  async setSchedule(
    schedule: { startTime: string; endTime: string; timezone?: string } | null,
    userId?: string
  ): Promise<AgenticModeSettings> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userId) headers['x-user-id'] = userId;

    const response = await fetch(`${this.baseUrl}/api/agentic-mode/schedule`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ schedule }),
    });

    if (!response.ok) {
      throw new Error('Failed to set schedule');
    }

    const json = await response.json();
    return json.data || json;
  }

  /**
   * Get the effective (currently active) configuration
   */
  async getEffectiveConfig(userId?: string): Promise<AgenticModeConfig> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userId) headers['x-user-id'] = userId;

    const response = await fetch(`${this.baseUrl}/api/agentic-mode/effective`, { headers });

    if (!response.ok) {
      throw new Error('Failed to get effective config');
    }

    const json = await response.json();
    return json.data || json;
  }

  /**
   * Get available presets
   */
  async getPresets(): Promise<Record<string, AgenticPreset>> {
    const response = await fetch(`${this.baseUrl}/api/agentic-mode/presets`);

    if (!response.ok) {
      throw new Error('Failed to get presets');
    }

    const json = await response.json();
    // Backend returns { success, data: { presets: [...] } }
    // Convert array to Record<string, AgenticPreset>
    const presetsArray = json.data?.presets || json.presets || [];
    const presetsMap: Record<string, AgenticPreset> = {};
    for (const preset of presetsArray) {
      presetsMap[preset.name] = preset;
    }
    return presetsMap;
  }
}

// Singleton instance
export const agenticModeApi = new AgenticModeApiService();
export default agenticModeApi;
