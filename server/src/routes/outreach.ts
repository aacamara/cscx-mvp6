/**
 * Outreach Routes
 * PRD-191: API endpoints for Outreach.io sequence trigger integration
 */

import { Router, Request, Response } from 'express';
import { outreachService, outreachOAuth } from '../services/outreach/index.js';
import { OutreachTriggerType } from '../services/outreach/types.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// ============================================
// OAuth Routes
// ============================================

/**
 * POST /api/outreach/connect
 * Initiate Outreach OAuth flow
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const redirectUri = req.body.redirectUri;
    const authUrl = outreachOAuth.getAuthorizationUrl(userId, redirectUri);

    res.json({ authUrl });
  } catch (error) {
    console.error('[Outreach Routes] Connect error:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

/**
 * GET /api/outreach/callback
 * Handle Outreach OAuth callback
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.error('[Outreach Routes] OAuth error:', error);
      return res.redirect(`/settings/integrations?outreach_error=${encodeURIComponent(error as string)}`);
    }

    if (!code || !state) {
      return res.redirect('/settings/integrations?outreach_error=missing_params');
    }

    const result = await outreachOAuth.completeOAuth(code as string, state as string);

    if (result.success) {
      res.redirect(`/settings/integrations?outreach_connected=true&email=${encodeURIComponent(result.email || '')}`);
    } else {
      res.redirect(`/settings/integrations?outreach_error=${encodeURIComponent(result.error || 'unknown')}`);
    }
  } catch (error) {
    console.error('[Outreach Routes] Callback error:', error);
    res.redirect('/settings/integrations?outreach_error=callback_failed');
  }
});

/**
 * GET /api/outreach/status
 * Get Outreach connection status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const status = await outreachOAuth.getConnectionStatus(userId);
    res.json(status);
  } catch (error) {
    console.error('[Outreach Routes] Status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * DELETE /api/outreach/disconnect
 * Disconnect Outreach
 */
router.delete('/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    await outreachOAuth.disconnect(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('[Outreach Routes] Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// ============================================
// Sequence Routes (FR-2)
// ============================================

/**
 * GET /api/outreach/sequences
 * List available sequences from Outreach
 */
router.get('/sequences', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const forceRefresh = req.query.refresh === 'true';
    const limit = parseInt(req.query.limit as string) || 100;

    const sequences = await outreachService.listSequences(userId, { forceRefresh, limit });

    res.json({ sequences });
  } catch (error) {
    console.error('[Outreach Routes] List sequences error:', error);
    res.status(500).json({ error: 'Failed to list sequences' });
  }
});

/**
 * GET /api/outreach/sequences/:sequenceId
 * Get a specific sequence
 */
router.get('/sequences/:sequenceId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const sequenceId = parseInt(req.params.sequenceId);
    if (isNaN(sequenceId)) {
      return res.status(400).json({ error: 'Invalid sequence ID' });
    }

    const sequence = await outreachService.getSequence(userId, sequenceId);
    if (!sequence) {
      return res.status(404).json({ error: 'Sequence not found' });
    }

    res.json({ sequence });
  } catch (error) {
    console.error('[Outreach Routes] Get sequence error:', error);
    res.status(500).json({ error: 'Failed to get sequence' });
  }
});

/**
 * GET /api/outreach/sequences/:sequenceId/metrics
 * Get sequence metrics
 */
router.get('/sequences/:sequenceId/metrics', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const sequenceId = parseInt(req.params.sequenceId);
    if (isNaN(sequenceId)) {
      return res.status(400).json({ error: 'Invalid sequence ID' });
    }

    const metrics = await outreachService.getSequenceMetrics(userId, sequenceId);
    if (!metrics) {
      return res.status(404).json({ error: 'Sequence not found' });
    }

    res.json({ metrics });
  } catch (error) {
    console.error('[Outreach Routes] Get metrics error:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// ============================================
// Prospect Routes (FR-3)
// ============================================

/**
 * POST /api/outreach/prospects
 * Create or sync a prospect from stakeholder
 */
router.post('/prospects', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { stakeholderId } = req.body;

    if (!stakeholderId) {
      return res.status(400).json({ error: 'stakeholderId is required' });
    }

    // Get stakeholder from database
    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const { data: stakeholder, error: stakeholderError } = await supabase
      .from('stakeholders')
      .select('*, customers(id, name)')
      .eq('id', stakeholderId)
      .single();

    if (stakeholderError || !stakeholder) {
      return res.status(404).json({ error: 'Stakeholder not found' });
    }

    const prospect = await outreachService.syncStakeholderToProspect(userId, {
      id: stakeholder.id,
      name: stakeholder.name,
      email: stakeholder.email,
      role: stakeholder.role,
      phone: stakeholder.phone,
      linkedinUrl: stakeholder.linkedin_url,
      customerId: stakeholder.customer_id,
      customerName: stakeholder.customers?.name,
    });

    res.json({ prospect });
  } catch (error) {
    console.error('[Outreach Routes] Create prospect error:', error);
    res.status(500).json({ error: 'Failed to create prospect' });
  }
});

