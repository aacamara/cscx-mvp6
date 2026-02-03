/**
 * Renewal Proposal Routes
 * PRD-027: Renewal Proposal Generator
 *
 * API endpoints for generating, previewing, and sending renewal proposals
 */

import { Router, Request, Response } from 'express';
import { renewalProposalGenerator } from '../services/renewal/proposalGenerator.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { activityLogger } from '../services/activityLogger.js';

const router = Router();

/**
 * POST /api/customers/:id/renewal-proposal
 * Generate a complete renewal proposal package
 *
 * Body params:
 * - generateSlides: boolean (optional) - Whether to generate presentation slides
 * - customPricingOptions: array (optional) - Override default pricing options
 */
router.post('/:id/renewal-proposal', authMiddleware, async (req: Request, res: Response) => {
  try {
    const customerId = req.params.id;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || 'system';

    const { generateSlides, customPricingOptions } = req.body;

    console.log(`[RenewalProposal] Generating proposal for customer ${customerId}`);

    const proposal = await renewalProposalGenerator.generateProposal(customerId, userId, {
      generateSlides,
      customPricingOptions,
    });

    res.json({
      success: true,
      data: {
        proposalDocId: proposal.proposalDocId,
        proposalDocUrl: proposal.proposalDocUrl,
        emailDraft: {
          to: proposal.emailDraft.to,
          subject: proposal.emailDraft.subject,
          body: proposal.emailDraft.bodyText,
          bodyHtml: proposal.emailDraft.bodyHtml,
        },
        summary: proposal.summary,
      },
      message: 'Renewal proposal generated successfully',
    });
  } catch (error) {
    console.error('[RenewalProposal] Error generating proposal:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROPOSAL_GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to generate renewal proposal',
      },
    });
  }
});

/**
 * GET /api/customers/:id/renewal-proposal/preview
 * Preview proposal content before generation
 *
 * Returns aggregated data that will be used in the proposal:
 * - Customer info
 * - Contract details
 * - Usage metrics
 * - Value calculations
 * - Pricing options
 * - Section content previews
 */
router.get('/:id/renewal-proposal/preview', authMiddleware, async (req: Request, res: Response) => {
  try {
    const customerId = req.params.id;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || 'system';

    console.log(`[RenewalProposal] Previewing proposal for customer ${customerId}`);

    const preview = await renewalProposalGenerator.previewProposal(customerId, userId);

    if (!preview) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: 'Customer not found or insufficient data for preview',
        },
      });
    }

    res.json({
      success: true,
      data: {
        customer: {
          id: preview.customer.id,
          name: preview.customer.name,
          industry: preview.customer.industry,
          arr: preview.customer.arr,
          healthScore: preview.customer.health_score,
          primaryContact: preview.customer.primary_contact,
        },
        contract: {
          id: preview.contract.id,
          arr: preview.contract.arr,
          startDate: preview.contract.start_date,
          endDate: preview.contract.end_date,
          entitlements: preview.contract.entitlements,
        },
        renewalPipeline: {
          renewalDate: preview.renewalPipeline.renewal_date,
          currentArr: preview.renewalPipeline.current_arr,
          proposedArr: preview.renewalPipeline.proposed_arr,
          probability: preview.renewalPipeline.probability,
          stage: preview.renewalPipeline.stage,
          riskFactors: preview.renewalPipeline.risk_factors,
          proposalSent: preview.renewalPipeline.proposal_sent,
          proposalDocUrl: preview.renewalPipeline.proposal_doc_url,
        },
        usageMetrics: {
          monthlyActiveUsers: preview.usageMetrics.mau,
          dailyActiveUsers: preview.usageMetrics.dau,
          adoptionScore: preview.usageMetrics.adoption_score,
          usageTrend: preview.usageMetrics.usage_trend,
          yoyChange: preview.usageMetrics.yoy_change,
          featureAdoption: preview.usageMetrics.feature_adoption,
        },
        valueMetrics: {
          totalValueDelivered: preview.valueMetrics.totalValueDelivered,
          roi: preview.valueMetrics.roi,
          efficiencyImprovement: preview.valueMetrics.efficiencyImprovement,
          timeSavedHours: preview.valueMetrics.timeSavedHours,
          costSavings: preview.valueMetrics.costSavings,
          keyWins: preview.valueMetrics.keyWins,
          newUseCases: preview.valueMetrics.newUseCases,
        },
        pricingOptions: preview.pricingOptions,
        healthScoreTrend: preview.healthScoreTrend,
        daysUntilRenewal: preview.daysUntilRenewal,
        proposalSections: preview.proposalSections,
      },
    });
  } catch (error) {
    console.error('[RenewalProposal] Error previewing proposal:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PREVIEW_FAILED',
        message: error instanceof Error ? error.message : 'Failed to preview renewal proposal',
      },
    });
  }
});

/**
 * POST /api/customers/:id/renewal-proposal/send
 * Send the renewal proposal email with document attachment
 *
 * Body params:
 * - to: string (optional) - Override recipient email
 * - cc: string[] (optional) - CC recipients
 * - bcc: string[] (optional) - BCC recipients
 * - subject: string (optional) - Override subject line
 * - bodyHtml: string (optional) - Override email body HTML
 * - bodyText: string (optional) - Override email body plain text
 *
 * Note: This endpoint requires HITL approval before sending
 */
