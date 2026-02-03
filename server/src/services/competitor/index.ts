/**
 * Competitor Intelligence Service
 * PRD-094: Competitor Mentioned - Battle Card
 *
 * Main service that orchestrates competitor detection, battle card retrieval,
 * and alert generation
 */

import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  Competitor,
  CompetitorMention,
  CompetitorMentionAlert,
  DetectionOptions,
  DetectionResult,
  PortfolioCompetitorInsights,
  CompetitorAnalytics,
  BattleCard,
} from './types.js';
import { competitorDetector, DEFAULT_COMPETITORS } from './detector.js';
import { battleCardService } from './battlecard.js';

// Re-export types and services
export * from './types.js';
export { competitorDetector, DEFAULT_COMPETITORS } from './detector.js';
export { battleCardService } from './battlecard.js';

// ============================================
// Competitor Intelligence Service
// ============================================

export class CompetitorIntelligenceService {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Detection & Alert Generation
  // ============================================

  /**
   * Scan text for competitor mentions and create alerts
   */
  async scanForCompetitors(options: DetectionOptions): Promise<CompetitorMentionAlert[]> {
    const detections = competitorDetector.detect(options.text);

    if (detections.length === 0) {
      return [];
    }

    // Get customer context if available
    let customerContext: {
      healthScore?: number;
      arr?: number;
      daysUntilRenewal?: number;
      status?: string;
    } = {};

    if (this.supabase && options.customerId) {
      const { data: customer } = await this.supabase
        .from('customers')
        .select('health_score, arr, renewal_date, status')
        .eq('id', options.customerId)
        .single();

      if (customer) {
        customerContext = {
          healthScore: customer.health_score,
          arr: customer.arr,
          status: customer.status,
          daysUntilRenewal: customer.renewal_date
            ? Math.ceil((new Date(customer.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : undefined,
        };
      }
    }

    const alerts: CompetitorMentionAlert[] = [];

    for (const detection of detections) {
      // Calculate risk level with customer context
      const riskLevel = competitorDetector.calculateRiskLevel(
        detection,
        customerContext.healthScore,
        customerContext.daysUntilRenewal
      );

      // Create mention record
      const mention: CompetitorMention = {
        id: uuidv4(),
        customerId: options.customerId,
        customerName: options.customerName,
        competitorId: detection.competitor.id,
        competitorName: detection.competitor.name,
        sourceType: options.sourceType,
        sourceId: options.sourceId,
        sourceTitle: options.sourceTitle,
        sourceUrl: options.sourceUrl,
        context: detection.context,
        sentiment: detection.sentiment,
        intentSignal: detection.intentSignal,
        featuresMentioned: detection.featuresMentioned,
        riskLevel,
        detectedAt: new Date(),
        detectedBy: 'system',
        acknowledged: false,
        followUpScheduled: false,
      };

      // Save mention to database
      await this.saveMention(mention);

      // Get battle card
      const battleCard = await battleCardService.getBattleCard(detection.competitor.id);

      // Build alert
      const alert: CompetitorMentionAlert = {
        id: uuidv4(),
        mentionId: mention.id,
        customerId: options.customerId,
        customerName: options.customerName || 'Unknown Customer',
        competitorId: detection.competitor.id,
        competitorName: detection.competitor.name,
        customerStatus: (customerContext.status as any) || 'active',
        customerArr: customerContext.arr || 0,
        customerHealthScore: customerContext.healthScore || 50,
        daysUntilRenewal: customerContext.daysUntilRenewal,
        sourceType: options.sourceType,
        sourceTitle: options.sourceTitle,
        context: detection.context,
        sentiment: detection.sentiment,
        riskLevel,
        battleCard: battleCard ? {
          id: battleCard.id,
          keyDifferentiators: battleCard.keyDifferentiators.filter(d => d.importance === 'high').slice(0, 3),
          suggestedTalkTrack: battleCardService.getSuggestedTalkTrack(battleCard, mention),
          suggestedResponse: battleCardService.generateSuggestedResponse(battleCard, mention, {
            name: options.customerName,
          }),
        } : undefined,
        suggestedActions: battleCardService.getSuggestedActions(mention, customerContext),
        createdAt: new Date(),
      };

      alerts.push(alert);
    }

    return alerts;
  }

  /**
   * Save a competitor mention to the database
   */
  async saveMention(mention: CompetitorMention): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('competitor_mentions').insert({
      id: mention.id,
      customer_id: mention.customerId,
      competitor_id: mention.competitorId,
      competitor_name: mention.competitorName,
      source_type: mention.sourceType,
      source_id: mention.sourceId,
      source_title: mention.sourceTitle,
      source_url: mention.sourceUrl,
      context: mention.context,
      full_quote: mention.fullQuote,
      sentiment: mention.sentiment,
      intent_signal: mention.intentSignal,
      features_mentioned: mention.featuresMentioned,
      risk_level: mention.riskLevel,
      detected_at: mention.detectedAt.toISOString(),
      detected_by: mention.detectedBy,
      acknowledged: mention.acknowledged,
    });
  }

  // ============================================
  // Retrieval Methods
  // ============================================

  /**
   * Get competitor mentions for a customer
   */
  async getCustomerMentions(
    customerId: string,
    options: { limit?: number; offset?: number; competitorId?: string } = {}
  ): Promise<{ mentions: CompetitorMention[]; total: number }> {
    if (!this.supabase) {
      return { mentions: [], total: 0 };
    }

    const { limit = 50, offset = 0, competitorId } = options;

    let query = this.supabase
      .from('competitor_mentions')
      .select('*', { count: 'exact' })
      .eq('customer_id', customerId)
      .order('detected_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (competitorId) {
      query = query.eq('competitor_id', competitorId);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('Failed to fetch competitor mentions:', error);
      return { mentions: [], total: 0 };
    }

    return {
      mentions: (data || []).map(this.mapDbMention),
      total: count || 0,
    };
  }

  /**
   * Get recent competitor mentions across all customers
   */
  async getRecentMentions(
    options: { limit?: number; days?: number; riskLevel?: string } = {}
  ): Promise<CompetitorMention[]> {
    if (!this.supabase) return [];

    const { limit = 20, days = 7, riskLevel } = options;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let query = this.supabase
      .from('competitor_mentions')
      .select('*')
      .gte('detected_at', cutoffDate.toISOString())
      .order('detected_at', { ascending: false })
      .limit(limit);

    if (riskLevel) {
      query = query.eq('risk_level', riskLevel);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch recent mentions:', error);
      return [];
    }

    return (data || []).map(this.mapDbMention);
  }

  /**
   * Acknowledge a competitor mention
   */
  async acknowledgeMention(mentionId: string, userId: string): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('competitor_mentions')
      .update({
        acknowledged: true,
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', mentionId);
  }

  // ============================================
  // Analytics Methods
  // ============================================

  /**
   * Get portfolio-wide competitor insights
   */
  async getPortfolioInsights(
    options: { days?: number; userId?: string } = {}
  ): Promise<PortfolioCompetitorInsights> {
    const { days = 30 } = options;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    if (!this.supabase) {
      return {
        totalMentions: 0,
        uniqueCustomers: 0,
        topCompetitors: [],
        atRiskCustomers: [],
        recentMentions: [],
        periodStart: cutoffDate,
        periodEnd: new Date(),
      };
    }

    // Fetch all mentions in period
    const { data: mentions } = await this.supabase
      .from('competitor_mentions')
      .select(`
        *,
        customers (id, name, health_score, arr)
      `)
      .gte('detected_at', cutoffDate.toISOString());

    if (!mentions || mentions.length === 0) {
      return {
        totalMentions: 0,
        uniqueCustomers: 0,
        topCompetitors: [],
        atRiskCustomers: [],
        recentMentions: [],
        periodStart: cutoffDate,
        periodEnd: new Date(),
      };
    }

    // Aggregate by competitor
    const competitorStats = new Map<string, {
      competitorId: string;
      competitorName: string;
      mentionCount: number;
      customers: Set<string>;
      riskScores: number[];
    }>();

    // Aggregate by customer
    const customerStats = new Map<string, {
      customerId: string;
      customerName: string;
      mentions: number;
      lastMentionDate: Date;
      riskLevel: string;
    }>();

    for (const mention of mentions) {
      // Competitor aggregation
      const competitorId = mention.competitor_id;
      if (!competitorStats.has(competitorId)) {
        competitorStats.set(competitorId, {
          competitorId,
          competitorName: mention.competitor_name,
          mentionCount: 0,
          customers: new Set(),
          riskScores: [],
        });
      }
      const compStat = competitorStats.get(competitorId)!;
      compStat.mentionCount++;
      compStat.customers.add(mention.customer_id);
      compStat.riskScores.push(this.riskLevelToScore(mention.risk_level));

      // Customer aggregation
      const customerId = mention.customer_id;
      if (!customerStats.has(customerId)) {
        customerStats.set(customerId, {
          customerId,
          customerName: mention.customers?.name || 'Unknown',
          mentions: 0,
          lastMentionDate: new Date(mention.detected_at),
          riskLevel: mention.risk_level,
        });
      }
      const custStat = customerStats.get(customerId)!;
      custStat.mentions++;
      if (new Date(mention.detected_at) > custStat.lastMentionDate) {
        custStat.lastMentionDate = new Date(mention.detected_at);
        custStat.riskLevel = mention.risk_level;
      }
    }

    // Build top competitors
    const topCompetitors = Array.from(competitorStats.values())
      .map(stat => ({
        competitorId: stat.competitorId,
        competitorName: stat.competitorName,
        mentionCount: stat.mentionCount,
        uniqueCustomers: stat.customers.size,
        avgRiskLevel: stat.riskScores.reduce((a, b) => a + b, 0) / stat.riskScores.length,
      }))
      .sort((a, b) => b.mentionCount - a.mentionCount)
      .slice(0, 10);

    // Build at-risk customers (high/critical risk mentions)
    const atRiskCustomers = Array.from(customerStats.values())
      .filter(c => c.riskLevel === 'high' || c.riskLevel === 'critical')
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 10);

    // Recent mentions
    const recentMentions = mentions
      .sort((a: { detected_at: string }, b: { detected_at: string }) =>
        new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime())
      .slice(0, 10)
      .map(this.mapDbMention);

    return {
      totalMentions: mentions.length,
      uniqueCustomers: customerStats.size,
      topCompetitors,
      atRiskCustomers,
      recentMentions,
      periodStart: cutoffDate,
      periodEnd: new Date(),
    };
  }

  /**
   * Get analytics for a specific competitor
   */
  async getCompetitorAnalytics(
    competitorId: string,
    options: { days?: number } = {}
  ): Promise<CompetitorAnalytics | null> {
    const { days = 90 } = options;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    if (!this.supabase) return null;

    const { data: mentions, error } = await this.supabase
      .from('competitor_mentions')
      .select('*')
      .eq('competitor_id', competitorId)
      .gte('detected_at', cutoffDate.toISOString());

    if (error || !mentions || mentions.length === 0) return null;

    // Aggregate stats
    const mentionsBySource: Record<string, number> = {};
    const sentimentDistribution: Record<string, number> = {};
    const intentDistribution: Record<string, number> = {};
    const featureCounts: Record<string, number> = {};

    for (const mention of mentions) {
      // Source distribution
      mentionsBySource[mention.source_type] = (mentionsBySource[mention.source_type] || 0) + 1;

      // Sentiment distribution
      sentimentDistribution[mention.sentiment] = (sentimentDistribution[mention.sentiment] || 0) + 1;

      // Intent distribution
      intentDistribution[mention.intent_signal] = (intentDistribution[mention.intent_signal] || 0) + 1;

      // Feature counts
      const features = mention.features_mentioned || [];
      for (const feature of features) {
        featureCounts[feature] = (featureCounts[feature] || 0) + 1;
      }
    }

    // Top features
    const topFeaturesMentioned = Object.entries(featureCounts)
      .map(([feature, count]) => ({ feature, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate trend (compare first half vs second half of period)
    const midpoint = new Date(cutoffDate.getTime() + (Date.now() - cutoffDate.getTime()) / 2);
    const firstHalf = mentions.filter(m => new Date(m.detected_at) < midpoint).length;
    const secondHalf = mentions.length - firstHalf;

    let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (secondHalf > firstHalf * 1.2) trendDirection = 'increasing';
    else if (secondHalf < firstHalf * 0.8) trendDirection = 'decreasing';

    const competitor = competitorDetector.getCompetitor(competitorId);

    return {
      competitorId,
      competitorName: competitor?.name || competitorId,
      totalMentions: mentions.length,
      mentionsBySource,
      sentimentDistribution,
      intentDistribution,
      topFeaturesMentioned,
      trendDirection,
      periodStart: cutoffDate,
      periodEnd: new Date(),
    };
  }

  // ============================================
  // Competitor Management
  // ============================================

  /**
   * Get all tracked competitors
   */
  getCompetitors(): Competitor[] {
    return competitorDetector.getCompetitors();
  }

  /**
   * Get a single competitor
   */
  getCompetitor(id: string): Competitor | undefined {
    return competitorDetector.getCompetitor(id);
  }

  /**
   * Add a custom competitor
   */
  async addCompetitor(competitor: Omit<Competitor, 'id' | 'createdAt' | 'updatedAt'>): Promise<Competitor> {
    const newCompetitor: Competitor = {
      ...competitor,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add to detector
    competitorDetector.addCompetitor(newCompetitor);

    // Save to database
    if (this.supabase) {
      await this.supabase.from('competitors').insert({
        id: newCompetitor.id,
        name: newCompetitor.name,
        aliases: newCompetitor.aliases,
        website: newCompetitor.website,
        category: newCompetitor.category,
        strengths: newCompetitor.strengths,
        weaknesses: newCompetitor.weaknesses,
        created_at: newCompetitor.createdAt.toISOString(),
      });
    }

    return newCompetitor;
  }

  // ============================================
  // Battle Card Access
  // ============================================

  /**
   * Get battle card for a competitor
   */
  async getBattleCard(competitorId: string): Promise<BattleCard | null> {
    return battleCardService.getBattleCard(competitorId);
  }

  /**
   * Get all battle cards
   */
  async getAllBattleCards(): Promise<BattleCard[]> {
    return battleCardService.getAllBattleCards();
  }

  // ============================================
  // Helper Methods
  // ============================================

  private riskLevelToScore(level: string): number {
    switch (level) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  private mapDbMention(row: Record<string, unknown>): CompetitorMention {
    return {
      id: row.id as string,
      customerId: row.customer_id as string,
      customerName: (row.customers as any)?.name,
      competitorId: row.competitor_id as string,
      competitorName: row.competitor_name as string,
      sourceType: row.source_type as CompetitorMention['sourceType'],
      sourceId: row.source_id as string,
      sourceTitle: row.source_title as string | undefined,
      sourceUrl: row.source_url as string | undefined,
      context: row.context as string,
      fullQuote: row.full_quote as string | undefined,
      sentiment: row.sentiment as CompetitorMention['sentiment'],
      intentSignal: row.intent_signal as CompetitorMention['intentSignal'],
      featuresMentioned: (row.features_mentioned as string[]) || [],
      riskLevel: row.risk_level as CompetitorMention['riskLevel'],
      detectedAt: new Date(row.detected_at as string),
      detectedBy: row.detected_by as 'system' | 'manual',
      acknowledged: row.acknowledged as boolean,
      acknowledgedBy: row.acknowledged_by as string | undefined,
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at as string) : undefined,
      followUpScheduled: row.follow_up_scheduled as boolean || false,
      notes: row.notes as string | undefined,
    };
  }
}

// Singleton instance
export const competitorIntelligenceService = new CompetitorIntelligenceService();
