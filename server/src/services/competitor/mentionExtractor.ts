/**
 * Competitor Mention Extractor Service
 * PRD-011: Competitor Mention Analysis -> Battle Card
 *
 * Extracts and analyzes competitor mentions from various data sources
 * including meeting transcripts, support tickets, sales notes, and survey responses.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  CompetitorMention,
  DetectionResult,
  CompetitorAnalytics,
  PortfolioCompetitorInsights,
  SuggestedAction,
} from './types.js';
import { competitorDetector } from './detector.js';
import { battleCardService } from './battlecard.js';

// ============================================
// Types
// ============================================

export interface DataSource {
  type: 'meeting_transcript' | 'support_ticket' | 'sales_note' | 'survey_response' | 'email';
  id: string;
  title?: string;
  content: string;
  customerId: string;
  customerName?: string;
  createdAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface ExtractedMentionsResult {
  totalDocuments: number;
  dateRange: {
    start: Date;
    end: Date;
  };
  uniqueCustomers: number;
  mentions: CompetitorMention[];
  competitorSummary: Array<{
    competitorId: string;
    competitorName: string;
    mentionCount: number;
    uniqueCustomers: number;
    threatLevel: 'low' | 'medium' | 'high';
    trend: 'increasing' | 'decreasing' | 'stable';
  }>;
  contextAnalysis: Record<string, {
    pricing: number;
    features: number;
    migration: number;
    general: number;
  }>;
  atRiskAccounts: Array<{
    customerId: string;
    customerName: string;
    arr: number;
    competitor: string;
    riskSignals: string[];
  }>;
}

export interface UploadAnalysisResult {
  documentCount: number;
  dateRange: {
    start: string;
    end: string;
  };
  customers: number;
  mentionStats: {
    total: number;
    byCompetitor: Array<{
      name: string;
      count: number;
      customers: number;
      threatLevel: string;
      trend: string;
    }>;
  };
  contextBreakdown: Record<string, {
    pricing: { count: number; percentage: number };
    features: { count: number; percentage: number };
    migration: { count: number; percentage: number };
    general: { count: number; percentage: number };
  }>;
  keyThemes: Array<{
    theme: string;
    count: number;
    examples: string[];
  }>;
  atRiskAccounts: Array<{
    customerId: string;
    customerName: string;
    arr: number;
    competitor: string;
    riskSignals: string[];
    status: 'active_evaluation' | 'mentioned' | 'general_awareness';
  }>;
}

// ============================================
// Context Detection Patterns
// ============================================

const CONTEXT_PATTERNS = {
  pricing: [
    'price', 'pricing', 'cost', 'cheaper', 'expensive', 'afford', 'budget',
    'discount', 'deal', 'contract value', 'quote', 'proposal', '% off',
    'per seat', 'per user', 'license', 'subscription'
  ],
  features: [
    'feature', 'capability', 'functionality', 'integration', 'api', 'workflow',
    'automation', 'dashboard', 'reporting', 'analytics', 'ui', 'ux', 'mobile',
    'app', 'platform', 'tool', 'module'
  ],
  migration: [
    'switch', 'migrate', 'migration', 'move to', 'moving to', 'transition',
    'replace', 'replacing', 'leaving', 'left', 'churned', 'cancel', 'cancelation',
    'alternative', 'evaluating', 'considering'
  ],
  general: [
    'heard about', 'know about', 'mentioned', 'saw', 'read', 'article',
    'competitor', 'competition', 'market', 'industry', 'vendor', 'provider'
  ]
};

// Theme extraction patterns
const THEME_PATTERNS = [
  { pattern: /(\w+)\s+is\s+(\d+%?)\s+cheaper/gi, theme: '{0} is {1} cheaper' },
  { pattern: /better\s+(\w+)\s+(?:app|experience|ui)/gi, theme: 'better {0} experience' },
  { pattern: /mentioned\s+by\s+(?:our|the)\s+(\w+)/gi, theme: 'mentioned by {0}' },
  { pattern: /faster\s+(\w+)/gi, theme: 'faster {0}' },
  { pattern: /easier\s+to\s+(\w+)/gi, theme: 'easier to {0}' },
  { pattern: /more\s+(\w+)\s+features/gi, theme: 'more {0} features' },
];

// ============================================
// Mention Extractor Service
// ============================================

export class MentionExtractorService {
  private supabase: SupabaseClient | null = null;
  private mentionsCache: Map<string, CompetitorMention[]> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Extract competitor mentions from multiple data sources
   */
  async extractMentions(sources: DataSource[]): Promise<ExtractedMentionsResult> {
    const mentions: CompetitorMention[] = [];
    const customerSet = new Set<string>();
    const competitorMentionMap = new Map<string, { mentions: CompetitorMention[]; customers: Set<string> }>();
    const contextAnalysis: Record<string, { pricing: number; features: number; migration: number; general: number }> = {};

    let earliestDate = new Date();
    let latestDate = new Date(0);

    for (const source of sources) {
      customerSet.add(source.customerId);

      // Update date range
      const sourceDate = source.createdAt || new Date();
      if (sourceDate < earliestDate) earliestDate = sourceDate;
      if (sourceDate > latestDate) latestDate = sourceDate;

      // Detect competitor mentions in the content
      const detectionResults = competitorDetector.detect(source.content);

      for (const detection of detectionResults) {
        // Calculate risk level
        const riskLevel = competitorDetector.calculateRiskLevel(detection);

        // Detect context category
        const contextCategory = this.detectContextCategory(detection.context);

        // Create mention record
        const mention: CompetitorMention = {
          id: crypto.randomUUID(),
          customerId: source.customerId,
          customerName: source.customerName,
          competitorId: detection.competitor.id,
          competitorName: detection.competitor.name,
          sourceType: this.mapSourceType(source.type),
          sourceId: source.id,
          sourceTitle: source.title,
          context: detection.context,
          fullQuote: detection.context,
          sentiment: detection.sentiment,
          intentSignal: detection.intentSignal,
          featuresMentioned: detection.featuresMentioned,
          riskLevel,
          detectedAt: new Date(),
          detectedBy: 'system',
          acknowledged: false,
          followUpScheduled: false,
        };

        mentions.push(mention);

        // Track by competitor
        if (!competitorMentionMap.has(detection.competitor.id)) {
          competitorMentionMap.set(detection.competitor.id, {
            mentions: [],
            customers: new Set(),
          });
        }
        const competitorData = competitorMentionMap.get(detection.competitor.id)!;
        competitorData.mentions.push(mention);
        competitorData.customers.add(source.customerId);

        // Track context analysis by competitor
        if (!contextAnalysis[detection.competitor.id]) {
          contextAnalysis[detection.competitor.id] = { pricing: 0, features: 0, migration: 0, general: 0 };
        }
        contextAnalysis[detection.competitor.id][contextCategory]++;
      }
    }

    // Build competitor summary
    const competitorSummary = Array.from(competitorMentionMap.entries())
      .map(([competitorId, data]) => {
        const competitor = competitorDetector.getCompetitor(competitorId);
        const avgRiskScore = this.calculateAverageRiskScore(data.mentions);

        return {
          competitorId,
          competitorName: competitor?.name || competitorId,
          mentionCount: data.mentions.length,
          uniqueCustomers: data.customers.size,
          threatLevel: this.riskScoreToLevel(avgRiskScore),
          trend: this.calculateTrend(data.mentions) as 'increasing' | 'decreasing' | 'stable',
        };
      })
      .sort((a, b) => b.mentionCount - a.mentionCount);

    // Identify at-risk accounts
    const atRiskAccounts = await this.identifyAtRiskAccounts(mentions);

    return {
      totalDocuments: sources.length,
      dateRange: {
        start: earliestDate,
        end: latestDate,
      },
      uniqueCustomers: customerSet.size,
      mentions,
      competitorSummary,
      contextAnalysis,
      atRiskAccounts,
    };
  }

  /**
   * Analyze uploaded files for competitor mentions
   */
  async analyzeUpload(
    files: Array<{ name: string; content: string; type: string }>,
    options: { customerId?: string; customerName?: string } = {}
  ): Promise<UploadAnalysisResult> {
    // Convert files to data sources
    const sources: DataSource[] = files.map((file, index) => ({
      type: this.inferSourceType(file.name, file.type),
      id: `upload-${Date.now()}-${index}`,
      title: file.name,
      content: file.content,
      customerId: options.customerId || 'unknown',
      customerName: options.customerName,
      createdAt: new Date(),
    }));

    const result = await this.extractMentions(sources);

    // Extract key themes
    const keyThemes = this.extractKeyThemes(result.mentions);

    // Format context breakdown
    const contextBreakdown: Record<string, {
      pricing: { count: number; percentage: number };
      features: { count: number; percentage: number };
      migration: { count: number; percentage: number };
      general: { count: number; percentage: number };
    }> = {};

    for (const [competitorId, context] of Object.entries(result.contextAnalysis)) {
      const total = context.pricing + context.features + context.migration + context.general;
      contextBreakdown[competitorId] = {
        pricing: { count: context.pricing, percentage: total > 0 ? Math.round((context.pricing / total) * 100) : 0 },
        features: { count: context.features, percentage: total > 0 ? Math.round((context.features / total) * 100) : 0 },
        migration: { count: context.migration, percentage: total > 0 ? Math.round((context.migration / total) * 100) : 0 },
        general: { count: context.general, percentage: total > 0 ? Math.round((context.general / total) * 100) : 0 },
      };
    }

    return {
      documentCount: sources.length,
      dateRange: {
        start: result.dateRange.start.toISOString(),
        end: result.dateRange.end.toISOString(),
      },
      customers: result.uniqueCustomers,
      mentionStats: {
        total: result.mentions.length,
        byCompetitor: result.competitorSummary.map(c => ({
          name: c.competitorName,
          count: c.mentionCount,
          customers: c.uniqueCustomers,
          threatLevel: c.threatLevel,
          trend: c.trend,
        })),
      },
      contextBreakdown,
      keyThemes,
      atRiskAccounts: result.atRiskAccounts.map(a => ({
        ...a,
        status: this.determineAccountStatus(a, result.mentions) as 'active_evaluation' | 'mentioned' | 'general_awareness',
      })),
    };
  }

  /**
   * Get competitor analytics for a specific time period
   */
  async getCompetitorAnalytics(
    competitorId: string,
    periodDays: number = 30
  ): Promise<CompetitorAnalytics> {
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);
    const periodEnd = new Date();

    // Get mentions from database or cache
    const mentions = await this.getMentionsForPeriod(competitorId, periodStart, periodEnd);

    const mentionsBySource: Record<string, number> = {};
    const sentimentDistribution: Record<string, number> = {};
    const intentDistribution: Record<string, number> = {};
    const featureCounts: Record<string, number> = {};

    for (const mention of mentions) {
      // Count by source
      mentionsBySource[mention.sourceType] = (mentionsBySource[mention.sourceType] || 0) + 1;

      // Sentiment distribution
      sentimentDistribution[mention.sentiment] = (sentimentDistribution[mention.sentiment] || 0) + 1;

      // Intent distribution
      intentDistribution[mention.intentSignal] = (intentDistribution[mention.intentSignal] || 0) + 1;

      // Feature counts
      for (const feature of mention.featuresMentioned) {
        featureCounts[feature] = (featureCounts[feature] || 0) + 1;
      }
    }

    const topFeaturesMentioned = Object.entries(featureCounts)
      .map(([feature, count]) => ({ feature, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const competitor = competitorDetector.getCompetitor(competitorId);

    return {
      competitorId,
      competitorName: competitor?.name || competitorId,
      totalMentions: mentions.length,
      mentionsBySource,
      sentimentDistribution,
      intentDistribution,
      topFeaturesMentioned,
      trendDirection: this.calculateTrend(mentions),
      periodStart,
      periodEnd,
    };
  }

  /**
   * Get portfolio-wide competitor insights
   */
  async getPortfolioInsights(periodDays: number = 30): Promise<PortfolioCompetitorInsights> {
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);
    const periodEnd = new Date();

    // Get all mentions for period
    const allMentions = await this.getAllMentionsForPeriod(periodStart, periodEnd);

    const customerSet = new Set<string>();
    const competitorStats = new Map<string, { mentionCount: number; customers: Set<string>; riskScores: number[] }>();
    const atRiskCustomers: Array<{
      customerId: string;
      customerName: string;
      competitorMentions: number;
      lastMentionDate: Date;
      riskLevel: string;
    }> = [];

    for (const mention of allMentions) {
      customerSet.add(mention.customerId);

      if (!competitorStats.has(mention.competitorId)) {
        competitorStats.set(mention.competitorId, {
          mentionCount: 0,
          customers: new Set(),
          riskScores: [],
        });
      }

      const stats = competitorStats.get(mention.competitorId)!;
      stats.mentionCount++;
      stats.customers.add(mention.customerId);
      stats.riskScores.push(this.riskLevelToScore(mention.riskLevel));
    }

    // Build top competitors list
    const topCompetitors = Array.from(competitorStats.entries())
      .map(([competitorId, stats]) => ({
        competitorId,
        competitorName: competitorDetector.getCompetitor(competitorId)?.name || competitorId,
        mentionCount: stats.mentionCount,
        uniqueCustomers: stats.customers.size,
        avgRiskLevel: stats.riskScores.reduce((a, b) => a + b, 0) / stats.riskScores.length,
      }))
      .sort((a, b) => b.mentionCount - a.mentionCount)
      .slice(0, 10);

    // Identify at-risk customers (high/critical risk mentions)
    const customerMentions = new Map<string, CompetitorMention[]>();
    for (const mention of allMentions) {
      if (!customerMentions.has(mention.customerId)) {
        customerMentions.set(mention.customerId, []);
      }
      customerMentions.get(mention.customerId)!.push(mention);
    }

    for (const [customerId, mentions] of customerMentions) {
      const highRiskMentions = mentions.filter(m => m.riskLevel === 'high' || m.riskLevel === 'critical');
      if (highRiskMentions.length > 0) {
        const latestMention = mentions.reduce((latest, m) =>
          m.detectedAt > latest.detectedAt ? m : latest
        );

        atRiskCustomers.push({
          customerId,
          customerName: mentions[0].customerName || customerId,
          competitorMentions: mentions.length,
          lastMentionDate: latestMention.detectedAt,
          riskLevel: highRiskMentions[0].riskLevel,
        });
      }
    }

    return {
      totalMentions: allMentions.length,
      uniqueCustomers: customerSet.size,
      topCompetitors,
      atRiskCustomers: atRiskCustomers.sort((a, b) => b.competitorMentions - a.competitorMentions),
      recentMentions: allMentions.slice(0, 20),
      periodStart,
      periodEnd,
    };
  }

  /**
   * Save mention to database
   */
  async saveMention(mention: CompetitorMention): Promise<CompetitorMention> {
    if (this.supabase) {
      const { error } = await this.supabase
        .from('competitor_mentions')
        .upsert({
          id: mention.id,
          customer_id: mention.customerId,
          customer_name: mention.customerName,
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
          acknowledged_by: mention.acknowledgedBy,
          acknowledged_at: mention.acknowledgedAt?.toISOString(),
          follow_up_scheduled: mention.followUpScheduled,
          notes: mention.notes,
        });

      if (error) {
        console.error('Failed to save mention:', error);
      }
    }

    return mention;
  }

  /**
   * Get mentions for a specific customer
   */
  async getMentionsForCustomer(customerId: string): Promise<CompetitorMention[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('competitor_mentions')
        .select('*')
        .eq('customer_id', customerId)
        .order('detected_at', { ascending: false });

      if (!error && data) {
        return data.map(this.mapDbMention);
      }
    }

    // Fallback to cache
    return this.mentionsCache.get(customerId) || [];
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private mapSourceType(type: DataSource['type']): CompetitorMention['sourceType'] {
    const mapping: Record<DataSource['type'], CompetitorMention['sourceType']> = {
      meeting_transcript: 'meeting',
      support_ticket: 'support_ticket',
      sales_note: 'document',
      survey_response: 'document',
      email: 'email',
    };
    return mapping[type] || 'document';
  }

  private inferSourceType(fileName: string, mimeType: string): DataSource['type'] {
    const lowerName = fileName.toLowerCase();

    if (lowerName.includes('transcript') || lowerName.includes('meeting') || lowerName.includes('call')) {
      return 'meeting_transcript';
    }
    if (lowerName.includes('ticket') || lowerName.includes('support') || lowerName.includes('case')) {
      return 'support_ticket';
    }
    if (lowerName.includes('survey') || lowerName.includes('feedback') || lowerName.includes('nps')) {
      return 'survey_response';
    }
    if (lowerName.includes('sales') || lowerName.includes('note')) {
      return 'sales_note';
    }

    return 'meeting_transcript'; // Default
  }

  private detectContextCategory(context: string): 'pricing' | 'features' | 'migration' | 'general' {
    const contextLower = context.toLowerCase();

    let maxScore = 0;
    let maxCategory: 'pricing' | 'features' | 'migration' | 'general' = 'general';

    for (const [category, patterns] of Object.entries(CONTEXT_PATTERNS)) {
      let score = 0;
      for (const pattern of patterns) {
        if (contextLower.includes(pattern)) {
          score++;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        maxCategory = category as 'pricing' | 'features' | 'migration' | 'general';
      }
    }

    return maxCategory;
  }

  private extractKeyThemes(mentions: CompetitorMention[]): Array<{ theme: string; count: number; examples: string[] }> {
    const themeCounts = new Map<string, { count: number; examples: string[] }>();

    // Common theme patterns
    const themePatterns = [
      { regex: /(\d+%?)\s+cheaper/gi, template: '{1} cheaper' },
      { regex: /better\s+(\w+)\s+(?:app|experience)/gi, template: 'better {1} experience' },
      { regex: /mentioned\s+by\s+(?:our|the)\s+(\w+)/gi, template: 'mentioned by {1}' },
      { regex: /easier\s+to\s+(\w+)/gi, template: 'easier to {1}' },
    ];

    for (const mention of mentions) {
      const context = mention.context;

      for (const { regex, template } of themePatterns) {
        const matches = context.matchAll(new RegExp(regex));
        for (const match of matches) {
          let theme = template;
          for (let i = 1; i < match.length; i++) {
            theme = theme.replace(`{${i}}`, match[i]);
          }

          if (!themeCounts.has(theme)) {
            themeCounts.set(theme, { count: 0, examples: [] });
          }
          const data = themeCounts.get(theme)!;
          data.count++;
          if (data.examples.length < 3) {
            data.examples.push(context.slice(0, 100));
          }
        }
      }
    }

    return Array.from(themeCounts.entries())
      .map(([theme, data]) => ({ theme, count: data.count, examples: data.examples }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private async identifyAtRiskAccounts(mentions: CompetitorMention[]): Promise<Array<{
    customerId: string;
    customerName: string;
    arr: number;
    competitor: string;
    riskSignals: string[];
  }>> {
    const customerRisk = new Map<string, {
      customerName: string;
      competitors: Set<string>;
      riskSignals: string[];
      highestRisk: string;
    }>();

    for (const mention of mentions) {
      if (mention.riskLevel !== 'high' && mention.riskLevel !== 'critical') continue;

      if (!customerRisk.has(mention.customerId)) {
        customerRisk.set(mention.customerId, {
          customerName: mention.customerName || mention.customerId,
          competitors: new Set(),
          riskSignals: [],
          highestRisk: mention.riskLevel,
        });
      }

      const risk = customerRisk.get(mention.customerId)!;
      risk.competitors.add(mention.competitorName);

      // Add risk signals based on intent
      if (mention.intentSignal === 'evaluation') {
        risk.riskSignals.push('Active evaluation in progress');
      }
      if (mention.intentSignal === 'comparison' && mention.sentiment === 'positive') {
        risk.riskSignals.push(`Favorable comparison to ${mention.competitorName}`);
      }
      if (mention.featuresMentioned.includes('migration')) {
        risk.riskSignals.push('Migration consideration');
      }
    }

    // Get ARR from database if available
    const results: Array<{
      customerId: string;
      customerName: string;
      arr: number;
      competitor: string;
      riskSignals: string[];
    }> = [];

    for (const [customerId, data] of customerRisk) {
      let arr = 0;

      if (this.supabase) {
        const { data: customer } = await this.supabase
          .from('customers')
          .select('arr')
          .eq('id', customerId)
          .single();

        if (customer) {
          arr = customer.arr || 0;
        }
      }

      results.push({
        customerId,
        customerName: data.customerName,
        arr,
        competitor: Array.from(data.competitors).join(', '),
        riskSignals: [...new Set(data.riskSignals)],
      });
    }

    return results.sort((a, b) => b.arr - a.arr);
  }

  private determineAccountStatus(
    account: { customerId: string; riskSignals: string[] },
    mentions: CompetitorMention[]
  ): string {
    const customerMentions = mentions.filter(m => m.customerId === account.customerId);

    if (customerMentions.some(m => m.intentSignal === 'evaluation')) {
      return 'active_evaluation';
    }
    if (customerMentions.some(m => m.riskLevel === 'high' || m.riskLevel === 'critical')) {
      return 'mentioned';
    }
    return 'general_awareness';
  }

  private calculateAverageRiskScore(mentions: CompetitorMention[]): number {
    if (mentions.length === 0) return 0;

    const totalScore = mentions.reduce((sum, m) => sum + this.riskLevelToScore(m.riskLevel), 0);
    return totalScore / mentions.length;
  }

  private riskLevelToScore(level: string): number {
    const scores: Record<string, number> = {
      low: 25,
      medium: 50,
      high: 75,
      critical: 100,
    };
    return scores[level] || 0;
  }

  private riskScoreToLevel(score: number): 'low' | 'medium' | 'high' {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private calculateTrend(mentions: CompetitorMention[]): 'increasing' | 'decreasing' | 'stable' {
    if (mentions.length < 5) return 'stable';

    // Sort by date
    const sorted = [...mentions].sort((a, b) => a.detectedAt.getTime() - b.detectedAt.getTime());

    // Compare first half to second half
    const midpoint = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, midpoint).length;
    const secondHalf = sorted.slice(midpoint).length;

    const ratio = secondHalf / firstHalf;

    if (ratio > 1.2) return 'increasing';
    if (ratio < 0.8) return 'decreasing';
    return 'stable';
  }

  private async getMentionsForPeriod(
    competitorId: string,
    start: Date,
    end: Date
  ): Promise<CompetitorMention[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('competitor_mentions')
        .select('*')
        .eq('competitor_id', competitorId)
        .gte('detected_at', start.toISOString())
        .lte('detected_at', end.toISOString())
        .order('detected_at', { ascending: false });

      if (!error && data) {
        return data.map(this.mapDbMention);
      }
    }

    return [];
  }

  private async getAllMentionsForPeriod(start: Date, end: Date): Promise<CompetitorMention[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('competitor_mentions')
        .select('*')
        .gte('detected_at', start.toISOString())
        .lte('detected_at', end.toISOString())
        .order('detected_at', { ascending: false });

      if (!error && data) {
        return data.map(this.mapDbMention);
      }
    }

    return [];
  }

  private mapDbMention(row: Record<string, unknown>): CompetitorMention {
    return {
      id: row.id as string,
      customerId: row.customer_id as string,
      customerName: row.customer_name as string | undefined,
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
      followUpScheduled: row.follow_up_scheduled as boolean,
      notes: row.notes as string | undefined,
    };
  }
}

// Singleton instance
export const mentionExtractorService = new MentionExtractorService();
