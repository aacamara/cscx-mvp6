/**
 * Team Routes
 * Backend routes for team/member management within an organization.
 *
 * Endpoints:
 * - GET    /                         - List members of the current user's organization
 * - PATCH  /:memberId/role           - Update a member's role (admin only)
 * - DELETE /:memberId                - Deactivate a member (admin only, soft delete)
 * - POST   /:memberId/assign-customers - Assign customers to a CSM
 * - GET    /:memberId/customers      - Get a member's assigned customers
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// All routes require authentication
router.use(authMiddleware);

// Valid role values
const VALID_ROLES = ['admin', 'csm', 'viewer'] as const;
type MemberRole = typeof VALID_ROLES[number];

/**
 * GET /
 * List members of the current user's organization.
 * Returns member info with assigned customer counts.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const organizationId = req.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        error: { code: 'MISSING_ORG', message: 'Organization context is required' }
      });
    }

    if (!supabase) {
      return res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Database not configured' }
      });
    }

    // Fetch all org members for this organization (exclude deactivated by default)
    const { data: members, error: membersError } = await supabase
      .from('org_members')
      .select('id, user_id, role, status, invited_by, invited_at, joined_at')
      .eq('organization_id', organizationId)
      .in('status', ['active', 'invited']);

    if (membersError) {
      console.error('Failed to fetch org members:', membersError);
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch team members' }
      });
    }

    if (!members || members.length === 0) {
      return res.json({ members: [] });
    }

    // Collect unique user IDs to look up user info
    const userIds = members.map(m => m.user_id);

    // Get user profiles (email, name) via Supabase auth admin API
    // We batch-fetch all users and filter to the ones we need
    let userMap: Record<string, { email: string; name: string | null }> = {};

    // Demo user name map (for demo/dev mode when auth admin API isn't available)
    const DEMO_USER_NAMES: Record<string, { email: string; name: string }> = {
      'df2dc7be-ece0-40b2-a9d7-0f6c45b75131': { email: 'admin@acmecs.com', name: 'Aziz Camara' },
      'd0000000-0000-0000-0000-c00000000001': { email: 'sarah.chen@acmecs.com', name: 'Sarah Chen' },
      'd0000000-0000-0000-0000-c00000000002': { email: 'marcus.r@acmecs.com', name: 'Marcus Rodriguez' },
      'd0000000-0000-0000-0000-c00000000003': { email: 'priya.p@acmecs.com', name: 'Priya Patel' },
      'd0000000-0000-0000-0000-c00000000004': { email: 'jordan.t@acmecs.com', name: 'Jordan Taylor' },
    };

    try {
      const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({
        perPage: 1000,
      });

      if (!usersError && usersData?.users) {
        for (const user of usersData.users) {
          if (userIds.includes(user.id)) {
            userMap[user.id] = {
              email: user.email || '',
              name: user.user_metadata?.full_name || user.user_metadata?.name || null,
            };
          }
        }
      }
    } catch (authError) {
      // If auth admin API fails, we'll still return members without email/name
      console.warn('Could not fetch user details from auth:', authError);
    }

    // Fill in any missing users from demo name map
    for (const uid of userIds) {
      if (!userMap[uid] && DEMO_USER_NAMES[uid]) {
        userMap[uid] = DEMO_USER_NAMES[uid];
      }
    }

    // Get assigned customer counts per user_id within this org
    const { data: customerCounts, error: countError } = await supabase
      .from('customers')
      .select('csm_id')
      .eq('organization_id', organizationId)
      .not('csm_id', 'is', null);

    // Build a map of csm_id -> count
    const csmCountMap: Record<string, number> = {};
    if (!countError && customerCounts) {
      for (const row of customerCounts) {
        if (row.csm_id) {
          csmCountMap[row.csm_id] = (csmCountMap[row.csm_id] || 0) + 1;
        }
      }
    }

    // Assemble response
    const result = members.map(member => ({
      id: member.id,
      userId: member.user_id,
      email: userMap[member.user_id]?.email || null,
      name: userMap[member.user_id]?.name || null,
      role: member.role,
      status: member.status,
      joinedAt: member.joined_at,
      assignedCustomerCount: csmCountMap[member.user_id] || 0,
    }));

    res.json({ members: result });
  } catch (error) {
    console.error('List team members error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list team members' }
    });
  }
});

/**
 * PATCH /:memberId/role
 * Update a member's role (admin only).
 * Prevents the last admin from being demoted.
 */
