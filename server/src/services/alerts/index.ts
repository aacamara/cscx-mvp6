/**
 * Intelligent Alert Filtering Service (PRD-221)
 *
 * Main service for alert processing, scoring, bundling, and feedback
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { scoreAlert, scoreAlerts } from './scorer.js';
import { bundleAlerts } from './bundler.js';
import {
  RawAlert,
  ScoredAlert,
  AlertBundle,
  AlertScore,
  AlertContext,
  AlertFeedback,
  AlertFeedbackType,
  AlertSuppression,
  AlertPreferences,
  AlertSummaryStats,
  GetAlertsRequest,
  GetAlertsResponse,
  AlertType,
  AlertStatus,
  DEFAULT_ALERT_PREFERENCES,
} from './types.js';

// ============================================
// Initialize Supabase
// ============================================

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// In-Memory Store (Fallback)
// ============================================

const alertStore: Map<string, ScoredAlert> = new Map();
const bundleStore: Map<string, AlertBundle> = new Map();
const feedbackStore: Map<string, AlertFeedback> = new Map();
const suppressionStore: Map<string, AlertSuppression> = new Map();
const preferencesStore: Map<string, AlertPreferences> = new Map();

// ============================================
// Alert Processing
// ============================================

/**
 * Process a raw alert: score it, store it, and return the scored version
 */
export async function processAlert(
  alert: RawAlert,
  userId: string
): Promise<ScoredAlert> {
  // Get context for scoring
  const context = await getAlertContext(alert.customerId, userId);

  // Get user preferences
  const preferences = await getAlertPreferences(userId);

  // Score the alert
  const score = scoreAlert(alert, context, preferences);

  // Create scored alert
  const scoredAlert: ScoredAlert = {
    ...alert,
    score,
    status: 'unread',
    userId,
  };

  // Store the alert
  await storeAlert(scoredAlert);

  return scoredAlert;
}

/**
 * Process multiple raw alerts at once
 */
export async function processAlerts(
  alerts: RawAlert[],
  userId: string
): Promise<ScoredAlert[]> {
  const results: ScoredAlert[] = [];

  for (const alert of alerts) {
    const scored = await processAlert(alert, userId);
    results.push(scored);
  }

  return results;
}

// ============================================
// Alert Retrieval
// ============================================

/**
 * Get alerts for a user with filtering and bundling options
 */
export async function getAlerts(
  userId: string,
  options: GetAlertsRequest = {}
): Promise<GetAlertsResponse> {
  const {
    format = 'bundled',
    minScore = 0,
    status,
    customerId,
    types,
    limit = 50,
    offset = 0,
  } = options;

  // Get all alerts for user
  let alerts = await fetchAlerts(userId, { customerId, types, limit: limit + offset });

  // Filter by score
  alerts = alerts.filter(a => a.score.finalScore >= minScore);

  // Filter by status if specified
  if (status) {
    alerts = alerts.filter(a => a.status === status);
  }

  // Calculate stats
  const suppressedCount = alerts.filter(a => a.score.deliveryRecommendation === 'suppress').length;
  const digestCount = alerts.filter(a => a.score.deliveryRecommendation === 'digest').length;

  // Apply pagination
  const paginatedAlerts = alerts.slice(offset, offset + limit);

  if (format === 'bundled') {
    // Bundle alerts
    const bundles = await bundleAlerts(paginatedAlerts);
    return {
      bundles,
      suppressedCount,
      digestCount,
      totalCount: alerts.length,
    };
  }

  return {
    alerts: paginatedAlerts,
    suppressedCount,
    digestCount,
    totalCount: alerts.length,
  };
}

/**
 * Get a single alert by ID
 */
export async function getAlertById(alertId: string): Promise<ScoredAlert | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('alert_scores')
      .select('*, raw_alerts(*)')
      .eq('id', alertId)
      .single();

    if (error || !data) return null;

    return transformDbAlert(data);
  }

  return alertStore.get(alertId) || null;
}

/**
 * Get a bundle by ID
 */
