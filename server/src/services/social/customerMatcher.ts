/**
 * Social Mention Customer Matcher (PRD-019)
 *
 * Matches social media mentions to customer records using multiple signals:
 * - Author name/handle matching
 * - Company name detection in bio/content
 * - Domain matching
 * - Historical mention patterns
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  SocialMention,
  CustomerMatch,
} from '../../../../types/socialMention.js';
import Anthropic from '@anthropic-ai/sdk';

// Initialize clients
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

let anthropic: Anthropic | null = null;
if (config.anthropicApiKey) {
  anthropic = new Anthropic({
    apiKey: config.anthropicApiKey,
  });
}

// ============================================================================
// Types
// ============================================================================

interface CustomerRecord {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  contacts?: Array<{
    name: string;
    email?: string;
    title?: string;
    social_handles?: string[];
  }>;
}

interface MatchContext {
  author: string;
  author_handle?: string;
  content: string;
  bio?: string;
  location?: string;
}

// ============================================================================
// Customer Matching
// ============================================================================

/**
 * Match a mention to potential customers
 */
export async function matchMentionToCustomer(
  mention: SocialMention,
  additionalContext?: {
    bio?: string;
    location?: string;
  }
): Promise<CustomerMatch[]> {
  const matches: CustomerMatch[] = [];

  // Get all customers for matching
  const customers = await getCustomers();
  if (customers.length === 0) {
    return matches;
  }

  const context: MatchContext = {
    author: mention.author,
    author_handle: mention.author_handle,
    content: mention.content,
    bio: additionalContext?.bio,
    location: additionalContext?.location,
  };

  // Strategy 1: Exact handle match
  const handleMatches = findHandleMatches(context, customers);
  matches.push(...handleMatches);

  // Strategy 2: Name similarity matching
  const nameMatches = findNameMatches(context, customers);
  for (const match of nameMatches) {
    if (!matches.find(m => m.customer_id === match.customer_id)) {
      matches.push(match);
    }
  }

  // Strategy 3: Company mention in content
  const contentMatches = findContentMatches(context, customers);
  for (const match of contentMatches) {
    const existing = matches.find(m => m.customer_id === match.customer_id);
    if (existing) {
      // Boost confidence if multiple signals
      existing.confidence = Math.min(1, existing.confidence + 0.15);
      existing.match_signals.push(...match.match_signals.filter(s => !existing.match_signals.includes(s)));
    } else {
      matches.push(match);
    }
  }

  // Strategy 4: AI-powered matching for ambiguous cases
  if (anthropic && matches.length === 0) {
    const aiMatches = await findAIMatches(context, customers);
    matches.push(...aiMatches);
  }

  // Sort by confidence
  matches.sort((a, b) => b.confidence - a.confidence);

  return matches.slice(0, 5); // Return top 5 matches
}

/**
 * Find matches based on social handles
 */
function findHandleMatches(
  context: MatchContext,
  customers: CustomerRecord[]
): CustomerMatch[] {
  const matches: CustomerMatch[] = [];

  if (!context.author_handle) {
    return matches;
  }

  const normalizedHandle = normalizeHandle(context.author_handle);

  for (const customer of customers) {
    if (!customer.contacts) continue;

    for (const contact of customer.contacts) {
      if (!contact.social_handles) continue;

      for (const handle of contact.social_handles) {
        if (normalizeHandle(handle) === normalizedHandle) {
          matches.push({
            customer_id: customer.id,
            customer_name: customer.name,
            confidence: 0.95,
            match_signals: [`Exact handle match: @${context.author_handle} = ${contact.name}`],
          });
        }
      }
    }
  }

  return matches;
}

/**
 * Find matches based on author name similarity
 */
function findNameMatches(
  context: MatchContext,
  customers: CustomerRecord[]
): CustomerMatch[] {
  const matches: CustomerMatch[] = [];
  const authorName = context.author.toLowerCase();

  for (const customer of customers) {
    if (!customer.contacts) continue;

    for (const contact of customer.contacts) {
      const contactName = contact.name.toLowerCase();
      const similarity = calculateNameSimilarity(authorName, contactName);

      if (similarity >= 0.8) {
        matches.push({
          customer_id: customer.id,
          customer_name: customer.name,
          confidence: similarity * 0.85, // Cap at 85% for name-only match
          match_signals: [`Name match: "${context.author}" ~ "${contact.name}" (${Math.round(similarity * 100)}% similar)`],
        });
      }
    }
  }

  return matches;
}

