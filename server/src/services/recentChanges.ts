/**
 * Recent Changes Service
 * PRD-073: Change detection and alerting for customer accounts
 *
 * Features:
 * - Real-time change detection across multiple data sources
 * - Severity classification and alert routing
 * - Change correlation analysis
 * - Alert preferences management
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { v4 as uuidv4 } from 'uuid';

// Types
interface AccountChange {
  id: string;
  customerId: string;
  customerName: string;
  changeType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  sentiment: 'positive' | 'negative' | 'neutral';
  title: string;
  description: string;
  previousValue: string | number | null;
  newValue: string | number | null;
  changePercent: number | null;
  detectedAt: string;
  source: string;
  relatedEntity: string | null;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  actionTaken: string | null;
}

interface ChangeSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  unacknowledged: number;
}

interface ChangeTrend {
  week: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  netSentiment: 'positive' | 'negative' | 'neutral';
}

interface ChangeCorrelation {
  sequence: Array<{
    changeType: string;
    date: string;
    description: string;
  }>;
  hypothesis: string;
  recommendation: string;
}

interface AlertPreferences {
  customerId: string;
  healthDrop: { enabled: boolean; threshold: number; channels: string[] };
  usageChange: { enabled: boolean; threshold: number; channels: string[] };
  championActivity: { enabled: boolean; threshold: number; channels: string[] };
  supportTickets: { enabled: boolean; threshold: number; channels: string[] };
  renewalReminder: { enabled: boolean; threshold: number; channels: string[] };
}

interface GetChangesParams {
  customerId: string;
  period?: '7d' | '14d' | '30d' | '90d';
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'all';
  acknowledged?: boolean;
  changeTypes?: string[];
}

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// In-memory storage for development
const changesStore = new Map<string, AccountChange[]>();
const preferencesStore = new Map<string, AlertPreferences>();

/**
 * Get period in days from period string
 */
function getPeriodDays(period: string): number {
  const match = period.match(/(\d+)d/);
  return match ? parseInt(match[1]) : 7;
}

/**
 * Calculate date range for period
 */
