/**
 * Customer Journey Timeline Routes (PRD-062)
 *
 * API endpoints for customer journey timeline, stakeholder engagement,
 * and activity tracking.
 *
 * Endpoints:
 * - GET  /api/intelligence/timeline/:customerId - Get full customer journey
 * - GET  /api/intelligence/timeline/:customerId/events - Get timeline events (paginated)
 * - POST /api/intelligence/timeline/:customerId/events - Create timeline event
 * - GET  /api/intelligence/timeline/:customerId/milestones - Get milestones
 * - GET  /api/intelligence/timeline/:customerId/health-history - Get health score history
 * - GET  /api/intelligence/timeline/:customerId/stakeholder-engagement - Get stakeholder engagement
 * - GET  /api/intelligence/timeline/:customerId/heatmap - Get activity heatmap
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';
import { customerTimelineService, TimelineFilters } from '../services/customerTimeline.js';

const router = Router();

// Initialize Supabase client for org validation
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

/**
 * Validate that a customer belongs to the user's organization.
 * CRITICAL: Prevents cross-org data access.
 */
async function validateCustomerOrg(customerId: string, req: Request): Promise<boolean> {
  if (!supabase) return true; // Dev/demo mode - no validation

  let query = supabase.from('customers').select('id').eq('id', customerId).single();
  query = applyOrgFilter(query, req);

  const { data, error } = await query;
  return !error && !!data;
}

/**
 * GET /api/intelligence/timeline/:customerId
 *
 * Get comprehensive customer journey timeline with all data.
 *
 * Query Parameters:
 * - startDate: Filter events after this date (ISO)
 * - endDate: Filter events before this date (ISO)
 * - types: Comma-separated event types
 * - categories: Comma-separated event categories
 * - includeInternal: Include internal notes (default: true)
 * - search: Search query for event content
 * - limit: Max events per page (default: 50)
 * - offset: Pagination offset (default: 0)
 */
router.get('/:customerId', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { customerId } = req.params;
    const {
      startDate,
      endDate,
      types,
      categories,
      includeInternal,
      search,
      limit,
      offset
    } = req.query;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required'
        }
      });
    }

    // CRITICAL: Validate customer belongs to user's organization
    const isAuthorized = await validateCustomerOrg(customerId, req);
    if (!isAuthorized) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: `Could not find customer with ID '${customerId}'`
        }
      });
    }

    const filters: TimelineFilters = {};

    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;
    if (types) filters.eventTypes = (types as string).split(',') as any;
    if (categories) filters.eventCategories = (categories as string).split(',') as any;
    if (includeInternal !== undefined) filters.includeInternal = includeInternal !== 'false';
    if (search) filters.searchQuery = search as string;
    if (limit) filters.limit = parseInt(limit as string);
    if (offset) filters.offset = parseInt(offset as string);

    const journey = await customerTimelineService.getCustomerJourney(customerId, filters);

    if (!journey) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: `Could not find customer with ID '${customerId}'`
        }
      });
    }

    const responseTime = Date.now() - startTime;

    console.log(`[Timeline] Journey generated for ${journey.customer.name} in ${responseTime}ms`);

    // Warn if over 2 second target
    if (responseTime > 2000) {
      console.warn(`[Timeline] Journey generation exceeded 2s target: ${responseTime}ms`);
    }

    return res.json({
      success: true,
      data: journey,
      meta: {
        generatedAt: journey.generatedAt,
        responseTimeMs: responseTime,
        dataCompleteness: journey.dataCompleteness
      }
    });
  } catch (error) {
    console.error('[Timeline] Error getting customer journey:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get customer journey timeline'
      }
    });
  }
});

/**
 * GET /api/intelligence/timeline/:customerId/events
 *
 * Get timeline events only (for incremental loading).
 *
 * Query Parameters:
 * - startDate, endDate, types, categories, includeInternal, search
 * - limit: Max events (default: 50)
 * - offset: Pagination offset
 */
