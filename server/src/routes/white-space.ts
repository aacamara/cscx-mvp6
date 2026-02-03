/**
 * PRD-071: White Space Analysis Routes
 *
 * API endpoints for white space analysis:
 * - GET  /api/intelligence/white-space/:customerId - Analyze white space for customer
 * - POST /api/intelligence/white-space/:customerId/export - Export analysis
 * - POST /api/intelligence/white-space/:customerId/proposal - Generate proposal
 */

import { Router, Request, Response } from 'express';
import { whiteSpaceAnalysisService } from '../services/whiteSpaceAnalysis.js';

const router = Router();

// ============================================
// Main White Space Analysis Endpoint
// ============================================

/**
 * GET /api/intelligence/white-space/:customerId
 *
 * Generate comprehensive white space analysis for a customer.
 * Identifies untapped opportunities in products, users, and use cases.
 *
 * Query Parameters:
 * - focus (optional): 'products', 'users', 'use_cases', 'all' (default: 'all')
 */
router.get('/:customerId', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { customerId } = req.params;
    const focusArea = (req.query.focus as 'products' | 'users' | 'use_cases' | 'all') || 'all';

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
      });
    }

    // Validate focus area
    const validFocusAreas = ['products', 'users', 'use_cases', 'all'];
    if (!validFocusAreas.includes(focusArea)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FOCUS_AREA',
          message: `Focus area must be one of: ${validFocusAreas.join(', ')}`,
        },
      });
    }

    const analysis = await whiteSpaceAnalysisService.analyzeWhiteSpace(customerId, focusArea);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: `Could not find customer with ID '${customerId}'`,
        },
      });
    }

    const responseTime = Date.now() - startTime;

    console.log(`[WhiteSpace] Analysis generated for ${analysis.customerName} in ${responseTime}ms`);
    console.log(`[WhiteSpace] Total potential value: $${analysis.totalPotentialValue.toLocaleString()}`);

    // Warn if over 5 second target
    if (responseTime > 5000) {
      console.warn(`[WhiteSpace] Analysis exceeded 5s target: ${responseTime}ms`);
    }

    return res.json({
      success: true,
      data: analysis,
      meta: {
        generatedAt: analysis.generatedAt,
        responseTimeMs: responseTime,
        focusArea,
        opportunityCount: analysis.prioritizedOpportunities.length,
        totalPotentialValue: analysis.totalPotentialValue,
      },
    });
  } catch (error) {
    console.error('[WhiteSpace] Analysis error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate white space analysis',
      },
    });
  }
});

// ============================================
// Export White Space Analysis
// ============================================

/**
 * POST /api/intelligence/white-space/:customerId/export
 *
 * Export white space analysis in various formats.
 *
 * Request Body:
 * - format (optional): 'csv', 'pdf', 'json' (default: 'csv')
 * - includeDetails (optional): Include full opportunity details (default: true)
 * - includeProposal (optional): Include expansion proposal (default: true)
 * - includePeerComparison (optional): Include peer comparison (default: true)
 */
router.post('/:customerId/export', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const {
      format = 'csv',
      includeDetails = true,
      includeProposal = true,
      includePeerComparison = true,
    } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
      });
    }

    // Generate analysis
    const analysis = await whiteSpaceAnalysisService.analyzeWhiteSpace(customerId, 'all');

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: `Could not find customer with ID '${customerId}'`,
        },
      });
    }

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Category',
        'Opportunity',
        'Type',
        'Potential Value',
        'Confidence',
        'Relevance Score',
        'Key Signals',
        'Next Steps',
      ];

      const rows = analysis.prioritizedOpportunities.map(o => [
        o.category,
        o.name,
        o.type,
        o.potentialValue,
        o.confidence,
        o.relevanceScore,
        o.signals.join('; '),
        o.nextSteps.join('; '),
      ]);

      const csv = [
        `White Space Analysis: ${analysis.customerName}`,
        `Generated: ${analysis.generatedAt}`,
        `Total Potential Value: $${analysis.totalPotentialValue.toLocaleString()}`,
        '',
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="white-space-${analysis.customerName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv"`
      );
      return res.send(csv);
    }

    if (format === 'json') {
      // Return JSON with optional sections
      const exportData: any = {
        summary: {
          customerId: analysis.customerId,
          customerName: analysis.customerName,
          generatedAt: analysis.generatedAt,
          totalPotentialValue: analysis.totalPotentialValue,
          summary: analysis.summary,
        },
        opportunities: analysis.prioritizedOpportunities,
      };

      if (includeDetails) {
        exportData.categories = analysis.categories;
      }

      if (includeProposal) {
        exportData.expansionProposal = analysis.expansionProposal;
      }

      if (includePeerComparison) {
        exportData.peerComparison = analysis.peerComparison;
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="white-space-${analysis.customerName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json"`
      );
      return res.json(exportData);
    }

    // PDF format placeholder
    if (format === 'pdf') {
      return res.json({
        success: true,
        data: {
          message: 'PDF export functionality coming soon',
          customerId,
          format,
          estimatedDelivery: 'Q2 2026',
        },
      });
    }

    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FORMAT',
        message: "Format must be one of: 'csv', 'pdf', 'json'",
      },
    });
  } catch (error) {
    console.error('[WhiteSpace] Export error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to export white space analysis',
      },
    });
  }
});

