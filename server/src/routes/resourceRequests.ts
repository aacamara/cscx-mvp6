/**
 * Resource Requests API Routes
 * PRD-245: Endpoints for technical resource request management
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { resourceMatchingService, ResourceMatchScore } from '../services/resourceMatching.js';

const router = Router();

// Initialize Supabase client if configured
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// In-memory store for development
// ============================================

interface ResourceRequest {
  id: string;
  customer_id: string;
  requested_by_user_id: string;
  engagement_type: string;
  title: string;
  description?: string;
  customer_context?: string;
  required_skills: string[];
  preferred_skills: string[];
  estimated_hours?: number;
  start_date?: string;
  end_date?: string;
  urgency: string;
  flexibility: string;
  status: string;
  assigned_resource_id?: string;
  assigned_by_user_id?: string;
  assigned_at?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  calendar_event_ids: string[];
  meeting_links: { title: string; url: string }[];
  actual_hours?: number;
  outcome_summary?: string;
  deliverables: { name: string; url?: string; type: string }[];
  csm_rating?: number;
  csm_feedback?: string;
  resource_rating?: number;
  resource_feedback?: string;
  completed_at?: string;
  priority_score: number;
  match_metadata?: object;
  created_at: string;
  updated_at: string;
}

interface ResourceEngagement {
  id: string;
  request_id: string;
  resource_user_id: string;
  date: string;
  hours_logged: number;
  activity_type: string;
  notes?: string;
  billable: boolean;
  created_at: string;
}

interface RequestHistory {
  id: string;
  request_id: string;
  changed_by_user_id?: string;
  action: string;
  old_values: object;
  new_values: object;
  notes?: string;
  created_at: string;
}

// In-memory stores
const requestsStore: Map<string, ResourceRequest> = new Map();
const engagementsStore: Map<string, ResourceEngagement[]> = new Map();
const historyStore: Map<string, RequestHistory[]> = new Map();

// Helper to add history entry
function addHistoryEntry(
  requestId: string,
  action: string,
  userId?: string,
  oldValues: object = {},
  newValues: object = {},
  notes?: string
) {
  const entry: RequestHistory = {
    id: uuidv4(),
    request_id: requestId,
    changed_by_user_id: userId,
    action,
    old_values: oldValues,
    new_values: newValues,
    notes,
    created_at: new Date().toISOString()
  };

  const existing = historyStore.get(requestId) || [];
  existing.push(entry);
  historyStore.set(requestId, existing);

  return entry;
}

// ============================================
// Resource Requests CRUD
// ============================================

/**
 * POST /api/resource-requests
 * Create a new resource request
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      customer_id,
      engagement_type,
      title,
      description,
      customer_context,
      required_skills = [],
      preferred_skills = [],
      estimated_hours,
      start_date,
      end_date,
      urgency = 'normal',
      flexibility = 'flexible_week'
    } = req.body;

    // Validation
    if (!customer_id || !engagement_type || !title) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'customer_id, engagement_type, and title are required'
        }
      });
    }

    // Calculate priority score based on urgency
    const priorityScores: Record<string, number> = {
      critical: 100,
      high: 75,
      normal: 50,
      low: 25
    };

    const request: ResourceRequest = {
      id: uuidv4(),
      customer_id,
      requested_by_user_id: req.body.requested_by_user_id || 'current-user',
      engagement_type,
      title,
      description,
      customer_context,
      required_skills,
      preferred_skills,
      estimated_hours,
      start_date,
      end_date,
      urgency,
      flexibility,
      status: 'pending',
      calendar_event_ids: [],
      meeting_links: [],
      deliverables: [],
      priority_score: priorityScores[urgency] || 50,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('resource_requests')
        .insert({
          ...request,
          calendar_event_ids: JSON.stringify([]),
          meeting_links: JSON.stringify([]),
          deliverables: JSON.stringify([])
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        // Fall through to in-memory
      } else {
        // Add history entry
        if (supabase) {
          await supabase.from('resource_request_history').insert({
            request_id: data.id,
            changed_by_user_id: request.requested_by_user_id,
            action: 'created',
            new_values: { title, engagement_type, urgency }
          });
        }

        return res.status(201).json(data);
      }
    }

    // In-memory fallback
    requestsStore.set(request.id, request);
    addHistoryEntry(request.id, 'created', request.requested_by_user_id, {}, {
      title,
      engagement_type,
      urgency
    });

    res.status(201).json(request);
  } catch (error) {
    console.error('Create resource request error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create resource request' }
    });
  }
});

/**
 * GET /api/resource-requests
 * List resource requests with filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      status,
      urgency,
      engagement_type,
      customer_id,
      assigned_resource_id,
      requested_by_user_id,
      date_from,
      date_to,
      search,
      sort_by = 'created_at',
      sort_order = 'desc',
      page = '1',
      limit = '20'
    } = req.query;

    if (supabase) {
      let query = supabase
        .from('resource_requests')
        .select(`
          *,
          customers (id, name),
          requester:user_profiles!resource_requests_requested_by_user_id_fkey (id, full_name),
          assigned:user_profiles!resource_requests_assigned_resource_id_fkey (id, full_name)
        `);

      // Apply filters
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      if (urgency && urgency !== 'all') {
        query = query.eq('urgency', urgency);
      }
      if (engagement_type && engagement_type !== 'all') {
        query = query.eq('engagement_type', engagement_type);
      }
      if (customer_id) {
        query = query.eq('customer_id', customer_id);
      }
      if (assigned_resource_id) {
        query = query.eq('assigned_resource_id', assigned_resource_id);
      }
      if (requested_by_user_id) {
        query = query.eq('requested_by_user_id', requested_by_user_id);
      }
      if (date_from) {
        query = query.gte('start_date', date_from);
      }
      if (date_to) {
        query = query.lte('end_date', date_to);
      }
      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      // Sort
      const orderColumn = sort_by as string;
      query = query.order(orderColumn, { ascending: sort_order === 'asc' });

      // Paginate
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const startIndex = (pageNum - 1) * limitNum;
      query = query.range(startIndex, startIndex + limitNum - 1);

      const { data, error } = await query;

      if (!error && data) {
        // Get total count
        let countQuery = supabase.from('resource_requests').select('*', { count: 'exact', head: true });
        if (status && status !== 'all') countQuery = countQuery.eq('status', status);
        const { count } = await countQuery;

        return res.json({
          requests: data.map((r: any) => ({
            ...r,
            customer_name: r.customers?.name,
            requested_by_name: r.requester?.full_name,
            assigned_resource_name: r.assigned?.full_name
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: count || data.length,
            totalPages: Math.ceil((count || data.length) / limitNum)
          }
        });
      }
    }

    // In-memory fallback
    let results = Array.from(requestsStore.values());

    // Apply filters
    if (status && status !== 'all') {
      results = results.filter(r => r.status === status);
    }
    if (urgency && urgency !== 'all') {
      results = results.filter(r => r.urgency === urgency);
    }
    if (engagement_type && engagement_type !== 'all') {
      results = results.filter(r => r.engagement_type === engagement_type);
    }
    if (customer_id) {
      results = results.filter(r => r.customer_id === customer_id);
    }
    if (search) {
      const searchLower = (search as string).toLowerCase();
      results = results.filter(r =>
        r.title.toLowerCase().includes(searchLower) ||
        r.description?.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    results.sort((a, b) => {
      const aVal = a[sort_by as keyof ResourceRequest] || '';
      const bVal = b[sort_by as keyof ResourceRequest] || '';
      if (sort_order === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    // Paginate
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedResults = results.slice(startIndex, startIndex + limitNum);

    res.json({
      requests: paginatedResults,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: results.length,
        totalPages: Math.ceil(results.length / limitNum)
      }
    });
  } catch (error) {
    console.error('List resource requests error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list resource requests' }
    });
  }
});

/**
 * GET /api/resource-requests/:id
 * Get a single resource request
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (supabase) {
      const { data, error } = await supabase
        .from('resource_requests')
        .select(`
          *,
          customers (id, name, industry, arr),
          requester:user_profiles!resource_requests_requested_by_user_id_fkey (id, full_name, email),
          assigned:user_profiles!resource_requests_assigned_resource_id_fkey (id, full_name, email)
        `)
        .eq('id', id)
        .single();

      if (!error && data) {
        return res.json({
          ...data,
          customer_name: data.customers?.name,
          requested_by_name: data.requester?.full_name,
          assigned_resource_name: data.assigned?.full_name
        });
      }
    }

    // In-memory fallback
    const request = requestsStore.get(id);
    if (!request) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Resource request not found' }
      });
    }

    res.json(request);
  } catch (error) {
    console.error('Get resource request error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get resource request' }
    });
  }
});

/**
 * PATCH /api/resource-requests/:id
 * Update a resource request
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (supabase) {
      // Get current values for history
      const { data: current } = await supabase
        .from('resource_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (current) {
        const { data, error } = await supabase
          .from('resource_requests')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          // Add history entry
          await supabase.from('resource_request_history').insert({
            request_id: id,
            changed_by_user_id: req.body.updated_by_user_id,
            action: 'updated',
            old_values: current,
            new_values: updates
          });

          return res.json(data);
        }
      }
    }

    // In-memory fallback
    const request = requestsStore.get(id);
    if (!request) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Resource request not found' }
      });
    }

    const oldValues = { ...request };
    const updatedRequest = {
      ...request,
      ...updates,
      updated_at: new Date().toISOString()
    };

    requestsStore.set(id, updatedRequest);
    addHistoryEntry(id, 'updated', req.body.updated_by_user_id, oldValues, updates);

    res.json(updatedRequest);
  } catch (error) {
    console.error('Update resource request error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update resource request' }
    });
  }
});

// ============================================
// Resource Matching
// ============================================

/**
 * GET /api/resource-requests/:id/matches
 * Get matching resources for a request
 */
