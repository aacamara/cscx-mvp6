/**
 * AI-Powered Playbook Selection Service
 * PRD-232: Automated Playbook Selection
 *
 * Uses Claude to analyze customer context and recommend the most appropriate
 * playbook based on lifecycle stage, health score, risk signals, and more.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { v4 as uuidv4 } from 'uuid';

// Initialize clients
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

let anthropic: Anthropic | null = null;
if (config.anthropicApiKey) {
  anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
}

// Types
export type TriggerType = 'automatic' | 'suggested' | 'manual';
export type RecommendationStatus = 'pending_approval' | 'started' | 'active' | 'declined' | 'completed';
export type PlaybookType = 'onboarding' | 'adoption' | 'renewal' | 'save' | 'expansion' | 'qbr' | 'custom';

export interface PlaybookCriteria {
  lifecycle_stages: string[];
  health_score_range: { min: number; max: number };
  risk_signals: string[];
  expansion_signals: string[];
  renewal_proximity_days: { min: number; max: number };
  industries: string[];
  segments: string[];
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  type: PlaybookType;
  duration_days: number;
  steps_count: number;
  criteria: PlaybookCriteria;
  success_rate?: number;
}

export interface PlaybookOption {
  playbook_id: string;
  playbook_name: string;
  fit_score: number;
  key_reasons: string[];
}

export interface TriggerEvent {
  type: string;
  signal_type?: string;
  details?: string;
  playbook_hint?: string;
  require_approval?: boolean;
}

export interface PlaybookRecommendation {
  id: string;
  customer_id: string;
  customer_name: string;
  recommended_playbook: Playbook;
  fit_score: number;
  reasoning: string[];
  alternative_playbooks: PlaybookOption[];
  trigger_type: TriggerType;
  trigger_event?: TriggerEvent;
  status: RecommendationStatus;
  created_at: string;
}

export interface CustomerContext {
  id: string;
  name: string;
  stage: string;
  health_score: number;
  health_trend: 'improving' | 'stable' | 'declining';
  arr: number;
  industry: string | null;
  segment: string | null;
  days_to_renewal: number | null;
  renewal_date: string | null;
  risk_signals: string[];
  expansion_signals: string[];
  has_champion: boolean;
  stakeholder_count: number;
  active_playbooks: string[];
  recent_activity: Array<{ type: string; date: string; description: string }>;
}

// Default playbook library (used when database is not available)
const DEFAULT_PLAYBOOKS: Playbook[] = [
  {
    id: 'onboarding-standard',
    name: 'Standard Onboarding',
    description: 'Structured 30-day onboarding for new customers',
    type: 'onboarding',
    duration_days: 30,
    steps_count: 8,
    criteria: {
      lifecycle_stages: ['new', 'onboarding'],
      health_score_range: { min: 0, max: 100 },
      risk_signals: [],
      expansion_signals: [],
      renewal_proximity_days: { min: 300, max: 365 },
      industries: [],
      segments: [],
    },
  },
  {
    id: 'onboarding-enterprise',
    name: 'Enterprise Onboarding',
    description: 'High-touch 60-day onboarding for enterprise accounts',
    type: 'onboarding',
    duration_days: 60,
    steps_count: 15,
    criteria: {
      lifecycle_stages: ['new', 'onboarding'],
      health_score_range: { min: 0, max: 100 },
      risk_signals: [],
      expansion_signals: [],
      renewal_proximity_days: { min: 300, max: 365 },
      industries: [],
      segments: ['enterprise'],
    },
  },
  {
    id: 'adoption-standard',
    name: 'Feature Adoption Drive',
    description: 'Targeted training and enablement to increase product adoption',
    type: 'adoption',
    duration_days: 21,
    steps_count: 6,
    criteria: {
      lifecycle_stages: ['active', 'growing'],
      health_score_range: { min: 40, max: 75 },
      risk_signals: ['low_usage', 'feature_drop'],
      expansion_signals: [],
      renewal_proximity_days: { min: 60, max: 365 },
      industries: [],
      segments: [],
    },
  },
  {
    id: 'renewal-90day',
    name: '90-Day Renewal Playbook',
    description: 'Comprehensive renewal preparation starting 90 days out',
    type: 'renewal',
    duration_days: 90,
    steps_count: 10,
    criteria: {
      lifecycle_stages: ['active', 'renewing'],
      health_score_range: { min: 50, max: 100 },
      risk_signals: [],
      expansion_signals: [],
      renewal_proximity_days: { min: 0, max: 90 },
      industries: [],
      segments: [],
    },
  },
  {
    id: 'save-play-standard',
    name: 'Standard Save Play',
    description: 'Comprehensive risk mitigation playbook for at-risk accounts',
    type: 'save',
    duration_days: 30,
    steps_count: 8,
    criteria: {
      lifecycle_stages: ['at_risk', 'active'],
      health_score_range: { min: 0, max: 50 },
      risk_signals: ['health_drop', 'usage_decline', 'engagement_drop', 'support_escalation'],
      expansion_signals: [],
      renewal_proximity_days: { min: 0, max: 365 },
      industries: [],
      segments: [],
    },
  },
  {
    id: 'save-play-executive',
    name: 'Executive Save Play',
    description: 'High-touch save play with executive escalation for strategic accounts',
    type: 'save',
    duration_days: 45,
    steps_count: 12,
    criteria: {
      lifecycle_stages: ['at_risk', 'active'],
      health_score_range: { min: 0, max: 45 },
      risk_signals: ['health_drop', 'champion_departure', 'executive_change'],
      expansion_signals: [],
      renewal_proximity_days: { min: 0, max: 365 },
      industries: [],
      segments: ['enterprise', 'strategic'],
    },
  },
  {
    id: 'expansion-upsell',
    name: 'Expansion Discovery',
    description: 'Identify and pursue upsell opportunities in healthy accounts',
    type: 'expansion',
    duration_days: 30,
    steps_count: 7,
    criteria: {
      lifecycle_stages: ['active', 'growing'],
      health_score_range: { min: 75, max: 100 },
      risk_signals: [],
      expansion_signals: ['high_usage', 'new_use_case', 'team_growth', 'positive_feedback'],
      renewal_proximity_days: { min: 90, max: 365 },
      industries: [],
      segments: [],
    },
  },
  {
    id: 'qbr-standard',
    name: 'Quarterly Business Review',
    description: 'Standard QBR preparation and execution playbook',
    type: 'qbr',
    duration_days: 14,
    steps_count: 5,
    criteria: {
      lifecycle_stages: ['active', 'growing', 'renewing'],
      health_score_range: { min: 0, max: 100 },
      risk_signals: [],
      expansion_signals: [],
      renewal_proximity_days: { min: 0, max: 365 },
      industries: [],
      segments: [],
    },
  },
];

// Playbook triggers for automatic detection
const PLAYBOOK_TRIGGERS = [
  {
    trigger_type: 'health_score_drop',
    playbook_id: 'save-play-standard',
    conditions: [
      { metric: 'health_score_change_7d', operator: '<', value: -15 },
      { metric: 'health_score', operator: '<', value: 50 },
    ],
    auto_start: false,
    require_approval_if: ['high_arr', 'active_expansion'],
  },
  {
    trigger_type: 'renewal_approaching',
    playbook_id: 'renewal-90day',
    conditions: [
      { metric: 'days_to_renewal', operator: '<=', value: 90 },
      { metric: 'renewal_playbook_active', operator: '=', value: false },
    ],
    auto_start: true,
    require_approval_if: [],
  },
  {
    trigger_type: 'low_adoption',
    playbook_id: 'adoption-standard',
    conditions: [
      { metric: 'feature_adoption_rate', operator: '<', value: 30 },
      { metric: 'days_since_onboarding', operator: '>', value: 30 },
    ],
    auto_start: false,
    require_approval_if: ['active_save_play'],
  },
  {
    trigger_type: 'expansion_signal',
    playbook_id: 'expansion-upsell',
    conditions: [
      { metric: 'health_score', operator: '>=', value: 80 },
      { metric: 'has_expansion_signal', operator: '=', value: true },
    ],
    auto_start: false,
    require_approval_if: [],
  },
];

/**
 * Get recommended playbook for a customer
 */
