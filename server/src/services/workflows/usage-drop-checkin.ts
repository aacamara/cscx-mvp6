/**
 * Usage Drop Check-In Workflow (PRD-086)
 *
 * Executes the check-in workflow when a usage drop is detected:
 * 1. Send Slack notification to CSM
 * 2. Create task with appropriate due date
 * 3. Draft personalized check-in email using Communicator agent
 * 4. Log all activity
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { UsageDropAlert, sendUsageDropSlackAlert } from '../usage/drop-detector.js';
import { getDueDateOffsetHours } from '../../triggers/conditions/usage-drop.js';
import { activityLogger } from '../activityLogger.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Types
// ============================================

export interface WorkflowExecutionResult {
  success: boolean;
  workflowId: string;
  steps: WorkflowStepResult[];
  error?: string;
}

export interface WorkflowStepResult {
  stepId: string;
  stepName: string;
  success: boolean;
  data?: unknown;
  error?: string;
  executedAt: Date;
}

export interface CustomerContext {
  id: string;
  name: string;
  arr: number;
  healthScore: number;
  csmId?: string;
  csmName?: string;
  csmEmail?: string;
  primaryContact?: {
    name: string;
    email: string;
    title?: string;
  };
}

export interface DraftEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: 'pending_approval' | 'approved' | 'sent' | 'rejected';
  createdAt: Date;
  customerId: string;
  alertId: string;
}

// ============================================
// Email Template
// ============================================

const USAGE_DROP_EMAIL_TEMPLATE = {
  subject: 'Quick check-in from {{csm_name}}',
  body: `Hi {{champion_name}},

I hope you're doing well! I wanted to reach out and see how things are going with {{product_name}}.

I noticed there might have been some changes in how your team is using the platform recently, and I wanted to make sure everything is working smoothly for you. Sometimes these shifts are intentional, and sometimes they indicate we can do more to help.

A few questions:
- Is there anything that's been challenging or frustrating lately?
- Are there features you'd like to explore but haven't had time for?
- Would it be helpful to schedule a quick call to review anything?

I'm here to help in whatever way is most useful. Just let me know!

Best,
{{csm_name}}`,
};

// ============================================
// Workflow Executor
// ============================================

/**
 * Execute the full usage drop check-in workflow
 */
export async function executeUsageDropCheckinWorkflow(
  alert: UsageDropAlert,
  customer: CustomerContext,
  slackWebhookUrl?: string
): Promise<WorkflowExecutionResult> {
  const workflowId = uuidv4();
  const steps: WorkflowStepResult[] = [];
  let overallSuccess = true;

  console.log(`[UsageDropWorkflow] Starting workflow ${workflowId} for customer ${customer.name}`);

  // Step 1: Send Slack notification
  const slackResult = await executeSlackNotification(alert, customer, slackWebhookUrl);
  steps.push(slackResult);
  if (!slackResult.success) {
    console.warn(`[UsageDropWorkflow] Slack notification failed: ${slackResult.error}`);
  }

  // Step 2: Create task
  const taskResult = await executeCreateTask(alert, customer);
  steps.push(taskResult);
  if (!taskResult.success) {
    console.warn(`[UsageDropWorkflow] Task creation failed: ${taskResult.error}`);
    overallSuccess = false;
  }

  // Step 3: Draft check-in email
  const emailResult = await executeDraftEmail(alert, customer);
  steps.push(emailResult);
  if (!emailResult.success) {
    console.warn(`[UsageDropWorkflow] Email draft failed: ${emailResult.error}`);
    overallSuccess = false;
  }

  // Step 4: Log activity
  const logResult = await executeLogActivity(workflowId, alert, customer, steps);
  steps.push(logResult);

  // Step 5: Update health score (if significant drop)
  if (alert.severity === 'critical' || alert.severity === 'high') {
    const healthResult = await executeUpdateHealthScore(alert, customer);
    steps.push(healthResult);
  }

  console.log(`[UsageDropWorkflow] Workflow ${workflowId} completed. Success: ${overallSuccess}`);

  return {
    success: overallSuccess,
    workflowId,
    steps,
  };
}

// ============================================
// Step Executors
// ============================================

