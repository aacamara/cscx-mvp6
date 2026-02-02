/**
 * Auth Routes
 * PRD-1: Gated Login + Onboarding
 *
 * Handles invite code validation, user authentication flow
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import crypto from 'crypto';

const router = Router();

// Supabase client
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// Rate limiting store (in-memory for MVP, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limit middleware
const rateLimit = (maxRequests: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();

    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      return res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many attempts. Please try again later.',
          retryAfter
        }
      });
    }

    record.count++;
    next();
  };
};

// Validation schemas
const validateInviteSchema = z.object({
  code: z.string().min(6).max(50)
});

// Hash invite code for comparison
function hashInviteCode(code: string): string {
  return crypto.createHash('sha256').update(code.toLowerCase().trim()).digest('hex');
}

/**
 * POST /api/auth/validate-invite
 * Validates an invite code and returns workspace info
 */
router.post('/validate-invite', rateLimit(10, 60000), async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = validateInviteSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid invite code format',
          details: validationResult.error.errors
        }
      });
    }

    const { code } = validationResult.data;
    const codeHash = hashInviteCode(code);

    if (!supabase) {
      return res.status(503).json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Database not configured'
        }
      });
    }

    // Look up invite code
    const { data: invite, error } = await supabase
      .from('invite_codes')
      .select(`
        id,
        code_hash,
        workspace_id,
        expires_at,
        uses_remaining,
        max_uses,
        created_by,
        workspaces(id, name, slug, settings)
      `)
      .eq('code_hash', codeHash)
      .single();

    if (error || !invite) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CODE',
          message: 'Invalid invite code'
        }
      });
    }

    // Check expiration
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(401).json({
        error: {
          code: 'EXPIRED_CODE',
          message: 'This invite code has expired'
        }
      });
    }

    // Check uses
    if (invite.max_uses && invite.uses_remaining !== null && invite.uses_remaining <= 0) {
      return res.status(401).json({
        error: {
          code: 'CODE_EXHAUSTED',
          message: 'This invite code has been used the maximum number of times'
        }
      });
    }

    // Return workspace info (don't decrement yet - that happens on signup)
    res.json({
      valid: true,
      workspace: {
        id: invite.workspace_id,
        name: (invite.workspaces as any)?.name || 'Unknown Workspace',
        slug: (invite.workspaces as any)?.slug
      },
      inviteId: invite.id
    });
  } catch (error) {
    console.error('Validate invite error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to validate invite code'
      }
    });
  }
});

/**
 * POST /api/auth/claim-invite
 * Claims an invite code after successful OAuth
 */
router.post('/claim-invite', async (req: Request, res: Response) => {
  try {
    const { inviteId, userId } = req.body;

    if (!inviteId || !userId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'inviteId and userId are required'
        }
      });
    }

    if (!supabase) {
      return res.status(503).json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Database not configured'
        }
      });
    }

    // Get invite and verify still valid
    const { data: invite, error: inviteError } = await supabase
      .from('invite_codes')
      .select('id, workspace_id, uses_remaining, max_uses')
      .eq('id', inviteId)
      .single();

    if (inviteError || !invite) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Invite not found'
        }
      });
    }

    // Check uses remaining
    if (invite.max_uses && invite.uses_remaining !== null && invite.uses_remaining <= 0) {
      return res.status(400).json({
        error: {
          code: 'CODE_EXHAUSTED',
          message: 'This invite code has been fully used'
        }
      });
    }

    // Decrement uses remaining
    if (invite.max_uses) {
      await supabase
        .from('invite_codes')
        .update({ uses_remaining: (invite.uses_remaining || 0) - 1 })
        .eq('id', inviteId);
    }

    // Add user to workspace
    const { error: memberError } = await supabase
      .from('workspace_members')
      .upsert({
        workspace_id: invite.workspace_id,
        user_id: userId,
        role: 'member',
        invited_by_invite_id: inviteId,
        joined_at: new Date().toISOString()
      }, { onConflict: 'workspace_id,user_id' });

    if (memberError) {
      console.error('Add member error:', memberError);
      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to add user to workspace'
        }
      });
    }

    res.json({
      success: true,
      workspaceId: invite.workspace_id
    });
  } catch (error) {
    console.error('Claim invite error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to claim invite'
      }
    });
  }
});

// Admin emails that get auto-provisioned
const ADMIN_EMAILS = ['azizcamara2@gmail.com'];

/**
 * POST /api/auth/provision-admin
 * Auto-provisions admin users without invite code
 */