router.get('/:customerId/events', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const {
      startDate,
      endDate,
      types,
      categories,
      includeInternal,
      search,
      limit,
      offset
    } = req.query;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required'
        }
      });
    }

    // CRITICAL: Validate customer belongs to user's organization
    const isAuthorized = await validateCustomerOrg(customerId, req);
    if (!isAuthorized) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: `Could not find customer with ID '${customerId}'`
        }
      });
    }

    const filters: TimelineFilters = {};

    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;
    if (types) filters.eventTypes = (types as string).split(',') as any;
    if (categories) filters.eventCategories = (categories as string).split(',') as any;
    if (includeInternal !== undefined) filters.includeInternal = includeInternal !== 'false';
    if (search) filters.searchQuery = search as string;
    if (limit) filters.limit = parseInt(limit as string);
    if (offset) filters.offset = parseInt(offset as string);

    const result = await customerTimelineService.getTimelineEvents(customerId, filters);

    return res.json({
      success: true,
      data: {
        events: result.events,
        pagination: {
          total: result.total,
          hasMore: result.hasMore,
          limit: filters.limit || 50,
          offset: filters.offset || 0
        }
      }
    });
  } catch (error) {
    console.error('[Timeline] Error getting events:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get timeline events'
      }
    });
  }
});

/**
 * POST /api/intelligence/timeline/:customerId/events
 *
 * Create a new timeline event.
 *
 * Request Body:
 * - eventType (required): Type of event
 * - eventCategory (required): Category of event
 * - title (required): Event title
 * - description: Event description
 * - occurredAt (required): When the event occurred (ISO)
 * - durationMinutes: Duration if applicable
 * - participants: Array of participants
 * - sourceType (required): Source system
 * - sourceId: External ID
 * - sourceUrl: Link to source
 * - sentiment: positive/neutral/negative
 * - importance: high/normal/low
 * - isMilestone: boolean
 * - tags: Array of tags
 * - isInternal: boolean
 */
router.post('/:customerId/events', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const {
      eventType,
      eventCategory,
      title,
      description,
      occurredAt,
      durationMinutes,
      participants,
      sourceType,
      sourceId,
      sourceUrl,
      sentiment,
      importance,
      isMilestone,
      tags,
      isInternal
    } = req.body;

    // Validation
    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CUSTOMER_ID', message: 'Customer ID is required' }
      });
    }

    // CRITICAL: Validate customer belongs to user's organization before creating event
    const isAuthorized = await validateCustomerOrg(customerId, req);
    if (!isAuthorized) {
      return res.status(404).json({
        success: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found or access denied' }
      });
    }

    if (!eventType || !eventCategory || !title || !occurredAt || !sourceType) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'eventType, eventCategory, title, occurredAt, and sourceType are required'
        }
      });
    }

    const event = await customerTimelineService.createEvent({
      customerId,
      eventType,
      eventCategory,
      title,
      description,
      occurredAt,
      durationMinutes,
      participants,
      sourceType,
      sourceId,
      sourceUrl,
      sentiment: sentiment || 'neutral',
      importance: importance || 'normal',
      isMilestone: isMilestone || false,
      tags,
      isInternal: isInternal || false
    });

    if (!event) {
      return res.status(500).json({
        success: false,
        error: { code: 'CREATE_FAILED', message: 'Failed to create timeline event' }
      });
    }

    return res.status(201).json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('[Timeline] Error creating event:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create timeline event'
      }
    });
  }
});

/**
 * GET /api/intelligence/timeline/:customerId/stats
 *
 * Get timeline statistics summary.
 */