function getDateRange(period: string): { start: Date; end: Date } {
  const days = getPeriodDays(period);
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Get customer name by ID
 */
async function getCustomerName(customerId: string): Promise<string> {
  if (supabase) {
    const { data } = await supabase
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .single();
    return data?.name || 'Unknown Customer';
  }
  return 'Unknown Customer';
}

/**
 * Detect health score changes
 */
async function detectHealthScoreChanges(customerId: string, period: string): Promise<AccountChange[]> {
  const changes: AccountChange[] = [];
  const { start, end } = getDateRange(period);

  if (supabase) {
    try {
      // Get health score history
      const { data: history } = await supabase
        .from('health_score_history')
        .select('*')
        .eq('customer_id', customerId)
        .gte('recorded_at', start.toISOString())
        .lte('recorded_at', end.toISOString())
        .order('recorded_at', { ascending: false });

      if (history && history.length >= 2) {
        const current = history[0];
        const previous = history[history.length - 1];
        const change = current.score - previous.score;

        if (Math.abs(change) >= 5) {
          const customerName = await getCustomerName(customerId);
          const severity = Math.abs(change) >= 20 ? 'critical' :
                          Math.abs(change) >= 10 ? 'high' : 'medium';

          changes.push({
            id: uuidv4(),
            customerId,
            customerName,
            changeType: change < 0 ? 'health_score_drop' : 'health_score_improvement',
            severity,
            sentiment: change < 0 ? 'negative' : 'positive',
            title: change < 0 ? 'Health Score Drop' : 'Health Score Improvement',
            description: `Health score changed from ${previous.score} to ${current.score} (${change > 0 ? '+' : ''}${change} points)`,
            previousValue: previous.score,
            newValue: current.score,
            changePercent: Math.abs(change),
            detectedAt: current.recorded_at,
            source: 'health_score_history',
            relatedEntity: null,
            acknowledged: false,
            acknowledgedBy: null,
            acknowledgedAt: null,
            actionTaken: null,
          });
        }
      }
    } catch (error) {
      console.error('[RecentChanges] Error detecting health score changes:', error);
    }
  }

  return changes;
}

/**
 * Detect usage pattern changes
 */
async function detectUsageChanges(customerId: string, period: string): Promise<AccountChange[]> {
  const changes: AccountChange[] = [];
  const { start, end } = getDateRange(period);

  if (supabase) {
    try {
      // Get usage events aggregated by day
      const { data: recentUsage } = await supabase
        .from('usage_events')
        .select('*')
        .eq('customer_id', customerId)
        .gte('timestamp', start.toISOString())
        .lte('timestamp', end.toISOString());

      // Get previous period for comparison
      const prevStart = new Date(start.getTime() - getPeriodDays(period) * 24 * 60 * 60 * 1000);
      const { data: previousUsage } = await supabase
        .from('usage_events')
        .select('*')
        .eq('customer_id', customerId)
        .gte('timestamp', prevStart.toISOString())
        .lt('timestamp', start.toISOString());

      const recentCount = recentUsage?.length || 0;
      const previousCount = previousUsage?.length || 1;
      const changePercent = ((recentCount - previousCount) / previousCount) * 100;

      if (Math.abs(changePercent) >= 20) {
        const customerName = await getCustomerName(customerId);
        const isDropping = changePercent < 0;

        changes.push({
          id: uuidv4(),
          customerId,
          customerName,
          changeType: isDropping ? 'usage_drop' : 'usage_spike',
          severity: Math.abs(changePercent) >= 40 ? 'critical' :
                   Math.abs(changePercent) >= 30 ? 'high' : 'medium',
          sentiment: isDropping ? 'negative' : 'positive',
          title: isDropping ? 'Usage Drop Detected' : 'Usage Spike Detected',
          description: `Usage ${isDropping ? 'decreased' : 'increased'} by ${Math.abs(Math.round(changePercent))}% compared to previous period`,
          previousValue: previousCount,
          newValue: recentCount,
          changePercent: Math.round(changePercent),
          detectedAt: new Date().toISOString(),
          source: 'usage_events',
          relatedEntity: null,
          acknowledged: false,
          acknowledgedBy: null,
          acknowledgedAt: null,
          actionTaken: null,
        });
      }

      // Check for no login
      if (recentUsage && recentUsage.length === 0 && previousUsage && previousUsage.length > 0) {
        const lastActivity = previousUsage[0];
        const daysSince = Math.floor((new Date().getTime() - new Date(lastActivity.timestamp).getTime()) / (24 * 60 * 60 * 1000));

        if (daysSince >= 14) {
          const customerName = await getCustomerName(customerId);
          changes.push({
            id: uuidv4(),
            customerId,
            customerName,
            changeType: 'no_login',
            severity: daysSince >= 30 ? 'high' : 'medium',
            sentiment: 'negative',
            title: 'No Recent Activity',
            description: `No activity detected for ${daysSince} days`,
            previousValue: lastActivity.timestamp,
            newValue: null,
            changePercent: null,
            detectedAt: new Date().toISOString(),
            source: 'usage_events',
            relatedEntity: null,
            acknowledged: false,
            acknowledgedBy: null,
            acknowledgedAt: null,
            actionTaken: null,
          });
        }
      }
    } catch (error) {
      console.error('[RecentChanges] Error detecting usage changes:', error);
    }
  }

  return changes;
}

/**
 * Detect stakeholder changes
 */
async function detectStakeholderChanges(customerId: string, period: string): Promise<AccountChange[]> {
  const changes: AccountChange[] = [];
  const { start } = getDateRange(period);

  if (supabase) {
    try {
      // Check for stakeholder changes in activity log
      const { data: activities } = await supabase
        .from('agent_activity_log')
        .select('*')
        .eq('customer_id', customerId)
        .in('action_type', ['stakeholder_departed', 'stakeholder_added', 'contact_updated'])
        .gte('started_at', start.toISOString());

      if (activities) {
        const customerName = await getCustomerName(customerId);
        for (const activity of activities) {
          const isChampion = activity.action_data?.role?.toLowerCase().includes('champion');
          const isExec = activity.action_data?.role?.toLowerCase().includes('exec') ||
                        activity.action_data?.role?.toLowerCase().includes('vp') ||
                        activity.action_data?.role?.toLowerCase().includes('director');

          if (activity.action_type === 'stakeholder_departed') {
            changes.push({
              id: uuidv4(),
              customerId,
              customerName,
              changeType: isChampion ? 'champion_departed' : 'exec_sponsor_change',
              severity: isChampion ? 'critical' : 'high',
              sentiment: 'negative',
              title: isChampion ? 'Champion Departed' : 'Executive Sponsor Change',
              description: `${activity.action_data?.name || 'Stakeholder'} (${activity.action_data?.role || 'Unknown role'}) has left the organization`,
              previousValue: activity.action_data?.name || null,
              newValue: null,
              changePercent: null,
              detectedAt: activity.started_at,
              source: 'stakeholders',
              relatedEntity: activity.action_data?.name || null,
              acknowledged: false,
              acknowledgedBy: null,
              acknowledgedAt: null,
              actionTaken: null,
            });
          } else if (activity.action_type === 'stakeholder_added' && isExec) {
            changes.push({
              id: uuidv4(),
              customerId,
              customerName,
              changeType: 'new_decision_maker',
              severity: 'medium',
              sentiment: 'neutral',
              title: 'New Decision Maker Added',
              description: `${activity.action_data?.name || 'New stakeholder'} joined as ${activity.action_data?.role || 'unknown role'}`,
              previousValue: null,
              newValue: activity.action_data?.name || null,
              changePercent: null,
              detectedAt: activity.started_at,
              source: 'stakeholders',
              relatedEntity: activity.action_data?.name || null,
              acknowledged: false,
              acknowledgedBy: null,
              acknowledgedAt: null,
              actionTaken: null,
            });
          }
        }
      }
    } catch (error) {
      console.error('[RecentChanges] Error detecting stakeholder changes:', error);
    }
  }

  return changes;
}

/**
 * Detect contract and renewal changes
 */
async function detectContractChanges(customerId: string, period: string): Promise<AccountChange[]> {
  const changes: AccountChange[] = [];

  if (supabase) {
    try {
      // Get customer renewal date
      const { data: customer } = await supabase
        .from('customers')
        .select('name, renewal_date, arr')
        .eq('id', customerId)
        .single();

      if (customer?.renewal_date) {
        const renewalDate = new Date(customer.renewal_date);
        const now = new Date();
        const daysUntilRenewal = Math.ceil((renewalDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

        if (daysUntilRenewal > 0 && daysUntilRenewal <= 90) {
          const severity = daysUntilRenewal <= 30 ? 'critical' :
                          daysUntilRenewal <= 60 ? 'high' : 'medium';

          changes.push({
            id: uuidv4(),
            customerId,
            customerName: customer.name,
            changeType: 'renewal_approaching',
            severity,
            sentiment: 'neutral',
            title: 'Renewal Approaching',
            description: `Renewal in ${daysUntilRenewal} days (${renewalDate.toLocaleDateString()})`,
            previousValue: null,
            newValue: daysUntilRenewal,
            changePercent: null,
            detectedAt: new Date().toISOString(),
            source: 'contracts',
            relatedEntity: null,
            acknowledged: false,
            acknowledgedBy: null,
            acknowledgedAt: null,
            actionTaken: null,
          });
        }
      }
    } catch (error) {
      console.error('[RecentChanges] Error detecting contract changes:', error);
    }
  }

  return changes;
}

/**
 * Detect support ticket changes
 */
async function detectSupportChanges(customerId: string, period: string): Promise<AccountChange[]> {
  const changes: AccountChange[] = [];
  const { start, end } = getDateRange(period);

  if (supabase) {
    try {
      // Get support ticket activity
      const { data: tickets } = await supabase
        .from('agent_activity_log')
        .select('*')
        .eq('customer_id', customerId)
        .eq('action_type', 'support_ticket')
        .gte('started_at', start.toISOString())
        .lte('started_at', end.toISOString());

      // Get previous period tickets
      const prevStart = new Date(start.getTime() - getPeriodDays(period) * 24 * 60 * 60 * 1000);
      const { data: previousTickets } = await supabase
        .from('agent_activity_log')
        .select('*')
        .eq('customer_id', customerId)
        .eq('action_type', 'support_ticket')
        .gte('started_at', prevStart.toISOString())
        .lt('started_at', start.toISOString());

      const currentCount = tickets?.length || 0;
      const previousCount = previousTickets?.length || 0;

      // Check for ticket spike (more than 2x increase)
      if (currentCount >= 2 && currentCount > previousCount * 2) {
        const customerName = await getCustomerName(customerId);
        changes.push({
          id: uuidv4(),
          customerId,
          customerName,
          changeType: 'support_ticket_spike',
          severity: currentCount >= 5 ? 'high' : 'medium',
          sentiment: 'negative',
          title: 'Support Ticket Spike',
          description: `${currentCount} tickets opened in this period (vs ${previousCount} previously)`,
          previousValue: previousCount,
          newValue: currentCount,
          changePercent: previousCount > 0 ? Math.round(((currentCount - previousCount) / previousCount) * 100) : 100,
          detectedAt: new Date().toISOString(),
          source: 'support',
          relatedEntity: null,
          acknowledged: false,
          acknowledgedBy: null,
          acknowledgedAt: null,
          actionTaken: null,
        });
      }
    } catch (error) {
      console.error('[RecentChanges] Error detecting support changes:', error);
    }
  }

  return changes;
}

/**
 * Aggregate all changes and detect patterns
 */
async function detectAllChanges(customerId: string, period: string = '7d'): Promise<AccountChange[]> {
  const allChanges: AccountChange[] = [];

  // Run all detectors in parallel
  const [
    healthChanges,
    usageChanges,
    stakeholderChanges,
    contractChanges,
    supportChanges,
  ] = await Promise.all([
    detectHealthScoreChanges(customerId, period),
    detectUsageChanges(customerId, period),
    detectStakeholderChanges(customerId, period),
    detectContractChanges(customerId, period),
    detectSupportChanges(customerId, period),
  ]);

  allChanges.push(
    ...healthChanges,
    ...usageChanges,
    ...stakeholderChanges,
    ...contractChanges,
    ...supportChanges
  );

  // Sort by severity (critical first) and then by date (newest first)
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  allChanges.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
  });

  return allChanges;
}

/**
 * Generate change summary statistics
 */
function generateSummary(changes: AccountChange[]): ChangeSummary {
  return {
    critical: changes.filter(c => c.severity === 'critical').length,
    high: changes.filter(c => c.severity === 'high').length,
    medium: changes.filter(c => c.severity === 'medium').length,
    low: changes.filter(c => c.severity === 'low').length,
    total: changes.length,
    unacknowledged: changes.filter(c => !c.acknowledged).length,
  };
}

/**
 * Generate trend data for changes over time
 */
function generateTrends(changes: AccountChange[], period: string): ChangeTrend[] {
  const trends: ChangeTrend[] = [];
  const days = getPeriodDays(period);
  const weeksCount = Math.ceil(days / 7);

  for (let i = 0; i < weeksCount; i++) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() - i * 7);

    const weekChanges = changes.filter(c => {
      const date = new Date(c.detectedAt);
      return date >= weekStart && date < weekEnd;
    });

    const positive = weekChanges.filter(c => c.sentiment === 'positive').length;
    const negative = weekChanges.filter(c => c.sentiment === 'negative').length;

    trends.unshift({
      week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
            '-' +
            weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      critical: weekChanges.filter(c => c.severity === 'critical').length,
      high: weekChanges.filter(c => c.severity === 'high').length,
      medium: weekChanges.filter(c => c.severity === 'medium').length,
      low: weekChanges.filter(c => c.severity === 'low').length,
      netSentiment: positive > negative ? 'positive' : negative > positive ? 'negative' : 'neutral',
    });
  }

  return trends;
}

