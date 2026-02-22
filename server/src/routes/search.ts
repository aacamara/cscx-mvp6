/**
 * Universal Search Routes
 * PRD-219: AI-Powered Universal Search
 *
 * API endpoints for searching across all data types including
 * customers, stakeholders, emails, meetings, documents, and more.
 */

import { Router, Request, Response } from 'express';
import { universalSearchService } from '../services/universalSearch.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

/**
 * GET /api/search
 * Main search endpoint - searches across all data types
 *
 * Query params:
 * - q: Search query (required)
 * - type: Filter by type (optional, comma-separated for multiple)
 * - customer_id: Filter by customer (optional)
 * - from: Start date ISO string (optional)
 * - to: End date ISO string (optional)
 * - limit: Max results (default 20, max 100)
 * - offset: Pagination offset (default 0)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      q,
      type,
      customer_id,
      from,
      to,
      limit = '20',
      offset = '0'
    } = req.query;

    // Validate query
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_QUERY',
          message: 'Search query (q) is required'
        }
      });
    }

    // Parse parameters
    const parsedLimit = Math.min(Math.max(parseInt(limit as string) || 20, 1), 100);
    const parsedOffset = Math.max(parseInt(offset as string) || 0, 0);

    // Get user ID from auth header or use demo user
    const userId = req.headers['x-user-id'] as string || 'demo-user';

    // Build search options
    const searchOptions = {
      userId,
      limit: parsedLimit,
      offset: parsedOffset
    };

    // Execute search
    const startTime = Date.now();
    const { results, parsed, total, suggestions } = await universalSearchService.search(
      q.trim(),
      searchOptions
    );

    // Build filters applied object
    const filtersApplied: Record<string, string | string[]> = {};
    if (type) {
      const types = (type as string).split(',').map(t => t.trim());
      parsed.filters.type = types;
      filtersApplied.type = types;
    }
    if (customer_id) {
      parsed.filters.customer_id = customer_id as string;
      filtersApplied.customer_id = customer_id as string;
    }
    if (from || to) {
      parsed.filters.date_range = {
        from: from as string || null,
        to: to as string || null
      };
      if (from) filtersApplied.from = from as string;
      if (to) filtersApplied.to = to as string;
    }

    // Save search to history (async, don't wait)
    universalSearchService.saveSearch(userId, q.trim(), parsed.filters).catch(err => {
      console.error('Failed to save search history:', err);
    });

    // Return response
    res.json({
      query: q.trim(),
      parsed,
      results,
      total,
      suggestions,
      filters_applied: filtersApplied,
      search_time_ms: Date.now() - startTime,
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        has_more: parsedOffset + results.length < total
      }
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: {
        code: 'SEARCH_ERROR',
        message: error instanceof Error ? error.message : 'Search failed'
      }
    });
  }
});

/**
 * GET /api/search/suggest
 * Get search suggestions as user types
 *
 * Query params:
 * - q: Partial query (required)
 * - limit: Max suggestions (default 8, max 20)
 */
router.get('/suggest', async (req: Request, res: Response) => {
  try {
    const { q, limit = '8' } = req.query;

    // Get user ID from auth header or use demo user
    const userId = req.headers['x-user-id'] as string || 'demo-user';

    const parsedLimit = Math.min(Math.max(parseInt(limit as string) || 8, 1), 20);

    // Get suggestions
    const suggestions = await universalSearchService.suggest(
      (q as string)?.trim() || '',
      userId,
      parsedLimit
    );

    res.json({ suggestions });
  } catch (error) {
    console.error('Suggest error:', error);
    res.status(500).json({
      error: {
        code: 'SUGGEST_ERROR',
        message: 'Failed to generate suggestions'
      }
    });
  }
});

/**
 * GET /api/search/recent
 * Get recent searches for the user
 *
 * Query params:
 * - limit: Max results (default 10, max 50)
 */
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const { limit = '10' } = req.query;
    const userId = req.headers['x-user-id'] as string || 'demo-user';
    const parsedLimit = Math.min(Math.max(parseInt(limit as string) || 10, 1), 50);

    const recentSearches = await universalSearchService.getRecentSearches(userId, parsedLimit);

    res.json({ searches: recentSearches });
  } catch (error) {
    console.error('Recent searches error:', error);
    res.status(500).json({
      error: {
        code: 'RECENT_SEARCHES_ERROR',
        message: 'Failed to get recent searches'
      }
    });
  }
});

