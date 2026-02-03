/**
 * PRD-090: Feature Adoption Stall Detector Service
 *
 * Detects when customers have stalled on feature adoption and generates risk signals.
 * This service should be run periodically (daily) to scan all customers
 * for adoption stalls.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { triggerEngine, CustomerEvent } from '../../triggers/index.js';
import { sendSlackAlert, SlackAlertParams } from '../notifications/slack.js';
import type {
  AdoptionStallAlert,
  AdoptionDetectionResult,
  DetectionConfig,
  AdoptionStage,
  AdoptionStallEventData,
  TrainingResource,
} from './types.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: Required<DetectionConfig> = {
  stallThresholdDays: 14,      // 14 days of low usage
  usageThreshold: 20,          // Usage score below 20% is considered stalled
  cooldownDays: 30,            // 30-day cooldown between alerts
  minImportanceScore: 50,      // Only track important features
  excludeFeatureIds: [],
};

// ============================================
// Severity Calculation
// ============================================

/**
 * Calculate severity based on feature importance and stall duration
 */
export function calculateSeverity(
  featureImportance: number,
  daysStalled: number,
  usageScore: number
): 'medium' | 'high' | 'critical' {
  // Critical: High importance feature, long stall, very low usage
  if (featureImportance >= 80 && (daysStalled >= 30 || usageScore < 10)) {
    return 'critical';
  }

  // High: Important feature with significant stall
  if (featureImportance >= 70 && daysStalled >= 21) {
    return 'high';
  }

  if (featureImportance >= 60 && usageScore < 10) {
    return 'high';
  }

  return 'medium';
}

/**
 * Get due date offset in hours based on severity
 */
export function getDueDateOffsetHours(severity: 'medium' | 'high' | 'critical'): number {
  switch (severity) {
    case 'critical':
      return 24;   // 1 day
    case 'high':
      return 48;   // 2 days
    case 'medium':
    default:
      return 72;   // 3 days
  }
}

// ============================================
// Detection Functions
// ============================================

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.floor(Math.abs((date2.getTime() - date1.getTime()) / oneDay));
}

/**
 * Determine adoption stage based on usage score and days since activation
 */
function determineStage(usageScore: number, daysSinceActivation: number): AdoptionStage {
  if (usageScore === 0 && daysSinceActivation > 7) {
    return 'not_started';
  } else if (usageScore < 20) {
    return 'started';
  } else if (usageScore < 60) {
    return 'engaged';
  } else {
    return 'adopted';
  }
}

/**
 * Detect adoption stalls for a specific customer
 */
