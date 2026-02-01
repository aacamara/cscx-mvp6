/**
 * Intent Classifier
 * PRD-211: Natural Language Account Query
 *
 * Uses Claude to classify query intent and extract entities
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import {
  QueryIntent,
  QueryEntities,
  QueryClassification,
  AccountMatch,
} from './types.js';

// Initialize Anthropic client
const anthropic = config.anthropicApiKey
  ? new Anthropic({ apiKey: config.anthropicApiKey })
  : null;

/**
 * System prompt for intent classification
 */
const CLASSIFICATION_PROMPT = `You are a query classifier for a Customer Success platform. Your job is to analyze natural language queries about customer accounts and extract structured information.

INTENT TYPES:
- account_summary: General information about a specific account ("Tell me about X", "What's happening with X")
- account_list: Filtered list of accounts ("Show me accounts with...", "Which accounts...")
- metric_query: Specific metric values ("What's the health score for...", "What's the ARR...")
- stakeholder_query: Contact/relationship information ("Who are the contacts at...", "Key stakeholders...")
- usage_query: Product usage data ("How is X using the product?", "Usage trends for...")
- timeline_query: Historical events ("What happened with X last month?", "Recent activity...")
- comparison_query: Compare multiple accounts ("Compare X and Y", "How does X compare to Y")
- aggregation_query: Portfolio-level metrics ("Total ARR", "Average health score", "How many accounts...")
- email_query: Search or list emails ("emails from X", "what did Y say", "recent emails about Z", "unread emails")
- email_summary: Summarize emails ("summarize emails from X", "what were the key points in emails about Y")

ENTITY EXTRACTION:
- account_names: Customer/company names mentioned
- date_range: Time periods (parse "last month", "Q1 2026", "next 90 days" into start/end dates)
- filters: Industry, segment, health score thresholds, ARR ranges, status
- metrics: Specific metrics of interest
- limit: Number of results requested
- sort_by/sort_order: Ordering preferences
- email_sender: For email queries, the sender email or name ("from X")
- email_recipient: For email queries, the recipient ("to X")
- email_subject: Subject keywords ("about X")
- email_keywords: Keywords to search in email body
- unread_only: true if user asks for unread emails
- important_only: true if user asks for important/starred emails

Respond with valid JSON only. No markdown, no explanation.`;

/**
 * Classify query intent and extract entities using Claude
 */
