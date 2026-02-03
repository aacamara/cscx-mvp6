/**
 * PRD-121: Escalation API Routes
 * PRD-236: Intelligent Escalation Routing
 *
 * API endpoints for escalation management, war room operations,
 * and intelligent routing.
 */

import { Router, Request, Response } from 'express';
import { escalationService } from '../services/escalation/index.js';
import { warRoomService } from '../services/warRoom/index.js';
import { escalationRoutingService } from '../services/escalation/routing.js';
import { issueClassifier } from '../services/escalation/classifier.js';
import type {
  CreateEscalationRequest,
  UpdateEscalationStatusRequest,
  AddStatusUpdateRequest,
  ResolveEscalationRequest,
  EscalationFilters,
  EscalationSeverity,
  EscalationStatus,
} from '../../types/escalation.js';

const router = Router();

// ============================================
// ESCALATION CRUD
// ============================================

/**
 * POST /api/escalations
 * Create a new escalation (automatically creates war room)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const request: CreateEscalationRequest = req.body;

    // Validate required fields
    if (!request.customerId || !request.severity || !request.category || !request.title) {
      return res.status(400).json({
        error: 'Missing required fields: customerId, severity, category, title',
      });
    }

    // Validate severity
    if (!['P1', 'P2', 'P3'].includes(request.severity)) {
      return res.status(400).json({
        error: 'Invalid severity. Must be P1, P2, or P3',
      });
    }

    // Validate category
    const validCategories = ['technical', 'support', 'product', 'commercial', 'relationship'];
    if (!validCategories.includes(request.category)) {
      return res.status(400).json({
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      });
    }

    const result = await escalationService.createEscalation(userId, request);

    res.status(201).json({
      success: true,
      escalation: result.escalation,
      warRoom: {
        id: result.warRoom.id,
        slackChannelId: result.warRoom.slackChannelId,
        slackChannelName: result.warRoom.slackChannelName,
        slackChannelUrl: result.warRoom.slackChannelUrl,
        briefDocumentUrl: result.warRoom.briefDocumentUrl,
        dashboardUrl: result.warRoom.dashboardUrl,
      },
    });
  } catch (error) {
    console.error('[Escalation API] Create error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to create escalation',
    });
  }
});

/**
 * GET /api/escalations
 * List escalations with filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters: EscalationFilters = {};

    // Parse filters from query params
    if (req.query.status) {
      const statuses = (req.query.status as string).split(',') as EscalationStatus[];
      filters.status = statuses.length === 1 ? statuses[0] : statuses;
    }

    if (req.query.severity) {
      const severities = (req.query.severity as string).split(',') as EscalationSeverity[];
      filters.severity = severities.length === 1 ? severities[0] : severities;
    }

    if (req.query.category) {
      filters.category = req.query.category as any;
    }

    if (req.query.customerId) {
      filters.customerId = req.query.customerId as string;
    }

    if (req.query.ownerId) {
      filters.ownerId = req.query.ownerId as string;
    }

    if (req.query.createdAfter) {
      filters.createdAfter = new Date(req.query.createdAfter as string);
    }

    if (req.query.createdBefore) {
      filters.createdBefore = new Date(req.query.createdBefore as string);
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);

    const result = await escalationService.listEscalations(filters, page, pageSize);

    res.json(result);
  } catch (error) {
    console.error('[Escalation API] List error:', error);
    res.status(500).json({ error: 'Failed to list escalations' });
  }
});

/**
 * GET /api/escalations/active
 * Get active escalations (for dashboard)
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const escalations = await escalationService.getActiveEscalations();
    res.json({ escalations });
  } catch (error) {
    console.error('[Escalation API] Active list error:', error);
    res.status(500).json({ error: 'Failed to get active escalations' });
  }
});

/**
 * GET /api/escalations/:id
 * Get escalation by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const escalation = await escalationService.getEscalation(req.params.id);

    if (!escalation) {
      return res.status(404).json({ error: 'Escalation not found' });
    }

    res.json({ escalation });
  } catch (error) {
    console.error('[Escalation API] Get error:', error);
    res.status(500).json({ error: 'Failed to get escalation' });
  }
});

/**
 * GET /api/escalations/:id/full
 * Get escalation with war room details
 */
router.get('/:id/full', async (req: Request, res: Response) => {
  try {
    const result = await escalationService.getEscalationWithWarRoom(req.params.id);

    if (!result) {
      return res.status(404).json({ error: 'Escalation not found' });
    }

    res.json(result);
  } catch (error) {
    console.error('[Escalation API] Get full error:', error);
    res.status(500).json({ error: 'Failed to get escalation details' });
  }
});

// ============================================
// STATUS UPDATES
// ============================================

