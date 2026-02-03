/**
 * Confluence Routes - PRD-204
 *
 * API endpoints for Confluence Knowledge Base integration:
 * - OAuth authentication
 * - Space configuration
 * - Content sync
 * - Search
 * - Customer page linking
 * - Page creation
 */

import { Router, Request, Response } from 'express';
import {
  confluenceService,
  ConfluencePageCreate,
  SpaceConfig,
  SyncConfig,
} from '../services/integrations/confluence.js';

const router = Router();

// ============================================
// AUTHENTICATION ROUTES
// ============================================

/**
 * POST /api/confluence/connect
 *
 * Initiate Confluence OAuth flow (FR-1)
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { userId, authType = 'oauth', baseUrl, email, apiToken } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // API Token authentication (Server/Data Center)
    if (authType === 'api_token') {
      if (!baseUrl || !email || !apiToken) {
        return res.status(400).json({
          error: 'baseUrl, email, and apiToken are required for API token authentication',
        });
      }

      try {
        const connection = await confluenceService.connectWithApiToken(baseUrl, email, apiToken);
        await confluenceService.saveConnection(userId, connection);

        return res.json({
          success: true,
          message: 'Connected to Confluence successfully',
          baseUrl,
        });
      } catch (error) {
        return res.status(400).json({ error: (error as Error).message });
      }
    }

    // OAuth authentication (Cloud)
    if (!confluenceService.isConfigured()) {
      return res.status(503).json({
        error:
          'Confluence OAuth not configured. Set CONFLUENCE_CLIENT_ID and CONFLUENCE_CLIENT_SECRET, or use API token authentication.',
      });
    }

    const authUrl = confluenceService.getAuthUrl(userId);
    res.json({ authUrl });
  } catch (error) {
    console.error('Confluence connect error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/confluence/callback
 *
 * Handle Confluence OAuth callback (FR-1)
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error: oauthError } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (oauthError) {
      return res.redirect(
        `${frontendUrl}/settings/integrations?error=${encodeURIComponent(oauthError as string)}`
      );
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
    const connection = await confluenceService.connect(code as string);

    // Save connection
    await confluenceService.saveConnection(stateData.userId, connection);

    // Redirect to success page
    res.redirect(`${frontendUrl}/settings/integrations?success=confluence_connected`);
  } catch (error) {
    console.error('Confluence callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(
      `${frontendUrl}/settings/integrations?error=${encodeURIComponent((error as Error).message)}`
    );
  }
});

/**
 * GET /api/confluence/status
 *
 * Get Confluence integration status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Get sync status
    const status = await confluenceService.getSyncStatus(userId);

    // Get connection details if connected
    let connectionDetails = null;
    if (status.connected) {
      const connection = await confluenceService.getConnection(userId);
      if (connection) {
        connectionDetails = {
          baseUrl: connection.baseUrl,
          authType: connection.authType,
          config: connection.config,
        };
      }
    }

    // Get circuit breaker status
    const circuitBreakerStatus = confluenceService.getCircuitBreakerStatus();

    res.json({
      configured: confluenceService.isConfigured(),
      ...status,
      connection: connectionDetails,
      circuitBreaker: circuitBreakerStatus,
    });
  } catch (error) {
    console.error('Confluence status error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/confluence/disconnect
 *
 * Disconnect Confluence integration
 */