export async function getBundleById(bundleId: string): Promise<AlertBundle | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('alert_bundles')
      .select('*')
      .eq('id', bundleId)
      .single();

    if (error || !data) return null;

    // Get associated alerts
    const alertIds = data.alert_ids || [];
    const alerts: ScoredAlert[] = [];
    for (const id of alertIds) {
      const alert = await getAlertById(id);
      if (alert) alerts.push(alert);
    }

    return {
      bundleId: data.id,
      customerId: data.customer_id,
      customerName: data.customer_name || 'Unknown',
      alerts,
      bundleScore: data.bundle_score,
      title: data.title,
      summary: data.summary,
      recommendedAction: data.recommended_action,
      alertCount: alerts.length,
      createdAt: new Date(data.created_at),
      status: data.status || 'unread',
    };
  }

  return bundleStore.get(bundleId) || null;
}

// ============================================
// Alert Status Updates
// ============================================

/**
 * Mark alert(s) as read
 */
export async function markAlertsAsRead(alertIds: string[]): Promise<boolean> {
  if (supabase) {
    const { error } = await supabase
      .from('alert_scores')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .in('id', alertIds);

    return !error;
  }

  for (const id of alertIds) {
    const alert = alertStore.get(id);
    if (alert) {
      alert.status = 'read';
      alert.readAt = new Date();
      alertStore.set(id, alert);
    }
  }

  return true;
}

/**
 * Mark bundle as read
 */
export async function markBundleAsRead(bundleId: string): Promise<boolean> {
  if (supabase) {
    const { error } = await supabase
      .from('alert_bundles')
      .update({ status: 'read' })
      .eq('id', bundleId);

    if (error) return false;

    // Also mark contained alerts
    const bundle = await getBundleById(bundleId);
    if (bundle) {
      await markAlertsAsRead(bundle.alerts.map(a => a.id));
    }

    return true;
  }

  const bundle = bundleStore.get(bundleId);
  if (bundle) {
    bundle.status = 'read';
    bundleStore.set(bundleId, bundle);
    for (const alert of bundle.alerts) {
      alert.status = 'read';
      alert.readAt = new Date();
      alertStore.set(alert.id, alert);
    }
  }

  return true;
}

/**
 * Snooze an alert
 */
export async function snoozeAlert(alertId: string, snoozeUntil: Date): Promise<boolean> {
  if (supabase) {
    const { error } = await supabase
      .from('alert_scores')
      .update({ status: 'snoozed', snooze_until: snoozeUntil.toISOString() })
      .eq('id', alertId);

    return !error;
  }

  const alert = alertStore.get(alertId);
  if (alert) {
    alert.status = 'snoozed';
    alert.snoozeUntil = snoozeUntil;
    alertStore.set(alertId, alert);
  }

  return true;
}

/**
 * Dismiss an alert
 */
export async function dismissAlert(alertId: string): Promise<boolean> {
  if (supabase) {
    const { error } = await supabase
      .from('alert_scores')
      .update({ status: 'dismissed' })
      .eq('id', alertId);

    return !error;
  }

  const alert = alertStore.get(alertId);
  if (alert) {
    alert.status = 'dismissed';
    alertStore.set(alertId, alert);
  }

  return true;
}

// ============================================
// Feedback System
// ============================================

/**
 * Submit feedback on an alert
 */
export async function submitFeedback(
  alertId: string,
  userId: string,
  feedback: AlertFeedbackType,
  notes?: string
): Promise<AlertFeedback> {
  const feedbackRecord: AlertFeedback = {
    id: uuidv4(),
    alertId,
    userId,
    feedback,
    notes,
    createdAt: new Date(),
  };

  if (supabase) {
    await supabase.from('alert_feedback').insert({
      id: feedbackRecord.id,
      alert_id: alertId,
      user_id: userId,
      feedback,
      notes,
      created_at: feedbackRecord.createdAt.toISOString(),
    });
  } else {
    feedbackStore.set(feedbackRecord.id, feedbackRecord);
  }

  return feedbackRecord;
}

/**
 * Get feedback stats for learning
 */
