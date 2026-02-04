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

export default router;