router.patch('/:memberId/role', async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const { role } = req.body;
    const organizationId = req.organizationId;

    // Admin-only check
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only admins can update member roles' }
      });
    }

    if (!organizationId) {
      return res.status(400).json({
        error: { code: 'MISSING_ORG', message: 'Organization context is required' }
      });
    }

    if (!supabase) {
      return res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Database not configured' }
      });
    }

    // Validate role
    if (!role || !VALID_ROLES.includes(role as MemberRole)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`
        }
      });
    }

    // Fetch the target member to verify they belong to this org
    const { data: targetMember, error: fetchError } = await supabase
      .from('org_members')
      .select('id, user_id, role, status, organization_id')
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !targetMember) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Member not found in this organization' }
      });
    }

    // If demoting from admin, ensure they are not the last admin
    if (targetMember.role === 'admin' && role !== 'admin') {
      const { count: adminCount, error: countError } = await supabase
        .from('org_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('role', 'admin')
        .eq('status', 'active');

      if (countError) {
        console.error('Failed to count admins:', countError);
        return res.status(500).json({
          error: { code: 'INTERNAL_ERROR', message: 'Failed to verify admin count' }
        });
      }

      if ((adminCount || 0) <= 1) {
        return res.status(400).json({
          error: {
            code: 'LAST_ADMIN',
            message: 'Cannot demote the last admin. Promote another member to admin first.'
          }
        });
      }
    }

    // Update the role
    const { data: updatedMember, error: updateError } = await supabase
      .from('org_members')
      .update({ role })
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .select('id, user_id, role, status, joined_at')
      .single();

    if (updateError) {
      console.error('Failed to update member role:', updateError);
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update member role' }
      });
    }

    res.json({
      message: 'Member role updated successfully',
      member: {
        id: updatedMember.id,
        userId: updatedMember.user_id,
        role: updatedMember.role,
        status: updatedMember.status,
        joinedAt: updatedMember.joined_at,
      }
    });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update member role' }
    });
  }
});

/**
 * DELETE /:memberId
 * Deactivate a member (admin only, soft delete).
 * Sets status to 'deactivated' rather than deleting the row.
 * Prevents deactivating yourself.
 */
router.delete('/:memberId', async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const organizationId = req.organizationId;
    const currentUserId = req.userId;

    // Admin-only check
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only admins can deactivate members' }
      });
    }

    if (!organizationId) {
      return res.status(400).json({
        error: { code: 'MISSING_ORG', message: 'Organization context is required' }
      });
    }

    if (!supabase) {
      return res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Database not configured' }
      });
    }

    // Fetch the target member
    const { data: targetMember, error: fetchError } = await supabase
      .from('org_members')
      .select('id, user_id, role, status, organization_id')
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !targetMember) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Member not found in this organization' }
      });
    }

    // Prevent self-deactivation
    if (targetMember.user_id === currentUserId) {
      return res.status(400).json({
        error: {
          code: 'SELF_DEACTIVATION',
          message: 'You cannot deactivate yourself. Ask another admin to do this.'
        }
      });
    }

    // If the target is already deactivated, return early
    if (targetMember.status === 'deactivated') {
      return res.status(400).json({
        error: { code: 'ALREADY_DEACTIVATED', message: 'Member is already deactivated' }
      });
    }

    // Soft delete: set status to 'deactivated'
    const { error: updateError } = await supabase
      .from('org_members')
      .update({ status: 'deactivated' })
      .eq('id', memberId)
      .eq('organization_id', organizationId);

    if (updateError) {
      console.error('Failed to deactivate member:', updateError);
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to deactivate member' }
      });
    }

    res.json({ message: 'Member deactivated successfully' });
  } catch (error) {
    console.error('Deactivate member error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to deactivate member' }
    });
  }
});

/**
 * POST /:memberId/assign-customers
 * Assign customers to a CSM.
 * Updates customers.csm_id for the given customer IDs within the org.
 * Only works if the target member's role is 'csm'.
 */
router.post('/:memberId/assign-customers', async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const { customerIds } = req.body;
    const organizationId = req.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        error: { code: 'MISSING_ORG', message: 'Organization context is required' }
      });
    }

    if (!supabase) {
      return res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Database not configured' }
      });
    }

    // Validate customerIds
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'customerIds must be a non-empty array of strings' }
      });
    }

    // Fetch the target member to verify they belong to this org and have 'csm' role
    const { data: targetMember, error: fetchError } = await supabase
      .from('org_members')
      .select('id, user_id, role, status, organization_id')
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !targetMember) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Member not found in this organization' }
      });
    }

    if (targetMember.role !== 'csm') {
      return res.status(400).json({
        error: {
          code: 'INVALID_ROLE',
          message: 'Customers can only be assigned to members with the CSM role'
        }
      });
    }

    if (targetMember.status !== 'active') {
      return res.status(400).json({
        error: {
          code: 'INACTIVE_MEMBER',
          message: 'Cannot assign customers to an inactive or deactivated member'
        }
      });
    }

    // Update customers: set csm_id to the member's user_id
    // Only update customers that belong to this organization
    const { data: updatedCustomers, error: updateError } = await supabase
      .from('customers')
      .update({ csm_id: targetMember.user_id })
      .eq('organization_id', organizationId)
      .in('id', customerIds)
      .select('id, name');

    if (updateError) {
      console.error('Failed to assign customers:', updateError);
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to assign customers' }
      });
    }

    const assignedCount = updatedCustomers?.length || 0;
    const requestedCount = customerIds.length;

    res.json({
      message: `Successfully assigned ${assignedCount} customer(s) to the CSM`,
      assignedCount,
      requestedCount,
      skippedCount: requestedCount - assignedCount,
      assignedCustomers: updatedCustomers || [],
    });
  } catch (error) {
    console.error('Assign customers error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to assign customers' }
    });
  }
});

/**
 * GET /:memberId/customers
 * Get a member's assigned customers.
 * Returns customers where csm_id matches the member's user_id
 * within the current organization.
 */
router.get('/:memberId/customers', async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const organizationId = req.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        error: { code: 'MISSING_ORG', message: 'Organization context is required' }
      });
    }

    if (!supabase) {
      return res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Database not configured' }
      });
    }

    // Fetch the target member to get their user_id
    const { data: targetMember, error: fetchError } = await supabase
      .from('org_members')
      .select('id, user_id, role, organization_id')
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !targetMember) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Member not found in this organization' }
      });
    }

    // Fetch customers assigned to this member's user_id within the org
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('*')
      .eq('csm_id', targetMember.user_id)
      .eq('organization_id', organizationId)
      .order('name', { ascending: true });

    if (customersError) {
      console.error('Failed to fetch assigned customers:', customersError);
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch assigned customers' }
      });
    }

    res.json({
      memberId: targetMember.id,
      userId: targetMember.user_id,
      role: targetMember.role,
      customers: (customers || []).map(c => ({
        id: c.id,
        name: c.name,
        industry: c.industry,
        arr: c.arr || 0,
        healthScore: c.health_score || 0,
        status: c.stage || c.status || 'active',
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
      totalCount: customers?.length || 0,
    });
  } catch (error) {
    console.error('Get member customers error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get member customers' }
    });
  }
});

export default router;