export async function getFeedbackStats(
  alertType?: AlertType,
  days: number = 30
): Promise<{
  helpful: number;
  notHelpful: number;
  alreadyKnew: number;
  falsePositive: number;
  total: number;
}> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  if (supabase) {
    let query = supabase
      .from('alert_feedback')
      .select('feedback')
      .gte('created_at', cutoff.toISOString());

    if (alertType) {
      query = query.eq('alert_type', alertType);
    }

    const { data } = await query;

    const stats = {
      helpful: 0,
      notHelpful: 0,
      alreadyKnew: 0,
      falsePositive: 0,
      total: 0,
    };

    if (data) {
      for (const row of data) {
        stats.total++;
        if (row.feedback === 'helpful') stats.helpful++;
        if (row.feedback === 'not_helpful') stats.notHelpful++;
        if (row.feedback === 'already_knew') stats.alreadyKnew++;
        if (row.feedback === 'false_positive') stats.falsePositive++;
      }
    }

    return stats;
  }

  // In-memory fallback
  const stats = {
    helpful: 0,
    notHelpful: 0,
    alreadyKnew: 0,
    falsePositive: 0,
    total: 0,
  };

  for (const fb of feedbackStore.values()) {
    if (fb.createdAt >= cutoff) {
      stats.total++;
      if (fb.feedback === 'helpful') stats.helpful++;
      if (fb.feedback === 'not_helpful') stats.notHelpful++;
      if (fb.feedback === 'already_knew') stats.alreadyKnew++;
      if (fb.feedback === 'false_positive') stats.falsePositive++;
    }
  }

  return stats;
}

// ============================================
// Suppression Rules
// ============================================

/**
 * Create a suppression rule
 */
export async function createSuppression(
  suppression: Omit<AlertSuppression, 'id' | 'createdAt'>
): Promise<AlertSuppression> {
  const record: AlertSuppression = {
    ...suppression,
    id: uuidv4(),
    createdAt: new Date(),
  };

  if (supabase) {
    await supabase.from('alert_suppressions').insert({
      id: record.id,
      user_id: record.userId,
      suppression_type: record.suppressionType,
      customer_id: record.customerId,
      alert_type: record.alertType,
      reason: record.reason,
      expires_at: record.expiresAt?.toISOString(),
      created_at: record.createdAt.toISOString(),
    });
  } else {
    suppressionStore.set(record.id, record);
  }

  return record;
}

/**
 * Get active suppressions for a user
 */
