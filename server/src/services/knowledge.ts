/**
 * Knowledge Service
 * RAG (Retrieval Augmented Generation) with pgvector
 *
 * Handles document ingestion, chunking, embedding, and semantic search
 * Uses Supabase pgvector for production-ready vector storage
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { embeddingService, EmbeddingResult } from './embedding.js';

// Type definitions
export type KnowledgeLayer = 'universal' | 'company' | 'customer';
export type SourceType = 'upload' | 'gdrive' | 'url' | 'email' | 'system';
export type DocumentStatus = 'pending' | 'processing' | 'indexed' | 'failed';

export interface KnowledgeDocument {
  id: string;
  userId?: string;
  customerId?: string;
  layer: KnowledgeLayer;
  category: string;
  title: string;
  sourceType: SourceType;
  sourceUrl?: string;
  sourceId?: string;
  content?: string;
  status: DocumentStatus;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  wordCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface SearchResult {
  id: string;
  documentId: string;
  content: string;
  similarity: number;
  documentTitle: string;
  documentLayer: KnowledgeLayer;
  metadata?: Record<string, unknown>;
}

export interface AddDocumentOptions {
  userId?: string;
  customerId?: string;
  layer: KnowledgeLayer;
  category: string;
  title: string;
  content: string;
  sourceType: SourceType;
  sourceUrl?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  layer?: KnowledgeLayer;
  userId?: string;
  customerId?: string;
  category?: string;
}

export class KnowledgeService {
  private supabase: SupabaseClient | null = null;
  private isConfigured: boolean = false;

  // In-memory fallback for development without Supabase
  private inMemoryDocs: Map<string, KnowledgeDocument> = new Map();
  private inMemoryChunks: Map<string, KnowledgeChunk> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
      this.isConfigured = true;
      console.log('📚 Knowledge service initialized with Supabase');
    } else {
      console.warn('⚠️  Knowledge service running in memory mode (no persistence)');
    }
  }

  /**
   * Add a document to the knowledge base
   * Automatically chunks, embeds, and stores the document
   */
  async addDocument(options: AddDocumentOptions): Promise<KnowledgeDocument> {
    const docId = crypto.randomUUID();
    const now = new Date();

    // Create document record
    const document: KnowledgeDocument = {
      id: docId,
      userId: options.userId,
      customerId: options.customerId,
      layer: options.layer,
      category: options.category,
      title: options.title,
      sourceType: options.sourceType,
      sourceUrl: options.sourceUrl,
      sourceId: options.sourceId,
      content: options.content,
      status: 'pending',
      metadata: options.metadata || {},
      wordCount: options.content.split(/\s+/).length,
      createdAt: now,
      updatedAt: now
    };

    try {
      // Save document to database
      if (this.supabase) {
        const { error } = await this.supabase
          .from('knowledge_base')
          .insert({
            id: document.id,
            user_id: document.userId,
            customer_id: document.customerId,
            layer: document.layer,
            category: document.category,
            title: document.title,
            source_type: document.sourceType,
            source_url: document.sourceUrl,
            source_id: document.sourceId,
            content: document.content,
            status: 'processing',
            metadata: document.metadata,
            word_count: document.wordCount
          });

        if (error) throw error;
      } else {
        document.status = 'processing';
        this.inMemoryDocs.set(docId, document);
      }

      // Process document asynchronously
      this.processDocument(document).catch(err => {
        console.error(`Failed to process document ${docId}:`, err);
      });

      return document;
    } catch (error) {
      console.error('Failed to add document:', error);
      throw new Error(`Failed to add document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process a document: chunk, embed, and store vectors
   */
  private async processDocument(document: KnowledgeDocument): Promise<void> {
    try {
      if (!document.content) {
        throw new Error('Document has no content');
      }

      // Chunk the document
      const chunks = embeddingService.chunkText(document.content);

      if (chunks.length === 0) {
        throw new Error('No chunks generated from document');
      }

      console.log(`📄 Processing "${document.title}": ${chunks.length} chunks`);

      // Generate embeddings for all chunks
      const texts = chunks.map(c => c.content);
      const { embeddings } = await embeddingService.embedBatch(texts);

      // Store chunks with embeddings
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];

        const chunkRecord: KnowledgeChunk = {
          id: crypto.randomUUID(),
          documentId: document.id,
          chunkIndex: chunk.index,
          content: chunk.content,
          tokenCount: embedding.tokenCount,
          embedding: embedding.embedding,
          metadata: {
            documentTitle: document.title,
            documentCategory: document.category,
            documentLayer: document.layer
          },
          createdAt: new Date()
        };

        if (this.supabase) {
          // Format embedding as pgvector string
          const embeddingString = `[${embedding.embedding.join(',')}]`;

          const { error } = await this.supabase
            .from('knowledge_chunks')
            .insert({
              id: chunkRecord.id,
              document_id: chunkRecord.documentId,
              chunk_index: chunkRecord.chunkIndex,
              content: chunkRecord.content,
              token_count: chunkRecord.tokenCount,
              embedding: embeddingString,
              metadata: chunkRecord.metadata
            });

          if (error) {
            console.error(`Failed to store chunk ${i}:`, error);
            throw error;
          }
        } else {
          this.inMemoryChunks.set(chunkRecord.id, chunkRecord);
        }
      }

      // Update document status to indexed
      await this.updateDocumentStatus(document.id, 'indexed');

      console.log(`✅ Document "${document.title}" indexed successfully`);
    } catch (error) {
      console.error(`Failed to process document ${document.id}:`, error);
      await this.updateDocumentStatus(
        document.id,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  /**
   * Update document status
   */
  private async updateDocumentStatus(
    documentId: string,
    status: DocumentStatus,
    errorMessage?: string
  ): Promise<void> {
    if (this.supabase) {
      const { error } = await this.supabase
        .from('knowledge_base')
        .update({
          status,
          error_message: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      if (error) {
        console.error('Failed to update document status:', error);
      }
    } else {
      const doc = this.inMemoryDocs.get(documentId);
      if (doc) {
        doc.status = status;
        doc.errorMessage = errorMessage;
        doc.updatedAt = new Date();
      }
    }
  }

  /**
   * Search the knowledge base using semantic similarity
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const {
      limit = 5,
      threshold = 0.7,
      layer,
      userId,
      customerId,
      category
    } = options;

    try {
      // Generate query embedding
      const { embedding: queryEmbedding } = await embeddingService.embed(query);

      if (this.supabase) {
        // Use the search_knowledge function in Supabase
        const embeddingString = `[${queryEmbedding.join(',')}]`;

        const { data, error } = await this.supabase.rpc('search_knowledge', {
          query_embedding: embeddingString,
          match_threshold: threshold,
          match_count: limit,
          filter_layer: layer || null,
          filter_user_id: userId || null
        });

        if (error) {
          console.error('Search RPC error:', error);
          throw error;
        }

        // Filter by customer if specified
        let results: SearchResult[] = (data || []).map((row: any) => ({
          id: row.id,
          documentId: row.document_id,
          content: row.content,
          similarity: row.similarity,
          documentTitle: row.document_title,
          documentLayer: row.document_layer as KnowledgeLayer
        }));

        // Additional filtering for category if needed
        if (category) {
          // Need to join with documents for category filter
          const docIds = results.map(r => r.documentId);
          const { data: docs } = await this.supabase
            .from('knowledge_base')
            .select('id')
            .in('id', docIds)
            .eq('category', category);

          const validDocIds = new Set(docs?.map(d => d.id) || []);
          results = results.filter(r => validDocIds.has(r.documentId));
        }

        return results;
      } else {
        // In-memory search fallback
        return this.inMemorySearch(queryEmbedding, options);
      }
    } catch (error) {
      console.error('Knowledge search failed:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * In-memory search for development
   */
  private inMemorySearch(
    queryEmbedding: number[],
    options: SearchOptions
  ): SearchResult[] {
    const { limit = 5, threshold = 0.7, layer } = options;

    const results: SearchResult[] = [];

    for (const chunk of this.inMemoryChunks.values()) {
      if (!chunk.embedding) continue;

      const doc = this.inMemoryDocs.get(chunk.documentId);
      if (!doc || doc.status !== 'indexed') continue;

      // Filter by layer
      if (layer && doc.layer !== layer) continue;

      const similarity = embeddingService.cosineSimilarity(queryEmbedding, chunk.embedding);

      if (similarity >= threshold) {
        results.push({
          id: chunk.id,
          documentId: chunk.documentId,
          content: chunk.content,
          similarity,
          documentTitle: doc.title,
          documentLayer: doc.layer,
          metadata: chunk.metadata
        });
      }
    }

    // Sort by similarity and limit
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string): Promise<KnowledgeDocument | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('knowledge_base')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error || !data) return null;

      return this.mapDbDocument(data);
    } else {
      return this.inMemoryDocs.get(documentId) || null;
    }
  }

  /**
   * List documents with optional filtering
   */
  async listDocuments(options: {
    userId?: string;
    customerId?: string;
    layer?: KnowledgeLayer;
    category?: string;
    status?: DocumentStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ documents: KnowledgeDocument[]; total: number }> {
    const { limit = 50, offset = 0 } = options;

    if (this.supabase) {
      let query = this.supabase
        .from('knowledge_base')
        .select('*', { count: 'exact' });

      if (options.userId) query = query.eq('user_id', options.userId);
      if (options.customerId) query = query.eq('customer_id', options.customerId);
      if (options.layer) query = query.eq('layer', options.layer);
      if (options.category) query = query.eq('category', options.category);
      if (options.status) query = query.eq('status', options.status);

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        documents: (data || []).map(this.mapDbDocument),
        total: count || 0
      };
    } else {
      const docs = Array.from(this.inMemoryDocs.values())
        .filter(doc => {
          if (options.layer && doc.layer !== options.layer) return false;
          if (options.category && doc.category !== options.category) return false;
          if (options.status && doc.status !== options.status) return false;
          return true;
        })
        .slice(offset, offset + limit);

      return { documents: docs, total: this.inMemoryDocs.size };
    }
  }

  /**
   * Delete a document and its chunks
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    if (this.supabase) {
      // Chunks are deleted via CASCADE
      const { error } = await this.supabase
        .from('knowledge_base')
        .delete()
        .eq('id', documentId);

      if (error) {
        console.error('Failed to delete document:', error);
        return false;
      }
      return true;
    } else {
      // Delete from in-memory stores
      this.inMemoryDocs.delete(documentId);
      for (const [id, chunk] of this.inMemoryChunks) {
        if (chunk.documentId === documentId) {
          this.inMemoryChunks.delete(id);
        }
      }
      return true;
    }
  }

  /**
   * Get customer context from database
   * Combines customer info, recent emails, upcoming meetings, etc.
   */
  async getCustomerContext(customerId: string, userId: string): Promise<Record<string, unknown> | null> {
    if (!this.supabase) {
      return null;
    }

    try {
      const { data, error } = await this.supabase.rpc('get_customer_context', {
        p_customer_id: customerId,
        p_user_id: userId
      });

      if (error) {
        console.error('Failed to get customer context:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Customer context error:', error);
      return null;
    }
  }

  /**
   * Search for relevant context given a query and customer
   * Combines knowledge base search with customer-specific data
   */
  async getRelevantContext(
    query: string,
    options: {
      customerId?: string;
      userId?: string;
      includePlaybooks?: boolean;
      includeCustomerDocs?: boolean;
      limit?: number;
    } = {}
  ): Promise<{
    knowledgeResults: SearchResult[];
    customerContext?: Record<string, unknown>;
  }> {
    const {
      customerId,
      userId,
      includePlaybooks = true,
      includeCustomerDocs = true,
      limit = 5
    } = options;

    const results: SearchResult[] = [];

    // Search universal playbooks
    if (includePlaybooks) {
      const playbooks = await this.search(query, {
        layer: 'universal',
        limit: Math.ceil(limit / 2)
      });
      results.push(...playbooks);
    }

    // Search customer-specific documents
    if (includeCustomerDocs && customerId && userId) {
      const customerDocs = await this.search(query, {
        layer: 'customer',
        userId,
        customerId,
        limit: Math.ceil(limit / 2)
      });
      results.push(...customerDocs);
    }

    // Sort combined results by similarity
    const sortedResults = results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    // Get customer context if available
    let customerContext: Record<string, unknown> | undefined;
    if (customerId && userId) {
      const ctx = await this.getCustomerContext(customerId, userId);
      if (ctx) customerContext = ctx;
    }

    return {
      knowledgeResults: sortedResults,
      customerContext
    };
  }

  /**
   * Map database row to KnowledgeDocument
   */
  private mapDbDocument(row: Record<string, any>): KnowledgeDocument {
    return {
      id: row.id,
      userId: row.user_id,
      customerId: row.customer_id,
      layer: row.layer,
      category: row.category,
      title: row.title,
      sourceType: row.source_type,
      sourceUrl: row.source_url,
      sourceId: row.source_id,
      content: row.content,
      status: row.status,
      errorMessage: row.error_message,
      metadata: row.metadata,
      wordCount: row.word_count,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Check if service is properly configured with Supabase
   */
  isReady(): boolean {
    return this.isConfigured;
  }
}

// Singleton instance
export const knowledgeService = new KnowledgeService();
