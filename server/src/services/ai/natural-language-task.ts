/**
 * Natural Language Task Creation Service
 * PRD-234: Natural Language Task Creation
 *
 * Parses natural language input to create structured tasks.
 * Uses AI to extract entities like customer, stakeholder, due date,
 * priority, and task type from free-form text.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// Initialize clients
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

let anthropic: Anthropic | null = null;
if (config.anthropicApiKey) {
  anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
}

// ============================================
// Types
// ============================================

export type TaskType =
  | 'follow_up'
  | 'send'
  | 'schedule'
  | 'review'
  | 'call'
  | 'email'
  | 'research'
  | 'meeting'
  | 'documentation'
  | 'other';

export type TaskPriority = 'high' | 'medium' | 'low';

export interface CustomerMatch {
  id: string;
  name: string;
  match_confidence: number;
  arr?: number;
  health_score?: number;
  renewal_date?: string;
}

export interface StakeholderMatch {
  id: string;
  name: string;
  email?: string;
  title?: string;
  match_confidence: number;
}

export interface DateExtraction {
  raw_text: string;
  parsed_date: string;
  is_relative: boolean;
  confidence: number;
}

export interface PriorityExtraction {
  priority: TaskPriority;
  confidence: number;
  detected_keywords?: string[];
}

export interface TaskTypeExtraction {
  type: TaskType;
  confidence: number;
  detected_verbs?: string[];
}

export interface RelatedEntity {
  type: 'meeting' | 'email' | 'deal' | 'ticket' | 'qbr' | 'other';
  id?: string;
  name?: string;
  confidence: number;
}

export interface Ambiguity {
  field: string;
  issue: string;
  suggestions: string[];
}

export interface ParsedEntities {
  customer?: CustomerMatch;
  stakeholder?: StakeholderMatch;
  due_date?: DateExtraction;
  priority?: PriorityExtraction;
  task_type?: TaskTypeExtraction;
  related_to?: RelatedEntity;
}

export interface ParsedTask {
  raw_input: string;
  action_verb: string;
  description: string;
  entities: ParsedEntities;
  confidence: number;
  ambiguities: Ambiguity[];
}

export interface SuggestedTask {
  title: string;
  description: string;
  customer_id?: string;
  customer_name?: string;
  stakeholder_id?: string;
  stakeholder_name?: string;
  due_date?: string;
  priority: TaskPriority;
  task_type: TaskType;
  notes?: string;
}

export interface UserContext {
  current_customer_id?: string;
  current_customer_name?: string;
  timezone?: string;
  user_id?: string;
}

export interface ParseTaskResult {
  success: boolean;
  parsed: ParsedTask;
  suggested_task: SuggestedTask;
  ambiguities: Ambiguity[];
  confirmations_needed: string[];
  error?: string;
}

export interface CreatedTask {
  id: string;
  title: string;
  description: string;
  customer_id?: string;
  customer_name?: string;
  due_date?: string;
  priority: TaskPriority;
  task_type: TaskType;
  status: 'pending' | 'in_progress' | 'completed';
  source: 'natural_language';
  source_input: string;
  parse_confidence: number;
  created_at: string;
}

// ============================================
// Priority Keywords
// ============================================

const PRIORITY_KEYWORDS: Record<TaskPriority, string[]> = {
  high: ['urgent', 'asap', 'immediately', 'critical', 'important', 'high priority', 'priority', 'time-sensitive'],
  medium: ['soon', 'this week', 'when possible', 'moderate'],
  low: ['eventually', 'when you can', 'low priority', 'nice to have', 'optional', 'no rush'],
};

// ============================================
// Core Functions
// ============================================

/**
 * Parse natural language task input using Claude AI
 */
