/**
 * Quiet Account Detector Service
 * PRD-106: Detect accounts with extended silence and generate re-engagement alerts
 *
 * Monitors customer engagement and detects "quiet" accounts:
 * - Tracks last meaningful interactions (meetings, emails, support, CSM notes)
 * - Applies segment-specific thresholds
 * - Generates alerts with context and suggestions
 * - Provides re-engagement recommendations
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import Anthropic from '@anthropic-ai/sdk';
import {
  QuietAccountAlert,
  QuietAccountsResponse,
  QuietAccountDetailResponse,
  QuietAccountFilters,
  QuietAccountSummary,
  QuietAccountContext,
  QuietAccountEventData,
  LastInteraction,
  ReEngagementSuggestion,
  CheckInEmailDraft,
  CustomerSegment,
  QuietSeverity,
  QuietThresholds,
  DEFAULT_QUIET_THRESHOLDS,
  DEFAULT_QUIET_ACCOUNT_CONFIG,
  InteractionType,
  EngagementTrackingRecord,
} from '../../../types/quietAccount.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

let anthropic: Anthropic | null = null;
if (config.anthropicApiKey) {
  anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get the most recent date from multiple nullable dates
 */
function getMostRecentDate(...dates: (string | null | undefined)[]): string | null {
  const validDates = dates
    .filter((d): d is string => d !== null && d !== undefined)
    .map(d => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime());

  return validDates.length > 0 ? validDates[0].toISOString() : null;
}

/**
 * Get quiet threshold for a customer segment
 */
function getThresholdForSegment(
  segment: CustomerSegment,
  thresholds: QuietThresholds = DEFAULT_QUIET_THRESHOLDS
): number {
  return thresholds[segment] || thresholds['mid-market'];
}

/**
 * Calculate severity based on quiet days and threshold
 */
function calculateSeverity(quietDays: number, threshold: number): QuietSeverity {
  const escalationThreshold = DEFAULT_QUIET_THRESHOLDS.escalation;

  if (quietDays >= escalationThreshold) {
    return 'critical';
  } else if (quietDays >= threshold * 1.5) {
    return 'elevated';
  }
  return 'warning';
}

/**
 * Generate interpretation of quiet account situation
 */
function generateInterpretation(
  quietDays: number,
  context: QuietAccountContext,
  lastInteraction: LastInteraction | null
): string {
  const parts: string[] = [];

  // Base observation
  if (context.usageStatus === 'active' && context.loginStatus === 'regular') {
    parts.push('Account is actively using the product but not engaging with CSM.');
    parts.push('May be satisfied but disengaged, or quietly evaluating alternatives.');
  } else if (context.usageStatus === 'declining') {
    parts.push('Account shows both declining engagement AND declining product usage.');
    parts.push('This combination suggests potential churn risk requiring immediate attention.');
  } else if (context.loginStatus === 'inactive') {
    parts.push('Account has stopped logging in and CSM engagement.');
    parts.push('High likelihood of silent churn - urgent re-engagement needed.');
  }

  // Add renewal context if relevant
  if (context.daysToRenewal !== null && context.daysToRenewal <= 90) {
    parts.push(`With renewal in ${context.daysToRenewal} days, this silence is particularly concerning.`);
  }

  // Add health score context
  if (context.healthScore < 50) {
    parts.push('Combined with low health score, this account needs immediate attention.');
  } else if (context.healthScore >= 70) {
    parts.push('Health metrics remain stable, suggesting opportunity for proactive check-in.');
  }

  return parts.join(' ');
}

// ============================================
// ENGAGEMENT TRACKING
// ============================================

/**
 * Update engagement tracking for a customer after an interaction
 */
