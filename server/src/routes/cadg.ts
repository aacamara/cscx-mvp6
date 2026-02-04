/**
 * CADG API Routes
 * PRD: Context-Aware Agentic Document Generation
 *
 * Endpoints:
 * - POST /api/cadg/plan - Create execution plan
 * - POST /api/cadg/plan/:planId/approve - Approve plan
 * - POST /api/cadg/plan/:planId/reject - Reject plan
 * - GET /api/cadg/artifact/:artifactId - Get artifact
 * - GET /api/cadg/plans - Get user's plans
 */

import { Router, Request, Response } from 'express';
import { contextAggregator } from '../services/cadg/contextAggregator.js';
import { taskClassifier } from '../services/cadg/taskClassifier.js';
import { reasoningEngine } from '../services/cadg/reasoningEngine.js';
import { planService } from '../services/cadg/planService.js';
import { artifactGenerator } from '../services/cadg/artifactGenerator.js';
import { capabilityMatcher } from '../services/cadg/capabilityMatcher.js';
import { PlanModification } from '../services/cadg/types.js';
import { driveService } from '../services/google/drive.js';

const router = Router();

/**
 * POST /api/cadg/plan
 * Create an execution plan for a task
 */
router.post('/plan', async (req: Request, res: Response) => {
  try {
    const { query, customerId } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required',
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    // Step 1: Classify the task
    const classification = await taskClassifier.classify(query);

    // Check if it's a generative request
    if (!taskClassifier.isGenerativeRequest(query) && classification.confidence < 0.6) {
      return res.json({
        success: true,
        isGenerative: false,
        message: 'This appears to be a question rather than a generative task',
        classification,
      });
    }

    // Step 2: Match to capability (optional, enhances context)
    const capabilityMatch = await capabilityMatcher.match(query, {
      customerId,
      userId,
    });

    // Step 3: Aggregate context
    const context = await contextAggregator.aggregateContext({
      taskType: classification.taskType,
      customerId: customerId || null,
      userQuery: query,
      userId,
    });

    // Step 4: Create execution plan
    const plan = await reasoningEngine.createPlan({
      taskType: classification.taskType,
      context,
      userQuery: query,
      methodology: capabilityMatch.methodology,
    });

    // Step 5: Persist the plan
    const saveResult = await planService.createPlan(
      plan,
      userId,
      customerId || null,
      query,
      {
        knowledge: context.knowledge,
        metadata: context.metadata,
      }
    );

    if (!saveResult.success) {
      console.error('[CADG] Failed to save plan:', saveResult.error);
    }

    // Determine if approval is required
    const requiresApproval = plan.actions.some(a => a.requiresApproval);

    res.json({
      success: true,
      isGenerative: true,
      planId: plan.planId,
      plan,
      classification,
      capability: capabilityMatch.capability ? {
        id: capabilityMatch.capability.id,
        name: capabilityMatch.capability.name,
        confidence: capabilityMatch.confidence,
      } : null,
      requiresApproval,
      contextSummary: {
        sourcesSearched: context.metadata.sourcesSearched,
        playbooksFound: context.knowledge.playbooks.length,
        risksDetected: context.platformData.riskSignals.length,
        gatheringDurationMs: context.metadata.gatheringDurationMs,
      },
    });
  } catch (error) {
    console.error('[CADG] Plan creation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create plan',
    });
  }
});

/**
 * POST /api/cadg/plan/:planId/approve
 * Approve a plan for execution
 */
