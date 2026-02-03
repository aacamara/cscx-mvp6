/**
 * Competitive Intelligence Service (PRD-068)
 *
 * Aggregates competitive data from multiple sources to provide
 * account-specific competitive intelligence for CSMs.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { ClaudeService } from './claude.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Types
export interface CompetitorStatus {
  competitorId: string | null;
  competitorName: string;
  status: 'active_threat' | 'incumbent' | 'past_evaluation' | 'market_presence';
  relationship: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  lastMentioned: string | null;
  mentionCount: number;
  firstDetected: string;
}

export interface CompetitiveMention {
  id: string;
  competitorName: string;
  sourceType: string;
  sourceText: string;
  context: string | null;
  sentiment: 'positive' | 'neutral' | 'negative';
  intent: string;
  mentionedBy: string | null;
  mentionedAt: string;
  extractedConcerns: string[];
  extractedInterests: string[];
}

export interface BattleCardExcerpt {
  competitorId: string;
  competitorName: string;
  title: string;
  ourStrengths: Array<{ capability: string; advantage: string }>;
  theirWeaknesses: string[];
  keyDifferentiators: string[];
  talkTracks: Array<{ scenario: string; script: string }>;
}

export interface FeatureGap {
  featureName: string;
  competitorName: string;
  ourStatus: string;
  ourRoadmapQuarter: string | null;
  priority: 'high' | 'medium' | 'low';
  mentionCount: number;
  impactOnDeal: string;
  workaround: string | null;
}

export interface TechStackItem {
  category: string;
  productName: string;
  vendor: string | null;
  isCompetitor: boolean;
  integrationStatus: string | null;
  spendEstimate: number | null;
}

export interface RecommendedAction {
  action: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  reason: string;
  relatedCompetitor?: string;
}

export interface CompetitorAnalysis {
  competitorName: string;
  status: string;
  timeline: CompetitiveMention[];
  whatTheyAreLookingFor: string[];
  theirConcernsAboutUs: string[];
  ourStrengths: Array<{ capability: string; us: string; them: string; advantage: string }>;
  recommendedDefenseStrategy: string[];
  battleCardExcerpt: string | null;
}

export interface CompetitiveIntelligence {
  customerId: string;
  accountName: string;
  generatedAt: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  riskScore: number;
  activeThreats: CompetitorStatus[];
  incumbents: CompetitorStatus[];
  competitorAnalyses: CompetitorAnalysis[];
  featureGaps: FeatureGap[];
  techStack: TechStackItem[];
  mentionTrend: Array<{ period: string; count: number }>;
  historicalContext: {
    pastEvaluations: Array<{ competitor: string; when: string; outcome: string; whyWeWon: string }>;
    originalDealContext: { displaced: string | null; keyDifferentiators: string[]; decisionMaker: string | null };
  };
  recommendations: RecommendedAction[];
  aiAnalysis: string;
  dataCompleteness: number;
}

class CompetitiveIntelligenceService {
  private claude: ClaudeService;

  constructor() {
    this.claude = new ClaudeService();
  }

  /**
   * Generate comprehensive competitive intelligence for an account
   */
  async generateIntelligence(customerId: string, period?: string): Promise<CompetitiveIntelligence | null> {
    if (!supabase) {
      return this.generateMockIntelligence(customerId);
    }

    // Fetch all data in parallel
    const [
      customerData,
      customerCompetitors,
      competitiveMentions,
      battleCards,
      featureGaps,
      techStack
    ] = await Promise.all([
      this.fetchCustomerData(customerId),
      this.fetchCustomerCompetitors(customerId),
      this.fetchCompetitiveMentions(customerId, period),
      this.fetchBattleCards(),
      this.fetchFeatureGaps(customerId),
      this.fetchTechStack(customerId)
    ]);

    if (!customerData) {
      return null;
    }

    // Categorize competitors
    const activeThreats = customerCompetitors.filter(c => c.status === 'active_threat');
    const incumbents = customerCompetitors.filter(c => c.status === 'incumbent');

    // Calculate risk score
    const riskScore = this.calculateRiskScore(activeThreats, incumbents, competitiveMentions);
    const riskLevel = this.getRiskLevel(riskScore);

    // Generate competitor analyses
    const competitorAnalyses = await this.generateCompetitorAnalyses(
      customerCompetitors,
      competitiveMentions,
      battleCards
    );

    // Calculate mention trend
    const mentionTrend = this.calculateMentionTrend(competitiveMentions);

    // Build historical context
    const historicalContext = this.buildHistoricalContext(customerCompetitors, customerData);

    // Calculate data completeness
    const dataCompleteness = this.calculateDataCompleteness({
      customerCompetitors,
      competitiveMentions,
      battleCards,
      featureGaps,
      techStack
    });

    // Generate AI analysis and recommendations
    const { analysis, recommendations } = await this.generateAIAnalysis(
      customerData,
      activeThreats,
      incumbents,
      competitiveMentions,
      featureGaps
    );

    return {
      customerId,
      accountName: customerData.name,
      generatedAt: new Date().toISOString(),
      riskLevel,
      riskScore,
      activeThreats: activeThreats.map(this.formatCompetitorStatus),
      incumbents: incumbents.map(this.formatCompetitorStatus),
      competitorAnalyses,
      featureGaps: this.formatFeatureGaps(featureGaps),
      techStack: this.formatTechStack(techStack),
      mentionTrend,
      historicalContext,
      recommendations,
      aiAnalysis: analysis,
      dataCompleteness
    };
  }

  /**
   * Record a new competitive mention
   */
  async recordMention(data: {
    customerId: string;
    competitorName: string;
    sourceType: string;
    sourceId?: string;
    sourceText: string;
    context?: string;
    mentionedBy?: string;
    mentionedAt?: string;
  }): Promise<CompetitiveMention | null> {
    if (!supabase) {
      return null;
    }

    // Find or create competitor
    let competitorId: string | null = null;
    const { data: existingCompetitor } = await supabase
      .from('competitors')
      .select('id')
      .ilike('name', data.competitorName)
      .single();

    if (existingCompetitor) {
      competitorId = existingCompetitor.id;
    } else {
      // Create new competitor entry
      const { data: newCompetitor } = await supabase
        .from('competitors')
        .insert({ name: data.competitorName, category: 'unknown' })
        .select('id')
        .single();
      competitorId = newCompetitor?.id || null;
    }

    // Analyze the mention with AI
    const analysisResult = await this.analyzeMention(data.sourceText, data.context);

    // Insert the mention
    const { data: mention, error } = await supabase
      .from('competitive_mentions')
      .insert({
        customer_id: data.customerId,
        competitor_id: competitorId,
        competitor_name: data.competitorName,
        source_type: data.sourceType,
        source_id: data.sourceId,
        source_text: data.sourceText,
        context: data.context,
        sentiment: analysisResult.sentiment,
        intent: analysisResult.intent,
        mentioned_by: data.mentionedBy,
        mentioned_at: data.mentionedAt || new Date().toISOString(),
        extracted_concerns: analysisResult.concerns,
        extracted_interests: analysisResult.interests
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording competitive mention:', error);
      return null;
    }

    // Update customer_competitors table
    await this.updateCustomerCompetitor(data.customerId, competitorId, data.competitorName, analysisResult);

    return this.formatMention(mention);
  }

  /**
   * Get battle card for a specific competitor
   */
  async getBattleCard(competitorId: string): Promise<BattleCardExcerpt | null> {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('battle_cards')
      .select('*, competitors(name)')
      .eq('competitor_id', competitorId)
      .eq('status', 'active')
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      competitorId: data.competitor_id,
      competitorName: data.competitors?.name || 'Unknown',
      title: data.title,
      ourStrengths: data.our_strengths || [],
      theirWeaknesses: data.their_weaknesses || [],
      keyDifferentiators: data.key_differentiators || [],
      talkTracks: data.talk_tracks || []
    };
  }

  // Private helper methods

  private async fetchCustomerData(customerId: string) {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error) {
      console.error('Error fetching customer:', error);
      return null;
    }

    return data;
  }

  private async fetchCustomerCompetitors(customerId: string) {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('customer_competitors')
      .select('*')
      .eq('customer_id', customerId)
      .order('last_mentioned_at', { ascending: false });

    if (error) {
      console.error('Error fetching customer competitors:', error);
      return [];
    }

    return data || [];
  }

  private async fetchCompetitiveMentions(customerId: string, period?: string) {
    if (!supabase) return [];

    let query = supabase
      .from('competitive_mentions')
      .select('*')
      .eq('customer_id', customerId)
      .order('mentioned_at', { ascending: false });

    if (period) {
      const startDate = this.parseTimePeriod(period);
      if (startDate) {
        query = query.gte('mentioned_at', startDate.toISOString());
      }
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error('Error fetching competitive mentions:', error);
      return [];
    }

    return data || [];
  }

  private async fetchBattleCards() {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('battle_cards')
      .select('*, competitors(id, name)')
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching battle cards:', error);
      return [];
    }

    return data || [];
  }

  private async fetchFeatureGaps(customerId: string) {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('feature_gaps')
      .select('*, competitors(name)')
      .or(`customer_id.eq.${customerId},customer_id.is.null`)
      .order('priority', { ascending: true });

    if (error) {
      console.error('Error fetching feature gaps:', error);
      return [];
    }

    return data || [];
  }

  private async fetchTechStack(customerId: string) {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('customer_tech_stack')
      .select('*')
      .eq('customer_id', customerId)
      .order('category');

    if (error) {
      console.error('Error fetching tech stack:', error);
      return [];
    }

    return data || [];
  }

  private parseTimePeriod(period: string): Date | null {
    const now = new Date();
    const lower = period.toLowerCase();

    if (lower.includes('30 day') || lower.includes('month')) {
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (lower.includes('quarter') || lower.includes('90 day') || lower.includes('3 month')) {
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (lower.includes('6 month')) {
      return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    } else if (lower.includes('year') || lower.includes('12 month')) {
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }

    return null;
  }

  private calculateRiskScore(
    activeThreats: any[],
    incumbents: any[],
    mentions: any[]
  ): number {
    let score = 0;

    // Active evaluation is highest risk
    score += activeThreats.length * 40;

    // Each incumbent adds moderate risk
    score += incumbents.length * 15;

    // Recent mention frequency
    const recentMentions = mentions.filter(m => {
      const mentionDate = new Date(m.mentioned_at);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return mentionDate >= thirtyDaysAgo;
    });
    score += Math.min(recentMentions.length * 5, 30);

    // Feature gaps mentioned
    const featureGapMentions = mentions.filter(m => m.intent === 'comparison' || m.intent === 'complaint');
    score += Math.min(featureGapMentions.length * 3, 15);

    return Math.min(100, score);
  }

  private getRiskLevel(score: number): 'critical' | 'high' | 'medium' | 'low' {
    if (score >= 70) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }

  private formatCompetitorStatus(competitor: any): CompetitorStatus {
    return {
      competitorId: competitor.competitor_id,
      competitorName: competitor.competitor_name,
      status: competitor.status,
      relationship: competitor.relationship || '',
      riskLevel: competitor.risk_level || 'medium',
      lastMentioned: competitor.last_mentioned_at,
      mentionCount: competitor.mention_count || 0,
      firstDetected: competitor.first_detected_at
    };
  }

  private formatMention(mention: any): CompetitiveMention {
    return {
      id: mention.id,
      competitorName: mention.competitor_name,
      sourceType: mention.source_type,
      sourceText: mention.source_text,
      context: mention.context,
      sentiment: mention.sentiment,
      intent: mention.intent,
      mentionedBy: mention.mentioned_by,
      mentionedAt: mention.mentioned_at,
      extractedConcerns: mention.extracted_concerns || [],
      extractedInterests: mention.extracted_interests || []
    };
  }

  private formatFeatureGaps(gaps: any[]): FeatureGap[] {
    return gaps.map(g => ({
      featureName: g.feature_name,
      competitorName: g.competitors?.name || 'Unknown',
      ourStatus: g.our_status,
      ourRoadmapQuarter: g.our_roadmap_quarter,
      priority: g.priority,
      mentionCount: g.mention_count || 0,
      impactOnDeal: g.impact_on_deal || 'unknown',
      workaround: g.workaround
    }));
  }

  private formatTechStack(stack: any[]): TechStackItem[] {
    return stack.map(s => ({
      category: s.category,
      productName: s.product_name,
      vendor: s.vendor,
      isCompetitor: s.is_competitor,
      integrationStatus: s.integration_status,
      spendEstimate: s.spend_estimate
    }));
  }

  private async generateCompetitorAnalyses(
    customerCompetitors: any[],
    mentions: any[],
    battleCards: any[]
  ): Promise<CompetitorAnalysis[]> {
    const analyses: CompetitorAnalysis[] = [];

    // Only analyze active threats and incumbents
    const relevantCompetitors = customerCompetitors.filter(
      c => c.status === 'active_threat' || c.status === 'incumbent'
    );

    for (const competitor of relevantCompetitors.slice(0, 5)) {
      const competitorMentions = mentions
        .filter(m => m.competitor_name.toLowerCase() === competitor.competitor_name.toLowerCase())
        .sort((a, b) => new Date(b.mentioned_at).getTime() - new Date(a.mentioned_at).getTime());

      const battleCard = battleCards.find(
        bc => bc.competitors?.name?.toLowerCase() === competitor.competitor_name.toLowerCase()
      );

      // Extract what they're looking for from mentions
      const whatTheyAreLookingFor = new Set<string>();
      const theirConcernsAboutUs = new Set<string>();

      competitorMentions.forEach(m => {
        (m.extracted_interests || []).forEach((i: string) => whatTheyAreLookingFor.add(i));
        (m.extracted_concerns || []).forEach((c: string) => theirConcernsAboutUs.add(c));
      });

      // Build strengths comparison
      const ourStrengths = battleCard?.our_strengths?.map((s: any) => ({
        capability: s.capability || s.name || 'Feature',
        us: s.us || s.value || 'Available',
        them: s.them || 'Limited',
        advantage: s.advantage || s.description || ''
      })) || [];

      // Generate defense strategy
      const recommendedDefenseStrategy = this.generateDefenseStrategy(
        competitor.status,
        Array.from(whatTheyAreLookingFor),
        Array.from(theirConcernsAboutUs),
        battleCard
      );

      analyses.push({
        competitorName: competitor.competitor_name,
        status: this.formatStatus(competitor.status),
        timeline: competitorMentions.slice(0, 5).map(this.formatMention),
        whatTheyAreLookingFor: Array.from(whatTheyAreLookingFor),
        theirConcernsAboutUs: Array.from(theirConcernsAboutUs),
        ourStrengths,
        recommendedDefenseStrategy,
        battleCardExcerpt: battleCard?.talk_tracks?.[0]?.script || null
      });
    }

    return analyses;
  }

  private formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'active_threat': 'Actively Evaluating',
      'incumbent': 'Using Alongside',
      'past_evaluation': 'Previously Evaluated',
      'market_presence': 'In Their Market'
    };
    return statusMap[status] || status;
  }

  private generateDefenseStrategy(
    status: string,
    whatTheyWant: string[],
    concerns: string[],
    battleCard: any
  ): string[] {
    const strategies: string[] = [];

    if (status === 'active_threat') {
      strategies.push('Schedule ROI review showing actual value delivered');
      strategies.push('Demo advanced features they may not know about');
      if (concerns.length > 0) {
        strategies.push(`Address concerns: ${concerns.slice(0, 2).join(', ')}`);
      }
    } else if (status === 'incumbent') {
      strategies.push('Identify overlap areas for consolidation pitch');
      strategies.push('Demonstrate single-source-of-truth benefits');
      strategies.push('Calculate potential cost savings from vendor consolidation');
    }

    // Add battle card strategies if available
    if (battleCard?.objection_handlers?.length > 0) {
      const handler = battleCard.objection_handlers[0];
      strategies.push(`Objection response ready: "${handler.objection}"`);
    }

    return strategies;
  }

  private calculateMentionTrend(mentions: any[]): Array<{ period: string; count: number }> {
    const now = new Date();
    const quarters: Array<{ period: string; count: number }> = [];

    for (let i = 0; i < 4; i++) {
      const quarterStart = new Date(now.getFullYear(), now.getMonth() - 3 * (i + 1), 1);
      const quarterEnd = new Date(now.getFullYear(), now.getMonth() - 3 * i, 1);

      const count = mentions.filter(m => {
        const date = new Date(m.mentioned_at);
        return date >= quarterStart && date < quarterEnd;
      }).length;

      const quarterLabel = `Q${Math.ceil((quarterEnd.getMonth() + 1) / 3)} ${quarterEnd.getFullYear()}`;
      quarters.unshift({ period: quarterLabel, count });
    }

    return quarters;
  }

  private buildHistoricalContext(customerCompetitors: any[], customer: any) {
    const pastEvaluations = customerCompetitors
      .filter(c => c.status === 'past_evaluation')
      .map(c => ({
        competitor: c.competitor_name,
        when: this.formatQuarter(c.first_detected_at),
        outcome: c.relationship === 'displaced' ? 'Lost' : 'Won',
        whyWeWon: c.notes || 'Integration depth and support quality'
      }));

    return {
      pastEvaluations,
      originalDealContext: {
        displaced: customer.metadata?.displaced_competitor || null,
        keyDifferentiators: customer.metadata?.key_differentiators || [],
        decisionMaker: customer.metadata?.original_decision_maker || null
      }
    };
  }

  private formatQuarter(dateStr: string): string {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const quarter = Math.ceil((date.getMonth() + 1) / 3);
    return `Q${quarter} ${date.getFullYear()}`;
  }

  private calculateDataCompleteness(data: {
    customerCompetitors: any[];
    competitiveMentions: any[];
    battleCards: any[];
    featureGaps: any[];
    techStack: any[];
  }): number {
    let sections = 0;
    let populatedSections = 0;

    const checks = [
      { name: 'Competitors', hasData: data.customerCompetitors.length > 0 },
      { name: 'Mentions', hasData: data.competitiveMentions.length > 0 },
      { name: 'Battle Cards', hasData: data.battleCards.length > 0 },
      { name: 'Feature Gaps', hasData: data.featureGaps.length > 0 },
      { name: 'Tech Stack', hasData: data.techStack.length > 0 }
    ];

    checks.forEach(check => {
      sections++;
      if (check.hasData) populatedSections++;
    });

    return Math.round((populatedSections / sections) * 100);
  }

  private async analyzeMention(text: string, context?: string | null): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative';
    intent: string;
    concerns: string[];
    interests: string[];
  }> {
    const prompt = `Analyze this competitive mention from a customer conversation:

Text: "${text}"
${context ? `Context: "${context}"` : ''}

Return a JSON object with:
1. "sentiment": "positive", "neutral", or "negative" (about the competitor)
2. "intent": one of "evaluation", "comparison", "complaint", "praise", "question"
3. "concerns": array of concerns the customer has about OUR product (max 3)
4. "interests": array of things they like about the competitor (max 3)

Return ONLY the JSON object.`;

    try {
      const response = await this.claude.generate(prompt, 'You are a competitive intelligence analyst.');
      let jsonString = response.trim();
      if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/```json?\n?/g, '').replace(/```/g, '');
      }
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Error analyzing mention:', error);
      return {
        sentiment: 'neutral',
        intent: 'question',
        concerns: [],
        interests: []
      };
    }
  }

  private async updateCustomerCompetitor(
    customerId: string,
    competitorId: string | null,
    competitorName: string,
    analysis: { sentiment: string; intent: string }
  ) {
    if (!supabase || !competitorId) return;

    // Determine status based on intent
    let status = 'market_presence';
    let riskLevel = 'low';

    if (analysis.intent === 'evaluation') {
      status = 'active_threat';
      riskLevel = 'critical';
    } else if (analysis.intent === 'comparison' || analysis.intent === 'complaint') {
      status = 'active_threat';
      riskLevel = 'high';
    }

    // Upsert customer_competitor record
    const { error } = await supabase
      .from('customer_competitors')
      .upsert({
        customer_id: customerId,
        competitor_id: competitorId,
        competitor_name: competitorName,
        status,
        risk_level: riskLevel,
        last_mentioned_at: new Date().toISOString(),
        mention_count: 1 // Will be incremented via SQL if exists
      }, {
        onConflict: 'customer_id,competitor_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Error updating customer competitor:', error);
    }
  }

  private async generateAIAnalysis(
    customer: any,
    activeThreats: any[],
    incumbents: any[],
    mentions: any[],
    featureGaps: any[]
  ): Promise<{ analysis: string; recommendations: RecommendedAction[] }> {
    const systemPrompt = `You are a competitive intelligence analyst for Customer Success.
Given account data and competitive information, provide strategic analysis and recommendations.
Be specific, actionable, and prioritize based on revenue impact.`;

    const competitiveData = {
      accountName: customer.name,
      arr: customer.arr,
      healthScore: customer.health_score,
      activeThreats: activeThreats.map(t => ({
        name: t.competitor_name,
        mentions: t.mention_count
      })),
      incumbents: incumbents.map(i => ({
        name: i.competitor_name,
        relationship: i.relationship
      })),
      recentMentionCount: mentions.filter(m => {
        const date = new Date(m.mentioned_at);
        return date >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }).length,
      topFeatureGaps: featureGaps.slice(0, 3).map(g => g.feature_name)
    };

    const prompt = `Analyze this account's competitive situation and provide:
1. A 2-3 sentence strategic analysis
2. 3-5 prioritized recommendations

Account Data:
${JSON.stringify(competitiveData, null, 2)}

Return a JSON object with exactly this structure:
{
  "analysis": "strategic analysis text",
  "recommendations": [
    { "action": "specific action", "priority": "urgent|high|medium|low", "reason": "why", "relatedCompetitor": "name if applicable" }
  ]
}

Return ONLY the JSON object.`;

    try {
      const response = await this.claude.generate(prompt, systemPrompt);
      let jsonString = response.trim();
      if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/```json?\n?/g, '').replace(/```/g, '');
      }
      const parsed = JSON.parse(jsonString);

      return {
        analysis: parsed.analysis || 'Unable to generate analysis.',
        recommendations: (parsed.recommendations || []).map((r: any) => ({
          action: r.action,
          priority: r.priority || 'medium',
          reason: r.reason || '',
          relatedCompetitor: r.relatedCompetitor
        }))
      };
    } catch (error) {
      console.error('Error generating AI analysis:', error);

      // Fallback analysis
      const hasActiveThreats = activeThreats.length > 0;
      return {
        analysis: hasActiveThreats
          ? `${customer.name} has ${activeThreats.length} active competitive threat(s) requiring immediate attention. Focus on value reinforcement and addressing specific concerns.`
          : `${customer.name} has moderate competitive presence. Monitor for changes and maintain strong engagement.`,
        recommendations: hasActiveThreats
          ? [
              {
                action: 'Schedule ROI review meeting',
                priority: 'urgent' as const,
                reason: 'Active competitive evaluation detected',
                relatedCompetitor: activeThreats[0]?.competitor_name
              },
              {
                action: 'Prepare competitive battle card materials',
                priority: 'high' as const,
                reason: 'Arm team with differentiation messaging'
              }
            ]
          : [
              {
                action: 'Continue regular engagement cadence',
                priority: 'medium' as const,
                reason: 'No immediate competitive threats'
              }
            ]
      };
    }
  }

  private generateMockIntelligence(customerId: string): CompetitiveIntelligence {
    return {
      customerId,
      accountName: 'Demo Account',
      generatedAt: new Date().toISOString(),
      riskLevel: 'medium',
      riskScore: 45,
      activeThreats: [
        {
          competitorId: 'comp-1',
          competitorName: 'CompetitorX',
          status: 'active_threat',
          relationship: 'evaluating',
          riskLevel: 'high',
          lastMentioned: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          mentionCount: 3,
          firstDetected: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      ],
      incumbents: [
        {
          competitorId: 'comp-2',
          competitorName: 'CompetitorY',
          status: 'incumbent',
          relationship: 'using_alongside',
          riskLevel: 'medium',
          lastMentioned: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
          mentionCount: 2,
          firstDetected: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
        }
      ],
      competitorAnalyses: [
        {
          competitorName: 'CompetitorX',
          status: 'Actively Evaluating',
          timeline: [
            {
              id: 'm1',
              competitorName: 'CompetitorX',
              sourceType: 'qbr',
              sourceText: 'CEO asked about feature parity with CompetitorX',
              context: 'QBR meeting',
              sentiment: 'neutral',
              intent: 'comparison',
              mentionedBy: 'CEO',
              mentionedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              extractedConcerns: ['Reporting is harder to customize'],
              extractedInterests: ['Advanced dashboards']
            }
          ],
          whatTheyAreLookingFor: ['Advanced reporting', 'Better mobile experience', 'Lower price point'],
          theirConcernsAboutUs: ['Reporting customization', 'Mobile app feels dated', 'Higher cost per user'],
          ourStrengths: [
            { capability: 'Integration depth', us: '3x more integrations', them: 'Limited', advantage: 'Connect to more tools' },
            { capability: 'Enterprise security', us: 'SOC2 Type II, HIPAA', them: 'SOC2 only', advantage: 'Better compliance' }
          ],
          recommendedDefenseStrategy: [
            'Schedule ROI review showing actual value delivered',
            'Demo advanced reporting features they may not know about',
            'Emphasize integration depth and security compliance'
          ],
          battleCardExcerpt: 'CompetitorX may seem easier on the surface, but enterprise customers consistently find their reporting breaks at scale.'
        }
      ],
      featureGaps: [
        {
          featureName: 'Custom dashboards',
          competitorName: 'CompetitorX',
          ourStatus: 'in_development',
          ourRoadmapQuarter: 'Q2 2026',
          priority: 'high',
          mentionCount: 3,
          impactOnDeal: 'major',
          workaround: 'Use Sheets integration for custom reports'
        }
      ],
      techStack: [
        { category: 'CRM', productName: 'Salesforce', vendor: 'Salesforce', isCompetitor: false, integrationStatus: 'integrated', spendEstimate: 50000 },
        { category: 'Analytics', productName: 'CompetitorY', vendor: 'CompetitorY Inc', isCompetitor: true, integrationStatus: 'none', spendEstimate: 30000 }
      ],
      mentionTrend: [
        { period: 'Q4 2025', count: 1 },
        { period: 'Q1 2026', count: 3 }
      ],
      historicalContext: {
        pastEvaluations: [],
        originalDealContext: {
          displaced: null,
          keyDifferentiators: ['Integration depth', 'CSM model'],
          decisionMaker: 'VP Operations'
        }
      },
      recommendations: [
        {
          action: 'Schedule ROI review with VP Operations',
          priority: 'urgent',
          reason: 'Active CompetitorX evaluation detected',
          relatedCompetitor: 'CompetitorX'
        },
        {
          action: 'Demo analytics module to displace CompetitorY',
          priority: 'high',
          reason: 'Consolidation opportunity worth ~$30K',
          relatedCompetitor: 'CompetitorY'
        }
      ],
      aiAnalysis: 'Demo Account is actively evaluating CompetitorX, with 3 mentions in the last 30 days. The customer is comparing reporting capabilities and pricing. There is also an opportunity to consolidate by replacing their CompetitorY analytics with our module.',
      dataCompleteness: 80
    };
  }
}

export const competitiveIntelligenceService = new CompetitiveIntelligenceService();
