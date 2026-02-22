/**
 * Quick Actions Routes - PRD-265
 *
 * API endpoints for mobile quick action widgets:
 * - Widget data fetching
 * - Quick action execution
 * - Widget configuration management
 */

import { Router, Request, Response } from 'express';
import {
  quickActionsService,
  WidgetType,
  QuickActionType,
  QuickNoteInput,
  QuickTaskInput,
} from '../services/mobile/quickActions.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// Widget Data Endpoints
// ============================================

/**
 * GET /api/quick-actions/widgets
 * Get all widget configurations for the current user
 */
router.get('/widgets', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' },
      });
    }

    const configs = await quickActionsService.getWidgetConfigs(userId);

    res.json({
      success: true,
      data: configs,
    });
  } catch (error) {
    console.error('Error fetching widget configs:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to fetch widget configurations' },
    });
  }
});

/**
 * GET /api/quick-actions/widgets/:type/data
 * Get data for a specific widget type
 */
router.get('/widgets/:type/data', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const widgetType = req.params.type as WidgetType;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' },
      });
    }

    const validTypes: WidgetType[] = [
      'customer_quick_view',
      'portfolio_overview',
      'tasks_today',
      'quick_compose',
      'notification_summary',
    ];

    if (!validTypes.includes(widgetType)) {
      return res.status(400).json({
        error: { code: 'INVALID_TYPE', message: `Invalid widget type: ${widgetType}` },
      });
    }

    const data = await quickActionsService.getWidgetData(userId, widgetType);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching widget data:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to fetch widget data' },
    });
  }
});

/**
 * POST /api/quick-actions/widgets
 * Create or update a widget configuration
 */
router.post('/widgets', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id, widgetType, size, position, settings } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' },
      });
    }

    if (!widgetType) {
      return res.status(400).json({
        error: { code: 'MISSING_FIELD', message: 'Widget type is required' },
      });
    }

    const result = await quickActionsService.saveWidgetConfig(userId, {
      id,
      widgetType,
      size,
      position,
      settings,
    });

    if (!result.success) {
      return res.status(400).json({
        error: { code: 'SAVE_FAILED', message: result.error },
      });
    }

    res.json({
      success: true,
      data: result.config,
    });
  } catch (error) {
    console.error('Error saving widget config:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to save widget configuration' },
    });
  }
});

/**
 * DELETE /api/quick-actions/widgets/:id
 * Delete a widget configuration
 */
router.delete('/widgets/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const configId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' },
      });
    }

    const success = await quickActionsService.deleteWidgetConfig(userId, configId);

    if (!success) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Widget configuration not found' },
      });
    }

    res.json({
      success: true,
      message: 'Widget configuration deleted',
    });
  } catch (error) {
    console.error('Error deleting widget config:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to delete widget configuration' },
    });
  }
});

// ============================================
// Quick Data Endpoints (for widgets)
// ============================================

/**
 * GET /api/quick-actions/customers/priority
 * Get priority customers for widget display
 */
router.get('/customers/priority', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const limit = parseInt(req.query.limit as string) || 5;
    const customerIds = req.query.customerIds as string | undefined;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' },
      });
    }

    const customers = await quickActionsService.getPriorityCustomers(
      userId,
      limit,
      customerIds ? customerIds.split(',') : undefined
    );

    res.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    console.error('Error fetching priority customers:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to fetch priority customers' },
    });
  }
});

/**
 * GET /api/quick-actions/tasks/today
 * Get tasks due today
 */
router.get('/tasks/today', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' },
      });
    }

    const tasks = await quickActionsService.getTasksToday(userId, limit);

    res.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to fetch tasks' },
    });
  }
});

/**
 * GET /api/quick-actions/portfolio
 * Get portfolio overview metrics
 */
router.get('/portfolio', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' },
      });
    }

    const overview = await quickActionsService.getPortfolioOverview(userId);

    res.json({
      success: true,
      data: overview,
    });
  } catch (error) {
    console.error('Error fetching portfolio overview:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to fetch portfolio overview' },
    });
  }
});

// ============================================
// Quick Action Execution Endpoints
// ============================================

/**
 * POST /api/quick-actions/execute/:action
 * Execute a quick action
 */
