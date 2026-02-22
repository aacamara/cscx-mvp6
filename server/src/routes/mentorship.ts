/**
 * PRD-255: Mentor Assignment Routes
 *
 * API endpoints for the mentorship program including:
 * - Mentor management (opt-in/out, profile, settings)
 * - Mentor matching and suggestions
 * - Assignment workflow (create, accept, decline, complete)
 * - Session logging
 * - Milestone tracking
 * - Program analytics
 */

import { Router, Request, Response } from 'express';
import { mentorshipService } from '../services/collaboration/mentorship.js';
import {
  CreateMentorRequest,
  UpdateMentorRequest,
  CreateAssignmentRequest,
  CreateSessionRequest,
  CreateMilestoneRequest,
  MentorSearchFilters,
  AssignmentStatus,
} from '../../../types/mentorship.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

// ============================================
// Mentor Management
// ============================================

/**
 * GET /api/mentorship/mentors
 * Get all mentors with optional filters
 */
router.get('/mentors', async (req: Request, res: Response) => {
  try {
    const filters: MentorSearchFilters = {};

    if (req.query.isAvailable === 'true') filters.isAvailable = true;
    if (req.query.isCertified === 'true') filters.isCertified = true;
    if (req.query.expertiseAreas) {
      filters.expertiseAreas = (req.query.expertiseAreas as string).split(',');
    }
    if (req.query.minRating) {
      filters.minRating = parseFloat(req.query.minRating as string);
    }
    if (req.query.timezone) {
      filters.timezone = req.query.timezone as string;
    }

    const mentors = await mentorshipService.getMentors(filters);

    res.json({
      success: true,
      mentors,
      count: mentors.length,
    });
  } catch (error) {
    console.error('[Mentorship Routes] Get mentors error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get mentors',
    });
  }
});

/**
 * GET /api/mentorship/mentors/:id
 * Get a single mentor by ID
 */
router.get('/mentors/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const mentor = await mentorshipService.getMentor(id);

    if (!mentor) {
      return res.status(404).json({
        success: false,
        error: 'Mentor not found',
      });
    }

    res.json({
      success: true,
      mentor,
    });
  } catch (error) {
    console.error('[Mentorship Routes] Get mentor error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get mentor',
    });
  }
});

/**
 * GET /api/mentorship/mentors/:id/profile
 * Get mentor profile with assignments and recognitions
 */
router.get('/mentors/:id/profile', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const profile = await mentorshipService.getMentorProfile(id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Mentor not found',
      });
    }

    res.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error('[Mentorship Routes] Get mentor profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get mentor profile',
    });
  }
});

/**
 * POST /api/mentorship/mentors
 * Opt-in as a mentor
 */
router.post('/mentors', async (req: Request, res: Response) => {
  try {
    const request: CreateMentorRequest = req.body;

    // Get user info from headers or auth context
    const userId = req.headers['x-user-id'] as string || 'user-new';
    const userName = req.headers['x-user-name'] as string || 'New Mentor';
    const userEmail = req.headers['x-user-email'] as string || 'new.mentor@example.com';

    // Validate required fields
    if (!request.expertiseAreas || request.expertiseAreas.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one expertise area is required',
      });
    }

    const mentor = await mentorshipService.createMentor(userId, userName, userEmail, request);

    res.status(201).json({
      success: true,
      mentor,
      message: 'Successfully registered as a mentor',
    });
  } catch (error) {
    console.error('[Mentorship Routes] Create mentor error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register as mentor',
    });
  }
});

/**
 * PATCH /api/mentorship/mentors/:id
 * Update mentor settings
 */
router.patch('/mentors/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const request: UpdateMentorRequest = req.body;

    const mentor = await mentorshipService.updateMentor(id, request);

    if (!mentor) {
      return res.status(404).json({
        success: false,
        error: 'Mentor not found',
      });
    }

    res.json({
      success: true,
      mentor,
    });
  } catch (error) {
    console.error('[Mentorship Routes] Update mentor error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update mentor',
    });
  }
});

/**
 * DELETE /api/mentorship/mentors/:id
 * Opt-out as a mentor (deactivate)
 */
router.delete('/mentors/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const success = await mentorshipService.deactivateMentor(id);

    if (!success) {
      return res.status(400).json({
        success: false,
        error: 'Cannot deactivate mentor. Check for active assignments or mentor not found.',
      });
    }

    res.json({
      success: true,
      message: 'Mentor deactivated successfully',
    });
  } catch (error) {
    console.error('[Mentorship Routes] Deactivate mentor error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate mentor',
    });
  }
});

// ============================================
// Mentor Matching
// ============================================

/**
 * GET /api/mentorship/mentors/matches
 * Find best mentor matches for a mentee
 */
router.get('/mentors/matches', async (req: Request, res: Response) => {
  try {
    const menteeUserId = req.query.mentee as string;
    const needs = req.query.needs ? (req.query.needs as string).split(',') : undefined;

    if (!menteeUserId) {
      return res.status(400).json({
        success: false,
        error: 'mentee query parameter is required',
      });
    }

    const matches = await mentorshipService.findBestMentors(menteeUserId, needs);

    res.json({
      success: true,
      matches,
      count: matches.length,
    });
  } catch (error) {
    console.error('[Mentorship Routes] Find matches error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find mentor matches',
    });
  }
});

