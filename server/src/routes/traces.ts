/**
 * Traces API Routes
 * RESTful endpoints for agent trace data
 */

import { Router, Request, Response } from 'express';
import { agentTracer } from '../services/agentTracer.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

const router = Router();

// Initialize Supabase client
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// ============================================
// Types
// ============================================

interface TraceFilters {
  agentType?: string;
  agentName?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  customerId?: string;
}

interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

// ============================================
// Helper Functions
// ============================================

function parsePagination(req: Request): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function parseFilters(req: Request): TraceFilters {
  return {
    agentType: req.query.agentType as string,
    agentName: req.query.agentName as string,
    status: req.query.status as string,
    startDate: req.query.startDate as string,
    endDate: req.query.endDate as string,
    customerId: req.query.customerId as string,
  };
}

// ============================================
// Routes
// ============================================

/**
 * GET /api/traces
 * List recent traces with pagination and filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { page, limit, offset } = parsePagination(req);
    const filters = parseFilters(req);

    if (!supabase) {
      // Fallback to in-memory tracer
      const allRuns = userId
        ? await agentTracer.getUserRuns(userId, 100)
        : agentTracer.getActiveRuns();

      // Apply filters
      let filteredRuns = allRuns;
      if (filters.agentType) {
        filteredRuns = filteredRuns.filter(r => r.agentType === filters.agentType);
      }
      if (filters.agentName) {
        filteredRuns = filteredRuns.filter(r => r.agentName.toLowerCase().includes(filters.agentName!.toLowerCase()));
      }
      if (filters.status) {
        filteredRuns = filteredRuns.filter(r => r.status === filters.status);
      }
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        filteredRuns = filteredRuns.filter(r => r.startTime >= start);
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        filteredRuns = filteredRuns.filter(r => r.startTime <= end);
      }

      const total = filteredRuns.length;
      const traces = filteredRuns.slice(offset, offset + limit);

      return res.json({
        traces: traces.map(run => ({
          id: run.id,
          agentId: run.agentId,
          agentName: run.agentName,
          agentType: run.agentType,
          status: run.status,
          startTime: run.startTime,
          endTime: run.endTime,
          duration: run.endTime
            ? run.endTime.getTime() - run.startTime.getTime()
            : null,
          stepCount: run.steps.length,
          tokens: run.totalTokens,
          input: run.input.substring(0, 200),
          output: run.output?.substring(0, 200),
          hasError: !!run.error,
          customerId: run.customerId,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        }
      });
    }

    // Build Supabase query
    let query = supabase
      .from('agent_runs')
      .select('*', { count: 'exact' });

    // Apply filters
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (filters.agentType) {
      query = query.eq('agent_type', filters.agentType);
    }
    if (filters.agentName) {
      query = query.ilike('agent_name', `%${filters.agentName}%`);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.startDate) {
      query = query.gte('started_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('started_at', filters.endDate);
    }
    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }

    // Apply pagination and ordering
    const { data, error, count } = await query
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Supabase query error:', error);
      return res.status(500).json({ error: 'Failed to fetch traces' });
    }

    return res.json({
      traces: (data || []).map((row: any) => ({
        id: row.id,
        agentId: row.agent_id,
        agentName: row.agent_name,
        agentType: row.agent_type,
        status: row.status,
        startTime: row.started_at,
        endTime: row.ended_at,
        duration: row.ended_at
          ? new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()
          : null,
        stepCount: row.step_count || 0,
        tokens: {
          input: row.total_tokens_input || 0,
          output: row.total_tokens_output || 0,
        },
        input: row.input?.substring(0, 200),
        output: row.output?.substring(0, 200),
        hasError: !!row.error,
        customerId: row.customer_id,
      })),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      }
    });

  } catch (error) {
    console.error('Get traces error:', error);
    return res.status(500).json({ error: 'Failed to fetch traces' });
  }
});

/**
 * GET /api/traces/:runId
 * Get full trace with all steps
 */
router.get('/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const includeTree = req.query.tree === 'true';

    // Try in-memory first for active runs
    const run = includeTree
      ? await agentTracer.getRunTree(runId)
      : await agentTracer.getRun(runId);

    if (run) {
      return res.json({
        trace: {
          id: run.id,
          agentId: run.agentId,
          agentName: run.agentName,
          agentType: run.agentType,
          userId: run.userId,
          sessionId: run.sessionId,
          customerId: run.customerId,
          customerContext: run.customerContext,
          status: run.status,
          startTime: run.startTime,
          endTime: run.endTime,
          duration: run.endTime
            ? run.endTime.getTime() - run.startTime.getTime()
            : null,
          input: run.input,
          output: run.output,
          error: run.error,
          totalTokens: run.totalTokens,
          steps: run.steps,
          childRuns: run.childRuns,
          parentRunId: run.parentRunId,
          metadata: run.metadata,
        }
      });
    }

    // Fallback to database
    if (supabase) {
      const { data, error } = await supabase
        .from('agent_runs')
        .select('*, agent_steps(*)')
        .eq('id', runId)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Trace not found' });
      }

      return res.json({
        trace: {
          id: data.id,
          agentId: data.agent_id,
          agentName: data.agent_name,
          agentType: data.agent_type,
          userId: data.user_id,
          sessionId: data.session_id,
          customerId: data.customer_id,
          customerContext: data.customer_context,
          status: data.status,
          startTime: data.started_at,
          endTime: data.ended_at,
          duration: data.ended_at
            ? new Date(data.ended_at).getTime() - new Date(data.started_at).getTime()
            : null,
          input: data.input,
          output: data.output,
          error: data.error,
          totalTokens: {
            input: data.total_tokens_input || 0,
            output: data.total_tokens_output || 0,
          },
          steps: (data.agent_steps || []).map((s: any) => ({
            id: s.id,
            runId: s.run_id,
            type: s.type,
            name: s.name,
            description: s.description,
            input: s.input,
            output: s.output,
            timestamp: s.created_at,
            duration: s.duration_ms,
            parentStepId: s.parent_step_id,
            metadata: s.metadata,
            tokens: s.tokens_input ? { input: s.tokens_input, output: s.tokens_output } : undefined,
          })),
          parentRunId: data.parent_run_id,
          metadata: data.metadata,
        }
      });
    }

    return res.status(404).json({ error: 'Trace not found' });

  } catch (error) {
    console.error('Get trace error:', error);
    return res.status(500).json({ error: 'Failed to fetch trace' });
  }
});