router.post('/plan/:planId/approve', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { modifications } = req.body as { modifications?: PlanModification[] };
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    // Get the plan
    const { plan: planRow, success, error } = await planService.getPlan(planId);

    if (!success || !planRow) {
      return res.status(404).json({
        success: false,
        error: error || 'Plan not found',
      });
    }

    if (planRow.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Plan is already ${planRow.status}`,
      });
    }

    // Approve the plan
    const approveResult = await planService.approvePlan(planId, userId, modifications);

    if (!approveResult.success) {
      return res.status(500).json({
        success: false,
        error: approveResult.error,
      });
    }

    // Update status to executing
    await planService.updatePlanStatus(planId, 'executing');

    // Apply modifications if any
    let finalPlan = planRow.plan_json;
    if (modifications && modifications.length > 0) {
      finalPlan = planService.applyModifications(planRow.plan_json, modifications);
    }

    // Detect template mode (no customer selected)
    const isTemplateMode = !planRow.customer_id;

    // Re-aggregate context for execution
    const context = await contextAggregator.aggregateContext({
      taskType: finalPlan.taskType,
      customerId: planRow.customer_id,
      userQuery: planRow.user_query,
      userId,
    });

    // Check if this is an email artifact - return preview instead of sending
    const isEmailArtifact = finalPlan.taskType === 'email_drafting' ||
                            planRow.user_query?.toLowerCase().includes('email');

    if (isEmailArtifact) {
      // Generate email content but don't send - return preview for HITL
      const emailPreview = await artifactGenerator.generateEmailPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms send
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isPreview: true,
        preview: {
          to: emailPreview.to,
          cc: emailPreview.cc,
          subject: emailPreview.subject,
          body: emailPreview.body,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            renewalDate: context.platformData.customer360?.renewalDate,
          },
        },
        planId,
      });
    }

    // Check if this is a document artifact - return preview instead of creating
    const isDocumentArtifact = finalPlan.taskType === 'document_creation' ||
                               planRow.user_query?.toLowerCase().includes('document') ||
                               planRow.user_query?.toLowerCase().includes('success plan') ||
                               planRow.user_query?.toLowerCase().includes('account plan');

    if (isDocumentArtifact) {
      // Generate document content but don't create - return preview for HITL
      const documentPreview = await artifactGenerator.generateDocumentPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isDocumentPreview: true,
        preview: {
          title: documentPreview.title,
          sections: documentPreview.sections,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            renewalDate: context.platformData.customer360?.renewalDate,
          },
        },
        planId,
      });
    }

    // Check if this is a meeting prep artifact - return preview instead of markdown
    const isMeetingPrepArtifact = finalPlan.taskType === 'meeting_prep' ||
                                  planRow.user_query?.toLowerCase().includes('meeting prep') ||
                                  planRow.user_query?.toLowerCase().includes('prep for meeting') ||
                                  planRow.user_query?.toLowerCase().includes('prepare for meeting');

    if (isMeetingPrepArtifact) {
      // Generate meeting prep content but don't finalize - return preview for HITL
      const meetingPrepPreview = await artifactGenerator.generateMeetingPrepPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isMeetingPrepPreview: true,
        preview: {
          title: meetingPrepPreview.title,
          attendees: meetingPrepPreview.attendees,
          agenda: meetingPrepPreview.agenda,
          talkingPoints: meetingPrepPreview.talkingPoints,
          risks: meetingPrepPreview.risks,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            renewalDate: context.platformData.customer360?.renewalDate,
          },
        },
        planId,
      });
    }

    // Check if this is a milestone plan artifact (30-60-90) - return preview for HITL
    const isMilestonePlanArtifact = finalPlan.taskType === 'milestone_plan' ||
                                     planRow.user_query?.toLowerCase().includes('30-60-90') ||
                                     planRow.user_query?.toLowerCase().includes('30 60 90') ||
                                     planRow.user_query?.toLowerCase().includes('milestone plan') ||
                                     planRow.user_query?.toLowerCase().includes('first 90 days') ||
                                     planRow.user_query?.toLowerCase().includes('onboarding timeline') ||
                                     planRow.user_query?.toLowerCase().includes('implementation plan');

    if (isMilestonePlanArtifact) {
      // Generate milestone plan content but don't finalize - return preview for HITL
      const milestonePlanPreview = await artifactGenerator.generateMilestonePlanPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isMilestonePlanPreview: true,
        preview: {
          title: milestonePlanPreview.title,
          phases: milestonePlanPreview.phases,
          notes: milestonePlanPreview.notes,
          startDate: milestonePlanPreview.startDate,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            renewalDate: context.platformData.customer360?.renewalDate,
          },
        },
        planId,
      });
    }

    // Check if this is a stakeholder map artifact - return preview for HITL
    const isStakeholderMapArtifact = finalPlan.taskType === 'stakeholder_map' ||
                                      planRow.user_query?.toLowerCase().includes('stakeholder map') ||
                                      planRow.user_query?.toLowerCase().includes('stakeholder analysis') ||
                                      planRow.user_query?.toLowerCase().includes('map stakeholders') ||
                                      planRow.user_query?.toLowerCase().includes('key contacts') ||
                                      planRow.user_query?.toLowerCase().includes('org chart') ||
                                      planRow.user_query?.toLowerCase().includes('contact map');

    if (isStakeholderMapArtifact) {
      // Generate stakeholder map content but don't finalize - return preview for HITL
      const stakeholderMapPreview = await artifactGenerator.generateStakeholderMapPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isStakeholderMapPreview: true,
        preview: {
          title: stakeholderMapPreview.title,
          stakeholders: stakeholderMapPreview.stakeholders,
          relationships: stakeholderMapPreview.relationships,
          notes: stakeholderMapPreview.notes,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            renewalDate: context.platformData.customer360?.renewalDate,
          },
        },
        planId,
      });
    }

    // Check if this is a usage analysis artifact - return preview for HITL
    const isUsageAnalysisArtifact = finalPlan.taskType === 'usage_analysis' ||
                                     planRow.user_query?.toLowerCase().includes('usage analysis') ||
                                     planRow.user_query?.toLowerCase().includes('usage report') ||
                                     planRow.user_query?.toLowerCase().includes('analyze usage') ||
                                     planRow.user_query?.toLowerCase().includes('feature adoption') ||
                                     planRow.user_query?.toLowerCase().includes('adoption report') ||
                                     planRow.user_query?.toLowerCase().includes('engagement analysis') ||
                                     planRow.user_query?.toLowerCase().includes('user activity report');

    if (isUsageAnalysisArtifact) {
      // Generate usage analysis content but don't finalize - return preview for HITL
      const usageAnalysisPreview = await artifactGenerator.generateUsageAnalysisPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isUsageAnalysisPreview: true,
        preview: {
          title: usageAnalysisPreview.title,
          timeRange: usageAnalysisPreview.timeRange,
          metrics: usageAnalysisPreview.metrics,
          featureAdoption: usageAnalysisPreview.featureAdoption,
          userSegments: usageAnalysisPreview.userSegments,
          recommendations: usageAnalysisPreview.recommendations,
          chartTypes: usageAnalysisPreview.chartTypes,
          notes: usageAnalysisPreview.notes,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            renewalDate: context.platformData.customer360?.renewalDate,
          },
        },
        planId,
      });
    }

    // Check if this is a feature campaign artifact - return preview for HITL
    const isFeatureCampaignArtifact = finalPlan.taskType === 'feature_campaign' ||
                                       planRow.user_query?.toLowerCase().includes('feature campaign') ||
                                       planRow.user_query?.toLowerCase().includes('drive adoption') ||
                                       planRow.user_query?.toLowerCase().includes('increase adoption') ||
                                       planRow.user_query?.toLowerCase().includes('adoption campaign') ||
                                       planRow.user_query?.toLowerCase().includes('feature rollout') ||
                                       planRow.user_query?.toLowerCase().includes('promote feature') ||
                                       planRow.user_query?.toLowerCase().includes('underutilized features') ||
                                       planRow.user_query?.toLowerCase().includes('boost usage');

    if (isFeatureCampaignArtifact) {
      // Generate feature campaign content but don't finalize - return preview for HITL
      const featureCampaignPreview = await artifactGenerator.generateFeatureCampaignPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isFeatureCampaignPreview: true,
        preview: {
          title: featureCampaignPreview.title,
          campaignGoal: featureCampaignPreview.campaignGoal,
          targetFeatures: featureCampaignPreview.targetFeatures,
          userSegments: featureCampaignPreview.userSegments,
          timeline: featureCampaignPreview.timeline,
          messaging: featureCampaignPreview.messaging,
          successMetrics: featureCampaignPreview.successMetrics,
          notes: featureCampaignPreview.notes,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            renewalDate: context.platformData.customer360?.renewalDate,
          },
        },
        planId,
      });
    }

    // Check if this is a champion development artifact - return preview for HITL
    const isChampionDevelopmentArtifact = finalPlan.taskType === 'champion_development' ||
                                           planRow.user_query?.toLowerCase().includes('champion development') ||
                                           planRow.user_query?.toLowerCase().includes('champion program') ||
                                           planRow.user_query?.toLowerCase().includes('develop champions') ||
                                           planRow.user_query?.toLowerCase().includes('customer champions') ||
                                           planRow.user_query?.toLowerCase().includes('champion candidates') ||
                                           planRow.user_query?.toLowerCase().includes('identify champions') ||
                                           planRow.user_query?.toLowerCase().includes('nurture champions') ||
                                           planRow.user_query?.toLowerCase().includes('power users') ||
                                           planRow.user_query?.toLowerCase().includes('advocate program');

    if (isChampionDevelopmentArtifact) {
      // Generate champion development content but don't finalize - return preview for HITL
      const championDevelopmentPreview = await artifactGenerator.generateChampionDevelopmentPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isChampionDevelopmentPreview: true,
        preview: {
          title: championDevelopmentPreview.title,
          programGoal: championDevelopmentPreview.programGoal,
          candidates: championDevelopmentPreview.candidates,
          activities: championDevelopmentPreview.activities,
          rewards: championDevelopmentPreview.rewards,
          timeline: championDevelopmentPreview.timeline,
          successMetrics: championDevelopmentPreview.successMetrics,
          notes: championDevelopmentPreview.notes,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            renewalDate: context.platformData.customer360?.renewalDate,
          },
        },
        planId,
      });
    }

    // Check if this is a training program artifact - return preview for HITL
    const isTrainingProgramArtifact = finalPlan.taskType === 'training_program' ||
                                       planRow.user_query?.toLowerCase().includes('training program') ||
                                       planRow.user_query?.toLowerCase().includes('training curriculum') ||
                                       planRow.user_query?.toLowerCase().includes('learning program') ||
                                       planRow.user_query?.toLowerCase().includes('training modules') ||
                                       planRow.user_query?.toLowerCase().includes('training course') ||
                                       planRow.user_query?.toLowerCase().includes('learning path') ||
                                       planRow.user_query?.toLowerCase().includes('onboarding curriculum') ||
                                       planRow.user_query?.toLowerCase().includes('certification program');

    if (isTrainingProgramArtifact) {
      // Generate training program content but don't finalize - return preview for HITL
      const trainingProgramPreview = await artifactGenerator.generateTrainingProgramPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isTrainingProgramPreview: true,
        preview: {
          title: trainingProgramPreview.title,
          programGoal: trainingProgramPreview.programGoal,
          modules: trainingProgramPreview.modules,
          targetAudience: trainingProgramPreview.targetAudience,
          timeline: trainingProgramPreview.timeline,
          completionCriteria: trainingProgramPreview.completionCriteria,
          successMetrics: trainingProgramPreview.successMetrics,
          notes: trainingProgramPreview.notes,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            renewalDate: context.platformData.customer360?.renewalDate,
          },
        },
        planId,
      });
    }

    // Check if this is a value summary artifact - return preview for HITL
    const isValueSummaryArtifact = finalPlan.taskType === 'value_summary' ||
                                    planRow.user_query?.toLowerCase().includes('value summary') ||
                                    planRow.user_query?.toLowerCase().includes('value realization') ||
                                    planRow.user_query?.toLowerCase().includes('roi summary') ||
                                    planRow.user_query?.toLowerCase().includes('roi report') ||
                                    planRow.user_query?.toLowerCase().includes('roi calculation') ||
                                    planRow.user_query?.toLowerCase().includes('success metrics') ||
                                    planRow.user_query?.toLowerCase().includes('value delivered') ||
                                    planRow.user_query?.toLowerCase().includes('business value') ||
                                    planRow.user_query?.toLowerCase().includes('customer value') ||
                                    planRow.user_query?.toLowerCase().includes('demonstrate value') ||
                                    planRow.user_query?.toLowerCase().includes('show value') ||
                                    planRow.user_query?.toLowerCase().includes('prove value') ||
                                    planRow.user_query?.toLowerCase().includes('value report');

    if (isValueSummaryArtifact) {
      // Generate value summary content but don't finalize - return preview for HITL
      const valueSummaryPreview = await artifactGenerator.generateValueSummaryPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isValueSummaryPreview: true,
        preview: {
          title: valueSummaryPreview.title,
          executiveSummary: valueSummaryPreview.executiveSummary,
          valueMetrics: valueSummaryPreview.valueMetrics,
          successStories: valueSummaryPreview.successStories,
          testimonials: valueSummaryPreview.testimonials,
          roiCalculation: valueSummaryPreview.roiCalculation,
          keyHighlights: valueSummaryPreview.keyHighlights,
          nextSteps: valueSummaryPreview.nextSteps,
          notes: valueSummaryPreview.notes,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            arr: context.platformData.customer360?.arr,
          },
        },
        planId,
      });
    }

    // Check if this is a renewal forecast artifact - return preview for HITL
    const isRenewalForecastArtifact = finalPlan.taskType === 'renewal_forecast' ||
                                       planRow.user_query?.toLowerCase().includes('renewal forecast') ||
                                       planRow.user_query?.toLowerCase().includes('renewal prediction') ||
                                       planRow.user_query?.toLowerCase().includes('renewal probability') ||
                                       planRow.user_query?.toLowerCase().includes('renewal likelihood') ||
                                       planRow.user_query?.toLowerCase().includes('forecast renewal') ||
                                       planRow.user_query?.toLowerCase().includes('predict renewal') ||
                                       planRow.user_query?.toLowerCase().includes('renewal outlook') ||
                                       planRow.user_query?.toLowerCase().includes('renewal projections') ||
                                       planRow.user_query?.toLowerCase().includes('will they renew') ||
                                       planRow.user_query?.toLowerCase().includes('renewal risk') ||
                                       planRow.user_query?.toLowerCase().includes('renewal chance');

    if (isRenewalForecastArtifact) {
      // Generate renewal forecast content but don't finalize - return preview for HITL
      const renewalForecastPreview = await artifactGenerator.generateRenewalForecastPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isRenewalForecastPreview: true,
        preview: {
          title: renewalForecastPreview.title,
          renewalDate: renewalForecastPreview.renewalDate,
          currentProbability: renewalForecastPreview.currentProbability,
          targetProbability: renewalForecastPreview.targetProbability,
          arr: renewalForecastPreview.arr,
          contractTerm: renewalForecastPreview.contractTerm,
          probabilityFactors: renewalForecastPreview.probabilityFactors,
          riskFactors: renewalForecastPreview.riskFactors,
          positiveSignals: renewalForecastPreview.positiveSignals,
          recommendedActions: renewalForecastPreview.recommendedActions,
          historicalContext: renewalForecastPreview.historicalContext,
          notes: renewalForecastPreview.notes,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            renewalDate: context.platformData.customer360?.renewalDate,
          },
        },
        planId,
      });
    }

    // Check if this is an expansion proposal artifact - return preview for HITL
    const isExpansionProposalArtifact = finalPlan.taskType === 'expansion_proposal' ||
                                         planRow.user_query?.toLowerCase().includes('expansion proposal') ||
                                         planRow.user_query?.toLowerCase().includes('expansion plan') ||
                                         planRow.user_query?.toLowerCase().includes('upsell proposal') ||
                                         planRow.user_query?.toLowerCase().includes('upsell plan') ||
                                         planRow.user_query?.toLowerCase().includes('growth proposal') ||
                                         planRow.user_query?.toLowerCase().includes('upgrade proposal') ||
                                         planRow.user_query?.toLowerCase().includes('expand account') ||
                                         planRow.user_query?.toLowerCase().includes('account expansion') ||
                                         planRow.user_query?.toLowerCase().includes('expand customer') ||
                                         planRow.user_query?.toLowerCase().includes('pricing proposal') ||
                                         planRow.user_query?.toLowerCase().includes('expansion opportunity') ||
                                         planRow.user_query?.toLowerCase().includes('upsell opportunity') ||
                                         planRow.user_query?.toLowerCase().includes('cross-sell') ||
                                         planRow.user_query?.toLowerCase().includes('cross sell');

    if (isExpansionProposalArtifact) {
      // Generate expansion proposal content but don't finalize - return preview for HITL
      const expansionProposalPreview = await artifactGenerator.generateExpansionProposalPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isExpansionProposalPreview: true,
        preview: {
          title: expansionProposalPreview.title,
          proposalDate: expansionProposalPreview.proposalDate,
          validUntil: expansionProposalPreview.validUntil,
          currentArrValue: expansionProposalPreview.currentArrValue,
          proposedArrValue: expansionProposalPreview.proposedArrValue,
          expansionAmount: expansionProposalPreview.expansionAmount,
          expansionProducts: expansionProposalPreview.expansionProducts,
          pricingOptions: expansionProposalPreview.pricingOptions,
          businessCase: expansionProposalPreview.businessCase,
          roiProjection: expansionProposalPreview.roiProjection,
          usageGaps: expansionProposalPreview.usageGaps,
          growthSignals: expansionProposalPreview.growthSignals,
          nextSteps: expansionProposalPreview.nextSteps,
          notes: expansionProposalPreview.notes,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            arr: context.platformData.customer360?.arr,
          },
        },
        planId,
      });
    }

    // Check if this is a negotiation brief artifact - return preview for HITL
    const isNegotiationBriefArtifact = finalPlan.taskType === 'negotiation_brief' ||
                                        planRow.user_query?.toLowerCase().includes('negotiation brief') ||
                                        planRow.user_query?.toLowerCase().includes('negotiation prep') ||
                                        planRow.user_query?.toLowerCase().includes('negotiation strategy') ||
                                        planRow.user_query?.toLowerCase().includes('renewal negotiation') ||
                                        planRow.user_query?.toLowerCase().includes('contract negotiation') ||
                                        planRow.user_query?.toLowerCase().includes('negotiate renewal') ||
                                        planRow.user_query?.toLowerCase().includes('prepare negotiation') ||
                                        planRow.user_query?.toLowerCase().includes('leverage points') ||
                                        planRow.user_query?.toLowerCase().includes('counter strategy') ||
                                        planRow.user_query?.toLowerCase().includes('walk-away') ||
                                        planRow.user_query?.toLowerCase().includes('walkaway') ||
                                        planRow.user_query?.toLowerCase().includes('bargaining') ||
                                        planRow.user_query?.toLowerCase().includes('deal terms');

    if (isNegotiationBriefArtifact) {
      // Generate negotiation brief content but don't finalize - return preview for HITL
      const negotiationBriefPreview = await artifactGenerator.generateNegotiationBriefPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isNegotiationBriefPreview: true,
        preview: {
          title: negotiationBriefPreview.title,
          negotiationDate: negotiationBriefPreview.negotiationDate,
          contractValue: negotiationBriefPreview.contractValue,
          contractTerm: negotiationBriefPreview.contractTerm,
          renewalDate: negotiationBriefPreview.renewalDate,
          currentTerms: negotiationBriefPreview.currentTerms,
          leveragePoints: negotiationBriefPreview.leveragePoints,
          counterStrategies: negotiationBriefPreview.counterStrategies,
          walkAwayPoints: negotiationBriefPreview.walkAwayPoints,
          competitorIntel: negotiationBriefPreview.competitorIntel,
          valueDelivered: negotiationBriefPreview.valueDelivered,
          internalNotes: negotiationBriefPreview.internalNotes,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            arr: context.platformData.customer360?.arr,
            renewalDate: context.platformData.customer360?.renewalDate,
          },
        },
        planId,
      });
    }

    // Check if this is a training schedule artifact - return preview for HITL
    const isTrainingScheduleArtifact = finalPlan.taskType === 'training_schedule' ||
                                        planRow.user_query?.toLowerCase().includes('training schedule') ||
                                        planRow.user_query?.toLowerCase().includes('training calendar') ||
                                        planRow.user_query?.toLowerCase().includes('training plan') ||
                                        planRow.user_query?.toLowerCase().includes('training sessions') ||
                                        planRow.user_query?.toLowerCase().includes('schedule training');

    if (isTrainingScheduleArtifact) {
      // Generate training schedule content but don't finalize - return preview for HITL
      const trainingSchedulePreview = await artifactGenerator.generateTrainingSchedulePreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isTrainingSchedulePreview: true,
        preview: {
          title: trainingSchedulePreview.title,
          sessions: trainingSchedulePreview.sessions,
          notes: trainingSchedulePreview.notes,
          startDate: trainingSchedulePreview.startDate,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            renewalDate: context.platformData.customer360?.renewalDate,
          },
        },
        planId,
      });
    }

    // Check if this is a kickoff plan artifact - return preview for HITL
    const isKickoffPlanArtifact = finalPlan.taskType === 'kickoff_plan' ||
                                   planRow.user_query?.toLowerCase().includes('kickoff plan') ||
                                   planRow.user_query?.toLowerCase().includes('kickoff meeting') ||
                                   planRow.user_query?.toLowerCase().includes('build kickoff') ||
                                   planRow.user_query?.toLowerCase().includes('kickoff agenda');

    if (isKickoffPlanArtifact) {
      // Generate kickoff plan content but don't finalize - return preview for HITL
      const kickoffPlanPreview = await artifactGenerator.generateKickoffPlanPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isKickoffPlanPreview: true,
        preview: {
          title: kickoffPlanPreview.title,
          attendees: kickoffPlanPreview.attendees,
          agenda: kickoffPlanPreview.agenda,
          goals: kickoffPlanPreview.goals,
          nextSteps: kickoffPlanPreview.nextSteps,
          notes: kickoffPlanPreview.notes,
          meetingDate: kickoffPlanPreview.meetingDate,
          meetingDuration: kickoffPlanPreview.meetingDuration,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            renewalDate: context.platformData.customer360?.renewalDate,
          },
        },
        planId,
      });
    }

    // Check if this is a risk assessment artifact - return preview for HITL
    const isRiskAssessmentArtifact = finalPlan.taskType === 'risk_assessment' ||
                                      planRow.user_query?.toLowerCase().includes('risk assessment') ||
                                      planRow.user_query?.toLowerCase().includes('risk analysis') ||
                                      planRow.user_query?.toLowerCase().includes('churn risk') ||
                                      planRow.user_query?.toLowerCase().includes('at-risk') ||
                                      planRow.user_query?.toLowerCase().includes('at risk') ||
                                      planRow.user_query?.toLowerCase().includes('assess risk') ||
                                      planRow.user_query?.toLowerCase().includes('evaluate risk') ||
                                      planRow.user_query?.toLowerCase().includes('risk profile') ||
                                      planRow.user_query?.toLowerCase().includes('risk factors') ||
                                      planRow.user_query?.toLowerCase().includes('mitigation plan') ||
                                      planRow.user_query?.toLowerCase().includes('health risk');

    if (isRiskAssessmentArtifact) {
      // Generate risk assessment content but don't finalize - return preview for HITL
      const riskAssessmentPreview = await artifactGenerator.generateRiskAssessmentPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isRiskAssessmentPreview: true,
        preview: {
          title: riskAssessmentPreview.title,
          assessmentDate: riskAssessmentPreview.assessmentDate,
          overallRiskScore: riskAssessmentPreview.overallRiskScore,
          riskLevel: riskAssessmentPreview.riskLevel,
          healthScore: riskAssessmentPreview.healthScore,
          daysUntilRenewal: riskAssessmentPreview.daysUntilRenewal,
          arr: riskAssessmentPreview.arr,
          riskFactors: riskAssessmentPreview.riskFactors,
          mitigationActions: riskAssessmentPreview.mitigationActions,
          executiveSummary: riskAssessmentPreview.executiveSummary,
          notes: riskAssessmentPreview.notes,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            arr: context.platformData.customer360?.arr,
            renewalDate: context.platformData.customer360?.renewalDate,
          },
        },
        planId,
      });
    }

    // Check if this is a save play artifact - return preview for HITL
    const isSavePlayArtifact = finalPlan.taskType === 'save_play' ||
                               planRow.user_query?.toLowerCase().includes('save play') ||
                               planRow.user_query?.toLowerCase().includes('save this customer') ||
                               planRow.user_query?.toLowerCase().includes('save the customer') ||
                               planRow.user_query?.toLowerCase().includes('save account') ||
                               planRow.user_query?.toLowerCase().includes('churn save') ||
                               planRow.user_query?.toLowerCase().includes('retention play') ||
                               planRow.user_query?.toLowerCase().includes('retention plan') ||
                               planRow.user_query?.toLowerCase().includes('prevent churn') ||
                               planRow.user_query?.toLowerCase().includes('rescue plan') ||
                               planRow.user_query?.toLowerCase().includes('rescue this') ||
                               planRow.user_query?.toLowerCase().includes('intervention plan') ||
                               planRow.user_query?.toLowerCase().includes('turnaround plan') ||
                               planRow.user_query?.toLowerCase().includes('win back');

    if (isSavePlayArtifact) {
      // Generate save play content but don't finalize - return preview for HITL
      const savePlayPreview = await artifactGenerator.generateSavePlayPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isSavePlayPreview: true,
        preview: {
          title: savePlayPreview.title,
          createdDate: savePlayPreview.createdDate,
          riskLevel: savePlayPreview.riskLevel,
          situation: savePlayPreview.situation,
          healthScore: savePlayPreview.healthScore,
          daysUntilRenewal: savePlayPreview.daysUntilRenewal,
          arr: savePlayPreview.arr,
          rootCauses: savePlayPreview.rootCauses,
          actionItems: savePlayPreview.actionItems,
          successMetrics: savePlayPreview.successMetrics,
          timeline: savePlayPreview.timeline,
          notes: savePlayPreview.notes,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            arr: context.platformData.customer360?.arr,
            renewalDate: context.platformData.customer360?.renewalDate,
          },
        },
        planId,
      });
    }

    // Check if this is an escalation report artifact - return preview for HITL
    const isEscalationReportArtifact = finalPlan.taskType === 'escalation_report' ||
                                       planRow.user_query?.toLowerCase().includes('escalation report') ||
                                       planRow.user_query?.toLowerCase().includes('escalation') ||
                                       planRow.user_query?.toLowerCase().includes('escalate this') ||
                                       planRow.user_query?.toLowerCase().includes('escalate issue') ||
                                       planRow.user_query?.toLowerCase().includes('executive escalation') ||
                                       planRow.user_query?.toLowerCase().includes('urgent escalation') ||
                                       planRow.user_query?.toLowerCase().includes('escalate to') ||
                                       planRow.user_query?.toLowerCase().includes('raise escalation') ||
                                       planRow.user_query?.toLowerCase().includes('formal escalation') ||
                                       planRow.user_query?.toLowerCase().includes('critical issue') ||
                                       planRow.user_query?.toLowerCase().includes('create escalation');

    if (isEscalationReportArtifact) {
      // Generate escalation report content but don't finalize - return preview for HITL
      const escalationReportPreview = await artifactGenerator.generateEscalationReportPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isEscalationReportPreview: true,
        preview: {
          title: escalationReportPreview.title,
          createdDate: escalationReportPreview.createdDate,
          escalationLevel: escalationReportPreview.escalationLevel,
          issueSummary: escalationReportPreview.issueSummary,
          customerName: escalationReportPreview.customerName,
          arr: escalationReportPreview.arr,
          healthScore: escalationReportPreview.healthScore,
          daysUntilRenewal: escalationReportPreview.daysUntilRenewal,
          primaryContact: escalationReportPreview.primaryContact,
          escalationOwner: escalationReportPreview.escalationOwner,
          timeline: escalationReportPreview.timeline,
          impactMetrics: escalationReportPreview.impactMetrics,
          resolutionRequests: escalationReportPreview.resolutionRequests,
          supportingEvidence: escalationReportPreview.supportingEvidence,
          recommendedActions: escalationReportPreview.recommendedActions,
          notes: escalationReportPreview.notes,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            arr: context.platformData.customer360?.arr,
            renewalDate: context.platformData.customer360?.renewalDate,
          },
        },
        planId,
      });
    }

    // Check if this is an executive briefing artifact - return preview for HITL
    const isExecutiveBriefingArtifact = finalPlan.taskType === 'executive_briefing' ||
                                        planRow.user_query?.toLowerCase().includes('executive briefing') ||
                                        planRow.user_query?.toLowerCase().includes('exec briefing') ||
                                        planRow.user_query?.toLowerCase().includes('executive summary') ||
                                        planRow.user_query?.toLowerCase().includes('leadership briefing') ||
                                        planRow.user_query?.toLowerCase().includes('board briefing') ||
                                        planRow.user_query?.toLowerCase().includes('c-suite briefing') ||
                                        planRow.user_query?.toLowerCase().includes('executive deck') ||
                                        planRow.user_query?.toLowerCase().includes('executive presentation') ||
                                        planRow.user_query?.toLowerCase().includes('exec presentation') ||
                                        planRow.user_query?.toLowerCase().includes('brief the exec') ||
                                        planRow.user_query?.toLowerCase().includes('brief leadership') ||
                                        planRow.user_query?.toLowerCase().includes('leadership presentation') ||
                                        planRow.user_query?.toLowerCase().includes('stakeholder briefing') ||
                                        planRow.user_query?.toLowerCase().includes('account overview for exec') ||
                                        planRow.user_query?.toLowerCase().includes('account brief');

    if (isExecutiveBriefingArtifact) {
      // Generate executive briefing content but don't finalize - return preview for HITL
      const executiveBriefingPreview = await artifactGenerator.generateExecutiveBriefingPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isExecutiveBriefingPreview: true,
        preview: {
          title: executiveBriefingPreview.title,
          preparedFor: executiveBriefingPreview.preparedFor,
          preparedBy: executiveBriefingPreview.preparedBy,
          briefingDate: executiveBriefingPreview.briefingDate,
          slideCount: executiveBriefingPreview.slideCount,
          executiveSummary: executiveBriefingPreview.executiveSummary,
          headlines: executiveBriefingPreview.headlines,
          keyMetrics: executiveBriefingPreview.keyMetrics,
          strategicUpdates: executiveBriefingPreview.strategicUpdates,
          asks: executiveBriefingPreview.asks,
          nextSteps: executiveBriefingPreview.nextSteps,
          healthScore: executiveBriefingPreview.healthScore,
          daysUntilRenewal: executiveBriefingPreview.daysUntilRenewal,
          arr: executiveBriefingPreview.arr,
          notes: executiveBriefingPreview.notes,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            arr: context.platformData.customer360?.arr,
            renewalDate: context.platformData.customer360?.renewalDate,
          },
        },
        planId,
      });
    }

    // Check if this is an account plan artifact - return preview for HITL
    const isAccountPlanArtifact = finalPlan.taskType === 'account_plan' ||
                                  planRow.user_query?.toLowerCase().includes('account plan') ||
                                  planRow.user_query?.toLowerCase().includes('strategic plan') ||
                                  planRow.user_query?.toLowerCase().includes('strategic account plan') ||
                                  planRow.user_query?.toLowerCase().includes('account strategy') ||
                                  planRow.user_query?.toLowerCase().includes('account roadmap') ||
                                  planRow.user_query?.toLowerCase().includes('strategic roadmap') ||
                                  planRow.user_query?.toLowerCase().includes('customer plan') ||
                                  planRow.user_query?.toLowerCase().includes('annual plan') ||
                                  planRow.user_query?.toLowerCase().includes('success plan') ||
                                  planRow.user_query?.toLowerCase().includes('growth plan') ||
                                  planRow.user_query?.toLowerCase().includes('engagement plan') ||
                                  planRow.user_query?.toLowerCase().includes('partnership plan') ||
                                  planRow.user_query?.toLowerCase().includes('relationship plan');

    if (isAccountPlanArtifact) {
      // Generate account plan content but don't finalize - return preview for HITL
      const accountPlanPreview = await artifactGenerator.generateAccountPlanPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isAccountPlanPreview: true,
        preview: {
          title: accountPlanPreview.title,
          planPeriod: accountPlanPreview.planPeriod,
          createdDate: accountPlanPreview.createdDate,
          accountOverview: accountPlanPreview.accountOverview,
          objectives: accountPlanPreview.objectives,
          actionItems: accountPlanPreview.actionItems,
          milestones: accountPlanPreview.milestones,
          resources: accountPlanPreview.resources,
          successCriteria: accountPlanPreview.successCriteria,
          risks: accountPlanPreview.risks,
          timeline: accountPlanPreview.timeline,
          healthScore: accountPlanPreview.healthScore,
          daysUntilRenewal: accountPlanPreview.daysUntilRenewal,
          arr: accountPlanPreview.arr,
          notes: accountPlanPreview.notes,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            arr: context.platformData.customer360?.arr,
            renewalDate: context.platformData.customer360?.renewalDate,
          },
        },
        planId,
      });
    }

    // Check if this is a resolution plan artifact - return preview for HITL
    const isResolutionPlanArtifact = finalPlan.taskType === 'resolution_plan' ||
                                     planRow.user_query?.toLowerCase().includes('resolution plan') ||
                                     planRow.user_query?.toLowerCase().includes('action plan') ||
                                     planRow.user_query?.toLowerCase().includes('issue resolution') ||
                                     planRow.user_query?.toLowerCase().includes('problem resolution') ||
                                     planRow.user_query?.toLowerCase().includes('fix plan') ||
                                     planRow.user_query?.toLowerCase().includes('remediation plan') ||
                                     planRow.user_query?.toLowerCase().includes('corrective action') ||
                                     planRow.user_query?.toLowerCase().includes('resolve issues') ||
                                     planRow.user_query?.toLowerCase().includes('address issues') ||
                                     planRow.user_query?.toLowerCase().includes('issue tracker') ||
                                     planRow.user_query?.toLowerCase().includes('action tracker');

    if (isResolutionPlanArtifact) {
      // Generate resolution plan content but don't finalize - return preview for HITL
      const resolutionPlanPreview = await artifactGenerator.generateResolutionPlanPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isResolutionPlanPreview: true,
        preview: {
          title: resolutionPlanPreview.title,
          createdDate: resolutionPlanPreview.createdDate,
          targetResolutionDate: resolutionPlanPreview.targetResolutionDate,
          overallStatus: resolutionPlanPreview.overallStatus,
          summary: resolutionPlanPreview.summary,
          healthScore: resolutionPlanPreview.healthScore,
          daysUntilRenewal: resolutionPlanPreview.daysUntilRenewal,
          arr: resolutionPlanPreview.arr,
          issues: resolutionPlanPreview.issues,
          actionItems: resolutionPlanPreview.actionItems,
          dependencies: resolutionPlanPreview.dependencies,
          timeline: resolutionPlanPreview.timeline,
          notes: resolutionPlanPreview.notes,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            arr: context.platformData.customer360?.arr,
            renewalDate: context.platformData.customer360?.renewalDate,
          },
        },
        planId,
      });
    }

    // Check if this is a transformation roadmap artifact - return preview for HITL
    const isTransformationRoadmapArtifact = finalPlan.taskType === 'transformation_roadmap' ||
                                            planRow.user_query?.toLowerCase().includes('transformation roadmap') ||
                                            planRow.user_query?.toLowerCase().includes('transformation plan') ||
                                            planRow.user_query?.toLowerCase().includes('digital transformation') ||
                                            planRow.user_query?.toLowerCase().includes('transformation journey') ||
                                            planRow.user_query?.toLowerCase().includes('change roadmap') ||
                                            planRow.user_query?.toLowerCase().includes('transformation timeline') ||
                                            planRow.user_query?.toLowerCase().includes('maturity roadmap') ||
                                            planRow.user_query?.toLowerCase().includes('evolution roadmap') ||
                                            planRow.user_query?.toLowerCase().includes('adoption roadmap') ||
                                            planRow.user_query?.toLowerCase().includes('implementation roadmap') ||
                                            planRow.user_query?.toLowerCase().includes('rollout roadmap') ||
                                            planRow.user_query?.toLowerCase().includes('deployment roadmap');

    if (isTransformationRoadmapArtifact) {
      // Generate transformation roadmap content but don't finalize - return preview for HITL
      const transformationRoadmapPreview = await artifactGenerator.generateTransformationRoadmapPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: planRow.customer_id,
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isTransformationRoadmapPreview: true,
        preview: {
          title: transformationRoadmapPreview.title,
          visionStatement: transformationRoadmapPreview.visionStatement,
          createdDate: transformationRoadmapPreview.createdDate,
          timelineStart: transformationRoadmapPreview.timelineStart,
          timelineEnd: transformationRoadmapPreview.timelineEnd,
          totalDuration: transformationRoadmapPreview.totalDuration,
          currentState: transformationRoadmapPreview.currentState,
          targetState: transformationRoadmapPreview.targetState,
          phases: transformationRoadmapPreview.phases,
          milestones: transformationRoadmapPreview.milestones,
          successCriteria: transformationRoadmapPreview.successCriteria,
          dependencies: transformationRoadmapPreview.dependencies,
          risks: transformationRoadmapPreview.risks,
          keyStakeholders: transformationRoadmapPreview.keyStakeholders,
          notes: transformationRoadmapPreview.notes,
          healthScore: transformationRoadmapPreview.healthScore,
          arr: transformationRoadmapPreview.arr,
          customer: {
            id: planRow.customer_id || null,
            name: context.platformData.customer360?.name || 'Unknown Customer',
            healthScore: context.platformData.customer360?.healthScore,
            arr: context.platformData.customer360?.arr,
            renewalDate: context.platformData.customer360?.renewalDate,
          },
        },
        planId,
      });
    }

    // Check if this is a portfolio dashboard artifact - return preview for HITL (General Mode)
    const isPortfolioDashboardArtifact = finalPlan.taskType === 'portfolio_dashboard' ||
                                          planRow.user_query?.toLowerCase().includes('portfolio dashboard') ||
                                          planRow.user_query?.toLowerCase().includes('portfolio overview') ||
                                          planRow.user_query?.toLowerCase().includes('customer portfolio') ||
                                          planRow.user_query?.toLowerCase().includes('my portfolio') ||
                                          planRow.user_query?.toLowerCase().includes('all customers') ||
                                          planRow.user_query?.toLowerCase().includes('all my customers') ||
                                          planRow.user_query?.toLowerCase().includes('customer list') ||
                                          planRow.user_query?.toLowerCase().includes('book of business') ||
                                          planRow.user_query?.toLowerCase().includes('account list') ||
                                          planRow.user_query?.toLowerCase().includes('show customers') ||
                                          planRow.user_query?.toLowerCase().includes('customer health dashboard');

    if (isPortfolioDashboardArtifact) {
      // Generate portfolio dashboard content - this works in General Mode (no customer required)
      const portfolioDashboardPreview = await artifactGenerator.generatePortfolioDashboardPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: null, // General Mode - no specific customer
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isPortfolioDashboardPreview: true,
        preview: {
          title: portfolioDashboardPreview.title,
          createdDate: portfolioDashboardPreview.createdDate,
          lastUpdated: portfolioDashboardPreview.lastUpdated,
          summary: portfolioDashboardPreview.summary,
          customers: portfolioDashboardPreview.customers,
          filters: portfolioDashboardPreview.filters,
          columns: portfolioDashboardPreview.columns,
          availableSegments: portfolioDashboardPreview.availableSegments,
          availableTiers: portfolioDashboardPreview.availableTiers,
          availableOwners: portfolioDashboardPreview.availableOwners,
          notes: portfolioDashboardPreview.notes,
        },
        planId,
      });
    }

    // Check if this is a team metrics artifact - return preview for HITL (General Mode)
    const isTeamMetricsArtifact = finalPlan.taskType === 'team_metrics' ||
                                  planRow.user_query?.toLowerCase().includes('team metrics') ||
                                  planRow.user_query?.toLowerCase().includes('team performance') ||
                                  planRow.user_query?.toLowerCase().includes('csm metrics') ||
                                  planRow.user_query?.toLowerCase().includes('csm performance') ||
                                  planRow.user_query?.toLowerCase().includes('team dashboard') ||
                                  planRow.user_query?.toLowerCase().includes('manager dashboard') ||
                                  planRow.user_query?.toLowerCase().includes('team report') ||
                                  planRow.user_query?.toLowerCase().includes('csm report') ||
                                  planRow.user_query?.toLowerCase().includes('team kpis') ||
                                  planRow.user_query?.toLowerCase().includes('csm kpis') ||
                                  planRow.user_query?.toLowerCase().includes('team health') ||
                                  planRow.user_query?.toLowerCase().includes('compare csms') ||
                                  planRow.user_query?.toLowerCase().includes('csm comparison') ||
                                  planRow.user_query?.toLowerCase().includes('my team');

    if (isTeamMetricsArtifact) {
      // Generate team metrics content - this works in General Mode (no customer required)
      const teamMetricsPreview = await artifactGenerator.generateTeamMetricsPreview({
        plan: finalPlan,
        context,
        userId,
        customerId: null, // General Mode - no specific customer
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isTeamMetricsPreview: true,
        preview: {
          title: teamMetricsPreview.title,
          createdDate: teamMetricsPreview.createdDate,
          lastUpdated: teamMetricsPreview.lastUpdated,
          summary: teamMetricsPreview.summary,
          csms: teamMetricsPreview.csms,
          metrics: teamMetricsPreview.metrics,
          filters: teamMetricsPreview.filters,
          columns: teamMetricsPreview.columns,
          availableCsms: teamMetricsPreview.availableCsms,
          notes: teamMetricsPreview.notes,
        },
        planId,
      });
    }

    // Check if this is a renewal pipeline artifact - return preview for HITL (General Mode)
    const isRenewalPipelineArtifact = finalPlan.taskType === 'renewal_pipeline' ||
                                      planRow.user_query?.toLowerCase().includes('renewal pipeline') ||
                                      planRow.user_query?.toLowerCase().includes('renewals pipeline') ||
                                      planRow.user_query?.toLowerCase().includes('upcoming renewals') ||
                                      planRow.user_query?.toLowerCase().includes('renewal forecast') ||
                                      planRow.user_query?.toLowerCase().includes('renewal calendar') ||
                                      planRow.user_query?.toLowerCase().includes('renewal schedule') ||
                                      planRow.user_query?.toLowerCase().includes('renewal tracker') ||
                                      planRow.user_query?.toLowerCase().includes('renewal list') ||
                                      planRow.user_query?.toLowerCase().includes('renewals this quarter') ||
                                      planRow.user_query?.toLowerCase().includes('renewals this month') ||
                                      planRow.user_query?.toLowerCase().includes('renewals due') ||
                                      planRow.user_query?.toLowerCase().includes('upcoming renewals') ||
                                      planRow.user_query?.toLowerCase().includes('show renewals') ||
                                      planRow.user_query?.toLowerCase().includes('all renewals');

    if (isRenewalPipelineArtifact) {
      // Generate renewal pipeline content - this works in General Mode (no customer required)
      const renewalPipelinePreview = await artifactGenerator.generateRenewalPipelinePreview({
        plan: finalPlan,
        context,
        userId,
        customerId: null, // General Mode - no specific customer
        isTemplate: isTemplateMode,
      });

      // Keep plan in 'approved' status until user confirms save
      await planService.updatePlanStatus(planId, 'approved');

      return res.json({
        success: true,
        isRenewalPipelinePreview: true,
        preview: {
          title: renewalPipelinePreview.title,
          createdDate: renewalPipelinePreview.createdDate,
          lastUpdated: renewalPipelinePreview.lastUpdated,
          summary: renewalPipelinePreview.summary,
          renewals: renewalPipelinePreview.renewals,
          filters: renewalPipelinePreview.filters,
          columns: renewalPipelinePreview.columns,
          availableOwners: renewalPipelinePreview.availableOwners,
          availableTiers: renewalPipelinePreview.availableTiers,
          availableSegments: renewalPipelinePreview.availableSegments,
          notes: renewalPipelinePreview.notes,
        },
        planId,
      });
    }

    // Generate the artifact (with template mode support)
    const artifact = await artifactGenerator.generate({
      plan: finalPlan,
      context,
      userId,
      customerId: planRow.customer_id,
      isTemplate: isTemplateMode,
    });

    // Update plan to completed
    await planService.updatePlanStatus(planId, 'completed');

    // Build response with template mode info
    const response: Record<string, any> = {
      success: true,
      artifactId: artifact.artifactId,
      status: 'completed',
      preview: artifact.preview,
      storage: artifact.storage,
      metadata: {
        generationDurationMs: artifact.metadata.generationDurationMs,
        sourcesUsed: artifact.metadata.sourcesUsed,
      },
    };

    // Add template-specific fields
    if (isTemplateMode || (artifact as any).isTemplate) {
      response.isTemplate = true;
      response.templateFolderId = (artifact as any).templateFolderId;
      response.message = 'Template generated successfully. Replace placeholder data before using.';
    }

    res.json(response);
  } catch (error) {
    console.error('[CADG] Plan approval error:', error);

    // Try to update plan status to failed
    try {
      await planService.updatePlanStatus(
        req.params.planId,
        'failed',
        error instanceof Error ? error.message : 'Execution failed'
      );
    } catch {}

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute plan',
    });
  }
});

/**
 * POST /api/cadg/plan/:planId/reject
 * Reject a plan
 */
router.post('/plan/:planId/reject', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { reason } = req.body;

    const result = await planService.rejectPlan(planId, reason);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      message: 'Plan rejected',
    });
  } catch (error) {
    console.error('[CADG] Plan rejection error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reject plan',
    });
  }
});

/**
 * GET /api/cadg/artifact/:artifactId
 * Get a generated artifact
 */
router.get('/artifact/:artifactId', async (req: Request, res: Response) => {
  try {
    const { artifactId } = req.params;

    const { artifact, success, error } = await artifactGenerator.getArtifact(artifactId);

    if (!success || !artifact) {
      return res.status(404).json({
        success: false,
        error: error || 'Artifact not found',
      });
    }

    res.json({
      success: true,
      artifact: {
        id: artifact.id,
        type: artifact.artifact_type,
        title: artifact.title,
        preview: artifact.preview_markdown,
        driveUrl: artifact.drive_url,
        createdAt: artifact.created_at,
        sourcesUsed: artifact.sources_used,
        generationDurationMs: artifact.generation_duration_ms,
      },
    });
  } catch (error) {
    console.error('[CADG] Get artifact error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get artifact',
    });
  }
});

/**
 * GET /api/cadg/artifact/:artifactId/download
 * Download artifact in specified format
 */
router.get('/artifact/:artifactId/download', async (req: Request, res: Response) => {
  try {
    const { artifactId } = req.params;
    const { format } = req.query as { format?: string };
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    // Get the artifact
    const { artifact, success, error } = await artifactGenerator.getArtifact(artifactId);

    if (!success || !artifact) {
      return res.status(404).json({
        success: false,
        error: error || 'Artifact not found',
      });
    }

    if (!artifact.drive_file_id) {
      return res.status(400).json({
        success: false,
        error: 'Artifact has no associated Drive file',
      });
    }

    // Determine export format based on artifact type and requested format
    const exportFormats: Record<string, Record<string, string>> = {
      slides: {
        pdf: 'application/pdf',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      },
      sheets: {
        pdf: 'application/pdf',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        csv: 'text/csv',
      },
      docs: {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    };

    const artifactType = artifact.artifact_type || 'docs';
    const formatOptions = exportFormats[artifactType] || exportFormats.docs;
    const requestedFormat = format || 'pdf';
    const mimeType = formatOptions[requestedFormat] || 'application/pdf';

    // Export the file
    const fileBuffer = await driveService.exportFile(userId, artifact.drive_file_id, mimeType);

    // Determine filename
    const extension = requestedFormat;
    const filename = `${artifact.title || 'artifact'}.${extension}`;

    // Set headers and send file
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    res.send(fileBuffer);
  } catch (error) {
    console.error('[CADG] Download error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to download artifact',
    });
  }
});

/**
 * GET /api/cadg/artifact/:artifactId/export-sources
 * Export data sources used in artifact generation as CSV
 */
router.get('/artifact/:artifactId/export-sources', async (req: Request, res: Response) => {
  try {
    const { artifactId } = req.params;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    // Get the artifact
    const { artifact, success, error } = await artifactGenerator.getArtifact(artifactId);

    if (!success || !artifact) {
      return res.status(404).json({
        success: false,
        error: error || 'Artifact not found',
      });
    }

    // Get the plan to access context data
    const planResult = await planService.getPlan(artifact.plan_id);

    if (!planResult.success || !planResult.plan) {
      return res.status(404).json({
        success: false,
        error: 'Associated plan not found',
      });
    }

    // Build CSV content from sources used
    const sources = artifact.sources_used || [];
    const csvRows: string[] = [
      'Source Type,Category,Description,Value',
    ];

    // Add rows for each source type
    for (const source of sources) {
      switch (source) {
        case 'customer_360':
          csvRows.push(`Customer 360,Profile,Customer health and status data,Included`);
          break;
        case 'health_trends':
          csvRows.push(`Health Trends,Metrics,Historical health score data,Included`);
          break;
        case 'engagement_metrics':
          csvRows.push(`Engagement,Metrics,Feature adoption and usage data,Included`);
          break;
        case 'risk_signals':
          csvRows.push(`Risk Signals,Alerts,Active risk indicators,Included`);
          break;
        case 'renewal_forecast':
          csvRows.push(`Renewal Forecast,Prediction,Renewal probability and timeline,Included`);
          break;
        case 'value_summary':
          csvRows.push(`Value Summary,Analysis,ROI metrics and success stories,Included`);
          break;
        case 'customer_history':
          csvRows.push(`Interaction History,Timeline,Recent customer touchpoints,Included`);
          break;
        case 'knowledge_base':
          csvRows.push(`Knowledge Base,Content,Relevant playbooks and guides,Included`);
          break;
        case 'template_data':
          csvRows.push(`Template Data,Sample,Placeholder data for template,Included`);
          break;
        default:
          csvRows.push(`${source},Other,Additional data source,Included`);
      }
    }

    // Add metadata
    csvRows.push('');
    csvRows.push('Metadata,Value');
    csvRows.push(`Artifact ID,${artifactId}`);
    csvRows.push(`Generated At,${artifact.created_at}`);
    csvRows.push(`Generation Duration,${artifact.generation_duration_ms}ms`);
    csvRows.push(`Artifact Type,${artifact.artifact_type}`);

    const csvContent = csvRows.join('\n');

    // Send CSV
    const filename = `data-sources-${artifactId.slice(0, 8)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error('[CADG] Export sources error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export data sources',
    });
  }
});