export async function recordInteraction(
  customerId: string,
  type: InteractionType,
  date: string = new Date().toISOString()
): Promise<boolean> {
  if (!supabase) {
    console.log('[QuietAccountDetector] No database, interaction not recorded');
    return false;
  }

  try {
    // Map interaction type to database column
    const columnMap: Record<InteractionType, string> = {
      meeting: 'last_meeting_at',
      email_sent: 'last_email_sent_at',
      email_received: 'last_email_received_at',
      support_ticket: 'last_support_ticket_at',
      csm_note: 'last_csm_note_at',
      call: 'last_meeting_at', // Calls count as meetings
      qbr: 'last_meeting_at',  // QBRs count as meetings
    };

    const column = columnMap[type];
    if (!column) {
      console.warn(`[QuietAccountDetector] Unknown interaction type: ${type}`);
      return false;
    }

    // Upsert engagement tracking record
    const { error } = await supabase
      .from('engagement_tracking')
      .upsert(
        {
          customer_id: customerId,
          [column]: date,
          last_meaningful_interaction_at: date,
          quiet_since: null, // Reset quiet status
          re_engaged_at: date,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'customer_id' }
      );

    if (error) {
      console.error('[QuietAccountDetector] Failed to record interaction:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[QuietAccountDetector] Error recording interaction:', error);
    return false;
  }
}

/**
 * Get engagement tracking record for a customer
 */
export async function getEngagementTracking(
  customerId: string
): Promise<EngagementTrackingRecord | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('engagement_tracking')
      .select('*')
      .eq('customer_id', customerId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      customerId: data.customer_id,
      lastMeetingAt: data.last_meeting_at,
      lastEmailSentAt: data.last_email_sent_at,
      lastEmailReceivedAt: data.last_email_received_at,
      lastSupportTicketAt: data.last_support_ticket_at,
      lastCsmNoteAt: data.last_csm_note_at,
      lastMeaningfulInteractionAt: data.last_meaningful_interaction_at,
      quietSince: data.quiet_since,
      quietDays: data.quiet_days || 0,
      quietAlertSentAt: data.quiet_alert_sent_at,
      reEngagedAt: data.re_engaged_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('[QuietAccountDetector] Error getting engagement tracking:', error);
    return null;
  }
}

// ============================================
// QUIET ACCOUNT DETECTION
// ============================================

/**
 * Detect quiet accounts across the portfolio
 */