/**
 * GET /api/traces/:runId/steps
 * Get only steps for a trace (lightweight)
 */
router.get('/:runId/steps', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    // Try in-memory first
    const run = await agentTracer.getRun(runId);
    if (run) {
      return res.json({
        runId,
        steps: run.steps.map(step => ({
          id: step.id,
          type: step.type,
          name: step.name,
          description: step.description,
          input: step.input,
          output: step.output,
          timestamp: step.timestamp,
          duration: step.duration,
          parentStepId: step.parentStepId,
          metadata: step.metadata,
          tokens: step.tokens,
          status: step.output ? 'completed' : (step.metadata?.error ? 'error' : 'pending'),
        })),
        stepCount: run.steps.length,
      });
    }

    // Fallback to database
    if (supabase) {
      const { data, error } = await supabase
        .from('agent_steps')
        .select('*')
        .eq('run_id', runId)
        .order('created_at', { ascending: true });

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch steps' });
      }

      return res.json({
        runId,
        steps: (data || []).map((s: any) => ({
          id: s.id,
          type: s.type,
          name: s.name,
          description: s.description,
          input: s.input,
          output: s.output,
          timestamp: s.created_at,
          duration: s.duration_ms,
          parentStepId: s.parent_step_id,
          metadata: s.metadata,
          tokens: s.tokens_input ? { input: s.tokens_input, output: s.tokens_output } : undefined,
          status: s.output ? 'completed' : (s.metadata?.error ? 'error' : 'pending'),
        })),
        stepCount: data?.length || 0,
      });
    }

    return res.status(404).json({ error: 'Trace not found' });

  } catch (error) {
    console.error('Get steps error:', error);
    return res.status(500).json({ error: 'Failed to fetch steps' });
  }
});

/**
 * GET /api/traces/:runId/visualization
 * Get visualization data for flow graph
 */
router.get('/:runId/visualization', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const visualization = await agentTracer.getTraceVisualization(runId);

    if (!visualization) {
      return res.status(404).json({ error: 'Trace not found' });
    }

    return res.json(visualization);

  } catch (error) {
    console.error('Get visualization error:', error);
    return res.status(500).json({ error: 'Failed to fetch visualization' });
  }
});

/**
 * GET /api/traces/:runId/replay
 * Get replay data with timing information
 */
router.get('/:runId/replay', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const run = await agentTracer.getRun(runId);
    if (!run) {
      return res.status(404).json({ error: 'Trace not found' });
    }

    // Calculate relative timestamps for replay
    const startTime = run.startTime.getTime();
    const replaySteps = run.steps.map((step, index) => ({
      index,
      id: step.id,
      type: step.type,
      name: step.name,
      description: step.description,
      input: step.input,
      output: step.output,
      relativeTime: step.timestamp.getTime() - startTime,
      duration: step.duration || 0,
      tokens: step.tokens,
      metadata: step.metadata,
      status: step.output ? 'completed' : (step.metadata?.error ? 'error' : 'pending'),
    }));

    // Calculate state snapshots at each step
    const stateSnapshots = replaySteps.map((step, index) => ({
      stepIndex: index,
      completedSteps: index + 1,
      totalSteps: replaySteps.length,
      currentStatus: run.status,
      tokensUsed: replaySteps.slice(0, index + 1).reduce(
        (acc, s) => ({
          input: acc.input + (s.tokens?.input || 0),
          output: acc.output + (s.tokens?.output || 0),
        }),
        { input: 0, output: 0 }
      ),
    }));

    return res.json({
      runId,
      agentName: run.agentName,
      agentType: run.agentType,
      input: run.input,
      output: run.output,
      status: run.status,
      totalDuration: run.endTime
        ? run.endTime.getTime() - startTime
        : Date.now() - startTime,
      steps: replaySteps,
      stateSnapshots,
      totalSteps: replaySteps.length,
    });

  } catch (error) {
    console.error('Get replay error:', error);
    return res.status(500).json({ error: 'Failed to fetch replay data' });
  }
});

export { router as tracesRoutes };
