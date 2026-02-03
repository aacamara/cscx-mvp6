/**
 * CSCX.AI Revenue Analytics Service
 * PRD-158: Revenue Analytics Report
 *
 * Business logic for calculating revenue metrics, tracking movements,
 * analyzing retention, and assessing concentration risk.
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
  created_at: string;
  updated_at: string;
}

interface RevenueMovement {
  id: string;
  customer_id: string;
  customer_name: string;
  movement_date: string;
  type: 'new' | 'expansion' | 'contraction' | 'churn' | 'reactivation';
  previous_arr: number;
  new_arr: number;
  change_amount: number;
  reason?: string;
  source?: string;
  created_at: string;
}

interface RevenueTrend {
  period: string;
  period_label: string;
  arr: number;
  mrr: number;
  customer_count: number;
  nrr: number;
  grr: number;
}

interface SegmentBreakdown {
  segment: string;
  segment_label: string;
  arr: number;
  arr_percent: number;
  customer_count: number;
  nrr: number;
  grr: number;
  change_amount: number;
  change_percent: number;
  avg_arr: number;
}

interface CSMBreakdown {
  csm_id: string;
  csm_name: string;
  arr: number;
  arr_percent: number;
  customer_count: number;
  nrr: number;
  grr: number;
  expansion: number;
  contraction: number;
  churn: number;
  net_change: number;
}

interface ConcentrationAnalysis {
  total_arr: number;
  top_10: {
    top_n: number;
    arr: number;
    percent_of_total: number;
    customers: Array<{ id: string; name: string; arr: number; percent: number }>;
  };
  top_25: {
    top_n: number;
    arr: number;
    percent_of_total: number;
    customers: Array<{ id: string; name: string; arr: number; percent: number }>;
  };
  largest_customer: {
    id: string;
    name: string;
    arr: number;
    percent: number;
  };
  concentration_risk: 'low' | 'medium' | 'high';
  risk_threshold: number;
  risk_message: string;
}

// ============================================
// Service Class
// ============================================

class RevenueAnalyticsService {
  private supabase: SupabaseClient | null = null;

  // Mock data for demo/development
  private mockCustomers: Customer[] = [
    { id: '1', name: 'Acme Corp', arr: 250000, health_score: 85, segment: 'enterprise', csm_id: 'csm1', csm_name: 'Sarah Johnson', stage: 'active', created_at: '2024-01-15', updated_at: '2026-01-01' },
    { id: '2', name: 'TechStart Inc', arr: 180000, health_score: 78, segment: 'enterprise', csm_id: 'csm1', csm_name: 'Sarah Johnson', stage: 'active', created_at: '2024-03-01', updated_at: '2026-01-01' },
    { id: '3', name: 'GlobalRetail', arr: 150000, health_score: 92, segment: 'enterprise', csm_id: 'csm2', csm_name: 'Mike Chen', stage: 'active', created_at: '2024-02-15', updated_at: '2026-01-01' },
    { id: '4', name: 'DataFlow Systems', arr: 95000, health_score: 65, segment: 'mid-market', csm_id: 'csm2', csm_name: 'Mike Chen', stage: 'active', created_at: '2024-04-01', updated_at: '2026-01-01' },
    { id: '5', name: 'CloudNine Solutions', arr: 75000, health_score: 72, segment: 'mid-market', csm_id: 'csm3', csm_name: 'Lisa Wang', stage: 'active', created_at: '2024-05-15', updated_at: '2026-01-01' },
    { id: '6', name: 'MegaInc', arr: 65000, health_score: 88, segment: 'mid-market', csm_id: 'csm3', csm_name: 'Lisa Wang', stage: 'active', created_at: '2024-06-01', updated_at: '2026-01-01' },
    { id: '7', name: 'StartupXYZ', arr: 45000, health_score: 90, segment: 'mid-market', csm_id: 'csm1', csm_name: 'Sarah Johnson', stage: 'active', created_at: '2024-07-01', updated_at: '2026-01-01' },
    { id: '8', name: 'SmallBiz Pro', arr: 18000, health_score: 75, segment: 'smb', csm_id: 'csm4', csm_name: 'Tom Roberts', stage: 'active', created_at: '2024-08-01', updated_at: '2026-01-01' },
    { id: '9', name: 'LocalShop', arr: 12000, health_score: 82, segment: 'smb', csm_id: 'csm4', csm_name: 'Tom Roberts', stage: 'active', created_at: '2024-09-01', updated_at: '2026-01-01' },
    { id: '10', name: 'QuickServe', arr: 9500, health_score: 68, segment: 'smb', csm_id: 'csm4', csm_name: 'Tom Roberts', stage: 'active', created_at: '2024-10-01', updated_at: '2026-01-01' },
    { id: '11', name: 'Innovate Labs', arr: 120000, health_score: 95, segment: 'enterprise', csm_id: 'csm2', csm_name: 'Mike Chen', stage: 'active', created_at: '2024-11-01', updated_at: '2026-01-01' },
    { id: '12', name: 'Enterprise Plus', arr: 220000, health_score: 88, segment: 'enterprise', csm_id: 'csm1', csm_name: 'Sarah Johnson', stage: 'active', created_at: '2025-01-01', updated_at: '2026-01-01' },
  ];

  private mockMovements: RevenueMovement[] = [
    { id: 'm1', customer_id: '1', customer_name: 'Acme Corp', movement_date: '2026-01-15', type: 'expansion', previous_arr: 200000, new_arr: 250000, change_amount: 50000, reason: 'Premium upgrade', source: 'upsell', created_at: '2026-01-15' },
    { id: 'm2', customer_id: '2', customer_name: 'TechStart Inc', movement_date: '2026-01-10', type: 'expansion', previous_arr: 150000, new_arr: 180000, change_amount: 30000, reason: '50 additional seats', source: 'upsell', created_at: '2026-01-10' },
    { id: 'm3', customer_id: '4', customer_name: 'DataFlow Systems', movement_date: '2026-01-05', type: 'contraction', previous_arr: 110000, new_arr: 95000, change_amount: -15000, reason: 'Reduced seats', source: 'downsell', created_at: '2026-01-05' },
    { id: 'm4', customer_id: '12', customer_name: 'Enterprise Plus', movement_date: '2025-12-01', type: 'new', previous_arr: 0, new_arr: 220000, change_amount: 220000, reason: 'New enterprise deal', source: 'new_business', created_at: '2025-12-01' },
    { id: 'm5', customer_id: '3', customer_name: 'GlobalRetail', movement_date: '2025-11-15', type: 'expansion', previous_arr: 120000, new_arr: 150000, change_amount: 30000, reason: 'Analytics module', source: 'upsell', created_at: '2025-11-15' },
    { id: 'm6', customer_id: '5', customer_name: 'CloudNine Solutions', movement_date: '2025-11-01', type: 'contraction', previous_arr: 85000, new_arr: 75000, change_amount: -10000, reason: 'Downgraded tier', source: 'downsell', created_at: '2025-11-01' },
    { id: 'm7', customer_id: '11', customer_name: 'Innovate Labs', movement_date: '2025-10-15', type: 'new', previous_arr: 0, new_arr: 120000, change_amount: 120000, reason: 'New mid-market deal', source: 'new_business', created_at: '2025-10-15' },
  ];

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Calculation Helpers
  // ============================================

  private calculateGRR(startingARR: number, contraction: number, churn: number): number {
    if (startingARR === 0) return 100;
    return Math.round(((startingARR - contraction - churn) / startingARR) * 100);
  }

  private calculateNRR(
    startingARR: number,
    expansion: number,
    contraction: number,
    churn: number
  ): number {
    if (startingARR === 0) return 100;
    return Math.round(
      ((startingARR + expansion - contraction - churn) / startingARR) * 100
    );
  }

  private calculateLogoRetention(startingCustomers: number, churned: number): number {
    if (startingCustomers === 0) return 100;
    return Math.round(((startingCustomers - churned) / startingCustomers) * 100);
  }

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

  private getPeriodDates(period: string): { start: Date; end: Date; label: string } {
    const now = new Date();
    let start: Date;
    let end: Date;
    let label: string;

    switch (period) {
      case 'current_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        break;
      case 'current_quarter':
        const currentQ = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), currentQ * 3, 1);
        end = new Date(now.getFullYear(), (currentQ + 1) * 3, 0);
        label = `Q${currentQ + 1} ${now.getFullYear()}`;
        break;
      case 'last_quarter':
        const lastQ = Math.floor(now.getMonth() / 3) - 1;
        const lastQYear = lastQ < 0 ? now.getFullYear() - 1 : now.getFullYear();
        const adjustedQ = lastQ < 0 ? 3 : lastQ;
        start = new Date(lastQYear, adjustedQ * 3, 1);
        end = new Date(lastQYear, (adjustedQ + 1) * 3, 0);
        label = `Q${adjustedQ + 1} ${lastQYear}`;
        break;
      case 'current_year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        label = `${now.getFullYear()}`;
        break;
      case 'last_year':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        label = `${now.getFullYear() - 1}`;
        break;
      default:
        // Default to current quarter
        const defaultQ = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), defaultQ * 3, 1);
        end = new Date(now.getFullYear(), (defaultQ + 1) * 3, 0);
        label = `Q${defaultQ + 1} ${now.getFullYear()}`;
    }

    return { start, end, label };
  }

  // ============================================
  // Data Fetching
  // ============================================

  private async getCustomers(filters?: { segment?: string; csm_id?: string }): Promise<Customer[]> {
    if (this.supabase) {
      try {
        let query = this.supabase.from('customers').select('*').neq('stage', 'churned');

        if (filters?.segment) {
          // Filter by ARR ranges for segment
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
          segment: this.getSegmentFromARR(c.arr || 0),
          csm_id: c.csm_id,
          csm_name: c.csm_name,
          stage: c.stage || 'active',
          created_at: c.created_at,
          updated_at: c.updated_at
        }));
      } catch (error) {
        console.error('Error fetching customers from Supabase:', error);
        // Fall through to mock data
      }
    }

    // Return mock data (filtered)
    let customers = [...this.mockCustomers];
    if (filters?.segment) {
      customers = customers.filter(c => c.segment === filters.segment);
    }
    if (filters?.csm_id) {
      customers = customers.filter(c => c.csm_id === filters.csm_id);
    }
    return customers;
  }

  private async getMovements(
    startDate: Date,
    endDate: Date,
    filters?: { segment?: string; csm_id?: string }
  ): Promise<RevenueMovement[]> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('revenue_movements')
          .select('*, customers(name, segment)')
          .gte('movement_date', startDate.toISOString())
          .lte('movement_date', endDate.toISOString())
          .order('movement_date', { ascending: false });

        if (error) throw error;

        return (data || []).map(m => ({
          id: m.id,
          customer_id: m.customer_id,
          customer_name: m.customers?.name || 'Unknown',
          movement_date: m.movement_date,
          type: m.type,
          previous_arr: m.previous_arr || 0,
          new_arr: m.new_arr || 0,
          change_amount: m.change_amount || 0,
          reason: m.reason,
          source: m.source,
          created_at: m.created_at
        }));
      } catch (error) {
        console.error('Error fetching movements from Supabase:', error);
        // Fall through to mock data
      }
    }

    // Filter mock movements by date range
    return this.mockMovements.filter(m => {
      const movementDate = new Date(m.movement_date);
      return movementDate >= startDate && movementDate <= endDate;
    });
  }

  // ============================================
  // Main Analytics Methods
  // ============================================

  async getRevenueAnalytics(query: {
    period?: string;
    segment?: string;
    csm_id?: string;
  } = {}): Promise<{
    summary: any;
    movements: RevenueMovement[];
    trends: RevenueTrend[];
    by_segment: SegmentBreakdown[];
    by_csm: CSMBreakdown[];
  }> {
    const { start, end, label } = this.getPeriodDates(query.period || 'current_quarter');

    // Get current customers and movements
    const customers = await this.getCustomers({ segment: query.segment, csm_id: query.csm_id });
    const movements = await this.getMovements(start, end, { segment: query.segment, csm_id: query.csm_id });

    // Calculate totals
    const totalARR = customers.reduce((sum, c) => sum + (c.arr || 0), 0);
    const totalMRR = Math.round(totalARR / 12);
    const customerCount = customers.length;

    // Calculate movement totals
    const newBusiness = movements.filter(m => m.type === 'new').reduce((sum, m) => sum + m.change_amount, 0);
    const expansion = movements.filter(m => m.type === 'expansion').reduce((sum, m) => sum + m.change_amount, 0);
    const contraction = Math.abs(movements.filter(m => m.type === 'contraction').reduce((sum, m) => sum + m.change_amount, 0));
    const churn = Math.abs(movements.filter(m => m.type === 'churn').reduce((sum, m) => sum + m.change_amount, 0));
    const netChange = newBusiness + expansion - contraction - churn;

    // Calculate starting ARR (current - net change)
    const startingARR = totalARR - netChange;

    // Calculate retention metrics
    const grr = this.calculateGRR(startingARR, contraction, churn);
    const nrr = this.calculateNRR(startingARR, expansion, contraction, churn);
    const churnedCustomers = movements.filter(m => m.type === 'churn').length;
    const logoRetention = this.calculateLogoRetention(customerCount + churnedCustomers, churnedCustomers);

    // Calculate ARPA
    const arpa = customerCount > 0 ? Math.round(totalARR / customerCount) : 0;
    const previousArpa = customerCount > 0 ? Math.round(startingARR / (customerCount + churnedCustomers)) : 0;
    const arpaChange = arpa - previousArpa;
    const arpaChangePercent = previousArpa > 0 ? Math.round((arpaChange / previousArpa) * 100) : 0;

    // Build summary
    const summary = {
      period: query.period || 'current_quarter',
      period_label: label,
      totals: {
        starting_arr: startingARR,
        ending_arr: totalARR,
        starting_mrr: Math.round(startingARR / 12),
        ending_mrr: totalMRR,
        customer_count: customerCount,
        arr_change: netChange,
        arr_change_percent: startingARR > 0 ? Math.round((netChange / startingARR) * 100) : 0
      },
      movements: {
        new_business: newBusiness,
        expansion,
        contraction,
        churn,
        net_change: netChange
      },
      retention: {
        gross_retention: grr,
        net_retention: nrr,
        logo_retention: logoRetention,
        gross_retention_target: 92,
        net_retention_target: 105,
        logo_retention_target: 95
      },
      averages: {
        arpa,
        arpa_change: arpaChange,
        arpa_change_percent: arpaChangePercent,
        lifetime_value: Math.round(arpa * (100 / (100 - grr)) * 12) // Simple LTV calculation
      }
    };

    // Build segment breakdown
    const segmentGroups = new Map<string, Customer[]>();
    customers.forEach(c => {
      const segment = c.segment || this.getSegmentFromARR(c.arr);
      if (!segmentGroups.has(segment)) {
        segmentGroups.set(segment, []);
      }
      segmentGroups.get(segment)!.push(c);
    });

    const by_segment: SegmentBreakdown[] = [];
    for (const [segment, segCustomers] of segmentGroups) {
      const segARR = segCustomers.reduce((sum, c) => sum + (c.arr || 0), 0);
      const segMovements = movements.filter(m => {
        const customer = customers.find(c => c.id === m.customer_id);
        return customer && customer.segment === segment;
      });

      const segExpansion = segMovements.filter(m => m.type === 'expansion').reduce((sum, m) => sum + m.change_amount, 0);
      const segContraction = Math.abs(segMovements.filter(m => m.type === 'contraction').reduce((sum, m) => sum + m.change_amount, 0));
      const segChurn = Math.abs(segMovements.filter(m => m.type === 'churn').reduce((sum, m) => sum + m.change_amount, 0));
      const segStartingARR = segARR - segExpansion + segContraction + segChurn;

      by_segment.push({
        segment,
        segment_label: this.formatSegmentLabel(segment),
        arr: segARR,
        arr_percent: totalARR > 0 ? Math.round((segARR / totalARR) * 100) : 0,
        customer_count: segCustomers.length,
        nrr: this.calculateNRR(segStartingARR, segExpansion, segContraction, segChurn),
        grr: this.calculateGRR(segStartingARR, segContraction, segChurn),
        change_amount: segExpansion - segContraction - segChurn,
        change_percent: segStartingARR > 0 ? Math.round(((segExpansion - segContraction - segChurn) / segStartingARR) * 100) : 0,
        avg_arr: segCustomers.length > 0 ? Math.round(segARR / segCustomers.length) : 0
      });
    }

    // Sort by ARR descending
    by_segment.sort((a, b) => b.arr - a.arr);

    // Build CSM breakdown
    const csmGroups = new Map<string, { id: string; name: string; customers: Customer[] }>();
    customers.forEach(c => {
      const csmId = c.csm_id || 'unassigned';
      const csmName = c.csm_name || 'Unassigned';
      if (!csmGroups.has(csmId)) {
        csmGroups.set(csmId, { id: csmId, name: csmName, customers: [] });
      }
      csmGroups.get(csmId)!.customers.push(c);
    });

    const by_csm: CSMBreakdown[] = [];
    for (const [csmId, csmData] of csmGroups) {
      const csmARR = csmData.customers.reduce((sum, c) => sum + (c.arr || 0), 0);
      const csmMovements = movements.filter(m => {
        const customer = customers.find(c => c.id === m.customer_id);
        return customer && customer.csm_id === csmId;
      });

      const csmExpansion = csmMovements.filter(m => m.type === 'expansion').reduce((sum, m) => sum + m.change_amount, 0);
      const csmContraction = Math.abs(csmMovements.filter(m => m.type === 'contraction').reduce((sum, m) => sum + m.change_amount, 0));
      const csmChurn = Math.abs(csmMovements.filter(m => m.type === 'churn').reduce((sum, m) => sum + m.change_amount, 0));
      const csmStartingARR = csmARR - csmExpansion + csmContraction + csmChurn;

      by_csm.push({
        csm_id: csmId,
        csm_name: csmData.name,
        arr: csmARR,
        arr_percent: totalARR > 0 ? Math.round((csmARR / totalARR) * 100) : 0,
        customer_count: csmData.customers.length,
        nrr: this.calculateNRR(csmStartingARR, csmExpansion, csmContraction, csmChurn),
        grr: this.calculateGRR(csmStartingARR, csmContraction, csmChurn),
        expansion: csmExpansion,
        contraction: csmContraction,
        churn: csmChurn,
        net_change: csmExpansion - csmContraction - csmChurn
      });
    }

    // Sort CSM by ARR descending
    by_csm.sort((a, b) => b.arr - a.arr);

    // Build trends (last 12 months)
    const trends = await this.getRevenueTrends(12);

    return {
      summary,
      movements: movements.slice(0, 20), // Return top 20 movements
      trends,
      by_segment,
      by_csm
    };
  }

  async getRevenueTrends(periods: number = 12): Promise<RevenueTrend[]> {
    const trends: RevenueTrend[] = [];
    const now = new Date();

    // Generate mock trends for the last N months
    for (let i = periods - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      // Generate realistic growth pattern
      const baseARR = 800000;
      const growthFactor = 1 + (periods - i - 1) * 0.02; // ~2% monthly growth
      const variance = 0.98 + Math.random() * 0.04; // +/- 2% variance
      const arr = Math.round(baseARR * growthFactor * variance);

      trends.push({
        period: date.toISOString().split('T')[0],
        period_label: monthLabel,
        arr,
        mrr: Math.round(arr / 12),
        customer_count: Math.round(10 + (periods - i) * 0.5),
        nrr: 100 + Math.round(Math.random() * 15), // 100-115%
        grr: 88 + Math.round(Math.random() * 10)   // 88-98%
      });
    }

    return trends;
  }

  async getConcentrationAnalysis(): Promise<ConcentrationAnalysis> {
    const customers = await this.getCustomers();

    // Sort by ARR descending
    const sorted = [...customers].sort((a, b) => (b.arr || 0) - (a.arr || 0));
    const totalARR = sorted.reduce((sum, c) => sum + (c.arr || 0), 0);

    // Top 10 customers
    const top10 = sorted.slice(0, 10);
    const top10ARR = top10.reduce((sum, c) => sum + (c.arr || 0), 0);

    // Top 25 customers
    const top25 = sorted.slice(0, 25);
    const top25ARR = top25.reduce((sum, c) => sum + (c.arr || 0), 0);

    // Largest customer
    const largest = sorted[0];
    const largestPercent = totalARR > 0 ? (largest?.arr || 0) / totalARR * 100 : 0;

    // Determine risk level
    const riskThreshold = 10;
    let concentrationRisk: 'low' | 'medium' | 'high';
    let riskMessage: string;

    if (largestPercent >= riskThreshold * 1.5) {
      concentrationRisk = 'high';
      riskMessage = `High concentration risk: ${largest?.name || 'Unknown'} represents ${Math.round(largestPercent)}% of total ARR`;
    } else if (largestPercent >= riskThreshold) {
      concentrationRisk = 'medium';
      riskMessage = `Medium concentration risk: ${largest?.name || 'Unknown'} alone is ${Math.round(largestPercent)}% of total ARR`;
    } else {
      concentrationRisk = 'low';
      riskMessage = 'Revenue is well-distributed across the customer base';
    }

    return {
      total_arr: totalARR,
      top_10: {
        top_n: 10,
        arr: top10ARR,
        percent_of_total: totalARR > 0 ? Math.round((top10ARR / totalARR) * 100) : 0,
        customers: top10.map(c => ({
          id: c.id,
          name: c.name,
          arr: c.arr || 0,
          percent: totalARR > 0 ? Math.round(((c.arr || 0) / totalARR) * 100) : 0
        }))
      },
      top_25: {
        top_n: 25,
        arr: top25ARR,
        percent_of_total: totalARR > 0 ? Math.round((top25ARR / totalARR) * 100) : 0,
        customers: top25.map(c => ({
          id: c.id,
          name: c.name,
          arr: c.arr || 0,
          percent: totalARR > 0 ? Math.round(((c.arr || 0) / totalARR) * 100) : 0
        }))
      },
      largest_customer: {
        id: largest?.id || '',
        name: largest?.name || 'Unknown',
        arr: largest?.arr || 0,
        percent: Math.round(largestPercent)
      },
      concentration_risk: concentrationRisk,
      risk_threshold: riskThreshold,
      risk_message: riskMessage
    };
  }
}

// Export singleton instance
export const revenueAnalyticsService = new RevenueAnalyticsService();
