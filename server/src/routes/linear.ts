/**
 * Linear Integration Routes - PRD-202
 *
 * Handles OAuth flows, issue sync, and webhook processing for Linear integration.
 * Implements all endpoints for:
 * - Linear OAuth authentication (FR-1)
 * - Issue sync by customer label (FR-2)
 * - Customer-issue linking (FR-3)
 * - Issue creation with customer context (FR-4)
 * - Webhook processing for state changes (FR-5)
 * - Issue impact tracking (FR-6)
 */

import { Router, Request, Response } from 'express';
import { linearService, LinearSyncConfig, IssueCreateInput } from '../services/integrations/linear.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// OAUTH ROUTES
// ============================================

/**
 * POST /api/integrations/linear/connect
 *
 * Initiate Linear OAuth flow (FR-1)
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!linearService.isConfigured()) {
      return res.status(503).json({
        error: 'Linear integration not configured. Set LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET.',
      });
    }

    const authUrl = linearService.getAuthUrl(userId);
    res.json({ authUrl });
  } catch (error) {
    console.error('Linear connect error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/integrations/linear/callback
 *
 * Handle Linear OAuth callback (FR-1)
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error: oauthError } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (oauthError) {
      return res.redirect(`${frontendUrl}/settings/integrations?error=${encodeURIComponent(oauthError as string)}`);
    }

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/settings/integrations?error=missing_params`);
    }

    // Decode state to get userId
    let stateData: { userId: string };
    try {
      stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    } catch {
      return res.redirect(`${frontendUrl}/settings/integrations?error=invalid_state`);
    }

    // Exchange code for tokens
    const connection = await linearService.connect(code as string);

    // Save connection
    await linearService.saveConnection(stateData.userId, connection);

    // Redirect to success page
    res.redirect(`${frontendUrl}/settings/integrations?success=linear_connected`);
  } catch (error) {
    console.error('Linear callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/settings/integrations?error=${encodeURIComponent((error as Error).message)}`);
  }
});

/**
 * GET /api/integrations/linear/status
 *
 * Get Linear integration status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!linearService.isConfigured()) {
      return res.json({
        configured: false,
        connected: false,
        message: 'Linear integration not configured. Set LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET.',
      });
    }

    const status = await linearService.getSyncStatus(userId);
    const circuitBreakerStatus = linearService.getCircuitBreakerStatus();

    res.json({
      configured: true,
      ...status,
      circuitBreaker: circuitBreakerStatus,
    });
  } catch (error) {
    console.error('Linear status error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/integrations/linear/disconnect
 *
 * Disconnect Linear integration
 */
