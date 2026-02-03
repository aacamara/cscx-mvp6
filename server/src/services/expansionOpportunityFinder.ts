/**
 * Expansion Opportunity Finder Service
 * PRD-060: Expansion Opportunity Finder
 *
 * Automatically identifies and surfaces expansion opportunities across the
 * customer portfolio by analyzing usage patterns, feature adoption gaps,
 * stakeholder signals, and contract headroom.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { ClaudeService } from './claude.js';

// ============================================
// Types (inline for server - mirrors client types)
// ============================================

type OpportunityType = 'upsell' | 'cross_sell' | 'seat_expansion' | 'tier_upgrade';
type OpportunityTimeline = 'immediate' | '30_days' | '60_days' | 'next_renewal';
type ConfidenceLevel = 'high' | 'medium' | 'low';
type ExpansionSignalCategory = 'usage' | 'contract' | 'stakeholder' | 'whitespace';

interface ExpansionSignal {
  id: string;
  category: ExpansionSignalCategory;
  signalType: string;
  description: string;
  detectedAt: string;
  strength: number;
  source: string;
  metadata?: Record<string, unknown>;
}

interface Stakeholder {
  id: string;
  name: string;
  role: string;
  email?: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
  lastContact?: string;
  isChampion: boolean;
}

interface ExpansionOpportunity {
  id: string;
  customerId: string;
  customerName: string;
  opportunityType: OpportunityType;
  estimatedValue: number;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  signals: ExpansionSignal[];
  suggestedApproach: string;
  champion: Stakeholder | null;
  timeline: OpportunityTimeline;
  blockers: string[];
  currentArr: number;
  healthScore: number;
  segment: string;
  renewalDate?: string;
  daysToRenewal?: number;
  detectedAt: string;
  lastUpdated: string;
}

interface OpportunitySummary {
  totalOpportunities: number;
  totalPotentialValue: number;
  highConfidence: { count: number; value: number };
  mediumConfidence: { count: number; value: number };
  lowConfidence: { count: number; value: number };
  byTimeline: {
    immediate: { count: number; value: number };
    thirtyDays: { count: number; value: number };
    sixtyDays: { count: number; value: number };
    nextRenewal: { count: number; value: number };
  };
  byType: {
    upsell: { count: number; value: number; avgConfidence: number };
    crossSell: { count: number; value: number; avgConfidence: number };
    seatExpansion: { count: number; value: number; avgConfidence: number };
    tierUpgrade: { count: number; value: number; avgConfidence: number };
  };
}

interface QuickWin {
  opportunity: ExpansionOpportunity;
  score: number;
  reason: string;
}

interface ExpansionOpportunityFilters {
  csmId?: string;
  opportunityType?: OpportunityType | 'all';
  minValue?: number;
  confidenceFilter?: ConfidenceLevel | 'all';
  timeline?: OpportunityTimeline | 'all';
  search?: string;
  sortBy?: 'value' | 'confidence' | 'timeline' | 'customer';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// ============================================
// Configuration
// ============================================

const CONFIDENCE_WEIGHTS = {
  signalStrength: 0.35,
  healthScore: 0.25,
  championEngagement: 0.20,
  historicalExpansion: 0.20
};

const THRESHOLDS = {
  seatUtilization: 0.90,
  featureUsageLimit: 0.95,
  usageGrowthRate: 0.30,
  apiUsageThreshold: 0.80,
  entitlementThreshold: 0.80
};

// ============================================
// Expansion Opportunity Finder Service
// ============================================

export class ExpansionOpportunityFinderService {
  private supabase: SupabaseClient | null = null;
  private claude: ClaudeService;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
    this.claude = new ClaudeService();
  }

  // ============================================
  // Main Entry Points
  // ============================================

  /**
   * Get expansion opportunities across the portfolio
   */
  async findOpportunities(
    filters: ExpansionOpportunityFilters = {}
  ): Promise<{
    summary: OpportunitySummary;
    opportunities: ExpansionOpportunity[];
    quickWins: QuickWin[];
    generatedAt: string;
  }> {
    if (!this.supabase) {
      return this.generateMockOpportunities(filters);
    }

    // Fetch all active, healthy customers
    let query = this.supabase
      .from('customers')
      .select(`
        id, name, arr, health_score, segment, renewal_date, stage,
        contracted_seats, tier, csm_id, primary_contact_id, industry
      `)
      .eq('stage', 'active')
      .gte('health_score', 50); // Only healthy accounts for expansion

    // Filter by CSM if provided
    if (filters.csmId) {
      query = query.eq('csm_id', filters.csmId);
    }

    // Search filter
    if (filters.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    const { data: customers, error } = await query;

    if (error) {
      console.error('[ExpansionOpportunityFinder] Error fetching customers:', error);
      return this.generateMockOpportunities(filters);
    }

    // Analyze each customer for expansion opportunities
    const opportunities: ExpansionOpportunity[] = [];

    for (const customer of customers || []) {
      const opportunity = await this.analyzeCustomerOpportunity(customer);
      if (opportunity) {
        opportunities.push(opportunity);
      }
    }

    // Apply filters
    let filteredOpportunities = this.applyFilters(opportunities, filters);

    // Sort opportunities
    filteredOpportunities = this.sortOpportunities(filteredOpportunities, filters);

    // Apply pagination
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const paginatedOpportunities = filteredOpportunities.slice(offset, offset + limit);

    // Generate summary
    const summary = this.generateSummary(filteredOpportunities);

    // Identify quick wins
    const quickWins = this.identifyQuickWins(filteredOpportunities);

    return {
      summary,
      opportunities: paginatedOpportunities,
      quickWins,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Get expansion opportunities for a specific customer
   */
  async getCustomerOpportunity(customerId: string): Promise<ExpansionOpportunity | null> {
    if (!this.supabase) {
      return null;
    }

    const { data: customer } = await this.supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (!customer) {
      return null;
    }

    return this.analyzeCustomerOpportunity(customer);
  }

  // ============================================
  // Opportunity Analysis
  // ============================================

  private async analyzeCustomerOpportunity(customer: any): Promise<ExpansionOpportunity | null> {
    const signals: ExpansionSignal[] = [];

    // Detect usage-based signals
    const usageSignals = await this.detectUsageSignals(customer.id);
    signals.push(...usageSignals);

    // Detect contract-based signals
    const contractSignals = await this.detectContractSignals(customer.id);
    signals.push(...contractSignals);

    // Detect stakeholder signals
    const stakeholderSignals = await this.detectStakeholderSignals(customer.id);
    signals.push(...stakeholderSignals);

    // No signals? No opportunity
    if (signals.length === 0) {
      return null;
    }

    // Calculate confidence score
    const confidenceFactors = await this.calculateConfidenceFactors(customer, signals);
    const confidenceScore = this.computeConfidenceScore(confidenceFactors);
    const confidenceLevel = this.getConfidenceLevel(confidenceScore);

    // Determine opportunity type and estimate value
    const { opportunityType, estimatedValue, timeline } = this.classifyOpportunity(signals, customer);

    // Find champion
    const champion = await this.findChampion(customer.id);

    // Generate suggested approach
    const suggestedApproach = await this.generateApproach(signals, customer, champion);

    // Identify blockers
    const blockers = this.identifyBlockers(customer, signals);

    // Calculate days to renewal
    const daysToRenewal = customer.renewal_date
      ? Math.ceil((new Date(customer.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : undefined;

    return {
      id: `opp_${customer.id}_${Date.now()}`,
      customerId: customer.id,
      customerName: customer.name,
      opportunityType,
      estimatedValue,
      confidenceScore,
      confidenceLevel,
      signals,
      suggestedApproach,
      champion,
      timeline,
      blockers,
      currentArr: customer.arr || 0,
      healthScore: customer.health_score || 0,
      segment: customer.segment || 'unknown',
      renewalDate: customer.renewal_date,
      daysToRenewal,
      detectedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
  }

  // ============================================
  // Signal Detection Methods
  // ============================================

  private async detectUsageSignals(customerId: string): Promise<ExpansionSignal[]> {
    const signals: ExpansionSignal[] = [];

    if (!this.supabase) return signals;

    // Get usage metrics
    const { data: metrics } = await this.supabase
      .from('usage_metrics')
      .select('*')
      .eq('customer_id', customerId)
      .order('metric_date', { ascending: false })
      .limit(30);

    if (!metrics || metrics.length === 0) return signals;

    const latest = metrics[0];
    const customer = await this.getCustomer(customerId);

    // Signal 1: Seat Utilization > 90%
    const activeUsers = latest.active_users || 0;
    const contractedSeats = customer?.contracted_seats || 10;
    const seatUtilization = activeUsers / contractedSeats;

    if (seatUtilization > THRESHOLDS.seatUtilization) {
      signals.push({
        id: `sig_seat_${customerId}`,
        category: 'usage',
        signalType: 'seat_utilization_high',
        description: `${Math.round(seatUtilization * 100)}% seat utilization (${activeUsers}/${contractedSeats} seats)`,
        detectedAt: new Date().toISOString(),
        strength: Math.min(100, Math.round(seatUtilization * 100)),
        source: 'usage_metrics',
        metadata: {
          activeUsers,
          contractedSeats,
          utilizationPercent: Math.round(seatUtilization * 100)
        }
      });
    }

    // Signal 2: API Usage > 80% of limit
    const apiCalls = latest.api_calls || 0;
    const apiLimit = customer?.api_call_limit || 100000;
    const apiUtilization = apiCalls / apiLimit;

    if (apiUtilization > THRESHOLDS.apiUsageThreshold) {
      signals.push({
        id: `sig_api_${customerId}`,
        category: 'usage',
        signalType: 'api_usage_surge',
        description: `API usage at ${Math.round(apiUtilization * 100)}% of limit`,
        detectedAt: new Date().toISOString(),
        strength: Math.min(100, Math.round(apiUtilization * 100)),
        source: 'usage_metrics',
        metadata: {
          apiCalls,
          apiLimit,
          utilizationPercent: Math.round(apiUtilization * 100)
        }
      });
    }

    // Signal 3: Usage Growth > 30%
    if (metrics.length >= 14) {
      const recentUsage = metrics.slice(0, 7).reduce((sum, m) => sum + (m.login_count || 0), 0) / 7;
      const previousUsage = metrics.slice(7, 14).reduce((sum, m) => sum + (m.login_count || 0), 0) / 7;

      if (previousUsage > 0) {
        const growthRate = (recentUsage - previousUsage) / previousUsage;
        if (growthRate > THRESHOLDS.usageGrowthRate) {
          signals.push({
            id: `sig_growth_${customerId}`,
            category: 'usage',
            signalType: 'usage_growth',
            description: `${Math.round(growthRate * 100)}% usage growth vs prior period`,
            detectedAt: new Date().toISOString(),
            strength: Math.min(100, Math.round(50 + growthRate * 100)),
            source: 'usage_metrics',
            metadata: {
              recentAverage: Math.round(recentUsage),
              previousAverage: Math.round(previousUsage),
              growthPercent: Math.round(growthRate * 100)
            }
          });
        }
      }
    }

    return signals;
  }

  private async detectContractSignals(customerId: string): Promise<ExpansionSignal[]> {
    const signals: ExpansionSignal[] = [];

    if (!this.supabase) return signals;

    // Get contract and entitlements
    const { data: contracts } = await this.supabase
      .from('contracts')
      .select('*, entitlements(*)')
      .eq('customer_id', customerId)
      .eq('status', 'active');

    if (!contracts || contracts.length === 0) return signals;

    const contract = contracts[0];
    const entitlements = contract.entitlements || [];

    // Signal 1: Approaching entitlement limits
    for (const entitlement of entitlements) {
      if (entitlement.usage_current && entitlement.usage_limit) {
        const utilization = entitlement.usage_current / entitlement.usage_limit;
        if (utilization > THRESHOLDS.entitlementThreshold) {
          signals.push({
            id: `sig_ent_${entitlement.id}`,
            category: 'contract',
            signalType: 'entitlement_approaching',
            description: `${entitlement.type} at ${Math.round(utilization * 100)}% of limit`,
            detectedAt: new Date().toISOString(),
            strength: Math.min(100, Math.round(utilization * 100)),
            source: 'contract_entitlements',
            metadata: {
              entitlementType: entitlement.type,
              current: entitlement.usage_current,
              limit: entitlement.usage_limit
            }
          });
        }
      }
    }

    // Signal 2: Single year contract (multi-year opportunity)
    const startDate = new Date(contract.start_date);
    const endDate = new Date(contract.end_date);
    const termMonths = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));

    if (termMonths <= 12) {
      signals.push({
        id: `sig_multiyear_${customerId}`,
        category: 'contract',
        signalType: 'multi_year_available',
        description: 'Single year contract - multi-year conversion opportunity',
        detectedAt: new Date().toISOString(),
        strength: 65,
        source: 'contract_terms',
        metadata: { currentTermMonths: termMonths }
      });
    }

    // Signal 3: Missing products (cross-sell)
    const { data: allProducts } = await this.supabase
      .from('products')
      .select('id, name')
      .eq('status', 'active');

    const contractedProductIds = entitlements.map((e: any) => e.product_id).filter(Boolean);
    const missingProducts = (allProducts || []).filter(p => !contractedProductIds.includes(p.id));

    if (missingProducts.length > 0) {
      signals.push({
        id: `sig_products_${customerId}`,
        category: 'contract',
        signalType: 'missing_products',
        description: `${missingProducts.length} additional products available`,
        detectedAt: new Date().toISOString(),
        strength: 55,
        source: 'product_catalog',
        metadata: {
          missingProducts: missingProducts.map(p => p.name),
          count: missingProducts.length
        }
      });
    }

    return signals;
  }

  private async detectStakeholderSignals(customerId: string): Promise<ExpansionSignal[]> {
    const signals: ExpansionSignal[] = [];

    if (!this.supabase) return signals;

    // Check meeting analyses for expansion signals
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const { data: meetings } = await this.supabase
      .from('meeting_analyses')
      .select('*')
      .eq('customer_id', customerId)
      .gte('analyzed_at', thirtyDaysAgo.toISOString());

    if (meetings) {
      for (const meeting of meetings) {
        const expansionSignals = meeting.expansion_signals || [];
        const keyTopics = meeting.key_topics || [];

        // Check for budget discussions
        if (keyTopics.some((t: string) => t.toLowerCase().includes('budget'))) {
          const budgetMention = meeting.summary?.toLowerCase().includes('budget') ? meeting.summary : null;
          signals.push({
            id: `sig_budget_${meeting.id}`,
            category: 'stakeholder',
            signalType: 'budget_discussion',
            description: 'Budget discussed positively in recent meeting',
            detectedAt: meeting.analyzed_at,
            strength: 70,
            source: 'meeting_analysis',
            metadata: { meetingId: meeting.id, quote: budgetMention }
          });
        }

        // Check for new department mentions
        for (const sig of expansionSignals) {
          if (sig.type === 'new_department' || sig.description?.includes('team') || sig.description?.includes('department')) {
            signals.push({
              id: `sig_dept_${meeting.id}`,
              category: 'stakeholder',
              signalType: 'new_department',
              description: sig.description || 'New department expressing interest',
              detectedAt: meeting.analyzed_at,
              strength: 75,
              source: 'meeting_analysis',
              metadata: { meetingId: meeting.id, quote: sig.quote }
            });
          }

          // Check for growth goals
          if (sig.type === 'growth_goals' || sig.description?.includes('grow') || sig.description?.includes('expand')) {
            signals.push({
              id: `sig_growth_goal_${meeting.id}`,
              category: 'stakeholder',
              signalType: 'exec_growth_goals',
              description: sig.description || 'Executive mentioned growth goals',
              detectedAt: meeting.analyzed_at,
              strength: 80,
              source: 'meeting_analysis',
              metadata: { meetingId: meeting.id, quote: sig.quote }
            });
          }
        }

        // Check for competitor mentions (comparison shopping)
        const competitorMentions = meeting.competitor_mentions || [];
        if (competitorMentions.length > 0) {
          signals.push({
            id: `sig_competitor_${meeting.id}`,
            category: 'stakeholder',
            signalType: 'comparison_shopping',
            description: 'Asked about features vs competitors',
            detectedAt: meeting.analyzed_at,
            strength: 65,
            source: 'meeting_analysis',
            metadata: {
              meetingId: meeting.id,
              competitors: competitorMentions.map((c: any) => c.competitor)
            }
          });
        }
      }
    }

    return signals;
  }

  // ============================================
  // Confidence Calculation
  // ============================================

  private async calculateConfidenceFactors(
    customer: any,
    signals: ExpansionSignal[]
  ): Promise<{
    signalStrength: number;
    healthScore: number;
    championEngagement: number;
    historicalExpansion: number;
  }> {
    // Signal strength: average of all signal strengths
    const signalStrength = signals.length > 0
      ? signals.reduce((sum, s) => sum + s.strength, 0) / signals.length
      : 0;

    // Health score (already 0-100)
    const healthScore = customer.health_score || 50;

    // Champion engagement: check for recent stakeholder activity
    let championEngagement = 50; // Default
    if (this.supabase) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const { data: activities } = await this.supabase
        .from('agent_activity_log')
        .select('id')
        .eq('customer_id', customer.id)
        .gte('started_at', thirtyDaysAgo.toISOString())
        .limit(10);

      if (activities) {
        championEngagement = Math.min(100, 40 + activities.length * 6);
      }
    }

    // Historical expansion: check for past expansion opportunities
    let historicalExpansion = 50; // Default
    if (this.supabase) {
      const { data: pastExpansions } = await this.supabase
        .from('expansion_opportunities')
        .select('id, stage')
        .eq('customer_id', customer.id)
        .eq('stage', 'closed_won');

      if (pastExpansions && pastExpansions.length > 0) {
        historicalExpansion = Math.min(100, 60 + pastExpansions.length * 10);
      }
    }

    return {
      signalStrength,
      healthScore,
      championEngagement,
      historicalExpansion
    };
  }

  private computeConfidenceScore(factors: {
    signalStrength: number;
    healthScore: number;
    championEngagement: number;
    historicalExpansion: number;
  }): number {
    return Math.round(
      factors.signalStrength * CONFIDENCE_WEIGHTS.signalStrength +
      factors.healthScore * CONFIDENCE_WEIGHTS.healthScore +
      factors.championEngagement * CONFIDENCE_WEIGHTS.championEngagement +
      factors.historicalExpansion * CONFIDENCE_WEIGHTS.historicalExpansion
    );
  }

  private getConfidenceLevel(score: number): ConfidenceLevel {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  // ============================================
  // Opportunity Classification
  // ============================================

  private classifyOpportunity(
    signals: ExpansionSignal[],
    customer: any
  ): {
    opportunityType: OpportunityType;
    estimatedValue: number;
    timeline: OpportunityTimeline;
  } {
    const currentArr = customer.arr || 0;
    const signalTypes = signals.map(s => s.signalType);

    let opportunityType: OpportunityType = 'upsell';
    let valueMultiplier = 0.2;
    let timeline: OpportunityTimeline = '30_days';

    // Seat expansion takes precedence
    if (signalTypes.includes('seat_utilization_high')) {
      opportunityType = 'seat_expansion';
      const seatSignal = signals.find(s => s.signalType === 'seat_utilization_high');
      const utilization = (seatSignal?.metadata?.utilizationPercent || 90) / 100;
      valueMultiplier = Math.min(0.5, (utilization - 0.9) * 3 + 0.2);
      timeline = utilization > 0.95 ? 'immediate' : '30_days';
    }
    // API/tier upgrade
    else if (signalTypes.includes('api_usage_surge') || signalTypes.includes('usage_growth')) {
      opportunityType = 'tier_upgrade';
      valueMultiplier = 0.4;
      timeline = signalTypes.includes('api_usage_surge') ? 'immediate' : '30_days';
    }
    // Cross-sell for missing products
    else if (signalTypes.includes('missing_products') || signalTypes.includes('comparison_shopping')) {
      opportunityType = 'cross_sell';
      valueMultiplier = 0.35;
      timeline = '60_days';
    }
    // Default upsell
    else {
      opportunityType = 'upsell';
      valueMultiplier = 0.25;
      timeline = signalTypes.includes('exec_growth_goals') ? '30_days' : '60_days';
    }

    // Adjust timeline based on renewal proximity
    if (customer.renewal_date) {
      const daysToRenewal = Math.ceil(
        (new Date(customer.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysToRenewal <= 90) {
        timeline = 'next_renewal';
      }
    }

    const estimatedValue = Math.round(currentArr * valueMultiplier);

    return { opportunityType, estimatedValue, timeline };
  }

  // ============================================
  // Champion Identification
  // ============================================

  private async findChampion(customerId: string): Promise<Stakeholder | null> {
    if (!this.supabase) return null;

    const { data: stakeholders } = await this.supabase
      .from('stakeholders')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (!stakeholders || stakeholders.length === 0) return null;

    // Find the best champion candidate
    // Prefer: Executive sponsor > Decision maker > Primary contact
    const priorityRoles = ['executive sponsor', 'decision maker', 'champion', 'primary contact'];

    for (const role of priorityRoles) {
      const champion = stakeholders.find(s =>
        s.role?.toLowerCase().includes(role) ||
        s.title?.toLowerCase().includes(role)
      );
      if (champion) {
        return {
          id: champion.id,
          name: champion.name,
          role: champion.role || champion.title || 'Contact',
          email: champion.email,
          sentiment: champion.metadata?.sentiment || 'unknown',
          lastContact: champion.updated_at,
          isChampion: true
        };
      }
    }

    // Fall back to first stakeholder
    const first = stakeholders[0];
    return {
      id: first.id,
      name: first.name,
      role: first.role || first.title || 'Contact',
      email: first.email,
      sentiment: first.metadata?.sentiment || 'unknown',
      lastContact: first.updated_at,
      isChampion: false
    };
  }

  // ============================================
  // Approach Generation
  // ============================================

  private async generateApproach(
    signals: ExpansionSignal[],
    customer: any,
    champion: Stakeholder | null
  ): Promise<string> {
    const signalDescriptions = signals.map(s => `- ${s.description}`).join('\n');
    const championInfo = champion ? `Champion: ${champion.name} (${champion.role})` : 'No champion identified';

    try {
      const prompt = `Generate a concise 2-3 step approach for pursuing an expansion opportunity.

Customer: ${customer.name}
ARR: $${(customer.arr || 0).toLocaleString()}
Health Score: ${customer.health_score}/100
${championInfo}

Signals Detected:
${signalDescriptions}

Provide actionable steps. Format as numbered list. Keep it under 100 words.`;

      const response = await this.claude.generate(prompt);
      return response.trim();
    } catch (error) {
      // Fallback to template-based approach
      const primarySignal = signals[0]?.signalType || 'general';
      return this.getTemplateApproach(primarySignal, champion?.name);
    }
  }

  private getTemplateApproach(signalType: string, championName?: string): string {
    const champion = championName ? championName : 'the champion';

    const templates: Record<string, string> = {
      seat_utilization_high: `1. Lead with value delivered to current users\n2. Propose pilot for additional seats\n3. Bundle with training for new users`,
      api_usage_surge: `1. Highlight current API usage and growth\n2. Present tier options with enhanced limits\n3. Discuss future scaling needs with ${champion}`,
      usage_growth: `1. Celebrate growth milestone with ${champion}\n2. Present expansion options aligned with trajectory\n3. Propose success planning session`,
      missing_products: `1. Schedule discovery call on additional use cases\n2. Offer product demo for relevant modules\n3. Present ROI case study from similar customer`,
      new_department: `1. Map new department's requirements\n2. Schedule intro meeting with new stakeholders\n3. Propose department-specific pilot`,
      exec_growth_goals: `1. Align expansion to stated growth goals\n2. Present strategic partnership options\n3. Schedule executive sponsor meeting`
    };

    return templates[signalType] || `1. Review expansion signals with ${champion}\n2. Present relevant upgrade options\n3. Schedule follow-up discussion`;
  }

  // ============================================
  // Blocker Identification
  // ============================================

  private identifyBlockers(customer: any, signals: ExpansionSignal[]): string[] {
    const blockers: string[] = [];

    // Health score concern
    if (customer.health_score < 70) {
      blockers.push(`Health score at ${customer.health_score}/100 - address product concerns first`);
    }

    // Renewal too close
    if (customer.renewal_date) {
      const daysToRenewal = Math.ceil(
        (new Date(customer.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysToRenewal < 30) {
        blockers.push('Renewal in less than 30 days - prioritize renewal before expansion');
      }
    }

    // No champion identified
    const hasChampionSignal = signals.some(s =>
      s.category === 'stakeholder' && s.strength >= 70
    );
    if (!hasChampionSignal) {
      blockers.push('No strong champion engagement - build executive relationships');
    }

    return blockers;
  }

  // ============================================
  // Summary Generation
  // ============================================

  private generateSummary(opportunities: ExpansionOpportunity[]): OpportunitySummary {
    const totalOpportunities = opportunities.length;
    const totalPotentialValue = opportunities.reduce((sum, o) => sum + o.estimatedValue, 0);

    const highConf = opportunities.filter(o => o.confidenceLevel === 'high');
    const mediumConf = opportunities.filter(o => o.confidenceLevel === 'medium');
    const lowConf = opportunities.filter(o => o.confidenceLevel === 'low');

    const byType = (type: OpportunityType) => {
      const filtered = opportunities.filter(o => o.opportunityType === type);
      return {
        count: filtered.length,
        value: filtered.reduce((sum, o) => sum + o.estimatedValue, 0),
        avgConfidence: filtered.length > 0
          ? Math.round(filtered.reduce((sum, o) => sum + o.confidenceScore, 0) / filtered.length)
          : 0
      };
    };

    const byTimeline = (timeline: OpportunityTimeline) => {
      const filtered = opportunities.filter(o => o.timeline === timeline);
      return {
        count: filtered.length,
        value: filtered.reduce((sum, o) => sum + o.estimatedValue, 0)
      };
    };

    return {
      totalOpportunities,
      totalPotentialValue,
      highConfidence: {
        count: highConf.length,
        value: highConf.reduce((sum, o) => sum + o.estimatedValue, 0)
      },
      mediumConfidence: {
        count: mediumConf.length,
        value: mediumConf.reduce((sum, o) => sum + o.estimatedValue, 0)
      },
      lowConfidence: {
        count: lowConf.length,
        value: lowConf.reduce((sum, o) => sum + o.estimatedValue, 0)
      },
      byTimeline: {
        immediate: byTimeline('immediate'),
        thirtyDays: byTimeline('30_days'),
        sixtyDays: byTimeline('60_days'),
        nextRenewal: byTimeline('next_renewal')
      },
      byType: {
        upsell: byType('upsell'),
        crossSell: byType('cross_sell'),
        seatExpansion: byType('seat_expansion'),
        tierUpgrade: byType('tier_upgrade')
      }
    };
  }

  // ============================================
  // Quick Wins Identification
  // ============================================

  private identifyQuickWins(opportunities: ExpansionOpportunity[]): QuickWin[] {
    // Quick wins = high value + high confidence + immediate/30-day timeline
    const candidates = opportunities.filter(o =>
      o.confidenceLevel === 'high' &&
      (o.timeline === 'immediate' || o.timeline === '30_days')
    );

    // Score and sort
    const scored = candidates.map(o => {
      // Normalize value to 0-40 (assume max $200k value for scaling)
      const valueScore = Math.min(40, (o.estimatedValue / 200000) * 40);
      // Confidence score already 0-100, scale to 0-40
      const confScore = (o.confidenceScore / 100) * 40;
      // Timeline score: immediate = 20, 30_days = 15
      const timeScore = o.timeline === 'immediate' ? 20 : 15;

      const totalScore = valueScore + confScore + timeScore;

      return {
        opportunity: o,
        score: Math.round(totalScore),
        reason: this.generateQuickWinReason(o)
      };
    });

    // Sort by score and return top 5
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  private generateQuickWinReason(opportunity: ExpansionOpportunity): string {
    const reasons: string[] = [];

    if (opportunity.confidenceScore >= 80) {
      reasons.push('Very high confidence');
    }
    if (opportunity.timeline === 'immediate') {
      reasons.push('Ready to act now');
    }
    if (opportunity.estimatedValue >= 50000) {
      reasons.push('High value opportunity');
    }
    if (opportunity.champion) {
      reasons.push('Champion identified');
    }

    return reasons.join(', ') || 'Strong expansion potential';
  }

  // ============================================
  // Filtering and Sorting
  // ============================================

  private applyFilters(
    opportunities: ExpansionOpportunity[],
    filters: ExpansionOpportunityFilters
  ): ExpansionOpportunity[] {
    let filtered = [...opportunities];

    if (filters.opportunityType && filters.opportunityType !== 'all') {
      filtered = filtered.filter(o => o.opportunityType === filters.opportunityType);
    }

    if (filters.minValue) {
      filtered = filtered.filter(o => o.estimatedValue >= filters.minValue!);
    }

    if (filters.confidenceFilter && filters.confidenceFilter !== 'all') {
      filtered = filtered.filter(o => o.confidenceLevel === filters.confidenceFilter);
    }

    if (filters.timeline && filters.timeline !== 'all') {
      filtered = filtered.filter(o => o.timeline === filters.timeline);
    }

    return filtered;
  }

  private sortOpportunities(
    opportunities: ExpansionOpportunity[],
    filters: ExpansionOpportunityFilters
  ): ExpansionOpportunity[] {
    const sortBy = filters.sortBy || 'value';
    const sortOrder = filters.sortOrder || 'desc';
    const multiplier = sortOrder === 'asc' ? 1 : -1;

    return opportunities.sort((a, b) => {
      switch (sortBy) {
        case 'value':
          return (a.estimatedValue - b.estimatedValue) * multiplier;
        case 'confidence':
          return (a.confidenceScore - b.confidenceScore) * multiplier;
        case 'timeline':
          const timelineOrder = { immediate: 0, '30_days': 1, '60_days': 2, next_renewal: 3 };
          return (timelineOrder[a.timeline] - timelineOrder[b.timeline]) * multiplier;
        case 'customer':
          return a.customerName.localeCompare(b.customerName) * multiplier;
        default:
          return 0;
      }
    });
  }

  // ============================================
  // Helper Methods
  // ============================================

  private async getCustomer(customerId: string): Promise<any | null> {
    if (!this.supabase) return null;

    const { data } = await this.supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    return data;
  }

  // ============================================
  // Mock Data Generation
  // ============================================

  private generateMockOpportunities(filters: ExpansionOpportunityFilters): {
    summary: OpportunitySummary;
    opportunities: ExpansionOpportunity[];
    quickWins: QuickWin[];
    generatedAt: string;
  } {
    const mockOpportunities: ExpansionOpportunity[] = [
      {
        id: 'opp_mock_1',
        customerId: 'cust_1',
        customerName: 'Acme Corp',
        opportunityType: 'seat_expansion',
        estimatedValue: 45000,
        confidenceScore: 85,
        confidenceLevel: 'high',
        signals: [
          {
            id: 'sig_1',
            category: 'usage',
            signalType: 'seat_utilization_high',
            description: '96% seat utilization (48/50 seats)',
            detectedAt: new Date().toISOString(),
            strength: 96,
            source: 'usage_metrics'
          },
          {
            id: 'sig_2',
            category: 'stakeholder',
            signalType: 'new_department',
            description: '3 departments requesting access in last 30 days',
            detectedAt: new Date().toISOString(),
            strength: 75,
            source: 'meeting_analysis'
          }
        ],
        suggestedApproach: '1. Lead with value delivered to current users\n2. Propose pilot for requesting departments (15 seats)\n3. Bundle with power feature upgrade for better pricing',
        champion: {
          id: 'stake_1',
          name: 'Sarah Chen',
          role: 'VP Operations',
          email: 'sarah@acme.com',
          sentiment: 'positive',
          isChampion: true
        },
        timeline: 'immediate',
        blockers: [],
        currentArr: 180000,
        healthScore: 88,
        segment: 'Enterprise',
        renewalDate: '2026-09-15',
        daysToRenewal: 230,
        detectedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'opp_mock_2',
        customerId: 'cust_2',
        customerName: 'Beta Inc',
        opportunityType: 'cross_sell',
        estimatedValue: 35000,
        confidenceScore: 72,
        confidenceLevel: 'high',
        signals: [
          {
            id: 'sig_3',
            category: 'usage',
            signalType: 'new_use_case',
            description: 'Heavy export usage suggests analytics need',
            detectedAt: new Date().toISOString(),
            strength: 70,
            source: 'usage_metrics'
          },
          {
            id: 'sig_4',
            category: 'stakeholder',
            signalType: 'comparison_shopping',
            description: 'Competitor analytics mentioned in last QBR',
            detectedAt: new Date().toISOString(),
            strength: 65,
            source: 'meeting_analysis'
          }
        ],
        suggestedApproach: '1. Offer analytics demo to CFO and team\n2. Present ROI case study from similar company\n3. Bundle with training credits',
        champion: {
          id: 'stake_2',
          name: 'Michael Ross',
          role: 'CFO',
          email: 'mross@beta.com',
          sentiment: 'positive',
          isChampion: true
        },
        timeline: '30_days',
        blockers: [],
        currentArr: 120000,
        healthScore: 82,
        segment: 'Mid-Market',
        renewalDate: '2026-06-01',
        daysToRenewal: 124,
        detectedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'opp_mock_3',
        customerId: 'cust_3',
        customerName: 'Delta Co',
        opportunityType: 'tier_upgrade',
        estimatedValue: 28000,
        confidenceScore: 88,
        confidenceLevel: 'high',
        signals: [
          {
            id: 'sig_5',
            category: 'contract',
            signalType: 'multi_year_available',
            description: 'Single year contract - 15% multi-year discount available',
            detectedAt: new Date().toISOString(),
            strength: 90,
            source: 'contract_terms'
          }
        ],
        suggestedApproach: '1. Present multi-year value proposition\n2. Highlight pricing lock and discount\n3. Propose 3-year term with Q1 start',
        champion: {
          id: 'stake_3',
          name: 'Lisa Park',
          role: 'VP Finance',
          email: 'lpark@delta.com',
          sentiment: 'positive',
          isChampion: true
        },
        timeline: 'immediate',
        blockers: [],
        currentArr: 95000,
        healthScore: 91,
        segment: 'Mid-Market',
        renewalDate: '2026-03-15',
        daysToRenewal: 46,
        detectedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      },
      {
        id: 'opp_mock_4',
        customerId: 'cust_4',
        customerName: 'Epsilon Ltd',
        opportunityType: 'upsell',
        estimatedValue: 32000,
        confidenceScore: 80,
        confidenceLevel: 'high',
        signals: [
          {
            id: 'sig_6',
            category: 'usage',
            signalType: 'api_usage_surge',
            description: 'API usage at 87% of limit',
            detectedAt: new Date().toISOString(),
            strength: 87,
            source: 'usage_metrics'
          },
          {
            id: 'sig_7',
            category: 'stakeholder',
            signalType: 'exec_growth_goals',
            description: 'CEO mentioned 2x growth target in QBR',
            detectedAt: new Date().toISOString(),
            strength: 85,
            source: 'meeting_analysis'
          }
        ],
        suggestedApproach: '1. Present API tier upgrade options\n2. Align to stated growth goals\n3. Schedule technical deep-dive with engineering',
        champion: {
          id: 'stake_4',
          name: 'James Wong',
          role: 'CTO',
          email: 'jwong@epsilon.com',
          sentiment: 'positive',
          isChampion: true
        },
        timeline: 'immediate',
        blockers: [],
        currentArr: 110000,
        healthScore: 86,
        segment: 'Enterprise',
        renewalDate: '2026-08-01',
        daysToRenewal: 184,
        detectedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      }
    ];

    // Apply filters to mock data
    let filtered = this.applyFilters(mockOpportunities, filters);
    filtered = this.sortOpportunities(filtered, filters);

    const summary = this.generateSummary(filtered);
    const quickWins = this.identifyQuickWins(filtered);

    return {
      summary,
      opportunities: filtered,
      quickWins,
      generatedAt: new Date().toISOString()
    };
  }
}

// Singleton export
export const expansionOpportunityFinderService = new ExpansionOpportunityFinderService();
