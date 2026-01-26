/**
 * Health Check Service
 * Provides comprehensive health status with real connectivity tests
 */

import { config } from '../config/index.js';
import { getAllCircuitBreakerStats } from './circuitBreaker.js';

export interface ServiceHealth {
  status: 'connected' | 'disconnected' | 'degraded';
  latency?: number;
  lastChecked: string;
  error?: string;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  uptime: number;
  environment: string;
  services: {
    database: ServiceHealth;
    gemini: ServiceHealth;
    anthropic: ServiceHealth;
  };
  checks: HealthCheck[];
  circuitBreakers?: Record<string, unknown>;
}

export class HealthService {
  private startTime = Date.now();
  private version = '1.0.0';
  private cachedHealth: { status: HealthStatus; expiry: number } | null = null;
  private cacheTTL = 10000; // 10 seconds cache for health checks

  /**
   * Check database (Supabase) connectivity
   */
  async checkDatabase(): Promise<ServiceHealth> {
    const start = Date.now();

    if (!config.supabaseUrl || !config.supabaseServiceKey) {
      return {
        status: 'disconnected',
        lastChecked: new Date().toISOString(),
        error: 'Supabase not configured - using in-memory storage'
      };
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(config.supabaseUrl, config.supabaseServiceKey);

      // Perform actual connectivity check with timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database check timeout')), 5000)
      );

      const queryPromise = client.from('customers').select('count').limit(1);
      const { error } = await Promise.race([queryPromise, timeoutPromise]);

      const latency = Date.now() - start;

      if (error) {
        return {
          status: 'degraded',
          latency,
          lastChecked: new Date().toISOString(),
          error: error.message
        };
      }

      return {
        status: 'connected',
        latency,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'disconnected',
        latency: Date.now() - start,
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check Gemini API connectivity
   */
  async checkGemini(): Promise<ServiceHealth> {
    const start = Date.now();

    if (!config.geminiApiKey) {
      return {
        status: 'disconnected',
        lastChecked: new Date().toISOString(),
        error: 'Gemini API key not configured'
      };
    }

    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const client = new GoogleGenerativeAI(config.geminiApiKey);
      const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });

      // Minimal health check request with timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini check timeout')), 10000)
      );

      const generatePromise = model.generateContent('Reply with OK');
      await Promise.race([generatePromise, timeoutPromise]);

      return {
        status: 'connected',
        latency: Date.now() - start,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      // Check for rate limiting (still means API is reachable)
      if (errorMsg.includes('rate') || errorMsg.includes('429')) {
        return {
          status: 'degraded',
          latency: Date.now() - start,
          lastChecked: new Date().toISOString(),
          error: 'Rate limited'
        };
      }

      return {
        status: 'disconnected',
        latency: Date.now() - start,
        lastChecked: new Date().toISOString(),
        error: errorMsg
      };
    }
  }

  /**
   * Check Anthropic (Claude) API connectivity
   */
  async checkAnthropic(): Promise<ServiceHealth> {
    const start = Date.now();

    if (!config.anthropicApiKey) {
      return {
        status: 'disconnected',
        lastChecked: new Date().toISOString(),
        error: 'Anthropic API key not configured'
      };
    }

    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: config.anthropicApiKey });

      // Minimal health check with timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Anthropic check timeout')), 10000)
      );

      const messagePromise = client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'OK' }]
      });

      await Promise.race([messagePromise, timeoutPromise]);

      return {
        status: 'connected',
        latency: Date.now() - start,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      // Check for billing/rate issues (API is reachable but limited)
      if (
        errorMsg.includes('credit') ||
        errorMsg.includes('rate') ||
        errorMsg.includes('429')
      ) {
        return {
          status: 'degraded',
          latency: Date.now() - start,
          lastChecked: new Date().toISOString(),
          error: errorMsg.includes('credit') ? 'No credits' : 'Rate limited'
        };
      }

      return {
        status: 'disconnected',
        latency: Date.now() - start,
        lastChecked: new Date().toISOString(),
        error: errorMsg
      };
    }
  }

  /**
   * Get full health status with all service checks
   */
  async getFullHealth(skipCache = false): Promise<HealthStatus> {
    // Return cached health if valid
    if (!skipCache && this.cachedHealth && this.cachedHealth.expiry > Date.now()) {
      return this.cachedHealth.status;
    }

    const [database, gemini, anthropic] = await Promise.all([
      this.checkDatabase(),
      this.checkGemini(),
      this.checkAnthropic()
    ]);

    const checks: HealthCheck[] = [
      {
        name: 'database',
        status: database.status === 'connected' ? 'pass' : database.status === 'degraded' ? 'warn' : 'fail',
        message: database.error,
        duration: database.latency
      },
      {
        name: 'ai:gemini',
        status: gemini.status === 'connected' ? 'pass' : gemini.status === 'degraded' ? 'warn' : 'fail',
        message: gemini.error,
        duration: gemini.latency
      },
      {
        name: 'ai:anthropic',
        status: anthropic.status === 'connected' ? 'pass' : anthropic.status === 'degraded' ? 'warn' : 'fail',
        message: anthropic.error,
        duration: anthropic.latency
      }
    ];

    // Determine overall status
    const failCount = checks.filter(c => c.status === 'fail').length;
    const warnCount = checks.filter(c => c.status === 'warn').length;

    // At least one AI service must be available
    const hasAI = gemini.status !== 'disconnected' || anthropic.status !== 'disconnected';

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (!hasAI || failCount >= 2) {
      overallStatus = 'unhealthy';
    } else if (failCount >= 1 || warnCount >= 2) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const healthStatus: HealthStatus = {
      status: overallStatus,
      version: this.version,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      environment: process.env.NODE_ENV || 'development',
      services: { database, gemini, anthropic },
      checks,
      circuitBreakers: getAllCircuitBreakerStats()
    };

    // Cache the result
    this.cachedHealth = {
      status: healthStatus,
      expiry: Date.now() + this.cacheTTL
    };

    return healthStatus;
  }

  /**
   * Kubernetes liveness probe - lightweight, always returns ok if process is running
   */
  async getLivenessStatus(): Promise<{ status: 'ok' | 'error' }> {
    return { status: 'ok' };
  }

  /**
   * Kubernetes readiness probe - checks if app can serve traffic
   */
  async getReadinessStatus(): Promise<{ ready: boolean; reason?: string }> {
    // Check if at least one AI service is available
    const [gemini, anthropic] = await Promise.all([
      this.checkGemini(),
      this.checkAnthropic()
    ]);

    if (gemini.status === 'connected' || anthropic.status === 'connected') {
      return { ready: true };
    }

    if (gemini.status === 'degraded' || anthropic.status === 'degraded') {
      return { ready: true, reason: 'AI services degraded but available' };
    }

    return { ready: false, reason: 'No AI services available' };
  }

  /**
   * Basic health check (lightweight)
   */
  getBasicHealth(): { status: string; version: string; timestamp: string; uptime: number } {
    return {
      status: 'ok',
      version: this.version,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }

  /**
   * Clear health cache (for testing)
   */
  clearCache(): void {
    this.cachedHealth = null;
  }
}

// Export singleton instance
export const healthService = new HealthService();
