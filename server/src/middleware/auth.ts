/**
 * Authentication Middleware
 * Verifies user identity using Supabase auth
 */

import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
    }
  }
}

// Initialize Supabase client
const supabase: SupabaseClient | null =
  config.supabaseUrl && config.supabaseServiceKey
    ? createClient(config.supabaseUrl, config.supabaseServiceKey)
    : null;

/**
 * Middleware to verify JWT token from Supabase
 * SECURITY: Requires valid JWT token. No header fallbacks allowed.
 * In development mode, falls back to demo user only if no token provided.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  // SECURITY: x-user-id header is NOT accepted - removed for security
  // All authentication must go through proper JWT token validation

  // If we have a Supabase token, always verify it (both dev and prod)
  if (token && supabase) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired token'
        });
        return;
      }

      req.user = user;
      req.userId = user.id;
      next();
      return;
    } catch (error) {
      console.error('Auth verification error:', error);
      res.status(500).json({
        error: 'Auth Error',
        message: 'Failed to verify authentication'
      });
      return;
    }
  }

  // If token provided but no Supabase client configured
  if (token && !supabase) {
    res.status(500).json({
      error: 'Configuration Error',
      message: 'Authentication service not configured'
    });
    return;
  }

  // No token provided - check environment
  // In development only: allow demo user for local testing without auth setup
  if (config.nodeEnv === 'development') {
    req.userId = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';
    next();
    return;
  }

  // Production: require valid JWT token - no fallbacks
  res.status(401).json({
    error: 'Unauthorized',
    message: 'Authentication required. Please provide a valid JWT token.'
  });
}

/**
 * Middleware that makes auth optional (doesn't block if not authenticated)
 * SECURITY: x-user-id header is NOT accepted - all auth through JWT tokens
 */
export function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  // SECURITY: x-user-id header fallback removed for security

  // Try to verify token if provided
  if (token && supabase) {
    supabase.auth.getUser(token)
      .then(({ data: { user } }) => {
        if (user) {
          req.user = user;
          req.userId = user.id;
        } else if (config.nodeEnv === 'development') {
          // Development fallback only if token verification fails
          req.userId = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';
        }
        next();
      })
      .catch(() => {
        // Token verification failed
        if (config.nodeEnv === 'development') {
          req.userId = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';
        }
        next();
      });
    return;
  }

  // No token provided - development fallback only
  if (config.nodeEnv === 'development') {
    req.userId = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';
  }

  next();
}

/**
 * Middleware to require specific roles
 */
export function requireRole(allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      return;
    }

    // Skip role check in development
    if (config.nodeEnv !== 'production') {
      next();
      return;
    }

    if (!supabase) {
      res.status(500).json({
        error: 'Configuration Error',
        message: 'Database not configured'
      });
      return;
    }

    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', req.userId)
        .single();

      if (error || !profile) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'User profile not found'
        });
        return;
      }

      if (!allowedRoles.includes(profile.role)) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions'
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({
        error: 'Server Error',
        message: 'Failed to verify permissions'
      });
    }
  };
}

export { supabase };