// ============================================
// Assignment Management
// ============================================

/**
 * GET /api/mentorship/assignments
 * Get all mentorship assignments
 */
router.get('/assignments', async (req: Request, res: Response) => {
  try {
    const filters: { status?: AssignmentStatus; menteeUserId?: string } = {};

    if (req.query.status) {
      filters.status = req.query.status as AssignmentStatus;
    }
    if (req.query.menteeUserId) {
      filters.menteeUserId = req.query.menteeUserId as string;
    }

    const assignments = await mentorshipService.getAssignments(filters);

    res.json({
      success: true,
      assignments,
      count: assignments.length,
    });
  } catch (error) {
    console.error('[Mentorship Routes] Get assignments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get assignments',
    });
  }
});

/**
 * GET /api/mentorship/assignments/:id
 * Get a single assignment
 */
router.get('/assignments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const assignment = await mentorshipService.getAssignment(id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found',
      });
    }

    res.json({
      success: true,
      assignment,
    });
  } catch (error) {
    console.error('[Mentorship Routes] Get assignment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get assignment',
    });
  }
});

/**
 * POST /api/mentorship/assignments
 * Create a new mentorship assignment
 */
router.post('/assignments', async (req: Request, res: Response) => {
  try {
    const request: CreateAssignmentRequest = req.body;

    // Validate required fields
    if (!request.mentorId || !request.menteeUserId || !request.startDate) {
      return res.status(400).json({
        success: false,
        error: 'mentorId, menteeUserId, and startDate are required',
      });
    }

    // Validate dates
    const startDate = new Date(request.startDate);
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid startDate format',
      });
    }

    if (request.expectedEndDate) {
      const endDate = new Date(request.expectedEndDate);
      if (isNaN(endDate.getTime()) || endDate <= startDate) {
        return res.status(400).json({
          success: false,
          error: 'expectedEndDate must be after startDate',
        });
      }
    }

    // Get assigner info from headers
    const assignedByUserId = req.headers['x-user-id'] as string;
    const assignedByName = req.headers['x-user-name'] as string;

    const assignment = await mentorshipService.createAssignment(
      request,
      assignedByUserId,
      assignedByName
    );

    res.status(201).json({
      success: true,
      assignment,
      message: 'Mentorship assignment created. Awaiting mentor acceptance.',
    });
  } catch (error: any) {
    console.error('[Mentorship Routes] Create assignment error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create assignment',
    });
  }
});

/**
 * POST /api/mentorship/assignments/:id/accept
 * Mentor accepts the assignment
 */
router.post('/assignments/:id/accept', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const assignment = await mentorshipService.acceptAssignment(id, notes);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found',
      });
    }

    res.json({
      success: true,
      assignment,
      message: 'Assignment accepted successfully',
    });
  } catch (error: any) {
    console.error('[Mentorship Routes] Accept assignment error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to accept assignment',
    });
  }
});

/**
 * POST /api/mentorship/assignments/:id/decline
 * Mentor declines the assignment
 */
router.post('/assignments/:id/decline', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Decline reason is required',
      });
    }

    const assignment = await mentorshipService.declineAssignment(id, reason);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found',
      });
    }

    res.json({
      success: true,
      assignment,
      message: 'Assignment declined',
    });
  } catch (error: any) {
    console.error('[Mentorship Routes] Decline assignment error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to decline assignment',
    });
  }
});

/**
 * POST /api/mentorship/assignments/:id/complete
 * Complete a mentorship assignment
 */
router.post('/assignments/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { completionNotes, mentorFeedback } = req.body;

    const assignment = await mentorshipService.completeAssignment(id, completionNotes, mentorFeedback);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found',
      });
    }

    res.json({
      success: true,
      assignment,
      message: 'Assignment completed successfully',
    });
  } catch (error: any) {
    console.error('[Mentorship Routes] Complete assignment error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to complete assignment',
    });
  }
});

/**
 * POST /api/mentorship/assignments/:id/feedback
 * Mentee provides feedback and rating
 */
router.post('/assignments/:id/feedback', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { feedback, rating } = req.body;

    if (!feedback) {
      return res.status(400).json({
        success: false,
        error: 'Feedback is required',
      });
    }

    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5',
      });
    }

    const assignment = await mentorshipService.provideMenteeFeedback(id, feedback, rating);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found',
      });
    }

    res.json({
      success: true,
      assignment,
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    console.error('[Mentorship Routes] Provide feedback error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit feedback',
    });
  }
});

// ============================================
// Session Management
// ============================================

/**
 * GET /api/mentorship/assignments/:id/sessions
 * Get sessions for an assignment
 */
router.get('/assignments/:id/sessions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify assignment exists
    const assignment = await mentorshipService.getAssignment(id);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found',
      });
    }

    const sessions = await mentorshipService.getSessionsByAssignment(id);

    res.json({
      success: true,
      sessions,
      count: sessions.length,
    });
  } catch (error) {
    console.error('[Mentorship Routes] Get sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sessions',
    });
  }
});

