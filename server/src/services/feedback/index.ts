/**
 * Feedback Routing Service
 *
 * PRD-128: Feedback Received → Routing
 *
 * Handles feedback ingestion, AI classification, automatic routing,
 * acknowledgment workflows, and lifecycle tracking.
 */

import { v4 as uuidv4 } from 'uuid';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import { sendSlackAlert } from '../notifications/slack.js';
import { triggerEngine } from '../../triggers/engine.js';
import type { CustomerEvent } from '../../triggers/index.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Types
// ============================================

export type FeedbackSource = 'survey' | 'widget' | 'support' | 'meeting' | 'email' | 'social';
export type FeedbackType = 'feature_request' | 'bug' | 'praise' | 'complaint' | 'suggestion';
export type FeedbackCategory = 'product' | 'support' | 'pricing' | 'ux' | 'documentation' | 'performance' | 'onboarding' | 'other';
export type FeedbackSentiment = 'positive' | 'neutral' | 'negative';
export type FeedbackUrgency = 'immediate' | 'soon' | 'backlog';
export type FeedbackImpact = 'high' | 'medium' | 'low';
export type FeedbackStatus = 'received' | 'routed' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';

export interface FeedbackClassification {
  type: FeedbackType;
  category: FeedbackCategory;
  sentiment: FeedbackSentiment;
  urgency: FeedbackUrgency;
  impact: FeedbackImpact;
  confidence: number;
  themes: string[];
  keywords: string[];
  suggestedActions: string[];
}

export interface FeedbackRouting {
  primaryTeam: string;
  secondaryTeams: string[];
  assignedTo: string | null;
  assignedToEmail: string | null;
  routedAt: Date | null;
  routingRule: string | null;
  escalated: boolean;
  escalatedTo: string | null;
  escalatedAt: Date | null;
}

export interface CustomerFeedback {
  id: string;
  customerId: string;
  customerName?: string;
  source: FeedbackSource;
  sourceId: string | null;
  sourceUrl: string | null;
  submittedBy: {
    email: string;
    name: string | null;
    role: string | null;
    isKeyStakeholder: boolean;
  };
  content: string;
  rawContent: string | null;
  classification: FeedbackClassification;
  routing: FeedbackRouting;
  status: FeedbackStatus;
  acknowledgment: {
    sent: boolean;
    sentAt: Date | null;
    method: 'email' | 'slack' | 'in_app' | null;
    draftContent: string | null;
    approved: boolean;
    approvedBy: string | null;
    approvedAt: Date | null;
  };
  resolution: {
    resolvedAt: Date | null;
    outcome: 'implemented' | 'fixed' | 'wont_fix' | 'duplicate' | 'planned' | null;
    outcomeDetails: string | null;
    customerNotified: boolean;
    notifiedAt: Date | null;
    externalTicketId: string | null;
    externalTicketUrl: string | null;
  };
  csmNotified: boolean;
  csmNotifiedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoutingRule {
  id: string;
  name: string;
  description: string | null;
  priority: number;
  enabled: boolean;
  conditions: RoutingCondition[];
  conditionLogic: 'AND' | 'OR';
  routing: {
    primaryTeam: string;
    secondaryTeams: string[];
    assignTo?: string;
  };
  notifyCSM: boolean;
  autoAcknowledge: boolean;
}

export interface RoutingCondition {
  field: string;
  operator: string;
  value: string | string[] | number;
}

export interface CreateFeedbackInput {
  customerId: string;
  source: FeedbackSource;
  sourceId?: string;
  sourceUrl?: string;
  submittedBy: {
    email: string;
    name?: string;
    role?: string;
  };
  content: string;
  rawContent?: string;
  metadata?: Record<string, unknown>;
}

export interface FeedbackListQuery {
  customerId?: string;
  status?: FeedbackStatus | FeedbackStatus[];
  type?: FeedbackType | FeedbackType[];
  category?: FeedbackCategory | FeedbackCategory[];
  sentiment?: FeedbackSentiment;
  source?: FeedbackSource;
  team?: string;
  assignedTo?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// Classification Service
// ============================================

/**
 * Classify feedback using AI
 */
export async function classifyFeedback(
  content: string,
  customerContext?: { name?: string; industry?: string; arr?: number }
): Promise<FeedbackClassification> {
  const defaultClassification: FeedbackClassification = {
    type: 'suggestion',
    category: 'other',
    sentiment: 'neutral',
    urgency: 'backlog',
    impact: 'medium',
    confidence: 0.5,
    themes: [],
    keywords: [],
    suggestedActions: [],
  };

  if (!config.anthropicApiKey || !content.trim()) {
    return defaultClassification;
  }

  try {
    const anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });

    const contextStr = customerContext
      ? `\nCustomer context: ${customerContext.name || 'Unknown'}, Industry: ${customerContext.industry || 'Unknown'}, ARR: $${customerContext.arr || 'Unknown'}`
      : '';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: `You are an expert at classifying customer feedback for a B2B SaaS company.
Analyze the feedback and extract structured classification information.
Be precise and consistent in your classifications.`,
      messages: [{
        role: 'user',
        content: `Classify this customer feedback:${contextStr}

"${content}"

Return a JSON object with these exact fields:
{
  "type": "feature_request" | "bug" | "praise" | "complaint" | "suggestion",
  "category": "product" | "support" | "pricing" | "ux" | "documentation" | "performance" | "onboarding" | "other",
  "sentiment": "positive" | "neutral" | "negative",
  "urgency": "immediate" | "soon" | "backlog",
  "impact": "high" | "medium" | "low",
  "confidence": number between 0 and 1,
  "themes": ["theme1", "theme2"], // max 5 key themes
  "keywords": ["keyword1", "keyword2"], // max 10 important keywords
  "suggestedActions": ["action1", "action2"] // max 5 recommended follow-up actions
}

Classification guidelines:
- type: What kind of feedback is this?
  - feature_request: Asking for new functionality
  - bug: Reporting something broken
  - praise: Positive feedback or appreciation
  - complaint: Expressing dissatisfaction
  - suggestion: General improvement idea
- category: What area does it relate to?
- sentiment: Overall emotional tone
- urgency:
  - immediate: Customer is blocked or churning
  - soon: Should be addressed within days
  - backlog: Can be prioritized normally
- impact:
  - high: Affects many users or major workflow
  - medium: Notable impact
  - low: Minor enhancement

Return ONLY valid JSON, no markdown.`
      }],
    });

    const textBlock = message.content.find(block => block.type === 'text');
    const responseText = textBlock?.type === 'text' ? textBlock.text : '';

    // Parse the response
    let jsonString = responseText.trim();
    if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }

    const parsed = JSON.parse(jsonString);

    return {
      type: parsed.type || defaultClassification.type,
      category: parsed.category || defaultClassification.category,
      sentiment: parsed.sentiment || defaultClassification.sentiment,
      urgency: parsed.urgency || defaultClassification.urgency,
      impact: parsed.impact || defaultClassification.impact,
      confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      themes: Array.isArray(parsed.themes) ? parsed.themes.slice(0, 5) : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 10) : [],
      suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions.slice(0, 5) : [],
    };
  } catch (error) {
    console.error('[FeedbackService] Classification error:', error);
    return defaultClassification;
  }
}

// ============================================
// Routing Service
// ============================================

/**
 * Get applicable routing rules sorted by priority
 */
export async function getRoutingRules(organizationId: string | null = null): Promise<RoutingRule[]> {
  if (!supabase) return getDefaultRoutingRules();

  let query = supabase
    .from('feedback_routing_rules')
    .select('*')
    .eq('enabled', true)
    .order('priority', { ascending: true });

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error('[FeedbackService] Error fetching routing rules:', error);
    return getDefaultRoutingRules();
  }

  return data.map(mapDbRoutingRule);
}

/**
 * Route feedback based on classification
 */
export async function routeFeedback(
  classification: FeedbackClassification,
  customerContext?: { id: string; tier?: string; arr?: number }
): Promise<{ routing: FeedbackRouting; rule: RoutingRule | null }> {
  const rules = await getRoutingRules();

  // Evaluate each rule in priority order
  for (const rule of rules) {
    const matches = evaluateRoutingConditions(rule.conditions, rule.conditionLogic, classification, customerContext);

    if (matches) {
      return {
        routing: {
          primaryTeam: rule.routing.primaryTeam,
          secondaryTeams: rule.routing.secondaryTeams,
          assignedTo: rule.routing.assignTo || null,
          assignedToEmail: null,
          routedAt: new Date(),
          routingRule: rule.name,
          escalated: false,
          escalatedTo: null,
          escalatedAt: null,
        },
        rule,
      };
    }
  }

  // Default routing based on type
  const defaultTeam = getDefaultTeamForType(classification.type);
  return {
    routing: {
      primaryTeam: defaultTeam,
      secondaryTeams: [],
      assignedTo: null,
      assignedToEmail: null,
      routedAt: new Date(),
      routingRule: 'default',
      escalated: false,
      escalatedTo: null,
      escalatedAt: null,
    },
    rule: null,
  };
}

/**
 * Evaluate routing conditions
 */
function evaluateRoutingConditions(
  conditions: RoutingCondition[],
  logic: 'AND' | 'OR',
  classification: FeedbackClassification,
  customerContext?: { id: string; tier?: string; arr?: number }
): boolean {
  const results = conditions.map(condition => {
    const fieldValue = getFieldValue(condition.field, classification, customerContext);
    return evaluateCondition(fieldValue, condition.operator, condition.value);
  });

  if (logic === 'OR') {
    return results.some(r => r);
  }
  return results.every(r => r);
}

function getFieldValue(
  field: string,
  classification: FeedbackClassification,
  customerContext?: { id: string; tier?: string; arr?: number }
): unknown {
  switch (field) {
    case 'type': return classification.type;
    case 'category': return classification.category;
    case 'sentiment': return classification.sentiment;
    case 'urgency': return classification.urgency;
    case 'impact': return classification.impact;
    case 'customer_tier': return customerContext?.tier;
    case 'arr': return customerContext?.arr;
    case 'keywords': return classification.keywords;
    default: return null;
  }
}