router.get('/:customerId/stats', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { startDate, endDate } = req.query;

    // CRITICAL: Validate customer belongs to user's organization
    const isAuthorized = await validateCustomerOrg(customerId, req);
    if (!isAuthorized) {
      return res.status(404).json({
        success: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' }
      });
    }

    const filters: TimelineFilters = {};
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;

    const journey = await customerTimelineService.getCustomerJourney(customerId, filters);

    if (!journey) {
      return res.status(404).json({
        success: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' }
      });
    }

    return res.json({
      success: true,
      data: {
        stats: journey.stats,
        stakeholderEngagement: journey.stakeholderEngagement,
        dataCompleteness: journey.dataCompleteness
      }
    });
  } catch (error) {
    console.error('[Timeline] Error getting stats:', error);

    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get timeline stats' }
    });
  }
});

/**
 * GET /api/intelligence/timeline/:customerId/milestones
 *
 * Get customer milestones.
 */
router.get('/:customerId/milestones', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    // CRITICAL: Validate customer belongs to user's organization
    const isAuthorized = await validateCustomerOrg(customerId, req);
    if (!isAuthorized) {
      return res.status(404).json({
        success: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' }
      });
    }

    const journey = await customerTimelineService.getCustomerJourney(customerId, {});

    if (!journey) {
      return res.status(404).json({
        success: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' }
      });
    }

    return res.json({
      success: true,
      data: {
        milestones: journey.milestones,
        contractEvents: journey.highlights.contractEvents
      }
    });
  } catch (error) {
    console.error('[Timeline] Error getting milestones:', error);

    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get milestones' }
    });
  }
});

/**
 * GET /api/intelligence/timeline/:customerId/health-history
 *
 * Get health score history for charting.
 */
router.get('/:customerId/health-history', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    // CRITICAL: Validate customer belongs to user's organization
    const isAuthorized = await validateCustomerOrg(customerId, req);
    if (!isAuthorized) {
      return res.status(404).json({
        success: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' }
      });
    }

    const journey = await customerTimelineService.getCustomerJourney(customerId, {});

    if (!journey) {
      return res.status(404).json({
        success: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' }
      });
    }

    return res.json({
      success: true,
      data: {
        healthHistory: journey.healthHistory,
        currentScore: journey.customer.healthScore
      }
    });
  } catch (error) {
    console.error('[Timeline] Error getting health history:', error);

    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get health history' }
    });
  }
});

/**
 * GET /api/intelligence/timeline/:customerId/stakeholder-engagement
 *
 * Get stakeholder engagement metrics.
 */
router.get('/:customerId/stakeholder-engagement', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    // CRITICAL: Validate customer belongs to user's organization
    const isAuthorized = await validateCustomerOrg(customerId, req);
    if (!isAuthorized) {
      return res.status(404).json({
        success: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' }
      });
    }

    const journey = await customerTimelineService.getCustomerJourney(customerId, {});

    if (!journey) {
      return res.status(404).json({
        success: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' }
      });
    }

    return res.json({
      success: true,
      data: {
        stakeholders: journey.stakeholderEngagement,
        totalStakeholders: journey.stakeholderEngagement.length
      }
    });
  } catch (error) {
    console.error('[Timeline] Error getting stakeholder engagement:', error);

    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get stakeholder engagement' }
    });
  }
});

/**
 * GET /api/intelligence/timeline/:customerId/heatmap
 *
 * Get activity heatmap data.
 */
router.get('/:customerId/heatmap', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    // CRITICAL: Validate customer belongs to user's organization
    const isAuthorized = await validateCustomerOrg(customerId, req);
    if (!isAuthorized) {
      return res.status(404).json({
        success: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' }
      });
    }

    const journey = await customerTimelineService.getCustomerJourney(customerId, {});

    if (!journey) {
      return res.status(404).json({
        success: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' }
      });
    }

    return res.json({
      success: true,
      data: {
        heatmap: journey.activityHeatmap
      }
    });
  } catch (error) {
    console.error('[Timeline] Error getting heatmap:', error);

    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get activity heatmap' }
    });
  }
});

export default router;
