/**
 * PRD-123: Implementation Routes
 * API endpoints for implementation project management
 *
 * Endpoints:
 * - POST /api/implementations/initiate - Start implementation workflow
 * - GET /api/implementations/:id - Get implementation details
 * - PUT /api/implementations/:id/milestone/:milestoneId - Update milestone
 * - POST /api/implementations/:id/kickoff - Schedule kickoff
 * - GET /api/implementations/customer/:customerId - Get customer implementations
 * - GET /api/implementations - List all implementations
 */

import { Router, Request, Response } from 'express';
import {
  implementationService,
  type InitiateImplementationRequest,
  type ScheduleKickoffRequest,
  type ImplementationStatus,
} from '../services/implementation/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// POST /api/implementations/initiate
// Start implementation workflow (FR-1, FR-3)
// ============================================

router.post('/initiate', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const request = req.body as InitiateImplementationRequest;

    // Validate required fields
    if (!request.customerId) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'customerId is required',
      });
    }

    console.log(`[Implementation] Initiating for customer ${request.customerId}`);

    const result = await implementationService.initiateImplementation(userId, request);

    res.status(201).json({
      success: true,
      project: result.project,
      milestones: result.milestones,
      notifications: result.notifications,
    });
  } catch (error) {
    console.error('[Implementation] Initiate error:', error);
    res.status(500).json({
      error: 'Failed to initiate implementation',
      message: (error as Error).message,
    });
  }
});

// ============================================
// GET /api/implementations/:id
// Get implementation project details
// ============================================

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const project = await implementationService.getProject(id);

    if (!project) {
      return res.status(404).json({ error: 'Implementation project not found' });
    }

    // Get milestones
    const milestones = await implementationService.getProjectMilestones(id);

    res.json({
      project,
      milestones,
    });
  } catch (error) {
    console.error('[Implementation] Get project error:', error);
    res.status(500).json({
      error: 'Failed to get implementation project',
      message: (error as Error).message,
    });
  }
});

// ============================================
// GET /api/implementations
// List implementation projects
// ============================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { status, customerId, source, limit, offset } = req.query;

    const projects = await implementationService.listProjects(userId, {
      status: status as ImplementationStatus,
      customerId: customerId as string,
      source: source as any,
    });

    // Apply pagination
    const start = parseInt(offset as string) || 0;
    const end = start + (parseInt(limit as string) || 50);
    const paginated = projects.slice(start, end);

    res.json({
      projects: paginated,
      total: projects.length,
      offset: start,
      limit: end - start,
    });
  } catch (error) {
    console.error('[Implementation] List projects error:', error);
    res.status(500).json({
      error: 'Failed to list implementation projects',
      message: (error as Error).message,
    });
  }
});

// ============================================
// GET /api/implementations/customer/:customerId
// Get implementations for a customer
// ============================================

router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const project = await implementationService.getProjectByCustomer(customerId);

    if (!project) {
      return res.status(404).json({ error: 'No implementation project found for customer' });
    }

    const milestones = await implementationService.getProjectMilestones(project.id);

    res.json({
      project,
      milestones,
    });
  } catch (error) {
    console.error('[Implementation] Get customer project error:', error);
    res.status(500).json({
      error: 'Failed to get customer implementation',
      message: (error as Error).message,
    });
  }
});

// ============================================
// PUT /api/implementations/:id/status
// Update implementation project status
// ============================================

router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const validStatuses: ImplementationStatus[] = [
      'initiated',
      'planning',
      'executing',
      'closing',
      'completed',
      'on_hold',
      'cancelled',
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        validStatuses,
      });
    }

    const project = await implementationService.updateProjectStatus(id, status);

    if (!project) {
      return res.status(404).json({ error: 'Implementation project not found' });
    }

    res.json({ success: true, project });
  } catch (error) {
    console.error('[Implementation] Update status error:', error);
    res.status(500).json({
      error: 'Failed to update implementation status',
      message: (error as Error).message,
    });
  }
});

// ============================================
// PUT /api/implementations/:id/milestone/:milestoneId
// Update milestone status (FR-3)
// ============================================

router.put('/:id/milestone/:milestoneId', async (req: Request, res: Response) => {
  try {
    const { milestoneId } = req.params;
    const { status, completedDate } = req.body;

    const updates: any = {};
    if (status) updates.status = status;
    if (completedDate) updates.completedDate = new Date(completedDate);

    const milestone = await implementationService.updateMilestone(milestoneId, updates);

    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    res.json({ success: true, milestone });
  } catch (error) {
    console.error('[Implementation] Update milestone error:', error);
    res.status(500).json({
      error: 'Failed to update milestone',
      message: (error as Error).message,
    });
  }
});

