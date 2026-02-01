/**
 * Capability Matcher Service
 * PRD: Knowledge Base Population & CSM Capability Index
 *
 * Matches user queries to capabilities using:
 * - Keyword matching (GIN index on keywords array)
 * - Pattern matching (trigger patterns)
 * - Semantic similarity (embeddings - future)
 */

import {
  Capability,
  Methodology,
  CapabilityMatchResult,
  PlaybookMatch,
  CapabilityRow,
  MethodologyRow,
} from './types.js';

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { knowledgeService } from '../knowledge.js';

// Initialize Supabase client
const supabase = config.supabaseUrl && config.supabaseServiceKey
  ? createClient(config.supabaseUrl, config.supabaseServiceKey)
  : null;

/**
 * Match a user query to the most relevant capability
 */
export async function match(
  userQuery: string,
  context?: { customerId?: string; userId?: string }
): Promise<CapabilityMatchResult> {
  const normalizedQuery = userQuery.toLowerCase().trim();
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 2);

  // Step 1: Try keyword matching using database function
  const keywordMatch = await matchByKeywords(queryWords);

  // Step 2: Try pattern matching if keyword match is low confidence
  let patternMatch: { capability: Capability | null; confidence: number } = {
    capability: null,
    confidence: 0,
  };

  if (!keywordMatch.capability || keywordMatch.confidence < 0.7) {
    patternMatch = await matchByPatterns(normalizedQuery);
  }

  // Choose the best match
  const bestMatch = keywordMatch.confidence >= patternMatch.confidence
    ? keywordMatch
    : patternMatch;

  if (!bestMatch.capability) {
    return {
      capability: null,
      confidence: 0,
      methodology: null,
      relevantKnowledge: [],
    };
  }

  // Get methodology for the capability
  const methodology = await getMethodologyForCapability(bestMatch.capability.id);

  // Get relevant knowledge
  const relevantKnowledge = await getRelevantKnowledge(
    userQuery,
    bestMatch.capability,
    context?.userId
  );

  return {
    capability: bestMatch.capability,
    confidence: bestMatch.confidence,
    methodology,
    relevantKnowledge,
  };
}

/**
 * Match by keywords using database GIN index
 */
async function matchByKeywords(
  queryWords: string[]
): Promise<{ capability: Capability | null; confidence: number }> {
  if (!supabase || queryWords.length === 0) {
    return { capability: null, confidence: 0 };
  }

  try {
    // Use the database function for keyword matching
    const { data, error } = await supabase.rpc('match_capability_by_keywords', {
      search_keywords: queryWords,
    });

    if (error || !data || data.length === 0) {
      return { capability: null, confidence: 0 };
    }

    // Get the top match
    const topMatch = data[0];

    // Fetch full capability details
    const { data: capabilityData } = await supabase
      .from('capabilities')
      .select('*')
      .eq('id', topMatch.capability_id)
      .single();

    if (!capabilityData) {
      return { capability: null, confidence: 0 };
    }

    const capability = rowToCapability(capabilityData as CapabilityRow);

    // Calculate confidence based on match score relative to query length
    const confidence = Math.min(0.95, topMatch.match_score / Math.max(queryWords.length, 2) + 0.3);

    return { capability, confidence };
  } catch (error) {
    console.error('[capabilityMatcher] Keyword match error:', error);
    return { capability: null, confidence: 0 };
  }
}

/**
 * Match by trigger patterns
 */