export async function detectAdoptionStallForCustomer(
  customerId: string,
  detectionConfig: DetectionConfig = {}
): Promise<AdoptionDetectionResult> {
  const cfg = { ...DEFAULT_CONFIG, ...detectionConfig };
  const alerts: AdoptionStallAlert[] = [];

  if (!supabase) {
    return {
      customerId,
      customerName: '',
      alerts: [],
      skipped: true,
      skipReason: 'Database not configured',
    };
  }

  // Get customer info
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, name, health_score, arr')
    .eq('id', customerId)
    .single();

  if (customerError || !customer) {
    return {
      customerId,
      customerName: '',
      alerts: [],
      skipped: true,
      skipReason: 'Customer not found',
    };
  }

  // Get all feature adoptions for this customer
  const { data: adoptions, error: adoptionsError } = await supabase
    .from('feature_adoption')
    .select(`
      *,
      feature_catalog (
        feature_id,
        feature_name,
        category,
        importance_score,
        expected_adoption_days,
        training_resources
      )
    `)
    .eq('customer_id', customerId)
    .neq('stage', 'adopted')
    .order('usage_score', { ascending: true });

  if (adoptionsError) {
    return {
      customerId,
      customerName: customer.name,
      alerts: [],
      skipped: true,
      skipReason: `Database error: ${adoptionsError.message}`,
    };
  }

  if (!adoptions || adoptions.length === 0) {
    return {
      customerId,
      customerName: customer.name,
      alerts: [],
      skipped: true,
      skipReason: 'No feature adoptions to track',
    };
  }

  const now = new Date();
  const cooldownCutoff = new Date();
  cooldownCutoff.setDate(cooldownCutoff.getDate() - cfg.cooldownDays);

  for (const adoption of adoptions) {
    const catalog = adoption.feature_catalog;

    // Skip if feature is excluded
    if (cfg.excludeFeatureIds.includes(adoption.feature_id)) {
      continue;
    }

    // Skip if feature importance is below threshold
    if (catalog && catalog.importance_score < cfg.minImportanceScore) {
      continue;
    }

    // Skip if no activation date
    if (!adoption.activated_at) {
      continue;
    }

    // Check cooldown - has there been an alert for this feature recently?
    if (adoption.stall_detected_at && new Date(adoption.stall_detected_at) > cooldownCutoff) {
      continue;
    }

    const activatedAt = new Date(adoption.activated_at);
    const daysSinceActivation = daysBetween(activatedAt, now);
    const expectedAdoptionDays = catalog?.expected_adoption_days || adoption.expected_adoption_days || 30;

    // Check if feature is stalled
    // Condition: Past expected adoption time AND usage score below threshold
    const isStalled = (
      daysSinceActivation > expectedAdoptionDays &&
      adoption.usage_score < cfg.usageThreshold
    );

    if (!isStalled) {
      continue;
    }

    // Calculate days in current stage (approximate based on last_used_at or stall detection)
    const lastUsedAt = adoption.last_used_at ? new Date(adoption.last_used_at) : activatedAt;
    const daysInCurrentStage = daysBetween(lastUsedAt, now);

    // Only alert if stalled for significant time
    if (daysInCurrentStage < cfg.stallThresholdDays) {
      continue;
    }

    const featureImportance = catalog?.importance_score || 50;
    const severity = calculateSeverity(featureImportance, daysInCurrentStage, adoption.usage_score);

    const cooldownExpiresAt = new Date();
    cooldownExpiresAt.setDate(cooldownExpiresAt.getDate() + cfg.cooldownDays);

    const alert: AdoptionStallAlert = {
      id: uuidv4(),
      customerId,
      customerName: customer.name,
      featureId: adoption.feature_id,
      featureName: catalog?.feature_name || adoption.feature_name,
      currentStage: adoption.stage,
      usageScore: adoption.usage_score,
      expectedUsageScore: 60, // Target for 'engaged' stage
      daysInCurrentStage,
      daysSinceActivation,
      expectedAdoptionDays,
      severity,
      featureImportance,
      detectedAt: now,
      cooldownExpiresAt,
      trainingResources: catalog?.training_resources || [],
    };

    alerts.push(alert);
  }

  // Sort alerts by severity and feature importance
  alerts.sort((a, b) => {
    const severityOrder = { critical: 3, high: 2, medium: 1 };
    const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.featureImportance - a.featureImportance;
  });

  return {
    customerId,
    customerName: customer.name,
    alerts,
    skipped: false,
  };
}

/**
 * Run detection for all active customers
 */
export async function detectAdoptionStallForAllCustomers(
  detectionConfig: DetectionConfig = {}
): Promise<{
  processed: number;
  alertsGenerated: number;
  results: AdoptionDetectionResult[];
}> {
  if (!supabase) {
    return { processed: 0, alertsGenerated: 0, results: [] };
  }

  // Get all active customers
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id')
    .in('status', ['active', 'onboarding'])
    .order('arr', { ascending: false });

  if (error || !customers) {
    console.error('[AdoptionStallDetector] Failed to fetch customers:', error);
    return { processed: 0, alertsGenerated: 0, results: [] };
  }

  const results: AdoptionDetectionResult[] = [];
  let totalAlerts = 0;

  for (const customer of customers) {
    try {
      const result = await detectAdoptionStallForCustomer(customer.id, detectionConfig);
      results.push(result);

      if (result.alerts.length > 0) {
        totalAlerts += result.alerts.length;

        // Save alerts as risk signals
        for (const alert of result.alerts) {
          await saveRiskSignal(alert);
          await updateFeatureAdoptionStall(alert);
        }

        // Process through trigger engine
        await processAlertsThroughTriggerEngine(result.alerts);
      }
    } catch (err) {
      console.error(`[AdoptionStallDetector] Error processing customer ${customer.id}:`, err);
      results.push({
        customerId: customer.id,
        customerName: '',
        alerts: [],
        skipped: true,
        skipReason: `Error: ${(err as Error).message}`,
      });
    }
  }

  return {
    processed: customers.length,
    alertsGenerated: totalAlerts,
    results,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Save risk signal to database
 */
async function saveRiskSignal(alert: AdoptionStallAlert): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from('risk_signals').insert({
    id: alert.id,
    customer_id: alert.customerId,
    signal_type: 'adoption_stalled',
    severity: alert.severity,
    title: `Feature adoption stalled: ${alert.featureName}`,
    description: `${alert.featureName} has been in "${alert.currentStage}" stage for ${alert.daysInCurrentStage} days with only ${alert.usageScore}% usage (expected: ${alert.expectedUsageScore}% by day ${alert.expectedAdoptionDays})`,
    metadata: {
      featureId: alert.featureId,
      featureName: alert.featureName,
      currentStage: alert.currentStage,
      usageScore: alert.usageScore,
      expectedUsageScore: alert.expectedUsageScore,
      daysSinceActivation: alert.daysSinceActivation,
      daysInCurrentStage: alert.daysInCurrentStage,
      expectedAdoptionDays: alert.expectedAdoptionDays,
      featureImportance: alert.featureImportance,
      trainingResourcesCount: alert.trainingResources?.length || 0,
    },
    detected_at: alert.detectedAt.toISOString(),
    status: 'open',
  });

  if (error) {
    console.error('[AdoptionStallDetector] Failed to save risk signal:', error);
  }
}

/**
 * Update feature adoption record with stall detection
 */
async function updateFeatureAdoptionStall(alert: AdoptionStallAlert): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from('feature_adoption')
    .update({
      stall_detected_at: alert.detectedAt.toISOString(),
    })
    .eq('customer_id', alert.customerId)
    .eq('feature_id', alert.featureId);

  if (error) {
    console.error('[AdoptionStallDetector] Failed to update feature adoption:', error);
  }
}