/**
 * GET /api/outreach/prospects/by-email/:email
 * Find a prospect by email
 */
router.get('/prospects/by-email/:email', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const prospect = await outreachService.findProspectByEmail(userId, req.params.email);

    if (!prospect) {
      return res.status(404).json({ error: 'Prospect not found' });
    }

    res.json({ prospect });
  } catch (error) {
    console.error('[Outreach Routes] Find prospect error:', error);
    res.status(500).json({ error: 'Failed to find prospect' });
  }
});

// ============================================
// Enrollment Routes (FR-4)
// ============================================

/**
 * POST /api/outreach/enroll
 * Enroll a stakeholder in a sequence
 */
router.post('/enroll', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { stakeholderId, sequenceId, triggerType, skipApproval, mailboxId } = req.body;

    if (!stakeholderId || !sequenceId) {
      return res.status(400).json({ error: 'stakeholderId and sequenceId are required' });
    }

    // Get stakeholder from database
    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const { data: stakeholder, error: stakeholderError } = await supabase
      .from('stakeholders')
      .select('*, customers(id, name)')
      .eq('id', stakeholderId)
      .single();

    if (stakeholderError || !stakeholder) {
      return res.status(404).json({ error: 'Stakeholder not found' });
    }

    const enrollment = await outreachService.enrollStakeholder(
      userId,
      {
        stakeholderId,
        sequenceId,
        triggerType: triggerType as OutreachTriggerType,
        skipApproval,
        mailboxId,
      },
      {
        name: stakeholder.name,
        email: stakeholder.email,
        role: stakeholder.role,
        customerId: stakeholder.customer_id,
        customerName: stakeholder.customers?.name,
      }
    );

    res.status(201).json({ enrollment });
  } catch (error) {
    console.error('[Outreach Routes] Enroll error:', error);
    res.status(500).json({ error: 'Failed to enroll stakeholder' });
  }
});

/**
 * POST /api/outreach/enrollments/:enrollmentId/approve
 * Approve a pending enrollment (HITL)
 */
router.post('/enrollments/:enrollmentId/approve', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const enrollment = await outreachService.approveEnrollment(
      userId,
      req.params.enrollmentId,
      userId
    );

    res.json({ enrollment });
  } catch (error) {
    console.error('[Outreach Routes] Approve error:', error);
    res.status(500).json({ error: 'Failed to approve enrollment' });
  }
});

/**
 * POST /api/outreach/enrollments/:enrollmentId/reject
 * Reject a pending enrollment
 */
router.post('/enrollments/:enrollmentId/reject', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { reason } = req.body;

    const enrollment = await outreachService.rejectEnrollment(
      userId,
      req.params.enrollmentId,
      userId,
      reason
    );

    res.json({ enrollment });
  } catch (error) {
    console.error('[Outreach Routes] Reject error:', error);
    res.status(500).json({ error: 'Failed to reject enrollment' });
  }
});

// ============================================
// Status Routes (FR-6)
// ============================================

/**
 * GET /api/outreach/status/:stakeholderId
 * Get sequence status for a stakeholder
 */
router.get('/status/:stakeholderId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const status = await outreachService.getStakeholderStatus(userId, req.params.stakeholderId);

    if (!status) {
      return res.status(404).json({ error: 'Stakeholder not found' });
    }

    res.json({ status });
  } catch (error) {
    console.error('[Outreach Routes] Get status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// ============================================
// Pause/Resume Routes (FR-7)
// ============================================

/**
 * PUT /api/outreach/pause/:stakeholderId
 * Pause sequences for a stakeholder
 */
router.put('/pause/:stakeholderId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { enrollmentId } = req.body;

    if (!enrollmentId) {
      return res.status(400).json({ error: 'enrollmentId is required' });
    }

    const enrollment = await outreachService.pauseEnrollment(userId, enrollmentId);
    res.json({ enrollment });
  } catch (error) {
    console.error('[Outreach Routes] Pause error:', error);
    res.status(500).json({ error: 'Failed to pause enrollment' });
  }
});

