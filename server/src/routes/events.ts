/**
 * Event Routes
 * PRD-018: Event Attendance Upload and Engagement Scoring
 *
 * Endpoints:
 * - POST /api/events/attendance/upload - Upload attendance data
 * - GET /api/events/:customerId/engagement - Customer engagement score
 * - GET /api/events/recommendations - Event recommendations
 * - POST /api/events/invitations - Send event invitations
 * - POST /api/events/advocacy - Create advocacy opportunities
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { attendanceParser } from '../services/events/attendanceParser.js';
import { engagementScorer } from '../services/events/engagementScorer.js';
import { eventRecommender } from '../services/events/eventRecommender.js';
import { recalculateHealthScore } from '../services/usage/health-score.js';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept CSV and Excel files
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (allowedMimes.includes(file.mimetype) ||
        file.originalname.endsWith('.csv') ||
        file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  },
});

// In-memory storage for file data when Supabase not configured
const inMemoryFiles = new Map<string, {
  rows: Record<string, any>[];
  mapping: Record<string, string>;
  result?: any;
}>();

/**
 * POST /api/events/attendance/upload
 * Upload and parse event attendance data
 */
router.post('/attendance/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`[Events] Processing attendance upload: ${req.file.originalname} (${req.file.size} bytes)`);

    // Parse the CSV
    const { headers, rows, suggestedMapping } = await attendanceParser.parseCSV(
      req.file.buffer,
      { hasHeaders: true }
    );

    // Get column mapping from request or use suggested
    let columnMapping = req.body.columnMapping;
    if (typeof columnMapping === 'string') {
      columnMapping = JSON.parse(columnMapping);
    }

    if (!columnMapping) {
      // Create mapping from suggestions
      columnMapping = {};
      for (const suggestion of suggestedMapping) {
        if (suggestion.confidence >= 0.7) {
          columnMapping[suggestion.suggestedField] = suggestion.column;
        }
      }
    }

    // Process and store attendance records
    const result = await attendanceParser.processAttendanceData(rows, columnMapping, userId);

    // Store for later analysis
    inMemoryFiles.set(result.file_id, {
      rows,
      mapping: columnMapping,
    });

    res.json({
      success: result.success,
      fileId: result.file_id,
      fileName: req.file.originalname,
      summary: {
        totalRecords: result.total_records,
        uniqueUsers: result.unique_users,
        uniqueCustomers: result.unique_customers,
        uniqueEvents: result.unique_events,
        dateRange: result.date_range,
      },
      eventTypeCounts: result.event_type_counts,
      columnMapping,
      suggestedMapping,
      unmappedCustomers: result.unmapped_customers,
      warnings: result.warnings,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Attendance upload error:', error);
    res.status(500).json({
      error: 'Failed to process attendance file',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/events/attendance/:fileId/mapping
 * Confirm or update column mapping for uploaded file
 */
router.post('/attendance/:fileId/mapping', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { fileId } = req.params;
    const { columnMapping } = req.body;

    if (!columnMapping) {
      return res.status(400).json({ error: 'Column mapping required' });
    }

    // Update mapping
    const file = inMemoryFiles.get(fileId);
    if (file) {
      file.mapping = columnMapping;

      // Re-process with new mapping
      const result = await attendanceParser.processAttendanceData(
        file.rows,
        columnMapping,
        userId
      );

      return res.json({
        success: true,
        message: 'Column mapping updated and data reprocessed',
        fileId,
        summary: {
          totalRecords: result.total_records,
          uniqueUsers: result.unique_users,
          uniqueCustomers: result.unique_customers,
        },
      });
    }

    res.status(404).json({ error: 'File not found' });
  } catch (error) {
    console.error('Mapping update error:', error);
    res.status(500).json({
      error: 'Failed to update column mapping',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/events/attendance/:fileId/analyze
 * Analyze uploaded attendance data and calculate engagement scores
 */
router.post('/attendance/:fileId/analyze', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { fileId } = req.params;
    const { period = 'all' } = req.body;

    console.log(`[Events] Analyzing engagement for file ${fileId}`);

    // Calculate engagement scores
    const analysisResult = await engagementScorer.calculateEngagementScores(fileId, period);

    // Store result
    const file = inMemoryFiles.get(fileId);
    if (file) {
      file.result = analysisResult;
    }

    // Update health scores for customers with engagement data
    for (const customer of analysisResult.leaderboard) {
      if (customer.customer_id) {
        await recalculateHealthScore(customer.customer_id, 'event_engagement_update');
      }
    }

    res.json({
      success: true,
      data: analysisResult,
    });
  } catch (error) {
    console.error('Engagement analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze engagement',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/events/:customerId/engagement
 * Get engagement score for a specific customer
 */
router.get('/:customerId/engagement', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId } = req.params;
    const period = (req.query.period as string) || 'year';
    const includeUsers = req.query.includeUsers === 'true';

    // Get customer engagement
    const engagement = await engagementScorer.getCustomerEngagement(
      customerId,
      period as 'month' | 'quarter' | 'year' | 'all'
    );

    if (!engagement) {
      return res.status(404).json({
        error: 'No engagement data found for this customer',
      });
    }

    // Optionally get user-level engagement
    let userEngagement;
    if (includeUsers) {
      userEngagement = await engagementScorer.getUserEngagement(customerId);
    }

    res.json({
      success: true,
      data: {
        engagement,
        users: userEngagement,
      },
    });
  } catch (error) {
    console.error('Customer engagement fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch customer engagement',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/events/recommendations
 * Get event recommendations for upcoming events
 */
router.get('/recommendations', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    // Get upcoming events
    const upcomingEvents = await eventRecommender.getUpcomingEvents();

    // Get recommendations
    const recommendations = await eventRecommender.getEventRecommendations(upcomingEvents);

    res.json({
      success: true,
      data: {
        upcoming_events: upcomingEvents,
        recommendations,
      },
    });
  } catch (error) {
    console.error('Recommendations fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch event recommendations',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/events/invitations
 * Send event invitations to recommended customers
 */
router.post('/invitations', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { eventId, customerIds, customSubject, customBody } = req.body;

    if (!eventId) {
      return res.status(400).json({ error: 'Event ID required' });
    }

    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({ error: 'Customer IDs required' });
    }

    console.log(`[Events] Sending invitations for event ${eventId} to ${customerIds.length} customers`);

    // Send invitations
    const result = await eventRecommender.sendInvitations(
      eventId,
      customerIds,
      customSubject,
      customBody
    );

    res.json({
      success: result.failed_count === 0,
      invitations: result.invitations,
      sentCount: result.sent_count,
      failedCount: result.failed_count,
      errors: result.errors,
      message: `Sent ${result.sent_count}/${customerIds.length} invitations`,
    });
  } catch (error) {
    console.error('Invitation send error:', error);
    res.status(500).json({
      error: 'Failed to send invitations',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/events/advocacy
 * Create advocacy opportunities from high-engagement customers
 */
router.post('/advocacy', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerIds, advocacyTypes } = req.body;

    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({ error: 'Customer IDs required' });
    }

    console.log(`[Events] Creating advocacy opportunities for ${customerIds.length} customers`);

    // Create advocacy opportunities
    const opportunities = await eventRecommender.createAdvocacyOpportunities(
      customerIds,
      advocacyTypes
    );

    res.json({
      success: true,
      opportunities,
      count: opportunities.length,
      message: `Created ${opportunities.length} advocacy opportunities`,
    });
  } catch (error) {
    console.error('Advocacy creation error:', error);
    res.status(500).json({
      error: 'Failed to create advocacy opportunities',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/events/advocacy/candidates
 * Get list of advocacy candidates from recent analysis
 */
router.get('/advocacy/candidates', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { fileId, minScore = 85 } = req.query;

    // Get from stored analysis result
    const file = inMemoryFiles.get(fileId as string);
    if (file?.result) {
      const candidates = file.result.advocacy_candidates.filter(
        (c: any) => c.engagement_score >= Number(minScore)
      );

      return res.json({
        success: true,
        candidates,
        count: candidates.length,
      });
    }

    // Return mock data
    res.json({
      success: true,
      candidates: [],
      count: 0,
      message: 'No analysis data found. Please analyze attendance data first.',
    });
  } catch (error) {
    console.error('Advocacy candidates fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch advocacy candidates',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/events/declining
 * Get customers with declining engagement
 */
router.get('/declining', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { fileId } = req.query;

    // Get from stored analysis result
    const file = inMemoryFiles.get(fileId as string);
    if (file?.result) {
      return res.json({
        success: true,
        alerts: file.result.declining_engagement,
        count: file.result.declining_engagement.length,
      });
    }

    // Return mock data
    res.json({
      success: true,
      alerts: [],
      count: 0,
      message: 'No analysis data found. Please analyze attendance data first.',
    });
  } catch (error) {
    console.error('Declining engagement fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch declining engagement alerts',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/events/leaderboard
 * Get engagement leaderboard
 */
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { fileId, limit = 20 } = req.query;

    // Get from stored analysis result
    const file = inMemoryFiles.get(fileId as string);
    if (file?.result) {
      const leaderboard = file.result.leaderboard.slice(0, Number(limit));

      return res.json({
        success: true,
        leaderboard,
        count: leaderboard.length,
      });
    }

    // Return mock data
    res.json({
      success: true,
      leaderboard: [],
      count: 0,
      message: 'No analysis data found. Please analyze attendance data first.',
    });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch engagement leaderboard',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export const eventsRoutes = router;
export default router;
