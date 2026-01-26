/**
 * Skill Cache Service
 * In-memory cache with optional Supabase persistence for skill execution results
 *
 * Features:
 * - TTL support per skill
 * - Cache key generation from variables
 * - Hit/miss metrics
 * - LRU eviction
 * - Optional persistent storage
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import {
  SkillCacheEntry,
  SkillCacheStats,
  SkillExecutionResult,
} from '../agents/skills/types.js';

// ============================================
// Types
// ============================================

interface CacheConfig {
  maxEntries: number;
  defaultTtlSeconds: number;
  persistToSupabase: boolean;
  cleanupIntervalMs: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  totalSavedMs: number;
  persistWrites: number;
  persistReads: number;
}

// ============================================
// Skill Cache Service
// ============================================

export class SkillCacheService {
  private cache: Map<string, SkillCacheEntry> = new Map();
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSavedMs: 0,
    persistWrites: 0,
    persistReads: 0,
  };
  private config: CacheConfig;
  private supabase: SupabaseClient | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(cacheConfig?: Partial<CacheConfig>) {
    this.config = {
      maxEntries: cacheConfig?.maxEntries || 1000,
      defaultTtlSeconds: cacheConfig?.defaultTtlSeconds || 3600,
      persistToSupabase: cacheConfig?.persistToSupabase ?? true,
      cleanupIntervalMs: cacheConfig?.cleanupIntervalMs || 60000, // 1 minute
    };

    // Initialize Supabase if configured
    if (this.config.persistToSupabase && config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Generate a cache key from skill ID and variables
   */
  generateCacheKey(skillId: string, variables: Record<string, any>, keyFields: string[]): string {
    const keyParts = [skillId];

    for (const field of keyFields.sort()) {
      const value = variables[field];
      if (value !== undefined && value !== null) {
        keyParts.push(`${field}:${JSON.stringify(value)}`);
      }
    }

    return keyParts.join('|');
  }

  /**
   * Get a cached skill execution result
   */
  async get(cacheKey: string): Promise<SkillCacheEntry | null> {
    // Check in-memory cache first
    const entry = this.cache.get(cacheKey);

    if (entry) {
      // Check if expired
      if (entry.expiresAt < new Date()) {
        this.cache.delete(cacheKey);
        this.metrics.misses++;
        return null;
      }

      // Update access tracking
      entry.hitCount++;
      entry.lastAccessedAt = new Date();
      this.metrics.hits++;

      if (entry.result.totalDurationMs) {
        this.metrics.totalSavedMs += entry.result.totalDurationMs;
      }

      return entry;
    }

    // Try persistent storage if not in memory
    if (this.supabase) {
      try {
        const { data, error } = await (this.supabase as any)
          .from('skill_cache')
          .select('*')
          .eq('cache_key', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (data && !error) {
          // Hydrate into memory cache
          const persistedEntry: SkillCacheEntry = {
            key: data.cache_key,
            skillId: data.skill_id,
            result: data.result,
            variables: data.variables,
            createdAt: new Date(data.created_at),
            expiresAt: new Date(data.expires_at),
            hitCount: data.hit_count + 1,
            lastAccessedAt: new Date(),
          };

          this.cache.set(cacheKey, persistedEntry);
          this.metrics.hits++;
          this.metrics.persistReads++;

          // Update hit count in persistent storage
          await (this.supabase as any)
            .from('skill_cache')
            .update({
              hit_count: persistedEntry.hitCount,
              last_accessed_at: new Date().toISOString(),
            })
            .eq('cache_key', cacheKey);

          if (persistedEntry.result.totalDurationMs) {
            this.metrics.totalSavedMs += persistedEntry.result.totalDurationMs;
          }

          return persistedEntry;
        }
      } catch (err) {
        console.error('[SkillCache] Persistent read error:', err);
      }
    }

    this.metrics.misses++;
    return null;
  }

  /**
   * Store a skill execution result in cache
   */
  async set(
    cacheKey: string,
    skillId: string,
    result: SkillExecutionResult,
    variables: Record<string, any>,
    ttlSeconds: number
  ): Promise<void> {
    // Enforce max entries with LRU eviction
    if (this.cache.size >= this.config.maxEntries) {
      this.evictLRU();
    }

    const now = new Date();
    const entry: SkillCacheEntry = {
      key: cacheKey,
      skillId,
      result,
      variables,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
      hitCount: 0,
      lastAccessedAt: now,
    };

    this.cache.set(cacheKey, entry);

    // Persist to Supabase if configured
    if (this.supabase) {
      try {
        await (this.supabase as any)
          .from('skill_cache')
          .upsert({
            cache_key: cacheKey,
            skill_id: skillId,
            result,
            variables,
            created_at: now.toISOString(),
            expires_at: entry.expiresAt.toISOString(),
            hit_count: 0,
            last_accessed_at: now.toISOString(),
          });

        this.metrics.persistWrites++;
      } catch (err) {
        console.error('[SkillCache] Persistent write error:', err);
      }
    }
  }

  /**
   * Invalidate a cache entry
   */
  async invalidate(cacheKey: string): Promise<boolean> {
    const existed = this.cache.delete(cacheKey);

    if (this.supabase) {
      try {
        await (this.supabase as any)
          .from('skill_cache')
          .delete()
          .eq('cache_key', cacheKey);
      } catch (err) {
        console.error('[SkillCache] Persistent delete error:', err);
      }
    }

    return existed;
  }

  /**
   * Invalidate all cache entries for a skill
   */
  async invalidateSkill(skillId: string): Promise<number> {
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.skillId === skillId) {
        this.cache.delete(key);
        count++;
      }
    }

    if (this.supabase) {
      try {
        const { data } = await (this.supabase as any)
          .from('skill_cache')
          .delete()
          .eq('skill_id', skillId)
          .select('cache_key');

        if (data) {
          count = Math.max(count, data.length);
        }
      } catch (err) {
        console.error('[SkillCache] Persistent skill delete error:', err);
      }
    }

    return count;
  }

  /**
   * Get cache statistics
   */
  getStats(): SkillCacheStats {
    const entries = Array.from(this.cache.values());
    const validEntries = entries.filter(e => e.expiresAt > new Date());

    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;

    for (const entry of validEntries) {
      if (!oldestEntry || entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt;
      }
      if (!newestEntry || entry.createdAt > newestEntry) {
        newestEntry = entry.createdAt;
      }
    }

    const totalAttempts = this.metrics.hits + this.metrics.misses;

    return {
      totalEntries: validEntries.length,
      hitCount: this.metrics.hits,
      missCount: this.metrics.misses,
      hitRate: totalAttempts > 0 ? this.metrics.hits / totalAttempts : 0,
      totalSavedMs: this.metrics.totalSavedMs,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Get detailed metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if a skill has valid cache
   */
  async hasValidCache(cacheKey: string): Promise<boolean> {
    const entry = await this.get(cacheKey);
    return entry !== null;
  }

  /**
   * Get time until cache expires (in seconds)
   */
  getTimeToExpiry(cacheKey: string): number | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;

    const now = new Date();
    if (entry.expiresAt < now) return null;

    return Math.ceil((entry.expiresAt.getTime() - now.getTime()) / 1000);
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldest: SkillCacheEntry | null = null;
    let oldestKey: string | null = null;

    for (const [key, entry] of this.cache.entries()) {
      if (!oldest || entry.lastAccessedAt < oldest.lastAccessedAt) {
        oldest = entry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.metrics.evictions++;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = new Date();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      console.log(`[SkillCache] Cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * Start the cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Stop the cleanup interval
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clear all cache entries
   */
  async clearAll(): Promise<void> {
    this.cache.clear();

    if (this.supabase) {
      try {
        await (this.supabase as any)
          .from('skill_cache')
          .delete()
          .neq('cache_key', ''); // Delete all
      } catch (err) {
        console.error('[SkillCache] Persistent clear error:', err);
      }
    }

    // Reset metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSavedMs: 0,
      persistWrites: 0,
      persistReads: 0,
    };
  }
}

// Export singleton instance
export const skillCache = new SkillCacheService();
