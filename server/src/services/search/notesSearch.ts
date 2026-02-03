/**
 * Account Notes Search Service
 * PRD-081: Account Notes Search
 *
 * Provides unified search capabilities across all customer note sources including
 * chat messages, meeting transcripts, agent activities, and internal notes.
 * Supports both keyword and semantic (vector) search.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import { embeddingService } from '../embedding.js';

// ============================================================================
// Types
// ============================================================================

export type NoteSourceType = 'chat' | 'meeting' | 'agent' | 'internal' | 'document';

export interface NoteSearchResult {
  id: string;
  source_type: NoteSourceType;
  source_id: string;
  title: string;
  content: string;
  snippet: string;
  highlight?: {
    title?: string;
    content?: string;
  };
  relevance_score: number;
  date: string;
  author?: string;
  metadata: {
    customer_id?: string;
    customer_name?: string;
    session_id?: string;
    agent_type?: string;
    meeting_id?: string;
    [key: string]: unknown;
  };
  tags?: string[];
}

export interface NotesSearchOptions {
  customer_id?: string;
  user_id?: string;
  source_types?: NoteSourceType[];
  date_from?: string;
  date_to?: string;
  search_type?: 'keyword' | 'semantic' | 'hybrid';
  limit?: number;
  offset?: number;
}

export interface NotesSearchResponse {
  results: NoteSearchResult[];
  total: number;
  query: string;
  search_type: 'keyword' | 'semantic' | 'hybrid';
  search_time_ms: number;
  filters_applied: {
    customer_id?: string;
    source_types?: NoteSourceType[];
    date_range?: { from?: string; to?: string };
  };
  suggestions: string[];
}

interface SearchHistoryEntry {
  id: string;
  query: string;
  customer_id?: string;
  filters: NotesSearchOptions;
  result_count: number;
  clicked_result_ids: string[];
  searched_at: string;
}

// ============================================================================
// Notes Search Service
// ============================================================================

export class NotesSearchService {
  private supabase: SupabaseClient | null = null;
  private anthropic: Anthropic | null = null;

  constructor() {
    // Initialize Supabase
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }

    // Initialize Anthropic for semantic search and NLP
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: config.anthropicApiKey,
      });
    }
  }

  // ============================================================================
  // Main Search Method
  // ============================================================================

  /**
   * Search customer notes across all sources
   */
  async searchNotes(
    query: string,
    options: NotesSearchOptions = {}
  ): Promise<NotesSearchResponse> {
    const startTime = Date.now();
    const {
      customer_id,
      user_id,
      source_types,
      date_from,
      date_to,
      search_type = 'hybrid',
      limit = 20,
      offset = 0,
    } = options;

    let results: NoteSearchResult[] = [];
    let actualSearchType = search_type;

    // Determine search strategy
    if (search_type === 'hybrid' || search_type === 'semantic') {
      // Try semantic search first
      const semanticResults = await this.semanticSearchNotes(query, {
        customer_id,
        user_id,
        source_types,
        date_from,
        date_to,
        limit: limit * 2, // Get more for merging
      });
      results = semanticResults;
    }

    if (search_type === 'hybrid' || search_type === 'keyword') {
      // Also do keyword search
      const keywordResults = await this.keywordSearchNotes(query, {
        customer_id,
        user_id,
        source_types,
        date_from,
        date_to,
        limit: limit * 2,
      });

      if (search_type === 'hybrid') {
        results = this.mergeAndRankResults(results, keywordResults, query);
      } else {
        results = keywordResults;
      }
    }

    // Apply highlight to results
    results = results.map((r) => this.highlightMatches(r, query));

    // Get total before pagination
    const total = results.length;

    // Apply pagination
    results = results.slice(offset, offset + limit);

    // Generate suggestions based on results and query
    const suggestions = this.generateSuggestions(query, results, customer_id);

    // Track search for history (async, don't wait)
    if (user_id) {
      this.saveSearchHistory(user_id, query, options, results.length).catch((err) => {
        console.error('Failed to save search history:', err);
      });
    }

    return {
      results,
      total,
      query,
      search_type: actualSearchType,
      search_time_ms: Date.now() - startTime,
      filters_applied: {
        customer_id,
        source_types,
        date_range: date_from || date_to ? { from: date_from, to: date_to } : undefined,
      },
      suggestions,
    };
  }

  // ============================================================================
  // Keyword Search
  // ============================================================================

  /**
   * Search notes using PostgreSQL full-text search
   */
  private async keywordSearchNotes(
    query: string,
    options: Omit<NotesSearchOptions, 'search_type' | 'offset'>
  ): Promise<NoteSearchResult[]> {
    if (!this.supabase) {
      return this.inMemoryKeywordSearch(query, options);
    }

    const { customer_id, user_id, source_types, date_from, date_to, limit = 40 } = options;
    const results: NoteSearchResult[] = [];

    try {
      // Search chat messages
      if (!source_types || source_types.includes('chat')) {
        const chatResults = await this.searchChatMessages(query, {
          customer_id,
          user_id,
          date_from,
          date_to,
          limit,
        });
        results.push(...chatResults);
      }

      // Search meeting transcripts
      if (!source_types || source_types.includes('meeting')) {
        const meetingResults = await this.searchMeetingTranscripts(query, {
          customer_id,
          date_from,
          date_to,
          limit,
        });
        results.push(...meetingResults);
      }

      // Search agent activity logs
      if (!source_types || source_types.includes('agent')) {
        const agentResults = await this.searchAgentActivities(query, {
          customer_id,
          date_from,
          date_to,
          limit,
        });
        results.push(...agentResults);
      }

      // Sort by relevance score
      results.sort((a, b) => b.relevance_score - a.relevance_score);

      return results.slice(0, limit);
    } catch (error) {
      console.error('Keyword search error:', error);
      return [];
    }
  }

  /**
   * Search chat messages table
   */
  private async searchChatMessages(
    query: string,
    options: { customer_id?: string; user_id?: string; date_from?: string; date_to?: string; limit: number }
  ): Promise<NoteSearchResult[]> {
    if (!this.supabase) return [];

    try {
      let dbQuery = this.supabase
        .from('chat_messages')
        .select('id, customer_id, user_id, role, content, agent_type, session_id, created_at')
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(options.limit);

      if (options.customer_id) {
        dbQuery = dbQuery.eq('customer_id', options.customer_id);
      }

      if (options.user_id) {
        dbQuery = dbQuery.eq('user_id', options.user_id);
      }

      if (options.date_from) {
        dbQuery = dbQuery.gte('created_at', options.date_from);
      }

      if (options.date_to) {
        dbQuery = dbQuery.lte('created_at', options.date_to);
      }

      const { data, error } = await dbQuery;

      if (error) {
        console.error('Chat messages search error:', error);
        return [];
      }

      return (data || []).map((msg) => ({
        id: msg.id,
        source_type: 'chat' as NoteSourceType,
        source_id: msg.id,
        title: this.generateChatTitle(msg.content, msg.role, msg.agent_type),
        content: msg.content,
        snippet: this.generateSnippet(msg.content, query, 150),
        relevance_score: this.calculateKeywordRelevance(msg.content, query),
        date: msg.created_at,
        author: msg.role === 'assistant' ? (msg.agent_type || 'AI Assistant') : 'User',
        metadata: {
          customer_id: msg.customer_id,
          session_id: msg.session_id,
          agent_type: msg.agent_type,
          role: msg.role,
        },
      }));
    } catch (error) {
      console.error('Chat messages search failed:', error);
      return [];
    }
  }

  /**
   * Search meeting transcripts and summaries
   */
  private async searchMeetingTranscripts(
    query: string,
    options: { customer_id?: string; date_from?: string; date_to?: string; limit: number }
  ): Promise<NoteSearchResult[]> {
    if (!this.supabase) return [];

    try {
      // Search meetings table for summaries and notes
      let dbQuery = this.supabase
        .from('meetings')
        .select('id, customer_id, title, summary, notes, transcript, attendees, scheduled_at, created_at')
        .or(`summary.ilike.%${query}%,notes.ilike.%${query}%,transcript.ilike.%${query}%,title.ilike.%${query}%`)
        .order('scheduled_at', { ascending: false })
        .limit(options.limit);

      if (options.customer_id) {
        dbQuery = dbQuery.eq('customer_id', options.customer_id);
      }

      if (options.date_from) {
        dbQuery = dbQuery.gte('scheduled_at', options.date_from);
      }

      if (options.date_to) {
        dbQuery = dbQuery.lte('scheduled_at', options.date_to);
      }

      const { data, error } = await dbQuery;

      if (error) {
        console.error('Meeting transcripts search error:', error);
        return [];
      }

      return (data || []).map((meeting) => {
        // Combine all searchable content
        const fullContent = [meeting.summary, meeting.notes, meeting.transcript]
          .filter(Boolean)
          .join('\n\n');

        return {
          id: meeting.id,
          source_type: 'meeting' as NoteSourceType,
          source_id: meeting.id,
          title: meeting.title || 'Meeting Notes',
          content: fullContent,
          snippet: this.generateSnippet(fullContent, query, 200),
          relevance_score: this.calculateKeywordRelevance(fullContent, query),
          date: meeting.scheduled_at || meeting.created_at,
          author: 'Meeting',
          metadata: {
            customer_id: meeting.customer_id,
            meeting_id: meeting.id,
            attendees: meeting.attendees,
            has_transcript: !!meeting.transcript,
            has_summary: !!meeting.summary,
          },
        };
      });
    } catch (error) {
      console.error('Meeting transcripts search failed:', error);
      return [];
    }
  }

  /**
   * Search agent activity logs
   */
  private async searchAgentActivities(
    query: string,
    options: { customer_id?: string; date_from?: string; date_to?: string; limit: number }
  ): Promise<NoteSearchResult[]> {
    if (!this.supabase) return [];

    try {
      let dbQuery = this.supabase
        .from('agent_activity_log')
        .select('id, customer_id, agent_type, action_type, action_data, result_data, status, started_at')
        .order('started_at', { ascending: false })
        .limit(options.limit * 2); // Get more to filter

      if (options.customer_id) {
        dbQuery = dbQuery.eq('customer_id', options.customer_id);
      }

      if (options.date_from) {
        dbQuery = dbQuery.gte('started_at', options.date_from);
      }

      if (options.date_to) {
        dbQuery = dbQuery.lte('started_at', options.date_to);
      }

      const { data, error } = await dbQuery;

      if (error) {
        console.error('Agent activities search error:', error);
        return [];
      }

      // Filter by query match in action_data or result_data
      const queryLower = query.toLowerCase();
      const filtered = (data || []).filter((activity) => {
        const actionStr = JSON.stringify(activity.action_data || {}).toLowerCase();
        const resultStr = JSON.stringify(activity.result_data || {}).toLowerCase();
        return actionStr.includes(queryLower) || resultStr.includes(queryLower);
      });

      return filtered.slice(0, options.limit).map((activity) => {
        const content = this.formatAgentActivityContent(activity);

        return {
          id: activity.id,
          source_type: 'agent' as NoteSourceType,
          source_id: activity.id,
          title: this.formatAgentActivityTitle(activity.action_type, activity.agent_type),
          content,
          snippet: this.generateSnippet(content, query, 150),
          relevance_score: this.calculateKeywordRelevance(content, query),
          date: activity.started_at,
          author: activity.agent_type ? `${activity.agent_type} Agent` : 'AI Agent',
          metadata: {
            customer_id: activity.customer_id,
            agent_type: activity.agent_type,
            action_type: activity.action_type,
            status: activity.status,
          },
        };
      });
    } catch (error) {
      console.error('Agent activities search failed:', error);
      return [];
    }
  }

  // ============================================================================
  // Semantic Search
  // ============================================================================

  /**
   * Search notes using vector embeddings
   */
  private async semanticSearchNotes(
    query: string,
    options: Omit<NotesSearchOptions, 'search_type' | 'offset'>
  ): Promise<NoteSearchResult[]> {
    if (!this.supabase) return [];

    const { customer_id, user_id, source_types, date_from, date_to, limit = 40 } = options;

    try {
      // Generate embedding for the query
      const { embedding } = await embeddingService.embed(query);

      // Use a custom RPC function for vector search across notes
      // This requires a PostgreSQL function to be created
      const { data, error } = await this.supabase.rpc('search_notes_semantic', {
        query_embedding: `[${embedding.join(',')}]`,
        match_threshold: 0.6,
        match_count: limit,
        p_customer_id: customer_id || null,
        p_user_id: user_id || null,
        p_source_types: source_types || null,
        p_date_from: date_from || null,
        p_date_to: date_to || null,
      });

      if (error) {
        // If RPC doesn't exist, fall back to keyword search
        console.warn('Semantic search RPC not available, falling back to keyword search:', error.message);
        return [];
      }

      return (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        source_type: row.source_type as NoteSourceType,
        source_id: row.source_id as string,
        title: row.title as string || 'Untitled Note',
        content: row.content as string || '',
        snippet: this.generateSnippet(row.content as string, query, 150),
        relevance_score: (row.similarity as number) || 0.7,
        date: row.created_at as string,
        author: row.author as string,
        metadata: (row.metadata as Record<string, unknown>) || {},
      }));
    } catch (error) {
      console.error('Semantic search failed:', error);
      return [];
    }
  }

  // ============================================================================
  // Results Processing
  // ============================================================================

  /**
   * Merge and rank results from multiple search methods
   */
  private mergeAndRankResults(
    semanticResults: NoteSearchResult[],
    keywordResults: NoteSearchResult[],
    query: string
  ): NoteSearchResult[] {
    const merged = new Map<string, NoteSearchResult>();

    // Add semantic results (higher base score for semantic matches)
    for (const result of semanticResults) {
      const key = `${result.source_type}:${result.source_id}`;
      merged.set(key, {
        ...result,
        relevance_score: result.relevance_score * 1.1, // Boost semantic
      });
    }

    // Add or boost keyword results
    for (const result of keywordResults) {
      const key = `${result.source_type}:${result.source_id}`;
      const existing = merged.get(key);

      if (existing) {
        // Found in both - boost score
        existing.relevance_score = Math.min(1, existing.relevance_score + 0.15);
      } else {
        merged.set(key, result);
      }
    }

    // Convert to array and sort by relevance
    const results = Array.from(merged.values());
    results.sort((a, b) => b.relevance_score - a.relevance_score);

    return results;
  }

  /**
   * Add highlighting to search results
   */
  private highlightMatches(result: NoteSearchResult, query: string): NoteSearchResult {
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    if (terms.length === 0) return result;

    // Create highlight for title
    let highlightedTitle = result.title;
    let highlightedContent = result.snippet;

    for (const term of terms) {
      const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
      highlightedTitle = highlightedTitle.replace(regex, '**$1**');
      highlightedContent = highlightedContent.replace(regex, '**$1**');
    }

    return {
      ...result,
      highlight: {
        title: highlightedTitle !== result.title ? highlightedTitle : undefined,
        content: highlightedContent !== result.snippet ? highlightedContent : undefined,
      },
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private generateChatTitle(content: string, role: string, agentType?: string): string {
    const prefix = role === 'assistant' ? (agentType || 'AI') : 'User';
    const firstLine = content.split('\n')[0].substring(0, 60);
    return `${prefix}: ${firstLine}${content.length > 60 ? '...' : ''}`;
  }

  private generateSnippet(content: string, query: string, maxLength: number): string {
    if (!content) return '';

    // Try to find a snippet containing the query terms
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    const queryIndex = contentLower.indexOf(queryLower);

    if (queryIndex >= 0) {
      // Found exact match - center snippet around it
      const start = Math.max(0, queryIndex - 50);
      const end = Math.min(content.length, queryIndex + query.length + (maxLength - 50));
      let snippet = content.substring(start, end);

      if (start > 0) snippet = '...' + snippet;
      if (end < content.length) snippet = snippet + '...';

      return snippet;
    }

    // No exact match - return beginning of content
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength - 3) + '...';
  }

  private calculateKeywordRelevance(content: string, query: string): number {
    if (!content || !query) return 0;

    const contentLower = content.toLowerCase();
    const queryLower = query.toLowerCase();
    const terms = queryLower.split(/\s+/).filter((t) => t.length > 2);

    let score = 0;

    // Exact phrase match
    if (contentLower.includes(queryLower)) {
      score += 0.4;
    }

    // Individual term matches
    for (const term of terms) {
      const regex = new RegExp(this.escapeRegex(term), 'gi');
      const matches = content.match(regex);
      if (matches) {
        score += 0.15 * Math.min(matches.length, 3); // Cap at 3 matches per term
      }
    }

    return Math.min(1, score);
  }

  private formatAgentActivityContent(activity: {
    action_type: string;
    action_data?: Record<string, unknown>;
    result_data?: { summary?: string; [key: string]: unknown };
  }): string {
    const parts: string[] = [];

    if (activity.action_data) {
      const actionStr = typeof activity.action_data === 'string'
        ? activity.action_data
        : JSON.stringify(activity.action_data, null, 2);
      parts.push(`Action: ${actionStr}`);
    }

    if (activity.result_data?.summary) {
      parts.push(`Summary: ${activity.result_data.summary}`);
    } else if (activity.result_data) {
      const resultStr = typeof activity.result_data === 'string'
        ? activity.result_data
        : JSON.stringify(activity.result_data, null, 2);
      parts.push(`Result: ${resultStr}`);
    }

    return parts.join('\n\n') || activity.action_type;
  }

  private formatAgentActivityTitle(actionType: string, agentType?: string): string {
    const titles: Record<string, string> = {
      send_email: 'Email Sent',
      draft_email: 'Email Drafted',
      schedule_meeting: 'Meeting Scheduled',
      book_meeting: 'Meeting Booked',
      create_task: 'Task Created',
      health_check: 'Health Check',
      qbr_prep: 'QBR Preparation',
      risk_assessment: 'Risk Assessment',
      renewal_forecast: 'Renewal Forecast',
      research: 'Account Research',
    };

    const title = titles[actionType] || actionType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return agentType ? `${agentType}: ${title}` : title;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private generateSuggestions(
    query: string,
    results: NoteSearchResult[],
    customerId?: string
  ): string[] {
    const suggestions: string[] = [];

    // Suggest filtered searches
    if (results.length > 0) {
      const sourceTypes = [...new Set(results.map((r) => r.source_type))];
      for (const type of sourceTypes.slice(0, 2)) {
        suggestions.push(`${query} type:${type}`);
      }
    }

    // Suggest date-filtered searches
    if (!query.includes('from:') && !query.includes('to:')) {
      suggestions.push(`${query} from:${this.getDateNDaysAgo(30)}`);
    }

    // Suggest related searches based on common terms in results
    if (results.length >= 5) {
      const commonTerms = this.extractCommonTerms(results);
      for (const term of commonTerms.slice(0, 2)) {
        if (!query.toLowerCase().includes(term.toLowerCase())) {
          suggestions.push(`${query} ${term}`);
        }
      }
    }

    return suggestions.slice(0, 5);
  }

  private extractCommonTerms(results: NoteSearchResult[]): string[] {
    const termCounts = new Map<string, number>();
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'this', 'that', 'these',
      'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'them', 'their',
    ]);

    for (const result of results) {
      const words = result.content
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 3 && !stopWords.has(w));

      for (const word of words) {
        termCounts.set(word, (termCounts.get(word) || 0) + 1);
      }
    }

    // Sort by frequency and return top terms
    return Array.from(termCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([term]) => term);
  }

  private getDateNDaysAgo(n: number): string {
    const date = new Date();
    date.setDate(date.getDate() - n);
    return date.toISOString().split('T')[0];
  }

  // ============================================================================
  // Search History
  // ============================================================================

  /**
   * Save a search to history for analytics and re-use
   */
  async saveSearchHistory(
    userId: string,
    query: string,
    options: NotesSearchOptions,
    resultCount: number
  ): Promise<void> {
    if (!this.supabase) return;

    try {
      await this.supabase.from('notes_search_history').insert({
        user_id: userId,
        query,
        customer_id: options.customer_id,
        filters: options,
        result_count: resultCount,
        searched_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }

  /**
   * Get recent searches for a user
   */
  async getSearchHistory(
    userId: string,
    customerId?: string,
    limit: number = 10
  ): Promise<SearchHistoryEntry[]> {
    if (!this.supabase) return [];

    try {
      let query = this.supabase
        .from('notes_search_history')
        .select('*')
        .eq('user_id', userId)
        .order('searched_at', { ascending: false })
        .limit(limit);

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to get search history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Search history fetch error:', error);
      return [];
    }
  }

  /**
   * Track when a user clicks on a search result (for relevance learning)
   */
  async trackResultClick(
    searchHistoryId: string,
    resultId: string
  ): Promise<void> {
    if (!this.supabase) return;

    try {
      // Get current clicked results
      const { data } = await this.supabase
        .from('notes_search_history')
        .select('clicked_result_ids')
        .eq('id', searchHistoryId)
        .single();

      const currentClicks = (data?.clicked_result_ids as string[]) || [];

      // Add new click if not already tracked
      if (!currentClicks.includes(resultId)) {
        await this.supabase
          .from('notes_search_history')
          .update({
            clicked_result_ids: [...currentClicks, resultId],
          })
          .eq('id', searchHistoryId);
      }
    } catch (error) {
      console.error('Failed to track result click:', error);
    }
  }

  // ============================================================================
  // In-Memory Fallback
  // ============================================================================

  /**
   * Fallback keyword search when Supabase is not available
   */
  private inMemoryKeywordSearch(
    query: string,
    options: Omit<NotesSearchOptions, 'search_type' | 'offset'>
  ): NoteSearchResult[] {
    // Return empty array for in-memory mode
    // In a real scenario, this would search an in-memory data store
    console.warn('In-memory notes search not implemented - using Supabase is recommended');
    return [];
  }
}

// Singleton instance
export const notesSearchService = new NotesSearchService();