// ============================================
// POST /api/implementations/:id/kickoff
// Schedule kickoff meeting (FR-8)
// ============================================

router.post('/:id/kickoff', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;
    const { proposedTimes, duration, attendeeEmails, includeCustomer } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    if (!attendeeEmails || !Array.isArray(attendeeEmails)) {
      return res.status(400).json({ error: 'attendeeEmails array is required' });
    }

    const request: ScheduleKickoffRequest = {
      projectId: id,
      proposedTimes: proposedTimes?.map((t: string) => new Date(t)),
      duration: duration || 60,
      attendeeEmails,
      includeCustomer,
    };

    const result = await implementationService.scheduleKickoff(userId, request);

    if (!result.success) {
      return res.status(400).json({
        error: 'Failed to schedule kickoff',
        availableSlots: result.availableSlots,
      });
    }

    res.json({
      success: true,
      calendarEventId: result.calendarEventId,
      meetLink: result.meetLink,
      scheduledAt: result.scheduledAt,
      availableSlots: result.availableSlots,
    });
  } catch (error) {
    console.error('[Implementation] Schedule kickoff error:', error);
    res.status(500).json({
      error: 'Failed to schedule kickoff',
      message: (error as Error).message,
    });
  }
});

// ============================================
// POST /api/implementations/:id/kickoff-deck
// Generate kickoff deck (FR-8)
// ============================================

router.post('/:id/kickoff-deck', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const result = await implementationService.generateKickoffDeck(userId, id);

    if (!result) {
      return res.status(400).json({ error: 'Failed to generate kickoff deck' });
    }

    res.json({
      success: true,
      deckId: result.deckId,
      deckUrl: result.deckUrl,
    });
  } catch (error) {
    console.error('[Implementation] Generate deck error:', error);
    res.status(500).json({
      error: 'Failed to generate kickoff deck',
      message: (error as Error).message,
    });
  }
});

// ============================================
// POST /api/implementations/:id/handoff
// Assemble handoff package (FR-4)
// ============================================

router.post('/:id/handoff', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;
    const handoffData = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const project = await implementationService.getProject(id);
    if (!project) {
      return res.status(404).json({ error: 'Implementation project not found' });
    }

    const handoffPackage = await implementationService.assembleHandoffPackage(
      userId,
      id,
      { customerId: project.customerId, handoffData }
    );

    res.json({
      success: true,
      handoffPackage,
    });
  } catch (error) {
    console.error('[Implementation] Assemble handoff error:', error);
    res.status(500).json({
      error: 'Failed to assemble handoff package',
      message: (error as Error).message,
    });
  }
});

// ============================================
// GET /api/implementations/stats
// Get implementation statistics
// ============================================

router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    const projects = await implementationService.listProjects(userId);

    const stats = {
      total: projects.length,
      byStatus: {
        initiated: 0,
        planning: 0,
        executing: 0,
        closing: 0,
        completed: 0,
        on_hold: 0,
        cancelled: 0,
      },
      averageTimeToKickoff: 0,
      averageTimeToGoLive: 0,
    };

    for (const project of projects) {
      stats.byStatus[project.status]++;
    }

    // Calculate averages for completed projects
    const completedProjects = projects.filter((p) => p.status === 'completed');
    if (completedProjects.length > 0) {
      let totalKickoffDays = 0;
      let totalGoLiveDays = 0;
      let kickoffCount = 0;
      let goLiveCount = 0;

      for (const project of completedProjects) {
        if (project.kickoffMeeting.scheduledAt) {
          totalKickoffDays +=
            (project.kickoffMeeting.scheduledAt.getTime() - project.startDate.getTime()) /
            (1000 * 60 * 60 * 24);
          kickoffCount++;
        }
        if (project.actualGoLiveDate) {
          totalGoLiveDays +=
            (project.actualGoLiveDate.getTime() - project.startDate.getTime()) /
            (1000 * 60 * 60 * 24);
          goLiveCount++;
        }
      }

      stats.averageTimeToKickoff = kickoffCount > 0 ? Math.round(totalKickoffDays / kickoffCount) : 0;
      stats.averageTimeToGoLive = goLiveCount > 0 ? Math.round(totalGoLiveDays / goLiveCount) : 0;
    }

    res.json(stats);
  } catch (error) {
    console.error('[Implementation] Get stats error:', error);
    res.status(500).json({
      error: 'Failed to get implementation stats',
      message: (error as Error).message,
    });
  }
});

export default router;