export async function getPlaybookRecommendation(
  customerId: string,
  trigger?: TriggerEvent
): Promise<PlaybookRecommendation> {
  // Gather customer context
  const customer = await getCustomerContext(customerId);

  // Get available playbooks
  const playbooks = await getAvailablePlaybooks();

  // Calculate fit scores for all playbooks
  const scoredPlaybooks = await Promise.all(
    playbooks.map(async (playbook) => ({
      playbook,
      score: await calculateFitScore(playbook, customer, trigger),
      reasons: generateReasons(playbook, customer),
    }))
  );

  // Sort by fit score
  const ranked = scoredPlaybooks.sort((a, b) => b.score - a.score);
  const best = ranked[0];

  // Determine trigger type based on confidence and settings
  const triggerType = determineTriggerType(best.score, customer);

  // Create recommendation record
  const recommendation: PlaybookRecommendation = {
    id: uuidv4(),
    customer_id: customerId,
    customer_name: customer.name,
    recommended_playbook: best.playbook,
    fit_score: best.score,
    reasoning: best.reasons,
    alternative_playbooks: ranked.slice(1, 4).map((p) => ({
      playbook_id: p.playbook.id,
      playbook_name: p.playbook.name,
      fit_score: p.score,
      key_reasons: p.reasons.slice(0, 2),
    })),
    trigger_type: triggerType,
    trigger_event: trigger,
    status: triggerType === 'automatic' ? 'started' : 'pending_approval',
    created_at: new Date().toISOString(),
  };

  // Use AI to enhance recommendation if available
  if (anthropic && best.score > 50) {
    const enhanced = await enhanceRecommendationWithAI(recommendation, customer);
    recommendation.reasoning = enhanced.reasoning;
  }

  // Save recommendation to database
  await saveRecommendation(recommendation);

  return recommendation;
}

