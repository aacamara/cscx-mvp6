/**
 * Agent Memory Service
 * Provides persistent memory and context for agents across conversations
 *
 * Features:
 * - Store conversation context per customer
 * - Retrieve relevant past interactions
 * - Summarize long histories to fit context window
 * - Auto-expire old memories (configurable TTL)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index.js';

// ============================================
// Types
// ============================================

export type MemoryType =
  | 'conversation'     // Chat/conversation snippets
  | 'action'           // Agent action records
  | 'insight'          // Learned insights about customer
  | 'preference'       // User/customer preferences
  | 'context'          // General context data
  | 'summary';         // Summarized memories

export interface AgentMemory {
  id: string;
  customerId: string;
  userId: string;
  type: MemoryType;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
  importance: number;        // 0-100, used for prioritization
  accessCount: number;       // How often this memory was accessed
  lastAccessedAt: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemorySearchResult {
  memory: AgentMemory;
  relevanceScore: number;
}

export interface MemoryContext {
  recentConversations: AgentMemory[];
  recentActions: AgentMemory[];
  insights: AgentMemory[];
  preferences: AgentMemory[];
  summaries: AgentMemory[];
  totalMemories: number;
}

export interface CreateMemoryInput {
  customerId: string;
  userId: string;
  type: MemoryType;
  content: string;
  metadata?: Record<string, any>;
  importance?: number;
  ttlDays?: number;          // Days until expiration
}

export interface MemoryConfig {
  maxMemoriesPerCustomer: number;
  defaultTtlDays: number;
  maxContextTokens: number;
  summarizeThreshold: number;  // Number of memories before summarizing
  cleanupIntervalHours: number;
}

// Default configuration
const DEFAULT_CONFIG: MemoryConfig = {
  maxMemoriesPerCustomer: 1000,
  defaultTtlDays: 90,
  maxContextTokens: 4000,
  summarizeThreshold: 50,
  cleanupIntervalHours: 24,
};

// ============================================
// Agent Memory Service
// ============================================

export class AgentMemoryService {
  private supabase: SupabaseClient | null = null;
  private anthropic: Anthropic | null = null;
  private memoryCache: Map<string, AgentMemory[]> = new Map();
  private config: MemoryConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(memoryConfig?: Partial<MemoryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...memoryConfig };

    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }

    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }
  }

  /**
   * Initialize the memory service (start cleanup job)
   */
  initialize(): void {
    console.log('[AgentMemory] Initializing memory service...');

    // Start periodic cleanup
    this.cleanupInterval = setInterval(
      () => this.cleanupExpiredMemories(),
      this.config.cleanupIntervalHours * 60 * 60 * 1000
    );

    // Run initial cleanup
    this.cleanupExpiredMemories().catch(console.error);
  }

  /**
   * Store a new memory
   */
  async storeMemory(input: CreateMemoryInput): Promise<AgentMemory> {
    const memory: AgentMemory = {
      id: uuidv4(),
      customerId: input.customerId,
      userId: input.userId,
      type: input.type,
      content: input.content,
      metadata: input.metadata,
      importance: input.importance || this.calculateImportance(input),
      accessCount: 0,
      lastAccessedAt: new Date(),
      expiresAt: input.ttlDays
        ? new Date(Date.now() + input.ttlDays * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + this.config.defaultTtlDays * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Persist to database
    if (this.supabase) {
      try {
        await this.supabase
          .from('agent_memory')
          .insert({
            id: memory.id,
            customer_id: memory.customerId,
            user_id: memory.userId,
            type: memory.type,
            content: memory.content,
            metadata: memory.metadata,
            importance: memory.importance,
            access_count: memory.accessCount,
            last_accessed_at: memory.lastAccessedAt.toISOString(),
            expires_at: memory.expiresAt?.toISOString(),
            created_at: memory.createdAt.toISOString(),
            updated_at: memory.updatedAt.toISOString(),
          });
      } catch (e) {
        console.error('[AgentMemory] Failed to persist memory:', e);
      }
    }

    // Add to cache
    this.addToCache(memory);

    // Check if we need to summarize
    await this.checkAndSummarize(memory.customerId, memory.userId);

    console.log(`[AgentMemory] Stored ${memory.type} memory for customer ${memory.customerId}`);
    return memory;
  }

  /**
   * Store a conversation exchange as memory
   */
  async storeConversation(
    customerId: string,
    userId: string,
    userMessage: string,
    assistantResponse: string,
    metadata?: Record<string, any>
  ): Promise<AgentMemory> {
    const content = `User: ${userMessage}\nAssistant: ${assistantResponse}`;
    return this.storeMemory({
      customerId,
      userId,
      type: 'conversation',
      content,
      metadata: {
        ...metadata,
        userMessage: userMessage.substring(0, 200),
        responsePreview: assistantResponse.substring(0, 200),
      },
    });
  }

  /**
   * Store an agent action as memory
   */
  async storeAction(
    customerId: string,
    userId: string,
    actionType: string,
    actionDetails: string,
    result: any
  ): Promise<AgentMemory> {
    return this.storeMemory({
      customerId,
      userId,
      type: 'action',
      content: `Action: ${actionType}\nDetails: ${actionDetails}\nResult: ${JSON.stringify(result).substring(0, 500)}`,
      metadata: {
        actionType,
        success: result?.success,
      },
      importance: result?.success === false ? 80 : 50, // Failed actions are more important
    });
  }

  /**
   * Store an insight about a customer
   */
  async storeInsight(
    customerId: string,
    userId: string,
    insight: string,
    confidence: number = 0.8
  ): Promise<AgentMemory> {
    return this.storeMemory({
      customerId,
      userId,
      type: 'insight',
      content: insight,
      metadata: { confidence },
      importance: Math.round(confidence * 100),
      ttlDays: 180, // Insights last longer
    });
  }

  /**
   * Get memories for a customer
   */
  async getMemories(
    customerId: string,
    options?: {
      types?: MemoryType[];
      limit?: number;
      minImportance?: number;
      includeExpired?: boolean;
    }
  ): Promise<AgentMemory[]> {
    const { types, limit = 50, minImportance = 0, includeExpired = false } = options || {};

    if (this.supabase) {
      try {
        let query = this.supabase
          .from('agent_memory')
          .select('*')
          .eq('customer_id', customerId)
          .gte('importance', minImportance)
          .order('importance', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(limit);

        if (types && types.length > 0) {
          query = query.in('type', types);
        }

        if (!includeExpired) {
          query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
        }

        const { data, error } = await query;

        if (data && !error) {
          const memories = data.map(this.mapDbToMemory);

          // Update access counts
          this.updateAccessCounts(memories.map(m => m.id));

          return memories;
        }
      } catch (e) {
        console.error('[AgentMemory] Failed to get memories:', e);
      }
    }

    // Fallback to cache
    const cached = this.memoryCache.get(customerId) || [];
    return cached
      .filter(m => !types || types.includes(m.type))
      .filter(m => m.importance >= minImportance)
      .filter(m => includeExpired || !m.expiresAt || m.expiresAt > new Date())
      .slice(0, limit);
  }

  /**
   * Get full memory context for an agent
   */
  async getMemoryContext(
    customerId: string,
    userId: string
  ): Promise<MemoryContext> {
    const [conversations, actions, insights, preferences, summaries] = await Promise.all([
      this.getMemories(customerId, { types: ['conversation'], limit: 10 }),
      this.getMemories(customerId, { types: ['action'], limit: 10 }),
      this.getMemories(customerId, { types: ['insight'], limit: 20 }),
      this.getMemories(customerId, { types: ['preference'], limit: 10 }),
      this.getMemories(customerId, { types: ['summary'], limit: 5 }),
    ]);

    return {
      recentConversations: conversations,
      recentActions: actions,
      insights,
      preferences,
      summaries,
      totalMemories: conversations.length + actions.length + insights.length + preferences.length + summaries.length,
    };
  }

  /**
   * Build a context string for agent prompts
   */
  async buildContextString(
    customerId: string,
    userId: string,
    maxTokens?: number
  ): Promise<string> {
    const context = await this.getMemoryContext(customerId, userId);
    const maxLen = maxTokens || this.config.maxContextTokens;

    let contextString = '';

    // Add summaries first (most important)
    if (context.summaries.length > 0) {
      contextString += '## Customer History Summary\n';
      for (const summary of context.summaries) {
        contextString += `${summary.content}\n\n`;
      }
    }

    // Add insights
    if (context.insights.length > 0) {
      contextString += '## Key Insights\n';
      for (const insight of context.insights.slice(0, 5)) {
        contextString += `- ${insight.content}\n`;
      }
      contextString += '\n';
    }

    // Add preferences
    if (context.preferences.length > 0) {
      contextString += '## Preferences\n';
      for (const pref of context.preferences) {
        contextString += `- ${pref.content}\n`;
      }
      contextString += '\n';
    }

    // Add recent conversations (if space allows)
    if (context.recentConversations.length > 0 && contextString.length < maxLen * 3) {
      contextString += '## Recent Interactions\n';
      for (const conv of context.recentConversations.slice(0, 3)) {
        const snippet = conv.content.substring(0, 300);
        contextString += `${snippet}${conv.content.length > 300 ? '...' : ''}\n\n`;
      }
    }

    // Truncate if too long (rough token estimate: 4 chars per token)
    if (contextString.length > maxLen * 4) {
      contextString = contextString.substring(0, maxLen * 4) + '\n[Context truncated...]';
    }

    return contextString;
  }

  /**
   * Search memories by content similarity
   */
  async searchMemories(
    customerId: string,
    query: string,
    limit: number = 10
  ): Promise<MemorySearchResult[]> {
    // For now, use simple text matching
    // In production, use vector embeddings for semantic search
    const memories = await this.getMemories(customerId, { limit: 100 });

    const queryLower = query.toLowerCase();
    const scored = memories
      .map(memory => ({
        memory,
        relevanceScore: this.calculateRelevance(memory.content, queryLower),
      }))
      .filter(r => r.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    return scored;
  }

  /**
   * Delete a specific memory
   */
  async deleteMemory(memoryId: string): Promise<boolean> {
    if (this.supabase) {
      try {
        const { error } = await this.supabase
          .from('agent_memory')
          .delete()
          .eq('id', memoryId);

        if (error) {
          console.error('[AgentMemory] Failed to delete memory:', error);
          return false;
        }
      } catch (e) {
        console.error('[AgentMemory] Delete error:', e);
        return false;
      }
    }

    // Remove from cache
    for (const [customerId, memories] of this.memoryCache) {
      const index = memories.findIndex(m => m.id === memoryId);
      if (index !== -1) {
        memories.splice(index, 1);
        break;
      }
    }

    return true;
  }

  /**
   * Clear all memories for a customer
   */
  async clearCustomerMemories(customerId: string): Promise<number> {
    let deletedCount = 0;

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('agent_memory')
          .delete()
          .eq('customer_id', customerId)
          .select('id');

        if (!error && data) {
          deletedCount = data.length;
        }
      } catch (e) {
        console.error('[AgentMemory] Clear error:', e);
      }
    }

    // Clear cache
    this.memoryCache.delete(customerId);

    console.log(`[AgentMemory] Cleared ${deletedCount} memories for customer ${customerId}`);
    return deletedCount;
  }

  /**
   * Summarize old memories to reduce count
   */
  async summarizeMemories(
    customerId: string,
    userId: string
  ): Promise<AgentMemory | null> {
    if (!this.anthropic) {
      console.log('[AgentMemory] Cannot summarize without Anthropic API');
      return null;
    }

    // Get old memories to summarize
    const oldMemories = await this.getMemories(customerId, {
      types: ['conversation', 'action'],
      limit: this.config.summarizeThreshold,
      minImportance: 0,
    });

    if (oldMemories.length < this.config.summarizeThreshold) {
      return null;
    }

    // Build content to summarize
    const content = oldMemories
      .map(m => `[${m.type}] ${m.content.substring(0, 200)}`)
      .join('\n\n');

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `Summarize these customer interaction records into a concise summary of key points, patterns, and important information. Focus on actionable insights.

Records:
${content}

Summary:`,
          },
        ],
      });

      const textContent = response.content.find(c => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        return null;
      }

      const summary = await this.storeMemory({
        customerId,
        userId,
        type: 'summary',
        content: textContent.text,
        metadata: {
          summarizedCount: oldMemories.length,
          summarizedAt: new Date().toISOString(),
        },
        importance: 90,
        ttlDays: 365, // Summaries last a year
      });

      // Mark old memories as lower importance (they're now summarized)
      await this.reduceImportance(oldMemories.map(m => m.id), 20);

      console.log(`[AgentMemory] Created summary for customer ${customerId}`);
      return summary;

    } catch (e) {
      console.error('[AgentMemory] Summarization failed:', e);
      return null;
    }
  }

  /**
   * Cleanup expired memories
   */
  async cleanupExpiredMemories(): Promise<number> {
    let deletedCount = 0;

    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('agent_memory')
          .delete()
          .lt('expires_at', new Date().toISOString())
          .select('id');

        if (!error && data) {
          deletedCount = data.length;
        }
      } catch (e) {
        console.error('[AgentMemory] Cleanup error:', e);
      }
    }

    // Clear expired from cache
    for (const [customerId, memories] of this.memoryCache) {
      const now = new Date();
      this.memoryCache.set(
        customerId,
        memories.filter(m => !m.expiresAt || m.expiresAt > now)
      );
    }

    if (deletedCount > 0) {
      console.log(`[AgentMemory] Cleaned up ${deletedCount} expired memories`);
    }

    return deletedCount;
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // ============================================
  // Private Helpers
  // ============================================

  private calculateImportance(input: CreateMemoryInput): number {
    let importance = 50;

    // Insights and preferences are more important
    if (input.type === 'insight') importance += 20;
    if (input.type === 'preference') importance += 15;

    // Longer content might be more important
    if (input.content.length > 500) importance += 10;

    // Cap at 100
    return Math.min(100, importance);
  }

  private calculateRelevance(content: string, query: string): number {
    const contentLower = content.toLowerCase();
    const words = query.split(/\s+/);

    let matches = 0;
    for (const word of words) {
      if (contentLower.includes(word)) {
        matches++;
      }
    }

    return words.length > 0 ? matches / words.length : 0;
  }

  private addToCache(memory: AgentMemory): void {
    const existing = this.memoryCache.get(memory.customerId) || [];
    existing.unshift(memory);

    // Keep cache size manageable
    if (existing.length > 100) {
      existing.pop();
    }

    this.memoryCache.set(memory.customerId, existing);
  }

  private async updateAccessCounts(memoryIds: string[]): Promise<void> {
    if (!this.supabase || memoryIds.length === 0) return;

    try {
      // Update in batches
      for (const id of memoryIds) {
        await this.supabase.rpc('increment_memory_access', { memory_id: id });
      }
    } catch (e) {
      // Non-critical, just log
      console.log('[AgentMemory] Failed to update access counts');
    }
  }

  private async reduceImportance(memoryIds: string[], newImportance: number): Promise<void> {
    if (!this.supabase || memoryIds.length === 0) return;

    try {
      await this.supabase
        .from('agent_memory')
        .update({ importance: newImportance, updated_at: new Date().toISOString() })
        .in('id', memoryIds);
    } catch (e) {
      console.error('[AgentMemory] Failed to reduce importance:', e);
    }
  }

  private async checkAndSummarize(customerId: string, userId: string): Promise<void> {
    const count = await this.getMemoryCount(customerId);
    if (count > this.config.summarizeThreshold * 2) {
      // Run summarization in background
      this.summarizeMemories(customerId, userId).catch(console.error);
    }
  }

  private async getMemoryCount(customerId: string): Promise<number> {
    if (this.supabase) {
      try {
        const { count, error } = await this.supabase
          .from('agent_memory')
          .select('*', { count: 'exact', head: true })
          .eq('customer_id', customerId);

        if (!error && count !== null) {
          return count;
        }
      } catch (e) {
        console.error('[AgentMemory] Count error:', e);
      }
    }

    return this.memoryCache.get(customerId)?.length || 0;
  }

  private mapDbToMemory(data: any): AgentMemory {
    return {
      id: data.id,
      customerId: data.customer_id,
      userId: data.user_id,
      type: data.type,
      content: data.content,
      metadata: data.metadata,
      embedding: data.embedding,
      importance: data.importance,
      accessCount: data.access_count || 0,
      lastAccessedAt: new Date(data.last_accessed_at),
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

// Singleton instance
export const agentMemoryService = new AgentMemoryService();

export default agentMemoryService;