/**
 * GET /api/cadg/plans
 * Get user's plans
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;
    const { status, customerId, limit } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    const { plans, success, error } = await planService.getUserPlans(userId, {
      status: status as any,
      customerId: customerId as string,
      limit: limit ? parseInt(limit as string) : 20,
    });

    if (!success) {
      return res.status(500).json({
        success: false,
        error,
      });
    }

    res.json({
      success: true,
      plans: plans.map(p => ({
        id: p.id,
        taskType: p.task_type,
        userQuery: p.user_query,
        status: p.status,
        customerId: p.customer_id,
        createdAt: p.created_at,
        approvedAt: p.approved_at,
      })),
    });
  } catch (error) {
    console.error('[CADG] Get plans error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get plans',
    });
  }
});

/**
 * GET /api/cadg/capabilities
 * Get all available capabilities
 */
router.get('/capabilities', async (_req: Request, res: Response) => {
  try {
    const capabilities = await capabilityMatcher.getAllCapabilities();

    res.json({
      success: true,
      capabilities: capabilities.map(c => ({
        id: c.id,
        name: c.name,
        category: c.category,
        description: c.description,
        examplePrompts: c.examplePrompts.slice(0, 3),
      })),
    });
  } catch (error) {
    console.error('[CADG] Get capabilities error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get capabilities',
    });
  }
});

/**
 * POST /api/cadg/email/suggest
 * Get AI suggestions to improve email draft
 */
router.post('/email/suggest', async (req: Request, res: Response) => {
  try {
    const { subject, body, customerId } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!body) {
      return res.status(400).json({
        success: false,
        error: 'Email body is required',
      });
    }

    // Get customer context if available
    let customerContext = '';
    if (customerId) {
      try {
        const context = await contextAggregator.aggregateContext({
          taskType: 'email_drafting',
          customerId,
          userQuery: 'get customer context for email',
          userId,
        });

        if (context.platformData.customer360) {
          const c = context.platformData.customer360;
          customerContext = `
Customer: ${c.name || 'Unknown'}
Health Score: ${c.healthScore || 'N/A'}
Status: ${c.status || 'N/A'}
ARR: ${c.arr ? `$${c.arr.toLocaleString()}` : 'N/A'}
Renewal Date: ${c.renewalDate || 'N/A'}
`;
        }
      } catch (err) {
        console.warn('[CADG] Could not fetch customer context:', err);
      }
    }

    // Call Claude for suggestions
    const prompt = `You are a customer success expert. Review this email and suggest ONE specific improvement. Be concise (2-3 sentences max).

${customerContext ? `Customer Context:\n${customerContext}\n` : ''}
Subject: ${subject || '(no subject)'}

Email Body:
${body}

Provide a specific, actionable suggestion to make this email more effective. Focus on tone, clarity, personalization, or call-to-action. Do not rewrite the entire email, just suggest one improvement.`;

    // Use the reasoning engine's Claude integration
    const suggestion = await reasoningEngine.generateSuggestion(prompt);

    res.json({
      success: true,
      suggestion,
    });
  } catch (error) {
    console.error('[CADG] Email suggest error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get suggestion',
    });
  }
});

/**
 * POST /api/cadg/email/send
 * Send finalized email after user review
 */
router.post('/email/send', async (req: Request, res: Response) => {
  try {
    const { planId, to, cc, subject, body, customerId } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!to || !Array.isArray(to) || to.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recipients (to) are required',
      });
    }

    if (!subject || !body) {
      return res.status(400).json({
        success: false,
        error: 'Subject and body are required',
      });
    }

    // Import gmail service dynamically to avoid circular dependencies
    const { gmailService } = await import('../services/google/gmail.js');

    // Send the email
    const messageId = await gmailService.sendEmail(userId, {
      to,
      cc: cc || [],
      subject,
      bodyHtml: body.replace(/\n/g, '<br>'),
      bodyText: body,
      saveToDb: true,
      customerId,
    });

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity for customer timeline
    if (customerId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const { config } = await import('../config/index.js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'email_sent',
            description: `Email sent: ${subject}`,
            metadata: {
              recipients: to,
              cc: cc || [],
              subject,
              gmailMessageId: messageId,
              sentVia: 'cadg_email_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log email activity:', err);
      }
    }

    res.json({
      success: true,
      messageId,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Email send error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    });
  }
});

/**
 * POST /api/cadg/document/suggest
 * Get AI suggestions to improve document section
 */
router.post('/document/suggest', async (req: Request, res: Response) => {
  try {
    const { sectionTitle, sectionContent, documentTitle, customerId } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!sectionContent) {
      return res.status(400).json({
        success: false,
        error: 'Section content is required',
      });
    }

    // Get customer context if available
    let customerContext = '';
    if (customerId) {
      try {
        const context = await contextAggregator.aggregateContext({
          taskType: 'document_creation',
          customerId,
          userQuery: 'get customer context for document',
          userId,
        });

        if (context.platformData.customer360) {
          const c = context.platformData.customer360;
          customerContext = `
Customer: ${c.name || 'Unknown'}
Health Score: ${c.healthScore || 'N/A'}
Status: ${c.status || 'N/A'}
ARR: ${c.arr ? `$${c.arr.toLocaleString()}` : 'N/A'}
Renewal Date: ${c.renewalDate || 'N/A'}
`;
        }
      } catch (err) {
        console.warn('[CADG] Could not fetch customer context:', err);
      }
    }

    // Call Claude for suggestions
    const prompt = `You are a customer success expert. Review this document section and suggest ONE specific improvement. Be concise (2-3 sentences max).

${customerContext ? `Customer Context:\n${customerContext}\n` : ''}
Document: ${documentTitle || '(untitled)'}
Section: ${sectionTitle || '(untitled section)'}

Section Content:
${sectionContent}

Provide a specific, actionable suggestion to make this section more effective. Focus on clarity, completeness, actionable insights, or professional tone. Do not rewrite the entire section, just suggest one improvement.`;

    // Use the reasoning engine's Claude integration
    const suggestion = await reasoningEngine.generateSuggestion(prompt);

    res.json({
      success: true,
      suggestion,
    });
  } catch (error) {
    console.error('[CADG] Document suggest error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get suggestion',
    });
  }
});

/**
 * POST /api/cadg/document/save
 * Save finalized document after user review
 */
router.post('/document/save', async (req: Request, res: Response) => {
  try {
    const { planId, title, sections, customerId } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!title || !sections || !Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Title and sections are required',
      });
    }

    // Import docs and drive services
    const { docsService } = await import('../services/google/docs.js');

    // Build document content in Google Docs format
    const documentContent = sections.map((s: { title: string; content: string }) =>
      `## ${s.title}\n\n${s.content}`
    ).join('\n\n---\n\n');

    // Create document in Google Docs
    const result = await docsService.createDocument(userId, {
      title,
      content: documentContent,
      folderId: customerId ? undefined : undefined, // Will use customer folder if available
    });

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity for customer timeline
    if (customerId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const { config } = await import('../config/index.js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'document_created',
            description: `Document created: ${title}`,
            metadata: {
              documentId: result.id,
              documentUrl: result.webViewLink,
              sectionCount: sections.length,
              createdVia: 'cadg_document_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log document activity:', err);
      }
    }

    res.json({
      success: true,
      documentId: result.id,
      documentUrl: result.webViewLink,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Document save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save document',
    });
  }
});

/**
 * POST /api/cadg/meeting-prep/suggest
 * Get AI suggestions for meeting prep (agenda or talking points)
 */
router.post('/meeting-prep/suggest', async (req: Request, res: Response) => {
  try {
    const { suggestionType, currentItems, customerId, meetingContext } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!suggestionType || !['agenda', 'talking_points'].includes(suggestionType)) {
      return res.status(400).json({
        success: false,
        error: 'Valid suggestionType (agenda or talking_points) is required',
      });
    }

    // Get customer context if available
    let customerContext = '';
    if (customerId) {
      try {
        const context = await contextAggregator.aggregateContext({
          taskType: 'meeting_prep',
          customerId,
          userQuery: 'get customer context for meeting prep',
          userId,
        });

        if (context.platformData.customer360) {
          const c = context.platformData.customer360;
          customerContext = `
Customer: ${c.name || 'Unknown'}
Health Score: ${c.healthScore || 'N/A'}
Status: ${c.status || 'N/A'}
ARR: ${c.arr ? `$${c.arr.toLocaleString()}` : 'N/A'}
Renewal Date: ${c.renewalDate || 'N/A'}
`;
        }
      } catch (err) {
        console.warn('[CADG] Could not fetch customer context:', err);
      }
    }

    const itemType = suggestionType === 'agenda' ? 'agenda items' : 'talking points';
    const currentList = (currentItems || []).join('\n- ');

    // Call Claude for suggestions
    const prompt = `You are a customer success expert preparing for a meeting. Suggest 3-5 additional ${itemType} that would be valuable.

${customerContext ? `Customer Context:\n${customerContext}\n` : ''}
Meeting: ${meetingContext || 'Customer meeting'}

Current ${itemType}:
${currentList ? `- ${currentList}` : '(none yet)'}

Provide 3-5 concise, actionable ${itemType} that complement the existing list. ${suggestionType === 'talking_points' ? 'Focus on key messages, questions to ask, or points to emphasize.' : 'Focus on topics that drive value and progress.'}

Return ONLY a JSON array of strings, like: ["Item 1", "Item 2", "Item 3"]`;

    const response = await reasoningEngine.generateSuggestion(prompt);

    // Parse the JSON array from response
    let suggestions: string[] = [];
    try {
      // Try to extract JSON array from response
      const jsonMatch = response.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        // Fall back to splitting by newlines
        suggestions = response
          .split('\n')
          .map(s => s.replace(/^[-•*\d.)\s]+/, '').trim())
          .filter(s => s.length > 0)
          .slice(0, 5);
      }
    } catch {
      // If parsing fails, return the raw text split
      suggestions = response
        .split('\n')
        .map(s => s.replace(/^[-•*\d.)\s]+/, '').trim())
        .filter(s => s.length > 0)
        .slice(0, 5);
    }

    res.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error('[CADG] Meeting prep suggest error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get suggestions',
    });
  }
});

/**
 * POST /api/cadg/meeting-prep/save
 * Save finalized meeting prep after user review
 */
router.post('/meeting-prep/save', async (req: Request, res: Response) => {
  try {
    const { planId, title, attendees, agenda, talkingPoints, risks, customerId } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    // Import docs service
    const { docsService } = await import('../services/google/docs.js');

    // Build meeting prep document content
    const documentContent = `# ${title}

## Attendees
${(attendees || []).map((a: string) => `- ${a}`).join('\n') || 'TBD'}

## Agenda
${(agenda || []).map((a: { topic: string }, i: number) => `${i + 1}. ${a.topic}`).join('\n') || 'TBD'}

## Talking Points
${(talkingPoints || []).map((t: { point: string }) => `- ${t.point}`).join('\n') || 'No talking points defined'}

## Risks & Concerns
${(risks || []).map((r: { risk: string }) => `- ${r.risk}`).join('\n') || 'No risks identified'}
`;

    // Create document in Google Docs
    const result = await docsService.createDocument(userId, {
      title,
      content: documentContent,
    });

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity for customer timeline
    if (customerId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const { config } = await import('../config/index.js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'meeting_prep_created',
            description: `Meeting prep created: ${title}`,
            metadata: {
              documentId: result.id,
              documentUrl: result.webViewLink,
              attendeesCount: (attendees || []).length,
              agendaCount: (agenda || []).length,
              talkingPointsCount: (talkingPoints || []).length,
              createdVia: 'cadg_meeting_prep_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log meeting prep activity:', err);
      }
    }

    res.json({
      success: true,
      documentId: result.id,
      documentUrl: result.webViewLink,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Meeting prep save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save meeting prep',
    });
  }
});

/**
 * POST /api/cadg/kickoff-plan/save
 * Save finalized kickoff plan after user review
 */
router.post('/kickoff-plan/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      attendees,
      agenda,
      goals,
      nextSteps,
      notes,
      meetingDate,
      meetingDuration,
      customerId,
    } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    // Import docs service
    const { docsService } = await import('../services/google/docs.js');

    // Build kickoff plan document content
    const documentContent = `# ${title}

**Date:** ${meetingDate || 'TBD'}
**Duration:** ${meetingDuration || '90 min'}

---

## Attendees
${(attendees || []).map((a: { name: string; email: string; role: string }) =>
  `- **${a.name}** (${a.role})${a.email ? ` - ${a.email}` : ''}`
).join('\n') || 'TBD'}

---

## Meeting Agenda

${(agenda || []).map((a: { topic: string; duration: string; owner: string }, i: number) =>
  `### ${i + 1}. ${a.topic}
- **Duration:** ${a.duration || '10 min'}
- **Owner:** ${a.owner || 'CSM'}`
).join('\n\n') || 'TBD'}

---

## Onboarding Goals

${(goals || []).map((g: { goal: string }, i: number) =>
  `${i + 1}. ${g.goal}`
).join('\n') || 'No goals defined'}

---

## Next Steps

| # | Action | Owner | Due Date |
|---|--------|-------|----------|
${(nextSteps || []).map((s: { action: string; owner: string; dueDate: string }, i: number) =>
  `| ${i + 1} | ${s.action} | ${s.owner || 'TBD'} | ${s.dueDate || 'TBD'} |`
).join('\n') || '| - | No next steps defined | - | - |'}

---

## Notes

${notes || 'No additional notes.'}

---

*Generated by CSCX.AI on ${new Date().toLocaleDateString()}*
`;

    // Create document in Google Docs
    const result = await docsService.createDocument(userId, {
      title,
      content: documentContent,
    });

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity for customer timeline
    if (customerId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const { config } = await import('../config/index.js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'kickoff_plan_created',
            description: `Kickoff plan created: ${title}`,
            metadata: {
              documentId: result.id,
              documentUrl: result.webViewLink,
              attendeesCount: (attendees || []).length,
              agendaCount: (agenda || []).length,
              goalsCount: (goals || []).length,
              nextStepsCount: (nextSteps || []).length,
              meetingDate,
              createdVia: 'cadg_kickoff_plan_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log kickoff plan activity:', err);
      }
    }

    res.json({
      success: true,
      documentId: result.id,
      documentUrl: result.webViewLink,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Kickoff plan save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save kickoff plan',
    });
  }
});

/**
 * POST /api/cadg/milestone-plan/save
 * Save finalized milestone plan (30-60-90) after user review
 */
router.post('/milestone-plan/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      phases,
      notes,
      startDate,
      customerId,
    } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    // Import docs and sheets services
    const { docsService } = await import('../services/google/docs.js');
    const { sheetsService } = await import('../services/google/sheets.js');

    // Build milestone plan document content
    const documentContent = `# ${title}

**Start Date:** ${startDate || 'TBD'}

---

${(phases || []).map((phase: {
  name: string;
  daysLabel: string;
  goals: Array<{ goal: string; completed: boolean }>;
  milestones: Array<{ milestone: string; date: string; owner: string }>;
  successCriteria: Array<{ criteria: string }>;
}) => `## ${phase.name} (${phase.daysLabel})

### Goals
${(phase.goals || []).map((g: { goal: string; completed: boolean }, i: number) =>
  `${i + 1}. ${g.completed ? '~~' + g.goal + '~~ ✓' : g.goal}`
).join('\n') || 'No goals defined'}

### Milestones

| Milestone | Target Date | Owner |
|-----------|-------------|-------|
${(phase.milestones || []).map((m: { milestone: string; date: string; owner: string }) =>
  `| ${m.milestone} | ${m.date || 'TBD'} | ${m.owner || 'TBD'} |`
).join('\n') || '| No milestones defined | - | - |'}

### Success Criteria
${(phase.successCriteria || []).map((c: { criteria: string }, i: number) =>
  `- ${c.criteria}`
).join('\n') || '- No success criteria defined'}