router.delete('/disconnect', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    await linearService.disconnect(userId);

    res.json({
      success: true,
      message: 'Linear disconnected successfully',
    });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// ISSUE ROUTES
// ============================================

/**
 * GET /api/linear/issues/:customerId
 *
 * Get Linear issues for a customer (FR-2)
 */
router.get('/issues/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { status, limit, offset } = req.query;

    const result = await linearService.getCustomerIssues(customerId, {
      status: status as 'open' | 'completed' | 'all',
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json(result);
  } catch (error) {
    console.error('Get Linear issues error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/linear/issue/:issueId
 *
 * Get a single Linear issue
 */
router.get('/issue/:issueId', async (req: Request, res: Response) => {
  try {
    const { issueId } = req.params;
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const connection = await linearService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({ error: 'Linear not connected' });
    }

    const issue = await linearService.getIssue(connection, issueId);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const impact = await linearService.getIssueImpact(issueId);

    res.json({ issue, impact });
  } catch (error) {
    console.error('Get Linear issue error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/linear/issues
 *
 * Create a new Linear issue (FR-4)
 */
router.post('/issues', async (req: Request, res: Response) => {
  try {
    const { userId, customerId, issue } = req.body;

    if (!userId || !issue) {
      return res.status(400).json({ error: 'userId and issue are required' });
    }

    if (!issue.teamId || !issue.title) {
      return res.status(400).json({ error: 'teamId and title are required in issue' });
    }

    const connection = await linearService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({ error: 'Linear not connected' });
    }

    const createdIssue = await linearService.createIssue(connection, issue as IssueCreateInput);

    if (customerId) {
      const customerLabel = await linearService.getCustomerLabel(customerId);
      if (customerLabel) {
        await linearService.syncCustomerIssues(connection, userId, customerId, customerLabel, {
          incremental: true,
        });
      }
    }

    res.json({
      success: true,
      issue: createdIssue,
    });
  } catch (error) {
    console.error('Create Linear issue error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/linear/issue/:linearId/impact
 *
 * Get impact data for an issue (FR-6)
 */
router.get('/issue/:linearId/impact', async (req: Request, res: Response) => {
  try {
    const { linearId } = req.params;

    const impact = await linearService.getIssueImpact(linearId);

    res.json(impact);
  } catch (error) {
    console.error('Get issue impact error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// SYNC ROUTES
// ============================================

/**
 * POST /api/linear/sync
 *
 * Trigger sync for a customer's issues (FR-2)
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { userId, customerId, customerLabel, incremental = false } = req.body;

    if (!userId || !customerId) {
      return res.status(400).json({ error: 'userId and customerId are required' });
    }

    const connection = await linearService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({ error: 'Linear not connected' });
    }

    let label = customerLabel;
    if (!label) {
      label = await linearService.getCustomerLabel(customerId);
    }

    if (!label) {
      return res.status(400).json({
        error: 'No customer label configured. Set a customer label mapping first.',
      });
    }

    const result = await linearService.syncCustomerIssues(connection, userId, customerId, label, {
      incremental,
    });

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Linear sync error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/linear/history
 *
 * Get sync history
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const history = await linearService.getSyncHistory(userId, { limit, offset });

    res.json(history);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// WEBHOOK ROUTES
// ============================================

/**
 * POST /api/linear/webhook
 *
 * Handle Linear webhook (FR-5)
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['linear-signature'] as string;
    const payload = JSON.stringify(req.body);
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter required' });
    }

    if (signature && !linearService.validateWebhookSignature(payload, signature)) {
      console.warn('[Linear Webhook] Invalid signature');
    }

    const result = await linearService.processWebhook(userId as string, req.body);

    res.json({ success: result.processed, alerts: result.alerts.length });
  } catch (error) {
    console.error('Linear webhook error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// CONFIGURATION ROUTES
// ============================================

/**
 * GET /api/linear/teams
 *
 * List Linear teams
 */
router.get('/teams', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const connection = await linearService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({ error: 'Linear not connected' });
    }

    const teams = await linearService.listTeams(connection);

    res.json({ teams });
  } catch (error) {
    console.error('Get Linear teams error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/linear/labels
 *
 * List Linear labels (FR-3)
 */
router.get('/labels', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const teamId = req.query.teamId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const connection = await linearService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({ error: 'Linear not connected' });
    }

    const labels = await linearService.listLabels(connection, teamId);

    res.json({ labels });
  } catch (error) {
    console.error('Get Linear labels error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/linear/projects
 *
 * List Linear projects
 */
router.get('/projects', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const teamId = req.query.teamId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const connection = await linearService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({ error: 'Linear not connected' });
    }

    const projects = await linearService.listProjects(connection, teamId);

    res.json({ projects });
  } catch (error) {
    console.error('Get Linear projects error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/linear/customer-label
 *
 * Set customer-to-label mapping (FR-3)
 */
router.put('/customer-label', async (req: Request, res: Response) => {
  try {
    const { customerId, labelName } = req.body;

    if (!customerId || !labelName) {
      return res.status(400).json({ error: 'customerId and labelName are required' });
    }

    await linearService.setCustomerLabel(customerId, labelName);

    res.json({
      success: true,
      message: 'Customer label mapping updated',
    });
  } catch (error) {
    console.error('Set customer label error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/linear/customer-label/:customerId
 *
 * Get customer's Linear label
 */
router.get('/customer-label/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const labelName = await linearService.getCustomerLabel(customerId);

    res.json({ labelName });
  } catch (error) {
    console.error('Get customer label error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/linear/config
 *
 * Update Linear sync configuration
 */
router.put('/config', async (req: Request, res: Response) => {
  try {
    const { userId, config } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    await linearService.updateSyncConfig(userId, config as Partial<LinearSyncConfig>);

    res.json({
      success: true,
      message: 'Configuration updated successfully',
    });
  } catch (error) {
    console.error('Update config error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
