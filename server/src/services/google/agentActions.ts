/**
 * Agent Google Actions Service
 * Unified interface for agents to perform Google Workspace actions with HITL approval
 */

import { gmailService, DraftEmail, SendEmailOptions } from './gmail.js';
import { calendarService, CreateEventOptions } from './calendar.js';
import { driveService } from './drive.js';
import { docsService, DocTemplate } from './docs.js';
import { sheetsService, SheetTemplate } from './sheets.js';
import { slidesService, SlideTemplate } from './slides.js';
import { scriptsService } from './scripts.js';
import { googleApprovalService, GoogleActionType, ApprovalResult, PendingApproval } from './approval.js';
import { customerWorkspaceService, CustomerWorkspace } from './workspace.js';
import { config } from '../../config/index.js';

// Agent types
export type CSAgentType = 'onboarding' | 'adoption' | 'renewal' | 'risk' | 'strategic';

// Action result types
export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  approval?: ApprovalResult;
  pendingApprovalId?: string;
}

export interface AgentContext {
  userId: string;
  agentType: CSAgentType;
  customerId?: string;
  customerName?: string;
  sessionId?: string;
}

// ==================== Email Actions ====================

export async function sendEmail(
  ctx: AgentContext,
  email: SendEmailOptions
): Promise<ActionResult<{ messageId: string }>> {
  const approval = await googleApprovalService.checkApproval(
    ctx.userId,
    ctx.agentType,
    'send_email',
    { to: email.to, subject: email.subject, customerId: ctx.customerId },
    ctx.customerId
  );

  if (!approval.approved) {
    return {
      success: false,
      approval,
      pendingApprovalId: approval.approvalId,
    };
  }

  try {
    const messageId = await gmailService.sendEmail(ctx.userId, {
      ...email,
      saveToDb: true,
      customerId: ctx.customerId,
    });
    return { success: true, data: { messageId }, approval };
  } catch (error) {
    return { success: false, error: (error as Error).message, approval };
  }
}

export async function draftEmail(
  ctx: AgentContext,
  draft: DraftEmail
): Promise<ActionResult<{ draftId: string }>> {
  const approval = await googleApprovalService.checkApproval(
    ctx.userId,
    ctx.agentType,
    'draft_email',
    { to: draft.to, subject: draft.subject },
    ctx.customerId
  );

  if (!approval.approved) {
    return { success: false, approval, pendingApprovalId: approval.approvalId };
  }

  try {
    const draftId = await gmailService.createDraft(ctx.userId, draft);
    return { success: true, data: { draftId }, approval };
  } catch (error) {
    return { success: false, error: (error as Error).message, approval };
  }
}

// ==================== Calendar Actions ====================

export async function bookMeeting(
  ctx: AgentContext,
  event: CreateEventOptions
): Promise<ActionResult<{ eventId: string; eventLink?: string }>> {
  const approval = await googleApprovalService.checkApproval(
    ctx.userId,
    ctx.agentType,
    'book_meeting',
    { title: event.title, attendees: event.attendees, customerId: ctx.customerId },
    ctx.customerId
  );

  if (!approval.approved) {
    return { success: false, approval, pendingApprovalId: approval.approvalId };
  }

  try {
    const calendarEvent = await calendarService.createEvent(ctx.userId, event);
    return {
      success: true,
      data: { eventId: calendarEvent.id, eventLink: calendarEvent.meetLink },
      approval,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message, approval };
  }
}

export async function proposeMeeting(
  ctx: AgentContext,
  event: CreateEventOptions
): Promise<ActionResult<{ proposal: CreateEventOptions }>> {
  const approval = await googleApprovalService.checkApproval(
    ctx.userId,
    ctx.agentType,
    'propose_meeting',
    { title: event.title, attendees: event.attendees },
    ctx.customerId
  );

  if (!approval.approved) {
    return { success: false, approval, pendingApprovalId: approval.approvalId };
  }

  try {
    // Return the proposal for review before booking
    return { success: true, data: { proposal: event }, approval };
  } catch (error) {
    return { success: false, error: (error as Error).message, approval };
  }
}