---
`).join('\n')}

## Notes

${notes || 'No additional notes.'}

---

*Generated by CSCX.AI on ${new Date().toLocaleDateString()}*
`;

    // Create document in Google Docs
    const docResult = await docsService.createDocument(userId, {
      title,
      content: documentContent,
    });

    // Also create a Google Sheet tracker for milestones
    let sheetResult: { id: string; webViewLink?: string } | null = null;
    try {
      // Build sheet data with all milestones across phases
      const sheetData: string[][] = [
        ['Phase', 'Milestone', 'Target Date', 'Owner', 'Status'],
      ];

      (phases || []).forEach((phase: {
        name: string;
        milestones: Array<{ milestone: string; date: string; owner: string }>;
      }) => {
        (phase.milestones || []).forEach((m: { milestone: string; date: string; owner: string }) => {
          sheetData.push([
            phase.name,
            m.milestone,
            m.date || '',
            m.owner || '',
            'Pending',
          ]);
        });
      });

      sheetResult = await sheetsService.createSpreadsheet(userId, {
        title: `${title} - Tracker`,
        template: { type: 'onboarding_tracker' },
      });

      if (sheetResult) {
        await sheetsService.updateValues(userId, sheetResult.id, {
          range: 'A1',
          values: sheetData,
        });
      }
    } catch (err) {
      console.warn('[CADG] Could not create milestone tracker sheet:', err);
      // Continue without sheet
    }

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity for customer timeline
    if (customerId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const { config } = await import('../config/index.js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'milestone_plan_created',
            description: `Milestone plan created: ${title}`,
            metadata: {
              documentId: docResult.id,
              documentUrl: docResult.webViewLink,
              sheetId: sheetResult?.id,
              sheetUrl: sheetResult?.webViewLink,
              phasesCount: (phases || []).length,
              totalMilestones: (phases || []).reduce((sum: number, p: { milestones?: Array<unknown> }) =>
                sum + (p.milestones?.length || 0), 0),
              startDate,
              createdVia: 'cadg_milestone_plan_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log milestone plan activity:', err);
      }
    }

    res.json({
      success: true,
      documentId: docResult.id,
      documentUrl: docResult.webViewLink,
      sheetId: sheetResult?.id,
      sheetUrl: sheetResult?.webViewLink,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Milestone plan save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save milestone plan',
    });
  }
});

/**
 * POST /api/cadg/stakeholder-map/save
 * Save finalized stakeholder map after user review
 */
router.post('/stakeholder-map/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      stakeholders,
      relationships,
      notes,
      customerId,
    } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    // Import slides service for visual org chart
    const { slidesService } = await import('../services/google/slides.js');
    const { docsService } = await import('../services/google/docs.js');

    // Build stakeholder map document content
    const documentContent = `# ${title}

---

## Key Stakeholders

${(stakeholders || []).map((s: {
  name: string;
  title: string;
  email: string;
  role: string;
  influenceLevel: number;
  engagementLevel: string;
  notes: string;
}) => `### ${s.name}
- **Title:** ${s.title || 'N/A'}
- **Email:** ${s.email || 'N/A'}
- **Role:** ${s.role || 'User'}
- **Influence Level:** ${'★'.repeat(s.influenceLevel || 3)}${'☆'.repeat(5 - (s.influenceLevel || 3))} (${s.influenceLevel || 3}/5)
- **Engagement:** ${s.engagementLevel || 'Medium'}
${s.notes ? `- **Notes:** ${s.notes}` : ''}
`).join('\n')}

---

## Relationships

| From | Relationship | To |
|------|--------------|-----|
${(relationships || []).map((r: {
  fromId: string;
  toId: string;
  relationship: string;
}) => {
  const fromStakeholder = (stakeholders || []).find((s: { id: string }) => s.id === r.fromId);
  const toStakeholder = (stakeholders || []).find((s: { id: string }) => s.id === r.toId);
  return `| ${fromStakeholder?.name || 'Unknown'} | ${r.relationship || '-'} | ${toStakeholder?.name || 'Unknown'} |`;
}).join('\n') || '| No relationships defined | - | - |'}

---

## Role Legend

| Role | Description |
|------|-------------|
| Champion | Internal advocate, actively promotes the partnership |
| Sponsor | Executive decision maker, budget authority |
| Evaluator | Assesses value and ROI |
| User | Active user of the product |
| Blocker | Potential obstacle to adoption or renewal |

---

## Notes

${notes || 'No additional notes.'}

---

*Generated by CSCX.AI on ${new Date().toLocaleDateString()}*
`;

    // Create document in Google Docs
    const docResult = await docsService.createDocument(userId, {
      title,
      content: documentContent,
    });

    // Also try to create a visual org chart in Google Slides
    let slidesResult: { id: string; webViewLink?: string } | null = null;
    try {
      // Create a simple slides presentation with stakeholder cards
      slidesResult = await slidesService.createPresentation(userId, {
        title: `${title} - Visual Map`,
      });
      // Note: For a full implementation, you would add slides with stakeholder cards
      // arranged in an org chart layout. This is a simplified version.
    } catch (err) {
      console.warn('[CADG] Could not create stakeholder slides:', err);
      // Continue without slides
    }

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity for customer timeline
    if (customerId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const { config } = await import('../config/index.js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'stakeholder_map_created',
            description: `Stakeholder map created: ${title}`,
            metadata: {
              documentId: docResult.id,
              documentUrl: docResult.webViewLink,
              slidesId: slidesResult?.id,
              slidesUrl: slidesResult?.webViewLink,
              stakeholderCount: (stakeholders || []).length,
              relationshipCount: (relationships || []).length,
              createdVia: 'cadg_stakeholder_map_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log stakeholder map activity:', err);
      }
    }

    res.json({
      success: true,
      documentId: docResult.id,
      documentUrl: docResult.webViewLink,
      slidesId: slidesResult?.id,
      slidesUrl: slidesResult?.webViewLink,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Stakeholder map save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save stakeholder map',
    });
  }
});

/**
 * POST /api/cadg/training-schedule/save
 * Save finalized training schedule after user review
 */
router.post('/training-schedule/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      sessions,
      notes,
      startDate,
      customerId,
    } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    // Import docs and sheets services
    const { docsService } = await import('../services/google/docs.js');
    const { sheetsService } = await import('../services/google/sheets.js');

    // Build training schedule document content
    const documentContent = `# ${title}

**Start Date:** ${startDate || 'TBD'}
**Total Sessions:** ${(sessions || []).length}

---

${(sessions || []).map((session: {
  name: string;
  description: string;
  date: string;
  time: string;
  duration: string;
  trainer: string;
  attendeeGroups: string[];
  topics: string[];
  prerequisites: string[];
}, index: number) => `## Session ${index + 1}: ${session.name}

**Description:** ${session.description || 'N/A'}

| Detail | Value |
|--------|-------|
| Date | ${session.date || 'TBD'} |
| Time | ${session.time || 'TBD'} |
| Duration | ${session.duration || '60 min'} |
| Trainer | ${session.trainer || 'TBD'} |
| Attendees | ${(session.attendeeGroups || []).join(', ') || 'All Users'} |

### Topics
${(session.topics || []).map((t: string, i: number) => `${i + 1}. ${t}`).join('\n') || '- TBD'}

${(session.prerequisites || []).length > 0 ? `### Prerequisites
${session.prerequisites.map((p: string) => `- ${p}`).join('\n')}` : ''}

---
`).join('\n')}

## Notes

${notes || 'No additional notes.'}

---

*Generated by CSCX.AI on ${new Date().toLocaleDateString()}*
`;

    // Create document in Google Docs
    const docResult = await docsService.createDocument(userId, {
      title,
      content: documentContent,
    });

    // Also create a Google Sheet calendar for the training schedule
    let sheetResult: { id: string; webViewLink?: string } | null = null;
    try {
      // Build sheet data with all sessions
      const sheetData: string[][] = [
        ['Session', 'Date', 'Time', 'Duration', 'Trainer', 'Attendees', 'Topics', 'Prerequisites', 'Status'],
      ];

      (sessions || []).forEach((session: {
        name: string;
        date: string;
        time: string;
        duration: string;
        trainer: string;
        attendeeGroups: string[];
        topics: string[];
        prerequisites: string[];
      }) => {
        sheetData.push([
          session.name,
          session.date || '',
          session.time || '',
          session.duration || '',
          session.trainer || '',
          (session.attendeeGroups || []).join(', '),
          (session.topics || []).join('; '),
          (session.prerequisites || []).join('; '),
          'Scheduled',
        ]);
      });

      sheetResult = await sheetsService.createSpreadsheet(userId, {
        title: `${title} - Calendar`,
        template: { type: 'onboarding_tracker' },
      });

      if (sheetResult) {
        await sheetsService.updateValues(userId, sheetResult.id, {
          range: 'A1',
          values: sheetData,
        });
      }
    } catch (err) {
      console.warn('[CADG] Could not create training schedule sheet:', err);
      // Continue without sheet
    }

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity for customer timeline
    if (customerId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const { config } = await import('../config/index.js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'training_schedule_created',
            description: `Training schedule created: ${title}`,
            metadata: {
              documentId: docResult.id,
              documentUrl: docResult.webViewLink,
              sheetId: sheetResult?.id,
              sheetUrl: sheetResult?.webViewLink,
              sessionsCount: (sessions || []).length,
              startDate,
              createdVia: 'cadg_training_schedule_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log training schedule activity:', err);
      }
    }

    res.json({
      success: true,
      documentId: docResult.id,
      documentUrl: docResult.webViewLink,
      sheetId: sheetResult?.id,
      sheetUrl: sheetResult?.webViewLink,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Training schedule save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save training schedule',
    });
  }
});

/**
 * POST /api/cadg/usage-analysis/save
 * Save finalized usage analysis after user review
 */
router.post('/usage-analysis/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      timeRange,
      metrics,
      featureAdoption,
      userSegments,
      recommendations,
      chartTypes,
      notes,
      customerId,
    } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    // Import docs and sheets services
    const { docsService } = await import('../services/google/docs.js');
    const { sheetsService } = await import('../services/google/sheets.js');

    // Filter to only included items
    const includedMetrics = (metrics || []).filter((m: { included: boolean }) => m.included);
    const includedFeatures = (featureAdoption || []).filter((f: { included: boolean }) => f.included);
    const includedSegments = (userSegments || []).filter((s: { included: boolean }) => s.included);

    // Build usage analysis document content
    const documentContent = `# ${title}

**Analysis Period:** ${timeRange?.start || 'N/A'} to ${timeRange?.end || 'N/A'}

---

## Key Metrics

${includedMetrics.map((m: {
  name: string;
  value: number;
  unit: string;
  trend: string;
  trendValue: number;
}) => {
  const trendIcon = m.trend === 'up' ? '↑' : m.trend === 'down' ? '↓' : '→';
  const trendText = m.trendValue ? ` (${m.trendValue > 0 ? '+' : ''}${m.trendValue}%)` : '';
  return `- **${m.name}:** ${m.value} ${m.unit} ${trendIcon}${trendText}`;
}).join('\n') || '- No metrics included'}

---

## Feature Adoption

| Feature | Adoption Rate | Active Users | Trend |
|---------|---------------|--------------|-------|
${includedFeatures.map((f: {
  feature: string;
  adoptionRate: number;
  activeUsers: number;
  trend: string;
}) => {
  const trendIcon = f.trend === 'up' ? '↑' : f.trend === 'down' ? '↓' : '→';
  return `| ${f.feature} | ${f.adoptionRate}% | ${f.activeUsers} | ${trendIcon} |`;
}).join('\n') || '| No features included | - | - | - |'}

---

## User Segments

| Segment | Users | % of Total | Avg Engagement |
|---------|-------|------------|----------------|
${includedSegments.map((s: {
  name: string;
  count: number;
  percentage: number;
  avgEngagement: number;
}) => `| ${s.name} | ${s.count} | ${s.percentage}% | ${s.avgEngagement}% |`).join('\n') || '| No segments included | - | - | - |'}

---

## Recommendations

${(recommendations || []).map((r: {
  priority: string;
  category: string;
  recommendation: string;
  impact: string;
}, index: number) => {
  const priorityLabel = r.priority.toUpperCase();
  return `### ${index + 1}. [${priorityLabel}] ${r.category.charAt(0).toUpperCase() + r.category.slice(1)}

**Recommendation:** ${r.recommendation}

**Expected Impact:** ${r.impact}
`;
}).join('\n') || 'No recommendations included.'}

---

## Charts Included
${[
  chartTypes?.showTrendChart ? '- Usage Trend Chart' : null,
  chartTypes?.showAdoptionChart ? '- Feature Adoption Chart' : null,
  chartTypes?.showSegmentChart ? '- User Segment Distribution' : null,
  chartTypes?.showHeatmap ? '- Usage Heatmap' : null,
].filter(Boolean).join('\n') || '- No charts selected'}

---

## Notes

${notes || 'No additional notes.'}

---

*Generated by CSCX.AI on ${new Date().toLocaleDateString()}*
`;

    // Create document in Google Docs
    const docResult = await docsService.createDocument(userId, {
      title,
      content: documentContent,
    });

    // Also create a Google Sheet with the raw data
    let sheetResult: { id: string; webViewLink?: string } | null = null;
    try {
      // Build sheet data
      const metricsData: string[][] = [
        ['Metric Name', 'Value', 'Unit', 'Trend', 'Change %'],
        ...includedMetrics.map((m: {
          name: string;
          value: number;
          unit: string;
          trend: string;
          trendValue: number;
        }) => [
          m.name,
          m.value.toString(),
          m.unit,
          m.trend,
          m.trendValue.toString(),
        ]),
      ];

      const featuresData: string[][] = [
        ['Feature', 'Adoption Rate', 'Active Users', 'Trend'],
        ...includedFeatures.map((f: {
          feature: string;
          adoptionRate: number;
          activeUsers: number;
          trend: string;
        }) => [
          f.feature,
          f.adoptionRate.toString(),
          f.activeUsers.toString(),
          f.trend,
        ]),
      ];

      const segmentsData: string[][] = [
        ['Segment', 'Count', 'Percentage', 'Avg Engagement'],
        ...includedSegments.map((s: {
          name: string;
          count: number;
          percentage: number;
          avgEngagement: number;
        }) => [
          s.name,
          s.count.toString(),
          s.percentage.toString(),
          s.avgEngagement.toString(),
        ]),
      ];

      sheetResult = await sheetsService.createSpreadsheet(userId, {
        title: `${title} - Data`,
        template: { type: 'health_score_tracker' },
      });

      if (sheetResult) {
        // Add metrics sheet
        await sheetsService.updateValues(userId, sheetResult.id, {
          range: 'Sheet1!A1',
          values: metricsData,
        });

        // Note: For a full implementation, you would create separate sheets
        // for features and segments data
      }
    } catch (err) {
      console.warn('[CADG] Could not create usage analysis sheet:', err);
      // Continue without sheet
    }

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity for customer timeline
    if (customerId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const { config } = await import('../config/index.js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'usage_analysis_created',
            description: `Usage analysis created: ${title}`,
            metadata: {
              documentId: docResult.id,
              documentUrl: docResult.webViewLink,
              sheetId: sheetResult?.id,
              sheetUrl: sheetResult?.webViewLink,
              metricsCount: includedMetrics.length,
              featuresCount: includedFeatures.length,
              segmentsCount: includedSegments.length,
              recommendationsCount: (recommendations || []).length,
              timeRange,
              createdVia: 'cadg_usage_analysis_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log usage analysis activity:', err);
      }
    }

    res.json({
      success: true,
      documentId: docResult.id,
      documentUrl: docResult.webViewLink,
      sheetId: sheetResult?.id,
      sheetUrl: sheetResult?.webViewLink,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Usage analysis save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save usage analysis',
    });
  }
});

/**
 * POST /api/cadg/feature-campaign/save
 * Save finalized feature campaign after user review
 */
router.post('/feature-campaign/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      campaignGoal,
      targetFeatures,
      userSegments,
      timeline,
      messaging,
      successMetrics,
      notes,
      customerId,
    } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    // Import docs service
    const { docsService } = await import('../services/google/docs.js');

    // Filter to only included items
    const includedFeatures = (targetFeatures || []).filter((f: { included: boolean }) => f.included);
    const includedSegments = (userSegments || []).filter((s: { included: boolean }) => s.included);

    // Build feature campaign document content
    const documentContent = `# ${title}

**Campaign Goal:** ${campaignGoal || 'Drive feature adoption'}

**Timeline:** ${timeline?.startDate || 'TBD'} to ${timeline?.endDate || 'TBD'}

---

## Executive Summary

This feature adoption campaign aims to increase utilization of key platform capabilities by targeting specific user segments with personalized messaging and training. The campaign consists of ${(timeline?.phases || []).length} phases designed to maximize adoption through awareness, education, and reinforcement.

---

## Target Features

| Feature | Current Adoption | Target Adoption | Priority |
|---------|-----------------|-----------------|----------|
${includedFeatures.map((f: {
  name: string;
  currentAdoption: number;
  targetAdoption: number;
  priority: string;
}) => `| ${f.name} | ${f.currentAdoption}% | ${f.targetAdoption}% | ${f.priority.toUpperCase()} |`).join('\n') || '| No features selected | - | - | - |'}

---

## Target Segments

| Segment | Size | Current Usage | Potential |
|---------|------|---------------|-----------|
${includedSegments.map((s: {
  name: string;
  size: number;
  currentUsage: number;
  potential: string;
}) => `| ${s.name} | ${s.size} users | ${s.currentUsage}% | ${s.potential.toUpperCase()} |`).join('\n') || '| No segments selected | - | - | - |'}

---

## Campaign Timeline

${(timeline?.phases || []).map((phase: {
  name: string;
  startDate: string;
  endDate: string;
  activities: string[];
}, index: number) => `### Phase ${index + 1}: ${phase.name}

**Duration:** ${phase.startDate} to ${phase.endDate}

**Key Activities:**
${(phase.activities || []).map((activity: string) => `- ${activity}`).join('\n') || '- No activities defined'}
`).join('\n') || 'No phases defined.'}

---

## Messaging Strategy

${(messaging || []).map((msg: {
  channel: string;
  subject: string;
  content: string;
  timing: string;
  segment: string;
}, index: number) => `### Message ${index + 1}: ${msg.channel.toUpperCase()}

**Target Segment:** ${msg.segment}
**Timing:** ${msg.timing}
**Subject:** ${msg.subject}

**Content:**
${msg.content}
`).join('\n---\n\n') || 'No messaging templates defined.'}

---

## Success Metrics

| Metric | Current | Target | Unit |
|--------|---------|--------|------|
${(successMetrics || []).map((m: {
  name: string;
  current: number;
  target: number;
  unit: string;
}) => `| ${m.name} | ${m.current} | ${m.target} | ${m.unit} |`).join('\n') || '| No metrics defined | - | - | - |'}

---

## Notes

${notes || 'No additional notes.'}

---

*Generated by CSCX.AI on ${new Date().toLocaleDateString()}*
`;

    // Create document in Google Docs
    const docResult = await docsService.createDocument(userId, {
      title,
      content: documentContent,
    });

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity for customer timeline
    if (customerId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const { config } = await import('../config/index.js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'feature_campaign_created',
            description: `Feature campaign created: ${title}`,
            metadata: {
              documentId: docResult.id,
              documentUrl: docResult.webViewLink,
              featuresCount: includedFeatures.length,
              segmentsCount: includedSegments.length,
              phasesCount: (timeline?.phases || []).length,
              messagingCount: (messaging || []).length,
              metricsCount: (successMetrics || []).length,
              timeline,
              createdVia: 'cadg_feature_campaign_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log feature campaign activity:', err);
      }
    }

    res.json({
      success: true,
      documentId: docResult.id,
      documentUrl: docResult.webViewLink,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Feature campaign save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save feature campaign',
    });
  }
});

/**
 * POST /api/cadg/champion-development/save
 * Save finalized champion development program after user review
 */
router.post('/champion-development/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      programGoal,
      candidates,
      activities,
      rewards,
      timeline,
      successMetrics,
      notes,
      customerId,
    } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    // Import docs service
    const { docsService } = await import('../services/google/docs.js');

    // Filter to only selected candidates and enabled activities/rewards
    const selectedCandidates = (candidates || []).filter((c: any) => c.selected);
    const enabledActivities = (activities || []).filter((a: any) => a.enabled);
    const enabledRewards = (rewards || []).filter((r: any) => r.enabled);

    // Build document content
    const candidatesContent = selectedCandidates.map((c: any) =>
      `### ${c.name}
- **Role:** ${c.role}
- **Email:** ${c.email}
- **Engagement Score:** ${c.engagementScore}%
- **NPS Score:** ${c.npsScore}
- **Potential Level:** ${c.potentialLevel}
- **Strengths:** ${c.strengths?.join(', ') || 'None listed'}
- **Development Areas:** ${c.developmentAreas?.join(', ') || 'None listed'}`
    ).join('\n\n');

    const activitiesContent = enabledActivities.map((a: any) =>
      `### ${a.name}
- **Category:** ${a.category}
- **Description:** ${a.description}
- **Frequency:** ${a.frequency}
- **Owner:** ${a.owner}`
    ).join('\n\n');

    const rewardsContent = enabledRewards.map((r: any) =>
      `### ${r.name}
- **Type:** ${r.type}
- **Description:** ${r.description}
- **Criteria:** ${r.criteria}`
    ).join('\n\n');

    const milestonesContent = (timeline?.milestones || []).map((m: any) =>
      `| ${m.name} | ${m.date} | ${m.description} |`
    ).join('\n');

    const metricsContent = (successMetrics || []).map((m: any) =>
      `| ${m.name} | ${m.current} ${m.unit} | ${m.target} ${m.unit} | ${Math.round((m.current / m.target) * 100)}% |`
    ).join('\n');

    const documentContent = `# ${title}

## Program Goal

${programGoal}

## Program Timeline

- **Start Date:** ${timeline?.startDate || 'TBD'}
- **End Date:** ${timeline?.endDate || 'TBD'}

### Milestones

| Milestone | Date | Description |
|-----------|------|-------------|
${milestonesContent || '| No milestones defined | - | - |'}

## Champion Candidates (${selectedCandidates.length})

${candidatesContent || 'No candidates selected.'}

## Development Activities (${enabledActivities.length})

${activitiesContent || 'No activities defined.'}

## Recognition & Rewards (${enabledRewards.length})

${rewardsContent || 'No rewards defined.'}

## Success Metrics

| Metric | Current | Target | Progress |
|--------|---------|--------|----------|
${metricsContent || '| No metrics defined | - | - | - |'}

## Notes

${notes || 'No additional notes.'}

---

*Generated by CSCX.AI on ${new Date().toLocaleDateString()}*
`;

    // Create document in Google Docs
    const docResult = await docsService.createDocument(userId, {
      title,
      content: documentContent,
    });

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity for customer timeline
    if (customerId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const { config } = await import('../config/index.js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'champion_development_created',
            description: `Champion development program created: ${title}`,
            metadata: {
              documentId: docResult.id,
              documentUrl: docResult.webViewLink,
              candidatesCount: selectedCandidates.length,
              activitiesCount: enabledActivities.length,
              rewardsCount: enabledRewards.length,
              milestonesCount: (timeline?.milestones || []).length,
              metricsCount: (successMetrics || []).length,
              timeline,
              createdVia: 'cadg_champion_development_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log champion development activity:', err);
      }
    }

    res.json({
      success: true,
      documentId: docResult.id,
      documentUrl: docResult.webViewLink,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Champion development save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save champion development program',
    });
  }
});