/**
 * Process alerts through the trigger engine
 */
async function processAlertsThroughTriggerEngine(alerts: AdoptionStallAlert[]): Promise<void> {
  for (const alert of alerts) {
    const event: CustomerEvent = {
      id: uuidv4(),
      type: 'product_usage',
      customerId: alert.customerId,
      customerName: alert.customerName,
      data: {
        featureId: alert.featureId,
        featureName: alert.featureName,
        currentStage: alert.currentStage,
        usageScore: alert.usageScore,
        daysSinceActivation: alert.daysSinceActivation,
        expectedAdoptionDays: alert.expectedAdoptionDays,
        daysInCurrentStage: alert.daysInCurrentStage,
        severity: alert.severity,
        featureImportance: alert.featureImportance,
        trainingResourcesAvailable: alert.trainingResources?.length || 0,
      } satisfies AdoptionStallEventData,
      timestamp: alert.detectedAt,
      source: 'adoption_stall_detector',
    };

    try {
      await triggerEngine.processEvent(event);
    } catch (err) {
      console.error(`[AdoptionStallDetector] Trigger engine error for ${alert.customerId}:`, err);
    }
  }
}

/**
 * Send adoption stall alert to Slack
 */
export async function sendAdoptionStallSlackAlert(
  alert: AdoptionStallAlert,
  webhookUrl: string,
  csmName?: string,
  customerArr?: number,
  customerHealthScore?: number
): Promise<boolean> {
  const params: SlackAlertParams = {
    type: 'risk_signal',
    title: `Feature Adoption Stalled: ${alert.customerName}`,
    message: `*${alert.featureName}* has been in "${alert.currentStage}" stage for ${alert.daysInCurrentStage} days.\n\nUsage Score: ${alert.usageScore}% (expected: ${alert.expectedUsageScore}% by day ${alert.expectedAdoptionDays})`,
    customer: {
      id: alert.customerId,
      name: alert.customerName,
      arr: customerArr,
      healthScore: customerHealthScore,
    },
    priority: alert.severity === 'critical' ? 'urgent' : alert.severity === 'high' ? 'high' : 'medium',
    actionUrl: `/customers/${alert.customerId}?tab=adoption`,
    fields: {
      'Feature': alert.featureName,
      'Current Stage': alert.currentStage,
      'Usage Score': `${alert.usageScore}%`,
      'Days Stalled': alert.daysInCurrentStage,
      'Feature Importance': `${alert.featureImportance}/100`,
      'Training Resources': alert.trainingResources?.length || 0,
      'CSM': csmName || 'Unassigned',
    },
  };

  return await sendSlackAlert(webhookUrl, params);
}

// ============================================
// Exports
// ============================================

export default {
  detectAdoptionStallForCustomer,
  detectAdoptionStallForAllCustomers,
  sendAdoptionStallSlackAlert,
  calculateSeverity,
  getDueDateOffsetHours,
};