router.delete('/disconnect', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    await confluenceService.disconnect(userId);

    res.json({
      success: true,
      message: 'Confluence disconnected successfully',
    });
  } catch (error) {
    console.error('Confluence disconnect error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// SPACE ROUTES (FR-3)
// ============================================

/**
 * GET /api/confluence/spaces
 *
 * List available Confluence spaces
 */
router.get('/spaces', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const limit = parseInt(req.query.limit as string) || 25;
    const start = parseInt(req.query.start as string) || 0;
    const type = req.query.type as 'global' | 'personal' | undefined;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const connection = await confluenceService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({ error: 'Confluence not connected' });
    }

    const result = await confluenceService.listSpaces(connection, { limit, start, type });

    // Get configured spaces to show selection status
    const configuredSpaces = await confluenceService.getSpaceConfigs(userId);
    const configMap = new Map(configuredSpaces.map((s) => [s.spaceKey, s]));

    const spacesWithConfig = result.spaces.map((space) => ({
      ...space,
      configured: configMap.has(space.key),
      enabled: configMap.get(space.key)?.enabled || false,
      lastSyncAt: configMap.get(space.key)?.lastSyncAt,
    }));

    res.json({
      spaces: spacesWithConfig,
      total: result.total,
    });
  } catch (error) {
    console.error('List spaces error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/confluence/spaces/config
 *
 * Configure spaces for syncing
 */
router.put('/spaces/config', async (req: Request, res: Response) => {
  try {
    const { userId, spaceConfig } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!spaceConfig || !spaceConfig.spaceKey) {
      return res.status(400).json({ error: 'spaceConfig with spaceKey is required' });
    }

    await confluenceService.updateSpaceConfig(userId, spaceConfig as SpaceConfig);

    res.json({
      success: true,
      message: 'Space configuration updated',
    });
  } catch (error) {
    console.error('Update space config error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/confluence/spaces/config
 *
 * Get configured spaces
 */
router.get('/spaces/config', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const configs = await confluenceService.getSpaceConfigs(userId);

    res.json({ configs });
  } catch (error) {
    console.error('Get space configs error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// SYNC ROUTES (FR-2)
// ============================================

/**
 * POST /api/confluence/sync
 *
 * Trigger content sync
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { userId, spaceKeys, incremental = false } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const connection = await confluenceService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({ error: 'Confluence not connected' });
    }

    // Get last sync time for incremental sync
    let lastSyncAt: Date | undefined;
    if (incremental) {
      const status = await confluenceService.getSyncStatus(userId);
      lastSyncAt = status.lastSyncAt;
    }

    const result = await confluenceService.syncPages(connection, userId, {
      spaceKeys,
      incremental,
      lastSyncAt,
    });

    res.json({
      success: true,
      incremental,
      result,
    });
  } catch (error) {
    console.error('Confluence sync error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/confluence/history
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

    const history = await confluenceService.getSyncHistory(userId, { limit, offset });

    res.json(history);
  } catch (error) {
    console.error('Confluence history error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// SEARCH ROUTES (FR-4)
// ============================================

/**
 * GET /api/confluence/search
 *
 * Search Confluence content
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const query = req.query.q as string;
    const source = req.query.source as 'local' | 'remote' | undefined;
    const limit = parseInt(req.query.limit as string) || 20;
    const spaceKeys = req.query.spaceKeys
      ? (req.query.spaceKeys as string).split(',')
      : undefined;
    const labels = req.query.labels ? (req.query.labels as string).split(',') : undefined;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!query) {
      return res.status(400).json({ error: 'query (q) is required' });
    }

    // Default to local search (synced content)
    if (source !== 'remote') {
      const results = await confluenceService.fullTextSearch(userId, query, {
        spaceKeys,
        limit,
      });

      return res.json({
        success: true,
        source: 'local',
        results,
      });
    }

    // Remote search (live Confluence API)
    const connection = await confluenceService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({ error: 'Confluence not connected' });
    }

    const results = await confluenceService.search(connection, query, {
      spaceKeys,
      labels,
      limit,
    });

    res.json({
      success: true,
      source: 'remote',
      results,
    });
  } catch (error) {
    console.error('Confluence search error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// PAGE ROUTES (FR-6, FR-7)
// ============================================

/**
 * GET /api/confluence/pages/:customerId
 *
 * Get pages linked to a customer
 */
router.get('/pages/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const pages = await confluenceService.getCustomerPages(customerId);

    res.json({ pages });
  } catch (error) {
    console.error('Get customer pages error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/confluence/pages
 *
 * Create a new page in Confluence
 */
router.post('/pages', async (req: Request, res: Response) => {
  try {
    const { userId, page, customerId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!page || !page.spaceKey || !page.title || !page.body) {
      return res.status(400).json({ error: 'page with spaceKey, title, and body is required' });
    }

    const connection = await confluenceService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({ error: 'Confluence not connected' });
    }

    const createdPage = await confluenceService.createPage(connection, page as ConfluencePageCreate);

    // Link to customer if specified
    if (customerId) {
      await confluenceService.linkPageToCustomer(userId, createdPage.id, customerId, 'manual');
    }

    res.json({
      success: true,
      page: createdPage,
    });
  } catch (error) {
    console.error('Create page error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/confluence/pages/:pageId/link
 *
 * Link a page to a customer
 */
router.post('/pages/:pageId/link', async (req: Request, res: Response) => {
  try {
    const { pageId } = req.params;
    const { userId, customerId, linkType = 'manual' } = req.body;

    if (!userId || !customerId) {
      return res.status(400).json({ error: 'userId and customerId are required' });
    }

    const link = await confluenceService.linkPageToCustomer(userId, pageId, customerId, linkType);

    res.json({
      success: true,
      link,
    });
  } catch (error) {
    console.error('Link page error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/confluence/pages/link/:linkId
 *
 * Remove a page-customer link
 */
router.delete('/pages/link/:linkId', async (req: Request, res: Response) => {
  try {
    const { linkId } = req.params;

    await confluenceService.unlinkPageFromCustomer(linkId);

    res.json({
      success: true,
      message: 'Link removed',
    });
  } catch (error) {
    console.error('Unlink page error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/confluence/pages/details/:pageId
 *
 * Get page details from Confluence
 */
router.get('/pages/details/:pageId', async (req: Request, res: Response) => {
  try {
    const { pageId } = req.params;
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const connection = await confluenceService.getConnection(userId);
    if (!connection) {
      return res.status(400).json({ error: 'Confluence not connected' });
    }

    const page = await confluenceService.getPage(connection, pageId);

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({ page });
  } catch (error) {
    console.error('Get page details error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// CONFIGURATION ROUTES
// ============================================

/**
 * PUT /api/confluence/config
 *
 * Update sync configuration
 */
router.put('/config', async (req: Request, res: Response) => {
  try {
    const { userId, config } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Validate config
    const validSchedules = ['hourly', 'daily', 'manual'];
    if (config.syncSchedule && !validSchedules.includes(config.syncSchedule)) {
      return res.status(400).json({ error: `Invalid syncSchedule: ${config.syncSchedule}` });
    }

    await confluenceService.updateSyncConfig(userId, config as Partial<SyncConfig>);

    res.json({
      success: true,
      message: 'Configuration updated successfully',
    });
  } catch (error) {
    console.error('Confluence config error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