async function executeSlackNotification(
  alert: UsageDropAlert,
  customer: CustomerContext,
  webhookUrl?: string
): Promise<WorkflowStepResult> {
  const stepId = uuidv4();
  const stepName = 'notify_csm';

  if (!webhookUrl) {
    return {
      stepId,
      stepName,
      success: true,
      data: { skipped: true, reason: 'No Slack webhook configured' },
      executedAt: new Date(),
    };
  }

  try {
    const sent = await sendUsageDropSlackAlert(
      alert,
      webhookUrl,
      customer.csmName,
      customer.arr,
      customer.healthScore
    );

    return {
      stepId,
      stepName,
      success: sent,
      data: { sent },
      error: sent ? undefined : 'Slack webhook failed',
      executedAt: new Date(),
    };
  } catch (err) {
    return {
      stepId,
      stepName,
      success: false,
      error: (err as Error).message,
      executedAt: new Date(),
    };
  }
}

async function executeCreateTask(
  alert: UsageDropAlert,
  customer: CustomerContext
): Promise<WorkflowStepResult> {
  const stepId = uuidv4();
  const stepName = 'create_task';

  if (!supabase) {
    return {
      stepId,
      stepName,
      success: false,
      error: 'Database not configured',
      executedAt: new Date(),
    };
  }

  try {
    const dueDateOffset = getDueDateOffsetHours(alert.severity);
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + dueDateOffset);

    const taskTitle = `Check in on ${customer.name} - Usage dropped ${alert.percentDrop}%`;
    const taskDescription = `${alert.metricType.toUpperCase()} dropped from ${alert.previousValue} to ${alert.currentValue} (${alert.percentDrop}% drop) over the period ${alert.comparisonPeriod}.\n\nRecommended actions:\n- Review customer's recent activity\n- Check for any support tickets\n- Send personalized check-in email\n- Schedule a call if needed`;

    const { data, error } = await supabase.from('tasks').insert({
      id: uuidv4(),
      customer_id: customer.id,
      assigned_to: customer.csmId,
      title: taskTitle,
      description: taskDescription,
      priority: alert.severity === 'critical' ? 'urgent' : alert.severity === 'high' ? 'high' : 'medium',
      status: 'pending',
      due_date: dueDate.toISOString(),
      metadata: {
        source: 'usage_drop_workflow',
        alertId: alert.id,
        metricType: alert.metricType,
        percentDrop: alert.percentDrop,
      },
      created_at: new Date().toISOString(),
    }).select().single();

    if (error) {
      // Table might not exist, log but don't fail
      console.warn(`[UsageDropWorkflow] Task table not available: ${error.message}`);
      return {
        stepId,
        stepName,
        success: true,
        data: { taskId: null, skipped: true, reason: 'Tasks table not available' },
        executedAt: new Date(),
      };
    }

    return {
      stepId,
      stepName,
      success: true,
      data: { taskId: data?.id, title: taskTitle, dueDate: dueDate.toISOString() },
      executedAt: new Date(),
    };
  } catch (err) {
    return {
      stepId,
      stepName,
      success: false,
      error: (err as Error).message,
      executedAt: new Date(),
    };
  }
}

