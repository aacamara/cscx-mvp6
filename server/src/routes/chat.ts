/**
 * Chat Message Routes
 *
 * Handles saving and retrieving chat messages for agent conversations.
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

const router = Router();

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

export interface ChatMessage {
  id?: string;
  customer_id?: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  agent_type?: string;
  tool_calls?: unknown[];
  session_id: string;
  created_at?: string;
  status?: 'sending' | 'sent' | 'failed';
  client_id?: string;
}

/**
 * POST /api/chat/messages
 *
 * Save a new chat message.
 */
router.post('/messages', async (req: Request, res: Response) => {
  try {
    const message: ChatMessage = req.body;

    if (!message.user_id || !message.role || !message.content || !message.session_id) {
      return res.status(400).json({
        error: 'Missing required fields: user_id, role, content, session_id',
      });
    }

    if (!supabase) {
      // In-memory fallback for development
      return res.json({
        success: true,
        message: {
          ...message,
          id: `msg_${Date.now()}`,
          created_at: new Date().toISOString(),
        },
        persisted: false,
      });
    }

    // Use upsert with client_id for deduplication (prevents duplicate messages on retry)
    const { data, error } = await supabase
      .from('chat_messages')
      .upsert({
        customer_id: message.customer_id || null,
        user_id: message.user_id,
        role: message.role,
        content: message.content,
        agent_type: message.agent_type || null,
        tool_calls: message.tool_calls || [],
        session_id: message.session_id,
        status: message.status || 'sent',
        client_id: message.client_id || null,
      }, {
        onConflict: 'client_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to save chat message:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      success: true,
      message: data,
      persisted: true,
    });
  } catch (error) {
    console.error('Chat message save error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/chat/messages/batch
 *
 * Save multiple chat messages at once.
 */
router.post('/messages/batch', async (req: Request, res: Response) => {
  try {
    const { messages } = req.body as { messages: ChatMessage[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    if (!supabase) {
      return res.json({
        success: true,
        count: messages.length,
        persisted: false,
      });
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(
        messages.map((m) => ({
          customer_id: m.customer_id || null,
          user_id: m.user_id,
          role: m.role,
          content: m.content,
          agent_type: m.agent_type || null,
          tool_calls: m.tool_calls || [],
          session_id: m.session_id,
          status: m.status || 'sent',
          client_id: m.client_id || null,
        }))
      )
      .select();

    if (error) {
      console.error('Failed to save chat messages:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      success: true,
      count: data?.length || 0,
      messages: data,
      persisted: true,
    });
  } catch (error) {
    console.error('Chat batch save error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/chat/customer/:customerId
 *
 * Get chat history for a customer.
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { session_id, limit = '100', offset = '0' } = req.query;

    if (!supabase) {
      return res.json({
        messages: [],
        total: 0,
        persisted: false,
      });
    }

    let query = supabase
      .from('chat_messages')
      .select('*', { count: 'exact' })
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (session_id) {
      query = query.eq('session_id', session_id);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Failed to fetch chat messages:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      messages: data || [],
      total: count || 0,
      persisted: true,
    });
  } catch (error) {
    console.error('Chat fetch error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/chat/session/:sessionId
 *
 * Get chat history for a specific session.
 */
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { limit = '100' } = req.query;

    if (!supabase) {
      return res.json({
        messages: [],
        total: 0,
        persisted: false,
      });
    }

    const { data, error, count } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact' })
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(parseInt(limit as string));

    if (error) {
      console.error('Failed to fetch session messages:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      messages: data || [],
      total: count || 0,
      sessionId,
      persisted: true,
    });
  } catch (error) {
    console.error('Session fetch error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/chat/user/:userId/sessions
 *
 * Get all chat sessions for a user.
 */
router.get('/user/:userId/sessions', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!supabase) {
      return res.json({ sessions: [], persisted: false });
    }

    // Get distinct sessions with their latest message and customer info
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        session_id,
        customer_id,
        agent_type,
        created_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch user sessions:', error);
      return res.status(500).json({ error: error.message });
    }

    // Group by session_id and get the latest entry
    const sessionMap = new Map<string, {
      session_id: string;
      customer_id: string | null;
      agent_type: string | null;
      last_message_at: string;
      message_count: number;
    }>();

    for (const msg of data || []) {
      const existing = sessionMap.get(msg.session_id);
      if (!existing) {
        sessionMap.set(msg.session_id, {
          session_id: msg.session_id,
          customer_id: msg.customer_id,
          agent_type: msg.agent_type,
          last_message_at: msg.created_at,
          message_count: 1,
        });
      } else {
        existing.message_count++;
      }
    }

    res.json({
      sessions: Array.from(sessionMap.values()),
      persisted: true,
    });
  } catch (error) {
    console.error('Sessions fetch error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/chat/history
 *
 * Get chat history with search and filtering.
 * Supports both general mode (all user's messages) and customer-specific mode.
 *
 * Query params:
 * - customerId: Optional UUID - filter to specific customer's messages
 * - search: Optional string - case-insensitive text search on content
 * - limit: Optional number - max results (default 50)
 * - offset: Optional number - pagination offset (default 0)
 *
 * Returns messages ordered by created_at DESC (newest first).
 * User can only access their own messages (enforced via x-user-id header).
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID header (x-user-id) is required to access chat history',
      });
    }

    if (!supabase) {
      return res.json({
        messages: [],
        total: 0,
        persisted: false,
      });
    }

    const {
      customerId,
      search,
      limit = '50',
      offset = '0',
    } = req.query;

    // Start building the query - filter by user_id for security
    // Include tool_calls to support attachment metadata display
    // Include status and client_id for message status tracking
    let query = supabase
      .from('chat_messages')
      .select('id, customer_id, user_id, role, content, agent_type, tool_calls, session_id, created_at, status, client_id', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Filter by customer if provided
    if (customerId && typeof customerId === 'string') {
      query = query.eq('customer_id', customerId);
    }

    // Apply text search if provided (case-insensitive)
    if (search && typeof search === 'string' && search.trim()) {
      query = query.ilike('content', `%${search.trim()}%`);
    }

    // Apply pagination
    const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100);
    const offsetNum = parseInt(offset as string, 10) || 0;
    query = query.range(offsetNum, offsetNum + limitNum - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Failed to fetch chat history:', error);
      return res.status(500).json({
        error: 'Database error',
        message: error.message,
      });
    }

    res.json({
      messages: data || [],
      total: count || 0,
      limit: limitNum,
      offset: offsetNum,
      persisted: true,
    });
  } catch (error) {
    console.error('Chat history fetch error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: (error as Error).message,
    });
  }
});

/**
 * DELETE /api/chat/session/:sessionId
 *
 * Delete all messages in a session.
 */
router.delete('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!supabase) {
      return res.json({ success: true, deleted: 0, persisted: false });
    }

    const { error, count } = await supabase
      .from('chat_messages')
      .delete({ count: 'exact' })
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to delete session:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      success: true,
      deleted: count || 0,
      persisted: true,
    });
  } catch (error) {
    console.error('Session delete error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
