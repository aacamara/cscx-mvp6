/**
 * Login Pattern Detector Service (PRD-100)
 *
 * Detects significant changes in user login behavior at both individual
 * and account levels. Generates alerts for:
 * - Frequency downgrades (daily -> weekly, weekly -> monthly)
 * - Users who haven't logged in for 14+ days
 * - Account-level login declines (>30% reduction)
 * - Power user disengagement
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { triggerEngine, CustomerEvent } from '../../triggers/index.js';
import { sendSlackAlert, SlackAlertParams } from '../notifications/slack.js';
import {
  LoginFrequency,
  PatternChangeType,
  LoginPatternAlertType,
  LoginPatternAlertSeverity,
  UserLoginPattern,
  LoginPatternAlert,
  AffectedUserDetail,
  AccountLoginMetrics,
  LoginPatternAccountContext,
  SuggestedAction,
  LoginPatternDetectionConfig,
  LoginPatternDetectionResult,
  BulkDetectionResult,
  LoginPatternEventData,
} from '../../../../types/loginPattern.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: Required<LoginPatternDetectionConfig> = {
  accountDeclineThreshold: 30,
  inactiveDaysThreshold: 14,
  cooldownDays: 7,
  excludeNewUsers: true,
  newUserDays: 30,
  minimumBaseline: 5,
  includePowerUsersOnly: false,
  excludeWeekends: false,
  excludeHolidays: false,
};

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate login frequency category based on logins per week
 */
function calculateFrequency(loginsPerWeek: number): LoginFrequency {
  if (loginsPerWeek >= 4) return 'daily';
  if (loginsPerWeek >= 1) return 'weekly';
  if (loginsPerWeek >= 0.25) return 'monthly';
  return 'inactive';
}

/**
 * Calculate severity based on change and context
 */
function calculateSeverity(
  changePercent: number,
  hasPowerUserAffected: boolean,
  affectedCount: number
): LoginPatternAlertSeverity {
  if (hasPowerUserAffected) return 'high';

  if (affectedCount >= 10) {
    if (Math.abs(changePercent) >= 70) return 'critical';
    if (Math.abs(changePercent) >= 50) return 'high';
    return 'medium';
  }

  if (Math.abs(changePercent) >= 70) return 'critical';
  if (Math.abs(changePercent) >= 50) return 'high';
  if (Math.abs(changePercent) >= 30) return 'medium';
  return 'low';
}

/**
 * Generate suggested actions based on alert type and severity
 */
function generateSuggestedActions(
  alertType: LoginPatternAlertType,
  severity: LoginPatternAlertSeverity,
  affectedUsers: AffectedUserDetail[]
): SuggestedAction[] {
  const actions: SuggestedAction[] = [];

  // Always suggest checking in
  actions.push({
    type: 'send_email',
    title: 'Send Check-In Email',
    description: 'Draft a personalized check-in email to affected users',
    priority: severity === 'critical' ? 'high' : 'medium',
    template: 'login_pattern_checkin',
  });

  // For power users or high severity, suggest a call
  if (
    severity === 'high' ||
    severity === 'critical' ||
    alertType === 'power_user_disengagement'
  ) {
    actions.push({
      type: 'schedule_call',
      title: 'Schedule Call',
      description: 'Set up a call to understand the change in behavior',
      priority: 'high',
    });
  }

  // For account-level decline, suggest internal review
  if (alertType === 'account_level_decline') {
    actions.push({
      type: 'create_task',
      title: 'Review Account Health',
      description: 'Analyze recent changes and product usage patterns',
      priority: 'medium',
    });
  }

  // If multiple users affected, suggest team notification
  if (affectedUsers.length >= 3) {
    actions.push({
      type: 'slack_notify',
      title: 'Notify Team',
      description: 'Alert the team about widespread login pattern changes',
      priority: 'medium',
    });
  }

  return actions;
}

/**
 * Get account context for the alert
 */