function evaluateCondition(fieldValue: unknown, operator: string, conditionValue: unknown): boolean {
  switch (operator) {
    case 'equals':
      return fieldValue === conditionValue;
    case 'not_equals':
      return fieldValue !== conditionValue;
    case 'contains':
      if (Array.isArray(fieldValue)) {
        return fieldValue.some(v => v === conditionValue || (typeof v === 'string' && v.includes(String(conditionValue))));
      }
      return typeof fieldValue === 'string' && fieldValue.includes(String(conditionValue));
    case 'not_contains':
      if (Array.isArray(fieldValue)) {
        return !fieldValue.some(v => v === conditionValue || (typeof v === 'string' && v.includes(String(conditionValue))));
      }
      return typeof fieldValue === 'string' && !fieldValue.includes(String(conditionValue));
    case 'greater_than':
      return typeof fieldValue === 'number' && fieldValue > Number(conditionValue);
    case 'less_than':
      return typeof fieldValue === 'number' && fieldValue < Number(conditionValue);
    case 'in':
      return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
    case 'not_in':
      return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
    default:
      return false;
  }
}

function getDefaultTeamForType(type: FeedbackType): string {
  const mapping: Record<FeedbackType, string> = {
    feature_request: 'product',
    bug: 'engineering',
    praise: 'marketing',
    complaint: 'support',
    suggestion: 'product',
  };
  return mapping[type] || 'customer_success';
}

// ============================================
// Core CRUD Operations
// ============================================

/**
 * Create new feedback with classification and routing
 */
