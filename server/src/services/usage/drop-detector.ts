/**
 * Usage Drop Detector Service (PRD-086)
 *
 * Detects significant usage drops and generates risk signals.
 * This service should be run periodically (daily) to scan all customers
 * for usage anomalies.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { triggerEngine, CustomerEvent } from '../../triggers/index.js';
import {
  UsageDropMetricType,
  UsageDropEventData,
  calculateSeverity,
  getDueDateOffsetHours,
} from '../../triggers/conditions/usage-drop.js';
import { sendSlackAlert, SlackAlertParams } from '../notifications/slack.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Types
// ============================================

export interface UsageDropAlert {
  id: string;
  customerId: string;
  customerName: string;
  metricType: UsageDropMetricType;
  previousValue: number;
  currentValue: number;
  percentDrop: number;
  severity: 'medium' | 'high' | 'critical';
  comparisonPeriod: string;
  detectedAt: Date;
  cooldownExpiresAt: Date;
}

export interface UsageDropDetectionResult {
  customerId: string;
  customerName: string;
  alerts: UsageDropAlert[];
  skipped: boolean;
  skipReason?: string;
}

export interface DetectionConfig {
  dauThreshold?: number;      // Default: 30
  wauThreshold?: number;      // Default: 30
  mauThreshold?: number;      // Default: 30
  featureThreshold?: number;  // Default: 50
  minimumBaseline?: number;   // Default: 5 (users/events)
  cooldownDays?: number;      // Default: 7
  excludeWeekends?: boolean;  // Default: true
}

const DEFAULT_CONFIG: Required<DetectionConfig> = {
  dauThreshold: 30,
  wauThreshold: 30,
  mauThreshold: 30,
  featureThreshold: 50,
  minimumBaseline: 5,
  cooldownDays: 7,
  excludeWeekends: true,
};

// ============================================
// Detection Functions
// ============================================

/**
 * Detect usage drops for a specific customer
 */
