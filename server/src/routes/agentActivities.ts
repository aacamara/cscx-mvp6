/**
 * Agent Activities API Routes
 * Provides per-customer agent inbox: activities, approvals, chat history
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

const router = Router();

// Supabase client
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

/**
 * GET /api/agent-activities/customer/:customerId
 * Get all agent activities for a specific customer (inbox view)
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { customerId } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Fetch agent activity log for this customer
    const { data: activities, error: activitiesError } = await supabase
      .from('agent_activity_log')
      .select('*')
      .eq('customer_id', customerId)
      .order('started_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError);
    }

    // Fetch pending approvals for this customer
    const { data: approvals, error: approvalsError } = await supabase
      .from('approval_queue')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (approvalsError) {
      console.error('Error fetching approvals:', approvalsError);
    }

    // Fetch chat messages for this customer
    const { data: chatMessages, error: chatError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (chatError) {
      console.error('Error fetching chat messages:', chatError);
    }

    // Combine and format the data
    const inbox = {
      activities: (activities || []).map(a => ({
        id: a.id,
        type: 'activity',
        agentType: a.agent_type,
        actionType: a.action_type,
        status: a.status,
        actionData: a.action_data,
        resultData: a.result_data,
        errorMessage: a.error_message,
        startedAt: a.started_at,
        completedAt: a.completed_at,
        durationMs: a.duration_ms,
        sessionId: a.session_id
      })),
      pendingApprovals: (approvals || [])
        .filter(a => a.status === 'pending')
        .map(a => ({
          id: a.id,
          type: 'approval',
          actionType: a.action_type,
          actionData: a.action_data,
          originalContent: a.original_content,
          status: a.status,
          expiresAt: a.expires_at,
          createdAt: a.created_at
        })),
      completedApprovals: (approvals || [])
        .filter(a => a.status !== 'pending')
        .map(a => ({
          id: a.id,
          type: 'approval',
          actionType: a.action_type,
          actionData: a.action_data,
          status: a.status,
          reviewedAt: a.reviewed_at,
          reviewerNotes: a.reviewer_notes,
          createdAt: a.created_at
        })),
      chatHistory: (chatMessages || []).map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        agentType: m.agent_type,
        toolCalls: m.tool_calls,
        createdAt: m.created_at
      })),
      summary: {
        totalActivities: activities?.length || 0,
        pendingApprovals: approvals?.filter(a => a.status === 'pending').length || 0,
        completedToday: activities?.filter(a => {
          const today = new Date().toISOString().split('T')[0];
          return a.started_at?.startsWith(today);
        }).length || 0
      }
    };

    res.json(inbox);
  } catch (error) {
    console.error('Error fetching agent inbox:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/agent-activities
 * Log a new agent activity
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const {
      customerId,
      agentType,
      actionType,
      actionData,
      resultData,
      status = 'completed',
      sessionId,
      parentActionId
    } = req.body;

    if (!agentType || !actionType) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['agentType', 'actionType']
      });
    }

    const { data, error } = await supabase
      .from('agent_activity_log')
      .insert({
        customer_id: customerId,
        user_id: userId,
        agent_type: agentType,
        action_type: actionType,
        action_data: actionData || {},
        result_data: resultData || {},
        status,
        session_id: sessionId,
        parent_action_id: parentActionId,
        started_at: new Date().toISOString(),
        completed_at: status === 'completed' ? new Date().toISOString() : null
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      activity: data
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/agent-activities/chat-message
 * Save a chat message for a customer or general chat (no customer)
 *
 * Note on schema: user_id stores Supabase auth.uid() directly (no FK constraint).
 * This allows chat messages without requiring a record in public.users table.
 * See migration: 021_fix_chat_messages_userid.sql
 *
 * @param customerId - Optional: UUID of the customer. Null for general/global chat mode.
 * @param role - Required: 'user', 'assistant', or 'system'
 * @param content - Required: The message content
 * @param agentType - Optional: Type of agent (e.g., 'orchestrator', 'researcher')
 * @param toolCalls - Optional: JSON array of tool calls made by the agent
 * @param sessionId - Optional: Session ID to group related messages
 */
router.post('/chat-message', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID header (x-user-id) is required to save chat messages'
      });
    }

    if (!supabase) {
      return res.status(503).json({
        error: 'Database not configured',
        message: 'Supabase connection is not available. Check server configuration.'
      });
    }

    const {
      customerId,  // Optional - null for general mode chat (no specific customer)
      role,
      content,
      agentType,
      toolCalls,
      sessionId
    } = req.body;

    // Validate required fields
    if (!role || !content) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Both role and content are required to save a chat message',
        required: ['role', 'content'],
        received: { role: !!role, content: !!content }
      });
    }

    // Validate role value
    if (!['user', 'assistant', 'system'].includes(role)) {
      return res.status(400).json({
        error: 'Invalid role value',
        message: 'Role must be one of: user, assistant, system',
        received: role
      });
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        customer_id: customerId || null,  // Explicitly null for general mode
        user_id: userId,  // Stores auth.uid() directly (no FK constraint)
        role,
        content,
        agent_type: agentType || null,
        tool_calls: toolCalls || null,
        session_id: sessionId || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Database error saving chat message:', error);
      return res.status(500).json({
        error: 'Database error',
        message: error.message || 'Failed to save chat message',
        code: error.code
      });
    }

    res.status(201).json({
      success: true,
      message: data
    });
  } catch (error) {
    console.error('Error saving chat message:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: (error as Error).message || 'An unexpected error occurred'
    });
  }
});

/**
 * PATCH /api/agent-activities/:id
 * Update an activity status (e.g., mark as completed)
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { status, resultData, errorMessage, durationMs } = req.body;

    const updates: Record<string, any> = {};
    if (status) updates.status = status;
    if (resultData) updates.result_data = resultData;
    if (errorMessage) updates.error_message = errorMessage;
    if (durationMs) updates.duration_ms = durationMs;
    if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('agent_activity_log')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      activity: data
    });
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
