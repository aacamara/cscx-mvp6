/**
 * Feature Flag Service
 * Custom implementation with Supabase storage and in-memory caching
 */

import { config } from '../config/index.js';

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  rollout_percentage: number;
  targeting_rules?: TargetingRule[];
  created_at: string;
  updated_at: string;
}

export interface TargetingRule {
  attribute: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in';
  value: string | number | string[];
}

export interface EvaluationContext {
  userId?: string;
  customerId?: string;
  environment?: string;
  attributes?: Record<string, string | number | boolean>;
}

// Default flags for development and fallback
const DEFAULT_FLAGS: Record<string, FeatureFlag> = {
  enhanced_health_checks: {
    id: 'default-1',
    key: 'enhanced_health_checks',
    name: 'Enhanced Health Checks',
    description: 'Enable deep connectivity tests for all services',
    enabled: true,
    rollout_percentage: 100,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  ai_fallback_to_gemini: {
    id: 'default-2',
    key: 'ai_fallback_to_gemini',
    name: 'AI Fallback to Gemini',
    description: 'Automatically fallback from Claude to Gemini on failure',
    enabled: true,
    rollout_percentage: 100,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  circuit_breaker_enabled: {
    id: 'default-3',
    key: 'circuit_breaker_enabled',
    name: 'Circuit Breaker Pattern',
    description: 'Enable circuit breakers for AI services',
    enabled: true,
    rollout_percentage: 100,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  preview_deployments: {
    id: 'default-4',
    key: 'preview_deployments',
    name: 'Preview Deployments',
    description: 'Enable PR preview deployments',
    enabled: true,
    rollout_percentage: 100,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  structured_logging: {
    id: 'default-5',
    key: 'structured_logging',
    name: 'Structured Logging',
    description: 'Enable JSON structured logging for Cloud Logging',
    enabled: true,
    rollout_percentage: 100,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
};

export class FeatureFlagService {
  private cache: Map<string, { flag: FeatureFlag; expiry: number }> = new Map();
  private cacheTTL = 60000; // 1 minute cache
  private supabaseClient: unknown | null = null;
  private initialized = false;

  constructor() {
    this.initSupabase();
  }

  private async initSupabase(): Promise<void> {
    if (this.initialized) return;

    if (config.supabaseUrl && config.supabaseServiceKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        this.supabaseClient = createClient(config.supabaseUrl, config.supabaseServiceKey);
        this.initialized = true;
      } catch (error) {
        console.warn('Failed to initialize Supabase for feature flags:', error);
        this.initialized = true;
      }
    } else {
      this.initialized = true;
    }
  }

  /**
   * Get a feature flag by key
   */
  async getFlag(key: string): Promise<FeatureFlag | null> {
    // Check cache first
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.flag;
    }

    await this.initSupabase();

    // Try Supabase if available
    if (this.supabaseClient) {
      try {
        const client = this.supabaseClient as {
          from: (table: string) => {
            select: (cols: string) => {
              eq: (col: string, val: string) => {
                single: () => Promise<{ data: FeatureFlag | null; error: unknown }>;
              };
            };
          };
        };

        const { data, error } = await client
          .from('feature_flags')
          .select('*')
          .eq('key', key)
          .single();

        if (!error && data) {
          this.cache.set(key, { flag: data, expiry: Date.now() + this.cacheTTL });
          return data;
        }
      } catch (error) {
        console.warn(`Failed to fetch flag ${key} from Supabase:`, error);
      }
    }

    // Fallback to defaults
    const defaultFlag = DEFAULT_FLAGS[key];
    if (defaultFlag) {
      this.cache.set(key, { flag: defaultFlag, expiry: Date.now() + this.cacheTTL });
      return defaultFlag;
    }

    return null;
  }

  /**
   * Check if a feature flag is enabled
   */
  async isEnabled(key: string, context?: EvaluationContext): Promise<boolean> {
    const flag = await this.getFlag(key);

    if (!flag) {
      return false; // Unknown flags are disabled by default
    }

    if (!flag.enabled) {
      return false;
    }

    // Check targeting rules
    if (flag.targeting_rules && flag.targeting_rules.length > 0 && context) {
      const rulesMatch = this.evaluateRules(flag.targeting_rules, context);
      if (!rulesMatch) {
        return false;
      }
    }

    // Percentage rollout
    if (flag.rollout_percentage < 100) {
      const identifier = context?.userId || context?.customerId || 'anonymous';
      return this.isInRollout(flag.key, identifier, flag.rollout_percentage);
    }

    return true;
  }

  /**
   * Get multiple flags at once
   */
  async getFlags(keys: string[]): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    await Promise.all(
      keys.map(async key => {
        results[key] = await this.isEnabled(key);
      })
    );

    return results;
  }

  /**
   * Evaluate targeting rules against context
   */
  private evaluateRules(rules: TargetingRule[], context: EvaluationContext): boolean {
    return rules.every(rule => this.evaluateRule(rule, context));
  }

  private evaluateRule(rule: TargetingRule, context: EvaluationContext): boolean {
    const value =
      context.attributes?.[rule.attribute] ??
      context[rule.attribute as keyof EvaluationContext];

    switch (rule.operator) {
      case 'equals':
        return value === rule.value;
      case 'contains':
        return typeof value === 'string' && value.includes(String(rule.value));
      case 'gt':
        return typeof value === 'number' && value > Number(rule.value);
      case 'lt':
        return typeof value === 'number' && value < Number(rule.value);
      case 'gte':
        return typeof value === 'number' && value >= Number(rule.value);
      case 'lte':
        return typeof value === 'number' && value <= Number(rule.value);
      case 'in':
        return Array.isArray(rule.value) && rule.value.includes(String(value));
      case 'not_in':
        return Array.isArray(rule.value) && !rule.value.includes(String(value));
      default:
        return false;
    }
  }

  /**
   * Consistent hashing for percentage rollout
   */
  private isInRollout(flagKey: string, identifier: string, percentage: number): boolean {
    const hash = this.hashString(`${flagKey}:${identifier}`);
    return (hash % 100) < percentage;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Create a new feature flag (admin)
   */
  async createFlag(flag: Omit<FeatureFlag, 'id' | 'created_at' | 'updated_at'>): Promise<FeatureFlag | null> {
    await this.initSupabase();

    if (!this.supabaseClient) {
      console.warn('Supabase not configured - cannot create flag');
      return null;
    }

    try {
      const client = this.supabaseClient as {
        from: (table: string) => {
          insert: (data: unknown) => {
            select: () => {
              single: () => Promise<{ data: FeatureFlag | null; error: unknown }>;
            };
          };
        };
      };

      const { data, error } = await client
        .from('feature_flags')
        .insert(flag)
        .select()
        .single();

      if (error) {
        console.error('Create flag error:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Create flag error:', error);
      return null;
    }
  }

  /**
   * Update a feature flag (admin)
   */
  async updateFlag(key: string, updates: Partial<FeatureFlag>): Promise<boolean> {
    await this.initSupabase();

    if (!this.supabaseClient) {
      return false;
    }

    try {
      const client = this.supabaseClient as {
        from: (table: string) => {
          update: (data: unknown) => {
            eq: (col: string, val: string) => Promise<{ error: unknown }>;
          };
        };
      };

      const { error } = await client
        .from('feature_flags')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('key', key);

      if (!error) {
        this.cache.delete(key); // Invalidate cache
        return true;
      }

      return false;
    } catch (error) {
      console.error('Update flag error:', error);
      return false;
    }
  }

  /**
   * Get all feature flags (admin)
   */
  async getAllFlags(): Promise<FeatureFlag[]> {
    await this.initSupabase();

    if (this.supabaseClient) {
      try {
        const client = this.supabaseClient as {
          from: (table: string) => {
            select: (cols: string) => {
              order: (col: string) => Promise<{ data: FeatureFlag[] | null; error: unknown }>;
            };
          };
        };

        const { data, error } = await client
          .from('feature_flags')
          .select('*')
          .order('key');

        if (!error && data) {
          return data;
        }
      } catch (error) {
        console.warn('Failed to fetch all flags from Supabase:', error);
      }
    }

    // Return defaults
    return Object.values(DEFAULT_FLAGS);
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const featureFlags = new FeatureFlagService();