/**
 * Find matches based on company mentions in content
 */
function findContentMatches(
  context: MatchContext,
  customers: CustomerRecord[]
): CustomerMatch[] {
  const matches: CustomerMatch[] = [];
  const lowerContent = context.content.toLowerCase();
  const lowerBio = context.bio?.toLowerCase() || '';

  for (const customer of customers) {
    const customerNameLower = customer.name.toLowerCase();
    const signals: string[] = [];
    let confidence = 0;

    // Check if customer name mentioned in content
    if (lowerContent.includes(customerNameLower)) {
      signals.push(`Company name "${customer.name}" found in mention`);
      confidence += 0.4;
    }

    // Check if customer name mentioned in bio
    if (lowerBio.includes(customerNameLower)) {
      signals.push(`Company name "${customer.name}" found in author bio`);
      confidence += 0.3;
    }

    // Check domain
    if (customer.domain) {
      const domainWithoutTld = customer.domain.replace(/\.(com|io|ai|co|net|org)$/i, '');
      if (lowerContent.includes(domainWithoutTld) || lowerBio.includes(domainWithoutTld)) {
        signals.push(`Domain reference "${domainWithoutTld}" found`);
        confidence += 0.25;
      }
    }

    if (signals.length > 0) {
      matches.push({
        customer_id: customer.id,
        customer_name: customer.name,
        confidence: Math.min(0.75, confidence), // Cap content-only matches at 75%
        match_signals: signals,
      });
    }
  }

  return matches;
}

/**
 * Use AI to find potential matches
 */