export async function parseNaturalLanguageTask(
  input: string,
  context: UserContext = {}
): Promise<ParseTaskResult> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  try {
    // First, use Claude to extract structured information
    const aiParsed = await parseWithAI(input, context, todayStr);

    // Match customer and stakeholder to database
    const customerMatch = aiParsed.customer_mention
      ? await fuzzyMatchCustomer(aiParsed.customer_mention)
      : context.current_customer_id
        ? await getCustomerById(context.current_customer_id)
        : null;

    const stakeholderMatch =
      aiParsed.stakeholder_mention && customerMatch
        ? await matchStakeholder(aiParsed.stakeholder_mention, customerMatch.id)
        : null;

    // Build parsed entities
    const entities: ParsedEntities = {};

    if (customerMatch) {
      entities.customer = customerMatch;
    }

    if (stakeholderMatch) {
      entities.stakeholder = stakeholderMatch;
    }

    if (aiParsed.due_date) {
      entities.due_date = {
        raw_text: aiParsed.due_date_raw || '',
        parsed_date: aiParsed.due_date,
        is_relative: aiParsed.is_relative_date || false,
        confidence: aiParsed.due_date_confidence || 0.8,
      };
    }

    // Extract priority
    entities.priority = extractPriority(input, aiParsed.priority);

    // Extract task type
    entities.task_type = {
      type: aiParsed.task_type || 'other',
      confidence: aiParsed.task_type_confidence || 0.7,
      detected_verbs: aiParsed.detected_verbs,
    };

    // Related entity
    if (aiParsed.related_to) {
      entities.related_to = {
        type: aiParsed.related_to_type || 'other',
        name: aiParsed.related_to,
        confidence: 0.7,
      };
    }

    // Collect ambiguities
    const ambiguities: Ambiguity[] = [];
    const confirmationsNeeded: string[] = [];

    if (!entities.customer) {
      if (context.current_customer_id) {
        confirmationsNeeded.push('No customer mentioned - using current context');
      } else {
        ambiguities.push({
          field: 'customer',
          issue: 'No customer identified',
          suggestions: ['Add customer name to the task', 'Select a customer from the list'],
        });
      }
    }

    if (!entities.due_date) {
      ambiguities.push({
        field: 'due_date',
        issue: 'No due date detected',
        suggestions: ['Add a date like "tomorrow", "next week", or "by Friday"'],
      });
    }

    // Build parsed task
    const parsed: ParsedTask = {
      raw_input: input,
      action_verb: aiParsed.action_verb || 'do',
      description: aiParsed.description || input,
      entities,
      confidence: calculateOverallConfidence(entities, ambiguities),
      ambiguities,
    };

    // Build suggested task
    const suggestedTask = buildSuggestedTask(parsed, input);

    return {
      success: true,
      parsed,
      suggested_task: suggestedTask,
      ambiguities,
      confirmations_needed: confirmationsNeeded,
    };
  } catch (error) {
    console.error('Error parsing natural language task:', error);
    return {
      success: false,
      parsed: {
        raw_input: input,
        action_verb: 'do',
        description: input,
        entities: {},
        confidence: 0,
        ambiguities: [],
      },
      suggested_task: {
        title: input,
        description: input,
        priority: 'medium',
        task_type: 'other',
      },
      ambiguities: [],
      confirmations_needed: [],
      error: error instanceof Error ? error.message : 'Failed to parse task',
    };
  }
}

/**
 * Parse input using Claude AI
 */