export async function createFeedback(
  input: CreateFeedbackInput,
  organizationId: string | null = null
): Promise<{ feedback: CustomerFeedback; shouldNotifyCSM: boolean }> {
  const id = uuidv4();

  // Get customer context for better classification
  let customerContext: { name?: string; industry?: string; arr?: number } | undefined;
  if (supabase) {
    let customerQuery = supabase
      .from('customers')
      .select('name, industry, arr')
      .eq('id', input.customerId);

    if (organizationId) {
      customerQuery = customerQuery.eq('organization_id', organizationId);
    }

    const { data: customer } = await customerQuery.single();
    if (customer) {
      customerContext = customer;
    }
  }

  // Check if submitter is a key stakeholder
  let isKeyStakeholder = false;
  if (supabase && input.submittedBy.email) {
    let stakeholderQuery = supabase
      .from('stakeholders')
      .select('id')
      .eq('customer_id', input.customerId)
      .ilike('email', input.submittedBy.email);

    if (organizationId) {
      stakeholderQuery = stakeholderQuery.eq('organization_id', organizationId);
    }

    const { data: stakeholder } = await stakeholderQuery.single();
    isKeyStakeholder = !!stakeholder;
  }

  // Classify feedback
  const classification = await classifyFeedback(input.content, customerContext);

  // Route feedback
  const { routing, rule } = await routeFeedback(classification, { id: input.customerId });

  // Determine if CSM should be notified
  const shouldNotifyCSM = (
    classification.sentiment === 'negative' ||
    classification.urgency === 'immediate' ||
    isKeyStakeholder ||
    (rule?.notifyCSM ?? true)
  );

  // Build feedback object
  const feedback: CustomerFeedback = {
    id,
    customerId: input.customerId,
    customerName: customerContext?.name,
    source: input.source,
    sourceId: input.sourceId || null,
    sourceUrl: input.sourceUrl || null,
    submittedBy: {
      email: input.submittedBy.email,
      name: input.submittedBy.name || null,
      role: input.submittedBy.role || null,
      isKeyStakeholder,
    },
    content: input.content,
    rawContent: input.rawContent || null,
    classification,
    routing,
    status: 'routed',
    acknowledgment: {
      sent: false,
      sentAt: null,
      method: null,
      draftContent: null,
      approved: false,
      approvedBy: null,
      approvedAt: null,
    },
    resolution: {
      resolvedAt: null,
      outcome: null,
      outcomeDetails: null,
      customerNotified: false,
      notifiedAt: null,
      externalTicketId: null,
      externalTicketUrl: null,
    },
    csmNotified: false,
    csmNotifiedAt: null,
    metadata: input.metadata || {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Save to database
  if (supabase) {
    await supabase.from('customer_feedback').insert({
      id: feedback.id,
      customer_id: feedback.customerId,
      source: feedback.source,
      source_id: feedback.sourceId,
      source_url: feedback.sourceUrl,
      submitter_email: feedback.submittedBy.email,
      submitter_name: feedback.submittedBy.name,
      submitter_role: feedback.submittedBy.role,
      is_key_stakeholder: feedback.submittedBy.isKeyStakeholder,
      content: feedback.content,
      raw_content: feedback.rawContent,
      classification_type: feedback.classification.type,
      classification_category: feedback.classification.category,
      classification_sentiment: feedback.classification.sentiment,
      classification_urgency: feedback.classification.urgency,
      classification_impact: feedback.classification.impact,
      classification_confidence: feedback.classification.confidence,
      classification_themes: feedback.classification.themes,
      classification_keywords: feedback.classification.keywords,
      classification_suggested_actions: feedback.classification.suggestedActions,
      routing_primary_team: feedback.routing.primaryTeam,
      routing_secondary_teams: feedback.routing.secondaryTeams,
      routing_assigned_to: feedback.routing.assignedTo,
      routing_assigned_to_email: feedback.routing.assignedToEmail,
      routing_routed_at: feedback.routing.routedAt?.toISOString(),
      routing_rule: feedback.routing.routingRule,
      status: feedback.status,
      metadata: feedback.metadata,
      created_at: feedback.createdAt.toISOString(),
      updated_at: feedback.updatedAt.toISOString(),
      ...(organizationId ? { organization_id: organizationId } : {}),
    });

    // Log creation event
    await logFeedbackEvent(feedback.id, 'created', { source: feedback.source });
    await logFeedbackEvent(feedback.id, 'classified', { classification: feedback.classification });
    await logFeedbackEvent(feedback.id, 'routed', { routing: feedback.routing });
  }

  // Fire trigger event
  await fireFeedbackTrigger(feedback);

  return { feedback, shouldNotifyCSM };
}

/**
 * Get feedback by ID
 */
export async function getFeedbackById(feedbackId: string, organizationId: string | null = null): Promise<CustomerFeedback | null> {
  if (!supabase) return null;

  let query = supabase
    .from('customer_feedback')
    .select('*, customers(name)')
    .eq('id', feedbackId);

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query.single();

  if (error || !data) return null;

  return mapDbFeedback(data);
}

/**
 * List feedback with filters
 */
export async function listFeedback(query: FeedbackListQuery, organizationId: string | null = null): Promise<{
  feedback: CustomerFeedback[];
  total: number;
}> {
  if (!supabase) return { feedback: [], total: 0 };

  let dbQuery = supabase
    .from('customer_feedback')
    .select('*, customers(name)', { count: 'exact' });

  if (organizationId) {
    dbQuery = dbQuery.eq('organization_id', organizationId);
  }

  // Apply filters
  if (query.customerId) {
    dbQuery = dbQuery.eq('customer_id', query.customerId);
  }

  if (query.status) {
    if (Array.isArray(query.status)) {
      dbQuery = dbQuery.in('status', query.status);
    } else {
      dbQuery = dbQuery.eq('status', query.status);
    }
  }

  if (query.type) {
    if (Array.isArray(query.type)) {
      dbQuery = dbQuery.in('classification_type', query.type);
    } else {
      dbQuery = dbQuery.eq('classification_type', query.type);
    }
  }

  if (query.category) {
    if (Array.isArray(query.category)) {
      dbQuery = dbQuery.in('classification_category', query.category);
    } else {
      dbQuery = dbQuery.eq('classification_category', query.category);
    }
  }

  if (query.sentiment) {
    dbQuery = dbQuery.eq('classification_sentiment', query.sentiment);
  }

  if (query.source) {
    dbQuery = dbQuery.eq('source', query.source);
  }

  if (query.team) {
    dbQuery = dbQuery.eq('routing_primary_team', query.team);
  }

  if (query.assignedTo) {
    dbQuery = dbQuery.eq('routing_assigned_to', query.assignedTo);
  }

  if (query.startDate) {
    dbQuery = dbQuery.gte('created_at', query.startDate);
  }

  if (query.endDate) {
    dbQuery = dbQuery.lte('created_at', query.endDate);
  }

  if (query.search) {
    dbQuery = dbQuery.textSearch('content', query.search);
  }

  // Sorting
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder || 'desc';
  const sortColumn = sortBy === 'createdAt' ? 'created_at' :
                     sortBy === 'updatedAt' ? 'updated_at' :
                     sortBy === 'urgency' ? 'classification_urgency' :
                     sortBy === 'impact' ? 'classification_impact' : 'created_at';

  dbQuery = dbQuery.order(sortColumn, { ascending: sortOrder === 'asc' });

  // Pagination
  const limit = query.limit || 50;
  const offset = query.offset || 0;
  dbQuery = dbQuery.range(offset, offset + limit - 1);

  const { data, count, error } = await dbQuery;

  if (error) {
    console.error('[FeedbackService] Error listing feedback:', error);
    return { feedback: [], total: 0 };
  }

  return {
    feedback: (data || []).map(mapDbFeedback),
    total: count || 0,
  };
}

/**
 * Update feedback status
 */
export async function updateFeedbackStatus(
  feedbackId: string,
  status: FeedbackStatus,
  userId?: string,
  organizationId: string | null = null
): Promise<{ success: boolean; message: string }> {
  if (!supabase) return { success: false, message: 'Database not available' };

  let updateQuery = supabase
    .from('customer_feedback')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', feedbackId);

  if (organizationId) {
    updateQuery = updateQuery.eq('organization_id', organizationId);
  }

  const { error } = await updateQuery;

  if (error) {
    return { success: false, message: 'Failed to update status' };
  }

  await logFeedbackEvent(feedbackId, 'status_changed', { status }, userId, organizationId);

  return { success: true, message: `Status updated to ${status}` };
}

/**
 * Re-route feedback to a different team
 */
export async function rerouteFeedback(
  feedbackId: string,
  newTeam: string,
  assignTo?: string,
  userId?: string,
  organizationId: string | null = null
): Promise<{ success: boolean; message: string }> {
  if (!supabase) return { success: false, message: 'Database not available' };

  let updateQuery = supabase
    .from('customer_feedback')
    .update({
      routing_primary_team: newTeam,
      routing_assigned_to: assignTo || null,
      routing_routed_at: new Date().toISOString(),
      routing_rule: 'manual',
      status: 'routed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', feedbackId);

  if (organizationId) {
    updateQuery = updateQuery.eq('organization_id', organizationId);
  }

  const { error } = await updateQuery;

  if (error) {
    return { success: false, message: 'Failed to re-route feedback' };
  }

  await logFeedbackEvent(feedbackId, 'routed', { team: newTeam, assignTo, manual: true }, userId, organizationId);

  return { success: true, message: `Feedback re-routed to ${newTeam}` };
}

/**
 * Resolve feedback
 */
export async function resolveFeedback(
  feedbackId: string,
  outcome: 'implemented' | 'fixed' | 'wont_fix' | 'duplicate' | 'planned',
  outcomeDetails?: string,
  externalTicketId?: string,
  externalTicketUrl?: string,
  userId?: string
): Promise<{ success: boolean; message: string }> {
  if (!supabase) return { success: false, message: 'Database not available' };

  const { error } = await supabase
    .from('customer_feedback')
    .update({
      status: 'resolved',
      resolution_resolved_at: new Date().toISOString(),
      resolution_outcome: outcome,
      resolution_outcome_details: outcomeDetails || null,
      resolution_external_ticket_id: externalTicketId || null,
      resolution_external_ticket_url: externalTicketUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', feedbackId);

  if (error) {
    return { success: false, message: 'Failed to resolve feedback' };
  }

  await logFeedbackEvent(feedbackId, 'resolved', { outcome, outcomeDetails, externalTicketId }, userId);

  return { success: true, message: `Feedback resolved: ${outcome}` };
}

// ============================================
// Acknowledgment Service
// ============================================

/**
 * Generate acknowledgment draft
 */
export async function generateAcknowledgmentDraft(
  feedbackId: string
): Promise<{ success: boolean; draft: string | null; error?: string }> {
  const feedback = await getFeedbackById(feedbackId);
  if (!feedback) {
    return { success: false, draft: null, error: 'Feedback not found' };
  }

  if (!config.anthropicApiKey) {
    // Return default acknowledgment
    const defaultDraft = generateDefaultAcknowledgment(feedback);
    return { success: true, draft: defaultDraft };
  }

  try {
    const anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: `You are a customer success manager writing a brief, professional acknowledgment response to customer feedback.
Keep responses concise (2-3 sentences max), warm, and action-oriented.
Thank them for the feedback, confirm you've received it, and set expectations.`,
      messages: [{
        role: 'user',
        content: `Write an acknowledgment for this ${feedback.classification.type} feedback:

Customer: ${feedback.customerName || 'Valued Customer'}
Feedback: "${feedback.content}"
Routed to: ${feedback.routing.primaryTeam}

Write ONLY the acknowledgment message, no explanation.`
      }],
    });

    const textBlock = message.content.find(block => block.type === 'text');
    const draft = textBlock?.type === 'text' ? textBlock.text.trim() : generateDefaultAcknowledgment(feedback);

    // Save draft to database
    if (supabase) {
      await supabase
        .from('customer_feedback')
        .update({ ack_draft_content: draft })
        .eq('id', feedbackId);
    }

    return { success: true, draft };
  } catch (error) {
    console.error('[FeedbackService] Error generating acknowledgment:', error);
    const defaultDraft = generateDefaultAcknowledgment(feedback);
    return { success: true, draft: defaultDraft };
  }
}

function generateDefaultAcknowledgment(feedback: CustomerFeedback): string {
  const teamName = feedback.routing.primaryTeam.replace(/_/g, ' ');
  const typeText = feedback.classification.type.replace(/_/g, ' ');

  return `Thank you for sharing your ${typeText} with us. We've received your feedback and routed it to our ${teamName} team for review. We'll follow up with you once we have an update.`;
}

/**
 * Send acknowledgment
 */
export async function sendAcknowledgment(
  feedbackId: string,
  method: 'email' | 'slack' | 'in_app',
  content: string,
  approvedBy: string
): Promise<{ success: boolean; message: string }> {
  if (!supabase) return { success: false, message: 'Database not available' };

  // Update acknowledgment status
  const { error } = await supabase
    .from('customer_feedback')
    .update({
      ack_sent: true,
      ack_sent_at: new Date().toISOString(),
      ack_method: method,
      ack_draft_content: content,
      ack_approved: true,
      ack_approved_by: approvedBy,
      ack_approved_at: new Date().toISOString(),
      status: 'acknowledged',
      updated_at: new Date().toISOString(),
    })
    .eq('id', feedbackId);

  if (error) {
    return { success: false, message: 'Failed to update acknowledgment status' };
  }

  await logFeedbackEvent(feedbackId, 'acknowledged', { method, approvedBy }, approvedBy);

  return { success: true, message: `Acknowledgment sent via ${method}` };
}

// ============================================
// Analytics & Reporting
// ============================================

/**
 * Get feedback analytics
 */
export async function getFeedbackAnalytics(
  period: { startDate: Date; endDate: Date },
  customerId?: string
): Promise<Record<string, unknown>> {
  if (!supabase) {
    return {
      totals: { received: 0, routed: 0, acknowledged: 0, resolved: 0, pending: 0 },
      byType: {},
      byCategory: {},
      bySentiment: {},
      bySource: {},
      byTeam: {},
    };
  }

  let query = supabase
    .from('customer_feedback')
    .select('*')
    .gte('created_at', period.startDate.toISOString())
    .lte('created_at', period.endDate.toISOString());

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data: feedback, error } = await query;

  if (error || !feedback) {
    return {
      totals: { received: 0, routed: 0, acknowledged: 0, resolved: 0, pending: 0 },
      byType: {},
      byCategory: {},
      bySentiment: {},
      bySource: {},
      byTeam: {},
    };
  }

  // Calculate totals
  const totals = {
    received: feedback.length,
    routed: feedback.filter(f => f.status !== 'received').length,
    acknowledged: feedback.filter(f => f.ack_sent).length,
    resolved: feedback.filter(f => f.status === 'resolved' || f.status === 'closed').length,
    pending: feedback.filter(f => !['resolved', 'closed'].includes(f.status)).length,
  };

  // Group by various dimensions
  const byType: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const bySentiment: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byTeam: Record<string, number> = {};
  const themes: Record<string, { count: number; sentiment: string }> = {};

  for (const f of feedback) {
    // By type
    byType[f.classification_type] = (byType[f.classification_type] || 0) + 1;

    // By category
    byCategory[f.classification_category] = (byCategory[f.classification_category] || 0) + 1;

    // By sentiment
    bySentiment[f.classification_sentiment] = (bySentiment[f.classification_sentiment] || 0) + 1;

    // By source
    bySource[f.source] = (bySource[f.source] || 0) + 1;

    // By team
    if (f.routing_primary_team) {
      byTeam[f.routing_primary_team] = (byTeam[f.routing_primary_team] || 0) + 1;
    }

    // Themes
    for (const theme of f.classification_themes || []) {
      if (!themes[theme]) {
        themes[theme] = { count: 0, sentiment: f.classification_sentiment };
      }
      themes[theme].count++;
    }
  }

  // Calculate averages
  const routedFeedback = feedback.filter(f => f.routing_routed_at);
  const acknowledgedFeedback = feedback.filter(f => f.ack_sent_at);
  const resolvedFeedback = feedback.filter(f => f.resolution_resolved_at);

  const avgTimeToRoute = routedFeedback.length > 0
    ? routedFeedback.reduce((sum, f) => {
        const created = new Date(f.created_at).getTime();
        const routed = new Date(f.routing_routed_at).getTime();
        return sum + (routed - created) / 60000; // minutes
      }, 0) / routedFeedback.length
    : 0;

  const avgTimeToAcknowledge = acknowledgedFeedback.length > 0
    ? acknowledgedFeedback.reduce((sum, f) => {
        const created = new Date(f.created_at).getTime();
        const acked = new Date(f.ack_sent_at).getTime();
        return sum + (acked - created) / 3600000; // hours
      }, 0) / acknowledgedFeedback.length
    : 0;

  const avgTimeToResolve = resolvedFeedback.length > 0
    ? resolvedFeedback.reduce((sum, f) => {
        const created = new Date(f.created_at).getTime();
        const resolved = new Date(f.resolution_resolved_at).getTime();
        return sum + (resolved - created) / 86400000; // days
      }, 0) / resolvedFeedback.length
    : 0;

  const avgConfidence = feedback.length > 0
    ? feedback.reduce((sum, f) => sum + (f.classification_confidence || 0), 0) / feedback.length
    : 0;

  // Top themes
  const topThemes = Object.entries(themes)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([theme, data]) => ({ theme, ...data }));

  return {
    period: {
      startDate: period.startDate,
      endDate: period.endDate,
      days: Math.ceil((period.endDate.getTime() - period.startDate.getTime()) / 86400000),
    },
    totals,
    byType,
    byCategory,
    bySentiment,
    bySource,
    byTeam,
    averages: {
      timeToRoute: Math.round(avgTimeToRoute * 10) / 10,
      timeToAcknowledge: Math.round(avgTimeToAcknowledge * 10) / 10,
      timeToResolve: Math.round(avgTimeToResolve * 10) / 10,
      classificationConfidence: Math.round(avgConfidence * 100) / 100,
    },
    topThemes,
  };
}

// ============================================
// Event Logging
// ============================================

async function logFeedbackEvent(
  feedbackId: string,
  eventType: string,
  eventData: Record<string, unknown>,
  performedBy?: string | null
): Promise<void> {
  if (!supabase) return;

  await supabase.from('feedback_events').insert({
    id: uuidv4(),
    feedback_id: feedbackId,
    event_type: eventType,
    event_data: eventData,
    performed_by: performedBy || null,
    created_at: new Date().toISOString(),
  });
}

// ============================================
// Trigger Integration
// ============================================

async function fireFeedbackTrigger(feedback: CustomerFeedback): Promise<void> {
  const event: CustomerEvent = {
    id: feedback.id,
    type: 'feedback_received',
    customerId: feedback.customerId,
    customerName: feedback.customerName,
    data: {
      source: feedback.source,
      feedbackType: feedback.classification.type,
      category: feedback.classification.category,
      sentiment: feedback.classification.sentiment,
      urgency: feedback.classification.urgency,
      impact: feedback.classification.impact,
      team: feedback.routing.primaryTeam,
      submitterEmail: feedback.submittedBy.email,
      isKeyStakeholder: feedback.submittedBy.isKeyStakeholder,
      themes: feedback.classification.themes,
    },
    timestamp: new Date(),
    source: 'feedback_service',
  };

  await triggerEngine.processEvent(event);
}

// ============================================
// Notifications
// ============================================

/**
 * Send CSM notification for feedback
 */
export async function notifyCSMOfFeedback(
  feedback: CustomerFeedback,
  slackWebhook?: string
): Promise<boolean> {
  if (!supabase) return false;

  // Update notification status
  await supabase
    .from('customer_feedback')
    .update({
      csm_notified: true,
      csm_notified_at: new Date().toISOString(),
    })
    .eq('id', feedback.id);

  // Send Slack notification if webhook available
  if (slackWebhook) {
    const sentimentEmoji = {
      positive: ':star:',
      neutral: ':speech_balloon:',
      negative: ':warning:',
    };

    const urgencyEmoji = {
      immediate: ':rotating_light:',
      soon: ':clock3:',
      backlog: ':inbox_tray:',
    };

    const title = `${sentimentEmoji[feedback.classification.sentiment]} New ${feedback.classification.type.replace(/_/g, ' ')} from ${feedback.customerName || 'Customer'}`;

    let message = `*Type:* ${feedback.classification.type.replace(/_/g, ' ')}\n`;
    message += `*Category:* ${feedback.classification.category}\n`;
    message += `*Sentiment:* ${feedback.classification.sentiment}\n`;
    message += `*Urgency:* ${urgencyEmoji[feedback.classification.urgency]} ${feedback.classification.urgency}\n`;
    message += `*Routed to:* ${feedback.routing.primaryTeam}\n\n`;
    message += `*Feedback:*\n"${feedback.content.substring(0, 500)}${feedback.content.length > 500 ? '...' : ''}"`;

    if (feedback.classification.themes.length > 0) {
      message += `\n\n*Key Themes:* ${feedback.classification.themes.join(', ')}`;
    }

    await sendSlackAlert(slackWebhook, {
      type: 'customer_feedback',
      title,
      message,
      customer: {
        id: feedback.customerId,
        name: feedback.customerName || 'Unknown',
      },
      priority: feedback.classification.urgency === 'immediate' ? 'urgent' :
                feedback.classification.sentiment === 'negative' ? 'high' : 'medium',
      actionUrl: `/feedback/${feedback.id}`,
      fields: {
        'Source': feedback.source,
        'From': feedback.submittedBy.email,
        'Impact': feedback.classification.impact,
      },
    });
  }

  return true;
}

// ============================================
// Helper Functions
// ============================================

function mapDbFeedback(row: Record<string, unknown>): CustomerFeedback {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    customerName: (row.customers as { name?: string } | null)?.name || undefined,
    source: row.source as FeedbackSource,
    sourceId: row.source_id as string | null,
    sourceUrl: row.source_url as string | null,
    submittedBy: {
      email: row.submitter_email as string,
      name: row.submitter_name as string | null,
      role: row.submitter_role as string | null,
      isKeyStakeholder: row.is_key_stakeholder as boolean,
    },
    content: row.content as string,
    rawContent: row.raw_content as string | null,
    classification: {
      type: row.classification_type as FeedbackType,
      category: row.classification_category as FeedbackCategory,
      sentiment: row.classification_sentiment as FeedbackSentiment,
      urgency: row.classification_urgency as FeedbackUrgency,
      impact: row.classification_impact as FeedbackImpact,
      confidence: row.classification_confidence as number,
      themes: (row.classification_themes as string[]) || [],
      keywords: (row.classification_keywords as string[]) || [],
      suggestedActions: (row.classification_suggested_actions as string[]) || [],
    },
    routing: {
      primaryTeam: row.routing_primary_team as string,
      secondaryTeams: (row.routing_secondary_teams as string[]) || [],
      assignedTo: row.routing_assigned_to as string | null,
      assignedToEmail: row.routing_assigned_to_email as string | null,
      routedAt: row.routing_routed_at ? new Date(row.routing_routed_at as string) : null,
      routingRule: row.routing_rule as string | null,
      escalated: row.routing_escalated as boolean,
      escalatedTo: row.routing_escalated_to as string | null,
      escalatedAt: row.routing_escalated_at ? new Date(row.routing_escalated_at as string) : null,
    },
    status: row.status as FeedbackStatus,
    acknowledgment: {
      sent: row.ack_sent as boolean,
      sentAt: row.ack_sent_at ? new Date(row.ack_sent_at as string) : null,
      method: row.ack_method as 'email' | 'slack' | 'in_app' | null,
      draftContent: row.ack_draft_content as string | null,
      approved: row.ack_approved as boolean,
      approvedBy: row.ack_approved_by as string | null,
      approvedAt: row.ack_approved_at ? new Date(row.ack_approved_at as string) : null,
    },
    resolution: {
      resolvedAt: row.resolution_resolved_at ? new Date(row.resolution_resolved_at as string) : null,
      outcome: row.resolution_outcome as 'implemented' | 'fixed' | 'wont_fix' | 'duplicate' | 'planned' | null,
      outcomeDetails: row.resolution_outcome_details as string | null,
      customerNotified: row.resolution_customer_notified as boolean,
      notifiedAt: row.resolution_notified_at ? new Date(row.resolution_notified_at as string) : null,
      externalTicketId: row.resolution_external_ticket_id as string | null,
      externalTicketUrl: row.resolution_external_ticket_url as string | null,
    },
    csmNotified: row.csm_notified as boolean,
    csmNotifiedAt: row.csm_notified_at ? new Date(row.csm_notified_at as string) : null,
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapDbRoutingRule(row: Record<string, unknown>): RoutingRule {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | null,
    priority: row.priority as number,
    enabled: row.enabled as boolean,
    conditions: (row.conditions as RoutingCondition[]) || [],
    conditionLogic: (row.condition_logic as 'AND' | 'OR') || 'AND',
    routing: {
      primaryTeam: row.routing_primary_team as string,
      secondaryTeams: (row.routing_secondary_teams as string[]) || [],
      assignTo: row.routing_assign_to as string | undefined,
    },
    notifyCSM: row.notify_csm as boolean,
    autoAcknowledge: row.auto_acknowledge as boolean,
  };
}

function getDefaultRoutingRules(): RoutingRule[] {
  return [
    {
      id: 'default-feature',
      name: 'Feature Requests to Product',
      description: 'Route feature requests to Product team',
      priority: 10,
      enabled: true,
      conditions: [{ field: 'type', operator: 'equals', value: 'feature_request' }],
      conditionLogic: 'AND',
      routing: { primaryTeam: 'product', secondaryTeams: ['engineering'] },
      notifyCSM: true,
      autoAcknowledge: false,
    },
    {
      id: 'default-bug',
      name: 'Bugs to Engineering',
      description: 'Route bug reports to Engineering',
      priority: 10,
      enabled: true,
      conditions: [{ field: 'type', operator: 'equals', value: 'bug' }],
      conditionLogic: 'AND',
      routing: { primaryTeam: 'engineering', secondaryTeams: ['support'] },
      notifyCSM: true,
      autoAcknowledge: false,
    },
    {
      id: 'default-complaint',
      name: 'Complaints to Support',
      description: 'Route complaints to Support Lead',
      priority: 20,
      enabled: true,
      conditions: [{ field: 'type', operator: 'equals', value: 'complaint' }],
      conditionLogic: 'AND',
      routing: { primaryTeam: 'support', secondaryTeams: ['customer_success'] },
      notifyCSM: true,
      autoAcknowledge: false,
    },
    {
      id: 'default-praise',
      name: 'Praise to Marketing',
      description: 'Route praise to Marketing for testimonials',
      priority: 50,
      enabled: true,
      conditions: [{ field: 'type', operator: 'equals', value: 'praise' }],
      conditionLogic: 'AND',
      routing: { primaryTeam: 'marketing', secondaryTeams: ['customer_success'] },
      notifyCSM: false,
      autoAcknowledge: true,
    },
  ];
}

// Export service
export default {
  classifyFeedback,
  getRoutingRules,
  routeFeedback,
  createFeedback,
  getFeedbackById,
  listFeedback,
  updateFeedbackStatus,
  rerouteFeedback,
  resolveFeedback,
  generateAcknowledgmentDraft,
  sendAcknowledgment,
  getFeedbackAnalytics,
  notifyCSMOfFeedback,
};