/**
 * POST /api/cadg/training-program/save
 * Save finalized training program after user review
 */
router.post('/training-program/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      programGoal,
      modules,
      targetAudience,
      timeline,
      completionCriteria,
      successMetrics,
      notes,
      customerId,
    } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    // Import docs and sheets services
    const { docsService } = await import('../services/google/docs.js');
    const { sheetsService } = await import('../services/google/sheets.js');

    // Filter to only enabled modules, included audience, and enabled criteria
    const enabledModules = (modules || []).filter((m: any) => m.enabled);
    const includedAudience = (targetAudience || []).filter((a: any) => a.included);
    const enabledCriteria = (completionCriteria || []).filter((c: any) => c.enabled);

    // Build document content
    const modulesContent = enabledModules.map((m: any, idx: number) =>
      `### Module ${idx + 1}: ${m.name}

**Duration:** ${m.duration}
**Description:** ${m.description}

**Prerequisites:**
${m.prerequisites?.length > 0 ? m.prerequisites.map((p: string) => `- ${p}`).join('\n') : '- None'}

**Learning Objectives:**
${m.learningObjectives?.map((obj: string) => `- ${obj}`).join('\n') || '- None defined'}

**Assessment Criteria:**
${m.assessmentCriteria?.map((c: string) => `- ${c}`).join('\n') || '- None defined'}

**Resources:**
${m.resources?.map((r: any) => `- [${r.type.toUpperCase()}] ${r.name}${r.url ? ` (${r.url})` : ''}`).join('\n') || '- None defined'}`
    ).join('\n\n---\n\n');

    const audienceContent = includedAudience.map((a: any) =>
      `| ${a.name} | ${a.role} | ${a.currentSkillLevel} | ${a.targetSkillLevel} |`
    ).join('\n');

    const criteriaContent = enabledCriteria.map((c: any) =>
      `| ${c.name} | ${c.type} | ${c.requiredScore ? `${c.requiredScore}%` : 'N/A'} |`
    ).join('\n');

    const metricsContent = (successMetrics || []).map((m: any) =>
      `| ${m.name} | ${m.current} ${m.unit} | ${m.target} ${m.unit} | ${Math.round((m.current / m.target) * 100)}% |`
    ).join('\n');

    const totalHours = enabledModules.reduce((acc: number, m: any) => {
      const hours = parseFloat(m.duration.match(/[\d.]+/)?.[0] || '0');
      const isMinutes = m.duration.toLowerCase().includes('min');
      return acc + (isMinutes ? hours / 60 : hours);
    }, 0);

    const documentContent = `# ${title}

## Program Goal

${programGoal}

## Program Overview

- **Total Modules:** ${enabledModules.length}
- **Total Duration:** ${totalHours.toFixed(1)} hours
- **Timeline:** ${timeline?.startDate || 'TBD'} to ${timeline?.endDate || 'TBD'} (${timeline?.totalDuration || 'TBD'})

## Target Audience

| Audience | Role | Current Level | Target Level |
|----------|------|---------------|--------------|
${audienceContent || '| No audience defined | - | - | - |'}

## Training Modules

${modulesContent || 'No modules defined.'}

## Completion Criteria

| Criteria | Type | Required Score |
|----------|------|----------------|
${criteriaContent || '| No criteria defined | - | - |'}

## Success Metrics

| Metric | Current | Target | Progress |
|--------|---------|--------|----------|
${metricsContent || '| No metrics defined | - | - | - |'}

## Notes

${notes || 'No additional notes.'}

---

*Generated by CSCX.AI on ${new Date().toLocaleDateString()}*
`;

    // Create document in Google Docs
    const docResult = await docsService.createDocument(userId, {
      title,
      content: documentContent,
    });

    // Also create a Google Sheets tracker for module progress
    let sheetsResult = null;
    try {
      sheetsResult = await sheetsService.createSpreadsheet(userId, {
        title: `${title} - Progress Tracker`,
      });

      // Add headers and data to the sheet
      if (sheetsResult) {
        // Module progress sheet
        await sheetsService.updateValues(userId, sheetsResult.id, {
          range: 'Sheet1!A1:E1',
          values: [['Module', 'Duration', 'Status', 'Completed Date', 'Notes']],
        });

        const moduleRows = enabledModules.map((m: any) => [
          m.name,
          m.duration,
          'Not Started',
          '',
          '',
        ]);

        if (moduleRows.length > 0) {
          await sheetsService.updateValues(userId, sheetsResult.id, {
            range: 'Sheet1!A2',
            values: moduleRows,
          });
        }
      }
    } catch (err) {
      console.warn('[CADG] Could not create training tracker sheet:', err);
    }

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity for customer timeline
    if (customerId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const { config } = await import('../config/index.js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'training_program_created',
            description: `Training program created: ${title}`,
            metadata: {
              documentId: docResult.id,
              documentUrl: docResult.webViewLink,
              sheetsId: sheetsResult?.id,
              sheetsUrl: sheetsResult?.webViewLink,
              modulesCount: enabledModules.length,
              audienceCount: includedAudience.length,
              criteriaCount: enabledCriteria.length,
              metricsCount: (successMetrics || []).length,
              totalHours,
              timeline,
              createdVia: 'cadg_training_program_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log training program activity:', err);
      }
    }

    res.json({
      success: true,
      documentId: docResult.id,
      documentUrl: docResult.webViewLink,
      sheetsId: sheetsResult?.id,
      sheetsUrl: sheetsResult?.webViewLink,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Training program save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save training program',
    });
  }
});

/**
 * POST /api/cadg/renewal-forecast/save
 * Save finalized renewal forecast after user review
 */
router.post('/renewal-forecast/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      renewalDate,
      currentProbability,
      targetProbability,
      arr,
      contractTerm,
      probabilityFactors,
      riskFactors,
      positiveSignals,
      recommendedActions,
      historicalContext,
      notes,
      customerId,
    } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    // Import sheets service
    const { sheetsService } = await import('../services/google/sheets.js');

    // Filter to only enabled risk factors and positive signals
    const enabledRisks = (riskFactors || []).filter((r: any) => r.enabled);
    const enabledSignals = (positiveSignals || []).filter((s: any) => s.enabled);

    // Calculate weighted probability from factors
    const weightedProb = (probabilityFactors || []).reduce((acc: number, f: any) =>
      acc + (f.score * f.weight / 100), 0);
    const riskImpact = enabledRisks.reduce((acc: number, r: any) => acc + r.impact, 0);
    const signalImpact = enabledSignals.reduce((acc: number, s: any) => acc + s.impact, 0);
    const finalProbability = Math.max(0, Math.min(100, Math.round(weightedProb + riskImpact + signalImpact)));

    // Build factors content
    const factorsContent = (probabilityFactors || []).map((f: any) =>
      `| ${f.name} | ${f.weight}% | ${f.score} | ${f.description || '-'} |`
    ).join('\n');

    // Build risks content
    const risksContent = enabledRisks.map((r: any) =>
      `| ${r.name} | ${r.severity} | ${r.impact}% | ${r.description || '-'} |`
    ).join('\n');

    // Build signals content
    const signalsContent = enabledSignals.map((s: any) =>
      `| ${s.name} | ${s.strength} | +${s.impact}% | ${s.description || '-'} |`
    ).join('\n');

    // Build actions content
    const actionsContent = (recommendedActions || []).map((a: any) =>
      `| ${a.action} | ${a.priority} | ${a.owner} | ${a.dueDate} | ${a.status} |`
    ).join('\n');

    // Create Google Sheets forecast model
    let sheetsResult = null;
    try {
      sheetsResult = await sheetsService.createSpreadsheet(userId, {
        title: `${title} - Forecast Model`,
      });

      if (sheetsResult) {
        // Probability Factors sheet
        await sheetsService.updateValues(userId, sheetsResult.id, {
          range: 'Sheet1!A1:E1',
          values: [['Factor', 'Weight (%)', 'Score', 'Contribution', 'Description']],
        });

        const factorRows = (probabilityFactors || []).map((f: any) => [
          f.name,
          f.weight,
          f.score,
          Math.round(f.score * f.weight / 100),
          f.description || '',
        ]);

        if (factorRows.length > 0) {
          await sheetsService.updateValues(userId, sheetsResult.id, {
            range: 'Sheet1!A2',
            values: factorRows,
          });
        }

        // Summary row
        const summaryRowNum = factorRows.length + 3;
        await sheetsService.updateValues(userId, sheetsResult.id, {
          range: `Sheet1!A${summaryRowNum}:E${summaryRowNum + 5}`,
          values: [
            ['SUMMARY', '', '', '', ''],
            ['Base Probability', '', '', weightedProb.toFixed(1), ''],
            ['Risk Impact', '', '', riskImpact, `${enabledRisks.length} factors`],
            ['Signal Impact', '', '', `+${signalImpact}`, `${enabledSignals.length} factors`],
            ['Final Probability', '', '', finalProbability, ''],
            ['Target Probability', '', '', targetProbability, ''],
          ],
        });
      }
    } catch (err) {
      console.warn('[CADG] Could not create forecast sheet:', err);
    }

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity for customer timeline
    if (customerId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const { config } = await import('../config/index.js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'renewal_forecast_created',
            description: `Renewal forecast created: ${title} - ${finalProbability}% probability`,
            metadata: {
              sheetsId: sheetsResult?.id,
              sheetsUrl: sheetsResult?.webViewLink,
              renewalDate,
              finalProbability,
              targetProbability,
              arr,
              contractTerm,
              riskFactorsCount: enabledRisks.length,
              positiveSignalsCount: enabledSignals.length,
              actionsCount: (recommendedActions || []).length,
              createdVia: 'cadg_renewal_forecast_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log renewal forecast activity:', err);
      }
    }

    res.json({
      success: true,
      sheetsId: sheetsResult?.id,
      sheetsUrl: sheetsResult?.webViewLink,
      finalProbability,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Renewal forecast save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save renewal forecast',
    });
  }
});

/**
 * POST /api/cadg/value-summary/save
 * Save finalized value summary after user review
 */
router.post('/value-summary/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      executiveSummary,
      valueMetrics,
      successStories,
      testimonials,
      roiCalculation,
      keyHighlights,
      nextSteps,
      notes,
      customerId,
    } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    // Import services
    const { qbrSlidesService } = await import('../services/google/qbrSlides.js');

    // Filter to only included items
    const includedMetrics = (valueMetrics || []).filter((m: any) => m.included);
    const includedStories = (successStories || []).filter((s: any) => s.included);
    const includedTestimonials = (testimonials || []).filter((t: any) => t.included);

    // Build value metrics content for slides
    const metricsContent = includedMetrics.map((m: any) =>
      `• ${m.name}: ${m.value}${m.unit === '%' || m.unit === 'count' ? m.unit : ' ' + m.unit} - ${m.description}`
    ).join('\n');

    // Build success stories content
    const storiesContent = includedStories.map((s: any) =>
      `**${s.title}** (${s.date})\n${s.description}\nImpact: ${s.impact}`
    ).join('\n\n');

    // Build testimonials content
    const testimonialsContent = includedTestimonials.map((t: any) =>
      `"${t.quote}"\n— ${t.author}, ${t.title}`
    ).join('\n\n');

    // Build ROI summary
    const roi = roiCalculation || {};
    const roiContent = `
Investment: $${(roi.investmentCost || 0).toLocaleString()}
Annual Benefit: $${(roi.annualBenefit || 0).toLocaleString()}
ROI: ${roi.roiPercentage || 0}%
Payback Period: ${roi.paybackMonths || 0} months
3-Year Value: $${(roi.threeYearValue || 0).toLocaleString()}
    `.trim();

    // Create Google Slides presentation for value summary
    let slidesResult = null;
    try {
      // Build slide content for presentation
      const slideContent = {
        title: title,
        sections: [
          {
            title: 'Executive Summary',
            content: executiveSummary || 'Value delivered through our partnership.',
          },
          {
            title: 'Key Value Metrics',
            content: metricsContent || 'No metrics included.',
          },
          {
            title: 'Success Stories',
            content: storiesContent || 'No stories included.',
          },
          {
            title: 'Customer Testimonials',
            content: testimonialsContent || 'No testimonials included.',
          },
          {
            title: 'ROI Analysis',
            content: roiContent,
          },
          {
            title: 'Key Highlights',
            content: (keyHighlights || []).map((h: string) => `• ${h}`).join('\n'),
          },
          {
            title: 'Next Steps',
            content: (nextSteps || []).map((s: string) => `• ${s}`).join('\n'),
          },
        ],
      };

      // Use QBR slides service to create presentation (it handles generic slides too)
      slidesResult = await qbrSlidesService.createValueSummaryPresentation(userId, {
        title: title,
        executiveSummary: executiveSummary || '',
        valueMetrics: includedMetrics,
        successStories: includedStories,
        testimonials: includedTestimonials,
        roiCalculation: roi,
        keyHighlights: keyHighlights || [],
        nextSteps: nextSteps || [],
      });
    } catch (err) {
      console.warn('[CADG] Could not create value summary slides:', err);
      // Try to create a simple document instead
      try {
        const { docsService } = await import('../services/google/docs.js');

        // Build document content
        const docContent = `# ${title}

## Executive Summary
${executiveSummary || 'N/A'}

## Key Value Metrics
${metricsContent || 'No metrics included.'}

## Success Stories
${storiesContent || 'No stories included.'}

## Customer Testimonials
${testimonialsContent || 'No testimonials included.'}

## ROI Analysis
${roiContent}

## Key Highlights
${(keyHighlights || []).map((h: string) => `• ${h}`).join('\n')}

## Next Steps
${(nextSteps || []).map((s: string) => `• ${s}`).join('\n')}

${notes ? `\n## Notes\n${notes}` : ''}
`;

        const docsResult = await docsService.createDocument(userId, {
          title: title,
          content: docContent,
        });

        if (docsResult) {
          slidesResult = {
            id: docsResult.id,
            webViewLink: docsResult.webViewLink,
            isDocument: true,
          };
        }
      } catch (docErr) {
        console.warn('[CADG] Could not create value summary document:', docErr);
      }
    }

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity for customer timeline
    if (customerId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const { config } = await import('../config/index.js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'value_summary_created',
            description: `Value summary created: ${title} - ${roi.roiPercentage || 0}% ROI`,
            metadata: {
              slidesId: slidesResult?.id,
              slidesUrl: slidesResult?.webViewLink,
              isDocument: slidesResult?.isDocument || false,
              roiPercentage: roi.roiPercentage || 0,
              metricsCount: includedMetrics.length,
              storiesCount: includedStories.length,
              testimonialsCount: includedTestimonials.length,
              createdVia: 'cadg_value_summary_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log value summary activity:', err);
      }
    }

    res.json({
      success: true,
      fileId: slidesResult?.id,
      fileUrl: slidesResult?.webViewLink,
      isDocument: slidesResult?.isDocument || false,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Value summary save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save value summary',
    });
  }
});

/**
 * POST /api/cadg/expansion-proposal/save
 * Save finalized expansion proposal after user review
 */
router.post('/expansion-proposal/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      proposalDate,
      validUntil,
      currentArrValue,
      proposedArrValue,
      expansionAmount,
      expansionProducts,
      pricingOptions,
      businessCase,
      roiProjection,
      usageGaps,
      growthSignals,
      nextSteps,
      notes,
      customerId,
    } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    // Import services
    const { docsService } = await import('../services/google/docs.js');

    // Filter to only included items
    const includedProducts = (expansionProducts || []).filter((p: any) => p.included);
    const includedBusinessCase = (businessCase || []).filter((b: any) => b.included);

    // Calculate totals from included products
    const calculatedExpansion = includedProducts.reduce((sum: number, p: any) => sum + (p.annualPrice || 0), 0);
    const recommendedOption = (pricingOptions || []).find((o: any) => o.recommended) || pricingOptions?.[0];

    // Build document content
    const productsContent = includedProducts.map((p: any) =>
      `### ${p.name}\n**Category:** ${p.category?.replace('_', ' ')}\n**Current:** ${p.currentPlan} → **Proposed:** ${p.proposedPlan}\n**Annual Price:** $${(p.annualPrice || 0).toLocaleString()}\n${p.description}`
    ).join('\n\n');

    const pricingContent = (pricingOptions || []).map((o: any) =>
      `### ${o.name}${o.recommended ? ' ✓ Recommended' : ''}\n${o.description}\n**Annual:** $${(o.annualTotal || 0).toLocaleString()} | **Monthly:** $${(o.monthlyTotal || 0).toLocaleString()}\n**Discount:** ${o.discount} | **Term:** ${o.term}`
    ).join('\n\n');

    const businessCaseContent = includedBusinessCase.map((b: any) =>
      `### ${b.title}\n**Category:** ${b.category?.replace('_', ' ')}\n${b.description}\n**Impact:** ${b.impact}`
    ).join('\n\n');

    const roi = roiProjection || {};
    const roiContent = `**Investment Increase:** $${(roi.investmentIncrease || 0).toLocaleString()}
**Projected Annual Benefit:** $${(roi.projectedBenefit || 0).toLocaleString()}
**ROI:** ${roi.roiPercentage || 0}%
**Payback Period:** ${roi.paybackMonths || 0} months

**Assumptions:**
${(roi.assumptions || []).map((a: string) => `• ${a}`).join('\n')}`;

    // Build full document content
    const documentContent = `# ${title}

**Proposal Date:** ${proposalDate || new Date().toISOString().slice(0, 10)}
**Valid Until:** ${validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}

---

## Summary

| Metric | Value |
|--------|-------|
| Current ARR | $${(currentArrValue || 0).toLocaleString()} |
| Proposed ARR | $${(proposedArrValue || currentArrValue + calculatedExpansion).toLocaleString()} |
| Expansion Amount | $${(calculatedExpansion).toLocaleString()} |

---

## Expansion Products

${productsContent || 'No products selected'}

---

## Pricing Options

${pricingContent || 'No pricing options'}

---

## Business Case

${businessCaseContent || 'No business case items'}

---

## ROI Projection

${roiContent}

---

## Growth Signals

${(growthSignals || []).map((s: string) => `• ${s}`).join('\n') || 'No signals identified'}

---

## Usage Gaps (Expansion Opportunities)

${(usageGaps || []).map((g: string) => `• ${g}`).join('\n') || 'No gaps identified'}

---

## Next Steps

${(nextSteps || []).map((s: string, i: number) => `${i + 1}. ${s}`).join('\n') || 'No next steps'}

${notes ? `\n---\n\n## Notes\n\n${notes}` : ''}

---

*Generated by CSCX.AI*`;

    // Create Google Doc
    let docsResult: { id?: string; webViewLink?: string } | null = null;
    try {
      docsResult = await docsService.createDocument(userId, {
        title: title,
        content: documentContent,
      });
    } catch (docsErr) {
      console.warn('[CADG] Could not create expansion proposal document:', docsErr);
    }

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity for customer timeline
    if (customerId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const { config } = await import('../config/index.js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'expansion_proposal_created',
            description: `Expansion proposal created: ${title} - $${calculatedExpansion.toLocaleString()} expansion`,
            metadata: {
              docId: docsResult?.id,
              docUrl: docsResult?.webViewLink,
              currentArrValue,
              proposedArrValue: currentArrValue + calculatedExpansion,
              expansionAmount: calculatedExpansion,
              productsCount: includedProducts.length,
              roiPercentage: roi.roiPercentage || 0,
              recommendedOption: recommendedOption?.name,
              createdVia: 'cadg_expansion_proposal_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log expansion proposal activity:', err);
      }
    }

    res.json({
      success: true,
      docId: docsResult?.id,
      docUrl: docsResult?.webViewLink,
      expansionAmount: calculatedExpansion,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Expansion proposal save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save expansion proposal',
    });
  }
});

/**
 * POST /api/cadg/negotiation-brief/save
 * Save finalized negotiation brief after user review
 */
router.post('/negotiation-brief/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      negotiationDate,
      contractValue,
      contractTerm,
      renewalDate,
      currentTerms,
      leveragePoints,
      counterStrategies,
      walkAwayPoints,
      competitorIntel,
      valueDelivered,
      internalNotes,
      customerId,
    } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    // Import services
    const { docsService } = await import('../services/google/docs.js');

    // Filter to only enabled leverage points
    const enabledLeveragePoints = (leveragePoints || []).filter((l: any) => l.enabled);

    // Priority labels
    const priorityLabels: Record<string, string> = {
      must_have: '🔴 Must Have',
      important: '🟡 Important',
      nice_to_have: '🟢 Nice to Have',
    };

    const strengthLabels: Record<string, string> = {
      strong: '💪 Strong',
      moderate: '➡️ Moderate',
      weak: '⚠️ Weak',
    };

    const severityLabels: Record<string, string> = {
      critical: '🚫 Critical',
      important: '⚠️ Important',
      minor: 'ℹ️ Minor',
    };

    const categoryLabels: Record<string, string> = {
      value_delivered: 'Value Delivered',
      relationship: 'Relationship',
      market_position: 'Market Position',
      strategic_fit: 'Strategic Fit',
      timing: 'Timing',
      price: 'Price',
      scope: 'Scope',
      timeline: 'Timeline',
      terms: 'Terms',
      competition: 'Competition',
    };

    // Build document content
    const termsContent = (currentTerms || []).map((t: any) =>
      `### ${t.term}\n**Current:** ${t.currentValue}\n**Target:** ${t.targetValue}\n**Priority:** ${priorityLabels[t.priority] || t.priority}${t.notes ? `\n*Notes: ${t.notes}*` : ''}`
    ).join('\n\n');

    const leverageContent = enabledLeveragePoints.map((l: any) =>
      `### ${l.title}\n**Strength:** ${strengthLabels[l.strength] || l.strength} | **Category:** ${categoryLabels[l.category] || l.category}\n${l.description}`
    ).join('\n\n');

    const counterContent = (counterStrategies || []).map((c: any) =>
      `### ${c.objection}\n**Category:** ${categoryLabels[c.category] || c.category}\n**Response:** ${c.response}\n**Evidence:** ${c.evidence}`
    ).join('\n\n');

    const walkAwayContent = (walkAwayPoints || []).map((w: any) =>
      `### ${w.condition}\n**Severity:** ${severityLabels[w.severity] || w.severity}\n**Threshold:** ${w.threshold}\n**Rationale:** ${w.rationale}`
    ).join('\n\n');

    // Build full document content
    const documentContent = `# ${title}

**Negotiation Date:** ${negotiationDate || new Date().toISOString().slice(0, 10)}
**Contract Value:** $${(contractValue || 0).toLocaleString()}
**Contract Term:** ${contractTerm || '12 months'}
**Renewal Date:** ${renewalDate || 'TBD'}

---

## Contract Terms

${termsContent || 'No terms specified'}

---

## Leverage Points

${leverageContent || 'No leverage points enabled'}

---

## Counter-Strategies

${counterContent || 'No counter-strategies defined'}

---

## Walk-Away Points

${walkAwayContent || 'No walk-away points defined'}

---

## Competitor Intelligence

${(competitorIntel || []).map((c: string) => `• ${c}`).join('\n') || 'No competitor intel'}

---

## Value Delivered

${(valueDelivered || []).map((v: string) => `• ${v}`).join('\n') || 'No value points'}

${internalNotes ? `\n---\n\n## Internal Notes\n\n${internalNotes}` : ''}

---

