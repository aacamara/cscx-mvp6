/**
 * Conversation Context Routes (PRD-223)
 *
 * API endpoints for conversation context retention:
 * - GET /api/context/:customerId - Get context for a customer
 * - POST /api/context/remember - Explicitly save a memory
 * - POST /api/context/forget - Remove specific context
 * - GET /api/context/preferences - Get user preferences
 * - PUT /api/context/preferences - Update user preferences
 * - GET /api/context/history - Search conversation history
 * - GET /api/context/summary - Get conversation summaries
 */

import { Router, Request, Response } from 'express';
import {
  conversationContextService,
  CustomerContext,
  RelevantContext,
} from '../services/conversationContext.js';

const router = Router();

/**
 * GET /api/context/:customerId
 *
 * Get current context for a customer conversation.
 * Returns recent conversation, customer context, and relevant past interactions.
 */
router.get('/:customerId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID header (x-user-id) is required',
      });
    }

    const { customerId } = req.params;
    const { query, maxTokens, includeHistory } = req.query;

    // Retrieve relevant context
    const context = await conversationContextService.retrieveRelevantContext(
      (query as string) || '',
      customerId,
      userId,
      {
        maxTokens: maxTokens ? parseInt(maxTokens as string, 10) : undefined,
        includeHistory: includeHistory !== 'false',
      }
    );

    // Format response per PRD specification
    const response = {
      customer_id: customerId,
      recent_conversation: context.customerContext ? {
        last_interaction: context.customerContext.lastDiscussed?.toISOString(),
        summary: context.customerContext.lastInteractionSummary,
        pending_actions: context.customerContext.pendingActions,
      } : null,
      key_context: context.customerContext ? {
        relationship_status: deriveRelationshipStatus(context.customerContext),
        recent_topics: context.customerContext.recentTopics,
        sentiment_trend: deriveSentimentTrend(context.customerContext.sentimentHistory),
      } : null,
      previous_sessions: context.relevantPastConversations.slice(0, 5).map(conv => ({
        date: conv.timestamp.toISOString().split('T')[0],
        summary: conv.summary || conv.content.substring(0, 100) + '...',
        topics: conv.keyTopics,
      })),
      user_preferences: context.userPreferences ? {
        communication_style: context.userPreferences.communicationStyle,
        timezone: context.userPreferences.timezone,
      } : null,
      context_tokens: context.totalTokens,
    };

    res.json(response);
  } catch (error) {
    console.error('Context retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve context',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/context/
 *
 * Get general context (not customer-specific).
 * Returns user preferences and work state.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID header (x-user-id) is required',
      });
    }

    const [userPreferences, workState] = await Promise.all([
      conversationContextService.getUserPreferences(userId),
      conversationContextService.getWorkState(userId),
    ]);

    res.json({
      user_preferences: userPreferences,
      work_state: workState,
      active_customer_id: workState?.activeCustomerId,
      recent_customers: workState?.recentCustomers || [],
    });
  } catch (error) {
    console.error('General context error:', error);
    res.status(500).json({
      error: 'Failed to retrieve context',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/context/remember
 *
 * Explicitly save something to memory.
 */
router.post('/remember', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID header (x-user-id) is required',
      });
    }

    const { customer_id, memory_type, content, importance, tags } = req.body;

    if (!content) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'content is required',
      });
    }

    const validTypes = ['note', 'preference', 'decision', 'shortcut', 'workflow'];
    const type = validTypes.includes(memory_type) ? memory_type : 'note';

    const validImportance = ['low', 'medium', 'high', 'critical'];
    const imp = validImportance.includes(importance) ? importance : 'medium';

    const result = await conversationContextService.rememberExplicit(
      userId,
      customer_id || null,
      type,
      content,
      imp,
      tags || []
    );

    if (!result) {
      return res.status(500).json({
        error: 'Failed to save memory',
        message: 'Could not persist memory to database',
      });
    }

    res.json({
      success: true,
      memory_id: result.id,
      message: 'Memory saved successfully',
    });
  } catch (error) {
    console.error('Remember error:', error);
    res.status(500).json({
      error: 'Failed to save memory',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/context/forget
 *
 * Remove specific context.
 */
router.post('/forget', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID header (x-user-id) is required',
      });
    }

    const { memory_ids, scope, customer_id } = req.body;

    const validScopes = ['specific', 'customer', 'all'];
    const actualScope = validScopes.includes(scope) ? scope : 'specific';

    if (actualScope === 'specific' && (!memory_ids || !Array.isArray(memory_ids))) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'memory_ids array is required for specific scope',
      });
    }

    if (actualScope === 'customer' && !customer_id) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'customer_id is required for customer scope',
      });
    }

    if (actualScope === 'all') {
      // Require confirmation for deleting all
      const { confirm } = req.body;
      if (confirm !== true) {
        return res.status(400).json({
          error: 'Confirmation required',
          message: 'Set confirm: true to delete all memories',
        });
      }
    }

    const result = await conversationContextService.forget(
      userId,
      memory_ids || [],
      actualScope,
      customer_id
    );

    res.json({
      success: true,
      deleted: result.deleted,
      message: `Successfully deleted ${result.deleted} memory items`,
    });
  } catch (error) {
    console.error('Forget error:', error);
    res.status(500).json({
      error: 'Failed to forget',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/context/preferences
 *
 * Get user preferences.
 */
router.get('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID header (x-user-id) is required',
      });
    }

    const preferences = await conversationContextService.getUserPreferences(userId);

    res.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({
      error: 'Failed to get preferences',
      message: (error as Error).message,
    });
  }
});

