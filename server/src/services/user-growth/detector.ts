/**
 * User Growth Detector Service (PRD-111)
 *
 * Detects significant user growth at customer accounts and generates alerts.
 * This service should be run periodically (daily or weekly) to scan all customers.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { triggerEngine, CustomerEvent } from '../../triggers/index.js';
import {
  UserGrowthAlert,
  UserGrowthAlertType,
  UserGrowthAnalysis,
  DetectionConfig,
  DetectionResult,
  DepartmentGrowth,
  calculateSeverity,
  calculateExpansionRevenue,
} from './types.js';
import { sendUserGrowthSlackAlert } from './slack-alerts.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Default configuration
const DEFAULT_CONFIG: Required<DetectionConfig> = {
  growthThresholdPercent: 20,
  seatUtilizationWarning: 0.8,
  seatUtilizationCritical: 1.0,
  minimumUserBaseline: 5,
  cooldownDays: 14,
  comparisonDays: 30,
};

/**
 * Analyze user growth for a customer
 */
async function analyzeUserGrowth(
  customerId: string,
  customerName: string,
  cfg: Required<DetectionConfig>
): Promise<UserGrowthAnalysis | null> {
  if (!supabase) {
    return null;
  }

  const now = new Date();
  const comparisonDate = new Date(now.getTime() - cfg.comparisonDays * 24 * 60 * 60 * 1000);

  // Get current and historical usage metrics
  const { data: currentMetrics } = await supabase
    .from('usage_metrics')
    .select('mau, dau, wau, feature_breakdown')
    .eq('customer_id', customerId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single();

  const { data: previousMetrics } = await supabase
    .from('usage_metrics')
    .select('mau, dau, wau, feature_breakdown')
    .eq('customer_id', customerId)
    .lte('calculated_at', comparisonDate.toISOString())
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single();

  // Get contracted seats from customer or contract
  const { data: customer } = await supabase
    .from('customers')
    .select('metadata')
    .eq('id', customerId)
    .single();

  const contractedSeats = customer?.metadata?.contracted_seats || 100; // Default
  const currentUsers = currentMetrics?.mau || 0;
  const previousUsers = previousMetrics?.mau || currentUsers;

  if (currentUsers === 0 && previousUsers === 0) {
    return null;
  }

  // Calculate growth metrics
  const growthRate = previousUsers > 0
    ? ((currentUsers - previousUsers) / previousUsers) * 100
    : 0;

  const seatUtilization = contractedSeats > 0
    ? currentUsers / contractedSeats
    : 0;

  // Analyze department/team growth (from usage events if available)
  const departmentGrowth = await analyzeDepartmentGrowth(
    customerId,
    cfg.comparisonDays
  );

  return {
    customerId,
    customerName,
    currentUsers,
    previousUsers,
    contractedSeats,
    seatUtilization,
    growthRate,
    newUsersByDepartment: departmentGrowth,
    analyzedAt: now.toISOString(),
  };
}

/**
 * Analyze growth by department/team
 */
async function analyzeDepartmentGrowth(
  customerId: string,
  comparisonDays: number
): Promise<DepartmentGrowth[]> {
  if (!supabase) {
    return [];
  }

  const now = new Date();
  const comparisonDate = new Date(now.getTime() - comparisonDays * 24 * 60 * 60 * 1000);
  const midPoint = new Date(now.getTime() - (comparisonDays / 2) * 24 * 60 * 60 * 1000);

  // Get usage events with department/team info
  const { data: recentEvents } = await supabase
    .from('usage_events')
    .select('user_id, user_email, metadata')
    .eq('customer_id', customerId)
    .gte('timestamp', midPoint.toISOString())
    .order('timestamp', { ascending: false });

  const { data: previousEvents } = await supabase
    .from('usage_events')
    .select('user_id, user_email, metadata')
    .eq('customer_id', customerId)
    .gte('timestamp', comparisonDate.toISOString())
    .lt('timestamp', midPoint.toISOString())
    .order('timestamp', { ascending: false });

  // Group users by department
  const currentByDept = groupUsersByDepartment(recentEvents || []);
  const previousByDept = groupUsersByDepartment(previousEvents || []);

  // Calculate growth per department
  const allDepts = new Set([
    ...Object.keys(currentByDept),
    ...Object.keys(previousByDept),
  ]);

  const departmentGrowth: DepartmentGrowth[] = [];

  for (const dept of allDepts) {
    const current = currentByDept[dept] || 0;
    const previous = previousByDept[dept] || 0;
    const newUsers = current - previous;
    const percentChange = previous > 0
      ? ((current - previous) / previous) * 100
      : current > 0 ? 100 : 0;

    if (newUsers > 0) {
      departmentGrowth.push({
        department: dept,
        previousCount: previous,
        currentCount: current,
        newUsers,
        percentChange,
      });
    }
  }

  // Sort by new users descending
  return departmentGrowth.sort((a, b) => b.newUsers - a.newUsers);
}

/**
 * Group users by department from events
 */
function groupUsersByDepartment(
  events: Array<{ user_id?: string; user_email?: string; metadata?: any }>
): Record<string, number> {
  const usersByDept: Record<string, Set<string>> = {};

  for (const event of events) {
    const userId = event.user_id || event.user_email || 'anonymous';
    const dept = event.metadata?.department || event.metadata?.team || 'Unknown';

    if (!usersByDept[dept]) {
      usersByDept[dept] = new Set();
    }
    usersByDept[dept].add(userId);
  }

  const counts: Record<string, number> = {};
  for (const [dept, users] of Object.entries(usersByDept)) {
    counts[dept] = users.size;
  }

  return counts;
}

/**
 * Detect user growth for a specific customer
 */
export async function detectUserGrowthForCustomer(
  customerId: string,
  userConfig: DetectionConfig = {}
): Promise<DetectionResult> {
  const cfg = { ...DEFAULT_CONFIG, ...userConfig };
  const alerts: UserGrowthAlert[] = [];

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
    .select('id, name, health_score, arr, metadata')
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

  // Check cooldown - has there been a user growth alert recently?
  const cooldownCutoff = new Date();
  cooldownCutoff.setDate(cooldownCutoff.getDate() - cfg.cooldownDays);

  const { data: recentAlerts } = await supabase
    .from('risk_signals')
    .select('id')
    .eq('customer_id', customerId)
    .eq('signal_type', 'user_growth')
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

  // Analyze user growth
  const analysis = await analyzeUserGrowth(customerId, customer.name, cfg);

  if (!analysis) {
    return {
      customerId,
      customerName: customer.name,
      alerts: [],
      skipped: true,
      skipReason: 'Insufficient usage data',
    };
  }

  // Skip if below minimum user baseline
  if (analysis.previousUsers < cfg.minimumUserBaseline) {
    return {
      customerId,
      customerName: customer.name,
      alerts: [],
      analysis,
      skipped: true,
      skipReason: 'Below minimum user baseline',
    };
  }

  const pricePerSeat = customer.metadata?.price_per_seat || 100;
  const cooldownExpiresAt = new Date();
  cooldownExpiresAt.setDate(cooldownExpiresAt.getDate() + cfg.cooldownDays);

  const now = new Date();
  const comparisonPeriod = `Last ${cfg.comparisonDays} days`;

  // Check for rapid growth (>20% in 30 days)
  if (analysis.growthRate >= cfg.growthThresholdPercent) {
    const alertType: UserGrowthAlertType = 'rapid_growth';
    alerts.push({
      id: uuidv4(),
      customerId,
      customerName: customer.name,
      alertType,
      severity: calculateSeverity(alertType, analysis.growthRate),
      currentUsers: analysis.currentUsers,
      previousUsers: analysis.previousUsers,
      growthCount: analysis.currentUsers - analysis.previousUsers,
      growthRate: Math.round(analysis.growthRate),
      contractedSeats: analysis.contractedSeats,
      seatUtilization: analysis.seatUtilization,
      departmentGrowth: analysis.newUsersByDepartment,
      pricePerSeat,
      comparisonPeriod,
      detectedAt: now,
      cooldownExpiresAt,
    });
  }

  // Check for approaching seat limit (>80%)
  if (
    analysis.seatUtilization >= cfg.seatUtilizationWarning &&
    analysis.seatUtilization < cfg.seatUtilizationCritical
  ) {
    const alertType: UserGrowthAlertType = 'approaching_limit';
    alerts.push({
      id: uuidv4(),
      customerId,
      customerName: customer.name,
      alertType,
      severity: calculateSeverity(alertType, undefined, analysis.seatUtilization),
      currentUsers: analysis.currentUsers,
      previousUsers: analysis.previousUsers,
      growthCount: analysis.currentUsers - analysis.previousUsers,
      growthRate: Math.round(analysis.growthRate),
      contractedSeats: analysis.contractedSeats,
      seatUtilization: analysis.seatUtilization,
      departmentGrowth: analysis.newUsersByDepartment,
      pricePerSeat,
      comparisonPeriod,
      detectedAt: now,
      cooldownExpiresAt,
    });
  }

  // Check for exceeding seat limit (>100%)
  if (analysis.seatUtilization >= cfg.seatUtilizationCritical) {
    const overageCount = analysis.currentUsers - analysis.contractedSeats;
    const alertType: UserGrowthAlertType = 'exceeds_limit';
    alerts.push({
      id: uuidv4(),
      customerId,
      customerName: customer.name,
      alertType,
      severity: calculateSeverity(alertType),
      currentUsers: analysis.currentUsers,
      previousUsers: analysis.previousUsers,
      growthCount: analysis.currentUsers - analysis.previousUsers,
      growthRate: Math.round(analysis.growthRate),
      contractedSeats: analysis.contractedSeats,
      seatUtilization: analysis.seatUtilization,
      overageCount,
      departmentGrowth: analysis.newUsersByDepartment,
      estimatedExpansionRevenue: calculateExpansionRevenue(overageCount, pricePerSeat),
      pricePerSeat,
      comparisonPeriod,
      detectedAt: now,
      cooldownExpiresAt,
    });
  }

  return {
    customerId,
    customerName: customer.name,
    alerts,
    analysis,
    skipped: false,
  };
}

/**
 * Run detection for all active customers
 */
export async function detectUserGrowthForAllCustomers(
  userConfig: DetectionConfig = {}
): Promise<{
  processed: number;
  alertsGenerated: number;
  results: DetectionResult[];
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
    console.error('[UserGrowthDetector] Failed to fetch customers:', error);
    return { processed: 0, alertsGenerated: 0, results: [] };
  }

  const results: DetectionResult[] = [];
  let totalAlerts = 0;

  for (const customer of customers) {
    try {
      const result = await detectUserGrowthForCustomer(customer.id, userConfig);
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
      console.error(`[UserGrowthDetector] Error processing customer ${customer.id}:`, err);
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

/**
 * Save risk signal to database
 */
async function saveRiskSignal(alert: UserGrowthAlert): Promise<void> {
  if (!supabase) return;

  const title = getAlertTitle(alert);
  const description = getAlertDescription(alert);

  const { error } = await supabase.from('risk_signals').insert({
    id: alert.id,
    customer_id: alert.customerId,
    signal_type: 'user_growth',
    severity: alert.severity,
    title,
    description,
    metadata: {
      alertType: alert.alertType,
      currentUsers: alert.currentUsers,
      previousUsers: alert.previousUsers,
      growthRate: alert.growthRate,
      contractedSeats: alert.contractedSeats,
      seatUtilization: alert.seatUtilization,
      overageCount: alert.overageCount,
      departmentGrowth: alert.departmentGrowth,
      estimatedExpansionRevenue: alert.estimatedExpansionRevenue,
      comparisonPeriod: alert.comparisonPeriod,
    },
    detected_at: alert.detectedAt.toISOString(),
    status: 'open',
  });

  if (error) {
    console.error('[UserGrowthDetector] Failed to save risk signal:', error);
  }
}

/**
 * Generate alert title
 */
function getAlertTitle(alert: UserGrowthAlert): string {
  switch (alert.alertType) {
    case 'rapid_growth':
      return `User Growth: +${alert.growthRate}% in 30 days`;
    case 'approaching_limit':
      return `Approaching Seat Limit: ${Math.round(alert.seatUtilization * 100)}% utilized`;
    case 'exceeds_limit':
      return `Exceeds Seat Limit by ${alert.overageCount} users`;
    default:
      return 'User Growth Alert';
  }
}

/**
 * Generate alert description
 */
function getAlertDescription(alert: UserGrowthAlert): string {
  switch (alert.alertType) {
    case 'rapid_growth':
      return `Users grew from ${alert.previousUsers} to ${alert.currentUsers} (+${alert.growthCount} users, +${alert.growthRate}%) over the last 30 days.`;
    case 'approaching_limit':
      return `${alert.currentUsers} of ${alert.contractedSeats} seats are in use (${Math.round(alert.seatUtilization * 100)}%). Consider discussing seat expansion.`;
    case 'exceeds_limit':
      return `${alert.currentUsers} users exceed the contracted ${alert.contractedSeats} seats by ${alert.overageCount}. Estimated expansion revenue: $${alert.estimatedExpansionRevenue?.toLocaleString()}/year.`;
    default:
      return 'User growth detected for this account.';
  }
}

/**
 * Process alerts through the trigger engine
 */
async function processAlertsThroughTriggerEngine(alerts: UserGrowthAlert[]): Promise<void> {
  for (const alert of alerts) {
    const event: CustomerEvent = {
      id: uuidv4(),
      type: 'user_growth_detected',
      customerId: alert.customerId,
      customerName: alert.customerName,
      data: {
        alertType: alert.alertType,
        currentUsers: alert.currentUsers,
        previousUsers: alert.previousUsers,
        growthRate: alert.growthRate,
        contractedSeats: alert.contractedSeats,
        seatUtilization: alert.seatUtilization,
        overageCount: alert.overageCount,
        estimatedExpansionRevenue: alert.estimatedExpansionRevenue,
        severity: alert.severity,
      },
      timestamp: alert.detectedAt,
      source: 'user_growth_detector',
    };

    try {
      await triggerEngine.processEvent(event);
    } catch (err) {
      console.error(`[UserGrowthDetector] Trigger engine error for ${alert.customerId}:`, err);
    }
  }
}

/**
 * Get user growth alerts for a customer
 */
export async function getCustomerUserGrowthAlerts(
  customerId: string,
  options: { status?: string; limit?: number } = {}
): Promise<UserGrowthAlert[]> {
  if (!supabase) {
    return [];
  }

  const { status = 'open', limit = 10 } = options;

  let query = supabase
    .from('risk_signals')
    .select('*')
    .eq('customer_id', customerId)
    .eq('signal_type', 'user_growth')
    .order('detected_at', { ascending: false })
    .limit(limit);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map(mapRiskSignalToAlert);
}

/**
 * Map database record to UserGrowthAlert
 */
function mapRiskSignalToAlert(record: any): UserGrowthAlert {
  const metadata = record.metadata || {};
  return {
    id: record.id,
    customerId: record.customer_id,
    customerName: record.customer_name || '',
    alertType: metadata.alertType || 'rapid_growth',
    severity: record.severity || 'medium',
    currentUsers: metadata.currentUsers || 0,
    previousUsers: metadata.previousUsers || 0,
    growthCount: (metadata.currentUsers || 0) - (metadata.previousUsers || 0),
    growthRate: metadata.growthRate || 0,
    contractedSeats: metadata.contractedSeats || 0,
    seatUtilization: metadata.seatUtilization || 0,
    overageCount: metadata.overageCount,
    departmentGrowth: metadata.departmentGrowth || [],
    estimatedExpansionRevenue: metadata.estimatedExpansionRevenue,
    pricePerSeat: metadata.pricePerSeat,
    comparisonPeriod: metadata.comparisonPeriod || 'Last 30 days',
    detectedAt: new Date(record.detected_at),
    cooldownExpiresAt: new Date(record.cooldown_expires_at || record.detected_at),
  };
}

// Export the detector
export const userGrowthDetector = {
  detectUserGrowthForCustomer,
  detectUserGrowthForAllCustomers,
  getCustomerUserGrowthAlerts,
  sendUserGrowthSlackAlert,
};

export default userGrowthDetector;