// ==================== Document Actions ====================

export async function createDocument(
  ctx: AgentContext,
  options: {
    title: string;
    templateType?: DocTemplate['type'];
    variables?: Record<string, string>;
    folderId?: string;
  }
): Promise<ActionResult<{ documentId: string; url: string }>> {
  const approval = await googleApprovalService.checkApproval(
    ctx.userId,
    ctx.agentType,
    'create_document',
    { title: options.title, templateType: options.templateType },
    ctx.customerId
  );

  if (!approval.approved) {
    return { success: false, approval, pendingApprovalId: approval.approvalId };
  }

  try {
    // Use provided folderId, or default CSCX folder
    // (The services will use the default folder automatically if not provided)
    const folderId = options.folderId || config.google.defaultFolderId;

    let doc;
    if (options.templateType && options.variables) {
      doc = await docsService.createFromTemplate(
        ctx.userId,
        options.templateType,
        { ...options.variables, customerName: ctx.customerName || '' },
        folderId
      );
    } else {
      doc = await docsService.createDocument(ctx.userId, {
        title: options.title,
        folderId,
      });
    }

    return {
      success: true,
      data: { documentId: doc.id, url: doc.webViewLink || '' },
      approval,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message, approval };
  }
}

export async function createSpreadsheet(
  ctx: AgentContext,
  options: {
    title: string;
    templateType?: SheetTemplate['type'];
    folderId?: string;
  }
): Promise<ActionResult<{ spreadsheetId: string; url: string }>> {
  const approval = await googleApprovalService.checkApproval(
    ctx.userId,
    ctx.agentType,
    'create_document',
    { title: options.title, templateType: options.templateType, type: 'spreadsheet' },
    ctx.customerId
  );

  if (!approval.approved) {
    return { success: false, approval, pendingApprovalId: approval.approvalId };
  }

  try {
    // Use provided folderId, or default CSCX folder
    const folderId = options.folderId || config.google.defaultFolderId;

    let sheet;
    if (options.templateType) {
      sheet = await sheetsService.createFromTemplate(
        ctx.userId,
        options.templateType,
        options.title,
        folderId
      );
    } else {
      sheet = await sheetsService.createSpreadsheet(ctx.userId, {
        title: options.title,
        folderId,
      });
    }

    return {
      success: true,
      data: { spreadsheetId: sheet.id, url: sheet.webViewLink || '' },
      approval,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message, approval };
  }
}

export async function createPresentation(
  ctx: AgentContext,
  options: {
    title: string;
    templateType?: SlideTemplate['type'];
    variables?: Record<string, string>;
    folderId?: string;
  }
): Promise<ActionResult<{ presentationId: string; url: string }>> {
  const approval = await googleApprovalService.checkApproval(
    ctx.userId,
    ctx.agentType,
    'create_document',
    { title: options.title, templateType: options.templateType, type: 'presentation' },
    ctx.customerId
  );

  if (!approval.approved) {
    return { success: false, approval, pendingApprovalId: approval.approvalId };
  }

  try {
    // Use provided folderId, or default CSCX folder
    const folderId = options.folderId || config.google.defaultFolderId;

    let presentation;
    if (options.templateType && options.variables) {
      presentation = await slidesService.createFromTemplate(
        ctx.userId,
        options.templateType,
        { ...options.variables, customerName: ctx.customerName || '' },
        folderId
      );
    } else {
      presentation = await slidesService.createPresentation(ctx.userId, {
        title: options.title,
        folderId,
      });
    }

    return {
      success: true,
      data: { presentationId: presentation.id, url: presentation.webViewLink || '' },
      approval,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message, approval };
  }
}

// ==================== High-Level Agent Actions ====================

