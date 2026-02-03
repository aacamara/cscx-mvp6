/**
 * Deal Desk Analytics Service
 * PRD-244: Deal Desk Integration
 *
 * Service for Deal Desk analytics including approval rates,
 * turnaround times, discount trends, and win rate correlations.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  AnalyticsSummary,
  ApprovalRateByType,
  TurnaroundByUrgency,
  AnalyticsResult,
  DealDeskRequestType,
  DealDeskUrgency,
} from './types.js';

// ============================================
// Request Type Labels
// ============================================

const REQUEST_TYPE_LABELS: Record<DealDeskRequestType, string> = {
  discount: 'Discount Request',
  payment_terms: 'Payment Terms',
  contract_amendment: 'Contract Amendment',
  custom_pricing: 'Custom Pricing',
  bundle: 'Bundle/Package',
};

const URGENCY_LABELS: Record<DealDeskUrgency, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  critical: 'Critical',
};

// ============================================
// Analytics Service
// ============================================

export class DealDeskAnalyticsService {
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  /**
   * Get comprehensive Deal Desk analytics
   */
  async getAnalytics(periodDays: number = 90): Promise<AnalyticsResult> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

    if (!this.supabase) {
      return this.getMockAnalytics(startDate, endDate);
    }

    try {
      const [summary, approvalRates, turnaround] = await Promise.all([
        this.getSummary(startDate, endDate),
        this.getApprovalRateByType(startDate, endDate),
        this.getTurnaroundByUrgency(startDate, endDate),
      ]);

      return {
        summary,
        approvalRateByType: approvalRates,
        turnaroundByUrgency: turnaround,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      };
    } catch (error) {
      console.error('[DealDesk Analytics] Error:', error);
      throw error;
    }
  }

  /**
   * Get summary statistics
   */
  private async getSummary(startDate: Date, endDate: Date): Promise<AnalyticsSummary> {
    if (!this.supabase) {
      return this.getMockSummary();
    }

    const { data: requests } = await this.supabase
      .from('deal_desk_requests')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (!requests || requests.length === 0) {
      return {
        totalRequests: 0,
        pendingRequests: 0,
        approvedRequests: 0,
        rejectedRequests: 0,
        avgTurnaroundHours: 0,
        slaBreachRate: 0,
        totalArrImpacted: 0,
      };
    }

    const total = requests.length;
    const pending = requests.filter((r) => r.status === 'pending' || r.status === 'in_review').length;
    const approved = requests.filter((r) => r.status === 'approved').length;
    const rejected = requests.filter((r) => r.status === 'rejected').length;
    const breached = requests.filter((r) => r.sla_breached).length;
    const totalArr = requests.reduce((sum, r) => sum + (r.current_arr || 0), 0);

    // Calculate average turnaround time for decided requests
    const decidedRequests = requests.filter((r) => r.decision_at);
    let avgTurnaround = 0;
    if (decidedRequests.length > 0) {
      const totalHours = decidedRequests.reduce((sum, r) => {
        const created = new Date(r.created_at).getTime();
        const decided = new Date(r.decision_at).getTime();
        return sum + (decided - created) / (1000 * 60 * 60);
      }, 0);
      avgTurnaround = Math.round(totalHours / decidedRequests.length);
    }

    return {
      totalRequests: total,
      pendingRequests: pending,
      approvedRequests: approved,
      rejectedRequests: rejected,
      avgTurnaroundHours: avgTurnaround,
      slaBreachRate: total > 0 ? Math.round((breached / total) * 100) : 0,
      totalArrImpacted: totalArr,
    };
  }

  /**
   * Get approval rate breakdown by request type
   */
  private async getApprovalRateByType(
    startDate: Date,
    endDate: Date
  ): Promise<ApprovalRateByType[]> {
    if (!this.supabase) {
      return this.getMockApprovalRates();
    }

    const { data: requests } = await this.supabase
      .from('deal_desk_requests')
      .select('request_type, status, discount_approved_pct')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .in('status', ['approved', 'rejected']);

    if (!requests || requests.length === 0) {
      return [];
    }

    // Group by request type
    const typeGroups: Record<DealDeskRequestType, {
      total: number;
      approved: number;
      rejected: number;
      discounts: number[];
    }> = {
      discount: { total: 0, approved: 0, rejected: 0, discounts: [] },
      payment_terms: { total: 0, approved: 0, rejected: 0, discounts: [] },
      contract_amendment: { total: 0, approved: 0, rejected: 0, discounts: [] },
      custom_pricing: { total: 0, approved: 0, rejected: 0, discounts: [] },
      bundle: { total: 0, approved: 0, rejected: 0, discounts: [] },
    };

    for (const request of requests) {
      const type = request.request_type as DealDeskRequestType;
      if (typeGroups[type]) {
        typeGroups[type].total++;
        if (request.status === 'approved') {
          typeGroups[type].approved++;
          if (request.discount_approved_pct !== null) {
            typeGroups[type].discounts.push(request.discount_approved_pct);
          }
        } else {
          typeGroups[type].rejected++;
        }
      }
    }

    // Convert to array format
    return Object.entries(typeGroups)
      .filter(([_, data]) => data.total > 0)
      .map(([type, data]) => ({
        requestType: type as DealDeskRequestType,
        total: data.total,
        approved: data.approved,
        rejected: data.rejected,
        approvalRate: Math.round((data.approved / data.total) * 100),
        avgDiscountApproved:
          data.discounts.length > 0
            ? Math.round(data.discounts.reduce((a, b) => a + b, 0) / data.discounts.length * 10) / 10
            : null,
      }));
  }

  /**
   * Get turnaround time by urgency level
   */
  private async getTurnaroundByUrgency(
    startDate: Date,
    endDate: Date
  ): Promise<TurnaroundByUrgency[]> {
    if (!this.supabase) {
      return this.getMockTurnaround();
    }

    const { data: requests } = await this.supabase
      .from('deal_desk_requests')
      .select('urgency, created_at, decision_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .not('decision_at', 'is', null);

    if (!requests || requests.length === 0) {
      return [];
    }

    // Group by urgency
    const urgencyGroups: Record<DealDeskUrgency, number[]> = {
      low: [],
      normal: [],
      high: [],
      critical: [],
    };

    for (const request of requests) {
      const urgency = request.urgency as DealDeskUrgency;
      if (urgencyGroups[urgency]) {
        const created = new Date(request.created_at).getTime();
        const decided = new Date(request.decision_at).getTime();
        const hours = (decided - created) / (1000 * 60 * 60);
        urgencyGroups[urgency].push(hours);
      }
    }

    // Calculate stats
    return Object.entries(urgencyGroups)
      .filter(([_, hours]) => hours.length > 0)
      .map(([urgency, hours]) => {
        const sorted = hours.sort((a, b) => a - b);
        const avg = hours.reduce((a, b) => a + b, 0) / hours.length;
        const median = sorted[Math.floor(sorted.length / 2)];

        return {
          urgency: urgency as DealDeskUrgency,
          avgHours: Math.round(avg * 10) / 10,
          medianHours: Math.round(median * 10) / 10,
          count: hours.length,
        };
      });
  }

  /**
   * Get discount trends by customer segment over time
   */
  async getDiscountTrends(
    periodMonths: number = 6
  ): Promise<Array<{
    segment: string;
    month: string;
    avgDiscountRequested: number;
    avgDiscountApproved: number;
    requestCount: number;
  }>> {
    if (!this.supabase) {
      return this.getMockDiscountTrends();
    }

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - periodMonths);

    const { data: requests } = await this.supabase
      .from('deal_desk_requests')
      .select(`
        discount_requested_pct,
        discount_approved_pct,
        created_at,
        customers!inner(segment)
      `)
      .gte('created_at', startDate.toISOString())
      .eq('request_type', 'discount');

    if (!requests || requests.length === 0) {
      return [];
    }

    // Group by segment and month
    const groups: Record<string, Record<string, {
      requested: number[];
      approved: number[];
    }>> = {};

    for (const request of requests) {
      const segment = (request as any).customers?.segment || 'Unknown';
      const month = new Date(request.created_at).toISOString().slice(0, 7);

      if (!groups[segment]) groups[segment] = {};
      if (!groups[segment][month]) groups[segment][month] = { requested: [], approved: [] };

      if (request.discount_requested_pct !== null) {
        groups[segment][month].requested.push(request.discount_requested_pct);
      }
      if (request.discount_approved_pct !== null) {
        groups[segment][month].approved.push(request.discount_approved_pct);
      }
    }

    // Flatten to array
    const result: Array<{
      segment: string;
      month: string;
      avgDiscountRequested: number;
      avgDiscountApproved: number;
      requestCount: number;
    }> = [];

    for (const [segment, months] of Object.entries(groups)) {
      for (const [month, data] of Object.entries(months)) {
        const avgRequested = data.requested.length > 0
          ? data.requested.reduce((a, b) => a + b, 0) / data.requested.length
          : 0;
        const avgApproved = data.approved.length > 0
          ? data.approved.reduce((a, b) => a + b, 0) / data.approved.length
          : 0;

        result.push({
          segment,
          month,
          avgDiscountRequested: Math.round(avgRequested * 10) / 10,
          avgDiscountApproved: Math.round(avgApproved * 10) / 10,
          requestCount: data.requested.length,
        });
      }
    }

    return result.sort((a, b) => `${a.segment}-${a.month}`.localeCompare(`${b.segment}-${b.month}`));
  }

  /**
   * Get win rate correlation with Deal Desk involvement
   */
  async getWinRateCorrelation(): Promise<{
    withDealDesk: { deals: number; wonDeals: number; winRate: number; avgDiscount: number };
    withoutDealDesk: { deals: number; wonDeals: number; winRate: number; avgDiscount: number };
    correlation: number;
  }> {
    if (!this.supabase) {
      return this.getMockWinRateCorrelation();
    }

    // This would require integration with Salesforce opportunity data
    // For now, return mock data structure
    return this.getMockWinRateCorrelation();
  }

  /**
   * Get revenue impact analysis
   */
  async getRevenueImpact(
    periodMonths: number = 12
  ): Promise<Array<{
    period: string;
    discountGiven: number;
    revenueRetained: number;
    netImpact: number;
    dealsCount: number;
  }>> {
    if (!this.supabase) {
      return this.getMockRevenueImpact();
    }

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - periodMonths);

    const { data: requests } = await this.supabase
      .from('deal_desk_requests')
      .select('current_arr, discount_approved_pct, created_at')
      .gte('created_at', startDate.toISOString())
      .eq('status', 'approved');

    if (!requests || requests.length === 0) {
      return [];
    }

    // Group by month
    const monthGroups: Record<string, {
      discountGiven: number;
      revenueRetained: number;
      count: number;
    }> = {};

    for (const request of requests) {
      const month = new Date(request.created_at).toISOString().slice(0, 7);
      const arr = request.current_arr || 0;
      const discountPct = request.discount_approved_pct || 0;
      const discountAmount = (arr * discountPct) / 100;
      const retained = arr - discountAmount;

      if (!monthGroups[month]) {
        monthGroups[month] = { discountGiven: 0, revenueRetained: 0, count: 0 };
      }

      monthGroups[month].discountGiven += discountAmount;
      monthGroups[month].revenueRetained += retained;
      monthGroups[month].count++;
    }

    return Object.entries(monthGroups)
      .map(([month, data]) => ({
        period: month,
        discountGiven: Math.round(data.discountGiven),
        revenueRetained: Math.round(data.revenueRetained),
        netImpact: Math.round(data.revenueRetained - data.discountGiven),
        dealsCount: data.count,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  // ============================================
  // Mock Data for Development
  // ============================================

  private getMockAnalytics(startDate: Date, endDate: Date): AnalyticsResult {
    return {
      summary: this.getMockSummary(),
      approvalRateByType: this.getMockApprovalRates(),
      turnaroundByUrgency: this.getMockTurnaround(),
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  }

  private getMockSummary(): AnalyticsSummary {
    return {
      totalRequests: 124,
      pendingRequests: 8,
      approvedRequests: 98,
      rejectedRequests: 18,
      avgTurnaroundHours: 18,
      slaBreachRate: 5,
      totalArrImpacted: 4250000,
    };
  }

  private getMockApprovalRates(): ApprovalRateByType[] {
    return [
      { requestType: 'discount', total: 65, approved: 52, rejected: 13, approvalRate: 80, avgDiscountApproved: 12.5 },
      { requestType: 'payment_terms', total: 28, approved: 24, rejected: 4, approvalRate: 86, avgDiscountApproved: null },
      { requestType: 'contract_amendment', total: 15, approved: 12, rejected: 3, approvalRate: 80, avgDiscountApproved: null },
      { requestType: 'custom_pricing', total: 10, approved: 6, rejected: 4, approvalRate: 60, avgDiscountApproved: 18.2 },
      { requestType: 'bundle', total: 6, approved: 4, rejected: 2, approvalRate: 67, avgDiscountApproved: 15.0 },
    ];
  }

  private getMockTurnaround(): TurnaroundByUrgency[] {
    return [
      { urgency: 'critical', avgHours: 4.2, medianHours: 3.5, count: 12 },
      { urgency: 'high', avgHours: 8.5, medianHours: 7.2, count: 28 },
      { urgency: 'normal', avgHours: 18.4, medianHours: 16.0, count: 68 },
      { urgency: 'low', avgHours: 28.6, medianHours: 24.0, count: 16 },
    ];
  }

  private getMockDiscountTrends(): Array<{
    segment: string;
    month: string;
    avgDiscountRequested: number;
    avgDiscountApproved: number;
    requestCount: number;
  }> {
    const months = ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01'];
    const segments = ['Enterprise', 'Mid-Market', 'SMB'];
    const result: Array<any> = [];

    for (const segment of segments) {
      for (const month of months) {
        result.push({
          segment,
          month,
          avgDiscountRequested: 15 + Math.random() * 10,
          avgDiscountApproved: 10 + Math.random() * 8,
          requestCount: Math.floor(5 + Math.random() * 15),
        });
      }
    }

    return result;
  }

  private getMockWinRateCorrelation() {
    return {
      withDealDesk: { deals: 156, wonDeals: 124, winRate: 79.5, avgDiscount: 12.3 },
      withoutDealDesk: { deals: 342, wonDeals: 239, winRate: 69.9, avgDiscount: 5.2 },
      correlation: 0.68,
    };
  }

  private getMockRevenueImpact(): Array<{
    period: string;
    discountGiven: number;
    revenueRetained: number;
    netImpact: number;
    dealsCount: number;
  }> {
    const months = ['2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01'];
    return months.map((month) => {
      const baseRevenue = 300000 + Math.random() * 200000;
      const discountPct = 0.08 + Math.random() * 0.06;
      const discountGiven = Math.round(baseRevenue * discountPct);
      const revenueRetained = Math.round(baseRevenue - discountGiven);

      return {
        period: month,
        discountGiven,
        revenueRetained,
        netImpact: revenueRetained - discountGiven,
        dealsCount: Math.floor(8 + Math.random() * 12),
      };
    });
  }
}

// Singleton instance
export const dealDeskAnalyticsService = new DealDeskAnalyticsService();
