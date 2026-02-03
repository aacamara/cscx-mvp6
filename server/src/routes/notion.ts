/**
 * Notion Routes - PRD-203
 * Handles Notion OAuth, page sync, and documentation endpoints
 */

import { Router, Request, Response } from 'express';
import { notionService } from '../services/integrations/notion.js';

const router = Router();

// ============================================
// OAuth Routes
// ============================================

/**
 * GET /api/notion/auth
 * Initiate Notion OAuth flow
 */
router.get('/auth', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!notionService.isConfigured()) {
      return res.status(500).json({ error: 'Notion integration not configured' });
    }

    const authUrl = notionService.getAuthUrl(userId);
    res.json({ authUrl });
  } catch (error) {
    console.error('[Notion Routes] Auth error:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

/**
 * GET /api/notion/callback
 * Handle Notion OAuth callback
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.error('[Notion Routes] OAuth error:', error);
      return res.redirect(
        `/integrations?notion_error=${encodeURIComponent(error as string)}`
      );
    }

    if (!code || !state) {
      return res.redirect('/integrations?notion_error=missing_params');
    }

    // Decode state to get userId
    let userId: string;
    try {
      const decodedState = JSON.parse(
        Buffer.from(state as string, 'base64').toString()
      );
      userId = decodedState.userId;
    } catch {
      return res.redirect('/integrations?notion_error=invalid_state');
    }

    // Exchange code for token
    const connection = await notionService.connect(code as string);

    // Save connection
    await notionService.saveConnection(userId, connection);

    res.redirect(
      `/integrations?notion_connected=true&workspace=${encodeURIComponent(
        connection.workspaceName || ''
      )}`
    );
  } catch (error) {
    console.error('[Notion Routes] Callback error:', error);
    res.redirect('/integrations?notion_error=callback_failed');
  }
});

// ============================================
// Connection Status Routes
// ============================================

/**
 * GET /api/notion/status
 * Get Notion connection status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const status = await notionService.getSyncStatus(userId);
    res.json(status);
  } catch (error) {
    console.error('[Notion Routes] Status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * DELETE /api/notion/disconnect
 * Disconnect Notion
 */
router.delete('/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    await notionService.disconnect(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('[Notion Routes] Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// ============================================
// Search Routes
// ============================================

/**
 * POST /api/notion/search
 * Search Notion pages
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const connection = await notionService.getConnection(userId);
    if (!connection) {
      return res.status(404).json({ error: 'Notion not connected' });
    }

    const { query, filter, startCursor, pageSize } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query required' });
    }

    const result = await notionService.search(connection, query, {
      filter,
      startCursor,
      pageSize,
    });

    res.json(result);
  } catch (error) {
    console.error('[Notion Routes] Search error:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

// ============================================
// Page Routes
// ============================================

/**
 * GET /api/notion/pages/:customerId
 * Get pages for a customer
 */
router.get('/pages/:customerId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId } = req.params;
    const pages = await notionService.getCustomerPages(customerId);

    res.json({ pages });
  } catch (error) {
    console.error('[Notion Routes] Get pages error:', error);
    res.status(500).json({ error: 'Failed to get pages' });
  }
});

/**
 * GET /api/notion/page/:pageId
 * Get a specific page with content
 */
router.get('/page/:pageId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const connection = await notionService.getConnection(userId);
    if (!connection) {
      return res.status(404).json({ error: 'Notion not connected' });
    }

    const { pageId } = req.params;
    const includeContent = req.query.includeContent !== 'false';

    const page = await notionService.getPage(connection, pageId);

    if (includeContent) {
      const markdown = await notionService.getPageMarkdown(connection, pageId);
      (page as any).contentMarkdown = markdown;
    }

    res.json({ page });
  } catch (error) {
    console.error('[Notion Routes] Get page error:', error);
    res.status(500).json({ error: 'Failed to get page' });
  }
});

/**
 * POST /api/notion/pages
 * Create a new page
 */
