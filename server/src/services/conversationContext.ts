/**
 * Conversation Context Retention Service (PRD-223)
 *
 * Provides intelligent context retrieval and memory management for AI conversations.
 * Features:
 * - Per-customer conversation persistence
 * - Semantic search via vector embeddings
 * - Automatic summarization of old conversations
 * - User preference learning
 * - Context window optimization
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { embeddingService } from './embedding.js';

// ============================================
// Types
// ============================================

export interface ConversationMemory {
  id: string;
  userId: string;
  customerId: string | null;
  sessionId: string;
  timestamp: Date;
  role: 'user' | 'assistant' | 'system';
  content: string;
  summary?: string;
  importanceScore: number;
  keyTopics: string[];
  actionItems: string[];
  metadata?: Record<string, unknown>;
}

export interface CustomerContext {
  customerId: string;
  lastDiscussed: Date | null;
  recentTopics: string[];
  pendingActions: string[];
  keyDecisions: string[];
  relationshipNotes: string;
  sentimentHistory: Array<{ score: number; timestamp: string }>;
  communicationPreferences: Record<string, unknown>;
  lastInteractionSummary: string;
  conversationCount: number;
  totalMessages: number;
}

export interface UserPreferences {
  userId: string;
  communicationStyle: 'formal' | 'casual' | 'brief' | 'professional';
  preferredActions: string[];
  timezone: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  emailSignature?: string;
  commonShortcuts: Record<string, string>;
}

export interface WorkState {
  userId: string;
  activeCustomerId: string | null;
  activeSessionId: string | null;
  pendingDrafts: Array<{ id: string; type: string; content: string; customerId?: string }>;
  inProgressTasks: Array<{ id: string; description: string; status: string }>;
  recentSearches: string[];
  recentCustomers: string[];
}

export interface RelevantContext {
  recentConversation: ConversationMemory[];
  relevantPastConversations: ConversationMemory[];
  customerContext: CustomerContext | null;
  userPreferences: UserPreferences | null;
  workState: WorkState | null;
  totalTokens: number;
}

export interface ContextItem {
  type: 'conversation' | 'customer_context' | 'memory' | 'preference' | 'work_state';
  content: string;
  timestamp: Date;
  importance: number;
  tokens: number;
}

export interface ExtractionResult {
  actionItems: string[];
  decisions: string[];
  preferenceSignals: string[];
  keyTopics: string[];
  sentimentScore?: number;
}

export interface ContextSearchOptions {
  maxTokens?: number;
  includeHistory?: boolean;
  includePreferences?: boolean;
  includeWorkState?: boolean;
  similarityThreshold?: number;
  limit?: number;
}

// Default configuration
const DEFAULT_MAX_CONTEXT_TOKENS = 4000;
const DEFAULT_SIMILARITY_THRESHOLD = 0.7;
const DEFAULT_MESSAGE_LIMIT = 20;
const SUMMARIZE_AFTER_MESSAGES = 50;

// ============================================
// Conversation Context Service
// ============================================

export class ConversationContextService {
  private supabase: SupabaseClient | null = null;
  private anthropic: Anthropic | null = null;
  private contextCache: Map<string, { data: RelevantContext; expiresAt: number }> = new Map();
  private cacheTtlMs = 60000; // 1 minute cache

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }

    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }
  }

  // ============================================
  // Context Retrieval
  // ============================================

  /**
   * Retrieve relevant context for a conversation
   * Implements the context retrieval algorithm from PRD-223
   */
  async retrieveRelevantContext(
    currentMessage: string,
    customerId: string | null,
    userId: string,
    options: ContextSearchOptions = {}
  ): Promise<RelevantContext> {
    const {
      maxTokens = DEFAULT_MAX_CONTEXT_TOKENS,
      includeHistory = true,
      includePreferences = true,
      includeWorkState = true,
      similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
      limit = DEFAULT_MESSAGE_LIMIT,
    } = options;

    // Check cache first
    const cacheKey = `${userId}:${customerId}:${currentMessage.substring(0, 50)}`;
    const cached = this.contextCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // Retrieve context from multiple sources in parallel
    const [
      recentConversation,
      relevantPastConversations,
      customerContext,
      userPreferences,
      workState,
    ] = await Promise.all([
      includeHistory ? this.getRecentConversation(userId, customerId, limit) : Promise.resolve([]),
      includeHistory ? this.searchRelevantConversations(currentMessage, userId, customerId, similarityThreshold, limit) : Promise.resolve([]),
      customerId ? this.getCustomerContext(userId, customerId) : Promise.resolve(null),
      includePreferences ? this.getUserPreferences(userId) : Promise.resolve(null),
      includeWorkState ? this.getWorkState(userId) : Promise.resolve(null),
    ]);

    // Calculate total tokens and optimize context
    const context = await this.selectContext(
      {
        recentConversation,
        relevantPastConversations,
        customerContext,
        userPreferences,
        workState,
        totalTokens: 0,
      },
      maxTokens
    );

    // Cache the result
    this.contextCache.set(cacheKey, {
      data: context,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return context;
  }

  /**
   * Get recent conversation messages
   */
  async getRecentConversation(
    userId: string,
    customerId: string | null,
    limit: number = DEFAULT_MESSAGE_LIMIT
  ): Promise<ConversationMemory[]> {
    if (!this.supabase) return [];

    try {
      let query = this.supabase
        .from('conversation_memories')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[ConversationContext] Error fetching recent conversation:', error);
        return [];
      }

      return (data || []).map(this.mapDbToConversationMemory);
    } catch (error) {
      console.error('[ConversationContext] Error in getRecentConversation:', error);
      return [];
    }
  }

  /**
   * Search for semantically relevant past conversations
   */
  async searchRelevantConversations(
    query: string,
    userId: string,
    customerId: string | null,
    threshold: number = DEFAULT_SIMILARITY_THRESHOLD,
    limit: number = 10
  ): Promise<ConversationMemory[]> {
    if (!this.supabase) return [];

    try {
      // Generate embedding for the query
      const { embedding } = await embeddingService.embed(query);

      // Search using vector similarity
      const { data, error } = await (this.supabase as any).rpc('search_conversation_memories', {
        query_embedding: `[${embedding.join(',')}]`,
        p_user_id: userId,
        p_customer_id: customerId,
        match_threshold: threshold,
        match_count: limit,
      });

      if (error) {
        console.error('[ConversationContext] Error searching conversations:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        userId,
        customerId: row.customer_id,
        sessionId: row.session_id,
        timestamp: new Date(row.timestamp),
        role: row.role,
        content: row.content,
        summary: row.summary,
        importanceScore: row.importance_score,
        keyTopics: row.key_topics || [],
        actionItems: [],
      }));
    } catch (error) {
      console.error('[ConversationContext] Error in searchRelevantConversations:', error);
      return [];
    }
  }

  /**
   * Get customer-specific context
   */
  async getCustomerContext(userId: string, customerId: string): Promise<CustomerContext | null> {
    if (!this.supabase) return null;

    try {
      const { data, error } = await this.supabase
        .from('customer_contexts')
        .select('*')
        .eq('user_id', userId)
        .eq('customer_id', customerId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        customerId: data.customer_id,
        lastDiscussed: data.last_discussed ? new Date(data.last_discussed) : null,
        recentTopics: data.recent_topics || [],
        pendingActions: data.pending_actions || [],
        keyDecisions: data.key_decisions || [],
        relationshipNotes: data.relationship_notes || '',
        sentimentHistory: data.sentiment_history || [],
        communicationPreferences: data.communication_preferences || {},
        lastInteractionSummary: data.last_interaction_summary || '',
        conversationCount: data.conversation_count || 0,
        totalMessages: data.total_messages || 0,
      };
    } catch (error) {
      console.error('[ConversationContext] Error getting customer context:', error);
      return null;
    }
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    if (!this.supabase) return null;

    try {
      const { data, error } = await this.supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        // Return defaults if no preferences exist
        return {
          userId,
          communicationStyle: 'professional',
          preferredActions: [],
          timezone: 'America/New_York',
          workingHoursStart: '09:00',
          workingHoursEnd: '17:00',
          commonShortcuts: {},
        };
      }

      return {
        userId: data.user_id,
        communicationStyle: data.communication_style || 'professional',
        preferredActions: data.preferred_actions || [],
        timezone: data.timezone || 'America/New_York',
        workingHoursStart: data.working_hours_start || '09:00',
        workingHoursEnd: data.working_hours_end || '17:00',
        emailSignature: data.email_signature,
        commonShortcuts: data.common_shortcuts || {},
      };
    } catch (error) {
      console.error('[ConversationContext] Error getting user preferences:', error);
      return null;
    }
  }

  /**
   * Get current work state
   */
  async getWorkState(userId: string): Promise<WorkState | null> {
    if (!this.supabase) return null;

    try {
      const { data, error } = await this.supabase
        .from('work_state')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return {
          userId,
          activeCustomerId: null,
          activeSessionId: null,
          pendingDrafts: [],
          inProgressTasks: [],
          recentSearches: [],
          recentCustomers: [],
        };
      }

      return {
        userId: data.user_id,
        activeCustomerId: data.active_customer_id,
        activeSessionId: data.active_session_id,
        pendingDrafts: data.pending_drafts || [],
        inProgressTasks: data.in_progress_tasks || [],
        recentSearches: data.recent_searches || [],
        recentCustomers: data.recent_customers || [],
      };
    } catch (error) {
      console.error('[ConversationContext] Error getting work state:', error);
      return null;
    }
  }

  /**
   * Select and prioritize context within token budget
   */
  private async selectContext(
    context: RelevantContext,
    maxTokens: number
  ): Promise<RelevantContext> {
    const items: ContextItem[] = [];

    // Priority 1: Current session messages (most recent)
    for (const msg of context.recentConversation.slice(0, 10)) {
      items.push({
        type: 'conversation',
        content: msg.content,
        timestamp: msg.timestamp,
        importance: 90 + (msg.importanceScore / 10),
        tokens: this.estimateTokens(msg.content),
      });
    }

    // Priority 2: Customer-specific context
    if (context.customerContext) {
      const contextStr = this.formatCustomerContext(context.customerContext);
      items.push({
        type: 'customer_context',
        content: contextStr,
        timestamp: context.customerContext.lastDiscussed || new Date(),
        importance: 85,
        tokens: this.estimateTokens(contextStr),
      });
    }

    // Priority 3: Relevant past conversations
    for (const msg of context.relevantPastConversations) {
      items.push({
        type: 'conversation',
        content: msg.summary || msg.content,
        timestamp: msg.timestamp,
        importance: 70 + (msg.importanceScore / 10),
        tokens: this.estimateTokens(msg.summary || msg.content),
      });
    }

    // Priority 4: User preferences
    if (context.userPreferences) {
      const prefStr = this.formatUserPreferences(context.userPreferences);
      items.push({
        type: 'preference',
        content: prefStr,
        timestamp: new Date(),
        importance: 60,
        tokens: this.estimateTokens(prefStr),
      });
    }

    // Priority 5: Work state
    if (context.workState) {
      const stateStr = this.formatWorkState(context.workState);
      items.push({
        type: 'work_state',
        content: stateStr,
        timestamp: new Date(),
        importance: 50,
        tokens: this.estimateTokens(stateStr),
      });
    }

    // Sort by importance and select within budget
    items.sort((a, b) => b.importance - a.importance);

    let currentTokens = 0;
    const selectedRecent: ConversationMemory[] = [];
    const selectedRelevant: ConversationMemory[] = [];

    for (const item of items) {
      if (currentTokens + item.tokens > maxTokens) break;

      currentTokens += item.tokens;

      // Track which conversations are selected
      if (item.type === 'conversation') {
        const isRecent = context.recentConversation.some(m => m.content === item.content);
        if (isRecent) {
          const msg = context.recentConversation.find(m => m.content === item.content);
          if (msg) selectedRecent.push(msg);
        } else {
          const msg = context.relevantPastConversations.find(
            m => (m.summary || m.content) === item.content
          );
          if (msg) selectedRelevant.push(msg);
        }
      }
    }

    return {
      recentConversation: selectedRecent,
      relevantPastConversations: selectedRelevant,
      customerContext: context.customerContext,
      userPreferences: context.userPreferences,
      workState: context.workState,
      totalTokens: currentTokens,
    };
  }

  // ============================================
  // Memory Writing
  // ============================================

  /**
   * Store a conversation turn and extract key information
   */
  async storeConversationTurn(
    sessionId: string,
    userId: string,
    customerId: string | null,
    role: 'user' | 'assistant',
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<ConversationMemory | null> {
    if (!this.supabase) return null;

    try {
      // Generate embedding for semantic search
      let embedding: number[] | null = null;
      try {
        const result = await embeddingService.embed(content);
        embedding = result.embedding;
      } catch (err) {
        console.warn('[ConversationContext] Failed to generate embedding:', err);
      }

      // Calculate importance score
      const importanceScore = this.calculateImportance(content, role);

      // Extract key topics from content
      const keyTopics = this.extractTopics(content);

      const memory: Partial<ConversationMemory> = {
        id: uuidv4(),
        userId,
        customerId,
        sessionId,
        timestamp: new Date(),
        role,
        content,
        importanceScore,
        keyTopics,
        actionItems: [],
        metadata,
      };

      const { data, error } = await this.supabase
        .from('conversation_memories')
        .insert({
          id: memory.id,
          user_id: userId,
          customer_id: customerId,
          session_id: sessionId,
          timestamp: memory.timestamp?.toISOString(),
          role,
          content,
          importance_score: importanceScore,
          embedding: embedding ? `[${embedding.join(',')}]` : null,
          key_topics: keyTopics,
          metadata: metadata || {},
        })
        .select()
        .single();

      if (error) {
        console.error('[ConversationContext] Error storing conversation:', error);
        return null;
      }

      // Clear cache for this user/customer
      this.invalidateCache(userId, customerId);

      return this.mapDbToConversationMemory(data);
    } catch (error) {
      console.error('[ConversationContext] Error in storeConversationTurn:', error);
      return null;
    }
  }

  /**
   * Update memory after a conversation exchange
   */
  async updateMemoryFromConversation(
    sessionId: string,
    userId: string,
    customerId: string | null,
    userMessage: string,
    assistantResponse: string
  ): Promise<void> {
    // Store both turns
    await this.storeConversationTurn(sessionId, userId, customerId, 'user', userMessage);
    await this.storeConversationTurn(sessionId, userId, customerId, 'assistant', assistantResponse);

    // Extract key information from the exchange
    const extraction = await this.extractKeyInfo(userMessage, assistantResponse);

    // Update customer context if applicable
    if (customerId) {
      await this.updateCustomerContext(userId, customerId, extraction);
    }

    // Update user preferences if signals detected
    if (extraction.preferenceSignals.length > 0) {
      await this.updateUserPreferences(userId, extraction.preferenceSignals);
    }

    // Check if summarization is needed
    await this.maybeSummarizeOldConversations(userId, customerId);
  }

  /**
   * Extract key information from a conversation exchange using AI
   */
  async extractKeyInfo(
    userMessage: string,
    assistantResponse: string
  ): Promise<ExtractionResult> {
    if (!this.anthropic) {
      // Fallback to simple extraction
      return this.simpleExtraction(userMessage, assistantResponse);
    }

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `Analyze this conversation turn and extract key information. Return JSON only.

User: ${userMessage}
Assistant: ${assistantResponse}

Extract:
1. action_items: Array of specific commitments or tasks mentioned
2. decisions: Array of key decisions or conclusions
3. preference_signals: Array of user preference indicators (communication style, preferred approaches)
4. key_topics: Array of main topics discussed
5. sentiment_score: Number from -1 (negative) to 1 (positive)

Return only valid JSON with these fields.`,
          },
        ],
      });

      const textContent = response.content.find(c => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        return this.simpleExtraction(userMessage, assistantResponse);
      }

      try {
        const parsed = JSON.parse(textContent.text);
        return {
          actionItems: parsed.action_items || [],
          decisions: parsed.decisions || [],
          preferenceSignals: parsed.preference_signals || [],
          keyTopics: parsed.key_topics || [],
          sentimentScore: parsed.sentiment_score,
        };
      } catch {
        return this.simpleExtraction(userMessage, assistantResponse);
      }
    } catch (error) {
      console.error('[ConversationContext] Error extracting key info:', error);
      return this.simpleExtraction(userMessage, assistantResponse);
    }
  }

  /**
   * Simple extraction without AI
   */
  private simpleExtraction(userMessage: string, assistantResponse: string): ExtractionResult {
    const combined = `${userMessage} ${assistantResponse}`.toLowerCase();

    // Simple topic extraction
    const topicPatterns = [
      /(?:discuss|talking about|regarding|about)\s+(\w+(?:\s+\w+)?)/gi,
      /(?:renewal|onboarding|qbr|review|meeting|email)/gi,
    ];

    const topics: string[] = [];
    for (const pattern of topicPatterns) {
      const matches = combined.match(pattern);
      if (matches) {
        topics.push(...matches.map(m => m.trim()));
      }
    }

    // Simple action item detection
    const actionItems: string[] = [];
    if (combined.includes('will') || combined.includes('need to') || combined.includes('should')) {
      const sentences = assistantResponse.split(/[.!?]+/);
      for (const sentence of sentences) {
        if (sentence.includes('will') || sentence.includes('need to')) {
          actionItems.push(sentence.trim());
        }
      }
    }

    return {
      actionItems: actionItems.slice(0, 3),
      decisions: [],
      preferenceSignals: [],
      keyTopics: [...new Set(topics)].slice(0, 5),
    };
  }

  /**
   * Update customer context with extracted information
   */
  async updateCustomerContext(
    userId: string,
    customerId: string,
    extraction: ExtractionResult
  ): Promise<void> {
    if (!this.supabase) return;

    try {
      // Use the database function for atomic update
      await (this.supabase as any).rpc('update_customer_context_from_conversation', {
        p_user_id: userId,
        p_customer_id: customerId,
        p_topics: extraction.keyTopics,
        p_action_items: extraction.actionItems,
      });

      // Update sentiment history if available
      if (extraction.sentimentScore !== undefined) {
        const { data: existing } = await this.supabase
          .from('customer_contexts')
          .select('sentiment_history')
          .eq('user_id', userId)
          .eq('customer_id', customerId)
          .single();

        const history = existing?.sentiment_history || [];
        history.push({ score: extraction.sentimentScore, timestamp: new Date().toISOString() });

        // Keep last 20 sentiment scores
        const trimmedHistory = history.slice(-20);

        await this.supabase
          .from('customer_contexts')
          .update({ sentiment_history: trimmedHistory })
          .eq('user_id', userId)
          .eq('customer_id', customerId);
      }
    } catch (error) {
      console.error('[ConversationContext] Error updating customer context:', error);
    }
  }

  /**
   * Update user preferences from signals
   */
  async updateUserPreferences(userId: string, signals: string[]): Promise<void> {
    if (!this.supabase || signals.length === 0) return;

    try {
      // Parse signals for style indicators
      const signalText = signals.join(' ').toLowerCase();

      let styleUpdate: string | null = null;
      if (signalText.includes('formal') || signalText.includes('professional')) {
        styleUpdate = 'formal';
      } else if (signalText.includes('casual') || signalText.includes('friendly')) {
        styleUpdate = 'casual';
      } else if (signalText.includes('brief') || signalText.includes('concise')) {
        styleUpdate = 'brief';
      }

      if (styleUpdate) {
        await this.supabase
          .from('user_preferences')
          .upsert({
            user_id: userId,
            communication_style: styleUpdate,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id',
          });
      }
    } catch (error) {
      console.error('[ConversationContext] Error updating user preferences:', error);
    }
  }

  /**
   * Summarize old conversations if threshold reached
   */
  async maybeSummarizeOldConversations(
    userId: string,
    customerId: string | null
  ): Promise<void> {
    if (!this.supabase) return;

    try {
      // Count unsummarized messages
      let query = this.supabase
        .from('conversation_memories')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('summary', null);

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { count } = await query;

      if ((count || 0) < SUMMARIZE_AFTER_MESSAGES) return;

      // Trigger summarization in background
      this.summarizeConversations(userId, customerId).catch(console.error);
    } catch (error) {
      console.error('[ConversationContext] Error checking summarization:', error);
    }
  }

  /**
   * Summarize old conversations
   */
  async summarizeConversations(
    userId: string,
    customerId: string | null
  ): Promise<void> {
    if (!this.supabase || !this.anthropic) return;

    try {
      // Get old unsummarized messages
      let query = this.supabase
        .from('conversation_memories')
        .select('*')
        .eq('user_id', userId)
        .is('summary', null)
        .order('timestamp', { ascending: true })
        .limit(SUMMARIZE_AFTER_MESSAGES);

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data: messages, error } = await query;

      if (error || !messages || messages.length < 20) return;

      // Group messages by session for context
      const content = messages
        .map(m => `[${m.role}]: ${m.content.substring(0, 300)}`)
        .join('\n');

      // Generate summary
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `Summarize these customer interaction records. Focus on key decisions, action items, and important context.

${content}

Provide a concise summary (2-3 paragraphs) highlighting the most important information.`,
          },
        ],
      });

      const textContent = response.content.find(c => c.type === 'text');
      if (!textContent || textContent.type !== 'text') return;

      // Store summary
      const periodStart = new Date(messages[0].timestamp);
      const periodEnd = new Date(messages[messages.length - 1].timestamp);

      await this.supabase
        .from('conversation_summaries')
        .insert({
          user_id: userId,
          customer_id: customerId,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          summary: textContent.text,
          message_count: messages.length,
        });

      // Update original messages with summary reference
      const messageIds = messages.map(m => m.id);
      await this.supabase
        .from('conversation_memories')
        .update({ summary: 'Summarized' })
        .in('id', messageIds);

      console.log(`[ConversationContext] Summarized ${messages.length} messages for user ${userId}`);
    } catch (error) {
      console.error('[ConversationContext] Error summarizing conversations:', error);
    }
  }

  // ============================================
  // Explicit Memory Management
  // ============================================

  /**
   * Store an explicit memory (user-created note)
   */
  async rememberExplicit(
    userId: string,
    customerId: string | null,
    memoryType: 'note' | 'preference' | 'decision' | 'shortcut' | 'workflow',
    content: string,
    importance: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    tags: string[] = []
  ): Promise<{ id: string } | null> {
    if (!this.supabase) return null;

    try {
      const id = uuidv4();

      const { error } = await this.supabase
        .from('user_memories')
        .insert({
          id,
          user_id: userId,
          customer_id: customerId,
          memory_type: memoryType,
          content,
          importance,
          tags,
        });

      if (error) {
        console.error('[ConversationContext] Error storing explicit memory:', error);
        return null;
      }

      return { id };
    } catch (error) {
      console.error('[ConversationContext] Error in rememberExplicit:', error);
      return null;
    }
  }

  /**
   * Forget specific memories
   */
  async forget(
    userId: string,
    memoryIds: string[],
    scope: 'specific' | 'customer' | 'all' = 'specific',
    customerId?: string
  ): Promise<{ deleted: number }> {
    if (!this.supabase) return { deleted: 0 };

    try {
      let deleted = 0;

      if (scope === 'specific' && memoryIds.length > 0) {
        const { count } = await this.supabase
          .from('user_memories')
          .delete({ count: 'exact' })
          .eq('user_id', userId)
          .in('id', memoryIds);

        deleted = count || 0;
      } else if (scope === 'customer' && customerId) {
        // Delete all memories for a specific customer
        const { count: memoryCount } = await this.supabase
          .from('user_memories')
          .delete({ count: 'exact' })
          .eq('user_id', userId)
          .eq('customer_id', customerId);

        const { count: convCount } = await this.supabase
          .from('conversation_memories')
          .delete({ count: 'exact' })
          .eq('user_id', userId)
          .eq('customer_id', customerId);

        // Also clear customer context
        await this.supabase
          .from('customer_contexts')
          .delete()
          .eq('user_id', userId)
          .eq('customer_id', customerId);

        deleted = (memoryCount || 0) + (convCount || 0);
      } else if (scope === 'all') {
        // Delete all user memories (use with caution)
        const { count: memoryCount } = await this.supabase
          .from('user_memories')
          .delete({ count: 'exact' })
          .eq('user_id', userId);

        deleted = memoryCount || 0;
      }

      // Clear cache
      this.invalidateCache(userId, customerId || null);

      return { deleted };
    } catch (error) {
      console.error('[ConversationContext] Error in forget:', error);
      return { deleted: 0 };
    }
  }

  /**
   * Get explicit memories for a user
   */
  async getExplicitMemories(
    userId: string,
    customerId?: string,
    memoryType?: string
  ): Promise<Array<{ id: string; type: string; content: string; importance: string; createdAt: Date }>> {
    if (!this.supabase) return [];

    try {
      let query = this.supabase
        .from('user_memories')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      if (memoryType) {
        query = query.eq('memory_type', memoryType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[ConversationContext] Error fetching memories:', error);
        return [];
      }

      return (data || []).map(m => ({
        id: m.id,
        type: m.memory_type,
        content: m.content,
        importance: m.importance,
        createdAt: new Date(m.created_at),
      }));
    } catch (error) {
      console.error('[ConversationContext] Error in getExplicitMemories:', error);
      return [];
    }
  }

  // ============================================
  // Work State Management
  // ============================================

  /**
   * Update active customer context
   */
  async setActiveCustomer(userId: string, customerId: string | null): Promise<void> {
    if (!this.supabase) return;

    try {
      await this.supabase
        .from('work_state')
        .upsert({
          user_id: userId,
          active_customer_id: customerId,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });
    } catch (error) {
      console.error('[ConversationContext] Error setting active customer:', error);
    }
  }

  /**
   * Add to recent customers
   */
  async addRecentCustomer(userId: string, customerId: string): Promise<void> {
    if (!this.supabase) return;

    try {
      const { data: existing } = await this.supabase
        .from('work_state')
        .select('recent_customers')
        .eq('user_id', userId)
        .single();

      const recent = existing?.recent_customers || [];

      // Add to front, remove duplicates, limit to 10
      const updated = [customerId, ...recent.filter((c: string) => c !== customerId)].slice(0, 10);

      await this.supabase
        .from('work_state')
        .upsert({
          user_id: userId,
          recent_customers: updated,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });
    } catch (error) {
      console.error('[ConversationContext] Error adding recent customer:', error);
    }
  }

  // ============================================
  // Context Building
  // ============================================

  /**
   * Build a context string for AI prompts
   */
  buildContextString(context: RelevantContext): string {
    const parts: string[] = [];

    // Customer context
    if (context.customerContext) {
      parts.push('## Customer Context');
      parts.push(this.formatCustomerContext(context.customerContext));
      parts.push('');
    }

    // Conversation summaries
    if (context.relevantPastConversations.length > 0) {
      parts.push('## Previous Conversations');
      for (const conv of context.relevantPastConversations.slice(0, 3)) {
        parts.push(`- ${conv.summary || conv.content.substring(0, 200)}`);
      }
      parts.push('');
    }

    // Recent messages
    if (context.recentConversation.length > 0) {
      parts.push('## Recent Messages');
      for (const msg of context.recentConversation.slice(0, 5)) {
        parts.push(`[${msg.role}]: ${msg.content.substring(0, 150)}...`);
      }
      parts.push('');
    }

    // User preferences
    if (context.userPreferences) {
      parts.push('## User Preferences');
      parts.push(`Communication style: ${context.userPreferences.communicationStyle}`);
      if (context.userPreferences.preferredActions.length > 0) {
        parts.push(`Common actions: ${context.userPreferences.preferredActions.join(', ')}`);
      }
      parts.push('');
    }

    return parts.join('\n');
  }

  // ============================================
  // Helpers
  // ============================================

  private formatCustomerContext(context: CustomerContext): string {
    const parts: string[] = [];

    if (context.lastDiscussed) {
      parts.push(`Last discussed: ${context.lastDiscussed.toLocaleDateString()}`);
    }

    if (context.recentTopics.length > 0) {
      parts.push(`Recent topics: ${context.recentTopics.slice(0, 5).join(', ')}`);
    }

    if (context.pendingActions.length > 0) {
      parts.push(`Pending actions: ${context.pendingActions.slice(0, 3).join('; ')}`);
    }

    if (context.lastInteractionSummary) {
      parts.push(`Summary: ${context.lastInteractionSummary}`);
    }

    return parts.join('\n');
  }

  private formatUserPreferences(prefs: UserPreferences): string {
    return `Communication: ${prefs.communicationStyle}, Timezone: ${prefs.timezone}`;
  }

  private formatWorkState(state: WorkState): string {
    const parts: string[] = [];

    if (state.pendingDrafts.length > 0) {
      parts.push(`${state.pendingDrafts.length} pending drafts`);
    }

    if (state.inProgressTasks.length > 0) {
      parts.push(`${state.inProgressTasks.length} tasks in progress`);
    }

    return parts.join(', ') || 'No active work';
  }

  private estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  private calculateImportance(content: string, role: 'user' | 'assistant' | 'system'): number {
    let score = 50;

    // User messages are slightly more important for context
    if (role === 'user') score += 10;

    // Longer content might be more substantive
    if (content.length > 200) score += 10;
    if (content.length > 500) score += 10;

    // Keywords that indicate importance
    const importantKeywords = ['decision', 'agreed', 'confirmed', 'urgent', 'important', 'critical'];
    for (const keyword of importantKeywords) {
      if (content.toLowerCase().includes(keyword)) {
        score += 5;
      }
    }

    return Math.min(100, score);
  }

  private extractTopics(content: string): string[] {
    // Simple keyword extraction
    const words = content.toLowerCase().split(/\W+/);
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'just', 'don', 'now', 'and', 'or', 'but', 'if', 'because', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their']);

    const significantWords = words
      .filter(w => w.length > 3 && !stopWords.has(w))
      .slice(0, 10);

    return [...new Set(significantWords)];
  }

  private mapDbToConversationMemory(data: any): ConversationMemory {
    return {
      id: data.id,
      userId: data.user_id,
      customerId: data.customer_id,
      sessionId: data.session_id,
      timestamp: new Date(data.timestamp),
      role: data.role,
      content: data.content,
      summary: data.summary,
      importanceScore: data.importance_score || 50,
      keyTopics: data.key_topics || [],
      actionItems: data.action_items || [],
      metadata: data.metadata,
    };
  }

  private invalidateCache(userId: string, customerId: string | null): void {
    // Clear all cache entries for this user/customer combination
    for (const key of this.contextCache.keys()) {
      if (key.startsWith(`${userId}:${customerId}`)) {
        this.contextCache.delete(key);
      }
    }
  }
}

// Singleton instance
export const conversationContextService = new ConversationContextService();

export default conversationContextService;
