/**
 * Organization Routes
 * Multi-tenant organization CRUD: create, read, update, invite, join
 *
 * Tables:
 *   - organizations (id, name, slug, plan, settings, created_at, updated_at)
 *   - org_members (id, organization_id, user_id, role, invited_by, invited_at, joined_at, status)
 *   - invite_codes (id, organization_id, code, role, created_by, max_uses, uses_remaining, expires_at, created_at)
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { authMiddleware } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Validate that a slug is URL-safe: lowercase alphanumeric and hyphens only, 3-48 chars */
function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(slug);
}

/** Generate a cryptographically random 8-character invite code (base36) */
function generateInviteCode(): string {
  return crypto.randomBytes(6).toString('base64url').slice(0, 8).toLowerCase();
}

/**
 * Check whether the authenticated user is a member of the given organization.
 * Returns the membership row or null.
 */
async function getMembership(userId: string, orgId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('org_members')
    .select('id, organization_id, user_id, role, status')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

// ---------------------------------------------------------------------------
// All routes require authentication
// ---------------------------------------------------------------------------
router.use(authMiddleware);

// ---------------------------------------------------------------------------
// 1. POST /create  --  Create a new organization
// ---------------------------------------------------------------------------
router.post('/create', async (req: Request, res: Response) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { name, slug } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Organization name is required'
      });
    }

    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Organization slug is required'
      });
    }

    const normalizedSlug = slug.toLowerCase().trim();

    if (!isValidSlug(normalizedSlug)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Slug must be 3-48 characters, lowercase alphanumeric and hyphens only, and cannot start or end with a hyphen'
      });
    }

    // Check slug uniqueness
    const { data: existing, error: slugCheckError } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', normalizedSlug)
      .maybeSingle();

    if (slugCheckError) {
      console.error('Slug check error:', slugCheckError);
      return res.status(500).json({ error: 'Failed to validate slug uniqueness' });
    }

    if (existing) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'An organization with this slug already exists'
      });
    }

    // Create the organization
    const { data: organization, error: createError } = await supabase
      .from('organizations')
      .insert({
        name: name.trim(),
        slug: normalizedSlug,
        plan: 'free',
        settings: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id, name, slug, plan')
      .single();

    if (createError || !organization) {
      console.error('Organization create error:', createError);
      return res.status(500).json({ error: 'Failed to create organization' });
    }

    // Add the creating user as an admin member
    const { error: memberError } = await supabase
      .from('org_members')
      .insert({
        organization_id: organization.id,
        user_id: userId,
        role: 'admin',
        invited_by: userId,
        invited_at: new Date().toISOString(),
        joined_at: new Date().toISOString(),
        status: 'active'
      });

    if (memberError) {
      console.error('Member insert error:', memberError);
      // Attempt to clean up the orphaned organization
      await supabase.from('organizations').delete().eq('id', organization.id);
      return res.status(500).json({ error: 'Failed to add creator as organization member' });
    }

    return res.status(201).json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        plan: organization.plan
      }
    });
  } catch (error) {
    console.error('POST /create error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// 2. GET /current  --  Get the current user's organization(s)
// ---------------------------------------------------------------------------
router.get('/current', async (req: Request, res: Response) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Fetch all active memberships for this user, joining the organization details
    const { data: memberships, error: memberError } = await supabase
      .from('org_members')
      .select('organization_id, role')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (memberError) {
      console.error('Membership query error:', memberError);
      return res.status(500).json({ error: 'Failed to fetch memberships' });
    }

    if (!memberships || memberships.length === 0) {
      return res.json({ organizations: [] });
    }

    const orgIds = memberships.map((m: { organization_id: string }) => m.organization_id);

    // Fetch the organizations
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, slug, plan')
      .in('id', orgIds);

    if (orgError) {
      console.error('Organizations query error:', orgError);
      return res.status(500).json({ error: 'Failed to fetch organizations' });
    }

    // Fetch member counts per organization
    const { data: memberCounts, error: countError } = await supabase
      .from('org_members')
      .select('organization_id')
      .in('organization_id', orgIds)
      .eq('status', 'active');

    if (countError) {
      console.error('Member count query error:', countError);
      return res.status(500).json({ error: 'Failed to fetch member counts' });
    }

    // Build a count map
    const countMap: Record<string, number> = {};
    if (memberCounts) {
      for (const row of memberCounts) {
        countMap[row.organization_id] = (countMap[row.organization_id] || 0) + 1;
      }
    }

    // Build a role map from the user's memberships
    const roleMap: Record<string, string> = {};
    for (const m of memberships) {
      roleMap[m.organization_id] = m.role;
    }

    const organizations = (orgs || []).map((org: { id: string; name: string; slug: string; plan: string }) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      role: roleMap[org.id] || 'viewer',
      memberCount: countMap[org.id] || 0
    }));

    return res.json({ organizations });
  } catch (error) {
    console.error('GET /current error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// 3. GET /:orgId  --  Get organization details (requires membership)
// ---------------------------------------------------------------------------
router.get('/:orgId', async (req: Request, res: Response) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { orgId } = req.params;

    // Verify membership
    const membership = await getMembership(userId, orgId);
    if (!membership) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not a member of this organization'
      });
    }

    // Fetch organization
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, slug, plan, settings, created_at, updated_at')
      .eq('id', orgId)
      .single();

    if (orgError || !organization) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Organization not found'
      });
    }

    // Fetch all active members
    const { data: members, error: membersError } = await supabase
      .from('org_members')
      .select('id, user_id, role, joined_at, status')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .order('joined_at', { ascending: true });

    if (membersError) {
      console.error('Members query error:', membersError);
      return res.status(500).json({ error: 'Failed to fetch members' });
    }

    return res.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        plan: organization.plan,
        settings: organization.settings,
        createdAt: organization.created_at,
        updatedAt: organization.updated_at
      },
      members: (members || []).map((m: { id: string; user_id: string; role: string; joined_at: string; status: string }) => ({
        id: m.id,
        userId: m.user_id,
        role: m.role,
        joinedAt: m.joined_at,
        status: m.status
      })),
      currentUserRole: membership.role
    });
  } catch (error) {
    console.error('GET /:orgId error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// 4. PATCH /:orgId  --  Update organization settings (requires admin)
// ---------------------------------------------------------------------------
router.patch('/:orgId', async (req: Request, res: Response) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { orgId } = req.params;

    // Verify membership and admin role
    const membership = await getMembership(userId, orgId);
    if (!membership) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not a member of this organization'
      });
    }

    if (membership.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admins can update organization settings'
      });
    }

    const { name, settings } = req.body;

    // Build the update payload — only include fields that were provided
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Organization name must be a non-empty string'
        });
      }
      updates.name = name.trim();
    }

    if (settings !== undefined) {
      if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Settings must be a JSON object'
        });
      }
      updates.settings = settings;
    }

    // Require at least one field to update
    if (!name && settings === undefined) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Provide at least one field to update (name, settings)'
      });
    }

    const { data: updated, error: updateError } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', orgId)
      .select('id, name, slug, plan, settings, updated_at')
      .single();

    if (updateError || !updated) {
      console.error('Organization update error:', updateError);
      return res.status(500).json({ error: 'Failed to update organization' });
    }

    return res.json({
      success: true,
      organization: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        plan: updated.plan,
        settings: updated.settings,
        updatedAt: updated.updated_at
      }
    });
  } catch (error) {
    console.error('PATCH /:orgId error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// 5. POST /:orgId/invite  --  Generate an invite code (requires admin)
// ---------------------------------------------------------------------------
router.post('/:orgId/invite', async (req: Request, res: Response) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { orgId } = req.params;

    // Verify membership and admin role
    const membership = await getMembership(userId, orgId);
    if (!membership) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not a member of this organization'
      });
    }

    if (membership.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admins can generate invite codes'
      });
    }

    const {
      role = 'csm',
      maxUses = 1,
      expiresInDays = 7
    } = req.body;

    // Validate role
    const allowedRoles = ['csm', 'viewer'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Role must be one of: ${allowedRoles.join(', ')}`
      });
    }

    // Validate maxUses
    if (typeof maxUses !== 'number' || maxUses < 1 || maxUses > 100) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'maxUses must be a number between 1 and 100'
      });
    }

    // Validate expiresInDays
    if (typeof expiresInDays !== 'number' || expiresInDays < 1 || expiresInDays > 90) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'expiresInDays must be a number between 1 and 90'
      });
    }

    const code = generateInviteCode();
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

    // Validate that organization exists before creating invite
    const { data: orgExists, error: orgCheckError } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', orgId)
      .maybeSingle();

    if (orgCheckError) {
      console.error('Organization check error:', orgCheckError);
      return res.status(500).json({
        error: 'Failed to validate organization',
        details: orgCheckError.message
      });
    }

    if (!orgExists) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Organization not found'
      });
    }

    const { error: insertError } = await supabase
      .from('invite_codes')
      .insert({
        organization_id: orgId,
        code,
        role,
        created_by: userId,
        max_uses: maxUses,
        uses_remaining: maxUses,
        expires_at: expiresAt,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Invite code insert error:', insertError);
      return res.status(500).json({
        error: 'Failed to generate invite code',
        details: insertError.message
      });
    }

    return res.status(201).json({
      success: true,
      code,
      expiresAt
    });
  } catch (error) {
    console.error('POST /:orgId/invite error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// 6. POST /join  --  Join an organization with an invite code
// ---------------------------------------------------------------------------
router.post('/join', async (req: Request, res: Response) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { code } = req.body;

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invite code is required'
      });
    }

    const normalizedCode = code.trim().toLowerCase();

    // Look up the invite code
    const { data: invite, error: inviteError } = await supabase
      .from('invite_codes')
      .select('id, organization_id, code, role, uses_remaining, expires_at')
      .eq('code', normalizedCode)
      .maybeSingle();

    if (inviteError) {
      console.error('Invite lookup error:', inviteError);
      return res.status(500).json({ error: 'Failed to validate invite code' });
    }

    if (!invite) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Invalid invite code'
      });
    }

    // Check expiration
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({
        error: 'Expired',
        message: 'This invite code has expired'
      });
    }

    // Check remaining uses
    if (invite.uses_remaining <= 0) {
      return res.status(410).json({
        error: 'Exhausted',
        message: 'This invite code has been fully used'
      });
    }

    // Check if user is already a member
    const existingMembership = await getMembership(userId, invite.organization_id);
    if (existingMembership) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'You are already a member of this organization'
      });
    }

    // Add the user as a member
    const { error: memberError } = await supabase
      .from('org_members')
      .insert({
        organization_id: invite.organization_id,
        user_id: userId,
        role: invite.role,
        invited_at: new Date().toISOString(),
        joined_at: new Date().toISOString(),
        status: 'active'
      });

    if (memberError) {
      console.error('Member insert error:', memberError);
      return res.status(500).json({ error: 'Failed to join organization' });
    }

    // Decrement uses_remaining
    const { error: decrementError } = await supabase
      .from('invite_codes')
      .update({ uses_remaining: invite.uses_remaining - 1 })
      .eq('id', invite.id);

    if (decrementError) {
      // Non-fatal: the user has already been added. Log and continue.
      console.error('Invite code decrement error:', decrementError);
    }

    // Fetch the organization details for the response
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .eq('id', invite.organization_id)
      .single();

    if (orgError || !organization) {
      // Membership was created, but org fetch failed. Return success with limited info.
      return res.json({
        success: true,
        organization: {
          id: invite.organization_id,
          name: null,
          slug: null
        }
      });
    }

    return res.json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug
      }
    });
  } catch (error) {
    console.error('POST /join error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