router.get('/:id/matches', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get the request
    let request: any;

    if (supabase) {
      const { data } = await supabase
        .from('resource_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (data) {
        request = data;
      }
    }

    if (!request) {
      request = requestsStore.get(id);
    }

    if (!request) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Resource request not found' }
      });
    }

    // Find matching resources
    const matches = await resourceMatchingService.findMatchingResources({
      id: request.id,
      customer_id: request.customer_id,
      engagement_type: request.engagement_type,
      required_skills: request.required_skills || [],
      preferred_skills: request.preferred_skills || [],
      estimated_hours: request.estimated_hours,
      start_date: request.start_date,
      end_date: request.end_date,
      urgency: request.urgency
    });

    res.json({
      request_id: id,
      matches,
      matched_at: new Date().toISOString(),
      algorithm_version: '1.0.0'
    });
  } catch (error) {
    console.error('Get resource matches error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get resource matches' }
    });
  }
});

/**
 * POST /api/resource-requests/:id/assign
 * Assign a resource to a request
 */
router.post('/:id/assign', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resource_user_id, assigned_by_user_id, notes } = req.body;

    if (!resource_user_id) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'resource_user_id is required' }
      });
    }

    const updates = {
      assigned_resource_id: resource_user_id,
      assigned_by_user_id,
      assigned_at: new Date().toISOString(),
      status: 'assigned'
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('resource_requests')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        await supabase.from('resource_request_history').insert({
          request_id: id,
          changed_by_user_id: assigned_by_user_id,
          action: 'assigned',
          new_values: { assigned_resource_id: resource_user_id },
          notes
        });

        return res.json(data);
      }
    }

    // In-memory fallback
    const request = requestsStore.get(id);
    if (!request) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Resource request not found' }
      });
    }

    const updatedRequest = { ...request, ...updates, updated_at: new Date().toISOString() };
    requestsStore.set(id, updatedRequest);
    addHistoryEntry(id, 'assigned', assigned_by_user_id, {}, updates, notes);

    res.json(updatedRequest);
  } catch (error) {
    console.error('Assign resource error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to assign resource' }
    });
  }
});