/**
 * PUT /api/context/preferences
 *
 * Update user preferences.
 */
router.put('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID header (x-user-id) is required',
      });
    }

    const {
      communication_style,
      preferred_actions,
      timezone,
      working_hours_start,
      working_hours_end,
      email_signature,
      common_shortcuts,
    } = req.body;

    // Validate communication style
    const validStyles = ['formal', 'casual', 'brief', 'professional'];
    if (communication_style && !validStyles.includes(communication_style)) {
      return res.status(400).json({
        error: 'Invalid communication_style',
        message: `Must be one of: ${validStyles.join(', ')}`,
      });
    }

    // This would need a direct database update
    // For now, use the preference signals method
    const signals = [];
    if (communication_style) {
      signals.push(`prefer ${communication_style} communication`);
    }

    if (signals.length > 0) {
      await conversationContextService.updateUserPreferences(userId, signals);
    }

    res.json({
      success: true,
      message: 'Preferences updated',
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      error: 'Failed to update preferences',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/context/history
 *
 * Search conversation history.
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID header (x-user-id) is required',
      });
    }

    const {
      customer_id,
      query,
      limit = '20',
      threshold = '0.7',
    } = req.query;

    let results;

    if (query) {
      // Semantic search
      results = await conversationContextService.searchRelevantConversations(
        query as string,
        userId,
        customer_id as string | undefined || null,
        parseFloat(threshold as string),
        parseInt(limit as string, 10)
      );
    } else {
      // Recent history
      results = await conversationContextService.getRecentConversation(
        userId,
        customer_id as string | undefined || null,
        parseInt(limit as string, 10)
      );
    }

    res.json({
      success: true,
      count: results.length,
      conversations: results.map(conv => ({
        id: conv.id,
        customer_id: conv.customerId,
        session_id: conv.sessionId,
        timestamp: conv.timestamp.toISOString(),
        role: conv.role,
        content: conv.content,
        summary: conv.summary,
        importance_score: conv.importanceScore,
        key_topics: conv.keyTopics,
      })),
    });
  } catch (error) {
    console.error('History search error:', error);
    res.status(500).json({
      error: 'Failed to search history',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/context/memories
 *
 * Get explicit memories.
 */
router.get('/memories', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID header (x-user-id) is required',
      });
    }

    const { customer_id, memory_type } = req.query;

    const memories = await conversationContextService.getExplicitMemories(
      userId,
      customer_id as string | undefined,
      memory_type as string | undefined
    );

    res.json({
      success: true,
      count: memories.length,
      memories: memories.map(m => ({
        id: m.id,
        type: m.type,
        content: m.content,
        importance: m.importance,
        created_at: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Get memories error:', error);
    res.status(500).json({
      error: 'Failed to get memories',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/context/conversation
 *
 * Store a conversation turn and update context.
 */
router.post('/conversation', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID header (x-user-id) is required',
      });
    }

    const {
      session_id,
      customer_id,
      user_message,
      assistant_response,
    } = req.body;

    if (!session_id || !user_message || !assistant_response) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'session_id, user_message, and assistant_response are required',
      });
    }

    // Store and update memory
    await conversationContextService.updateMemoryFromConversation(
      session_id,
      userId,
      customer_id || null,
      user_message,
      assistant_response
    );

    res.json({
      success: true,
      message: 'Conversation stored and context updated',
    });
  } catch (error) {
    console.error('Store conversation error:', error);
    res.status(500).json({
      error: 'Failed to store conversation',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/context/active-customer
 *
 * Set the active customer for context switching.
 */
router.post('/active-customer', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID header (x-user-id) is required',
      });
    }

    const { customer_id } = req.body;

    await conversationContextService.setActiveCustomer(userId, customer_id || null);

    if (customer_id) {
      await conversationContextService.addRecentCustomer(userId, customer_id);
    }

    res.json({
      success: true,
      active_customer_id: customer_id,
    });
  } catch (error) {
    console.error('Set active customer error:', error);
    res.status(500).json({
      error: 'Failed to set active customer',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/context/build
 *
 * Build a context string for AI prompts.
 */
router.get('/build', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID header (x-user-id) is required',
      });
    }

    const { customer_id, query, max_tokens } = req.query;

    const context = await conversationContextService.retrieveRelevantContext(
      (query as string) || '',
      (customer_id as string) || null,
      userId,
      {
        maxTokens: max_tokens ? parseInt(max_tokens as string, 10) : undefined,
      }
    );

    const contextString = conversationContextService.buildContextString(context);

    res.json({
      success: true,
      context_string: contextString,
      total_tokens: context.totalTokens,
      sources: {
        recent_messages: context.recentConversation.length,
        relevant_past: context.relevantPastConversations.length,
        has_customer_context: !!context.customerContext,
        has_preferences: !!context.userPreferences,
      },
    });
  } catch (error) {
    console.error('Build context error:', error);
    res.status(500).json({
      error: 'Failed to build context',
      message: (error as Error).message,
    });
  }
});

// ============================================
// Helper Functions
// ============================================

function deriveRelationshipStatus(context: CustomerContext): string {
  const sentiment = deriveSentimentTrend(context.sentimentHistory);
  const hasPendingActions = context.pendingActions.length > 0;
  const recentActivity = context.lastDiscussed
    ? (Date.now() - context.lastDiscussed.getTime()) < 7 * 24 * 60 * 60 * 1000
    : false;

  if (sentiment === 'positive' && recentActivity) {
    return 'Healthy - Active engagement';
  } else if (sentiment === 'negative') {
    return 'At risk - Negative sentiment detected';
  } else if (!recentActivity && hasPendingActions) {
    return 'Needs attention - Pending actions';
  } else if (!recentActivity) {
    return 'Inactive - No recent engagement';
  }

  return 'Stable';
}

function deriveSentimentTrend(
  history: Array<{ score: number; timestamp: string }>
): string {
  if (!history || history.length === 0) return 'neutral';

  const recent = history.slice(-5);
  const avgScore = recent.reduce((sum, h) => sum + h.score, 0) / recent.length;

  if (avgScore > 0.3) return 'positive';
  if (avgScore < -0.3) return 'negative';
  return 'stable';
}

export default router;
