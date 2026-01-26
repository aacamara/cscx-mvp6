/**
 * Glossary & Playbooks API Routes
 * Provides access to CSM terminology and playbooks
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

const router = Router();
const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);

/**
 * GET /api/glossary
 * Get all glossary terms
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, search } = req.query;

    let query = supabase.from('glossary').select('*');

    if (category) query = query.eq('category', category as string);
    if (search) query = query.or(`term.ilike.%${search}%,abbreviation.ilike.%${search}%,definition.ilike.%${search}%`);

    const { data, error } = await query.order('term');
    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Glossary error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/glossary/categories
 * Get all glossary categories
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('glossary')
      .select('category');

    if (error) throw error;

    const categories = [...new Set(data.map(d => d.category).filter(Boolean))].sort();
    res.json(categories);
  } catch (error) {
    console.error('Categories error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/glossary/:term
 * Get single glossary term
 */
router.get('/:term', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('glossary')
      .select('*')
      .or(`term.eq.${req.params.term},abbreviation.eq.${req.params.term}`)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Term lookup error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as glossaryRoutes };
