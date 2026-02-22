/**
 * Training Routes
 * PRD-017: Training Completion Data Certification Tracking
 *
 * API Endpoints:
 * - POST /api/training/upload - Upload training data
 * - GET /api/training/:customerId/status - Customer training status
 * - GET /api/training/:customerId/gaps - Training gaps analysis
 * - POST /api/training/reminders - Send training reminders
 * - POST /api/training/plan - Create training plan
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import {
  trainingDataParser,
  certificationTracker,
  trainingGapAnalyzer
} from '../services/training/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

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
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (allowedMimes.includes(file.mimetype) ||
        file.originalname.endsWith('.csv') ||
        file.originalname.endsWith('.xlsx') ||
        file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  }
});

/**
 * POST /api/training/upload
 * Upload and parse training completion data
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`[Training] Processing training data upload: ${req.file.originalname} (${req.file.size} bytes)`);

    const customerId = req.body.customerId;
    const columnMapping = req.body.columnMapping
      ? JSON.parse(req.body.columnMapping)
      : undefined;

    const result = await trainingDataParser.parseTrainingData(req.file.buffer, {
      fileName: req.file.originalname,
      customerId,
      columnMapping
    });

    if (!result.success && result.errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Failed to parse training data',
        errors: result.errors,
        column_mapping: result.column_mapping,
        preview: result.preview
      });
    }

    res.json({
      success: true,
      file_id: result.file_id,
      file_name: result.file_name,
      total_records: result.total_records,
      unique_users: result.unique_users,
      unique_courses: result.unique_courses,
      customer_id: result.customer_id,
      customer_name: result.customer_name,
      column_mapping: result.column_mapping,
      preview: result.preview,
      message: `Found ${result.total_records} training records for ${result.unique_users} users across ${result.unique_courses} courses`
    });

  } catch (error) {
    console.error('[Training] Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process training file',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/training/upload/:fileId/confirm
 * Confirm column mapping and process training data
 */
