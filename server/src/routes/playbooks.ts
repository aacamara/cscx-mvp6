/**
 * Playbooks API Routes
 * Provides access to CSM playbooks and executions
 * V2: Added PlaybookExecutor integration for advanced playbook automation
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';
import { playbookExecutor } from '../playbooks/executor.js';
import type { Playbook } from '../playbooks/index.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();
const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);

/**
 * GET /api/playbooks
 * Get all active playbooks
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type } = req.query;

    let query = supabase
      .from('playbooks')
      .select('*')
      .eq('is_active', true);

    query = applyOrgFilter(query, req);

    if (type) query = query.eq('type', type as string);

    const { data, error } = await query.order('name');
    if (error) throw error;

    // PRD-016: Transform phases to steps for frontend compatibility
    // Database stores steps inside phases JSONB, frontend expects flat steps array
    const transformedData = data?.map(playbook => {
      let steps: any[] = [];
      if (playbook.phases && Array.isArray(playbook.phases)) {
        steps = playbook.phases.flatMap((phase: any) => {
          if (phase.tasks && Array.isArray(phase.tasks)) {
            return phase.tasks.map((task: string) => ({
              name: task,
              phase: phase.name || `Phase ${phase.phase}`,
              description: task
            }));
          }
          return [];
        });
      }
      return {
        ...playbook,
        steps
      };
    });

    res.json(transformedData);
  } catch (error) {
    console.error('Playbooks error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/playbooks/csm
 * Get all CSM playbooks (knowledge base)
 * NOTE: This route MUST be before /:id to avoid being caught by the UUID matcher
 */