router.post('/pages', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const connection = await notionService.getConnection(userId);
    if (!connection) {
      return res.status(404).json({ error: 'Notion not connected' });
    }

    const {
      parentType,
      parentId,
      title,
      templateId,
      customerId,
      customerName,
      properties,
      content,
    } = req.body;

    if (!parentType || !parentId || !title) {
      return res
        .status(400)
        .json({ error: 'parentType, parentId, and title required' });
    }

    let page;

    if (templateId) {
      // Create from template
      page = await notionService.createPageFromTemplate(connection, {
        templateId,
        parentType,
        parentId,
        title,
        customerId,
        customerName,
        additionalProperties: properties,
      });
    } else {
      // Create custom page
      page = await notionService.createPage(connection, {
        parentType,
        parentId,
        title,
        properties,
        content,
        customerId,
        customerName,
      });
    }

    res.json({ page });
  } catch (error) {
    console.error('[Notion Routes] Create page error:', error);
    res.status(500).json({ error: 'Failed to create page' });
  }
});

// ============================================
// Database Routes
// ============================================

/**
 * GET /api/notion/databases
 * List accessible databases
 */
router.get('/databases', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const connection = await notionService.getConnection(userId);
    if (!connection) {
      return res.status(404).json({ error: 'Notion not connected' });
    }

    const databases = await notionService.listDatabases(connection);
    res.json({ databases });
  } catch (error) {
    console.error('[Notion Routes] List databases error:', error);
    res.status(500).json({ error: 'Failed to list databases' });
  }
});

/**
 * POST /api/notion/databases/:databaseId/query
 * Query a database
 */
router.post('/databases/:databaseId/query', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const connection = await notionService.getConnection(userId);
    if (!connection) {
      return res.status(404).json({ error: 'Notion not connected' });
    }

    const { databaseId } = req.params;
    const { filter, sorts, startCursor, pageSize } = req.body;

    const result = await notionService.queryDatabase(connection, databaseId, {
      filter,
      sorts,
      startCursor,
      pageSize,
    });

    res.json(result);
  } catch (error) {
    console.error('[Notion Routes] Query database error:', error);
    res.status(500).json({ error: 'Failed to query database' });
  }
});

// ============================================
// Sync Routes
// ============================================

/**
 * POST /api/notion/sync/:customerId
 * Sync pages for a customer
 */
router.post('/sync/:customerId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const connection = await notionService.getConnection(userId);
    if (!connection) {
      return res.status(404).json({ error: 'Notion not connected' });
    }

    const { customerId } = req.params;
    const { customerName, databaseIds, linkingMethod, propertyName } = req.body;

    if (!customerName) {
      return res.status(400).json({ error: 'customerName required' });
    }

    const result = await notionService.syncCustomerPages(
      connection,
      userId,
      customerId,
      customerName,
      {
        databaseIds,
        linkingMethod,
        propertyName,
      }
    );

    res.json(result);
  } catch (error) {
    console.error('[Notion Routes] Sync error:', error);
    res.status(500).json({ error: 'Failed to sync' });
  }
});

/**
 * GET /api/notion/sync/history
 * Get sync history
 */
router.get('/sync/history', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await notionService.getSyncHistory(userId, { limit, offset });
    res.json(history);
  } catch (error) {
    console.error('[Notion Routes] Sync history error:', error);
    res.status(500).json({ error: 'Failed to get sync history' });
  }
});

// ============================================
// Configuration Routes
// ============================================

/**
 * PUT /api/notion/config
 * Update sync configuration
 */
router.put('/config', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const config = req.body;
    await notionService.updateSyncConfig(userId, config);

    res.json({ success: true });
  } catch (error) {
    console.error('[Notion Routes] Config update error:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// ============================================
// Template Routes
// ============================================

/**
 * GET /api/notion/templates
 * Get available page templates
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const templates = notionService.getTemplates();
    res.json({ templates });
  } catch (error) {
    console.error('[Notion Routes] Templates error:', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

// ============================================
// Health Check
// ============================================

/**
 * GET /api/notion/health
 * Health check for Notion integration
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

    const status = await notionService.getSyncStatus(userId);

    if (!status.connected) {
      return res.json({
        status: 'disconnected',
        message: 'Notion not connected',
      });
    }

    const circuitBreaker = notionService.getCircuitBreakerStatus();

    res.json({
      status: 'healthy',
      workspace: status.workspaceName,
      lastSync: status.lastSyncAt,
      circuitBreaker: {
        state: circuitBreaker.state,
        failures: circuitBreaker.failures,
      },
    });
  } catch (error) {
    console.error('[Notion Routes] Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: (error as Error).message,
    });
  }
});

export default router;