router.post('/execute/:action', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const actionType = req.params.action as QuickActionType;
    const params = req.body;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' },
      });
    }

    const validActions: QuickActionType[] = [
      'quick_note',
      'check_health',
      'create_task',
      'voice_note',
      'call_contact',
    ];

    if (!validActions.includes(actionType)) {
      return res.status(400).json({
        error: { code: 'INVALID_ACTION', message: `Invalid action type: ${actionType}` },
      });
    }

    const result = await quickActionsService.executeQuickAction(userId, actionType, params);

    if (!result.success) {
      return res.status(400).json({
        error: { code: 'ACTION_FAILED', message: result.error },
      });
    }

    res.json({
      success: true,
      data: result.result,
    });
  } catch (error) {
    console.error('Error executing quick action:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to execute action' },
    });
  }
});

/**
 * POST /api/quick-actions/note
 * Create a quick note (convenience endpoint)
 */
router.post('/note', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { customerId, content } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' },
      });
    }

    if (!customerId || !content) {
      return res.status(400).json({
        error: { code: 'MISSING_FIELDS', message: 'Customer ID and content are required' },
      });
    }

    const result = await quickActionsService.executeQuickAction(userId, 'quick_note', {
      customerId,
      content,
    } as QuickNoteInput);

    if (!result.success) {
      return res.status(400).json({
        error: { code: 'ACTION_FAILED', message: result.error },
      });
    }

    res.json({
      success: true,
      data: result.result,
    });
  } catch (error) {
    console.error('Error creating quick note:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to create note' },
    });
  }
});

/**
 * POST /api/quick-actions/voice-note
 * Create a voice note (convenience endpoint)
 */
router.post('/voice-note', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { customerId, content, audioUrl } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' },
      });
    }

    if (!customerId) {
      return res.status(400).json({
        error: { code: 'MISSING_FIELDS', message: 'Customer ID is required' },
      });
    }

    const result = await quickActionsService.executeQuickAction(userId, 'voice_note', {
      customerId,
      content: content || '[Voice Note]',
      audioUrl,
      isVoiceNote: true,
    } as QuickNoteInput);

    if (!result.success) {
      return res.status(400).json({
        error: { code: 'ACTION_FAILED', message: result.error },
      });
    }

    res.json({
      success: true,
      data: result.result,
    });
  } catch (error) {
    console.error('Error creating voice note:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to create voice note' },
    });
  }
});

/**
 * POST /api/quick-actions/task
 * Create a quick task (convenience endpoint)
 */
router.post('/task', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { customerId, title, dueDate, priority } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' },
      });
    }

    if (!title) {
      return res.status(400).json({
        error: { code: 'MISSING_FIELDS', message: 'Task title is required' },
      });
    }

    const result = await quickActionsService.executeQuickAction(userId, 'create_task', {
      customerId,
      title,
      dueDate,
      priority,
    } as QuickTaskInput);

    if (!result.success) {
      return res.status(400).json({
        error: { code: 'ACTION_FAILED', message: result.error },
      });
    }

    res.json({
      success: true,
      data: result.result,
    });
  } catch (error) {
    console.error('Error creating quick task:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to create task' },
    });
  }
});

/**
 * GET /api/quick-actions/customer/:id/health
 * Check customer health (convenience endpoint)
 */
router.get('/customer/:id/health', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const customerId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' },
      });
    }

    const result = await quickActionsService.executeQuickAction(userId, 'check_health', {
      customerId,
    });

    if (!result.success) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: result.error },
      });
    }

    res.json({
      success: true,
      data: result.result,
    });
  } catch (error) {
    console.error('Error checking customer health:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to check customer health' },
    });
  }
});

/**
 * GET /api/quick-actions/customer/:id/call
 * Get call info for customer (convenience endpoint)
 */
router.get('/customer/:id/call', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const customerId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' },
      });
    }

    const result = await quickActionsService.executeQuickAction(userId, 'call_contact', {
      customerId,
    });

    if (!result.success) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: result.error },
      });
    }

    res.json({
      success: true,
      data: result.result,
    });
  } catch (error) {
    console.error('Error getting call info:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to get call information' },
    });
  }
});

/**
 * POST /api/quick-actions/cache/clear
 * Clear widget cache for user
 */
router.post('/cache/clear', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User ID required' },
      });
    }

    quickActionsService.clearCache(userId);

    res.json({
      success: true,
      message: 'Cache cleared',
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      error: { code: 'ERROR', message: 'Failed to clear cache' },
    });
  }
});

export { router as quickActionsRoutes };
export default router;
