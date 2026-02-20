/**
 * Automations Routes
 * API endpoints for automation management and execution
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { automationService, nlAutomationParser } from '../services/automations/index.js';
import { skillsService } from '../services/skills/index.js';
import type { MCPContext } from '../mcp/index.js';
import { applyOrgFilter } from '../middleware/orgFilter.js';

const router = Router();
const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);

// ============================================
// NL Parsing
// ============================================

/**
 * POST /api/automations/parse
 * Parse a natural language description into an automation definition
 */
router.post('/parse', async (req: Request, res: Response) => {
  try {
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }

    // Get available skills for context
    const skills = await skillsService.listSkills({ enabled: true });
    const skillsContext = skills.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
    }));

    // Get customer segments for context
    let segQuery = supabase.from('customers').select('segment').not('segment', 'is', null);
    segQuery = applyOrgFilter(segQuery, req);
    const { data: segments } = await segQuery;

    const uniqueSegments = [...new Set(segments?.map(s => s.segment) || [])];

    // Parse the description
    const parsed = await nlAutomationParser.parse(description, {
      availableSkills: skillsContext,
      customerSegments: uniqueSegments,
    });

    res.json({
      success: true,
      parsed,
    });
  } catch (error) {
    console.error('Error parsing automation:', error);
    res.status(500).json({ error: 'Failed to parse automation description' });
  }
});

/**
 * POST /api/automations/from-nl
 * Create an automation from natural language description
 */
router.post('/from-nl', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'system';
    const organizationId = (req as any).organizationId || null;
    const { description, name, enabled } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }

    const automation = await automationService.createFromNL(
      description,
      userId,
      { name, enabled },
      organizationId
    );

    res.status(201).json({ automation });
  } catch (error) {
    console.error('Error creating automation from NL:', error);
    res.status(500).json({ error: 'Failed to create automation' });
  }
});

// ============================================
// Automation CRUD
// ============================================

/**
 * GET /api/automations
 * List automations
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const organizationId = (req as any).organizationId || null;
    const { type, enabled, limit = '50', offset = '0' } = req.query;

    const automations = await automationService.listAutomations({
      type: type as any,
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    }, organizationId);

    res.json({ automations });
  } catch (error) {
    console.error('Error listing automations:', error);
    res.status(500).json({ error: 'Failed to list automations' });
  }
});

/**
 * GET /api/automations/:automationId
 * Get automation details
 */
router.get('/:automationId', async (req: Request, res: Response) => {
  try {
    const { automationId } = req.params;
    const organizationId = (req as any).organizationId || null;

    const automation = await automationService.getAutomation(automationId, organizationId);

    if (!automation) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    res.json({ automation });
  } catch (error) {
    console.error('Error getting automation:', error);
    res.status(500).json({ error: 'Failed to get automation' });
  }
});

/**
 * POST /api/automations
 * Create a new automation
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'system';
    const organizationId = (req as any).organizationId || null;
    const {
      name,
      description,
      type,
      nlDescription,
      steps,
      schedule,
      trigger,
      scope,
      enabled,
    } = req.body;

    if (!name || !type || !steps || !scope) {
      return res.status(400).json({
        error: 'name, type, steps, and scope are required',
      });
    }

    const automation = await automationService.createAutomation({
      name,
      description: description || '',
      type,
      nlDescription: nlDescription || description || '',
      steps,
      schedule,
      trigger,
      scope,
      enabled: enabled ?? false,
      createdBy: userId,
    }, organizationId);

    res.status(201).json({ automation });
  } catch (error) {
    console.error('Error creating automation:', error);
    res.status(500).json({ error: 'Failed to create automation' });
  }
});

/**
 * PUT /api/automations/:automationId
 * Update an automation
 */
