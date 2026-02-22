/**
 * MCP Routes
 * API routes for MCP tool discovery and execution
 */

import { Router, Request, Response } from 'express';
import { mcpRegistry } from '../mcp/registry.js';
import { allTools, getToolStats } from '../mcp/tools/index.js';
import { MCPContext, MCPToolCategory, MCPProvider } from '../mcp/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// Initialize registry with all tools on startup
(async () => {
  console.log('[MCP Routes] Initializing MCP registry...');
  mcpRegistry.registerTools(allTools);
  console.log(`[MCP Routes] Registered ${allTools.length} tools`);
})();

// ============================================
// Tool Discovery
// ============================================

/**
 * GET /api/mcp/tools
 * List all available tools with optional filtering
 */
router.get('/tools', async (req: Request, res: Response) => {
  try {
    const filter: {
      category?: MCPToolCategory;
      provider?: MCPProvider;
      requiresApproval?: boolean;
    } = {};

    if (req.query.category) {
      filter.category = req.query.category as MCPToolCategory;
    }
    if (req.query.provider) {
      filter.provider = req.query.provider as MCPProvider;
    }
    if (req.query.requires_approval !== undefined) {
      filter.requiresApproval = req.query.requires_approval === 'true';
    }

    const result = mcpRegistry.discoverTools(
      Object.keys(filter).length > 0 ? filter : undefined
    );

    res.json(result);
  } catch (error) {
    console.error('[MCP Routes] List tools error:', error);
    res.status(500).json({ error: 'Failed to list tools' });
  }
});

/**
 * GET /api/mcp/tools/:toolName
 * Get details about a specific tool
 */
router.get('/tools/:toolName', async (req: Request, res: Response) => {
  try {
    const definition = mcpRegistry.getToolDefinition(req.params.toolName);

    if (!definition) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    res.json({
      name: definition.name,
      description: definition.description,
      category: definition.category,
      provider: definition.provider,
      requiresAuth: definition.requiresAuth,
      requiresApproval: definition.requiresApproval,
      approvalPolicy: definition.approvalPolicy,
      // Note: inputSchema is a Zod schema, convert to JSON Schema for API response
      inputSchema: definition.inputSchema._def?.typeName || 'object',
    });
  } catch (error) {
    console.error('[MCP Routes] Get tool error:', error);
    res.status(500).json({ error: 'Failed to get tool' });
  }
});

// ============================================
// Tool Execution
// ============================================

/**
 * POST /api/mcp/execute/:toolName
 * Execute an MCP tool
 */
router.post('/execute/:toolName', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { toolName } = req.params;
    const { input, customerId, customerName, sessionId } = req.body;

    const context: MCPContext = {
      userId,
      customerId,
      customerName,
      sessionId,
      traceId: req.headers['x-trace-id'] as string,
    };

    const result = await mcpRegistry.execute(toolName, input || {}, context);

    // Check if approval is required
    if (result.errorCode === 'APPROVAL_REQUIRED') {
      return res.status(202).json({
        status: 'approval_required',
        ...result,
      });
    }

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('[MCP Routes] Execute error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/mcp/execute/:toolName/with-approval
 * Execute an MCP tool that has been approved
 */
router.post('/execute/:toolName/with-approval', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { toolName } = req.params;
    const { input, approvalId, approved, customerId, customerName, sessionId } = req.body;

    if (!approvalId) {
      return res.status(400).json({ error: 'Approval ID required' });
    }

    const context: MCPContext = {
      userId,
      customerId,
      customerName,
      sessionId,
      traceId: req.headers['x-trace-id'] as string,
    };

    const result = await mcpRegistry.executeWithApproval(
      toolName,
      input || {},
      context,
      approvalId,
      approved ?? false
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('[MCP Routes] Execute with approval error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// Batch Execution
// ============================================

/**
 * POST /api/mcp/batch
 * Execute multiple tools in parallel
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { tools, customerId, customerName, sessionId } = req.body;

    if (!Array.isArray(tools) || tools.length === 0) {
      return res.status(400).json({ error: 'Tools array required' });
    }

    if (tools.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 tools per batch' });
    }

    const context: MCPContext = {
      userId,
      customerId,
      customerName,
      sessionId,
      traceId: req.headers['x-trace-id'] as string,
    };

    const results = await Promise.all(
      tools.map(async (tool: { name: string; input?: unknown }) => {
        const result = await mcpRegistry.execute(tool.name, tool.input || {}, context);
        return {
          toolName: tool.name,
          ...result,
        };
      })
    );

    const successCount = results.filter((r) => r.success).length;

    res.json({
      results,
      summary: {
        total: results.length,
        succeeded: successCount,
        failed: results.length - successCount,
      },
    });
  } catch (error) {
    console.error('[MCP Routes] Batch execute error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// Health & Metrics
// ============================================

/**
 * GET /api/mcp/health
 * Check MCP system health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const providerHealth = await mcpRegistry.checkAllHealth();
    const circuitBreakerStats = mcpRegistry.getCircuitBreakerStats();

    const allHealthy = Object.values(providerHealth).every((h) => h);

    res.json({
      status: allHealthy ? 'healthy' : 'degraded',
      providers: providerHealth,
      circuitBreakers: circuitBreakerStats,
    });
  } catch (error) {
    console.error('[MCP Routes] Health check error:', error);
    res.status(500).json({
      status: 'error',
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/mcp/metrics
 * Get MCP registry metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = mcpRegistry.getMetrics();
    const toolStats = getToolStats();

    res.json({
      ...metrics,
      toolStats,
    });
  } catch (error) {
    console.error('[MCP Routes] Metrics error:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// ============================================
// Categories
// ============================================

/**
 * GET /api/mcp/categories
 * List available tool categories with counts
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const metrics = mcpRegistry.getMetrics();

    const categories = Object.entries(metrics.toolsByCategory).map(([name, count]) => ({
      name,
      count,
    }));

    res.json({ categories });
  } catch (error) {
    console.error('[MCP Routes] Categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

/**
 * GET /api/mcp/providers
 * List available tool providers with counts
 */
router.get('/providers', async (req: Request, res: Response) => {
  try {
    const metrics = mcpRegistry.getMetrics();

    const providers = Object.entries(metrics.toolsByProvider).map(([name, count]) => ({
      name,
      count,
    }));

    res.json({ providers });
  } catch (error) {
    console.error('[MCP Routes] Providers error:', error);
    res.status(500).json({ error: 'Failed to get providers' });
  }
});

export default router;