/**
 * PUT /api/escalations/:id/status
 * Update escalation status
 */
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const request: UpdateEscalationStatusRequest = req.body;

    if (!request.status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['active', 'resolved', 'post_mortem', 'closed'];
    if (!validStatuses.includes(request.status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const escalation = await escalationService.updateStatus(
      userId,
      req.params.id,
      request
    );

    res.json({ success: true, escalation });
  } catch (error) {
    console.error('[Escalation API] Update status error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to update status',
    });
  }
});

/**
 * POST /api/escalations/:id/update
 * Add a status update to an escalation
 */
router.post('/:id/update', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const request: AddStatusUpdateRequest = req.body;

    if (!request.summary) {
      return res.status(400).json({ error: 'Summary is required' });
    }

    await escalationService.addStatusUpdate(userId, req.params.id, request);

    res.json({ success: true });
  } catch (error) {
    console.error('[Escalation API] Add update error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to add status update',
    });
  }
});

// ============================================
// RESOLUTION
// ============================================

/**
 * POST /api/escalations/:id/resolve
 * Resolve an escalation
 */
router.post('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const request: ResolveEscalationRequest = req.body;

    if (!request.summary || !request.actionsTaken || request.actionsTaken.length === 0) {
      return res.status(400).json({
        error: 'Summary and actionsTaken are required',
      });
    }

    const escalation = await escalationService.resolveEscalation(
      userId,
      req.params.id,
      request
    );

    res.json({ success: true, escalation });
  } catch (error) {
    console.error('[Escalation API] Resolve error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to resolve escalation',
    });
  }
});

/**
 * POST /api/escalations/:id/close
 * Close an escalation and archive the war room
 */
router.post('/:id/close', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    await escalationService.closeEscalation(userId, req.params.id);

    res.json({ success: true });
  } catch (error) {
    console.error('[Escalation API] Close error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to close escalation',
    });
  }
});

// ============================================
// WAR ROOM OPERATIONS
// ============================================

/**
 * GET /api/escalations/:id/war-room
 * Get war room for an escalation
 */
router.get('/:id/war-room', async (req: Request, res: Response) => {
  try {
    const warRoom = await warRoomService.getWarRoomByEscalation(req.params.id);

    if (!warRoom) {
      return res.status(404).json({ error: 'War room not found' });
    }

    res.json({ warRoom });
  } catch (error) {
    console.error('[Escalation API] Get war room error:', error);
    res.status(500).json({ error: 'Failed to get war room' });
  }
});

/**
 * POST /api/escalations/:id/war-room/status-update
 * Add status update to war room
 */
router.post('/:id/war-room/status-update', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const warRoom = await warRoomService.getWarRoomByEscalation(req.params.id);
    if (!warRoom) {
      return res.status(404).json({ error: 'War room not found' });
    }

    const { summary, progress, blockers, nextActions } = req.body;

    if (!summary) {
      return res.status(400).json({ error: 'Summary is required' });
    }

    const statusUpdate = await warRoomService.addStatusUpdate(userId, warRoom.id, {
      status: 'in_progress',
      summary,
      progress,
      blockers,
      nextActions,
      updatedBy: userId,
    });

    res.json({ success: true, statusUpdate });
  } catch (error) {
    console.error('[Escalation API] War room status update error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to add status update',
    });
  }
});

// ============================================
// DETECTION TRIGGERS
// ============================================

/**
 * POST /api/escalations/detect/support-ticket
 * Detect escalation from a support ticket
 */
router.post('/detect/support-ticket', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { ticketId, customerId, subject, description, priority, category } = req.body;

    if (!ticketId || !customerId || !subject || !priority) {
      return res.status(400).json({
        error: 'Missing required fields: ticketId, customerId, subject, priority',
      });
    }

    const result = await escalationService.detectFromSupportTicket(userId, {
      id: ticketId,
      customerId,
      subject,
      description: description || subject,
      priority,
      category,
    });

    if (!result) {
      return res.json({
        success: true,
        escalated: false,
        message: 'Ticket does not meet escalation criteria',
      });
    }

    res.status(201).json({
      success: true,
      escalated: true,
      escalation: result.escalation,
      warRoom: {
        id: result.warRoom.id,
        slackChannelUrl: result.warRoom.slackChannelUrl,
        dashboardUrl: result.warRoom.dashboardUrl,
      },
    });
  } catch (error) {
    console.error('[Escalation API] Detect from ticket error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to process support ticket',
    });
  }
});

/**
 * POST /api/escalations/detect/risk-signal
 * Detect escalation from a risk signal
 */