export async function classifyQuery(
  query: string,
  previousContext?: { query: string; entities: QueryEntities }
): Promise<QueryClassification> {
  if (!anthropic) {
    // Fallback to rule-based classification
    return fallbackClassification(query);
  }

  const today = new Date().toISOString().split('T')[0];

  const userPrompt = `Query: "${query}"
${previousContext ? `Previous query context: "${previousContext.query}"` : ''}
Today's date: ${today}

Classify the intent and extract entities. Respond with JSON:
{
  "intent": "one of the intent types",
  "confidence": 0.0 to 1.0,
  "entities": {
    "account_names": ["name1", "name2"],
    "date_range": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "relative": "original text" },
    "filters": { "industry": [], "health_score_min": null, "health_score_max": null, "arr_min": null, "arr_max": null, "status": [] },
    "metrics": ["metric1"],
    "limit": null,
    "sort_by": null,
    "sort_order": null
  },
  "reasoning": "brief explanation"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: CLASSIFICATION_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON response
    const parsed = JSON.parse(content.text);

    return {
      intent: parsed.intent as QueryIntent,
      confidence: parsed.confidence || 0.8,
      entities: cleanEntities(parsed.entities || {}),
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    console.error('Intent classification error:', error);
    // Fallback to rule-based
    return fallbackClassification(query);
  }
}

/**
 * Clean and validate extracted entities
 */
function cleanEntities(entities: QueryEntities): QueryEntities {
  const cleaned: QueryEntities = {};

  if (entities.account_names?.length) {
    cleaned.account_names = entities.account_names.filter(n => n && n.trim());
  }

  if (entities.account_ids?.length) {
    cleaned.account_ids = entities.account_ids;
  }

  if (entities.date_range) {
    cleaned.date_range = entities.date_range;
  }

  if (entities.filters) {
    const filters: QueryEntities['filters'] = {};
    if (entities.filters.industry?.length) filters.industry = entities.filters.industry;
    if (entities.filters.segment?.length) filters.segment = entities.filters.segment;
    if (entities.filters.status?.length) filters.status = entities.filters.status;
    if (typeof entities.filters.health_score_min === 'number') filters.health_score_min = entities.filters.health_score_min;
    if (typeof entities.filters.health_score_max === 'number') filters.health_score_max = entities.filters.health_score_max;
    if (typeof entities.filters.arr_min === 'number') filters.arr_min = entities.filters.arr_min;
    if (typeof entities.filters.arr_max === 'number') filters.arr_max = entities.filters.arr_max;
    if (Object.keys(filters).length > 0) cleaned.filters = filters;
  }

  if (entities.metrics?.length) {
    cleaned.metrics = entities.metrics;
  }

  if (typeof entities.limit === 'number') {
    cleaned.limit = Math.min(entities.limit, 100);
  }

  if (entities.sort_by) {
    cleaned.sort_by = entities.sort_by;
    cleaned.sort_order = entities.sort_order || 'desc';
  }

  return cleaned;
}

/**
 * Rule-based fallback classification when Claude is unavailable
 */
function fallbackClassification(query: string): QueryClassification {
  const queryLower = query.toLowerCase();

  let intent: QueryIntent = 'account_summary';
  let confidence = 0.6;
  const entities: QueryEntities = {};

  // Detect comparison queries
  if (queryLower.includes('compare') || queryLower.includes('vs') || queryLower.includes('versus')) {
    intent = 'comparison_query';
    confidence = 0.8;
  }
  // Detect aggregation queries
  else if (
    queryLower.includes('total') ||
    queryLower.includes('average') ||
    queryLower.includes('how many') ||
    queryLower.includes('sum of') ||
    queryLower.includes('portfolio')
  ) {
    intent = 'aggregation_query';
    confidence = 0.8;
  }
  // Detect list queries
  else if (
    queryLower.includes('show me') ||
    queryLower.includes('list') ||
    queryLower.includes('which accounts') ||
    queryLower.includes('accounts with')
  ) {
    intent = 'account_list';
    confidence = 0.75;

    // Extract filters
    if (queryLower.includes('health') && /\d+/.test(queryLower)) {
      const match = queryLower.match(/health.*?(\d+)/);
      if (match) {
        entities.filters = { health_score_max: parseInt(match[1]) };
      }
    }
  }
  // Detect stakeholder queries
  else if (
    queryLower.includes('stakeholder') ||
    queryLower.includes('contact') ||
    queryLower.includes('who') ||
    queryLower.includes('champion')
  ) {
    intent = 'stakeholder_query';
    confidence = 0.8;
  }
  // Detect usage queries
  else if (
    queryLower.includes('usage') ||
    queryLower.includes('adoption') ||
    queryLower.includes('using') ||
    queryLower.includes('active users')
  ) {
    intent = 'usage_query';
    confidence = 0.8;
  }
  // Detect timeline queries
  else if (
    queryLower.includes('happened') ||
    queryLower.includes('activity') ||
    queryLower.includes('timeline') ||
    queryLower.includes('last month') ||
    queryLower.includes('recent')
  ) {
    intent = 'timeline_query';
    confidence = 0.75;
  }
  // Detect metric queries
  else if (
    queryLower.includes("what's the") ||
    queryLower.includes('what is the') ||
    queryLower.includes('health score') ||
    queryLower.includes('arr') ||
    queryLower.includes('renewal date')
  ) {
    intent = 'metric_query';
    confidence = 0.75;
  }
  // Default to account summary for "tell me about" patterns
  else if (
    queryLower.includes('tell me about') ||
    queryLower.includes('about') ||
    queryLower.includes('info on')
  ) {
    intent = 'account_summary';
    confidence = 0.8;
  }

  // Extract account names (simple pattern matching)
  const namePatterns = [
    /tell me about (\w+(?:\s+\w+)*)/i,
    /about (\w+(?:\s+\w+)*)/i,
    /for (\w+(?:\s+\w+)*)/i,
    /at (\w+(?:\s+\w+)*)/i,
    /(\w+(?:\s+\w+)*)'s/i,
  ];

  for (const pattern of namePatterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Filter out common words
      if (!['the', 'a', 'an', 'this', 'that', 'my', 'our', 'all'].includes(name.toLowerCase())) {
        entities.account_names = [name];
        break;
      }
    }
  }

  // Detect "needs attention" pattern
  if (queryLower.includes('need attention') || queryLower.includes('at risk')) {
    intent = 'account_list';
    entities.filters = { health_score_max: 60 };
    confidence = 0.85;
  }

  return {
    intent,
    confidence,
    entities,
    reasoning: 'Rule-based classification (Claude unavailable)',
  };
}

/**
 * Fuzzy match account name against database
 */
export async function fuzzyMatchAccount(
  name: string,
  supabase: any
): Promise<AccountMatch[]> {
  if (!supabase || !name) return [];

  const cleanName = name.trim().toLowerCase();

  // Try exact match first
  const { data: exactMatches } = await supabase
    .from('customers')
    .select('id, name')
    .ilike('name', cleanName)
    .limit(5);

  if (exactMatches?.length === 1) {
    return [{
      id: exactMatches[0].id,
      name: exactMatches[0].name,
      score: 1.0,
      matched_on: 'exact',
    }];
  }

  // Try fuzzy match with ILIKE
  const { data: fuzzyMatches } = await supabase
    .from('customers')
    .select('id, name')
    .ilike('name', `%${cleanName}%`)
    .limit(10);

  if (!fuzzyMatches?.length) {
    return [];
  }

  // Score and sort matches
  return fuzzyMatches
    .map((m: { id: string; name: string }) => {
      const nameLower = m.name.toLowerCase();
      let score = 0;

      if (nameLower === cleanName) {
        score = 1.0;
      } else if (nameLower.startsWith(cleanName)) {
        score = 0.9;
      } else if (nameLower.includes(cleanName)) {
        score = 0.7;
      } else {
        // Simple Levenshtein-like scoring
        score = 0.5;
      }

      return {
        id: m.id,
        name: m.name,
        score,
        matched_on: score === 1.0 ? 'exact' as const : 'fuzzy' as const,
      };
    })
    .sort((a: AccountMatch, b: AccountMatch) => b.score - a.score)
    .slice(0, 5);
}

/**
 * Resolve account names to IDs with fuzzy matching
 */
export async function resolveAccountNames(
  names: string[],
  supabase: any
): Promise<{
  resolved: Map<string, string>;
  ambiguous: Map<string, AccountMatch[]>;
  notFound: string[];
}> {
  const resolved = new Map<string, string>();
  const ambiguous = new Map<string, AccountMatch[]>();
  const notFound: string[] = [];

  for (const name of names) {
    const matches = await fuzzyMatchAccount(name, supabase);

    if (matches.length === 0) {
      notFound.push(name);
    } else if (matches.length === 1 || matches[0].score > 0.9) {
      resolved.set(name, matches[0].id);
    } else {
      ambiguous.set(name, matches);
    }
  }

  return { resolved, ambiguous, notFound };
}
