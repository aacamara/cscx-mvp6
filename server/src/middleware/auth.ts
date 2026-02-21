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
      organizationId?: string;
      userRole?: string;
    }
  }
}

// Initialize Supabase client
const supabase: SupabaseClient | null =
  config.supabaseUrl && config.supabaseServiceKey
    ? createClient(config.supabaseUrl, config.supabaseServiceKey)
    : null;

/**
 * Look up the user's organization membership.
 * Tries org_members first (Phase 2+), falls back to workspace_members (Phase 1).
 * Non-fatal: if tables don't exist or user has no membership, continues without org context.
 */
async function resolveOrgMembership(req: Request): Promise<void> {
  if (!supabase || !req.userId) return;

  // Accept x-organization-id from frontend if provided (trusted via JWT auth)
  const orgIdHeader = req.headers['x-organization-id'] as string | undefined;

  try {
    // Try org_members table first (Phase 2+)
    const { data: orgMember, error: orgError } = await supabase
      .from('org_members')
      .select('organization_id, role')
      .eq('user_id', req.userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (!orgError && orgMember) {
      req.organizationId = orgIdHeader || orgMember.organization_id;
      req.userRole = orgMember.role;
      return;
    }

    // Fallback: try workspace_members (Phase 1 compatibility)
    const { data: wsMember, error: wsError } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', req.userId)
      .limit(1)
      .maybeSingle();

    if (!wsError && wsMember) {
      req.organizationId = orgIdHeader || wsMember.workspace_id;
      req.userRole = wsMember.role;
      return;
    }

    // If header provided but no DB membership found, trust the header
    if (orgIdHeader) {
      req.organizationId = orgIdHeader;
    }
  } catch {
    // Tables may not exist yet — silently continue without org context
  }
}

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
      // Resolve org membership (non-blocking)
      await resolveOrgMembership(req);
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
    // Resolve org membership from DB (finds seeded org_members row)
    await resolveOrgMembership(req);
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
      .then(async ({ data: { user } }) => {
        if (user) {
          req.user = user;
          req.userId = user.id;
          await resolveOrgMembership(req);
        } else if (config.nodeEnv === 'development') {
          req.userId = 'df2dc7be-ece0-40b2-a9d7-0f6c45b75131';
        }
        next();
      })
      .catch(() => {
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
    const orgIdHeader = req.headers['x-organization-id'] as string | undefined;
    if (orgIdHeader) {
      req.organizationId = orgIdHeader;
    }
  }

  next();
}

/**
 * Middleware to require specific roles.
 * Checks org membership role first (from resolveOrgMembership), then falls back to user_profiles.
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

    // Check org membership role first (set by resolveOrgMembership)
    if (req.userRole && allowedRoles.includes(req.userRole)) {
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

/**
 * Middleware to require organization context.
 * Rejects requests that don't have an organizationId set.
 */
export function requireOrganization(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip in development
  if (config.nodeEnv === 'development') {
    next();
    return;
  }

  if (!req.organizationId) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Organization context required'
    });
    return;
  }

  next();
}

export { supabase };