router.post('/detect/risk-signal', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { customerId, severity, type, description } = req.body;

    if (!customerId || !severity || !type || !description) {
      return res.status(400).json({
        error: 'Missing required fields: customerId, severity, type, description',
      });
    }

    const result = await escalationService.detectFromRiskSignal(userId, customerId, {
      severity,
      type,
      description,
    });

    if (!result) {
      return res.json({
        success: true,
        escalated: false,
        message: 'Risk signal does not meet escalation criteria',
      });
    }

    res.status(201).json({
      success: true,
      escalated: true,
      escalation: result.escalation,
      warRoom: {
        id: result.warRoom.id,
        slackChannelUrl: result.warRoom.slackChannelUrl,
        dashboardUrl: result.warRoom.dashboardUrl,
      },
    });
  } catch (error) {
    console.error('[Escalation API] Detect from risk signal error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to process risk signal',
    });
  }
});

// ============================================
// METRICS
// ============================================

/**
 * GET /api/escalations/metrics
 * Get escalation metrics for dashboard
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const [active, recentResolved] = await Promise.all([
      escalationService.listEscalations({ status: ['active', 'post_mortem'] }),
      escalationService.listEscalations({ status: 'resolved' }, 1, 10),
    ]);

    // Calculate metrics
    const activeByPriority = {
      P1: active.escalations.filter(e => e.severity === 'P1').length,
      P2: active.escalations.filter(e => e.severity === 'P2').length,
      P3: active.escalations.filter(e => e.severity === 'P3').length,
    };

    const activeByCategory: Record<string, number> = {};
    for (const esc of active.escalations) {
      activeByCategory[esc.category] = (activeByCategory[esc.category] || 0) + 1;
    }

    // Calculate average time to resolution for recent escalations
    const resolvedWithTime = recentResolved.escalations
      .filter(e => e.resolvedAt)
      .map(e => ({
        duration: new Date(e.resolvedAt!).getTime() - new Date(e.createdAt).getTime(),
      }));

    const avgResolutionTime = resolvedWithTime.length > 0
      ? resolvedWithTime.reduce((sum, e) => sum + e.duration, 0) / resolvedWithTime.length
      : 0;

    res.json({
      metrics: {
        totalActive: active.total,
        activeByPriority,
        activeByCategory,
        recentResolved: recentResolved.total,
        avgResolutionTimeMs: avgResolutionTime,
        avgResolutionTimeHours: avgResolutionTime / (1000 * 60 * 60),
      },
    });
  } catch (error) {
    console.error('[Escalation API] Metrics error:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// ============================================
// PRD-236: INTELLIGENT ROUTING
// ============================================

/**
 * GET /api/escalations/routing-preview
 * Preview routing for an escalation before submission
 */
router.post('/routing-preview', async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      customerId,
      customerName,
      customerTier,
      customerARR,
      healthScore,
      severity,
      category,
    } = req.body;

    if (!title || !description || !customerId) {
      return res.status(400).json({
        error: 'Missing required fields: title, description, customerId',
      });
    }

    const routingDecision = await escalationRoutingService.previewRouting({
      title,
      description,
      customerId,
      customerName,
      customerTier,
      customerARR,
      healthScore,
      severity,
      category,
    });

    res.json({
      success: true,
      routing: routingDecision,
    });
  } catch (error) {
    console.error('[Escalation API] Routing preview error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to generate routing preview',
    });
  }
});

/**
 * POST /api/escalations/classify
 * Classify an escalation issue
 */
router.post('/classify', async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      customerId,
      customerName,
      customerTier,
      customerARR,
      healthScore,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        error: 'Missing required fields: title, description',
      });
    }

    const classification = await issueClassifier.classifyIssue({
      title,
      description,
      customerId: customerId || '',
      customerName,
      customerTier,
      customerARR,
      healthScore,
    });

    res.json({
      success: true,
      classification,
    });
  } catch (error) {
    console.error('[Escalation API] Classification error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to classify issue',
    });
  }
});

/**
 * PUT /api/escalations/:id/reassign
 * Reassign an escalation to a new team member
 */
router.put('/:id/reassign', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { newAssigneeId, reason } = req.body;

    if (!newAssigneeId) {
      return res.status(400).json({ error: 'newAssigneeId is required' });
    }

    const newAssignee = await escalationRoutingService.reassignEscalation(
      req.params.id,
      newAssigneeId,
      reason || 'Manual reassignment'
    );

    // Update the escalation owner
    const escalation = await escalationService.getEscalation(req.params.id);
    if (escalation) {
      escalation.ownerId = newAssignee.userId;
      escalation.ownerName = newAssignee.userName;
      escalation.timeline.push({
        id: `tl_${Date.now()}`,
        timestamp: new Date(),
        type: 'status_change',
        title: 'Escalation Reassigned',
        description: `Reassigned to ${newAssignee.userName}. Reason: ${reason || 'Manual reassignment'}`,
        userId,
      });
      await escalationService.saveEscalation(escalation);
    }

    res.json({
      success: true,
      newAssignee,
    });
  } catch (error) {
    console.error('[Escalation API] Reassign error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to reassign escalation',
    });
  }
});