router.put('/:automationId', async (req: Request, res: Response) => {
  try {
    const { automationId } = req.params;
    const organizationId = (req as any).organizationId || null;
    const updates = req.body;

    const automation = await automationService.updateAutomation(automationId, updates, organizationId);

    res.json({ automation });
  } catch (error) {
    console.error('Error updating automation:', error);
    res.status(500).json({ error: 'Failed to update automation' });
  }
});

/**
 * DELETE /api/automations/:automationId
 * Delete an automation
 */
router.delete('/:automationId', async (req: Request, res: Response) => {
  try {
    const { automationId } = req.params;
    const organizationId = (req as any).organizationId || null;

    await automationService.deleteAutomation(automationId, organizationId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting automation:', error);
    res.status(500).json({ error: 'Failed to delete automation' });
  }
});

/**
 * POST /api/automations/:automationId/enable
 * Enable an automation
 */
router.post('/:automationId/enable', async (req: Request, res: Response) => {
  try {
    const { automationId } = req.params;
    const organizationId = (req as any).organizationId || null;

    const automation = await automationService.updateAutomation(automationId, {
      enabled: true,
    }, organizationId);

    res.json({ automation });
  } catch (error) {
    console.error('Error enabling automation:', error);
    res.status(500).json({ error: 'Failed to enable automation' });
  }
});

/**
 * POST /api/automations/:automationId/disable
 * Disable an automation
 */
router.post('/:automationId/disable', async (req: Request, res: Response) => {
  try {
    const { automationId } = req.params;
    const organizationId = (req as any).organizationId || null;

    const automation = await automationService.updateAutomation(automationId, {
      enabled: false,
    }, organizationId);

    res.json({ automation });
  } catch (error) {
    console.error('Error disabling automation:', error);
    res.status(500).json({ error: 'Failed to disable automation' });
  }
});

// ============================================
// Execution
// ============================================

/**
 * POST /api/automations/:automationId/run
 * Run an automation manually
 */
router.post('/:automationId/run', async (req: Request, res: Response) => {
  try {
    const { automationId } = req.params;
    const userId = (req as any).userId || 'system';
    const { customerIds } = req.body;

    const context: MCPContext = {
      userId,
      traceId: `run_${Date.now()}`,
    };

    const run = await automationService.runAutomation(
      automationId,
      context,
      { customerIds }
    );

    res.json({ run });
  } catch (error) {
    console.error('Error running automation:', error);
    res.status(500).json({ error: 'Failed to run automation' });
  }
});

/**
 * GET /api/automations/:automationId/runs
 * List runs for an automation
 */
router.get('/:automationId/runs', async (req: Request, res: Response) => {
  try {
    const { automationId } = req.params;
    const { status, limit = '50', offset = '0' } = req.query;

    const runs = await automationService.listRuns({
      automationId,
      status: status as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({ runs });
  } catch (error) {
    console.error('Error listing runs:', error);
    res.status(500).json({ error: 'Failed to list runs' });
  }
});

/**
 * GET /api/automations/runs/:runId
 * Get run details
 */
router.get('/runs/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const run = await automationService.getRun(runId);

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    res.json({ run });
  } catch (error) {
    console.error('Error getting run:', error);
    res.status(500).json({ error: 'Failed to get run' });
  }
});

// ============================================
// Statistics
// ============================================

/**
 * GET /api/automations/stats
 * Get automation statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);

    // Get automation counts
    let autoQuery = supabase.from('automations').select('id, type, enabled');
    autoQuery = applyOrgFilter(autoQuery, req);
    const { data: automations, error: autoError } = await autoQuery;

    if (autoError) throw autoError;

    // Get run counts
    let runsQuery = supabase.from('automation_runs').select('status, customers_processed, customers_succeeded, customers_failed');
    runsQuery = applyOrgFilter(runsQuery, req);
    const { data: runs, error: runError } = await runsQuery
      .gte('started_at', cutoffDate.toISOString());

    if (runError) throw runError;

    const stats = {
      totalAutomations: automations?.length || 0,
      enabledAutomations: automations?.filter(a => a.enabled).length || 0,
      automationsByType: automations?.reduce((acc, a) => {
        acc[a.type] = (acc[a.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {},
      totalRuns: runs?.length || 0,
      runsByStatus: runs?.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {},
      customersProcessed: runs?.reduce((sum, r) => sum + (r.customers_processed || 0), 0) || 0,
      customersSucceeded: runs?.reduce((sum, r) => sum + (r.customers_succeeded || 0), 0) || 0,
      customersFailed: runs?.reduce((sum, r) => sum + (r.customers_failed || 0), 0) || 0,
      period: { days: daysNum, from: cutoffDate.toISOString() },
    };

    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ============================================
// Skills V2 (Database-backed)
// ============================================

/**
 * GET /api/automations/skills
 * List skills from database
 */
router.get('/skills', async (req: Request, res: Response) => {
  try {
    const { category, enabled, search, tags } = req.query;

    const skills = await skillsService.listSkills({
      category: category as any,
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      search: search as string,
      tags: tags ? (tags as string).split(',') : undefined,
    });

    res.json({ skills });
  } catch (error) {
    console.error('Error listing skills:', error);
    res.status(500).json({ error: 'Failed to list skills' });
  }
});

/**
 * GET /api/automations/skills/:skillId
 * Get skill details
 */
router.get('/skills/:skillId', async (req: Request, res: Response) => {
  try {
    const { skillId } = req.params;

    const skill = await skillsService.getSkill(skillId);

    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    res.json({ skill });
  } catch (error) {
    console.error('Error getting skill:', error);
    res.status(500).json({ error: 'Failed to get skill' });
  }
});

/**
 * POST /api/automations/skills
 * Create a new skill
 */
router.post('/skills', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'system';
    const skillData = req.body;

    const skill = await skillsService.createSkill({
      ...skillData,
      source: 'user',
      createdBy: userId,
    });

    res.status(201).json({ skill });
  } catch (error) {
    console.error('Error creating skill:', error);
    res.status(500).json({ error: 'Failed to create skill' });
  }
});

