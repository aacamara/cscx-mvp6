/**
 * Playbooks API Routes
 * Provides access to CSM playbooks and executions
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';

const router = Router();
const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);

/**
 * GET /api/playbooks
 * Get all active playbooks
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type } = req.query;

    let query = supabase
      .from('playbooks')
      .select('*')
      .eq('is_active', true);

    if (type) query = query.eq('type', type as string);

    const { data, error } = await query.order('name');
    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Playbooks error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/playbooks/csm
 * Get all CSM playbooks (knowledge base)
 * NOTE: This route MUST be before /:id to avoid being caught by the UUID matcher
 */
router.get('/csm', async (req: Request, res: Response) => {
  try {
    const { category } = req.query;

    let query = supabase
      .from('csm_playbooks')
      .select('id, category, subcategory, title, summary, use_cases, tags, created_at');

    if (category) query = query.eq('category', category as string);

    const { data, error } = await query.order('category').order('title');
    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('CSM playbooks error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/playbooks/csm/search
 * Semantic search across CSM playbooks
 * NOTE: This route MUST be before /:id to avoid being caught by the UUID matcher
 */
router.get('/csm/search', async (req: Request, res: Response) => {
  try {
    const { q, category, limit = 5 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    if (!config.geminiApiKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is required for semantic search' });
    }

    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

    // Generate embedding for the query
    const result = await embeddingModel.embedContent(q as string);
    const queryEmbedding = result.embedding.values;

    // Call the search_knowledge RPC function (uses pgvector)
    const { data, error } = await supabase.rpc('search_csm_playbooks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: parseInt(limit as string, 10),
      filter_category: category || null
    });

    if (error) {
      // If RPC doesn't exist, fall back to basic search
      if (error.code === '42883') {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('csm_playbooks')
          .select('id, category, title, summary, content')
          .ilike('content', `%${q}%`)
          .limit(parseInt(limit as string, 10));

        if (fallbackError) throw fallbackError;
        return res.json(fallbackData);
      }
      throw error;
    }

    res.json(data);
  } catch (error) {
    console.error('CSM playbooks search error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/playbooks/csm/generate-embeddings
 * Generate embeddings for all CSM playbooks that don't have them
 * NOTE: This route MUST be before /:id to avoid being caught by the UUID matcher
 */
router.post('/csm/generate-embeddings', async (req: Request, res: Response) => {
  try {
    if (!config.geminiApiKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY is required for embedding generation' });
    }

    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

    // Fetch all playbooks without embeddings
    const { data: playbooks, error: fetchError } = await supabase
      .from('csm_playbooks')
      .select('id, title, content, summary, category')
      .is('embedding', null);

    if (fetchError) {
      return res.status(500).json({ error: `Failed to fetch playbooks: ${fetchError.message}` });
    }

    if (!playbooks || playbooks.length === 0) {
      return res.json({ message: 'All playbooks already have embeddings', successCount: 0, errorCount: 0 });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const playbook of playbooks) {
      try {
        // Create text for embedding (title + summary + truncated content)
        const textForEmbedding = [
          playbook.title,
          playbook.summary || '',
          playbook.category,
          playbook.content.substring(0, 8000) // Limit content length
        ].join('\n\n');

        // Generate embedding
        const result = await embeddingModel.embedContent(textForEmbedding);
        const embedding = result.embedding.values;

        // Update playbook with embedding
        const { error: updateError } = await supabase
          .from('csm_playbooks')
          .update({ embedding: `[${embedding.join(',')}]` })
          .eq('id', playbook.id);

        if (updateError) {
          errors.push(`${playbook.title}: ${updateError.message}`);
          errorCount++;
        } else {
          successCount++;
        }

        // Rate limiting - avoid hitting API limits
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err) {
        errors.push(`${playbook.title}: ${(err as Error).message}`);
        errorCount++;
      }
    }

    res.json({
      message: `Embedding generation complete`,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Embedding generation error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/playbooks/code/:code
 * Get playbook by code (e.g., PB-ONB)
 */
router.get('/code/:code', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('playbooks')
      .select('*')
      .eq('code', req.params.code)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Playbook by code error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/playbooks/executions/active
 * Get all active playbook executions
 * NOTE: Must be before /:id to avoid being caught by UUID matcher
 */
router.get('/executions/active', async (req: Request, res: Response) => {
  try {
    const { customer_id } = req.query;

    let query = supabase
      .from('playbook_executions')
      .select(`
        *,
        playbooks (id, name, code, phases),
        customers (id, name)
      `)
      .eq('status', 'active');

    if (customer_id) query = query.eq('customer_id', customer_id as string);

    const { data, error } = await query.order('started_at', { ascending: false });
    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Active executions error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/playbooks/:id
 * Get single playbook with details
 * NOTE: This route uses :id param, so it MUST be after all static routes like /csm, /code/:code, /executions/active
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('playbooks')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Playbook lookup error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/playbooks/:id/execute
 * Start a playbook execution for a customer
 */
router.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const { customer_id, cta_id } = req.body;

    if (!customer_id) {
      return res.status(400).json({ error: 'customer_id is required' });
    }

    const { data, error } = await supabase
      .from('playbook_executions')
      .insert({
        playbook_id: req.params.id,
        customer_id,
        cta_id,
        current_phase: 1,
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Playbook execution error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/playbooks/executions/:id/progress
 * Update playbook execution progress
 */
router.put('/executions/:id/progress', async (req: Request, res: Response) => {
  try {
    const { current_phase, progress, status } = req.body;

    const updates: any = {};
    if (current_phase !== undefined) updates.current_phase = current_phase;
    if (progress !== undefined) updates.progress = progress;
    if (status !== undefined) {
      updates.status = status;
      if (status === 'completed') updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('playbook_executions')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Update execution error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as playbooksRoutes };
