/**
 * Tasks API routes
 * Fetches tasks from Supabase google_tasks table
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const router = Router();

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

interface TaskRow {
  id: string;
  user_id: string;
  customer_id: string | null;
  google_task_id: string;
  google_tasklist_id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: 'high' | 'medium' | 'low';
  task_type: string;
  source: string;
  status: 'needsAction' | 'completed';
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/google/tasks
 * Fetch all tasks for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!supabase) {
      return res.json({ tasks: [], message: 'Task storage not configured' });
    }

    const { data, error } = await supabase
      .from('google_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }

    return res.json({ tasks: data || [] });
  } catch (error) {
    console.error('Error in tasks route:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/google/tasks/:id/complete
 * Mark a task as completed
 */
router.patch('/:id/complete', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!supabase) {
      return res.status(400).json({ error: 'Task storage not configured' });
    }

    const { data, error } = await supabase
      .from('google_tasks')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error completing task:', error);
      return res.status(500).json({ error: 'Failed to complete task' });
    }

    return res.json({ task: data });
  } catch (error) {
    console.error('Error completing task:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/google/tasks/:id
 * Delete a task
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!supabase) {
      return res.status(400).json({ error: 'Task storage not configured' });
    }

    const { error } = await supabase
      .from('google_tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting task:', error);
      return res.status(500).json({ error: 'Failed to delete task' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