/**
 * POST /api/escalations/with-routing
 * Create an escalation with intelligent routing
 */
router.post('/with-routing', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const {
      customerId,
      title,
      description,
      impact,
      customerContacts,
      // Let the system determine these if not provided
      severity: providedSeverity,
      category: providedCategory,
    } = req.body;

    if (!customerId || !title || !description) {
      return res.status(400).json({
        error: 'Missing required fields: customerId, title, description',
      });
    }

    // 1. Get customer info for routing
    const customer = await getCustomerInfo(customerId);

    // 2. Get routing preview (includes classification)
    const routingDecision = await escalationRoutingService.previewRouting({
      title,
      description,
      customerId,
      customerName: customer?.name,
      customerTier: customer?.segment,
      customerARR: customer?.arr,
      healthScore: customer?.healthScore,
      severity: providedSeverity,
      category: providedCategory,
    });

    // 3. Create the escalation with AI-determined or provided severity/category
    const createRequest: CreateEscalationRequest = {
      customerId,
      severity: providedSeverity || routingDecision.classification.severity,
      category: providedCategory || routingDecision.classification.category,
      title,
      description,
      impact: impact || routingDecision.classification.keyIssues.join('; '),
      customerContacts,
    };

    const result = await escalationService.createEscalation(userId, createRequest);

    // 4. Route the escalation
    const finalRouting = await escalationRoutingService.routeEscalation(
      result.escalation.id,
      routingDecision.classification,
      customer?.segment,
      customer?.arr
    );

    // 5. Update escalation with routing info
    result.escalation.ownerId = finalRouting.primary.userId;
    result.escalation.ownerName = finalRouting.primary.userName;
    result.escalation.timeline.push({
      id: `tl_${Date.now()}`,
      timestamp: new Date(),
      type: 'participant_added',
      title: 'Intelligent Routing Applied',
      description: finalRouting.routingReason,
      metadata: {
        primary: finalRouting.primary,
        secondary: finalRouting.secondary,
        executiveSponsor: finalRouting.executiveSponsor,
        estimatedResponseTime: finalRouting.estimatedResponseTime,
      },
    });
    await escalationService.saveEscalation(result.escalation);

    res.status(201).json({
      success: true,
      escalation: result.escalation,
      warRoom: {
        id: result.warRoom.id,
        slackChannelId: result.warRoom.slackChannelId,
        slackChannelName: result.warRoom.slackChannelName,
        slackChannelUrl: result.warRoom.slackChannelUrl,
        briefDocumentUrl: result.warRoom.briefDocumentUrl,
        dashboardUrl: result.warRoom.dashboardUrl,
      },
      routing: {
        primary: finalRouting.primary,
        secondary: finalRouting.secondary,
        executiveSponsor: finalRouting.executiveSponsor,
        standbyTeam: finalRouting.standbyTeam,
        estimatedResponseTime: finalRouting.estimatedResponseTime,
        classification: finalRouting.classification,
      },
    });
  } catch (error) {
    console.error('[Escalation API] Create with routing error:', error);
    res.status(500).json({
      error: (error as Error).message || 'Failed to create escalation with routing',
    });
  }
});

/**
 * GET /api/escalations/team-availability
 * Get team member availability for routing
 */
router.get('/team-availability', async (req: Request, res: Response) => {
  try {
    // This would integrate with a real availability system
    // For now, return basic team info
    res.json({
      success: true,
      teamMembers: [
        {
          id: 'user_james',
          name: 'James Wilson',
          role: 'Sr. Solutions Architect',
          available: true,
          currentLoad: 2,
          expertise: ['API Integration', 'Engineering'],
        },
        {
          id: 'user_sarah',
          name: 'Sarah Chen',
          role: 'Customer Success Manager',
          available: true,
          currentLoad: 1,
          expertise: ['Customer Success', 'Account Management'],
        },
        {
          id: 'user_mike',
          name: 'Mike Johnson',
          role: 'Product Manager',
          available: false,
          currentLoad: 3,
          expertise: ['Product', 'Roadmap'],
        },
        {
          id: 'user_lisa',
          name: 'Lisa Park',
          role: 'VP Engineering',
          available: true,
          currentLoad: 0,
          expertise: ['Executive', 'Leadership'],
        },
      ],
    });
  } catch (error) {
    console.error('[Escalation API] Team availability error:', error);
    res.status(500).json({ error: 'Failed to get team availability' });
  }
});

// Helper function to get customer info
async function getCustomerInfo(customerId: string): Promise<{
  name: string;
  segment?: string;
  arr?: number;
  healthScore?: number;
} | null> {
  // This would typically query the database
  // For now, return mock data or null
  return null;
}

export default router;
