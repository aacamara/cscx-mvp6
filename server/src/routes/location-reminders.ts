/**
 * PRD-268: Location-Based Reminders API Routes
 *
 * Endpoints for managing customer locations, geofences, visit logs,
 * and location preferences for CSMs.
 */

import { Router, Request, Response } from 'express';
import {
  locationRemindersService,
  CreateLocationInput,
  UpdateLocationInput,
  UpdatePreferencesInput,
  StartVisitInput,
  EndVisitInput,
  LogGeofenceEventInput,
} from '../services/mobile/index.js';

const router = Router();

// ============================================
// Customer Location Endpoints
// ============================================

/**
 * POST /api/locations
 * Create a new customer location
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const input: CreateLocationInput = req.body;

    if (!input.customer_id) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'customer_id is required' }
      });
    }

    if (input.latitude === undefined || input.longitude === undefined) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'latitude and longitude are required' }
      });
    }

    const location = await locationRemindersService.createLocation(input);

    res.status(201).json({
      success: true,
      data: location
    });
  } catch (error) {
    console.error('Create location error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create location'
      }
    });
  }
});

/**
 * GET /api/locations/:id
 * Get a specific location
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const location = await locationRemindersService.getLocation(id);

    if (!location) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Location not found' }
      });
    }

    res.json({
      success: true,
      data: location
    });
  } catch (error) {
    console.error('Get location error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get location' }
    });
  }
});

/**
 * GET /api/locations/customer/:customerId
 * Get all locations for a customer
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const locations = await locationRemindersService.getCustomerLocations(customerId);

    res.json({
      success: true,
      data: locations
    });
  } catch (error) {
    console.error('Get customer locations error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get customer locations' }
    });
  }
});

/**
 * PATCH /api/locations/:id
 * Update a location
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const input: UpdateLocationInput = req.body;

    const location = await locationRemindersService.updateLocation(id, input);

    res.json({
      success: true,
      data: location
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update location'
      }
    });
  }
});

/**
 * DELETE /api/locations/:id
 * Delete a location
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await locationRemindersService.deleteLocation(id);

    res.json({
      success: true,
      message: 'Location deleted successfully'
    });
  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete location' }
    });
  }
});

/**
 * POST /api/locations/nearby
 * Find nearby customer locations
 */
router.post('/nearby', async (req: Request, res: Response) => {
  try {
    const { latitude, longitude, radius_meters } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'latitude and longitude are required' }
      });
    }

    const locations = await locationRemindersService.findNearbyLocations(
      latitude,
      longitude,
      radius_meters || 1000
    );

    res.json({
      success: true,
      data: locations
    });
  } catch (error) {
    console.error('Find nearby locations error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to find nearby locations' }
    });
  }
});

// ============================================
// Geofence Endpoints
// ============================================

/**
 * GET /api/locations/geofences/:userId
 * Get active geofences for a user
 */
router.get('/geofences/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const geofences = await locationRemindersService.getActiveGeofences(userId);

    res.json({
      success: true,
      data: geofences
    });
  } catch (error) {
    console.error('Get geofences error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get geofences' }
    });
  }
});

/**
 * POST /api/locations/geofence-event
 * Log a geofence event (enter/exit)
 */
router.post('/geofence-event', async (req: Request, res: Response) => {
  try {
    const input: LogGeofenceEventInput = req.body;

    if (!input.user_id || !input.customer_id || !input.event_type) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'user_id, customer_id, and event_type are required'
        }
      });
    }

    const event = await locationRemindersService.logGeofenceEvent(input);

    // On enter, also start a visit automatically
    if (input.event_type === 'enter') {
      const visit = await locationRemindersService.startVisit({
        user_id: input.user_id,
        customer_id: input.customer_id,
        location_id: input.location_id
      });

      return res.status(201).json({
        success: true,
        data: {
          event,
          visit,
          customer_brief: await locationRemindersService.getCustomerBrief(input.customer_id)
        }
      });
    }

    // On exit, get active visit for potential completion
    if (input.event_type === 'exit') {
      const activeVisit = await locationRemindersService.getActiveVisit(
        input.user_id,
        input.customer_id
      );

      return res.status(201).json({
        success: true,
        data: {
          event,
          active_visit: activeVisit
        }
      });
    }

    res.status(201).json({
      success: true,
      data: { event }
    });
  } catch (error) {
    console.error('Log geofence event error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to log geofence event'
      }
    });
  }
});

/**
 * POST /api/locations/notification-clicked/:eventId
 * Mark notification as clicked
 */
router.post('/notification-clicked/:eventId', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    await locationRemindersService.markNotificationClicked(eventId);

    res.json({ success: true });
  } catch (error) {
    console.error('Mark notification clicked error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to mark notification clicked' }
    });
  }
});

// ============================================
// Visit Log Endpoints
// ============================================

/**
 * POST /api/locations/visits/start
 * Start a new visit
 */