/**
 * PUT /api/outreach/resume/:stakeholderId
 * Resume sequences for a stakeholder
 */
router.put('/resume/:stakeholderId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { enrollmentId } = req.body;

    if (!enrollmentId) {
      return res.status(400).json({ error: 'enrollmentId is required' });
    }

    const enrollment = await outreachService.resumeEnrollment(userId, enrollmentId);
    res.json({ enrollment });
  } catch (error) {
    console.error('[Outreach Routes] Resume error:', error);
    res.status(500).json({ error: 'Failed to resume enrollment' });
  }
});

/**
 * DELETE /api/outreach/remove/:stakeholderId
 * Remove stakeholder from sequence
 */
router.delete('/remove/:stakeholderId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { enrollmentId } = req.body;

    if (!enrollmentId) {
      return res.status(400).json({ error: 'enrollmentId is required' });
    }

    await outreachService.removeEnrollment(userId, enrollmentId);
    res.json({ success: true });
  } catch (error) {
    console.error('[Outreach Routes] Remove error:', error);
    res.status(500).json({ error: 'Failed to remove from sequence' });
  }
});

// ============================================
// Mapping Routes (FR-5)
// ============================================

/**
 * GET /api/outreach/mappings
 * List trigger-sequence mappings
 */
router.get('/mappings', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const mappings = await outreachService.listMappings(userId);
    res.json({ mappings });
  } catch (error) {
    console.error('[Outreach Routes] List mappings error:', error);
    res.status(500).json({ error: 'Failed to list mappings' });
  }
});

/**
 * POST /api/outreach/mappings
 * Create a trigger-sequence mapping
 */
router.post('/mappings', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const {
      triggerType,
      sequenceId,
      sequenceName,
      stakeholderRoles,
      segmentFilter,
      healthThreshold,
      daysBeforeRenewal,
      enabled,
      requiresApproval,
    } = req.body;

    if (!triggerType || !sequenceId || !sequenceName) {
      return res.status(400).json({ error: 'triggerType, sequenceId, and sequenceName are required' });
    }

    const mapping = await outreachService.createMapping(userId, {
      triggerType,
      sequenceId,
      sequenceName,
      stakeholderRoles,
      segmentFilter,
      healthThreshold,
      daysBeforeRenewal,
      enabled,
      requiresApproval,
    });

    res.status(201).json({ mapping });
  } catch (error) {
    console.error('[Outreach Routes] Create mapping error:', error);
    res.status(500).json({ error: 'Failed to create mapping' });
  }
});

/**
 * PUT /api/outreach/mappings/:mappingId
 * Update a trigger-sequence mapping
 */
router.put('/mappings/:mappingId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const mapping = await outreachService.updateMapping(
      userId,
      req.params.mappingId,
      req.body
    );

    res.json({ mapping });
  } catch (error) {
    console.error('[Outreach Routes] Update mapping error:', error);
    res.status(500).json({ error: 'Failed to update mapping' });
  }
});

/**
 * DELETE /api/outreach/mappings/:mappingId
 * Delete a trigger-sequence mapping
 */
router.delete('/mappings/:mappingId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    await outreachService.deleteMapping(userId, req.params.mappingId);
    res.json({ success: true });
  } catch (error) {
    console.error('[Outreach Routes] Delete mapping error:', error);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
});

// ============================================
// Sync Route
// ============================================

/**
 * POST /api/outreach/sync
 * Sync enrollment status from Outreach
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const updated = await outreachService.syncEnrollmentStatus(userId);
    res.json({ success: true, updated });
  } catch (error) {
    console.error('[Outreach Routes] Sync error:', error);
    res.status(500).json({ error: 'Failed to sync status' });
  }
});

// ============================================
// Health Check
// ============================================

/**
 * GET /api/outreach/health
 * Health check for Outreach integration
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.json({
        status: 'unknown',
        message: 'User ID required for health check',
      });
    }

    const connected = await outreachOAuth.isConnected(userId);

    if (!connected) {
      return res.json({
        status: 'disconnected',
        message: 'Outreach not connected',
      });
    }

    const healthy = await outreachService.healthCheck(userId);
    const circuitBreaker = outreachService.getCircuitBreakerStats();

    res.json({
      status: healthy ? 'healthy' : 'unhealthy',
      circuitBreaker: {
        state: circuitBreaker.state,
        failures: circuitBreaker.failures,
      },
    });
  } catch (error) {
    console.error('[Outreach Routes] Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: (error as Error).message,
    });
  }
});

export default router;
