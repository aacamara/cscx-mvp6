/**
 * Agentic Mode Service
 * Manages user agentic mode settings and configurations
 *
 * This service allows CSMs to toggle between:
 * - Manual Mode (default): AI suggests, human drives
 * - Agentic Mode: AI executes autonomously, pauses for high-risk approvals
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import {
  AgenticModeConfig,
  DEFAULT_AGENTIC_CONFIG,
} from '../agents/engine/agentic-loop.js';

// Extended config with metadata
export interface UserAgenticSettings {
  userId: string;
  config: AgenticModeConfig;
  createdAt: Date;
  updatedAt: Date;
  // Presets
  preset: 'manual' | 'vacation' | 'supervised' | 'custom';
  // Schedule (optional) - auto-enable during certain hours
  schedule?: {
    enabled: boolean;
    timezone: string;
    rules: Array<{
      days: number[]; // 0-6, Sunday = 0
      startTime: string; // HH:MM
      endTime: string;   // HH:MM
      config: AgenticModeConfig;
    }>;
  };
}

// Predefined presets
export const AGENTIC_PRESETS: Record<string, AgenticModeConfig> = {
  manual: {
    enabled: false,
    maxSteps: 10,
    autoApproveLevel: 'none',
    pauseOnHighRisk: true,
    notifyOnCompletion: true,
  },
  vacation: {
    enabled: true,
    maxSteps: 20,
    autoApproveLevel: 'low_risk',
    pauseOnHighRisk: true,
    notifyOnCompletion: true,
  },
  supervised: {
    enabled: true,
    maxSteps: 15,
    autoApproveLevel: 'low_risk',
    pauseOnHighRisk: true,
    notifyOnCompletion: true,
  },
  autonomous: {
    enabled: true,
    maxSteps: 30,
    autoApproveLevel: 'all',
    pauseOnHighRisk: true, // Still pause for high-risk even in autonomous
    notifyOnCompletion: true,
  },
};

export class AgenticModeService {
  private supabase: SupabaseClient | null = null;
  private cache: Map<string, UserAgenticSettings> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Get agentic mode settings for a user
   */
  async getSettings(userId: string): Promise<UserAgenticSettings> {
    // Check cache first
    const cached = this.cache.get(userId);
    if (cached) {
      return cached;
    }

    // Try database
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('user_agentic_settings')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (data && !error) {
          const settings: UserAgenticSettings = {
            userId: data.user_id,
            config: data.config as AgenticModeConfig,
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at),
            preset: data.preset || 'manual',
            schedule: data.schedule,
          };
          this.cache.set(userId, settings);
          return settings;
        }
      } catch (e) {
        console.log('[AgenticMode] Database query failed, using defaults');
      }
    }

    // Return default settings
    const defaultSettings: UserAgenticSettings = {
      userId,
      config: DEFAULT_AGENTIC_CONFIG,
      createdAt: new Date(),
      updatedAt: new Date(),
      preset: 'manual',
    };

    return defaultSettings;
  }

  /**
   * Update agentic mode settings for a user
   */
  async updateSettings(
    userId: string,
    updates: Partial<UserAgenticSettings>
  ): Promise<UserAgenticSettings> {
    const current = await this.getSettings(userId);

    const newSettings: UserAgenticSettings = {
      ...current,
      ...updates,
      config: updates.config ? { ...current.config, ...updates.config } : current.config,
      updatedAt: new Date(),
    };

    // Persist to database
    if (this.supabase) {
      try {
        await this.supabase
          .from('user_agentic_settings')
          .upsert({
            user_id: userId,
            config: newSettings.config,
            preset: newSettings.preset,
            schedule: newSettings.schedule,
            updated_at: newSettings.updatedAt.toISOString(),
          });
      } catch (e) {
        console.log('[AgenticMode] Failed to persist settings:', e);
      }
    }

    // Update cache
    this.cache.set(userId, newSettings);

    console.log(`[AgenticMode] Updated settings for user ${userId}: preset=${newSettings.preset}, enabled=${newSettings.config.enabled}`);

    return newSettings;
  }

  /**
   * Toggle agentic mode on/off
   */
  async toggleMode(userId: string, enabled: boolean): Promise<UserAgenticSettings> {
    const current = await this.getSettings(userId);

    return this.updateSettings(userId, {
      config: {
        ...current.config,
        enabled,
      },
      preset: enabled ? 'supervised' : 'manual',
    });
  }

  /**
   * Apply a preset configuration
   */
  async applyPreset(
    userId: string,
    preset: 'manual' | 'vacation' | 'supervised' | 'autonomous'
  ): Promise<UserAgenticSettings> {
    const presetConfig = AGENTIC_PRESETS[preset];

    if (!presetConfig) {
      throw new Error(`Unknown preset: ${preset}`);
    }

    return this.updateSettings(userId, {
      config: presetConfig,
      preset: preset === 'autonomous' ? 'custom' : preset,
    });
  }

  /**
   * Get effective config for current time (respects schedules)
   */
  async getEffectiveConfig(userId: string): Promise<AgenticModeConfig> {
    const settings = await this.getSettings(userId);

    // If no schedule or schedule disabled, return base config
    if (!settings.schedule?.enabled || !settings.schedule.rules.length) {
      return settings.config;
    }

    // Check if current time matches any schedule rule
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      timeZone: settings.schedule.timezone,
    });

    for (const rule of settings.schedule.rules) {
      if (
        rule.days.includes(currentDay) &&
        currentTime >= rule.startTime &&
        currentTime <= rule.endTime
      ) {
        return rule.config;
      }
    }

    return settings.config;
  }

  /**
   * Set up a schedule for automatic agentic mode
   */
  async setSchedule(
    userId: string,
    schedule: UserAgenticSettings['schedule']
  ): Promise<UserAgenticSettings> {
    return this.updateSettings(userId, { schedule });
  }

  /**
   * Clear cache for a user
   */
  clearCache(userId: string): void {
    this.cache.delete(userId);
  }

  /**
   * Get all available presets (deep copy to prevent mutation)
   */
  getPresets(): Record<string, AgenticModeConfig> {
    return JSON.parse(JSON.stringify(AGENTIC_PRESETS));
  }
}

// Singleton instance
export const agenticModeService = new AgenticModeService();

export default agenticModeService;
