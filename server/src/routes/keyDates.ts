/**
 * Key Dates API Routes (PRD-109)
 *
 * RESTful endpoints for managing key customer dates and reminders.
 */

import { Router, Request, Response } from 'express';
import { keyDatesService, KeyDateFilters } from '../services/keyDates/index.js';

const router = Router();

// ============================================
// GET /api/key-dates - List key dates
// ============================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      stakeholderId,
      dateType,
      fromDate,
      toDate,
      upcoming,
      search,
      limit,
      offset,
    } = req.query;

    const filters: KeyDateFilters = {
      customerId: customerId as string,
      stakeholderId: stakeholderId as string,
      dateType: dateType as any,
      fromDate: fromDate as string,
      toDate: toDate as string,
      upcoming: upcoming === 'true',
      search: search as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    };

    const { keyDates, total } = await keyDatesService.listKeyDates(filters);

    const page = Math.floor((filters.offset || 0) / (filters.limit || 20)) + 1;
    const totalPages = Math.ceil(total / (filters.limit || 20));

    res.json({
      success: true,
      data: {
        keyDates,
        total,
        pagination: {
          page,
          limit: filters.limit || 20,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error('[KeyDates API] List error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list key dates' },
    });
  }
});

// ============================================
// GET /api/key-dates/upcoming - Get upcoming reminders
// ============================================

router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const userId = req.headers['x-user-id'] as string;

    const reminders = await keyDatesService.getUpcomingReminders(days, userId);

    // Calculate summary
    const summary = {
      total: reminders.length,
      byUrgency: {
        critical: reminders.filter(r => r.urgency === 'critical').length,
        high: reminders.filter(r => r.urgency === 'high').length,
        medium: reminders.filter(r => r.urgency === 'medium').length,
        low: reminders.filter(r => r.urgency === 'low').length,
      },
      byType: reminders.reduce((acc, r) => {
        acc[r.keyDate.dateType] = (acc[r.keyDate.dateType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    res.json({
      success: true,
      data: {
        reminders,
        summary,
      },
    });
  } catch (error) {
    console.error('[KeyDates API] Upcoming reminders error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get upcoming reminders' },
    });
  }
});

// ============================================
// GET /api/key-dates/customer/:customerId - Get by customer
// ============================================

router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const keyDates = await keyDatesService.getKeyDatesByCustomer(customerId);

    res.json({
      success: true,
      data: { keyDates },
    });
  } catch (error) {
    console.error('[KeyDates API] Get by customer error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get customer key dates' },
    });
  }
});

// ============================================
// GET /api/key-dates/:id - Get single key date
// ============================================

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const keyDate = await keyDatesService.getKeyDate(id);

    if (!keyDate) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Key date not found' },
      });
    }

    res.json({
      success: true,
      data: keyDate,
    });
  } catch (error) {
    console.error('[KeyDates API] Get error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get key date' },
    });
  }
});

// ============================================
// POST /api/key-dates - Create key date
// ============================================

router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      stakeholderId,
      dateType,
      dateValue,
      title,
      description,
      reminderDaysBefore,
      isRecurring,
      recurrencePattern,
    } = req.body;

    // Validation
    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'customerId is required' },
      });
    }
    if (!dateType) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'dateType is required' },
      });
    }
    if (!dateValue) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'dateValue is required' },
      });
    }
    if (!title) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'title is required' },
      });
    }

    const keyDate = await keyDatesService.createKeyDate({
      customerId,
      stakeholderId,
      dateType,
      dateValue,
      title,
      description,
      reminderDaysBefore,
      isRecurring,
      recurrencePattern,
    });

    res.status(201).json({
      success: true,
      data: keyDate,
    });
  } catch (error) {
    console.error('[KeyDates API] Create error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create key date' },
    });
  }
});

// ============================================
// PATCH /api/key-dates/:id - Update key date
// ============================================

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const keyDate = await keyDatesService.updateKeyDate(id, updates);

    if (!keyDate) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Key date not found' },
      });
    }

    res.json({
      success: true,
      data: keyDate,
    });
  } catch (error) {
    console.error('[KeyDates API] Update error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update key date' },
    });
  }
});

// ============================================
// DELETE /api/key-dates/:id - Delete key date
// ============================================

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const success = await keyDatesService.deleteKeyDate(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Key date not found' },
      });
    }

    res.json({
      success: true,
      message: 'Key date deleted successfully',
    });
  } catch (error) {
    console.error('[KeyDates API] Delete error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete key date' },
    });
  }
});

// ============================================
// POST /api/key-dates/reminder/:id/dismiss - Dismiss reminder
// ============================================

router.post('/reminder/:id/dismiss', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    await keyDatesService.dismissReminder(id, userId);

    res.json({
      success: true,
      message: 'Reminder dismissed',
    });
  } catch (error) {
    console.error('[KeyDates API] Dismiss reminder error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to dismiss reminder' },
    });
  }
});

// ============================================
// POST /api/key-dates/reminder/:id/send-slack - Send Slack reminder
// ============================================

router.post('/reminder/:id/send-slack', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { channelId } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'User ID is required' },
      });
    }

    if (!channelId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'channelId is required' },
      });
    }

    // Get the reminder
    const reminders = await keyDatesService.getUpcomingReminders(30, userId);
    const reminder = reminders.find(r => r.id === id);

    if (!reminder) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Reminder not found' },
      });
    }

    await keyDatesService.sendSlackReminder(userId, reminder, channelId);

    res.json({
      success: true,
      message: 'Slack reminder sent',
    });
  } catch (error) {
    console.error('[KeyDates API] Send Slack reminder error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to send Slack reminder' },
    });
  }
});

// ============================================
// POST /api/key-dates/import-from-contract - Import from contract
// ============================================

router.post('/import-from-contract', async (req: Request, res: Response) => {
  try {
    const { customerId, startDate, renewalDate, goLiveDate } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'customerId is required' },
      });
    }

    const imported = await keyDatesService.importFromContract(customerId, {
      startDate,
      renewalDate,
      goLiveDate,
    });

    res.status(201).json({
      success: true,
      data: {
        imported,
        count: imported.length,
      },
    });
  } catch (error) {
    console.error('[KeyDates API] Import from contract error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to import key dates from contract' },
    });
  }
});

export default router;
