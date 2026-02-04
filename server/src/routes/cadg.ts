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

export default router;