router.post('/visits/start', async (req: Request, res: Response) => {
  try {
    const input: StartVisitInput = req.body;

    if (!input.user_id || !input.customer_id) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'user_id and customer_id are required' }
      });
    }

    // Check for existing active visit
    const existingVisit = await locationRemindersService.getActiveVisit(
      input.user_id,
      input.customer_id
    );

    if (existingVisit) {
      return res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'An active visit already exists for this customer'
        },
        data: existingVisit
      });
    }

    const visit = await locationRemindersService.startVisit(input);
    const brief = await locationRemindersService.getCustomerBrief(input.customer_id);

    res.status(201).json({
      success: true,
      data: {
        visit,
        customer_brief: brief
      }
    });
  } catch (error) {
    console.error('Start visit error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to start visit'
      }
    });
  }
});

/**
 * POST /api/locations/visits/:visitId/end
 * End a visit with notes
 */
router.post('/visits/:visitId/end', async (req: Request, res: Response) => {
  try {
    const { visitId } = req.params;
    const input: EndVisitInput = req.body;

    const visit = await locationRemindersService.endVisit(visitId, input);

    res.json({
      success: true,
      data: visit
    });
  } catch (error) {
    console.error('End visit error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to end visit'
      }
    });
  }
});

/**
 * GET /api/locations/visits/active/:userId
 * Get active visit for a user
 */
router.get('/visits/active/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { customer_id } = req.query;

    const visit = await locationRemindersService.getActiveVisit(
      userId,
      customer_id as string | undefined
    );

    res.json({
      success: true,
      data: visit
    });
  } catch (error) {
    console.error('Get active visit error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get active visit' }
    });
  }
});

/**
 * GET /api/locations/visits/:userId
 * Get visit history for a user
 */
router.get('/visits/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const {
      customer_id,
      start_date,
      end_date,
      limit = '20',
      offset = '0'
    } = req.query;

    const result = await locationRemindersService.getVisitLogs(userId, {
      customerId: customer_id as string | undefined,
      startDate: start_date as string | undefined,
      endDate: end_date as string | undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    res.json({
      success: true,
      data: result.visits,
      pagination: {
        total: result.total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error) {
    console.error('Get visit logs error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get visit logs' }
    });
  }
});

/**
 * GET /api/locations/visits/detail/:visitId
 * Get a specific visit log
 */
router.get('/visits/detail/:visitId', async (req: Request, res: Response) => {
  try {
    const { visitId } = req.params;
    const visit = await locationRemindersService.getVisitLog(visitId);

    if (!visit) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Visit not found' }
      });
    }

    res.json({
      success: true,
      data: visit
    });
  } catch (error) {
    console.error('Get visit error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get visit' }
    });
  }
});

/**
 * PATCH /api/locations/visits/:visitId/notes
 * Update visit notes
 */
router.patch('/visits/:visitId/notes', async (req: Request, res: Response) => {
  try {
    const { visitId } = req.params;
    const { notes } = req.body;

    if (notes === undefined) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'notes field is required' }
      });
    }

    const visit = await locationRemindersService.updateVisitNotes(visitId, notes);

    res.json({
      success: true,
      data: visit
    });
  } catch (error) {
    console.error('Update visit notes error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update visit notes' }
    });
  }
});

// ============================================
// User Preferences Endpoints
// ============================================

/**
 * GET /api/locations/preferences/:userId
 * Get location preferences for a user
 */
router.get('/preferences/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const preferences = await locationRemindersService.getPreferences(userId);

    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get preferences' }
    });
  }
});

/**
 * PUT /api/locations/preferences/:userId
 * Update location preferences for a user
 */
router.put('/preferences/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const input: UpdatePreferencesInput = req.body;

    const preferences = await locationRemindersService.updatePreferences(userId, input);

    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update preferences'
      }
    });
  }
});

// ============================================
// Analytics & Patterns Endpoints
// ============================================

/**
 * GET /api/locations/patterns/:userId
 * Get visit patterns for a user
 */
router.get('/patterns/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { customer_id } = req.query;

    const patterns = await locationRemindersService.getVisitPatterns(
      userId,
      customer_id as string | undefined
    );

    res.json({
      success: true,
      data: patterns
    });
  } catch (error) {
    console.error('Get patterns error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get visit patterns' }
    });
  }
});

/**
 * GET /api/locations/summary/:userId
 * Get visit summary for a user
 */
router.get('/summary/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const summary = await locationRemindersService.getCsmVisitSummary(userId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get visit summary' }
    });
  }
});

/**
 * GET /api/locations/brief/:customerId
 * Get customer brief for arrival notification
 */
router.get('/brief/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const brief = await locationRemindersService.getCustomerBrief(customerId);

    if (!brief) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Customer not found' }
      });
    }

    res.json({
      success: true,
      data: brief
    });
  } catch (error) {
    console.error('Get customer brief error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get customer brief' }
    });
  }
});

// ============================================
// Privacy Endpoints
// ============================================

/**
 * DELETE /api/locations/history/:userId
 * Clear location history for privacy
 */
router.delete('/history/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    await locationRemindersService.clearLocationHistory(userId);

    res.json({
      success: true,
      message: 'Location history cleared successfully'
    });
  } catch (error) {
    console.error('Clear location history error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to clear location history' }
    });
  }
});

/**
 * POST /api/locations/disable/:userId
 * Disable location tracking for a user
 */
router.post('/disable/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    await locationRemindersService.disableLocationTracking(userId);

    res.json({
      success: true,
      message: 'Location tracking disabled successfully'
    });
  } catch (error) {
    console.error('Disable location tracking error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to disable location tracking' }
    });
  }
});

export default router;
