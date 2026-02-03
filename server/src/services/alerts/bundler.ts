/**
 * Alert Bundler (PRD-221)
 *
 * Groups related alerts by customer and generates AI-powered summaries
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import {
  ScoredAlert,
  AlertBundle,
  AlertType,
} from './types.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Initialize Claude client
// ============================================

let anthropic: Anthropic | null = null;
if (config.anthropicApiKey) {
  anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
}

// ============================================
// Bundling Configuration
// ============================================

const BUNDLE_TIME_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================
// Main Bundling Function
// ============================================

export async function bundleAlerts(
  alerts: ScoredAlert[]
): Promise<AlertBundle[]> {
  // Filter out suppressed alerts
  const activeAlerts = alerts.filter(a => a.score.deliveryRecommendation !== 'suppress');

  // Group by customer
  const byCustomer = groupBy(activeAlerts, 'customerId');

  // Create bundles for each customer
  const bundles: AlertBundle[] = [];

  for (const [customerId, customerAlerts] of Object.entries(byCustomer)) {
    // Only bundle if there are multiple alerts within time window
    const recentAlerts = filterByTimeWindow(customerAlerts, BUNDLE_TIME_WINDOW_MS);

    if (recentAlerts.length === 0) continue;

    // Sort by score (highest first)
    const sorted = recentAlerts.sort((a, b) => b.score.finalScore - a.score.finalScore);

    // Generate bundle summary
    const summary = await generateBundleSummary(sorted);

    // Get customer name from first alert
    const customerName = sorted[0].customerName || 'Unknown Customer';

    bundles.push({
      bundleId: uuidv4(),
      customerId,
      customerName,
      alerts: sorted,
      bundleScore: Math.max(...sorted.map(a => a.score.finalScore)),
      title: summary.title,
      summary: summary.summary,
      recommendedAction: summary.action,
      alertCount: sorted.length,
      createdAt: new Date(),
      status: 'unread',
    });
  }

  // Sort bundles by score
  return bundles.sort((a, b) => b.bundleScore - a.bundleScore);
}

// ============================================
// Summary Generation
// ============================================

interface BundleSummary {
  title: string;
  summary: string;
  action: string;
}

async function generateBundleSummary(alerts: ScoredAlert[]): Promise<BundleSummary> {
  // If no Claude API, use rule-based summary
  if (!anthropic) {
    return generateRuleBasedSummary(alerts);
  }

  try {
    const alertDescriptions = alerts.map((a, i) =>
      `${i + 1}. ${a.type.replace(/_/g, ' ')}: ${a.description} (Score: ${a.score.finalScore})`
    ).join('\n');

    const customerName = alerts[0].customerName || 'the customer';
    const topScore = alerts[0].score.finalScore;

    const prompt = `You are a Customer Success AI assistant. Summarize these related alerts for a CSM to take action.

Customer: ${customerName}
Number of Alerts: ${alerts.length}
Highest Priority Score: ${topScore}/100

Alerts:
${alertDescriptions}

Provide a JSON response with:
1. title: A brief headline (max 50 chars) summarizing the situation
2. summary: 1-2 sentence explanation of what's happening and why it matters
3. action: A specific recommended next step for the CSM

Response format:
{"title": "...", "summary": "...", "action": "..."}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      try {
        const parsed = JSON.parse(content.text);
        return {
          title: parsed.title || generateRuleBasedSummary(alerts).title,
          summary: parsed.summary || generateRuleBasedSummary(alerts).summary,
          action: parsed.action || generateRuleBasedSummary(alerts).action,
        };
      } catch {
        // JSON parsing failed, fall back to rule-based
        return generateRuleBasedSummary(alerts);
      }
    }

    return generateRuleBasedSummary(alerts);
  } catch (error) {
    console.error('Error generating AI summary:', error);
    return generateRuleBasedSummary(alerts);
  }
}

function generateRuleBasedSummary(alerts: ScoredAlert[]): BundleSummary {
  const alertCount = alerts.length;
  const topAlert = alerts[0];
  const topScore = topAlert.score.finalScore;
  const customerName = topAlert.customerName || 'Customer';

  // Analyze alert types
  const types = alerts.map(a => a.type);
  const hasHealthIssue = types.includes('health_score_drop') || types.includes('health_score_critical');
  const hasUsageIssue = types.includes('usage_drop');
  const hasEngagementIssue = types.includes('engagement_drop') || types.includes('stakeholder_inactive');
  const hasRenewalRisk = types.includes('renewal_approaching') || types.includes('contract_expiring');
  const hasEscalation = types.includes('support_escalation');

  // Generate title based on patterns
  let title: string;
  let summary: string;
  let action: string;

  if (hasHealthIssue && hasUsageIssue && hasEngagementIssue) {
    title = 'Multiple risk signals detected';
    summary = `${customerName} shows converging risk signals with health, usage, and engagement all declining. This pattern often precedes churn.`;
    action = 'Schedule urgent check-in call within 24 hours';
  } else if (hasEscalation) {
    title = 'Support escalation requires attention';
    summary = `${customerName} has an escalated support issue${alertCount > 1 ? ' along with other signals' : ''}. Immediate intervention recommended.`;
    action = 'Review escalation and coordinate with support team';
  } else if (hasRenewalRisk && hasHealthIssue) {
    title = 'Renewal at risk - health declining';
    summary = `${customerName}'s renewal is approaching with declining health scores. Without intervention, renewal is at risk.`;
    action = 'Initiate save play and schedule executive alignment';
  } else if (hasRenewalRisk) {
    title = 'Renewal prep needed';
    summary = `${customerName}'s renewal is approaching. ${alertCount > 1 ? `${alertCount} related alerts` : 'Review account status'} before renewal conversation.`;
    action = 'Schedule QBR or renewal planning call';
  } else if (hasHealthIssue) {
    title = 'Health score declining';
    summary = `${customerName}'s health score has dropped significantly${alertCount > 1 ? ` with ${alertCount - 1} additional signals` : ''}. Proactive outreach recommended.`;
    action = 'Send check-in email and analyze usage patterns';
  } else if (hasUsageIssue) {
    title = 'Usage patterns changing';
    summary = `${customerName}'s product usage has declined${alertCount > 1 ? ` along with ${alertCount - 1} other signals` : ''}. May indicate adoption issues.`;
    action = 'Review feature adoption and schedule training session';
  } else if (hasEngagementIssue) {
    title = 'Engagement dropping';
    summary = `${customerName}'s engagement has decreased. ${alertCount > 1 ? `${alertCount} related signals detected.` : 'Consider re-engagement outreach.'}`;
    action = 'Send personalized re-engagement email';
  } else if (alertCount > 1) {
    title = `${alertCount} alerts require attention`;
    summary = `${customerName} has ${alertCount} alerts that may require coordinated action. Review the details below.`;
    action = 'Review all alerts and prioritize response';
  } else {
    title = formatAlertType(topAlert.type);
    summary = topAlert.description;
    action = getDefaultAction(topAlert.type);
  }

  return { title, summary, action };
}

function formatAlertType(type: AlertType): string {
  const formatted = type.replace(/_/g, ' ');
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function getDefaultAction(type: AlertType): string {
  const actions: Record<AlertType, string> = {
    health_score_drop: 'Review health score drivers and schedule check-in',
    health_score_critical: 'Escalate internally and contact customer immediately',
    usage_drop: 'Analyze usage patterns and schedule product review',
    usage_spike: 'Investigate spike cause and ensure proper training',
    renewal_approaching: 'Prepare renewal proposal and schedule meeting',
    engagement_drop: 'Send re-engagement email and offer value call',
    champion_left: 'Identify new champion and schedule intro meeting',
    nps_detractor: 'Follow up on feedback and create improvement plan',
    support_escalation: 'Coordinate with support and reach out to customer',
    contract_expiring: 'Review contract terms and prepare for negotiation',
    expansion_signal: 'Research expansion opportunity and prepare pitch',
    adoption_stalled: 'Schedule training session and share best practices',
    invoice_overdue: 'Coordinate with finance and discuss payment',
    stakeholder_inactive: 'Re-engage stakeholder with relevant content',
    custom: 'Review alert and determine appropriate action',
  };

  return actions[type] || 'Review and take appropriate action';
}

// ============================================
// Utility Functions
// ============================================

function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

function filterByTimeWindow(alerts: ScoredAlert[], windowMs: number): ScoredAlert[] {
  const cutoff = new Date(Date.now() - windowMs);
  return alerts.filter(a => a.createdAt >= cutoff);
}

// ============================================
// Exports
// ============================================

export default {
  bundleAlerts,
};