// ============================================
// Resource Actions (Accept/Decline)
// ============================================

/**
 * POST /api/resource-requests/:id/accept
 * Accept an assignment
 */
router.post('/:id/accept', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    const updates = {
      status: 'scheduled',
      updated_at: new Date().toISOString()
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('resource_requests')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        await supabase.from('resource_request_history').insert({
          request_id: id,
          changed_by_user_id: user_id,
          action: 'accepted'
        });

        return res.json(data);
      }
    }

    // In-memory fallback
    const request = requestsStore.get(id);
    if (!request) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Resource request not found' }
      });
    }

    const updatedRequest = { ...request, ...updates };
    requestsStore.set(id, updatedRequest);
    addHistoryEntry(id, 'accepted', user_id);

    res.json(updatedRequest);
  } catch (error) {
    console.error('Accept assignment error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to accept assignment' }
    });
  }
});

/**
 * POST /api/resource-requests/:id/decline
 * Decline an assignment
 */
router.post('/:id/decline', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id, reason } = req.body;

    const updates = {
      status: 'pending',
      assigned_resource_id: null,
      assigned_by_user_id: null,
      assigned_at: null,
      updated_at: new Date().toISOString()
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('resource_requests')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        await supabase.from('resource_request_history').insert({
          request_id: id,
          changed_by_user_id: user_id,
          action: 'declined',
          notes: reason
        });

        return res.json(data);
      }
    }

    // In-memory fallback
    const request = requestsStore.get(id);
    if (!request) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Resource request not found' }
      });
    }

    const updatedRequest = {
      ...request,
      ...updates,
      assigned_resource_id: undefined,
      assigned_by_user_id: undefined,
      assigned_at: undefined
    };
    requestsStore.set(id, updatedRequest);
    addHistoryEntry(id, 'declined', user_id, {}, {}, reason);

    res.json(updatedRequest);
  } catch (error) {
    console.error('Decline assignment error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to decline assignment' }
    });
  }
});

