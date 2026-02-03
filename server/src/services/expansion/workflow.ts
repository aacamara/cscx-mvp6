/**
 * Expansion Signal Workflow
 * PRD-103: Expansion Signal Detected
 *
 * Implements the scheduled daily workflow for expansion signal detection.
 * Based on the workflow definition in PRD-103, Section 4.3.
 *
 * Workflow: expansion_signal_response
 * Schedule: Daily at 9 AM
 *
 * Steps:
 * 1. scan_for_signals - Detect expansion signals for all active customers
 * 2. notify_csm - Send Slack DM to CSM for each detection
 * 3. create_opportunity - Create expansion opportunity record
 * 4. create_task - Create follow-up task for CSM
 * 5. notify_sales - Notify sales rep for high-score opportunities (>=0.8)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { expansionDetector } from './detector.js';
import { expansionOpportunityService } from './opportunity-service.js';
import { expansionSlackAlerts } from './slack-alerts.js';
import { ExpansionSignalDetectionResult } from './types.js';

// ============================================
// Workflow Configuration
// ============================================

interface WorkflowConfig {
  minCompositeScore: number;
  highScoreThreshold: number;
  taskDueOffsetDays: number;
  notifyChannel?: string;
}

const DEFAULT_CONFIG: WorkflowConfig = {
  minCompositeScore: 0.6,
  highScoreThreshold: 0.8,
  taskDueOffsetDays: 7,
};

// ============================================
// Workflow Results
// ============================================

interface WorkflowRunResult {
  runId: string;
  status: 'completed' | 'partial' | 'failed';
  startedAt: Date;
  completedAt: Date;
  stats: {
    customersScanned: number;
    signalsDetected: number;
    opportunitiesCreated: number;
    opportunitiesUpdated: number;
    csmAlertsent: number;
    salesAlertsSent: number;
    tasksCreated: number;
  };
  errors: Array<{
    customerId: string;
    customerName?: string;
    step: string;
    error: string;
  }>;
}

// ============================================
// Expansion Workflow Service
// ============================================

export class ExpansionWorkflowService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Execute the full expansion signal detection workflow
   * This is typically called by a scheduled job at 9 AM daily
   */
  async executeWorkflow(
    userId: string,
    workflowConfig: Partial<WorkflowConfig> = {}
  ): Promise<WorkflowRunResult> {
    const runConfig = { ...DEFAULT_CONFIG, ...workflowConfig };
    const startedAt = new Date();
    const runId = await this.createScanRun('scheduled');

    const result: WorkflowRunResult = {
      runId,
      status: 'completed',
      startedAt,
      completedAt: new Date(),
      stats: {
        customersScanned: 0,
        signalsDetected: 0,
        opportunitiesCreated: 0,
        opportunitiesUpdated: 0,
        csmAlertsent: 0,
        salesAlertsSent: 0,
        tasksCreated: 0,
      },
      errors: [],
    };

    try {
      // Step 1: Scan for signals
      console.log(`[ExpansionWorkflow] Starting scan with minScore=${runConfig.minCompositeScore}`);
      const detections = await expansionDetector.scanAllCustomers(runConfig.minCompositeScore);
      result.stats.customersScanned = detections.length;

      if (detections.length === 0) {
        console.log('[ExpansionWorkflow] No expansion signals detected');
        result.completedAt = new Date();
        await this.completeScanRun(runId, result.stats, 'completed');
        return result;
      }

      console.log(`[ExpansionWorkflow] Found ${detections.length} customers with signals`);
      result.stats.signalsDetected = detections.reduce((sum, d) => sum + d.signals.length, 0);

      // Process each detection
      for (const detection of detections) {
        try {
          await this.processDetection(userId, detection, runConfig, result);
        } catch (error) {
          result.errors.push({
            customerId: detection.customerId,
            customerName: detection.customerName,
            step: 'processDetection',
            error: (error as Error).message,
          });
        }
      }

      // Determine final status
      if (result.errors.length > 0 && result.errors.length < detections.length) {
        result.status = 'partial';
      } else if (result.errors.length === detections.length) {
        result.status = 'failed';
      }

      result.completedAt = new Date();
      await this.completeScanRun(runId, result.stats, result.status === 'failed' ? 'failed' : 'completed');

      console.log(`[ExpansionWorkflow] Completed with status=${result.status}`, result.stats);

      return result;
    } catch (error) {
      console.error('[ExpansionWorkflow] Workflow failed:', error);
      result.status = 'failed';
      result.completedAt = new Date();
      await this.completeScanRun(runId, result.stats, 'failed', (error as Error).message);
      throw error;
    }
  }

  /**
   * Process a single detection through the workflow steps
   */
  private async processDetection(
    userId: string,
    detection: ExpansionSignalDetectionResult,
    config: WorkflowConfig,
    result: WorkflowRunResult
  ): Promise<void> {
    // Step 2 & 3: Create opportunity
    const opportunity = await expansionOpportunityService.createOpportunity(detection);

    if (opportunity) {
      // Check if this is new or updated (based on detected_at vs created_at difference)
      const isNew = opportunity.createdAt.getTime() === opportunity.detectedAt.getTime();
      if (isNew) {
        result.stats.opportunitiesCreated++;
      } else {
        result.stats.opportunitiesUpdated++;
      }

      // Generate alert data
      const alertData = expansionOpportunityService.generateAlertData(detection, opportunity.id);

      // Step 2: Notify CSM (get CSM Slack user ID from customer)
      const csmSlackUserId = await this.getCsmSlackUserId(detection.customerId);
      if (csmSlackUserId) {
        try {
          await expansionSlackAlerts.sendCsmDm(userId, csmSlackUserId, alertData);
          result.stats.csmAlertsent++;
        } catch (error) {
          result.errors.push({
            customerId: detection.customerId,
            customerName: detection.customerName,
            step: 'notify_csm',
            error: (error as Error).message,
          });
        }
      }

      // Step 4: Create task
      try {
        await this.createFollowUpTask(detection, opportunity.id, config.taskDueOffsetDays);
        result.stats.tasksCreated++;
      } catch (error) {
        result.errors.push({
          customerId: detection.customerId,
          customerName: detection.customerName,
          step: 'create_task',
          error: (error as Error).message,
        });
      }

      // Step 5: Notify sales if high score
      if (detection.compositeScore >= config.highScoreThreshold) {
        const salesSlackUserId = await this.getSalesSlackUserId(detection.customerId);
        if (salesSlackUserId) {
          try {
            const csmName = await this.getCsmName(detection.customerId);
            await expansionSlackAlerts.sendSalesAlert(userId, salesSlackUserId, alertData, csmName || 'CSM');
            result.stats.salesAlertsSent++;
          } catch (error) {
            result.errors.push({
              customerId: detection.customerId,
              customerName: detection.customerName,
              step: 'notify_sales',
              error: (error as Error).message,
            });
          }
        }
      }

      // Log signals to signal log table
      await this.logSignals(detection, opportunity.id);
    }
  }

  /**
   * Log individual signals to the signal log table
   */
  private async logSignals(
    detection: ExpansionSignalDetectionResult,
    opportunityId: string
  ): Promise<void> {
    if (!this.supabase) return;

    const signalLogs = detection.signals.map(signal => ({
      customer_id: detection.customerId,
      opportunity_id: opportunityId,
      signal_type: signal.type,
      signal_strength: signal.strength,
      description: signal.details,
      source: signal.source,
      quote: signal.quote,
      metadata: signal.metadata || {},
      detected_at: signal.detected_at.toISOString(),
    }));

    const { error } = await this.supabase
      .from('expansion_signal_log')
      .insert(signalLogs);

    if (error) {
      console.error('[ExpansionWorkflow] Failed to log signals:', error);
    }
  }

  /**
   * Create a follow-up task for the CSM
   */
  private async createFollowUpTask(
    detection: ExpansionSignalDetectionResult,
    opportunityId: string,
    dueOffsetDays: number
  ): Promise<void> {
    if (!this.supabase) return;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueOffsetDays);

    const primarySignal = detection.signals[0]?.type || 'expansion signal';

    await this.supabase.from('activities').insert({
      customer_id: detection.customerId,
      type: 'task',
      title: `Explore expansion: ${detection.customerName} - ${primarySignal}`,
      description: `
Expansion opportunity detected with composite score ${(detection.compositeScore * 100).toFixed(0)}%.

Signals:
${detection.signals.map(s => `- ${s.type}: ${s.details}`).join('\n')}

Recommended approach: ${detection.recommendedApproach}

Estimated expansion ARR: $${detection.estimatedExpansionArr.toLocaleString()}
      `.trim(),
      status: 'pending',
      priority: 'medium',
      due_date: dueDate.toISOString(),
      metadata: {
        opportunityId,
        compositeScore: detection.compositeScore,
        expansionType: detection.expansionType,
        signalCount: detection.signals.length,
      },
    });
  }

  /**
   * Get CSM's Slack user ID for a customer
   */
  private async getCsmSlackUserId(customerId: string): Promise<string | null> {
    if (!this.supabase) return null;

    const { data } = await this.supabase
      .from('customers')
      .select('owner_id')
      .eq('id', customerId)
      .single();

    if (!data?.owner_id) return null;

    // Get Slack user ID from user profile or slack connections
    const { data: user } = await this.supabase
      .from('users')
      .select('slack_user_id')
      .eq('id', data.owner_id)
      .single();

    return user?.slack_user_id || null;
  }

  /**
   * Get CSM's name for a customer
   */
  private async getCsmName(customerId: string): Promise<string | null> {
    if (!this.supabase) return null;

    const { data } = await this.supabase
      .from('customers')
      .select(`
        owner_id,
        users!customers_owner_id_fkey (
          name,
          email
        )
      `)
      .eq('id', customerId)
      .single();

    return (data as any)?.users?.name || (data as any)?.users?.email || null;
  }

  /**
   * Get Sales rep's Slack user ID for a customer
   */
  private async getSalesSlackUserId(customerId: string): Promise<string | null> {
    if (!this.supabase) return null;

    const { data } = await this.supabase
      .from('customers')
      .select('sales_rep_id')
      .eq('id', customerId)
      .single();

    if (!data?.sales_rep_id) return null;

    const { data: user } = await this.supabase
      .from('users')
      .select('slack_user_id')
      .eq('id', data.sales_rep_id)
      .single();

    return user?.slack_user_id || null;
  }

  /**
   * Create scan run record
   */
  private async createScanRun(runType: 'scheduled' | 'manual'): Promise<string> {
    if (!this.supabase) return 'local-' + Date.now();

    const { data, error } = await this.supabase
      .from('expansion_scan_runs')
      .insert({
        run_type: runType,
        status: 'running',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[ExpansionWorkflow] Failed to create scan run:', error);
      return 'error-' + Date.now();
    }

    return data.id;
  }

  /**
   * Complete scan run record
   */
  private async completeScanRun(
    runId: string,
    stats: WorkflowRunResult['stats'],
    status: 'completed' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('expansion_scan_runs')
      .update({
        status,
        customers_scanned: stats.customersScanned,
        signals_detected: stats.signalsDetected,
        opportunities_created: stats.opportunitiesCreated,
        opportunities_updated: stats.opportunitiesUpdated,
        alerts_sent: stats.csmAlertsent + stats.salesAlertsSent,
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);
  }
}

// Singleton instance
export const expansionWorkflowService = new ExpansionWorkflowService();