export async function generateQBR(
  ctx: AgentContext,
  options: {
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
    year: number;
    metrics: Record<string, string>;
  }
): Promise<ActionResult<{
  document: { id: string; url: string };
  presentation: { id: string; url: string };
}>> {
  const approval = await googleApprovalService.checkApproval(
    ctx.userId,
    ctx.agentType,
    'generate_qbr',
    { quarter: options.quarter, year: options.year, customerId: ctx.customerId },
    ctx.customerId
  );

  if (!approval.approved) {
    return { success: false, approval, pendingApprovalId: approval.approvalId };
  }

  try {
    if (!ctx.customerId || !ctx.customerName) {
      return { success: false, error: 'Customer context required for QBR generation', approval };
    }

    const result = await customerWorkspaceService.generateQBRPackage(
      ctx.customerId,
      ctx.userId,
      {
        quarter: options.quarter,
        year: String(options.year),
        ...options.metrics,
      }
    );

    if (!result) {
      return { success: false, error: 'Failed to generate QBR package', approval };
    }

    return { success: true, data: result, approval };
  } catch (error) {
    return { success: false, error: (error as Error).message, approval };
  }
}

export async function createHealthScoreTracker(
  ctx: AgentContext
): Promise<ActionResult<{ spreadsheetId: string; url: string }>> {
  const approval = await googleApprovalService.checkApproval(
    ctx.userId,
    ctx.agentType,
    'create_document',
    { type: 'health_score_tracker', customerId: ctx.customerId },
    ctx.customerId
  );

  if (!approval.approved) {
    return { success: false, approval, pendingApprovalId: approval.approvalId };
  }

  try {
    if (!ctx.customerId || !ctx.customerName) {
      return { success: false, error: 'Customer context required', approval };
    }

    const result = await customerWorkspaceService.createHealthScoreTracker(
      ctx.customerId,
      ctx.userId
    );

    if (!result) {
      return { success: false, error: 'Failed to create health score tracker', approval };
    }

    return {
      success: true,
      data: { spreadsheetId: result.id, url: result.url },
      approval,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message, approval };
  }
}

export async function createSavePlay(
  ctx: AgentContext,
  options: {
    riskAssessment: string;
    churnIndicators: string[];
    actionPlan: string[];
  }
): Promise<ActionResult<{ documentId: string; url: string }>> {
  const approval = await googleApprovalService.checkApproval(
    ctx.userId,
    ctx.agentType,
    'create_save_play',
    { customerId: ctx.customerId, riskLevel: 'high' },
    ctx.customerId
  );

  if (!approval.approved) {
    return { success: false, approval, pendingApprovalId: approval.approvalId };
  }

  try {
    if (!ctx.customerId || !ctx.customerName) {
      return { success: false, error: 'Customer context required', approval };
    }

    const workspace = await customerWorkspaceService.getOrCreateWorkspace(
      ctx.customerId,
      ctx.customerName,
      ctx.userId
    );

    const doc = await docsService.createFromTemplate(
      ctx.userId,
      'save_play',
      {
        customerName: ctx.customerName,
        riskAssessment: options.riskAssessment,
        churnIndicators: options.churnIndicators.map(i => `• ${i}`).join('\n'),
        actionPlan: options.actionPlan.map((a, i) => `${i + 1}. ${a}`).join('\n'),
      },
      workspace.folders.success
    );

    return {
      success: true,
      data: { documentId: doc.id, url: doc.webViewLink || '' },
      approval,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message, approval };
  }
}

export async function createRenewalProposal(
  ctx: AgentContext,
  options: {
    renewalDate: string;
    currentARR: number;
    proposedARR: number;
    valueDelivered: string[];
    expansionOpportunities?: string[];
  }
): Promise<ActionResult<{ documentId: string; url: string }>> {
  const approval = await googleApprovalService.checkApproval(
    ctx.userId,
    ctx.agentType,
    'send_renewal_proposal',
    { customerId: ctx.customerId, proposedARR: options.proposedARR },
    ctx.customerId
  );

  if (!approval.approved) {
    return { success: false, approval, pendingApprovalId: approval.approvalId };
  }

  try {
    if (!ctx.customerId || !ctx.customerName) {
      return { success: false, error: 'Customer context required', approval };
    }

    const workspace = await customerWorkspaceService.getOrCreateWorkspace(
      ctx.customerId,
      ctx.customerName,
      ctx.userId
    );

    const doc = await docsService.createFromTemplate(
      ctx.userId,
      'renewal_proposal',
      {
        customerName: ctx.customerName,
        renewalDate: options.renewalDate,
        terms: `Current ARR: $${options.currentARR.toLocaleString()}\nProposed ARR: $${options.proposedARR.toLocaleString()}`,
        valueDelivered: options.valueDelivered.map(v => `• ${v}`).join('\n'),
        expansion: options.expansionOpportunities?.map(e => `• ${e}`).join('\n') || 'None identified',
      },
      workspace.folders.renewals
    );

    return {
      success: true,
      data: { documentId: doc.id, url: doc.webViewLink || '' },
      approval,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message, approval };
  }
}

