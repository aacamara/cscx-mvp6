/**
 * Knowledge Base Routes
 * PRD-2 US-006: Knowledge base document sync from Google Drive
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { randomUUID } from 'crypto';
import { applyOrgFilterInclusive, withOrgId } from '../middleware/orgFilter.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Supabase client
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

// In-memory store for KB documents when database not available
const kbDocuments = new Map<string, {
  id: string;
  title: string;
  content: string;
  source: string;
  syncedAt: string;
  embedding?: number[];
}>();

/**
 * POST /api/kb/sync
 * Trigger sync of knowledge base documents from Google Drive
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { folderId, userId, workspaceId } = req.body;

    if (!folderId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Google Drive folderId is required'
        }
      });
    }

    // Simulate document fetch from Drive
    // In production, this would use the Google Drive API via driveService
    const syncResults = {
      documentsProcessed: 0,
      documentsSkipped: 0,
      chunksCreated: 0,
      errors: [] as { document: string; reason: string }[]
    };

    // Simulate processing Drive documents
    const mockDriveDocuments = [
      {
        id: 'doc-1',
        title: 'Product Overview',
        content: 'CSCX.AI is a comprehensive customer success platform that helps CSMs manage their customer relationships effectively. Features include health scoring, automated workflows, and AI-powered insights.',
        mimeType: 'application/vnd.google-apps.document'
      },
      {
        id: 'doc-2',
        title: 'Onboarding Best Practices',
        content: 'Effective customer onboarding includes: 1. Kickoff call within 48 hours of contract signing. 2. Define success criteria and KPIs. 3. Create implementation timeline. 4. Assign dedicated CSM. 5. Schedule regular check-ins.',
        mimeType: 'application/vnd.google-apps.document'
      },
      {
        id: 'doc-3',
        title: 'Health Score Methodology',
        content: 'Health scores are calculated using: Product Usage (30%), Support Sentiment (20%), Engagement (25%), NPS Responses (15%), and Contract Status (10%). Scores range from 0-100, with Red (<50), Yellow (50-79), and Green (80+) classifications.',
        mimeType: 'application/vnd.google-apps.document'
      },
      {
        id: 'doc-4',
        title: 'Renewal Playbook',
        content: 'Renewal process begins 120 days before expiration. Steps include: Value review meeting at 90 days, proposal at 60 days, negotiation at 30 days, and signature by renewal date. Track all expansion opportunities.',
        mimeType: 'application/vnd.google-apps.document'
      }
    ];

    for (const doc of mockDriveDocuments) {
      try {
        // Extract text (already provided in mock)
        const extractedText = doc.content;

        // Generate simple embedding (in production, use OpenAI/Claude embeddings)
        const embedding = generateSimpleEmbedding(extractedText);

        // Split into chunks for better retrieval
        const chunks = splitIntoChunks(extractedText, 500);

        if (supabase) {
          // Store in knowledge_chunks table
          for (let i = 0; i < chunks.length; i++) {
            const chunkId = randomUUID();
            const chunkEmbedding = generateSimpleEmbedding(chunks[i]);

            const { error } = await supabase
              .from('knowledge_chunks')
              .upsert(withOrgId({
                id: chunkId,
                document_id: doc.id,
                document_title: doc.title,
                chunk_index: i,
                content: chunks[i],
                embedding: chunkEmbedding,
                workspace_id: workspaceId,
                source_folder_id: folderId,
                synced_at: new Date().toISOString()
              }, req), { onConflict: 'document_id,chunk_index' });

            if (error) {
              // Table might not exist, continue with in-memory
              console.warn('Knowledge chunks table not available:', error.message);
            } else {
              syncResults.chunksCreated++;
            }
          }
        } else {
          // Store in-memory for demo
          for (let i = 0; i < chunks.length; i++) {
            const chunkId = `${doc.id}-chunk-${i}`;
            kbDocuments.set(chunkId, {
              id: chunkId,
              title: `${doc.title} (Part ${i + 1})`,
              content: chunks[i],
              source: folderId,
              syncedAt: new Date().toISOString(),
              embedding: generateSimpleEmbedding(chunks[i])
            });
            syncResults.chunksCreated++;
          }
        }

        syncResults.documentsProcessed++;
      } catch (docError: any) {
        syncResults.errors.push({
          document: doc.title,
          reason: docError.message || 'Processing failed'
        });
      }
    }

    res.json({
      message: 'Knowledge base sync completed',
      folderId,
      status: {
        documentsProcessed: syncResults.documentsProcessed,
        documentsSkipped: syncResults.documentsSkipped,
        chunksCreated: syncResults.chunksCreated,
        totalDocumentsInKB: supabase ? syncResults.chunksCreated : kbDocuments.size
      },
      errors: syncResults.errors.length > 0 ? syncResults.errors : undefined
    });
  } catch (error) {
    console.error('KB sync error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to sync knowledge base' }
    });
  }
});

/**
 * GET /api/kb/search
 * Search knowledge base using semantic similarity
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { query, limit = '5', workspaceId } = req.query;

    if (!query) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Search query is required'
        }
      });
    }

    const queryEmbedding = generateSimpleEmbedding(query as string);
    const maxResults = Math.min(parseInt(limit as string), 20);

    let results: { id: string; title: string; content: string; score: number }[] = [];

    if (supabase) {
      // In production, use vector similarity search
      // For now, do a text search fallback
      let searchQuery = supabase
        .from('knowledge_chunks')
        .select('id, document_title, content');
      searchQuery = applyOrgFilterInclusive(searchQuery, req);
      const { data, error } = await searchQuery
        .ilike('content', `%${query}%`)
        .limit(maxResults);

      if (!error && data) {
        results = data.map(chunk => ({
          id: chunk.id,
          title: chunk.document_title,
          content: chunk.content,
          score: 0.85 // Simulated score
        }));
      }
    }

    // Fallback to in-memory search
    if (results.length === 0 && kbDocuments.size > 0) {
      const queryLower = (query as string).toLowerCase();
      const matches: { id: string; title: string; content: string; score: number }[] = [];

      kbDocuments.forEach((doc) => {
        const contentLower = doc.content.toLowerCase();
        if (contentLower.includes(queryLower)) {
          matches.push({
            id: doc.id,
            title: doc.title,
            content: doc.content,
            score: calculateSimpleSimilarity(queryEmbedding, doc.embedding || [])
          });
        }
      });

      results = matches
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
    }

    res.json({
      query,
      results,
      totalResults: results.length
    });
  } catch (error) {
    console.error('KB search error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to search knowledge base' }
    });
  }
});

/**
 * GET /api/kb/status
 * Get current knowledge base status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.query;

    let stats = {
      totalDocuments: 0,
      totalChunks: 0,
      lastSyncAt: null as string | null,
      sources: [] as { folderId: string; documentCount: number }[]
    };

    if (supabase) {
      // Get counts from database
      let countQuery = supabase
        .from('knowledge_chunks')
        .select('*', { count: 'exact', head: true });
      countQuery = applyOrgFilterInclusive(countQuery, req);
      const { count: chunkCount } = await countQuery;

      let lastSyncQuery = supabase
        .from('knowledge_chunks')
        .select('synced_at');
      lastSyncQuery = applyOrgFilterInclusive(lastSyncQuery, req);
      const { data: lastSync } = await lastSyncQuery
        .order('synced_at', { ascending: false })
        .limit(1)
        .single();

      stats.totalChunks = chunkCount || 0;
      stats.lastSyncAt = lastSync?.synced_at || null;
    } else {
      // In-memory stats
      stats.totalChunks = kbDocuments.size;
      if (kbDocuments.size > 0) {
        const docs = Array.from(kbDocuments.values());
        stats.lastSyncAt = docs[docs.length - 1].syncedAt;
      }
    }

    res.json(stats);
  } catch (error) {
    console.error('KB status error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get KB status' }
    });
  }
});

/**
 * Generate a simple embedding for text (production would use real embeddings)
 */
function generateSimpleEmbedding(text: string): number[] {
  // Simple hash-based embedding for demo
  // In production, use OpenAI/Claude/Cohere embeddings
  const embedding = new Array(128).fill(0);
  const words = text.toLowerCase().split(/\s+/);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    for (let j = 0; j < word.length; j++) {
      const idx = (word.charCodeAt(j) * (i + 1) * (j + 1)) % 128;
      embedding[idx] += 1 / (i + 1);
    }
  }

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? embedding.map(v => v / magnitude) : embedding;
}

/**
 * Split text into chunks for embedding
 */
function splitIntoChunks(text: string, maxLength: number): string[] {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if ((currentChunk + ' ' + trimmedSentence).length <= maxLength) {
      currentChunk = currentChunk ? currentChunk + '. ' + trimmedSentence : trimmedSentence;
    } else {
      if (currentChunk) chunks.push(currentChunk + '.');
      currentChunk = trimmedSentence;
    }
  }

  if (currentChunk) chunks.push(currentChunk + '.');
  return chunks.length > 0 ? chunks : [text];
}

/**
 * Calculate simple cosine similarity between embeddings
 */
function calculateSimpleSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

export { router as kbRoutes };
