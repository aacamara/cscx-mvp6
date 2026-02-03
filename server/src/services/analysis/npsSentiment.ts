/**
 * NPS Sentiment Analysis Service
 *
 * PRD-005: NPS Survey Results -> Sentiment Analysis
 *
 * Analyzes verbatim feedback from NPS surveys to:
 * - Correlate sentiment with numeric scores
 * - Identify score/sentiment mismatches
 * - Prioritize detractors by ARR and urgency
 * - Identify promoter advocacy opportunities
 * - Generate personalized follow-up strategies
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import type { NPSSurveyRow, NPSDistribution, ParsedNPSSurvey } from '../surveys/npsParser.js';

let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// ============================================
// Types
// ============================================

export type Sentiment = 'positive' | 'negative' | 'mixed' | 'neutral';

export interface VerbatimAnalysis {
  responseId: string;
  sentiment: Sentiment;
  sentimentScore: number; // -1 to 1
  themes: string[];
  keyPhrases: string[];
  emotionalTone: string;
  actionableInsight?: string;
  hasScoreMismatch: boolean;
  mismatchReason?: string;
}

export interface ThemeAggregation {
  theme: string;
  count: number;
  sentiment: Sentiment;
  avgScore: number;
  primarySegment: 'promoters' | 'passives' | 'detractors' | 'mixed';
  sampleVerbatims: string[];
}

export interface PriorityDetractor {
  response: NPSSurveyRow;
  analysis: VerbatimAnalysis;
  customer?: CustomerContext;
  urgencyScore: number;
  urgencyFactors: string[];
  recommendedAction: string;
  suggestedResponseStrategy: string;
}

export interface PromoterOpportunity {
  response: NPSSurveyRow;
  analysis: VerbatimAnalysis;
  customer?: CustomerContext;
  advocacyScore: number;
  opportunityType: 'case_study' | 'reference_call' | 'g2_review' | 'testimonial' | 'webinar_speaker';
  verbatimHighlight: string;
}

export interface ScoreSentimentMismatch {
  response: NPSSurveyRow;
  analysis: VerbatimAnalysis;
  expectedSentiment: Sentiment;
  actualSentiment: Sentiment;
  rootCause: string;
  recommendation: string;
}

export interface CustomerContext {
  id: string;
  name: string;
  arr?: number;
  healthScore?: number;
  csm?: string;
  stage?: string;
  renewalDate?: string;
}

export interface NPSAnalysisResult {
  surveyId: string;
  analyzedAt: Date;
  distribution: NPSDistribution;
  sentimentCorrelation: {
    promoterPositive: number;
    passiveNeutral: number;
    detractorNegative: number;
    overallMismatchRate: number;
  };
  themes: ThemeAggregation[];
  priorityDetractors: PriorityDetractor[];
  promoterOpportunities: PromoterOpportunity[];
  mismatches: ScoreSentimentMismatch[];
  processingStats: {
    totalResponses: number;
    analyzedVerbatims: number;
    processingTimeMs: number;
  };
}

// ============================================
// Sentiment Analysis Service
// ============================================

class NPSSentimentService {
  private anthropic: Anthropic | null = null;

  constructor() {
    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }
  }

  /**
   * Analyze a complete NPS survey with sentiment analysis
   */
  async analyzeSurvey(
    survey: ParsedNPSSurvey,
    options: {
      includeCustomerContext?: boolean;
      maxDetractors?: number;
      maxPromoters?: number;
    } = {}
  ): Promise<NPSAnalysisResult> {
    const startTime = Date.now();
    const {
      includeCustomerContext = true,
      maxDetractors = 10,
      maxPromoters = 10,
    } = options;

    // Get customer context for responses that have customer IDs
    const customerContextMap = includeCustomerContext
      ? await this.getCustomerContextMap(survey.responses)
      : new Map<string, CustomerContext>();

    // Analyze verbatim feedback
    const verbatimAnalyses = await this.analyzeVerbatims(survey.responses);
    const analysisMap = new Map(
      verbatimAnalyses.map(a => [a.responseId, a])
    );

    // Calculate sentiment correlation
    const sentimentCorrelation = this.calculateSentimentCorrelation(
      survey.responses,
      analysisMap
    );

    // Aggregate themes
    const themes = this.aggregateThemes(survey.responses, analysisMap);

    // Identify priority detractors
    const priorityDetractors = this.identifyPriorityDetractors(
      survey.responses.filter(r => r.category === 'detractor'),
      analysisMap,
      customerContextMap,
      maxDetractors
    );

    // Identify promoter opportunities
    const promoterOpportunities = this.identifyPromoterOpportunities(
      survey.responses.filter(r => r.category === 'promoter'),
      analysisMap,
      customerContextMap,
      maxPromoters
    );

    // Identify mismatches
    const mismatches = this.identifyMismatches(
      survey.responses,
      analysisMap
    );

    const processingTimeMs = Date.now() - startTime;

    return {
      surveyId: survey.id,
      analyzedAt: new Date(),
      distribution: survey.distribution,
      sentimentCorrelation,
      themes,
      priorityDetractors,
      promoterOpportunities,
      mismatches,
      processingStats: {
        totalResponses: survey.responses.length,
        analyzedVerbatims: verbatimAnalyses.length,
        processingTimeMs,
      },
    };
  }

  /**
   * Analyze verbatim feedback in batches
   */
  async analyzeVerbatims(
    responses: NPSSurveyRow[]
  ): Promise<VerbatimAnalysis[]> {
    // Filter responses with verbatim
    const withVerbatim = responses.filter(
      r => r.verbatim && r.verbatim.trim().length > 0
    );

    if (withVerbatim.length === 0) {
      return [];
    }

    // Process in batches to avoid rate limits
    const BATCH_SIZE = 20;
    const analyses: VerbatimAnalysis[] = [];

    for (let i = 0; i < withVerbatim.length; i += BATCH_SIZE) {
      const batch = withVerbatim.slice(i, i + BATCH_SIZE);
      const batchAnalyses = await this.analyzeBatch(batch);
      analyses.push(...batchAnalyses);
    }

    return analyses;
  }

  /**
   * Analyze a batch of verbatim responses
   */
  private async analyzeBatch(
    responses: NPSSurveyRow[]
  ): Promise<VerbatimAnalysis[]> {
    if (!this.anthropic || responses.length === 0) {
      // Return basic analysis without AI
      return responses.map(r => this.basicAnalysis(r));
    }

    try {
      const batchInput = responses.map((r, i) => ({
        index: i,
        score: r.score,
        verbatim: r.verbatim || '',
      }));

      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: `You are an expert at analyzing customer feedback for B2B SaaS companies.
Analyze NPS survey verbatim responses and extract sentiment, themes, and insights.

For each response, determine if there's a mismatch between the numeric score and the sentiment:
- Promoters (9-10) should have positive sentiment
- Passives (7-8) should have neutral/mixed sentiment
- Detractors (0-6) should have negative sentiment

A mismatch often indicates a specific issue (billing, adoption) rather than general dissatisfaction.`,
        messages: [{
          role: 'user',
          content: `Analyze these NPS verbatim responses:

${JSON.stringify(batchInput, null, 2)}

Return a JSON array with one analysis per response:
[
  {
    "index": 0,
    "sentiment": "positive" | "negative" | "mixed" | "neutral",
    "sentimentScore": number between -1 and 1,
    "themes": ["theme1", "theme2"], // max 3 key themes
    "keyPhrases": ["phrase1", "phrase2"], // notable quotes
    "emotionalTone": "frustrated" | "satisfied" | "neutral" | "enthusiastic" | etc,
    "actionableInsight": "specific action the CSM should take",
    "hasScoreMismatch": boolean,
    "mismatchReason": "if mismatch, explain why" | null
  }
]

Return ONLY valid JSON array, no markdown.`,
        }],
      });

      const textBlock = message.content.find(b => b.type === 'text');
      const responseText = textBlock?.type === 'text' ? textBlock.text : '[]';

      let parsed: Array<{
        index: number;
        sentiment: Sentiment;
        sentimentScore: number;
        themes: string[];
        keyPhrases: string[];
        emotionalTone: string;
        actionableInsight?: string;
        hasScoreMismatch: boolean;
        mismatchReason?: string;
      }>;

      try {
        let jsonStr = responseText.trim();
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        }
        parsed = JSON.parse(jsonStr);
      } catch {
        console.error('Failed to parse verbatim analysis response');
        return responses.map(r => this.basicAnalysis(r));
      }

      // Map analyses back to responses
      return responses.map((r, i) => {
        const analysis = parsed.find(p => p.index === i);
        if (!analysis) {
          return this.basicAnalysis(r);
        }

        return {
          responseId: r.id,
          sentiment: analysis.sentiment,
          sentimentScore: analysis.sentimentScore,
          themes: analysis.themes || [],
          keyPhrases: analysis.keyPhrases || [],
          emotionalTone: analysis.emotionalTone || 'neutral',
          actionableInsight: analysis.actionableInsight,
          hasScoreMismatch: analysis.hasScoreMismatch,
          mismatchReason: analysis.mismatchReason,
        };
      });
    } catch (error) {
      console.error('Error analyzing verbatim batch:', error);
      return responses.map(r => this.basicAnalysis(r));
    }
  }

  /**
   * Basic analysis without AI
   */
  private basicAnalysis(response: NPSSurveyRow): VerbatimAnalysis {
    const score = response.score;
    let sentiment: Sentiment;
    let sentimentScore: number;

    if (score >= 9) {
      sentiment = 'positive';
      sentimentScore = 0.8;
    } else if (score >= 7) {
      sentiment = 'neutral';
      sentimentScore = 0.2;
    } else {
      sentiment = 'negative';
      sentimentScore = -0.6;
    }

    return {
      responseId: response.id,
      sentiment,
      sentimentScore,
      themes: [],
      keyPhrases: [],
      emotionalTone: sentiment === 'positive' ? 'satisfied' : sentiment === 'negative' ? 'frustrated' : 'neutral',
      hasScoreMismatch: false,
    };
  }

  /**
   * Get customer context for responses
   */
  private async getCustomerContextMap(
    responses: NPSSurveyRow[]
  ): Promise<Map<string, CustomerContext>> {
    const contextMap = new Map<string, CustomerContext>();

    if (!supabase) return contextMap;

    // Get unique customer identifiers
    const customerIds = new Set(
      responses
        .map(r => r.customerId)
        .filter((id): id is string => !!id)
    );

    const customerNames = new Set(
      responses
        .map(r => r.customerName)
        .filter((name): name is string => !!name && !customerIds.has(name))
    );

    // Lookup by ID
    if (customerIds.size > 0) {
      const { data } = await supabase
        .from('customers')
        .select('id, name, arr, health_score, csm_email, stage, renewal_date')
        .in('id', Array.from(customerIds));

      if (data) {
        for (const customer of data) {
          contextMap.set(customer.id, {
            id: customer.id,
            name: customer.name,
            arr: customer.arr,
            healthScore: customer.health_score,
            csm: customer.csm_email,
            stage: customer.stage,
            renewalDate: customer.renewal_date,
          });
        }
      }
    }

    // Lookup by name (fuzzy match)
    if (customerNames.size > 0) {
      for (const name of customerNames) {
        const { data } = await supabase
          .from('customers')
          .select('id, name, arr, health_score, csm_email, stage, renewal_date')
          .ilike('name', `%${name}%`)
          .limit(1);

        if (data && data.length > 0) {
          const customer = data[0];
          contextMap.set(name, {
            id: customer.id,
            name: customer.name,
            arr: customer.arr,
            healthScore: customer.health_score,
            csm: customer.csm_email,
            stage: customer.stage,
            renewalDate: customer.renewal_date,
          });
        }
      }
    }

    return contextMap;
  }

  /**
   * Calculate sentiment correlation with NPS categories
   */
  private calculateSentimentCorrelation(
    responses: NPSSurveyRow[],
    analysisMap: Map<string, VerbatimAnalysis>
  ): NPSAnalysisResult['sentimentCorrelation'] {
    const promoters = responses.filter(r => r.category === 'promoter');
    const passives = responses.filter(r => r.category === 'passive');
    const detractors = responses.filter(r => r.category === 'detractor');

    const promoterPositive = this.calculateCorrelation(
      promoters,
      analysisMap,
      'positive'
    );
    const passiveNeutral = this.calculateCorrelation(
      passives,
      analysisMap,
      'neutral',
      'mixed'
    );
    const detractorNegative = this.calculateCorrelation(
      detractors,
      analysisMap,
      'negative'
    );

    // Calculate overall mismatch rate
    const totalWithVerbatim = responses.filter(r => analysisMap.has(r.id)).length;
    const mismatches = responses.filter(r => {
      const analysis = analysisMap.get(r.id);
      return analysis?.hasScoreMismatch;
    }).length;

    const overallMismatchRate = totalWithVerbatim > 0
      ? Math.round((mismatches / totalWithVerbatim) * 100)
      : 0;

    return {
      promoterPositive: Math.round(promoterPositive * 100),
      passiveNeutral: Math.round(passiveNeutral * 100),
      detractorNegative: Math.round(detractorNegative * 100),
      overallMismatchRate,
    };
  }

  private calculateCorrelation(
    responses: NPSSurveyRow[],
    analysisMap: Map<string, VerbatimAnalysis>,
    ...expectedSentiments: Sentiment[]
  ): number {
    const withAnalysis = responses.filter(r => analysisMap.has(r.id));
    if (withAnalysis.length === 0) return 0;

    const matching = withAnalysis.filter(r => {
      const analysis = analysisMap.get(r.id);
      return analysis && expectedSentiments.includes(analysis.sentiment);
    });

    return matching.length / withAnalysis.length;
  }

  /**
   * Aggregate themes from verbatim analysis
   */
  private aggregateThemes(
    responses: NPSSurveyRow[],
    analysisMap: Map<string, VerbatimAnalysis>
  ): ThemeAggregation[] {
    const themeData = new Map<string, {
      count: number;
      scores: number[];
      sentiments: Sentiment[];
      categories: string[];
      verbatims: string[];
    }>();

    for (const response of responses) {
      const analysis = analysisMap.get(response.id);
      if (!analysis) continue;

      for (const theme of analysis.themes) {
        const normalizedTheme = theme.toLowerCase().trim();
        if (!themeData.has(normalizedTheme)) {
          themeData.set(normalizedTheme, {
            count: 0,
            scores: [],
            sentiments: [],
            categories: [],
            verbatims: [],
          });
        }

        const data = themeData.get(normalizedTheme)!;
        data.count++;
        data.scores.push(response.score);
        data.sentiments.push(analysis.sentiment);
        data.categories.push(response.category);
        if (response.verbatim && data.verbatims.length < 3) {
          data.verbatims.push(response.verbatim.substring(0, 200));
        }
      }
    }

    // Convert to aggregations and sort by count
    const aggregations: ThemeAggregation[] = Array.from(themeData.entries())
      .map(([theme, data]) => {
        const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;

        // Determine primary sentiment
        const sentimentCounts = data.sentiments.reduce((acc, s) => {
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        const primarySentiment = Object.entries(sentimentCounts)
          .sort((a, b) => b[1] - a[1])[0][0] as Sentiment;

        // Determine primary segment
        const categoryCounts = data.categories.reduce((acc, c) => {
          acc[c] = (acc[c] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        const sortedCategories = Object.entries(categoryCounts)
          .sort((a, b) => b[1] - a[1]);
        const primarySegment = sortedCategories[0][1] > data.count * 0.6
          ? sortedCategories[0][0] as 'promoters' | 'passives' | 'detractors'
          : 'mixed';

        return {
          theme: theme.charAt(0).toUpperCase() + theme.slice(1),
          count: data.count,
          sentiment: primarySentiment,
          avgScore: Math.round(avgScore * 10) / 10,
          primarySegment,
          sampleVerbatims: data.verbatims,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 themes

    return aggregations;
  }

  /**
   * Identify and prioritize detractors
   */
  private identifyPriorityDetractors(
    detractors: NPSSurveyRow[],
    analysisMap: Map<string, VerbatimAnalysis>,
    customerContextMap: Map<string, CustomerContext>,
    maxCount: number
  ): PriorityDetractor[] {
    const prioritized = detractors.map(response => {
      const analysis = analysisMap.get(response.id) || this.basicAnalysis(response);
      const customer = response.customerId
        ? customerContextMap.get(response.customerId)
        : response.customerName
          ? customerContextMap.get(response.customerName)
          : undefined;

      // Calculate urgency score
      const urgencyFactors: string[] = [];
      let urgencyScore = 0;

      // Low score factor
      if (response.score <= 2) {
        urgencyScore += 30;
        urgencyFactors.push('Critical score (0-2)');
      } else if (response.score <= 4) {
        urgencyScore += 20;
        urgencyFactors.push('Low score (3-4)');
      }

      // Strong negative sentiment
      if (analysis.sentimentScore <= -0.7) {
        urgencyScore += 25;
        urgencyFactors.push('Strong negative sentiment');
      }

      // High ARR customer
      if (customer?.arr) {
        if (customer.arr >= 100000) {
          urgencyScore += 30;
          urgencyFactors.push(`High ARR ($${Math.round(customer.arr / 1000)}K)`);
        } else if (customer.arr >= 50000) {
          urgencyScore += 15;
          urgencyFactors.push(`Medium ARR ($${Math.round(customer.arr / 1000)}K)`);
        }
      }

      // Low health score
      if (customer?.healthScore !== undefined && customer.healthScore < 50) {
        urgencyScore += 20;
        urgencyFactors.push(`Low health score (${customer.healthScore})`);
      }

      // Upcoming renewal
      if (customer?.renewalDate) {
        const daysToRenewal = Math.ceil(
          (new Date(customer.renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (daysToRenewal <= 90) {
          urgencyScore += 25;
          urgencyFactors.push(`Renewal in ${daysToRenewal} days`);
        }
      }

      // Generate recommended action
      const recommendedAction = this.getRecommendedAction(response, analysis, customer);
      const suggestedResponseStrategy = this.getResponseStrategy(response, analysis);

      return {
        response,
        analysis,
        customer,
        urgencyScore,
        urgencyFactors,
        recommendedAction,
        suggestedResponseStrategy,
      };
    });

    // Sort by urgency score and return top N
    return prioritized
      .sort((a, b) => b.urgencyScore - a.urgencyScore)
      .slice(0, maxCount);
  }

  private getRecommendedAction(
    response: NPSSurveyRow,
    analysis: VerbatimAnalysis,
    customer?: CustomerContext
  ): string {
    if (response.score <= 2 || analysis.sentimentScore <= -0.8) {
      return 'Executive escalation - schedule immediate call';
    }

    if (customer?.arr && customer.arr >= 100000) {
      return 'High-touch outreach - CSM manager involvement';
    }

    if (analysis.themes.some(t => t.toLowerCase().includes('support'))) {
      return 'Schedule call + SLA review discussion';
    }

    if (analysis.themes.some(t =>
      t.toLowerCase().includes('feature') || t.toLowerCase().includes('integration')
    )) {
      return 'Product roadmap discussion';
    }

    return 'Personal follow-up call within 24 hours';
  }

  private getResponseStrategy(
    response: NPSSurveyRow,
    analysis: VerbatimAnalysis
  ): string {
    const themes = analysis.themes.map(t => t.toLowerCase());

    if (themes.some(t => t.includes('implement') || t.includes('onboard'))) {
      return 'Acknowledge implementation challenges, offer dedicated onboarding support or training session';
    }

    if (themes.some(t => t.includes('support') || t.includes('response'))) {
      return 'Apologize for support experience, review SLAs, introduce escalation path';
    }

    if (themes.some(t => t.includes('price') || t.includes('cost') || t.includes('value'))) {
      return 'Schedule value realization discussion, review ROI metrics and usage';
    }

    if (themes.some(t => t.includes('feature') || t.includes('missing'))) {
      return 'Discuss product roadmap, explore workarounds, log feature request';
    }

    return 'Express genuine concern, schedule discovery call to understand root cause';
  }

  /**
   * Identify promoter advocacy opportunities
   */
  private identifyPromoterOpportunities(
    promoters: NPSSurveyRow[],
    analysisMap: Map<string, VerbatimAnalysis>,
    customerContextMap: Map<string, CustomerContext>,
    maxCount: number
  ): PromoterOpportunity[] {
    const opportunities = promoters
      .filter(r => r.verbatim && r.verbatim.length > 20) // Need substantive verbatim
      .map(response => {
        const analysis = analysisMap.get(response.id) || this.basicAnalysis(response);
        const customer = response.customerId
          ? customerContextMap.get(response.customerId)
          : response.customerName
            ? customerContextMap.get(response.customerName)
            : undefined;

        // Calculate advocacy score
        let advocacyScore = 0;

        // Perfect score
        if (response.score === 10) advocacyScore += 30;
        else if (response.score === 9) advocacyScore += 20;

        // Strong positive sentiment
        if (analysis.sentimentScore >= 0.8) advocacyScore += 25;

        // High ARR = better reference
        if (customer?.arr) {
          if (customer.arr >= 100000) advocacyScore += 25;
          else if (customer.arr >= 50000) advocacyScore += 15;
        }

        // Healthy customer = reliable reference
        if (customer?.healthScore && customer.healthScore >= 80) {
          advocacyScore += 15;
        }

        // Long verbatim suggests engaged customer
        if (response.verbatim && response.verbatim.length > 100) {
          advocacyScore += 10;
        }

        // Determine opportunity type
        const opportunityType = this.determineOpportunityType(response, analysis, customer);

        // Extract highlight quote
        const verbatimHighlight = this.extractHighlight(response.verbatim || '');

        return {
          response,
          analysis,
          customer,
          advocacyScore,
          opportunityType,
          verbatimHighlight,
        };
      });

    return opportunities
      .sort((a, b) => b.advocacyScore - a.advocacyScore)
      .slice(0, maxCount);
  }

  private determineOpportunityType(
    response: NPSSurveyRow,
    analysis: VerbatimAnalysis,
    customer?: CustomerContext
  ): PromoterOpportunity['opportunityType'] {
    const verbatim = (response.verbatim || '').toLowerCase();
    const themes = analysis.themes.map(t => t.toLowerCase());

    // Long detailed feedback = case study material
    if (response.verbatim && response.verbatim.length > 200) {
      return 'case_study';
    }

    // Support praise = G2 review
    if (themes.some(t => t.includes('support') || t.includes('team'))) {
      return 'g2_review';
    }

    // Implementation success = reference call
    if (themes.some(t => t.includes('implement') || t.includes('transform'))) {
      return 'reference_call';
    }

    // High ARR = testimonial
    if (customer?.arr && customer.arr >= 100000) {
      return 'testimonial';
    }

    // Default to G2 review as lowest friction
    return 'g2_review';
  }

  private extractHighlight(verbatim: string): string {
    // Try to extract a quotable sentence
    const sentences = verbatim.split(/[.!?]+/).filter(s => s.trim().length > 20);

    // Prefer sentences with strong positive words
    const positiveWords = ['love', 'best', 'amazing', 'excellent', 'great', 'fantastic', 'transform'];
    const highlighted = sentences.find(s =>
      positiveWords.some(w => s.toLowerCase().includes(w))
    );

    if (highlighted) {
      return highlighted.trim().substring(0, 150);
    }

    // Return first sentence
    return sentences[0]?.trim().substring(0, 150) || verbatim.substring(0, 150);
  }

  /**
   * Identify score-sentiment mismatches
   */
  private identifyMismatches(
    responses: NPSSurveyRow[],
    analysisMap: Map<string, VerbatimAnalysis>
  ): ScoreSentimentMismatch[] {
    return responses
      .filter(r => {
        const analysis = analysisMap.get(r.id);
        return analysis?.hasScoreMismatch;
      })
      .map(response => {
        const analysis = analysisMap.get(response.id)!;

        // Determine expected sentiment
        let expectedSentiment: Sentiment;
        if (response.category === 'promoter') {
          expectedSentiment = 'positive';
        } else if (response.category === 'passive') {
          expectedSentiment = 'neutral';
        } else {
          expectedSentiment = 'negative';
        }

        return {
          response,
          analysis,
          expectedSentiment,
          actualSentiment: analysis.sentiment,
          rootCause: analysis.mismatchReason || 'Unknown',
          recommendation: this.getMismatchRecommendation(response, analysis),
        };
      })
      .slice(0, 10);
  }

  private getMismatchRecommendation(
    response: NPSSurveyRow,
    analysis: VerbatimAnalysis
  ): string {
    // Detractor with positive sentiment = specific issue
    if (response.category === 'detractor' && analysis.sentiment === 'positive') {
      if (analysis.mismatchReason?.toLowerCase().includes('price')) {
        return 'Schedule pricing/value discussion - customer likes product but has billing concerns';
      }
      if (analysis.mismatchReason?.toLowerCase().includes('adopt')) {
        return 'Focus on adoption and training - satisfaction issue, not product issue';
      }
      return 'Investigate specific issue - customer sentiment is positive despite low score';
    }

    // Promoter with negative sentiment = concerning
    if (response.category === 'promoter' && analysis.sentiment === 'negative') {
      return 'Urgent follow-up needed - high score may not reflect true sentiment';
    }

    return 'Investigate the disconnect between numeric score and verbatim feedback';
  }
}

export const npsSentimentService = new NPSSentimentService();
export default npsSentimentService;