async function matchByPatterns(
  query: string
): Promise<{ capability: Capability | null; confidence: number }> {
  if (!supabase) {
    return { capability: null, confidence: 0 };
  }

  try {
    // Fetch all enabled capabilities
    const { data, error } = await supabase
      .from('capabilities')
      .select('*')
      .eq('enabled', true);

    if (error || !data) {
      return { capability: null, confidence: 0 };
    }

    let bestMatch: { capability: Capability | null; confidence: number } = {
      capability: null,
      confidence: 0,
    };

    for (const row of data) {
      const capability = rowToCapability(row as CapabilityRow);

      // Check each trigger pattern
      for (const pattern of capability.triggerPatterns) {
        try {
          // Convert pattern to regex (handle {variable} placeholders)
          const regexPattern = pattern
            .replace(/\{[^}]+\}/g, '.*')
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\\\.\\\*/g, '.*');

          const regex = new RegExp(regexPattern, 'i');

          if (regex.test(query)) {
            const confidence = 0.9; // High confidence for pattern matches
            if (confidence > bestMatch.confidence) {
              bestMatch = { capability, confidence };
            }
          }
        } catch {
          // Invalid regex pattern, skip
        }
      }
    }

    return bestMatch;
  } catch (error) {
    console.error('[capabilityMatcher] Pattern match error:', error);
    return { capability: null, confidence: 0 };
  }
}

/**
 * Get methodology for a capability
 */
async function getMethodologyForCapability(
  capabilityId: string
): Promise<Methodology | null> {
  if (!supabase) {
    return null;
  }

  try {
    // Use the database function
    const { data, error } = await supabase.rpc('get_methodology_for_capability', {
      capability_id: capabilityId,
    });

    if (error || !data || data.length === 0) {
      return null;
    }

    const row = data[0];
    return {
      id: row.methodology_id,
      name: row.methodology_name,
      category: '',
      applicableTo: [capabilityId],
      steps: row.steps || [],
      qualityCriteria: row.quality_criteria || [],
      commonMistakes: [],
      templates: row.templates || [],
      examples: [],
    };
  } catch (error) {
    console.error('[capabilityMatcher] Methodology fetch error:', error);
    return null;
  }
}

/**
 * Get relevant knowledge for a capability
 */
async function getRelevantKnowledge(
  userQuery: string,
  capability: Capability,
  userId?: string
): Promise<PlaybookMatch[]> {
  try {
    // Search knowledge base for relevant content
    const searchQuery = `${capability.name} ${userQuery}`;
    const results = await knowledgeService.search(searchQuery, {
      limit: 3,
      threshold: 0.5,
      userId: userId,
    });

    return results.map(r => ({
      id: r.id,
      title: r.documentTitle,
      content: r.content,
      relevanceScore: r.similarity,
      category: (r.metadata?.category as string) || 'general',
    }));
  } catch (error) {
    console.error('[capabilityMatcher] Knowledge search error:', error);
    return [];
  }
}

/**
 * Convert database row to Capability type
 */
function rowToCapability(row: CapabilityRow): Capability {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description || '',
    triggerPatterns: row.trigger_patterns || [],
    keywords: row.keywords || [],
    examplePrompts: row.example_prompts || [],
    requiredInputs: row.required_inputs || [],
    outputs: row.outputs || [],
    execution: row.execution || { service: '', method: '', requiresApproval: false, estimatedDuration: '' },
    relatedCapabilities: row.related_capabilities || [],
    prerequisites: row.prerequisites || [],
    enabled: row.enabled,
  };
}

/**
 * Get all capabilities (for admin/debugging)
 */
export async function getAllCapabilities(): Promise<Capability[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('capabilities')
      .select('*')
      .eq('enabled', true)
      .order('category', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(row => rowToCapability(row as CapabilityRow));
  } catch (error) {
    console.error('[capabilityMatcher] Get all capabilities error:', error);
    return [];
  }
}

/**
 * Get capabilities by category
 */
export async function getCapabilitiesByCategory(
  category: string
): Promise<Capability[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('capabilities')
      .select('*')
      .eq('category', category)
      .eq('enabled', true);

    if (error || !data) {
      return [];
    }

    return data.map(row => rowToCapability(row as CapabilityRow));
  } catch (error) {
    console.error('[capabilityMatcher] Get by category error:', error);
    return [];
  }
}

export const capabilityMatcher = {
  match,
  getAllCapabilities,
  getCapabilitiesByCategory,
};