/**
 * Analyze change correlations to find patterns
 */
function analyzeCorrelations(changes: AccountChange[]): ChangeCorrelation | null {
  if (changes.length < 2) return null;

  // Sort changes chronologically
  const sortedChanges = [...changes].sort(
    (a, b) => new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime()
  );

  // Look for common patterns
  const negativeChanges = sortedChanges.filter(c => c.sentiment === 'negative');
  if (negativeChanges.length < 2) return null;

  // Check for cascading issues
  const hasChampionIssue = negativeChanges.some(c =>
    c.changeType === 'champion_departed' || c.changeType === 'no_login'
  );
  const hasUsageIssue = negativeChanges.some(c =>
    c.changeType === 'usage_drop' || c.changeType === 'feature_abandoned'
  );
  const hasSupportIssue = negativeChanges.some(c =>
    c.changeType === 'support_ticket_spike'
  );
  const hasHealthIssue = negativeChanges.some(c =>
    c.changeType === 'health_score_drop'
  );

  let hypothesis = '';
  let recommendation = '';

  if (hasChampionIssue && (hasUsageIssue || hasHealthIssue)) {
    hypothesis = 'Champion may be disengaged or facing internal challenges. Loss of champion attention often precedes usage decline and health score drops.';
    recommendation = 'Recommend direct outreach to verify champion status and identify new internal advocates.';
  } else if (hasSupportIssue && hasUsageIssue) {
    hypothesis = 'Product issues may be causing both increased support tickets and reduced usage. Users may be abandoning features due to problems.';
    recommendation = 'Review support tickets for root cause and prioritize product fixes to restore confidence.';
  } else if (hasUsageIssue && hasHealthIssue) {
    hypothesis = 'Declining engagement is impacting overall account health. This could indicate loss of value perception or competitive pressure.';
    recommendation = 'Schedule executive check-in to understand strategic priorities and re-establish value proposition.';
  }

  if (!hypothesis) return null;

  return {
    sequence: negativeChanges.slice(0, 5).map(c => ({
      changeType: c.changeType,
      date: new Date(c.detectedAt).toLocaleDateString(),
      description: c.description,
    })),
    hypothesis,
    recommendation,
  };
}