/**
 * Get customer context for playbook selection
 */
async function getCustomerContext(customerId: string): Promise<CustomerContext> {
  // Default context
  let context: CustomerContext = {
    id: customerId,
    name: 'Unknown Customer',
    stage: 'active',
    health_score: 70,
    health_trend: 'stable',
    arr: 0,
    industry: null,
    segment: null,
    days_to_renewal: null,
    renewal_date: null,
    risk_signals: [],
    expansion_signals: [],
    has_champion: false,
    stakeholder_count: 0,
    active_playbooks: [],
    recent_activity: [],
  };

  if (!supabase) {
    // Return mock data for demo
    return {
      ...context,
      name: 'Demo Customer',
      health_score: 45,
      health_trend: 'declining',
      arr: 250000,
      industry: 'Technology',
      segment: 'enterprise',
      days_to_renewal: 85,
      renewal_date: new Date(Date.now() + 85 * 24 * 60 * 60 * 1000).toISOString(),
      risk_signals: ['health_drop', 'usage_decline'],
      expansion_signals: [],
      stakeholder_count: 5,
    };
  }

  try {
    // Get customer info
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (customer) {
      context.name = customer.name;
      context.stage = customer.stage || 'active';
      context.health_score = customer.health_score || 70;
      context.arr = customer.arr || 0;
      context.industry = customer.industry;
      context.segment = customer.segment;
      context.renewal_date = customer.renewal_date;

      if (customer.renewal_date) {
        context.days_to_renewal = Math.ceil(
          (new Date(customer.renewal_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        );
      }
    }

    // Get health trend from history
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { data: history } = await supabase
      .from('health_score_history')
      .select('score')
      .eq('customer_id', customerId)
      .gte('calculated_at', sevenDaysAgo.toISOString())
      .order('calculated_at', { ascending: true });

    if (history && history.length >= 2) {
      const firstScore = history[0].score;
      const lastScore = history[history.length - 1].score;
      const diff = lastScore - firstScore;

      if (diff > 5) context.health_trend = 'improving';
      else if (diff < -5) context.health_trend = 'declining';
      else context.health_trend = 'stable';

      // Detect risk signals
      if (diff < -15) context.risk_signals.push('health_drop');
    }

    // Get usage metrics for risk/expansion signals
    const { data: metrics } = await supabase
      .from('usage_metrics')
      .select('*')
      .eq('customer_id', customerId)
      .order('calculated_at', { ascending: false })
      .limit(2);

    if (metrics && metrics.length >= 2) {
      const current = metrics[0];
      const previous = metrics[1];
      const usageChange = (current.total_events - previous.total_events) / Math.max(previous.total_events, 1);

      if (usageChange < -0.2) context.risk_signals.push('usage_decline');
      if (usageChange > 0.3) context.expansion_signals.push('high_usage');
    }

    // Get active playbooks
    const { data: executions } = await supabase
      .from('playbook_executions')
      .select('playbook_id')
      .eq('customer_id', customerId)
      .eq('status', 'active');

    if (executions) {
      context.active_playbooks = executions.map((e) => e.playbook_id);
    }

    // Get stakeholder info
    const { data: contract } = await supabase
      .from('contracts')
      .select('extracted_data')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (contract?.extracted_data) {
      const stakeholders = (contract.extracted_data as any).stakeholders || [];
      context.stakeholder_count = stakeholders.length;
      context.has_champion = stakeholders.some(
        (s: any) =>
          s.role?.toLowerCase().includes('champion') ||
          s.role?.toLowerCase().includes('admin') ||
          s.approval_required
      );
    }

  } catch (error) {
    console.error('Error getting customer context:', error);
  }

  return context;
}

/**
 * Get available playbooks from database or use defaults
 */
async function getAvailablePlaybooks(): Promise<Playbook[]> {
  if (!supabase) {
    return DEFAULT_PLAYBOOKS;
  }

  try {
    const { data } = await supabase
      .from('playbooks')
      .select('*')
      .eq('is_active', true);

    if (data && data.length > 0) {
      return data.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        type: p.type || 'custom',
        duration_days: p.estimated_duration_days || 30,
        steps_count: p.phases?.length || p.steps_count || 5,
        criteria: p.criteria || {
          lifecycle_stages: [],
          health_score_range: { min: 0, max: 100 },
          risk_signals: [],
          expansion_signals: [],
          renewal_proximity_days: { min: 0, max: 365 },
          industries: [],
          segments: [],
        },
        success_rate: p.success_rate,
      }));
    }
  } catch (error) {
    console.error('Error fetching playbooks:', error);
  }

  return DEFAULT_PLAYBOOKS;
}