async function getAccountContext(
  customerId: string
): Promise<LoginPatternAccountContext> {
  if (!supabase) return {};

  const { data: customer } = await supabase
    .from('customers')
    .select('arr, health_score, renewal_date, csm_name, segment')
    .eq('id', customerId)
    .single();

  if (!customer) return {};

  const renewalDate = customer.renewal_date
    ? new Date(customer.renewal_date)
    : null;
  const daysToRenewal = renewalDate
    ? Math.floor((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : undefined;

  return {
    arr: customer.arr,
    healthScore: customer.health_score,
    renewalDate: customer.renewal_date,
    daysToRenewal,
    csmName: customer.csm_name,
    segment: customer.segment,
  };
}

// ============================================
// Detection Functions
// ============================================

/**
 * Detect login pattern changes for a specific customer
 */
export async function detectLoginPatternsForCustomer(
  customerId: string,
  configOverrides: LoginPatternDetectionConfig = {}
): Promise<LoginPatternDetectionResult> {
  const cfg = { ...DEFAULT_CONFIG, ...configOverrides };
  const alerts: LoginPatternAlert[] = [];

  if (!supabase) {
    return {
      customerId,
      customerName: '',
      alerts: [],
      usersAnalyzed: 0,
      patternsChanged: 0,
      skipped: true,
      skipReason: 'Database not configured',
    };
  }

  // Get customer info
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, name, health_score, arr, csm_name, segment, renewal_date')
    .eq('id', customerId)
    .single();

  if (customerError || !customer) {
    return {
      customerId,
      customerName: '',
      alerts: [],
      usersAnalyzed: 0,
      patternsChanged: 0,
      skipped: true,
      skipReason: 'Customer not found',
    };
  }

  // Check cooldown - has there been a login pattern alert in the last N days?
  const cooldownCutoff = new Date();
  cooldownCutoff.setDate(cooldownCutoff.getDate() - cfg.cooldownDays);

  const { data: recentAlerts } = await supabase
    .from('login_pattern_alerts')
    .select('id')
    .eq('customer_id', customerId)
    .gte('detected_at', cooldownCutoff.toISOString())
    .limit(1);

  if (recentAlerts && recentAlerts.length > 0) {
    return {
      customerId,
      customerName: customer.name,
      alerts: [],
      usersAnalyzed: 0,
      patternsChanged: 0,
      skipped: true,
      skipReason: 'Within cooldown period',
    };
  }

  // Get all user login patterns for this customer
  const { data: patterns, error: patternsError } = await supabase
    .from('user_login_patterns')
    .select('*')
    .eq('customer_id', customerId);

  if (patternsError) {
    console.error('[LoginPatternDetector] Error fetching patterns:', patternsError);
    return {
      customerId,
      customerName: customer.name,
      alerts: [],
      usersAnalyzed: 0,
      patternsChanged: 0,
      skipped: true,
      skipReason: `Database error: ${patternsError.message}`,
    };
  }

  if (!patterns || patterns.length === 0) {
    return {
      customerId,
      customerName: customer.name,
      alerts: [],
      usersAnalyzed: 0,
      patternsChanged: 0,
      skipped: true,
      skipReason: 'No user login patterns found',
    };
  }

  // Filter patterns based on configuration
  let filteredPatterns = patterns;
  if (cfg.includePowerUsersOnly) {
    filteredPatterns = patterns.filter((p) => p.is_power_user);
  }

  // Analyze patterns for changes
  const changedPatterns = filteredPatterns.filter(
    (p) =>
      p.pattern_change_type === 'downgraded' ||
      p.pattern_change_type === 'stopped'
  );

  // Check for users who haven't logged in for threshold days
  const inactiveUsers = filteredPatterns.filter(
    (p) => p.days_since_login >= cfg.inactiveDaysThreshold
  );

  // Calculate account-level metrics
  const totalUsers = filteredPatterns.length;
  const historicalTotal = filteredPatterns.reduce(
    (sum, p) => sum + (p.avg_logins_per_week_historical || 0),
    0
  );
  const currentTotal = filteredPatterns.reduce(
    (sum, p) => sum + (p.avg_logins_per_week_current || 0),
    0
  );
  const historicalAvg = totalUsers > 0 ? historicalTotal / totalUsers : 0;
  const currentAvg = totalUsers > 0 ? currentTotal / totalUsers : 0;
  const changePercent =
    historicalAvg > 0
      ? ((currentAvg - historicalAvg) / historicalAvg) * 100
      : 0;

  const accountContext = await getAccountContext(customerId);
  const cooldownExpiresAt = new Date();
  cooldownExpiresAt.setDate(cooldownExpiresAt.getDate() + cfg.cooldownDays);

  // Build affected user details
  const buildAffectedUserDetail = (p: typeof patterns[0]): AffectedUserDetail => ({
    userId: p.user_id,
    name: p.user_name || 'Unknown',
    email: p.user_email,
    role: p.user_role,
    isPowerUser: p.is_power_user,
    previousFrequency: p.historical_frequency as LoginFrequency,
    currentFrequency: p.current_frequency as LoginFrequency,
    lastLogin: p.last_login_at || '',
    daysSinceLogin: p.days_since_login || 0,
  });

  // Check for account-level decline
  if (
    changePercent <= -cfg.accountDeclineThreshold &&
    historicalAvg >= cfg.minimumBaseline / 4 // Ensure meaningful baseline
  ) {
    const affectedUserDetails = changedPatterns.map(buildAffectedUserDetail);
    const hasPowerUserAffected = affectedUserDetails.some((u) => u.isPowerUser);
    const severity = calculateSeverity(
      changePercent,
      hasPowerUserAffected,
      affectedUserDetails.length
    );

    const alert: LoginPatternAlert = {
      id: uuidv4(),
      customerId,
      customerName: customer.name,
      alertType: 'account_level_decline',
      severity,
      status: 'open',
      totalUsers,
      affectedUsers: affectedUserDetails.length,
      previousAvgLoginsPerWeek: historicalAvg,
      currentAvgLoginsPerWeek: currentAvg,
      changePercent: Math.round(changePercent * 10) / 10,
      affectedUserDetails,
      accountContext,
      suggestedActions: generateSuggestedActions(
        'account_level_decline',
        severity,
        affectedUserDetails
      ),
      resolvedAt: null,
      detectedAt: new Date(),
      cooldownExpiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    alerts.push(alert);
  }

  // Check for power user disengagement
  const affectedPowerUsers = changedPatterns.filter((p) => p.is_power_user);
  if (affectedPowerUsers.length > 0) {
    const affectedUserDetails = affectedPowerUsers.map(buildAffectedUserDetail);

    const alert: LoginPatternAlert = {
      id: uuidv4(),
      customerId,
      customerName: customer.name,
      alertType: 'power_user_disengagement',
      severity: 'high',
      status: 'open',
      totalUsers,
      affectedUsers: affectedPowerUsers.length,
      previousAvgLoginsPerWeek: historicalAvg,
      currentAvgLoginsPerWeek: currentAvg,
      changePercent: Math.round(changePercent * 10) / 10,
      affectedUserDetails,
      accountContext,
      suggestedActions: generateSuggestedActions(
        'power_user_disengagement',
        'high',
        affectedUserDetails
      ),
      resolvedAt: null,
      detectedAt: new Date(),
      cooldownExpiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    alerts.push(alert);
  }

  // Check for individual stopped users (not already covered by power user alert)
  const nonPowerUserInactive = inactiveUsers.filter((p) => !p.is_power_user);
  if (nonPowerUserInactive.length > 0 && !alerts.some((a) => a.alertType === 'account_level_decline')) {
    const affectedUserDetails = nonPowerUserInactive.map(buildAffectedUserDetail);
    const alertType: LoginPatternAlertType =
      nonPowerUserInactive.length >= 3 ? 'bulk_downgrade' : 'individual_stopped';
    const severity = calculateSeverity(
      changePercent,
      false,
      nonPowerUserInactive.length
    );

    const alert: LoginPatternAlert = {
      id: uuidv4(),
      customerId,
      customerName: customer.name,
      alertType,
      severity,
      status: 'open',
      totalUsers,
      affectedUsers: nonPowerUserInactive.length,
      previousAvgLoginsPerWeek: historicalAvg,
      currentAvgLoginsPerWeek: currentAvg,
      changePercent: Math.round(changePercent * 10) / 10,
      affectedUserDetails,
      accountContext,
      suggestedActions: generateSuggestedActions(alertType, severity, affectedUserDetails),
      resolvedAt: null,
      detectedAt: new Date(),
      cooldownExpiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    alerts.push(alert);
  }

  return {
    customerId,
    customerName: customer.name,
    alerts,
    usersAnalyzed: filteredPatterns.length,
    patternsChanged: changedPatterns.length,
    skipped: false,
  };
}

/**
 * Run detection for all active customers
 */
export async function detectLoginPatternsForAllCustomers(
  configOverrides: LoginPatternDetectionConfig = {}
): Promise<BulkDetectionResult> {
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
    console.error('[LoginPatternDetector] Failed to fetch customers:', error);
    return { processed: 0, alertsGenerated: 0, results: [] };
  }

  const results: LoginPatternDetectionResult[] = [];
  let totalAlerts = 0;

  for (const customer of customers) {
    try {
      const result = await detectLoginPatternsForCustomer(customer.id, configOverrides);
      results.push(result);

      if (result.alerts.length > 0) {
        totalAlerts += result.alerts.length;

        // Save alerts to database
        for (const alert of result.alerts) {
          await saveLoginPatternAlert(alert);
          await saveRiskSignal(alert, result.customerName);
        }

        // Process through trigger engine
        await processAlertsThroughTriggerEngine(result.alerts, result.customerName);
      }
    } catch (err) {
      console.error(`[LoginPatternDetector] Error processing customer ${customer.id}:`, err);
      results.push({
        customerId: customer.id,
        customerName: '',
        alerts: [],
        usersAnalyzed: 0,
        patternsChanged: 0,
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
// Database Operations
// ============================================

/**
 * Save login pattern alert to database
 */
async function saveLoginPatternAlert(alert: LoginPatternAlert): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from('login_pattern_alerts').insert({
    id: alert.id,
    customer_id: alert.customerId,
    alert_type: alert.alertType,
    severity: alert.severity,
    status: alert.status,
    total_users: alert.totalUsers,
    affected_users: alert.affectedUsers,
    previous_avg_logins_per_week: alert.previousAvgLoginsPerWeek,
    current_avg_logins_per_week: alert.currentAvgLoginsPerWeek,
    change_percent: alert.changePercent,
    affected_user_details: alert.affectedUserDetails,
    account_context: alert.accountContext,
    suggested_actions: alert.suggestedActions,
    detected_at: alert.detectedAt.toISOString(),
    cooldown_expires_at: alert.cooldownExpiresAt.toISOString(),
  });

  if (error) {
    console.error('[LoginPatternDetector] Failed to save alert:', error);
  }
}

/**
 * Save risk signal to database
 */
async function saveRiskSignal(
  alert: LoginPatternAlert,
  customerName: string
): Promise<void> {
  if (!supabase) return;

  const title = getAlertTitle(alert.alertType, alert.affectedUsers, alert.changePercent);

  const { error } = await supabase.from('risk_signals').insert({
    id: uuidv4(),
    customer_id: alert.customerId,
    signal_type: 'login_pattern_change',
    severity: alert.severity,
    title,
    description: `Login pattern change detected: ${alert.affectedUsers} users affected. Account login change: ${alert.changePercent}%`,
    metadata: {
      pattern_type: alert.alertType,
      account_level_change: alert.alertType === 'account_level_decline',
      total_users: alert.totalUsers,
      affected_users: alert.affectedUsers,
      users: alert.affectedUserDetails,
      account_metrics: {
        previousAvgLoginsPerWeek: alert.previousAvgLoginsPerWeek,
        currentAvgLoginsPerWeek: alert.currentAvgLoginsPerWeek,
        changePercent: alert.changePercent,
        totalUsers: alert.totalUsers,
        activeUsers: alert.totalUsers - alert.affectedUsers,
        inactiveUsers: alert.affectedUsers,
        powerUsersAffected: alert.affectedUserDetails.filter((u) => u.isPowerUser).length,
      },
    },
    detected_at: alert.detectedAt.toISOString(),
    status: 'open',
    auto_detected: true,
    source: 'login_pattern_detector',
  });

  if (error) {
    console.error('[LoginPatternDetector] Failed to save risk signal:', error);
  }
}

/**
 * Get alert title based on type
 */
function getAlertTitle(
  alertType: LoginPatternAlertType,
  affectedUsers: number,
  changePercent: number
): string {
  switch (alertType) {
    case 'individual_downgrade':
      return 'User Login Frequency Downgrade';
    case 'individual_stopped':
      return 'User Stopped Logging In';
    case 'power_user_disengagement':
      return 'Power User Disengagement Detected';
    case 'account_level_decline':
      return `Account Login Decline: ${Math.abs(Math.round(changePercent))}%`;
    case 'bulk_downgrade':
      return `${affectedUsers} Users Changed Login Patterns`;
    default:
      return 'Login Pattern Change Detected';
  }
}

/**
 * Process alerts through the trigger engine
 */
async function processAlertsThroughTriggerEngine(
  alerts: LoginPatternAlert[],
  customerName: string
): Promise<void> {
  for (const alert of alerts) {
    const eventData: LoginPatternEventData = {
      alertType: alert.alertType,
      severity: alert.severity,
      affectedUsers: alert.affectedUsers,
      totalUsers: alert.totalUsers,
      changePercent: alert.changePercent,
      affectedUserDetails: alert.affectedUserDetails,
      accountMetrics: {
        previousAvgLoginsPerWeek: alert.previousAvgLoginsPerWeek,
        currentAvgLoginsPerWeek: alert.currentAvgLoginsPerWeek,
        changePercent: alert.changePercent,
        totalUsers: alert.totalUsers,
        activeUsers: alert.totalUsers - alert.affectedUsers,
        inactiveUsers: alert.affectedUsers,
        powerUsersAffected: alert.affectedUserDetails.filter((u) => u.isPowerUser).length,
      },
    };

    const event: CustomerEvent = {
      id: uuidv4(),
      type: 'login_pattern_change',
      customerId: alert.customerId,
      customerName,
      data: eventData,
      timestamp: alert.detectedAt,
      source: 'login_pattern_detector',
    };

    try {
      await triggerEngine.processEvent(event);
    } catch (err) {
      console.error(`[LoginPatternDetector] Trigger engine error for ${alert.customerId}:`, err);
    }
  }
}

// ============================================
// Slack Notification
// ============================================

/**
 * Send login pattern change alert to Slack
 */
export async function sendLoginPatternSlackAlert(
  alert: LoginPatternAlert,
  webhookUrl: string,
  customerArr?: number,
  customerHealthScore?: number
): Promise<boolean> {
  const severityEmoji: Record<LoginPatternAlertSeverity, string> = {
    critical: ':rotating_light:',
    high: ':warning:',
    medium: ':bell:',
    low: ':information_source:',
  };

  // Build key users affected message
  const keyUsersMessage = alert.affectedUserDetails
    .slice(0, 5)
    .map((user, i) => {
      const emoji = user.isPowerUser ? ':red_circle:' : ':orange_circle:';
      const roleStr = user.role ? ` (${user.role})` : '';
      const powerUserStr = user.isPowerUser ? ', Power User' : '';
      return `${i + 1}. ${emoji} ${user.name}${roleStr}${powerUserStr}\n   ${user.previousFrequency} -> ${user.currentFrequency} (last login: ${user.daysSinceLogin} days ago)`;
    })
    .join('\n\n');

  const alertTitle = getAlertTitle(alert.alertType, alert.affectedUsers, alert.changePercent);

  const params: SlackAlertParams = {
    type: 'risk_signal',
    title: `Login Pattern Change: ${alert.customerName}`,
    message: `*${alertTitle}*\n\n*Metrics:*\n- Previous: ${alert.previousAvgLoginsPerWeek.toFixed(1)} logins/week\n- Current: ${alert.currentAvgLoginsPerWeek.toFixed(1)} logins/week\n- Change: ${alert.changePercent}%\n\n*Key Users Affected:*\n${keyUsersMessage}`,
    customer: {
      id: alert.customerId,
      name: alert.customerName || 'Unknown',
      arr: customerArr || alert.accountContext.arr,
      healthScore: customerHealthScore || alert.accountContext.healthScore,
    },
    priority:
      alert.severity === 'critical'
        ? 'urgent'
        : alert.severity === 'high'
        ? 'high'
        : 'medium',
    actionUrl: `/customers/${alert.customerId}`,
    fields: {
      'Alert Type': alert.alertType.replace(/_/g, ' '),
      'Severity': alert.severity,
      'Affected Users': `${alert.affectedUsers}/${alert.totalUsers}`,
      'Login Change': `${alert.changePercent}%`,
      'Power Users Affected': alert.affectedUserDetails.filter((u) => u.isPowerUser).length,
    },
  };

  return await sendSlackAlert(webhookUrl, params);
}

// ============================================
// User Pattern Update
// ============================================

/**
 * Update login pattern for a specific user after login event
 */
export async function updateUserLoginPattern(
  customerId: string,
  userId: string,
  userEmail?: string,
  userName?: string,
  userRole?: string,
  isPowerUser?: boolean
): Promise<UserLoginPattern | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('update_user_login_pattern', {
    p_customer_id: customerId,
    p_user_id: userId,
    p_user_email: userEmail,
    p_user_name: userName,
    p_user_role: userRole,
    p_is_power_user: isPowerUser || false,
  });

  if (error) {
    console.error('[LoginPatternDetector] Error updating user pattern:', error);
    return null;
  }

  return data as UserLoginPattern;
}

/**
 * Get login patterns for a customer
 */
export async function getLoginPatternsForCustomer(
  customerId: string,
  options: {
    includeInactive?: boolean;
    powerUsersOnly?: boolean;
    limit?: number;
  } = {}
): Promise<UserLoginPattern[]> {
  if (!supabase) return [];

  let query = supabase
    .from('user_login_patterns')
    .select('*')
    .eq('customer_id', customerId)
    .order('last_login_at', { ascending: false });

  if (!options.includeInactive) {
    query = query.neq('current_frequency', 'inactive');
  }

  if (options.powerUsersOnly) {
    query = query.eq('is_power_user', true);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[LoginPatternDetector] Error fetching patterns:', error);
    return [];
  }

  return (data || []).map(mapDbPattern);
}

/**
 * Map database row to UserLoginPattern
 */
function mapDbPattern(row: any): UserLoginPattern {
  return {
    id: row.id,
    customerId: row.customer_id,
    userId: row.user_id,
    userEmail: row.user_email,
    userName: row.user_name,
    userRole: row.user_role,
    isPowerUser: row.is_power_user,
    historicalFrequency: row.historical_frequency,
    currentFrequency: row.current_frequency,
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : null,
    daysSinceLogin: row.days_since_login,
    loginCount30d: row.login_count_30d,
    loginCount7d: row.login_count_7d,
    patternChangedAt: row.pattern_changed_at ? new Date(row.pattern_changed_at) : null,
    patternChangeType: row.pattern_change_type,
    avgLoginsPerWeekHistorical: row.avg_logins_per_week_historical,
    avgLoginsPerWeekCurrent: row.avg_logins_per_week_current,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ============================================
// Exports
// ============================================

export default {
  detectLoginPatternsForCustomer,
  detectLoginPatternsForAllCustomers,
  sendLoginPatternSlackAlert,
  updateUserLoginPattern,
  getLoginPatternsForCustomer,
};
