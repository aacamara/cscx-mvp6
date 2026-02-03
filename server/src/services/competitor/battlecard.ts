/**
 * Battle Card Service
 * PRD-094: Competitor Mentioned - Battle Card
 *
 * Manages battle cards and generates competitive positioning
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  BattleCard,
  Competitor,
  Differentiator,
  TalkTrack,
  ObjectionHandler,
  FeatureComparison,
  BattleCardResource,
  CompetitorMention,
  SuggestedAction,
} from './types.js';
import { DEFAULT_COMPETITORS } from './detector.js';

// ============================================
// Default Battle Cards
// ============================================

const DEFAULT_BATTLE_CARDS: Record<string, Partial<BattleCard>> = {
  gainsight: {
    id: 'bc-gainsight',
    competitorId: 'gainsight',
    competitorName: 'Gainsight',
    version: '2.0',
    overview: 'Gainsight is the legacy leader in CS platforms, known for enterprise deployments but suffering from complexity and slow implementation times.',
    targetMarket: 'Large Enterprise (1000+ employees)',
    pricingModel: 'Per-seat licensing with implementation fees ($150k-$500k+ annually)',
    keyDifferentiators: [
      {
        id: 'diff-1',
        title: 'AI-First Architecture',
        description: 'CSCX.AI is built on AI from the ground up, not bolted on. Our meeting intelligence, predictive health scoring, and automated insights are native capabilities, not add-ons.',
        category: 'product',
        importance: 'high',
      },
      {
        id: 'diff-2',
        title: 'Rapid Time to Value',
        description: 'Customers are live in weeks, not months. Gainsight implementations average 6-12 months; CSCX.AI averages 4-6 weeks.',
        category: 'service',
        importance: 'high',
      },
      {
        id: 'diff-3',
        title: 'Meeting Intelligence Built-In',
        description: 'Native meeting recording, transcription, and AI analysis. Gainsight requires third-party integrations.',
        category: 'product',
        importance: 'medium',
      },
      {
        id: 'diff-4',
        title: 'Modern Tech Stack',
        description: 'Cloud-native architecture with real-time capabilities. Gainsight runs on older technology requiring more maintenance.',
        category: 'product',
        importance: 'medium',
      },
    ],
    talkTracks: [
      {
        id: 'tt-1',
        scenario: 'Customer mentions Gainsight has more features',
        script: 'You\'re right that Gainsight has been around longer and has accumulated many features. The question is: how many of those features will you actually use? Our customers tell us that 80% of their value comes from 20% of features. We focus on that 20% and make it exceptional with AI. Would you rather have 100 features you\'ll never use, or 30 features that actually drive outcomes?',
        keyPoints: [
          'Feature quantity vs. quality',
          'AI-powered outcomes focus',
          'Faster time to value',
        ],
        tags: ['features', 'value'],
      },
      {
        id: 'tt-2',
        scenario: 'Customer is concerned about switching costs',
        script: 'Switching costs are a real consideration. Let me share what our customers have experienced: most complete migration in 4-6 weeks with our white-glove support. We handle the data migration, integration setup, and training. The average payback period is 3 months based on time saved alone. What specific aspects of switching are you most concerned about?',
        keyPoints: [
          '4-6 week migration timeline',
          'White-glove support included',
          '3-month payback period',
        ],
        tags: ['migration', 'switching', 'risk'],
      },
    ],
    objectionHandlers: [
      {
        id: 'obj-1',
        objection: 'Gainsight is the industry standard',
        response: 'Gainsight was the standard - in 2015. The industry has evolved. Today\'s CSMs need AI-powered insights, not just dashboards. Would you use a 2015 smartphone because it was the standard then? The question isn\'t who was first, it\'s who\'s best positioned for where CS is going.',
        supportingPoints: [
          'Industry evolving toward AI',
          'Modern CSMs expect more',
          'First-mover advantage diminishing',
        ],
      },
      {
        id: 'obj-2',
        objection: 'Our company already uses Gainsight',
        response: 'Many of our best customers came from Gainsight. They switched because they needed AI capabilities Gainsight couldn\'t provide, wanted faster implementation for new use cases, or simply wanted to reduce total cost of ownership. What\'s driving your evaluation today?',
        supportingPoints: [
          'Many customers switch successfully',
          'AI capabilities gap',
          'TCO advantages',
        ],
      },
    ],
    featureComparison: [
      { feature: 'AI Health Scoring', ourCapability: 'full', theirCapability: 'partial', advantage: 'us', notes: 'Native ML vs. rules-based' },
      { feature: 'Meeting Intelligence', ourCapability: 'full', theirCapability: 'partial', advantage: 'us', notes: 'Built-in vs. integration required' },
      { feature: 'Implementation Time', ourCapability: 'full', theirCapability: 'partial', advantage: 'us', notes: 'Weeks vs. months' },
      { feature: 'Enterprise Reporting', ourCapability: 'full', theirCapability: 'full', advantage: 'tie' },
      { feature: 'Salesforce Integration', ourCapability: 'full', theirCapability: 'full', advantage: 'tie' },
      { feature: 'Community/Ecosystem', ourCapability: 'partial', theirCapability: 'full', advantage: 'them', notes: 'Growing rapidly' },
    ],
    winRate: 65,
    totalDeals: 45,
    wonDeals: 29,
    lostDeals: 16,
    resources: [
      { id: 'r-1', title: 'Gainsight Competitive One-Pager', type: 'document', url: '/docs/competitive/gainsight-one-pager.pdf' },
      { id: 'r-2', title: 'Migration Success Story: Acme Corp', type: 'case_study', url: '/case-studies/acme-gainsight-migration' },
    ],
  },

  churnzero: {
    id: 'bc-churnzero',
    competitorId: 'churnzero',
    competitorName: 'ChurnZero',
    version: '1.5',
    overview: 'ChurnZero is a solid mid-market CS platform with good real-time capabilities but limited AI and meeting intelligence features.',
    targetMarket: 'Mid-market (100-1000 employees)',
    pricingModel: 'Per-seat licensing ($100-$300k annually)',
    keyDifferentiators: [
      {
        id: 'diff-1',
        title: 'Superior AI Capabilities',
        description: 'CSCX.AI provides predictive health scoring, AI-generated insights, and automated meeting analysis. ChurnZero relies primarily on rule-based automation.',
        category: 'product',
        importance: 'high',
      },
      {
        id: 'diff-2',
        title: 'Native Meeting Intelligence',
        description: 'Built-in meeting recording, transcription, risk detection, and action item extraction. ChurnZero lacks native meeting capabilities.',
        category: 'product',
        importance: 'high',
      },
      {
        id: 'diff-3',
        title: 'Agentic Automation',
        description: 'AI agents that can autonomously execute multi-step workflows. ChurnZero offers basic playbook automation only.',
        category: 'product',
        importance: 'medium',
      },
    ],
    talkTracks: [
      {
        id: 'tt-1',
        scenario: 'Customer likes ChurnZero\'s real-time features',
        script: 'ChurnZero does have good real-time capabilities - that\'s one of their strengths. The question is: what do you do with that real-time data? With CSCX.AI, our AI doesn\'t just show you what\'s happening - it tells you what to do about it and can even take action for you. Would you like to see how our AI agents handle a usage drop scenario?',
        keyPoints: [
          'Acknowledge their strength',
          'Differentiate with AI actions',
          'Offer to demo',
        ],
        tags: ['real-time', 'AI'],
      },
    ],
    objectionHandlers: [
      {
        id: 'obj-1',
        objection: 'ChurnZero is more affordable',
        response: 'Let\'s look at total value, not just license cost. Our AI saves CSMs 10+ hours per week on manual tasks. If a CSM costs $75/hour, that\'s $39,000 in productivity gains per CSM per year. How many CSMs do you have?',
        supportingPoints: [
          '10+ hours saved per week',
          '$39k productivity gain per CSM',
          'TCO vs. license cost',
        ],
      },
    ],
    winRate: 70,
    totalDeals: 32,
    wonDeals: 22,
    lostDeals: 10,
    resources: [],
  },

  totango: {
    id: 'bc-totango',
    competitorId: 'totango',
    competitorName: 'Totango',
    version: '1.5',
    overview: 'Totango offers a modular approach with a free tier, appealing to startups and small teams, but lacks depth for sophisticated CS operations.',
    targetMarket: 'Startups and small mid-market',
    pricingModel: 'Freemium model with per-seat pricing',
    keyDifferentiators: [
      {
        id: 'diff-1',
        title: 'Enterprise-Ready from Day One',
        description: 'CSCX.AI scales from startup to enterprise without platform changes. Totango users often outgrow the platform.',
        category: 'product',
        importance: 'high',
      },
      {
        id: 'diff-2',
        title: 'AI-Native Architecture',
        description: 'Built with AI at the core, not as an add-on. Totango\'s AI capabilities are limited and often require additional modules.',
        category: 'product',
        importance: 'high',
      },
    ],
    talkTracks: [
      {
        id: 'tt-1',
        scenario: 'Customer attracted to Totango free tier',
        script: 'Totango\'s free tier is great for getting started, and I respect that approach. The challenge is that as you grow, you\'ll hit limitations and face a migration. With CSCX.AI, you start with our full platform at startup pricing, and it grows with you. No migration, no re-training, no data loss. What\'s your growth trajectory looking like?',
        keyPoints: [
          'Acknowledge free tier appeal',
          'Future migration pain',
          'Growth with single platform',
        ],
        tags: ['pricing', 'growth'],
      },
    ],
    objectionHandlers: [],
    winRate: 75,
    totalDeals: 20,
    wonDeals: 15,
    lostDeals: 5,
    resources: [],
  },
};

// ============================================
// Battle Card Service Class
// ============================================

export class BattleCardService {
  private supabase: ReturnType<typeof createClient> | null = null;
  private battleCards: Map<string, BattleCard> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }

    // Load default battle cards
    this.loadDefaultBattleCards();
  }

  private loadDefaultBattleCards(): void {
    for (const [competitorId, card] of Object.entries(DEFAULT_BATTLE_CARDS)) {
      const fullCard: BattleCard = {
        id: card.id || `bc-${competitorId}`,
        competitorId,
        competitorName: card.competitorName || competitorId,
        version: card.version || '1.0',
        lastUpdated: new Date(),
        overview: card.overview || '',
        targetMarket: card.targetMarket || '',
        pricingModel: card.pricingModel,
        keyDifferentiators: card.keyDifferentiators || [],
        talkTracks: card.talkTracks || [],
        objectionHandlers: card.objectionHandlers || [],
        featureComparison: card.featureComparison,
        winRate: card.winRate,
        totalDeals: card.totalDeals,
        wonDeals: card.wonDeals,
        lostDeals: card.lostDeals,
        resources: card.resources || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.battleCards.set(competitorId, fullCard);
    }
  }

  /**
   * Get battle card for a competitor
   */
  async getBattleCard(competitorId: string): Promise<BattleCard | null> {
    // Try in-memory first
    if (this.battleCards.has(competitorId)) {
      return this.battleCards.get(competitorId)!;
    }

    // Try database
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('battle_cards')
        .select('*')
        .eq('competitor_id', competitorId)
        .single();

      if (!error && data) {
        return this.mapDbBattleCard(data);
      }
    }

    return null;
  }

  /**
   * Get all battle cards
   */
  async getAllBattleCards(): Promise<BattleCard[]> {
    const cards = Array.from(this.battleCards.values());

    // If database is available, merge with DB cards
    if (this.supabase) {
      const { data } = await this.supabase
        .from('battle_cards')
        .select('*');

      if (data) {
        const dbCards = data.map(this.mapDbBattleCard);
        // Merge, preferring DB cards for duplicates
        const cardMap = new Map(cards.map(c => [c.competitorId, c]));
        for (const dbCard of dbCards) {
          cardMap.set(dbCard.competitorId, dbCard);
        }
        return Array.from(cardMap.values());
      }
    }

    return cards;
  }

  /**
   * Save or update a battle card
   */
  async saveBattleCard(card: BattleCard): Promise<BattleCard> {
    card.updatedAt = new Date();

    // Save to in-memory
    this.battleCards.set(card.competitorId, card);

    // Save to database if available
    if (this.supabase) {
      const dbData = {
        id: card.id,
        competitor_id: card.competitorId,
        competitor_name: card.competitorName,
        version: card.version,
        last_updated: card.lastUpdated.toISOString(),
        overview: card.overview,
        target_market: card.targetMarket,
        pricing_model: card.pricingModel,
        key_differentiators: JSON.stringify(card.keyDifferentiators),
        talk_tracks: JSON.stringify(card.talkTracks),
        objection_handlers: JSON.stringify(card.objectionHandlers),
        feature_comparison: card.featureComparison ? JSON.stringify(card.featureComparison) : null,
        win_rate: card.winRate,
        total_deals: card.totalDeals,
        won_deals: card.wonDeals,
        lost_deals: card.lostDeals,
        resources: JSON.stringify(card.resources),
        updated_at: card.updatedAt.toISOString(),
      };

      await this.supabase
        .from('battle_cards')
        .upsert(dbData, { onConflict: 'competitor_id' });
    }

    return card;
  }

  /**
   * Get relevant talk track based on context
   */
  getSuggestedTalkTrack(
    battleCard: BattleCard,
    mention: Partial<CompetitorMention>
  ): TalkTrack | undefined {
    if (!battleCard.talkTracks || battleCard.talkTracks.length === 0) {
      return undefined;
    }

    // Score each talk track based on relevance
    const scored = battleCard.talkTracks.map(track => {
      let score = 0;

      // Check if features mentioned match talk track tags
      for (const feature of mention.featuresMentioned || []) {
        if (track.tags?.includes(feature)) score += 2;
      }

      // Check intent signal alignment
      if (mention.intentSignal === 'evaluation' && track.tags?.includes('evaluation')) score += 3;
      if (mention.intentSignal === 'comparison' && track.tags?.includes('comparison')) score += 3;
      if (mention.sentiment === 'positive' && track.tags?.includes('value')) score += 2;

      // Check context keywords
      const contextLower = (mention.context || '').toLowerCase();
      const scenarioLower = track.scenario.toLowerCase();

      // Simple keyword overlap
      const scenarioWords = scenarioLower.split(/\s+/).filter(w => w.length > 4);
      for (const word of scenarioWords) {
        if (contextLower.includes(word)) score += 1;
      }

      return { track, score };
    });

    // Return highest scored track
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.score > 0 ? scored[0].track : battleCard.talkTracks[0];
  }

  /**
   * Generate suggested response based on mention context
   */
  generateSuggestedResponse(
    battleCard: BattleCard,
    mention: Partial<CompetitorMention>,
    customerContext?: { name?: string; primaryContact?: string }
  ): string {
    const talkTrack = this.getSuggestedTalkTrack(battleCard, mention);
    const differentiators = battleCard.keyDifferentiators
      .filter(d => d.importance === 'high')
      .slice(0, 2);

    // Build response template
    let response = `I'd love to discuss your evaluation and share some insights about how we compare.\n\n`;

    if (differentiators.length > 0) {
      response += `Key areas where we differentiate:\n`;
      for (const diff of differentiators) {
        response += `- ${diff.title}: ${diff.description.slice(0, 100)}...\n`;
      }
      response += '\n';
    }

    if (talkTrack) {
      response += `Would you be open to a quick call to discuss? I can walk you through ${talkTrack.keyPoints?.[0] || 'our key differentiators'}.`;
    }

    return response;
  }

  /**
   * Get suggested actions for a competitor mention
   */
  getSuggestedActions(
    mention: Partial<CompetitorMention>,
    customerContext?: {
      healthScore?: number;
      daysUntilRenewal?: number;
      arr?: number;
    }
  ): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    // Always suggest a follow-up meeting for evaluation signals
    if (mention.intentSignal === 'evaluation' || mention.riskLevel === 'high' || mention.riskLevel === 'critical') {
      actions.push({
        type: 'schedule_meeting',
        title: 'Schedule Competitive Discussion',
        description: 'Schedule a call to address competitive concerns and demonstrate key differentiators',
        priority: 'high',
      });
    }

    // Suggest email for less urgent cases
    if (mention.riskLevel === 'medium' || mention.intentSignal === 'comparison') {
      actions.push({
        type: 'draft_email',
        title: 'Send Positioning Email',
        description: 'Draft an email with relevant case studies and differentiators',
        priority: 'medium',
      });
    }

    // Escalate for high-value at-risk accounts
    if (
      (mention.riskLevel === 'critical' || mention.riskLevel === 'high') &&
      customerContext?.arr && customerContext.arr > 100000
    ) {
      actions.push({
        type: 'notify_sales',
        title: 'Alert Account Team',
        description: 'Notify sales team about competitive threat on high-value account',
        priority: 'high',
        metadata: { arr: customerContext.arr },
      });
    }

    // Research action for unknown competitors
    if (mention.sentiment === 'positive' || mention.intentSignal === 'praise') {
      actions.push({
        type: 'research',
        title: 'Research Customer Usage',
        description: 'Review customer product usage to identify potential gaps',
        priority: 'medium',
      });
    }

    return actions;
  }

  /**
   * Map database row to BattleCard
   */
  private mapDbBattleCard(row: Record<string, unknown>): BattleCard {
    return {
      id: row.id as string,
      competitorId: row.competitor_id as string,
      competitorName: row.competitor_name as string,
      version: row.version as string,
      lastUpdated: new Date(row.last_updated as string),
      overview: row.overview as string,
      targetMarket: row.target_market as string,
      pricingModel: row.pricing_model as string | undefined,
      keyDifferentiators: typeof row.key_differentiators === 'string'
        ? JSON.parse(row.key_differentiators)
        : (row.key_differentiators as Differentiator[]) || [],
      talkTracks: typeof row.talk_tracks === 'string'
        ? JSON.parse(row.talk_tracks)
        : (row.talk_tracks as TalkTrack[]) || [],
      objectionHandlers: typeof row.objection_handlers === 'string'
        ? JSON.parse(row.objection_handlers)
        : (row.objection_handlers as ObjectionHandler[]) || [],
      featureComparison: row.feature_comparison
        ? (typeof row.feature_comparison === 'string'
            ? JSON.parse(row.feature_comparison)
            : row.feature_comparison as FeatureComparison[])
        : undefined,
      winRate: row.win_rate as number | undefined,
      totalDeals: row.total_deals as number | undefined,
      wonDeals: row.won_deals as number | undefined,
      lostDeals: row.lost_deals as number | undefined,
      resources: typeof row.resources === 'string'
        ? JSON.parse(row.resources)
        : (row.resources as BattleCardResource[]) || [],
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// Singleton instance
export const battleCardService = new BattleCardService();