/**
 * Calculate fit score for a playbook given customer context
 */
async function calculateFitScore(
  playbook: Playbook,
  customer: CustomerContext,
  trigger?: TriggerEvent
): Promise<number> {
  let score = 50; // Base score
  const criteria = playbook.criteria;

  // Lifecycle stage match (+20)
  if (criteria.lifecycle_stages.length === 0 || criteria.lifecycle_stages.includes(customer.stage)) {
    score += 20;
  } else {
    score -= 15; // Penalize mismatch
  }

  // Health score match (+15)
  if (
    customer.health_score >= criteria.health_score_range.min &&
    customer.health_score <= criteria.health_score_range.max
  ) {
    score += 15;
  } else {
    // Partial credit for close matches
    const distance = Math.min(
      Math.abs(customer.health_score - criteria.health_score_range.min),
      Math.abs(customer.health_score - criteria.health_score_range.max)
    );
    score -= Math.min(15, distance / 3);
  }

  // Risk signal match (+15)
  if (trigger?.type === 'risk_signal' && criteria.risk_signals.includes(trigger.signal_type || '')) {
    score += 15;
  } else if (criteria.risk_signals.length > 0) {
    const matchingRiskSignals = customer.risk_signals.filter((s) => criteria.risk_signals.includes(s));
    score += Math.min(15, matchingRiskSignals.length * 5);
  }

  // Expansion signal match (+10)
  if (criteria.expansion_signals.length > 0) {
    const matchingExpansionSignals = customer.expansion_signals.filter((s) =>
      criteria.expansion_signals.includes(s)
    );
    score += Math.min(10, matchingExpansionSignals.length * 5);
  }

  // Renewal proximity match (+10)
  if (customer.days_to_renewal !== null) {
    if (
      customer.days_to_renewal >= criteria.renewal_proximity_days.min &&
      customer.days_to_renewal <= criteria.renewal_proximity_days.max
    ) {
      score += 10;
    } else if (
      playbook.type === 'renewal' &&
      customer.days_to_renewal <= criteria.renewal_proximity_days.max
    ) {
      // Still give partial credit for renewal playbooks when renewal is close
      score += 5;
    }
  }

  // Industry match (+5)
  if (criteria.industries.length === 0 || criteria.industries.includes(customer.industry || '')) {
    score += 5;
  }

  // Segment match (+5)
  if (criteria.segments.length === 0 || criteria.segments.includes(customer.segment || '')) {
    score += 5;
  }

  // Historical success rate adjustment (+/- 10)
  if (playbook.success_rate !== undefined) {
    score += (playbook.success_rate - 0.5) * 20; // +/- 10 based on success rate
  } else {
    // Try to get from database
    const successRate = await getPlaybookSuccessRate(playbook.id, customer.segment);
    if (successRate !== null) {
      score += (successRate - 0.5) * 20;
    }
  }

  // Penalize if same playbook type is already active
  if (customer.active_playbooks.some((p) => p.includes(playbook.type))) {
    score -= 20;
  }

  // Trigger hint bonus
  if (trigger?.playbook_hint === playbook.id) {
    score += 10;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Get playbook success rate from outcomes table
 */
async function getPlaybookSuccessRate(
  playbookId: string,
  segment: string | null
): Promise<number | null> {
  if (!supabase) return null;

  try {
    let query = supabase
      .from('playbook_outcomes')
      .select('outcome')
      .eq('playbook_id', playbookId);

    if (segment) {
      // Join with customers to filter by segment
      // Simplified: just get all outcomes for this playbook
    }

    const { data } = await query;

    if (data && data.length >= 5) {
      const successCount = data.filter((o) => o.outcome === 'success').length;
      return successCount / data.length;
    }
  } catch (error) {
    console.error('Error getting success rate:', error);
  }

  return null;
}

/**
 * Generate human-readable reasons for playbook recommendation
 */
function generateReasons(playbook: Playbook, customer: CustomerContext): string[] {
  const reasons: string[] = [];
  const criteria = playbook.criteria;

  // Lifecycle stage
  if (criteria.lifecycle_stages.includes(customer.stage)) {
    reasons.push(`Customer is in ${customer.stage} stage, matching playbook criteria`);
  }

  // Health score
  if (
    customer.health_score >= criteria.health_score_range.min &&
    customer.health_score <= criteria.health_score_range.max
  ) {
    if (customer.health_score < 50) {
      reasons.push(`Health score (${customer.health_score}) indicates intervention needed`);
    } else if (customer.health_score >= 80) {
      reasons.push(`Strong health score (${customer.health_score}) supports this approach`);
    } else {
      reasons.push(`Health score (${customer.health_score}) within target range`);
    }
  }

  // Risk signals
  if (customer.risk_signals.length > 0 && playbook.type === 'save') {
    reasons.push(`Risk signals detected: ${customer.risk_signals.join(', ')}`);
  }

  // Expansion signals
  if (customer.expansion_signals.length > 0 && playbook.type === 'expansion') {
    reasons.push(`Expansion signals present: ${customer.expansion_signals.join(', ')}`);
  }

  // Renewal proximity
  if (customer.days_to_renewal !== null && playbook.type === 'renewal') {
    reasons.push(`Renewal in ${customer.days_to_renewal} days requires preparation`);
  }

  // ARR value
  if (customer.arr >= 100000) {
    reasons.push(`High value account ($${customer.arr.toLocaleString()} ARR) warrants proactive intervention`);
  }

  // Health trend
  if (customer.health_trend === 'declining') {
    reasons.push('Declining health trend requires attention');
  } else if (customer.health_trend === 'improving') {
    reasons.push('Positive momentum should be maintained');
  }

  // Segment match
  if (criteria.segments.length > 0 && criteria.segments.includes(customer.segment || '')) {
    reasons.push(`Playbook designed for ${customer.segment} segment`);
  }

  // Success rate
  if (playbook.success_rate !== undefined && playbook.success_rate > 0.6) {
    reasons.push(`Historical success rate: ${Math.round(playbook.success_rate * 100)}%`);
  }

  return reasons.slice(0, 5); // Limit to 5 reasons
}

/**
 * Determine trigger type based on score and customer settings
 */
function determineTriggerType(score: number, customer: CustomerContext): TriggerType {
  // High confidence automatic triggers
  if (score >= 90 && customer.arr < 100000) {
    return 'automatic';
  }

  // High confidence but high value accounts need approval
  if (score >= 80) {
    return 'suggested';
  }

  // Manual for lower confidence
  return 'manual';
}

/**
 * Enhance recommendation with AI-generated insights
 */
async function enhanceRecommendationWithAI(
  recommendation: PlaybookRecommendation,
  customer: CustomerContext
): Promise<{ reasoning: string[] }> {
  if (!anthropic) {
    return { reasoning: recommendation.reasoning };
  }

  const prompt = `You are a Customer Success expert. Analyze this playbook recommendation and provide 3-5 clear, specific reasons why this playbook is the best choice.

CUSTOMER CONTEXT:
- Name: ${customer.name}
- Stage: ${customer.stage}
- Health Score: ${customer.health_score}/100 (${customer.health_trend} trend)
- ARR: $${customer.arr.toLocaleString()}
- Industry: ${customer.industry || 'Unknown'}
- Segment: ${customer.segment || 'Unknown'}
- Days to Renewal: ${customer.days_to_renewal ?? 'N/A'}
- Risk Signals: ${customer.risk_signals.join(', ') || 'None'}
- Expansion Signals: ${customer.expansion_signals.join(', ') || 'None'}

RECOMMENDED PLAYBOOK:
- Name: ${recommendation.recommended_playbook.name}
- Type: ${recommendation.recommended_playbook.type}
- Duration: ${recommendation.recommended_playbook.duration_days} days
- Fit Score: ${recommendation.fit_score}%

Provide 3-5 specific, actionable reasons for this recommendation. Format as a JSON array of strings.
Example: ["Reason 1", "Reason 2", "Reason 3"]`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const match = content.text.match(/\[[\s\S]*\]/);
      if (match) {
        const reasons = JSON.parse(match[0]);
        if (Array.isArray(reasons) && reasons.length > 0) {
          return { reasoning: reasons.slice(0, 5) };
        }
      }
    }
  } catch (error) {
    console.error('Error enhancing recommendation with AI:', error);
  }

  return { reasoning: recommendation.reasoning };
}