async function parseWithAI(
  input: string,
  context: UserContext,
  todayStr: string
): Promise<Record<string, unknown>> {
  if (!anthropic) {
    // Fallback to basic parsing without AI
    return basicParsing(input);
  }

  const prompt = `Parse this task description and extract structured information.

Input: "${input}"

User context:
- Current customer (if viewing): ${context.current_customer_name || context.current_customer_id || 'None'}
- Today's date: ${todayStr}
- User timezone: ${context.timezone || 'UTC'}

Extract the following and return as JSON:
{
  "action_verb": "the main action verb (follow up, send, schedule, call, review, etc.)",
  "description": "clean description of what needs to be done",
  "customer_mention": "company/customer name mentioned, or null",
  "stakeholder_mention": "person name mentioned, or null",
  "due_date": "ISO date string YYYY-MM-DD, or null",
  "due_date_raw": "the original text mentioning the date",
  "is_relative_date": true/false,
  "due_date_confidence": 0.0-1.0,
  "priority": "high/medium/low or null",
  "task_type": "follow_up/send/schedule/review/call/email/research/meeting/documentation/other",
  "task_type_confidence": 0.0-1.0,
  "detected_verbs": ["list", "of", "action", "verbs"],
  "related_to": "related context (meeting, renewal, QBR, etc.) or null",
  "related_to_type": "meeting/email/deal/ticket/qbr/other or null"
}

Handle relative dates:
- "tomorrow" = ${getRelativeDate(1, todayStr)}
- "next week" = ${getRelativeDate(7, todayStr)}
- "next Monday" = calculate based on today
- "this Friday" = calculate based on today
- "in 2 days" = ${getRelativeDate(2, todayStr)}

Return ONLY valid JSON, no explanation.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      // Extract JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }

    return basicParsing(input);
  } catch (error) {
    console.error('AI parsing error:', error);
    return basicParsing(input);
  }
}

/**
 * Basic parsing fallback without AI
 */
function basicParsing(input: string): Record<string, unknown> {
  const lowerInput = input.toLowerCase();

  // Extract action verb
  const actionVerbs = ['follow up', 'send', 'schedule', 'call', 'review', 'email', 'meet', 'check'];
  let actionVerb = 'do';
  for (const verb of actionVerbs) {
    if (lowerInput.includes(verb)) {
      actionVerb = verb.replace(' ', '_');
      break;
    }
  }

  // Try to detect priority
  let priority = null;
  for (const [level, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    if (keywords.some((k) => lowerInput.includes(k))) {
      priority = level;
      break;
    }
  }

  // Map action verb to task type
  const taskTypeMap: Record<string, TaskType> = {
    follow_up: 'follow_up',
    send: 'send',
    schedule: 'schedule',
    call: 'call',
    review: 'review',
    email: 'email',
    meet: 'meeting',
    check: 'follow_up',
    do: 'other',
  };

  return {
    action_verb: actionVerb,
    description: input,
    customer_mention: null,
    stakeholder_mention: null,
    due_date: null,
    priority,
    task_type: taskTypeMap[actionVerb] || 'other',
    task_type_confidence: 0.5,
    detected_verbs: [actionVerb],
  };
}

/**
 * Fuzzy match customer name to database
 */
async function fuzzyMatchCustomer(mention: string): Promise<CustomerMatch | null> {
  if (!supabase) {
    return null;
  }

  try {
    // Try exact match first
    const { data: exactMatch } = await supabase
      .from('customers')
      .select('id, name, arr, health_score')
      .ilike('name', mention)
      .limit(1)
      .single();

    if (exactMatch) {
      return {
        id: exactMatch.id,
        name: exactMatch.name,
        match_confidence: 1.0,
        arr: exactMatch.arr,
        health_score: exactMatch.health_score,
      };
    }

    // Try partial match
    const { data: partialMatches } = await supabase
      .from('customers')
      .select('id, name, arr, health_score')
      .ilike('name', `%${mention}%`)
      .limit(5);

    if (partialMatches && partialMatches.length > 0) {
      // Score matches by similarity
      const scored = partialMatches.map((c) => ({
        ...c,
        score: calculateSimilarity(mention.toLowerCase(), c.name.toLowerCase()),
      }));

      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];

      if (best.score >= 0.5) {
        return {
          id: best.id,
          name: best.name,
          match_confidence: best.score,
          arr: best.arr,
          health_score: best.health_score,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error matching customer:', error);
    return null;
  }
}

/**
 * Get customer by ID
 */
async function getCustomerById(customerId: string): Promise<CustomerMatch | null> {
  if (!supabase) {
    return null;
  }

  try {
    const { data } = await supabase
      .from('customers')
      .select('id, name, arr, health_score')
      .eq('id', customerId)
      .single();

    if (data) {
      return {
        id: data.id,
        name: data.name,
        match_confidence: 1.0,
        arr: data.arr,
        health_score: data.health_score,
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting customer:', error);
    return null;
  }
}

/**
 * Match stakeholder to customer contacts
 */
async function matchStakeholder(
  mention: string,
  customerId: string
): Promise<StakeholderMatch | null> {
  if (!supabase) {
    return null;
  }

  try {
    // Get contracts with stakeholder data
    const { data: contracts } = await supabase
      .from('contracts')
      .select('extracted_data')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (contracts && contracts.length > 0) {
      const extractedData = contracts[0].extracted_data as {
        stakeholders?: Array<{
          name?: string;
          role?: string;
          email?: string;
        }>;
      };
      const stakeholders = extractedData?.stakeholders || [];

      for (const stakeholder of stakeholders) {
        if (stakeholder.name) {
          const similarity = calculateSimilarity(
            mention.toLowerCase(),
            stakeholder.name.toLowerCase()
          );

          if (similarity >= 0.6) {
            return {
              id: `${customerId}-${stakeholder.name.replace(/\s+/g, '-').toLowerCase()}`,
              name: stakeholder.name,
              title: stakeholder.role,
              email: stakeholder.email,
              match_confidence: similarity,
            };
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error matching stakeholder:', error);
    return null;
  }
}

/**
 * Extract priority from text
 */
function extractPriority(
  text: string,
  aiPriority: string | null | undefined
): PriorityExtraction {
  const lowerText = text.toLowerCase();

  // Check for explicit keywords
  for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    const matched = keywords.filter((k) => lowerText.includes(k));
    if (matched.length > 0) {
      return {
        priority: priority as TaskPriority,
        confidence: 0.9,
        detected_keywords: matched,
      };
    }
  }

  // Use AI-detected priority if available
  if (aiPriority && ['high', 'medium', 'low'].includes(aiPriority)) {
    return {
      priority: aiPriority as TaskPriority,
      confidence: 0.7,
    };
  }

  // Default to medium
  return {
    priority: 'medium',
    confidence: 0.5,
  };
}

/**
 * Calculate string similarity (Levenshtein-based)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;

  // Check for substring match
  if (str2.includes(str1) || str1.includes(str2)) {
    return Math.min(len1, len2) / Math.max(len1, len2);
  }

  // Simple Levenshtein distance
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[len1][len2];
  return 1 - distance / Math.max(len1, len2);
}

/**
 * Calculate overall confidence score
 */
function calculateOverallConfidence(
  entities: ParsedEntities,
  ambiguities: Ambiguity[]
): number {
  let totalScore = 0;
  let weights = 0;

  // Customer confidence (weight: 30)
  if (entities.customer) {
    totalScore += entities.customer.match_confidence * 30;
    weights += 30;
  } else {
    weights += 30;
  }

  // Due date confidence (weight: 25)
  if (entities.due_date) {
    totalScore += entities.due_date.confidence * 25;
    weights += 25;
  } else {
    weights += 25;
  }

  // Task type confidence (weight: 20)
  if (entities.task_type) {
    totalScore += entities.task_type.confidence * 20;
    weights += 20;
  } else {
    weights += 20;
  }

  // Priority confidence (weight: 15)
  if (entities.priority) {
    totalScore += entities.priority.confidence * 15;
    weights += 15;
  } else {
    weights += 15;
  }

  // Stakeholder confidence (weight: 10)
  if (entities.stakeholder) {
    totalScore += entities.stakeholder.match_confidence * 10;
    weights += 10;
  }

  // Penalty for ambiguities
  const ambiguityPenalty = ambiguities.length * 5;

  const baseScore = weights > 0 ? totalScore / weights : 0.5;
  return Math.max(0.1, Math.min(1.0, baseScore - ambiguityPenalty / 100));
}

/**
 * Get relative date from today
 */
function getRelativeDate(daysFromNow: number, todayStr: string): string {
  const today = new Date(todayStr);
  today.setDate(today.getDate() + daysFromNow);
  return today.toISOString().split('T')[0];
}

/**
 * Build suggested task from parsed data
 */
function buildSuggestedTask(parsed: ParsedTask, originalInput: string): SuggestedTask {
  const { entities, action_verb, description } = parsed;

  // Build title
  let title = description;
  if (title.length > 60) {
    title = title.substring(0, 57) + '...';
  }

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // Build description
  let fullDescription = `${description}`;
  if (entities.stakeholder?.name) {
    fullDescription = `${description} with ${entities.stakeholder.name}`;
  }
  fullDescription += `\n\n(Created from natural language: "${originalInput}")`;

  return {
    title,
    description: fullDescription,
    customer_id: entities.customer?.id,
    customer_name: entities.customer?.name,
    stakeholder_id: entities.stakeholder?.id,
    stakeholder_name: entities.stakeholder?.name,
    due_date: entities.due_date?.parsed_date,
    priority: entities.priority?.priority || 'medium',
    task_type: entities.task_type?.type || 'other',
  };
}

/**
 * Create a task from natural language input
 */
export async function createTaskFromNaturalLanguage(
  input: string,
  context: UserContext = {},
  autoConfirm: boolean = false,
  overrides: Partial<SuggestedTask> = {}
): Promise<{
  success: boolean;
  task?: CreatedTask;
  needs_confirmation?: boolean;
  parsed?: ParsedTask;
  suggested_task?: SuggestedTask;
  error?: string;
}> {
  // First, parse the input
  const parseResult = await parseNaturalLanguageTask(input, context);

  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error,
    };
  }

  // Check if confirmation is needed
  const needsConfirmation =
    parseResult.parsed.confidence < 0.7 ||
    parseResult.ambiguities.length > 0 ||
    parseResult.confirmations_needed.length > 0;

  if (needsConfirmation && !autoConfirm) {
    return {
      success: true,
      needs_confirmation: true,
      parsed: parseResult.parsed,
      suggested_task: parseResult.suggested_task,
    };
  }

  // Merge overrides
  const finalTask = {
    ...parseResult.suggested_task,
    ...overrides,
  };

  // Create the task in database
  if (!supabase) {
    // Return mock task if no database
    const mockTask: CreatedTask = {
      id: `task-${Date.now()}`,
      title: finalTask.title,
      description: finalTask.description,
      customer_id: finalTask.customer_id,
      customer_name: finalTask.customer_name,
      due_date: finalTask.due_date,
      priority: finalTask.priority,
      task_type: finalTask.task_type,
      status: 'pending',
      source: 'natural_language',
      source_input: input,
      parse_confidence: parseResult.parsed.confidence,
      created_at: new Date().toISOString(),
    };

    return {
      success: true,
      task: mockTask,
    };
  }

  try {
    const { data, error } = await supabase
      .from('plan_tasks')
      .insert({
        title: finalTask.title,
        description: finalTask.description,
        customer_id: finalTask.customer_id,
        due_date: finalTask.due_date,
        priority: finalTask.priority,
        task_type: finalTask.task_type,
        status: 'pending',
        source: 'natural_language',
        source_input: input,
        parse_confidence: parseResult.parsed.confidence,
        assignee_id: context.user_id,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      success: true,
      task: {
        id: data.id,
        title: data.title,
        description: data.description,
        customer_id: data.customer_id,
        customer_name: finalTask.customer_name,
        due_date: data.due_date,
        priority: data.priority,
        task_type: data.task_type,
        status: data.status,
        source: 'natural_language',
        source_input: input,
        parse_confidence: data.parse_confidence,
        created_at: data.created_at,
      },
    };
  } catch (error) {
    console.error('Error creating task:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create task',
    };
  }
}

/**
 * Parse multiple tasks in batch (e.g., from meeting notes)
 */
export async function parseBatchTasks(
  items: string[],
  source: string = 'manual',
  context: UserContext = {}
): Promise<{
  success: boolean;
  tasks: Array<{
    input: string;
    success: boolean;
    parsed?: ParsedTask;
    suggested_task?: SuggestedTask;
    confidence: number;
    error?: string;
  }>;
  total_parsed: number;
  high_confidence: number;
  needs_review: number;
}> {
  const results: Array<{
    input: string;
    success: boolean;
    parsed?: ParsedTask;
    suggested_task?: SuggestedTask;
    confidence: number;
    error?: string;
  }> = [];

  // Process items in parallel with limit
  const batchSize = 5;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (input) => {
        try {
          const result = await parseNaturalLanguageTask(input.trim(), context);
          return {
            input,
            success: result.success,
            parsed: result.parsed,
            suggested_task: result.suggested_task,
            confidence: result.parsed.confidence,
            error: result.error,
          };
        } catch (error) {
          return {
            input,
            success: false,
            confidence: 0,
            error: error instanceof Error ? error.message : 'Parse failed',
          };
        }
      })
    );
    results.push(...batchResults);
  }

  const successfulResults = results.filter((r) => r.success);
  const highConfidence = successfulResults.filter((r) => r.confidence >= 0.8);
  const needsReview = successfulResults.filter((r) => r.confidence < 0.8);

  return {
    success: true,
    tasks: results,
    total_parsed: successfulResults.length,
    high_confidence: highConfidence.length,
    needs_review: needsReview.length,
  };
}

/**
 * Create multiple tasks from batch
 */
export async function createBatchTasks(
  tasks: Array<{
    input: string;
    overrides?: Partial<SuggestedTask>;
    confirmed: boolean;
  }>,
  context: UserContext = {}
): Promise<{
  success: boolean;
  created: number;
  failed: number;
  tasks: Array<{
    input: string;
    success: boolean;
    task_id?: string;
    error?: string;
  }>;
}> {
  const results: Array<{
    input: string;
    success: boolean;
    task_id?: string;
    error?: string;
  }> = [];

  for (const item of tasks) {
    if (!item.confirmed) {
      results.push({
        input: item.input,
        success: false,
        error: 'Task not confirmed',
      });
      continue;
    }

    const result = await createTaskFromNaturalLanguage(
      item.input,
      context,
      true,
      item.overrides || {}
    );

    results.push({
      input: item.input,
      success: result.success,
      task_id: result.task?.id,
      error: result.error,
    });
  }

  const created = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return {
    success: created > 0,
    created,
    failed,
    tasks: results,
  };
}

// Export all functions
export const naturalLanguageTaskService = {
  parseNaturalLanguageTask,
  createTaskFromNaturalLanguage,
  parseBatchTasks,
  createBatchTasks,
};

export default naturalLanguageTaskService;
