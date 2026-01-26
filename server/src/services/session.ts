/**
 * Session Service
 * Manages agent conversation sessions with Supabase persistence
 *
 * Features:
 * - Session creation and retrieval
 * - Message persistence
 * - Session context updates
 * - In-memory caching for performance
 * - Session expiration and cleanup
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { CustomerContext } from '../agents/base.js';

// Types
export interface SessionMessage {
  id?: string;
  sessionId: string;
  agentId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: boolean;
  requiresApproval?: boolean;
  deployedAgent?: string;
  toolCalls?: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

export interface Session {
  id: string;
  customerId?: string;
  userId?: string;
  status: 'active' | 'completed' | 'expired';
  context: SessionContext;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionContext {
  customerContext?: CustomerContext;
  currentSpecialist?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  contractContext?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PendingAction {
  id: string;
  sessionId: string;
  messageId?: string;
  agentId?: string;
  actionType: string;
  actionData: Record<string, unknown>;
  description?: string;
  requiresApproval: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
  executedAt?: Date;
  executionResult?: Record<string, unknown>;
  createdAt: Date;
}

// In-memory cache for active sessions
const sessionCache = new Map<string, {
  session: Session;
  messages: SessionMessage[];
  pendingActions: Map<string, PendingAction>;
  lastAccessed: Date;
}>();

// Cache TTL: 30 minutes
const CACHE_TTL_MS = 30 * 60 * 1000;

// Session expiry: 24 hours
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

// UUID validation helper
const isValidUUID = (str: string | undefined | null): boolean => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

class SessionService {
  private client: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.client = createClient(
        config.supabaseUrl,
        config.supabaseServiceKey
      );
    }
  }

  /**
   * Check if Supabase is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Create a new session
   */
  async createSession(params: {
    sessionId?: string;  // Allow passing a specific session ID
    customerId?: string;
    userId?: string;
    context?: SessionContext;
    metadata?: Record<string, unknown>;
  }): Promise<Session> {
    const { sessionId, customerId, userId, context = {}, metadata = {} } = params;

    // Use provided sessionId or generate a new one
    const finalSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (!this.client) {
      // In-memory only mode
      const session: Session = {
        id: finalSessionId,
        customerId,
        userId,
        status: 'active',
        context,
        metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      sessionCache.set(session.id, {
        session,
        messages: [],
        pendingActions: new Map(),
        lastAccessed: new Date()
      });

      return session;
    }

    // Validate UUIDs - Supabase requires valid UUIDs or null
    const validCustomerId = isValidUUID(customerId) ? customerId : null;
    const validUserId = isValidUUID(userId) ? userId : null;

    // Store metadata and original IDs in the context column (merged)
    // This ensures compatibility with existing database schema
    const enrichedContext = {
      ...context,
      _metadata: {
        ...metadata,
        ...(customerId && !validCustomerId ? { original_customer_id: customerId } : {}),
        ...(userId && !validUserId ? { original_user_id: userId } : {})
      }
    };

    // Create in Supabase
    const { data, error } = await this.client
      .from('agent_sessions')
      .insert({
        customer_id: validCustomerId,
        user_id: validUserId,
        status: 'active',
        context: enrichedContext
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create session:', error);
      throw new Error(`Failed to create session: ${error.message}`);
    }

    // Extract metadata from context for the session object
    const storedContext = data.context || {};
    const storedMetadata = storedContext._metadata || {};
    delete storedContext._metadata;

    const session: Session = {
      id: data.id,
      customerId: data.customer_id,
      userId: data.user_id,
      status: data.status,
      context: storedContext,
      metadata: storedMetadata,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };

    // Cache the session with BOTH the DB id AND the provided sessionId (if different)
    const cacheEntry = {
      session,
      messages: [],
      pendingActions: new Map(),
      lastAccessed: new Date()
    };
    sessionCache.set(session.id, cacheEntry);

    // Also cache by the frontend-provided sessionId for easy lookup
    if (sessionId && sessionId !== session.id) {
      sessionCache.set(sessionId, cacheEntry);
    }

    return session;
  }

  /**
   * Get a session by ID (from cache or database)
   */
  async getSession(sessionId: string): Promise<Session | null> {
    // Check cache first
    const cached = sessionCache.get(sessionId);
    if (cached) {
      cached.lastAccessed = new Date();
      return cached.session;
    }

    if (!this.client) {
      return null;
    }

    // Load from database
    const { data, error } = await this.client
      .from('agent_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      return null;
    }

    // Extract metadata from context (stored in _metadata key for schema compatibility)
    const storedContext = data.context || {};
    const storedMetadata = storedContext._metadata || {};
    const cleanContext = { ...storedContext };
    delete cleanContext._metadata;

    const session: Session = {
      id: data.id,
      customerId: data.customer_id,
      userId: data.user_id,
      status: data.status,
      context: cleanContext,
      metadata: storedMetadata,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };

    // Load messages and cache
    const messages = await this.getMessages(sessionId);
    const actions = await this.getPendingActions(sessionId);

    sessionCache.set(sessionId, {
      session,
      messages,
      pendingActions: new Map(actions.map(a => [a.id, a])),
      lastAccessed: new Date()
    });

    return session;
  }

  /**
   * Get or create a session
   */
  async getOrCreateSession(params: {
    sessionId?: string;
    customerId?: string;
    userId?: string;
    context?: SessionContext;
  }): Promise<Session> {
    const { sessionId, customerId, userId, context } = params;

    if (sessionId) {
      const existing = await this.getSession(sessionId);
      if (existing) {
        // Update context if provided
        if (context) {
          await this.updateSessionContext(sessionId, context);
        }
        return existing;
      }
    }

    // Create new session with the provided sessionId (or generate one)
    return this.createSession({ sessionId, customerId, userId, context });
  }

  /**
   * Update session context
   */
  async updateSessionContext(
    sessionId: string,
    context: Partial<SessionContext>
  ): Promise<void> {
    const cached = sessionCache.get(sessionId);
    if (cached) {
      cached.session.context = { ...cached.session.context, ...context };
      cached.session.updatedAt = new Date();
      cached.lastAccessed = new Date();
    }

    if (!this.client) return;

    // Get current context and merge
    const { data: current } = await this.client
      .from('agent_sessions')
      .select('context')
      .eq('id', sessionId)
      .single();

    const mergedContext = { ...(current?.context || {}), ...context };

    await this.client
      .from('agent_sessions')
      .update({ context: mergedContext })
      .eq('id', sessionId);
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionId: string,
    status: Session['status']
  ): Promise<void> {
    const cached = sessionCache.get(sessionId);
    if (cached) {
      cached.session.status = status;
      cached.session.updatedAt = new Date();
    }

    if (!this.client) return;

    await this.client
      .from('agent_sessions')
      .update({ status })
      .eq('id', sessionId);
  }

  /**
   * Add a message to a session
   */
  async addMessage(message: SessionMessage): Promise<SessionMessage> {
    const messageWithId: SessionMessage = {
      ...message,
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: message.createdAt || new Date()
    };

    // Add to cache
    const cached = sessionCache.get(message.sessionId);
    if (cached) {
      cached.messages.push(messageWithId);
      cached.lastAccessed = new Date();
    }

    if (!this.client) {
      return messageWithId;
    }

    // Save to database
    const { data, error } = await this.client
      .from('agent_messages')
      .insert({
        session_id: message.sessionId,
        agent_id: message.agentId,
        role: message.role,
        content: message.content,
        thinking: message.thinking || false,
        requires_approval: message.requiresApproval || false,
        deployed_agent: message.deployedAgent,
        tool_calls: message.toolCalls,
        metadata: message.metadata
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to save message:', error);
    } else if (data) {
      messageWithId.id = data.id;
      messageWithId.createdAt = new Date(data.created_at);
    }

    return messageWithId;
  }

  /**
   * Get all messages for a session
   */
  async getMessages(sessionId: string): Promise<SessionMessage[]> {
    // Check cache first
    const cached = sessionCache.get(sessionId);
    if (cached && cached.messages.length > 0) {
      cached.lastAccessed = new Date();
      return cached.messages;
    }

    if (!this.client) {
      return cached?.messages || [];
    }

    // Load from database
    const { data, error } = await this.client
      .from('agent_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error || !data) {
      return [];
    }

    const messages: SessionMessage[] = data.map(m => ({
      id: m.id,
      sessionId: m.session_id,
      agentId: m.agent_id,
      role: m.role,
      content: m.content,
      thinking: m.thinking,
      requiresApproval: m.requires_approval,
      deployedAgent: m.deployed_agent,
      toolCalls: m.tool_calls,
      metadata: m.metadata,
      createdAt: new Date(m.created_at)
    }));

    // Update cache
    if (cached) {
      cached.messages = messages;
    }

    return messages;
  }

  /**
   * Get conversation history formatted for LLM
   */
  async getConversationHistory(
    sessionId: string,
    limit: number = 20
  ): Promise<Array<{ role: string; content: string }>> {
    const messages = await this.getMessages(sessionId);

    return messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-limit)
      .map(m => ({
        role: m.role,
        content: m.content
      }));
  }

  /**
   * Add a pending action
   */
  async addPendingAction(action: Omit<PendingAction, 'id' | 'createdAt'>): Promise<PendingAction> {
    const fullAction: PendingAction = {
      ...action,
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date()
    };

    // Add to cache
    const cached = sessionCache.get(action.sessionId);
    if (cached) {
      cached.pendingActions.set(fullAction.id, fullAction);
      cached.lastAccessed = new Date();
    }

    if (!this.client) {
      return fullAction;
    }

    // Save to database
    const { data, error } = await this.client
      .from('agent_actions')
      .insert({
        session_id: action.sessionId,
        message_id: action.messageId,
        agent_id: action.agentId,
        action_type: action.actionType,
        action_data: action.actionData,
        description: action.description,
        requires_approval: action.requiresApproval,
        approval_status: action.approvalStatus
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to save action:', error);
    } else if (data) {
      fullAction.id = data.id;
    }

    return fullAction;
  }

  /**
   * Get pending actions for a session
   */
  async getPendingActions(sessionId: string): Promise<PendingAction[]> {
    const cached = sessionCache.get(sessionId);
    if (cached && cached.pendingActions.size > 0) {
      return Array.from(cached.pendingActions.values())
        .filter(a => a.approvalStatus === 'pending');
    }

    if (!this.client) {
      return [];
    }

    const { data, error } = await this.client
      .from('agent_actions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(a => ({
      id: a.id,
      sessionId: a.session_id,
      messageId: a.message_id,
      agentId: a.agent_id,
      actionType: a.action_type,
      actionData: a.action_data,
      description: a.description,
      requiresApproval: a.requires_approval,
      approvalStatus: a.approval_status,
      approvedBy: a.approved_by,
      approvedAt: a.approved_at ? new Date(a.approved_at) : undefined,
      executedAt: a.executed_at ? new Date(a.executed_at) : undefined,
      executionResult: a.execution_result,
      createdAt: new Date(a.created_at)
    }));
  }

  /**
   * Update action approval status
   */
  async updateActionStatus(
    actionId: string,
    status: 'approved' | 'rejected',
    approvedBy?: string
  ): Promise<void> {
    // Update in all caches
    for (const [, cached] of sessionCache) {
      const action = cached.pendingActions.get(actionId);
      if (action) {
        action.approvalStatus = status;
        action.approvedBy = approvedBy;
        action.approvedAt = new Date();
        break;
      }
    }

    if (!this.client) return;

    await this.client
      .from('agent_actions')
      .update({
        approval_status: status,
        approved_by: approvedBy,
        approved_at: new Date().toISOString()
      })
      .eq('id', actionId);
  }

  /**
   * Get user's active sessions
   */
  async getUserSessions(userId: string, limit: number = 10): Promise<Session[]> {
    if (!this.client) {
      return Array.from(sessionCache.values())
        .filter(c => c.session.userId === userId && c.session.status === 'active')
        .map(c => c.session)
        .slice(0, limit);
    }

    const { data, error } = await this.client
      .from('agent_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map(s => ({
      id: s.id,
      customerId: s.customer_id,
      userId: s.user_id,
      status: s.status,
      context: s.context || {},
      metadata: s.metadata || {},
      createdAt: new Date(s.created_at),
      updatedAt: new Date(s.updated_at)
    }));
  }

  /**
   * Get customer's sessions
   */
  async getCustomerSessions(customerId: string, limit: number = 10): Promise<Session[]> {
    if (!this.client) {
      return Array.from(sessionCache.values())
        .filter(c => c.session.customerId === customerId)
        .map(c => c.session)
        .slice(0, limit);
    }

    const { data, error } = await this.client
      .from('agent_sessions')
      .select('*')
      .eq('customer_id', customerId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map(s => ({
      id: s.id,
      customerId: s.customer_id,
      userId: s.user_id,
      status: s.status,
      context: s.context || {},
      metadata: s.metadata || {},
      createdAt: new Date(s.created_at),
      updatedAt: new Date(s.updated_at)
    }));
  }

  /**
   * Clean up expired cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    for (const [sessionId, cached] of sessionCache) {
      if (now - cached.lastAccessed.getTime() > CACHE_TTL_MS) {
        sessionCache.delete(sessionId);
      }
    }
  }

  /**
   * Expire old sessions
   */
  async expireOldSessions(): Promise<number> {
    const expiryDate = new Date(Date.now() - SESSION_EXPIRY_MS);

    if (!this.client) {
      let count = 0;
      for (const [sessionId, cached] of sessionCache) {
        if (cached.session.updatedAt < expiryDate && cached.session.status === 'active') {
          cached.session.status = 'expired';
          count++;
        }
      }
      return count;
    }

    const { data, error } = await this.client
      .from('agent_sessions')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .lt('updated_at', expiryDate.toISOString())
      .select('id');

    if (error) {
      console.error('Failed to expire sessions:', error);
      return 0;
    }

    return data?.length || 0;
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    cachedSessions: number;
    totalMessages: number;
    pendingActions: number;
  }> {
    if (!this.client) {
      let totalMessages = 0;
      let pendingActions = 0;
      for (const cached of sessionCache.values()) {
        totalMessages += cached.messages.length;
        pendingActions += Array.from(cached.pendingActions.values())
          .filter(a => a.approvalStatus === 'pending').length;
      }

      return {
        totalSessions: sessionCache.size,
        activeSessions: Array.from(sessionCache.values())
          .filter(c => c.session.status === 'active').length,
        cachedSessions: sessionCache.size,
        totalMessages,
        pendingActions
      };
    }

    const [sessionsResult, activeResult, messagesResult, actionsResult] = await Promise.all([
      this.client.from('agent_sessions').select('id', { count: 'exact', head: true }),
      this.client.from('agent_sessions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      this.client.from('agent_messages').select('id', { count: 'exact', head: true }),
      this.client.from('agent_actions').select('id', { count: 'exact', head: true }).eq('approval_status', 'pending')
    ]);

    return {
      totalSessions: sessionsResult.count || 0,
      activeSessions: activeResult.count || 0,
      cachedSessions: sessionCache.size,
      totalMessages: messagesResult.count || 0,
      pendingActions: actionsResult.count || 0
    };
  }
}

// Export singleton instance
export const sessionService = new SessionService();

// Start periodic cache cleanup
setInterval(() => {
  sessionService.cleanupCache();
}, 5 * 60 * 1000); // Every 5 minutes