*Generated by CSCX.AI - CONFIDENTIAL*`;

    // Create Google Doc
    let docsResult: { id?: string; webViewLink?: string } | null = null;
    try {
      docsResult = await docsService.createDocument(userId, {
        title: title,
        content: documentContent,
      });
    } catch (docsErr) {
      console.warn('[CADG] Could not create negotiation brief document:', docsErr);
    }

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity for customer timeline
    if (customerId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const { config } = await import('../config/index.js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'negotiation_brief_created',
            description: `Negotiation brief created: ${title} - $${(contractValue || 0).toLocaleString()} contract`,
            metadata: {
              docId: docsResult?.id,
              docUrl: docsResult?.webViewLink,
              contractValue,
              contractTerm,
              renewalDate,
              termsCount: (currentTerms || []).length,
              leveragePointsCount: enabledLeveragePoints.length,
              counterStrategiesCount: (counterStrategies || []).length,
              walkAwayPointsCount: (walkAwayPoints || []).length,
              createdVia: 'cadg_negotiation_brief_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log negotiation brief activity:', err);
      }
    }

    res.json({
      success: true,
      docId: docsResult?.id,
      docUrl: docsResult?.webViewLink,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Negotiation brief save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save negotiation brief',
    });
  }
});

/**
 * POST /api/cadg/risk-assessment/save
 * Save finalized risk assessment after user review
 */
router.post('/risk-assessment/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      assessmentDate,
      overallRiskScore,
      riskLevel,
      healthScore,
      daysUntilRenewal,
      arr,
      riskFactors,
      mitigationActions,
      executiveSummary,
      notes,
      customerId,
    } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    // Import services
    const { docsService } = await import('../services/google/docs.js');
    const { sheetsService } = await import('../services/google/sheets.js');

    // Filter to only enabled risk factors
    const enabledRiskFactors = (riskFactors || []).filter((r: any) => r.enabled);

    // Severity labels and icons
    const severityLabels: Record<string, string> = {
      critical: '🔴 Critical',
      high: '🟠 High',
      medium: '🟡 Medium',
      low: '🟢 Low',
    };

    const categoryLabels: Record<string, string> = {
      health: 'Health',
      engagement: 'Engagement',
      support: 'Support',
      nps: 'NPS',
      usage: 'Usage',
      relationship: 'Relationship',
      financial: 'Financial',
      competitive: 'Competitive',
    };

    const priorityLabels: Record<string, string> = {
      high: '🔴 High',
      medium: '🟡 Medium',
      low: '🟢 Low',
    };

    const statusLabels: Record<string, string> = {
      pending: '⏳ Pending',
      in_progress: '🔄 In Progress',
      completed: '✅ Completed',
      blocked: '🚫 Blocked',
    };

    // Build risk factors content
    const riskFactorsContent = enabledRiskFactors.map((r: any) =>
      `### ${r.name}\n**Severity:** ${severityLabels[r.severity] || r.severity} | **Category:** ${categoryLabels[r.category] || r.category} | **Weight:** ${r.weight}%\n${r.description}\n**Evidence:** ${r.evidence}`
    ).join('\n\n');

    // Build mitigation actions content
    const actionsContent = (mitigationActions || []).map((a: any) =>
      `### ${a.action}\n**Priority:** ${priorityLabels[a.priority] || a.priority} | **Owner:** ${a.owner} | **Due:** ${a.dueDate} | **Status:** ${statusLabels[a.status] || a.status}\n${a.description}`
    ).join('\n\n');

    // Build full document content
    const documentContent = `# ${title}

**Assessment Date:** ${assessmentDate || new Date().toISOString().slice(0, 10)}
**Overall Risk Score:** ${overallRiskScore}/100
**Risk Level:** ${severityLabels[riskLevel] || riskLevel}
**Health Score:** ${healthScore}/100
**Days Until Renewal:** ${daysUntilRenewal}
**ARR:** $${(arr || 0).toLocaleString()}

---

## Executive Summary

${executiveSummary || 'No executive summary provided.'}

---

## Risk Factors (${enabledRiskFactors.length} identified)

${riskFactorsContent || 'No risk factors identified.'}

---

## Mitigation Actions (${(mitigationActions || []).length} planned)

${actionsContent || 'No mitigation actions defined.'}

${notes ? `\n---\n\n## Notes\n\n${notes}` : ''}

---

*Generated by CSCX.AI - Risk Assessment*`;

    // Create Google Doc
    let docsResult: { id?: string; webViewLink?: string } | null = null;
    try {
      docsResult = await docsService.createDocument(userId, {
        title: title,
        content: documentContent,
      });
    } catch (docsErr) {
      console.warn('[CADG] Could not create risk assessment document:', docsErr);
    }

    // Create Google Sheets tracker for mitigation actions
    let sheetsResult: { spreadsheetId?: string; spreadsheetUrl?: string } | null = null;
    try {
      // Build sheet data
      const sheetHeaders = ['Action', 'Description', 'Priority', 'Owner', 'Due Date', 'Status', 'Related Risks'];
      const sheetRows = (mitigationActions || []).map((a: any) => [
        a.action,
        a.description,
        a.priority,
        a.owner,
        a.dueDate,
        a.status,
        (a.relatedRiskIds || []).map((riskId: string) => {
          const risk = enabledRiskFactors.find((r: any) => r.id === riskId);
          return risk?.name || riskId;
        }).join(', '),
      ]);

      // Add risk factors sheet
      const riskHeaders = ['Risk Factor', 'Category', 'Severity', 'Weight', 'Evidence'];
      const riskRows = enabledRiskFactors.map((r: any) => [
        r.name,
        categoryLabels[r.category] || r.category,
        r.severity,
        `${r.weight}%`,
        r.evidence,
      ]);

      // Create spreadsheet with sheet names and headers
      const createdSheet = await sheetsService.createSpreadsheet(userId, {
        title: `${title} - Tracker`,
        sheets: ['Mitigation Actions', 'Risk Factors'],
        headers: [sheetHeaders, riskHeaders],
      });

      // Add data to sheets if creation succeeded
      if (createdSheet?.id) {
        try {
          // Add action rows to first sheet
          if (sheetRows.length > 0) {
            await sheetsService.updateValues(userId, createdSheet.id, {
              range: `'Mitigation Actions'!A2`,
              values: sheetRows,
            });
          }
          // Add risk factor rows to second sheet
          if (riskRows.length > 0) {
            await sheetsService.updateValues(userId, createdSheet.id, {
              range: `'Risk Factors'!A2`,
              values: riskRows,
            });
          }
        } catch (updateErr) {
          console.warn('[CADG] Could not populate risk assessment sheets:', updateErr);
        }
      }

      sheetsResult = {
        spreadsheetId: createdSheet?.id,
        spreadsheetUrl: createdSheet?.webViewLink,
      };
    } catch (sheetsErr) {
      console.warn('[CADG] Could not create risk assessment tracker:', sheetsErr);
    }

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity for customer timeline
    if (customerId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const { config } = await import('../config/index.js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'risk_assessment_created',
            description: `Risk assessment created: ${title} - Risk Score: ${overallRiskScore}/100 (${riskLevel})`,
            metadata: {
              docId: docsResult?.id,
              docUrl: docsResult?.webViewLink,
              sheetsId: sheetsResult?.spreadsheetId,
              sheetsUrl: sheetsResult?.spreadsheetUrl,
              overallRiskScore,
              riskLevel,
              healthScore,
              daysUntilRenewal,
              arr,
              riskFactorsCount: enabledRiskFactors.length,
              actionsCount: (mitigationActions || []).length,
              createdVia: 'cadg_risk_assessment_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log risk assessment activity:', err);
      }
    }

    res.json({
      success: true,
      docId: docsResult?.id,
      docUrl: docsResult?.webViewLink,
      sheetsId: sheetsResult?.spreadsheetId,
      sheetsUrl: sheetsResult?.spreadsheetUrl,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Risk assessment save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save risk assessment',
    });
  }
});

/**
 * POST /api/cadg/save-play/save
 * Save finalized save play after user review
 */
router.post('/save-play/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      createdDate,
      riskLevel,
      situation,
      healthScore,
      daysUntilRenewal,
      arr,
      rootCauses,
      actionItems,
      successMetrics,
      timeline,
      notes,
      customerId,
    } = req.body;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    // Import services
    const { docsService } = await import('../services/google/docs.js');
    const { sheetsService } = await import('../services/google/sheets.js');

    // Filter to only enabled root causes
    const enabledRootCauses = (rootCauses || []).filter((c: any) => c.enabled);

    // Filter to only enabled success metrics
    const enabledMetrics = (successMetrics || []).filter((m: any) => m.enabled);

    // Severity labels and icons
    const severityLabels: Record<string, string> = {
      critical: '🔴 Critical',
      high: '🟠 High',
      medium: '🟡 Medium',
      low: '🟢 Low',
    };

    const categoryLabels: Record<string, string> = {
      product: 'Product',
      service: 'Service',
      relationship: 'Relationship',
      value: 'Value',
      competitive: 'Competitive',
      budget: 'Budget',
      timing: 'Timing',
      other: 'Other',
    };

    const priorityLabels: Record<string, string> = {
      high: '🔴 High',
      medium: '🟡 Medium',
      low: '🟢 Low',
    };

    const statusLabels: Record<string, string> = {
      pending: '⏳ Pending',
      in_progress: '🔄 In Progress',
      completed: '✅ Completed',
      blocked: '🚫 Blocked',
    };

    // Build root causes content
    const rootCausesContent = enabledRootCauses.map((c: any) =>
      `### ${c.cause}\n**Severity:** ${severityLabels[c.severity] || c.severity} | **Category:** ${categoryLabels[c.category] || c.category}\n${c.description}\n**Evidence:** ${c.evidence}`
    ).join('\n\n');

    // Build action items content
    const actionsContent = (actionItems || []).map((a: any) =>
      `### ${a.action}\n**Priority:** ${priorityLabels[a.priority] || a.priority} | **Owner:** ${a.owner} | **Due:** ${a.dueDate} | **Status:** ${statusLabels[a.status] || a.status}\n${a.description}`
    ).join('\n\n');

    // Build success metrics content
    const metricsContent = enabledMetrics.map((m: any) =>
      `- **${m.metric}**: ${m.currentValue} → ${m.targetValue} (by ${m.dueDate})`
    ).join('\n');

    // Build full document content
    const documentContent = `# ${title}

**Created Date:** ${createdDate || new Date().toISOString().slice(0, 10)}
**Risk Level:** ${severityLabels[riskLevel] || riskLevel}
**Health Score:** ${healthScore}/100
**Days Until Renewal:** ${daysUntilRenewal}
**ARR:** $${(arr || 0).toLocaleString()}
**Timeline:** ${timeline}

---

## Situation Summary

${situation || 'No situation summary provided.'}

---

## Root Causes (${enabledRootCauses.length} identified)

${rootCausesContent || 'No root causes identified.'}

---

## Action Items (${(actionItems || []).length} planned)

${actionsContent || 'No action items defined.'}

---

## Success Metrics (${enabledMetrics.length} tracked)

${metricsContent || 'No success metrics defined.'}

${notes ? `\n---\n\n## Notes\n\n${notes}` : ''}

---

*Generated by CSCX.AI - Save Play*`;

    // Create Google Doc
    let docsResult: { id?: string; webViewLink?: string } | null = null;
    try {
      docsResult = await docsService.createDocument(userId, {
        title: title,
        content: documentContent,
      });
    } catch (docsErr) {
      console.warn('[CADG] Could not create save play document:', docsErr);
    }

    // Create Google Sheets tracker for action items
    let sheetsResult: { spreadsheetId?: string; spreadsheetUrl?: string } | null = null;
    try {
      // Build action items sheet data
      const actionHeaders = ['Action', 'Description', 'Priority', 'Owner', 'Due Date', 'Status', 'Related Causes'];
      const actionRows = (actionItems || []).map((a: any) => [
        a.action,
        a.description,
        a.priority,
        a.owner,
        a.dueDate,
        a.status,
        (a.relatedCauseIds || []).map((causeId: string) => {
          const cause = enabledRootCauses.find((c: any) => c.id === causeId);
          return cause?.cause || causeId;
        }).join(', '),
      ]);

      // Build root causes sheet data
      const causeHeaders = ['Root Cause', 'Category', 'Severity', 'Description', 'Evidence'];
      const causeRows = enabledRootCauses.map((c: any) => [
        c.cause,
        categoryLabels[c.category] || c.category,
        c.severity,
        c.description,
        c.evidence,
      ]);

      // Build success metrics sheet data
      const metricHeaders = ['Metric', 'Current Value', 'Target Value', 'Target Date'];
      const metricRows = enabledMetrics.map((m: any) => [
        m.metric,
        m.currentValue,
        m.targetValue,
        m.dueDate,
      ]);

      // Create spreadsheet with multiple sheets
      const createdSheet = await sheetsService.createSpreadsheet(userId, {
        title: `${title} - Tracker`,
        sheets: ['Action Items', 'Root Causes', 'Success Metrics'],
        headers: [actionHeaders, causeHeaders, metricHeaders],
      });

      // Add data to sheets if creation succeeded
      if (createdSheet?.id) {
        try {
          // Add action rows to first sheet
          if (actionRows.length > 0) {
            await sheetsService.updateValues(userId, createdSheet.id, {
              range: `'Action Items'!A2`,
              values: actionRows,
            });
          }
          // Add root cause rows to second sheet
          if (causeRows.length > 0) {
            await sheetsService.updateValues(userId, createdSheet.id, {
              range: `'Root Causes'!A2`,
              values: causeRows,
            });
          }
          // Add metrics rows to third sheet
          if (metricRows.length > 0) {
            await sheetsService.updateValues(userId, createdSheet.id, {
              range: `'Success Metrics'!A2`,
              values: metricRows,
            });
          }
        } catch (updateErr) {
          console.warn('[CADG] Could not populate save play sheets:', updateErr);
        }
      }

      sheetsResult = {
        spreadsheetId: createdSheet?.id,
        spreadsheetUrl: createdSheet?.webViewLink,
      };
    } catch (sheetsErr) {
      console.warn('[CADG] Could not create save play tracker:', sheetsErr);
    }

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity for customer timeline
    if (customerId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const { config } = await import('../config/index.js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'save_play_created',
            description: `Save play created: ${title} - Risk Level: ${riskLevel}, Timeline: ${timeline}`,
            metadata: {
              docId: docsResult?.id,
              docUrl: docsResult?.webViewLink,
              sheetsId: sheetsResult?.spreadsheetId,
              sheetsUrl: sheetsResult?.spreadsheetUrl,
              riskLevel,
              healthScore,
              daysUntilRenewal,
              arr,
              timeline,
              rootCausesCount: enabledRootCauses.length,
              actionsCount: (actionItems || []).length,
              metricsCount: enabledMetrics.length,
              createdVia: 'cadg_save_play_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log save play activity:', err);
      }
    }

    res.json({
      success: true,
      docId: docsResult?.id,
      docUrl: docsResult?.webViewLink,
      sheetsId: sheetsResult?.spreadsheetId,
      sheetsUrl: sheetsResult?.spreadsheetUrl,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Save play save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save save play',
    });
  }
});

/**
 * POST /api/cadg/escalation-report/save
 * Save finalized escalation report after user review
 */
router.post('/escalation-report/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      createdDate,
      escalationLevel,
      issueSummary,
      customerName,
      arr,
      healthScore,
      daysUntilRenewal,
      primaryContact,
      escalationOwner,
      timeline,
      impactMetrics,
      resolutionRequests,
      supportingEvidence,
      recommendedActions,
      notes,
      customerId,
    } = req.body;

    // Get userId from session or request
    const userId = (req as any).userId || req.body.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    // Filter enabled items
    const enabledTimeline = (timeline || []).filter((e: any) => e.enabled);
    const enabledImpacts = (impactMetrics || []).filter((m: any) => m.enabled);
    const enabledEvidence = (supportingEvidence || []).filter((e: any) => e.enabled);

    // Build document content
    const documentContent = `# ${title}

**Created:** ${createdDate}
**Escalation Level:** ${escalationLevel?.toUpperCase()}
**Customer:** ${customerName}
**Primary Contact:** ${primaryContact}
**Escalation Owner:** ${escalationOwner}

---

## Executive Summary

${issueSummary}

---

## Key Metrics

| Metric | Value |
|--------|-------|
| ARR | $${(arr || 0).toLocaleString()} |
| Health Score | ${healthScore}/100 |
| Days to Renewal | ${daysUntilRenewal} |
| Escalation Level | ${escalationLevel?.toUpperCase()} |

---

## Timeline of Events

${enabledTimeline.map((event: any, idx: number) => `### ${idx + 1}. ${event.event}
**Date:** ${event.date}
**Severity:** ${event.severity?.toUpperCase()}
**Actor:** ${event.actor}

${event.description}
`).join('\n')}

---

## Business Impact

${enabledImpacts.map((impact: any) => `### ${impact.metric}
**Value:** ${impact.value}
**Severity:** ${impact.severity?.toUpperCase()}

${impact.impact}
`).join('\n')}

---

## Resolution Requests

| # | Request | Priority | Owner | Due Date | Status |
|---|---------|----------|-------|----------|--------|
${(resolutionRequests || []).map((req: any, idx: number) => `| ${idx + 1} | ${req.request} | ${req.priority?.toUpperCase()} | ${req.owner} | ${req.dueDate} | ${req.status} |`).join('\n')}

---

## Supporting Evidence

${enabledEvidence.map((evidence: any) => `### ${evidence.title}
**Type:** ${evidence.type}
**Date:** ${evidence.date}
${evidence.url ? `**Link:** ${evidence.url}` : ''}

${evidence.description}
`).join('\n')}

---

## Recommended Actions

${recommendedActions}

---

${notes ? `## Internal Notes

${notes}

---

` : ''}
*Document generated via CSCX.AI Escalation Report*
`;

    // Create Google Doc
    let docsResult: { id?: string; webViewLink?: string } | null = null;
    try {
      docsResult = await docsService.createDocument(userId, {
        title: title,
        content: documentContent,
      });
    } catch (docsErr) {
      console.warn('[CADG] Could not create escalation report document:', docsErr);
    }

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity
    if (customerId) {
      try {
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'escalation_report_created',
            description: `Escalation report created: ${title} - Level: ${escalationLevel}, ${(resolutionRequests || []).length} resolution requests`,
            metadata: {
              docId: docsResult?.id,
              docUrl: docsResult?.webViewLink,
              escalationLevel,
              healthScore,
              arr,
              daysUntilRenewal,
              primaryContact,
              escalationOwner,
              timelineCount: enabledTimeline.length,
              impactCount: enabledImpacts.length,
              requestCount: (resolutionRequests || []).length,
              evidenceCount: enabledEvidence.length,
              createdVia: 'cadg_escalation_report_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log escalation report activity:', err);
      }
    }

    res.json({
      success: true,
      docId: docsResult?.id,
      docUrl: docsResult?.webViewLink,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Escalation report save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save escalation report',
    });
  }
});

/**
 * POST /api/cadg/executive-briefing/save
 * Save finalized executive briefing after user review and create Google Slides
 */
router.post('/executive-briefing/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      preparedFor,
      preparedBy,
      briefingDate,
      slideCount,
      executiveSummary,
      headlines,
      keyMetrics,
      strategicUpdates,
      asks,
      nextSteps,
      healthScore,
      daysUntilRenewal,
      arr,
      notes,
      customerId,
    } = req.body;

    // Get userId from session or request
    const userId = (req as any).userId || req.body.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    // Filter enabled items only
    const enabledHeadlines = (headlines || []).filter((h: any) => h.enabled);
    const enabledMetrics = (keyMetrics || []).filter((m: any) => m.enabled);
    const enabledUpdates = (strategicUpdates || []).filter((u: any) => u.enabled);
    const enabledAsks = (asks || []).filter((a: any) => a.enabled);

    // Status and sentiment labels for display
    const SENTIMENT_LABELS: Record<string, string> = {
      positive: '✅',
      neutral: '➖',
      negative: '⚠️',
    };

    const STATUS_LABELS: Record<string, string> = {
      completed: 'Completed',
      in_progress: 'In Progress',
      planned: 'Planned',
      at_risk: 'At Risk',
    };

    const TREND_LABELS: Record<string, string> = {
      up: '↑',
      down: '↓',
      stable: '→',
    };

    const PRIORITY_LABELS: Record<string, string> = {
      high: 'HIGH',
      medium: 'MEDIUM',
      low: 'LOW',
    };

    // Build document content for Google Slides (fallback to Doc if Slides fails)
    const documentContent = `# ${title}

**Prepared For:** ${preparedFor}
**Prepared By:** ${preparedBy}
**Date:** ${briefingDate}
**Slide Count Target:** ${slideCount}

---

## Executive Summary

${executiveSummary}

---

## Key Headlines

${enabledHeadlines.map((h: any) => `### ${SENTIMENT_LABELS[h.sentiment] || ''} ${h.headline}

${h.detail}
`).join('\n')}

---

## Key Metrics

| Metric | Value | Trend | Category |
|--------|-------|-------|----------|
${enabledMetrics.map((m: any) => `| ${m.name} | ${m.value} | ${TREND_LABELS[m.trend] || m.trend} | ${m.category} |`).join('\n')}

---

## Strategic Updates

${enabledUpdates.map((u: any) => `### ${u.title}
**Status:** ${STATUS_LABELS[u.status] || u.status} | **Category:** ${u.category}

${u.description}
`).join('\n')}

---

## Asks

| Ask | Priority | Owner | Due Date |
|-----|----------|-------|----------|
${enabledAsks.map((a: any) => `| ${a.ask} | ${PRIORITY_LABELS[a.priority] || a.priority} | ${a.owner} | ${a.dueDate} |`).join('\n')}

### Ask Details

${enabledAsks.map((a: any, idx: number) => `#### ${idx + 1}. ${a.ask}
**Priority:** ${PRIORITY_LABELS[a.priority] || a.priority}
**Owner:** ${a.owner}
**Due Date:** ${a.dueDate}

**Rationale:** ${a.rationale}
`).join('\n')}

---

## Next Steps

${(nextSteps || []).map((step: string, idx: number) => `${idx + 1}. ${step}`).join('\n')}

---

## Account Overview

| Metric | Value |
|--------|-------|
| ARR | $${(arr || 0).toLocaleString()} |
| Health Score | ${healthScore}/100 |
| Days to Renewal | ${daysUntilRenewal} |

---

