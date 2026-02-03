/**
 * Competitor Detection Service (PRD-094)
 *
 * Detects competitor mentions in text content from meetings, emails,
 * and support tickets. Provides sentiment analysis and context extraction.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import Anthropic from '@anthropic-ai/sdk';

// ============================================
// Types
// ============================================

export type CompetitorCategory =
  | 'cs_platform'
  | 'crm'
  | 'analytics'
  | 'engagement'
  | 'support'
  | 'other';

export type MentionSourceType =
  | 'meeting'
  | 'email'
  | 'support_ticket'
  | 'call_transcript'
  | 'chat'
  | 'document';

export type MentionSentiment =
  | 'positive'
  | 'negative'
  | 'neutral'
  | 'evaluating';

export interface Competitor {
  id: string;
  name: string;
  aliases: string[];
  website?: string;
  category: CompetitorCategory;
  battleCardId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompetitorMention {
  id: string;
  customerId: string;
  customerName?: string;
  competitorId: string;
  competitorName: string;
  sourceType: MentionSourceType;
  sourceId: string;
  sourceUrl?: string;
  context: string;
  sentiment: MentionSentiment;
  featuresMentioned: string[];
  detectedAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  notes?: string;
}

export interface DetectionResult {
  competitor: string;
  competitorId?: string;
  alias: string;
  context: string;
  sentiment: MentionSentiment;
  featuresMentioned: string[];
  position: number;
}

export interface BattleCard {
  id: string;
  competitorId: string;
  competitorName: string;
  lastUpdated: Date;
  overview: string;
  keyDifferentiators: Array<{
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    category: string;
  }>;
  talkTracks: Array<{
    scenario: string;
    script: string;
    tips: string[];
  }>;
  objectionHandlers: Array<{
    objection: string;
    response: string;
    proofPoints: string[];
  }>;
  featureComparison: Array<{
    feature: string;
    ours: string;
    theirs: string;
    notes: string;
  }>;
  winLossStats: {
    totalDeals: number;
    wins: number;
    losses: number;
    winRate: number;
    avgDealSize: number;
    lastUpdated: Date;
  };
  resources: Array<{
    title: string;
    type: string;
    url: string;
  }>;
}

export interface CompetitorAlert {
  id: string;
  mention: CompetitorMention;
  customer: {
    id: string;
    name: string;
    arr: number;
    healthScore: number;
    renewalDate?: string;
    daysUntilRenewal?: number;
    csmName?: string;
    stage: string;
  };
  battleCard?: BattleCard;
  suggestedResponse?: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
  status: 'new' | 'viewed' | 'actioned' | 'dismissed';
}

// Default competitor patterns
const DEFAULT_COMPETITORS: Array<{ name: string; aliases: string[]; category: CompetitorCategory }> = [
  { name: 'Gainsight', aliases: ['gainsight', 'gain sight', 'GS'], category: 'cs_platform' },
  { name: 'ChurnZero', aliases: ['churnzero', 'churn zero', 'CZ', 'churn-zero'], category: 'cs_platform' },
  { name: 'Totango', aliases: ['totango'], category: 'cs_platform' },
  { name: 'Vitally', aliases: ['vitally', 'vitally.io'], category: 'cs_platform' },
  { name: 'Planhat', aliases: ['planhat', 'plan hat'], category: 'cs_platform' },
  { name: 'ClientSuccess', aliases: ['clientsuccess', 'client success', 'client-success'], category: 'cs_platform' },
  { name: 'Catalyst', aliases: ['catalyst', 'catalyst.io'], category: 'cs_platform' },
  { name: 'Custify', aliases: ['custify'], category: 'cs_platform' }
];

// ============================================
// Service Class
// ============================================

export class CompetitorDetectionService {
  private supabase: SupabaseClient | null = null;
  private anthropic: Anthropic | null = null;
  private competitors: Map<string, Competitor> = new Map();
  private isConfigured: boolean = false;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
      this.isConfigured = true;
    }

    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }

    console.log('Competitor detection service initialized');
  }

  /**
   * Initialize the service by loading competitors from database or defaults
   */
  async initialize(): Promise<void> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('competitors')
        .select('*');

      if (!error && data) {
        for (const comp of data) {
          this.competitors.set(comp.name.toLowerCase(), {
            id: comp.id,
            name: comp.name,
            aliases: comp.aliases || [],
            website: comp.website,
            category: comp.category,
            battleCardId: comp.battle_card_id,
            createdAt: new Date(comp.created_at),
            updatedAt: new Date(comp.updated_at || comp.created_at)
          });
        }
        console.log(`Loaded ${this.competitors.size} competitors from database`);
        return;
      }
    }

    // Use defaults if no database
    for (const comp of DEFAULT_COMPETITORS) {
      this.competitors.set(comp.name.toLowerCase(), {
        id: crypto.randomUUID(),
        name: comp.name,
        aliases: comp.aliases,
        category: comp.category,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    console.log(`Loaded ${this.competitors.size} default competitors`);
  }

  /**
   * Detect competitor mentions in text
   */
  detectCompetitors(text: string): DetectionResult[] {
    const mentions: DetectionResult[] = [];
    const lowerText = text.toLowerCase();

    for (const competitor of this.competitors.values()) {
      const allPatterns = [competitor.name.toLowerCase(), ...competitor.aliases.map(a => a.toLowerCase())];

      for (const pattern of allPatterns) {
        const index = lowerText.indexOf(pattern);
        if (index !== -1) {
          // Extract context (100 chars before and after)
          const contextStart = Math.max(0, index - 100);
          const contextEnd = Math.min(text.length, index + pattern.length + 100);
          const context = text.slice(contextStart, contextEnd);

          // Basic sentiment detection
          const sentiment = this.detectSentiment(context);

          // Feature extraction
          const features = this.extractFeatures(context);

          mentions.push({
            competitor: competitor.name,
            competitorId: competitor.id,
            alias: pattern,
            context,
            sentiment,
            featuresMentioned: features,
            position: index
          });

          break; // Only report once per competitor
        }
      }
    }

    return mentions;
  }

  /**
   * Basic sentiment detection from context
   */
  private detectSentiment(context: string): MentionSentiment {
    const lower = context.toLowerCase();

    // Evaluating signals
    const evaluatingPatterns = [
      'looking at', 'considering', 'evaluating', 'comparing', 'demo',
      'interested in', 'talking to', 'meeting with', 'proposal from',
      'also using', 'might switch', 'thinking about'
    ];
    if (evaluatingPatterns.some(p => lower.includes(p))) {
      return 'evaluating';
    }

    // Positive signals (about competitor)
    const positivePatterns = [
      'like their', 'love their', 'better at', 'easier to',
      'prefer their', 'impressed with', 'great at'
    ];
    if (positivePatterns.some(p => lower.includes(p))) {
      return 'positive';
    }

    // Negative signals (about competitor)
    const negativePatterns = [
      "don't like", "didn't like", 'frustrated with', 'issues with',
      'problems with', 'too expensive', 'hard to use', 'complicated'
    ];
    if (negativePatterns.some(p => lower.includes(p))) {
      return 'negative';
    }

    return 'neutral';
  }

  /**
   * Extract mentioned features from context
   */
  private extractFeatures(context: string): string[] {
    const features: string[] = [];
    const lower = context.toLowerCase();

    const featurePatterns = [
      { pattern: 'reporting', feature: 'Reporting & Dashboards' },
      { pattern: 'dashboard', feature: 'Reporting & Dashboards' },
      { pattern: 'analytics', feature: 'Analytics' },
      { pattern: 'health score', feature: 'Health Scoring' },
      { pattern: 'automation', feature: 'Automation' },
      { pattern: 'workflow', feature: 'Workflows' },
      { pattern: 'integration', feature: 'Integrations' },
      { pattern: 'api', feature: 'API' },
      { pattern: 'playbook', feature: 'Playbooks' },
      { pattern: 'implementation', feature: 'Implementation' },
      { pattern: 'onboarding', feature: 'Onboarding' },
      { pattern: 'support', feature: 'Customer Support' },
      { pattern: 'price', feature: 'Pricing' },
      { pattern: 'cost', feature: 'Pricing' },
      { pattern: 'ai', feature: 'AI/ML Features' },
      { pattern: 'machine learning', feature: 'AI/ML Features' }
    ];

    for (const { pattern, feature } of featurePatterns) {
      if (lower.includes(pattern) && !features.includes(feature)) {
        features.push(feature);
      }
    }

    return features;
  }

  /**
   * Use AI to analyze context and generate response suggestion
   */
  async analyzeWithAI(context: string, competitorName: string): Promise<{
    sentiment: MentionSentiment;
    features: string[];
    suggestedResponse: string;
    riskLevel: 'high' | 'medium' | 'low';
  }> {
    if (!this.anthropic) {
      return {
        sentiment: this.detectSentiment(context),
        features: this.extractFeatures(context),
        suggestedResponse: `I'd be happy to discuss how we compare to ${competitorName} and address any specific concerns you have.`,
        riskLevel: 'medium'
      };
    }

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Analyze this customer conversation snippet where they mentioned ${competitorName}:

"${context}"

Provide a JSON response with:
1. sentiment: one of "positive", "negative", "neutral", or "evaluating" (regarding how they view the competitor)
2. features: array of specific features/capabilities being discussed
3. suggestedResponse: a helpful response the CSM could use (2-3 sentences)
4. riskLevel: "high", "medium", or "low" based on churn risk indicators

Respond with valid JSON only.`
        }]
      });

      const textContent = response.content.find(c => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        const parsed = JSON.parse(textContent.text);
        return {
          sentiment: parsed.sentiment || 'neutral',
          features: parsed.features || [],
          suggestedResponse: parsed.suggestedResponse || '',
          riskLevel: parsed.riskLevel || 'medium'
        };
      }
    } catch (error) {
      console.error('AI analysis failed:', error);
    }

    return {
      sentiment: this.detectSentiment(context),
      features: this.extractFeatures(context),
      suggestedResponse: `I'd be happy to discuss how we compare to ${competitorName}.`,
      riskLevel: 'medium'
    };
  }

  /**
   * Create a new competitor mention record
   */
  async createMention(data: {
    customerId: string;
    competitorId: string;
    competitorName: string;
    sourceType: MentionSourceType;
    sourceId: string;
    sourceUrl?: string;
    context: string;
    sentiment: MentionSentiment;
    featuresMentioned: string[];
  }): Promise<CompetitorMention> {
    const mention: CompetitorMention = {
      id: crypto.randomUUID(),
      ...data,
      detectedAt: new Date(),
      acknowledged: false
    };

    if (this.supabase) {
      const { error } = await this.supabase
        .from('competitor_mentions')
        .insert({
          id: mention.id,
          customer_id: mention.customerId,
          competitor_id: mention.competitorId,
          source_type: mention.sourceType,
          source_id: mention.sourceId,
          source_url: mention.sourceUrl,
          context: mention.context,
          sentiment: mention.sentiment,
          features_mentioned: mention.featuresMentioned,
          detected_at: mention.detectedAt.toISOString(),
          acknowledged: false
        });

      if (error) {
        console.error('Failed to save mention:', error);
        throw new Error(`Failed to save mention: ${error.message}`);
      }
    }

    return mention;
  }

  /**
   * Get mentions for a customer
   */
  async getMentionsForCustomer(customerId: string, limit = 10): Promise<CompetitorMention[]> {
    if (!this.supabase) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('competitor_mentions')
      .select(`
        *,
        competitors(name)
      `)
      .eq('customer_id', customerId)
      .order('detected_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch mentions:', error);
      return [];
    }

    return (data || []).map(this.mapMention);
  }

  /**
   * Get all unacknowledged mentions for a user's customers
   */
  async getUnacknowledgedMentions(userId: string, options: {
    limit?: number;
    offset?: number;
  } = {}): Promise<{ mentions: CompetitorMention[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    if (!this.supabase) {
      return { mentions: [], total: 0 };
    }

    // Get customer IDs for this user
    const { data: customers } = await this.supabase
      .from('customers')
      .select('id')
      .eq('csm_id', userId);

    if (!customers || customers.length === 0) {
      return { mentions: [], total: 0 };
    }

    const customerIds = customers.map(c => c.id);

    const { data, count, error } = await this.supabase
      .from('competitor_mentions')
      .select(`
        *,
        competitors(name),
        customers(name, arr, health_score, renewal_date, stage)
      `, { count: 'exact' })
      .in('customer_id', customerIds)
      .eq('acknowledged', false)
      .order('detected_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Failed to fetch unacknowledged mentions:', error);
      return { mentions: [], total: 0 };
    }

    return {
      mentions: (data || []).map(this.mapMention),
      total: count || 0
    };
  }

  /**
   * Get battle card for a competitor
   */
  async getBattleCard(competitorId: string): Promise<BattleCard | null> {
    if (!this.supabase) {
      // Return sample battle card for demo
      return this.getSampleBattleCard(competitorId);
    }

    const { data, error } = await this.supabase
      .from('battle_cards')
      .select('*')
      .eq('competitor_id', competitorId)
      .single();

    if (error || !data) {
      return this.getSampleBattleCard(competitorId);
    }

    return this.mapBattleCard(data);
  }

  /**
   * Generate a sample battle card for demo purposes
   */
  private getSampleBattleCard(competitorId: string): BattleCard {
    const competitor = Array.from(this.competitors.values())
      .find(c => c.id === competitorId) || { name: 'Competitor', id: competitorId };

    return {
      id: crypto.randomUUID(),
      competitorId: competitor.id,
      competitorName: competitor.name,
      lastUpdated: new Date(),
      overview: `${competitor.name} is a customer success platform that focuses on traditional rule-based automation and manual workflows. While they have market presence, their platform lacks the AI-first approach that modern CS teams require.`,
      keyDifferentiators: [
        {
          title: 'AI-First Architecture',
          description: 'CSCX uses AI agents that learn and adapt, unlike rule-based systems that require constant manual configuration.',
          impact: 'high',
          category: 'feature'
        },
        {
          title: 'Faster Implementation',
          description: 'Get up and running in weeks, not months. Our AI handles configuration automatically.',
          impact: 'high',
          category: 'implementation'
        },
        {
          title: 'Meeting Intelligence',
          description: 'Built-in meeting transcription and AI analysis that competitors lack or charge extra for.',
          impact: 'medium',
          category: 'feature'
        },
        {
          title: 'Modern UX',
          description: 'Clean, intuitive interface designed for today\'s CSMs, not enterprise complexity.',
          impact: 'medium',
          category: 'feature'
        }
      ],
      talkTracks: [
        {
          scenario: 'Customer mentions competitor has better reporting',
          script: 'I\'d love to show you our new Analytics Dashboard. We\'ve invested heavily in making insights actionable - you can not only see the data but immediately take action with AI-suggested next steps.',
          tips: [
            'Offer a live demo of reporting features',
            'Show AI-generated insights feature',
            'Emphasize time saved vs manual analysis'
          ]
        },
        {
          scenario: 'Customer concerned about switching costs',
          script: 'We\'ve built our platform to make transitions smooth. Our AI can actually import your existing playbooks and health score models, and we provide dedicated migration support at no extra cost.',
          tips: [
            'Mention free migration assistance',
            'Share case study of successful migration',
            'Offer extended trial period'
          ]
        }
      ],
      objectionHandlers: [
        {
          objection: 'We\'ve already invested in [Competitor]',
          response: 'I understand - that investment is valuable. What we\'ve seen with similar customers is that the AI automation actually helps them get more value from their existing data. Would it help to see how other customers made the transition?',
          proofPoints: [
            '30% average reduction in time-to-value',
            'Integration with existing tools means no data loss',
            'Dedicated migration team included'
          ]
        },
        {
          objection: '[Competitor] has more features',
          response: 'Feature count can be misleading - what matters is whether those features solve your specific challenges. Our AI-first approach means you get smart automation without the configuration overhead. What specific capabilities are most important to your team?',
          proofPoints: [
            'AI handles 80% of routine tasks automatically',
            'Features that matter vs features that add complexity',
            'Customer case studies showing efficiency gains'
          ]
        }
      ],
      featureComparison: [
        { feature: 'AI-Powered Automation', ours: 'better', theirs: 'partial', notes: 'We use ML, they use rules' },
        { feature: 'Health Scoring', ours: 'full', theirs: 'full', notes: 'Similar capability' },
        { feature: 'Meeting Intelligence', ours: 'full', theirs: 'partial', notes: 'Built-in vs add-on' },
        { feature: 'Implementation Time', ours: 'better', theirs: 'none', notes: 'Weeks vs months' },
        { feature: 'Playbook Builder', ours: 'full', theirs: 'full', notes: 'Ours includes AI suggestions' }
      ],
      winLossStats: {
        totalDeals: 47,
        wins: 31,
        losses: 16,
        winRate: 66,
        avgDealSize: 85000,
        lastUpdated: new Date()
      },
      resources: [
        { title: 'Competitive One-Pager', type: 'one_pager', url: '/docs/competitive/one-pager.pdf' },
        { title: 'Migration Guide', type: 'document', url: '/docs/migration/guide.pdf' },
        { title: 'Customer Success Story', type: 'case_study', url: '/docs/case-studies/switch-story.pdf' }
      ]
    };
  }

  /**
   * Acknowledge a mention
   */
  async acknowledgeMention(mentionId: string, userId: string, notes?: string): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('competitor_mentions')
      .update({
        acknowledged: true,
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
        notes
      })
      .eq('id', mentionId);
  }

  /**
   * Get all competitors
   */
  getCompetitors(): Competitor[] {
    return Array.from(this.competitors.values());
  }

  /**
   * Add a new competitor
   */
  async addCompetitor(data: {
    name: string;
    aliases: string[];
    website?: string;
    category: CompetitorCategory;
  }): Promise<Competitor> {
    const competitor: Competitor = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (this.supabase) {
      const { error } = await this.supabase
        .from('competitors')
        .insert({
          id: competitor.id,
          name: competitor.name,
          aliases: competitor.aliases,
          website: competitor.website,
          category: competitor.category,
          created_at: competitor.createdAt.toISOString()
        });

      if (error) {
        throw new Error(`Failed to add competitor: ${error.message}`);
      }
    }

    this.competitors.set(competitor.name.toLowerCase(), competitor);
    return competitor;
  }

  /**
   * Calculate alert priority based on customer context
   */
  calculatePriority(mention: CompetitorMention, customer: {
    arr: number;
    healthScore: number;
    daysUntilRenewal?: number;
  }): 'high' | 'medium' | 'low' {
    let score = 0;

    // High ARR customers are priority
    if (customer.arr >= 100000) score += 3;
    else if (customer.arr >= 50000) score += 2;
    else score += 1;

    // Low health score increases priority
    if (customer.healthScore < 50) score += 3;
    else if (customer.healthScore < 70) score += 2;
    else score += 1;

    // Near renewal increases priority
    if (customer.daysUntilRenewal !== undefined) {
      if (customer.daysUntilRenewal <= 30) score += 3;
      else if (customer.daysUntilRenewal <= 90) score += 2;
    }

    // Evaluating sentiment is highest risk
    if (mention.sentiment === 'evaluating') score += 2;
    else if (mention.sentiment === 'positive') score += 1;

    if (score >= 8) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
  }

  /**
   * Map database record to CompetitorMention
   */
  private mapMention(row: any): CompetitorMention {
    return {
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customers?.name,
      competitorId: row.competitor_id,
      competitorName: row.competitors?.name || 'Unknown',
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceUrl: row.source_url,
      context: row.context,
      sentiment: row.sentiment,
      featuresMentioned: row.features_mentioned || [],
      detectedAt: new Date(row.detected_at),
      acknowledged: row.acknowledged,
      acknowledgedBy: row.acknowledged_by,
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
      notes: row.notes
    };
  }

  /**
   * Map database record to BattleCard
   */
  private mapBattleCard(row: any): BattleCard {
    return {
      id: row.id,
      competitorId: row.competitor_id,
      competitorName: row.competitor_name,
      lastUpdated: new Date(row.updated_at || row.created_at),
      overview: row.overview,
      keyDifferentiators: row.key_differentiators || [],
      talkTracks: row.talk_tracks || [],
      objectionHandlers: row.objection_handlers || [],
      featureComparison: row.feature_comparison || [],
      winLossStats: row.win_loss_stats || {
        totalDeals: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        avgDealSize: 0,
        lastUpdated: new Date()
      },
      resources: row.resources || []
    };
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isConfigured;
  }
}

// Singleton instance
export const competitorDetectionService = new CompetitorDetectionService();

// Initialize on module load
competitorDetectionService.initialize().catch(err => {
  console.error('Failed to initialize competitor detection service:', err);
});
