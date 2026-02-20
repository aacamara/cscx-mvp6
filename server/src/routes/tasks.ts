/**
 * Tasks API Routes
 * PRD-234: Natural Language Task Creation
 *
 * API endpoints for creating and managing tasks, including
 * natural language parsing and batch creation.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { applyOrgFilter, withOrgId, getOrgId } from '../middleware/orgFilter.js';
import {
  parseNaturalLanguageTask,
  createTaskFromNaturalLanguage,
  parseBatchTasks,
  createBatchTasks,
} from '../services/ai/natural-language-task.js';

const router = Router();

// Initialize Supabase client if configured
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Natural Language Task Endpoints
// ============================================

/**
 * POST /api/tasks/parse
 * Parse natural language task input without creating
 */
router.post('/parse', async (req: Request, res: Response) => {
  try {
    const { input, context } = req.body;

    if (!input || typeof input !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Task input is required' },
      });
    }

    const userId = req.headers['x-user-id'] as string;
    const userContext = {
      ...context,
      user_id: userId,
    };

    const result = await parseNaturalLanguageTask(input, userContext);

    res.json(result);
  } catch (error) {
    console.error('Parse task error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to parse task',
      },
    });
  }
});

/**
 * POST /api/tasks/create-from-nl
 * Create a task from natural language input
 */
router.post('/create-from-nl', async (req: Request, res: Response) => {
  try {
    const { input, context, auto_confirm, overrides } = req.body;

    if (!input || typeof input !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Task input is required' },
      });
    }

    const userId = req.headers['x-user-id'] as string;
    const userContext = {
      ...context,
      user_id: userId,
    };

    const result = await createTaskFromNaturalLanguage(
      input,
      userContext,
      auto_confirm || false,
      overrides || {}
    );

    if (result.success && result.task) {
      res.status(201).json(result);
    } else if (result.needs_confirmation) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Create task from NL error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create task',
      },
    });
  }
});

/**
 * POST /api/tasks/batch-parse
 * Parse multiple tasks at once (e.g., from meeting notes)
 */
router.post('/batch-parse', async (req: Request, res: Response) => {
  try {
    const { items, source, context } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Items array is required' },
      });
    }

    // Limit batch size
    if (items.length > 50) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Maximum 50 items per batch' },
      });
    }

    const userId = req.headers['x-user-id'] as string;
    const userContext = {
      ...context,
      user_id: userId,
    };

    // Handle both string arrays and object arrays
    const inputStrings = items.map((item: string | { input: string }) =>
      typeof item === 'string' ? item : item.input
    );

    const result = await parseBatchTasks(inputStrings, source || 'manual', userContext);

    res.json(result);
  } catch (error) {
    console.error('Batch parse error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to parse batch',
      },
    });
  }
});

/**
 * POST /api/tasks/batch-create
 * Create multiple tasks from batch parsing results
 */
router.post('/batch-create', async (req: Request, res: Response) => {
  try {
    const { tasks, context } = req.body;

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Tasks array is required' },
      });
    }

    const userId = req.headers['x-user-id'] as string;
    const userContext = {
      ...context,
      user_id: userId,
    };

    const result = await createBatchTasks(tasks, userContext);

    res.status(result.created > 0 ? 201 : 400).json(result);
  } catch (error) {
    console.error('Batch create error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create batch',
      },
    });
  }
});

// ============================================
// Standard Task CRUD Endpoints
// ============================================