${notes ? `## Internal Notes

${notes}

---

` : ''}
*Document generated via CSCX.AI Executive Briefing*
`;

    // Try to create Google Slides presentation first
    let slidesResult: { id?: string; webViewLink?: string } | null = null;
    try {
      const { qbrSlidesService } = await import('../services/google/qbrSlides.js');

      // Create executive briefing presentation
      slidesResult = await qbrSlidesService.createExecutiveBriefingPresentation(userId, {
        title,
        preparedFor,
        preparedBy,
        briefingDate,
        executiveSummary,
        headlines: enabledHeadlines,
        keyMetrics: enabledMetrics,
        strategicUpdates: enabledUpdates,
        asks: enabledAsks,
        nextSteps,
        healthScore,
        daysUntilRenewal,
        arr,
        slideCount,
      });
    } catch (slidesErr) {
      console.warn('[CADG] Could not create executive briefing slides:', slidesErr);
    }

    // Fallback to Google Doc if slides failed
    let docsResult: { id?: string; webViewLink?: string } | null = null;
    if (!slidesResult) {
      try {
        const { docsService } = await import('../services/google/docs.js');
        docsResult = await docsService.createDocument(userId, {
          title: title,
          content: documentContent,
        });
      } catch (docsErr) {
        console.warn('[CADG] Could not create executive briefing document:', docsErr);
      }
    }

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity
    if (customerId) {
      try {
        const { config } = await import('../config/index.js');
        const { createClient } = await import('@supabase/supabase-js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'executive_briefing_created',
            description: `Executive briefing created: ${title} - ${enabledHeadlines.length} headlines, ${enabledAsks.length} asks`,
            metadata: {
              slidesId: slidesResult?.id,
              slidesUrl: slidesResult?.webViewLink,
              docId: docsResult?.id,
              docUrl: docsResult?.webViewLink,
              slideCount,
              healthScore,
              arr,
              daysUntilRenewal,
              headlineCount: enabledHeadlines.length,
              metricCount: enabledMetrics.length,
              updateCount: enabledUpdates.length,
              askCount: enabledAsks.length,
              createdVia: 'cadg_executive_briefing_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log executive briefing activity:', err);
      }
    }

    res.json({
      success: true,
      slidesId: slidesResult?.id,
      slidesUrl: slidesResult?.webViewLink,
      docId: docsResult?.id,
      docUrl: docsResult?.webViewLink,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Executive briefing save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save executive briefing',
    });
  }
});

/**
 * POST /api/cadg/account-plan/save
 * Save finalized account plan after user review and create Google Doc + Sheets
 */
router.post('/account-plan/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      planPeriod,
      createdDate,
      accountOverview,
      objectives,
      actionItems,
      milestones,
      resources,
      successCriteria,
      risks,
      timeline,
      healthScore,
      daysUntilRenewal,
      arr,
      notes,
      customerId,
    } = req.body;

    // Get userId from session or request
    const userId = (req as any).userId || req.body.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    // Filter enabled items only
    const enabledObjectives = (objectives || []).filter((o: any) => o.enabled);
    const enabledActions = (actionItems || []).filter((a: any) => a.enabled);
    const enabledMilestones = (milestones || []).filter((m: any) => m.enabled);
    const enabledResources = (resources || []).filter((r: any) => r.enabled);

    // Status and priority labels for display
    const PRIORITY_LABELS: Record<string, string> = {
      high: 'HIGH',
      medium: 'MEDIUM',
      low: 'LOW',
    };

    const STATUS_LABELS: Record<string, string> = {
      planned: 'Planned',
      in_progress: 'In Progress',
      completed: 'Completed',
      blocked: 'Blocked',
      at_risk: 'At Risk',
    };

    const CATEGORY_LABELS: Record<string, string> = {
      growth: 'Growth',
      retention: 'Retention',
      expansion: 'Expansion',
      adoption: 'Adoption',
      risk_mitigation: 'Risk Mitigation',
      strategic: 'Strategic',
    };

    const RESOURCE_TYPE_LABELS: Record<string, string> = {
      budget: 'Budget',
      headcount: 'Headcount',
      tooling: 'Tooling',
      training: 'Training',
      support: 'Support',
      other: 'Other',
    };

    // Build document content for Google Doc
    const documentContent = `# ${title}

**Plan Period:** ${planPeriod}
**Created:** ${createdDate}

---

## Account Overview

${accountOverview}

---

## Key Metrics

| Metric | Value |
|--------|-------|
| ARR | $${(arr || 0).toLocaleString()} |
| Health Score | ${healthScore}/100 |
| Days to Renewal | ${daysUntilRenewal} |

---

## Strategic Objectives

${enabledObjectives.map((obj: any, idx: number) => `### ${idx + 1}. ${obj.title}

**Category:** ${CATEGORY_LABELS[obj.category] || obj.category}
**Priority:** ${PRIORITY_LABELS[obj.priority] || obj.priority}
**Target Date:** ${obj.targetDate}

${obj.description}

**Success Metrics:**
${(obj.metrics || []).map((m: string) => `- ${m}`).join('\n')}
`).join('\n')}

---

## Action Items

| Action | Owner | Priority | Due Date | Status |
|--------|-------|----------|----------|--------|
${enabledActions.map((a: any) => `| ${a.action} | ${a.owner} | ${PRIORITY_LABELS[a.priority] || a.priority} | ${a.dueDate} | ${STATUS_LABELS[a.status] || a.status} |`).join('\n')}

### Action Details

${enabledActions.map((a: any, idx: number) => `#### ${idx + 1}. ${a.action}

**Owner:** ${a.owner}
**Priority:** ${PRIORITY_LABELS[a.priority] || a.priority}
**Due Date:** ${a.dueDate}
**Status:** ${STATUS_LABELS[a.status] || a.status}

${a.description}

${a.relatedObjectiveIds?.length ? `**Related Objectives:** ${a.relatedObjectiveIds.map((id: string) => {
  const obj = enabledObjectives.find((o: any) => o.id === id);
  return obj?.title || id;
}).join(', ')}` : ''}
`).join('\n')}

---

## Milestones

| Milestone | Target Date | Status | Owner |
|-----------|-------------|--------|-------|
${enabledMilestones.map((m: any) => `| ${m.name} | ${m.targetDate} | ${STATUS_LABELS[m.status] || m.status} | ${m.owner} |`).join('\n')}

### Milestone Details

${enabledMilestones.map((m: any, idx: number) => `#### ${idx + 1}. ${m.name}

**Target Date:** ${m.targetDate}
**Status:** ${STATUS_LABELS[m.status] || m.status}
**Owner:** ${m.owner}

${m.description}
`).join('\n')}

---

## Resources

| Type | Description | Allocation |
|------|-------------|------------|
${enabledResources.map((r: any) => `| ${RESOURCE_TYPE_LABELS[r.type] || r.type} | ${r.description} | ${r.allocation} |`).join('\n')}

---

## Success Criteria

${(successCriteria || []).map((c: string, idx: number) => `${idx + 1}. ${c}`).join('\n')}

---

## Identified Risks

${(risks || []).map((r: string, idx: number) => `${idx + 1}. ${r}`).join('\n')}

---

## Timeline

${timeline}

---

${notes ? `## Internal Notes

${notes}

---

` : ''}
*Document generated via CSCX.AI Strategic Account Plan*
`;

    // Create Google Doc
    let docsResult: { id?: string; webViewLink?: string } | null = null;
    try {
      const { docsService } = await import('../services/google/docs.js');
      docsResult = await docsService.createDocument(userId, {
        title: title,
        content: documentContent,
      });
    } catch (docsErr) {
      console.warn('[CADG] Could not create account plan document:', docsErr);
    }

    // Create Google Sheets milestone tracker
    let sheetsResult: { id?: string; webViewLink?: string } | null = null;
    try {
      const { sheetsService } = await import('../services/google/sheets.js');
      sheetsResult = await sheetsService.createSpreadsheet(userId, {
        title: `${title} - Tracker`,
      });

      // Add objectives data
      if (sheetsResult?.id) {
        const objectivesData = [
          ['Objective', 'Category', 'Priority', 'Target Date', 'Status', 'Metrics'],
          ...enabledObjectives.map((obj: any) => [
            obj.title,
            CATEGORY_LABELS[obj.category] || obj.category,
            PRIORITY_LABELS[obj.priority] || obj.priority,
            obj.targetDate,
            'Active',
            (obj.metrics || []).join('; '),
          ]),
        ];

        await sheetsService.updateValues(userId, sheetsResult.id, {
          range: 'Sheet1!A1',
          values: objectivesData,
        });

        // Add action items data in a new range
        const actionsData = [
          ['', ''],
          ['Action Items', ''],
          ['Action', 'Owner', 'Priority', 'Due Date', 'Status', 'Description'],
          ...enabledActions.map((a: any) => [
            a.action,
            a.owner,
            PRIORITY_LABELS[a.priority] || a.priority,
            a.dueDate,
            STATUS_LABELS[a.status] || a.status,
            a.description,
          ]),
        ];

        const actionsStartRow = enabledObjectives.length + 3;
        await sheetsService.updateValues(userId, sheetsResult.id, {
          range: `Sheet1!A${actionsStartRow}`,
          values: actionsData,
        });

        // Add milestones data
        const milestonesData = [
          ['', ''],
          ['Milestones', ''],
          ['Milestone', 'Description', 'Target Date', 'Status', 'Owner'],
          ...enabledMilestones.map((m: any) => [
            m.name,
            m.description,
            m.targetDate,
            STATUS_LABELS[m.status] || m.status,
            m.owner,
          ]),
        ];

        const milestonesStartRow = actionsStartRow + enabledActions.length + 5;
        await sheetsService.updateValues(userId, sheetsResult.id, {
          range: `Sheet1!A${milestonesStartRow}`,
          values: milestonesData,
        });
      }
    } catch (sheetsErr) {
      console.warn('[CADG] Could not create account plan tracker:', sheetsErr);
    }

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity
    if (customerId) {
      try {
        const { config } = await import('../config/index.js');
        const { createClient } = await import('@supabase/supabase-js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'account_plan_created',
            description: `Strategic account plan created: ${title} - ${enabledObjectives.length} objectives, ${enabledActions.length} actions, ${enabledMilestones.length} milestones`,
            metadata: {
              docId: docsResult?.id,
              docUrl: docsResult?.webViewLink,
              sheetsId: sheetsResult?.id,
              sheetsUrl: sheetsResult?.webViewLink,
              planPeriod,
              healthScore,
              arr,
              daysUntilRenewal,
              objectiveCount: enabledObjectives.length,
              actionCount: enabledActions.length,
              milestoneCount: enabledMilestones.length,
              resourceCount: enabledResources.length,
              createdVia: 'cadg_account_plan_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log account plan activity:', err);
      }
    }

    res.json({
      success: true,
      docId: docsResult?.id,
      docUrl: docsResult?.webViewLink,
      sheetsId: sheetsResult?.id,
      sheetsUrl: sheetsResult?.webViewLink,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Account plan save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save account plan',
    });
  }
});

/**
 * POST /api/cadg/resolution-plan/save
 * Save finalized resolution plan after user review
 */
router.post('/resolution-plan/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      createdDate,
      targetResolutionDate,
      overallStatus,
      summary,
      healthScore,
      daysUntilRenewal,
      arr,
      issues,
      actionItems,
      dependencies,
      timeline,
      notes,
      customerId,
    } = req.body;

    // Get userId from session or request
    const userId = (req as any).userId || req.body.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    // Filter enabled items
    const enabledIssues = (issues || []).filter((i: any) => i.enabled);
    const enabledDependencies = (dependencies || []).filter((d: any) => d.enabled);

    // Status colors for display
    const STATUS_LABELS: Record<string, string> = {
      on_track: 'On Track',
      at_risk: 'At Risk',
      blocked: 'Blocked',
      resolved: 'Resolved',
    };

    const SEVERITY_LABELS: Record<string, string> = {
      critical: 'Critical',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    };

    const ISSUE_STATUS_LABELS: Record<string, string> = {
      open: 'Open',
      in_progress: 'In Progress',
      blocked: 'Blocked',
      resolved: 'Resolved',
    };

    const ACTION_STATUS_LABELS: Record<string, string> = {
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      blocked: 'Blocked',
    };

    // Build document content
    const documentContent = `# ${title}

**Created:** ${createdDate}
**Target Resolution:** ${targetResolutionDate}
**Overall Status:** ${STATUS_LABELS[overallStatus] || overallStatus}

---

## Executive Summary

${summary}

---

## Key Metrics

| Metric | Value |
|--------|-------|
| ARR | $${(arr || 0).toLocaleString()} |
| Health Score | ${healthScore}/100 |
| Days to Renewal | ${daysUntilRenewal} |
| Open Issues | ${enabledIssues.filter((i: any) => i.status !== 'resolved').length} |
| Pending Actions | ${(actionItems || []).filter((a: any) => a.status === 'pending').length} |

---

## Issues

${enabledIssues.map((issue: any, idx: number) => `### ${idx + 1}. ${issue.title}
**Category:** ${issue.category}
**Severity:** ${SEVERITY_LABELS[issue.severity] || issue.severity}
**Status:** ${ISSUE_STATUS_LABELS[issue.status] || issue.status}
**Reported:** ${issue.reportedDate}

${issue.description}
`).join('\n')}

---

## Action Items

| # | Action | Owner | Priority | Due Date | Status |
|---|--------|-------|----------|----------|--------|
${(actionItems || []).map((action: any, idx: number) => `| ${idx + 1} | ${action.action} | ${action.owner} | ${action.priority?.toUpperCase()} | ${action.dueDate} | ${ACTION_STATUS_LABELS[action.status] || action.status} |`).join('\n')}

### Action Details

${(actionItems || []).map((action: any, idx: number) => `#### ${idx + 1}. ${action.action}
**Owner:** ${action.owner}
**Priority:** ${action.priority?.toUpperCase()}
**Due Date:** ${action.dueDate}
**Status:** ${ACTION_STATUS_LABELS[action.status] || action.status}
**Related Issues:** ${action.relatedIssueIds?.map((id: string) => {
  const issue = enabledIssues.find((i: any) => i.id === id);
  return issue ? issue.title : id;
}).join(', ') || 'None'}

${action.description}
`).join('\n')}

---

## Dependencies

${enabledDependencies.map((dep: any, idx: number) => `### ${idx + 1}. ${dep.description}
**Type:** ${dep.type}
**Status:** ${dep.status}
**Blocked By:** ${dep.blockedBy}
`).join('\n')}

---

## Timeline

${timeline}

---

${notes ? `## Internal Notes

${notes}

---

` : ''}
*Document generated via CSCX.AI Resolution Plan*
`;

    // Create Google Doc
    let docsResult: { id?: string; webViewLink?: string } | null = null;
    try {
      const { docsService } = await import('../services/google/docs.js');
      docsResult = await docsService.createDocument(userId, {
        title: title,
        content: documentContent,
      });
    } catch (docsErr) {
      console.warn('[CADG] Could not create resolution plan document:', docsErr);
    }

    // Create Google Sheets tracker
    let sheetsResult: { id?: string; webViewLink?: string } | null = null;
    try {
      const { sheetsService } = await import('../services/google/sheets.js');

      const sheetResult = await sheetsService.createSpreadsheet(userId, {
        title: `${title} - Tracker`,
      });

      if (sheetResult && sheetResult.id) {
        // Add Issues sheet data
        const issuesHeader = ['ID', 'Title', 'Category', 'Severity', 'Status', 'Reported Date', 'Description'];
        const issuesData = enabledIssues.map((issue: any) => [
          issue.id,
          issue.title,
          issue.category,
          issue.severity,
          issue.status,
          issue.reportedDate,
          issue.description,
        ]);

        // Update sheets with data
        await sheetsService.updateValues(userId, sheetResult.id, {
          range: 'Sheet1!A1',
          values: [issuesHeader, ...issuesData],
        });

        sheetsResult = { id: sheetResult.id, webViewLink: sheetResult.webViewLink };
      }
    } catch (sheetsErr) {
      console.warn('[CADG] Could not create resolution plan tracker:', sheetsErr);
    }

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity
    if (customerId) {
      try {
        const { config } = await import('../config/index.js');
        const { createClient } = await import('@supabase/supabase-js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'resolution_plan_created',
            description: `Resolution plan created: ${title} - ${enabledIssues.length} issues, ${(actionItems || []).length} actions`,
            metadata: {
              docId: docsResult?.id,
              docUrl: docsResult?.webViewLink,
              sheetId: sheetsResult?.id,
              sheetUrl: sheetsResult?.webViewLink,
              overallStatus,
              healthScore,
              arr,
              daysUntilRenewal,
              issueCount: enabledIssues.length,
              actionCount: (actionItems || []).length,
              dependencyCount: enabledDependencies.length,
              targetResolutionDate,
              createdVia: 'cadg_resolution_plan_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log resolution plan activity:', err);
      }
    }

    res.json({
      success: true,
      docId: docsResult?.id,
      docUrl: docsResult?.webViewLink,
      sheetId: sheetsResult?.id,
      sheetUrl: sheetsResult?.webViewLink,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Resolution plan save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save resolution plan',
    });
  }
});

/**
 * POST /api/cadg/transformation-roadmap/save
 * Save finalized transformation roadmap after user review and create Google Slides
 */
router.post('/transformation-roadmap/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      visionStatement,
      createdDate,
      timelineStart,
      timelineEnd,
      totalDuration,
      currentState,
      targetState,
      phases,
      milestones,
      successCriteria,
      dependencies,
      risks,
      keyStakeholders,
      notes,
      healthScore,
      arr,
      customerId,
    } = req.body;

    // Get userId from session or request
    const userId = (req as any).userId || req.body.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    // Filter enabled items only
    const enabledPhases = (phases || []).filter((p: any) => p.enabled);
    const enabledMilestones = (milestones || []).filter((m: any) => m.enabled);
    const enabledCriteria = (successCriteria || []).filter((c: any) => c.enabled);
    const enabledDependencies = (dependencies || []).filter((d: any) => d.enabled);
    const enabledRisks = (risks || []).filter((r: any) => r.enabled);

    // Status and labels for display
    const STATUS_LABELS: Record<string, string> = {
      planned: 'Planned',
      in_progress: 'In Progress',
      completed: 'Completed',
      at_risk: 'At Risk',
    };

    const CATEGORY_LABELS: Record<string, string> = {
      adoption: 'Adoption',
      business: 'Business',
      technical: 'Technical',
      operational: 'Operational',
      strategic: 'Strategic',
    };

    const DEPENDENCY_TYPE_LABELS: Record<string, string> = {
      internal: 'Internal',
      external: 'External',
      customer: 'Customer',
      vendor: 'Vendor',
      technical: 'Technical',
    };

    const LIKELIHOOD_LABELS: Record<string, string> = {
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    };

    // Build document content for Google Doc
    const documentContent = `# ${title}

**Created:** ${createdDate}
**Timeline:** ${timelineStart} to ${timelineEnd} (${totalDuration})

---

## Vision Statement

${visionStatement}

---

## Current State

${currentState}

---

## Target State

${targetState}

---

## Transformation Phases

${enabledPhases.map((phase: any, idx: number) => `### Phase ${idx + 1}: ${phase.name}

**Duration:** ${phase.duration}
**Timeline:** ${phase.startDate} to ${phase.endDate}
**Owner:** ${phase.owner}
**Status:** ${STATUS_LABELS[phase.status] || phase.status}

${phase.description}

**Objectives:**
${(phase.objectives || []).map((obj: string) => `- ${obj}`).join('\n')}

**Deliverables:**
${(phase.deliverables || []).map((del: string) => `- ${del}`).join('\n')}
`).join('\n')}

---

## Key Milestones

| Milestone | Phase | Target Date | Status | Owner |
|-----------|-------|-------------|--------|-------|
${enabledMilestones.map((m: any) => {
  const phase = enabledPhases.find((p: any) => p.id === m.phaseId);
  return `| ${m.name} | ${phase?.name || 'N/A'} | ${m.targetDate} | ${STATUS_LABELS[m.status] || m.status} | ${m.owner} |`;
}).join('\n')}

### Milestone Details

${enabledMilestones.map((m: any, idx: number) => `#### ${idx + 1}. ${m.name}

**Target Date:** ${m.targetDate}
**Status:** ${STATUS_LABELS[m.status] || m.status}
**Owner:** ${m.owner}

${m.description}
`).join('\n')}

---

## Success Criteria

| Criterion | Category | Measurable | Target Value |
|-----------|----------|------------|--------------|
${enabledCriteria.map((c: any) => `| ${c.criterion} | ${CATEGORY_LABELS[c.category] || c.category} | ${c.measurable ? 'Yes' : 'No'} | ${c.targetValue} |`).join('\n')}

---

## Dependencies

| Dependency | Type | Owner | Status |
|------------|------|-------|--------|
${enabledDependencies.map((d: any) => `| ${d.description} | ${DEPENDENCY_TYPE_LABELS[d.type] || d.type} | ${d.owner} | ${d.status} |`).join('\n')}

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation Strategy |
|------|------------|--------|---------------------|
${enabledRisks.map((r: any) => `| ${r.risk} | ${LIKELIHOOD_LABELS[r.likelihood] || r.likelihood} | ${LIKELIHOOD_LABELS[r.impact] || r.impact} | ${r.mitigation} |`).join('\n')}

---

## Key Stakeholders

${(keyStakeholders || []).map((s: string, idx: number) => `${idx + 1}. ${s}`).join('\n')}

---

${notes ? `## Internal Notes

${notes}

---

` : ''}
*Document generated via CSCX.AI Transformation Roadmap*
`;

    // Create Google Doc first
    let docsResult: { id?: string; webViewLink?: string } | null = null;
    try {
      const { docsService } = await import('../services/google/docs.js');
      docsResult = await docsService.createDocument(userId, {
        title: title,
        content: documentContent,
      });
    } catch (docsErr) {
      console.warn('[CADG] Could not create transformation roadmap document:', docsErr);
    }

    // Try to create Google Slides presentation
    let slidesResult: { id?: string; webViewLink?: string } | null = null;
    try {
      const { qbrSlidesService } = await import('../services/google/qbrSlides.js');

      // Build slides content
      const slidesData = {
        title,
        visionStatement,
        currentState,
        targetState,
        phases: enabledPhases,
        milestones: enabledMilestones,
        successCriteria: enabledCriteria,
        risks: enabledRisks,
        keyStakeholders,
      };

      // Create presentation using the transformation roadmap method if available
      // Otherwise fall back to creating a basic presentation
      if ((qbrSlidesService as any).createTransformationRoadmapPresentation) {
        slidesResult = await (qbrSlidesService as any).createTransformationRoadmapPresentation(userId, slidesData);
      } else {
        // Create a basic presentation structure
        const { slidesService } = await import('../services/google/slides.js');
        if (slidesService?.createPresentation) {
          slidesResult = await slidesService.createPresentation(userId, {
            title: title,
          });
        }
      }
    } catch (slidesErr) {
      console.warn('[CADG] Could not create transformation roadmap slides:', slidesErr);
    }

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity
    if (customerId) {
      try {
        const { config } = await import('../config/index.js');
        const { createClient } = await import('@supabase/supabase-js');
        if (config.supabaseUrl && config.supabaseServiceKey) {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
          await supabase.from('agent_activities').insert({
            user_id: userId,
            customer_id: customerId,
            activity_type: 'transformation_roadmap_created',
            description: `Transformation roadmap created: ${title} - ${enabledPhases.length} phases, ${enabledMilestones.length} milestones`,
            metadata: {
              docId: docsResult?.id,
              docUrl: docsResult?.webViewLink,
              slidesId: slidesResult?.id,
              slidesUrl: slidesResult?.webViewLink,
              timelineStart,
              timelineEnd,
              totalDuration,
              healthScore,
              arr,
              phaseCount: enabledPhases.length,
              milestoneCount: enabledMilestones.length,
              criteriaCount: enabledCriteria.length,
              riskCount: enabledRisks.length,
              createdVia: 'cadg_transformation_roadmap_preview',
            },
          });
        }
      } catch (err) {
        console.warn('[CADG] Could not log transformation roadmap activity:', err);
      }
    }

    res.json({
      success: true,
      docId: docsResult?.id,
      docUrl: docsResult?.webViewLink,
      slidesId: slidesResult?.id,
      slidesUrl: slidesResult?.webViewLink,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Transformation roadmap save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save transformation roadmap',
    });
  }
});

/**
 * POST /api/cadg/portfolio-dashboard/save
 * Save finalized portfolio dashboard after user review and create Google Sheets
 */
router.post('/portfolio-dashboard/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      createdDate,
      lastUpdated,
      summary,
      customers,
      filters,
      columns,
      notes,
    } = req.body;

    // Get userId from session or request
    const userId = (req as any).userId || req.body.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
    }

    // Filter enabled customers only
    const enabledCustomers = (customers || []).filter((c: any) => c.enabled);
    // Filter enabled columns only
    const enabledColumns = (columns || []).filter((col: any) => col.enabled);

    // Status labels for display
    const RISK_LABELS: Record<string, string> = {
      healthy: 'Healthy',
      at_risk: 'At Risk',
      critical: 'Critical',
    };

    // Build document content for Google Doc
    const documentContent = `# ${title}