/**
 * Get default alert preferences
 */
function getDefaultPreferences(customerId: string): AlertPreferences {
  return {
    customerId,
    healthDrop: { enabled: true, threshold: 10, channels: ['push', 'slack'] },
    usageChange: { enabled: true, threshold: 20, channels: ['in_app'] },
    championActivity: { enabled: true, threshold: 14, channels: ['push'] },
    supportTickets: { enabled: true, threshold: 3, channels: ['slack'] },
    renewalReminder: { enabled: true, threshold: 90, channels: ['push', 'email'] },
  };
}

// ============================================
// Public Service API
// ============================================

export const recentChangesService = {
  /**
   * Get recent changes for a customer
   */
  async getChanges(params: GetChangesParams) {
    const {
      customerId,
      period = '7d',
      severity = 'all',
      acknowledged,
      changeTypes,
    } = params;

    console.log(`[RecentChanges] Fetching changes for customer ${customerId}, period: ${period}`);

    // Detect all changes
    let changes = await detectAllChanges(customerId, period);

    // Apply filters
    if (severity !== 'all') {
      changes = changes.filter(c => c.severity === severity);
    }

    if (acknowledged !== undefined) {
      changes = changes.filter(c => c.acknowledged === acknowledged);
    }

    if (changeTypes && changeTypes.length > 0) {
      changes = changes.filter(c => changeTypes.includes(c.changeType));
    }

    // Store changes for later reference
    changesStore.set(customerId, changes);

    // Generate response
    const summary = generateSummary(changes);
    const trends = generateTrends(changes, period);
    const correlations = analyzeCorrelations(changes);
    const alertPreferences = preferencesStore.get(customerId) || getDefaultPreferences(customerId);

    console.log(`[RecentChanges] Found ${changes.length} changes for customer ${customerId}`);

    return {
      summary,
      changes,
      trends,
      correlations,
      alertPreferences,
    };
  },

  /**
   * Acknowledge a change
   */
  async acknowledgeChange(
    changeId: string,
    acknowledgedBy: string,
    actionTaken?: string
  ): Promise<AccountChange | null> {
    // Find the change in store
    for (const [customerId, changes] of changesStore.entries()) {
      const changeIndex = changes.findIndex(c => c.id === changeId);
      if (changeIndex !== -1) {
        const change = changes[changeIndex];
        change.acknowledged = true;
        change.acknowledgedBy = acknowledgedBy;
        change.acknowledgedAt = new Date().toISOString();
        change.actionTaken = actionTaken || null;

        // Log to activity
        if (supabase) {
          await supabase.from('agent_activity_log').insert({
            customer_id: change.customerId,
            action_type: 'change_acknowledged',
            agent_type: 'system',
            status: 'completed',
            action_data: {
              changeId,
              changeType: change.changeType,
              actionTaken,
            },
          });
        }

        console.log(`[RecentChanges] Change ${changeId} acknowledged by ${acknowledgedBy}`);
        return change;
      }
    }

    return null;
  },

  /**
   * Get alert preferences for a customer
   */
  async getAlertPreferences(customerId: string): Promise<AlertPreferences> {
    let prefs = preferencesStore.get(customerId);

    if (!prefs && supabase) {
      // Try to load from database
      const { data } = await supabase
        .from('alert_preferences')
        .select('*')
        .eq('customer_id', customerId)
        .single();

      if (data) {
        prefs = {
          customerId,
          healthDrop: data.health_drop || getDefaultPreferences(customerId).healthDrop,
          usageChange: data.usage_change || getDefaultPreferences(customerId).usageChange,
          championActivity: data.champion_activity || getDefaultPreferences(customerId).championActivity,
          supportTickets: data.support_tickets || getDefaultPreferences(customerId).supportTickets,
          renewalReminder: data.renewal_reminder || getDefaultPreferences(customerId).renewalReminder,
        };
        preferencesStore.set(customerId, prefs);
      }
    }

    return prefs || getDefaultPreferences(customerId);
  },

  /**
   * Update alert preferences for a customer
   */
  async updateAlertPreferences(
    customerId: string,
    updates: Partial<AlertPreferences>
  ): Promise<AlertPreferences> {
    const currentPrefs = await this.getAlertPreferences(customerId);
    const newPrefs = { ...currentPrefs, ...updates, customerId };

    preferencesStore.set(customerId, newPrefs);

    // Persist to database if available
    if (supabase) {
      await supabase
        .from('alert_preferences')
        .upsert({
          customer_id: customerId,
          health_drop: newPrefs.healthDrop,
          usage_change: newPrefs.usageChange,
          champion_activity: newPrefs.championActivity,
          support_tickets: newPrefs.supportTickets,
          renewal_reminder: newPrefs.renewalReminder,
          updated_at: new Date().toISOString(),
        });
    }

    console.log(`[RecentChanges] Alert preferences updated for customer ${customerId}`);
    return newPrefs;
  },

  /**
   * Get suggested actions for a change
   */
  getSuggestedActions(change: AccountChange): string[] {
    const actions: string[] = [];

    switch (change.changeType) {
      case 'health_score_drop':
        actions.push('Schedule check-in call with champion');
        actions.push('Review recent support tickets for root cause');
        if (change.severity === 'critical') {
          actions.push('Prepare save play if decline continues');
        }
        break;

      case 'champion_departed':
        actions.push('Identify backup champions in organization');
        actions.push('Schedule executive sponsor meeting');
        actions.push('Update stakeholder map');
        break;

      case 'usage_drop':
        actions.push('Analyze feature-level usage for patterns');
        actions.push('Schedule product training session');
        actions.push('Send re-engagement campaign');
        break;

      case 'no_login':
        actions.push('Send check-in email to primary contact');
        actions.push('Verify contact information is current');
        actions.push('Consider escalation if no response');
        break;

      case 'renewal_approaching':
        actions.push('Review contract terms and pricing');
        actions.push('Schedule renewal discussion');
        actions.push('Prepare value summary document');
        break;

      case 'support_ticket_spike':
        actions.push('Review tickets for common themes');
        actions.push('Coordinate with support team');
        actions.push('Schedule product review call');
        break;

      default:
        actions.push('Review change details');
        actions.push('Contact customer if needed');
    }

    return actions;
  },

  /**
   * Export changes as CSV
   */
  exportChanges(changes: AccountChange[]): string {
    const headers = ['Date', 'Type', 'Severity', 'Title', 'Description', 'Previous Value', 'New Value', 'Change %', 'Acknowledged', 'Action Taken'];
    const rows = changes.map(c => [
      new Date(c.detectedAt).toISOString(),
      c.changeType,
      c.severity,
      c.title,
      c.description,
      c.previousValue?.toString() || '',
      c.newValue?.toString() || '',
      c.changePercent?.toString() || '',
      c.acknowledged ? 'Yes' : 'No',
      c.actionTaken || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return csv;
  },
};