router.post('/:id/renewal-proposal/send', authMiddleware, async (req: Request, res: Response) => {
  try {
    const customerId = req.params.id;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || 'system';

    const { to, cc, bcc, subject, bodyHtml, bodyText, skipApproval } = req.body;

    console.log(`[RenewalProposal] Sending proposal for customer ${customerId}`);

    // Check for existing proposal
    const preview = await renewalProposalGenerator.previewProposal(customerId, userId);
    if (!preview) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: 'Customer not found',
        },
      });
    }

    // If skipApproval is not set (default), create an approval request
    if (!skipApproval) {
      // Log the pending approval
      await activityLogger.log({
        agentType: 'renewal',
        actionType: 'renewal_proposal_pending',
        customerId,
        userId,
        actionData: {
          type: 'send_renewal_proposal',
          recipient: to || preview.customer.primary_contact?.email,
          proposalUrl: preview.renewalPipeline.proposal_doc_url,
        },
        resultData: {
          status: 'pending_approval',
        },
        status: 'pending',
      });

      return res.json({
        success: true,
        data: {
          status: 'pending_approval',
          message: 'Renewal proposal email requires approval before sending',
          approvalRequired: true,
          emailPreview: {
            to: to || preview.customer.primary_contact?.email,
            subject: subject || `${preview.customer.name} Partnership Renewal Proposal - FY${new Date().getFullYear() + 1}`,
            hasAttachment: true,
            proposalDocUrl: preview.renewalPipeline.proposal_doc_url,
          },
        },
      });
    }

    // Send the proposal
    const result = await renewalProposalGenerator.sendProposal(customerId, userId, {
      to: to ? [to] : undefined,
      cc,
      bcc,
      subject,
      bodyHtml,
      bodyText,
    });

    res.json({
      success: true,
      data: {
        messageId: result.messageId,
        sent: result.success,
        recipient: to || preview.customer.primary_contact?.email,
        proposalDocUrl: preview.renewalPipeline.proposal_doc_url,
      },
      message: 'Renewal proposal sent successfully',
    });
  } catch (error) {
    console.error('[RenewalProposal] Error sending proposal:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SEND_FAILED',
        message: error instanceof Error ? error.message : 'Failed to send renewal proposal',
      },
    });
  }
});

/**
 * GET /api/customers/:id/renewal-proposal/status
 * Get the status of a renewal proposal for a customer
 */
router.get('/:id/renewal-proposal/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const customerId = req.params.id;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || 'system';

    const preview = await renewalProposalGenerator.previewProposal(customerId, userId);
    if (!preview) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: 'Customer not found',
        },
      });
    }

    res.json({
      success: true,
      data: {
        customerId,
        customerName: preview.customer.name,
        renewalDate: preview.renewalPipeline.renewal_date,
        daysUntilRenewal: preview.daysUntilRenewal,
        proposalStatus: {
          generated: !!preview.renewalPipeline.proposal_doc_url,
          sent: preview.renewalPipeline.proposal_sent,
          sentAt: preview.renewalPipeline.proposal_sent_at,
          docUrl: preview.renewalPipeline.proposal_doc_url,
        },
        pipelineStage: preview.renewalPipeline.stage,
        currentArr: preview.customer.arr,
        healthScore: preview.healthScoreTrend.current,
      },
    });
  } catch (error) {
    console.error('[RenewalProposal] Error getting status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get proposal status',
      },
    });
  }
});

/**
 * PATCH /api/customers/:id/renewal-proposal
 * Update pricing options or other proposal details before sending
 */
router.patch('/:id/renewal-proposal', authMiddleware, async (req: Request, res: Response) => {
  try {
    const customerId = req.params.id;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || 'system';

    const { pricingOptions, regenerateDocument } = req.body;

    if (!pricingOptions || !Array.isArray(pricingOptions)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'pricingOptions array is required',
        },
      });
    }

    // Validate pricing options
    for (const option of pricingOptions) {
      if (!option.name || typeof option.arr !== 'number') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PRICING_OPTION',
            message: 'Each pricing option must have name and arr',
          },
        });
      }
    }

    // If regenerateDocument is true, generate a new proposal with updated options
    if (regenerateDocument) {
      const proposal = await renewalProposalGenerator.generateProposal(customerId, userId, {
        customPricingOptions: pricingOptions,
      });

      return res.json({
        success: true,
        data: {
          proposalDocId: proposal.proposalDocId,
          proposalDocUrl: proposal.proposalDocUrl,
          pricingOptions,
          regenerated: true,
        },
        message: 'Proposal regenerated with updated pricing options',
      });
    }

    // Otherwise just return the updated options for preview
    res.json({
      success: true,
      data: {
        pricingOptions,
        regenerated: false,
      },
      message: 'Pricing options updated - regenerate document to apply changes',
    });
  } catch (error) {
    console.error('[RenewalProposal] Error updating proposal:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update proposal',
      },
    });
  }
});

export default router;