export async function getSuppressions(userId: string): Promise<AlertSuppression[]> {
  const now = new Date();

  if (supabase) {
    const { data } = await supabase
      .from('alert_suppressions')
      .select('*')
      .eq('user_id', userId)
      .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`);

    return (data || []).map(s => ({
      id: s.id,
      userId: s.user_id,
      suppressionType: s.suppression_type,
      customerId: s.customer_id,
      alertType: s.alert_type,
      reason: s.reason,
      expiresAt: s.expires_at ? new Date(s.expires_at) : undefined,
      createdAt: new Date(s.created_at),
    }));
  }

  return Array.from(suppressionStore.values()).filter(
    s => s.userId === userId && (!s.expiresAt || s.expiresAt > now)
  );
}

/**
 * Delete a suppression rule
 */
export async function deleteSuppression(suppressionId: string): Promise<boolean> {
  if (supabase) {
    const { error } = await supabase
      .from('alert_suppressions')
      .delete()
      .eq('id', suppressionId);

    return !error;
  }

  return suppressionStore.delete(suppressionId);
}

// ============================================
// Preferences
// ============================================

/**
 * Get user alert preferences
 */
export async function getAlertPreferences(userId: string): Promise<AlertPreferences> {
  if (supabase) {
    const { data } = await supabase
      .from('alert_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (data) {
      return {
        userId: data.user_id,
        immediateThreshold: data.immediate_threshold ?? DEFAULT_ALERT_PREFERENCES.immediateThreshold,
        digestThreshold: data.digest_threshold ?? DEFAULT_ALERT_PREFERENCES.digestThreshold,
        suppressThreshold: data.suppress_threshold ?? DEFAULT_ALERT_PREFERENCES.suppressThreshold,
        quietHoursEnabled: data.quiet_hours_enabled ?? DEFAULT_ALERT_PREFERENCES.quietHoursEnabled,
        quietHoursStart: data.quiet_hours_start ?? DEFAULT_ALERT_PREFERENCES.quietHoursStart,
        quietHoursEnd: data.quiet_hours_end ?? DEFAULT_ALERT_PREFERENCES.quietHoursEnd,
        allowCriticalDuringQuiet: data.allow_critical_during_quiet ?? DEFAULT_ALERT_PREFERENCES.allowCriticalDuringQuiet,
        criticalThreshold: data.critical_threshold ?? DEFAULT_ALERT_PREFERENCES.criticalThreshold,
        filterMinorHealthChanges: data.filter_minor_health_changes ?? DEFAULT_ALERT_PREFERENCES.filterMinorHealthChanges,
        minorHealthChangeThreshold: data.minor_health_change_threshold ?? DEFAULT_ALERT_PREFERENCES.minorHealthChangeThreshold,
        filterSeasonalPatterns: data.filter_seasonal_patterns ?? DEFAULT_ALERT_PREFERENCES.filterSeasonalPatterns,
        filterActivePlaybooks: data.filter_active_playbooks ?? DEFAULT_ALERT_PREFERENCES.filterActivePlaybooks,
        updatedAt: new Date(data.updated_at),
      };
    }
  }

  const stored = preferencesStore.get(userId);
  if (stored) return stored;

  return {
    ...DEFAULT_ALERT_PREFERENCES,
    userId,
  };
}

/**
 * Update user alert preferences
 */
export async function updateAlertPreferences(
  userId: string,
  updates: Partial<Omit<AlertPreferences, 'userId' | 'updatedAt'>>
): Promise<AlertPreferences> {
  const current = await getAlertPreferences(userId);
  const updated: AlertPreferences = {
    ...current,
    ...updates,
    userId,
    updatedAt: new Date(),
  };

  if (supabase) {
    await supabase.from('alert_preferences').upsert({
      user_id: userId,
      immediate_threshold: updated.immediateThreshold,
      digest_threshold: updated.digestThreshold,
      suppress_threshold: updated.suppressThreshold,
      quiet_hours_enabled: updated.quietHoursEnabled,
      quiet_hours_start: updated.quietHoursStart,
      quiet_hours_end: updated.quietHoursEnd,
      allow_critical_during_quiet: updated.allowCriticalDuringQuiet,
      critical_threshold: updated.criticalThreshold,
      filter_minor_health_changes: updated.filterMinorHealthChanges,
      minor_health_change_threshold: updated.minorHealthChangeThreshold,
      filter_seasonal_patterns: updated.filterSeasonalPatterns,
      filter_active_playbooks: updated.filterActivePlaybooks,
      updated_at: updated.updatedAt.toISOString(),
    });
  } else {
    preferencesStore.set(userId, updated);
  }

  return updated;
}

// ============================================
// Summary Statistics
// ============================================

/**
 * Get alert summary statistics
 */
export async function getAlertStats(
  userId: string,
  days: number = 7
): Promise<AlertSummaryStats> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const alerts = await fetchAlerts(userId, {});

  const recentAlerts = alerts.filter(a => a.createdAt >= cutoff);

  const byType: Record<AlertType, number> = {} as Record<AlertType, number>;
  const byCustomer: Record<string, number> = {};
  let totalScore = 0;

  for (const alert of recentAlerts) {
    byType[alert.type] = (byType[alert.type] || 0) + 1;
    byCustomer[alert.customerId] = (byCustomer[alert.customerId] || 0) + 1;
    totalScore += alert.score.finalScore;
  }

  const feedbackStats = await getFeedbackStats(undefined, days);

  return {
    totalAlerts: recentAlerts.length,
    priorityCount: recentAlerts.filter(a => a.score.deliveryRecommendation === 'immediate').length,
    digestCount: recentAlerts.filter(a => a.score.deliveryRecommendation === 'digest').length,
    suppressedCount: recentAlerts.filter(a => a.score.deliveryRecommendation === 'suppress').length,
    byType,
    byCustomer,
    averageScore: recentAlerts.length > 0 ? Math.round(totalScore / recentAlerts.length) : 0,
    feedbackStats,
  };
}

// ============================================
// Helper Functions
// ============================================

async function getAlertContext(customerId: string, userId: string): Promise<AlertContext> {
  // Fetch customer data
  let customer = {
    id: customerId,
    name: 'Unknown Customer',
    arr: 50000,
    healthScore: 70,
    status: 'active' as const,
    daysToRenewal: undefined as number | undefined,
  };

  if (supabase) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (data) {
      customer = {
        id: data.id,
        name: data.name,
        arr: data.arr || 50000,
        healthScore: data.health_score || 70,
        status: data.stage || 'active',
        daysToRenewal: data.renewal_date
          ? Math.ceil((new Date(data.renewal_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
          : undefined,
      };
    }
  }

  // Get recent alerts for this customer
  const recentAlerts = await fetchAlerts(userId, { customerId, limit: 10 });

  // Check for active save plays/playbooks
  let hasActiveSavePlay = false;
  let activePlaybooks: string[] = [];

  if (supabase) {
    const { data: playbooks } = await supabase
      .from('playbook_executions')
      .select('playbook_id, playbook_name')
      .eq('customer_id', customerId)
      .eq('status', 'active');

    if (playbooks) {
      activePlaybooks = playbooks.map(p => p.playbook_name);
      hasActiveSavePlay = playbooks.some(p =>
        p.playbook_name?.toLowerCase().includes('save') ||
        p.playbook_name?.toLowerCase().includes('rescue')
      );
    }
  }

  return {
    customer,
    recentAlerts,
    activePlaybooks,
    hasActiveSavePlay,
    seasonalPatterns: [], // Could be loaded from historical data
  };
}

async function storeAlert(alert: ScoredAlert): Promise<void> {
  if (supabase) {
    // Store raw alert
    await supabase.from('raw_alerts').insert({
      id: alert.id,
      type: alert.type,
      customer_id: alert.customerId,
      customer_name: alert.customerName,
      title: alert.title,
      description: alert.description,
      metric_change: alert.metricChange,
      metadata: alert.metadata,
      source: alert.source,
      created_at: alert.createdAt.toISOString(),
    });

    // Store score
    await supabase.from('alert_scores').insert({
      id: uuidv4(),
      raw_alert_id: alert.id,
      user_id: alert.userId,
      impact_score: alert.score.impactScore,
      urgency_score: alert.score.urgencyScore,
      confidence_score: alert.score.confidenceScore,
      final_score: alert.score.finalScore,
      factors: alert.score.factors,
      delivery_recommendation: alert.score.deliveryRecommendation,
      filtered: alert.score.filtered,
      filter_reason: alert.score.filterReason,
      status: alert.status,
      calculated_at: new Date().toISOString(),
    });
  } else {
    alertStore.set(alert.id, alert);
  }
}

async function fetchAlerts(
  userId: string,
  options: { customerId?: string; types?: AlertType[]; limit?: number }
): Promise<ScoredAlert[]> {
  const { customerId, types, limit = 100 } = options;

  if (supabase) {
    let query = supabase
      .from('alert_scores')
      .select('*, raw_alerts(*)')
      .eq('user_id', userId)
      .order('calculated_at', { ascending: false })
      .limit(limit);

    if (customerId) {
      query = query.eq('raw_alerts.customer_id', customerId);
    }

    const { data } = await query;

    if (data) {
      return data
        .filter(d => d.raw_alerts)
        .map(d => transformDbAlert(d));
    }

    return [];
  }

  // In-memory fallback
  let results = Array.from(alertStore.values()).filter(a => a.userId === userId);

  if (customerId) {
    results = results.filter(a => a.customerId === customerId);
  }

  if (types && types.length > 0) {
    results = results.filter(a => types.includes(a.type));
  }

  return results
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

function transformDbAlert(data: any): ScoredAlert {
  const rawAlert = data.raw_alerts || data;

  return {
    id: rawAlert.id,
    type: rawAlert.type,
    customerId: rawAlert.customer_id,
    customerName: rawAlert.customer_name,
    title: rawAlert.title,
    description: rawAlert.description,
    metricChange: rawAlert.metric_change,
    metadata: rawAlert.metadata,
    source: rawAlert.source,
    createdAt: new Date(rawAlert.created_at),
    score: {
      rawAlertId: rawAlert.id,
      impactScore: data.impact_score,
      urgencyScore: data.urgency_score,
      confidenceScore: data.confidence_score,
      finalScore: data.final_score,
      factors: data.factors || [],
      deliveryRecommendation: data.delivery_recommendation,
      filtered: data.filtered,
      filterReason: data.filter_reason,
    },
    status: data.status || 'unread',
    userId: data.user_id,
    readAt: data.read_at ? new Date(data.read_at) : undefined,
    snoozeUntil: data.snooze_until ? new Date(data.snooze_until) : undefined,
  };
}

// ============================================
// Exports
// ============================================

export * from './types.js';
export { scoreAlert, scoreAlerts } from './scorer.js';
export { bundleAlerts } from './bundler.js';

export default {
  processAlert,
  processAlerts,
  getAlerts,
  getAlertById,
  getBundleById,
  markAlertsAsRead,
  markBundleAsRead,
  snoozeAlert,
  dismissAlert,
  submitFeedback,
  getFeedbackStats,
  createSuppression,
  getSuppressions,
  deleteSuppression,
  getAlertPreferences,
  updateAlertPreferences,
  getAlertStats,
};