export async function detectUsageDropForCustomer(
  customerId: string,
  config: DetectionConfig = {}
): Promise<UsageDropDetectionResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const alerts: UsageDropAlert[] = [];

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

  // Check cooldown - has there been a usage drop alert in the last N days?
  const cooldownCutoff = new Date();
  cooldownCutoff.setDate(cooldownCutoff.getDate() - cfg.cooldownDays);

  const { data: recentAlerts } = await supabase
    .from('risk_signals')
    .select('id')
    .eq('customer_id', customerId)
    .eq('signal_type', 'usage_drop')
    .gte('detected_at', cooldownCutoff.toISOString())
    .limit(1);

  if (recentAlerts && recentAlerts.length > 0) {
    return {
      customerId,
      customerName: customer.name,
      alerts: [],
      skipped: true,
      skipReason: 'Within cooldown period',
    };
  }

  // Get latest two metric calculations for comparison
  const { data: metrics, error: metricsError } = await supabase
    .from('usage_metrics')
    .select('*')
    .eq('customer_id', customerId)
    .order('calculated_at', { ascending: false })
    .limit(2);

  if (metricsError || !metrics || metrics.length < 2) {
    return {
      customerId,
      customerName: customer.name,
      alerts: [],
      skipped: true,
      skipReason: 'Insufficient usage data',
    };
  }

  const current = metrics[0];
  const previous = metrics[1];

  // Check DAU drop
  if (previous.dau >= cfg.minimumBaseline) {
    const dauDrop = ((previous.dau - current.dau) / previous.dau) * 100;
    if (dauDrop >= cfg.dauThreshold) {
      alerts.push(createAlert(
        customerId,
        customer.name,
        'dau',
        previous.dau,
        current.dau,
        dauDrop,
        `${previous.period_start} to ${current.period_end}`
      ));
    }
  }

  // Check WAU drop
  if (previous.wau >= cfg.minimumBaseline) {
    const wauDrop = ((previous.wau - current.wau) / previous.wau) * 100;
    if (wauDrop >= cfg.wauThreshold) {
      alerts.push(createAlert(
        customerId,
        customer.name,
        'wau',
        previous.wau,
        current.wau,
        wauDrop,
        `${previous.period_start} to ${current.period_end}`
      ));
    }
  }

  // Check MAU drop
  if (previous.mau >= cfg.minimumBaseline) {
    const mauDrop = ((previous.mau - current.mau) / previous.mau) * 100;
    if (mauDrop >= cfg.mauThreshold) {
      alerts.push(createAlert(
        customerId,
        customer.name,
        'mau',
        previous.mau,
        current.mau,
        mauDrop,
        `${previous.period_start} to ${current.period_end}`
      ));
    }
  }

  // Check total events drop
  if (previous.total_events >= cfg.minimumBaseline * 10) {
    const eventsDrop = ((previous.total_events - current.total_events) / previous.total_events) * 100;
    if (eventsDrop >= cfg.dauThreshold) {
      alerts.push(createAlert(
        customerId,
        customer.name,
        'total_events',
        previous.total_events,
        current.total_events,
        eventsDrop,
        `${previous.period_start} to ${current.period_end}`
      ));
    }
  }

  // Check feature usage drops
  if (previous.feature_breakdown && current.feature_breakdown) {
    const prevFeatures = previous.feature_breakdown as Record<string, number>;
    const currFeatures = current.feature_breakdown as Record<string, number>;

    for (const [feature, prevCount] of Object.entries(prevFeatures)) {
      if (prevCount >= cfg.minimumBaseline) {
        const currCount = currFeatures[feature] || 0;
        const featureDrop = ((prevCount - currCount) / prevCount) * 100;
        if (featureDrop >= cfg.featureThreshold) {
          alerts.push(createAlert(
            customerId,
            customer.name,
            'feature_usage',
            prevCount,
            currCount,
            featureDrop,
            `${previous.period_start} to ${current.period_end}`,
            [feature]
          ));
        }
      }
    }
  }

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
export async function detectUsageDropForAllCustomers(
  config: DetectionConfig = {}
): Promise<{
  processed: number;
  alertsGenerated: number;
  results: UsageDropDetectionResult[];
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
    console.error('[UsageDropDetector] Failed to fetch customers:', error);
    return { processed: 0, alertsGenerated: 0, results: [] };
  }

  const results: UsageDropDetectionResult[] = [];
  let totalAlerts = 0;

  for (const customer of customers) {
    try {
      const result = await detectUsageDropForCustomer(customer.id, config);
      results.push(result);

      if (result.alerts.length > 0) {
        totalAlerts += result.alerts.length;

        // Save alerts as risk signals
        for (const alert of result.alerts) {
          await saveRiskSignal(alert);
        }

        // Process through trigger engine
        await processAlertsThroughTriggerEngine(result.alerts);
      }
    } catch (err) {
      console.error(`[UsageDropDetector] Error processing customer ${customer.id}:`, err);
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

function createAlert(
  customerId: string,
  customerName: string,
  metricType: UsageDropMetricType,
  previousValue: number,
  currentValue: number,
  percentDrop: number,
  comparisonPeriod: string,
  affectedFeatures?: string[]
): UsageDropAlert {
  const cooldownDays = DEFAULT_CONFIG.cooldownDays;
  const cooldownExpiresAt = new Date();
  cooldownExpiresAt.setDate(cooldownExpiresAt.getDate() + cooldownDays);

  return {
    id: uuidv4(),
    customerId,
    customerName,
    metricType,
    previousValue: Math.round(previousValue),
    currentValue: Math.round(currentValue),
    percentDrop: Math.round(percentDrop),
    severity: calculateSeverity(percentDrop),
    comparisonPeriod,
    detectedAt: new Date(),
    cooldownExpiresAt,
  };
}

/**
 * Save risk signal to database
 */
async function saveRiskSignal(alert: UsageDropAlert): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from('risk_signals').insert({
    id: alert.id,
    customer_id: alert.customerId,
    signal_type: 'usage_drop',
    severity: alert.severity,
    title: `${alert.metricType.toUpperCase()} dropped ${alert.percentDrop}%`,
    description: `${alert.metricType.toUpperCase()} dropped from ${alert.previousValue} to ${alert.currentValue} (${alert.percentDrop}% drop)`,
    metadata: {
      metricType: alert.metricType,
      previousValue: alert.previousValue,
      currentValue: alert.currentValue,
      percentDrop: alert.percentDrop,
      comparisonPeriod: alert.comparisonPeriod,
    },
    detected_at: alert.detectedAt.toISOString(),
    status: 'open',
  });

  if (error) {
    console.error('[UsageDropDetector] Failed to save risk signal:', error);
  }
}

/**
 * Process alerts through the trigger engine
 */
async function processAlertsThroughTriggerEngine(alerts: UsageDropAlert[]): Promise<void> {
  for (const alert of alerts) {
    const event: CustomerEvent = {
      id: uuidv4(),
      type: 'usage_metric_updated',
      customerId: alert.customerId,
      customerName: alert.customerName,
      data: {
        metricType: alert.metricType,
        previousValue: alert.previousValue,
        currentValue: alert.currentValue,
        percentDrop: alert.percentDrop,
        severity: alert.severity,
        comparisonPeriod: alert.comparisonPeriod,
      } satisfies UsageDropEventData,
      timestamp: alert.detectedAt,
      source: 'usage_drop_detector',
    };

    try {
      await triggerEngine.processEvent(event);
    } catch (err) {
      console.error(`[UsageDropDetector] Trigger engine error for ${alert.customerId}:`, err);
    }
  }
}

/**
 * Send usage drop alert to Slack
 */
export async function sendUsageDropSlackAlert(
  alert: UsageDropAlert,
  webhookUrl: string,
  csmName?: string,
  customerArr?: number,
  customerHealthScore?: number
): Promise<boolean> {
  const severityEmoji = {
    critical: ':rotating_light:',
    high: ':warning:',
    medium: ':bell:',
  };

  const params: SlackAlertParams = {
    type: 'risk_signal',
    title: `Usage Alert: ${alert.customerName}`,
    message: `${alert.metricType.toUpperCase()} dropped ${alert.percentDrop}% (${alert.previousValue} → ${alert.currentValue} users) over the past 7 days`,
    customer: {
      id: alert.customerId,
      name: alert.customerName,
      arr: customerArr,
      healthScore: customerHealthScore,
    },
    priority: alert.severity === 'critical' ? 'urgent' : alert.severity === 'high' ? 'high' : 'medium',
    actionUrl: `/customers/${alert.customerId}`,
    fields: {
      'Metric': alert.metricType.toUpperCase(),
      'Drop': `${alert.percentDrop}%`,
      'Previous': alert.previousValue,
      'Current': alert.currentValue,
      'Period': alert.comparisonPeriod,
      'CSM': csmName || 'Unassigned',
    },
  };

  return await sendSlackAlert(webhookUrl, params);
}

// ============================================
// Exports
// ============================================

export default {
  detectUsageDropForCustomer,
  detectUsageDropForAllCustomers,
  sendUsageDropSlackAlert,
};