// ============================================
// Generate Expansion Proposal
// ============================================

/**
 * POST /api/intelligence/white-space/:customerId/proposal
 *
 * Generate a customized expansion proposal from white space analysis.
 *
 * Request Body:
 * - opportunityIds (optional): Specific opportunities to include
 * - maxItems (optional): Maximum items in proposal (default: 4)
 * - discountTier (optional): 'standard', 'premium', 'strategic' (default: 'standard')
 */
router.post('/:customerId/proposal', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { opportunityIds, maxItems = 4, discountTier = 'standard' } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CUSTOMER_ID',
          message: 'Customer ID is required',
        },
      });
    }

    // Generate analysis
    const analysis = await whiteSpaceAnalysisService.analyzeWhiteSpace(customerId, 'all');

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: `Could not find customer with ID '${customerId}'`,
        },
      });
    }

    // Filter opportunities if specific IDs provided
    let selectedOpportunities = analysis.prioritizedOpportunities;
    if (opportunityIds && Array.isArray(opportunityIds)) {
      selectedOpportunities = selectedOpportunities.filter(o =>
        opportunityIds.includes(o.id)
      );
    }

    // Limit to maxItems
    selectedOpportunities = selectedOpportunities.slice(0, maxItems);

    // Apply discount tier
    const discountRates: Record<string, Record<string, number>> = {
      standard: { high: 10, medium: 7, low: 5 },
      premium: { high: 15, medium: 12, low: 8 },
      strategic: { high: 20, medium: 15, low: 12 },
    };

    const rates = discountRates[discountTier] || discountRates.standard;

    const proposalItems = selectedOpportunities.map(o => {
      const discount = rates[o.confidence] || rates.medium;
      return {
        item: o.name,
        category: o.category,
        description: o.description,
        annualValue: o.potentialValue,
        discount,
        netValue: Math.round(o.potentialValue * (1 - discount / 100)),
        confidence: o.confidence,
        whyIncluded: o.whyItFits || [],
      };
    });

    const proposal = {
      customerId: analysis.customerId,
      customerName: analysis.customerName,
      generatedAt: new Date().toISOString(),
      discountTier,
      items: proposalItems,
      summary: {
        itemCount: proposalItems.length,
        totalAnnualValue: proposalItems.reduce((sum, i) => sum + i.annualValue, 0),
        totalDiscount: proposalItems.reduce((sum, i) => sum + (i.annualValue - i.netValue), 0),
        totalNetValue: proposalItems.reduce((sum, i) => sum + i.netValue, 0),
      },
      valueProposition: [
        'Consolidate existing point solutions for cost savings',
        'Enable new capabilities across additional departments',
        'Increase platform ROI with advanced features',
        'Future-proof technology investment',
      ],
      timeline: {
        immediate: proposalItems.filter(i => i.confidence === 'high').map(i => i.item),
        thisQuarter: proposalItems.filter(i => i.confidence === 'medium').map(i => i.item),
        nextQuarter: proposalItems.filter(i => i.confidence === 'low').map(i => i.item),
      },
      nextSteps: [
        'Review proposal with customer stakeholders',
        'Schedule deep-dive sessions for top priorities',
        'Prepare ROI analysis for each item',
        'Draft contract amendment',
      ],
    };

    console.log(`[WhiteSpace] Proposal generated for ${analysis.customerName}: ${proposalItems.length} items, $${proposal.summary.totalNetValue.toLocaleString()} net value`);

    return res.json({
      success: true,
      data: proposal,
      meta: {
        generatedAt: proposal.generatedAt,
        itemCount: proposalItems.length,
        discountTier,
      },
    });
  } catch (error) {
    console.error('[WhiteSpace] Proposal generation error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate expansion proposal',
      },
    });
  }
});

