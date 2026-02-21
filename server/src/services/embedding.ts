/**
 * Embedding Service
 * Generates vector embeddings using Gemini embedding models
 *
 * Output dimension: 768 (compatible with pgvector schema)
 *
 * Configurable via EMBEDDING_MODEL env var:
 * - text-embedding-004 (default, stable on v1beta)
 * - text-embedding-005 (requires v1 API)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// Type definitions
export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

export interface BatchEmbeddingResult {
  embeddings: EmbeddingResult[];
  totalTokens: number;
}

export interface ChunkResult {
  content: string;
  tokenCount: number;
  index: number;
}

export interface SearchResult {
  id: string;
  documentId: string;
  content: string;
  similarity: number;
  metadata?: {
    title?: string;
    sourceType?: string;
    sourceUrl?: string;
  };
}

export interface KnowledgeDocument {
  id: string;
  userId: string;
  customerId?: string;
  sourceType: string;
  sourceId: string;
  title: string;
  contentType: string;
  rawContent?: string;
  sourceUrl?: string;
  indexedAt: Date;
}

export class EmbeddingService {
  private client: GoogleGenerativeAI | null = null;
  private supabase: ReturnType<typeof createClient> | null = null;
  private model: string = process.env.EMBEDDING_MODEL || 'text-embedding-004';
  private maxTokensPerChunk: number = 2000; // Safe limit for embedding model
  private chunkOverlap: number = 200; // Token overlap between chunks

  constructor() {
    if (config.geminiApiKey) {
      this.client = new GoogleGenerativeAI(config.geminiApiKey);
    }

    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<EmbeddingResult> {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY is required for embedding service');
    }

    try {
      const model = this.client.getGenerativeModel({ model: this.model });

      const result = await model.embedContent(text);
      const embedding = result.embedding.values;

      return {
        embedding,
        tokenCount: this.estimateTokens(text)
      };
    } catch (error) {
      console.error('Embedding error:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY is required for embedding service');
    }

    try {
      const model = this.client.getGenerativeModel({ model: this.model });

      const results: EmbeddingResult[] = [];
      let totalTokens = 0;

      // Process in batches of 100 (API limit)
      const batchSize = 100;
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);

        // Embed each text in the batch
        const batchPromises = batch.map(async (text) => {
          const result = await model.embedContent(text);
          const tokenCount = this.estimateTokens(text);
          totalTokens += tokenCount;
          return {
            embedding: result.embedding.values,
            tokenCount
          };
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      return {
        embeddings: results,
        totalTokens
      };
    } catch (error) {
      console.error('Batch embedding error:', error);
      throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Split text into chunks suitable for embedding
   * Uses a simple sentence-aware chunking strategy
   */
  chunkText(text: string, maxTokens?: number): ChunkResult[] {
    const limit = maxTokens || this.maxTokensPerChunk;
    const chunks: ChunkResult[] = [];

    // Clean and normalize text
    const cleanedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!cleanedText) {
      return [];
    }

    // Split into paragraphs first
    const paragraphs = cleanedText.split(/\n\n+/);

    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const paragraphTokens = this.estimateTokens(paragraph);
      const currentTokens = this.estimateTokens(currentChunk);

      // If paragraph alone exceeds limit, split by sentences
      if (paragraphTokens > limit) {
        // Flush current chunk if not empty
        if (currentChunk) {
          chunks.push({
            content: currentChunk.trim(),
            tokenCount: currentTokens,
            index: chunkIndex++
          });
          currentChunk = '';
        }

        // Split paragraph into sentences
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];

        for (const sentence of sentences) {
          const sentenceTokens = this.estimateTokens(sentence);
          const chunkTokens = this.estimateTokens(currentChunk);

          if (chunkTokens + sentenceTokens > limit && currentChunk) {
            chunks.push({
              content: currentChunk.trim(),
              tokenCount: chunkTokens,
              index: chunkIndex++
            });
            // Start new chunk with overlap from previous
            const words = currentChunk.split(/\s+/);
            const overlapWords = words.slice(-Math.floor(this.chunkOverlap / 4));
            currentChunk = overlapWords.join(' ') + ' ' + sentence;
          } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          }
        }
      } else if (currentTokens + paragraphTokens > limit) {
        // Paragraph would exceed limit, start new chunk
        if (currentChunk) {
          chunks.push({
            content: currentChunk.trim(),
            tokenCount: currentTokens,
            index: chunkIndex++
          });
        }
        // Start new chunk with some overlap
        const words = currentChunk.split(/\s+/);
        const overlapWords = words.slice(-Math.floor(this.chunkOverlap / 4));
        currentChunk = overlapWords.join(' ') + '\n\n' + paragraph;
      } else {
        // Add paragraph to current chunk
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        tokenCount: this.estimateTokens(currentChunk),
        index: chunkIndex
      });
    }

    return chunks;
  }

  /**
   * Estimate token count for text
   * Uses a simple heuristic: ~4 characters per token for English text
   */
  estimateTokens(text: string): number {
    if (!text) return 0;
    // Rough estimate: 1 token ≈ 4 characters or 0.75 words
    const charEstimate = Math.ceil(text.length / 4);
    const wordEstimate = Math.ceil(text.split(/\s+/).length * 1.3);
    return Math.max(charEstimate, wordEstimate);
  }

  /**
   * Compute cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embedding dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get the embedding dimension (768 for text-embedding-005)
   */
  getDimension(): number {
    return 768;
  }

  // ==================== Knowledge Base Methods ====================

  /**
   * Store embedding in database
   */
  async storeEmbedding(chunkId: string, embedding: number[]): Promise<void> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    // Type assertion needed until Supabase types are regenerated
    await (this.supabase as any)
      .from('knowledge_chunks')
      .update({
        embedding: `[${embedding.join(',')}]`,
      })
      .eq('id', chunkId);
  }

  /**
   * Index document chunks with embeddings
   */
  async indexDocument(documentId: string): Promise<number> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    // Get chunks without embeddings
    const { data: chunks, error } = await (this.supabase as any)
      .from('knowledge_chunks')
      .select('id, content')
      .eq('document_id', documentId)
      .is('embedding', null);

    if (error || !chunks?.length) {
      return 0;
    }

    let indexed = 0;

    // Generate and store embeddings
    for (const chunk of chunks) {
      try {
        const { embedding } = await this.embed(chunk.content);
        await this.storeEmbedding(chunk.id, embedding);
        indexed++;
      } catch (err) {
        console.error(`Error embedding chunk ${chunk.id}:`, err);
      }
    }

    return indexed;
  }

  /**
   * Search for similar content using vector similarity
   */
  async searchSimilar(
    query: string,
    options: {
      userId?: string;
      customerId?: string;
      limit?: number;
      threshold?: number;
    } = {}
  ): Promise<SearchResult[]> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    // Generate query embedding
    const { embedding: queryEmbedding } = await this.embed(query);

    // Use the similarity search function from the migration
    const { data, error } = await (this.supabase as any).rpc('search_knowledge_chunks', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      match_threshold: options.threshold || 0.7,
      match_count: options.limit || 10,
      p_user_id: options.userId,
      p_customer_id: options.customerId,
    });

    if (error) {
      console.error('Error searching chunks:', error);
      return [];
    }

    // Get document metadata for results
    const results: SearchResult[] = [];

    for (const row of data || []) {
      const { data: doc } = await (this.supabase as any)
        .from('knowledge_base')
        .select('title, source_type, source_url')
        .eq('id', row.document_id)
        .single();

      results.push({
        id: row.id,
        documentId: row.document_id,
        content: row.content,
        similarity: row.similarity,
        metadata: doc ? {
          title: doc.title,
          sourceType: doc.source_type,
          sourceUrl: doc.source_url,
        } : undefined,
      });
    }

    return results;
  }

  /**
   * Get relevant context for a query (for RAG)
   */
  async getContext(
    query: string,
    options: {
      userId?: string;
      customerId?: string;
      maxTokens?: number;
      limit?: number;
    } = {}
  ): Promise<string> {
    const results = await this.searchSimilar(query, {
      userId: options.userId,
      customerId: options.customerId,
      limit: options.limit || 5,
      threshold: 0.6,
    });

    if (!results.length) {
      return '';
    }

    // Build context string with source attribution
    const contextParts: string[] = [];
    let tokenEstimate = 0;
    const maxTokens = options.maxTokens || 2000;

    for (const result of results) {
      const source = result.metadata?.title || 'Unknown source';
      const part = `[From: ${source}]\n${result.content}\n`;

      // Rough token estimate (4 chars per token)
      const partTokens = part.length / 4;

      if (tokenEstimate + partTokens > maxTokens) {
        break;
      }

      contextParts.push(part);
      tokenEstimate += partTokens;
    }

    return contextParts.join('\n---\n');
  }

  /**
   * Index all unindexed chunks
   */
  async indexAllPending(): Promise<{ indexed: number; failed: number }> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }

    // Get all chunks without embeddings
    const { data: chunks, error } = await (this.supabase as any)
      .from('knowledge_chunks')
      .select('id, content')
      .is('embedding', null)
      .limit(100);

    if (error || !chunks?.length) {
      return { indexed: 0, failed: 0 };
    }

    let indexed = 0;
    let failed = 0;

    for (const chunk of chunks) {
      try {
        const { embedding } = await this.embed(chunk.content);
        await this.storeEmbedding(chunk.id, embedding);
        indexed++;
      } catch (err) {
        console.error(`Error embedding chunk ${chunk.id}:`, err);
        failed++;
      }
    }

    return { indexed, failed };
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string): Promise<KnowledgeDocument | null> {
    if (!this.supabase) {
      return null;
    }

    const { data, error } = await (this.supabase as any)
      .from('knowledge_base')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      customerId: data.customer_id,
      sourceType: data.source_type,
      sourceId: data.source_id,
      title: data.title,
      contentType: data.content_type,
      rawContent: data.raw_content,
      sourceUrl: data.source_url,
      indexedAt: new Date(data.indexed_at),
    };
  }

  /**
   * List documents for a user
   */
  async listDocuments(
    userId: string,
    options: { customerId?: string; limit?: number; offset?: number } = {}
  ): Promise<KnowledgeDocument[]> {
    if (!this.supabase) {
      return [];
    }

    let query = (this.supabase as any)
      .from('knowledge_base')
      .select('*')
      .eq('user_id', userId)
      .order('indexed_at', { ascending: false })
      .limit(options.limit || 50);

    if (options.customerId) {
      query = query.eq('customer_id', options.customerId);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      customerId: d.customer_id,
      sourceType: d.source_type,
      sourceId: d.source_id,
      title: d.title,
      contentType: d.content_type,
      rawContent: d.raw_content,
      sourceUrl: d.source_url,
      indexedAt: new Date(d.indexed_at),
    }));
  }

  /**
   * Delete document and its chunks
   */
  async deleteDocument(documentId: string): Promise<void> {
    if (!this.supabase) {
      return;
    }

    // Delete chunks first (due to FK constraint)
    await (this.supabase as any)
      .from('knowledge_chunks')
      .delete()
      .eq('document_id', documentId);

    // Delete document
    await (this.supabase as any)
      .from('knowledge_base')
      .delete()
      .eq('id', documentId);
  }

  /**
   * Get embedding statistics
   */
  async getStats(userId: string): Promise<{
    totalDocuments: number;
    totalChunks: number;
    indexedChunks: number;
    pendingChunks: number;
  }> {
    if (!this.supabase) {
      return { totalDocuments: 0, totalChunks: 0, indexedChunks: 0, pendingChunks: 0 };
    }

    // Get document count
    const { count: docCount } = await (this.supabase as any)
      .from('knowledge_base')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get chunk counts
    const { count: totalChunks } = await (this.supabase as any)
      .from('knowledge_chunks')
      .select('*, knowledge_base!inner(*)', { count: 'exact', head: true })
      .eq('knowledge_base.user_id', userId);

    const { count: indexedChunks } = await (this.supabase as any)
      .from('knowledge_chunks')
      .select('*, knowledge_base!inner(*)', { count: 'exact', head: true })
      .eq('knowledge_base.user_id', userId)
      .not('embedding', 'is', null);

    return {
      totalDocuments: docCount || 0,
      totalChunks: totalChunks || 0,
      indexedChunks: indexedChunks || 0,
      pendingChunks: (totalChunks || 0) - (indexedChunks || 0),
    };
  }
}

// Singleton instance
export const embeddingService = new EmbeddingService();
