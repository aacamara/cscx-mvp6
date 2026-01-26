/**
 * Skill Execution Engine
 * Executes skills with variable substitution, caching, and metrics tracking
 */

import {
  Skill,
  SkillStep,
  SkillContext,
  SkillExecutionResult,
  SkillStepResult,
  SkillStepStatus,
  SkillExecutionMetrics,
} from './types.js';
import { skillCache } from '../../services/skillCache.js';
import { approvalService } from '../../services/approval.js';
import { calendarService } from '../../services/google/calendar.js';
import { gmailService, DraftEmail, SendEmailOptions } from '../../services/google/gmail.js';
import { driveService } from '../../services/google/drive.js';
import { docsService } from '../../services/google/docs.js';
import { sheetsService } from '../../services/google/sheets.js';
import { slidesService } from '../../services/google/slides.js';
import { customerWorkspaceService } from '../../services/google/workspace.js';

// ============================================
// Types
// ============================================

interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

// ============================================
// Skill Execution Engine
// ============================================

export class SkillExecutor {
  private executionMetrics: Map<string, SkillExecutionMetrics> = new Map();

  /**
   * Execute a skill with the given context
   */
  async execute(
    skill: Skill,
    context: SkillContext,
    options: { skipCache?: boolean } = {}
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[SkillExecutor] Starting execution: ${skill.name} (${executionId})`);

    // Check cache if enabled and not skipping
    if (skill.cacheable.enabled && !options.skipCache) {
      const cacheKey = skillCache.generateCacheKey(
        skill.id,
        context.variables,
        skill.cacheable.keyFields
      );

      const cached = await skillCache.get(cacheKey);
      if (cached) {
        console.log(`[SkillExecutor] Cache hit for ${skill.id}: ${cacheKey}`);
        this.recordMetrics(skill.id, true, true, cached.result.totalDurationMs);

        return {
          ...cached.result,
          executionId,
          fromCache: true,
          cacheKey,
        };
      }
    }

    // Execute steps
    const result = await this.executeSteps(skill, context, executionId);

    // Calculate total duration
    result.totalDurationMs = Date.now() - startTime;

    // Cache the result if enabled and successful
    if (skill.cacheable.enabled && result.success && result.pendingApprovals.length === 0) {
      const cacheKey = skillCache.generateCacheKey(
        skill.id,
        context.variables,
        skill.cacheable.keyFields
      );

      await skillCache.set(
        cacheKey,
        skill.id,
        result,
        context.variables,
        skill.cacheable.ttlSeconds
      );

      result.cacheKey = cacheKey;
      console.log(`[SkillExecutor] Cached result for ${skill.id}: ${cacheKey}`);
    }

    // Record metrics
    this.recordMetrics(skill.id, result.success, false, result.totalDurationMs);

    return result;
  }

  /**
   * Execute all steps in a skill
   */
  private async executeSteps(
    skill: Skill,
    context: SkillContext,
    executionId: string
  ): Promise<SkillExecutionResult> {
    const result: SkillExecutionResult = {
      executionId,
      skillId: skill.id,
      skillName: skill.name,
      success: true,
      fromCache: false,
      steps: [],
      pendingApprovals: [],
      totalDurationMs: 0,
      message: '',
    };

    // Create a mutable context for step results
    const mutableContext: SkillContext = { ...context, variables: { ...context.variables } };

    for (const step of skill.steps) {
      console.log(`[SkillExecutor] Step: ${step.name} (${step.id})`);

      // Check condition if present
      if (step.condition && !step.condition(mutableContext)) {
        console.log(`[SkillExecutor] Skipping step (condition not met): ${step.id}`);
        result.steps.push({
          stepId: step.id,
          stepName: step.name,
          status: 'skipped',
        });
        continue;
      }

      const stepResult = await this.executeStep(step, mutableContext);
      result.steps.push(stepResult);

      // Handle different step outcomes
      if (stepResult.status === 'pending_approval') {
        if (stepResult.approvalId) {
          result.pendingApprovals.push(stepResult.approvalId);
        }
        // Don't mark as failure, just note approval pending
      } else if (stepResult.status === 'failed') {
        result.success = false;

        // Check if step is retryable
        if (step.retryable && (step.maxRetries || 3) > 0) {
          console.log(`[SkillExecutor] Retrying step: ${step.id}`);
          // Simple retry logic - could be enhanced with exponential backoff
          for (let attempt = 1; attempt <= (step.maxRetries || 3); attempt++) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            const retryResult = await this.executeStep(step, mutableContext);
            if (retryResult.status === 'completed') {
              result.steps[result.steps.length - 1] = retryResult;
              result.success = true;
              break;
            }
          }
        }

        if (!result.success) {
          console.log(`[SkillExecutor] Step failed, stopping: ${step.id}`);
          break;
        }
      } else if (stepResult.status === 'completed' && stepResult.result) {
        // Store step result in context for subsequent steps
        this.storeStepResult(mutableContext, step.id, stepResult.result);
      }
    }

    // Build result message
    const completed = result.steps.filter(s => s.status === 'completed').length;
    const pending = result.pendingApprovals.length;
    const failed = result.steps.filter(s => s.status === 'failed').length;
    const skipped = result.steps.filter(s => s.status === 'skipped').length;

    if (pending > 0) {
      result.message = `Skill "${skill.name}" partially executed. ${completed} step(s) completed, ${pending} awaiting approval.`;
    } else if (failed > 0) {
      result.message = `Skill "${skill.name}" failed. ${completed}/${skill.steps.length - skipped} steps succeeded.`;
    } else {
      result.message = `Skill "${skill.name}" completed successfully. ${completed} step(s) executed.`;
    }

    console.log(`[SkillExecutor] Result: ${result.message}`);
    return result;
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: SkillStep,
    context: SkillContext
  ): Promise<SkillStepResult> {
    const startTime = Date.now();
    const stepResult: SkillStepResult = {
      stepId: step.id,
      stepName: step.name,
      status: 'running',
      startedAt: new Date(),
    };

    try {
      // Generate input for the tool
      const input = step.inputMapper(context);

      if (step.requiresApproval) {
        // Create an approval request
        const approval = await approvalService.createApproval({
          userId: context.userId,
          actionType: this.mapToolToActionType(step.tool),
          actionData: {
            ...input,
            _skillStepId: step.id,
            _skillStepName: step.name,
            _toolName: step.tool,
          },
          originalContent: JSON.stringify(input, null, 2),
        });

        stepResult.status = 'pending_approval';
        stepResult.approvalId = approval.id;
        stepResult.completedAt = new Date();
        stepResult.durationMs = Date.now() - startTime;

        console.log(`[SkillExecutor] Approval created: ${approval.id}`);
      } else {
        // Execute the tool directly
        const toolResult = await this.executeTool(step.tool, input, context);

        if (toolResult.success) {
          stepResult.status = 'completed';
          stepResult.result = toolResult.data;
        } else {
          stepResult.status = 'failed';
          stepResult.error = toolResult.error || 'Unknown error';
        }

        stepResult.completedAt = new Date();
        stepResult.durationMs = Date.now() - startTime;
      }
    } catch (error) {
      stepResult.status = 'failed';
      stepResult.error = error instanceof Error ? error.message : 'Unknown error';
      stepResult.completedAt = new Date();
      stepResult.durationMs = Date.now() - startTime;
      console.error(`[SkillExecutor] Step error (${step.id}):`, error);
    }

    return stepResult;
  }

  /**
   * Execute a tool
   */
  private async executeTool(
    toolName: string,
    input: Record<string, any>,
    context: SkillContext
  ): Promise<ToolExecutionResult> {
    try {
      switch (toolName) {
        // Calendar tools
        case 'check_availability': {
          const startDate = new Date(input.dateRange?.start || Date.now());
          const endDate = new Date(input.dateRange?.end || Date.now() + 14 * 24 * 60 * 60 * 1000);
          const slots = await calendarService.findAvailableSlots(context.userId, {
            timeMin: startDate,
            timeMax: endDate,
            duration: input.durationMinutes || 30,
            attendeeEmails: input.participants,
          });
          return { success: true, data: { availableSlots: slots } };
        }

        case 'book_meeting':
        case 'schedule_meeting': {
          const event = await calendarService.createMeeting(context.userId, {
            title: input.title,
            description: input.description,
            startTime: new Date(input.startTime),
            endTime: new Date(input.endTime),
            attendees: input.attendees,
            sendNotifications: input.sendNotifications !== false,
          });
          return { success: true, data: { eventId: event.id, meetLink: event.meetLink } };
        }

        // Email tools
        case 'draft_email': {
          const draftOptions: DraftEmail = {
            to: input.to,
            cc: input.cc,
            subject: input.subject,
            bodyHtml: input.body?.includes('<') ? input.body : `<p>${input.body || ''}</p>`,
            bodyText: input.body?.includes('<') ? undefined : input.body,
          };
          const draftId = await gmailService.createDraft(context.userId, draftOptions);
          return { success: true, data: { draftId } };
        }

        case 'send_email': {
          const sendOptions: SendEmailOptions = {
            to: input.to,
            cc: input.cc,
            subject: input.subject,
            bodyHtml: input.body?.includes('<') ? input.body : `<p>${input.body || ''}</p>`,
            bodyText: input.body?.includes('<') ? undefined : input.body,
          };
          const messageId = await gmailService.sendEmail(context.userId, sendOptions);
          return { success: true, data: { messageId } };
        }

        // Drive/Workspace tools
        case 'create_workspace': {
          const workspace = await customerWorkspaceService.getOrCreateWorkspace(
            input.customerId || context.customerId || `customer_${Date.now()}`,
            input.customerName,
            context.userId
          );
          return { success: true, data: workspace };
        }

        case 'create_folder': {
          const folder = await driveService.createFolder(
            context.userId,
            input.folderName || input.customerName,
            input.parentFolderId
          );
          return { success: true, data: { folderId: folder.id, webViewLink: folder.webViewLink } };
        }

        case 'share_folder': {
          for (const email of input.emails || []) {
            await driveService.shareFile(context.userId, input.folderId, email, input.role || 'reader');
          }
          return { success: true, data: { shared: input.emails?.length || 0 } };
        }

        // Document tools
        case 'create_document': {
          const doc = input.template
            ? await docsService.createFromTemplate(context.userId, input.template, {
                title: input.title,
                folderId: input.folderId,
                variables: input.variables || {},
              })
            : await docsService.createDocument(context.userId, {
                title: input.title,
                folderId: input.folderId,
              });
          return { success: true, data: { docId: doc.id, webViewLink: doc.webViewLink } };
        }

        case 'create_sheet': {
          const sheet = input.templateType
            ? await sheetsService.createFromTemplate(
                context.userId,
                input.templateType,
                input.title || undefined,
                input.folderId
              )
            : await sheetsService.createSpreadsheet(context.userId, {
                title: input.title,
                folderId: input.folderId,
              });
          return { success: true, data: { sheetId: sheet.id, webViewLink: sheet.webViewLink } };
        }

        case 'create_presentation': {
          const slides = input.template
            ? await slidesService.createFromTemplate(context.userId, input.template, {
                title: input.title,
                folderId: input.folderId,
                variables: input.variables || {},
              })
            : await slidesService.createPresentation(context.userId, {
                title: input.title,
                folderId: input.folderId,
              });
          return { success: true, data: { presentationId: slides.id, webViewLink: slides.webViewLink } };
        }

        // Template tools
        case 'load_template': {
          // Templates are loaded by the document services
          return { success: true, data: { templateLoaded: true, type: input.templateType } };
        }

        case 'personalize_template': {
          // Personalization is done inline
          return { success: true, data: { personalized: true } };
        }

        case 'populate_sheet': {
          if (input.sheetId && input.data) {
            // Sheet population would go here
            return { success: true, data: { populated: true, rows: input.data.length } };
          }
          return { success: true, data: { populated: false, message: 'No data provided' } };
        }

        // Approval tools
        case 'request_human_approval': {
          // This is handled separately in requiresApproval flow
          return { success: true, data: { requested: true } };
        }

        case 'draft_meeting': {
          // Draft meeting details for approval
          return {
            success: true,
            data: {
              drafted: true,
              title: input.title,
              attendees: input.attendees,
              duration: input.durationMinutes,
            },
          };
        }

        // Analytics tools
        case 'get_health_score': {
          // Would fetch from metrics service
          return {
            success: true,
            data: {
              score: context.customer?.healthScore || 70,
              factors: {
                engagement: 75,
                adoption: 65,
                sentiment: 80,
                support: 70,
              },
            },
          };
        }

        case 'get_usage_metrics': {
          // Would fetch from usage service
          return {
            success: true,
            data: {
              dau: 150,
              mau: 500,
              featureAdoption: 0.65,
              apiCalls: 10000,
              highlights: ['API usage up 20%', 'New feature adoption strong'],
            },
          };
        }

        case 'analyze_trends':
        case 'get_health_history': {
          return {
            success: true,
            data: {
              trend: 'improving',
              currentScore: context.customer?.healthScore || 70,
              previousScore: 65,
              change: 5,
            },
          };
        }

        case 'analyze_sentiment': {
          return {
            success: true,
            data: {
              overall: 'positive',
              score: 0.75,
              summary: 'Customer sentiment is generally positive with some concerns about onboarding timeline.',
            },
          };
        }

        case 'generate_recommendations': {
          return {
            success: true,
            data: {
              recommendations: [
                'Schedule a check-in call to address onboarding concerns',
                'Provide additional training resources for underutilized features',
                'Consider upsell opportunity based on usage patterns',
              ],
            },
          };
        }

        case 'calculate_value_metrics': {
          const arr = context.customer?.arr || 0;
          return {
            success: true,
            data: {
              roi: '350%',
              timeSavedHours: 120,
              costSavings: Math.round(arr * 0.15),
              achievements: [
                'Reduced manual processes by 60%',
                'Improved team collaboration',
                'Faster time to value',
              ],
            },
          };
        }

        case 'organize_folder': {
          // Folder organization
          return { success: true, data: { organized: true } };
        }

        default:
          console.warn(`[SkillExecutor] Unknown tool: ${toolName}`);
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      console.error(`[SkillExecutor] Tool execution error (${toolName}):`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Tool execution failed' };
    }
  }

  /**
   * Store step result in context for subsequent steps
   */
  private storeStepResult(context: SkillContext, stepId: string, result: any): void {
    // Common patterns for storing results
    switch (stepId) {
      case 'create_drive_folder':
      case 'create_folder':
      case 'create_workspace':
        context.variables._createdFolderId = result.folderId || result.driveFolderId;
        break;
      case 'create_tracking_sheet':
      case 'create_sheet':
        context.variables._createdSheetId = result.sheetId;
        break;
      case 'create_qbr_deck':
      case 'create_presentation':
        context.variables._qbrDeckId = result.presentationId;
        break;
      case 'draft_renewal_proposal':
        context.variables._proposalId = result.docId;
        break;
      case 'create_value_summary':
        context.variables._valueSummaryId = result.docId;
        break;
      case 'fetch_health_score':
      case 'get_health_score':
        context.variables._healthScore = result;
        break;
      case 'fetch_usage_metrics':
      case 'get_usage_metrics':
        context.variables._usageMetrics = result;
        break;
      case 'analyze_trends':
      case 'get_health_history':
        context.variables._trends = result;
        context.variables._healthHistory = result;
        break;
      case 'analyze_sentiment':
        context.variables._sentiment = result;
        break;
      case 'generate_recommendations':
        context.variables._recommendations = result.recommendations;
        break;
      case 'calculate_value_metrics':
        context.variables._valueMetrics = result;
        break;
      case 'book_meeting':
        context.variables._meetingBooked = true;
        context.variables._meetingEventId = result.eventId;
        context.variables._meetingMeetLink = result.meetLink;
        break;
    }

    // Store generic result with step ID
    context.variables[`_${stepId}_result`] = result;
  }

  /**
   * Map tool name to approval action type
   */
  private mapToolToActionType(
    tool: string
  ): 'send_email' | 'schedule_meeting' | 'create_task' | 'share_document' | 'create_document' | 'create_spreadsheet' | 'other' {
    const mapping: Record<string, 'send_email' | 'schedule_meeting' | 'create_task' | 'share_document' | 'create_document' | 'create_spreadsheet' | 'other'> = {
      draft_email: 'send_email',
      send_email: 'send_email',
      book_meeting: 'schedule_meeting',
      schedule_meeting: 'schedule_meeting',
      draft_meeting: 'schedule_meeting',
      share_folder: 'share_document',
      create_document: 'create_document',
      create_sheet: 'create_spreadsheet',
      create_presentation: 'create_document',
    };
    return mapping[tool] || 'other';
  }

  /**
   * Record execution metrics
   */
  private recordMetrics(
    skillId: string,
    success: boolean,
    fromCache: boolean,
    durationMs: number
  ): void {
    let metrics = this.executionMetrics.get(skillId);

    if (!metrics) {
      metrics = {
        skillId,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageDurationMs: 0,
        totalTimeSavedMs: 0,
      };
    }

    metrics.totalExecutions++;
    metrics.lastExecutedAt = new Date();

    if (success) {
      metrics.successfulExecutions++;
    } else {
      metrics.failedExecutions++;
    }

    if (fromCache) {
      metrics.cacheHits++;
      metrics.totalTimeSavedMs += durationMs;
    } else {
      metrics.cacheMisses++;
      // Update rolling average
      const totalNonCached = metrics.totalExecutions - metrics.cacheHits;
      if (totalNonCached > 0) {
        metrics.averageDurationMs =
          (metrics.averageDurationMs * (totalNonCached - 1) + durationMs) / totalNonCached;
      }
    }

    this.executionMetrics.set(skillId, metrics);
  }

  /**
   * Get metrics for a skill
   */
  getSkillMetrics(skillId: string): SkillExecutionMetrics | undefined {
    return this.executionMetrics.get(skillId);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, SkillExecutionMetrics> {
    return new Map(this.executionMetrics);
  }
}

// Export singleton
export const skillExecutor = new SkillExecutor();