// ============================================
// Scheduling
// ============================================

/**
 * POST /api/resource-requests/:id/schedule
 * Schedule an engagement
 */
router.post('/:id/schedule', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      scheduled_start,
      scheduled_end,
      create_calendar_event = true,
      meeting_link
    } = req.body;

    if (!scheduled_start || !scheduled_end) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'scheduled_start and scheduled_end are required' }
      });
    }

    const updates: any = {
      scheduled_start,
      scheduled_end,
      status: 'scheduled',
      updated_at: new Date().toISOString()
    };

    if (meeting_link) {
      updates.meeting_links = [{ title: 'Meeting Link', url: meeting_link }];
    }

    // TODO: Integrate with Google Calendar to create event
    // if (create_calendar_event) { ... }

    if (supabase) {
      const { data, error } = await supabase
        .from('resource_requests')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        await supabase.from('resource_request_history').insert({
          request_id: id,
          action: 'scheduled',
          new_values: { scheduled_start, scheduled_end }
        });

        return res.json(data);
      }
    }

    // In-memory fallback
    const request = requestsStore.get(id);
    if (!request) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Resource request not found' }
      });
    }

    const updatedRequest = {
      ...request,
      ...updates,
      meeting_links: meeting_link ? [{ title: 'Meeting Link', url: meeting_link }] : request.meeting_links
    };
    requestsStore.set(id, updatedRequest);
    addHistoryEntry(id, 'scheduled', undefined, {}, { scheduled_start, scheduled_end });

    res.json(updatedRequest);
  } catch (error) {
    console.error('Schedule engagement error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to schedule engagement' }
    });
  }
});

// ============================================
// Time Tracking
// ============================================

/**
 * POST /api/resource-requests/:id/log-time
 * Log time for an engagement
 */
router.post('/:id/log-time', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      user_id,
      date,
      hours_logged,
      activity_type,
      notes,
      billable = true
    } = req.body;

    if (!date || !hours_logged || !activity_type) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'date, hours_logged, and activity_type are required' }
      });
    }

    const engagement: ResourceEngagement = {
      id: uuidv4(),
      request_id: id,
      resource_user_id: user_id || 'current-user',
      date,
      hours_logged,
      activity_type,
      notes,
      billable,
      created_at: new Date().toISOString()
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('resource_engagements')
        .insert(engagement)
        .select()
        .single();

      if (!error && data) {
        // Update actual hours on request
        const { data: request } = await supabase
          .from('resource_requests')
          .select('actual_hours')
          .eq('id', id)
          .single();

        const newActualHours = (request?.actual_hours || 0) + hours_logged;
        await supabase
          .from('resource_requests')
          .update({ actual_hours: newActualHours })
          .eq('id', id);

        await supabase.from('resource_request_history').insert({
          request_id: id,
          changed_by_user_id: user_id,
          action: 'time_logged',
          new_values: { hours_logged, activity_type, date }
        });

        return res.status(201).json(data);
      }
    }

    // In-memory fallback
    const existing = engagementsStore.get(id) || [];
    existing.push(engagement);
    engagementsStore.set(id, existing);

    const request = requestsStore.get(id);
    if (request) {
      request.actual_hours = (request.actual_hours || 0) + hours_logged;
      requestsStore.set(id, request);
    }

    addHistoryEntry(id, 'time_logged', user_id, {}, { hours_logged, activity_type, date });

    res.status(201).json(engagement);
  } catch (error) {
    console.error('Log time error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to log time' }
    });
  }
});