/**
 * Save recommendation to database
 */
async function saveRecommendation(recommendation: PlaybookRecommendation): Promise<void> {
  if (!supabase) return;

  try {
    await supabase.from('playbook_recommendations').insert({
      id: recommendation.id,
      customer_id: recommendation.customer_id,
      playbook_id: recommendation.recommended_playbook.id,
      fit_score: recommendation.fit_score,
      reasoning: recommendation.reasoning,
      alternatives: recommendation.alternative_playbooks,
      trigger_type: recommendation.trigger_type,
      trigger_event: recommendation.trigger_event,
      status: recommendation.status,
      created_at: recommendation.created_at,
    });
  } catch (error) {
    console.error('Error saving recommendation:', error);
  }
}

/**
 * Start a recommended playbook
 */
export async function startRecommendedPlaybook(
  customerId: string,
  playbookId: string,
  recommendationId?: string,
  overrideReason?: string
): Promise<{ success: boolean; executionId?: string; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    // Create playbook execution
    const { data: execution, error: execError } = await supabase
      .from('playbook_executions')
      .insert({
        playbook_id: playbookId,
        customer_id: customerId,
        current_phase: 1,
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (execError) throw execError;

    // Update recommendation status
    if (recommendationId) {
      await supabase
        .from('playbook_recommendations')
        .update({
          status: 'started',
          started_at: new Date().toISOString(),
        })
        .eq('id', recommendationId);
    }

    // Record outcome tracking
    await supabase.from('playbook_outcomes').insert({
      customer_id: customerId,
      playbook_id: playbookId,
      selection_method: recommendationId ? 'ai_recommended' : 'manual',
      was_recommended_playbook: !overrideReason,
      created_at: new Date().toISOString(),
    });

    return { success: true, executionId: execution.id };
  } catch (error) {
    console.error('Error starting playbook:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Decline a playbook recommendation
 */
export async function declineRecommendation(
  recommendationId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    await supabase
      .from('playbook_recommendations')
      .update({
        status: 'declined',
        decline_reason: reason,
      })
      .eq('id', recommendationId);

    return { success: true };
  } catch (error) {
    console.error('Error declining recommendation:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get all pending recommendations for a user
 */
export async function getPendingRecommendations(): Promise<PlaybookRecommendation[]> {
  if (!supabase) {
    // Return demo data
    return [
      {
        id: 'demo-rec-1',
        customer_id: 'demo-customer-1',
        customer_name: 'TechCorp Industries',
        recommended_playbook: DEFAULT_PLAYBOOKS.find((p) => p.id === 'save-play-standard')!,
        fit_score: 85,
        reasoning: [
          'Health score dropped below 50 (currently 45)',
          'High value account ($250K ARR) warrants proactive intervention',
          'Usage decline matches save play criteria',
          'Historical success rate for similar accounts: 72%',
        ],
        alternative_playbooks: [
          {
            playbook_id: 'save-play-executive',
            playbook_name: 'Executive Save Play',
            fit_score: 75,
            key_reasons: ['Higher touch approach', 'Includes exec escalation'],
          },
          {
            playbook_id: 'adoption-standard',
            playbook_name: 'Feature Adoption Drive',
            fit_score: 65,
            key_reasons: ['Focus on usage improvement'],
          },
        ],
        trigger_type: 'suggested',
        trigger_event: {
          type: 'health_score_drop',
          details: 'Health score dropped from 62 to 45 this week',
        },
        status: 'pending_approval',
        created_at: new Date().toISOString(),
      },
    ];
  }

  try {
    const { data } = await supabase
      .from('playbook_recommendations')
      .select(`
        *,
        customers (id, name, health_score, arr),
        playbooks (id, name, description, type, estimated_duration_days, phases)
      `)
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false });

    if (!data) return [];

    return data.map((rec) => ({
      id: rec.id,
      customer_id: rec.customer_id,
      customer_name: rec.customers?.name || 'Unknown',
      recommended_playbook: {
        id: rec.playbooks?.id || rec.playbook_id,
        name: rec.playbooks?.name || 'Unknown Playbook',
        description: rec.playbooks?.description || '',
        type: rec.playbooks?.type || 'custom',
        duration_days: rec.playbooks?.estimated_duration_days || 30,
        steps_count: rec.playbooks?.phases?.length || 5,
        criteria: {} as PlaybookCriteria,
      },
      fit_score: rec.fit_score,
      reasoning: rec.reasoning || [],
      alternative_playbooks: rec.alternatives || [],
      trigger_type: rec.trigger_type,
      trigger_event: rec.trigger_event,
      status: rec.status,
      created_at: rec.created_at,
    }));
  } catch (error) {
    console.error('Error fetching pending recommendations:', error);
    return [];
  }
}

/**
 * Evaluate triggers for a customer event
 */
export async function evaluateTriggers(
  customerId: string,
  eventType: string
): Promise<PlaybookRecommendation | null> {
  const customer = await getCustomerContext(customerId);

  for (const trigger of PLAYBOOK_TRIGGERS) {
    if (eventType === trigger.trigger_type) {
      // Simplified condition evaluation
      let conditionsMet = true;

      for (const condition of trigger.conditions) {
        let value: number | boolean;

        switch (condition.metric) {
          case 'health_score':
            value = customer.health_score;
            break;
          case 'health_score_change_7d':
            value = customer.health_trend === 'declining' ? -15 : 0;
            break;
          case 'days_to_renewal':
            value = customer.days_to_renewal ?? 999;
            break;
          case 'renewal_playbook_active':
            value = customer.active_playbooks.some((p) => p.includes('renewal'));
            break;
          case 'feature_adoption_rate':
            value = 50; // Would need to calculate from metrics
            break;
          case 'has_expansion_signal':
            value = customer.expansion_signals.length > 0;
            break;
          default:
            value = 0;
        }

        let met = false;
        const numValue = typeof value === 'number' ? value : (value ? 1 : 0);
        switch (condition.operator) {
          case '<':
            met = numValue < (condition.value as number);
            break;
          case '<=':
            met = numValue <= (condition.value as number);
            break;
          case '>':
            met = numValue > (condition.value as number);
            break;
          case '>=':
            met = numValue >= (condition.value as number);
            break;
          case '=':
            met = value === condition.value;
            break;
        }

        if (!met) {
          conditionsMet = false;
          break;
        }
      }

      if (conditionsMet) {
        // Check approval conditions
        const shouldRequireApproval = trigger.require_approval_if.some((cond) => {
          switch (cond) {
            case 'high_arr':
              return customer.arr >= 100000;
            case 'active_expansion':
              return customer.active_playbooks.some((p) => p.includes('expansion'));
            case 'active_save_play':
              return customer.active_playbooks.some((p) => p.includes('save'));
            default:
              return false;
          }
        });

        return await getPlaybookRecommendation(customerId, {
          type: trigger.trigger_type,
          playbook_hint: trigger.playbook_id,
          require_approval: shouldRequireApproval || !trigger.auto_start,
        });
      }
    }
  }

  return null;
}

export default {
  getPlaybookRecommendation,
  startRecommendedPlaybook,
  declineRecommendation,
  getPendingRecommendations,
  evaluateTriggers,
};
