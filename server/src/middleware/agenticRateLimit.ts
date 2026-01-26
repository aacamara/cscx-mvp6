/**
 * Agentic Rate Limiting Middleware
 * Production-grade rate limiting for agentic endpoints
 * Provides user-specific limits with different tiers for execute vs read-only operations
 */

import { Request, Response, NextFunction } from 'express';

// Rate limit configuration
interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  message: string;       // Error message
}

// Rate limit state for a single user/endpoint
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Sliding window rate limit state
interface SlidingWindowEntry {
  timestamps: number[];
  windowStart: number;
}

// Rate limit configurations by endpoint type
export const AGENTIC_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Execute endpoints - stricter limits (costly operations)
  execute: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 10,      // 10 requests per minute
    message: 'Too many agent executions. Please wait before executing more goals.',
  },

  // Resume endpoints - moderate limits
  resume: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 20,      // 20 requests per minute
    message: 'Too many resume requests. Please wait.',
  },

  // Plan endpoints - moderate limits
  plan: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 15,      // 15 requests per minute
    message: 'Too many planning requests. Please wait.',
  },

  // Specialist execution - moderate limits
  specialist: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 15,      // 15 requests per minute
    message: 'Too many specialist requests. Please wait.',
  },

  // Read-only endpoints - more relaxed limits
  readonly: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 60,      // 60 requests per minute
    message: 'Too many requests. Please slow down.',
  },

  // Default for unmatched endpoints
  default: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 30,      // 30 requests per minute
    message: 'Rate limit exceeded. Please wait.',
  },
};

// Global rate limit configuration (applies across all users)
export const GLOBAL_RATE_LIMITS = {
  execute: {
    windowMs: 60 * 1000,
    maxRequests: 100,     // 100 executions per minute globally
    message: 'System is at capacity. Please try again shortly.',
  },
};

// In-memory rate limit store (per user)
// In production, replace with Redis for distributed rate limiting
const userRateLimits = new Map<string, Map<string, SlidingWindowEntry>>();
const globalRateLimits = new Map<string, SlidingWindowEntry>();

/**
 * Get user ID from request headers or query params
 */
function getUserId(req: Request): string {
  return (
    (req.headers['x-user-id'] as string) ||
    (req.query.userId as string) ||
    req.ip ||
    'anonymous'
  );
}

/**
 * Determine the rate limit type based on request path and method
 */
function getRateLimitType(req: Request): string {
  const path = req.path.toLowerCase();
  const method = req.method.toUpperCase();

  // Execute endpoints (POST /execute, POST /execute-plan)
  if (path.includes('/execute') && method === 'POST') {
    return 'execute';
  }

  // Resume endpoints
  if (path.includes('/resume') && method === 'POST') {
    return 'resume';
  }

  // Plan endpoints
  if (path.includes('/plan') && method === 'POST') {
    return 'plan';
  }

  // Specialist endpoints
  if (path.includes('/specialist') && method === 'POST') {
    return 'specialist';
  }

  // Read-only endpoints (GET requests)
  if (method === 'GET') {
    return 'readonly';
  }

  return 'default';
}

/**
 * Check sliding window rate limit
 */
function checkSlidingWindow(
  entry: SlidingWindowEntry | undefined,
  config: RateLimitConfig,
  now: number
): { allowed: boolean; remaining: number; resetTime: number; entry: SlidingWindowEntry } {
  const windowStart = now - config.windowMs;

  if (!entry) {
    entry = { timestamps: [], windowStart: now };
  }

  // Remove timestamps outside the current window
  entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);
  entry.windowStart = windowStart;

  const remaining = Math.max(0, config.maxRequests - entry.timestamps.length);
  const resetTime = entry.timestamps.length > 0
    ? Math.min(...entry.timestamps) + config.windowMs
    : now + config.windowMs;

  if (entry.timestamps.length >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetTime, entry };
  }

  // Add current timestamp
  entry.timestamps.push(now);

  return {
    allowed: true,
    remaining: Math.max(0, config.maxRequests - entry.timestamps.length),
    resetTime,
    entry,
  };
}

/**
 * Create rate limit response headers
 */
function setRateLimitHeaders(
  res: Response,
  config: RateLimitConfig,
  remaining: number,
  resetTime: number
): void {
  res.setHeader('X-RateLimit-Limit', config.maxRequests);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));
  res.setHeader('X-RateLimit-Window', config.windowMs / 1000);
}

