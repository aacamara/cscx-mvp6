/**
 * Feature Request Grouper Service
 * PRD-016: Feature Request List Prioritization Scoring
 *
 * Groups similar feature requests using NLP and keyword matching,
 * deduplicates overlapping requests, and creates unified request items.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import Anthropic from '@anthropic-ai/sdk';
import {
  ParsedFeatureRequest,
  FeatureRequestGroup,
  FeatureCategory,
  GroupingResult,
  URGENCY_SCORES,
} from './types.js';

// Category keyword patterns for initial classification
const CATEGORY_KEYWORDS: Record<FeatureCategory, string[]> = {
  security: ['sso', 'saml', 'oauth', 'mfa', '2fa', 'authentication', 'authorization', 'permission', 'role', 'audit', 'log', 'compliance', 'gdpr', 'soc2', 'hipaa', 'encrypt'],
  integrations: ['integration', 'connect', 'sync', 'api', 'webhook', 'zapier', 'salesforce', 'hubspot', 'slack', 'jira', 'import', 'export'],
  reporting: ['report', 'dashboard', 'analytics', 'metric', 'insight', 'visualization', 'chart', 'graph', 'kpi', 'trend'],
  api: ['api', 'endpoint', 'rate limit', 'sdk', 'graphql', 'rest', 'webhook', 'batch', 'bulk'],
  mobile: ['mobile', 'ios', 'android', 'app', 'responsive', 'touch', 'offline'],
  performance: ['performance', 'speed', 'fast', 'slow', 'latency', 'load', 'scale', 'timeout'],
  ui_ux: ['ui', 'ux', 'interface', 'design', 'layout', 'theme', 'dark mode', 'accessibility', 'navigation', 'usability'],
  automation: ['automation', 'workflow', 'trigger', 'rule', 'schedule', 'auto', 'batch', 'cron'],
  compliance: ['compliance', 'audit', 'gdpr', 'hipaa', 'soc2', 'iso', 'security', 'data retention', 'privacy'],
  other: [],
};

// Similarity thresholds
const SIMILARITY_THRESHOLD = 0.7;
const MIN_GROUP_SIZE = 1;

class FeatureRequestGrouperService {
  private supabase: SupabaseClient | null = null;
  private anthropic: Anthropic | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }
  }

  /**
   * Group similar feature requests together
   */
  async groupRequests(
    requests: ParsedFeatureRequest[],
    uploadId: string
  ): Promise<GroupingResult> {
    const startTime = Date.now();

    try {
      // Step 1: Classify by category
      const categorized = this.categorizeRequests(requests);

      // Step 2: Group within each category using semantic similarity
      const groups: FeatureRequestGroup[] = [];

      for (const [category, categoryRequests] of Object.entries(categorized)) {
        if (categoryRequests.length === 0) continue;

        const categoryGroups = await this.groupBySemanticSimilarity(
          categoryRequests,
          category as FeatureCategory
        );

        groups.push(...categoryGroups);
      }

      // Step 3: Find any ungrouped requests
      const groupedIds = new Set(groups.flatMap(g => g.requests.map(r => r.id)));
      const ungrouped = requests.filter(r => !groupedIds.has(r.id));

      // Step 4: Generate group titles and descriptions using AI
      const enhancedGroups = await this.enhanceGroupsWithAI(groups);

      // Step 5: Save to database
      if (this.supabase) {
        await this.saveGroups(uploadId, enhancedGroups);
      }

      return {
        originalCount: requests.length,
        groupedCount: enhancedGroups.length,
        groups: enhancedGroups,
        ungrouped,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[FeatureRequestGrouper] Grouping error:', error);
      throw error;
    }
  }

  /**
   * Categorize requests by feature category
   */
  private categorizeRequests(
    requests: ParsedFeatureRequest[]
  ): Record<FeatureCategory, ParsedFeatureRequest[]> {
    const categorized: Record<FeatureCategory, ParsedFeatureRequest[]> = {
      security: [],
      integrations: [],
      reporting: [],
      api: [],
      mobile: [],
      performance: [],
      ui_ux: [],
      automation: [],
      compliance: [],
      other: [],
    };

    for (const request of requests) {
      const category = this.detectCategory(request.requestNormalized);
      categorized[category].push(request);
    }

    return categorized;
  }

  /**
   * Detect the category of a request
   */
  private detectCategory(normalizedText: string): FeatureCategory {
    const words = normalizedText.split(' ');
    const categoryScores: Record<FeatureCategory, number> = {
      security: 0,
      integrations: 0,
      reporting: 0,
      api: 0,
      mobile: 0,
      performance: 0,
      ui_ux: 0,
      automation: 0,
      compliance: 0,
      other: 0,
    };

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (normalizedText.includes(keyword)) {
          categoryScores[category as FeatureCategory] += 1;
        }
        // Check individual words for exact matches
        if (words.includes(keyword)) {
          categoryScores[category as FeatureCategory] += 0.5;
        }
      }
    }

    // Find highest scoring category
    let maxScore = 0;
    let bestCategory: FeatureCategory = 'other';

    for (const [category, score] of Object.entries(categoryScores)) {
      if (score > maxScore) {
        maxScore = score;
        bestCategory = category as FeatureCategory;
      }
    }

    return bestCategory;
  }

  /**
   * Group requests by semantic similarity within a category
   */
  private async groupBySemanticSimilarity(
    requests: ParsedFeatureRequest[],
    category: FeatureCategory
  ): Promise<FeatureRequestGroup[]> {
    if (requests.length === 0) return [];
    if (requests.length === 1) {
      return [this.createGroup(requests, category)];
    }

    const groups: FeatureRequestGroup[] = [];
    const processed = new Set<string>();

    // Sort by ARR to prioritize high-value customers in group naming
    const sortedRequests = [...requests].sort((a, b) => b.arr - a.arr);

    for (const request of sortedRequests) {
      if (processed.has(request.id)) continue;

      // Find similar requests
      const similar = sortedRequests.filter(r => {
        if (r.id === request.id || processed.has(r.id)) return false;
        return this.calculateSimilarity(request.requestNormalized, r.requestNormalized) >= SIMILARITY_THRESHOLD;
      });

      // Create group with this request and similar ones
      const groupRequests = [request, ...similar];
      groupRequests.forEach(r => processed.add(r.id));

      if (groupRequests.length >= MIN_GROUP_SIZE) {
        groups.push(this.createGroup(groupRequests, category));
      }
    }

    return groups;
  }

  /**
   * Calculate similarity between two normalized request texts
   * Uses Jaccard similarity on word sets
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(' ').filter(w => w.length > 2));
    const words2 = new Set(text2.split(' ').filter(w => w.length > 2));

    if (words1.size === 0 && words2.size === 0) return 1;
    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Create a feature request group
   */
  private createGroup(
    requests: ParsedFeatureRequest[],
    category: FeatureCategory
  ): FeatureRequestGroup {
    const uniqueCustomers = new Set(requests.map(r => r.customerId));
    const totalArr = requests.reduce((sum, r) => sum + r.arr, 0);

    // Calculate average urgency
    const urgencySum = requests.reduce((sum, r) => {
      return sum + (URGENCY_SCORES[r.urgency || 'medium'] || 50);
    }, 0);
    const avgUrgency = urgencySum / requests.length;

    // Extract common keywords
    const keywords = this.extractKeywords(requests.map(r => r.requestNormalized));

    return {
      id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      title: this.generateGroupTitle(requests),
      description: '',
      category,
      requests,
      customerCount: uniqueCustomers.size,
      totalArr,
      avgUrgency,
      keywords,
      createdAt: new Date(),
    };
  }

  /**
   * Generate a preliminary group title from requests
   */
  private generateGroupTitle(requests: ParsedFeatureRequest[]): string {
    // Find most common meaningful words
    const wordCounts = new Map<string, number>();

    for (const request of requests) {
      const words = request.requestNormalized.split(' ')
        .filter(w => w.length > 3 && !this.isStopWord(w));

      for (const word of words) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }

    // Get top words
    const topWords = [...wordCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => word);

    if (topWords.length === 0) {
      return 'Feature Request';
    }

    return topWords.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  /**
   * Extract keywords from request texts
   */
  private extractKeywords(texts: string[]): string[] {
    const wordCounts = new Map<string, number>();

    for (const text of texts) {
      const words = text.split(' ')
        .filter(w => w.length > 2 && !this.isStopWord(w));

      for (const word of words) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }

    // Get words that appear in multiple requests
    return [...wordCounts.entries()]
      .filter(([_, count]) => count >= Math.min(2, texts.length))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Check if a word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
      'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
      'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
      'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
      'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
      'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
      'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
      'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
      'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
      'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
      'need', 'able', 'should', 'would', 'could', 'been', 'have', 'has', 'had', 'was',
      'were', 'being', 'feature', 'request', 'please', 'add', 'support', 'allow', 'enable',
    ]);

    return stopWords.has(word.toLowerCase());
  }

  /**
   * Enhance groups with AI-generated titles and descriptions
   */
  private async enhanceGroupsWithAI(
    groups: FeatureRequestGroup[]
  ): Promise<FeatureRequestGroup[]> {
    if (!this.anthropic || groups.length === 0) {
      return groups;
    }

    try {
      // Batch process groups (up to 20 at a time)
      const batchSize = 20;
      const enhancedGroups: FeatureRequestGroup[] = [];

      for (let i = 0; i < groups.length; i += batchSize) {
        const batch = groups.slice(i, i + batchSize);
        const enhanced = await this.enhanceGroupBatch(batch);
        enhancedGroups.push(...enhanced);
      }

      return enhancedGroups;
    } catch (error) {
      console.error('[FeatureRequestGrouper] AI enhancement error:', error);
      return groups; // Return original groups if AI fails
    }
  }

  /**
   * Enhance a batch of groups with AI
   */
  private async enhanceGroupBatch(
    groups: FeatureRequestGroup[]
  ): Promise<FeatureRequestGroup[]> {
    if (!this.anthropic) return groups;

    const prompt = `You are analyzing grouped feature requests from customers. For each group, generate:
1. A concise, professional title (max 50 chars)
2. A brief description explaining what customers want (1-2 sentences)

Groups to analyze:
${groups.map((g, idx) => `
Group ${idx + 1}:
- Category: ${g.category}
- Customer count: ${g.customerCount}
- Total ARR: $${g.totalArr.toLocaleString()}
- Keywords: ${g.keywords.join(', ')}
- Sample requests:
${g.requests.slice(0, 3).map(r => `  * "${r.request.substring(0, 100)}${r.request.length > 100 ? '...' : ''}"`).join('\n')}
`).join('\n')}

Respond with JSON array:
[
  {"groupIndex": 0, "title": "SSO/SAML Integration", "description": "Customers need enterprise SSO support with SAML for security compliance and streamlined authentication."},
  ...
]`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') return groups;

      // Parse JSON from response
      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return groups;

      const enhancements = JSON.parse(jsonMatch[0]);

      // Apply enhancements
      return groups.map((group, idx) => {
        const enhancement = enhancements.find((e: any) => e.groupIndex === idx);
        if (enhancement) {
          return {
            ...group,
            title: enhancement.title || group.title,
            description: enhancement.description || '',
          };
        }
        return group;
      });
    } catch (error) {
      console.error('[FeatureRequestGrouper] AI batch enhancement error:', error);
      return groups;
    }
  }

  /**
   * Save groups to database
   */
  private async saveGroups(
    uploadId: string,
    groups: FeatureRequestGroup[]
  ): Promise<void> {
    if (!this.supabase) return;

    try {
      // Update upload status
      await this.supabase
        .from('feature_request_uploads')
        .update({
          status: 'grouped',
          unique_groups: groups.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', uploadId);

      // Save groups
      const groupRecords = groups.map(g => ({
        id: g.id,
        upload_id: uploadId,
        title: g.title,
        description: g.description,
        category: g.category,
        keywords: g.keywords,
        request_count: g.requests.length,
        customer_count: g.customerCount,
        total_arr: g.totalArr,
        created_at: new Date().toISOString(),
      }));

      await this.supabase.from('feature_groups').insert(groupRecords);

      // Update requests with group ID
      for (const group of groups) {
        const requestIds = group.requests.map(r => r.id);
        await this.supabase
          .from('feature_requests')
          .update({ group_id: group.id })
          .in('id', requestIds);
      }
    } catch (error) {
      console.error('[FeatureRequestGrouper] Error saving groups:', error);
    }
  }
}

// Singleton instance
export const featureRequestGrouper = new FeatureRequestGrouperService();
export default featureRequestGrouper;
