/**
 * Expansion Signal Detector Service
 * PRD-103: Expansion Signal Detected
 *
 * Monitors multiple data sources (usage, meetings, emails, support)
 * for indicators of expansion potential.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  ExpansionSignalType,
  ExpansionType,
  DetectedSignal,
  ExpansionSignalDetectionResult,
  CustomerCurrentState,
  CustomerUsageMetrics,
  MeetingExpansionSignal,
  EXPANSION_SIGNAL_CONFIGS,
} from './types.js';

// ============================================
// Expansion Signal Detector
// ============================================

export class ExpansionSignalDetector {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Main Detection Entry Point
  // ============================================

  /**
   * Scan a customer for expansion signals
   * Aggregates signals from all sources and calculates composite score
   */
  async detectSignals(customerId: string): Promise<ExpansionSignalDetectionResult | null> {
    if (!this.supabase) {
      console.warn('[ExpansionDetector] Supabase not configured');
      return null;
    }

    // Get customer data
    const customer = await this.getCustomer(customerId);
    if (!customer) {
      console.warn(`[ExpansionDetector] Customer ${customerId} not found`);
      return null;
    }

    const signals: DetectedSignal[] = [];

    // FR-1.1: Usage approaching tier limits
    const usageSignal = await this.detectUsageLimitApproaching(customerId);
    if (usageSignal) signals.push(usageSignal);

    // FR-1.2: New users beyond contracted seats
    const seatSignal = await this.detectSeatOverage(customerId);
    if (seatSignal) signals.push(seatSignal);

    // FR-1.3: Interest in higher-tier features (from meetings)
    const featureSignals = await this.detectFeatureInterest(customerId);
    signals.push(...featureSignals);

    // FR-1.4: Expansion mentions in meetings/emails
    const mentionSignals = await this.detectExpansionMentions(customerId);
    signals.push(...mentionSignals);

    // FR-1.5: New department/team onboarding
    const teamSignal = await this.detectNewTeamOnboarding(customerId);
    if (teamSignal) signals.push(teamSignal);

    // FR-1.6: API usage growth
    const apiSignal = await this.detectApiUsageGrowth(customerId);
    if (apiSignal) signals.push(apiSignal);

    // FR-1.7: Competitor displacement signals
    const competitorSignals = await this.detectCompetitorDisplacement(customerId);
    signals.push(...competitorSignals);

    // No signals detected
    if (signals.length === 0) {
      return null;
    }

    // Calculate composite score (weighted average)
    const compositeScore = this.calculateCompositeScore(signals);

    // Determine expansion type and estimate ARR
    const { expansionType, estimatedArr, suggestedProducts, approach } =
      this.analyzeExpansionOpportunity(signals, customer);

    return {
      customerId,
      customerName: customer.name,
      signals,
      compositeScore,
      estimatedExpansionArr: estimatedArr,
      suggestedProducts,
      recommendedApproach: approach,
      expansionType,
      currentState: {
        arr: customer.arr || 0,
        plan: customer.tier || 'Professional',
        healthScore: customer.health_score || 70,
        contractEndDate: customer.renewal_date ? new Date(customer.renewal_date) : undefined,
        activeUsers: customer.active_users || 0,
        contractedSeats: customer.contracted_seats || 10,
        tier: customer.tier,
      },
    };
  }

  /**
   * Scan all active customers for expansion signals
   * For scheduled daily scan
   */
  async scanAllCustomers(minCompositeScore = 0.6): Promise<ExpansionSignalDetectionResult[]> {
    if (!this.supabase) return [];

    // Get all active customers
    const { data: customers, error } = await this.supabase
      .from('customers')
      .select('id')
      .eq('stage', 'active')
      .order('arr', { ascending: false });

    if (error || !customers) {
      console.error('[ExpansionDetector] Failed to fetch customers:', error);
      return [];
    }

    const results: ExpansionSignalDetectionResult[] = [];

    for (const customer of customers) {
      try {
        const result = await this.detectSignals(customer.id);
        if (result && result.compositeScore >= minCompositeScore) {
          results.push(result);
        }
      } catch (err) {
        console.error(`[ExpansionDetector] Error scanning customer ${customer.id}:`, err);
      }
    }

    // Sort by composite score (highest first)
    results.sort((a, b) => b.compositeScore - a.compositeScore);

    return results;
  }

  // ============================================
  // Signal Detection Methods
  // ============================================

  /**
   * FR-1.1: Detect usage approaching tier limits
   */
  private async detectUsageLimitApproaching(customerId: string): Promise<DetectedSignal | null> {
    if (!this.supabase) return null;

    // Get latest usage metrics
    const { data: metrics } = await this.supabase
      .from('usage_metrics')
      .select('api_calls, login_count, active_users')
      .eq('customer_id', customerId)
      .order('metric_date', { ascending: false })
      .limit(1)
      .single();

    if (!metrics) return null;

    // Get customer limits (from subscription data or defaults)
    const { data: customer } = await this.supabase
      .from('customers')
      .select('api_call_limit, tier')
      .eq('id', customerId)
      .single();

    const apiCallLimit = customer?.api_call_limit || this.getDefaultLimit(customer?.tier);
    const usageRatio = (metrics.api_calls || 0) / apiCallLimit;

    // Check if approaching limit (>80%)
    if (usageRatio >= 0.8) {
      const percentUsed = Math.round(usageRatio * 100);
      return {
        type: 'usage_limit_approaching',
        details: `Using ${percentUsed}% of API call limit`,
        detected_at: new Date(),
        strength: Math.min(0.95, 0.6 + (usageRatio - 0.8) * 2), // Scale 0.6-0.95
        source: 'usage_data',
        metadata: {
          currentUsage: metrics.api_calls,
          limit: apiCallLimit,
          percentUsed,
        },
      };
    }

    return null;
  }

  /**
   * FR-1.2: Detect seat overage
   */
  private async detectSeatOverage(customerId: string): Promise<DetectedSignal | null> {
    if (!this.supabase) return null;

    // Get active users count
    const { data: usage } = await this.supabase
      .from('usage_metrics')
      .select('active_users')
      .eq('customer_id', customerId)
      .order('metric_date', { ascending: false })
      .limit(1)
      .single();

    // Get contracted seats
    const { data: customer } = await this.supabase
      .from('customers')
      .select('contracted_seats')
      .eq('id', customerId)
      .single();

    const activeUsers = usage?.active_users || 0;
    const contractedSeats = customer?.contracted_seats || 10;

    if (activeUsers > contractedSeats) {
      const overage = activeUsers - contractedSeats;
      return {
        type: 'seat_overage',
        details: `${activeUsers} active users exceeds ${contractedSeats} contracted seats (+${overage})`,
        detected_at: new Date(),
        strength: 0.9, // High strength - clear expansion signal
        source: 'usage_data',
        metadata: {
          activeUsers,
          contractedSeats,
          overage,
        },
      };
    }

    return null;
  }

  /**
   * FR-1.3: Detect interest in higher-tier features
   */
  private async detectFeatureInterest(customerId: string): Promise<DetectedSignal[]> {
    if (!this.supabase) return [];

    const signals: DetectedSignal[] = [];

    // Check meeting analysis for feature interest
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const { data: meetings } = await this.supabase
      .from('meeting_analyses')
      .select('expansion_signals, analyzed_at')
      .eq('customer_id', customerId)
      .gte('analyzed_at', thirtyDaysAgo.toISOString());

    if (!meetings) return signals;

    for (const meeting of meetings) {
      const expansionSignals = meeting.expansion_signals || [];
      for (const signal of expansionSignals) {
        if (signal.type === 'new_use_case' || signal.potential === 'high') {
          signals.push({
            type: 'feature_interest',
            details: signal.description,
            detected_at: new Date(meeting.analyzed_at),
            strength: signal.potential === 'high' ? 0.8 : 0.65,
            source: 'meeting_transcript',
            quote: signal.quote,
            metadata: { meetingSignal: signal },
          });
        }
      }
    }

    return signals;
  }

  /**
   * FR-1.4: Detect expansion mentions in meetings/emails
   */
  private async detectExpansionMentions(customerId: string): Promise<DetectedSignal[]> {
    if (!this.supabase) return [];

    const signals: DetectedSignal[] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Check meeting analyses
    const { data: meetings } = await this.supabase
      .from('meeting_analyses')
      .select('expansion_signals, analyzed_at, key_topics')
      .eq('customer_id', customerId)
      .gte('analyzed_at', thirtyDaysAgo.toISOString());

    if (meetings) {
      for (const meeting of meetings) {
        const expansionSignals = meeting.expansion_signals || [];
        for (const signal of expansionSignals) {
          if (signal.type === 'upsell' || signal.type === 'additional_users') {
            signals.push({
              type: 'expansion_mention',
              details: signal.description,
              detected_at: new Date(meeting.analyzed_at),
              strength: 0.75,
              source: 'meeting_transcript',
              quote: signal.quote,
            });
          }
        }
      }
    }

    return signals;
  }

  /**
   * FR-1.5: Detect new team/department onboarding
   */
  private async detectNewTeamOnboarding(customerId: string): Promise<DetectedSignal | null> {
    if (!this.supabase) return null;

    // Get recent user activity by department
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const { data: events } = await this.supabase
      .from('usage_events')
      .select('user_id, metadata')
      .eq('customer_id', customerId)
      .gte('timestamp', thirtyDaysAgo.toISOString());

    if (!events || events.length === 0) return null;

    // Analyze departments
    const departmentUsers = new Map<string, Set<string>>();
    for (const event of events) {
      const dept = event.metadata?.department || 'Unknown';
      if (!departmentUsers.has(dept)) {
        departmentUsers.set(dept, new Set());
      }
      departmentUsers.get(dept)!.add(event.user_id);
    }

    // Get the customer's primary department
    const { data: customer } = await this.supabase
      .from('customers')
      .select('primary_department')
      .eq('id', customerId)
      .single();

    const primaryDept = customer?.primary_department || 'Sales';

    // Count users from non-primary departments
    let newDeptUsers = 0;
    const newDepartments: string[] = [];

    for (const [dept, users] of departmentUsers) {
      if (dept !== primaryDept && dept !== 'Unknown') {
        newDeptUsers += users.size;
        if (users.size >= 3) {
          newDepartments.push(dept);
        }
      }
    }

    // Signal if 5+ users from different departments
    if (newDeptUsers >= 5) {
      return {
        type: 'new_team_onboarding',
        details: `${newDeptUsers} users from ${newDepartments.length} new department(s): ${newDepartments.join(', ')}`,
        detected_at: new Date(),
        strength: 0.75,
        source: 'usage_data',
        metadata: {
          newDeptUsers,
          newDepartments,
          primaryDepartment: primaryDept,
        },
      };
    }

    return null;
  }

  /**
   * FR-1.6: Detect API usage growth
   */
  private async detectApiUsageGrowth(customerId: string): Promise<DetectedSignal | null> {
    if (!this.supabase) return null;

    // Get usage over last 60 days
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const { data: metrics } = await this.supabase
      .from('usage_metrics')
      .select('api_calls, metric_date')
      .eq('customer_id', customerId)
      .gte('metric_date', sixtyDaysAgo.toISOString())
      .order('metric_date', { ascending: true });

    if (!metrics || metrics.length < 14) return null; // Need at least 2 weeks

    // Compare last 2 weeks to previous 2 weeks
    const midpoint = Math.floor(metrics.length / 2);
    const firstHalf = metrics.slice(0, midpoint);
    const secondHalf = metrics.slice(midpoint);

    const firstAvg = firstHalf.reduce((sum, m) => sum + (m.api_calls || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, m) => sum + (m.api_calls || 0), 0) / secondHalf.length;

    if (firstAvg === 0) return null;

    const growthRate = (secondAvg - firstAvg) / firstAvg;

    // Signal if 50%+ growth
    if (growthRate >= 0.5) {
      return {
        type: 'api_usage_growth',
        details: `API usage grew ${Math.round(growthRate * 100)}% over last 30 days`,
        detected_at: new Date(),
        strength: Math.min(0.85, 0.5 + growthRate * 0.3),
        source: 'usage_data',
        metadata: {
          previousAverage: Math.round(firstAvg),
          currentAverage: Math.round(secondAvg),
          growthRate: Math.round(growthRate * 100),
        },
      };
    }

    return null;
  }

  /**
   * FR-1.7: Detect competitor displacement signals
   */
  private async detectCompetitorDisplacement(customerId: string): Promise<DetectedSignal[]> {
    if (!this.supabase) return [];

    const signals: DetectedSignal[] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Check meeting analyses for competitor mentions
    const { data: meetings } = await this.supabase
      .from('meeting_analyses')
      .select('competitor_mentions, analyzed_at')
      .eq('customer_id', customerId)
      .gte('analyzed_at', thirtyDaysAgo.toISOString());

    if (meetings) {
      for (const meeting of meetings) {
        const mentions = meeting.competitor_mentions || [];
        for (const mention of mentions) {
          // Look for migration/replacement context
          if (mention.context === 'migration' || mention.context === 'evaluation') {
            if (mention.sentiment !== 'positive') {
              signals.push({
                type: 'competitor_displacement',
                details: `Discussing replacing ${mention.competitor}`,
                detected_at: new Date(meeting.analyzed_at),
                strength: 0.8,
                source: 'meeting_transcript',
                quote: mention.quote,
                metadata: {
                  competitor: mention.competitor,
                  context: mention.context,
                  sentiment: mention.sentiment,
                },
              });
            }
          }
        }
      }
    }

    return signals;
  }

  // ============================================
  // Analysis Methods
  // ============================================

  /**
   * Calculate composite score from multiple signals
   */
  private calculateCompositeScore(signals: DetectedSignal[]): number {
    if (signals.length === 0) return 0;

    // Weight signals by type
    const weights: Record<ExpansionSignalType, number> = {
      usage_limit_approaching: 1.2,
      seat_overage: 1.3,
      feature_interest: 1.0,
      expansion_mention: 1.1,
      new_team_onboarding: 1.1,
      api_usage_growth: 0.9,
      competitor_displacement: 1.0,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const signal of signals) {
      const weight = weights[signal.type] || 1.0;
      weightedSum += signal.strength * weight;
      totalWeight += weight;
    }

    // Boost score slightly for multiple signals (compound effect)
    const baseScore = weightedSum / totalWeight;
    const signalCountBonus = Math.min(0.15, (signals.length - 1) * 0.05);

    return Math.min(1.0, baseScore + signalCountBonus);
  }

  /**
   * Analyze opportunity and generate recommendations
   */
  private analyzeExpansionOpportunity(
    signals: DetectedSignal[],
    customer: any
  ): {
    expansionType: ExpansionType;
    estimatedArr: number;
    suggestedProducts: string[];
    approach: string;
  } {
    const currentArr = customer.arr || 0;
    const signalTypes = signals.map(s => s.type);

    // Determine primary expansion type based on signals
    let expansionType: ExpansionType = 'upsell';
    let arrMultiplier = 0.3;
    const suggestedProducts: string[] = [];
    let approach = '';

    if (signalTypes.includes('seat_overage')) {
      expansionType = 'seat_expansion';
      arrMultiplier = 0.25;
      suggestedProducts.push('Additional Seats');
      approach = 'Review current usage and propose seat expansion';
    } else if (signalTypes.includes('new_team_onboarding')) {
      expansionType = 'land_and_expand';
      arrMultiplier = 0.5;
      suggestedProducts.push('Department License', 'Enterprise Plan');
      approach = 'Schedule discovery call with new team leads';
    } else if (signalTypes.includes('usage_limit_approaching')) {
      expansionType = 'upsell';
      arrMultiplier = 0.5;
      suggestedProducts.push('API Plus', 'Premium Tier');
      approach = 'Propose tier upgrade with enhanced limits';
    } else if (signalTypes.includes('feature_interest')) {
      expansionType = 'feature_upsell';
      arrMultiplier = 0.4;
      suggestedProducts.push('Advanced Analytics', 'Enterprise Features');
      approach = 'Schedule technical deep-dive on requested features';
    } else if (signalTypes.includes('competitor_displacement')) {
      expansionType = 'cross_sell';
      arrMultiplier = 0.4;
      suggestedProducts.push('Replacement Module', 'Integration Package');
      approach = 'Highlight competitive advantages and migration support';
    }

    // Calculate estimated ARR
    const estimatedArr = Math.round(currentArr * arrMultiplier);

    return {
      expansionType,
      estimatedArr,
      suggestedProducts,
      approach,
    };
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

  private getDefaultLimit(tier?: string): number {
    switch (tier?.toLowerCase()) {
      case 'enterprise':
        return 1000000;
      case 'professional':
        return 100000;
      case 'starter':
        return 10000;
      default:
        return 50000;
    }
  }
}

// Singleton instance
export const expansionDetector = new ExpansionSignalDetector();