/**
 * Create 429 rate limit exceeded response
 */
function rateLimitExceeded(
  res: Response,
  config: RateLimitConfig,
  remaining: number,
  resetTime: number,
  isGlobal: boolean = false
): void {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

  res.setHeader('Retry-After', Math.max(1, retryAfter));
  setRateLimitHeaders(res, config, remaining, resetTime);

  res.status(429).json({
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: config.message,
      retryAfter: Math.max(1, retryAfter),
      isGlobalLimit: isGlobal,
    },
  });
}

/**
 * Agentic Rate Limit Middleware
 * Apply to /api/agentic/* routes
 */
export function agenticRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const userId = getUserId(req);
  const limitType = getRateLimitType(req);
  const config = AGENTIC_RATE_LIMITS[limitType] || AGENTIC_RATE_LIMITS.default;

  // Check global rate limit for execute endpoints
  if (limitType === 'execute') {
    const globalConfig = GLOBAL_RATE_LIMITS.execute;
    const globalEntry = globalRateLimits.get('execute');
    const globalResult = checkSlidingWindow(globalEntry, globalConfig, now);

    globalRateLimits.set('execute', globalResult.entry);

    if (!globalResult.allowed) {
      return rateLimitExceeded(res, globalConfig, globalResult.remaining, globalResult.resetTime, true);
    }
  }

  // Get or create user rate limit map
  if (!userRateLimits.has(userId)) {
    userRateLimits.set(userId, new Map());
  }
  const userLimits = userRateLimits.get(userId)!;

  // Check user rate limit
  const userEntry = userLimits.get(limitType);
  const result = checkSlidingWindow(userEntry, config, now);

  userLimits.set(limitType, result.entry);

  // Set rate limit headers on all responses
  setRateLimitHeaders(res, config, result.remaining, result.resetTime);

  if (!result.allowed) {
    return rateLimitExceeded(res, config, result.remaining, result.resetTime, false);
  }

  next();
}

/**
 * Get current rate limit status for a user
 * Useful for debugging and monitoring
 */
export function getUserRateLimitStatus(userId: string): Record<string, {
  used: number;
  limit: number;
  remaining: number;
  resetTime: number;
}> {
  const now = Date.now();
  const userLimits = userRateLimits.get(userId);
  const status: Record<string, any> = {};

  for (const [type, config] of Object.entries(AGENTIC_RATE_LIMITS)) {
    const entry = userLimits?.get(type);
    const windowStart = now - config.windowMs;

    if (entry) {
      const activeTimestamps = entry.timestamps.filter(ts => ts > windowStart);
      status[type] = {
        used: activeTimestamps.length,
        limit: config.maxRequests,
        remaining: Math.max(0, config.maxRequests - activeTimestamps.length),
        resetTime: activeTimestamps.length > 0
          ? Math.min(...activeTimestamps) + config.windowMs
          : now + config.windowMs,
      };
    } else {
      status[type] = {
        used: 0,
        limit: config.maxRequests,
        remaining: config.maxRequests,
        resetTime: now + config.windowMs,
      };
    }
  }

  return status;
}

/**
 * Reset rate limits for a user (admin function)
 */
export function resetUserRateLimits(userId: string): void {
  userRateLimits.delete(userId);
}

/**
 * Clean up expired rate limit entries
 * Call periodically to prevent memory leaks
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now();

  const userIds = Array.from(userRateLimits.keys());
  for (const userId of userIds) {
    const limits = userRateLimits.get(userId);
    if (!limits) continue;

    let hasActiveEntries = false;

    const types = Array.from(limits.keys());
    for (const type of types) {
      const entry = limits.get(type);
      if (!entry) continue;

      const config = AGENTIC_RATE_LIMITS[type] || AGENTIC_RATE_LIMITS.default;
      const windowStart = now - config.windowMs;

      entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);

      if (entry.timestamps.length > 0) {
        hasActiveEntries = true;
      }
    }

    // Remove user if no active entries
    if (!hasActiveEntries) {
      userRateLimits.delete(userId);
    }
  }
}

// Cleanup expired entries every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

/**
 * Export for testing
 */
export const _testExports = {
  userRateLimits,
  globalRateLimits,
  checkSlidingWindow,
  getRateLimitType,
  getUserId,
};