/**
 * GET /api/tasks
 * List tasks with filtering and pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      customer_id,
      status,
      priority,
      task_type,
      due_before,
      due_after,
      assignee_id,
      sort_by = 'created_at',
      sort_order = 'desc',
      page = '1',
      limit = '20',
    } = req.query;

    const userId = req.headers['x-user-id'] as string;

    if (supabase) {
      let query = supabase.from('plan_tasks').select('*, customers(name)', { count: 'exact' });
      query = applyOrgFilter(query, req);

      // Apply filters
      if (customer_id) {
        query = query.eq('customer_id', customer_id);
      }
      if (status) {
        query = query.eq('status', status);
      }
      if (priority) {
        query = query.eq('priority', priority);
      }
      if (task_type) {
        query = query.eq('task_type', task_type);
      }
      if (due_before) {
        query = query.lte('due_date', due_before);
      }
      if (due_after) {
        query = query.gte('due_date', due_after);
      }
      if (assignee_id) {
        query = query.eq('assignee_id', assignee_id);
      }

      // Sort
      const sortColumn = ['created_at', 'due_date', 'priority', 'title'].includes(sort_by as string)
        ? (sort_by as string)
        : 'created_at';
      query = query.order(sortColumn, { ascending: sort_order === 'asc' });

      // Paginate
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const startIndex = (pageNum - 1) * limitNum;
      query = query.range(startIndex, startIndex + limitNum - 1);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      // Transform data
      const tasks = (data || []).map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        customer_id: task.customer_id,
        customer_name: task.customers?.name,
        due_date: task.due_date,
        priority: task.priority || 'medium',
        task_type: task.task_type || 'other',
        status: task.status || 'pending',
        source: task.source,
        source_input: task.source_input,
        parse_confidence: task.parse_confidence,
        assignee_id: task.assignee_id,
        created_at: task.created_at,
        updated_at: task.updated_at,
      }));

      return res.json({
        success: true,
        tasks,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || tasks.length,
          total_pages: Math.ceil((count || tasks.length) / limitNum),
        },
      });
    }

    // Fallback - return empty array
    res.json({
      success: true,
      tasks: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        total_pages: 0,
      },
    });
  } catch (error) {
    console.error('List tasks error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list tasks',
      },
    });
  }
});

/**
 * GET /api/tasks/:id
 * Get a single task by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (supabase) {
      let query = supabase.from('plan_tasks').select('*, customers(name)').eq('id', id);
      query = applyOrgFilter(query, req);
      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Task not found' },
          });
        }
        throw error;
      }

      return res.json({
        success: true,
        task: {
          id: data.id,
          title: data.title,
          description: data.description,
          customer_id: data.customer_id,
          customer_name: data.customers?.name,
          due_date: data.due_date,
          priority: data.priority || 'medium',
          task_type: data.task_type || 'other',
          status: data.status || 'pending',
          source: data.source,
          source_input: data.source_input,
          parse_confidence: data.parse_confidence,
          assignee_id: data.assignee_id,
          created_at: data.created_at,
          updated_at: data.updated_at,
        },
      });
    }

    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Task not found' },
    });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get task',
      },
    });
  }
});

/**
 * POST /api/tasks
 * Create a task (standard method)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, description, customer_id, due_date, priority, task_type, assignee_id } =
      req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Task title is required' },
      });
    }

    const userId = req.headers['x-user-id'] as string;

    if (supabase) {
      const { data, error } = await supabase
        .from('plan_tasks')
        .insert(withOrgId({
          title,
          description,
          customer_id,
          due_date,
          priority: priority || 'medium',
          task_type: task_type || 'other',
          status: 'pending',
          source: 'manual',
          assignee_id: assignee_id || userId,
        }, req))
        .select('*, customers(name)')
        .single();

      if (error) {
        throw error;
      }

      return res.status(201).json({
        success: true,
        task: {
          id: data.id,
          title: data.title,
          description: data.description,
          customer_id: data.customer_id,
          customer_name: data.customers?.name,
          due_date: data.due_date,
          priority: data.priority,
          task_type: data.task_type,
          status: data.status,
          source: data.source,
          assignee_id: data.assignee_id,
          created_at: data.created_at,
          updated_at: data.updated_at,
        },
      });
    }

    // Fallback - create mock task
    const mockTask = {
      id: uuidv4(),
      title,
      description,
      customer_id,
      due_date,
      priority: priority || 'medium',
      task_type: task_type || 'other',
      status: 'pending',
      source: 'manual',
      assignee_id: assignee_id || userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    res.status(201).json({
      success: true,
      task: mockTask,
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create task',
      },
    });
  }
});

/**
 * PATCH /api/tasks/:id
 * Update a task
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated
    delete updates.id;
    delete updates.created_at;
    delete updates.source;
    delete updates.source_input;
    delete updates.parse_confidence;

    if (supabase) {
      let query = supabase
        .from('plan_tasks')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      const orgId = getOrgId(req);
      if (orgId) {
        query = query.eq('organization_id', orgId);
      } else {
        query = query.is('organization_id', null);
      }
      const { data, error } = await query
        .select('*, customers(name)')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Task not found' },
          });
        }
        throw error;
      }

      return res.json({
        success: true,
        task: {
          id: data.id,
          title: data.title,
          description: data.description,
          customer_id: data.customer_id,
          customer_name: data.customers?.name,
          due_date: data.due_date,
          priority: data.priority,
          task_type: data.task_type,
          status: data.status,
          source: data.source,
          source_input: data.source_input,
          parse_confidence: data.parse_confidence,
          assignee_id: data.assignee_id,
          created_at: data.created_at,
          updated_at: data.updated_at,
        },
      });
    }

    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Task not found' },
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update task',
      },
    });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (supabase) {
      let deleteQuery = supabase.from('plan_tasks').delete().eq('id', id);
      const deleteOrgId = getOrgId(req);
      if (deleteOrgId) {
        deleteQuery = deleteQuery.eq('organization_id', deleteOrgId);
      } else {
        deleteQuery = deleteQuery.is('organization_id', null);
      }
      const { error } = await deleteQuery;

      if (error) {
        throw error;
      }

      return res.json({
        success: true,
        message: 'Task deleted successfully',
      });
    }

    res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete task',
      },
    });
  }
});

/**
 * POST /api/tasks/:id/complete
 * Mark a task as completed
 */
router.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    if (supabase) {
      let completeQuery = supabase
        .from('plan_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completion_notes: notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      const completeOrgId = getOrgId(req);
      if (completeOrgId) {
        completeQuery = completeQuery.eq('organization_id', completeOrgId);
      } else {
        completeQuery = completeQuery.is('organization_id', null);
      }
      const { data, error } = await completeQuery
        .select('*, customers(name)')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Task not found' },
          });
        }
        throw error;
      }

      return res.json({
        success: true,
        task: {
          id: data.id,
          title: data.title,
          status: data.status,
          completed_at: data.completed_at,
        },
      });
    }

    res.json({
      success: true,
      task: { id, status: 'completed' },
    });
  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to complete task',
      },
    });
  }
});

export { router as taskRoutes };