/**
 * POST /api/mentorship/assignments/:id/sessions
 * Log a mentorship session
 */
router.post('/assignments/:id/sessions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const request: CreateSessionRequest = req.body;

    // Validate required fields
    if (!request.sessionDate || !request.topicsCovered || request.topicsCovered.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'sessionDate and topicsCovered are required',
      });
    }

    // Determine who is logging (would use auth context)
    const loggedBy = (req.headers['x-role'] as string) === 'mentee' ? 'mentee' : 'mentor';

    const session = await mentorshipService.createSession(id, request, loggedBy as 'mentor' | 'mentee');

    res.status(201).json({
      success: true,
      session,
      message: 'Session logged successfully',
    });
  } catch (error: any) {
    console.error('[Mentorship Routes] Create session error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to log session',
    });
  }
});

/**
 * PATCH /api/mentorship/sessions/:id
 * Update a session
 */
router.patch('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const session = await mentorshipService.updateSession(id, updates);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    res.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('[Mentorship Routes] Update session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update session',
    });
  }
});

/**
 * POST /api/mentorship/sessions/:sessionId/action-items/:itemId/complete
 * Complete an action item
 */
router.post('/sessions/:sessionId/action-items/:itemId/complete', async (req: Request, res: Response) => {
  try {
    const { sessionId, itemId } = req.params;

    const session = await mentorshipService.completeActionItem(sessionId, itemId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session or action item not found',
      });
    }

    res.json({
      success: true,
      session,
      message: 'Action item completed',
    });
  } catch (error) {
    console.error('[Mentorship Routes] Complete action item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete action item',
    });
  }
});

// ============================================
// Milestone Management
// ============================================

/**
 * GET /api/mentorship/assignments/:id/milestones
 * Get milestones for an assignment
 */
router.get('/assignments/:id/milestones', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const milestones = await mentorshipService.getMilestonesByAssignment(id);

    res.json({
      success: true,
      milestones,
      count: milestones.length,
    });
  } catch (error) {
    console.error('[Mentorship Routes] Get milestones error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get milestones',
    });
  }
});

/**
 * POST /api/mentorship/assignments/:id/milestones
 * Create a milestone
 */
router.post('/assignments/:id/milestones', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const request: CreateMilestoneRequest = req.body;

    if (!request.milestoneName) {
      return res.status(400).json({
        success: false,
        error: 'milestoneName is required',
      });
    }

    const milestone = await mentorshipService.createMilestone(id, request);

    res.status(201).json({
      success: true,
      milestone,
    });
  } catch (error: any) {
    console.error('[Mentorship Routes] Create milestone error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create milestone',
    });
  }
});

/**
 * POST /api/mentorship/milestones/:id/complete
 * Complete a milestone
 */
router.post('/milestones/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get verifier info from headers
    const verifiedByUserId = req.headers['x-user-id'] as string;
    const verifiedByUserName = req.headers['x-user-name'] as string;

    const milestone = await mentorshipService.completeMilestone(id, verifiedByUserId, verifiedByUserName);

    if (!milestone) {
      return res.status(404).json({
        success: false,
        error: 'Milestone not found',
      });
    }

    res.json({
      success: true,
      milestone,
      message: 'Milestone completed',
    });
  } catch (error) {
    console.error('[Mentorship Routes] Complete milestone error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete milestone',
    });
  }
});

// ============================================
// Analytics
// ============================================

/**
 * GET /api/mentorship/analytics
 * Get program-level metrics
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const metrics = await mentorshipService.getProgramMetrics();

    res.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('[Mentorship Routes] Get analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics',
    });
  }
});

/**
 * GET /api/mentorship/analytics/ramp-comparison
 * Get ramp time comparison (mentored vs non-mentored)
 */
router.get('/analytics/ramp-comparison', async (req: Request, res: Response) => {
  try {
    const comparison = await mentorshipService.getRampComparison();

    res.json({
      success: true,
      comparison,
    });
  } catch (error) {
    console.error('[Mentorship Routes] Get ramp comparison error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get ramp comparison',
    });
  }
});

/**
 * GET /api/mentorship/analytics/mentor-effectiveness
 * Get mentor effectiveness rankings
 */
router.get('/analytics/mentor-effectiveness', async (req: Request, res: Response) => {
  try {
    const effectiveness = await mentorshipService.getMentorEffectiveness();

    res.json({
      success: true,
      effectiveness,
    });
  } catch (error) {
    console.error('[Mentorship Routes] Get mentor effectiveness error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get mentor effectiveness',
    });
  }
});

/**
 * GET /api/mentorship/analytics/workload
 * Get mentor workload distribution
 */
router.get('/analytics/workload', async (req: Request, res: Response) => {
  try {
    const workload = await mentorshipService.getMentorWorkload();

    res.json({
      success: true,
      workload,
    });
  } catch (error) {
    console.error('[Mentorship Routes] Get workload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get workload distribution',
    });
  }
});

export default router;