export async function detectQuietAccounts(
  filters: QuietAccountFilters = {},
  thresholds: QuietThresholds = DEFAULT_QUIET_THRESHOLDS
): Promise<QuietAccountsResponse> {
  if (!supabase) {
    return {
      accounts: [],
      summary: {
        totalQuietAccounts: 0,
        bySegment: { enterprise: 0, 'mid-market': 0, smb: 0, startup: 0 },
        bySeverity: { warning: 0, elevated: 0, critical: 0 },
        totalArrAtRisk: 0,
        avgQuietDays: 0,
        reEngagedThisWeek: 0,
        reEngagedThisMonth: 0,
      },
      timestamp: new Date().toISOString(),
    };
  }

  try {
    // Build query for customers with engagement tracking
    let query = supabase
      .from('customers')
      .select(`
        id,
        name,
        arr,
        health_score,
        segment,
        stage,
        renewal_date,
        csm_id,
        created_at,
        engagement_tracking (
          last_meeting_at,
          last_email_sent_at,
          last_email_received_at,
          last_support_ticket_at,
          last_csm_note_at,
          last_meaningful_interaction_at,
          quiet_since,
          quiet_alert_sent_at,
          re_engaged_at
        )
      `)
      .not('stage', 'in', `(${DEFAULT_QUIET_ACCOUNT_CONFIG.excludedStages.join(',')})`);

    // Apply filters
    if (filters.segment) {
      query = query.eq('segment', filters.segment);
    }
    if (filters.csmId) {
      query = query.eq('csm_id', filters.csmId);
    }

    const { data: customers, error } = await query;

    if (error) {
      console.error('[QuietAccountDetector] Failed to fetch customers:', error);
      throw error;
    }

    const now = new Date();
    const quietAccounts: QuietAccountAlert[] = [];

    for (const customer of customers || []) {
      const segment = (customer.segment || 'mid-market').toLowerCase() as CustomerSegment;
      const threshold = getThresholdForSegment(segment, thresholds);

      // Get engagement tracking data
      const et = customer.engagement_tracking?.[0];

      // Calculate last meaningful interaction
      const lastInteractionDate = getMostRecentDate(
        et?.last_meeting_at,
        et?.last_email_sent_at,
        et?.last_email_received_at,
        et?.last_support_ticket_at,
        et?.last_csm_note_at
      );

      // If no interaction data, use customer creation date
      const referenceDate = lastInteractionDate
        ? new Date(lastInteractionDate)
        : new Date(customer.created_at);

      const quietDays = daysBetween(referenceDate, now);

      // Check if account is quiet
      if (quietDays < threshold) continue;

      // Skip already alerted accounts (unless force refresh)
      if (et?.quiet_alert_sent_at && !filters.includeExcluded) {
        const alertAge = daysBetween(new Date(et.quiet_alert_sent_at), now);
        if (alertAge < 7) continue; // Don't re-alert within 7 days
      }

      // Apply severity filter
      const severity = calculateSeverity(quietDays, threshold);
      if (filters.severity && filters.severity !== severity) continue;

      // Apply quiet days filters
      if (filters.minQuietDays && quietDays < filters.minQuietDays) continue;
      if (filters.maxQuietDays && quietDays > filters.maxQuietDays) continue;

      // Build last activities list
      const lastActivities = buildLastActivitiesList(et);

      // Calculate days to renewal
      const daysToRenewal = customer.renewal_date
        ? daysBetween(now, new Date(customer.renewal_date))
        : null;

      // Build context
      const context: QuietAccountContext = {
        arr: customer.arr || 0,
        healthScore: customer.health_score || 50,
        segment,
        daysToRenewal,
        usageStatus: 'active', // Would need usage data integration
        loginStatus: 'regular', // Would need login data integration
      };

      // Generate interpretation
      const lastInteraction = lastActivities[0] || null;
      const interpretation = generateInterpretation(quietDays, context, lastInteraction);

      // Generate suggested actions
      const suggestedActions = generateSuggestedActions(quietDays, context, severity);

      quietAccounts.push({
        id: `qa-${customer.id}`,
        customerId: customer.id,
        customerName: customer.name,
        quietDays,
        severity,
        threshold,
        lastActivities,
        context,
        interpretation,
        suggestedActions,
        alertSentAt: new Date().toISOString(),
        acknowledgedAt: null,
        acknowledgedBy: null,
        reEngagedAt: null,
        createdAt: new Date().toISOString(),
      });
    }

    // Sort results
    const sortBy = filters.sortBy || 'quiet_days';
    const sortOrder = filters.sortOrder || 'desc';

    quietAccounts.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'quiet_days':
          comparison = a.quietDays - b.quietDays;
          break;
        case 'arr':
          comparison = a.context.arr - b.context.arr;
          break;
        case 'renewal_date':
          comparison = (a.context.daysToRenewal || 999) - (b.context.daysToRenewal || 999);
          break;
        case 'health_score':
          comparison = a.context.healthScore - b.context.healthScore;
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Calculate summary
    const summary = calculateSummary(quietAccounts);

    return {
      accounts: quietAccounts,
      summary,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[QuietAccountDetector] Error detecting quiet accounts:', error);
    throw error;
  }
}

/**
 * Build list of last activities from engagement tracking
 */
function buildLastActivitiesList(et: any): LastInteraction[] {
  const activities: LastInteraction[] = [];
  const now = new Date();

  const addActivity = (type: InteractionType, dateStr: string | null) => {
    if (!dateStr) return;
    const date = new Date(dateStr);
    activities.push({
      type,
      date: dateStr,
      daysAgo: daysBetween(date, now),
    });
  };

  if (et) {
    addActivity('meeting', et.last_meeting_at);
    addActivity('email_sent', et.last_email_sent_at);
    addActivity('email_received', et.last_email_received_at);
    addActivity('support_ticket', et.last_support_ticket_at);
    addActivity('csm_note', et.last_csm_note_at);
  }

  // Sort by date (most recent first)
  return activities.sort((a, b) => b.daysAgo - a.daysAgo).reverse();
}

/**
 * Generate suggested actions based on context
 */
function generateSuggestedActions(
  quietDays: number,
  context: QuietAccountContext,
  severity: QuietSeverity
): string[] {
  const actions: string[] = [];

  // Primary action based on severity
  if (severity === 'critical') {
    actions.push('Schedule urgent executive check-in call');
    actions.push('Review account for potential churn indicators');
  } else if (severity === 'elevated') {
    actions.push('Send personalized check-in email with value summary');
    actions.push('Propose a sync call to review goals and progress');
  } else {
    actions.push('Send friendly check-in email');
  }

  // Renewal-specific actions
  if (context.daysToRenewal !== null && context.daysToRenewal <= 90) {
    actions.push('Initiate early renewal conversation');
    actions.push('Schedule QBR to demonstrate value before renewal');
  }

  // Health-score specific actions
  if (context.healthScore < 50) {
    actions.push('Review usage patterns for potential issues');
    actions.push('Consider escalation to leadership');
  }

  // Product usage specific actions
  if (context.usageStatus === 'declining') {
    actions.push('Schedule product training or enablement session');
    actions.push('Share relevant case studies or best practices');
  }

  return actions.slice(0, 5); // Limit to 5 suggestions
}

/**
 * Calculate summary statistics
 */
function calculateSummary(accounts: QuietAccountAlert[]): QuietAccountSummary {
  const bySegment: Record<CustomerSegment, number> = {
    enterprise: 0,
    'mid-market': 0,
    smb: 0,
    startup: 0,
  };

  const bySeverity: Record<QuietSeverity, number> = {
    warning: 0,
    elevated: 0,
    critical: 0,
  };

  let totalArr = 0;
  let totalQuietDays = 0;

  for (const account of accounts) {
    bySegment[account.context.segment]++;
    bySeverity[account.severity]++;
    totalArr += account.context.arr;
    totalQuietDays += account.quietDays;
  }

  return {
    totalQuietAccounts: accounts.length,
    bySegment,
    bySeverity,
    totalArrAtRisk: totalArr,
    avgQuietDays: accounts.length > 0 ? Math.round(totalQuietDays / accounts.length) : 0,
    reEngagedThisWeek: 0, // Would need historical data
    reEngagedThisMonth: 0,
  };
}

// ============================================
// QUIET ACCOUNT DETAIL
// ============================================

/**
 * Get detailed information for a quiet account
 */
export async function getQuietAccountDetail(
  customerId: string
): Promise<QuietAccountDetailResponse | null> {
  if (!supabase) return null;

  try {
    // Get customer with engagement tracking
    const { data: customer, error } = await supabase
      .from('customers')
      .select(`
        id,
        name,
        arr,
        health_score,
        segment,
        stage,
        renewal_date,
        csm_id,
        industry,
        created_at,
        engagement_tracking (
          last_meeting_at,
          last_email_sent_at,
          last_email_received_at,
          last_support_ticket_at,
          last_csm_note_at,
          last_meaningful_interaction_at,
          quiet_since,
          quiet_alert_sent_at,
          re_engaged_at
        )
      `)
      .eq('id', customerId)
      .single();

    if (error || !customer) {
      console.error('[QuietAccountDetector] Customer not found:', customerId);
      return null;
    }

    const now = new Date();
    const segment = (customer.segment || 'mid-market').toLowerCase() as CustomerSegment;
    const threshold = getThresholdForSegment(segment);
    const et = customer.engagement_tracking?.[0];

    // Calculate quiet days
    const lastInteractionDate = getMostRecentDate(
      et?.last_meeting_at,
      et?.last_email_sent_at,
      et?.last_email_received_at,
      et?.last_support_ticket_at,
      et?.last_csm_note_at
    );

    const referenceDate = lastInteractionDate
      ? new Date(lastInteractionDate)
      : new Date(customer.created_at);

    const quietDays = daysBetween(referenceDate, now);
    const severity = calculateSeverity(quietDays, threshold);

    // Build engagement history
    const engagementHistory = await getEngagementHistory(customerId);

    // Calculate days to renewal
    const daysToRenewal = customer.renewal_date
      ? daysBetween(now, new Date(customer.renewal_date))
      : null;

    // Build context
    const context: QuietAccountContext = {
      arr: customer.arr || 0,
      healthScore: customer.health_score || 50,
      segment,
      daysToRenewal,
      usageStatus: 'active',
      loginStatus: 'regular',
    };

    // Build last activities
    const lastActivities = buildLastActivitiesList(et);
    const lastInteraction = lastActivities[0] || null;

    // Generate interpretation
    const interpretation = generateInterpretation(quietDays, context, lastInteraction);

    // Generate suggested actions
    const suggestedActions = generateSuggestedActions(quietDays, context, severity);

    // Build alert object
    const alert: QuietAccountAlert = {
      id: `qa-${customer.id}`,
      customerId: customer.id,
      customerName: customer.name,
      quietDays,
      severity,
      threshold,
      lastActivities,
      context,
      interpretation,
      suggestedActions,
      alertSentAt: et?.quiet_alert_sent_at || new Date().toISOString(),
      acknowledgedAt: null,
      acknowledgedBy: null,
      reEngagedAt: et?.re_engaged_at || null,
      createdAt: new Date().toISOString(),
    };

    // Generate re-engagement suggestions
    const reEngagementSuggestions = generateReEngagementSuggestions(alert);

    // Generate draft check-in email
    const draftCheckInEmail = await generateCheckInEmailDraft(customer, alert);

    return {
      alert,
      engagementHistory,
      reEngagementSuggestions,
      draftCheckInEmail,
    };
  } catch (error) {
    console.error('[QuietAccountDetector] Error getting quiet account detail:', error);
    return null;
  }
}

/**
 * Get engagement history for a customer
 */
async function getEngagementHistory(customerId: string): Promise<LastInteraction[]> {
  if (!supabase) return [];

  try {
    // Get recent engagement activities
    const { data: activities, error } = await supabase
      .from('engagement_activities')
      .select('*')
      .eq('customer_id', customerId)
      .order('date', { ascending: false })
      .limit(20);

    if (error || !activities) return [];

    const now = new Date();
    return activities.map((a: any) => ({
      type: a.type as InteractionType,
      date: a.date,
      daysAgo: daysBetween(new Date(a.date), now),
      subject: a.subject,
      participants: a.participants,
      summary: a.notes,
    }));
  } catch (error) {
    console.error('[QuietAccountDetector] Error getting engagement history:', error);
    return [];
  }
}

/**
 * Generate re-engagement suggestions
 */
function generateReEngagementSuggestions(alert: QuietAccountAlert): ReEngagementSuggestion[] {
  const suggestions: ReEngagementSuggestion[] = [];
  const { severity, context, quietDays } = alert;

  // Email suggestion (always)
  suggestions.push({
    type: 'email',
    priority: severity === 'critical' ? 'high' : 'medium',
    title: 'Send Check-In Email',
    description: `Reach out with a personalized check-in after ${quietDays} days of silence`,
    template: 'quiet_account_checkin',
    conversationStarters: [
      'I wanted to check in and see how things are going with [Product].',
      'I noticed we haven\'t connected in a while and wanted to ensure everything is running smoothly.',
      'I have some updates and best practices I thought might be valuable for your team.',
    ],
  });

  // Meeting suggestion for elevated/critical
  if (severity !== 'warning') {
    suggestions.push({
      type: 'meeting',
      priority: severity === 'critical' ? 'high' : 'medium',
      title: 'Schedule Sync Call',
      description: 'Propose a quick call to reconnect and understand current priorities',
      conversationStarters: [
        'I\'d love to schedule a quick 15-minute call to catch up.',
        'Would you have time this week for a brief sync?',
        'I have some insights about your usage I\'d like to share - can we find time to connect?',
      ],
    });
  }

  // Value summary for accounts approaching renewal
  if (context.daysToRenewal !== null && context.daysToRenewal <= 120) {
    suggestions.push({
      type: 'value_summary',
      priority: 'high',
      title: 'Share Value Summary',
      description: 'Prepare and share a summary of value delivered to reinforce ROI before renewal',
    });
  }

  // Call for critical cases
  if (severity === 'critical') {
    suggestions.push({
      type: 'call',
      priority: 'high',
      title: 'Direct Phone Outreach',
      description: 'Consider a direct phone call if email outreach has been unsuccessful',
      conversationStarters: [
        'Hi [Name], I wanted to personally check in and make sure everything is okay.',
        'I noticed we haven\'t been able to connect lately and wanted to reach out directly.',
      ],
    });
  }

  return suggestions;
}

/**
 * Generate a draft check-in email using AI
 */
async function generateCheckInEmailDraft(
  customer: any,
  alert: QuietAccountAlert
): Promise<CheckInEmailDraft | null> {
  // Build context for email generation
  const lastActivity = alert.lastActivities[0];
  const lastTouchpoint = lastActivity
    ? `Last interaction was a ${lastActivity.type} ${lastActivity.daysAgo} days ago`
    : 'No recent interactions recorded';

  const accountContext = `${customer.segment} account with $${(customer.arr || 0).toLocaleString()} ARR`;
  const valueReminder = `Using ${customer.name} to achieve their business goals`;

  // Determine tone based on severity
  const tone = alert.severity === 'critical' ? 'urgent' :
               alert.severity === 'elevated' ? 'professional' : 'friendly';

  // If AI is available, generate personalized email
  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Generate a brief, professional check-in email for a quiet customer account.

Context:
- Customer: ${customer.name}
- Industry: ${customer.industry || 'Technology'}
- Days since last interaction: ${alert.quietDays}
- Account tier: ${customer.segment}
- ${lastTouchpoint}
${alert.context.daysToRenewal ? `- Renewal in ${alert.context.daysToRenewal} days` : ''}

Requirements:
- Tone: ${tone}
- Keep it under 150 words
- Be genuine, not salesy
- Mention wanting to ensure they're getting value
- Include a soft call-to-action (suggest a brief call or ask for feedback)

Return ONLY the email body, no subject line.`,
          },
        ],
      });

      const emailBody = response.content[0].type === 'text'
        ? response.content[0].text
        : '';

      return {
        to: '', // Would need stakeholder email
        subject: `Quick check-in from ${customer.name || 'your CSM'}`,
        body: emailBody,
        tone,
        personalization: {
          lastTouchpoint,
          accountContext,
          valueReminder,
        },
      };
    } catch (error) {
      console.error('[QuietAccountDetector] AI email generation failed:', error);
    }
  }

  // Fallback template if AI unavailable
  return {
    to: '',
    subject: `Checking in - ${customer.name}`,
    body: `Hi,

I hope this message finds you well. I realized it's been a while since we last connected, and I wanted to reach out to see how things are going.

I want to ensure you're getting the most value from our partnership. If you have any questions, need assistance, or just want to catch up on what's new, I'd be happy to schedule a quick call.

Please let me know if there's anything I can help with.

Best regards`,
    tone,
    personalization: {
      lastTouchpoint,
      accountContext,
      valueReminder,
    },
  };
}

// ============================================
// ALERT MANAGEMENT
// ============================================

/**
 * Mark alert as sent for a customer
 */
export async function markAlertSent(customerId: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('engagement_tracking')
      .upsert(
        {
          customer_id: customerId,
          quiet_alert_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'customer_id' }
      );

    return !error;
  } catch (error) {
    console.error('[QuietAccountDetector] Error marking alert sent:', error);
    return false;
  }
}

/**
 * Mark account as re-engaged
 */
export async function markReEngaged(
  customerId: string,
  interactionType: InteractionType
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('engagement_tracking')
      .upsert(
        {
          customer_id: customerId,
          re_engaged_at: now,
          last_meaningful_interaction_at: now,
          quiet_since: null,
          updated_at: now,
        },
        { onConflict: 'customer_id' }
      );

    // Also record the interaction
    await recordInteraction(customerId, interactionType, now);

    return !error;
  } catch (error) {
    console.error('[QuietAccountDetector] Error marking re-engaged:', error);
    return false;
  }
}

/**
 * Exclude account from quiet alerts
 */
export async function excludeFromAlerts(
  customerId: string,
  reason: string,
  excludeUntil?: string
): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('customer_alert_exclusions')
      .upsert(
        {
          customer_id: customerId,
          alert_type: 'quiet_account',
          reason,
          exclude_until: excludeUntil || null,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'customer_id,alert_type' }
      );

    return !error;
  } catch (error) {
    console.error('[QuietAccountDetector] Error excluding from alerts:', error);
    return false;
  }
}

// ============================================
// TRIGGER EVENT GENERATION
// ============================================

/**
 * Generate trigger events for quiet accounts
 * Called by scheduled job to fire triggers
 */
export async function generateQuietAccountEvents(): Promise<QuietAccountEventData[]> {
  const response = await detectQuietAccounts({ includeExcluded: false });

  return response.accounts.map(alert => ({
    customerId: alert.customerId,
    customerName: alert.customerName,
    quietDays: alert.quietDays,
    threshold: alert.threshold,
    severity: alert.severity,
    segment: alert.context.segment,
    lastInteraction: alert.lastActivities[0] || null,
    arr: alert.context.arr,
    healthScore: alert.context.healthScore,
    daysToRenewal: alert.context.daysToRenewal,
  }));
}

// ============================================
// SERVICE EXPORT
// ============================================

export const quietAccountService = {
  // Detection
  detectQuietAccounts,
  getQuietAccountDetail,
  generateQuietAccountEvents,

  // Tracking
  recordInteraction,
  getEngagementTracking,

  // Alert management
  markAlertSent,
  markReEngaged,
  excludeFromAlerts,

  // Utilities
  getThresholdForSegment,
  calculateSeverity,
};

export default quietAccountService;