/**
 * GET /api/resource-requests/:id/time-entries
 * Get time entries for a request
 */
router.get('/:id/time-entries', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (supabase) {
      const { data, error } = await supabase
        .from('resource_engagements')
        .select('*')
        .eq('request_id', id)
        .order('date', { ascending: false });

      if (!error && data) {
        return res.json({ entries: data });
      }
    }

    // In-memory fallback
    const entries = engagementsStore.get(id) || [];
    res.json({ entries });
  } catch (error) {
    console.error('Get time entries error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get time entries' }
    });
  }
});

// ============================================
// Completion
// ============================================

/**
 * POST /api/resource-requests/:id/complete
 * Mark a request as completed
 */
router.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      outcome_summary,
      deliverables = [],
      csm_rating,
      csm_feedback,
      resource_rating,
      resource_feedback,
      user_id
    } = req.body;

    if (!outcome_summary) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'outcome_summary is required' }
      });
    }

    const updates = {
      status: 'completed',
      outcome_summary,
      deliverables,
      csm_rating,
      csm_feedback,
      resource_rating,
      resource_feedback,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('resource_requests')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        await supabase.from('resource_request_history').insert({
          request_id: id,
          changed_by_user_id: user_id,
          action: 'completed',
          new_values: { outcome_summary, csm_rating, resource_rating }
        });

        return res.json(data);
      }
    }

    // In-memory fallback
    const request = requestsStore.get(id);
    if (!request) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Resource request not found' }
      });
    }

    const updatedRequest = { ...request, ...updates };
    requestsStore.set(id, updatedRequest);
    addHistoryEntry(id, 'completed', user_id, {}, { outcome_summary, csm_rating, resource_rating });

    res.json(updatedRequest);
  } catch (error) {
    console.error('Complete request error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to complete request' }
    });
  }
});

// ============================================
// History
// ============================================

/**
 * GET /api/resource-requests/:id/history
 * Get history for a request
 */
router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (supabase) {
      const { data, error } = await supabase
        .from('resource_request_history')
        .select(`
          *,
          user:user_profiles!resource_request_history_changed_by_user_id_fkey (id, full_name)
        `)
        .eq('request_id', id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return res.json({
          history: data.map((h: any) => ({
            ...h,
            changed_by_name: h.user?.full_name
          }))
        });
      }
    }

    // In-memory fallback
    const history = historyStore.get(id) || [];
    res.json({ history });
  } catch (error) {
    console.error('Get request history error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get request history' }
    });
  }
});

// ============================================
// Resource Manager Dashboard
// ============================================

/**
 * GET /api/resource-manager/queue
 * Get pending requests queue for resource managers
 */
router.get('/manager/queue', async (req: Request, res: Response) => {
  try {
    if (supabase) {
      const { data: pending } = await supabase
        .from('resource_requests')
        .select(`
          *,
          customers (id, name, arr)
        `)
        .eq('status', 'pending')
        .order('priority_score', { ascending: false })
        .order('created_at', { ascending: true });

      const { data: urgent } = await supabase
        .from('resource_requests')
        .select(`
          *,
          customers (id, name, arr)
        `)
        .eq('status', 'pending')
        .in('urgency', ['high', 'critical'])
        .order('priority_score', { ascending: false });

      const { data: inProgress } = await supabase
        .from('resource_requests')
        .select('id')
        .eq('status', 'in_progress');

      return res.json({
        pending_requests: pending || [],
        urgent_requests: urgent || [],
        overdue_requests: [], // TODO: Calculate based on start_date
        total_pending: pending?.length || 0,
        total_in_progress: inProgress?.length || 0
      });
    }

    // In-memory fallback
    const allRequests = Array.from(requestsStore.values());
    const pending = allRequests.filter(r => r.status === 'pending');
    const urgent = pending.filter(r => ['high', 'critical'].includes(r.urgency));
    const inProgress = allRequests.filter(r => r.status === 'in_progress');

    res.json({
      pending_requests: pending,
      urgent_requests: urgent,
      overdue_requests: [],
      total_pending: pending.length,
      total_in_progress: inProgress.length
    });
  } catch (error) {
    console.error('Get manager queue error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get manager queue' }
    });
  }
});

