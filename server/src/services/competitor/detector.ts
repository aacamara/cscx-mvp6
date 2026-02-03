/**
 * Competitor Detection Service
 * PRD-094: Competitor Mentioned - Battle Card
 *
 * Detects competitor mentions in text from meetings, emails, and support tickets
 */

import {
  Competitor,
  CompetitorAlias,
  DetectionResult,
  DetectionOptions,
  CompetitorMention,
} from './types.js';

// ============================================
// Default Competitors (CS Industry)
// ============================================

export const DEFAULT_COMPETITORS: Competitor[] = [
  {
    id: 'gainsight',
    name: 'Gainsight',
    aliases: ['gainsight', 'gain sight', 'GS', 'gainsight.com'],
    website: 'https://www.gainsight.com',
    category: 'Customer Success Platform',
    strengths: [
      'Large enterprise presence',
      'Comprehensive feature set',
      'Strong brand recognition',
    ],
    weaknesses: [
      'Complex implementation (6-12 months)',
      'Higher total cost of ownership',
      'Rules-based automation (not AI-first)',
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'churnzero',
    name: 'ChurnZero',
    aliases: ['churnzero', 'churn zero', 'CZ', 'churn-zero', 'churnzero.com'],
    website: 'https://www.churnzero.com',
    category: 'Customer Success Platform',
    strengths: [
      'Strong real-time analytics',
      'Good mid-market fit',
      'Solid playbook automation',
    ],
    weaknesses: [
      'Limited AI capabilities',
      'Less mature product',
      'Smaller ecosystem',
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'totango',
    name: 'Totango',
    aliases: ['totango', 'totango.com'],
    website: 'https://www.totango.com',
    category: 'Customer Success Platform',
    strengths: [
      'Modular approach',
      'Free tier available',
      'Quick to deploy',
    ],
    weaknesses: [
      'Feature gaps in enterprise',
      'Limited AI/ML capabilities',
      'Reporting limitations',
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'planhat',
    name: 'Planhat',
    aliases: ['planhat', 'plan hat', 'planhat.com'],
    website: 'https://www.planhat.com',
    category: 'Customer Success Platform',
    strengths: [
      'Modern UI/UX',
      'Flexible data model',
      'European presence',
    ],
    weaknesses: [
      'Smaller US presence',
      'Less mature automation',
      'Limited integrations',
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'vitally',
    name: 'Vitally',
    aliases: ['vitally', 'vitally.io', 'vitally.com'],
    website: 'https://www.vitally.io',
    category: 'Customer Success Platform',
    strengths: [
      'Product-led growth focus',
      'Developer-friendly',
      'Modern architecture',
    ],
    weaknesses: [
      'Less enterprise-ready',
      'Smaller team',
      'Limited professional services',
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'catalyst',
    name: 'Catalyst',
    aliases: ['catalyst', 'catalyst.io', 'catalyst software'],
    website: 'https://www.catalyst.io',
    category: 'Customer Success Platform',
    strengths: [
      'Revenue focus',
      'Strong Salesforce integration',
      'Good for expansion tracking',
    ],
    weaknesses: [
      'Newer to market',
      'Limited health scoring',
      'Smaller ecosystem',
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'clientsuccess',
    name: 'ClientSuccess',
    aliases: ['clientsuccess', 'client success', 'clientsuccess.com'],
    website: 'https://www.clientsuccess.com',
    category: 'Customer Success Platform',
    strengths: [
      'Simple and intuitive',
      'Good customer support',
      'Mid-market focus',
    ],
    weaknesses: [
      'Limited advanced features',
      'Less scalable',
      'Fewer integrations',
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// ============================================
// Feature Keywords for Detection
// ============================================

const FEATURE_KEYWORDS: Record<string, string[]> = {
  'health_scoring': ['health score', 'health scoring', 'customer health', 'risk score', 'churn prediction'],
  'playbooks': ['playbook', 'automation', 'workflow', 'sequence', 'journey'],
  'analytics': ['analytics', 'reporting', 'dashboard', 'metrics', 'insights', 'BI'],
  'integrations': ['integration', 'connect', 'sync', 'API', 'native integration'],
  'ai_ml': ['AI', 'artificial intelligence', 'machine learning', 'ML', 'predictive'],
  'meetings': ['meeting', 'call recording', 'transcript', 'meeting intelligence', 'conversation'],
  'email': ['email tracking', 'email automation', 'sequences', 'outreach'],
  'nps': ['NPS', 'net promoter', 'survey', 'feedback', 'CSAT'],
  'renewal': ['renewal', 'expansion', 'upsell', 'revenue', 'forecast'],
  'onboarding': ['onboarding', 'implementation', 'time to value', 'TTV'],
};

// ============================================
// Sentiment Indicators
// ============================================

const POSITIVE_INDICATORS = [
  'love', 'great', 'better', 'prefer', 'impressed', 'amazing', 'excellent',
  'recommend', 'happy with', 'satisfied', 'good experience', 'like about',
];

const NEGATIVE_INDICATORS = [
  'hate', 'terrible', 'worse', 'frustrat', 'disappoint', 'issue', 'problem',
  'concern', 'difficult', 'confusing', 'missing', 'lack', 'unhappy', 'bad',
];

const COMPARISON_INDICATORS = [
  'compared to', 'versus', 'vs', 'compared with', 'rather than', 'instead of',
  'better than', 'worse than', 'similar to', 'different from', 'alternative',
  'switch from', 'switch to', 'migrate', 'evaluating', 'considering',
];

const EVALUATION_INDICATORS = [
  'looking at', 'evaluating', 'considering', 'exploring', 'researching',
  'demo', 'trial', 'POC', 'proof of concept', 'shortlist', 'RFP', 'vendor',
];

// ============================================
// Competitor Detector Class
// ============================================

export class CompetitorDetector {
  private competitors: Map<string, Competitor> = new Map();
  private aliasIndex: Map<string, CompetitorAlias> = new Map();

  constructor(competitors: Competitor[] = DEFAULT_COMPETITORS) {
    this.loadCompetitors(competitors);
  }

  /**
   * Load competitors and build alias index
   */
  loadCompetitors(competitors: Competitor[]): void {
    this.competitors.clear();
    this.aliasIndex.clear();

    for (const competitor of competitors) {
      this.competitors.set(competitor.id, competitor);

      // Index all aliases (case-insensitive)
      for (const alias of competitor.aliases) {
        this.aliasIndex.set(alias.toLowerCase(), {
          alias,
          competitorId: competitor.id,
          competitorName: competitor.name,
        });
      }
    }
  }

  /**
   * Add a custom competitor
   */
  addCompetitor(competitor: Competitor): void {
    this.competitors.set(competitor.id, competitor);
    for (const alias of competitor.aliases) {
      this.aliasIndex.set(alias.toLowerCase(), {
        alias,
        competitorId: competitor.id,
        competitorName: competitor.name,
      });
    }
  }

  /**
   * Get all competitors
   */
  getCompetitors(): Competitor[] {
    return Array.from(this.competitors.values());
  }

  /**
   * Get competitor by ID
   */
  getCompetitor(id: string): Competitor | undefined {
    return this.competitors.get(id);
  }

  /**
   * Detect competitor mentions in text
   */
  detect(text: string): DetectionResult[] {
    const results: DetectionResult[] = [];
    const textLower = text.toLowerCase();
    const foundCompetitors = new Set<string>();

    // Search for each alias in the text
    for (const [aliasLower, aliasInfo] of this.aliasIndex) {
      // Skip if we already found this competitor
      if (foundCompetitors.has(aliasInfo.competitorId)) continue;

      // Find the alias in the text (word boundary aware)
      const regex = new RegExp(`\\b${this.escapeRegex(aliasLower)}\\b`, 'gi');
      const match = regex.exec(textLower);

      if (match) {
        const competitor = this.competitors.get(aliasInfo.competitorId);
        if (!competitor) continue;

        foundCompetitors.add(aliasInfo.competitorId);

        // Extract context around the mention
        const context = this.extractContext(text, match.index, 150);

        // Analyze sentiment
        const sentiment = this.analyzeSentiment(context);

        // Detect intent signal
        const intentSignal = this.detectIntent(context);

        // Detect features mentioned
        const featuresMentioned = this.detectFeatures(context);

        // Calculate confidence
        const confidence = this.calculateConfidence(context, competitor.name);

        results.push({
          competitor,
          matchedAlias: aliasInfo.alias,
          context,
          position: match.index,
          sentiment,
          intentSignal,
          featuresMentioned,
          confidence,
        });
      }
    }

    // Sort by position in text
    return results.sort((a, b) => a.position - b.position);
  }

  /**
   * Extract context around a mention
   */
  private extractContext(text: string, position: number, radius: number): string {
    const start = Math.max(0, position - radius);
    const end = Math.min(text.length, position + radius);

    let context = text.slice(start, end);

    // Clean up context
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';

    return context.trim();
  }

  /**
   * Analyze sentiment of context
   */
  private analyzeSentiment(context: string): CompetitorMention['sentiment'] {
    const contextLower = context.toLowerCase();

    // Check for comparison first
    for (const indicator of COMPARISON_INDICATORS) {
      if (contextLower.includes(indicator)) {
        return 'comparison';
      }
    }

    // Count positive and negative indicators
    let positiveCount = 0;
    let negativeCount = 0;

    for (const indicator of POSITIVE_INDICATORS) {
      if (contextLower.includes(indicator)) positiveCount++;
    }

    for (const indicator of NEGATIVE_INDICATORS) {
      if (contextLower.includes(indicator)) negativeCount++;
    }

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Detect intent signal from context
   */
  private detectIntent(context: string): CompetitorMention['intentSignal'] {
    const contextLower = context.toLowerCase();

    // Check for evaluation
    for (const indicator of EVALUATION_INDICATORS) {
      if (contextLower.includes(indicator)) {
        return 'evaluation';
      }
    }

    // Check for comparison
    for (const indicator of COMPARISON_INDICATORS) {
      if (contextLower.includes(indicator)) {
        return 'comparison';
      }
    }

    // Check sentiment-based intent
    const sentiment = this.analyzeSentiment(context);
    if (sentiment === 'positive') return 'praise';
    if (sentiment === 'negative') return 'frustration';

    // Check for questions
    if (context.includes('?') || contextLower.includes('what') ||
        contextLower.includes('how') || contextLower.includes('why')) {
      return 'question';
    }

    return 'unknown';
  }

  /**
   * Detect features mentioned in context
   */
  private detectFeatures(context: string): string[] {
    const contextLower = context.toLowerCase();
    const features: string[] = [];

    for (const [feature, keywords] of Object.entries(FEATURE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (contextLower.includes(keyword.toLowerCase())) {
          features.push(feature);
          break;
        }
      }
    }

    return [...new Set(features)];
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(context: string, competitorName: string): number {
    let confidence = 0.5; // Base confidence

    // Boost if exact name match (not just alias)
    if (context.toLowerCase().includes(competitorName.toLowerCase())) {
      confidence += 0.2;
    }

    // Boost if evaluation/comparison indicators present
    const contextLower = context.toLowerCase();
    for (const indicator of [...EVALUATION_INDICATORS, ...COMPARISON_INDICATORS]) {
      if (contextLower.includes(indicator)) {
        confidence += 0.1;
        break;
      }
    }

    // Boost if features are mentioned
    const features = this.detectFeatures(context);
    if (features.length > 0) {
      confidence += 0.1;
    }

    // Reduce if context is very short
    if (context.length < 50) {
      confidence -= 0.1;
    }

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Calculate risk level based on detection result
   */
  calculateRiskLevel(
    result: DetectionResult,
    customerHealthScore?: number,
    daysUntilRenewal?: number
  ): CompetitorMention['riskLevel'] {
    let riskScore = 0;

    // Intent-based risk
    switch (result.intentSignal) {
      case 'evaluation':
        riskScore += 40;
        break;
      case 'comparison':
        riskScore += 30;
        break;
      case 'frustration':
        riskScore += 25;
        break;
      case 'question':
        riskScore += 10;
        break;
      case 'praise':
        riskScore += 35; // Praising competitor is risky
        break;
    }

    // Sentiment-based risk
    switch (result.sentiment) {
      case 'positive':
        riskScore += 20; // Positive about competitor
        break;
      case 'comparison':
        riskScore += 15;
        break;
      case 'negative':
        riskScore -= 10; // Negative about competitor (good for us)
        break;
    }

    // Customer health factor
    if (customerHealthScore !== undefined) {
      if (customerHealthScore < 50) riskScore += 20;
      else if (customerHealthScore < 70) riskScore += 10;
    }

    // Renewal proximity factor
    if (daysUntilRenewal !== undefined) {
      if (daysUntilRenewal < 30) riskScore += 25;
      else if (daysUntilRenewal < 60) riskScore += 15;
      else if (daysUntilRenewal < 90) riskScore += 10;
    }

    // Convert score to risk level
    if (riskScore >= 60) return 'critical';
    if (riskScore >= 40) return 'high';
    if (riskScore >= 20) return 'medium';
    return 'low';
  }
}

// Singleton instance
export const competitorDetector = new CompetitorDetector();
