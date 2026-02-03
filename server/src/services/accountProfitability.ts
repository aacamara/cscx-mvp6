/**
 * CSCX.AI Account Profitability Service
 * PRD-078: Account Profitability View
 *
 * Business logic for calculating account-level profitability including
 * revenue, cost-to-serve, margins, benchmarks, and optimization opportunities.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// ============================================
// Types
// ============================================

interface Customer {
  id: string;
  name: string;
  arr: number;
  health_score: number;
  segment?: string;
  csm_id?: string;
  csm_name?: string;
  stage?: string;
  industry?: string;
  created_at: string;
  updated_at: string;
}

interface RevenueBreakdown {
  total: number;
  subscription: number;
  expansion: number;
  services: number;
  support: number;
}

interface CSMCost {
  hours: number;
  hourly_rate: number;
  total: number;
  activities: Array<{ activity: string; hours: number; percent: number; cost: number }>;
}

interface SupportCost {
  tickets: number;
  escalations: number;
  avg_resolution_hours: number;
  cost_per_ticket: number;
  total: number;
}

interface InfraCost {
  compute: number;
  storage: number;
  api_calls: number;
  total: number;
}

interface CostBreakdown {
  total: number;
  csm: CSMCost;
  support: SupportCost;
  infrastructure: InfraCost;
  onboarding: number;
  training: number;
  sales: number;
  other: number;
}

interface ProfitabilityTrendPoint {
  period: string;
  period_label: string;
  revenue: number;
  costs: number;
  margin: number;
  margin_percent: number;
}

interface SegmentBenchmark {
  segment: string;
  segment_label: string;
  avg_margin_percent: number;
  avg_cost_to_serve_percent: number;
  avg_csm_hours_per_quarter: number;
  avg_support_cost: number;
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
  };
}

interface OptimizationOpportunity {
  id: string;
  title: string;
  category: 'cost_reduction' | 'revenue_expansion' | 'efficiency';
  current_value: number;
  target_value: number;
  potential_impact: number;
  margin_impact_percent: number;
  action: string;
  effort: 'low' | 'medium' | 'high';
  priority: number;
}

type ProfitabilityTier = 'high' | 'medium' | 'low' | 'negative';
type ProfitabilityTrend = 'improving' | 'stable' | 'declining';

// ============================================
// Service Class
// ============================================

class AccountProfitabilityService {
  private supabase: SupabaseClient | null = null;

  // Mock customer data for demo/development
  private mockCustomers: Customer[] = [
    { id: '1', name: 'Acme Corp', arr: 250000, health_score: 85, segment: 'enterprise', csm_id: 'csm1', csm_name: 'Sarah Johnson', stage: 'active', industry: 'Technology', created_at: '2024-01-15', updated_at: '2026-01-01' },
    { id: '2', name: 'TechStart Inc', arr: 180000, health_score: 78, segment: 'enterprise', csm_id: 'csm1', csm_name: 'Sarah Johnson', stage: 'active', industry: 'SaaS', created_at: '2024-03-01', updated_at: '2026-01-01' },
    { id: '3', name: 'GlobalRetail', arr: 150000, health_score: 92, segment: 'enterprise', csm_id: 'csm2', csm_name: 'Mike Chen', stage: 'active', industry: 'Retail', created_at: '2024-02-15', updated_at: '2026-01-01' },
    { id: '4', name: 'DataFlow Systems', arr: 95000, health_score: 65, segment: 'mid-market', csm_id: 'csm2', csm_name: 'Mike Chen', stage: 'active', industry: 'Analytics', created_at: '2024-04-01', updated_at: '2026-01-01' },
    { id: '5', name: 'CloudNine Solutions', arr: 75000, health_score: 72, segment: 'mid-market', csm_id: 'csm3', csm_name: 'Lisa Wang', stage: 'active', industry: 'Cloud', created_at: '2024-05-15', updated_at: '2026-01-01' },
    { id: '6', name: 'MegaInc', arr: 65000, health_score: 88, segment: 'mid-market', csm_id: 'csm3', csm_name: 'Lisa Wang', stage: 'active', industry: 'Manufacturing', created_at: '2024-06-01', updated_at: '2026-01-01' },
    { id: '7', name: 'StartupXYZ', arr: 45000, health_score: 90, segment: 'mid-market', csm_id: 'csm1', csm_name: 'Sarah Johnson', stage: 'active', industry: 'Fintech', created_at: '2024-07-01', updated_at: '2026-01-01' },
    { id: '8', name: 'SmallBiz Pro', arr: 18000, health_score: 75, segment: 'smb', csm_id: 'csm4', csm_name: 'Tom Roberts', stage: 'active', industry: 'Services', created_at: '2024-08-01', updated_at: '2026-01-01' },
    { id: '9', name: 'LocalShop', arr: 12000, health_score: 82, segment: 'smb', csm_id: 'csm4', csm_name: 'Tom Roberts', stage: 'active', industry: 'Retail', created_at: '2024-09-01', updated_at: '2026-01-01' },
    { id: '10', name: 'QuickServe', arr: 9500, health_score: 68, segment: 'smb', csm_id: 'csm4', csm_name: 'Tom Roberts', stage: 'active', industry: 'Hospitality', created_at: '2024-10-01', updated_at: '2026-01-01' },
  ];

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  private getSegmentFromARR(arr: number): string {
    if (arr >= 100000) return 'enterprise';
    if (arr >= 25000) return 'mid-market';
    return 'smb';
  }

  private formatSegmentLabel(segment: string): string {
    const labels: Record<string, string> = {
      enterprise: 'Enterprise',
      'mid-market': 'Mid-Market',
      smb: 'SMB'
    };
    return labels[segment] || segment;
  }

  private getProfitabilityTier(marginPercent: number): ProfitabilityTier {
    if (marginPercent >= 70) return 'high';
    if (marginPercent >= 50) return 'medium';
    if (marginPercent >= 0) return 'low';
    return 'negative';
  }

  private getProfitabilityTrend(currentMargin: number, previousMargin: number): ProfitabilityTrend {
    const change = currentMargin - previousMargin;
    if (change > 2) return 'improving';
    if (change < -2) return 'declining';
    return 'stable';
  }

  private getPeriodDates(period: string): { start: Date; end: Date; label: string } {
    const now = new Date();
    let start: Date;
    let end: Date;
    let label: string;

    switch (period) {
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        break;
      case 'qtd':
      case 'quarter':
        const currentQ = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), currentQ * 3, 1);
        end = new Date(now.getFullYear(), (currentQ + 1) * 3, 0);
        label = `Q${currentQ + 1} ${now.getFullYear()}`;
        break;
      case 'ytd':
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        label = `${now.getFullYear()}`;
        break;
      case '12m':
        start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        end = now;
        label = 'Last 12 Months';
        break;
      case 'contract':
        // Use YTD as fallback for contract period
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        label = 'Contract Period';
        break;
      default:
        // Default to 12 months
        start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        end = now;
        label = 'Last 12 Months';
    }

    return { start, end, label };
  }

  // ============================================
  // Data Fetching
  // ============================================

  private async getCustomer(customerId: string): Promise<Customer | null> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single();

        if (error) throw error;

        if (data) {
          return {
            id: data.id,
            name: data.name,
            arr: data.arr || 0,
            health_score: data.health_score || 70,
            segment: data.segment || this.getSegmentFromARR(data.arr || 0),
            csm_id: data.csm_id,
            csm_name: data.csm_name,
            stage: data.stage || 'active',
            industry: data.industry,
            created_at: data.created_at,
            updated_at: data.updated_at
          };
        }
      } catch (error) {
        console.error('Error fetching customer from Supabase:', error);
      }
    }

    // Return mock customer
    return this.mockCustomers.find(c => c.id === customerId) || null;
  }

  private async getCustomers(filters?: { segment?: string }): Promise<Customer[]> {
    if (this.supabase) {
      try {
        let query = this.supabase.from('customers').select('*').neq('stage', 'churned');

        if (filters?.segment) {
          if (filters.segment === 'enterprise') {
            query = query.gte('arr', 100000);
          } else if (filters.segment === 'mid-market') {
            query = query.gte('arr', 25000).lt('arr', 100000);
          } else if (filters.segment === 'smb') {
            query = query.lt('arr', 25000);
          }
        }

        const { data, error } = await query.order('arr', { ascending: false });

        if (error) throw error;

        return (data || []).map(c => ({
          id: c.id,
          name: c.name,
          arr: c.arr || 0,
          health_score: c.health_score || 70,
          segment: c.segment || this.getSegmentFromARR(c.arr || 0),
          csm_id: c.csm_id,
          csm_name: c.csm_name,
          stage: c.stage || 'active',
          industry: c.industry,
          created_at: c.created_at,
          updated_at: c.updated_at
        }));
      } catch (error) {
        console.error('Error fetching customers from Supabase:', error);
      }
    }

    let customers = [...this.mockCustomers];
    if (filters?.segment) {
      customers = customers.filter(c => c.segment === filters.segment);
    }
    return customers;
  }

  // ============================================
  // Cost Calculation Methods
  // ============================================

  private calculateCSMCost(customer: Customer, period: { start: Date; end: Date }): CSMCost {
    // Base hours by segment (quarterly)
    const baseHours: Record<string, number> = {
      enterprise: 120,
      'mid-market': 80,
      smb: 40
    };

    const segment = customer.segment || this.getSegmentFromARR(customer.arr);
    const base = baseHours[segment] || 60;

    // Apply modifiers
    const healthModifier = customer.health_score < 50 ? 1.3 : (customer.health_score < 70 ? 1.1 : 1.0);
    const totalHours = Math.round(base * healthModifier);
    const hourlyRate = 60;
    const total = totalHours * hourlyRate;

    // Activity breakdown (representative distribution)
    const activities = [
      { activity: 'Meetings', hours: Math.round(totalHours * 0.16), percent: 16, cost: 0 },
      { activity: 'Email/Communication', hours: Math.round(totalHours * 0.20), percent: 20, cost: 0 },
      { activity: 'QBRs', hours: Math.round(totalHours * 0.08), percent: 8, cost: 0 },
      { activity: 'Support Coordination', hours: Math.round(totalHours * 0.12), percent: 12, cost: 0 },
      { activity: 'Strategy/Planning', hours: Math.round(totalHours * 0.16), percent: 16, cost: 0 },
      { activity: 'Admin/Reporting', hours: Math.round(totalHours * 0.08), percent: 8, cost: 0 },
      { activity: 'Training Prep', hours: Math.round(totalHours * 0.10), percent: 10, cost: 0 },
      { activity: 'Escalation Handling', hours: Math.round(totalHours * 0.10), percent: 10, cost: 0 }
    ];

    // Calculate cost for each activity
    activities.forEach(a => {
      a.cost = a.hours * hourlyRate;
    });

    return {
      hours: totalHours,
      hourly_rate: hourlyRate,
      total,
      activities
    };
  }

  private calculateSupportCost(customer: Customer): SupportCost {
    // Support costs scale with ARR and health score
    const segment = customer.segment || this.getSegmentFromARR(customer.arr);

    // Base ticket count by segment
    const baseTickets: Record<string, number> = {
      enterprise: 15,
      'mid-market': 10,
      smb: 5
    };

    const tickets = baseTickets[segment] || 8;
    const escalations = customer.health_score < 70 ? Math.ceil(tickets * 0.2) : Math.ceil(tickets * 0.1);
    const avgResolution = customer.health_score < 70 ? 24 : 12;
    const costPerTicket = segment === 'enterprise' ? 800 : (segment === 'mid-market' ? 650 : 500);

    return {
      tickets,
      escalations,
      avg_resolution_hours: avgResolution,
      cost_per_ticket: costPerTicket,
      total: tickets * costPerTicket
    };
  }

  private calculateInfrastructureCost(customer: Customer): InfraCost {
    // Infrastructure costs scale with ARR (proxy for usage)
    const baseRate = 0.03; // 3% of ARR
    const total = Math.round(customer.arr * baseRate);

    return {
      compute: Math.round(total * 0.5),
      storage: Math.round(total * 0.3),
      api_calls: Math.round(total * 0.2),
      total
    };
  }

  private calculateRevenue(customer: Customer): RevenueBreakdown {
    // Revenue breakdown (simplified - in production would come from billing system)
    const total = customer.arr;
    const subscription = Math.round(total * 0.85);
    const expansion = Math.round(total * 0.10);
    const services = Math.round(total * 0.03);
    const support = Math.round(total * 0.02);

    return {
      total,
      subscription,
      expansion,
      services,
      support
    };
  }

  // ============================================
  // Main Service Methods
  // ============================================

  async getAccountProfitability(
    customerId: string,
    query: { period?: string; include_projections?: boolean } = {}
  ): Promise<{
    profitability: any;
    trend: ProfitabilityTrendPoint[];
    benchmark: SegmentBenchmark;
    opportunities: OptimizationOpportunity[];
    csm_allocation: any;
    support_details: any;
    ltv_analysis: any;
    generated_at: string;
  }> {
    const customer = await this.getCustomer(customerId);

    if (!customer) {
      throw new Error('Customer not found');
    }

    const { start, end, label } = this.getPeriodDates(query.period || '12m');
    const segment = customer.segment || this.getSegmentFromARR(customer.arr);

    // Calculate revenue and costs
    const revenue = this.calculateRevenue(customer);
    const csmCost = this.calculateCSMCost(customer, { start, end });
    const supportCost = this.calculateSupportCost(customer);
    const infraCost = this.calculateInfrastructureCost(customer);

    // Additional costs
    const onboardingCost = customer.arr > 100000 ? 15000 : (customer.arr > 25000 ? 8000 : 3000);
    const trainingCost = Math.round(customer.arr * 0.015);
    const salesCost = Math.round(customer.arr * 0.02);
    const otherCost = Math.round(customer.arr * 0.01);

    const totalCosts = csmCost.total + supportCost.total + infraCost.total +
      onboardingCost + trainingCost + salesCost + otherCost;

    const costs: CostBreakdown = {
      total: totalCosts,
      csm: csmCost,
      support: supportCost,
      infrastructure: infraCost,
      onboarding: onboardingCost,
      training: trainingCost,
      sales: salesCost,
      other: otherCost
    };

    // Calculate profitability
    const grossMargin = revenue.total - costs.total;
    const grossMarginPercent = revenue.total > 0
      ? Math.round((grossMargin / revenue.total) * 1000) / 10
      : 0;

    // Contribution margin (excluding allocated overhead)
    const directCosts = csmCost.total + supportCost.total + infraCost.total;
    const contributionMargin = revenue.total - directCosts;
    const contributionMarginPercent = revenue.total > 0
      ? Math.round((contributionMargin / revenue.total) * 1000) / 10
      : 0;

    // Get benchmark data
    const benchmark = await this.getSegmentBenchmark(segment);

    // Calculate vs segment average
    const vsSegmentAvg = Math.round(grossMarginPercent - benchmark.avg_margin_percent);

    // Profitability tier
    const profitabilityTier = this.getProfitabilityTier(grossMarginPercent);

    // LTV calculation
    const customerAgeMonths = Math.max(1, Math.floor(
      (new Date().getTime() - new Date(customer.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
    ));
    const estimatedLifetimeYears = profitabilityTier === 'high' ? 6 :
      (profitabilityTier === 'medium' ? 4 : 3);
    const projectedLTV = Math.round(grossMargin * estimatedLifetimeYears);

    // Build profitability object
    const profitability = {
      customer_id: customer.id,
      customer_name: customer.name,
      period: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
        label
      },
      revenue,
      costs,
      gross_margin: grossMargin,
      gross_margin_percent: grossMarginPercent,
      contribution_margin: contributionMargin,
      contribution_margin_percent: contributionMarginPercent,
      vs_segment_avg: vsSegmentAvg,
      profitability_tier: profitabilityTier,
      ltv: projectedLTV,
      projected_margin_12m: grossMargin
    };

    // Generate trend data
    const trend = this.generateProfitabilityTrend(customer, 8);

    // Generate optimization opportunities
    const opportunities = this.generateOpportunities(customer, costs, revenue, benchmark);

    // CSM time allocation details
    const csm_allocation = {
      total_hours: csmCost.hours,
      breakdown: csmCost.activities,
      efficiency_notes: this.generateEfficiencyNotes(csmCost, supportCost, benchmark)
    };

    // Support cost details
    const support_details = {
      tickets_submitted: supportCost.tickets,
      tickets_benchmark: Math.round(benchmark.avg_support_cost / 650),
      escalations: supportCost.escalations,
      escalations_benchmark: 1,
      avg_resolution_time: supportCost.avg_resolution_hours,
      avg_resolution_benchmark: 12,
      cost_per_ticket: supportCost.cost_per_ticket,
      cost_per_ticket_benchmark: 650,
      total_cost: supportCost.total,
      analysis: this.generateSupportAnalysis(supportCost),
      recommendations: this.generateSupportRecommendations(supportCost)
    };

    // LTV analysis
    const ltv_analysis = {
      customer_age_months: customerAgeMonths,
      total_revenue_ltd: Math.round(revenue.total * (customerAgeMonths / 12)),
      total_costs_ltd: Math.round(costs.total * (customerAgeMonths / 12)),
      net_margin_ltd: Math.round(grossMargin * (customerAgeMonths / 12)),
      projected_annual_margin: grossMargin,
      estimated_lifetime_years: estimatedLifetimeYears,
      projected_ltv: projectedLTV
    };

    return {
      profitability,
      trend,
      benchmark,
      opportunities,
      csm_allocation,
      support_details,
      ltv_analysis,
      generated_at: new Date().toISOString()
    };
  }

  async getPortfolioProfitability(query: {
    period?: string;
    segment?: string;
    min_arr?: number;
    max_arr?: number;
    tier?: string;
    sort_by?: string;
    sort_order?: string;
  } = {}): Promise<{
    summary: any;
    customers: any[];
    generated_at: string;
  }> {
    let customers = await this.getCustomers({ segment: query.segment });

    // Apply filters
    if (query.min_arr) {
      customers = customers.filter(c => c.arr >= query.min_arr!);
    }
    if (query.max_arr) {
      customers = customers.filter(c => c.arr <= query.max_arr!);
    }

    // Calculate profitability for each customer
    const customerProfitability = await Promise.all(
      customers.map(async (customer) => {
        const segment = customer.segment || this.getSegmentFromARR(customer.arr);
        const revenue = this.calculateRevenue(customer);
        const csmCost = this.calculateCSMCost(customer, { start: new Date(), end: new Date() });
        const supportCost = this.calculateSupportCost(customer);
        const infraCost = this.calculateInfrastructureCost(customer);

        const totalCosts = csmCost.total + supportCost.total + infraCost.total +
          (customer.arr > 100000 ? 15000 : (customer.arr > 25000 ? 8000 : 3000)) +
          Math.round(customer.arr * 0.045);

        const margin = revenue.total - totalCosts;
        const marginPercent = revenue.total > 0
          ? Math.round((margin / revenue.total) * 1000) / 10
          : 0;

        const benchmark = await this.getSegmentBenchmark(segment);

        return {
          customer_id: customer.id,
          customer_name: customer.name,
          segment,
          arr: customer.arr,
          total_costs: totalCosts,
          margin,
          margin_percent: marginPercent,
          profitability_tier: this.getProfitabilityTier(marginPercent),
          trend: this.getProfitabilityTrend(marginPercent, marginPercent - 2 + Math.random() * 4),
          vs_segment_avg: Math.round(marginPercent - benchmark.avg_margin_percent)
        };
      })
    );

    // Filter by tier if specified
    let filteredCustomers = customerProfitability;
    if (query.tier) {
      filteredCustomers = customerProfitability.filter(c => c.profitability_tier === query.tier);
    }

    // Sort
    const sortBy = query.sort_by || 'margin';
    const sortOrder = query.sort_order || 'desc';
    filteredCustomers.sort((a, b) => {
      const aVal = a[sortBy as keyof typeof a] as number || 0;
      const bVal = b[sortBy as keyof typeof b] as number || 0;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Calculate summary
    const totalARR = filteredCustomers.reduce((sum, c) => sum + c.arr, 0);
    const totalCosts = filteredCustomers.reduce((sum, c) => sum + c.total_costs, 0);
    const avgMarginPercent = filteredCustomers.length > 0
      ? Math.round(filteredCustomers.reduce((sum, c) => sum + c.margin_percent, 0) / filteredCustomers.length * 10) / 10
      : 0;

    // Distribution
    const distribution = {
      high: { count: 0, arr: 0, percent: 0 },
      medium: { count: 0, arr: 0, percent: 0 },
      low: { count: 0, arr: 0, percent: 0 },
      negative: { count: 0, arr: 0, percent: 0 }
    };

    filteredCustomers.forEach(c => {
      const tier = c.profitability_tier as keyof typeof distribution;
      distribution[tier].count++;
      distribution[tier].arr += c.arr;
    });

    Object.keys(distribution).forEach(key => {
      const tier = key as keyof typeof distribution;
      distribution[tier].percent = totalARR > 0
        ? Math.round((distribution[tier].arr / totalARR) * 100)
        : 0;
    });

    // Top and bottom profitable
    const sorted = [...filteredCustomers].sort((a, b) => b.margin_percent - a.margin_percent);
    const topProfitable = sorted.slice(0, 5).map(c => ({
      customer_id: c.customer_id,
      customer_name: c.customer_name,
      arr: c.arr,
      margin_percent: c.margin_percent
    }));
    const bottomProfitable = sorted.slice(-5).reverse().map(c => ({
      customer_id: c.customer_id,
      customer_name: c.customer_name,
      arr: c.arr,
      margin_percent: c.margin_percent
    }));

    const summary = {
      total_customers: filteredCustomers.length,
      total_arr: totalARR,
      total_costs: totalCosts,
      avg_margin_percent: avgMarginPercent,
      distribution,
      top_profitable: topProfitable,
      bottom_profitable: bottomProfitable
    };

    return {
      summary,
      customers: filteredCustomers,
      generated_at: new Date().toISOString()
    };
  }

  private async getSegmentBenchmark(segment: string): Promise<SegmentBenchmark> {
    // Benchmark data by segment
    const benchmarks: Record<string, SegmentBenchmark> = {
      enterprise: {
        segment: 'enterprise',
        segment_label: 'Enterprise',
        avg_margin_percent: 65,
        avg_cost_to_serve_percent: 35,
        avg_csm_hours_per_quarter: 100,
        avg_support_cost: 12000,
        percentiles: { p25: 58, p50: 65, p75: 74 }
      },
      'mid-market': {
        segment: 'mid-market',
        segment_label: 'Mid-Market',
        avg_margin_percent: 62,
        avg_cost_to_serve_percent: 38,
        avg_csm_hours_per_quarter: 70,
        avg_support_cost: 6500,
        percentiles: { p25: 55, p50: 62, p75: 70 }
      },
      smb: {
        segment: 'smb',
        segment_label: 'SMB',
        avg_margin_percent: 55,
        avg_cost_to_serve_percent: 45,
        avg_csm_hours_per_quarter: 35,
        avg_support_cost: 2500,
        percentiles: { p25: 48, p50: 55, p75: 64 }
      }
    };

    return benchmarks[segment] || benchmarks['mid-market'];
  }

  private generateProfitabilityTrend(customer: Customer, quarters: number): ProfitabilityTrendPoint[] {
    const trend: ProfitabilityTrendPoint[] = [];
    const now = new Date();
    const baseRevenue = customer.arr / 4; // Quarterly

    for (let i = quarters - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - (i * 3), 1);
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      const year = date.getFullYear();

      // Simulate gradual improvement over time
      const improvementFactor = 1 + (quarters - i - 1) * 0.02;
      const variance = 0.95 + Math.random() * 0.1;

      const revenue = Math.round(baseRevenue * improvementFactor * variance);
      const costPercent = 0.35 - (quarters - i - 1) * 0.01; // Improving efficiency
      const costs = Math.round(revenue * costPercent * variance);
      const margin = revenue - costs;
      const marginPercent = Math.round((margin / revenue) * 1000) / 10;

      trend.push({
        period: `${year}-Q${quarter}`,
        period_label: `Q${quarter} ${year}`,
        revenue,
        costs,
        margin,
        margin_percent: marginPercent
      });
    }

    return trend;
  }

  private generateOpportunities(
    customer: Customer,
    costs: CostBreakdown,
    revenue: RevenueBreakdown,
    benchmark: SegmentBenchmark
  ): OptimizationOpportunity[] {
    const opportunities: OptimizationOpportunity[] = [];
    let priority = 1;

    // Support cost reduction opportunity
    const supportBenchmark = benchmark.avg_support_cost;
    if (costs.support.total > supportBenchmark * 1.2) {
      const targetReduction = Math.round(costs.support.total - supportBenchmark);
      const marginImpact = revenue.total > 0
        ? Math.round((targetReduction / revenue.total) * 1000) / 10
        : 0;

      opportunities.push({
        id: `opp-${priority}`,
        title: 'Reduce Support Costs',
        category: 'cost_reduction',
        current_value: costs.support.total,
        target_value: supportBenchmark,
        potential_impact: targetReduction,
        margin_impact_percent: marginImpact,
        action: 'Create self-service documentation for common issues',
        effort: 'medium',
        priority: priority++
      });
    }

    // Expansion revenue opportunity
    const expansionPotential = Math.round(customer.arr * 0.25);
    if (customer.health_score > 70) {
      opportunities.push({
        id: `opp-${priority}`,
        title: 'Increase Expansion Revenue',
        category: 'revenue_expansion',
        current_value: revenue.expansion,
        target_value: revenue.expansion + expansionPotential,
        potential_impact: expansionPotential,
        margin_impact_percent: Math.round((expansionPotential / revenue.total) * 100),
        action: 'Pursue cross-sell and upsell opportunities based on usage patterns',
        effort: 'medium',
        priority: priority++
      });
    }

    // CSM efficiency opportunity
    const csmBenchmark = benchmark.avg_csm_hours_per_quarter;
    if (costs.csm.hours > csmBenchmark * 1.15) {
      const hoursReduction = costs.csm.hours - csmBenchmark;
      const costReduction = hoursReduction * costs.csm.hourly_rate;

      opportunities.push({
        id: `opp-${priority}`,
        title: 'Optimize CSM Time',
        category: 'efficiency',
        current_value: costs.csm.hours,
        target_value: csmBenchmark,
        potential_impact: costReduction,
        margin_impact_percent: revenue.total > 0
          ? Math.round((costReduction / revenue.total) * 1000) / 10
          : 0,
        action: 'Automate monthly reporting and implement self-service portals',
        effort: 'low',
        priority: priority++
      });
    }

    return opportunities;
  }

  private generateEfficiencyNotes(
    csmCost: CSMCost,
    supportCost: SupportCost,
    benchmark: SegmentBenchmark
  ): string[] {
    const notes: string[] = [];

    // Check support coordination time
    const supportCoord = csmCost.activities.find(a => a.activity === 'Support Coordination');
    if (supportCoord && supportCoord.percent > 15) {
      notes.push(`${supportCoord.hours} hours on support coordination - higher than average. Consider: More proactive engagement to reduce reactive support.`);
    }

    // Check admin time
    const admin = csmCost.activities.find(a => a.activity === 'Admin/Reporting');
    if (admin && admin.percent > 10) {
      notes.push(`Admin time is ${admin.percent}% of total. Consider automating reporting tasks.`);
    }

    // Check overall hours vs benchmark
    if (csmCost.hours > benchmark.avg_csm_hours_per_quarter * 1.2) {
      notes.push(`Total CSM hours (${csmCost.hours}) exceeds segment benchmark (${benchmark.avg_csm_hours_per_quarter}). Review engagement model.`);
    }

    return notes;
  }

  private generateSupportAnalysis(supportCost: SupportCost): string {
    if (supportCost.escalations > 2) {
      return `Higher ticket volume driving costs. Root cause: Complex integrations or training gaps. Escalation rate above average.`;
    } else if (supportCost.tickets > 12) {
      return `Elevated ticket count. Consider proactive outreach and enhanced documentation.`;
    }
    return `Support metrics within normal range.`;
  }

  private generateSupportRecommendations(supportCost: SupportCost): string[] {
    const recommendations: string[] = [];

    if (supportCost.tickets > 10) {
      recommendations.push('Create self-service documentation for top 5 ticket categories');
    }
    if (supportCost.escalations > 1) {
      recommendations.push('Implement proactive health checks to prevent escalations');
    }
    if (supportCost.avg_resolution_hours > 18) {
      recommendations.push('Review ticket routing and first-response SLAs');
    }

    return recommendations;
  }
}

// Export singleton instance
export const accountProfitabilityService = new AccountProfitabilityService();