/**
 * GET /api/resource-manager/utilization
 * Get resource utilization dashboard
 */
router.get('/manager/utilization', async (req: Request, res: Response) => {
  try {
    if (supabase) {
      const { data: resources } = await supabase
        .from('resource_pool')
        .select(`
          user_id,
          resource_type,
          max_weekly_hours,
          target_utilization,
          user_profiles!inner (full_name)
        `)
        .eq('is_available_for_requests', true);

      if (resources) {
        const utilization = await Promise.all(
          resources.map(async (r: any) => {
            // Get current week's booked hours
            const today = new Date();
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);

            const { data } = await supabase.rpc('calculate_resource_utilization', {
              p_user_id: r.user_id,
              p_start_date: weekStart.toISOString().split('T')[0],
              p_end_date: weekEnd.toISOString().split('T')[0]
            });

            const utilData = data?.[0] || { total_available_hours: 40, total_booked_hours: 0, utilization_rate: 0 };
            const currentUtilization = utilData.utilization_rate || 0;
            const targetPct = r.target_utilization * 100;

            let status: 'under_utilized' | 'optimal' | 'over_utilized' = 'optimal';
            if (currentUtilization < targetPct - 20) status = 'under_utilized';
            else if (currentUtilization > targetPct + 10) status = 'over_utilized';

            // Get active engagements
            const { count } = await supabase
              .from('resource_requests')
              .select('*', { count: 'exact', head: true })
              .eq('assigned_resource_id', r.user_id)
              .eq('status', 'in_progress');

            return {
              user_id: r.user_id,
              full_name: r.user_profiles?.full_name,
              resource_type: r.resource_type,
              current_week_utilization: currentUtilization,
              current_month_utilization: currentUtilization, // TODO: Calculate monthly
              target_utilization: r.target_utilization,
              booked_hours_this_week: utilData.total_booked_hours || 0,
              available_hours_this_week: utilData.total_available_hours || 40,
              active_engagements: count || 0,
              status
            };
          })
        );

        const avgUtilization = utilization.length > 0
          ? utilization.reduce((sum, u) => sum + u.current_week_utilization, 0) / utilization.length
          : 0;

        const alerts = utilization
          .filter(u => u.status !== 'optimal')
          .map(u => ({
            type: u.status === 'over_utilized' ? 'overloaded' as const : 'underutilized' as const,
            resource_name: u.full_name,
            message: u.status === 'over_utilized'
              ? `${u.full_name} is at ${Math.round(u.current_week_utilization)}% utilization`
              : `${u.full_name} is only at ${Math.round(u.current_week_utilization)}% utilization`
          }));

        return res.json({
          resources: utilization,
          team_avg_utilization: Math.round(avgUtilization),
          total_active_engagements: utilization.reduce((sum, u) => sum + u.active_engagements, 0),
          capacity_alerts: alerts
        });
      }
    }

    // Mock fallback
    res.json({
      resources: [
        {
          user_id: 'mock-1',
          full_name: 'Alex Chen',
          resource_type: 'solutions_architect',
          current_week_utilization: 75,
          current_month_utilization: 72,
          target_utilization: 0.8,
          booked_hours_this_week: 30,
          available_hours_this_week: 40,
          active_engagements: 2,
          status: 'optimal'
        },
        {
          user_id: 'mock-2',
          full_name: 'Sarah Johnson',
          resource_type: 'solutions_engineer',
          current_week_utilization: 92,
          current_month_utilization: 88,
          target_utilization: 0.8,
          booked_hours_this_week: 37,
          available_hours_this_week: 40,
          active_engagements: 3,
          status: 'over_utilized'
        }
      ],
      team_avg_utilization: 78,
      total_active_engagements: 5,
      capacity_alerts: [
        {
          type: 'overloaded',
          resource_name: 'Sarah Johnson',
          message: 'Sarah Johnson is at 92% utilization'
        }
      ]
    });
  } catch (error) {
    console.error('Get utilization error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get utilization data' }
    });
  }
});

export { router as resourceRequestRoutes };
