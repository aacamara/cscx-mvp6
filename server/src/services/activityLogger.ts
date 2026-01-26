/**
 * Activity Logger Service
 *
 * Logs agent activities, chat messages, and user interactions to the database.
 * Provides a unified interface for tracking all system activities.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

export interface AgentActivity {
  customer_id?: string;
  user_id: string;
  agent_type: 'onboarding' | 'adoption' | 'renewal' | 'risk' | 'strategic';
  action_type: string;
  action_data?: Record<string, unknown>;
  result_data?: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  error_message?: string;
  session_id?: string;
  parent_action_id?: string;
}

export interface ChatMessage {
  customer_id?: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  agent_type?: string;
  tool_calls?: unknown[];
  session_id: string;
}

export class ActivityLogger {
  /**
   * Log an agent activity
   */
  async logActivity(activity: AgentActivity): Promise<string | null> {
    if (!supabase) {
      console.log('[ActivityLogger] No database, activity not persisted:', activity.action_type);
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('agent_activity_log')
        .insert({
          customer_id: activity.customer_id || null,
          user_id: activity.user_id,
          agent_type: activity.agent_type,
          action_type: activity.action_type,
          action_data: activity.action_data || {},
          result_data: activity.result_data || {},
          status: activity.status,
          error_message: activity.error_message || null,
          session_id: activity.session_id || null,
          parent_action_id: activity.parent_action_id || null,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error('[ActivityLogger] Failed to log activity:', error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error('[ActivityLogger] Error logging activity:', error);
      return null;
    }
  }

  /**
   * Update an existing activity (e.g., mark as completed)
   */
  async updateActivity(
    activityId: string,
    updates: Partial<{
      status: AgentActivity['status'];
      result_data: Record<string, unknown>;
      error_message: string;
      completed_at: string;
      duration_ms: number;
    }>
  ): Promise<boolean> {
    if (!supabase) {
      return false;
    }

    try {
      const { error } = await supabase
        .from('agent_activity_log')
        .update({
          ...updates,
          completed_at: updates.completed_at || (updates.status === 'completed' || updates.status === 'failed' ? new Date().toISOString() : undefined),
        })
        .eq('id', activityId);

      if (error) {
        console.error('[ActivityLogger] Failed to update activity:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ActivityLogger] Error updating activity:', error);
      return false;
    }
  }

  /**
   * Log a chat message
   */
  async logChatMessage(message: ChatMessage): Promise<string | null> {
    if (!supabase) {
      console.log('[ActivityLogger] No database, message not persisted');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          customer_id: message.customer_id || null,
          user_id: message.user_id,
          role: message.role,
          content: message.content,
          agent_type: message.agent_type || null,
          tool_calls: message.tool_calls || [],
          session_id: message.session_id,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[ActivityLogger] Failed to log chat message:', error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error('[ActivityLogger] Error logging chat message:', error);
      return null;
    }
  }

  /**
   * Log multiple chat messages at once
   */
  async logChatMessages(messages: ChatMessage[]): Promise<number> {
    if (!supabase || messages.length === 0) {
      return 0;
    }

    try {
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
          }))
        )
        .select('id');

      if (error) {
        console.error('[ActivityLogger] Failed to log chat messages:', error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.error('[ActivityLogger] Error logging chat messages:', error);
      return 0;
    }
  }

  /**
   * Get recent activities for a customer
   */
  async getCustomerActivities(
    customerId: string,
    options: { limit?: number; agentType?: string } = {}
  ): Promise<unknown[]> {
    if (!supabase) {
      return [];
    }

    try {
      let query = supabase
        .from('agent_activity_log')
        .select('*')
        .eq('customer_id', customerId)
        .order('started_at', { ascending: false })
        .limit(options.limit || 50);

      if (options.agentType) {
        query = query.eq('agent_type', options.agentType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[ActivityLogger] Failed to fetch activities:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[ActivityLogger] Error fetching activities:', error);
      return [];
    }
  }

  /**
   * Get chat history for a session
   */
  async getSessionChat(sessionId: string, limit: number = 100): Promise<unknown[]> {
    if (!supabase) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('[ActivityLogger] Failed to fetch chat:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[ActivityLogger] Error fetching chat:', error);
      return [];
    }
  }

  /**
   * Create a combined activity and chat log entry
   * Useful for agent actions that also produce a user-facing message
   */
  async logActionWithMessage(
    activity: AgentActivity,
    message?: Omit<ChatMessage, 'user_id' | 'session_id'>
  ): Promise<{ activityId: string | null; messageId: string | null }> {
    const activityId = await this.logActivity(activity);

    let messageId: string | null = null;
    if (message && activity.session_id) {
      messageId = await this.logChatMessage({
        ...message,
        user_id: activity.user_id,
        session_id: activity.session_id,
        agent_type: activity.agent_type,
      });
    }

    return { activityId, messageId };
  }
}

// Singleton instance
export const activityLogger = new ActivityLogger();
export default activityLogger;