// ============================================
// Quick Actions
// ============================================

/**
 * POST /api/intelligence/white-space/:customerId/actions/:actionType
 *
 * Execute quick actions from the white space analysis.
 * Supported actions: schedule_demo, send_one_pager, create_proposal, share_with_ae
 */
router.post('/:customerId/actions/:actionType', async (req: Request, res: Response) => {
  try {
    const { customerId, actionType } = req.params;
    const { opportunityId, recipientEmail, notes } = req.body;

    const supportedActions = ['schedule_demo', 'send_one_pager', 'create_proposal', 'share_with_ae', 'schedule_strategy_call'];

    if (!supportedActions.includes(actionType)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ACTION',
          message: `Action must be one of: ${supportedActions.join(', ')}`,
        },
      });
    }

    // Handle different action types
    let result: any = { actionType, status: 'initiated' };

    switch (actionType) {
      case 'schedule_demo':
        result = {
          actionType,
          status: 'initiated',
          message: 'Demo scheduling initiated',
          nextSteps: ['Select product for demo', 'Choose date/time', 'Invite stakeholders'],
          data: { opportunityId, customerId },
        };
        break;

      case 'send_one_pager':
        result = {
          actionType,
          status: 'initiated',
          message: 'One-pager delivery initiated',
          nextSteps: ['Select product one-pager', 'Customize for customer', 'Send email'],
          data: { opportunityId, recipientEmail },
        };
        break;

      case 'create_proposal':
        result = {
          actionType,
          status: 'initiated',
          message: 'Proposal creation initiated',
          nextSteps: ['Select opportunities', 'Configure pricing', 'Generate document'],
          data: { customerId, redirectUrl: `/api/intelligence/white-space/${customerId}/proposal` },
        };
        break;

      case 'share_with_ae':
        result = {
          actionType,
          status: 'completed',
          message: 'Analysis shared with Account Executive',
          data: { customerId, sharedWith: recipientEmail, notes },
        };
        break;

      case 'schedule_strategy_call':
        result = {
          actionType,
          status: 'initiated',
          message: 'Strategy call scheduling initiated',
          nextSteps: ['Select participants', 'Choose date/time', 'Prepare agenda'],
          data: { customerId },
        };
        break;
    }

    console.log(`[WhiteSpace] Action ${actionType} executed for customer ${customerId}`);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[WhiteSpace] Action execution error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to execute action',
      },
    });
  }
});

// ============================================
// Summary Statistics
// ============================================

/**
 * GET /api/intelligence/white-space/:customerId/summary
 *
 * Get a quick summary of white space for a customer.
 * Lighter weight than full analysis - good for overview displays.
 */
router.get('/:customerId/summary', async (req: Request, res: Response) => {
  const startTime = Date.now();

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

    const analysis = await whiteSpaceAnalysisService.analyzeWhiteSpace(customerId, 'all');

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: `Could not find customer with ID '${customerId}'`,
        },
      });
    }

    const summary = {
      customerId: analysis.customerId,
      customerName: analysis.customerName,
      totalPotentialValue: analysis.totalPotentialValue,
      opportunityCount: analysis.prioritizedOpportunities.length,
      byCategory: analysis.summary,
      topOpportunity: analysis.prioritizedOpportunities[0]
        ? {
            name: analysis.prioritizedOpportunities[0].name,
            value: analysis.prioritizedOpportunities[0].potentialValue,
            confidence: analysis.prioritizedOpportunities[0].confidence,
          }
        : null,
      peerGaps: analysis.peerComparison.filter(p => p.gap === 'under_penetrated').length,
    };

    const responseTime = Date.now() - startTime;

    return res.json({
      success: true,
      data: summary,
      meta: {
        generatedAt: analysis.generatedAt,
        responseTimeMs: responseTime,
      },
    });
  } catch (error) {
    console.error('[WhiteSpace] Summary error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate white space summary',
      },
    });
  }
});

export default router;
