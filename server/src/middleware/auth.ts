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
 * Allows requests without auth in development mode
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  // Get user ID from custom header (fallback for development)
  const customUserId = req.headers['x-user-id'] as string;

  // In development, allow requests without auth
  if (config.nodeEnv !== 'production') {
    if (customUserId) {
      req.userId = customUserId;
      next();
      return;
    }

    // Use demo user in dev if no auth
    req.userId = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';
    next();
    return;
  }

  // In production, require authentication
  if (!token && !customUserId) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
    return;
  }

  // If we have a Supabase token, verify it
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

  // Fall back to custom header
  if (customUserId) {
    req.userId = customUserId;
    next();
    return;
  }

  res.status(401).json({
    error: 'Unauthorized',
    message: 'Authentication required'
  });
}

/**
 * Middleware that makes auth optional (doesn't block if not authenticated)
 */
export function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  const customUserId = req.headers['x-user-id'] as string;

  // Set user ID if available
  if (customUserId) {
    req.userId = customUserId;
  } else if (config.nodeEnv !== 'production') {
    req.userId = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';
  }

  // Try to verify token if provided (but don't fail if invalid)
  if (token && supabase) {
    supabase.auth.getUser(token)
      .then(({ data: { user } }) => {
        if (user) {
          req.user = user;
          req.userId = user.id;
        }
        next();
      })
      .catch(() => {
        next();
      });
    return;
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