router.post('/upload/:fileId/confirm', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { fileId } = req.params;
    const { columnMapping, customerId } = req.body;

    if (!columnMapping) {
      return res.status(400).json({ error: 'Column mapping required' });
    }

    // In a production system, we would fetch the raw data and re-process with confirmed mapping
    // For now, return success
    res.json({
      success: true,
      message: 'Column mapping confirmed',
      file_id: fileId
    });

  } catch (error) {
    console.error('[Training] Mapping confirmation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm column mapping',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/training/:customerId/status
 * Get comprehensive training status for a customer
 */
router.get('/:customerId/status', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId } = req.params;
    const customerName = req.query.customerName as string | undefined;

    console.log(`[Training] Fetching training status for customer: ${customerId}`);

    const status = await certificationTracker.getCustomerTrainingStatus(
      customerId,
      customerName
    );

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('[Training] Status fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch training status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/training/:customerId/gaps
 * Get training gap analysis for a customer
 */
router.get('/:customerId/gaps', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId } = req.params;
    const customerName = req.query.customerName as string | undefined;
    const minSeverity = req.query.minSeverity as 'high' | 'medium' | 'low' | undefined;

    console.log(`[Training] Analyzing training gaps for customer: ${customerId}`);

    const analysis = await trainingGapAnalyzer.analyzeTrainingGaps(
      customerId,
      customerName
    );

    // Filter by severity if requested
    if (minSeverity) {
      const severityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
      const minOrder = severityOrder[minSeverity];
      analysis.gaps = analysis.gaps.filter(g => severityOrder[g.severity] <= minOrder);
    }

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.error('[Training] Gap analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze training gaps',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/training/:customerId/certifications
 * Get certification overview for a customer
 */
router.get('/:customerId/certifications', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId } = req.params;
    const includeExpiring = req.query.includeExpiring !== 'false';

    const status = await certificationTracker.getCustomerTrainingStatus(customerId);

    const response: any = {
      success: true,
      certifications: status.certifications,
      users_by_status: status.users_by_status
    };

    if (includeExpiring) {
      response.expiring_certifications = status.expiring_certifications;
    }

    res.json(response);

  } catch (error) {
    console.error('[Training] Certification fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch certifications',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/training/:customerId/courses
 * Get course completion status for a customer
 */
router.get('/:customerId/courses', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId } = req.params;

    const status = await certificationTracker.getCustomerTrainingStatus(customerId);

    res.json({
      success: true,
      courses: status.courses,
      overview: status.overview
    });

  } catch (error) {
    console.error('[Training] Courses fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch course status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/training/:customerId/adoption-correlation
 * Get training vs adoption correlation data
 */
router.get('/:customerId/adoption-correlation', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId } = req.params;

    const status = await certificationTracker.getCustomerTrainingStatus(customerId);

    res.json({
      success: true,
      correlation: status.training_vs_adoption
    });

  } catch (error) {
    console.error('[Training] Correlation fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch adoption correlation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/training/reminders
 * Send training reminders to users
 */
router.post('/reminders', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId, reminderTypes, customMessage } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID required' });
    }

    if (!reminderTypes || !Array.isArray(reminderTypes) || reminderTypes.length === 0) {
      return res.status(400).json({
        error: 'Reminder types required',
        valid_types: ['certification_required', 'recertification_due', 'uncertified_users']
      });
    }

    console.log(`[Training] Sending reminders for customer: ${customerId}`);

    const result = await trainingGapAnalyzer.sendTrainingReminders(
      customerId,
      reminderTypes
    );

    res.json({
      success: true,
      total_sent: result.total_sent,
      reminders: result.reminders,
      message: `Sent ${result.total_sent} training reminders`
    });

  } catch (error) {
    console.error('[Training] Reminder send error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send training reminders',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/training/plan
 * Create a training plan for a customer
 */
router.post('/plan', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const {
      customerId,
      customerName,
      includeGaps = true,
      includeExpiring = true,
      weeks = 4
    } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID required' });
    }

    console.log(`[Training] Creating training plan for customer: ${customerId}`);

    const plan = await trainingGapAnalyzer.generateTrainingPlan(
      customerId,
      customerName || 'Unknown Customer',
      userId,
      { includeGaps, includeExpiring, weeks }
    );

    res.json({
      success: true,
      plan,
      message: `Training plan created with ${plan.weeks.length} weeks of activities`
    });

  } catch (error) {
    console.error('[Training] Plan creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create training plan',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/training/:customerId/recommendations
 * Get training recommendations for a customer
 */
router.get('/:customerId/recommendations', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId } = req.params;

    const analysis = await trainingGapAnalyzer.analyzeTrainingGaps(customerId);

    res.json({
      success: true,
      recommendations: analysis.priority_recommendations,
      risk_summary: analysis.risk_summary
    });

  } catch (error) {
    console.error('[Training] Recommendations fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recommendations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/training/:customerId/users/:userEmail
 * Get training status for a specific user
 */
router.get('/:customerId/users/:userEmail', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId, userEmail } = req.params;

    const records = await trainingDataParser.getTrainingRecords(customerId);
    const userRecords = records.filter(r => r.user_email === userEmail);

    if (userRecords.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found in training records'
      });
    }

    const firstRecord = userRecords[0];
    const completedCourses = userRecords.filter(r => r.status === 'completed' && r.passed);
    const certifications = userRecords.filter(r => r.certification_earned);

    res.json({
      success: true,
      user: {
        user_id: firstRecord.user_id,
        user_email: firstRecord.user_email,
        user_name: firstRecord.user_name,
        user_role: firstRecord.user_role
      },
      summary: {
        total_courses: userRecords.length,
        completed_courses: completedCourses.length,
        certifications_earned: certifications.length,
        completion_rate: Math.round((completedCourses.length / userRecords.length) * 100)
      },
      courses: userRecords.map(r => ({
        course_id: r.course_id,
        course_name: r.course_name,
        course_type: r.course_type,
        status: r.status,
        score: r.score,
        passed: r.passed,
        enrollment_date: r.enrollment_date,
        completion_date: r.completion_date,
        certification_earned: r.certification_earned,
        certification_expires: r.certification_expires
      }))
    });

  } catch (error) {
    console.error('[Training] User status fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user training status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export const trainingRoutes = router;
export default router;