router.get('/csm', async (req: Request, res: Response) => {
  try {
    const { category } = req.query;

    let query = supabase
      .from('csm_playbooks')
      .select('id, category, subcategory, title, summary, use_cases, tags, created_at');

    if (category) query = query.eq('category', category as string);

    const { data, error } = await query.order('category').order('title');
    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('CSM playbooks error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/playbooks/csm/search
 * Semantic search across CSM playbooks
 * NOTE: This route MUST be before /:id to avoid being caught by the UUID matcher
 */
router.get('/csm/search', async (req: Request, res: Response) => {
  try {
    const { q, category, limit = 5 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    if (!config.geminiApiKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is required for semantic search' });
    }

    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-005' });

    // Generate embedding for the query
    const result = await embeddingModel.embedContent(q as string);
    const queryEmbedding = result.embedding.values;

    // Call the search_knowledge RPC function (uses pgvector)
    const { data, error } = await supabase.rpc('search_csm_playbooks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: parseInt(limit as string, 10),
      filter_category: category || null
    });

    if (error) {
      // If RPC doesn't exist, fall back to basic search
      if (error.code === '42883') {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('csm_playbooks')
          .select('id, category, title, summary, content')
          .ilike('content', `%${q}%`)
          .limit(parseInt(limit as string, 10));

        if (fallbackError) throw fallbackError;
        return res.json(fallbackData);
      }
      throw error;
    }

    res.json(data);
  } catch (error) {
    console.error('CSM playbooks search error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/playbooks/csm/generate-embeddings
 * Generate embeddings for all CSM playbooks that don't have them
 * NOTE: This route MUST be before /:id to avoid being caught by the UUID matcher
 */
router.post('/csm/generate-embeddings', async (req: Request, res: Response) => {
  try {
    if (!config.geminiApiKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is required for embedding generation' });
    }

    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-005' });

    // Fetch all playbooks without embeddings
    const { data: playbooks, error: fetchError } = await supabase
      .from('csm_playbooks')
      .select('id, title, content, summary, category')
      .is('embedding', null);

    if (fetchError) {
      return res.status(500).json({ error: `Failed to fetch playbooks: ${fetchError.message}` });
    }

    if (!playbooks || playbooks.length === 0) {
      return res.json({ message: 'All playbooks already have embeddings', successCount: 0, errorCount: 0 });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const playbook of playbooks) {
      try {
        // Create text for embedding (title + summary + truncated content)
        const textForEmbedding = [
          playbook.title,
          playbook.summary || '',
          playbook.category,
          playbook.content.substring(0, 8000) // Limit content length
        ].join('\n\n');

        // Generate embedding
        const result = await embeddingModel.embedContent(textForEmbedding);
        const embedding = result.embedding.values;

        // Update playbook with embedding
        const { error: updateError } = await supabase
          .from('csm_playbooks')
          .update({ embedding: `[${embedding.join(',')}]` })
          .eq('id', playbook.id);

        if (updateError) {
          errors.push(`${playbook.title}: ${updateError.message}`);
          errorCount++;
        } else {
          successCount++;
        }

        // Rate limiting - avoid hitting API limits
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err) {
        errors.push(`${playbook.title}: ${(err as Error).message}`);
        errorCount++;
      }
    }

    res.json({
      message: `Embedding generation complete`,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Embedding generation error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/playbooks/code/:code
 * Get playbook by code (e.g., PB-ONB)
 */
router.get('/code/:code', async (req: Request, res: Response) => {
  try {
    let query = supabase
      .from('playbooks')
      .select('*')
      .eq('code', req.params.code);

    query = applyOrgFilter(query, req);

    const { data, error } = await query.single();

    if (error) throw error;

    // PRD-016: Transform phases to steps for frontend compatibility
    let steps: any[] = [];
    if (data.phases && Array.isArray(data.phases)) {
      steps = data.phases.flatMap((phase: any) => {
        if (phase.tasks && Array.isArray(phase.tasks)) {
          return phase.tasks.map((task: string) => ({
            name: task,
            phase: phase.name || `Phase ${phase.phase}`,
            description: task
          }));
        }
        return [];
      });
    }

    res.json({
      ...data,
      steps
    });
  } catch (error) {
    console.error('Playbook by code error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/playbooks/executions/active
 * Get all active playbook executions
 * NOTE: Must be before /:id to avoid being caught by UUID matcher
 */
router.get('/executions/active', async (req: Request, res: Response) => {
  try {
    const { customer_id } = req.query;

    let query = supabase
      .from('playbook_executions')
      .select(`
        *,
        playbooks (id, name, code, phases),
        customers (id, name)
      `)
      .eq('status', 'active');

    query = applyOrgFilter(query, req);

    if (customer_id) query = query.eq('customer_id', customer_id as string);

    const { data, error } = await query.order('started_at', { ascending: false });
    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Active executions error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/playbooks/:id
 * Get single playbook with details
 * NOTE: This route uses :id param, so it MUST be after all static routes like /csm, /code/:code, /executions/active
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    let query = supabase
      .from('playbooks')
      .select('*')
      .eq('id', req.params.id);

    query = applyOrgFilter(query, req);

    const { data, error } = await query.single();

    if (error) throw error;

    // PRD-016: Transform phases to steps for frontend compatibility
    let steps: any[] = [];
    if (data.phases && Array.isArray(data.phases)) {
      steps = data.phases.flatMap((phase: any) => {
        if (phase.tasks && Array.isArray(phase.tasks)) {
          return phase.tasks.map((task: string) => ({
            name: task,
            phase: phase.name || `Phase ${phase.phase}`,
            description: task
          }));
        }
        return [];
      });
    }

    res.json({
      ...data,
      steps
    });
  } catch (error) {
    console.error('Playbook lookup error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/playbooks/:id/execute
 * Start a playbook execution for a customer
 */
router.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const { customer_id, cta_id } = req.body;

    if (!customer_id) {
      return res.status(400).json({ error: 'customer_id is required' });
    }

    const { data, error } = await supabase
      .from('playbook_executions')
      .insert(withOrgId({
        playbook_id: req.params.id,
        customer_id,
        cta_id,
        current_phase: 1,
        status: 'active'
      }, req))
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Playbook execution error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/playbooks/executions/:id/progress
 * Update playbook execution progress
 */
router.put('/executions/:id/progress', async (req: Request, res: Response) => {
  try {
    const { current_phase, progress, status } = req.body;

    const updates: any = {};
    if (current_phase !== undefined) updates.current_phase = current_phase;
    if (progress !== undefined) updates.progress = progress;
    if (status !== undefined) {
      updates.status = status;
      if (status === 'completed') updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('playbook_executions')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Update execution error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================
// V2 Playbook Executor Routes
// Advanced automation with MCP integration
// ============================================

/**
 * POST /api/playbooks/v2/:playbookId/start
 * Start a V2 playbook execution with the PlaybookExecutor
 */
router.post('/v2/:playbookId/start', async (req: Request, res: Response) => {
  try {
    const { playbookId } = req.params;
    const userId = (req as any).userId || 'system';
    const { customerId, anchorDate, variables } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    // Get playbook from the new playbooks table structure
    let playbookQuery = supabase
      .from('playbooks')
      .select('*')
      .eq('id', playbookId)
      .eq('is_active', true);

    playbookQuery = applyOrgFilter(playbookQuery, req);

    const { data: playbookRow, error: playbookError } = await playbookQuery.single();

    if (playbookError || !playbookRow) {
      return res.status(404).json({ error: 'Playbook not found or disabled' });
    }

    // Convert to Playbook type for executor
    const playbook: Playbook = {
      id: playbookRow.id,
      name: playbookRow.name,
      description: playbookRow.description,
      type: playbookRow.type || 'custom',
      category: playbookRow.category || 'engagement',
      stages: playbookRow.phases || playbookRow.stages || [],
      triggers: playbookRow.triggers || [],
      variables: playbookRow.variables || [],
      estimatedDurationDays: playbookRow.estimated_duration_days,
      source: playbookRow.source || 'system',
      enabled: playbookRow.is_active,
      createdAt: new Date(playbookRow.created_at),
      updatedAt: new Date(playbookRow.updated_at || playbookRow.created_at),
    };

    // Get customer name
    const { data: customer } = await supabase
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .single();

    const customerName = customer?.name || 'Unknown';

    // Start execution using the V2 executor
    const execution = await playbookExecutor.startExecution(playbook, {
      customerId,
      customerName,
      userId,
      anchorDate: anchorDate ? new Date(anchorDate) : new Date(),
      variables: variables || {},
    });

    res.status(201).json({ execution });
  } catch (error) {
    console.error('Error starting V2 playbook:', error);
    res.status(500).json({ error: 'Failed to start playbook execution' });
  }
});

/**
 * GET /api/playbooks/v2/executions
 * List V2 playbook executions
 */
router.get('/v2/executions', async (req: Request, res: Response) => {
  try {
    const { customerId, status, playbookId, limit = '50', offset = '0' } = req.query;

    let query = supabase
      .from('playbook_executions')
      .select(`
        *,
        playbooks (id, name, code),
        customers (id, name)
      `)
      .order('started_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    query = applyOrgFilter(query, req);

    if (customerId) query = query.eq('customer_id', customerId);
    if (status) query = query.eq('status', status);
    if (playbookId) query = query.eq('playbook_id', playbookId);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ executions: data });
  } catch (error) {
    console.error('Error listing V2 executions:', error);
    res.status(500).json({ error: 'Failed to list executions' });
  }
});

/**
 * GET /api/playbooks/v2/executions/:executionId
 * Get V2 execution details
 */
router.get('/v2/executions/:executionId', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;

    let execQuery = supabase
      .from('playbook_executions')
      .select(`
        *,
        playbooks (id, name, code, phases),
        customers (id, name)
      `)
      .eq('id', executionId);

    execQuery = applyOrgFilter(execQuery, req);

    const { data, error } = await execQuery.single();

    if (error || !data) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    res.json({ execution: data });
  } catch (error) {
    console.error('Error getting V2 execution:', error);
    res.status(500).json({ error: 'Failed to get execution' });
  }
});

/**
 * POST /api/playbooks/v2/executions/:executionId/advance
 * Advance V2 execution to next stage
 */
router.post('/v2/executions/:executionId/advance', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const execution = await playbookExecutor.advanceStage(executionId);
    res.json({ execution });
  } catch (error) {
    console.error('Error advancing V2 execution:', error);
    res.status(500).json({ error: 'Failed to advance execution' });
  }
});

/**
 * POST /api/playbooks/v2/executions/:executionId/skip
 * Skip current stage in V2 execution
 */
router.post('/v2/executions/:executionId/skip', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const execution = await playbookExecutor.skipStage(executionId);
    res.json({ execution });
  } catch (error) {
    console.error('Error skipping V2 stage:', error);
    res.status(500).json({ error: 'Failed to skip stage' });
  }
});

/**
 * POST /api/playbooks/v2/executions/:executionId/pause
 * Pause V2 execution
 */
router.post('/v2/executions/:executionId/pause', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const execution = await playbookExecutor.pauseExecution(executionId);
    res.json({ execution });
  } catch (error) {
    console.error('Error pausing V2 execution:', error);
    res.status(500).json({ error: 'Failed to pause execution' });
  }
});

/**
 * POST /api/playbooks/v2/executions/:executionId/resume
 * Resume paused V2 execution
 */
router.post('/v2/executions/:executionId/resume', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const execution = await playbookExecutor.resumeExecution(executionId);
    res.json({ execution });
  } catch (error) {
    console.error('Error resuming V2 execution:', error);
    res.status(500).json({ error: 'Failed to resume execution' });
  }
});

/**
 * POST /api/playbooks/v2/executions/:executionId/cancel
 * Cancel V2 execution
 */
router.post('/v2/executions/:executionId/cancel', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const { reason } = req.body;
    const execution = await playbookExecutor.cancelExecution(executionId, reason);
    res.json({ execution });
  } catch (error) {
    console.error('Error cancelling V2 execution:', error);
    res.status(500).json({ error: 'Failed to cancel execution' });
  }
});

/**
 * POST /api/playbooks/v2/executions/:executionId/actions/:actionId/execute
 * Execute a specific action in V2 execution
 */
router.post('/v2/executions/:executionId/actions/:actionId/execute', async (req: Request, res: Response) => {
  try {
    const { executionId, actionId } = req.params;
    const result = await playbookExecutor.executeAction(executionId, actionId);
    res.json({ result });
  } catch (error) {
    console.error('Error executing V2 action:', error);
    res.status(500).json({ error: 'Failed to execute action' });
  }
});

/**
 * GET /api/playbooks/v2/stats
 * Get V2 playbook statistics
 */
router.get('/v2/stats', async (req: Request, res: Response) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);

    // Overall stats
    let statsQuery = supabase
      .from('playbook_executions')
      .select('status, started_at, completed_at')
      .gte('started_at', cutoffDate.toISOString());

    statsQuery = applyOrgFilter(statsQuery, req);

    const { data: executions, error } = await statsQuery;

    if (error) throw error;

    const stats = {
      total: executions?.length || 0,
      completed: executions?.filter(e => e.status === 'completed').length || 0,
      active: executions?.filter(e => e.status === 'active').length || 0,
      failed: executions?.filter(e => e.status === 'failed').length || 0,
      cancelled: executions?.filter(e => e.status === 'cancelled').length || 0,
    };

    // Calculate average duration for completed executions
    const completedWithDuration = executions?.filter(e => e.status === 'completed' && e.completed_at) || [];
    const avgDurationDays = completedWithDuration.length > 0
      ? completedWithDuration.reduce((sum, e) => {
          const duration = new Date(e.completed_at).getTime() - new Date(e.started_at).getTime();
          return sum + (duration / (1000 * 60 * 60 * 24));
        }, 0) / completedWithDuration.length
      : null;

    res.json({
      overall: { ...stats, avgDurationDays },
      period: { days: daysNum, from: cutoffDate.toISOString() },
    });
  } catch (error) {
    console.error('Error getting V2 stats:', error);
    res.status(500).json({ error: 'Failed to get playbook stats' });
  }
});

export { router as playbooksRoutes };
