/**
 * Universal Search Service
 * PRD-219: AI-Powered Universal Search
 *
 * Provides semantic and keyword search across all data types including
 * customers, stakeholders, emails, meetings, documents, and more.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index.js';
import { embeddingService } from './embedding.js';

// ============================================
// Types
// ============================================

interface ParsedQuery {
  raw_query: string;
  keywords: string[];
  filters: {
    type?: string[];
    customer_id?: string;
    date_range?: { from: string | null; to: string | null };
    author?: string;
  };
  natural_language_intent?: string;
  entities: {
    person_names?: string[];
    company_names?: string[];
    dates?: string[];
  };
  search_type: 'semantic' | 'keyword' | 'hybrid';
}

interface SearchResult {
  id: string;
  type: string;
  title: string;
  snippet: string;
  relevance_score: number;
  metadata: Record<string, unknown>;
  highlight?: { title?: string; content?: string };
  actions: string[];
}

interface SearchOptions {
  userId: string;
  limit?: number;
  offset?: number;
}

// ============================================
// Universal Search Service
// ============================================

export class UniversalSearchService {
  private supabase: SupabaseClient | null = null;
  private anthropic: Anthropic | null = null;

  constructor() {
    // Initialize Supabase
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }

    // Initialize Anthropic for NLP
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: config.anthropicApiKey
      });
    }
  }

  // ============================================
  // Main Search Method
  // ============================================

  async search(
    query: string,
    options: SearchOptions
  ): Promise<{
    results: SearchResult[];
    parsed: ParsedQuery;
    total: number;
    suggestions: string[];
  }> {
    const startTime = Date.now();
    const { userId, limit = 20, offset = 0 } = options;

    // Step 1: Parse the query
    const parsed = await this.parseQuery(query);

    // Step 2: Execute search based on parsed query
    let results: SearchResult[] = [];

    if (parsed.search_type === 'semantic' || parsed.search_type === 'hybrid') {
      // Use semantic search when natural language is detected
      const semanticResults = await this.semanticSearch(query, parsed.filters, userId, limit);
      results = semanticResults;
    }

    if (parsed.search_type === 'keyword' || parsed.search_type === 'hybrid') {
      // Use keyword search for exact matches
      const keywordResults = await this.keywordSearch(parsed.keywords, parsed.filters, userId, limit);

      if (parsed.search_type === 'hybrid') {
        // Merge and deduplicate results
        results = this.mergeResults(results, keywordResults);
      } else {
        results = keywordResults;
      }
    }

    // Step 3: Search entities directly if found
    if (parsed.entities.company_names?.length || parsed.entities.person_names?.length) {
      const entityResults = await this.entitySearch(parsed.entities, userId, limit);
      results = this.mergeResults(results, entityResults);
    }

    // Step 4: Apply AI ranking if we have enough results
    if (results.length > 5 && this.anthropic) {
      results = await this.aiRank(results, query, parsed);
    }

    // Step 5: Apply pagination
    const total = results.length;
    results = results.slice(offset, offset + limit);

    // Step 6: Generate suggestions
    const suggestions = this.generateSuggestions(query, parsed);

    console.log(`Search completed in ${Date.now() - startTime}ms for query: "${query}"`);

    return {
      results,
      parsed,
      total,
      suggestions
    };
  }

  // ============================================
  // Query Parser with NLP
  // ============================================

  async parseQuery(query: string): Promise<ParsedQuery> {
    const parsed: ParsedQuery = {
      raw_query: query,
      keywords: [],
      filters: {},
      entities: {},
      search_type: 'hybrid'
    };

    // Extract explicit filters from query syntax (e.g., "type:email from:sarah")
    const filterPatterns = [
      { pattern: /type:(\w+)/gi, key: 'type' as const },
      { pattern: /customer:([^\s]+)/gi, key: 'customer_id' as const },
      { pattern: /from:(\d{4}-\d{2}-\d{2})/gi, key: 'date_from' as const },
      { pattern: /to:(\d{4}-\d{2}-\d{2})/gi, key: 'date_to' as const },
      { pattern: /author:([^\s]+)/gi, key: 'author' as const }
    ];

    let cleanQuery = query;
    for (const { pattern, key } of filterPatterns) {
      const matches = [...query.matchAll(pattern)];
      for (const match of matches) {
        const value = match[1];
        if (key === 'type') {
          parsed.filters.type = parsed.filters.type || [];
          parsed.filters.type.push(value.toLowerCase());
        } else if (key === 'date_from') {
          parsed.filters.date_range = parsed.filters.date_range || { from: null, to: null };
          parsed.filters.date_range.from = value;
        } else if (key === 'date_to') {
          parsed.filters.date_range = parsed.filters.date_range || { from: null, to: null };
          parsed.filters.date_range.to = value;
        } else if (key === 'customer_id') {
          parsed.filters.customer_id = value;
        } else if (key === 'author') {
          parsed.filters.author = value;
        }
        cleanQuery = cleanQuery.replace(match[0], '').trim();
      }
    }

    // Extract keywords (basic tokenization)
    parsed.keywords = cleanQuery
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.isStopWord(word));

    // Use Claude for advanced NLP if available and query looks like natural language
    if (this.anthropic && this.isNaturalLanguageQuery(cleanQuery)) {
      try {
        const nlpResult = await this.parseWithClaude(cleanQuery);
        parsed.natural_language_intent = nlpResult.intent;
        parsed.entities = { ...parsed.entities, ...nlpResult.entities };

        // Infer filters from NLP
        if (nlpResult.inferred_type) {
          parsed.filters.type = parsed.filters.type || [];
          if (!parsed.filters.type.includes(nlpResult.inferred_type)) {
            parsed.filters.type.push(nlpResult.inferred_type);
          }
        }
        if (nlpResult.date_range) {
          parsed.filters.date_range = nlpResult.date_range;
        }

        parsed.search_type = 'hybrid';
      } catch (error) {
        console.error('Claude NLP parsing failed:', error);
        // Fall back to keyword search
        parsed.search_type = 'keyword';
      }
    }

    return parsed;
  }

  private async parseWithClaude(query: string): Promise<{
    intent: string;
    entities: { person_names?: string[]; company_names?: string[]; dates?: string[] };
    inferred_type?: string;
    date_range?: { from: string | null; to: string | null };
  }> {
    if (!this.anthropic) {
      throw new Error('Anthropic not configured');
    }

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Parse this search query for a Customer Success platform. Extract:
1. The user's intent (what they're looking for)
2. Named entities (person names, company names, dates)
3. The most likely content type (customer, stakeholder, email, meeting, document, playbook, task, note)
4. Any date range implied

Query: "${query}"

Respond with JSON only:
{
  "intent": "brief description of what user wants",
  "entities": {
    "person_names": ["name1"],
    "company_names": ["company1"],
    "dates": ["2024-01-15"]
  },
  "inferred_type": "email|meeting|customer|etc or null",
  "date_range": {"from": "2024-01-01", "to": "2024-01-31"} or null
}`
        }
      ]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse Claude response');
    }

    return JSON.parse(jsonMatch[0]);
  }

  private isNaturalLanguageQuery(query: string): boolean {
    // Check if query looks like natural language vs just keywords
    const naturalLanguageIndicators = [
      /\b(from|about|with|this|last|next|week|month|year)\b/i,
      /\b(emails?|meetings?|notes?|documents?)\b/i,
      /\b(show|find|get|search|look)\b/i,
      /\?$/, // Questions
      query.split(' ').length > 3 // Longer queries
    ];

    return naturalLanguageIndicators.some(indicator =>
      typeof indicator === 'object' ? indicator.test(query) : indicator
    );
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that',
      'the', 'to', 'was', 'were', 'will', 'with'
    ]);
    return stopWords.has(word);
  }

  // ============================================
  // Semantic Search
  // ============================================

  private async semanticSearch(
    query: string,
    filters: ParsedQuery['filters'],
    userId: string,
    limit: number
  ): Promise<SearchResult[]> {
    if (!this.supabase) {
      return [];
    }

    try {
      // Generate query embedding
      const { embedding } = await embeddingService.embed(query);

      // Build the search query
      const { data, error } = await this.supabase.rpc('search_universal', {
        query_embedding: `[${embedding.join(',')}]`,
        match_threshold: 0.6,
        match_count: limit,
        p_user_id: userId,
        p_source_types: filters.type || null,
        p_customer_id: filters.customer_id || null,
        p_date_from: filters.date_range?.from || null,
        p_date_to: filters.date_range?.to || null
      });

      if (error) {
        console.error('Semantic search error:', error);
        return [];
      }

      return (data || []).map((row: Record<string, unknown>) => this.formatResult(row, 'semantic'));
    } catch (error) {
      console.error('Semantic search failed:', error);
      return [];
    }
  }

  // ============================================
  // Keyword Search
  // ============================================

  private async keywordSearch(
    keywords: string[],
    filters: ParsedQuery['filters'],
    userId: string,
    limit: number
  ): Promise<SearchResult[]> {
    if (!this.supabase || keywords.length === 0) {
      return [];
    }

    try {
      // Build PostgreSQL full-text search query
      const searchQuery = keywords.join(' & ');

      let query = this.supabase
        .from('search_index')
        .select('*')
        .textSearch('tsv', searchQuery, { type: 'websearch' })
        .eq('user_id', userId)
        .limit(limit);

      // Apply filters
      if (filters.type?.length) {
        query = query.in('source_type', filters.type);
      }
      if (filters.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }
      if (filters.date_range?.from) {
        query = query.gte('created_at', filters.date_range.from);
      }
      if (filters.date_range?.to) {
        query = query.lte('created_at', filters.date_range.to);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Keyword search error:', error);
        return [];
      }

      return (data || []).map((row: Record<string, unknown>) => this.formatResult(row, 'keyword'));
    } catch (error) {
      console.error('Keyword search failed:', error);
      return [];
    }
  }

  // ============================================
  // Entity Search
  // ============================================

  private async entitySearch(
    entities: ParsedQuery['entities'],
    userId: string,
    limit: number
  ): Promise<SearchResult[]> {
    if (!this.supabase) {
      return [];
    }

    const results: SearchResult[] = [];

    try {
      // Search for companies in customers
      if (entities.company_names?.length) {
        for (const company of entities.company_names) {
          const { data } = await this.supabase
            .from('customers')
            .select('id, name, industry, arr, health_score, stage, created_at')
            .ilike('name', `%${company}%`)
            .limit(limit);

          if (data) {
            results.push(...data.map((c: Record<string, unknown>) => ({
              id: c.id as string,
              type: 'customer',
              title: c.name as string,
              snippet: `${c.industry || 'Unknown industry'} | ARR: $${((c.arr as number) || 0).toLocaleString()} | Health: ${c.health_score || 'N/A'}`,
              relevance_score: 0.9,
              metadata: {
                customer_id: c.id,
                customer_name: c.name,
                date: c.created_at
              },
              actions: ['view_customer']
            })));
          }
        }
      }

      // Search for people in stakeholders
      if (entities.person_names?.length) {
        for (const person of entities.person_names) {
          const { data } = await this.supabase
            .from('stakeholders')
            .select('id, name, email, title, company, customer_id')
            .or(`name.ilike.%${person}%,email.ilike.%${person}%`)
            .limit(limit);

          if (data) {
            results.push(...data.map((s: Record<string, unknown>) => ({
              id: s.id as string,
              type: 'stakeholder',
              title: s.name as string,
              snippet: `${s.title || 'Contact'} at ${s.company || 'Unknown company'} | ${s.email || ''}`,
              relevance_score: 0.9,
              metadata: {
                customer_id: s.customer_id,
                email: s.email
              },
              actions: ['view_stakeholder', 'view_customer']
            })));
          }
        }
      }
    } catch (error) {
      console.error('Entity search failed:', error);
    }

    return results;
  }

  // ============================================
  // Result Merging and Ranking
  // ============================================

  private mergeResults(
    results1: SearchResult[],
    results2: SearchResult[]
  ): SearchResult[] {
    const seen = new Set<string>();
    const merged: SearchResult[] = [];

    // Add all from first set
    for (const result of results1) {
      const key = `${result.type}:${result.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(result);
      }
    }

    // Add unique from second set
    for (const result of results2) {
      const key = `${result.type}:${result.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(result);
      } else {
        // Boost score for items found in both
        const existing = merged.find(r => `${r.type}:${r.id}` === key);
        if (existing) {
          existing.relevance_score = Math.min(1, existing.relevance_score + 0.1);
        }
      }
    }

    // Sort by relevance
    merged.sort((a, b) => b.relevance_score - a.relevance_score);

    return merged;
  }

  private async aiRank(
    results: SearchResult[],
    query: string,
    parsed: ParsedQuery
  ): Promise<SearchResult[]> {
    if (!this.anthropic || results.length <= 5) {
      return results;
    }

    try {
      // Get Claude to rank the top results
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Given the search query "${query}" with intent "${parsed.natural_language_intent || 'general search'}",
rank these search results by relevance. Return only the IDs in order of relevance, most relevant first.

Results:
${results.slice(0, 10).map((r, i) => `${i + 1}. [${r.id}] ${r.type}: ${r.title} - ${r.snippet.substring(0, 100)}`).join('\n')}

Respond with a JSON array of IDs only: ["id1", "id2", ...]`
          }
        ]
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const rankedIds = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || '[]');

      // Reorder results based on Claude's ranking
      const idToResult = new Map(results.map(r => [r.id, r]));
      const ranked: SearchResult[] = [];

      for (const id of rankedIds) {
        const result = idToResult.get(id);
        if (result) {
          result.relevance_score = 1 - (ranked.length * 0.05); // Decrease score by position
          ranked.push(result);
          idToResult.delete(id);
        }
      }

      // Add remaining results
      ranked.push(...idToResult.values());

      return ranked;
    } catch (error) {
      console.error('AI ranking failed:', error);
      return results;
    }
  }

  // ============================================
  // Suggestions
  // ============================================

  async suggest(
    query: string,
    userId: string,
    limit: number = 8
  ): Promise<Array<{
    type: string;
    text: string;
    id?: string;
    category: string;
    metadata?: Record<string, unknown>;
  }>> {
    const suggestions: Array<{
      type: string;
      text: string;
      id?: string;
      category: string;
      metadata?: Record<string, unknown>;
    }> = [];

    if (!query || query.length < 2 || !this.supabase) {
      // Return recent searches if no query
      return this.getRecentSearches(userId, limit);
    }

    try {
      // 1. Add query suggestions based on common patterns
      const querySuggestions = this.generateQuerySuggestions(query);
      suggestions.push(...querySuggestions.slice(0, 2));

      // 2. Search customers
      const { data: customers } = await this.supabase
        .from('customers')
        .select('id, name, industry')
        .ilike('name', `%${query}%`)
        .limit(3);

      if (customers) {
        suggestions.push(...customers.map(c => ({
          type: 'customer',
          text: c.name,
          id: c.id,
          category: 'Customer',
          metadata: { industry: c.industry }
        })));
      }

      // 3. Search stakeholders
      const { data: stakeholders } = await this.supabase
        .from('stakeholders')
        .select('id, name, title, company')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(3);

      if (stakeholders) {
        suggestions.push(...stakeholders.map(s => ({
          type: 'stakeholder',
          text: `${s.name}${s.title ? ` (${s.title})` : ''}`,
          id: s.id,
          category: 'Contact',
          metadata: { company: s.company, role: s.title }
        })));
      }

      // 4. Add recent searches that match
      const recentMatches = await this.getMatchingRecentSearches(userId, query, 2);
      suggestions.push(...recentMatches);

    } catch (error) {
      console.error('Suggestion generation failed:', error);
    }

    return suggestions.slice(0, limit);
  }

  private generateQuerySuggestions(query: string): Array<{
    type: string;
    text: string;
    category: string;
  }> {
    const suggestions: Array<{ type: string; text: string; category: string }> = [];
    const lowerQuery = query.toLowerCase();

    // Common search patterns
    const patterns = [
      { trigger: 'email', suggestions: [`emails from ${query.replace(/emails?\s*/i, '')}`, `emails about ${query.replace(/emails?\s*/i, '')}`] },
      { trigger: 'meeting', suggestions: [`meetings with ${query.replace(/meetings?\s*/i, '')}`, `meetings this week`] },
      { trigger: 'at risk', suggestions: ['at-risk accounts', 'customers needing attention'] },
      { trigger: 'renewal', suggestions: ['upcoming renewals', 'renewals this quarter'] }
    ];

    for (const pattern of patterns) {
      if (lowerQuery.includes(pattern.trigger)) {
        suggestions.push(...pattern.suggestions.map(s => ({
          type: 'query',
          text: s,
          category: 'Search'
        })));
      }
    }

    return suggestions;
  }

  private generateSuggestions(query: string, parsed: ParsedQuery): string[] {
    const suggestions: string[] = [];

    // Suggest related searches based on entities found
    if (parsed.entities.person_names?.length) {
      const name = parsed.entities.person_names[0];
      suggestions.push(
        `emails from ${name}`,
        `meetings with ${name}`,
        `${name} activity`
      );
    }

    if (parsed.entities.company_names?.length) {
      const company = parsed.entities.company_names[0];
      suggestions.push(
        `${company} health score`,
        `${company} renewal status`,
        `${company} stakeholders`
      );
    }

    // Suggest filter variations
    if (!parsed.filters.type?.length) {
      suggestions.push(
        `${query} type:email`,
        `${query} type:meeting`
      );
    }

    return suggestions.slice(0, 5);
  }

  // ============================================
  // Recent Searches
  // ============================================

  async saveSearch(
    userId: string,
    query: string,
    filters?: ParsedQuery['filters']
  ): Promise<void> {
    if (!this.supabase) return;

    try {
      // Check if search exists
      const { data: existing } = await this.supabase
        .from('user_searches')
        .select('id, use_count')
        .eq('user_id', userId)
        .eq('query', query)
        .single();

      if (existing) {
        // Update existing
        await this.supabase
          .from('user_searches')
          .update({
            use_count: existing.use_count + 1,
            last_used_at: new Date().toISOString(),
            filters: filters || null
          })
          .eq('id', existing.id);
      } else {
        // Create new
        await this.supabase
          .from('user_searches')
          .insert({
            user_id: userId,
            query,
            filters: filters || null,
            is_saved: false,
            use_count: 1,
            last_used_at: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error('Failed to save search:', error);
    }
  }

  async getRecentSearches(
    userId: string,
    limit: number = 10
  ): Promise<Array<{
    type: string;
    text: string;
    category: string;
  }>> {
    if (!this.supabase) return [];

    try {
      const { data } = await this.supabase
        .from('user_searches')
        .select('query')
        .eq('user_id', userId)
        .order('last_used_at', { ascending: false })
        .limit(limit);

      return (data || []).map(s => ({
        type: 'recent',
        text: s.query,
        category: 'Recent Search'
      }));
    } catch (error) {
      console.error('Failed to get recent searches:', error);
      return [];
    }
  }

  private async getMatchingRecentSearches(
    userId: string,
    query: string,
    limit: number
  ): Promise<Array<{
    type: string;
    text: string;
    category: string;
  }>> {
    if (!this.supabase) return [];

    try {
      const { data } = await this.supabase
        .from('user_searches')
        .select('query')
        .eq('user_id', userId)
        .ilike('query', `%${query}%`)
        .order('use_count', { ascending: false })
        .limit(limit);

      return (data || []).map(s => ({
        type: 'recent',
        text: s.query,
        category: 'Recent Search'
      }));
    } catch (error) {
      return [];
    }
  }

  // ============================================
  // Saved Searches
  // ============================================

  async saveSearchAsFavorite(
    userId: string,
    searchId: string,
    name: string
  ): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('user_searches')
      .update({
        is_saved: true,
        name
      })
      .eq('id', searchId)
      .eq('user_id', userId);
  }

  async getSavedSearches(userId: string): Promise<Array<{
    id: string;
    name: string;
    query: string;
    filters?: ParsedQuery['filters'];
  }>> {
    if (!this.supabase) return [];

    const { data } = await this.supabase
      .from('user_searches')
      .select('id, name, query, filters')
      .eq('user_id', userId)
      .eq('is_saved', true)
      .order('name');

    return data || [];
  }

  async deleteSavedSearch(userId: string, searchId: string): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('user_searches')
      .delete()
      .eq('id', searchId)
      .eq('user_id', userId);
  }

  // ============================================
  // Indexing Methods
  // ============================================

  async indexDocument(doc: {
    source_type: string;
    source_id: string;
    user_id: string;
    customer_id?: string;
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<string | null> {
    if (!this.supabase) return null;

    try {
      // Insert into search index
      const { data, error } = await this.supabase
        .from('search_index')
        .upsert({
          source_type: doc.source_type,
          source_id: doc.source_id,
          user_id: doc.user_id,
          customer_id: doc.customer_id,
          title: doc.title,
          content: doc.content,
          metadata: doc.metadata || {},
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'source_type,source_id'
        })
        .select('id')
        .single();

      if (error) {
        console.error('Index document error:', error);
        return null;
      }

      // Generate and store embedding
      if (data?.id) {
        const textToEmbed = `${doc.title}\n\n${doc.content}`;
        const { embedding } = await embeddingService.embed(textToEmbed);

        await this.supabase
          .from('search_embeddings')
          .upsert({
            search_index_id: data.id,
            embedding: `[${embedding.join(',')}]`
          }, {
            onConflict: 'search_index_id'
          });
      }

      return data?.id || null;
    } catch (error) {
      console.error('Index document failed:', error);
      return null;
    }
  }

  async bulkIndex(documents: Array<{
    source_type: string;
    source_id: string;
    user_id: string;
    customer_id?: string;
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
  }>): Promise<{ indexed: number; failed: number }> {
    let indexed = 0;
    let failed = 0;

    for (const doc of documents) {
      const result = await this.indexDocument(doc);
      if (result) {
        indexed++;
      } else {
        failed++;
      }
    }

    return { indexed, failed };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private formatResult(row: Record<string, unknown>, source: 'semantic' | 'keyword'): SearchResult {
    const type = (row.source_type || row.type || 'note') as string;
    const metadata = (row.metadata || {}) as Record<string, unknown>;

    return {
      id: row.id as string || row.source_id as string,
      type,
      title: row.title as string || 'Untitled',
      snippet: this.generateSnippet(row.content as string, 150),
      relevance_score: (row.similarity as number) || (source === 'keyword' ? 0.7 : 0.8),
      metadata: {
        customer_id: row.customer_id as string,
        customer_name: metadata.customer_name as string,
        date: row.created_at as string || row.updated_at as string,
        ...metadata
      },
      highlight: row.highlight as { title?: string; content?: string },
      actions: this.getActionsForType(type)
    };
  }

  private generateSnippet(content: string | undefined, maxLength: number): string {
    if (!content) return '';
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength - 3) + '...';
  }

  private getActionsForType(type: string): string[] {
    const actionMap: Record<string, string[]> = {
      customer: ['view_customer'],
      stakeholder: ['view_stakeholder', 'view_customer'],
      email: ['open_email', 'view_customer'],
      meeting: ['view_summary', 'view_recording', 'view_customer'],
      document: ['open_document', 'view_customer'],
      playbook: ['view_playbook'],
      task: ['view_task', 'view_customer'],
      note: ['view_note', 'view_customer'],
      activity: ['view_customer']
    };
    return actionMap[type] || ['view_customer'];
  }
}

// Singleton instance
export const universalSearchService = new UniversalSearchService();