router.post('/provision-admin', async (req: Request, res: Response) => {
  try {
    const { userId, email, workspaceId } = req.body;

    if (!userId || !email || !workspaceId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'userId, email, and workspaceId are required'
        }
      });
    }

    // Verify email is in admin list
    if (!ADMIN_EMAILS.includes(email.toLowerCase())) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Email not authorized for admin access'
        }
      });
    }

    if (!supabase) {
      return res.status(503).json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Database not configured'
        }
      });
    }

    // 1. Create or update user profile
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('auth_user_id', userId)
      .single();

    let profileId: string;

    if (existingProfile) {
      profileId = existingProfile.id;
      await supabase
        .from('user_profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', profileId);
    } else {
      const { data: newProfile, error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          auth_user_id: userId,
          email: email,
          default_workspace_id: workspaceId,
          first_login_at: new Date().toISOString(),
          last_login_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (profileError || !newProfile) {
        console.error('Create admin profile error:', profileError);
        return res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to create admin profile'
          }
        });
      }
      profileId = newProfile.id;
    }

    // 2. Add admin to workspace with admin role
    await supabase
      .from('workspace_members')
      .upsert({
        workspace_id: workspaceId,
        user_id: profileId,
        role: 'admin',
        joined_at: new Date().toISOString()
      }, { onConflict: 'workspace_id,user_id' });

    res.json({
      success: true,
      profileId,
      role: 'admin'
    });
  } catch (error) {
    console.error('Provision admin error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to provision admin'
      }
    });
  }
});

/**
 * POST /api/auth/redeem-invite
 * Redeems an invite code after successful OAuth
 * Creates user profile and adds to workspace
 */
router.post('/redeem-invite', async (req: Request, res: Response) => {
  try {
    const { inviteId, workspaceId, userId, email } = req.body;

    if (!inviteId || !workspaceId || !userId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'inviteId, workspaceId, and userId are required'
        }
      });
    }

    if (!supabase) {
      return res.status(503).json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Database not configured'
        }
      });
    }

    // 1. Create or update user profile
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('auth_user_id', userId)
      .single();

    let profileId: string;

    if (existingProfile) {
      profileId = existingProfile.id;
      // Update last login
      await supabase
        .from('user_profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', profileId);
    } else {
      // Create new profile
      const { data: newProfile, error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          auth_user_id: userId,
          email: email || 'unknown@example.com',
          default_workspace_id: workspaceId,
          first_login_at: new Date().toISOString(),
          last_login_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (profileError || !newProfile) {
        console.error('Create profile error:', profileError);
        return res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to create user profile'
          }
        });
      }
      profileId = newProfile.id;
    }

    // 2. Add user to workspace (if not already member)
    const { error: memberError } = await supabase
      .from('workspace_members')
      .upsert({
        workspace_id: workspaceId,
        user_id: profileId,
        role: 'member',
        invited_by_invite_id: inviteId,
        joined_at: new Date().toISOString()
      }, { onConflict: 'workspace_id,user_id' });

    if (memberError) {
      console.error('Add member error:', memberError);
      // Not fatal - user profile was created
    }

    // 3. Decrement invite uses
    const { data: invite } = await supabase
      .from('invite_codes')
      .select('uses_remaining')
      .eq('id', inviteId)
      .single();

    if (invite && invite.uses_remaining > 0) {
      await supabase
        .from('invite_codes')
        .update({ uses_remaining: invite.uses_remaining - 1 })
        .eq('id', inviteId);
    }

    res.json({
      success: true,
      profileId,
      workspaceId
    });
  } catch (error) {
    console.error('Redeem invite error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to redeem invite'
      }
    });
  }
});

/**
 * GET /api/auth/session
 * Returns current user session info
 */
router.get('/session', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'No valid session'
        }
      });
    }

    const token = authHeader.substring(7);

    if (!supabase) {
      return res.status(503).json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Database not configured'
        }
      });
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired session'
        }
      });
    }

    // Get user's workspaces
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select(`
        role,
        workspaces(id, name, slug)
      `)
      .eq('user_id', user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email?.split('@')[0],
        avatarUrl: user.user_metadata?.avatar_url
      },
      workspaces: memberships?.map(m => ({
        id: (m.workspaces as any)?.id,
        name: (m.workspaces as any)?.name,
        slug: (m.workspaces as any)?.slug,
        role: m.role
      })) || []
    });
  } catch (error) {
    console.error('Session error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get session'
      }
    });
  }
});

/**
 * POST /api/auth/logout
 * Invalidates user session
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ') && supabase) {
      const token = authHeader.substring(7);
      await supabase.auth.admin.signOut(token);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    // Still return success - logout should always "work" from user perspective
    res.json({ success: true });
  }
});

export { router as authRoutes };
