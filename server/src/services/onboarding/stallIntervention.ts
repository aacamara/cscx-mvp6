/**
 * Onboarding Stall Intervention Service (PRD-098)
 *
 * Implements FR-3.1 through FR-3.5: automated intervention workflow
 * when onboarding stalls are detected.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { sendSlackAlert, SlackAlertParams } from '../notifications/slack.js';
import { sendNotification } from '../notifications/index.js';
import { draftEmail, EmailContext, EmailType } from '../ai/email-drafter.js';
import { pendingActionsService } from '../pendingActions.js';
import {
  StallResult,
  InterventionAction,
  InterventionResult,
  StallIssue,
} from './types.js';

// Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Slack Alert Builder
// ============================================

/**
 * Build a rich Slack alert for a stalled onboarding (PRD-098 Section 5.1)
 */
function buildStallSlackAlert(stall: StallResult): SlackAlertParams {
  // Build blockers list
  const blockersList = stall.issues
    .slice(0, 3)
    .map((issue, idx) => {
      const icon =
        issue.owner === 'customer'
          ? ':clock3:'
          : issue.type === 'tasks_overdue'
          ? ':red_circle:'
          : ':speech_balloon:';
      return `${idx + 1}. ${icon} ${issue.details} (${issue.daysStalled} days)`;
    })
    .join('\n');

  // Build suggested interventions
  const interventionsList = stall.suggestedInterventions
    .slice(0, 3)
    .map((intervention, idx) => `${idx + 1}. ${intervention}`)
    .join('\n');

  const message = `*Phase:* ${formatPhase(stall.phase)}
*Expected Duration:* ${stall.targetOnboardingDays} days
*Current Duration:* ${stall.daysInOnboarding} days (${stall.daysInOnboarding - stall.targetOnboardingDays > 0 ? `${stall.daysInOnboarding - stall.targetOnboardingDays} days overdue` : 'on track'})

*Blockers Identified:*
${blockersList}

*Customer Context:*
- ARR: $${stall.arr.toLocaleString()}
- Segment: ${stall.segment}
- Days in Onboarding: ${stall.daysInOnboarding} (target: ${stall.targetOnboardingDays})

*Suggested Interventions:*
${interventionsList}`;

  return {
    type: stall.requiresEscalation ? 'escalation' : 'action_required',
    title: `Onboarding Stalled: ${stall.customerName}`,
    message,
    customer: {
      id: stall.customerId,
      name: stall.customerName,
      arr: stall.arr,
    },
    priority: mapSeverityToPriority(stall.highestSeverity),
    actionUrl: `/customers/${stall.customerId}?tab=onboarding`,
    fields: {
      phase: formatPhase(stall.phase),
      daysStalled: Math.max(...stall.issues.map((i) => i.daysStalled)),
      issueCount: stall.issues.length,
      primaryBlocker: stall.primaryBlocker.substring(0, 50),
    },
  };
}

/**
 * Build escalation alert for manager (FR-3.4)
 */
function buildEscalationAlert(stall: StallResult): SlackAlertParams {
  const daysStalled = Math.max(...stall.issues.map((i) => i.daysStalled));

  return {
    type: 'escalation',
    title: `Chronic Onboarding Stall: ${stall.customerName}`,
    message: `This onboarding has been stalled for ${daysStalled} days and requires management attention.

*Primary Blocker:* ${stall.primaryBlocker}

*CSM:* ${stall.csmName || 'Unassigned'}
*ARR at Risk:* $${stall.arr.toLocaleString()}

Please review and assist with unblocking this customer.`,
    customer: {
      id: stall.customerId,
      name: stall.customerName,
      arr: stall.arr,
    },
    priority: 'urgent',
    actionUrl: `/customers/${stall.customerId}?tab=onboarding`,
    fields: {
      daysStalled,
      csmName: stall.csmName,
      segment: stall.segment,
    },
  };
}

// ============================================
// Helper Functions
// ============================================