**Generated:** ${createdDate}
**Last Updated:** ${lastUpdated}

---

## Portfolio Summary

| Metric | Value |
|--------|-------|
| Total Customers | ${summary.totalCustomers} |
| Total ARR | $${(summary.totalArr || 0).toLocaleString()} |
| Average Health Score | ${summary.avgHealthScore} |
| Average NPS | ${summary.avgNps} |
| Healthy Customers | ${summary.healthyCount} |
| At-Risk Customers | ${summary.atRiskCount} |
| Critical Customers | ${summary.criticalCount} |
| Renewing This Quarter | ${summary.renewingThisQuarter} |
| Renewal ARR This Quarter | $${(summary.renewingThisQuarterArr || 0).toLocaleString()} |

---

## Filters Applied

- **Health Levels:** ${(filters.healthLevels || []).map((h: string) => RISK_LABELS[h] || h).join(', ')}
- **Segments:** ${(filters.segments || []).join(', ') || 'All'}
- **Tiers:** ${(filters.tiers || []).join(', ') || 'All'}
- **Owners:** ${(filters.owners || []).join(', ') || 'All'}
- **Date Range:** ${filters.dateRange?.type || 'All'}
- **Sort By:** ${filters.sortBy || 'health'} (${filters.sortDirection || 'asc'})

---

## Customer List

| Customer | ARR | Health | Status | Tier | Renewal | Days | Owner |
|----------|-----|--------|--------|------|---------|------|-------|
${enabledCustomers.map((c: any) => `| ${c.name} | $${(c.arr || 0).toLocaleString()} | ${c.healthScore} | ${RISK_LABELS[c.riskLevel] || c.riskLevel} | ${c.tier} | ${c.renewalDate} | ${c.daysUntilRenewal} | ${c.owner} |`).join('\n')}

---

## Customer Details

${enabledCustomers.map((c: any, idx: number) => `### ${idx + 1}. ${c.name}

- **ARR:** $${(c.arr || 0).toLocaleString()}
- **Health Score:** ${c.healthScore}/100
- **Status:** ${RISK_LABELS[c.riskLevel] || c.riskLevel}
- **Tier:** ${c.tier}
- **Segment:** ${c.segment}
- **Renewal Date:** ${c.renewalDate}
- **Days Until Renewal:** ${c.daysUntilRenewal}
- **Owner:** ${c.owner}
- **NPS Score:** ${c.npsScore !== null ? c.npsScore : 'N/A'}
- **Last Activity:** ${c.lastActivityDate}
`).join('\n')}

---

${notes ? `## Notes

${notes}

---

` : ''}
*Dashboard generated via CSCX.AI Portfolio Dashboard*
`;

    // Create Google Sheets with portfolio data
    let sheetsResult: { id?: string; webViewLink?: string } | null = null;
    try {
      const { sheetsService } = await import('../services/google/sheets.js');

      // Create spreadsheet
      sheetsResult = await sheetsService.createSpreadsheet(userId, {
        title: title,
      });

      if (sheetsResult?.id) {
        // Build header row based on enabled columns
        const columnHeaders = enabledColumns.map((col: any) => col.name);

        // Build data rows
        const dataRows = enabledCustomers.map((c: any) => {
          const row: any[] = [];
          enabledColumns.forEach((col: any) => {
            switch (col.id) {
              case 'name': row.push(c.name); break;
              case 'arr': row.push(c.arr); break;
              case 'healthScore': row.push(c.healthScore); break;
              case 'riskLevel': row.push(RISK_LABELS[c.riskLevel] || c.riskLevel); break;
              case 'tier': row.push(c.tier); break;
              case 'segment': row.push(c.segment); break;
              case 'renewalDate': row.push(c.renewalDate); break;
              case 'daysUntilRenewal': row.push(c.daysUntilRenewal); break;
              case 'owner': row.push(c.owner); break;
              case 'npsScore': row.push(c.npsScore !== null ? c.npsScore : 'N/A'); break;
              case 'lastActivityDate': row.push(c.lastActivityDate); break;
              default: row.push(''); break;
            }
          });
          return row;
        });

        // Update sheet with data
        await sheetsService.updateValues(userId, sheetsResult.id, {
          range: 'Sheet1!A1',
          values: [columnHeaders, ...dataRows],
        });
      }
    } catch (sheetsErr) {
      console.warn('[CADG] Could not create portfolio dashboard spreadsheet:', sheetsErr);
    }

    // Create Google Doc as well
    let docsResult: { id?: string; webViewLink?: string } | null = null;
    try {
      const { docsService } = await import('../services/google/docs.js');
      docsResult = await docsService.createDocument(userId, {
        title: `${title} - Summary`,
        content: documentContent,
      });
    } catch (docsErr) {
      console.warn('[CADG] Could not create portfolio dashboard document:', docsErr);
    }

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity (no customer ID for General Mode)
    try {
      const { config } = await import('../config/index.js');
      const { createClient } = await import('@supabase/supabase-js');
      if (config.supabaseUrl && config.supabaseServiceKey) {
        const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
        await supabase.from('agent_activities').insert({
          user_id: userId,
          customer_id: null, // General Mode - no specific customer
          activity_type: 'portfolio_dashboard_created',
          description: `Portfolio dashboard created: ${title} - ${enabledCustomers.length} customers, $${(summary.totalArr || 0).toLocaleString()} ARR`,
          metadata: {
            sheetsId: sheetsResult?.id,
            sheetsUrl: sheetsResult?.webViewLink,
            docId: docsResult?.id,
            docUrl: docsResult?.webViewLink,
            totalCustomers: summary.totalCustomers,
            totalArr: summary.totalArr,
            healthyCount: summary.healthyCount,
            atRiskCount: summary.atRiskCount,
            criticalCount: summary.criticalCount,
            avgHealthScore: summary.avgHealthScore,
            createdVia: 'cadg_portfolio_dashboard_preview',
          },
        });
      }
    } catch (err) {
      console.warn('[CADG] Could not log portfolio dashboard activity:', err);
    }

    res.json({
      success: true,
      sheetsId: sheetsResult?.id,
      sheetsUrl: sheetsResult?.webViewLink,
      docId: docsResult?.id,
      docUrl: docsResult?.webViewLink,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Portfolio dashboard save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save portfolio dashboard',
    });
  }
});

/**
 * POST /api/cadg/team-metrics/save
 * Save finalized team metrics report after user review and create Google Sheets + Slides
 */
router.post('/team-metrics/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      createdDate,
      lastUpdated,
      summary,
      csms,
      metrics,
      filters,
      columns,
      notes,
    } = req.body;

    // Get userId from auth context or request
    const userId = (req as any).userId || req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID required',
      });
    }

    // Filter enabled CSMs and columns
    const enabledCsms = (csms || []).filter((c: any) => c.enabled);
    const enabledColumns = (columns || []).filter((c: any) => c.enabled);
    const enabledMetrics = (metrics || []).filter((m: any) => m.enabled);

    // Format labels for team metrics
    const TREND_ICONS: Record<string, string> = {
      up: '↑',
      down: '↓',
      stable: '→',
    };

    // Build document content
    const documentContent = `# ${title || 'Team Metrics Dashboard'}

**Generated:** ${createdDate || new Date().toISOString().slice(0, 10)}
**Last Updated:** ${lastUpdated || new Date().toISOString().slice(0, 10)}

---

## Summary

| Metric | Value |
|--------|-------|
| Total CSMs | ${summary?.totalCsms || enabledCsms.length} |
| Total Customers | ${summary?.totalCustomers || 0} |
| Total ARR | $${(summary?.totalArr || 0).toLocaleString()} |
| Average Health Score | ${summary?.avgHealthScore || 0}/100 |
| Average NPS | ${summary?.avgNps || 0} |
| Renewal Rate | ${summary?.renewalRate || 0}% |
| Expansion Rate | ${summary?.expansionRate || 0}% |
| Churn Rate | ${summary?.churnRate || 0}% |

### Customer Health Distribution

- **Healthy:** ${summary?.healthyCount || 0} customers
- **At Risk:** ${summary?.atRiskCount || 0} customers
- **Critical:** ${summary?.criticalCount || 0} customers

---

## Key Metrics

${enabledMetrics.map((m: any) => `### ${m.name} ${TREND_ICONS[m.trend] || ''}

- **Value:** ${m.unit === '$' ? '$' + (m.value / 1000000).toFixed(1) + 'M' : m.value + m.unit}
${m.benchmark !== null ? `- **Benchmark:** ${m.unit === '$' ? '$' + (m.benchmark / 1000000).toFixed(1) + 'M' : m.benchmark + m.unit}` : ''}
- *${m.description}*
`).join('\n')}

---

## CSM Performance

${enabledCsms.map((c: any, idx: number) => `### ${idx + 1}. ${c.name}

- **Email:** ${c.email}
- **Customers:** ${c.customerCount}
- **ARR:** $${(c.totalArr || 0).toLocaleString()}
- **Average Health Score:** ${c.avgHealthScore}/100
- **Health Distribution:** ${c.healthyCount} Healthy / ${c.atRiskCount} At Risk / ${c.criticalCount} Critical
- **Renewal Rate:** ${c.renewalRate}%
- **Expansion Rate:** ${c.expansionRate}%
- **Churn Rate:** ${c.churnRate}%
- **NPS Score:** ${c.npsScore !== null ? c.npsScore : 'N/A'}
- **Activities This Week:** ${c.activitiesThisWeek}
- **Open Tickets:** ${c.openTickets}
- **Avg Response Time:** ${c.avgResponseTime} hours
`).join('\n')}

---

${notes ? `## Notes

${notes}

---

` : ''}
*Team metrics report generated via CSCX.AI Team Metrics Dashboard*
`;

    // Create Google Sheets with team data
    let sheetsResult: { id?: string; webViewLink?: string } | null = null;
    try {
      const { sheetsService } = await import('../services/google/sheets.js');

      // Create spreadsheet
      sheetsResult = await sheetsService.createSpreadsheet(userId, {
        title: title,
      });

      if (sheetsResult?.id) {
        // Build header row based on enabled columns
        const columnHeaders = enabledColumns.map((col: any) => col.name);

        // Build data rows
        const dataRows = enabledCsms.map((c: any) => {
          const row: any[] = [];
          enabledColumns.forEach((col: any) => {
            switch (col.id) {
              case 'name': row.push(c.name); break;
              case 'customerCount': row.push(c.customerCount); break;
              case 'totalArr': row.push(c.totalArr); break;
              case 'avgHealthScore': row.push(c.avgHealthScore); break;
              case 'healthDistribution': row.push(`${c.healthyCount}/${c.atRiskCount}/${c.criticalCount}`); break;
              case 'renewalRate': row.push(c.renewalRate + '%'); break;
              case 'expansionRate': row.push(c.expansionRate + '%'); break;
              case 'churnRate': row.push(c.churnRate + '%'); break;
              case 'npsScore': row.push(c.npsScore !== null ? c.npsScore : 'N/A'); break;
              case 'activitiesThisWeek': row.push(c.activitiesThisWeek); break;
              case 'openTickets': row.push(c.openTickets); break;
              case 'avgResponseTime': row.push(c.avgResponseTime + 'h'); break;
              default: row.push(''); break;
            }
          });
          return row;
        });

        // Update sheet with data
        await sheetsService.updateValues(userId, sheetsResult.id, {
          range: 'Sheet1!A1',
          values: [columnHeaders, ...dataRows],
        });
      }
    } catch (sheetsErr) {
      console.warn('[CADG] Could not create team metrics spreadsheet:', sheetsErr);
    }

    // Create Google Doc with report
    let docsResult: { id?: string; webViewLink?: string } | null = null;
    try {
      const { docsService } = await import('../services/google/docs.js');
      docsResult = await docsService.createDocument(userId, {
        title: `${title} - Report`,
        content: documentContent,
      });
    } catch (docsErr) {
      console.warn('[CADG] Could not create team metrics document:', docsErr);
    }

    // Try to create Google Slides presentation (optional)
    let slidesResult: { id?: string; webViewLink?: string } | null = null;
    try {
      const { slidesService } = await import('../services/google/slides.js');
      if (slidesService?.createPresentation) {
        slidesResult = await slidesService.createPresentation(userId, {
          title: `${title} - Presentation`,
        });
      }
    } catch (slidesErr) {
      console.warn('[CADG] Could not create team metrics slides:', slidesErr);
    }

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity (no customer ID for General Mode)
    try {
      const { config } = await import('../config/index.js');
      const { createClient } = await import('@supabase/supabase-js');
      if (config.supabaseUrl && config.supabaseServiceKey) {
        const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
        await supabase.from('agent_activities').insert({
          user_id: userId,
          customer_id: null, // General Mode - no specific customer
          activity_type: 'team_metrics_created',
          description: `Team metrics report created: ${title} - ${enabledCsms.length} CSMs, $${(summary?.totalArr || 0).toLocaleString()} ARR`,
          metadata: {
            sheetsId: sheetsResult?.id,
            sheetsUrl: sheetsResult?.webViewLink,
            docId: docsResult?.id,
            docUrl: docsResult?.webViewLink,
            slidesId: slidesResult?.id,
            slidesUrl: slidesResult?.webViewLink,
            totalCsms: summary?.totalCsms,
            totalCustomers: summary?.totalCustomers,
            totalArr: summary?.totalArr,
            avgHealthScore: summary?.avgHealthScore,
            avgNps: summary?.avgNps,
            renewalRate: summary?.renewalRate,
            expansionRate: summary?.expansionRate,
            churnRate: summary?.churnRate,
            createdVia: 'cadg_team_metrics_preview',
          },
        });
      }
    } catch (err) {
      console.warn('[CADG] Could not log team metrics activity:', err);
    }

    res.json({
      success: true,
      sheetsId: sheetsResult?.id,
      sheetsUrl: sheetsResult?.webViewLink,
      docId: docsResult?.id,
      docUrl: docsResult?.webViewLink,
      slidesId: slidesResult?.id,
      slidesUrl: slidesResult?.webViewLink,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Team metrics save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save team metrics',
    });
  }
});

/**
 * POST /api/cadg/renewal-pipeline/save
 * Save finalized renewal pipeline after user review and create Google Sheets
 */
router.post('/renewal-pipeline/save', async (req: Request, res: Response) => {
  try {
    const {
      planId,
      title,
      createdDate,
      lastUpdated,
      summary,
      renewals,
      filters,
      columns,
      notes,
    } = req.body;

    // Get userId from auth context or request
    const userId = (req as any).userId || req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID required',
      });
    }

    // Filter enabled renewals and columns
    const enabledRenewals = (renewals || []).filter((r: any) => r.enabled);
    const enabledColumns = (columns || []).filter((c: any) => c.enabled);

    // Risk level labels
    const RISK_LABELS: Record<string, string> = {
      low: 'Low Risk',
      medium: 'Medium Risk',
      high: 'High Risk',
      critical: 'Critical Risk',
    };

    // Date range labels
    const DATE_RANGE_LABELS: Record<string, string> = {
      all: 'All Time',
      this_month: 'This Month',
      this_quarter: 'This Quarter',
      next_quarter: 'Next Quarter',
      next_6_months: 'Next 6 Months',
      this_year: 'This Year',
      custom: 'Custom Range',
    };

    // Group by labels
    const GROUP_BY_LABELS: Record<string, string> = {
      none: 'No Grouping',
      month: 'By Month',
      quarter: 'By Quarter',
      owner: 'By Owner',
      risk_level: 'By Risk Level',
      tier: 'By Tier',
    };

    // Build document content
    const documentContent = `# ${title || 'Renewal Pipeline'}

**Generated:** ${createdDate || new Date().toISOString().slice(0, 10)}
**Last Updated:** ${lastUpdated || new Date().toISOString().slice(0, 10)}

---

## Pipeline Summary

| Metric | Value |
|--------|-------|
| Total Renewals | ${summary?.totalRenewals || enabledRenewals.length} |
| Total ARR | $${(summary?.totalArr || 0).toLocaleString()} |
| Average Probability | ${summary?.avgProbability || 0}% |
| Average Health Score | ${summary?.avgHealthScore || 0}/100 |
| Low Risk | ${summary?.lowRiskCount || 0} |
| Medium Risk | ${summary?.mediumRiskCount || 0} |
| High Risk | ${summary?.highRiskCount || 0} |
| Critical Risk | ${summary?.criticalRiskCount || 0} |
| Renewing This Month | ${summary?.renewingThisMonth || 0} ($${(summary?.renewingThisMonthArr || 0).toLocaleString()}) |
| Renewing This Quarter | ${summary?.renewingThisQuarter || 0} ($${(summary?.renewingThisQuarterArr || 0).toLocaleString()}) |

---

## Filters Applied

- **Risk Levels:** ${(filters?.riskLevels || []).map((r: string) => RISK_LABELS[r] || r).join(', ')}
- **Date Range:** ${DATE_RANGE_LABELS[filters?.dateRange?.type] || 'All'}
- **Owners:** ${(filters?.owners || []).join(', ') || 'All'}
- **Tiers:** ${(filters?.tiers || []).join(', ') || 'All'}
- **ARR Threshold:** ${filters?.arrThreshold?.min ? `Min: $${filters.arrThreshold.min.toLocaleString()}` : ''} ${filters?.arrThreshold?.max ? `Max: $${filters.arrThreshold.max.toLocaleString()}` : ''}
- **Group By:** ${GROUP_BY_LABELS[filters?.groupBy] || 'None'}
- **Sort By:** ${filters?.sortBy || 'renewal_date'} (${filters?.sortDirection || 'asc'})

---

## Renewal List

| Customer | ARR | Renewal Date | Days | Probability | Health | Risk | Owner |
|----------|-----|--------------|------|-------------|--------|------|-------|
${enabledRenewals.map((r: any) => `| ${r.customerName} | $${(r.arr || 0).toLocaleString()} | ${r.renewalDate} | ${r.daysUntilRenewal} | ${r.probability}% | ${r.healthScore}/100 | ${RISK_LABELS[r.riskLevel] || r.riskLevel} | ${r.owner} |`).join('\n')}

---

## Renewal Details

${enabledRenewals.map((r: any, idx: number) => `### ${idx + 1}. ${r.customerName}

- **ARR:** $${(r.arr || 0).toLocaleString()}
- **Renewal Date:** ${r.renewalDate}
- **Days Until Renewal:** ${r.daysUntilRenewal}
- **Probability:** ${r.probability}%
- **Health Score:** ${r.healthScore}/100
- **Risk Level:** ${RISK_LABELS[r.riskLevel] || r.riskLevel}
- **Owner:** ${r.owner}
- **Tier:** ${r.tier}
- **Segment:** ${r.segment}
- **NPS Score:** ${r.npsScore !== null ? r.npsScore : 'N/A'}
- **Last Contact:** ${r.lastContactDate}
`).join('\n')}

---

${notes ? `## Notes

${notes}

---

` : ''}
*Renewal pipeline generated via CSCX.AI Renewal Pipeline*
`;

    // Create Google Sheets with renewal data
    let sheetsResult: { id?: string; webViewLink?: string } | null = null;
    try {
      const { sheetsService } = await import('../services/google/sheets.js');

      // Create spreadsheet
      sheetsResult = await sheetsService.createSpreadsheet(userId, {
        title: title || 'Renewal Pipeline',
      });

      if (sheetsResult?.id) {
        // Build header row based on enabled columns
        const columnHeaders = enabledColumns.map((col: any) => col.name);

        // Build data rows
        const dataRows = enabledRenewals.map((r: any) => {
          const row: any[] = [];
          enabledColumns.forEach((col: any) => {
            switch (col.id) {
              case 'customerName': row.push(r.customerName); break;
              case 'arr': row.push(r.arr); break;
              case 'renewalDate': row.push(r.renewalDate); break;
              case 'daysUntilRenewal': row.push(r.daysUntilRenewal); break;
              case 'probability': row.push(r.probability + '%'); break;
              case 'healthScore': row.push(r.healthScore); break;
              case 'riskLevel': row.push(RISK_LABELS[r.riskLevel] || r.riskLevel); break;
              case 'owner': row.push(r.owner); break;
              case 'tier': row.push(r.tier); break;
              case 'segment': row.push(r.segment); break;
              case 'npsScore': row.push(r.npsScore !== null ? r.npsScore : 'N/A'); break;
              case 'lastContactDate': row.push(r.lastContactDate); break;
              default: row.push(''); break;
            }
          });
          return row;
        });

        // Update sheet with data
        await sheetsService.updateValues(userId, sheetsResult.id, {
          range: 'Sheet1!A1',
          values: [columnHeaders, ...dataRows],
        });
      }
    } catch (sheetsErr) {
      console.warn('[CADG] Could not create renewal pipeline spreadsheet:', sheetsErr);
    }

    // Create Google Doc with summary
    let docsResult: { id?: string; webViewLink?: string } | null = null;
    try {
      const { docsService } = await import('../services/google/docs.js');
      docsResult = await docsService.createDocument(userId, {
        title: `${title || 'Renewal Pipeline'} - Report`,
        content: documentContent,
      });
    } catch (docsErr) {
      console.warn('[CADG] Could not create renewal pipeline document:', docsErr);
    }

    // Update plan status if planId provided
    if (planId) {
      await planService.updatePlanStatus(planId, 'completed');
    }

    // Log activity (no customer ID for General Mode)
    try {
      const { config } = await import('../config/index.js');
      const { createClient } = await import('@supabase/supabase-js');
      if (config.supabaseUrl && config.supabaseServiceKey) {
        const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
        await supabase.from('agent_activities').insert({
          user_id: userId,
          customer_id: null, // General Mode - no specific customer
          activity_type: 'renewal_pipeline_created',
          description: `Renewal pipeline created: ${title} - ${enabledRenewals.length} renewals, $${(summary?.totalArr || 0).toLocaleString()} ARR`,
          metadata: {
            sheetsId: sheetsResult?.id,
            sheetsUrl: sheetsResult?.webViewLink,
            docId: docsResult?.id,
            docUrl: docsResult?.webViewLink,
            totalRenewals: summary?.totalRenewals,
            totalArr: summary?.totalArr,
            avgProbability: summary?.avgProbability,
            avgHealthScore: summary?.avgHealthScore,
            lowRiskCount: summary?.lowRiskCount,
            mediumRiskCount: summary?.mediumRiskCount,
            highRiskCount: summary?.highRiskCount,
            criticalRiskCount: summary?.criticalRiskCount,
            renewingThisMonth: summary?.renewingThisMonth,
            renewingThisQuarter: summary?.renewingThisQuarter,
            createdVia: 'cadg_renewal_pipeline_preview',
          },
        });
      }
    } catch (err) {
      console.warn('[CADG] Could not log renewal pipeline activity:', err);
    }

    res.json({
      success: true,
      sheetsId: sheetsResult?.id,
      sheetsUrl: sheetsResult?.webViewLink,
      docId: docsResult?.id,
      docUrl: docsResult?.webViewLink,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CADG] Renewal pipeline save error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save renewal pipeline',
    });
  }
});

export default router;