async function findAIMatches(
  context: MatchContext,
  customers: CustomerRecord[]
): Promise<CustomerMatch[]> {
  if (!anthropic || customers.length === 0) {
    return [];
  }

  const customerList = customers
    .slice(0, 50) // Limit for prompt size
    .map(c => `- ${c.name} (${c.industry || 'Unknown industry'})`)
    .join('\n');

  const prompt = `Analyze this social media mention and determine if the author might be associated with any of the listed companies.

Author: ${context.author}
Handle: ${context.author_handle || 'N/A'}
Bio: ${context.bio || 'N/A'}
Location: ${context.location || 'N/A'}
Content: "${context.content}"

Customer List:
${customerList}

If you can identify a potential match, return JSON:
{
  "matches": [
    {
      "company_name": "<exact company name from list>",
      "confidence": <0 to 1>,
      "reasoning": "<brief explanation>"
    }
  ]
}

If no matches are likely, return: {"matches": []}
Return ONLY valid JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const matches: CustomerMatch[] = [];

    if (parsed.matches && Array.isArray(parsed.matches)) {
      for (const match of parsed.matches) {
        const customer = customers.find(c => c.name.toLowerCase() === match.company_name.toLowerCase());
        if (customer && match.confidence >= 0.5) {
          matches.push({
            customer_id: customer.id,
            customer_name: customer.name,
            confidence: Math.min(0.7, match.confidence), // Cap AI matches at 70%
            match_signals: [`AI analysis: ${match.reasoning}`],
          });
        }
      }
    }

    return matches;
  } catch (error) {
    console.error('[CustomerMatcher] AI matching failed:', error);
    return [];
  }
}

// ============================================================================
// Bulk Matching
// ============================================================================

/**
 * Match multiple mentions to customers in batch
 */
export async function matchMentionsBatch(
  mentions: SocialMention[]
): Promise<Map<string, CustomerMatch | null>> {
  const results = new Map<string, CustomerMatch | null>();

  // Get customers once
  const customers = await getCustomers();
  if (customers.length === 0) {
    for (const mention of mentions) {
      results.set(mention.id, null);
    }
    return results;
  }

  // Process each mention
  for (const mention of mentions) {
    const matches = await matchMentionToCustomer(mention);
    results.set(mention.id, matches.length > 0 ? matches[0] : null);
  }

  return results;
}

/**
 * Confirm a customer match for a mention
 */
export async function confirmCustomerMatch(
  mentionId: string,
  customerId: string
): Promise<boolean> {
  if (!supabase) {
    return false;
  }

  const { error } = await supabase
    .from('social_mentions')
    .update({
      customer_id: customerId,
      match_confidence: 1.0, // Manual confirmation = 100% confidence
      updated_at: new Date().toISOString(),
    })
    .eq('id', mentionId);

  return !error;
}

// ============================================================================
// Advocate Detection
// ============================================================================

/**
 * Identify potential customer advocates from positive mentions
 */
export async function identifyAdvocates(
  mentions: SocialMention[]
): Promise<Array<{
  customer_id: string;
  customer_name: string;
  advocate_name: string;
  advocate_handle?: string;
  platform: string;
  followers: number;
  mention_id: string;
  content_preview: string;
  opportunity_type: 'amplify' | 'case_study' | 'reference' | 'speaking';
}>> {
  const advocates = [];

  const positiveMentions = mentions.filter(
    m => m.sentiment === 'positive' && m.customer_id && m.sentiment_score >= 50
  );

  for (const mention of positiveMentions) {
    const followers = mention.author_followers || 0;
    const engagement = mention.engagement.likes + mention.engagement.shares;

    // Determine opportunity type based on reach
    let opportunityType: 'amplify' | 'case_study' | 'reference' | 'speaking' = 'amplify';
    if (followers > 50000 || engagement > 500) {
      opportunityType = 'speaking';
    } else if (followers > 10000 || engagement > 100) {
      opportunityType = 'case_study';
    } else if (followers > 1000) {
      opportunityType = 'reference';
    }

    advocates.push({
      customer_id: mention.customer_id!,
      customer_name: mention.customer_name || 'Unknown',
      advocate_name: mention.author,
      advocate_handle: mention.author_handle,
      platform: mention.platform,
      followers,
      mention_id: mention.id,
      content_preview: mention.content.slice(0, 150) + (mention.content.length > 150 ? '...' : ''),
      opportunity_type: opportunityType,
    });
  }

  return advocates.sort((a, b) => b.followers - a.followers);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all customers from database
 */
async function getCustomers(): Promise<CustomerRecord[]> {
  if (!supabase) {
    return [];
  }

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, industry')
    .limit(500);

  if (!customers) {
    return [];
  }

  // Also get contacts/stakeholders
  const customerIds = customers.map(c => c.id);
  const { data: contacts } = await supabase
    .from('contacts')
    .select('customer_id, name, email, title')
    .in('customer_id', customerIds);

  return customers.map(c => ({
    id: c.id,
    name: c.name,
    industry: c.industry,
    contacts: (contacts || [])
      .filter(contact => contact.customer_id === c.id)
      .map(contact => ({
        name: contact.name,
        email: contact.email,
        title: contact.title,
      })),
  }));
}

/**
 * Normalize social handle for comparison
 */
function normalizeHandle(handle: string): string {
  return handle
    .toLowerCase()
    .replace(/^@/, '')
    .trim();
}

/**
 * Calculate name similarity using Levenshtein distance
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  // Normalize names
  const n1 = name1.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  const n2 = name2.toLowerCase().replace(/[^a-z\s]/g, '').trim();

  if (n1 === n2) return 1.0;

  // Check if one contains the other
  if (n1.includes(n2) || n2.includes(n1)) {
    const longer = Math.max(n1.length, n2.length);
    const shorter = Math.min(n1.length, n2.length);
    return shorter / longer;
  }

  // Levenshtein distance
  const distance = levenshteinDistance(n1, n2);
  const maxLength = Math.max(n1.length, n2.length);

  return maxLength > 0 ? (maxLength - distance) / maxLength : 0;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

// ============================================================================
// Exports
// ============================================================================

export const customerMatcher = {
  matchMentionToCustomer,
  matchMentionsBatch,
  confirmCustomerMatch,
  identifyAdvocates,
};

export default customerMatcher;
