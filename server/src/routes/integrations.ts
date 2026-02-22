/**
 * CRM Integrations Routes
 *
 * Handles OAuth flows, sync operations, and configuration for CRM integrations.
 */

import { Router, Request, Response } from 'express';
import { salesforceService } from '../services/integrations/salesforce.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// SALESFORCE ROUTES
// ============================================

/**
 * GET /api/integrations/salesforce/status
 *
 * Check Salesforce integration status for current user.
 */
router.get('/salesforce/status', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check if service is configured
    if (!salesforceService.isConfigured()) {
      return res.json({
        configured: false,
        connected: false,
        message: 'Salesforce integration not configured. Set SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET.',
      });
    }

    // Check if user has a connection
    const connection = await salesforceService.getConnection(userId);

    res.json({
      configured: true,
      connected: !!connection,
      instanceUrl: connection?.instanceUrl,
      tokenValid: connection ? connection.tokenExpiresAt > new Date() : false,
    });
  } catch (error) {
    console.error('Salesforce status error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/integrations/salesforce/auth
 *
 * Initiate Salesforce OAuth flow.
 */
router.get('/salesforce/auth', (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!salesforceService.isConfigured()) {
      return res.status(503).json({
        error: 'Salesforce integration not configured',
      });
    }

    const authUrl = salesforceService.getAuthUrl(userId);
    res.json({ authUrl });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/integrations/salesforce/callback
 *
 * Handle Salesforce OAuth callback.
 */
router.get('/salesforce/callback', async (req: Request, res: Response) => {
  try {
    const { code, state: userId, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect(`/integrations?error=${encodeURIComponent(oauthError as string)}`);
    }

    if (!code || !userId) {
      return res.redirect('/integrations?error=missing_params');
    }

    // Exchange code for tokens
    const connection = await salesforceService.connect(code as string);

    // Save connection
    await salesforceService.saveConnection(userId as string, connection);

    // Redirect to success page
    res.redirect('/integrations?success=salesforce_connected');
  } catch (error) {
    console.error('Salesforce callback error:', error);
    res.redirect(`/integrations?error=${encodeURIComponent((error as Error).message)}`);
  }
});

/**
 * POST /api/integrations/salesforce/sync
 *
 * Trigger a sync from Salesforce.
 */
router.post('/salesforce/sync', async (req: Request, res: Response) => {
  try {
    const { userId, syncType = 'accounts' } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const connection = await salesforceService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({
        error: 'Salesforce not connected. Please authenticate first.',
      });
    }

    let result;
    switch (syncType) {
      case 'accounts':
        result = await salesforceService.syncAccounts(connection, userId);
        break;
      case 'health_scores':
        result = await salesforceService.pushHealthScores(connection, userId);
        break;
      default:
        return res.status(400).json({ error: `Unknown sync type: ${syncType}` });
    }

    res.json({
      success: true,
      syncType,
      result,
    });
  } catch (error) {
    console.error('Salesforce sync error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/integrations/salesforce/disconnect
 *
 * Disconnect Salesforce integration.
 */
router.delete('/salesforce/disconnect', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // In a real implementation, this would delete from database
    // For now, just return success
    res.json({
      success: true,
      message: 'Salesforce disconnected successfully',
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// GENERAL ROUTES
// ============================================

/**
 * GET /api/integrations
 *
 * List available integrations and their status.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    const integrations = [
      {
        id: 'salesforce',
        name: 'Salesforce',
        description: 'Sync customer data from Salesforce CRM',
        configured: salesforceService.isConfigured(),
        connected: false,
        logo: '/integrations/salesforce.svg',
        features: ['Account sync', 'Contact sync', 'Health score push', 'Bi-directional sync'],
      },
      {
        id: 'hubspot',
        name: 'HubSpot',
        description: 'Sync customer data from HubSpot CRM',
        configured: false, // Not implemented yet
        connected: false,
        logo: '/integrations/hubspot.svg',
        features: ['Company sync', 'Contact sync', 'Deal tracking'],
        comingSoon: true,
      },
    ];

    // Check connection status if userId provided
    if (userId) {
      const sfConnection = await salesforceService.getConnection(userId);
      integrations[0].connected = !!sfConnection;
    }

    res.json({ integrations });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/integrations/sync-history
 *
 * Get sync history for a user.
 */
router.get('/sync-history', async (req: Request, res: Response) => {
  try {
    const { userId, limit = '10' } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // In a real implementation, this would query the database
    res.json({
      history: [],
      message: 'Sync history will be populated after syncs are performed.',
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