/**
 * PUT /api/automations/skills/:skillId
 * Update a skill
 */
router.put('/skills/:skillId', async (req: Request, res: Response) => {
  try {
    const { skillId } = req.params;
    const updates = req.body;

    const skill = await skillsService.updateSkill(skillId, updates);

    res.json({ skill });
  } catch (error) {
    console.error('Error updating skill:', error);
    res.status(500).json({ error: 'Failed to update skill' });
  }
});

/**
 * DELETE /api/automations/skills/:skillId
 * Delete a skill
 */
router.delete('/skills/:skillId', async (req: Request, res: Response) => {
  try {
    const { skillId } = req.params;

    await skillsService.deleteSkill(skillId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting skill:', error);
    res.status(500).json({ error: 'Failed to delete skill' });
  }
});

/**
 * POST /api/automations/skills/:skillId/execute
 * Execute a skill
 */
router.post('/skills/:skillId/execute', async (req: Request, res: Response) => {
  try {
    const { skillId } = req.params;
    const userId = (req as any).userId || 'system';
    const { inputs, customerId, customerName } = req.body;

    const context: MCPContext = {
      userId,
      customerId,
      customerName,
      traceId: `skill_${Date.now()}`,
    };

    const execution = await skillsService.executeSkill(skillId, inputs || {}, context);

    res.json({ execution });
  } catch (error) {
    console.error('Error executing skill:', error);
    res.status(500).json({ error: 'Failed to execute skill' });
  }
});

/**
 * GET /api/automations/skills/:skillId/executions
 * List skill executions
 */
router.get('/skills/:skillId/executions', async (req: Request, res: Response) => {
  try {
    const { skillId } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    const executions = await skillsService.listExecutions({
      skillId,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({ executions });
  } catch (error) {
    console.error('Error listing executions:', error);
    res.status(500).json({ error: 'Failed to list executions' });
  }
});

export default router;