function formatPhase(phase: string): string {
  return phase
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function mapSeverityToPriority(
  severity: string
): 'low' | 'medium' | 'high' | 'urgent' {
  switch (severity) {
    case 'critical':
      return 'urgent';
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    default:
      return 'low';
  }
}

// ============================================
// Intervention Actions
// ============================================

/**
 * FR-3.1: Alert CSM with stall details and suggestions
 */
async function alertCSM(
  stall: StallResult,
  slackWebhook?: string
): Promise<{ slack: boolean; inApp: boolean }> {
  const results = { slack: false, inApp: false };

  // In-app notification
  if (stall.csmId) {
    try {
      const notifResult = await sendNotification(stall.csmId, {
        type: 'health_alert',
        title: `Onboarding Stalled: ${stall.customerName}`,
        body: `${stall.customerName}'s onboarding has stalled. ${stall.issues.length} issue(s) detected: ${stall.primaryBlocker}`,
        priority: mapSeverityToPriority(stall.highestSeverity),
        customerId: stall.customerId,
        customerName: stall.customerName,
        actionUrl: `/customers/${stall.customerId}?tab=onboarding`,
        data: {
          phase: stall.phase,
          issues: stall.issues.length,
          daysStalled: Math.max(...stall.issues.map((i) => i.daysStalled)),
          suggestedActions: stall.suggestedInterventions,
        },
      });
      results.inApp = notifResult.inApp;
    } catch (error) {
      console.error('Failed to send in-app notification:', error);
    }
  }

  // Slack notification
  if (slackWebhook) {
    try {
      const alertParams = buildStallSlackAlert(stall);
      results.slack = await sendSlackAlert(slackWebhook, alertParams);
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }

  return results;
}

/**
 * FR-3.2: Create intervention task
 */
async function createInterventionTask(
  stall: StallResult
): Promise<string | undefined> {
  if (!stall.csmId) return undefined;

  try {
    const action = await pendingActionsService.createAction(
      stall.csmId,
      'create_task',
      `Unblock onboarding: ${stall.customerName}`,
      `Onboarding stalled - ${stall.primaryBlocker}. Suggested action: ${stall.suggestedInterventions[0]}`,
      {
        title: `Unblock onboarding: ${stall.customerName} - ${stall.issues[0]?.type || 'stalled'}`,
        description: `Customer onboarding has stalled.\n\nPrimary blocker: ${stall.primaryBlocker}\n\nSuggested interventions:\n${stall.suggestedInterventions.map((s) => `- ${s}`).join('\n')}`,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        priority: mapSeverityToPriority(stall.highestSeverity),
        category: 'onboarding',
      }
    );

    return action.id;
  } catch (error) {
    console.error('Failed to create intervention task:', error);
    return undefined;
  }
}

/**
 * FR-3.3: Draft re-engagement email
 */
async function draftReengagementEmail(
  stall: StallResult
): Promise<string | undefined> {
  if (!stall.csmId) return undefined;

  try {
    // Build email context from stall data
    const emailContext: EmailContext = {
      healthScore: 50, // Stalled onboarding = low health
      lastContact: `${Math.max(...stall.issues.map((i) => i.daysStalled))} days ago`,
      recentActivity: [],
      arr: stall.arr,
      stage: 'onboarding',
      riskSignals: stall.issues.map((i) => i.details),
    };

    // Draft the email using AI
    const drafted = await draftEmail({
      type: 'risk_outreach' as EmailType,
      customerName: stall.customerName,
      recipientName: 'Team', // Would need actual contact name
      context: emailContext,
      tone: stall.highestSeverity === 'critical' ? 'urgent' : 'professional',
      customInstructions: `This is a re-engagement email for a stalled onboarding. The customer hasn't been responsive. The main blocker is: ${stall.primaryBlocker}. Please be empathetic and offer specific help.`,
      senderName: stall.csmName || 'Your Customer Success Manager',
    });

    // Create draft action
    const action = await pendingActionsService.createAction(
      stall.csmId,
      'create_draft',
      `Re-engagement email for ${stall.customerName}`,
      drafted.subject,
      {
        to: [], // Would need actual email addresses
        subject: drafted.subject,
        bodyHtml: drafted.body.replace(/\n/g, '<br>'),
        bodyText: drafted.body,
      }
    );

    return action.id;
  } catch (error) {
    console.error('Failed to draft re-engagement email:', error);
    return undefined;
  }
}

/**
 * FR-3.4: Escalate to manager for chronic stalls
 */
async function escalateToManager(
  stall: StallResult,
  slackWebhook?: string
): Promise<boolean> {
  if (!stall.requiresEscalation) return false;

  // Would need manager ID lookup
  // For now, send escalation alert to same webhook
  if (slackWebhook) {
    try {
      const alertParams = buildEscalationAlert(stall);
      return await sendSlackAlert(slackWebhook, alertParams);
    } catch (error) {
      console.error('Failed to escalate to manager:', error);
    }
  }

  return false;
}

// ============================================
// Main Intervention Workflow
// ============================================

/**
 * Execute intervention workflow for a stalled onboarding
 */
export async function executeIntervention(
  stall: StallResult,
  options: {
    slackWebhook?: string;
    createTask?: boolean;
    draftEmail?: boolean;
    escalate?: boolean;
  } = {}
): Promise<InterventionResult> {
  const {
    slackWebhook,
    createTask = true,
    draftEmail: shouldDraftEmail = true,
    escalate = true,
  } = options;

  const actions: InterventionAction[] = [];
  const notificationsSent = { slack: false, email: false, inApp: false };

  console.log(
    `[Intervention] Starting intervention for ${stall.customerName} (${stall.customerId})`
  );

  // FR-3.1: Alert CSM
  const alertResults = await alertCSM(stall, slackWebhook);
  notificationsSent.slack = alertResults.slack;
  notificationsSent.inApp = alertResults.inApp;

  actions.push({
    type: 'slack_alert',
    title: 'CSM Alert Sent',
    description: `Alerted CSM about stalled onboarding`,
    priority: mapSeverityToPriority(stall.highestSeverity),
  });

  // FR-3.2: Create intervention task
  let taskId: string | undefined;
  if (createTask) {
    taskId = await createInterventionTask(stall);
    if (taskId) {
      actions.push({
        type: 'create_task',
        title: 'Intervention Task Created',
        description: `Task created to unblock onboarding`,
        priority: mapSeverityToPriority(stall.highestSeverity),
        data: { taskId },
      });
    }
  }

  // FR-3.3: Draft re-engagement email
  let emailDraftId: string | undefined;
  if (shouldDraftEmail) {
    emailDraftId = await draftReengagementEmail(stall);
    if (emailDraftId) {
      actions.push({
        type: 'draft_email',
        title: 'Re-engagement Email Drafted',
        description: `Email draft created for CSM review`,
        priority: mapSeverityToPriority(stall.highestSeverity),
        data: { emailDraftId },
      });
    }
  }

  // FR-3.4: Escalate if chronic stall
  if (escalate && stall.requiresEscalation) {
    const escalated = await escalateToManager(stall, slackWebhook);
    if (escalated) {
      actions.push({
        type: 'escalate_manager',
        title: 'Escalated to Manager',
        description: `Stall exceeds 10 days, escalated to management`,
        priority: 'urgent',
      });
    }
  }

  console.log(
    `[Intervention] Completed for ${stall.customerName}: ${actions.length} actions taken`
  );

  return {
    customerId: stall.customerId,
    customerName: stall.customerName,
    stallResult: stall,
    actions,
    executedAt: new Date(),
    notificationsSent,
    taskCreated: taskId,
    emailDraftId,
  };
}

/**
 * Run intervention workflow for all stalled onboardings
 */
export async function runInterventionWorkflow(
  stalls: StallResult[],
  slackWebhook?: string
): Promise<InterventionResult[]> {
  const results: InterventionResult[] = [];

  for (const stall of stalls) {
    try {
      const result = await executeIntervention(stall, { slackWebhook });
      results.push(result);
    } catch (error) {
      console.error(
        `[Intervention] Failed for ${stall.customerName}:`,
        error
      );
    }
  }

  console.log(
    `[Intervention Workflow] Completed: ${results.length}/${stalls.length} interventions executed`
  );

  return results;
}

export default {
  executeIntervention,
  runInterventionWorkflow,
  buildStallSlackAlert,
};