async function executeDraftEmail(
  alert: UsageDropAlert,
  customer: CustomerContext
): Promise<WorkflowStepResult> {
  const stepId = uuidv4();
  const stepName = 'draft_email';

  if (!supabase) {
    return {
      stepId,
      stepName,
      success: false,
      error: 'Database not configured',
      executedAt: new Date(),
    };
  }

  if (!customer.primaryContact?.email) {
    return {
      stepId,
      stepName,
      success: true,
      data: { skipped: true, reason: 'No primary contact email' },
      executedAt: new Date(),
    };
  }

  try {
    // Generate personalized email from template
    const subject = USAGE_DROP_EMAIL_TEMPLATE.subject
      .replace('{{csm_name}}', customer.csmName || 'Your Customer Success Manager');

    const body = USAGE_DROP_EMAIL_TEMPLATE.body
      .replace(/\{\{champion_name\}\}/g, customer.primaryContact.name.split(' ')[0])
      .replace(/\{\{product_name\}\}/g, 'our platform')
      .replace(/\{\{csm_name\}\}/g, customer.csmName || 'Your Customer Success Manager');

    const draftEmail: DraftEmail = {
      id: uuidv4(),
      to: customer.primaryContact.email,
      subject,
      body,
      status: 'pending_approval',
      createdAt: new Date(),
      customerId: customer.id,
      alertId: alert.id,
    };

    // Save to pending approvals
    const { data, error } = await supabase.from('pending_actions').insert({
      id: draftEmail.id,
      customer_id: customer.id,
      action_type: 'send_email',
      status: 'pending',
      payload: {
        to: draftEmail.to,
        subject: draftEmail.subject,
        body: draftEmail.body,
        context: {
          alertId: alert.id,
          metricType: alert.metricType,
          percentDrop: alert.percentDrop,
          source: 'usage_drop_workflow',
        },
      },
      metadata: {
        emailType: 'usage_drop_checkin',
        severity: alert.severity,
      },
      created_at: new Date().toISOString(),
    }).select().single();

    if (error) {
      // Table might not exist, log but don't fail
      console.warn(`[UsageDropWorkflow] Pending actions table not available: ${error.message}`);
      return {
        stepId,
        stepName,
        success: true,
        data: {
          draftId: draftEmail.id,
          to: draftEmail.to,
          subject: draftEmail.subject,
          status: 'pending_approval',
          stored: false,
        },
        executedAt: new Date(),
      };
    }

    return {
      stepId,
      stepName,
      success: true,
      data: {
        draftId: draftEmail.id,
        to: draftEmail.to,
        subject: draftEmail.subject,
        status: 'pending_approval',
        stored: true,
      },
      executedAt: new Date(),
    };
  } catch (err) {
    return {
      stepId,
      stepName,
      success: false,
      error: (err as Error).message,
      executedAt: new Date(),
    };
  }
}

async function executeLogActivity(
  workflowId: string,
  alert: UsageDropAlert,
  customer: CustomerContext,
  steps: WorkflowStepResult[]
): Promise<WorkflowStepResult> {
  const stepId = uuidv4();
  const stepName = 'log_activity';

  try {
    await activityLogger.logActivity({
      customer_id: customer.id,
      user_id: customer.csmId || 'system',
      agent_type: 'risk',
      action_type: 'usage_drop_workflow_triggered',
      action_data: {
        workflowId,
        alertId: alert.id,
        metricType: alert.metricType,
        percentDrop: alert.percentDrop,
        severity: alert.severity,
      },
      result_data: {
        stepsCompleted: steps.filter(s => s.success).length,
        totalSteps: steps.length,
      },
      status: 'completed',
    });

    return {
      stepId,
      stepName,
      success: true,
      data: { logged: true },
      executedAt: new Date(),
    };
  } catch (err) {
    return {
      stepId,
      stepName,
      success: false,
      error: (err as Error).message,
      executedAt: new Date(),
    };
  }
}

async function executeUpdateHealthScore(
  alert: UsageDropAlert,
  customer: CustomerContext
): Promise<WorkflowStepResult> {
  const stepId = uuidv4();
  const stepName = 'update_health_score';

  if (!supabase) {
    return {
      stepId,
      stepName,
      success: false,
      error: 'Database not configured',
      executedAt: new Date(),
    };
  }

  try {
    // Calculate health score adjustment based on severity
    const adjustment = alert.severity === 'critical' ? -15 : alert.severity === 'high' ? -10 : -5;
    const newScore = Math.max(0, Math.min(100, customer.healthScore + adjustment));

    const { error } = await supabase
      .from('customers')
      .update({
        health_score: newScore,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customer.id);

    if (error) {
      return {
        stepId,
        stepName,
        success: false,
        error: error.message,
        executedAt: new Date(),
      };
    }

    return {
      stepId,
      stepName,
      success: true,
      data: {
        previousScore: customer.healthScore,
        newScore,
        adjustment,
        reason: `Usage drop: ${alert.metricType} dropped ${alert.percentDrop}%`,
      },
      executedAt: new Date(),
    };
  } catch (err) {
    return {
      stepId,
      stepName,
      success: false,
      error: (err as Error).message,
      executedAt: new Date(),
    };
  }
}

// ============================================
// Exports
// ============================================

export default {
  executeUsageDropCheckinWorkflow,
  USAGE_DROP_EMAIL_TEMPLATE,
};
