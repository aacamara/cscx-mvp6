/**
 * Priority Scorer Service
 * PRD-016: Feature Request List Prioritization Scoring
 *
 * Calculates priority scores for grouped feature requests based on:
 * - ARR Impact (30%)
 * - Customer Count (20%)
 * - Urgency (20%)
 * - Competitive Necessity (15%)
 * - Strategic Alignment (15%)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import Anthropic from '@anthropic-ai/sdk';
import {
  FeatureRequestGroup,
  PriorityScore,
  ScoreBreakdown,
  ComponentScore,
  CompetitiveContext,
  CustomerRequestSummary,
  CustomerQuote,
  FeatureRequestScoreResult,
  PrioritizationMatrix,
  SCORE_WEIGHTS,
  URGENCY_SCORES,
} from './types.js';

// Competitors for competitive analysis
const KNOWN_COMPETITORS = ['Gainsight', 'ChurnZero', 'Totango', 'ClientSuccess', 'Planhat'];

class PriorityScorerService {
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
   * Score and prioritize feature request groups
   */
  async scoreGroups(
    groups: FeatureRequestGroup[],
    uploadId: string,
    options: {
      includeCompetitiveAnalysis?: boolean;
      strategicGoals?: string[];
    } = {}
  ): Promise<FeatureRequestScoreResult> {
    const startTime = Date.now();

    try {
      // Calculate global maximums for normalization
      const maxArr = Math.max(...groups.map(g => g.totalArr), 1);
      const maxCustomerCount = Math.max(...groups.map(g => g.customerCount), 1);

      // Score each group
      const scoredGroups: PriorityScore[] = [];

      for (const group of groups) {
        const score = await this.scoreGroup(group, {
          maxArr,
          maxCustomerCount,
          includeCompetitiveAnalysis: options.includeCompetitiveAnalysis,
          strategicGoals: options.strategicGoals,
        });
        scoredGroups.push(score);
      }

      // Sort by overall score and assign ranks
      scoredGroups.sort((a, b) => b.overallScore - a.overallScore);
      scoredGroups.forEach((score, idx) => {
        score.rank = idx + 1;
      });

      // Build prioritization matrix
      const matrix = this.buildPrioritizationMatrix(scoredGroups);

      // Save scores to database
      if (this.supabase) {
        await this.saveScores(uploadId, scoredGroups);
      }

      return {
        success: true,
        uploadId,
        scoredAt: new Date(),
        totalScored: scoredGroups.length,
        prioritizedList: scoredGroups,
        matrix,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[PriorityScorer] Scoring error:', error);
      throw error;
    }
  }

  /**
   * Score a single feature request group
   */
  private async scoreGroup(
    group: FeatureRequestGroup,
    context: {
      maxArr: number;
      maxCustomerCount: number;
      includeCompetitiveAnalysis?: boolean;
      strategicGoals?: string[];
    }
  ): Promise<PriorityScore> {
    // Calculate component scores
    const arrImpact = this.calculateArrImpactScore(group.totalArr, context.maxArr);
    const customerCount = this.calculateCustomerCountScore(group.customerCount, context.maxCustomerCount);
    const urgency = this.calculateUrgencyScore(group.avgUrgency);

    // Competitive analysis (if enabled)
    let competitive: ComponentScore;
    let competitiveContext: CompetitiveContext | undefined;

    if (context.includeCompetitiveAnalysis) {
      const analysis = await this.analyzeCompetitiveContext(group);
      competitiveContext = analysis.context;
      competitive = analysis.score;
    } else {
      competitive = {
        raw: 50,
        normalized: 50,
        weight: SCORE_WEIGHTS.competitive,
        weighted: 50 * SCORE_WEIGHTS.competitive,
      };
    }

    // Strategic alignment score
    const strategic = this.calculateStrategicScore(group, context.strategicGoals);

    // Build breakdown
    const breakdown: ScoreBreakdown = {
      arrImpact,
      customerCount,
      urgency,
      competitive,
      strategic,
    };

    // Calculate overall score (weighted sum)
    const overallScore = Math.round(
      arrImpact.weighted +
      customerCount.weighted +
      urgency.weighted +
      competitive.weighted +
      strategic.weighted
    );

    // Determine urgency level
    const urgencyLevel = this.determineUrgencyLevel(group.avgUrgency);

    // Extract customer summaries and quotes
    const requestingCustomers = this.extractCustomerSummaries(group);
    const quotes = this.extractQuotes(group);

    // Generate recommendation
    const recommendation = this.generateRecommendation(group, overallScore, breakdown);

    return {
      groupId: group.id,
      title: group.title,
      description: group.description,
      overallScore,
      breakdown,
      customerCount: group.customerCount,
      totalArrImpact: group.totalArr,
      urgencyLevel,
      competitiveContext,
      requestingCustomers,
      quotes,
      recommendation,
      rank: 0, // Will be set after sorting
    };
  }

  /**
   * Calculate ARR impact score
   */
  private calculateArrImpactScore(arr: number, maxArr: number): ComponentScore {
    const normalized = maxArr > 0 ? Math.round((arr / maxArr) * 100) : 0;
    return {
      raw: arr,
      normalized,
      weight: SCORE_WEIGHTS.arrImpact,
      weighted: normalized * SCORE_WEIGHTS.arrImpact,
    };
  }

  /**
   * Calculate customer count score
   */
  private calculateCustomerCountScore(count: number, maxCount: number): ComponentScore {
    const normalized = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
    return {
      raw: count,
      normalized,
      weight: SCORE_WEIGHTS.customerCount,
      weighted: normalized * SCORE_WEIGHTS.customerCount,
    };
  }

  /**
   * Calculate urgency score
   */
  private calculateUrgencyScore(avgUrgency: number): ComponentScore {
    // avgUrgency is already 0-100
    const normalized = Math.round(avgUrgency);
    return {
      raw: avgUrgency,
      normalized,
      weight: SCORE_WEIGHTS.urgency,
      weighted: normalized * SCORE_WEIGHTS.urgency,
    };
  }

  /**
   * Analyze competitive context using AI
   */
  private async analyzeCompetitiveContext(
    group: FeatureRequestGroup
  ): Promise<{ context: CompetitiveContext; score: ComponentScore }> {
    // Default competitive context
    const defaultContext: CompetitiveContext = {
      competitors: KNOWN_COMPETITORS.map(name => ({ name, hasFeature: false })),
      isTableStakes: false,
      marketTrend: 'stable' as const,
    };

    if (!this.anthropic) {
      return {
        context: defaultContext,
        score: {
          raw: 50,
          normalized: 50,
          weight: SCORE_WEIGHTS.competitive,
          weighted: 50 * SCORE_WEIGHTS.competitive,
        },
      };
    }

    try {
      const prompt = `Analyze this feature request from a competitive perspective in the Customer Success software market.

Feature: ${group.title}
Description: ${group.description}
Keywords: ${group.keywords.join(', ')}
Category: ${group.category}

Known competitors: ${KNOWN_COMPETITORS.join(', ')}

Respond with JSON only:
{
  "competitors": [{"name": "CompetitorName", "hasFeature": true, "quality": "basic|standard|advanced"}],
  "isTableStakes": true/false,
  "marketTrend": "emerging|growing|mature|declining",
  "competitiveScore": 0-100 (higher = more competitively necessary)
}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      const context: CompetitiveContext = {
        competitors: analysis.competitors || defaultContext.competitors,
        isTableStakes: analysis.isTableStakes || false,
        marketTrend: analysis.marketTrend || 'stable',
      };

      const normalized = analysis.competitiveScore || 50;

      return {
        context,
        score: {
          raw: normalized,
          normalized,
          weight: SCORE_WEIGHTS.competitive,
          weighted: normalized * SCORE_WEIGHTS.competitive,
        },
      };
    } catch (error) {
      console.error('[PriorityScorer] Competitive analysis error:', error);
      return {
        context: defaultContext,
        score: {
          raw: 50,
          normalized: 50,
          weight: SCORE_WEIGHTS.competitive,
          weighted: 50 * SCORE_WEIGHTS.competitive,
        },
      };
    }
  }

  /**
   * Calculate strategic alignment score
   */
  private calculateStrategicScore(
    group: FeatureRequestGroup,
    strategicGoals?: string[]
  ): ComponentScore {
    // Default strategic priorities
    const defaultPriorities = [
      'enterprise',
      'security',
      'compliance',
      'integrations',
      'automation',
    ];

    const priorities = strategicGoals || defaultPriorities;

    // Check category alignment
    let alignmentScore = 50; // Base score

    if (priorities.includes(group.category)) {
      alignmentScore += 30;
    }

    // Enterprise segment bonus
    const enterpriseRequests = group.requests.filter(r => r.segment === 'enterprise').length;
    if (enterpriseRequests > 0) {
      alignmentScore += Math.min(20, enterpriseRequests * 5);
    }

    const normalized = Math.min(100, alignmentScore);

    return {
      raw: alignmentScore,
      normalized,
      weight: SCORE_WEIGHTS.strategic,
      weighted: normalized * SCORE_WEIGHTS.strategic,
    };
  }

  /**
   * Determine urgency level from average score
   */
  private determineUrgencyLevel(avgUrgency: number): 'critical' | 'high' | 'medium' | 'low' {
    if (avgUrgency >= 85) return 'critical';
    if (avgUrgency >= 65) return 'high';
    if (avgUrgency >= 40) return 'medium';
    return 'low';
  }

  /**
   * Extract customer summaries from group
   */
  private extractCustomerSummaries(group: FeatureRequestGroup): CustomerRequestSummary[] {
    // Group requests by customer
    const customerMap = new Map<string, {
      customerId: string;
      customerName: string;
      arr: number;
      segment: string;
      urgencies: string[];
      contexts: string[];
    }>();

    for (const request of group.requests) {
      const existing = customerMap.get(request.customerId);
      if (existing) {
        if (request.urgency) existing.urgencies.push(request.urgency);
        if (request.context) existing.contexts.push(request.context);
      } else {
        customerMap.set(request.customerId, {
          customerId: request.customerId,
          customerName: request.customerName,
          arr: request.arr,
          segment: request.segment,
          urgencies: request.urgency ? [request.urgency] : [],
          contexts: request.context ? [request.context] : [],
        });
      }
    }

    // Convert to summaries sorted by ARR
    return Array.from(customerMap.values())
      .map(c => ({
        customerId: c.customerId,
        customerName: c.customerName,
        arr: c.arr,
        urgency: this.getMostUrgent(c.urgencies),
        context: c.contexts[0],
        segment: c.segment,
      }))
      .sort((a, b) => b.arr - a.arr);
  }

  /**
   * Get the most urgent level from a list
   */
  private getMostUrgent(urgencies: string[]): string {
    if (urgencies.includes('critical')) return 'critical';
    if (urgencies.includes('high')) return 'high';
    if (urgencies.includes('medium')) return 'medium';
    if (urgencies.includes('low')) return 'low';
    return 'medium';
  }

  /**
   * Extract customer quotes from group
   */
  private extractQuotes(group: FeatureRequestGroup): CustomerQuote[] {
    const quotes: CustomerQuote[] = [];

    for (const request of group.requests) {
      // Check if context contains quote-like content
      if (request.context && request.context.length > 20) {
        quotes.push({
          customerId: request.customerId,
          customerName: request.customerName,
          quote: request.context,
          source: request.source || 'feedback',
          date: request.submittedAt,
        });
      }
    }

    // Return top 5 quotes by ARR
    return quotes
      .sort((a, b) => {
        const reqA = group.requests.find(r => r.customerId === a.customerId);
        const reqB = group.requests.find(r => r.customerId === b.customerId);
        return (reqB?.arr || 0) - (reqA?.arr || 0);
      })
      .slice(0, 5);
  }

  /**
   * Generate recommendation based on score
   */
  private generateRecommendation(
    group: FeatureRequestGroup,
    score: number,
    breakdown: ScoreBreakdown
  ): string {
    if (score >= 85) {
      return 'Must-have for next release. High ARR impact and customer demand.';
    }
    if (score >= 70) {
      return 'Priority candidate for current quarter roadmap.';
    }
    if (score >= 55) {
      return 'Consider for next quarter based on resource availability.';
    }
    if (score >= 40) {
      return 'Track for future consideration. Monitor demand trends.';
    }
    return 'Lower priority. Revisit if demand increases.';
  }

  /**
   * Build prioritization matrix (2x2 urgency vs ARR)
   */
  private buildPrioritizationMatrix(scores: PriorityScore[]): PrioritizationMatrix {
    // Calculate thresholds
    const avgArr = scores.reduce((sum, s) => sum + s.totalArrImpact, 0) / scores.length;
    const avgUrgency = scores.reduce((sum, s) => sum + s.breakdown.urgency.normalized, 0) / scores.length;

    const quadrants = {
      highUrgencyHighArr: [] as PriorityScore[],
      highUrgencyLowArr: [] as PriorityScore[],
      lowUrgencyHighArr: [] as PriorityScore[],
      lowUrgencyLowArr: [] as PriorityScore[],
    };

    for (const score of scores) {
      const isHighUrgency = score.breakdown.urgency.normalized >= avgUrgency;
      const isHighArr = score.totalArrImpact >= avgArr;

      if (isHighUrgency && isHighArr) {
        quadrants.highUrgencyHighArr.push(score);
      } else if (isHighUrgency && !isHighArr) {
        quadrants.highUrgencyLowArr.push(score);
      } else if (!isHighUrgency && isHighArr) {
        quadrants.lowUrgencyHighArr.push(score);
      } else {
        quadrants.lowUrgencyLowArr.push(score);
      }
    }

    return {
      quadrants,
      avgArrThreshold: avgArr,
      avgUrgencyThreshold: avgUrgency,
    };
  }

  /**
   * Save scores to database
   */
  private async saveScores(uploadId: string, scores: PriorityScore[]): Promise<void> {
    if (!this.supabase) return;

    try {
      // Update upload status
      await this.supabase
        .from('feature_request_uploads')
        .update({
          status: 'scored',
          updated_at: new Date().toISOString(),
        })
        .eq('id', uploadId);

      // Update groups with scores
      for (const score of scores) {
        await this.supabase
          .from('feature_groups')
          .update({
            priority_score: score.overallScore,
            priority_rank: score.rank,
          })
          .eq('id', score.groupId);
      }
    } catch (error) {
      console.error('[PriorityScorer] Error saving scores:', error);
    }
  }
}

// Singleton instance
export const priorityScorer = new PriorityScorerService();
export default priorityScorer;
