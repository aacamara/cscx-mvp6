/**
 * Expansion Opportunity Service
 * PRD-103: Expansion Signal Detected
 *
 * Manages expansion opportunities in the database,
 * including creation, qualification, and tracking.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import {
  ExpansionOpportunity,
  ExpansionSignalDetectionResult,
  ExpansionStage,
  ExpansionTimeline,
  ExpansionAlertData,
} from './types.js';

// ============================================
// Expansion Opportunity Service
// ============================================

export class ExpansionOpportunityService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // FR-2.1: Create Expansion Opportunity
  // ============================================

  /**
   * Create an expansion opportunity from detected signals
   */
  async createOpportunity(
    detection: ExpansionSignalDetectionResult,
    qualifiedBy?: string
  ): Promise<ExpansionOpportunity | null> {
    if (!this.supabase) {
      console.warn('[ExpansionService] Supabase not configured');
      return null;
    }

    // Check for existing active opportunity for this customer
    const { data: existing } = await this.supabase
      .from('expansion_opportunities')
      .select('id')
      .eq('customer_id', detection.customerId)
      .in('stage', ['detected', 'qualified', 'proposed', 'negotiating'])
      .single();

    if (existing) {
      // Update existing opportunity with new signals
      return this.updateOpportunitySignals(existing.id, detection);
    }

    // FR-2.2: Score opportunity by signal strength
    const probability = Math.round(detection.compositeScore * 100);

    // Determine timeline based on signals
    const timeline = this.determineTimeline(detection);

    const opportunity: Partial<ExpansionOpportunity> = {
      id: uuidv4(),
      customerId: detection.customerId,
      customerName: detection.customerName,
      opportunityType: detection.expansionType,
      productLine: detection.suggestedProducts.join(', '),
      estimatedValue: detection.estimatedExpansionArr,
      probability,
      stage: 'detected',
      timeline,
      blockers: [],

      // FR-2.3: Include signal details and evidence
      signalData: {
        signals: detection.signals,
        compositeScore: detection.compositeScore,
        suggestedProducts: detection.suggestedProducts,
        recommendedApproach: detection.recommendedApproach,
      },

      detectedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { data, error } = await this.supabase
      .from('expansion_opportunities')
      .insert({
        id: opportunity.id,
        customer_id: opportunity.customerId,
        opportunity_type: opportunity.opportunityType,
        product_line: opportunity.productLine,
        estimated_value: opportunity.estimatedValue,
        probability: opportunity.probability,
        stage: opportunity.stage,
        timeline: opportunity.timeline,
        blockers: opportunity.blockers,
        signal_data: opportunity.signalData,
        detected_at: opportunity.detectedAt?.toISOString(),
        created_at: opportunity.createdAt?.toISOString(),
        updated_at: opportunity.updatedAt?.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[ExpansionService] Failed to create opportunity:', error);
      return null;
    }

    return this.mapDbToOpportunity(data, detection.customerName);
  }

  /**
   * Update existing opportunity with new signals
   */
  private async updateOpportunitySignals(
    opportunityId: string,
    detection: ExpansionSignalDetectionResult
  ): Promise<ExpansionOpportunity | null> {
    if (!this.supabase) return null;

    const { data: existing } = await this.supabase
      .from('expansion_opportunities')
      .select('signal_data')
      .eq('id', opportunityId)
      .single();

    if (!existing) return null;

    // Merge signals (avoid duplicates)
    const existingSignals = existing.signal_data?.signals || [];
    const newSignalTypes = detection.signals.map(s => s.type);
    const mergedSignals = [
      ...existingSignals.filter((s: any) => !newSignalTypes.includes(s.type)),
      ...detection.signals,
    ];

    // Recalculate composite score
    const newCompositeScore = Math.max(
      detection.compositeScore,
      existing.signal_data?.compositeScore || 0
    );

    const { data, error } = await this.supabase
      .from('expansion_opportunities')
      .update({
        estimated_value: Math.max(detection.estimatedExpansionArr, existing.estimated_value || 0),
        probability: Math.round(newCompositeScore * 100),
        signal_data: {
          signals: mergedSignals,
          compositeScore: newCompositeScore,
          suggestedProducts: detection.suggestedProducts,
          recommendedApproach: detection.recommendedApproach,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', opportunityId)
      .select()
      .single();

    if (error) {
      console.error('[ExpansionService] Failed to update opportunity:', error);
      return null;
    }

    return this.mapDbToOpportunity(data, detection.customerName);
  }

  // ============================================
  // Opportunity Management
  // ============================================

  /**
   * Get opportunity by ID
   */
  async getOpportunity(opportunityId: string): Promise<ExpansionOpportunity | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('expansion_opportunities')
      .select(`
        *,
        customers (name)
      `)
      .eq('id', opportunityId)
      .single();

    if (error || !data) return null;

    return this.mapDbToOpportunity(data, data.customers?.name);
  }

  /**
   * Get all opportunities for a customer
   */
  async getCustomerOpportunities(customerId: string): Promise<ExpansionOpportunity[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('expansion_opportunities')
      .select(`
        *,
        customers (name)
      `)
      .eq('customer_id', customerId)
      .order('detected_at', { ascending: false });

    if (error || !data) return [];

    return data.map(row => this.mapDbToOpportunity(row, row.customers?.name));
  }

  /**
   * List all active opportunities
   */
  async listActiveOpportunities(filters?: {
    minCompositeScore?: number;
    stage?: ExpansionStage[];
    timeline?: ExpansionTimeline;
  }): Promise<ExpansionOpportunity[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('expansion_opportunities')
      .select(`
        *,
        customers (name)
      `)
      .in('stage', ['detected', 'qualified', 'proposed', 'negotiating'])
      .order('probability', { ascending: false });

    if (filters?.stage) {
      query = query.in('stage', filters.stage);
    }

    if (filters?.timeline) {
      query = query.eq('timeline', filters.timeline);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    let opportunities = data.map(row => this.mapDbToOpportunity(row, row.customers?.name));

    if (filters?.minCompositeScore) {
      opportunities = opportunities.filter(
        o => o.signalData.compositeScore >= filters.minCompositeScore!
      );
    }

    return opportunities;
  }

  /**
   * Update opportunity stage
   */
  async updateStage(
    opportunityId: string,
    stage: ExpansionStage,
    notes?: string
  ): Promise<ExpansionOpportunity | null> {
    if (!this.supabase) return null;

    const updates: any = {
      stage,
      updated_at: new Date().toISOString(),
    };

    if (stage === 'qualified') {
      updates.qualified_at = new Date().toISOString();
    } else if (stage === 'closed_won' || stage === 'closed_lost') {
      updates.closed_at = new Date().toISOString();
    }

    if (notes) {
      updates.next_steps = notes;
    }

    const { data, error } = await this.supabase
      .from('expansion_opportunities')
      .update(updates)
      .eq('id', opportunityId)
      .select(`
        *,
        customers (name)
      `)
      .single();

    if (error || !data) return null;

    return this.mapDbToOpportunity(data, data.customers?.name);
  }

  // ============================================
  // FR-3.1: Sales Notification
  // ============================================

  /**
   * Assign sales rep and mark as notified
   */
  async assignSalesRep(
    opportunityId: string,
    salesRepId: string
  ): Promise<ExpansionOpportunity | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('expansion_opportunities')
      .update({
        sales_rep_id: salesRepId,
        sales_notified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', opportunityId)
      .select(`
        *,
        customers (name)
      `)
      .single();

    if (error || !data) return null;

    return this.mapDbToOpportunity(data, data.customers?.name);
  }

  // ============================================
  // FR-3.2: CRM Integration
  // ============================================

  /**
   * Link to CRM opportunity
   */
  async linkCrmOpportunity(
    opportunityId: string,
    crmOpportunityId: string
  ): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('expansion_opportunities')
      .update({
        crm_opportunity_id: crmOpportunityId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', opportunityId);
  }

  // ============================================
  // Alert Data Generation
  // ============================================

  /**
   * Generate alert data for Slack notification
   */
  generateAlertData(
    detection: ExpansionSignalDetectionResult,
    opportunityId: string
  ): ExpansionAlertData {
    // Map signal types to display format
    const signalEmojis: Record<string, string> = {
      usage_limit_approaching: ':zap:',
      seat_overage: ':busts_in_silhouette:',
      feature_interest: ':bulb:',
      expansion_mention: ':speech_balloon:',
      new_team_onboarding: ':office:',
      api_usage_growth: ':chart_with_upwards_trend:',
      competitor_displacement: ':crossed_swords:',
    };

    const signalTitles: Record<string, string> = {
      usage_limit_approaching: 'Usage Limit Approaching',
      seat_overage: 'Seat Overage',
      feature_interest: 'Feature Interest',
      expansion_mention: 'Expansion Mention',
      new_team_onboarding: 'New Team Onboarding',
      api_usage_growth: 'API Usage Growth',
      competitor_displacement: 'Competitor Displacement',
    };

    return {
      customerId: detection.customerId,
      customerName: detection.customerName,
      signalStrength: detection.compositeScore >= 0.8 ? 'HIGH' : detection.compositeScore >= 0.6 ? 'MEDIUM' : 'LOW',
      compositeScore: Math.round(detection.compositeScore * 100) / 100,
      estimatedExpansionArr: detection.estimatedExpansionArr,
      signals: detection.signals.map(s => ({
        type: s.type,
        emoji: signalEmojis[s.type] || ':bell:',
        title: signalTitles[s.type] || s.type,
        description: s.details,
      })),
      currentState: {
        arr: detection.currentState.arr,
        plan: detection.currentState.plan,
        contractEnd: detection.currentState.contractEndDate
          ? detection.currentState.contractEndDate.toISOString().split('T')[0]
          : 'N/A',
      },
      recommendedExpansion: {
        products: detection.suggestedProducts,
        estimatedValue: detection.estimatedExpansionArr,
        approach: detection.recommendedApproach,
      },
      opportunityId,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private determineTimeline(detection: ExpansionSignalDetectionResult): ExpansionTimeline {
    // If seat overage or usage at limit, immediate
    const signalTypes = detection.signals.map(s => s.type);
    if (signalTypes.includes('seat_overage') || signalTypes.includes('usage_limit_approaching')) {
      return 'immediate';
    }

    // High composite score suggests urgency
    if (detection.compositeScore >= 0.8) {
      return 'this_quarter';
    }

    // Feature interest or new team might take longer
    if (signalTypes.includes('new_team_onboarding')) {
      return 'next_quarter';
    }

    return 'this_quarter';
  }

  private mapDbToOpportunity(row: any, customerName?: string): ExpansionOpportunity {
    return {
      id: row.id,
      customerId: row.customer_id,
      customerName: customerName || row.customer_name || 'Unknown',
      opportunityType: row.opportunity_type,
      productLine: row.product_line,
      estimatedValue: row.estimated_value,
      probability: row.probability,
      stage: row.stage,
      championId: row.champion_id,
      useCase: row.use_case,
      competitiveThreat: row.competitive_threat,
      timeline: row.timeline,
      blockers: row.blockers || [],
      nextSteps: row.next_steps,
      signalData: row.signal_data || {
        signals: [],
        compositeScore: 0,
        suggestedProducts: [],
        recommendedApproach: '',
      },
      salesRepId: row.sales_rep_id,
      salesNotifiedAt: row.sales_notified_at ? new Date(row.sales_notified_at) : undefined,
      crmOpportunityId: row.crm_opportunity_id,
      detectedAt: new Date(row.detected_at),
      qualifiedAt: row.qualified_at ? new Date(row.qualified_at) : undefined,
      closedAt: row.closed_at ? new Date(row.closed_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// Singleton instance
export const expansionOpportunityService = new ExpansionOpportunityService();