// ==================== Approval Management ====================

export async function executePendingAction(
  approvalId: string,
  decidedBy: string
): Promise<ActionResult> {
  const approval = await googleApprovalService.getApproval(approvalId);
  if (!approval) {
    return { success: false, error: 'Approval not found' };
  }

  if (approval.status !== 'approved') {
    return { success: false, error: 'Action not approved' };
  }

  // Re-execute the original action
  const ctx: AgentContext = {
    userId: approval.userId,
    agentType: approval.agentType as CSAgentType,
    customerId: approval.customerId,
  };

  // Route to appropriate handler based on action type
  switch (approval.actionType) {
    case 'send_email':
      return sendEmail(ctx, approval.actionData as unknown as SendEmailOptions);
    case 'book_meeting':
      return bookMeeting(ctx, approval.actionData as unknown as CreateEventOptions);
    // Add other action types as needed
    default:
      return { success: false, error: `Unknown action type: ${approval.actionType}` };
  }
}

export async function getPendingApprovals(userId: string): Promise<PendingApproval[]> {
  return googleApprovalService.getPendingApprovals(userId);
}

export async function approveAction(
  approvalId: string,
  decidedBy: string,
  note?: string
): Promise<ActionResult<{ executed: boolean }>> {
  const approval = await googleApprovalService.approve(approvalId, decidedBy, note);
  if (!approval) {
    return { success: false, error: 'Failed to approve action' };
  }

  // Optionally auto-execute after approval
  const result = await executePendingAction(approvalId, decidedBy);
  return {
    success: true,
    data: { executed: result.success },
  };
}

export async function rejectAction(
  approvalId: string,
  decidedBy: string,
  note?: string
): Promise<ActionResult> {
  const approval = await googleApprovalService.reject(approvalId, decidedBy, note);
  if (!approval) {
    return { success: false, error: 'Failed to reject action' };
  }
  return { success: true };
}

// ==================== Workspace Management ====================

export async function getOrCreateWorkspace(
  ctx: AgentContext
): Promise<ActionResult<CustomerWorkspace>> {
  if (!ctx.customerId || !ctx.customerName) {
    return { success: false, error: 'Customer context required' };
  }

  try {
    const workspace = await customerWorkspaceService.getOrCreateWorkspace(
      ctx.customerId,
      ctx.customerName,
      ctx.userId
    );
    return { success: true, data: workspace };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function enableWorkspaceAutomations(
  ctx: AgentContext,
  automationTypes: ('healthScoreCalculator' | 'renewalAlerts' | 'usageTracker' | 'weeklyDigest')[]
): Promise<ActionResult> {
  const approval = await googleApprovalService.checkApproval(
    ctx.userId,
    ctx.agentType,
    'deploy_script',
    { automationTypes, customerId: ctx.customerId },
    ctx.customerId
  );

  if (!approval.approved) {
    return { success: false, approval, pendingApprovalId: approval.approvalId };
  }

  try {
    if (!ctx.customerId || !ctx.customerName) {
      return { success: false, error: 'Customer context required', approval };
    }

    await customerWorkspaceService.enableAutomations(ctx.customerId, ctx.userId, automationTypes);
    return { success: true, approval };
  } catch (error) {
    return { success: false, error: (error as Error).message, approval };
  }
}