/**
 * GET /api/search/saved
 * Get saved searches for the user
 */
router.get('/saved', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'demo-user';

    const savedSearches = await universalSearchService.getSavedSearches(userId);

    res.json({ searches: savedSearches });
  } catch (error) {
    console.error('Saved searches error:', error);
    res.status(500).json({
      error: {
        code: 'SAVED_SEARCHES_ERROR',
        message: 'Failed to get saved searches'
      }
    });
  }
});

/**
 * POST /api/search/saved
 * Save a search as a favorite
 *
 * Body:
 * - search_id: ID of the search to save (from recent searches)
 * - name: Display name for the saved search
 */
router.post('/saved', async (req: Request, res: Response) => {
  try {
    const { search_id, name } = req.body;
    const userId = req.headers['x-user-id'] as string || 'demo-user';

    if (!search_id || !name) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'search_id and name are required'
        }
      });
    }

    await universalSearchService.saveSearchAsFavorite(userId, search_id, name);

    res.json({ success: true, message: 'Search saved successfully' });
  } catch (error) {
    console.error('Save search error:', error);
    res.status(500).json({
      error: {
        code: 'SAVE_SEARCH_ERROR',
        message: 'Failed to save search'
      }
    });
  }
});

/**
 * DELETE /api/search/saved/:id
 * Delete a saved search
 */
router.delete('/saved/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string || 'demo-user';

    await universalSearchService.deleteSavedSearch(userId, id);

    res.json({ success: true, message: 'Search deleted successfully' });
  } catch (error) {
    console.error('Delete search error:', error);
    res.status(500).json({
      error: {
        code: 'DELETE_SEARCH_ERROR',
        message: 'Failed to delete search'
      }
    });
  }
});

/**
 * POST /api/search/index
 * Index a document for search (internal/admin endpoint)
 *
 * Body:
 * - source_type: Type of document (customer, email, meeting, etc.)
 * - source_id: Original document ID
 * - user_id: Owner user ID
 * - customer_id: Associated customer ID (optional)
 * - title: Document title
 * - content: Document content to index
 * - metadata: Additional metadata (optional)
 */
router.post('/index', async (req: Request, res: Response) => {
  try {
    const {
      source_type,
      source_id,
      user_id,
      customer_id,
      title,
      content,
      metadata
    } = req.body;

    // Validate required fields
    if (!source_type || !source_id || !user_id || !title || !content) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'source_type, source_id, user_id, title, and content are required'
        }
      });
    }

    const indexId = await universalSearchService.indexDocument({
      source_type,
      source_id,
      user_id,
      customer_id,
      title,
      content,
      metadata
    });

    if (!indexId) {
      return res.status(500).json({
        error: {
          code: 'INDEX_ERROR',
          message: 'Failed to index document'
        }
      });
    }

    res.status(201).json({
      success: true,
      id: indexId,
      message: 'Document indexed successfully'
    });
  } catch (error) {
    console.error('Index error:', error);
    res.status(500).json({
      error: {
        code: 'INDEX_ERROR',
        message: error instanceof Error ? error.message : 'Failed to index document'
      }
    });
  }
});

/**
 * POST /api/search/index/bulk
 * Bulk index multiple documents
 *
 * Body:
 * - documents: Array of documents to index (same format as /index)
 */
router.post('/index/bulk', async (req: Request, res: Response) => {
  try {
    const { documents } = req.body;

    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'documents array is required'
        }
      });
    }

    // Limit bulk operations
    if (documents.length > 100) {
      return res.status(400).json({
        error: {
          code: 'TOO_MANY_DOCUMENTS',
          message: 'Maximum 100 documents per bulk request'
        }
      });
    }

    const result = await universalSearchService.bulkIndex(documents);

    res.json({
      success: true,
      indexed: result.indexed,
      failed: result.failed,
      message: `Indexed ${result.indexed} documents, ${result.failed} failed`
    });
  } catch (error) {
    console.error('Bulk index error:', error);
    res.status(500).json({
      error: {
        code: 'BULK_INDEX_ERROR',
        message: error instanceof Error ? error.message : 'Failed to bulk index documents'
      }
    });
  }
});

export { router as searchRoutes };
