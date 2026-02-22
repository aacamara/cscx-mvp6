/**
 * Stakeholder Relationship Map Routes
 * PRD-063: API endpoints for stakeholder relationship mapping and visualization
 */

import { Router, Request, Response } from 'express';
import { stakeholderRelationshipMapService } from '../services/stakeholderRelationshipMap.js';
import { authMiddleware } from '../middleware/auth.js';
import { applyOrgFilter, withOrgId } from '../middleware/orgFilter.js';

const router = Router();

/**
 * GET /api/intelligence/stakeholder-map/:customerId
 * Get the full stakeholder relationship map for a customer
 *
 * Query Parameters:
 * - view: 'org_chart' | 'influence_map' | 'engagement_view' (default: 'org_chart')
 * - includeFormer: 'true' | 'false' (default: 'false')
 */
router.get('/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const view = (req.query.view as string) || 'org_chart';
    const includeFormer = req.query.includeFormer === 'true';

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
      });
    }

    const validViews = ['org_chart', 'influence_map', 'engagement_view'];
    if (!validViews.includes(view)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_VIEW_MODE',
          message: `View mode must be one of: ${validViews.join(', ')}`,
        },
      });
    }

    const mapData = await stakeholderRelationshipMapService.getStakeholderMap(
      customerId,
      view as 'org_chart' | 'influence_map' | 'engagement_view',
      includeFormer
    );

    if (!mapData) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: 'Customer not found or has no stakeholder data',
        },
      });
    }

    res.json({
      success: true,
      data: mapData,
    });
  } catch (error) {
    console.error('[StakeholderMap] Error getting stakeholder map:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get stakeholder map',
      },
    });
  }
});

/**
 * GET /api/intelligence/stakeholder-map/:customerId/score
 * Get the multi-threading score for a customer
 */
router.get('/:customerId/score', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
      });
    }

    const score = await stakeholderRelationshipMapService.calculateMultiThreadingScore(customerId);

    res.json({
      success: true,
      data: {
        customerId,
        score,
        calculatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[StakeholderMap] Error calculating score:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to calculate multi-threading score',
      },
    });
  }
});

/**
 * GET /api/intelligence/stakeholder-map/:customerId/actions
 * Get recommended relationship actions for a customer
 */
router.get('/:customerId/actions', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
      });
    }

    const actions = await stakeholderRelationshipMapService.getRelationshipActions(customerId);

    res.json({
      success: true,
      data: {
        customerId,
        actions,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[StakeholderMap] Error getting actions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get relationship actions',
      },
    });
  }
});

/**
 * POST /api/intelligence/stakeholder-map/:customerId/relationships
 * Create or update a stakeholder relationship
 */
router.post('/:customerId/relationships', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { fromId, toId, relationshipType, strength, notes } = req.body;

    if (!customerId || !fromId || !toId || !relationshipType) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'customerId, fromId, toId, and relationshipType are required',
        },
      });
    }

    const validTypes = ['reports_to', 'collaborates_with', 'influences', 'blocks'];
    if (!validTypes.includes(relationshipType)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RELATIONSHIP_TYPE',
          message: `relationshipType must be one of: ${validTypes.join(', ')}`,
        },
      });
    }

    const validStrengths = ['strong', 'moderate', 'weak'];
    if (strength && !validStrengths.includes(strength)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STRENGTH',
          message: `strength must be one of: ${validStrengths.join(', ')}`,
        },
      });
    }

    const relationship = await stakeholderRelationshipMapService.createRelationship(
      fromId,
      toId,
      relationshipType,
      strength || 'moderate',
      notes
    );

    if (!relationship) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create relationship',
        },
      });
    }

    res.status(201).json({
      success: true,
      data: { relationship },
    });
  } catch (error) {
    console.error('[StakeholderMap] Error creating relationship:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create relationship',
      },
    });
  }
});

/**
 * DELETE /api/intelligence/stakeholder-map/:customerId/relationships/:relationshipId
 * Delete a stakeholder relationship
 */
router.delete('/:customerId/relationships/:relationshipId', async (req: Request, res: Response) => {
  try {
    const { relationshipId } = req.params;

    if (!relationshipId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_RELATIONSHIP_ID',
          message: 'Relationship ID is required',
        },
      });
    }

    const success = await stakeholderRelationshipMapService.deleteRelationship(relationshipId);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete relationship',
        },
      });
    }

    res.json({
      success: true,
      message: 'Relationship deleted successfully',
    });
  } catch (error) {
    console.error('[StakeholderMap] Error deleting relationship:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete relationship',
      },
    });
  }
});

/**
 * PATCH /api/intelligence/stakeholder-map/:customerId/stakeholders/:stakeholderId
 * Update stakeholder relationship attributes
 */
router.patch('/:customerId/stakeholders/:stakeholderId', async (req: Request, res: Response) => {
  try {
    const { stakeholderId } = req.params;
    const updates = req.body;

    if (!stakeholderId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_STAKEHOLDER_ID',
          message: 'Stakeholder ID is required',
        },
      });
    }

    // Validate enum fields
    const validRoles = ['champion', 'sponsor', 'influencer', 'user', 'detractor', 'blocker'];
    if (updates.stakeholderRole && !validRoles.includes(updates.stakeholderRole)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STAKEHOLDER_ROLE',
          message: `stakeholderRole must be one of: ${validRoles.join(', ')}`,
        },
      });
    }

    const validInfluence = ['high', 'medium', 'low'];
    if (updates.influenceLevel && !validInfluence.includes(updates.influenceLevel)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INFLUENCE_LEVEL',
          message: `influenceLevel must be one of: ${validInfluence.join(', ')}`,
        },
      });
    }

    const validSentiment = ['positive', 'neutral', 'negative', 'unknown'];
    if (updates.sentiment && !validSentiment.includes(updates.sentiment)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SENTIMENT',
          message: `sentiment must be one of: ${validSentiment.join(', ')}`,
        },
      });
    }

    const validChannels = ['email', 'phone', 'slack', 'in_person'];
    if (updates.preferredChannel && !validChannels.includes(updates.preferredChannel)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PREFERRED_CHANNEL',
          message: `preferredChannel must be one of: ${validChannels.join(', ')}`,
        },
      });
    }

    const stakeholder = await stakeholderRelationshipMapService.updateStakeholder(
      stakeholderId,
      updates
    );

    if (!stakeholder) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'STAKEHOLDER_NOT_FOUND',
          message: 'Stakeholder not found or update failed',
        },
      });
    }

    res.json({
      success: true,
      data: { stakeholder },
    });
  } catch (error) {
    console.error('[StakeholderMap] Error updating stakeholder:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update stakeholder',
      },
    });
  }
});

export default router;
